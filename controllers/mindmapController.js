const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
const Mindmap = require("../models/Mindmap");
const ClickedNode = require("../models/ClickedNode");
const UserActivity = require("../models/UserActivity");
const LearningPath = require("../models/LearningPath");
const Quiz = require("../models/Quiz");
const LearningPathController = require("../controllers/learningPathController");

const cleanMermaidCode = (text) => {
  const mermaidBlockRegex = /```mermaid\n?([\s\S]*?)```/;
  const match = text.match(mermaidBlockRegex);
  return match ? match[1].trim() : text.trim();
};

exports.generateMindmap = async (req, res) => {
  try {
    const { topic, googleId } = req.body;

    // Check if mindmap already exists
    const existingMindmap = await Mindmap.findOne({
      googleId,
      topic,
    });

    if (existingMindmap) {
      return res.json({
        mermaidCode: existingMindmap.mermaidCode,
        isExisting: true,
      });
    }
    const prompt = `Given the topic "${topic}", create a comprehensive Mermaid mindmap diagram that visualizes the complete knowledge structure.

Your mindmap should include:

1. A clear hierarchical structure with:
   - The main topic as the root node
   - Primary concepts as level 1 branches
   - Key subcategories as level 2 branches 
   - Specific elements as level 3 branches
   - You can have more than 3 levels of depth for complex topics

2. Follow these structural guidelines:
   - Maintain logical grouping of related concepts
   - Ensure balanced branch distribution across the mindmap
   - Limit initial depth to 4 levels for clarity, but allow more depth for complex topics

3. Content requirements:
   - Include essential domain-specific terminology
   - Cover theoretical foundations and practical applications
   - Address interdisciplinary connections where appropriate

4. Formatting instructions:
   - Use precise, concise node labels (2-5 words maximum)
   - Maintain consistent terminology throughout
   - Use capitalization for main branches, sentence case for subnodes

Respond with ONLY the Mermaid mindmap code between triple backticks with 'mermaid' tag.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const cleanedCode = cleanMermaidCode(response.text());

    // Save the new mindmap
    const mindmap = new Mindmap({
      googleId,
      topic,
      mermaidCode: cleanedCode,
    });
    await mindmap.save();

    res.json({ mermaidCode: cleanedCode, isNew: true });
  } catch (error) {
    console.error("Error generating mindmap:", error);
    res.status(500).json({ error: "Failed to generate mindmap" });
  }
};

const cleanExplanation = (explanation) => {
  const sections = explanation
    .split("\n")
    .filter((section) => section.trim() !== "");
  return {
    briefExplanation: sections[0] || "",
    example: sections[1] || "",
    keyTakeaway: sections[2] || "",
  };
};

exports.getNodeInfo = async (req, res) => {
  try {
    const { nodeText, parentContext, googleId } = req.body;

    // Fetch the complete mindmap for better context
    const mindmap = await Mindmap.findOne({
      googleId,
      topic: parentContext,
    });

    // If mindmap not found, proceed with just the basic context
    let mindmapHierarchy = "";
    if (mindmap && mindmap.mermaidCode) {
      mindmapHierarchy = `\n\nHere is the complete mindmap hierarchy for context:\n${mindmap.mermaidCode}`;
    }

    console.log(mindmapHierarchy);

    // Generate explanation with enhanced context
    const prompt = `Given the concept "${nodeText}" in the context of the topic "${parentContext}", provide:

1. A brief explanation (3-7 clear, informative sentences that define the concept precisely and highlight its importance)

2. One concrete example explained in simple terms that a 10-year-old would understand - use relatable scenarios, analogies, or everyday objects to make the concept tangible

3. Key takeaway that captures the essential insight or practical application of this concept in a memorable way

Keep each section concise (maximum 3 sentences each). Don't include section headings or numbers. Separate the three sections with a single line break. Use conversational language while maintaining accuracy. Avoid jargon unless absolutely necessary and explain any technical terms used.${mindmapHierarchy}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const cleanedExplanation = cleanExplanation(response.text());

    // Track user activity
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

    res.json({ explanation: cleanedExplanation });
  } catch (error) {
    console.error("Error getting node info:", error);
    res.status(500).json({ error: "Failed to get node information" });
  }
};

exports.getUserMindmaps = async (req, res) => {
  try {
    const { googleId } = req.params;
    const mindmaps = await Mindmap.find({ googleId })
      .select("topic createdAt")
      .sort("-createdAt");

    res.json(mindmaps);
  } catch (error) {
    console.error("Error fetching user mindmaps:", error);
    res.status(500).json({ error: "Failed to fetch mindmaps" });
  }
};

exports.getMindmapByTopic = async (req, res) => {
  try {
    const { googleId, topic } = req.params;
    const mindmap = await Mindmap.findOne({ googleId, topic });

    if (!mindmap) {
      return res.status(404).json({ error: "Mindmap not found" });
    }

    res.json(mindmap);
  } catch (error) {
    console.error("Error fetching mindmap:", error);
    res.status(500).json({ error: "Failed to fetch mindmap" });
  }
};

exports.trackNodeClick = async (req, res) => {
  try {
    const { googleId, topic, nodeText } = req.body;
    const clickedNode = new ClickedNode({
      googleId,
      topic,
      nodeText,
    });
    await clickedNode.save();

    // Track user activity
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

    // Update learning path with new clicked node
    const learningPath = await LearningPath.findOne({ googleId, topic });
    if (learningPath) {
      // Get all clicked nodes
      const clickedNodes = await ClickedNode.find({ googleId, topic });
      const clickedNodeTexts = clickedNodes.map((node) => node.nodeText);

      // Asynchronously update the learning path
      LearningPathController.enhanceLearningPath(
        learningPath._id,
        clickedNodeTexts
      );
    }

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getClickedNodes = async (req, res) => {
  try {
    const { googleId, topic } = req.params;
    const clickedNodes = await ClickedNode.find({ googleId, topic });
    res.status(200).json(clickedNodes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteMindmap = async (req, res) => {
  try {
    const { googleId, topic } = req.params;

    // Delete the mindmap
    await Mindmap.findOneAndDelete({ googleId, topic });

    // Delete all related data
    await Promise.all([
      // Delete all clicked nodes for this topic
      ClickedNode.deleteMany({ googleId, topic }),

      // Delete the learning path for this topic
      LearningPath.findOneAndDelete({ googleId, topic }),

      // Delete all quizzes for this topic
      Quiz.deleteMany({ googleId, topic }),
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting mindmap:", error);
    res.status(500).json({ error: "Failed to delete mindmap" });
  }
};
