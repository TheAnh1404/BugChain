# BugChain - Hybrid Web2/Web3 Bug Bounty Platform

BugChain is a Level 2 hybrid bug bounty app. Rich bounty/report metadata, user accounts, wallet links, review comments, and transaction records are stored in the NestJS/PostgreSQL backend. Escrow, report hashes, approvals, claims, refunds, and audit events are executed by the deployed Soroban contract on Stellar Testnet.

Deployed Testnet contract:

```text
CBRSQQ3WTR4S32JKUMO2E3MA6P3EX5IH6YC6FR4HWIZFC72TBRXBNSCS
```

# Level 1:

Submission must include:
- Public GitHub repository
- README.md file

README must include:
- Project description
- Setup instructions (how to run locally)
- Screenshots:
  - Wallet connected state
    ![Wallet connected state](./screenshots/wallet_connected.png)
  - Balance displayed
  - Successful testnet transaction
    ![Successful testnet transaction](./screenshots/freighter_sign_message.png)
  - The transaction result is shown to the user

Submit your GitHub repository link below before the monthly deadline.

---

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

# Level 3

## Level 3 Overview

BugChain Level 3 upgrades the Level 2 hybrid Web2/Web3 bounty lifecycle into a production-ready release layer. The release adds encrypted report storage, explicit RBAC, audit logs, real-time notifications, hunter reputation, security analytics, organization/project support, CI/CD workflows, structured backend logging, and frontend/backend Sentry monitoring.

The Level 2 Soroban escrow lifecycle remains intact. Level 3 extends it with a read-only severity reward suggestion helper and backend multi-reviewer assignment architecture without changing the deployed transaction flow.

## Architecture Diagram

```mermaid
graph TD
    Frontend[React + Vite Frontend]
    SentryFE[Sentry Frontend]
    SSE[GET /events/stream]
    API[NestJS API]
    Pino[Pino Structured Logs]
    SentryBE[Sentry Backend]
    DB[(PostgreSQL + Prisma)]
    Crypto[AES-256-GCM Report Encryption]
    Notify[Notifications]
    Reputation[Reputation Profiles]
    Analytics[Security Analytics]
    Orgs[Organizations + Projects]
    Freighter[Freighter Wallet]
    RPC[Soroban RPC]
    Contract[BugChain Soroban Contract]
    Stellar[Stellar Testnet]

    Frontend --> API
    Frontend --> SSE
    Frontend --> SentryFE
    Frontend --> Freighter
    API --> DB
    API --> Crypto
    API --> Notify
    API --> Reputation
    API --> Analytics
    API --> Orgs
    API --> Pino
    API --> SentryBE
    API --> SSE
    Freighter --> RPC
    RPC --> Contract
    Contract --> Stellar
```

## Security Architecture

- Report fields `description`, `impact`, `steps_to_reproduce`, and `recommendation` are encrypted before database storage with AES-256-GCM.
- Database storage uses `encrypted_content`, `iv`, and `auth_tag`; legacy plaintext columns are retained for compatibility but new writes store the sensitive fields as encrypted placeholders.
- Authorized read paths decrypt only after resource checks pass for the hunter, bounty owner, reviewer assignment, or admin.
- RBAC roles are `OWNER`, `HUNTER`, `REVIEWER`, and `ADMIN`.
- Permission matrix is implemented in `backend/src/common/security/permission-matrix.ts`.
- Audit logs are written to `audit_logs` for `CREATE_BOUNTY`, `SUBMIT_REPORT`, `APPROVE_REPORT`, `REJECT_REPORT`, `CLAIM_REWARD`, and `REFUND_BOUNTY`.

