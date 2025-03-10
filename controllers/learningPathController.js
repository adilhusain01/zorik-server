const LearningPath = require("../models/LearningPath");
const Mindmap = require("../models/Mindmap");
const ClickedNode = require("../models/ClickedNode");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

exports.generateLearningPath = async (req, res) => {
  try {
    console.log("=== GENERATE LEARNING PATH START ===");
    console.log("Request body:", req.body);
    const { googleId, topic } = req.body;

    // Check if a learning path already exists
    let learningPath = await LearningPath.findOne({ googleId, topic });
    console.log(
      "Existing learning path:",
      learningPath ? "Found" : "Not found"
    );

    if (learningPath) {
      console.log("Returning existing learning path");
      return res.json(learningPath);
    }

    // Get the mindmap for this topic
    const mindmap = await Mindmap.findOne({ googleId, topic });
    console.log("Mindmap found:", mindmap ? "Yes" : "No");
    if (!mindmap) {
      console.log("Mindmap not found, returning 404");
      return res.status(404).json({ error: "Mindmap not found" });
    }

    console.log("Mindmap mermaid code:", mindmap.mermaidCode);

    // Extract nodes from mermaid code - UPDATED REGEX
    const nodeRegex = /\s+\w+(?:\(\([^)]+\)\)|[\(\["'][^"\]]+[\]"\)'])/g;
    const nodeMatches = mindmap.mermaidCode.match(nodeRegex) || [];
    console.log("Node matches:", nodeMatches);

    // Extract node text with improved pattern matching
    const nodes = nodeMatches
      .map((match) => {
        let nodeText;
        if (match.includes("((") && match.includes("))")) {
          // Handle double parentheses format
          nodeText = match.match(/\(\(([^)]+)\)\)/)?.[1];
        } else if (match.includes("[") && match.includes("]")) {
          // Handle bracket format
          nodeText =
            match.match(/\["([^"]+)"\]/)?.[1] ||
            match.match(/\[([^\]]+)\]/)?.[1];
        } else if (match.includes("(") && match.includes(")")) {
          // Handle single parentheses format
          nodeText = match.match(/\(([^)]+)\)/)?.[1];
        } else {
          // Fallback - just get the text after the identifier
          const parts = match.trim().split(/\s+/);
          nodeText = parts.length > 1 ? parts.slice(1).join(" ") : match.trim();
        }

        if (!nodeText) {
          console.log("Failed to extract node text from:", match);
          return null;
        }

        return {
          nodeText,
          status: "not_started",
          priority: 0,
          recommendedResources: [],
        };
      })
      .filter((node) => node !== null);

    console.log("Extracted nodes:", nodes);

    // If no nodes were extracted, use a fallback method
    if (nodes.length === 0) {
      console.log("No nodes extracted, using fallback method");
      // Extract all text that appears to be a concept
      const lines = mindmap.mermaidCode.split("\n");
      const fallbackNodes = [];

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (
          trimmedLine &&
          !trimmedLine.startsWith("mindmap") &&
          !trimmedLine.startsWith("root")
        ) {
          // Remove leading spaces and any special characters
          const cleanedLine = trimmedLine
            .replace(/^\s*\w+\s*/, "")
            .replace(/[\(\[\]"\)]/g, "");
          if (cleanedLine) {
            fallbackNodes.push({
              nodeText: cleanedLine,
              status: "not_started",
              priority: 0,
              recommendedResources: [],
            });
          }
        }
      }

      // Add the root node if it exists
      const rootMatch = mindmap.mermaidCode.match(/root\(\(([^)]+)\)\)/);
      if (rootMatch && rootMatch[1]) {
        fallbackNodes.push({
          nodeText: rootMatch[1],
          status: "not_started",
          priority: 0,
          recommendedResources: [],
        });
      }

      console.log("Fallback nodes:", fallbackNodes);
      nodes.push(...fallbackNodes);
    }

    // Get clicked nodes
    const clickedNodes = await ClickedNode.find({ googleId, topic });
    console.log("Clicked nodes found:", clickedNodes.length);
    console.log("Clicked nodes:", clickedNodes);

    const clickedNodeTexts = clickedNodes.map((node) => node.nodeText);
    console.log("Clicked node texts:", clickedNodeTexts);

    // Create initial learning path
    learningPath = new LearningPath({
      googleId,
      topic,
      nodes,
    });

    console.log("Saving initial learning path");
    await learningPath.save();
    console.log("Initial learning path saved with ID:", learningPath._id);

    // Asynchronously enhance the learning path with AI
    console.log(
      "Starting async enhancement with clicked nodes:",
      clickedNodeTexts
    );
    this.enhanceLearningPath(learningPath._id, clickedNodeTexts);

    console.log("Returning learning path to client");
    console.log("=== GENERATE LEARNING PATH END ===");
    res.json(learningPath);
  } catch (error) {
    console.error("Error generating learning path:", error);
    res.status(500).json({ error: "Failed to generate learning path" });
  }
};

