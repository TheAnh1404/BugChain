use soroban_sdk::{contract, contractimpl, panic_with_error, token, Address, BytesN, Env};

use crate::errors::BugChainError;
use crate::events;
use crate::storage;
use crate::types::{Bounty, BountyStatus, Report, ReportStatus, RewardSuggestion, Severity};

#[contract]
pub struct BugChainContract;

#[contractimpl]
impl BugChainContract {
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();

        if storage::has_admin(&env) {
            panic_with_error!(&env, BugChainError::AlreadyInitialized);
        }

        storage::set_admin(&env, &admin);
    }

    pub fn create_bounty(
        env: Env,
        owner: Address,
        asset: Address,
        reward_amount: i128,
        deadline: u64,
        metadata_hash: BytesN<32>,
    ) -> u64 {
        storage::require_initialized(&env);
        owner.require_auth();

        if reward_amount <= 0 {
            panic_with_error!(&env, BugChainError::InvalidRewardAmount);
        }
        if deadline <= env.ledger().timestamp() {
            panic_with_error!(&env, BugChainError::InvalidDeadline);
        }

        let bounty_id = storage::next_bounty_id(&env);
        let contract_address = env.current_contract_address();
        let token_client = token::Client::new(&env, &asset);
        token_client.transfer(&owner, &contract_address, &reward_amount);

        let bounty = Bounty {
            id: bounty_id,
            owner: owner.clone(),
            asset: asset.clone(),
            reward_amount,
            total_escrowed: reward_amount,
            remaining_balance: reward_amount,
            deadline,
            metadata_hash,
            status: BountyStatus::Open,
            approved_report_id: None,
        };

        storage::set_bounty(&env, &bounty);
        events::bounty_created(&env, bounty_id, owner, asset, reward_amount, deadline);

        bounty_id
    }

    pub fn submit_report(
        env: Env,
        hunter: Address,
        bounty_id: u64,
        report_hash: BytesN<32>,
    ) -> u64 {
        storage::require_initialized(&env);
        hunter.require_auth();

        let bounty = storage::get_bounty(&env, bounty_id);
        if bounty.status != BountyStatus::Open {
            panic_with_error!(&env, BugChainError::BountyNotOpen);
        }
        if env.ledger().timestamp() > bounty.deadline {
            panic_with_error!(&env, BugChainError::DeadlinePassed);
        }
        if hunter == bounty.owner {
            panic_with_error!(&env, BugChainError::CannotSubmitOwnBounty);
        }

        let report_id = storage::next_report_id(&env);
        let report = Report {
            id: report_id,
            bounty_id,
            hunter: hunter.clone(),
            report_hash,
            status: ReportStatus::Pending,
            payout_amount: 0,
            submitted_at: env.ledger().timestamp(),
        };

        storage::set_report(&env, &report);
        events::report_submitted(&env, report_id, bounty_id, hunter);

        report_id
    }

    pub fn approve_report(env: Env, owner: Address, bounty_id: u64, report_id: u64) {
        storage::require_initialized(&env);
        owner.require_auth();

        let mut bounty = storage::get_bounty(&env, bounty_id);
        let mut report = storage::get_report(&env, report_id);

        if owner != bounty.owner {
            panic_with_error!(&env, BugChainError::Unauthorized);
        }
        if bounty.status != BountyStatus::Open {
            panic_with_error!(&env, BugChainError::BountyNotOpen);
        }
        if report.bounty_id != bounty_id {
            panic_with_error!(&env, BugChainError::ReportDoesNotBelongToBounty);
        }
        if report.status != ReportStatus::Pending {
            panic_with_error!(&env, BugChainError::ReportNotPending);
        }

        // TODO: Add multi-reviewer approval, dispute resolution, and reputation scoring.
        report.status = ReportStatus::Approved;
        bounty.status = BountyStatus::Completed;
        bounty.approved_report_id = Some(report_id);

        storage::set_report(&env, &report);
        storage::set_bounty(&env, &bounty);
        events::report_approved(&env, bounty_id, report_id, report.hunter);
    }

    pub fn deposit_funds(env: Env, owner: Address, bounty_id: u64, amount: i128) {
        storage::require_initialized(&env);
        owner.require_auth();

        if amount <= 0 {
            panic_with_error!(&env, BugChainError::InvalidRewardAmount);
        }

        let mut bounty = storage::get_bounty(&env, bounty_id);
        if owner != bounty.owner {
            panic_with_error!(&env, BugChainError::Unauthorized);
        }
        if bounty.status != BountyStatus::Open {
            panic_with_error!(&env, BugChainError::BountyNotOpen);
        }

        let contract_address = env.current_contract_address();
        let token_client = token::Client::new(&env, &bounty.asset);
        token_client.transfer(&owner, &contract_address, &amount);

        bounty.total_escrowed += amount;
        bounty.remaining_balance += amount;
        storage::set_bounty(&env, &bounty);
        events::funds_deposited(&env, bounty_id, owner, amount);
    }

    pub fn approve_report_with_payout(
        env: Env,
        owner: Address,
        bounty_id: u64,
        report_id: u64,
        payout_amount: i128,
    ) {
        storage::require_initialized(&env);
        owner.require_auth();

        let mut bounty = storage::get_bounty(&env, bounty_id);
        let mut report = storage::get_report(&env, report_id);

        if owner != bounty.owner {
            panic_with_error!(&env, BugChainError::Unauthorized);
        }
        if bounty.status != BountyStatus::Open {
            panic_with_error!(&env, BugChainError::BountyNotOpen);
        }
        if report.bounty_id != bounty_id {
            panic_with_error!(&env, BugChainError::ReportDoesNotBelongToBounty);
        }
        if report.status != ReportStatus::Pending {
            panic_with_error!(&env, BugChainError::ReportNotPending);
        }
        if payout_amount <= 0 || payout_amount > bounty.remaining_balance {
            panic_with_error!(&env, BugChainError::InvalidPayoutAmount);
        }

        let contract_address = env.current_contract_address();
        let token_client = token::Client::new(&env, &bounty.asset);
        token_client.transfer(&contract_address, &report.hunter, &payout_amount);

        bounty.remaining_balance -= payout_amount;
        if bounty.remaining_balance == 0 {
            bounty.status = BountyStatus::Completed;
        }

        report.status = ReportStatus::Paid;
        report.payout_amount = payout_amount;
        storage::set_report(&env, &report);
        storage::set_bounty(&env, &bounty);
        events::report_approved(&env, bounty_id, report_id, report.hunter.clone());
        events::reward_claimed(&env, bounty_id, report_id, report.hunter, payout_amount);
    }

    pub fn reject_report(env: Env, owner: Address, bounty_id: u64, report_id: u64) {
        storage::require_initialized(&env);
        owner.require_auth();

        let bounty = storage::get_bounty(&env, bounty_id);
        let mut report = storage::get_report(&env, report_id);

        if owner != bounty.owner {
            panic_with_error!(&env, BugChainError::Unauthorized);
        }
        if report.bounty_id != bounty_id {
            panic_with_error!(&env, BugChainError::ReportDoesNotBelongToBounty);
        }
        if report.status != ReportStatus::Pending {
            panic_with_error!(&env, BugChainError::ReportNotPending);
        }

        report.status = ReportStatus::Rejected;
        storage::set_report(&env, &report);
        events::report_rejected(&env, bounty_id, report_id);
    }

    pub fn escalate_dispute(env: Env, hunter: Address, report_id: u64) {
        storage::require_initialized(&env);
        hunter.require_auth();

        let mut report = storage::get_report(&env, report_id);
        if report.hunter != hunter {
            panic_with_error!(&env, BugChainError::Unauthorized);
        }
        if report.status != ReportStatus::Rejected {
            panic_with_error!(&env, BugChainError::CannotEscalateNonRejectedReport);
        }

        report.status = ReportStatus::Disputed;
        storage::set_report(&env, &report);
        events::dispute_escalated(&env, report.bounty_id, report_id);
    }

    pub fn resolve_dispute(
        env: Env,
        arbitrator: Address,
        bounty_id: u64,
        report_id: u64,
        payout_hunter: bool,
    ) {
        storage::require_initialized(&env);
        arbitrator.require_auth();

        let admin = storage::get_admin(&env);
        if arbitrator != admin {
            panic_with_error!(&env, BugChainError::Unauthorized);
        }

        let mut bounty = storage::get_bounty(&env, bounty_id);
        let mut report = storage::get_report(&env, report_id);
        if report.bounty_id != bounty_id {
            panic_with_error!(&env, BugChainError::ReportDoesNotBelongToBounty);
        }
        if report.status != ReportStatus::Disputed {
            panic_with_error!(&env, BugChainError::ReportNotDisputed);
        }

        let contract_address = env.current_contract_address();
        let token_client = token::Client::new(&env, &bounty.asset);
        if payout_hunter {
            let payout_amount = bounty.reward_amount.min(bounty.remaining_balance);
            if payout_amount <= 0 {
                panic_with_error!(&env, BugChainError::InvalidPayoutAmount);
            }
            token_client.transfer(&contract_address, &report.hunter, &payout_amount);
            bounty.remaining_balance -= payout_amount;
            if bounty.remaining_balance == 0 {
                bounty.status = BountyStatus::Completed;
            }
            report.status = ReportStatus::Paid;
            report.payout_amount = payout_amount;
        } else {
            if bounty.remaining_balance > 0 {
                token_client.transfer(&contract_address, &bounty.owner, &bounty.remaining_balance);
            }
            bounty.remaining_balance = 0;
            bounty.status = BountyStatus::Closed;
            report.status = ReportStatus::Rejected;
        }

        storage::set_report(&env, &report);
        storage::set_bounty(&env, &bounty);
        events::dispute_resolved(&env, bounty_id, report_id, payout_hunter);
    }

    pub fn claim_reward(env: Env, hunter: Address, bounty_id: u64, report_id: u64) {
        storage::require_initialized(&env);
        hunter.require_auth();

        let mut bounty = storage::get_bounty(&env, bounty_id);
        let mut report = storage::get_report(&env, report_id);

        if report.hunter != hunter {
            panic_with_error!(&env, BugChainError::Unauthorized);
        }
        if report.bounty_id != bounty_id {
            panic_with_error!(&env, BugChainError::ReportDoesNotBelongToBounty);
        }
        if bounty.status != BountyStatus::Completed {
            panic_with_error!(&env, BugChainError::BountyNotCompleted);
        }
        if bounty.approved_report_id.is_none() {
            panic_with_error!(&env, BugChainError::NoApprovedReport);
        }
        if bounty.approved_report_id != Some(report_id) {
            panic_with_error!(&env, BugChainError::NoApprovedReport);
        }
        if report.status == ReportStatus::Paid {
            panic_with_error!(&env, BugChainError::AlreadyClaimed);
        }
        if report.status != ReportStatus::Approved {
            panic_with_error!(&env, BugChainError::ReportNotApproved);
        }

        // TODO: Add partial rewards and severity-based reward schedules.
        let contract_address = env.current_contract_address();
        let token_client = token::Client::new(&env, &bounty.asset);
        token_client.transfer(&contract_address, &hunter, &bounty.reward_amount);

        report.status = ReportStatus::Paid;
        report.payout_amount = bounty.reward_amount;
        bounty.remaining_balance = 0;
        storage::set_report(&env, &report);
        storage::set_bounty(&env, &bounty);
        events::reward_claimed(&env, bounty_id, report_id, hunter, bounty.reward_amount);
    }

    pub fn refund_expired_bounty(env: Env, owner: Address, bounty_id: u64) {
        storage::require_initialized(&env);
        owner.require_auth();

        let mut bounty = storage::get_bounty(&env, bounty_id);
        if owner != bounty.owner {
            panic_with_error!(&env, BugChainError::Unauthorized);
        }
        if bounty.status != BountyStatus::Open {
            panic_with_error!(&env, BugChainError::BountyNotOpen);
        }
        if env.ledger().timestamp() <= bounty.deadline {
            panic_with_error!(&env, BugChainError::DeadlineNotPassed);
        }

        let contract_address = env.current_contract_address();
        let token_client = token::Client::new(&env, &bounty.asset);
        let refund_amount = bounty.remaining_balance;
        token_client.transfer(&contract_address, &owner, &refund_amount);

        bounty.status = BountyStatus::Refunded;
        bounty.remaining_balance = 0;
        storage::set_bounty(&env, &bounty);
        events::bounty_refunded(&env, bounty_id, owner, refund_amount);
    }

    pub fn get_bounty(env: Env, bounty_id: u64) -> Bounty {
        storage::get_bounty(&env, bounty_id)
    }

    pub fn get_report(env: Env, report_id: u64) -> Report {
        storage::get_report(&env, report_id)
    }

    pub fn suggest_reward(_env: Env, severity: Severity) -> RewardSuggestion {
        match severity {
            Severity::Low => RewardSuggestion {
                min_xlm: 25,
                recommended_xlm: 50,
                max_xlm: 100,
            },
            Severity::Medium => RewardSuggestion {
                min_xlm: 100,
                recommended_xlm: 250,
                max_xlm: 500,
            },
            Severity::High => RewardSuggestion {
                min_xlm: 500,
                recommended_xlm: 1_000,
                max_xlm: 2_500,
            },
            Severity::Critical => RewardSuggestion {
                min_xlm: 2_500,
                recommended_xlm: 5_000,
                max_xlm: 10_000,
            },
        }
    }
}
