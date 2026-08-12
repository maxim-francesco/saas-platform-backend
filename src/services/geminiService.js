const { GoogleGenAI } = require("@google/genai");

let ai = null;
function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment.");
  }
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
}

async function generateText({ systemInstruction, prompt, maxOutputTokens, responseMimeType, temperature }) {
  const client = getClient();
  const config = {
    systemInstruction,
    temperature: temperature ?? 0.7,
    maxOutputTokens: maxOutputTokens ?? 1024,
  };
  if (responseMimeType) config.responseMimeType = responseMimeType;
  const response = await client.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: prompt,
    config,
  });
  const text = response.text;
  if (!text) throw new Error("Empty Gemini response: " + JSON.stringify(response));
  return text;
}

module.exports = { generateText };
