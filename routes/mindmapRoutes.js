const express = require("express");
const router = express.Router();
const mindmapController = require("../controllers/mindmapController");

router.post("/mindmap/generate", mindmapController.generateMindmap);
router.post("/get-node-info", mindmapController.getNodeInfo);
router.get("/user-mindmaps/:googleId", mindmapController.getUserMindmaps);
router.get("/mindmap/:googleId/:topic", mindmapController.getMindmapByTopic);
router.post("/track-node-click", mindmapController.trackNodeClick);
router.get(
  "/clicked-nodes/:googleId/:topic",
  mindmapController.getClickedNodes
);
router.delete(
  "/delete-mindmap/:googleId/:topic",
  mindmapController.deleteMindmap
);

module.exports = router;
