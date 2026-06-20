# GEMINI.md - BugChain Developer & AI Agent Context

Welcome to **BugChain**, a hybrid Web2/Web3 bug bounty platform. This document serves as the primary technical reference and instructional context for developers and future AI agents working on this codebase.

---

## 1. Project Overview & Architecture

BugChain combines the speed and user experience of traditional Web2 applications with the transparency, trustless escrow, and cryptographic auditability of Web3.

The project is structured into three main layers:
1.  **Frontend (`/frontend`)**: A React + Vite web application styled with modern CSS, using **Freighter** wallet integration and the `@stellar/stellar-sdk` to interact with Stellar/Soroban.
2.  **Backend (`/backend`)**: A robust **NestJS** application using **Prisma ORM** connected to a **PostgreSQL** database. It acts as the centralized API layer for user profiles, bounty marketplace caching, report management, triage reviews, and transaction logging.
3.  **Smart Contracts (`/contracts`)**: A Soroban (Stellar) Rust workspace that handles critical decentralized operations: locking up bounty escrow reward pools, private registration of cryptographic report hashes, and automated/trustless payouts.

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

---

## 2. Directory Structure

```
D:\TheAnhProject\BugChain\
├── backend/                  # NestJS backend API
│   ├── src/                  # Source files (auth, bounties, reports, reviews, users, wallets, etc.)
│   ├── prisma/               # Schema design & SQL migrations
│   └── package.json          # Server dependencies and scripts
├── contracts/                # Soroban Rust smart contracts
│   ├── bug_bounty/           # Legacy contract
│   ├── bugchain/             # Primary active contract (with state, events, storage, tests)
│   ├── Cargo.toml            # Workspace configuration
│   └── target/               # Compiled WASM files and Rust build outputs
├── frontend/                 # Vite + React UI
│   ├── src/                  # Components, hooks, services, and views
│   └── package.json          # Web dependencies and scripts
├── AGENTS.md                 # Original Repository Guidelines
└── README.md                 # Workspace entrypoint instructions
```

---

## 3. Environment Setup & Configuration

### Backend (`/backend/.env`)
Create `/backend/.env` matching the following schema:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bugchain?schema=public"
JWT_SECRET="replace-with-a-strong-secret-or-random-key"
JWT_EXPIRES_IN="7d"
PORT=3000
```

### Frontend (`/frontend/.env.local`)
Create `/frontend/.env.local` to direct the UI and wallet:
```env
VITE_API_URL=http://localhost:3000
VITE_CONTRACT_ID=C... # Deployed BugChain Soroban contract ID
```

---

## 4. Building, Testing, and Running

Follow these steps to spin up the local development environment or run validation suites.

### Backend Setup
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev       # Applies latest DB schema updates
npm run start:dev            # Starts NestJS server on http://localhost:3000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev                  # Starts Vite with HMR on http://localhost:5173
```

### Smart Contract Development
Make sure you have Rust and the `wasm32-unknown-unknown` target installed.
```bash
cd contracts

# Run unit tests (there are 12 verified test cases for bugchain contract)
cargo test

# Build target WASM binary
cargo build --target wasm32-unknown-unknown --release

# Optimize WASM size for low-fee Soroban gas usage
soroban contract optimize --wasm ../target/wasm32-unknown-unknown/release/bugchain.wasm
```

---

## 5. Smart Contract Specifications

The primary active contract is **`bugchain`** (`contracts/bugchain/src/contract.rs`).

### Public API / Methods
*   **`initialize(env: Env, admin: Address)`**: Initializes contract ownership under the designated admin. Panics if already initialized.
*   **`create_bounty(env: Env, owner: Address, asset: Address, reward_amount: i128, deadline: u64, metadata_hash: BytesN<32>) -> u64`**: Transfers specified reward tokens into escrow and stores a newly registered `Bounty` struct. Returns a `u64` bounty ID.
*   **`submit_report(env: Env, hunter: Address, bounty_id: u64, report_hash: BytesN<32>) -> u64`**: Submits a hashed report referencing an active bounty. Returns a `u64` report ID.
*   **`approve_report(env: Env, owner: Address, bounty_id: u64, report_id: u64)`**: Invoked by the bounty owner to mark a report as approved and the bounty as completed.
*   **`reject_report(env: Env, owner: Address, bounty_id: u64, report_id: u64)`**: Invoked by the bounty owner to reject a pending submission.
*   **`claim_reward(env: Env, hunter: Address, bounty_id: u64, report_id: u64)`**: Invoked by the security researcher (hunter) to payout the locked reward tokens from the escrow contract to their personal wallet once their report is approved.
*   **`refund_expired_bounty(env: Env, owner: Address, bounty_id: u64)`**: Allows the bounty owner to reclaim their escrowed funds if the bounty has reached its deadline and remains unresolved.
*   **`get_bounty(env: Env, bounty_id: u64) -> Bounty`**: Reads the bounty details from the contract's persistent storage.
*   **`get_report(env: Env, report_id: u64) -> Report`**: Reads the report details from the contract's persistent storage.

