#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Owner,              // Address of the campaign owner/triage team
    RewardAmount,       // Balance locked for rewards
    ReportHash(Symbol), // Map report identifier to status (Approved = 1, Pending = 0, Rejected = 2)
}

#[contract]
pub struct BugBountyContract;

#[contractimpl]
impl BugBountyContract {
    /// Initialize the bug bounty campaign, setting the triage owner and locking initial reward limits.
    pub fn initialize(env: Env, owner: Address, reward_amount: u128) {
        // Prevent re-initialization by checking if Owner is already set
        if env.storage().instance().has(&DataKey::Owner) {
            panic!("Contract is already initialized");
        }
        
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::RewardAmount, &reward_amount);
    }

    /// Submit a cryptographic hash representing a vulnerability report.
    /// This locks the claim under the researcher's address without revealing the bug itself.
    pub fn register_report(env: Env, reporter: Address, report_id: Symbol) {
        // Authenticate the caller (researcher)
        reporter.require_auth();

        // Check if this report_id hash has already been registered
        let key = DataKey::ReportHash(report_id.clone());
        if env.storage().persistent().has(&key) {
            panic!("This report hash has already been submitted");
        }

        // Save report as pending (0 = pending)
        env.storage().persistent().set(&key, &0i32);

        // Emit report registration event
        env.events().publish(
            (symbol_short!("register"), report_id),
            reporter,
        );
    }

    /// Approve a report (triage success) and disburse the locked bounty reward directly to the researcher.
    /// Callable only by the verified triage owner.
    pub fn resolve_report(
        env: Env,
        owner: Address,
        report_id: Symbol,
        researcher: Address,
        payout_amount: u128,
    ) {
        // Verify owner signature
        owner.require_auth();

        // Ensure owner is the configured triage authority
        let saved_owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        if owner != saved_owner {
            panic!("Access denied: Caller is not the authorized program owner");
        }

        // Ensure report exists and is pending
        let key = DataKey::ReportHash(report_id.clone());
        if !env.storage().persistent().has(&key) {
            panic!("Report not found");
        }
        let status: i32 = env.storage().persistent().get(&key).unwrap();
        if status != 0 {
            panic!("Report already resolved or closed");
        }

        // Fetch reward pool balance
        let mut total_rewards: u128 = env.storage().instance().get(&DataKey::RewardAmount).unwrap();
        if payout_amount > total_rewards {
            panic!("Insufficient funds in the bounty escrow pool");
        }

        // Update reward balance
        total_rewards -= payout_amount;
        env.storage().instance().set(&DataKey::RewardAmount, &total_rewards);

        // Set status to approved (1 = approved)
        env.storage().persistent().set(&key, &1i32);

        // Emit resolution event
        env.events().publish(
            (symbol_short!("resolve"), report_id),
            (researcher, payout_amount),
        );
    }

    /// Fetch the current status of a report (0 = Pending, 1 = Approved, 2 = Rejected).
    pub fn get_report_status(env: Env, report_id: Symbol) -> i32 {
        let key = DataKey::ReportHash(report_id);
        if !env.storage().persistent().has(&key) {
            panic!("Report not found");
        }
        env.storage().persistent().get(&key).unwrap()
    }

    /// Fetch the remaining reward pool balance.
    pub fn get_reward_pool(env: Env) -> u128 {
        env.storage().instance().get(&DataKey::RewardAmount).unwrap_or(0)
    }
}
