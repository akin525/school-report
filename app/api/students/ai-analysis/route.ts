import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { students, scores, subjects, sessions } from '@/lib/schema';
import { eq, and, desc, getTableColumns } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const provider = searchParams.get('provider') as any;
    const schoolId = session.schoolId;

    if (!studentId) return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });

    const studentResult = await db.select().from(students).where(
      and(eq(students.id, studentId), eq(students.school_id, schoolId || ''))
    ).limit(1);
    const student = studentResult[0];

    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    // Get scores for the student
    const studentScores = await db.select({
      ...getTableColumns(scores),
      subject_name: subjects.name,
      session_name: sessions.name
    })
      .from(scores)
      .innerJoin(subjects, eq(subjects.id, scores.subject_id))
      .innerJoin(sessions, eq(sessions.id, scores.session_id))
      .where(and(eq(scores.student_id, studentId), eq(scores.school_id, schoolId || '')))
      .orderBy(desc(sessions.name), desc(scores.term));

    if (studentScores.length === 0) {
      return NextResponse.json({ analysis: "No academic records found for this student to perform analysis." });
    }

    const performanceData = studentScores.map(s =>
      `${s.session_name} Term ${s.term} - ${s.subject_name}: CA1(${s.ca1_score}), CA2(${s.ca2_score}), Exam(${s.exam_score}) Total: ${(s.ca1_score || 0) + (s.ca2_score || 0) + (s.exam_score || 0)}/100`
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

