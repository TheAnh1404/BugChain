extern crate std;

use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{token, Address, BytesN, Env};

use crate::contract::{BugChainContract, BugChainContractClient};
use crate::types::{BountyStatus, ReportStatus, Severity};

struct TestContext {
    env: Env,
    client: BugChainContractClient<'static>,
    token: token::Client<'static>,
    admin: Address,
    owner: Address,
    hunter: Address,
    other: Address,
}

fn hash(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

fn setup() -> TestContext {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|li| {
        li.timestamp = 1_700_000_000;
    });

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let hunter = Address::generate(&env);
    let other = Address::generate(&env);

    let contract_id = env.register_contract(None, BugChainContract);
    let client = BugChainContractClient::new(&env, &contract_id);

    let token_id = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let token = token::Client::new(&env, &token_id);
    let token_admin = token::StellarAssetClient::new(&env, &token_id);
    token_admin.mint(&owner, &10_000);

    TestContext {
        env,
        client,
        token,
        admin,
        owner,
        hunter,
        other,
    }
}

fn initialized() -> TestContext {
    let ctx = setup();
    ctx.client.initialize(&ctx.admin);
    ctx
}

fn create_bounty(ctx: &TestContext, amount: i128, deadline: u64) -> u64 {
    ctx.client.create_bounty(
        &ctx.owner,
        &ctx.token.address,
        &amount,
        &deadline,
        &hash(&ctx.env, 1),
    )
}

fn create_report(ctx: &TestContext, bounty_id: u64) -> u64 {
    ctx.client
        .submit_report(&ctx.hunter, &bounty_id, &hash(&ctx.env, 2))
}

#[test]
fn initialize_works() {
    let ctx = setup();
    ctx.client.initialize(&ctx.admin);
}

#[test]
fn severity_reward_suggestions_are_available() {
    let ctx = setup();

    let low = ctx.client.suggest_reward(&Severity::Low);
    assert_eq!(low.min_xlm, 25);
    assert_eq!(low.recommended_xlm, 50);
    assert_eq!(low.max_xlm, 100);

    let critical = ctx.client.suggest_reward(&Severity::Critical);
    assert_eq!(critical.min_xlm, 2_500);
    assert_eq!(critical.recommended_xlm, 5_000);
    assert_eq!(critical.max_xlm, 10_000);
}

#[test]
fn create_bounty_locks_reward_and_stores_bounty() {
    let ctx = initialized();
    let deadline = ctx.env.ledger().timestamp() + 100;
    let owner_before = ctx.token.balance(&ctx.owner);

    let bounty_id = create_bounty(&ctx, 1_000, deadline);
    let bounty = ctx.client.get_bounty(&bounty_id);

    assert_eq!(bounty.id, bounty_id);
    assert_eq!(bounty.owner, ctx.owner);
    assert_eq!(bounty.reward_amount, 1_000);
    assert_eq!(bounty.total_escrowed, 1_000);
    assert_eq!(bounty.remaining_balance, 1_000);
    assert_eq!(bounty.status, BountyStatus::Open);
    assert_eq!(ctx.token.balance(&ctx.owner), owner_before - 1_000);
    assert_eq!(ctx.token.balance(&ctx.client.address), 1_000);
}

#[test]
fn owner_can_deposit_and_partial_payout_multiple_reports() {
    let ctx = initialized();
    let deadline = ctx.env.ledger().timestamp() + 100;
    let bounty_id = create_bounty(&ctx, 1_000, deadline);
    ctx.client.deposit_funds(&ctx.owner, &bounty_id, &500);

    let first_report_id = create_report(&ctx, bounty_id);
    let second_report_id = create_report(&ctx, bounty_id);
    let hunter_before = ctx.token.balance(&ctx.hunter);

    ctx.client
        .approve_report_with_payout(&ctx.owner, &bounty_id, &first_report_id, &400);
    ctx.client
        .approve_report_with_payout(&ctx.owner, &bounty_id, &second_report_id, &600);

    let bounty = ctx.client.get_bounty(&bounty_id);
    let first_report = ctx.client.get_report(&first_report_id);
    let second_report = ctx.client.get_report(&second_report_id);

    assert_eq!(ctx.token.balance(&ctx.hunter), hunter_before + 1_000);
    assert_eq!(ctx.token.balance(&ctx.client.address), 500);
    assert_eq!(bounty.status, BountyStatus::Open);
    assert_eq!(bounty.total_escrowed, 1_500);
    assert_eq!(bounty.remaining_balance, 500);
    assert_eq!(first_report.status, ReportStatus::Paid);
    assert_eq!(first_report.payout_amount, 400);
    assert_eq!(second_report.status, ReportStatus::Paid);
    assert_eq!(second_report.payout_amount, 600);
}

