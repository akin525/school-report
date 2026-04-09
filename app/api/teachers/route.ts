import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const schoolId = searchParams.get('schoolId') || session.schoolId;

  const db = getDb();
  const teachers = db.prepare(`
    SELECT t.*, u.email as user_email, u.role as user_role
    FROM teachers t
    LEFT JOIN users u ON u.id = t.user_id
    WHERE t.school_id = ?
    ORDER BY t.name
  `).all(schoolId);
  return NextResponse.json(teachers);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, email, phone, qualification, category, createLogin, password, schoolId } = await req.json();
  const sId = schoolId || session.schoolId;

  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const db = getDb();
  const teacherId = uuidv4();
  let userId = null;

  if (createLogin && email && password) {
    userId = uuidv4();
    const hash = await hashPassword(password);
    db.prepare('INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)')
      .run(userId, sId, name, email, hash, 'teacher');
  }

  db.prepare('INSERT INTO teachers (id, school_id, user_id, name, email, phone, qualification, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(teacherId, sId, userId, name, email || '', phone || '', qualification || '', category || 'secondary');

  return NextResponse.json(db.prepare('SELECT * FROM teachers WHERE id=?').get(teacherId), { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, name, email, phone, qualification, category } = await req.json();
  const db = getDb();
  db.prepare('UPDATE teachers SET name=?, email=?, phone=?, qualification=?, category=? WHERE id=?')
    .run(name, email, phone, qualification, category, id);
  return NextResponse.json(db.prepare('SELECT * FROM teachers WHERE id=?').get(id));
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await req.json();
  const db = getDb();
  
  // Get associated user ID first
  const teacher = db.prepare('SELECT user_id FROM teachers WHERE id=?').get(id) as any;
  
  if (teacher?.user_id) {
    db.prepare('DELETE FROM users WHERE id=?').run(teacher.user_id);
  }
  
  db.prepare('DELETE FROM teachers WHERE id=?').run(id);
  return NextResponse.json({ success: true });
}