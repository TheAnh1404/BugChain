# Smart Contracts Workspace

This directory contains the **Soroban** smart contracts written in **Rust** for the BugChain Web3 Bug Bounty platform. These contracts handle the secure escrow of reward pools, private registration of cryptographic vulnerability report hashes, and automated payment release upon verification.

## Contract Architecture

The primary contract is `contracts/bug_bounty`:

- **`initialize(owner: Address, reward_amount: u128)`**: Sets up the triage authority and registers the locked reward pool.
- **`register_report(reporter: Address, report_id: Symbol)`**: Allows security researchers to securely claim discovery of a bug on-chain by registering a hash of their report without revealing the vulnerability contents.
- **`resolve_report(owner: Address, report_id: Symbol, researcher: Address, payout_amount: u128)`**: Triggers the release of funds from the contract escrow directly to the researcher's wallet. Restricted to the triage owner.
- **`get_report_status(report_id: Symbol) -> i32`**: Returns the triage status (Pending, Approved, Rejected).
- **`get_reward_pool() -> u128`**: Returns the active escrow reward size.

---

## Upgrade & Compilation Guide

### 1. Prerequisites
Ensure you have Rust, WASM target compilation, and the Soroban CLI installed:

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add the WASM compilation target
rustup target add wasm32-unknown-unknown

# Install Soroban CLI
cargo install --locked soroban-cli
```

### 2. Build the Contract
Compile the Rust codebase into a lightweight WebAssembly binary:

```bash
# Navigate to workspace
cd contracts/

# Build release WASM
cargo build --target wasm32-unknown-unknown --release
```

The resulting file will be located at:
`target/wasm32-unknown-unknown/release/bug_bounty.wasm`

### 3. Optimize the Binary
Soroban charges transaction fees based on WASM size. Optimize the binary before deployment:

```bash
soroban contract optimize --wasm ../target/wasm32-unknown-unknown/release/bug_bounty.wasm
```

This generates `bug_bounty.optimized.wasm` in the same directory, significantly reducing size and gas costs.

### 4. Deploy to Stellar Futurenet

Deploy to the Stellar Futurenet test network:

```bash
# Generate a test deployment account
soroban keys generate hunter --network futurenet

# Deploy to Futurenet
soroban contract deploy \
  --wasm ../target/wasm32-unknown-unknown/release/bug_bounty.optimized.wasm \
  --source hunter \
  --network futurenet
```

This returns the contract's unique address (e.g. `C...`). Use this contract ID in your frontend Freighter wallet integration!
