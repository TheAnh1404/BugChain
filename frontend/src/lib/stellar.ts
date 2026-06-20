/// <reference types="vite/client" />
import { signTransaction } from '@stellar/freighter-api';
import {
  Address,
  Asset,
  BASE_FEE,
  Contract,
  nativeToScVal,
  Networks,
  scValToNative,
  StrKey,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { Server as SorobanRpcServer } from '@stellar/stellar-sdk/rpc';
import { connectFreighterTestnet, STELLAR_TESTNET_NETWORK, STELLAR_TESTNET_PASSPHRASE } from './freighter';

const SOROBAN_RPC_URL = import.meta.env.VITE_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const STELLAR_EXPERT_TESTNET_TX_URL = import.meta.env.VITE_STELLAR_EXPERT_TX_URL || 'https://stellar.expert/explorer/testnet/tx';
const NETWORK_PASSPHRASE = import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE || STELLAR_TESTNET_PASSPHRASE;
const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID;
const TOKEN_DECIMALS = 7;

type BountyMetadata = {
  title: string;
  description: string;
  scope: string;
  severity: string;
  rewardAmount: string;
  deadline: string;
};

type CreateBountyOnChainInput = {
  owner?: string;
  rewardAsset: string;
  rewardAmount: string;
  deadline: string;
  metadataHash: string;
};

type CreateBountyOnChainResult = {
  txHash: string;
  onchainBountyId: string;
  metadataHash: string;
  stellarExplorerUrl: string;
};

function requireContractId() {
  if (!CONTRACT_ID || !StrKey.isValidContract(CONTRACT_ID)) {
    throw new Error('Missing or invalid VITE_CONTRACT_ID. Set it to your deployed BugChain Testnet contract ID.');
  }

  return CONTRACT_ID;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[a-fA-F0-9]{64}$/.test(hex)) {
    throw new Error('metadataHash must be a 32-byte SHA-256 hex string.');
  }

  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function normalizeError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

function toStroops(amount: string): bigint {
  const normalized = amount.trim();
  if (!/^\d+(\.\d{1,7})?$/.test(normalized)) {
    throw new Error('Reward amount must be a positive decimal with up to 7 decimal places.');
  }

  const [whole, fraction = ''] = normalized.split('.');
  const paddedFraction = fraction.padEnd(TOKEN_DECIMALS, '0');
  const stroops = `${whole}${paddedFraction}`.replace(/^0+(?=\d)/, '');

  return BigInt(stroops);
}

function resolveAssetContractId(rewardAsset: string) {
  const asset = rewardAsset.trim().toUpperCase();

  if (!asset || asset === 'XLM') {
    return Asset.native().contractId(Networks.TESTNET);
  }

  if (StrKey.isValidContract(asset)) {
    return asset;
  }

  const [code, issuer] = asset.split(':');
  if (code && issuer && /^[A-Z0-9]{1,12}$/.test(code) && StrKey.isValidEd25519PublicKey(issuer)) {
    return new Asset(code, issuer).contractId(Networks.TESTNET);
  }

  throw new Error('Reward asset must be XLM, a Stellar asset contract ID, or CODE:G... issuer format.');
}

function parseOnChainId(returnValue: any, fieldName: string) {
  if (!returnValue) {
    throw new Error(`Soroban transaction succeeded but did not return a ${fieldName}.`);
  }

  const nativeValue = scValToNative(returnValue);

  if (typeof nativeValue === 'bigint') {
    return nativeValue.toString();
  }

  if (typeof nativeValue === 'number' || typeof nativeValue === 'string') {
    return String(nativeValue);
  }

  throw new Error(`Unable to decode on-chain ${fieldName} from Soroban return value.`);
}

function parseBountyId(returnValue: any) {
  return parseOnChainId(returnValue, 'bounty ID');
}

function parseReportId(returnValue: any) {
  return parseOnChainId(returnValue, 'report ID');
}

async function pollSuccessfulTransaction(server: SorobanRpcServer, txHash: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await server.getTransaction(txHash);

    if (result.status === 'SUCCESS') {
      return result;
    }

    if (result.status === 'FAILED') {
      throw new Error('Soroban transaction failed on Stellar Testnet.');
    }

    await sleep(1000);
  }

  throw new Error('Timed out while waiting for Stellar Testnet transaction confirmation.');
}

