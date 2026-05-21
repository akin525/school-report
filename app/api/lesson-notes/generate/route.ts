import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { generateWithGemini } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { topic, subject, level, provider } = await request.json();

    if (!topic || !subject) {
      return NextResponse.json({ error: 'Topic and Subject are required' }, { status: 400 });
    }

    const prompt = `
      Create a detailed lesson note for the following:
      Topic: ${topic}
      Subject: ${subject}
      Target Level/Class: ${level || 'Secondary School'}

      The lesson note should include:
      1. Learning Objectives
      2. Introduction
      3. Main Content/Body (broken down into sub-topics)
      4. Summary
      5. Evaluation Questions (3-5 questions)

      Format the response as plain text with clear headings. Use standard HTML tags like <h3> and <p> for better rendering.
    `;

    const { generateAIContent } = await import('@/lib/ai');
    const generatedContent = await generateAIContent(prompt, false, provider);

    return NextResponse.json({ content: generatedContent });
  } catch (error: any) {
    console.error('Error generating lesson note:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate lesson note' }, { status: 500 });
  }
}
