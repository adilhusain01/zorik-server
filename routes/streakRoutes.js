const express = require("express");
const router = express.Router();
const streakController = require("../controllers/streakController");

router.get("/check/:walletAddress", streakController.checkStreakEligibility);
router.post("/record-claim", streakController.recordRewardClaim);

module.exports = router;
