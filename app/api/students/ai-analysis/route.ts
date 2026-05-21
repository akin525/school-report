import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { generateWithGemini } from '@/lib/ai';
import getDb from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const provider = searchParams.get('provider') as any;
    const schoolId = session.schoolId;

    if (!studentId) return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });

    const db = getDb();
    const student = db.prepare('SELECT * FROM students WHERE id = ? AND school_id = ?').get(studentId, schoolId) as any;

    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    // Get scores for the student
    const scores = db.prepare(`
      SELECT sc.*, s.name as subject_name, sess.name as session_name
      FROM scores sc
      JOIN subjects s ON s.id = sc.subject_id
      JOIN sessions sess ON sess.id = sc.session_id
      WHERE sc.student_id = ? AND sc.school_id = ?
      ORDER BY sess.name DESC, sc.term DESC
    `).all(studentId, schoolId) as any[];

    if (scores.length === 0) {
      return NextResponse.json({ analysis: "No academic records found for this student to perform analysis." });
    }

    const performanceData = scores.map(s =>
      `${s.session_name} Term ${s.term} - ${s.subject_name}: CA1(${s.ca1_score}), CA2(${s.ca2_score}), Exam(${s.exam_score}) Total: ${s.ca1_score + s.ca2_score + s.exam_score}/100`
    ).join('\n');

    const prompt = `
      Analyze the academic performance of student "${student.first_name} ${student.last_name}" based on the following scores:

      ${performanceData}

      Provide a concise AI analysis (approx 150 words) that:
      1. Summarizes overall performance across terms.
      2. Identifies strongest and weakest subjects.
      3. Suggests specific areas for improvement.
      4. Gives an encouraging closing statement.

      Format with clear headings. Use HTML tags like <b> and <br> for formatting.
    `;

    const { generateAIContent } = await import('@/lib/ai');
    const analysis = await generateAIContent(prompt, false, provider);

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error('AI Analysis error:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}
