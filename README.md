# BugChain
### Decentralized Bug Bounty Protocol on Stellar

A hybrid Web2 + Web3 security bounty platform with on-chain reward escrow, Freighter wallet signing, Soroban smart contracts, and Stellar Expert transaction verification.

---

## 1. Project Overview

**BugChain** is a hybrid Web2/Web3 bug bounty platform designed to solve the critical trust gap between vulnerability researchers (Hunters) and project owners. Traditional Web2 platforms suffer from payout opacity, centralized control over bounty funds, and settlement delays. BugChain addresses these challenges by combining the performance of a centralized Web2 API with the trustless custody and cryptographic verification of the Stellar blockchain.

### Core Problems Solved
- **Guaranteed Payouts:** Bounty rewards are locked directly into the Soroban smart contract escrow upon bounty creation. Project owners cannot withhold payouts for valid, approved reports.
- **Vulnerability Privacy with On-Chain Auditing:** To prevent public disclosure of active zero-day vulnerabilities, the raw contents of bug reports are kept private and encrypted off-chain, while their cryptographic SHA-256 hashes are immutable registered on-chain. This provides verifiable proof of submission without compromising security.
- **Trustless Settlement:** When a project owner approves a report, the Hunter claims the reward token directly from the contract escrow, eliminating manual payroll cycles or intermediary delays.

### Why Stellar & Soroban?
BugChain leverages Stellar due to its ultra-low transaction fees, sub-second finality, and the Soroban WASM smart contract framework. Micro-bounties and localized payouts are economically viable on Stellar, whereas gas costs on platforms like Ethereum make small-scale rewards impractical. Transaction tracking is audited transparently through Stellar Expert Explorer.

---

## 2. System Model Overview

BugChain operates on a hybrid model where Web2 is optimized for user interaction, notifications, and metadata caching, and Web3 secures transactions and agreements.

### High-Level Architecture

```mermaid
graph TD
    subgraph Web2 Infrastructure
        Frontend[React + Vite Frontend]
        Backend[NestJS Backend API]
        Database[(PostgreSQL + Prisma)]
    end

    subgraph Stellar Web3 Infrastructure
        Freighter[Freighter Wallet]
        RPC[Soroban RPC Server]
        Contract[BugChain Soroban Contract]
        Stellar[Stellar Testnet Ledger]
        Explorer[Stellar Expert Explorer]
    end

    Frontend -->|REST API Requests| Backend
    Backend -->|Prisma Client| Database
    Frontend -->|Request Signature| Freighter
    Frontend -->|Submit Signed Tx| RPC
    RPC -->|Invoke Methods| Contract
    Contract -->|Emit State Events| Stellar
    Stellar -->|Indexed By| Explorer
    Backend -->|Background Event Sync| RPC
```

### Hybrid Functional Split

| Layer | Web2 Platform Responsibilities | Web3 Stellar Blockchain Responsibilities |
| :--- | :--- | :--- |
| **Identity** | User credentials, JWT session management, RBAC roles. | Ed25519 public keys, Freighter signature verification. |
| **Bounties** | Caching, categorization, detailed description Markdown. | Locking reward assets in escrow, deadline enforcing. |
| **Reports** | AES-256-GCM encrypted vulnerability writeups. | Registration of report SHA-256 hashes, payout claims. |
| **Auditing** | Audit logs for administrative actions, analytics. | Ledger events, immutable transaction hashes. |

---

## 3. Core Features

We maintain a clear product roadmap with complete, in-progress, and planned features:

### Web2 Features
- **Secure Authentication:** JWT-based login with Access & Refresh Token rotation and reuse detection. ✅ *Completed*
- **Role-Based Access Control (RBAC):** Restrict APIs to `ADMIN`, `OWNER`, `HUNTER`, and `REVIEWER` roles. ✅ *Completed*
- **Private Report Storage:** AES-256-GCM server-side encryption of report descriptions and steps to reproduce. ✅ *Completed*
- **Reputation Profile:** Hunter stats track success rates, total XLM earned, and unlockable achievement badges. ✅ *Completed*
- **Security Analytics:** Dashboard featuring reports over time, average resolution, and severity distribution. ✅ *Completed*
- **Organization & Project Consoles:** Collaborate with team members and group bounties under projects. ✅ *Completed*

