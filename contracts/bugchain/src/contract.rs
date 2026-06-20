use soroban_sdk::{contract, contractimpl, panic_with_error, token, Address, BytesN, Env};

use crate::errors::BugChainError;
use crate::events;
use crate::storage;
use crate::types::{Bounty, BountyStatus, Report, ReportStatus};

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

    pub fn claim_reward(env: Env, hunter: Address, bounty_id: u64, report_id: u64) {
        storage::require_initialized(&env);
        hunter.require_auth();

        let bounty = storage::get_bounty(&env, bounty_id);
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
        storage::set_report(&env, &report);
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
        token_client.transfer(&contract_address, &owner, &bounty.reward_amount);

        bounty.status = BountyStatus::Refunded;
        storage::set_bounty(&env, &bounty);
        events::bounty_refunded(&env, bounty_id, owner, bounty.reward_amount);
    }

    pub fn get_bounty(env: Env, bounty_id: u64) -> Bounty {
        storage::get_bounty(&env, bounty_id)
    }

    pub fn get_report(env: Env, report_id: u64) -> Report {
        storage::get_report(&env, report_id)
    }
}
