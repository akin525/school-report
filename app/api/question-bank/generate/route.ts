import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { generateWithGemini } from '@/lib/ai';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { topic, subject, level, count, type, difficulty, provider } = await req.json();

    if (!topic || !subject) {
      return NextResponse.json({ error: 'Topic and Subject are required' }, { status: 400 });
    }

    const prompt = `
      Generate ${count || 5} ${type || 'multiple_choice'} questions for:
      Topic: ${topic}
      Subject: ${subject}
      Target Level/Class: ${level || 'Secondary School'}
      Difficulty: ${difficulty || 'medium'}

      Return a JSON array of objects with this structure:
      [
        {
          "question_text": "string",
          "option_a": "string",
          "option_b": "string",
          "option_c": "string",
          "option_d": "string",
          "correct_answer": "A, B, C, or D",
          "difficulty": "medium"
        }
      ]

      If type is 'short_answer', options should be null or empty and 'correct_answer' is the correct phrase.

      IMPORTANT: Return ONLY the JSON array.
    `;

    const { generateAIContent } = await import('@/lib/ai');
    const aiResponse = await generateAIContent(prompt, true, provider);
    const parsed = JSON.parse(aiResponse);
    const questions = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.data || []);

    return NextResponse.json({ questions });
  } catch (error: any) {
    console.error('AI Question Bank generation error:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}
