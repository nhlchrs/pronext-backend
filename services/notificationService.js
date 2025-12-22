/**
 * Notifications Service
 * Handles real-time notifications using Socket.io
 */

export class NotificationService {
  constructor(io) {
    this.io = io;
  }

  /**
   * Send notification to specific user
   */
  notifyUser(userId, notificationType, data) {
    this.io.to(`notifications:${userId}`).emit("notification", {
      type: notificationType,
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Send notification to multiple users
   */
  notifyUsers(userIds, notificationType, data) {
    userIds.forEach((userId) => {
      this.notifyUser(userId, notificationType, data);
    });
  }

  /**
   * Broadcast notification to all connected users
   */
  broadcastNotification(notificationType, data) {
    this.io.emit("notification", {
      type: notificationType,
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Send payout notification
   */
  notifyPayoutUpdate(userId, payoutData) {
    this.notifyUser(userId, "payout_update", {
      payoutId: payoutData._id,
      status: payoutData.status,
      amount: payoutData.netAmount,
      message: `Your payout of ${payoutData.netAmount} is now ${payoutData.status}`,
    });

    // Also notify to payout_updates channel
    this.io.to(`payout_updates:${userId}`).emit("payout_status", payoutData);
  }

  /**
   * Send commission notification
   */
  notifyCommissionEarned(userId, commissionData) {
    this.notifyUser(userId, "commission_earned", {
      commissionId: commissionData._id,
      amount: commissionData.netAmount,
      type: commissionData.commissionType,
      message: `You earned ${commissionData.netAmount} from ${commissionData.commissionType}`,
    });
  }

  /**
   * Send meeting reminder
   */
  notifyMeetingReminder(userId, meetingData) {
    this.notifyUser(userId, "meeting_reminder", {
      meetingId: meetingData._id,
      title: meetingData.title,
      scheduledAt: meetingData.scheduledAt,
      message: `Reminder: ${meetingData.title} is scheduled for ${new Date(
        meetingData.scheduledAt
      ).toLocaleString()}`,
    });
  }

  /**
   * Send announcement notification
   */
  notifyAnnouncement(userIds, announcementData) {
    const notification = {
      type: "announcement",
      announcementId: announcementData._id,
      title: announcementData.title,
      description: announcementData.description,
      flag: announcementData.flag,
      timestamp: new Date(),
    };

    if (userIds && userIds.length > 0) {
      this.notifyUsers(userIds, "announcement", notification);
    } else {
      this.broadcastNotification("announcement", notification);
    }
  }

  /**
   * Send team update notification
   */
  notifyTeamUpdate(teamId, updateData) {
    this.io.to(`team:${teamId}`).emit("team_update", {
      teamId,
      updateData,
      timestamp: new Date(),
    });
  }

  /**
   * Send incentive notification
   */
  notifyIncentiveQualified(userId, incentiveData) {
    this.notifyUser(userId, "incentive_qualified", {
      incentiveId: incentiveData._id,
      title: incentiveData.title,
      amount: incentiveData.amount,
      message: `Congratulations! You've qualified for: ${incentiveData.title}`,
    });
  }

  /**
   * Send incentive awarded notification
   */
  notifyIncentiveAwarded(userId, incentiveData) {
    this.notifyUser(userId, "incentive_awarded", {
      incentiveId: incentiveData._id,
      title: incentiveData.title,
      amount: incentiveData.amount,
      message: `Your incentive "${incentiveData.title}" has been awarded!`,
    });
  }

  /**
   * Send KYC status notification
   */
  notifyKYCStatusUpdate(userId, kycData) {
    this.notifyUser(userId, "kyc_status", {
      status: kycData.status,
      message:
        kycData.status === "verified"
          ? "Your KYC has been verified successfully!"
          : `Your KYC status: ${kycData.status}`,
      rejectionReason: kycData.rejectionReason,
    });
  }

  /**
   * Send level promotion notification
   */
  notifyLevelPromotion(userId, levelData) {
    this.notifyUser(userId, "level_promotion", {
      newLevel: levelData.newLevel,
      message: `Congratulations! You've been promoted to Level ${levelData.newLevel}`,
    });
  }

  /**
   * Send real-time analytics update
   */
  broadcastAnalyticsUpdate(analyticsData) {
    this.io.to("analytics_updates").emit("analytics_update", {
      data: analyticsData,
      timestamp: new Date(),
    });
  }

  /**
   * Notify user suspension
   */
  notifyAccountSuspended(userId, reason) {
    this.notifyUser(userId, "account_suspended", {
      message: `Your account has been suspended. Reason: ${reason}`,
      reason,
    });
  }

  /**
   * Notify user reactivation
   */
  notifyAccountReactivated(userId) {
    this.notifyUser(userId, "account_reactivated", {
      message: "Your account has been reactivated. You can now log in.",
    });
  }

  /**
   * Send referral bonus notification
   */
  notifyReferralBonus(userId, referralData) {
    this.notifyUser(userId, "referral_bonus", {
      referralId: referralData._id,
      referredUserName: referralData.referredUserName,
      bonusAmount: referralData.bonusAmount,
      message: `You earned ${referralData.bonusAmount} for referring ${referralData.referredUserName}`,
    });
  }
}

export default NotificationService;
