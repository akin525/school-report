import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const schoolId = searchParams.get('schoolId') || session.schoolId;
  const category = searchParams.get('category');
  const classId = searchParams.get('classId');

  const db = getDb();

  if (classId) {
    const subjects = db.prepare(`
      SELECT s.* FROM subjects s
      JOIN class_subjects cs ON cs.subject_id = s.id
      WHERE cs.class_id = ? AND s.school_id = ?
      ORDER BY s.name
    `).all(classId, schoolId);
    return NextResponse.json(subjects);
  }

  let query = 'SELECT * FROM subjects WHERE school_id = ?';
  const params: any[] = [schoolId];
  if (category) { query += ' AND category = ?'; params.push(category); }
  query += ' ORDER BY category, name';

  const subjects = db.prepare(query).all(...params);
  return NextResponse.json(subjects);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, code, category, schoolId } = await req.json();
  const sId = schoolId || session.schoolId;

  const db = getDb();
  const id = uuidv4();
  db.prepare('INSERT INTO subjects (id, school_id, name, code, category) VALUES (?, ?, ?, ?, ?)')
    .run(id, sId, name, code || '', category || 'secondary');

  return NextResponse.json(db.prepare('SELECT * FROM subjects WHERE id=?').get(id), { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, name, code, category } = await req.json();
  const db = getDb();
  db.prepare('UPDATE subjects SET name=?, code=?, category=? WHERE id=?').run(name, code, category, id);
  return NextResponse.json(db.prepare('SELECT * FROM subjects WHERE id=?').get(id));
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await req.json();
  const db = getDb();
  db.prepare('DELETE FROM subjects WHERE id=?').run(id);
  return NextResponse.json({ success: true });
}