export function buildBountyMetadata(input: BountyMetadata): BountyMetadata {
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    scope: input.scope.trim(),
    severity: input.severity,
    rewardAmount: input.rewardAmount.trim(),
    deadline: new Date(input.deadline).toISOString(),
  };
}

export async function hashBountyMetadata(metadata: BountyMetadata) {
  if (!window.crypto?.subtle) {
    throw new Error('Browser Web Crypto API is required to hash bounty metadata.');
  }

  const encoded = new TextEncoder().encode(stableStringify(metadata));
  const digest = await window.crypto.subtle.digest('SHA-256', encoded);

  return bytesToHex(new Uint8Array(digest));
}

export function getStellarExplorerTxUrl(txHash: string) {
  return `${STELLAR_EXPERT_TESTNET_TX_URL}/${txHash}`;
}

export async function createBountyOnChain(
  input: CreateBountyOnChainInput,
): Promise<CreateBountyOnChainResult> {
  const contractId = requireContractId();
  const { address } = await connectFreighterTestnet();
  const owner = input.owner || address;

  if (owner !== address) {
    throw new Error('Connected Freighter wallet does not match the bounty owner wallet.');
  }

  const server = new SorobanRpcServer(SOROBAN_RPC_URL);
  const sourceAccount = await server.getAccount(owner);
  const contract = new Contract(contractId);
  const assetContractId = resolveAssetContractId(input.rewardAsset);
  const deadlineSeconds = BigInt(Math.floor(new Date(input.deadline).getTime() / 1000));
  const rewardAmount = toStroops(input.rewardAmount);
  const metadataBytes = hexToBytes(input.metadataHash);

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'create_bounty',
        new Address(owner).toScVal(),
        new Address(assetContractId).toScVal(),
        nativeToScVal(rewardAmount, { type: 'i128' }),
        nativeToScVal(deadlineSeconds, { type: 'u64' }),
        nativeToScVal(metadataBytes, { type: 'bytes' }),
      ),
    )
    .setTimeout(60)
    .build();

  let preparedTransaction;
  try {
    preparedTransaction = await server.prepareTransaction(transaction);
  } catch (error) {
    throw new Error(`Soroban simulation failed: ${normalizeError(error, 'Unable to prepare transaction.')}`);
  }

  const signed = await signTransaction(preparedTransaction.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
    address: owner,
  });

  if (signed.error) {
    throw new Error(signed.error.message || 'Freighter rejected the transaction signature.');
  }

  const signedTransaction = TransactionBuilder.fromXDR(
    signed.signedTxXdr,
    NETWORK_PASSPHRASE,
  );

  const submitted = await server.sendTransaction(signedTransaction);

  if (submitted.status === 'ERROR') {
    throw new Error('Stellar Testnet rejected the transaction before confirmation.');
  }

  if (!submitted.hash) {
    throw new Error('Stellar RPC did not return a transaction hash.');
  }

  const confirmed = await pollSuccessfulTransaction(server, submitted.hash);
  const txHash = (confirmed.txHash || submitted.hash).toLowerCase();

  return {
    txHash,
    onchainBountyId: parseBountyId(confirmed.returnValue),
    metadataHash: input.metadataHash,
    stellarExplorerUrl: getStellarExplorerTxUrl(txHash),
  };
}

export type ReportMetadata = {
  bountyId: string;
  onchainBountyId: string;
  title: string;
  severity: string;
  description: string;
  stepsToReproduce: string;
  impact: string;
  recommendation: string;
  hunterWallet: string;
};

export type SubmitReportOnChainInput = {
  hunterAddress: string;
  onchainBountyId: string;
  reportHash: string;
};

export type SubmitReportOnChainResult = {
  txHash: string;
  onchainReportId: string;
  stellarExplorerUrl: string;
};

