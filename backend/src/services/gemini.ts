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
        category: { type: SchemaType.STRING, description: "Category: work, personal, family, soccer, school, etc." },
        confidence_score: { type: SchemaType.NUMBER },
        missing_info: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        people: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              name: { type: SchemaType.STRING, description: "Name of the person, or 'child' if grade/age context suggests a child" },
              relationship: { type: SchemaType.STRING, description: "family, coworker, teammate, child, spouse, friend, etc." },
              category: { type: SchemaType.STRING, description: "family, work, sports, school, etc." },
              grade: { type: SchemaType.STRING, description: "Grade level if mentioned (e.g., '8th grade', '8. klasse')" },
              birthDate: { type: SchemaType.STRING, description: "Birth date if known/inferred from text, in YYYY-MM-DD format" },
              school: { type: SchemaType.STRING, description: "School name if mentioned" },
              kindergarten: { type: SchemaType.STRING, description: "Kindergarten name if mentioned" },
              company: { type: SchemaType.STRING, description: "Company name (for coworkers) if mentioned" },
              department: { type: SchemaType.STRING, description: "Department/team (for coworkers) if mentioned" },
              role: { type: SchemaType.STRING, description: "Role/title (for coworkers) if mentioned" },
              workplace: { type: SchemaType.STRING, description: "Workplace (for spouse/partner) if mentioned" },
              gradeTaught: { type: SchemaType.STRING, description: "Grade taught (for teachers) if mentioned" },
              subject: { type: SchemaType.STRING, description: "Subject taught (for teachers) if mentioned" },
              sport: { type: SchemaType.STRING, description: "Sport coached (for coaches) if mentioned" },
              team: { type: SchemaType.STRING, description: "Team name (for coaches) if mentioned" },
              organization: { type: SchemaType.STRING, description: "Club/organization (for coaches) if mentioned" },
              metadata: {
                type: SchemaType.OBJECT,
                description:
                  "Optional relationship-specific metadata as a JSON object. Use only these keys when possible.",
                properties: {
                  birthDate: { type: SchemaType.STRING, description: "YYYY-MM-DD if known" },
                  grade: { type: SchemaType.STRING, description: "Grade level (child)" },
                  school: { type: SchemaType.STRING, description: "School name" },
                  kindergarten: { type: SchemaType.STRING, description: "Kindergarten name" },
                  company: { type: SchemaType.STRING, description: "Company name" },
                  department: { type: SchemaType.STRING, description: "Department/team" },
                  role: { type: SchemaType.STRING, description: "Role/title" },
                  workplace: { type: SchemaType.STRING, description: "Workplace name" },
                  gradeTaught: { type: SchemaType.STRING, description: "Grade taught" },
                  subject: { type: SchemaType.STRING, description: "Subject taught" },
                  sport: { type: SchemaType.STRING, description: "Sport coached" },
                  team: { type: SchemaType.STRING, description: "Team name" },
                  organization: { type: SchemaType.STRING, description: "Club/organization" },
                },
              },
              notes: { type: SchemaType.STRING, description: "Additional context like grade, age, or relationship details" },
              person_id: { type: SchemaType.STRING, description: "ID of an existing person from known_people if this clearly matches them" },
              is_new: { type: SchemaType.BOOLEAN, description: "true if this is a new person not in known_people" }
            },
            required: []
          },
          description: "People mentioned or involved in this dump. Use person_id to point to existing people from known_people when possible."
        },
        actionable_items: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              title: { type: SchemaType.STRING },
              description: { type: SchemaType.STRING },
              kind: { type: SchemaType.STRING, description: "\"todo\" or \"info\". Use \"info\" for non-actionable context that should expire." },
              due_date: { type: SchemaType.STRING, description: "ISO 8601 date string or null" },
              expires_at: { type: SchemaType.STRING, description: "ISO 8601 date string or null. REQUIRED when kind=\"info\"." },
              priority: { type: SchemaType.STRING, description: "high, medium, or low" },
              category: { type: SchemaType.STRING, description: "school, family, work, etc." },
              people_ids: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
                description: "List of existing person_id values (from KNOWN PEOPLE) relevant to this item."
              }
            },
            required: ["title"]
          },
          description: "Items extracted from the captured entry. Use kind=todo for actionable tasks and kind=info for time-bounded context. Always include expires_at for info."
        },
        full_text: {
          type: SchemaType.STRING,
          description: "Full plain-text transcription of ALL readable text from the image and/or message"
        }
      },
      required: ["title", "confidence_score"]
    }
  }
});

