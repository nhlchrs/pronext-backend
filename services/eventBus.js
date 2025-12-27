import { EventEmitter } from "events";

/**
 * Centralized Event Bus for real-time updates
 * Handles all system-wide events
 */

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20);
  }

  // User Events
  emitUserRegistered(user) {
    this.emit("user.registered", user);
  }

  emitUserLoginSuccess(userId, sessionInfo) {
    this.emit("user.login_success", { userId, sessionInfo });
  }

  emitUserLogout(userId) {
    this.emit("user.logout", { userId });
  }

  emitUserProfileUpdated(userId, updatedData) {
    this.emit("user.profile_updated", { userId, updatedData });
  }

  emitUserSuspended(userId, reason) {
    this.emit("user.suspended", { userId, reason });
  }

  emitUserReactivated(userId) {
    this.emit("user.reactivated", { userId });
  }

  // Commission Events
  emitCommissionEarned(userId, commissionData) {
    this.emit("commission.earned", { userId, commissionData });
  }

  emitCommissionApproved(commissionId) {
    this.emit("commission.approved", { commissionId });
  }

  emitCommissionPaid(commissionId, payoutId) {
    this.emit("commission.paid", { commissionId, payoutId });
  }

  // Payout Events
  emitPayoutRequested(userId, payoutData) {
    this.emit("payout.requested", { userId, payoutData });
  }

  emitPayoutApproved(payoutId) {
    this.emit("payout.approved", { payoutId });
  }

  emitPayoutProcessing(payoutId) {
    this.emit("payout.processing", { payoutId });
  }

  emitPayoutCompleted(payoutId) {
    this.emit("payout.completed", { payoutId });
  }

  emitPayoutFailed(payoutId, reason) {
    this.emit("payout.failed", { payoutId, reason });
  }

  // Referral Events
  emitReferralCreated(referrerId, referralData) {
    this.emit("referral.created", { referrerId, referralData });
  }

  emitReferralActivated(referralId) {
    this.emit("referral.activated", { referralId });
  }

  // KYC Events
  emitKYCSubmitted(userId, kycData) {
    this.emit("kyc.submitted", { userId, kycData });
  }

  emitKYCVerified(userId, kycData) {
    this.emit("kyc.verified", { userId, kycData });
  }

  emitKYCRejected(userId, reason) {
    this.emit("kyc.rejected", { userId, reason });
  }

  // Incentive Events
  emitIncentiveQualified(userId, incentiveData) {
    this.emit("incentive.qualified", { userId, incentiveData });
  }

  emitIncentiveAwarded(userId, incentiveData) {
    this.emit("incentive.awarded", { userId, incentiveData });
  }

  emitIncentiveClaimed(userId, incentiveId) {
    this.emit("incentive.claimed", { userId, incentiveId });
  }

  // Meeting Events
  emitMeetingCreated(meetingData) {
    this.emit("meeting.created", { meetingData });
  }

  emitMeetingStarted(meetingId) {
    this.emit("meeting.started", { meetingId });
  }

  emitMeetingEnded(meetingId, statistics) {
    this.emit("meeting.ended", { meetingId, statistics });
  }

  emitMeetingJoined(meetingId, userId) {
    this.emit("meeting.joined", { meetingId, userId });
  }

  // Announcement Events
  emitAnnouncementCreated(announcementData) {
    this.emit("announcement.created", { announcementData });
  }

  emitAnnouncementUpdated(announcementId, updatedData) {
    this.emit("announcement.updated", { announcementId, updatedData });
  }

  emitAnnouncementDeleted(announcementId) {
    this.emit("announcement.deleted", { announcementId });
  }

  // Team Events
  emitTeamCreated(teamData) {
    this.emit("team.created", { teamData });
  }

  emitTeamUpdated(teamId, updatedData) {
    this.emit("team.updated", { teamId, updatedData });
  }

  emitTeamMemberAdded(teamId, userId) {
    this.emit("team.member_added", { teamId, userId });
  }

  emitTeamMemberRemoved(teamId, userId) {
    this.emit("team.member_removed", { teamId, userId });
  }

  // Analytics Events
  emitAnalyticsUpdated(analyticsData) {
    this.emit("analytics.updated", { analyticsData });
  }

  emitDashboardMetricsUpdated(metrics) {
    this.emit("dashboard.metrics_updated", { metrics });
  }

  // Level Events
  emitLevelPromotion(userId, newLevel) {
    this.emit("level.promoted", { userId, newLevel });
  }

  emitLevelDemotion(userId, newLevel) {
    this.emit("level.demoted", { userId, newLevel });
  }

  // Error Events
  emitError(errorData) {
    this.emit("error.occurred", { errorData });
  }

  // Admin Actions
  emitAdminAction(action, adminId, targetId, details) {
    this.emit("admin.action", { action, adminId, targetId, details });
  }

  // Announcement Events
  emitAnnouncementCreated(announcementData) {
    this.emit("announcement.created", { announcementData });
  }

  emitAnnouncementUpdated(announcementId, updatedData) {
    this.emit("announcement.updated", { announcementId, updatedData });
  }

  emitAnnouncementDeleted(announcementId) {
    this.emit("announcement.deleted", { announcementId });
  }
}

// Create and export singleton instance
const eventBus = new EventBus();

export default eventBus;
