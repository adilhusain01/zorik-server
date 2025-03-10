const mongoose = require("mongoose");

const streakRewardSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: true,
    lowercase: true,
  },
  lastClaimDate: {
    type: Date,
    required: true,
  },
  nextEligibleDate: {
    type: Date,
    required: true,
  },
});

streakRewardSchema.index({ walletAddress: 1 }, { unique: true });
module.exports = mongoose.model("StreakReward", streakRewardSchema);
