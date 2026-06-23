use soroban_sdk::{panic_with_error, Address, Env};

use crate::errors::BugChainError;
use crate::types::{Bounty, DataKey, Report};

pub fn has_admin(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Admin)
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::Admin)
        .unwrap_or_else(|| panic_with_error!(env, BugChainError::NotInitialized))
}

pub fn require_initialized(env: &Env) {
    if !has_admin(env) {
        panic_with_error!(env, BugChainError::NotInitialized);
    }
}

pub fn next_bounty_id(env: &Env) -> u64 {
    let current = env
        .storage()
        .instance()
        .get::<DataKey, u64>(&DataKey::BountyCounter)
        .unwrap_or(0);
    let next = current + 1;
    env.storage().instance().set(&DataKey::BountyCounter, &next);
    next
}

pub fn next_report_id(env: &Env) -> u64 {
    let current = env
        .storage()
        .instance()
        .get::<DataKey, u64>(&DataKey::ReportCounter)
        .unwrap_or(0);
    let next = current + 1;
    env.storage().instance().set(&DataKey::ReportCounter, &next);
    next
}

pub fn set_bounty(env: &Env, bounty: &Bounty) {
    env.storage()
        .persistent()
        .set(&DataKey::Bounty(bounty.id), bounty);
}

pub fn get_bounty(env: &Env, bounty_id: u64) -> Bounty {
    env.storage()
        .persistent()
        .get::<DataKey, Bounty>(&DataKey::Bounty(bounty_id))
        .unwrap_or_else(|| panic_with_error!(env, BugChainError::BountyNotFound))
}

pub fn set_report(env: &Env, report: &Report) {
    env.storage()
        .persistent()
        .set(&DataKey::Report(report.id), report);
}

pub fn get_report(env: &Env, report_id: u64) -> Report {
    env.storage()
        .persistent()
        .get::<DataKey, Report>(&DataKey::Report(report_id))
        .unwrap_or_else(|| panic_with_error!(env, BugChainError::ReportNotFound))
}