Required backend environment:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=replace-with-a-strong-secret
REPORT_ENCRYPTION_KEY=64-hex-or-base64-32-byte-key
```

## Notification System

Level 3 adds the `notifications` table and REST APIs:

- `GET /notifications`
- `GET /notifications/unread-count`
- `PATCH /notifications/:id/read`
- `PATCH /notifications/read-all`

Notification types:

- `REPORT_APPROVED`
- `REPORT_REJECTED`
- `REWARD_CLAIMED`
- `BOUNTY_REFUNDED`
- `NEW_REPORT`

The frontend `NotificationBell` subscribes to `notification_created` SSE events, refreshes automatically, displays an unread counter, and supports marking notifications as read.

## Reputation System

Level 3 adds `reputation_profiles` and `reputation_badges`.

Tracked profile fields:

- `approvedReports`
- `rejectedReports`
- `successRate`
- `earnedXLM`
- `severityScore`

Hunter levels:

- Level 1
- Level 2
- Level 3
- Elite Hunter

Badges:

- First Report
- Critical Finder
- Top Hunter
- 1000 XLM Earned

APIs:

- `GET /reputation/me`
- `GET /reputation/leaderboard`
- `GET /reputation/users/:id`

## Analytics System

Level 3 adds the security analytics endpoint:

```http
GET /analytics/security
```

Metrics:

- Total Bounties
- Total Reports
- Approval Rate
- Average Resolution Time
- Rewards Paid
- Severity Distribution
- Reports Over Time
- Rewards Over Time
- Hunter Leaderboard

The frontend `AnalyticsDashboard` renders native responsive charts and refreshes from SSE lifecycle events.

## Organization System

Level 3 adds:

- `organizations`
- `organization_members`
- `projects`

APIs:

- `POST /organizations`
- `GET /organizations`
- `GET /organizations/:id`
- `POST /organizations/:id/members`
- `POST /organizations/:id/projects`
- `GET /organizations/:id/projects`

Organization owners can invite existing users as members or reviewers, create projects, and attach new bounties to organization projects.

## Deployment Guide

Backend:

```bash
cd backend
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build
npm run start
```

Frontend:

```bash
cd frontend
npm ci
npm run build
npm run preview
```

Contracts:

```bash
cd contracts
cargo test
cargo build --target wasm32-unknown-unknown --release
```

## CI/CD Guide

GitHub Actions workflows:

- `.github/workflows/frontend-ci.yml`
- `.github/workflows/backend-ci.yml`

Both pipelines run install, lint, build, and tests for their workspace.

## Monitoring Guide

Frontend Sentry is enabled with:

```env
VITE_SENTRY_DSN=
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
```

Backend Sentry is enabled with:

```env
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0.1
LOG_LEVEL=info
```

The backend uses Pino structured logs through Nest's logger interface and captures unhandled exceptions/rejections through Sentry when a DSN is configured.

## Contract Address

```text
CBRSQQ3WTR4S32JKUMO2E3MA6P3EX5IH6YC6FR4HWIZFC72TBRXBNSCS
```

## Example Transaction Hashes

Only real Stellar Testnet hashes are documented.

| Action | Transaction Hash | Stellar Expert |
| --- | --- | --- |
| Create Bounty | `b1d1ae0ac1b6f783e34a6042f2ec776e0dcc54083860352e9fa61970de9c98a1` | [Open](https://stellar.expert/explorer/testnet/tx/b1d1ae0ac1b6f783e34a6042f2ec776e0dcc54083860352e9fa61970de9c98a1) |
| Submit Report | `149b64983d26d92da9f9cc3c6c94056e6ff5a2e7341c761adde3bd5cf9b1de4e` | [Open](https://stellar.expert/explorer/testnet/tx/149b64983d26d92da9f9cc3c6c94056e6ff5a2e7341c761adde3bd5cf9b1de4e) |
| Approve Report | `0a56ce22f0e7231604d9b5d857f7626920929086fb48ea928582375a1f656b6c` | [Open](https://stellar.expert/explorer/testnet/tx/0a56ce22f0e7231604d9b5d857f7626920929086fb48ea928582375a1f656b6c) |
| Claim Reward | `57cdfcac4ad8c1438e3a7cb5ef78a9a04862a3351a8cd9ef6131721ce7ee0173` | [Open](https://stellar.expert/explorer/testnet/tx/57cdfcac4ad8c1438e3a7cb5ef78a9a04862a3351a8cd9ef6131721ce7ee0173) |
| Refund Expired Bounty | `ccd55b08eb11c14b6eadb0c99527a8b7749f487fc32b9f9f43958114a4046e8b` | [Open](https://stellar.expert/explorer/testnet/tx/ccd55b08eb11c14b6eadb0c99527a8b7749f487fc32b9f9f43958114a4046e8b) |

## Validation Results

- Frontend: `npm run lint`, `npm run build`, `npm run test`
- Backend: `npm run lint`, `npm run build`, `npm run test`
- Contracts: `cargo test` with 15 passing contract tests

### Demo Video

TODO: Add demo video

### Mobile Responsive Screenshots

TODO: Add screenshots

### CI/CD Screenshots

TODO: Add screenshots

### Test Results

TODO: Add screenshots

### Live Demo

TODO: Add deployed URL
