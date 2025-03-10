const UserActivity = require("../models/UserActivity");
const StreakReward = require("../models/StreakReward");

const streakController = {
  checkStreakEligibility: async (req, res) => {
    try {
      const { walletAddress } = req.params;
      const now = new Date();
      const fiveDaysAgo = new Date(now.setDate(now.getDate() - 4));

      // Check last 5 days activity
      const activities = await UserActivity.find({
        walletAddress: walletAddress.toLowerCase(),
        date: {
          $gte: fiveDaysAgo,
          $lte: new Date(),
        },
      }).sort({ date: -1 });

      // Group activities by date to ensure one activity per day
      const uniqueDays = new Set(
        activities.map((a) => a.date.toISOString().split("T")[0])
      );

      // Check streak record
      const streakRecord = await StreakReward.findOne({
        walletAddress: walletAddress.toLowerCase(),
      });

      const isEligible =
        uniqueDays.size >= 5 &&
        (!streakRecord || new Date() >= streakRecord.nextEligibleDate);

      res.json({
        isEligible,
        nextEligibleDate: streakRecord?.nextEligibleDate,
        currentStreak: uniqueDays.size,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  recordRewardClaim: async (req, res) => {
    try {
      const { walletAddress, transactionHash } = req.body;

      const now = new Date();
      const nextEligibleDate = new Date(now);
      nextEligibleDate.setDate(nextEligibleDate.getDate() + 5);

      await StreakReward.findOneAndUpdate(
        { walletAddress: walletAddress.toLowerCase() },
        {
          lastClaimDate: now,
          nextEligibleDate,
          lastTransactionHash: transactionHash,
        },
        { upsert: true }
      );

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = streakController;