export async function hashReportMetadata(metadata: ReportMetadata): Promise<string> {
  if (!window.crypto?.subtle) {
    throw new Error('Browser Web Crypto API is required to hash report metadata.');
  }

  const canonical: ReportMetadata = {
    bountyId: metadata.bountyId.trim(),
    onchainBountyId: metadata.onchainBountyId.trim(),
    title: metadata.title.trim(),
    severity: metadata.severity,
    description: metadata.description.trim(),
    stepsToReproduce: metadata.stepsToReproduce.trim(),
    impact: metadata.impact.trim(),
    recommendation: metadata.recommendation.trim(),
    hunterWallet: metadata.hunterWallet.trim(),
  };

  const encoded = new TextEncoder().encode(stableStringify(canonical));
  const digest = await window.crypto.subtle.digest('SHA-256', encoded);

  return bytesToHex(new Uint8Array(digest));
}

export async function submitReportOnChain(
  input: SubmitReportOnChainInput,
): Promise<SubmitReportOnChainResult> {
  const contractId = requireContractId();
  const { address, network } = await connectFreighterTestnet();

  if (input.hunterAddress !== address) {
    throw new Error('Connected Freighter wallet does not match the reporter wallet.');
  }

  if (network !== STELLAR_TESTNET_NETWORK) {
    throw new Error('Please switch Freighter to Stellar Testnet.');
  }

  const server = new SorobanRpcServer(SOROBAN_RPC_URL);
  const sourceAccount = await server.getAccount(address);
  const contract = new Contract(contractId);
  const reportHashBytes = hexToBytes(input.reportHash);

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'submit_report',
        new Address(address).toScVal(),
        nativeToScVal(BigInt(input.onchainBountyId), { type: 'u64' }),
        nativeToScVal(reportHashBytes, { type: 'bytes' }),
      ),
    )
    .setTimeout(60)
    .build();

  let preparedTransaction;
  try {
    preparedTransaction = await server.prepareTransaction(transaction);
  } catch (error) {
    throw new Error(`Soroban simulation failed: ${normalizeError(error, 'Unable to prepare transaction.')}`);
  }

  const signed = await signTransaction(preparedTransaction.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
    address,
  });

  if (signed.error) {
    throw new Error(signed.error.message || 'Freighter rejected the transaction signature.');
  }

  const signedTransaction = TransactionBuilder.fromXDR(
    signed.signedTxXdr,
    NETWORK_PASSPHRASE,
  );

  const submitted = await server.sendTransaction(signedTransaction);

  if (submitted.status === 'ERROR') {
    throw new Error('Stellar Testnet rejected the transaction before confirmation.');
  }

  if (!submitted.hash) {
    throw new Error('Stellar RPC did not return a transaction hash.');
  }

  const confirmed = await pollSuccessfulTransaction(server, submitted.hash);
  const txHash = (confirmed.txHash || submitted.hash).toLowerCase();

  return {
    txHash,
    onchainReportId: parseReportId(confirmed.returnValue),
    stellarExplorerUrl: getStellarExplorerTxUrl(txHash),
  };
}

export type ApproveReportOnChainInput = {
  ownerAddress: string;
  onchainBountyId: string;
  onchainReportId: string;
};

export type ApproveReportOnChainResult = {
  txHash: string;
  stellarExplorerUrl: string;
};

