import { query } from '../db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey || '');
const model = genAI.getGenerativeModel({ model: config.gemini.model });

export const generateDailySummary = async (userId: string) => {
  try {
    // 1. Fetch upcoming events (next 24h)
    const eventsRes = await query(
      `SELECT * FROM events WHERE user_id = $1 AND start_time >= NOW() AND start_time < NOW() + INTERVAL '24 hours' ORDER BY start_time ASC`,
      [userId]
    );
    const events = eventsRes.rows;

    // 2. Fetch recent dumps (last 24h)
    const dumpsRes = await query(
      `SELECT content_text, source_type FROM raw_dumps WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
      [userId]
    );
    const dumps = dumpsRes.rows;

    // 3. Prompt Gemini
    const prompt = `
      Generate a Morning Briefing for the user.
      
      Upcoming Events (Next 24h):
      ${events.map(e => `- ${e.title} at ${e.start_time}`).join('\n')}
      
      Recent Notes/Dumps (Last 24h):
      ${dumps.map(d => `- [${d.source_type}] ${d.content_text || '(Image/Audio Content)'}`).join('\n')}
      
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