import fs from 'fs';
import path from 'path';
import axios from 'axios';

async function getImageData(mediaPath: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    // If it's a URL (HTTP/HTTPS), download it
    if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
      console.log(`Downloading image from URL: ${mediaPath}`);
      const response = await axios.get(mediaPath, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 second timeout
      });
      
      const buffer = Buffer.from(response.data);
      const base64 = buffer.toString('base64');
      
      // Detect mime type from response headers or URL
      const contentType = response.headers['content-type'] || 'image/jpeg';
      let mimeType = 'image/jpeg';
      if (contentType.includes('png')) mimeType = 'image/png';
      else if (contentType.includes('webp')) mimeType = 'image/webp';
      else if (contentType.includes('gif')) mimeType = 'image/gif';
      
      return { data: base64, mimeType };
    }
    
    // If it's a local file path (starts with /uploads/ or just uploads/)
    let absolutePath: string;
    if (mediaPath.startsWith('/uploads/')) {
      // Local storage path: /uploads/filename.jpg -> process.cwd()/uploads/filename.jpg
      absolutePath = path.join(process.cwd(), mediaPath);
    } else if (mediaPath.startsWith('uploads/')) {
      // Relative path without leading slash
      absolutePath = path.join(process.cwd(), mediaPath);
    } else if (path.isAbsolute(mediaPath)) {
      // Already absolute path
      absolutePath = mediaPath;
    } else {
      // Relative path - resolve from cwd
      absolutePath = path.resolve(process.cwd(), mediaPath);
    }
    
    console.log(`Looking for image at: ${absolutePath}`);
    
    if (fs.existsSync(absolutePath)) {
      const mediaData = fs.readFileSync(absolutePath);
      const ext = path.extname(absolutePath).toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.gif') mimeType = 'image/gif';
      
      console.log(`Successfully loaded image from ${absolutePath} (${mimeType})`);
      return { data: mediaData.toString('base64'), mimeType };
    } else {
      console.warn(`Media file not found at ${absolutePath}`);
      // Try to see if uploads directory exists
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (fs.existsSync(uploadsDir)) {
        console.log(`Uploads directory exists at: ${uploadsDir}`);
        const files = fs.readdirSync(uploadsDir);
        console.log(`Files in uploads: ${files.slice(0, 5).join(', ')}...`);
      } else {
        console.warn(`Uploads directory does not exist at: ${uploadsDir}`);
      }
      return null;
    }
  } catch (error) {
    console.error(`Error loading image from ${mediaPath}:`, error);
    return null;
  }
}

