use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum BugChainError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    BountyNotFound = 3,
    ReportNotFound = 4,
    InvalidRewardAmount = 5,
    InvalidDeadline = 6,
    Unauthorized = 7,
    BountyNotOpen = 8,
    DeadlinePassed = 9,
    DeadlineNotPassed = 10,
    CannotSubmitOwnBounty = 11,
    ReportNotPending = 12,
    ReportNotApproved = 13,
    ReportDoesNotBelongToBounty = 14,
    BountyNotCompleted = 15,
    AlreadyClaimed = 16,
    NoApprovedReport = 17,
    InvalidPayoutAmount = 18,
    CannotEscalateNonRejectedReport = 19,
    ReportNotDisputed = 20,
}
