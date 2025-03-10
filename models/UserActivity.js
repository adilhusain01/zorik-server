// models/UserActivity.js
const mongoose = require("mongoose");

const userActivitySchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
});

// Compound index to ensure unique combinations of user and date
userActivitySchema.index({ googleId: 1, date: 1 }, { unique: true });

const UserActivity = mongoose.model("UserActivity", userActivitySchema);

module.exports = UserActivity;
