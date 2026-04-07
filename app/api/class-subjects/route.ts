import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const schoolId = searchParams.get('schoolId') || session.schoolId;

  const db = getDb();
  const rows = db.prepare(`
    SELECT cs.*, s.name as subject_name, s.code as subject_code, s.category
    FROM class_subjects cs
    JOIN subjects s ON s.id = cs.subject_id
    WHERE cs.class_id = ? AND cs.school_id = ?
    ORDER BY s.name
  `).all(classId, schoolId);

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { classId, subjectIds, schoolId } = await req.json();
  const sId = schoolId || session.schoolId;

  const db = getDb();
  // Replace all subject assignments for this class
  db.prepare('DELETE FROM class_subjects WHERE class_id = ? AND school_id = ?').run(classId, sId);

  const insert = db.prepare('INSERT OR IGNORE INTO class_subjects (id, class_id, subject_id, school_id) VALUES (?, ?, ?, ?)');
  for (const subjectId of subjectIds) {
    insert.run(uuidv4(), classId, subjectId, sId);
  }

  return NextResponse.json({ success: true });
}