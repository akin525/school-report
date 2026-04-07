import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const schoolId = searchParams.get('schoolId') || session.schoolId;

  const db = getDb();
  const sessions = db.prepare('SELECT * FROM sessions WHERE school_id = ? ORDER BY start_year DESC').all(schoolId);
  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, start_year, end_year, is_current, schoolId } = await req.json();
  const sId = schoolId || session.schoolId;

  const db = getDb();
  if (is_current) {
    db.prepare('UPDATE sessions SET is_current = 0 WHERE school_id = ?').run(sId);
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO sessions (id, school_id, name, start_year, end_year, is_current)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, sId, name, start_year, end_year, is_current ? 1 : 0);

  return NextResponse.json(db.prepare('SELECT * FROM sessions WHERE id=?').get(id), { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, name, start_year, end_year, is_current } = await req.json();
  const db = getDb();

  const existing = db.prepare('SELECT * FROM sessions WHERE id=?').get(id) as any;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (is_current) {
    db.prepare('UPDATE sessions SET is_current = 0 WHERE school_id = ?').run(existing.school_id);
  }

  db.prepare('UPDATE sessions SET name=?, start_year=?, end_year=?, is_current=? WHERE id=?')
    .run(name, start_year, end_year, is_current ? 1 : 0, id);

  return NextResponse.json(db.prepare('SELECT * FROM sessions WHERE id=?').get(id));
}