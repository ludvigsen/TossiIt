import { prisma } from '../db';
import { Prisma } from '@prisma/client';
import { processDumpWithGemini } from './gemini';
import { checkCalendarConflicts, createCalendarEvent } from './calendar';
import { generateEmbedding } from './embeddings';
import { searchSimilarDumps } from './memory';

export const processRawDump = async (dumpId: string) => {
  try {
    console.log(`Processing dump ${dumpId}...`);
    
    // 1. Fetch the dump
    const dump = await prisma.rawDump.findUnique({
      where: { id: dumpId }
    });
    
    if (!dump) {
      console.error(`Dump ${dumpId} not found`);
      return;
    }

    // 1.5 Generate Embedding and Search Context
    let context: string[] = [];
    if (dump.contentText) {
        const embedding = await generateEmbedding(dump.contentText);
        if (embedding.length > 0) {
            // Update dump with embedding using raw SQL for pgvector
            const vectorString = `[${embedding.join(',')}]`;
            await prisma.$executeRaw`
                UPDATE raw_dumps 
                SET embedding = ${Prisma.raw(`${vectorString}::vector`)} 
                WHERE id = ${dumpId}::uuid
            `;
            
            // Search for context
            const similarDumps = await searchSimilarDumps(embedding);
            context = similarDumps.map(d => d.content_text);
        }
    }

    // 2. Call Gemini
    const aiResult = await processDumpWithGemini(dump.contentText, dump.mediaUrl, context);
    console.log('AI Result:', aiResult);

    const { confidence_score, ...proposedData } = aiResult;
    const { start_time, end_time, title, category } = proposedData;

    // 3. Check for conflicts
    let conflict = false;
    if (start_time && end_time) {
        conflict = await checkCalendarConflicts(dump.userId, start_time, end_time);
    }

    const missingDate = !start_time;
    
    // Traffic Light Logic
    if (confidence_score > 0.9 && !conflict && !missingDate) {
        // Auto-Add to Events
        console.log(`Auto-adding event for dump ${dumpId}`);
        
        // Sync to Google Calendar (optional here or later, spec says "When an event is moved from smart_inbox to events...". But this is auto-add.)
        // I'll sync it now for auto-add.
        const gcalEventId = await createCalendarEvent(dump.userId, proposedData);
        
        await prisma.event.create({
          data: {
            userId: dump.userId,
            title: title || '',
            startTime: new Date(start_time),
            endTime: end_time ? new Date(end_time) : null,
            category: category || null,
            gcalEventId: gcalEventId,
            originDumpId: dumpId
          }
        });

    } else {
        // Add to Smart Inbox
        console.log(`Adding dump ${dumpId} to Smart Inbox`);

        let flagReason = null;
        let status = 'pending';

        // Collect all flag reasons
        const reasons: string[] = [];
        if (confidence_score < 0.9) reasons.push('low_confidence');
        if (conflict) reasons.push('conflict_detected');
        
        if (missingDate) {
            reasons.push('missing_context');
            status = 'needs_info'; // Spec says: IF missing_date: Flag as status: 'needs_info'
        }
        
        if (proposedData.missing_info && proposedData.missing_info.length > 0) {
             reasons.push('missing_fields');
        }
        
        flagReason = reasons.length > 0 ? reasons.join(', ') : null;

        await prisma.smartInbox.create({
          data: {
            dumpId: dumpId,
            userId: dump.userId,
            proposedData: proposedData as any,
            aiConfidenceScore: confidence_score,
            flagReason: flagReason,
            status: status
          }
        });
    }

    // 4. Update raw_dumps as processed
    await prisma.rawDump.update({
      where: { id: dumpId },
      data: { processedAt: new Date() }
    });

    console.log(`Dump ${dumpId} processed successfully.`);

  } catch (error) {
    console.error(`Error processing dump ${dumpId}:`, error);
  }
};
