import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { config } from '../config';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey || '');

const model = genAI.getGenerativeModel({
  model: config.gemini.model,
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING },
        start_time: { type: SchemaType.STRING, description: "ISO 8601 date string or null" },
        end_time: { type: SchemaType.STRING, description: "ISO 8601 date string or null" },
        category: { type: SchemaType.STRING },
        confidence_score: { type: SchemaType.NUMBER },
        missing_info: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
      },
      required: ["title", "confidence_score"]
    }
  }
});

import fs from 'fs';
import path from 'path';

export const processDumpWithGemini = async (text: string, mediaPath?: string, context: string[] = []) => {
  const contextString = context.length > 0 
    ? `Here is the user's past history regarding this topic:\n${context.join('\n')}\nUse this to infer category and preferences.` 
    : '';

  const prompt = `
    Analyze this input. Extract event details, tasks, or notes.
    ${contextString}
    Output ONLY valid JSON adhering to the schema.
    If dates are relative (e.g. "tomorrow"), calculate them based on the current date: ${new Date().toISOString()}.
  `;

  let parts: any[] = [prompt];
  if (text) parts.push(text);

  if (mediaPath) {
    // Resolve absolute path if relative
    const absolutePath = path.isAbsolute(mediaPath) ? mediaPath : path.resolve(process.cwd(), mediaPath.replace(/^\//, '')); // remove leading slash if any
    
    if (fs.existsSync(absolutePath)) {
        const mediaData = fs.readFileSync(absolutePath);
        // Simple mime type detection based on extension
        const ext = path.extname(absolutePath).toLowerCase();
        let mimeType = 'image/jpeg';
        if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.webp') mimeType = 'image/webp';
        
        parts.push({ inlineData: { data: mediaData.toString('base64'), mimeType } });
    } else {
        console.warn(`Media file not found at ${absolutePath}`);
    }
  }

  try {
    const result = await model.generateContent(parts);
    const response = result.response;
    return JSON.parse(response.text());
  } catch (error) {
    console.error("Gemini processing error:", error);
    throw error;
  }
};

