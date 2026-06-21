# BugChain - Hybrid Web2/Web3 Bug Bounty Platform

BugChain is a Level 2 hybrid bug bounty app. Rich bounty/report metadata, user accounts, wallet links, review comments, and transaction records are stored in the NestJS/PostgreSQL backend. Escrow, report hashes, approvals, claims, refunds, and audit events are executed by the deployed Soroban contract on Stellar Testnet.

Deployed Testnet contract:

```text
CBRSQQ3WTR4S32JKUMO2E3MA6P3EX5IH6YC6FR4HWIZFC72TBRXBNSCS
```

## Level 2 Scope

BugChain supports:

- Multiple linked Stellar wallets through Freighter.
- Real Soroban transactions for create bounty, submit report, approve report, reject report, claim reward, and refund expired bounty.
- Transaction lifecycle tracking with `PENDING`, `SUCCESS`, and `FAILED`.
- Real-time frontend updates through Server-Sent Events at `GET /events/stream`.
- Contract event sync for `bounty_created`, `report_submitted`, `report_approved`, `report_rejected`, `reward_claimed`, and `bounty_refunded`.
- Error handling across contract errors, wallet/signing errors, and API validation/sync errors.

BugChain does not claim support for multiple wallet providers yet. The current wallet provider is Freighter.

## Architecture Diagram

```mermaid
graph TD
    Frontend[React + Vite Frontend]
    Freighter[Freighter Wallet]
    Backend[NestJS Backend]
    Database[(PostgreSQL)]
    EventSync[Contract Event Sync]
    SSE[GET /events/stream SSE]
    RPC[Soroban RPC]
    Contract[BugChain Soroban Contract]
    Stellar[Stellar Testnet]

    Frontend -->|REST API| Backend
    Frontend -->|subscribe| SSE
    SSE --> Backend
    Frontend -->|sign transactions/messages| Freighter
    Frontend -->|submit signed tx| RPC
    Freighter -->|Ed25519 signatures| Frontend
    Backend --> Database
    Backend --> EventSync
    EventSync -->|poll contract events every 10s| RPC
    RPC --> Contract
    Contract --> Stellar
```

## System Flow

```mermaid
sequenceDiagram
    actor User
    participant UI as Frontend
    participant API as Backend API
    participant Wallet as Freighter
    participant RPC as Soroban RPC
    participant Contract as Soroban Contract
    participant DB as PostgreSQL

    User->>UI: Start on-chain action
    UI->>API: Create transaction record
    API->>DB: status = PENDING
    API-->>UI: transactionId
    UI->>Wallet: Request signature
    Wallet-->>UI: Signed transaction
    UI->>RPC: Submit signed transaction
    RPC->>Contract: Invoke method
    Contract-->>RPC: Emit contract event
    RPC-->>UI: txHash
    UI->>API: Sync txHash + transactionId
    API->>DB: status = SUCCESS
    API-->>UI: Updated resource
    API-->>UI: SSE transaction_updated / contract event
```

If signing or submission fails before confirmation, the frontend calls the backend fail endpoint and the transaction record moves to `FAILED`.

## Contract Flow

```mermaid
sequenceDiagram
    actor Owner
    actor Hunter
    participant Contract as BugChain Contract

    Owner->>Contract: create_bounty(owner, asset, reward_amount, deadline, metadata_hash)
    Contract-->>Contract: Transfer reward into escrow
    Contract-->>Owner: bounty_created
    Hunter->>Contract: submit_report(hunter, bounty_id, report_hash)
    Contract-->>Hunter: report_submitted
    Owner->>Contract: approve_report(owner, bounty_id, report_id)
    Contract-->>Owner: report_approved
    Hunter->>Contract: claim_reward(hunter, bounty_id, report_id)
    Contract-->>Hunter: reward_claimed + escrow payout
```

Refund path:

```mermaid
sequenceDiagram
    actor Owner
    participant Contract as BugChain Contract

    Owner->>Contract: create_bounty(...)
    Contract-->>Owner: bounty_created
    Owner->>Contract: refund_expired_bounty(owner, bounty_id)
    Contract-->>Owner: bounty_refunded + escrow returned
```

## State Machines

### Bounty Lifecycle

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Backend draft saved
    DRAFT --> OPEN: create_bounty SUCCESS
    OPEN --> COMPLETED: report_approved
    OPEN --> REFUNDED: bounty_refunded after deadline
    COMPLETED --> [*]
    REFUNDED --> [*]
```

### Report Lifecycle

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Report metadata saved
    DRAFT --> PENDING: submit_report SUCCESS
    PENDING --> APPROVED: approve_report SUCCESS
    PENDING --> REJECTED: reject_report SUCCESS
    APPROVED --> PAID: claim_reward SUCCESS
    REJECTED --> [*]
    PAID --> [*]
```

### Transaction Lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING: Frontend starts on-chain action
    PENDING --> SUCCESS: txHash confirmed and synced
    PENDING --> FAILED: signing, simulation, submission, or rejection error
    PENDING --> SUCCESS: event sync repairs confirmed tx
    SUCCESS --> [*]
    FAILED --> [*]
