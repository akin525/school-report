import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const schoolId = searchParams.get('schoolId');

  if (!schoolId) return NextResponse.json({ error: 'School ID required' }, { status: 400 });

  const db = getDb();
  const grading = db.prepare('SELECT * FROM grading_system WHERE school_id = ? ORDER BY min_score DESC').all(schoolId);
  return NextResponse.json(grading);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { school_id, grade, min_score, max_score, remark, color } = await req.json();
  const db = getDb();
  const id = uuidv4();

  db.prepare(`
    INSERT INTO grading_system (id, school_id, grade, min_score, max_score, remark, color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, school_id, grade, min_score, max_score, remark, color);

  return NextResponse.json({ success: true, id });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, grade, min_score, max_score, remark, color } = await req.json();
  const db = getDb();

  db.prepare(`
    UPDATE grading_system SET grade=?, min_score=?, max_score=?, remark=?, color=?
    WHERE id=?
  `).run(grade, min_score, max_score, remark, color, id);

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await req.json();
  const db = getDb();

  db.prepare('DELETE FROM grading_system WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