### Web3 Features
- **Freighter Wallet Integration:** Securely connect, verify wallet ownership via nonce signatures. ✅ *Completed*
- **Soroban Escrow Smart Contract:** Automated token custody, release on approval, and refund on expiry. ✅ *Completed*
- **On-Chain Hash Registration:** Immutable registration of SHA-256 report hashes upon submission. ✅ *Completed*
- **Transaction State Tracking:** Log blockchain interactions as `PENDING`, `SUCCESS`, or `FAILED` in real time. ✅ *Completed*
- **Stellar Expert Deep Linking:** Connect on-chain tx hashes directly to Stellar Explorer UI. ✅ *Completed*

### Product UX Features
- **Interactive Onboarding:** Checklist to guide new users from registration to their first wallet interaction. ✅ *Completed*
- **Server-Sent Events (SSE):** Real-time dashboard updates without manual page refreshes. ✅ *Completed*
- **Toast Notifications & Loading Skeletons:** High-fidelity micro-interactions for transaction confirmation. ✅ *Completed*
- **Optional PostHog & Sentry Integrations:** Ready-to-go environment parameters for tracking and monitoring. ✅ *Completed*

---

## 4. Problem Statement

Traditional bug bounty platforms present several critical trust bottlenecks:
1. **The Centralized Escrow Problem:** Project owners control the reward treasury. If a critical bug is reported, owners may downplay the severity or refuse to pay the Hunter.
2. **Plagiarism and Disclosure Fraud:** Without a timestamped cryptographic hash, rogue owners can reject a submission, silently patch the bug, and claim it was already known.
3. **High Intermediary Fees:** Web2 platforms take up to 25% of reward payouts, reducing incentives for security researchers.

### The BugChain Solution
BugChain addresses these pain points by locking rewards into a decentralized smart contract before the program is published. By registering the SHA-256 hash of a vulnerability report *before* sharing details, the Hunter secures cryptographic proof of priority. The platform cuts out high intermediary fees by paying out reward tokens directly peer-to-peer on-chain.

---

## 5. Why Stellar?

Stellar is uniquely positioned as the transaction layer for decentralized bug bounties:
- **Predictable, Micro-Cent Fees:** Initiating, submitting, and claiming bounties costs fractions of a cent, ensuring rewards are not eaten up by gas fees.
- **Fast, Sub-Second Finality:** Stellar consensus ensures transactions are finalized in 3-5 seconds, bypassing long settlement delays.
- **Soroban Custom Tokens:** Escrow accepts any Stellar Asset (native XLM, stablecoins like USDC, or custom tokens), giving project owners financial flexibility.
- **Freighter Wallet API:** A lightweight, non-custodial browser extension that signs transactions securely without exposing private keys.

---

## 6. Technical Architecture

BugChain utilizes a React client, a NestJS API layer caching the state of the Stellar Testnet, and a Soroban WASM smart contract.

### Component Design

```mermaid
graph TD
    subgraph Client Application
        Vite[Vite React App]
        FreighterAPI[Freighter API]
        SSEClient[EventSource SSE Client]
    end

    subgraph API Server
        NestJS[NestJS Controller & Services]
        Prisma[Prisma Client]
        SyncService[Event Sync Service]
    end

    subgraph Stellar Network
        RPC[Soroban RPC Node]
        Ledger[(Stellar Ledger)]
    end

    Vite -->|JSON REST| NestJS
    NestJS -->|CRUD| Prisma
    Prisma -->|Query/Persist| Postgres[(PostgreSQL)]
    Vite -->|Sign Transaction| FreighterAPI
    FreighterAPI -->|Broadcast Tx| RPC
    RPC -->|Update State| Ledger
    SyncService -->|Poll Contract Events| RPC
    SyncService -->|Sync State| Prisma
    NestJS -->|Stream Updates| SSEClient
```

---

## 7. Data Flow

### 7.1. Wallet Linking Flow
```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant Backend
    participant Freighter

    User->>Frontend: Click "Connect Wallet"
    Frontend->>Freighter: Get Wallet Address
    Freighter-->>Frontend: Stellar Address (G...)
    Frontend->>Backend: POST /wallets/nonce { address }
    Backend->>Backend: Generate Secure Nonce (32-byte hex)
    Backend-->>Frontend: Return { nonce, message }
    Frontend->>Freighter: Request Message Signature
    Freighter-->>Frontend: Return Signature
    Frontend->>Backend: POST /wallets/link { address, signature, message }
    Backend->>Backend: Stellar SDK Keypair Verify Signature
    Backend->>Backend: Mark Wallet Verified in Database
    Backend-->>Frontend: Return 200 OK (Linked Status)
```

