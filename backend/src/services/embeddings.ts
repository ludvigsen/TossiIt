import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey || '');
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error("Error generating embedding:", error);
    return [];
  }
};

