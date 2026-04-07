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

  const db = getDb();
  let query = 'SELECT * FROM classes WHERE school_id = ?';
  const params: any[] = [schoolId];
  if (category) { query += ' AND category = ?'; params.push(category); }
  query += ' ORDER BY category, name';

  const classes = db.prepare(query).all(...params);
  return NextResponse.json(classes);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, arm, level, category, schoolId } = await req.json();
  const sId = schoolId || session.schoolId;

  const db = getDb();
  const id = uuidv4();
  db.prepare('INSERT INTO classes (id, school_id, name, arm, level, category) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, sId, name, arm || '', level || name, category || 'secondary');

  return NextResponse.json(db.prepare('SELECT * FROM classes WHERE id=?').get(id), { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, name, arm, level, category } = await req.json();
  const db = getDb();
  db.prepare('UPDATE classes SET name=?, arm=?, level=?, category=? WHERE id=?')
    .run(name, arm, level, category, id);
  return NextResponse.json(db.prepare('SELECT * FROM classes WHERE id=?').get(id));
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await req.json();
  const db = getDb();
  db.prepare('DELETE FROM classes WHERE id=?').run(id);
  return NextResponse.json({ success: true });
}