#[test]
fn hunter_can_escalate_rejected_report_and_admin_can_pay_dispute() {
    let ctx = initialized();
    let deadline = ctx.env.ledger().timestamp() + 100;
    let bounty_id = create_bounty(&ctx, 1_000, deadline);
    let report_id = create_report(&ctx, bounty_id);

    ctx.client.reject_report(&ctx.owner, &bounty_id, &report_id);
    ctx.client.escalate_dispute(&ctx.hunter, &report_id);

    let hunter_before = ctx.token.balance(&ctx.hunter);
    ctx.client
        .resolve_dispute(&ctx.admin, &bounty_id, &report_id, &true);

    let bounty = ctx.client.get_bounty(&bounty_id);
    let report = ctx.client.get_report(&report_id);

    assert_eq!(ctx.token.balance(&ctx.hunter), hunter_before + 1_000);
    assert_eq!(bounty.status, BountyStatus::Completed);
    assert_eq!(bounty.remaining_balance, 0);
    assert_eq!(report.status, ReportStatus::Paid);
    assert_eq!(report.payout_amount, 1_000);
}

#[test]
fn admin_can_reject_dispute_and_close_bounty() {
    let ctx = initialized();
    let deadline = ctx.env.ledger().timestamp() + 100;
    let bounty_id = create_bounty(&ctx, 1_000, deadline);
    let report_id = create_report(&ctx, bounty_id);

    ctx.client.reject_report(&ctx.owner, &bounty_id, &report_id);
    ctx.client.escalate_dispute(&ctx.hunter, &report_id);

    let owner_before = ctx.token.balance(&ctx.owner);
    ctx.client
        .resolve_dispute(&ctx.admin, &bounty_id, &report_id, &false);

    let bounty = ctx.client.get_bounty(&bounty_id);
    let report = ctx.client.get_report(&report_id);

    assert_eq!(ctx.token.balance(&ctx.owner), owner_before + 1_000);
    assert_eq!(ctx.token.balance(&ctx.client.address), 0);
    assert_eq!(bounty.status, BountyStatus::Closed);
    assert_eq!(bounty.remaining_balance, 0);
    assert_eq!(report.status, ReportStatus::Rejected);
}

#[test]
#[should_panic]
fn create_bounty_fails_with_invalid_reward_amount() {
    let ctx = initialized();
    let deadline = ctx.env.ledger().timestamp() + 100;
    create_bounty(&ctx, 0, deadline);
}

#[test]
fn submit_report_works() {
    let ctx = initialized();
    let deadline = ctx.env.ledger().timestamp() + 100;
    let bounty_id = create_bounty(&ctx, 1_000, deadline);

    let report_id = create_report(&ctx, bounty_id);
    let report = ctx.client.get_report(&report_id);

    assert_eq!(report.id, report_id);
    assert_eq!(report.bounty_id, bounty_id);
    assert_eq!(report.hunter, ctx.hunter);
    assert_eq!(report.status, ReportStatus::Pending);
}

#[test]
#[should_panic]
fn hunter_cannot_submit_to_own_bounty() {
    let ctx = initialized();
    let deadline = ctx.env.ledger().timestamp() + 100;
    let bounty_id = create_bounty(&ctx, 1_000, deadline);

    ctx.client
        .submit_report(&ctx.owner, &bounty_id, &hash(&ctx.env, 3));
}

#[test]
fn owner_can_approve_report() {
    let ctx = initialized();
    let deadline = ctx.env.ledger().timestamp() + 100;
    let bounty_id = create_bounty(&ctx, 1_000, deadline);
    let report_id = create_report(&ctx, bounty_id);

    ctx.client
        .approve_report(&ctx.owner, &bounty_id, &report_id);

    let bounty = ctx.client.get_bounty(&bounty_id);
    let report = ctx.client.get_report(&report_id);
    assert_eq!(bounty.status, BountyStatus::Completed);
    assert_eq!(bounty.approved_report_id, Some(report_id));
    assert_eq!(report.status, ReportStatus::Approved);
}

