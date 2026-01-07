import { prisma } from '../db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey || '');
const model = genAI.getGenerativeModel({ model: config.gemini.model });

export const generateDailySummary = async (userId: string) => {
  try {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Fetch upcoming events (next 24h)
    const events = await prisma.event.findMany({
      where: {
        userId: userId,
        startTime: {
          gte: now,
          lt: tomorrow
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    // 2. Fetch recent dumps (last 24h)
    const dumps = await prisma.rawDump.findMany({
      where: {
        userId: userId,
        createdAt: {
          gte: yesterday
        }
      },
      select: {
        contentText: true,
        sourceType: true
      }
    });

    // 3. Prompt Gemini
    const prompt = `
      Generate a Morning Briefing for the user.
      
      Upcoming Events (Next 24h):
      ${events.map(e => `- ${e.title} at ${e.startTime}`).join('\n')}
      
      Recent Notes/Dumps (Last 24h):
      ${dumps.map(d => `- [${d.sourceType}] ${d.contentText || '(Image/Audio Content)'}`).join('\n')}
      
      Output a concise, friendly summary of what to expect today and any key reminders from notes.
    `;

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();

  } catch (error) {
    console.error('Error generating summary:', error);
    return "Could not generate summary.";
  }
};

