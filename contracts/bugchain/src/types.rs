use soroban_sdk::{contracttype, Address, BytesN};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum BountyStatus {
    Open,
    Completed,
    Closed,
    Refunded,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ReportStatus {
    Pending,
    Approved,
    Rejected,
    Disputed,
    Paid,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Severity {
    Low,
    Medium,
    High,
    Critical,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardSuggestion {
    pub min_xlm: i128,
    pub recommended_xlm: i128,
    pub max_xlm: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Bounty {
    pub id: u64,
    pub owner: Address,
    pub asset: Address,
    pub reward_amount: i128,
    pub total_escrowed: i128,
    pub remaining_balance: i128,
    pub deadline: u64,
    pub metadata_hash: BytesN<32>,
    pub status: BountyStatus,
    pub approved_report_id: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Report {
    pub id: u64,
    pub bounty_id: u64,
    pub hunter: Address,
    pub report_hash: BytesN<32>,
    pub status: ReportStatus,
    pub payout_amount: i128,
    pub submitted_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    BountyCounter,
    ReportCounter,
    Bounty(u64),
    Report(u64),
}
