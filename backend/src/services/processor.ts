import { query } from '../db';
import { processDumpWithGemini } from './gemini';
import { checkCalendarConflicts, createCalendarEvent } from './calendar';
import { generateEmbedding } from './embeddings';
import { searchSimilarDumps } from './memory';

export const processRawDump = async (dumpId: string) => {
  try {
    console.log(`Processing dump ${dumpId}...`);
    
    // 1. Fetch the dump
    const dumpResult = await query('SELECT * FROM raw_dumps WHERE id = $1', [dumpId]);
    if (dumpResult.rows.length === 0) {
      console.error(`Dump ${dumpId} not found`);
      return;
    }
    const dump = dumpResult.rows[0];

    // 1.5 Generate Embedding and Search Context
    let context: string[] = [];
    if (dump.content_text) {
        const embedding = await generateEmbedding(dump.content_text);
        if (embedding.length > 0) {
            // Update dump with embedding
            const vectorString = `[${embedding.join(',')}]`;
            await query('UPDATE raw_dumps SET embedding = $1 WHERE id = $2', [vectorString, dumpId]);
            
            // Search for context
            const similarDumps = await searchSimilarDumps(embedding);
            context = similarDumps.map(d => d.content_text);
        }
    }

    // 2. Call Gemini
    const aiResult = await processDumpWithGemini(dump.content_text, dump.media_url, context);
    console.log('AI Result:', aiResult);

    const { confidence_score, ...proposedData } = aiResult;
    const { start_time, end_time, title, category } = proposedData;

    // 3. Check for conflicts
    let conflict = false;
    if (start_time && end_time) {
        conflict = await checkCalendarConflicts(dump.user_id, start_time, end_time);
    }

    const missingDate = !start_time;
    
    // Traffic Light Logic
    if (confidence_score > 0.9 && !conflict && !missingDate) {
        // Auto-Add to Events
        console.log(`Auto-adding event for dump ${dumpId}`);
        
        // Sync to Google Calendar (optional here or later, spec says "When an event is moved from smart_inbox to events...". But this is auto-add.)
        // I'll sync it now for auto-add.
        const gcalEventId = await createCalendarEvent(dump.user_id, proposedData);
        
        const insertEventQuery = `
            INSERT INTO events (user_id, title, start_time, end_time, category, gcal_event_id, origin_dump_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        await query(insertEventQuery, [
            dump.user_id,
            title,
            start_time,
            end_time,
            category,
            gcalEventId,
            dumpId
        ]);

    } else {
        // Add to Smart Inbox
        console.log(`Adding dump ${dumpId} to Smart Inbox`);

        let flagReason = null;
        let status = 'pending';

        if (confidence_score < 0.9) flagReason = 'low_confidence';
        if (conflict) flagReason = 'conflict_detected';
        if (missingDate) {
            flagReason = 'missing_context';
            status = 'needs_info'; // Spec says: IF missing_date: Flag as status: 'needs_info'
        }
        if (proposedData.missing_info && proposedData.missing_info.length > 0) {
             // Append or set if not set
             flagReason = flagReason ? `${flagReason}, missing_fields` : 'missing_fields';
        }

        const insertInboxQuery = `
            INSERT INTO smart_inbox (dump_id, user_id, proposed_data, ai_confidence_score, flag_reason, status)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        
        await query(insertInboxQuery, [
            dumpId,
            dump.user_id,
            JSON.stringify(proposedData),
            confidence_score,
            flagReason,
            status
        ]);
    }

    // 4. Update raw_dumps as processed
    await query('UPDATE raw_dumps SET processed_at = NOW() WHERE id = $1', [dumpId]);

    console.log(`Dump ${dumpId} processed successfully.`);

  } catch (error) {
    console.error(`Error processing dump ${dumpId}:`, error);
  }
};
