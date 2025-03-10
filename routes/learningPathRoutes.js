const express = require("express");
const router = express.Router();
const learningPathController = require("../controllers/learningPathController");

router.post(
  "/learning-path/generate",
  learningPathController.generateLearningPath
);
router.post(
  "/learning-path/update-status",
  learningPathController.updateNodeStatus
);
router.get(
  "/learning-path/:googleId/:topic",
  learningPathController.getLearningPath
);

module.exports = router;
