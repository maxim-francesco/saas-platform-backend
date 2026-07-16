const { GoogleGenAI } = require("@google/genai");

let ai = null;
function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment.");
  }
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
}

async function generateText({ systemInstruction, prompt }) {
  const client = getClient();
  const response = await client.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.7,
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  const text = response.text;
  if (!text) throw new Error("Empty Gemini response: " + JSON.stringify(response));
  return text;
}

module.exports = { generateText };
