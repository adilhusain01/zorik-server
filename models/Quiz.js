const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
  },
  topic: {
    type: String,
    required: true,
  },
  nodeText: {
    type: String,
    required: true,
  },
  questions: [
    {
      question: String,
      options: [String],
      correctAnswer: Number,
      explanation: String,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Quiz", quizSchema);
