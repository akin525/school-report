import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { examId, answers } = await req.json();
    if (!examId || !answers) return NextResponse.json({ error: 'Missing examId or answers' }, { status: 400 });

    const db = getDb();

    // Get student record
    const student = db.prepare('SELECT id, class_id FROM students WHERE user_id = ?').get(session.userId) as any;
    if (!student) return NextResponse.json({ error: 'Student record not found' }, { status: 404 });

    // Verify exam and time
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId) as any;
    if (!exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });

    const now = new Date();
    const end = new Date(exam.end_time);
    if (now > new Date(end.getTime() + 60000)) { // 1 min grace period
      return NextResponse.json({ error: 'Exam has ended' }, { status: 403 });
    }

    // Check if already submitted
    const existing = db.prepare('SELECT id FROM exam_submissions WHERE exam_id = ? AND student_id = ?').get(examId, student.id);
    if (existing) return NextResponse.json({ error: 'Already submitted' }, { status: 400 });

    // Calculate score
    const questionIds = Object.keys(answers);
    let score = 0;

    if (questionIds.length > 0) {
      const placeholders = questionIds.map(() => '?').join(',');
      const correctAnswers = db.prepare(`
        SELECT id, correct_answer, marks FROM question_bank WHERE id IN (${placeholders})
      `).all(...questionIds) as any[];

      for (const q of correctAnswers) {
        if (q.correct_answer === answers[q.id]) {
          score += q.marks;
        }
      }
    }

    const submissionId = uuidv4();
    db.prepare(`
      INSERT INTO exam_submissions (id, exam_id, student_id, score, answers)
      VALUES (?, ?, ?, ?, ?)
    `).run(submissionId, examId, student.id, score, JSON.stringify(answers));

    return NextResponse.json({ success: true, score });
  } catch (error: any) {
    console.error('EXAM_SUBMIT_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
