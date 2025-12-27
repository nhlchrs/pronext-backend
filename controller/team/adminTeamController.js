import { TeamMember, Referral, Bonus, Commission } from "../../models/teamModel.js";
import User from "../../models/authModel.js";
import Team from "../../models/teamModel.js";
import logger from "../../helpers/logger.js";
import { successResponse, successResponseWithData, ErrorResponse } from "../../helpers/apiResponse.js";

const adminLogger = logger.module("ADMIN_TEAM_CONTROLLER");

// ==================== TEAM MEMBER ADMIN FUNCTIONS ====================

/**
 * Get all team members with statistics
 */
export const getAllTeamMembers = async () => {
  try {
    adminLogger.start("Fetching all team members");

    const members = await TeamMember.find()
      .populate("userId", "fname lname email phone createdAt")
      .populate("sponsorId", "fname lname")
      .sort({ directCount: -1 });

    const stats = await TeamMember.aggregate([
      {
        $group: {
          _id: null,
          totalMembers: { $sum: 1 },
          totalEarnings: { $sum: "$totalEarnings" },
          averageDirects: { $avg: "$directCount" },
          maxDirects: { $max: "$directCount" },
        },
      },
    ]);

    const levelBreakdown = await TeamMember.aggregate([
      {
        $group: {
          _id: "$level",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      success: true,
      data: {
        members,
        totalMembers: stats[0]?.totalMembers || 0,
        totalEarnings: stats[0]?.totalEarnings || 0,
        averageDirects: stats[0]?.averageDirects || 0,
        levelBreakdown,
      },
    };
  } catch (error) {
    adminLogger.error("Error fetching team members", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Create team member (admin function)
 */
export const createTeamMember = async (userId, sponsorId, packagePrice) => {
  try {
    adminLogger.start("Creating new team member", { userId });

    if (!userId) {
      return {
        success: false,
        message: "User ID is required",
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        message: "User not found",
      };
    }

    const existingMember = await TeamMember.findOne({ userId });
    if (existingMember) {
      return {
        success: false,
        message: "Team member already exists",
      };
    }

    const { v4: uuidv4 } = await import("uuid");
    const generateReferralCode = (userId) => {
      return `PRO-${userId.toString().slice(-6).toUpperCase()}-${uuidv4().slice(0, 8).toUpperCase()}`;
    };

    const referralCode = generateReferralCode(userId);
    const newMember = new TeamMember({
      userId,
      referralCode,
      packagePrice: packagePrice || 0,
    });

    if (sponsorId) {
      const sponsor = await TeamMember.findOne({ userId: sponsorId });
      if (!sponsor) {
        return {
          success: false,
          message: "Sponsor not found",
        };
      }

      newMember.sponsorId = sponsor._id;
      sponsor.teamMembers.push(userId);
      sponsor.directCount = sponsor.teamMembers.length;
      await sponsor.save();

      adminLogger.success("Sponsor assigned", { userId, sponsorId });
    }

    await newMember.save();

    const commission = new Commission({ userId });
    await commission.save();

    adminLogger.success("Team member created", { userId, referralCode });

    return {
      success: true,
      message: "Team member created successfully",
      data: newMember,
    };
  } catch (error) {
    adminLogger.error("Error creating team member", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Set sponsor for team member
 */
export const setTeamSponsor = async (userId, sponsorId) => {
  try {
    adminLogger.start("Setting sponsor", { userId, sponsorId });

    if (!userId) {
      return {
        success: false,
        message: "User ID is required",
      };
    }

    const member = await TeamMember.findOne({ userId });
    if (!member) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    // If unsetting sponsor
    if (!sponsorId) {
      if (member.sponsorId) {
        const oldSponsor = await TeamMember.findById(member.sponsorId);
        if (oldSponsor) {
          oldSponsor.teamMembers = oldSponsor.teamMembers.filter(
            (id) => id.toString() !== userId
          );
          oldSponsor.directCount = oldSponsor.teamMembers.length;
          await oldSponsor.save();
        }
      }
      member.sponsorId = null;
      await member.save();
      return {
        success: true,
        message: "Sponsor removed successfully",
        data: member,
      };
    }

    // Set new sponsor
    const newSponsor = await TeamMember.findOne({ userId: sponsorId });
    if (!newSponsor) {
      return {
        success: false,
        message: "Sponsor not found",
      };
    }

    // Remove from old sponsor if exists
    if (member.sponsorId) {
      const oldSponsor = await TeamMember.findById(member.sponsorId);
      if (oldSponsor) {
        oldSponsor.teamMembers = oldSponsor.teamMembers.filter(
          (id) => id.toString() !== userId
        );
        oldSponsor.directCount = oldSponsor.teamMembers.length;
        await oldSponsor.save();
      }
    }

    // Add to new sponsor
    member.sponsorId = newSponsor._id;
    newSponsor.teamMembers.push(userId);
    newSponsor.directCount = newSponsor.teamMembers.length;

    await member.save();
    await newSponsor.save();

    adminLogger.success("Sponsor updated", { userId, sponsorId });

    return {
      success: true,
      message: "Sponsor updated successfully",
      data: member,
    };
  } catch (error) {
    adminLogger.error("Error setting sponsor", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Update team member
 */
export const updateTeamMember = async (userId, packagePrice) => {
  try {
    adminLogger.start("Updating team member", { userId });

    const member = await TeamMember.findOne({ userId });

    if (!member) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    if (packagePrice !== undefined) {
      member.packagePrice = packagePrice;
    }

    await member.save();

    adminLogger.success("Team member updated", { userId });

    return {
      success: true,
      message: "Team member updated successfully",
      data: member,
    };
  } catch (error) {
    adminLogger.error("Error updating team member", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Delete team member
 */
export const deleteTeamMember = async (userId) => {
  try {
    adminLogger.start("Deleting team member", { userId });

    const member = await TeamMember.findOne({ userId });

    if (!member) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    // Remove from sponsor's team
    if (member.sponsorId) {
      const sponsor = await TeamMember.findById(member.sponsorId);
      if (sponsor) {
        sponsor.teamMembers = sponsor.teamMembers.filter(
          (id) => id.toString() !== userId
        );
        sponsor.directCount = sponsor.teamMembers.length;
        await sponsor.save();
      }
    }

    // Reassign downline to sponsor
    if (member.teamMembers.length > 0 && member.sponsorId) {
      const sponsor = await TeamMember.findById(member.sponsorId);
      if (sponsor) {
        for (const downlineId of member.teamMembers) {
          const downlineMember = await TeamMember.findOne({ userId: downlineId });
          if (downlineMember) {
            downlineMember.sponsorId = sponsor._id;
            await downlineMember.save();
            sponsor.teamMembers.push(downlineId);
          }
        }
        sponsor.directCount = sponsor.teamMembers.length;
        await sponsor.save();
      }
    }

    // Delete team member
    await TeamMember.deleteOne({ userId });

    // Delete related records
    await Bonus.deleteMany({ userId });
    await Commission.deleteOne({ userId });
    await Referral.deleteMany({ referrerId: userId });

    adminLogger.success("Team member deleted", { userId });

    return {
      success: true,
      message: "Team member deleted successfully",
    };
  } catch (error) {
    adminLogger.error("Error deleting team member", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get all teams with pagination, search, and filters
export const getAllTeams = async (req, res) => {
  try {
    adminLogger.start("Getting all teams", {
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      status: req.query.status,
      tier: req.query.tier,
    });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const status = req.query.status || "all";
    const tier = req.query.tier || "all";

    // Build filter object
    let filter = {};

    if (search) {
      filter.$or = [
        { teamName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (status === "active") {
      filter.isActive = true;
    } else if (status === "suspended") {
      filter.isActive = false;
    }

    if (tier !== "all") {
      filter.tier = tier;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get teams with populated references
    const teams = await Team.find(filter)
      .populate("teamLead", "fname lname email phone isVerified")
      .populate("verifiedBy", "fname lname email")
      .populate("suspendedBy", "fname lname email")
      .populate("createdBy", "fname lname email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const total = await Team.countDocuments(filter);

    const stats = {
      totalTeams: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    };

    adminLogger.success("Teams fetched successfully", {
      count: teams.length,
      total: total,
      page: page,
    });

    return res.status(200).json(
      successResponseWithData("Teams fetched successfully", {
        teams,
        pagination: stats,
      })
    );
  } catch (error) {
    adminLogger.error("Error fetching teams", error);
    return res.status(500).json(ErrorResponse("Error fetching teams", error.message));
  }
};

// Get single team details
export const getTeamById = async (req, res) => {
  try {
    const { teamId } = req.params;

    adminLogger.start("Getting team details", { teamId });

    if (!teamId) {
      return res.status(400).json(ErrorResponse("Team ID is required"));
    }

    const team = await Team.findById(teamId)
      .populate("teamLead", "fname lname email phone isVerified totalEarnings")
      .populate("members", "fname lname email phone isVerified")
      .populate("verifiedBy", "fname lname email")
      .populate("suspendedBy", "fname lname email")
      .populate("createdBy", "fname lname email");

    if (!team) {
      adminLogger.warn("Team not found", { teamId });
      return res.status(404).json(ErrorResponse("Team not found"));
    }

    // Get additional statistics
    const memberCount = team.members.length;
    const monthlyProgress = team.currentMonthEarnings;
    const targetProgress = team.monthlyTarget ? Math.round((monthlyProgress / team.monthlyTarget) * 100) : 0;

    adminLogger.success("Team details fetched", { teamId });

    return res.status(200).json(
      successResponseWithData("Team details fetched successfully", {
        team: {
          ...team.toObject(),
          memberCount,
          targetProgress,
        },
      })
    );
  } catch (error) {
    adminLogger.error("Error fetching team details", error);
    return res.status(500).json(ErrorResponse("Error fetching team details", error.message));
  }
};

// Get team members
export const getTeamMembers = async (req, res) => {
  try {
    const { teamId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;

    adminLogger.start("Getting team members", { teamId, page, limit });

    if (!teamId) {
      return res.status(400).json(ErrorResponse("Team ID is required"));
    }

    const team = await Team.findById(teamId).populate("members");

    if (!team) {
      adminLogger.warn("Team not found", { teamId });
      return res.status(404).json(ErrorResponse("Team not found"));
    }

    const skip = (page - 1) * limit;
    const totalMembers = team.members.length;

    // Get member details with pagination
    const members = await User.find({ _id: { $in: team.members } })
      .select("fname lname email phone isVerified isActive createdAt")
      .skip(skip)
      .limit(limit);

    adminLogger.success("Team members fetched", { teamId, count: members.length });

    return res.status(200).json(
      successResponseWithData("Team members fetched successfully", {
        members,
        pagination: {
          total: totalMembers,
          page,
          limit,
          totalPages: Math.ceil(totalMembers / limit),
        },
      })
    );
  } catch (error) {
    adminLogger.error("Error fetching team members", error);
    return res.status(500).json(ErrorResponse("Error fetching team members", error.message));
  }
};

// Get team statistics
export const getTeamStatistics = async (req, res) => {
  try {
    adminLogger.start("Getting team statistics");

    const totalTeams = await Team.countDocuments();
    const activeTeams = await Team.countDocuments({ isActive: true });
    const suspendedTeams = await Team.countDocuments({ isActive: false });
    const verifiedTeams = await Team.countDocuments({ isVerified: true });

    // Get tier distribution
    const tierDistribution = await Team.aggregate([
      {
        $group: {
          _id: "$tier",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get total earnings
    const earningsData = await Team.aggregate([
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: "$totalEarnings" },
          totalCommissions: { $sum: "$totalCommissionsPaid" },
          currentMonthEarnings: { $sum: "$currentMonthEarnings" },
        },
      },
    ]);

    // Get top performing teams
    const topTeams = await Team.find({ isActive: true })
      .populate("teamLead", "fname lname")
      .sort({ totalEarnings: -1 })
      .limit(5);

    // Get team growth data (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const teamGrowth = await Team.aggregate([
      {
        $match: { createdAt: { $gte: thirtyDaysAgo } },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const stats = {
      totalTeams,
      activeTeams,
      suspendedTeams,
      verifiedTeams,
      tierDistribution,
      earnings: earningsData[0] || {
        totalEarnings: 0,
        totalCommissions: 0,
        currentMonthEarnings: 0,
      },
      topTeams,
      teamGrowth,
    };

    adminLogger.success("Team statistics calculated", stats);

    return res.status(200).json(successResponseWithData("Team statistics fetched successfully", stats));
  } catch (error) {
    adminLogger.error("Error fetching team statistics", error);
    return res.status(500).json(ErrorResponse("Error fetching team statistics", error.message));
  }
};

// Verify/Approve team
export const verifyTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const adminId = req.user.id;

    adminLogger.start("Verifying team", { teamId, adminId });

    if (!teamId) {
      return res.status(400).json(ErrorResponse("Team ID is required"));
    }

    const team = await Team.findById(teamId);

    if (!team) {
      adminLogger.warn("Team not found", { teamId });
      return res.status(404).json(ErrorResponse("Team not found"));
    }

    if (team.isVerified) {
      adminLogger.warn("Team already verified", { teamId });
      return res.status(400).json(ErrorResponse("Team is already verified"));
    }

    team.isVerified = true;
    team.verifiedAt = new Date();
    team.verifiedBy = adminId;
    await team.save();

    adminLogger.success("Team verified successfully", { teamId });

    return res.status(200).json(successResponseWithData("Team verified successfully", { team }));
  } catch (error) {
    adminLogger.error("Error verifying team", error);
    return res.status(500).json(ErrorResponse("Error verifying team", error.message));
  }
};

// Suspend team
export const suspendTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    adminLogger.start("Suspending team", { teamId, adminId, reason });

    if (!teamId) {
      return res.status(400).json(ErrorResponse("Team ID is required"));
    }

    if (!reason) {
      return res.status(400).json(ErrorResponse("Suspension reason is required"));
    }

    const team = await Team.findById(teamId);

    if (!team) {
      adminLogger.warn("Team not found", { teamId });
      return res.status(404).json(ErrorResponse("Team not found"));
    }

    if (!team.isActive) {
      adminLogger.warn("Team already suspended", { teamId });
      return res.status(400).json(ErrorResponse("Team is already suspended"));
    }

    team.isActive = false;
    team.suspendedAt = new Date();
    team.suspensionReason = reason;
    team.suspendedBy = adminId;
    await team.save();

    adminLogger.success("Team suspended successfully", { teamId });

    return res.status(200).json(successResponseWithData("Team suspended successfully", { team }));
  } catch (error) {
    adminLogger.error("Error suspending team", error);
    return res.status(500).json(ErrorResponse("Error suspending team", error.message));
  }
};

// Reactivate suspended team
export const reactivateTeam = async (req, res) => {
  try {
    const { teamId } = req.params;

    adminLogger.start("Reactivating team", { teamId });

    if (!teamId) {
      return res.status(400).json(ErrorResponse("Team ID is required"));
    }

    const team = await Team.findById(teamId);

    if (!team) {
      adminLogger.warn("Team not found", { teamId });
      return res.status(404).json(ErrorResponse("Team not found"));
    }

    if (team.isActive) {
      adminLogger.warn("Team already active", { teamId });
      return res.status(400).json(ErrorResponse("Team is already active"));
    }

    team.isActive = true;
    team.suspendedAt = null;
    team.suspensionReason = null;
    team.suspendedBy = null;
    await team.save();

    adminLogger.success("Team reactivated successfully", { teamId });

    return res.status(200).json(successResponseWithData("Team reactivated successfully", { team }));
  } catch (error) {
    adminLogger.error("Error reactivating team", error);
    return res.status(500).json(ErrorResponse("Error reactivating team", error.message));
  }
};

// Update team tier
export const updateTeamTier = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { tier } = req.body;

    adminLogger.start("Updating team tier", { teamId, tier });

    if (!teamId) {
      return res.status(400).json(ErrorResponse("Team ID is required"));
    }

    if (!tier || !["bronze", "silver", "gold", "platinum"].includes(tier)) {
      return res.status(400).json(ErrorResponse("Valid tier is required (bronze, silver, gold, platinum)"));
    }

    const team = await Team.findByIdAndUpdate(teamId, { tier }, { new: true });

    if (!team) {
      adminLogger.warn("Team not found", { teamId });
      return res.status(404).json(ErrorResponse("Team not found"));
    }

    adminLogger.success("Team tier updated", { teamId, tier });

    return res.status(200).json(successResponseWithData("Team tier updated successfully", { team }));
  } catch (error) {
    adminLogger.error("Error updating team tier", error);
    return res.status(500).json(ErrorResponse("Error updating team tier", error.message));
  }
};

// Remove team member
export const removeTeamMember = async (req, res) => {
  try {
    const { teamId, memberId } = req.params;

    adminLogger.start("Removing team member", { teamId, memberId });

    if (!teamId || !memberId) {
      return res.status(400).json(ErrorResponse("Team ID and Member ID are required"));
    }

    const team = await Team.findById(teamId);

    if (!team) {
      adminLogger.warn("Team not found", { teamId });
      return res.status(404).json(ErrorResponse("Team not found"));
    }

    const isMember = team.members.includes(memberId);

    if (!isMember) {
      adminLogger.warn("Member not found in team", { teamId, memberId });
      return res.status(400).json(ErrorResponse("Member not found in this team"));
    }

    // Remove member from team
    team.members = team.members.filter((id) => id.toString() !== memberId);
    team.totalMembers = team.members.length;
    await team.save();

    adminLogger.success("Team member removed", { teamId, memberId });

    return res.status(200).json(successResponseWithData("Team member removed successfully", { team }));
  } catch (error) {
    adminLogger.error("Error removing team member", error);
    return res.status(500).json(ErrorResponse("Error removing team member", error.message));
  }
};

// Add team member manually
export const addTeamMember = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { memberId } = req.body;

    adminLogger.start("Adding team member", { teamId, memberId });

    if (!teamId || !memberId) {
      return res.status(400).json(ErrorResponse("Team ID and Member ID are required"));
    }

    const team = await Team.findById(teamId);

    if (!team) {
      adminLogger.warn("Team not found", { teamId });
      return res.status(404).json(ErrorResponse("Team not found"));
    }

    // Check if member exists
    const member = await User.findById(memberId);

    if (!member) {
      adminLogger.warn("User not found", { memberId });
      return res.status(404).json(ErrorResponse("User not found"));
    }

    // Check if already a member
    if (team.members.includes(memberId)) {
      adminLogger.warn("User already a team member", { teamId, memberId });
      return res.status(400).json(ErrorResponse("User is already a member of this team"));
    }

    // Add member to team
    team.members.push(memberId);
    team.totalMembers = team.members.length;
    await team.save();

    adminLogger.success("Team member added", { teamId, memberId });

    return res.status(200).json(successResponseWithData("Team member added successfully", { team }));
  } catch (error) {
    adminLogger.error("Error adding team member", error);
    return res.status(500).json(ErrorResponse("Error adding team member", error.message));
  }
};

// Update team details
export const updateTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { teamName, description, monthlyTarget } = req.body;

    adminLogger.start("Updating team", { teamId });

    if (!teamId) {
      return res.status(400).json(ErrorResponse("Team ID is required"));
    }

    const updateData = {};

    if (teamName) updateData.teamName = teamName;
    if (description) updateData.description = description;
    if (monthlyTarget !== undefined) updateData.monthlyTarget = monthlyTarget;

    const team = await Team.findByIdAndUpdate(teamId, updateData, { new: true })
      .populate("teamLead", "fname lname email");

    if (!team) {
      adminLogger.warn("Team not found", { teamId });
      return res.status(404).json(ErrorResponse("Team not found"));
    }

    adminLogger.success("Team updated successfully", { teamId });

    return res.status(200).json(successResponseWithData("Team updated successfully", { team }));
  } catch (error) {
    adminLogger.error("Error updating team", error);
    return res.status(500).json(ErrorResponse("Error updating team", error.message));
  }
};

// Delete team (only if no members)
export const deleteTeam = async (req, res) => {
  try {
    const { teamId } = req.params;

    adminLogger.start("Deleting team", { teamId });

    if (!teamId) {
      return res.status(400).json(ErrorResponse("Team ID is required"));
    }

    const team = await Team.findById(teamId);

    if (!team) {
      adminLogger.warn("Team not found", { teamId });
      return res.status(404).json(ErrorResponse("Team not found"));
    }

    if (team.members.length > 0) {
      adminLogger.warn("Cannot delete team with members", { teamId });
      return res.status(400).json(ErrorResponse("Cannot delete team that has members. Remove all members first."));
    }

    await Team.findByIdAndDelete(teamId);

    adminLogger.success("Team deleted successfully", { teamId });

    return res.status(200).json(successResponse("Team deleted successfully"));
  } catch (error) {
    adminLogger.error("Error deleting team", error);
    return res.status(500).json(ErrorResponse("Error deleting team", error.message));
  }
};

// Export all functions
export default {
  getAllTeams,
  getTeamById,
  getTeamMembers,
  getTeamStatistics,
  verifyTeam,
  suspendTeam,
  reactivateTeam,
  updateTeamTier,
  removeTeamMember,
  addTeamMember,
  updateTeam,
  deleteTeam,
  getAllTeamMembers,
  createTeamMember,
  setTeamSponsor,
  updateTeamMember,
  deleteTeamMember,
};
