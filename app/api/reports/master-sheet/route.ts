import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const sessionId = searchParams.get('sessionId');
  const subjectId = searchParams.get('subjectId');
  const term = parseInt(searchParams.get('term') || '1');
  const schoolId = session.schoolId;

  if (!classId || !sessionId || !subjectId) {
    return NextResponse.json({ error: 'classId, sessionId, and subjectId are required' }, { status: 400 });
  }

  const db = getDb();

  // Get session info
  const academicSession = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as any;
  
  // Get class info
  const classInfo = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId) as any;
  
  // Get subject info
  const subjectInfo = db.prepare('SELECT * FROM subjects WHERE id = ?').get(subjectId) as any;

  // Get all students in the class
  const students = db.prepare(`
    SELECT id, first_name, middle_name, last_name, admission_number
    FROM students
    WHERE class_id = ? AND school_id = ?
    ORDER BY last_name, first_name
  `).all(classId, schoolId) as any[];

  // Get scores for the specific subject, class, and term
  const scores = db.prepare(`
    SELECT * FROM scores
    WHERE class_id = ? AND session_id = ? AND subject_id = ? AND term = ? AND school_id = ?
  `).all(classId, sessionId, subjectId, term, schoolId) as any[];

  return NextResponse.json({
    session: academicSession,
    class: classInfo,
    subject: subjectInfo,
    students,
    scores,
    term
  });
}
