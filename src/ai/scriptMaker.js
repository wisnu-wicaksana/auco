import fs from 'fs/promises';
import path from 'path';
import { groq, gemini, withTimeout, safeJsonParse, retryRequest } from '../config/aiConfig.js';
import { logger } from '../utils/logger.js';
import * as PATHS from '../config/paths.js';

const saveJson = async (data, filepath) => {
  try {
    const dir = path.dirname(filepath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    logger.success(`Script saved to: ${filepath}`);
  } catch (error) {
    logger.error(`Failed to save file ${filepath}: ${error.message}`);
  }
};

const validateScript = (data) => {
  const requiredKeys = ['language', 'title', 'hook', 'full_narration', 'fallback_keywords', 'scenes'];
  for (const key of requiredKeys) {
    if (!data[key]) {
      throw new Error(`Validation failed: Key "${key}" not found in JSON.`);
    }
  }
  
  if (!Array.isArray(data.scenes) || data.scenes.length === 0) {
    throw new Error('Validation failed: "scenes" must be a non-empty array.');
  }
  
  return true;
};

export async function generateScript(textArticle) {
  logger.step(1, 'Processing script with AI (Primary: Gemini, Fallback: Groq)...');

const prompt = `
CRITICAL INSTRUCTION: Detect the language of the provided Article/Topic. The ENTIRE output (title, hook, full_narration, and scene narrations) MUST be written EXCLUSIVELY in that detected language. DO NOT mix languages!

Convert the following article or topic into a detailed video script for TikTok/Reels.

Article/Topic:
${textArticle}

MANDATORY RULES:
1. Output MUST be pure valid JSON format.
2. No markdown formatting (like \`\`\`json).
3. No explanatory text before or after the JSON.
4. No comments inside the JSON.
5. WORD COUNT & DURATION ENFORCEMENT: 1 minute of video requires EXACTLY 180 words because the voiceover is sped up for TikTok. You MUST calculate the required word count based on the requested duration (e.g., 2 minutes = MINIMUM 360 words). To reach long word counts, you MUST write multiple long, detailed paragraphs expanding on sub-topics, history, facts, and examples. DO NOT SUMMARIZE. If you output less than the calculated word count, the system will crash. If no duration is requested, default to 150-180 words.
6. The \`narration\` text inside the \`scenes\` array MUST be an EXACT, word-for-word sequential split of the \`full_narration\`. DO NOT duplicate, overlap, or skip any words between scenes. When you concatenate all scene narrations, it must perfectly match the \`full_narration\` without any repeated phrases.
7. The first sentence of the full_narration MUST be an engaging hook (max 12 words) translated natively into the detected language (e.g., "Did you know...", "Have you ever wondered..."). The \`hook\` JSON field should just be a copy of this first sentence. Do NOT repeat the hook in the subsequent scene narrations.
8. The closing sentence (at the end of full_narration and the last scene) MUST be an interactive Call to Action translated natively and NATURALLY into the detected language. For Indonesian, use natural phrases like "Gimana menurut kalian? Coba komen di bawah ya!" instead of stiff literal translations like "Apa yang kamu pikir?".
9. Visual keywords: MAXIMUM 2 words strictly in English (for stock footage search). The first word MUST be a subject, the second word a simple action.
   VALID EXAMPLES: "lion", "lion walking", "dog running", "woman reading", "chef cooking".
   INVALID EXAMPLES: "lion in africa", "lion with sunset", "lion hunting zebra", "woman reading newspaper indoors".

EXPECTED JSON STRUCTURE:
{
  "language": "The detected language name written in English (e.g. Indonesian, English, Spanish, Japanese)",
  "title": "Short title for the file",
  "hook": "Hook text",
  "full_narration": "The entire narration concatenated here (length adjusted based on requested duration)",
  "estimated_duration": 120,
  "thumbnail_prompt": "Prompt for generating a thumbnail",
  "fallback_keywords": [
    "nature",
    "animals"
  ],
  "scenes": [
    {
      "time": "0-6",
      "duration": 6,
      "narration": "Narration text for scene 1",
      "visual_keywords": "lion walking"
    }
  ]
}
`;

  let scriptData = null;

  try {
    logger.info('[AI-1] Attempting to generate script with Google Gemini...');
    const requestGemini = async () => {
      const response = await withTimeout(
        gemini.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.9
          }
        }), 
        30000
      );
      return typeof response.text === 'function' ? response.text() : response.text;
    };

    const responseText = await retryRequest(requestGemini, 1);
    scriptData = safeJsonParse(responseText);
    validateScript(scriptData);
    logger.success('Script successfully generated using Gemini!');

  } catch (error) {
    logger.warn(`Gemini processing failed (${error.message}). Switching to Groq (Llama 3)...`);
    
    try {
      logger.info('[AI-2] Attempting to generate script with Groq (Fallback)...');
      const requestGroq = async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        try {
          const response = await groq.chat.completions.create({
            messages: [
              { role: "system", content: "You are a helpful assistant that strictly outputs valid JSON only without markdown formatting." },
              { role: "user", content: prompt }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.7,
          }, { signal: controller.signal });
          return response.choices[0]?.message?.content || "{}";
        } finally {
          clearTimeout(timeoutId);
        }
      };

      const responseText = await retryRequest(requestGroq, 1);
      scriptData = safeJsonParse(responseText);
      validateScript(scriptData);
      logger.success('Script successfully generated using Groq (Fallback)!');
      
    } catch (groqError) {
      logger.error('Fatal Error: Both AI systems (Gemini & Groq) failed to generate the script.');
      logger.error(`Gemini Error: ${error.message}`);
      logger.error(`Groq Error: ${groqError.message}`);
      throw new Error('All AI models failed to generate the script.');
    }
  }

  await saveJson(scriptData, PATHS.SCRIPT_OUTPUT);
  return scriptData;
}

