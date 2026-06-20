use soroban_sdk::{Address, Env, Symbol};

pub fn bounty_created(
    env: &Env,
    bounty_id: u64,
    owner: Address,
    asset: Address,
    reward_amount: i128,
    deadline: u64,
) {
    env.events().publish(
        (Symbol::new(env, "bounty_created"), bounty_id),
        (owner, asset, reward_amount, deadline),
    );
}

pub fn report_submitted(env: &Env, report_id: u64, bounty_id: u64, hunter: Address) {
    env.events().publish(
        (Symbol::new(env, "report_submitted"), report_id),
        (bounty_id, hunter),
    );
}

pub fn report_approved(env: &Env, bounty_id: u64, report_id: u64, hunter: Address) {
    env.events().publish(
        (Symbol::new(env, "report_approved"), bounty_id, report_id),
        hunter,
    );
}

pub fn report_rejected(env: &Env, bounty_id: u64, report_id: u64) {
    env.events().publish(
        (Symbol::new(env, "report_rejected"), bounty_id, report_id),
        (),
    );
}

pub fn reward_claimed(env: &Env, bounty_id: u64, report_id: u64, hunter: Address, amount: i128) {
    env.events().publish(
        (Symbol::new(env, "reward_claimed"), bounty_id, report_id),
        (hunter, amount),
    );
}

pub fn bounty_refunded(env: &Env, bounty_id: u64, owner: Address, amount: i128) {
    env.events().publish(
        (Symbol::new(env, "bounty_refunded"), bounty_id),
        (owner, amount),
    );
}