### 7.2. Create Bounty Flow
```mermaid
sequenceDiagram
    actor Owner
    participant Frontend
    participant Backend
    participant Freighter
    participant Soroban as Soroban RPC

    Owner->>Frontend: Enter Title, Scope, Reward (XLM), Deadline
    Frontend->>Backend: POST /bounties (Status = DRAFT)
    Backend-->>Frontend: Return Bounty ID & Metadata Hash
    Frontend->>Freighter: Request Transaction Sign (create_bounty)
    Freighter-->>Frontend: Signed XDR Envelope
    Frontend->>Soroban: sendTransaction(Signed XDR)
    Soroban-->>Frontend: Transaction Hash & Confirmation
    Frontend->>Backend: PATCH /bounties/:id/onchain { txHash, onchainBountyId }
    Backend->>Backend: Update Status = OPEN
    Backend-->>Frontend: Return Updated Bounty (SSE stream trigger)
```

### 7.3. Submit Report Flow
```mermaid
sequenceDiagram
    actor Hunter
    participant Frontend
    participant Backend
    participant Freighter
    participant Soroban as Soroban RPC

    Hunter->>Frontend: Fill Vulnerability Writeup (AES Encrypted locally)
    Frontend->>Backend: POST /reports (Status = DRAFT)
    Backend->>Backend: Save AES Encrypted Content
    Backend-->>Frontend: Return Report ID & SHA-256 Hash
    Frontend->>Freighter: Request Transaction Sign (submit_report)
    Freighter-->>Frontend: Signed XDR Envelope
    Frontend->>Soroban: sendTransaction(Signed XDR)
    Soroban-->>Frontend: Transaction Hash & Confirmation
    Frontend->>Backend: PATCH /reports/:id/onchain { txHash, onchainReportId }
    Backend->>Backend: Update Status = PENDING
    Backend-->>Frontend: Return Updated Report (SSE notification trigger)
```

### 7.4. Approve / Reject Flow
```mermaid
sequenceDiagram
    actor Owner
    participant Frontend
    participant Backend
    participant Freighter
    participant Soroban as Soroban RPC

    Owner->>Frontend: Review Report details -> Click "Approve" / "Reject"
    Frontend->>Freighter: Request Transaction Sign (approve_report / reject_report)
    Freighter-->>Frontend: Signed XDR Envelope
    Frontend->>Soroban: sendTransaction(Signed XDR)
    Soroban-->>Frontend: Transaction Hash & Confirmation
    Frontend->>Backend: PATCH /reports/:id/status { txHash }
    Backend->>Backend: Update Report = APPROVED/REJECTED & Bounty = COMPLETED
    Backend-->>Frontend: Return Success Status
```

### 7.5. Claim Reward Flow
```mermaid
sequenceDiagram
    actor Hunter
    participant Frontend
    participant Backend
    participant Freighter
    participant Soroban as Soroban RPC

    Hunter->>Frontend: View Approved Report -> Click "Claim Reward"
    Frontend->>Freighter: Request Transaction Sign (claim_reward)
    Freighter-->>Frontend: Signed XDR Envelope
    Frontend->>Soroban: sendTransaction(Signed XDR)
    Soroban-->>Frontend: Transaction Hash & Confirmation
    Frontend->>Backend: PATCH /reports/:id/claim { txHash }
    Backend->>Backend: Update Status = PAID
    Backend-->>Frontend: Return Updated Payout Status
```

### 7.6. Refund Flow
```mermaid
sequenceDiagram
    actor Owner
    participant Frontend
    participant Backend
    participant Freighter
    participant Soroban as Soroban RPC

    Owner->>Frontend: View Expired Bounty -> Click "Refund Escrow"
    Frontend->>Freighter: Request Transaction Sign (refund_expired_bounty)
    Freighter-->>Frontend: Signed XDR Envelope
    Frontend->>Soroban: sendTransaction(Signed XDR)
    Soroban-->>Frontend: Transaction Hash & Confirmation
    Frontend->>Backend: POST /bounties/:id/refund { txHash }
    Backend->>Backend: Update Status = REFUNDED
    Backend-->>Frontend: Return Refund Complete Status
```

---

## 8. Smart Contract Design

The Soroban contract logic is written in Rust and operates on the Stellar Testnet ledger.

### Public Methods
*   **`initialize(env: Env, admin: Address)`**
    - *Purpose:* Set the contract administrator address. Can only be invoked once.
    - *Caller:* Deployer.
    - *State Changes:* Writes `DataKey::Admin` to instance storage.
    - *Events:* None.
