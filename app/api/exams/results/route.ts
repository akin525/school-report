import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'student') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('examId');

    if (!examId) return NextResponse.json({ error: 'examId required' }, { status: 400 });

    const db = getDb();

    const exam = db.prepare(`
      SELECT e.*, s.name as subject_name, c.name as class_name
      FROM exams e
      JOIN subjects s ON s.id = e.subject_id
      JOIN classes c ON c.id = e.class_id
      WHERE e.id = ?
    `).get(examId);

    const submissions = db.prepare(`
      SELECT es.*, s.first_name, s.last_name, s.admission_number
      FROM exam_submissions es
      JOIN students s ON s.id = es.student_id
      WHERE es.exam_id = ?
      ORDER BY es.submitted_at DESC
    `).all(examId);

    return NextResponse.json({ exam, submissions });
  } catch (error: any) {
    console.error('EXAM_RESULTS_GET_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
