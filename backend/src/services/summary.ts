import { prisma } from '../db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import { getDayRangeFromTzOffsetMinutes } from '../utils/time';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey || '');
const model = genAI.getGenerativeModel({ model: config.gemini.model });

export const generateDailySummary = async (userId: string, tzOffsetMinutes?: number) => {
  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const { startUtc: startOfToday, endUtc: endOfToday, localDateISO } = getDayRangeFromTzOffsetMinutes(now, tzOffsetMinutes);

    // 1. Fetch today's events (in user's local day)
    const events = await prisma.event.findMany({
      where: {
        userId: userId,
        startTime: {
          gte: startOfToday,
          lte: endOfToday
        }
      },
      include: {
        people: { select: { id: true, name: true, relationship: true, category: true } },
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    // 1b. Fetch relevant todos for today/overdue (same logic as dashboard)
    const todos = await prisma.actionableItem.findMany({
      where: {
        userId,
        completed: false,
        OR: [
          { dueDate: { lte: endOfToday } },
          { dueDate: null },
        ],
      },
      include: {
        people: { select: { id: true, name: true, relationship: true, category: true } },
      },
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
      take: 20,
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
You are generating the user's "AI Insight" for their Dashboard.

CRITICAL:
- Today is ${localDateISO}. Only describe THIS date as "today".
- Do not invent dates. If an event has a timestamp, treat it as authoritative.
- Ownership: If an event/todo has people with relationship "child", it belongs to that child (not the user). Use phrasing like "For <name>: …". If no people are attached, assume it's the user's.

Return concise Markdown with:
- A short headline
- "Today" section (bulleted agenda + todos, clearly labeled by owner)
- 1–3 reminders inferred from recent notes

DATA (JSON):
${JSON.stringify({
  today: localDateISO,
  events: events.map(e => ({
    title: e.title,
    startTime: e.startTime,
    endTime: e.endTime,
    allDay: e.isAllDay,
    location: e.location,
    category: e.category,
    people: e.people?.map(p => ({ name: p.name, relationship: p.relationship, category: p.category })) ?? [],
  })),
  todos: todos.map(t => ({
    title: t.title,
    dueDate: t.dueDate,
    priority: t.priority,
    category: t.category,
    people: t.people?.map(p => ({ name: p.name, relationship: p.relationship, category: p.category })) ?? [],
  })),
  recentNotes: dumps.map(d => ({
    sourceType: d.sourceType,
    contentText: d.contentText || null,
  })),
}, null, 2)}
`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();

  } catch (error) {
    console.error('Error generating summary:', error);
    return "Could not generate summary.";
  }
};

