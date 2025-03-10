const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const { logger } = require("./middleware/logEvents");
const mindmapRoutes = require("./routes/mindmapRoutes");
const userRoutes = require("./routes/userRoutes");
const streakRoutes = require("./routes/streakRoutes");
const learningPathRoutes = require("./routes/learningPathRoutes");
const quizRoutes = require("./routes/quizRoutes");

const app = express();

// Connect to MongoDB

app.use(logger);
app.use(cors());
app.use(express.json());

// Routes
app.use("/api", mindmapRoutes);
app.use("/api/user", userRoutes);
app.use("/api/streak", streakRoutes);

// Add these routes
app.use("/api", learningPathRoutes);
app.use("/api", quizRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something broke!" });
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => console.error("MongoDB connection error:", err));