### Status Definitions
*   **`BountyStatus`**: `Open`, `Completed`, `Refunded`
*   **`ReportStatus`**: `Pending`, `Approved`, `Rejected`, `Paid`

---

## 6. Database Schema Design (Prisma)

The application uses PostgreSQL with Prisma to represent and cache hybrid identities, bounties, and triage states.

### Key Models & Relationships
1.  **`User`**: Core user accounts. Role-based (`USER` or `ADMIN`).
    *   Has many `Wallet`s, `Bounty` items (as Creator), `Report` items (as Hunter), and `Review` items (as Reviewer/Triage Owner).
2.  **`Wallet`**: Represents connected Stellar wallets linked to `User` profiles (e.g. Freighter). Supports nonce verification.
3.  **`Bounty`**: Local database cache of active and closed bounty opportunities.
    *   Holds references to on-chain counterparts (`onchainBountyId`, `txHash`, `stellarExplorerUrl`).
    *   Tracks financial reward details, deadline, status (`DRAFT`, `OPEN`, `UNDER_REVIEW`, `COMPLETED`, `EXPIRED`, `REFUNDED`), and `Severity` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
4.  **`Report`**: Detailed bug reports submitted by research hunters.
    *   Contains Web2 descriptions (reproduce steps, impact, recommendation) alongside the on-chain reference (`onchainReportId`, cryptographic `reportHash`).
5.  **`Review`**: Recorded decisions (`APPROVE`, `REJECT`) along with comments by authorized triage managers.
6.  **`Transaction`**: Audits of all network events (`CREATE_BOUNTY`, `LOCK_REWARD`, `SUBMIT_REPORT`, `APPROVE_REPORT`, `RELEASE_REWARD`, `REFUND`).

---

## 7. Development & Coding Conventions

When modifying, extending, or maintaining this codebase, follow these rigid standards:

### React/Vite Frontend
*   **Components/Views**: Standardize on functional components written with modern ES Modules and React 19 hooks. Use PascalCase filenames (e.g., `BountyMarketplace.jsx`).
*   **Styling**: Use utility-based styling with Tailwind-like classes or global CSS. Always verify existing class names to match the high-fidelity dark aesthetic (#0A0A0A base background, lavender highlights).
*   **Blockchain Signatures**: Use Freighter's API wrapper located in `frontend/src/lib/freighter.js` to sign and push transactions to Soroban.
*   **Linting**: Always maintain zero-warning code quality. Run `npm run lint` before committing any visual or functional changes.

### NestJS Backend
*   **Prisma Updates**: When modifying database schema in `prisma/schema.prisma`, always run `npx prisma generate` followed by a local DB migration or sync.
*   **Strong Types**: Ensure strict TS-typing. Avoid the use of `any`. Utilize NestJS validators (`class-validator`) in all input DTOs.
*   **Security Filters**: Register and catch appropriate database and network errors globally using `HttpExceptionFilter` and guards like `JwtAuthGuard`.

### Soroban Smart Contracts
*   **No Std Library**: The contract MUST be annotated with `#![no_std]`.
*   **Storage Best Practices**: Properly categorize data with ledger-friendly keys using types defined in `contracts/bugchain/src/storage.rs` to maintain optimized states.
*   **Events**: Standardize on firing contract events (`events.rs`) for state-altering transactions (`create_bounty`, `submit_report`, `report_approved`, etc.).

---

## 8. Specific AI Agent Workflow Guidelines

If you are an autonomous AI sub-agent tasked with writing code, follow these steps meticulously:

1.  **Code Consistency**: Mimic the surrounding code formatting (tabs, spacing, bracket layout). Do not rewrite helper functions or duplicate structures already defined in utility files like `stellar.ts` or `freighter.js`.
2.  **Verify compilation**: Immediately compile and verify changes.
    *   Backend: Run a quick build check if typescript changes occur.
    *   Contracts: Always execute `cargo test` in `contracts/` if modifying contracts.
3.  **No Suppressed Warnings**: Do not use lint-ignores, suppression comments, type casting overrides, or hidden workarounds to bypass warnings. Address compilation and typing alerts explicitly.
4.  **Secret Redaction**: Never hardcode private keys, wallet secret phrases, database credentials, or API secret tokens. Leverage `.env` files and corresponding schema definitions instead.