#[test]
#[should_panic]
fn non_owner_cannot_approve_report() {
    let ctx = initialized();
    let deadline = ctx.env.ledger().timestamp() + 100;
    let bounty_id = create_bounty(&ctx, 1_000, deadline);
    let report_id = create_report(&ctx, bounty_id);

    ctx.client
        .approve_report(&ctx.other, &bounty_id, &report_id);
}

#[test]
fn hunter_can_claim_reward_after_approval() {
    let ctx = initialized();
    let deadline = ctx.env.ledger().timestamp() + 100;
    let bounty_id = create_bounty(&ctx, 1_000, deadline);
    let report_id = create_report(&ctx, bounty_id);

    ctx.client
        .approve_report(&ctx.owner, &bounty_id, &report_id);

    let hunter_before = ctx.token.balance(&ctx.hunter);
    ctx.client.claim_reward(&ctx.hunter, &bounty_id, &report_id);

    let report = ctx.client.get_report(&report_id);
    assert_eq!(ctx.token.balance(&ctx.hunter), hunter_before + 1_000);
    assert_eq!(ctx.token.balance(&ctx.client.address), 0);
    assert_eq!(report.status, ReportStatus::Paid);
}

#[test]
#[should_panic]
fn hunter_cannot_claim_twice() {
    let ctx = initialized();
    let deadline = ctx.env.ledger().timestamp() + 100;
    let bounty_id = create_bounty(&ctx, 1_000, deadline);
    let report_id = create_report(&ctx, bounty_id);

    ctx.client
        .approve_report(&ctx.owner, &bounty_id, &report_id);
    ctx.client.claim_reward(&ctx.hunter, &bounty_id, &report_id);
    ctx.client.claim_reward(&ctx.hunter, &bounty_id, &report_id);
}

#[test]
fn owner_can_refund_expired_bounty() {
    let ctx = initialized();
    let deadline = ctx.env.ledger().timestamp() + 100;
    let bounty_id = create_bounty(&ctx, 1_000, deadline);

    ctx.env.ledger().with_mut(|li| {
        li.timestamp = deadline + 1;
    });

    let owner_before = ctx.token.balance(&ctx.owner);
    ctx.client.refund_expired_bounty(&ctx.owner, &bounty_id);

    let bounty = ctx.client.get_bounty(&bounty_id);
    assert_eq!(ctx.token.balance(&ctx.owner), owner_before + 1_000);
    assert_eq!(ctx.token.balance(&ctx.client.address), 0);
    assert_eq!(bounty.status, BountyStatus::Refunded);
}

#[test]
#[should_panic]
fn owner_cannot_refund_before_deadline() {
    let ctx = initialized();
    let deadline = ctx.env.ledger().timestamp() + 100;
    let bounty_id = create_bounty(&ctx, 1_000, deadline);

    ctx.client.refund_expired_bounty(&ctx.owner, &bounty_id);
}

#[test]
#[should_panic]
fn rejected_report_cannot_claim_reward() {
    let ctx = initialized();
    let deadline = ctx.env.ledger().timestamp() + 100;
    let bounty_id = create_bounty(&ctx, 1_000, deadline);
    let report_id = create_report(&ctx, bounty_id);

    ctx.client.reject_report(&ctx.owner, &bounty_id, &report_id);
    ctx.client.claim_reward(&ctx.hunter, &bounty_id, &report_id);
}

#[test]
#[should_panic]
fn owner_cannot_approve_unrelated_report() {
    let ctx = initialized();
    let deadline = ctx.env.ledger().timestamp() + 100;
    let bounty_id1 = create_bounty(&ctx, 1_000, deadline);
    let bounty_id2 = create_bounty(&ctx, 1_000, deadline);
    let report_id2 = create_report(&ctx, bounty_id2);

    // Attempt to approve report_id2 under bounty_id1
    ctx.client
        .approve_report(&ctx.owner, &bounty_id1, &report_id2);
}

#[test]
#[should_panic]
fn claim_without_approval_rejected() {
    let ctx = initialized();
    let deadline = ctx.env.ledger().timestamp() + 100;
    let bounty_id = create_bounty(&ctx, 1_000, deadline);
    let report_id = create_report(&ctx, bounty_id);

    // Attempt to claim before approval
    ctx.client.claim_reward(&ctx.hunter, &bounty_id, &report_id);
}
