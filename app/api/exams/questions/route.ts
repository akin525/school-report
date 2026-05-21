import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('examId');

    if (!examId) return NextResponse.json({ error: 'examId required' }, { status: 400 });

    const db = getDb();

    // Get exam details to check class and time
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId) as any;
    if (!exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });

    const now = new Date();
    const start = new Date(exam.start_time);
    const end = new Date(exam.end_time);

    // If student, check if they belong to the class and if exam is active
    if (session.role === 'student') {
      const student = db.prepare('SELECT id, class_id FROM students WHERE user_id = ?').get(session.userId) as any;
      if (!student || student.class_id !== exam.class_id) {
        return NextResponse.json({ error: 'Unauthorized: This exam is not for your class' }, { status: 403 });
      }

      if (now < start) return NextResponse.json({ error: 'Exam has not started yet' }, { status: 403 });
      if (now > end) return NextResponse.json({ error: 'Exam has ended' }, { status: 403 });

      // Check if already submitted
      const submitted = db.prepare('SELECT id FROM exam_submissions WHERE exam_id = ? AND student_id = ?').get(examId, student.id);
      if (submitted) return NextResponse.json({ error: 'You have already submitted this exam' }, { status: 403 });
    }

    // Get questions for the subject and class
    // In a real system, we'd limit this or have specific questions selected for the exam
    // For now, we'll take up to 50 questions from the bank for that subject/class/term
    const questions = db.prepare(`
      SELECT id, question_text, option_a, option_b, option_c, option_d, question_type, marks
      FROM question_bank
      WHERE subject_id = ? AND class_id = ? AND term = ?
      LIMIT 50
    `).all(exam.subject_id, exam.class_id, exam.term);

    return NextResponse.json({ exam, questions });
  } catch (error: any) {
    console.error('EXAM_QUESTIONS_GET_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