exports.enhanceLearningPath = async (learningPathId, clickedNodes = []) => {
  try {
    console.log("=== ENHANCE LEARNING PATH START ===");
    console.log("Learning path ID:", learningPathId);
    console.log("Clicked nodes:", clickedNodes);

    const learningPath = await LearningPath.findById(learningPathId);
    console.log("Learning path found:", learningPath ? "Yes" : "No");

    if (!learningPath) {
      console.log("Learning path not found, aborting enhancement");
      return;
    }

    console.log("Learning path topic:", learningPath.topic);
    console.log("Learning path nodes count:", learningPath.nodes.length);
    console.log(
      "Learning path nodes:",
      learningPath.nodes.map((n) => n.nodeText)
    );

    const prompt = `Given a topic "${
      learningPath.topic
    }" with the following concepts:
    ${learningPath.nodes.map((n) => n.nodeText).join(", ")}
    
    The user has already explored these concepts: ${
      clickedNodes.length > 0 ? clickedNodes.join(", ") : "none"
    }
    
    For each concept, provide:
    1. A priority score (1-10) based on importance and logical learning order
    2. 2-3 specific learning resources (articles, videos, or exercises)
    
    Format your response as a valid JSON object like this:
    {
      "nodes": [
        {
          "nodeText": "concept name",
          "priority": priority_score,
          "recommendedResources": ["resource1", "resource2"]
        }
      ]
    }
    
    Do not include any markdown formatting, code blocks, or backticks in your response. Just return the raw JSON.`;

    console.log("Sending prompt to AI:", prompt);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.log("AI response received, length:", responseText.length);
    console.log("AI response preview:", responseText.substring(0, 200) + "...");

    // Clean the response to ensure it's valid JSON
    const cleanedResponse = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    console.log(
      "Cleaned response preview:",
      cleanedResponse.substring(0, 200) + "..."
    );

    try {
      console.log("Attempting to parse JSON response");
      const enhancedData = JSON.parse(cleanedResponse);
      console.log("JSON parsed successfully");
      console.log("Enhanced data nodes count:", enhancedData.nodes.length);
      console.log("Enhanced data sample:", enhancedData.nodes.slice(0, 2));

      // Update learning path with AI recommendations
      console.log("Updating learning path with AI recommendations");
      for (const enhancedNode of enhancedData.nodes) {
        const nodeIndex = learningPath.nodes.findIndex(
          (n) =>
            n.nodeText.toLowerCase() === enhancedNode.nodeText.toLowerCase()
        );

        console.log(
          `Node "${enhancedNode.nodeText}" found at index:`,
          nodeIndex
        );
        if (nodeIndex !== -1) {
          console.log(
            `Updating node "${enhancedNode.nodeText}" with priority ${enhancedNode.priority} and ${enhancedNode.recommendedResources.length} resources`
          );
          learningPath.nodes[nodeIndex].priority = enhancedNode.priority;
          learningPath.nodes[nodeIndex].recommendedResources =
            enhancedNode.recommendedResources;
        }
      }

      learningPath.lastUpdated = new Date();
      console.log("Saving enhanced learning path");
      await learningPath.save();
      console.log("Enhanced learning path saved successfully");
    } catch (jsonError) {
      console.error("Error parsing AI response:", jsonError);
      console.log("Raw response:", responseText);

      // Fallback: assign default priorities if parsing fails
      console.log("Using fallback method to assign priorities");
      learningPath.nodes.forEach((node, index) => {
        console.log(
          `Assigning fallback priority ${10 - index} to node "${node.nodeText}"`
        );
        node.priority = 10 - index;
        if (
          !node.recommendedResources ||
          node.recommendedResources.length === 0
        ) {
          console.log(
            `Assigning fallback resources to node "${node.nodeText}"`
          );
          node.recommendedResources = [
            `${learningPath.topic} ${node.nodeText} tutorial`,
            `Learn ${node.nodeText} basics`,
          ];
        }
      });

      learningPath.lastUpdated = new Date();
      console.log("Saving learning path with fallback data");
      await learningPath.save();
      console.log("Learning path with fallback data saved successfully");
    }
    console.log("=== ENHANCE LEARNING PATH END ===");
  } catch (error) {
    console.error("Error enhancing learning path:", error);
    // Try to save basic priorities even if there's an error
    try {
      if (learningPath) {
        learningPath.nodes.forEach((node, index) => {
          node.priority = 10 - Math.min(index, 9);
          if (
            !node.recommendedResources ||
            node.recommendedResources.length === 0
          ) {
            node.recommendedResources = [
              `${learningPath.topic} ${node.nodeText} resources`,
              `${node.nodeText} study guide`,
            ];
          }
        });

        learningPath.lastUpdated = new Date();
        await learningPath.save();
        console.log("Saved basic priorities after error");
      }
    } catch (saveError) {
      console.error("Failed to save fallback priorities:", saveError);
    }
  }
};

