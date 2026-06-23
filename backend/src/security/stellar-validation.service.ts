import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { rpc, xdr } from '@stellar/stellar-sdk';

type ValidateTxInput = {
  txHash: string;
  expectedFunction?: string;
};

@Injectable()
export class StellarValidationService {
  private readonly logger = new Logger(StellarValidationService.name);
  private readonly server: rpc.Server;
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    const rpcUrl = config.get<string>('VITE_STELLAR_RPC_URL') || 'https://soroban-testnet.stellar.org';
    this.server = new rpc.Server(rpcUrl);
    this.enabled = config.get<string>('ENABLE_STELLAR_TX_VALIDATION') === 'true';
  }

  async validateBountyCreationTx(input: ValidateTxInput) {
    await this.validateSuccessfulContractTx({
      ...input,
      expectedFunction: input.expectedFunction || 'create_bounty',
    });
  }

  async validateReportSubmissionTx(input: ValidateTxInput) {
    await this.validateSuccessfulContractTx({
      ...input,
      expectedFunction: input.expectedFunction || 'submit_report',
    });
  }

  async validateReportReviewTx(input: ValidateTxInput & { approved: boolean }) {
    await this.validateSuccessfulContractTx({
      ...input,
      expectedFunction:
        input.expectedFunction || (input.approved ? 'approve_report' : 'reject_report'),
    });
  }

  async validateRewardClaimTx(input: ValidateTxInput) {
    await this.validateSuccessfulContractTx({
      ...input,
      expectedFunction: input.expectedFunction || 'claim_reward',
    });
  }

  async validateRefundTx(input: ValidateTxInput) {
    await this.validateSuccessfulContractTx({
      ...input,
      expectedFunction: input.expectedFunction || 'refund_expired_bounty',
    });
  }

  private async validateSuccessfulContractTx(input: ValidateTxInput) {
    if (!this.enabled) return;

    try {
      const txResult = (await this.server.getTransaction(input.txHash)) as any;
      if (txResult.status !== 'SUCCESS') {
        throw new BadRequestException('Transaction was not successful on-chain');
      }

      const functionName = this.tryReadInvokedFunctionName(txResult.envelopeXdr);
      if (functionName && input.expectedFunction && functionName !== input.expectedFunction) {
        throw new BadRequestException(
          `Expected ${input.expectedFunction} transaction but found ${functionName}`,
        );
      }

      if (!functionName && input.expectedFunction) {
        this.logger.warn(
          `Unable to decode invoked function for ${input.txHash}; RPC SUCCESS was verified only.`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown validation error';
      throw new BadRequestException(`On-chain transaction verification failed: ${message}`);
    }
  }

  private tryReadInvokedFunctionName(envelopeXdr?: string): string | null {
    if (!envelopeXdr) return null;

    try {
      const envelope = xdr.TransactionEnvelope.fromXDR(envelopeXdr, 'base64') as any;
      const tx = envelope.value();
      const operations = tx.operations?.() || [];
      const invokeOperation = operations.find((operation: any) => {
        const body = operation.body?.();
        return String(body?.switch?.()).includes('invokeHostFunction');
      });

      if (!invokeOperation) return null;

      const hostFunction = invokeOperation.body().invokeHostFunctionOp().hostFunction();
      const invokeContract = hostFunction.invokeContract?.();
      const functionName = invokeContract?.functionName?.();

      return functionName ? String(functionName) : null;
    } catch {
      return null;
    }
  }
}
