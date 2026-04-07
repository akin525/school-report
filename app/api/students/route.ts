import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const schoolId = searchParams.get('schoolId') || session.schoolId;
  const classId = searchParams.get('classId');
  const search = searchParams.get('search');

  const db = getDb();
  let query = `
    SELECT s.*, c.name as class_name, c.category as class_category
    FROM students s
    LEFT JOIN classes c ON c.id = s.class_id
    WHERE s.school_id = ?
  `;
  const params: any[] = [schoolId];

  if (classId) { query += ' AND s.class_id = ?'; params.push(classId); }
  if (search) { query += ' AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.admission_number LIKE ?)'; const s = `%${search}%`; params.push(s, s, s); }
  query += ' ORDER BY s.last_name, s.first_name';

  const students = db.prepare(query).all(...params);
  return NextResponse.json(students);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { first_name, middle_name, last_name, class_id, date_of_birth, gender, admission_number, admission_year, photo_url, schoolId } = body;
  const sId = schoolId || session.schoolId;

  if (!first_name || !last_name) return NextResponse.json({ error: 'First name and last name required' }, { status: 400 });

  const db = getDb();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO students (id, school_id, admission_number, first_name, middle_name, last_name, class_id, date_of_birth, gender, photo_url, admission_year)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, sId, admission_number || null, first_name, middle_name || '', last_name, class_id || null, date_of_birth || '', gender || '', photo_url || '', admission_year || '');

  return NextResponse.json(db.prepare('SELECT * FROM students WHERE id=?').get(id), { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, first_name, middle_name, last_name, class_id, date_of_birth, gender, admission_number, admission_year, photo_url } = await req.json();
  const db = getDb();
  db.prepare(`
    UPDATE students SET first_name=?, middle_name=?, last_name=?, class_id=?, date_of_birth=?, gender=?, admission_number=?, admission_year=?, photo_url=?
    WHERE id=?
  `).run(first_name, middle_name, last_name, class_id, date_of_birth, gender, admission_number, admission_year, photo_url, id);

  return NextResponse.json(db.prepare('SELECT * FROM students WHERE id=?').get(id));
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await req.json();
  const db = getDb();
  db.prepare('DELETE FROM students WHERE id=?').run(id);
  return NextResponse.json({ success: true });
}