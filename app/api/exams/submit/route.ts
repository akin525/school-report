import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { students, exams, examSubmissions, questionBank } from '@/lib/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { examId, answers } = await req.json();
    if (!examId || !answers) return NextResponse.json({ error: 'Missing examId or answers' }, { status: 400 });

    // Get student record
    const studentResult = await db.select({ id: students.id, class_id: students.class_id }).from(students).where(eq(students.user_id, session.userId)).limit(1);
    const student = studentResult[0];
    if (!student) return NextResponse.json({ error: 'Student record not found' }, { status: 404 });

    // Verify exam and time
    const examResult = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
    const exam = examResult[0];
    if (!exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });

    const now = new Date();
    const end = new Date(exam.end_time);
    if (now > new Date(end.getTime() + 60000)) { // 1 min grace period
      return NextResponse.json({ error: 'Exam has ended' }, { status: 403 });
    }

    // Check if already submitted
    const existingResult = await db.select({ id: examSubmissions.id }).from(examSubmissions).where(
      and(
        eq(examSubmissions.exam_id, examId),
        eq(examSubmissions.student_id, student.id)
      )
    ).limit(1);

    if (existingResult.length > 0) return NextResponse.json({ error: 'Already submitted' }, { status: 400 });

    // Calculate score
    const questionIds = Object.keys(answers);
    let score = 0;

    if (questionIds.length > 0) {
      const correctAnswers = await db.select({ id: questionBank.id, correct_answer: questionBank.correct_answer, marks: questionBank.marks })
        .from(questionBank)
        .where(inArray(questionBank.id, questionIds));

      for (const q of correctAnswers) {
        if (q.correct_answer === answers[q.id]) {
          score += q.marks || 1;
        }
      }
    }

    const submissionId = uuidv4();
    await db.insert(examSubmissions).values({
      id: submissionId,
      exam_id: examId,
      student_id: student.id,
      score,
      answers: answers
    });

    return NextResponse.json({ success: true, score });
  } catch (error: any) {
    console.error('EXAM_SUBMIT_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

