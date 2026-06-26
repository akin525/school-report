import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { exams, students, examSubmissions, questionBank } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('examId');

    if (!examId) return NextResponse.json({ error: 'examId required' }, { status: 400 });

    // Get exam details to check class and time
    const examResult = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
    const exam = examResult[0];
    if (!exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });

    const now = new Date();
    const start = new Date(exam.start_time);
    const end = new Date(exam.end_time);

    // If student, check if they belong to the class and if exam is active
    if (session.role === 'student') {
      const studentResult = await db.select({ id: students.id, class_id: students.class_id }).from(students).where(eq(students.user_id, session.userId)).limit(1);
      const student = studentResult[0];

      if (!student || student.class_id !== exam.class_id) {
        return NextResponse.json({ error: 'Unauthorized: This exam is not for your class' }, { status: 403 });
      }

      if (now < start) return NextResponse.json({ error: 'Exam has not started yet' }, { status: 403 });
      if (now > end) return NextResponse.json({ error: 'Exam has ended' }, { status: 403 });

      // Check if already submitted
      const submittedResult = await db.select({ id: examSubmissions.id }).from(examSubmissions).where(
        and(
          eq(examSubmissions.exam_id, examId),
          eq(examSubmissions.student_id, student.id)
        )
      ).limit(1);

      if (submittedResult.length > 0) return NextResponse.json({ error: 'You have already submitted this exam' }, { status: 403 });
    }

    // Get questions for the subject and class
    const questions = await db.select({
      id: questionBank.id,
      question_text: questionBank.question_text,
      option_a: questionBank.option_a,
      option_b: questionBank.option_b,
      option_c: questionBank.option_c,
      option_d: questionBank.option_d,
      question_type: questionBank.question_type,
      marks: questionBank.marks
    })
      .from(questionBank)
      .where(
        and(
          eq(questionBank.subject_id, exam.subject_id),
          eq(questionBank.class_id, exam.class_id),
          eq(questionBank.term, exam.term)
        )
      )
      .limit(50);

    return NextResponse.json({ exam, questions });
  } catch (error: any) {
    console.error('EXAM_QUESTIONS_GET_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

