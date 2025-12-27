/**
 * Real-time Events Handler
 * Bridges EventBus and Socket.io for real-time notifications
 */

import eventBus from "./eventBus.js";
import { NotificationService } from "./notificationService.js";

export const setupRealtimeEvents = (io) => {
  const notificationService = new NotificationService(io);

  // ==================== USER EVENTS ====================

  eventBus.on("user.registered", (data) => {
    const { user } = data;
    notificationService.broadcastNotification("user_registered", {
      message: "New user registered",
      userId: user._id,
    });
  });

  eventBus.on("user.login_success", (data) => {
    const { userId } = data;
    io.to(`user:${userId}`).emit("user_login", { userId, timestamp: new Date() });
  });

  eventBus.on("user.logout", (data) => {
    const { userId } = data;
    io.to(`user:${userId}`).emit("user_logout", { userId });
  });

  eventBus.on("user.profile_updated", (data) => {
    const { userId, updatedData } = data;
    notificationService.notifyUser(userId, "profile_updated", {
      message: "Your profile has been updated",
      data: updatedData,
    });
  });

  eventBus.on("user.suspended", (data) => {
    const { userId, reason } = data;
    notificationService.notifyAccountSuspended(userId, reason);
  });

  eventBus.on("user.reactivated", (data) => {
    const { userId } = data;
    notificationService.notifyAccountReactivated(userId);
  });

  // ==================== COMMISSION EVENTS ====================

  eventBus.on("commission.earned", (data) => {
    const { userId, commissionData } = data;
    notificationService.notifyCommissionEarned(userId, commissionData);

    // Broadcast to analytics
    io.to("analytics_updates").emit("commission_earned", {
      userId,
      amount: commissionData.netAmount,
    });
  });

  eventBus.on("commission.approved", (data) => {
    const { commissionId } = data;
    io.emit("commission_approved", { commissionId });
  });

  eventBus.on("commission.paid", (data) => {
    const { commissionId, payoutId } = data;
    io.emit("commission_paid", { commissionId, payoutId });
  });

  // ==================== PAYOUT EVENTS ====================

  eventBus.on("payout.requested", (data) => {
    const { userId, payoutData } = data;
    notificationService.notifyPayoutUpdate(userId, payoutData);
  });

  eventBus.on("payout.approved", (data) => {
    const { payoutId } = data;
    io.emit("payout_approved", { payoutId, timestamp: new Date() });
  });

  eventBus.on("payout.processing", (data) => {
    const { payoutId } = data;
    io.emit("payout_processing", { payoutId, timestamp: new Date() });
  });

  eventBus.on("payout.completed", (data) => {
    const { payoutId } = data;
    io.emit("payout_completed", {
      payoutId,
      message: "Your payout has been completed",
      timestamp: new Date(),
    });
  });

  eventBus.on("payout.failed", (data) => {
    const { payoutId, reason } = data;
    io.emit("payout_failed", { payoutId, reason, timestamp: new Date() });
  });

  // ==================== REFERRAL EVENTS ====================

  eventBus.on("referral.created", (data) => {
    const { referrerId, referralData } = data;
    notificationService.notifyUser(referrerId, "referral_created", {
      message: "New referral registered",
      referralData,
    });
  });

  eventBus.on("referral.activated", (data) => {
    const { referralId } = data;
    io.emit("referral_activated", { referralId, timestamp: new Date() });
  });

  // ==================== KYC EVENTS ====================

  eventBus.on("kyc.submitted", (data) => {
    const { userId } = data;
    notificationService.notifyUser(userId, "kyc_submitted", {
      message: "Your KYC has been submitted for verification",
    });
  });

  eventBus.on("kyc.verified", (data) => {
    const { userId, kycData } = data;
    notificationService.notifyKYCStatusUpdate(userId, kycData);
  });

  eventBus.on("kyc.rejected", (data) => {
    const { userId, reason } = data;
    notificationService.notifyUser(userId, "kyc_rejected", {
      message: `Your KYC has been rejected. Reason: ${reason}`,
      reason,
    });
  });

  // ==================== INCENTIVE EVENTS ====================

  eventBus.on("incentive.qualified", (data) => {
    const { userId, incentiveData } = data;
    notificationService.notifyIncentiveQualified(userId, incentiveData);
  });

  eventBus.on("incentive.awarded", (data) => {
    const { userId, incentiveData } = data;
    notificationService.notifyIncentiveAwarded(userId, incentiveData);
  });

  eventBus.on("incentive.claimed", (data) => {
    const { userId, incentiveId } = data;
    notificationService.notifyUser(userId, "incentive_claimed", {
      message: "Your incentive has been claimed",
      incentiveId,
    });
  });

  // ==================== MEETING EVENTS ====================

  eventBus.on("meeting.created", (data) => {
    const { meetingData } = data;
    notificationService.broadcastNotification("meeting_created", {
      message: `New meeting: ${meetingData.title}`,
      meetingData,
    });
  });

  eventBus.on("meeting.started", (data) => {
    const { meetingId } = data;
    io.emit("meeting_started", { meetingId, timestamp: new Date() });
  });

  eventBus.on("meeting.ended", (data) => {
    const { meetingId, statistics } = data;
    io.emit("meeting_ended", { meetingId, statistics, timestamp: new Date() });
  });

  eventBus.on("meeting.joined", (data) => {
    const { meetingId, userId } = data;
    io.to(`meeting:${meetingId}`).emit("user_joined_meeting", { userId });
  });

  // ==================== ANNOUNCEMENT EVENTS ====================

  eventBus.on("announcement.created", (data) => {
    const { announcementData } = data;
    console.log("📢 Broadcasting announcement_created event:", announcementData);
    // Emit directly to all connected clients
    io.emit("announcement_created", { announcementData });
    // Also use notification service for backwards compatibility
    notificationService.broadcastNotification("announcement_created", announcementData);
  });

  eventBus.on("announcement.updated", (data) => {
    const { announcementId, updatedData } = data;
    console.log("📝 Broadcasting announcement_updated event:", announcementId);
    io.emit("announcement_updated", { announcementId, updatedData });
  });

  eventBus.on("announcement.deleted", (data) => {
    const { announcementId } = data;
    console.log("🗑️ Broadcasting announcement_deleted event:", announcementId);
    io.emit("announcement_deleted", { announcementId });
  });

  // ==================== TEAM EVENTS ====================

  eventBus.on("team.created", (data) => {
    const { teamData } = data;
    io.emit("team_created", { teamData, timestamp: new Date() });
  });

  eventBus.on("team.updated", (data) => {
    const { teamId, updatedData } = data;
    notificationService.notifyTeamUpdate(teamId, updatedData);
  });

  eventBus.on("team.member_added", (data) => {
    const { teamId, userId } = data;
    io.to(`team:${teamId}`).emit("member_added", { userId, timestamp: new Date() });
  });

  eventBus.on("team.member_removed", (data) => {
    const { teamId, userId } = data;
    io.to(`team:${teamId}`).emit("member_removed", { userId });
  });

  // ==================== ANALYTICS EVENTS ====================

  eventBus.on("analytics.updated", (data) => {
    const { analyticsData } = data;
    notificationService.broadcastAnalyticsUpdate(analyticsData);
  });

  eventBus.on("dashboard.metrics_updated", (data) => {
    const { metrics } = data;
    io.to("analytics_updates").emit("dashboard_metrics", metrics);
  });

  // ==================== LEVEL EVENTS ====================

  eventBus.on("level.promoted", (data) => {
    const { userId, newLevel } = data;
    notificationService.notifyLevelPromotion(userId, { newLevel });
  });

  eventBus.on("level.demoted", (data) => {
    const { userId, newLevel } = data;
    notificationService.notifyUser(userId, "level_demoted", {
      message: `Your level has been demoted to Level ${newLevel}`,
      newLevel,
    });
  });

  // ==================== ERROR EVENTS ====================

  eventBus.on("error.occurred", (data) => {
    const { errorData } = data;
    console.error("[ERROR EVENT]", errorData);
    io.emit("system_error", { error: errorData });
  });

  // ==================== ADMIN EVENTS ====================

  eventBus.on("admin.action", (data) => {
    const { action, adminId, targetId, details } = data;
    console.log(`[ADMIN ACTION] ${action} by ${adminId} on ${targetId}`);
    io.emit("admin_action", { action, adminId, targetId, details });
  });

  console.log("✅ Real-time events handler initialized successfully");
};

export default setupRealtimeEvents;
