import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('schoolId') || session.schoolId;
    const classId = searchParams.get('classId');

    const db = getDb();

    let query = `
      SELECT e.*, s.name as subject_name, c.name as class_name, u.name as creator_name,
             (SELECT COUNT(*) FROM exam_submissions es WHERE es.exam_id = e.id) as submission_count
      FROM exams e
      JOIN subjects s ON s.id = e.subject_id
      JOIN classes c ON c.id = e.class_id
      JOIN users u ON u.id = e.created_by
      WHERE e.school_id = ?
    `;
    const params: any[] = [schoolId];

    if (session.role === 'student') {
      const student = db.prepare('SELECT class_id, id FROM students WHERE user_id = ?').get(session.userId) as any;
      if (student) {
        query += ' AND e.class_id = ?';
        params.push(student.class_id);

        // Include if student has submitted
        query = query.replace('SELECT e.*', `SELECT e.*, (SELECT score FROM exam_submissions es WHERE es.exam_id = e.id AND es.student_id = "${student.id}") as student_score`);
      }
    } else if (classId) {
      query += ' AND e.class_id = ?';
      params.push(classId);
    }

    query += ' ORDER BY e.start_time DESC';

    const exams = db.prepare(query).all(...params);
    return NextResponse.json(exams);
  } catch (error: any) {
    console.error('EXAMS_GET_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { title, subject_id, class_id, session_id, term, start_time, end_time, duration_minutes, total_marks, schoolId } = await req.json();
    const sId = schoolId || session.schoolId;

    if (!title || !subject_id || !class_id || !start_time || !end_time || !duration_minutes) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO exams (id, school_id, title, subject_id, class_id, session_id, term, start_time, end_time, duration_minutes, total_marks, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, sId, title, subject_id, class_id, session_id, term, start_time, end_time, duration_minutes, total_marks || 100, session.userId);

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('EXAMS_POST_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
