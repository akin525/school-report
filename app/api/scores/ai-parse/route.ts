import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { schools, subjects } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { image, subjectId, term, schoolId, provider = 'openai' } = body;
    const sId = schoolId || session.schoolId;

    if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

    // Fetch school AI settings
    const schoolResult = await db.select({
      openai_api_key: schools.openai_api_key,
      gemini_api_key: schools.gemini_api_key,
      ai_enabled: schools.ai_enabled
    }).from(schools).where(eq(schools.id, sId || '')).limit(1);
    const school = schoolResult[0];

    if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 });
    if (!school.ai_enabled) return NextResponse.json({ error: 'AI features are currently disabled by the administrator' }, { status: 403 });

    const gKey = school.gemini_api_key || process.env.GEMINI_API_KEY;
    const oKey = school.openai_api_key || process.env.OPENAI_API_KEY;

    const subjectResult = await db.select({ name: subjects.name }).from(subjects).where(eq(subjects.id, subjectId)).limit(1);
    const subject = subjectResult[0];
    const subjectName = subject?.name || 'Subject';

    const base64Parts = image.split(',');
    const base64Data = base64Parts[1];
    const mimeType = image.split(';')[0].split(':')[1] || 'image/jpeg';

    const prompt = `You are a data entry specialist. Extract student scores from this document for the subject "${subjectName}" during the ${term === '1' ? '1st' : term === '2' ? '2nd' : '3rd'} Term.
    Return a JSON array of objects with these exact keys: admission_number, first_name, last_name, ca1, ca2, exam.
    Ensure all numbers are parsed correctly. If a score is missing, use 0.
    The response must be a valid JSON array only.`;

    if (provider === 'gemini') {
      if (!gKey) return NextResponse.json({ error: 'Gemini API Key missing' }, { status: 500 });

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${gKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: base64Data } }
            ]
          }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return NextResponse.json({ error: 'Gemini API failed: ' + (error.error?.message || 'Unknown error') }, { status: response.status });
      }

      const result = await response.json();
      const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!aiText) return NextResponse.json({ error: 'No data extracted from Gemini' }, { status: 422 });

      try {
        const scoresResult = JSON.parse(aiText);
        return NextResponse.json({ scores: scoresResult });
      } catch (e) {
        return NextResponse.json({ error: 'Failed to parse Gemini response as JSON' }, { status: 500 });
      }

    } else {
      // Default to OpenAI
      if (!oKey) return NextResponse.json({ error: 'OpenAI API Key missing' }, { status: 500 });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${oKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: { url: image }
                }
              ]
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return NextResponse.json({ error: 'OpenAI API failed: ' + (error.error?.message || 'Unknown error') }, { status: response.status });
      }

      const result = await response.json();
      const aiText = result.choices?.[0]?.message?.content;

      if (!aiText) return NextResponse.json({ error: 'No data extracted from OpenAI' }, { status: 422 });

      try {
        const parsed = JSON.parse(aiText);
        const scoresResult = Array.isArray(parsed) ? parsed : (parsed.scores || parsed.students || Object.values(parsed)[0]);

        if (!Array.isArray(scoresResult)) {
            return NextResponse.json({ error: 'AI did not return a list of scores' }, { status: 422 });
        }

        return NextResponse.json({ scores: scoresResult });
      } catch (e) {
        return NextResponse.json({ error: 'Failed to parse OpenAI response' }, { status: 500 });
      }
    }
  } catch (error: any) {
    console.error('AI_PARSE_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

