const mongoose = require("mongoose");

const clickedNodeSchema = new mongoose.Schema({
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
  clickedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("ClickedNode", clickedNodeSchema);