*   **`create_bounty(env: Env, owner: Address, asset: Address, reward_amount: i128, deadline: u64, metadata_hash: BytesN<32>) -> u64`**
    - *Purpose:* Locks tokens in escrow and registers a new bounty opportunity.
    - *Caller:* Bounty Owner.
    - *State Changes:* Increments `DataKey::BountyCounter`, transfers `reward_amount` tokens from Owner to the contract address, writes `Bounty` struct to persistent storage.
    - *Events:* Emits `bounty_created` event containing the bounty ID, owner, asset, reward amount, and deadline.
*   **`submit_report(env: Env, hunter: Address, bounty_id: u64, report_hash: BytesN<32>) -> u64`**
    - *Purpose:* Submits a report hash to claim priority on a vulnerability.
    - *Caller:* Hunter.
    - *State Changes:* Increments `DataKey::ReportCounter`, writes `Report` struct to persistent storage.
    - *Events:* Emits `report_submitted` event with the report ID, bounty ID, and hunter.
*   **`approve_report(env: Env, owner: Address, bounty_id: u64, report_id: u64)`**
    - *Purpose:* Approves a submission. Resolves the bounty program.
    - *Caller:* Bounty Owner.
    - *State Changes:* Sets `bounty.status = Completed`, `report.status = Approved`, and updates structures in storage.
    - *Events:* Emits `report_approved` event with bounty ID, report ID, and hunter address.
*   **`reject_report(env: Env, owner: Address, bounty_id: u64, report_id: u64)`**
    - *Purpose:* Rejects a submission. Reopens the bounty for other researchers.
    - *Caller:* Bounty Owner.
    - *State Changes:* Sets `report.status = Rejected`.
    - *Events:* Emits `report_rejected` event with bounty ID and report ID.
*   **`claim_reward(env: Env, hunter: Address, bounty_id: u64, report_id: u64)`**
    - *Purpose:* Releases locked tokens from the contract escrow to the Hunter's wallet.
    - *Caller:* Hunter.
    - *State Changes:* Sets `report.status = Paid`. Transfers `reward_amount` tokens from contract to Hunter.
    - *Events:* Emits `reward_claimed` event containing bounty ID, report ID, hunter address, and amount.
*   **`refund_expired_bounty(env: Env, owner: Address, bounty_id: u64)`**
    - *Purpose:* Allows Bounty Owners to reclaim funds locked in escrows that have passed their deadline.
    - *Caller:* Bounty Owner.
    - *State Changes:* Sets `bounty.status = Refunded`. Transfers `reward_amount` tokens from contract back to Owner.
    - *Events:* Emits `bounty_refunded` event containing bounty ID, owner, and amount.

### Types and Statuses
- **`BountyStatus`**: `Open`, `Completed`, `Refunded`, `Cancelled`
- **`ReportStatus`**: `Pending`, `Approved`, `Rejected`, `Paid`
- **`Severity`**: `Low`, `Medium`, `High`, `Critical`

---

## 9. Database Design

We use PostgreSQL with Prisma ORM.

### Database Schema Model Diagram

```mermaid
erDiagram
    USER ||--o{ WALLET : "has"
    USER ||--o{ BOUNTY : "owns"
    USER ||--o{ REPORT : "submits"
    USER ||--o{ AUDIT_LOG : "triggers"
    USER ||--o{ NOTIFICATION : "receives"
    USER ||--o{ TRANSACTION : "executes"
    USER ||--o| REPUTATION_PROFILE : "has"
    USER ||--o{ REPUTATION_BADGE : "earns"
    USER ||--o{ USER_SESSION : "creates"
    ORGANIZATION ||--o{ PROJECT : "groups"
    ORGANIZATION ||--o{ BOUNTY : "owns"
    PROJECT ||--o{ BOUNTY : "contains"
    BOUNTY ||--o{ REPORT : "has"
    BOUNTY ||--o{ TRANSACTION : "records"
    REPORT ||--o{ REVIEW : "undergoes"
    REPORT ||--o{ TRANSACTION : "records"
```

### Key Prisma Models
- **`User`**: Handles user login, emails, and permissions.
- **`Wallet`**: Stores connected wallet credentials (`walletAddress`, `nonce`, `verifiedAt`).
- **`Bounty`**: Caches on-chain bounty data, scopes, severities, and transaction hashes.
- **`Report`**: Stores AES-encrypted descriptions alongside on-chain report IDs and cryptographic hashes.
- **`Transaction`**: Audits database mutations with related `txHash`es.

