const express = require("express");
const router = express.Router();
const quizController = require("../controllers/quizController");

router.post("/quiz/generate", quizController.generateQuiz);
router.get("/quiz/:googleId/:topic/:nodeText", quizController.getQuiz);

module.exports = router;
