import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const schoolId = searchParams.get('schoolId') || session.schoolId;
  const teacherId = searchParams.get('teacherId');
  const sessionId = searchParams.get('sessionId');
  const classId = searchParams.get('classId');

  const db = getDb();
  let query = `
    SELECT ta.*, t.name as teacher_name, s.name as subject_name, c.name as class_name,
           ses.name as session_name
    FROM teacher_assignments ta
    JOIN teachers t ON t.id = ta.teacher_id
    LEFT JOIN subjects s ON s.id = ta.subject_id
    JOIN classes c ON c.id = ta.class_id
    JOIN sessions ses ON ses.id = ta.session_id
    WHERE ta.school_id = ?
  `;
  const params: any[] = [schoolId];

  if (teacherId) { query += ' AND ta.teacher_id = ?'; params.push(teacherId); }
  if (sessionId) { query += ' AND ta.session_id = ?'; params.push(sessionId); }
  if (classId) { query += ' AND ta.class_id = ?'; params.push(classId); }
  query += ' ORDER BY t.name, s.name';

  return NextResponse.json(db.prepare(query).all(...params));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { teacherId, subjectId, classId, sessionId, schoolId } = await req.json();
  const sId = schoolId || session.schoolId;

  const db = getDb();
  const id = uuidv4();
  try {
    // Check if a primary teacher is already assigned to this class (subject-less)
    if (!subjectId) {
      const existing = db.prepare('SELECT id FROM teacher_assignments WHERE teacher_id=? AND class_id=? AND session_id=? AND subject_id IS NULL')
        .get(teacherId, classId, sessionId);
      if (existing) return NextResponse.json({ error: 'Teacher is already assigned to this class' }, { status: 409 });
    }

    db.prepare('INSERT INTO teacher_assignments (id, school_id, teacher_id, subject_id, class_id, session_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, sId, teacherId, subjectId || null, classId, sessionId);
    return NextResponse.json(db.prepare('SELECT * FROM teacher_assignments WHERE id=?').get(id), { status: 201 });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Assignment already exists' }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await req.json();
  const db = getDb();
  db.prepare('DELETE FROM teacher_assignments WHERE id=?').run(id);
  return NextResponse.json({ success: true });
}