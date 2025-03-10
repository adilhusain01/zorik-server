const mongoose = require("mongoose");

const learningPathSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
  },
  topic: {
    type: String,
    required: true,
  },
  nodes: [
    {
      nodeText: String,
      status: {
        type: String,
        enum: ["not_started", "in_progress", "mastered"],
        default: "not_started",
      },
      priority: {
        type: Number,
        default: 0,
      },
      recommendedResources: [
        {
          type: String,
        },
      ],
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("LearningPath", learningPathSchema);
