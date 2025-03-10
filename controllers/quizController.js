const Quiz = require("../models/Quiz");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
const ClickedNode = require("../models/ClickedNode");

exports.generateQuiz = async (req, res) => {
  try {
    const { googleId, topic, nodeText, parentContext, forceRefresh } = req.body;

    // Check if quiz already exists and not forcing refresh
    if (!forceRefresh) {
      let quiz = await Quiz.findOne({ googleId, topic, nodeText });
      if (quiz) {
        return res.json(quiz);
      }
    } else {
      // If forcing refresh, delete existing quiz
      await Quiz.findOneAndDelete({ googleId, topic, nodeText });
    }

    // Get clicked nodes to enhance context
    const clickedNodes = await ClickedNode.find({ googleId, topic });
    const clickedNodeTexts = clickedNodes.map((node) => node.nodeText);

    // Generate quiz questions using AI with enhanced context
    const prompt = `Create a quiz about "${nodeText}" in the context of "${
      parentContext || topic
    }".
    
    The user has already explored these concepts: ${
      clickedNodeTexts.length > 0 ? clickedNodeTexts.join(", ") : "none"
    }
    
    Generate 5-10 multiple-choice questions that test understanding of key concepts.
    
    For each question:
    1. Write a clear question
    2. Provide 4 options (only one correct)
    3. Indicate which option is correct (0-3)
    4. Include a brief explanation of why the answer is correct
    
    Format your response as a valid JSON object:
    {
      "questions": [
        {
          "question": "Question text",
          "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
          "correctAnswer": correct_option_index,
          "explanation": "Explanation text"
        }
      ]
    }
    
    Do not include any markdown formatting, code blocks, or backticks in your response. Just return the raw JSON.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Clean the response to ensure it's valid JSON
    const cleanedResponse = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    try {
      const quizData = JSON.parse(cleanedResponse);

      quiz = new Quiz({
        googleId,
        topic,
        nodeText,
        questions: quizData.questions,
      });

      await quiz.save();
      res.json(quiz);
    } catch (jsonError) {
      console.error("Error parsing AI response:", jsonError);

      // Create a fallback quiz with a simple question
      quiz = new Quiz({
        googleId,
        topic,
        nodeText,
        questions: [
          {
            question: `What is the main concept of ${nodeText}?`,
            options: [
              `${nodeText} is a fundamental concept in ${topic}`,
              `${nodeText} is unrelated to ${topic}`,
              `${nodeText} is a fictional term`,
              `${nodeText} is only used in advanced applications`,
            ],
            correctAnswer: 0,
            explanation: `${nodeText} is indeed a fundamental concept in ${topic}.`,
          },
        ],
      });

      await quiz.save();
      res.json(quiz);
    }
  } catch (error) {
    console.error("Error generating quiz:", error);
    res.status(500).json({ error: "Failed to generate quiz" });
  }
};

exports.getQuiz = async (req, res) => {
  try {
    const { googleId, topic, nodeText } = req.params;

    const quiz = await Quiz.findOne({ googleId, topic, nodeText });
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    res.json(quiz);
  } catch (error) {
    console.error("Error fetching quiz:", error);
    res.status(500).json({ error: "Failed to fetch quiz" });
  }
};
