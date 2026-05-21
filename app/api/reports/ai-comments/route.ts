import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { generateWithGemini } from '@/lib/ai';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { students, scores, term, provider } = await req.json();

    if (!Array.isArray(students) || !Array.isArray(scores)) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 });
    }

    const termName = term === '1' ? '1st' : term === '2' ? '2nd' : '3rd';

    // Group scores by student
    const studentScoresMap: Record<string, any[]> = {};
    scores.forEach((s: any) => {
      if (!studentScoresMap[s.student_id]) studentScoresMap[s.student_id] = [];
      studentScoresMap[s.student_id].push(s);
    });

    const prompt = `
      Generate short, personalized, and professional class teacher comments for the following students based on their ${termName} term academic performance.

      Return a JSON object where the keys are student IDs and values are the generated comment strings.

      DATA:
      ${students.map(st => {
        const sScores = studentScoresMap[st.id] || [];
        const performance = sScores.map(s => `${s.subject_name}: ${s.ca1_score + s.ca2_score + s.exam_score}/100`).join(', ');
        return `ID: ${st.id}, Name: ${st.first_name} ${st.last_name}, Performance: [${performance}]`;
      }).join('\n')}

      Guidelines:
      - Be encouraging but honest.
      - Keep comments between 10-25 words.
      - Use the student's first name.
      - Focus on their strengths and areas for improvement.

      IMPORTANT: Return ONLY the JSON object.
    `;

    const { generateAIContent } = await import('@/lib/ai');
    const aiResponse = await generateAIContent(prompt, true, provider);
    const results = JSON.parse(aiResponse);

    return NextResponse.json({ comments: results });
  } catch (error: any) {
    console.error('AI Comment generation error:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}