export async function generateCaption(narration, targetLanguage = 'English') {
  logger.step(5, 'AI is writing the TikTok/Reels Caption...');
  
  const prompt = `
I have a video with the following narration: "${narration}".

Please create a TikTok caption strictly and exclusively in ${targetLanguage.toUpperCase()}.
RULES:
- Maximum 2 sentences.
- Use casual, engaging language native to ${targetLanguage.toUpperCase()} that encourages comments.
- Must contain 1 question at the end.
- Do not use too many emojis (maximum 2).
- Include 3-5 relevant hashtags at the end.
`;

  let caption = "";

  try {
    logger.info('[AI-1] Attempting to generate caption with Google Gemini...');
    const requestGemini = async () => {
      const response = await withTimeout(
        gemini.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            temperature: 0.9
          }
        }), 
        20000
      );
      return typeof response.text === 'function' ? response.text() : response.text;
    };

    caption = await retryRequest(requestGemini, 1);
    logger.success('Caption successfully generated using Gemini!');

  } catch (error) {
    logger.warn(`Gemini failed to generate caption (${error.message}). Switching to Groq...`);
    
    try {
      logger.info('[AI-2] Attempting to generate caption with Groq (Fallback)...');
      const requestGroq = async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        try {
          const response = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.9,
          }, { signal: controller.signal });
          return response.choices[0]?.message?.content || "";
        } finally {
          clearTimeout(timeoutId);
        }
      };

      caption = await retryRequest(requestGroq, 1);
      logger.success('Caption successfully generated using Groq (Fallback)!');
      
    } catch (groqError) {
      logger.error(`Both AI models failed to generate caption: ${groqError.message}`);
      logger.warn('Using default caption as a fallback.');
      caption = "Watch this video until the end! What do you guys think? 👇 #video #funfacts";
    }
  }

  await fs.mkdir(path.dirname(PATHS.CAPTION_OUTPUT), { recursive: true });
  await fs.writeFile(PATHS.CAPTION_OUTPUT, caption);
  
  logger.blank('\n----------------------------------\n' + caption + '\n----------------------------------\n');
  logger.success(`Caption saved to: ${PATHS.CAPTION_OUTPUT}`);
  
  return caption;
}