export const processDumpWithGemini = async (
  text: string,
  mediaPath?: string,
  context: string[] = [],
  knownPeople: Array<{ id: string; name: string; relationship: string | null; category: string | null; metadata: any | null }> = [],
) => {
  const contextString = context.length > 0 
    ? `Here is the user's past history regarding this topic:\n${context.join('\n')}\nUse this to infer category and preferences.` 
    : '';

  const knownPeopleString =
    knownPeople.length > 0
      ? `KNOWN PEOPLE (JSON):\n${JSON.stringify(knownPeople)}\n\nWhen you output people:\n- If a mentioned person clearly matches one of these, set person_id to that person's id and is_new to false.\n- If you do NOT know the id, OMIT person_id entirely (do NOT output person_id: null and do NOT output the string \"null\").\n- If it is clearly a different/new person, set is_new = true and omit person_id.\n- Prefer mapping by name first, then by grade/metadata (e.g., grade, school, relationship).\n`
      : 'There are currently no known people defined for this user.';

  const now = new Date();
  const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][tomorrow.getDay()];

  const prompt = `
    You are analyzing input for a busy parent's life planner app. This could be text, an image, or both.
    
    CRITICAL: If an image is provided, you MUST carefully read ALL text in the image. This is often a screenshot of a message, email, or document.
    
    IMPORTANT DATE EXTRACTION RULES:
    - Today is ${dayOfWeek}, ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
    - Tomorrow is ${tomorrowDayOfWeek}, ${tomorrow.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
    - If the text says "Thursday" or "torsdag" (Norwegian), and today is ${dayOfWeek}, calculate if it means tomorrow (${tomorrowDayOfWeek}) or next Thursday
    - If it says "tomorrow" or "i morgen", use: ${tomorrow.toISOString()}
    - If it says a day of the week, calculate the actual date based on today
    - If it says "next week" or "next Monday", calculate the date
    - ALWAYS convert relative dates to absolute ISO 8601 dates
    
    EXTRACTION REQUIREMENTS:
    1. Event details:
       - Title: Extract the main event name (e.g., "School hike", "Soccer practice")
       - Dates: Convert ALL date references to ISO 8601 format
       - Times: Extract start and end times if mentioned
       - Location: Extract any location mentioned
       - Category: school, family, work, sports, etc.
    
    2. People mentioned:
       - Look for names, grades (e.g., "8th grade", "8. klasse"), ages, school/kindergarten names, companies, roles, teachers, coaches.
       - Infer relationship: child / spouse / family / teacher / coach / coworker / friend / acquaintance / other.
       - Populate relationship-specific metadata whenever possible:
         * child: birthDate (YYYY-MM-DD if explicitly present), grade, school OR kindergarten
         * teacher: gradeTaught, school, subject
         * coach: sport, team, organization
         * coworker: company, department, role
         * spouse/partner: workplace, birthDate (if present)
       - You can put these fields directly on the person object and/or inside metadata (preferred). Avoid inventing values.
       - Use the KNOWN PEOPLE list below to map each mentioned person to an existing person_id when possible.
    
    3. Items (todos + info):
       - Extract BOTH actionable tasks (todos) and non-actionable time-bounded context (info).
       - Use kind="todo" for tasks the user must do.
       - Use kind="info" for context that should auto-hide after it is no longer relevant.
       - For kind="info", you MUST set expires_at (you decide it).
       - People linkage:
         * If this message is about a child's school/kindergarten activity, then ALL related todos and infos should be attributed to that child.
         * When the child is a KNOWN PERSON, include their person_id in people_ids for EVERY related item (todos AND info).
         * If the child is not a known person_id, still include the child as a person in the people[] array (relationship=child) with metadata (grade/school), and leave people_ids empty.
       - Extract EVERYTHING that requires action (todos):
         * Things to bring (cocoa, warm clothes, shoes, gloves, etc.)
         * Things to prepare (packed lunch, sausages for grilling)
         * Things to inform about (tell teachers by Wednesday)
         * Deadlines (inform by Wednesday)
       - Set due dates (todo): if it says "inform by Wednesday", set the due_date to that Wednesday
       - Priority: "high" for deadlines, "medium" for things to bring/prepare
    
    4. School/Event context:
       - If it mentions a grade level, this is important context
       - If it mentions school activities, categorize as "school"
       - Extract all details: departure time, return time, activities planned
    
    For people detection and mapping:
    - KNOWN PEOPLE are provided as JSON with fields { id, name, relationship, category, metadata }.
    - ALWAYS try to map detected people to KNOWN PEOPLE first:
      * If names match (case-insensitive), map to that id (person_id) and set is_new = false.
      * If names are generic (\"child\", \"son\", \"daughter\", etc.) but grade/school/relationship clearly match a known child, map to that child.
      * Only when you are confident that this is a different person NOT in the list, set is_new = true and leave person_id null.
    - Avoid inventing new generic people when an appropriate known person exists.
    - Always set is_new explicitly:
      * is_new = false when you mapped to a known person_id
      * is_new = true when you are creating a new person (and omit person_id)
    
    ${contextString}

    ${knownPeopleString}
    
    Current date/time: ${now.toISOString()}
    Today: ${dayOfWeek}
    Tomorrow: ${tomorrowDayOfWeek}
    
    BE THOROUGH: Extract EVERY detail from the image/text. Don't miss:
    - Dates (even if just "Thursday" - convert it!)
    - Times (departure, return, event start/end)
    - People (names, grades, relationships)
    - Action items (everything to bring, prepare, inform about)
    - Deadlines (when things need to be done)
    
    Output ONLY valid JSON adhering to the schema.
  `;

  let parts: any[] = [prompt];
  if (text) parts.push(text);

  if (mediaPath) {
    const imageData = await getImageData(mediaPath);
    if (imageData) {
      parts.push({ inlineData: { data: imageData.data, mimeType: imageData.mimeType } });
      console.log(`Added image to Gemini request (${imageData.mimeType})`);
    } else {
      console.warn(`Could not load image from ${mediaPath}, processing text only`);
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