exports.updateNodeStatus = async (req, res) => {
  try {
    console.log("=== UPDATE NODE STATUS START ===");
    console.log("Request body:", req.body);
    const { googleId, topic, nodeText, status } = req.body;

    const learningPath = await LearningPath.findOne({ googleId, topic });
    console.log("Learning path found:", learningPath ? "Yes" : "No");

    if (!learningPath) {
      console.log("Learning path not found, returning 404");
      return res.status(404).json({ error: "Learning path not found" });
    }

    const nodeIndex = learningPath.nodes.findIndex(
      (n) => n.nodeText === nodeText
    );
    console.log(`Node "${nodeText}" found at index:`, nodeIndex);

    if (nodeIndex === -1) {
      console.log("Node not found in learning path, returning 404");
      return res.status(404).json({ error: "Node not found in learning path" });
    }

    console.log(
      `Updating node "${nodeText}" status from "${learningPath.nodes[nodeIndex].status}" to "${status}"`
    );
    learningPath.nodes[nodeIndex].status = status;
    learningPath.lastUpdated = new Date();

    console.log("Saving updated learning path");
    await learningPath.save();
    console.log("Learning path updated successfully");

    console.log("=== UPDATE NODE STATUS END ===");
    res.json(learningPath);
  } catch (error) {
    console.error("Error updating node status:", error);
    res.status(500).json({ error: "Failed to update node status" });
  }
};

exports.getLearningPath = async (req, res) => {
  try {
    console.log("=== GET LEARNING PATH START ===");
    console.log("Request params:", req.params);
    const { googleId, topic } = req.params;

    const learningPath = await LearningPath.findOne({ googleId, topic });
    console.log("Learning path found:", learningPath ? "Yes" : "No");

    if (!learningPath) {
      console.log("Learning path not found, returning 404");
      return res.status(404).json({ error: "Learning path not found" });
    }

    console.log("Learning path nodes count:", learningPath.nodes.length);
    console.log("=== GET LEARNING PATH END ===");
    res.json(learningPath);
  } catch (error) {
    console.error("Error fetching learning path:", error);
    res.status(500).json({ error: "Failed to fetch learning path" });
  }
};
