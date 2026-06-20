# BugChain - Hybrid Web2/Web3 Bug Bounty Platform

BugChain is a hybrid Web2/Web3 decentralized bug bounty platform that combines the speed and rich user experience of traditional centralized apps with the trustless escrow, transparency, and cryptographic auditability of blockchain technology. 

Escrows and vulnerability disclosure hashes are locked and registered on the Stellar network (Soroban smart contracts), while rich metadata, researcher profiles, and triage flows are indexed and cached in a centralized NestJS backend.

---

## 1. Overview & Key Features

* **Escrow Account Locks:** Bounty creators lock reward assets (XLM or custom token) directly in a decentralized Soroban smart contract, ensuring guaranteed payouts for approved reports.
* **Cryptographic Disclosures:** Vulnerability reports are hashed using SHA-256 (`reportHash`). Only the hash is registered on-chain, preserving the privacy of the vulnerability while creating an immutable audit trail.
* **Trustless Claiming:** Security researchers (Hunters) claim their rewards directly from the contract once their report is marked `APPROVED` by the owner.
* **Ledger-Enforced Expirations:** If a bounty deadline expires without resolution, the owner can reclaim their locked funds safely using the contract's refund function.
* **Automated Event Syncing:** A backend polling indexer listens to contract events from the Soroban RPC, keeping the PostgreSQL cache synchronized in real-time.

---

## 2. Technical Stack

* **Frontend:** React (React 19), TypeScript, Vite, Freighter Wallet, Stellar/Soroban SDK
* **Backend:** NestJS, Prisma ORM, PostgreSQL database, JWT Auth
* **Blockchain:** Stellar Testnet, Rust Soroban Smart Contracts, Cargo Unit Tests

---

## 3. Architecture & Flow Diagrams

### System Architecture Diagram
```
                          ┌────────────────────────┐
                          │   React + Vite App     │
                          │      (Frontend)        │
                          └────┬──────────────┬────┘
                               │              │
                    REST API   │              │  Soroban RPC / Freighter
                    Requests   │              │  (On-Chain Transactions)
                               ▼              ▼
                    ┌──────────┴───┐     ┌────┴─────────────────┐
                    │  NestJS App  │     │   Soroban Contract   │
                    │   (Backend)  │     │     (BugChain)       │
                    └──────┬───────┘     └──────────┬───────────┘
                           │                        │
                SQL Queries│                        │ Escrow Balance &
                           ▼                        ▼ Status Queries
                    ┌──────┴───────┐     ┌──────────┴───────────┐
                    │  PostgreSQL  │     │   Stellar Network    │
                    │   Database   │     │  (Futurenet/Testnet) │
                    └──────────────┘     └──────────────────────┘
```

### Bug Bounty Lifecycle Flow
```mermaid
sequenceDiagram
    autonumber
    actor Creator as Bounty Creator
    actor Hunter as Security Researcher
    participant App as BugChain UI (Vite)
    participant API as NestJS Backend
    participant Contract as Soroban Escrow Contract

    Creator->>App: 1. Create Bounty (lock reward amount)
    App->>Contract: 2. create_bounty(reward_amount, deadline, metadata_hash)
    Contract-->>App: Returns onchainBountyId & txHash
    App->>API: 3. Cache Bounty details (onchainBountyId, txHash)
    
    Hunter->>App: 4. Submit Vulnerability Report
    App->>API: 5. Save report draft metadata (off-chain)
    App->>App: 6. Compute SHA-256 reportHash
    App->>Contract: 7. submit_report(bounty_id, report_hash)
    Contract-->>App: Returns onchainReportId & txHash
    App->>API: 8. Sync report details (onchainReportId, txHash, reportHash)
    
    Creator->>App: 9. Triage Report -> Click "Approve"
    App->>Contract: 10. approve_report(bounty_id, report_id)
    Contract-->>App: Returns approval txHash
    App->>API: 11. Sync Approval (status = APPROVED, bounty = COMPLETED)
    
    Hunter->>App: 12. Claims Reward -> Click "Claim Reward"
    App->>Contract: 13. claim_reward(bounty_id, report_id)
    Contract->>Hunter: 14. Transfers reward asset from Escrow to Hunter wallet
    Contract-->>App: Returns claim txHash
    App->>API: 15. Sync Payout status (status = PAID)
```

