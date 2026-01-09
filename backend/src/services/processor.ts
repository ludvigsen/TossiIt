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

    // 1.2 Load known people for this user (for Gemini to map to)
    const knownPeople = await prisma.person.findMany({
      where: { userId: dump.userId },
      select: {
        id: true,
        name: true,
        relationship: true,
        category: true,
        metadata: true,
      },
    });

    // 1.3 Load recent events to help Gemini avoid duplicates
    const recentEvents = await prisma.event.findMany({
      where: { userId: dump.userId },
      orderBy: { startTime: 'desc' },
      take: 20,
    });

    // 1.5 Generate Embedding and Search Context (for dumps that already have text)
    let context: string[] = [];
    if (dump.contentText) {
      const embedding = await generateEmbedding(dump.contentText);
        if (embedding.length > 0) {
        // Update dump with embedding using raw SQL for pgvector
            const vectorString = `[${embedding.join(',')}]`;
        const vectorLiteral = `'${vectorString}'`; // pgvector expects quoted string literal
        await prisma.$executeRaw`
          UPDATE raw_dumps 
          SET embedding = ${Prisma.raw(`${vectorLiteral}::vector`)} 
          WHERE id = ${dumpId}::uuid
        `;
            
        // Search for similar dumps for additional context (user-scoped, excluding current dump)
        const similarDumps = await searchSimilarDumps(embedding, dump.userId, dumpId);
        context = similarDumps.map((d) => d.content_text);
        }
    }

    // Add recent events to context so Gemini can see possible duplicates
    if (recentEvents.length > 0) {
      const eventLines = recentEvents.map(
        (e) =>
          `EXISTING_EVENT: id=${e.id}, title="${e.title}", start=${e.startTime.toISOString()}, end=${
            e.endTime ? e.endTime.toISOString() : 'null'
          }, category=${e.category || ''}`,
      );
      context.push(...eventLines);
    }

    // 2. Call Gemini (it can also extract full_text from images)
    const aiResult = await processDumpWithGemini(
      dump.contentText || '',
      dump.mediaUrl || undefined,
      context,
      knownPeople,
    );
    console.log('AI Result:', aiResult);

    const { confidence_score, people = [], actionable_items = [], full_text, ...proposedData } = aiResult;

    // If this dump had no text but Gemini extracted full_text, persist it and generate embedding now
    if (!dump.contentText && full_text) {
      try {
        await prisma.rawDump.update({
          where: { id: dumpId },
          data: { contentText: full_text as string }
        });

        const embedding = await generateEmbedding(full_text as string);
        if (embedding.length > 0) {
          const vectorString = `[${embedding.join(',')}]`;
          const vectorLiteral = `'${vectorString}'`;
          await prisma.$executeRaw`
              UPDATE raw_dumps 
              SET embedding = ${Prisma.raw(`${vectorLiteral}::vector`)} 
              WHERE id = ${dumpId}::uuid
          `;
        }
      } catch (e) {
        console.error('Failed to persist full_text/embedding for dump', dumpId, e);
      }
    }
    const { start_time, end_time, title, category } = proposedData;

    // 3. Check for conflicts
    let conflict = false;
    if (start_time && end_time) {
        conflict = await checkCalendarConflicts(dump.userId, start_time, end_time);
    }

    const missingDate = !start_time;
    const hasTitle = !!title;
    const hasCategory = !!category;
    
    // Smarter auto-approval: If we have title + date + category, even with lower confidence, we can auto-approve
    // For school events especially, we want to be more lenient
    const isSchoolEvent = category === 'school' || proposedData.category === 'school';
    const smartAutoApprove = hasTitle && !missingDate && (hasCategory || isSchoolEvent) && confidence_score > 0.7;
    
    // Process People - create or link people mentioned
    const personIds: string[] = [];
    
    // First, try to match people by context (grade, age) even if name not mentioned
    if (proposedData.category === 'school' || category === 'school') {
      // Look for grade mentions in the data
      const gradeMatch = JSON.stringify(proposedData).match(/(\d+)(?:th|st|nd|rd)?\s*grade|(\d+)\.?\s*klasse/i);
      if (gradeMatch) {
        const grade = gradeMatch[1] || gradeMatch[2];
        // Try to find existing people with this grade in metadata
        const allPeople = await prisma.person.findMany({
          where: {
            userId: dump.userId,
            relationship: { in: ['child', 'son', 'daughter'] }
          }
        });
        
        // Filter people whose metadata contains this grade
        const matchingPeople = allPeople.filter(person => {
          const metadata = person.metadata as any;
          if (!metadata) return false;
          const personGrade = metadata.grade || '';
          return personGrade.toLowerCase().includes(grade) || 
                 JSON.stringify(metadata).toLowerCase().includes(grade);
        });
        
        for (const person of matchingPeople) {
          if (!personIds.includes(person.id)) {
            personIds.push(person.id);
            console.log(`Matched person ${person.name} by grade context: ${grade}`);
          }
        }
      }
    }
    
    // Process explicitly mentioned people
    for (const personData of people) {
      // Destructure potential mapping hints from Gemini
      const anyPerson = personData as any;
      const rawMappedId: unknown = anyPerson.person_id ?? anyPerson.personId;
      const mappedId =
        typeof rawMappedId === 'string' &&
        rawMappedId.trim() !== '' &&
        rawMappedId.trim().toLowerCase() !== 'null' &&
        // UUID v4/v1-ish general match (Prisma expects uuid)
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawMappedId.trim())
          ? rawMappedId.trim()
          : undefined;
      const isNew: boolean | undefined = anyPerson.is_new;

      try {
        let person = null;

        // 1) If Gemini gave us a person_id, try to use that directly
        if (mappedId) {
          person = await prisma.person.findFirst({
            where: { id: mappedId, userId: dump.userId },
          });
        }

        // 2) If no valid person yet and we have a concrete name, try match by (userId, name)
        if (!person && personData.name) {
          person = await prisma.person.findUnique({
            where: {
              userId_name: {
                userId: dump.userId,
                name: personData.name,
              },
            },
          });
        }

        // Helper to build metadata from personData
        const buildMetadata = () => {
          const metadata: any = {};
          // If Gemini provided a nested metadata object, merge it first.
          if (anyPerson.metadata && typeof anyPerson.metadata === 'object' && !Array.isArray(anyPerson.metadata)) {
            Object.assign(metadata, anyPerson.metadata);
          }
          if (anyPerson.grade) metadata.grade = anyPerson.grade;
          if (anyPerson.school) metadata.school = anyPerson.school;
          if (anyPerson.birthDate) metadata.birthDate = anyPerson.birthDate;
          Object.keys(anyPerson).forEach((key) => {
            if (
              !['name', 'relationship', 'category', 'notes', 'person_id', 'personId', 'is_new', 'metadata'].includes(key) &&
              anyPerson[key]
            ) {
              metadata[key] = anyPerson[key];
            }
          });
          return metadata;
        };

        // 3) If still no person, create it (we already tried matching by id + (userId,name)).
        // We do NOT rely on Gemini setting is_new correctly; it can be missing.
        if (!person && personData.name) {
          const metadata = buildMetadata();
          person = await prisma.person.create({
            data: {
              userId: dump.userId,
              name: personData.name,
              relationship: personData.relationship || null,
              category: personData.category || null,
              metadata: Object.keys(metadata).length > 0 ? metadata : null,
              notes: personData.notes || null,
            },
          });
          console.log(`Created new person from AI mapping: ${person.name}`);
        } else if (person) {
          // 4) Merge any new metadata/relationship/category into existing person
          const updateData: any = {};
          if (personData.relationship && personData.relationship !== person.relationship) {
            updateData.relationship = personData.relationship;
          }
          if (personData.category && personData.category !== person.category) {
            updateData.category = personData.category;
          }

          const newMetadata = buildMetadata();
          if (Object.keys(newMetadata).length > 0) {
            const existingMetadata = (person.metadata as any) || {};
            updateData.metadata = { ...existingMetadata, ...newMetadata };
          }

          if (personData.notes && personData.notes !== person.notes) {
            updateData.notes = personData.notes;
          }

          if (Object.keys(updateData).length > 0) {
            person = await prisma.person.update({
              where: { id: person.id },
              data: updateData,
            });
          }
        }

        if (person && !personIds.includes(person.id)) {
          personIds.push(person.id);
        }
      } catch (error) {
        console.error(`Error processing person from AI mapping:`, error);
      }
    }

    // Process Items (todos + info)
    // Preload the people attached to this dump to drive default linking logic.
    const attachedPeople = personIds.length
      ? await prisma.person.findMany({
          where: { id: { in: personIds }, userId: dump.userId },
          select: { id: true, name: true, relationship: true, category: true },
        })
      : [];

    const childPersonIds = attachedPeople
      .filter((p) => {
        const rel = (p.relationship || '').toLowerCase();
        return rel === 'child' || rel === 'son' || rel === 'daughter';
      })
      .map((p) => p.id);

    const dumpCategory = (proposedData as any)?.category || null;

    for (const actionItem of actionable_items) {
      if (!actionItem.title) continue;
      
      try {
        let actionPeopleIds: string[] = [];

        // 1) Prefer explicit linkage from AI, but only keep ids that exist for this user/dump.
        const aiPeopleIds = Array.isArray((actionItem as any).people_ids) ? (actionItem as any).people_ids : [];
        if (aiPeopleIds.length > 0) {
          actionPeopleIds = aiPeopleIds
            .filter((pid: any) => typeof pid === 'string')
            .map((pid: string) => pid.trim())
            .filter((pid: string) => personIds.includes(pid));
        }

        // 2) If nothing explicit, try name matching in description against attached people (cheap).
        if (actionPeopleIds.length === 0 && actionItem.description) {
          const desc = actionItem.description.toLowerCase();
          actionPeopleIds = attachedPeople
            .filter((p) => p.name && desc.includes(p.name.toLowerCase()))
            .map((p) => p.id);
        }

        // 3) If still nothing and this looks like a school item, default-link to child(ren) on this dump.
        const itemCategory = (actionItem as any).category || null;
        const isSchoolContext = itemCategory === 'school' || dumpCategory === 'school';
        if (actionPeopleIds.length === 0 && isSchoolContext && childPersonIds.length > 0) {
          actionPeopleIds = [...childPersonIds];
        }

        const kind = ((actionItem as any).kind === 'info' ? 'info' : 'todo') as 'info' | 'todo';
        const expiresAtRaw = (actionItem as any).expires_at as string | undefined;
        const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

        await prisma.actionableItem.create({
          data: {
            userId: dump.userId,
            dumpId: dumpId,
            title: actionItem.title,
            description: actionItem.description || null,
            kind,
            dueDate: actionItem.due_date ? new Date(actionItem.due_date) : null,
            expiresAt,
            priority: actionItem.priority || null,
            category: actionItem.category || null,
            people: {
              connect: actionPeopleIds.map(id => ({ id }))
            }
          }
        });
        console.log(`Created item (${kind}): ${actionItem.title}`);
      } catch (error) {
        console.error(`Error creating actionable item:`, error);
      }
    }

    // Traffic Light Logic - Smarter auto-approval with duplicate check
    if ((confidence_score > 0.9 || smartAutoApprove) && !conflict && !missingDate) {
      // Before auto-creating, check if a very similar event already exists around the same time
      const startDate = new Date(start_time);
      const windowStart = new Date(startDate.getTime() - 60 * 60 * 1000); // 1h before
      const windowEnd = new Date(startDate.getTime() + 60 * 60 * 1000); // 1h after

      const possibleDuplicates = await prisma.event.findMany({
        where: {
          userId: dump.userId,
          startTime: {
            gte: windowStart,
            lte: windowEnd,
          },
        },
      });

      const normalizedTitle = (title || '').trim().toLowerCase();
      const duplicate = possibleDuplicates.find(
        (e) => e.title.trim().toLowerCase() === normalizedTitle,
      );

      if (duplicate) {
        console.log(
          `Skipping auto-add for dump ${dumpId} - similar event already exists: ${duplicate.id}`,
        );
      } else {
        // Auto-Add to Events
        console.log(`Auto-adding event for dump ${dumpId}`);
        
        // Sync to Google Calendar
        const gcalEventId = await createCalendarEvent(dump.userId, proposedData);

        await prisma.event.create({
          data: {
            userId: dump.userId,
            title: title || '',
            startTime: startDate,
            endTime: end_time ? new Date(end_time) : null,
            category: category || null,
            gcalEventId: gcalEventId,
            originDumpId: dumpId,
            people: {
              connect: personIds.map((id) => ({ id })),
            },
          },
        });
      }

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
            proposedData: {
              ...proposedData,
              people: people,
              actionable_items: actionable_items
            } as any,
            aiConfidenceScore: confidence_score,
            flagReason: flagReason,
            status: status,
            people: {
              connect: personIds.map((id) => ({ id })),
            },
          }
        });
    }

    // Link people to dump
    if (personIds.length > 0) {
      await prisma.rawDump.update({
        where: { id: dumpId },
        data: {
          people: {
            connect: personIds.map(id => ({ id }))
          }
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