---

## 10. Transaction Verification

Every on-chain action produces a verified transaction hash recorded on the Stellar Testnet ledger.

- **Deployed Soroban Contract Address:**
  `CBRSQQ3WTR4S32JKUMO2E3MA6P3EX5IH6YC6FR4HWIZFC72TBRXBNSCS`

### Verified Transactions Reference

| Operation | Real Transaction Hash | Explorer Link |
| :--- | :--- | :--- |
| **Create Bounty** | `b1d1ae0ac1b6f783e34a6042f2ec776e0dcc54083860352e9fa61970de9c98a1` | [Stellar Expert](https://stellar.expert/explorer/testnet/tx/b1d1ae0ac1b6f783e34a6042f2ec776e0dcc54083860352e9fa61970de9c98a1) |
| **Submit Report** | `149b64983d26d92da9f9cc3c6c94056e6ff5a2e7341c761adde3bd5cf9b1de4e` | [Stellar Expert](https://stellar.expert/explorer/testnet/tx/149b64983d26d92da9f9cc3c6c94056e6ff5a2e7341c761adde3bd5cf9b1de4e) |
| **Approve Report** | `0a56ce22f0e7231604d9b5d857f7626920929086fb48ea928582375a1f656b6c` | [Stellar Expert](https://stellar.expert/explorer/testnet/tx/0a56ce22f0e7231604d9b5d857f7626920929086fb48ea928582375a1f656b6c) |
| **Claim Reward** | `57cdfcac4ad8c1438e3a7cb5ef78a9a04862a3351a8cd9ef6131721ce7ee0173` | [Stellar Expert](https://stellar.expert/explorer/testnet/tx/57cdfcac4ad8c1438e3a7cb5ef78a9a04862a3351a8cd9ef6131721ce7ee0173) |
| **Refund Expired Bounty** | `ccd55b08eb11c14b6eadb0c99527a8b7749f487fc32b9f9f43958114a4046e8b` | [Stellar Expert](https://stellar.expert/explorer/testnet/tx/ccd55b08eb11c14b6eadb0c99527a8b7749f487fc32b9f9f43958114a4046e8b) |

---

## 11. Stellar Journey Submission Progress

BugChain has been systematically built to fulfill all submission requirements for the Stellar Smart Contract Hackathon.

### Level 1 - White Belt
- [x] Create a public GitHub repository.
- [x] Setup basic `README.md` with descriptions and instructions.
- [x] Configure and display wallet connected state.
  - *Evidence:* Connected state screenshot shown in `./screenshots/wallet_connected.png`.
- [x] Request Freighter wallet signatures and display transaction result to the user.
  - *Evidence:* Message sign confirmation shown in `./screenshots/freighter_sign_message.png`.

### Level 2 - Yellow Belt
- [x] Deploy Soroban smart contract on Stellar Testnet.
- [x] Integrate Freighter wallet with the frontend application.
- [x] Implement real contract invocations: create bounty, submit report, approve report, claim reward, and refund.
- [x] Set up transaction lifecycle states: `PENDING`, `SUCCESS`, and `FAILED`.
- [x] Write and pass contract tests.
  - *Evidence:* 15 unit tests passed successfully inside `contracts/bugchain`.

### Level 3 - Orange Belt
- [x] Maintain clean codebase with meaningful commit history.
- [x] Document database schemas, API specs, and contract interfaces.
- [x] Set up background Event Syncing worker polling Soroban RPC for real-time DB caching.
- [ ] Deploy live demo link — TODO
- [ ] Create and embed 1-2 minute walkthrough demo video — TODO
- [x] Set up CI/CD actions for automated testing on push.
  - *Evidence:* Actions `.github/workflows/frontend-ci.yml`, `backend-ci.yml`, and `contract-ci.yml`.

### Level 4 - Green Belt
- [x] Build mobile responsive layout (optimized for 375px, 390px, and 430px).
- [x] Guided onboarding checklist in dashboard.
- [x] Build feedback collection forms and summary dashboard.
- [x] Wallet interaction proof system (CSV Export support).
- [x] Set up security analytics dashboard.
- [x] Integrate optional Sentry and PostHog setups.
- [ ] Onboard 10+ real testers with wallet interactions — TODO
- [ ] Collect 10+ user wallet interaction proof screenshots — TODO
- [ ] Summarize real-user feedback after testing sessions — TODO

---

## 12. Installation and Setup

### 12.1. Prerequisites
- Node.js (v18 or higher)
- Rust and Cargo
- Soroban CLI toolchain
- PostgreSQL database instance

### 12.2. Environment Configurations
Create `.env` files in both workspace directories using the variables below.

**Backend Setup (`backend/.env`):**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bugchain?schema=public"
JWT_SECRET="replace-with-a-strong-secret-or-random-key"
JWT_EXPIRES_IN="7d"
REPORT_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
FRONTEND_URL="http://localhost:5173"
EMAIL_PROVIDER="console"
DEV_INLINE_PASSWORD_RESET_LINK=true
VITE_CONTRACT_ID="CBRSQQ3WTR4S32JKUMO2E3MA6P3EX5IH6YC6FR4HWIZFC72TBRXBNSCS"
VITE_STELLAR_RPC_URL="https://soroban-testnet.stellar.org"
VITE_STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
ENABLE_STELLAR_TX_VALIDATION=false
PORT=3000
```

**Frontend Setup (`frontend/.env.local`):**
```env
VITE_API_URL=http://localhost:3000
VITE_CONTRACT_ID=CBRSQQ3WTR4S32JKUMO2E3MA6P3EX5IH6YC6FR4HWIZFC72TBRXBNSCS
VITE_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
VITE_STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
VITE_STELLAR_EXPERT_TX_URL=https://stellar.expert/explorer/testnet/tx
```

### 12.3. Startup Instructions

**1. Database Migration & Backend Start**
```bash
cd backend
npm install
npx prisma db push
npx prisma generate
npm run start:dev
```

**2. Frontend Client Start**
```bash
cd frontend
npm install
npm run dev
```

**3. Smart Contract Assembly**
```bash
cd contracts
cargo test
cargo build --target wasm32-unknown-unknown --release
```

---

## 13. Running Tests

Validate project components using the automated command suite:

### Contract Unit Tests
```bash
cd contracts
cargo test
```
*Test Output Placeholder:*
TODO: Add test output screenshot.

### Backend Validation
```bash
cd backend
npm run test
npm run lint
```

### Frontend Validation
```bash
cd frontend
npm run lint
npm run build
```

---

## 14. Deployment

- **Frontend Target:** Vercel or Netlify.
- **Backend Target:** Railway, Render, or Heroku.
- **Database Host:** Supabase, Neon, or Railway PostgreSQL.
- **Contract Environment:** Stellar Testnet.

*Live Demo Link:*
TODO: Add live demo link.

---

## 15. Screenshots and Demo

### Screenshots

*   **Platform Dashboard & User Interface:**
    TODO: Add dashboard screenshot.
*   **Mobile Responsive Layout (375px/390px/430px):**
    TODO: Add mobile UI screenshot.
*   **Sentry/PostHog Analytics Setup:**
    TODO: Add monitoring setup screenshot.
*   **GitHub Actions CI/CD Pipelines:**
    TODO: Add pipeline workflow screenshot.
*   **Passed Soroban Contract Tests:**
    TODO: Add rust cargo test screenshot.
*   **10+ User Proof Verified Logs:**
    TODO: Add CSV logs or proof dashboard screenshot.

### Demo Video

TODO: Add 1-2 minute walkthrough demo video link here.

---

## 16. Product Roadmap

### Level 4 Completed
- [x] Integrated guided onboarding checklist interface.
- [x] Built feedback collection systems.
- [x] Created wallet proof audits and CSV export module.
- [x] Designed structured security analytics endpoints.

### Future Milestones
- [ ] **Mainnet Release:** Deploy contracts to Stellar Mainnet.
- [ ] **Multi-Reviewer Consensus:** Require approvals from multiple reviewers before payouts.
- [ ] **Decentralized Dispute Resolution:** Arbitration contract allowing community votes on contested rejections.
- [ ] **Advanced Reputation Profiles:** Dynamic score calculation adjusting with reports severity and volume.
- [ ] **AI Severity Predictor:** Automated report analysis suggesting severities based on vulnerability descriptions.

---

## 17. Final Submission Checklist

- [x] Public GitHub repository.
- [x] Comprehensive `README.md` documentation.
- [x] Over 15 structured git commits in repository.
- [ ] Deployed Live Demo link — TODO
- [x] Active Soroban contract address.
- [x] Deployed transaction hashes documented.
- [x] Level 1 connected wallet screenshots.
- [ ] Level 4 user testing proofs and CSV — TODO
- [ ] Project walkthrough demo video — TODO
- [ ] Real-tester feedback summary — TODO