```

## Real-Time Events

Backend endpoint:

```http
GET /events/stream
```

SSE event types:

- `bounty_created`
- `report_submitted`
- `report_approved`
- `report_rejected`
- `reward_claimed`
- `bounty_refunded`
- `transaction_updated`

The frontend subscribes once per active view and refreshes affected data without manual polling or page refresh:

- Transaction Timeline
- Bounty Details
- Researcher Dashboard
- Report Status tables

## Wallet Verification

Wallet linking uses Freighter message signing. The backend verifies:

- `walletAddress`
- exact nonce-bound verification `message`
- Freighter `signature`

Verification uses Stellar SDK `Keypair.fromPublicKey(walletAddress).verify(...)` against decoded signature bytes. The verifier accepts hex, base64, base64url, and Buffer JSON signatures. It verifies the exact UTF-8 message bytes and a SHA-256 digest fallback for SDK serialization compatibility. There is no always-true verification fallback.

## Smart Contract Functions

Primary active contract: `contracts/bugchain/src/contract.rs`.

- `initialize(admin)`
- `create_bounty(owner, asset, reward_amount, deadline, metadata_hash) -> u64`
- `submit_report(hunter, bounty_id, report_hash) -> u64`
- `approve_report(owner, bounty_id, report_id)`
- `reject_report(owner, bounty_id, report_id)`
- `claim_reward(hunter, bounty_id, report_id)`
- `refund_expired_bounty(owner, bounty_id)`
- `get_bounty(bounty_id)`
- `get_report(report_id)`

## Verified Testnet Transactions

All links below were generated against the deployed BugChain Testnet contract and verified through Stellar Expert API with HTTP 200 responses.

| Action | Transaction Hash | Stellar Expert |
| --- | --- | --- |
| Create Bounty | `b1d1ae0ac1b6f783e34a6042f2ec776e0dcc54083860352e9fa61970de9c98a1` | [Open](https://stellar.expert/explorer/testnet/tx/b1d1ae0ac1b6f783e34a6042f2ec776e0dcc54083860352e9fa61970de9c98a1) |
| Submit Report | `149b64983d26d92da9f9cc3c6c94056e6ff5a2e7341c761adde3bd5cf9b1de4e` | [Open](https://stellar.expert/explorer/testnet/tx/149b64983d26d92da9f9cc3c6c94056e6ff5a2e7341c761adde3bd5cf9b1de4e) |
| Approve Report | `0a56ce22f0e7231604d9b5d857f7626920929086fb48ea928582375a1f656b6c` | [Open](https://stellar.expert/explorer/testnet/tx/0a56ce22f0e7231604d9b5d857f7626920929086fb48ea928582375a1f656b6c) |
| Claim Reward | `57cdfcac4ad8c1438e3a7cb5ef78a9a04862a3351a8cd9ef6131721ce7ee0173` | [Open](https://stellar.expert/explorer/testnet/tx/57cdfcac4ad8c1438e3a7cb5ef78a9a04862a3351a8cd9ef6131721ce7ee0173) |
| Refund Expired Bounty | `ccd55b08eb11c14b6eadb0c99527a8b7749f487fc32b9f9f43958114a4046e8b` | [Open](https://stellar.expert/explorer/testnet/tx/ccd55b08eb11c14b6eadb0c99527a8b7749f487fc32b9f9f43958114a4046e8b) |

## Environment Variables

Backend (`backend/.env`):

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bugchain?schema=public"
JWT_SECRET="replace-with-a-strong-secret-or-random-key"
JWT_EXPIRES_IN="7d"
PORT=3000
VITE_STELLAR_RPC_URL="https://soroban-testnet.stellar.org"
VITE_CONTRACT_ID="CBRSQQ3WTR4S32JKUMO2E3MA6P3EX5IH6YC6FR4HWIZFC72TBRXBNSCS"
```

Frontend (`frontend/.env.local`):

```env
VITE_API_URL=http://localhost:3000
VITE_CONTRACT_ID=CBRSQQ3WTR4S32JKUMO2E3MA6P3EX5IH6YC6FR4HWIZFC72TBRXBNSCS
VITE_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
VITE_STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
VITE_STELLAR_EXPERT_TX_URL=https://stellar.expert/explorer/testnet/tx
```

## Development Commands

Frontend:

```bash
cd frontend
npm install
npm run lint
npm run build
npm run dev
```

Backend:

```bash
cd backend
npm install
npx prisma db push
npx prisma generate
npm run build
npm run start:dev
```

Contracts:

```bash
cd contracts
cargo test
cargo build --target wasm32-unknown-unknown --release
```

## Level 3 Candidates

Level 3 work should be kept separate from this Level 2 completion:

- Additional wallet providers beyond Freighter.
- Multi-reviewer approvals and dispute resolution.
- Partial payouts and severity-based reward schedules.
- Production event indexing with durable checkpoints and replay windows.
- File storage for report attachments.
- Automated end-to-end tests for wallet-driven browser flows.