export async function approveReportOnChain(
  input: ApproveReportOnChainInput,
): Promise<ApproveReportOnChainResult> {
  const contractId = requireContractId();
  const { address, network } = await connectFreighterTestnet();

  if (input.ownerAddress !== address) {
    throw new Error('Connected Freighter wallet does not match the bounty owner wallet.');
  }

  if (network !== STELLAR_TESTNET_NETWORK) {
    throw new Error('Please switch Freighter to Stellar Testnet.');
  }

  const server = new SorobanRpcServer(SOROBAN_RPC_URL);
  const sourceAccount = await server.getAccount(address);
  const contract = new Contract(contractId);

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'approve_report',
        new Address(address).toScVal(),
        nativeToScVal(BigInt(input.onchainBountyId), { type: 'u64' }),
        nativeToScVal(BigInt(input.onchainReportId), { type: 'u64' }),
      ),
    )
    .setTimeout(60)
    .build();

  let preparedTransaction;
  try {
    preparedTransaction = await server.prepareTransaction(transaction);
  } catch (error) {
    throw new Error(`Soroban simulation failed: ${normalizeError(error, 'Unable to prepare transaction.')}`);
  }

  const signed = await signTransaction(preparedTransaction.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
    address,
  });

  if (signed.error) {
    throw new Error(signed.error.message || 'Freighter rejected the transaction signature.');
  }

  const signedTransaction = TransactionBuilder.fromXDR(
    signed.signedTxXdr,
    NETWORK_PASSPHRASE,
  );

  const submitted = await server.sendTransaction(signedTransaction);

  if (submitted.status === 'ERROR') {
    throw new Error('Stellar Testnet rejected the transaction before confirmation.');
  }

  if (!submitted.hash) {
    throw new Error('Stellar RPC did not return a transaction hash.');
  }

  const confirmed = await pollSuccessfulTransaction(server, submitted.hash);
  const txHash = (confirmed.txHash || submitted.hash).toLowerCase();

  return {
    txHash,
    stellarExplorerUrl: getStellarExplorerTxUrl(txHash),
  };
}

export type RejectReportOnChainInput = {
  ownerAddress: string;
  onchainBountyId: string;
  onchainReportId: string;
};

export type RejectReportOnChainResult = {
  txHash: string;
  stellarExplorerUrl: string;
};

export async function rejectReportOnChain(
  input: RejectReportOnChainInput,
): Promise<RejectReportOnChainResult> {
  const contractId = requireContractId();
  const { address, network } = await connectFreighterTestnet();

  if (input.ownerAddress !== address) {
    throw new Error('Connected Freighter wallet does not match the bounty owner wallet.');
  }

  if (network !== STELLAR_TESTNET_NETWORK) {
    throw new Error('Please switch Freighter to Stellar Testnet.');
  }

  const server = new SorobanRpcServer(SOROBAN_RPC_URL);
  const sourceAccount = await server.getAccount(address);
  const contract = new Contract(contractId);

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'reject_report',
        new Address(address).toScVal(),
        nativeToScVal(BigInt(input.onchainBountyId), { type: 'u64' }),
        nativeToScVal(BigInt(input.onchainReportId), { type: 'u64' }),
      ),
    )
    .setTimeout(60)
    .build();

  let preparedTransaction;
  try {
    preparedTransaction = await server.prepareTransaction(transaction);
  } catch (error) {
    throw new Error(`Soroban simulation failed: ${normalizeError(error, 'Unable to prepare transaction.')}`);
  }

  const signed = await signTransaction(preparedTransaction.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
    address,
  });

  if (signed.error) {
    throw new Error(signed.error.message || 'Freighter rejected the transaction signature.');
  }

  const signedTransaction = TransactionBuilder.fromXDR(
    signed.signedTxXdr,
    NETWORK_PASSPHRASE,
  );

  const submitted = await server.sendTransaction(signedTransaction);

  if (submitted.status === 'ERROR') {
    throw new Error('Stellar Testnet rejected the transaction before confirmation.');
  }

  if (!submitted.hash) {
    throw new Error('Stellar RPC did not return a transaction hash.');
  }

  const confirmed = await pollSuccessfulTransaction(server, submitted.hash);
  const txHash = (confirmed.txHash || submitted.hash).toLowerCase();

  return {
    txHash,
    stellarExplorerUrl: getStellarExplorerTxUrl(txHash),
  };
}

export type ClaimRewardOnChainInput = {
  hunterAddress: string;
  onchainBountyId: string;
  onchainReportId: string;
};

export type ClaimRewardOnChainResult = {
  txHash: string;
  stellarExplorerUrl: string;
};

