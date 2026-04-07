import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const schoolId = searchParams.get('schoolId') || session.schoolId;
  const studentId = searchParams.get('studentId');
  const classId = searchParams.get('classId');
  const sessionId = searchParams.get('sessionId');
  const term = searchParams.get('term');
  const subjectId = searchParams.get('subjectId');

  const db = getDb();
  let query = `
    SELECT sc.*, s.name as subject_name, st.first_name, st.last_name, st.admission_number
    FROM scores sc
    JOIN subjects s ON s.id = sc.subject_id
    JOIN students st ON st.id = sc.student_id
    WHERE sc.school_id = ?
  `;
  const params: any[] = [schoolId];

  if (studentId) { query += ' AND sc.student_id = ?'; params.push(studentId); }
  if (classId) { query += ' AND sc.class_id = ?'; params.push(classId); }
  if (sessionId) { query += ' AND sc.session_id = ?'; params.push(sessionId); }
  if (term) { query += ' AND sc.term = ?'; params.push(parseInt(term)); }
  if (subjectId) { query += ' AND sc.subject_id = ?'; params.push(subjectId); }
  query += ' ORDER BY st.last_name, st.first_name, s.name';

  return NextResponse.json(db.prepare(query).all(...params));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { studentId, subjectId, classId, sessionId, term, ca_score, exam_score, schoolId } = body;
  const sId = schoolId || session.schoolId;

  const db = getDb();
  // Upsert
  const existing = db.prepare('SELECT id FROM scores WHERE student_id=? AND subject_id=? AND session_id=? AND term=?')
    .get(studentId, subjectId, sessionId, term) as any;

  if (existing) {
    db.prepare('UPDATE scores SET ca_score=?, exam_score=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(ca_score ?? 0, exam_score ?? 0, existing.id);
    return NextResponse.json(db.prepare('SELECT * FROM scores WHERE id=?').get(existing.id));
  } else {
    const id = uuidv4();
    db.prepare('INSERT INTO scores (id, school_id, student_id, subject_id, class_id, session_id, term, ca_score, exam_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, sId, studentId, subjectId, classId, sessionId, term, ca_score ?? 0, exam_score ?? 0);
    return NextResponse.json(db.prepare('SELECT * FROM scores WHERE id=?').get(id), { status: 201 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { scores, schoolId } = await req.json(); // bulk update
  const sId = schoolId || session.schoolId;
  const db = getDb();

  const upsert = db.transaction((scoreList: any[]) => {
    for (const sc of scoreList) {
      const existing = db.prepare('SELECT id FROM scores WHERE student_id=? AND subject_id=? AND session_id=? AND term=?')
        .get(sc.studentId, sc.subjectId, sc.sessionId, sc.term) as any;
      if (existing) {
        db.prepare('UPDATE scores SET ca_score=?, exam_score=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
          .run(sc.ca_score ?? 0, sc.exam_score ?? 0, existing.id);
      } else {
        const id = uuidv4();
        db.prepare('INSERT INTO scores (id, school_id, student_id, subject_id, class_id, session_id, term, ca_score, exam_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, sId, sc.studentId, sc.subjectId, sc.classId, sc.sessionId, sc.term, sc.ca_score ?? 0, sc.exam_score ?? 0);
      }
    }
  });

  upsert(scores);
  return NextResponse.json({ success: true });
}