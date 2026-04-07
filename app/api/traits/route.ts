import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');
  const sessionId = searchParams.get('sessionId');
  const term = searchParams.get('term');
  const schoolId = searchParams.get('schoolId') || session.schoolId;

  const db = getDb();
  let query = 'SELECT * FROM affective_traits WHERE school_id = ?';
  const params: any[] = [schoolId];
  if (studentId) { query += ' AND student_id = ?'; params.push(studentId); }
  if (sessionId) { query += ' AND session_id = ?'; params.push(sessionId); }
  if (term) { query += ' AND term = ?'; params.push(parseInt(term)); }

  return NextResponse.json(db.prepare(query).all(...params));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { studentId, sessionId, term, homework, punctuality, interaction, leadership, politeness, conduct, schoolId } = body;
  const sId = schoolId || session.schoolId;

  const db = getDb();
  const existing = db.prepare('SELECT id FROM affective_traits WHERE student_id=? AND session_id=? AND term=?')
    .get(studentId, sessionId, term) as any;

  if (existing) {
    db.prepare('UPDATE affective_traits SET homework=?, punctuality=?, interaction=?, leadership=?, politeness=?, conduct=? WHERE id=?')
      .run(homework, punctuality, interaction, leadership, politeness, conduct, existing.id);
    return NextResponse.json(db.prepare('SELECT * FROM affective_traits WHERE id=?').get(existing.id));
  } else {
    const id = uuidv4();
    db.prepare('INSERT INTO affective_traits (id, school_id, student_id, session_id, term, homework, punctuality, interaction, leadership, politeness, conduct) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, sId, studentId, sessionId, term, homework, punctuality, interaction, leadership, politeness, conduct);
    return NextResponse.json(db.prepare('SELECT * FROM affective_traits WHERE id=?').get(id), { status: 201 });
  }
}