const User = require("../models/User");
const UserActivity = require("../models/UserActivity");

const userController = {
  checkUser: async (req, res) => {
    try {
      const { googleId } = req.body;
      const user = await User.findOne({ googleId });
      res.json({ exists: !!user, user });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  registerUser: async (req, res) => {
    try {
      const { googleId, email, username, picture } = req.body;

      // Check if username already exists
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({ error: "Username already taken" });
      }

      const user = new User({
        googleId,
        email,
        username,
        picture,
      });

      await user.save();
      res.status(201).json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getUserActivityData: async (req, res) => {
    try {
      const { googleId, month, year } = req.params;

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const activities = await UserActivity.find({
        googleId,
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      }).select("date -_id");

      res.json(activities);
    } catch (error) {
      console.error("Error fetching user activity data:", error);
      res.status(500).json({ error: "Failed to fetch activity data" });
    }
  },

  getUserProfile: async (req, res) => {
    try {
      const { googleId } = req.params;
      const user = await User.findOne({ googleId });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ error: "Failed to fetch user profile" });
    }
  },

  updateUserProfile: async (req, res) => {
    try {
      const { googleId } = req.params;
      const { username, picture } = req.body;

      // Check if username already exists for another user
      if (username) {
        const existingUsername = await User.findOne({
          username,
          googleId: { $ne: googleId },
        });

        if (existingUsername) {
          return res.status(400).json({ error: "Username already taken" });
        }
      }

      const updatedUser = await User.findOneAndUpdate(
        { googleId },
        { $set: { username, picture } },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ error: "Failed to update user profile" });
    }
  },

  // Track daily activity
  trackActivity: async (req, res) => {
    try {
      const { googleId } = req.body;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await UserActivity.findOneAndUpdate(
        {
          googleId,
          date: today,
        },
        {},
        { upsert: true }
      );

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error tracking activity:", error);
      res.status(500).json({ error: "Failed to track activity" });
    }
  },

  // Get user stats
  getUserStats: async (req, res) => {
    try {
      const { googleId } = req.params;

      // Count total activity days
      const totalActivityDays = await UserActivity.countDocuments({ googleId });

      // Count mindmaps created
      const Mindmap = require("../models/Mindmap");
      const totalMindmaps = await Mindmap.countDocuments({ googleId });

      // Get current streak
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let currentStreak = 0;
      let checkDate = new Date(today);

      while (true) {
        const activity = await UserActivity.findOne({
          googleId,
          date: checkDate,
        });

        if (!activity) break;

        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }

      res.json({
        totalActivityDays,
        totalMindmaps,
        currentStreak,
      });
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ error: "Failed to fetch user stats" });
    }
  },
};

module.exports = userController;