export async function claimRewardOnChain(
  input: ClaimRewardOnChainInput,
): Promise<ClaimRewardOnChainResult> {
  const contractId = requireContractId();
  const { address, network } = await connectFreighterTestnet();

  if (input.hunterAddress !== address) {
    throw new Error('Connected Freighter wallet does not match the hunter wallet.');
  }

  if (network !== STELLAR_TESTNET_NETWORK) {
    throw new Error('Please switch Freighter to Stellar Testnet.');
  }

  const server = new SorobanRpcServer(SOROBAN_RPC_URL);
  const sourceAccount = await server.getAccount(address);
  const contract = new Contract(contractId);

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'claim_reward',
        new Address(address).toScVal(),
        nativeToScVal(BigInt(input.onchainBountyId), { type: 'u64' }),
        nativeToScVal(BigInt(input.onchainReportId), { type: 'u64' }),
      ),
    )
    .setTimeout(60)
    .build();

  let preparedTransaction;
  try {
    preparedTransaction = await server.prepareTransaction(transaction);
  } catch (error) {
    throw new Error(`Soroban simulation failed: ${normalizeError(error, 'Unable to prepare transaction.')}`);
  }

  const signed = await signTransaction(preparedTransaction.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
    address,
  });

  if (signed.error) {
    throw new Error(signed.error.message || 'Freighter rejected the transaction signature.');
  }

  const signedTransaction = TransactionBuilder.fromXDR(
    signed.signedTxXdr,
    NETWORK_PASSPHRASE,
  );

  const submitted = await server.sendTransaction(signedTransaction);

  if (submitted.status === 'ERROR') {
    throw new Error('Stellar Testnet rejected the transaction before confirmation.');
  }

  if (!submitted.hash) {
    throw new Error('Stellar RPC did not return a transaction hash.');
  }

  const confirmed = await pollSuccessfulTransaction(server, submitted.hash);
  const txHash = (confirmed.txHash || submitted.hash).toLowerCase();

  return {
    txHash,
    stellarExplorerUrl: getStellarExplorerTxUrl(txHash),
  };
}

export type RefundExpiredBountyOnChainInput = {
  ownerAddress: string;
  onchainBountyId: string;
};

export type RefundExpiredBountyOnChainResult = {
  txHash: string;
  stellarExplorerUrl: string;
};

export async function refundExpiredBountyOnChain(
  input: RefundExpiredBountyOnChainInput,
): Promise<RefundExpiredBountyOnChainResult> {
  const contractId = requireContractId();
  const { address, network } = await connectFreighterTestnet();

  if (input.ownerAddress !== address) {
    throw new Error('Connected Freighter wallet does not match the bounty owner wallet.');
  }

  if (network !== STELLAR_TESTNET_NETWORK) {
    throw new Error('Please switch Freighter to Stellar Testnet.');
  }

  const server = new SorobanRpcServer(SOROBAN_RPC_URL);
  const sourceAccount = await server.getAccount(address);
  const contract = new Contract(contractId);

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'refund_expired_bounty',
        new Address(address).toScVal(),
        nativeToScVal(BigInt(input.onchainBountyId), { type: 'u64' }),
      ),
    )
    .setTimeout(60)
    .build();

  let preparedTransaction;
  try {
    preparedTransaction = await server.prepareTransaction(transaction);
  } catch (error) {
    throw new Error(`Soroban simulation failed: ${normalizeError(error, 'Unable to prepare transaction.')}`);
  }

  const signed = await signTransaction(preparedTransaction.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
    address,
  });

  if (signed.error) {
    throw new Error(signed.error.message || 'Freighter rejected the transaction signature.');
  }

  const signedTransaction = TransactionBuilder.fromXDR(
    signed.signedTxXdr,
    NETWORK_PASSPHRASE,
  );

  const submitted = await server.sendTransaction(signedTransaction);

  if (submitted.status === 'ERROR') {
    throw new Error('Stellar Testnet rejected the transaction before confirmation.');
  }

  if (!submitted.hash) {
    throw new Error('Stellar RPC did not return a transaction hash.');
  }

  const confirmed = await pollSuccessfulTransaction(server, submitted.hash);
  const txHash = (confirmed.txHash || submitted.hash).toLowerCase();

  return {
    txHash,
    stellarExplorerUrl: getStellarExplorerTxUrl(txHash),
  };
}