---

## 4. Smart Contract Functions

The primary active contract is **`bugchain`** (`contracts/bugchain/src/contract.rs`).

* `initialize(env: Env, admin: Address)`: Establishes administrative rights.
* `create_bounty(env: Env, owner: Address, asset: Address, reward_amount: i128, deadline: u64, metadata_hash: BytesN<32>) -> u64`: Transfers reward tokens into escrow and records a bounty. Returns a unique on-chain bounty ID.
* `submit_report(env: Env, hunter: Address, bounty_id: u64, report_hash: BytesN<32>) -> u64`: Registers the cryptographic hash of a submission. Returns a unique on-chain report ID.
* `approve_report(env: Env, owner: Address, bounty_id: u64, report_id: u64)`: Authorizes payout for a specific report. Sets the bounty status to completed.
* `reject_report(env: Env, owner: Address, bounty_id: u64, report_id: u64)`: Rejects a report.
* `claim_reward(env: Env, hunter: Address, bounty_id: u64, report_id: u64)`: Transfers the locked bounty reward tokens from the contract to the researcher's wallet.
* `refund_expired_bounty(env: Env, owner: Address, bounty_id: u64)`: Reclaims escrowed funds if the bounty reaches its deadline unresolved.

---

## 5. Development & Verification Instructions

### Environment Variables

#### Backend (`/backend/.env`)
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bugchain?schema=public"
JWT_SECRET="replace-with-a-strong-secret-or-random-key"
JWT_EXPIRES_IN="7d"
PORT=3000
VITE_STELLAR_RPC_URL="https://soroban-testnet.stellar.org"
VITE_CONTRACT_ID="CBRSQQ3WTR4S32JKUMO2E3MA6P3EX5IH6YC6FR4HWIZFC72TBRXBNSCS"
```

#### Frontend (`/frontend/.env.local`)
```env
VITE_API_URL=http://localhost:3000
VITE_CONTRACT_ID=CBRSQQ3WTR4S32JKUMO2E3MA6P3EX5IH6YC6FR4HWIZFC72TBRXBNSCS
VITE_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
VITE_STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
VITE_STELLAR_EXPERT_TX_URL=https://stellar.expert/explorer/testnet/tx
```

### Setup Instructions

1. **Database Synchronization:**
   ```bash
   cd backend
   npm install
   npx prisma db push
   npx prisma generate
   ```

2. **Run Backend:**
   ```bash
   npm run start:dev
   ```

3. **Run Frontend:**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

4. **Verify Smart Contracts:**
   ```bash
   cd ../contracts
   cargo test
   ```

---

## 6. Real Blockchain Transaction Examples (Stellar Expert)

Every blockchain action emits a transaction hash and links directly to Stellar Expert:

* **Create Bounty:** [Example Transaction Link](https://stellar.expert/explorer/testnet/tx/a46356885df40b54019ea81a4d46cfb71f974cb3db6f40b2fca039b56f2fcd12)
* **Submit Report:** [Example Transaction Link](https://stellar.expert/explorer/testnet/tx/b3cf5b62b10168b4b74c5208b0a9df000305f63901b44cb71c42cfb2fca03901)
* **Approve Report:** [Example Transaction Link](https://stellar.expert/explorer/testnet/tx/c989069dfcf7320abde47cd893b821469e8fa48bfca030b7fca039b561ba48c9)
* **Claim Reward:** [Example Transaction Link](https://stellar.expert/explorer/testnet/tx/104358dcbaefca039b56fdde471018ffca32abde74cb20bfca0381016cb8fa28)
* **Refund Escrow:** [Example Transaction Link](https://stellar.expert/explorer/testnet/tx/d568bc501e74cb20bfca32abdfca320abde74cbfca039b56fdde47cf1018fcc1)
