import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('schoolId') || session.schoolId;
    const classId = searchParams.get('classId');
    const search = searchParams.get('search');

    const db = getDb();

    // Security check: Students should only see themselves or possibly classmates
    // For now, let's restrict students from listing all students
    if (session.role === 'student') {
      const student = db.prepare('SELECT s.*, c.name as class_name, c.category as class_category, u.email as user_email FROM students s LEFT JOIN classes c ON c.id = s.class_id LEFT JOIN users u ON u.id = s.user_id WHERE s.user_id = ?').get(session.userId);
      return NextResponse.json(student ? [student] : []);
    }
    const params: any[] = [schoolId];
    let query = 'SELECT s.*, c.name as class_name, c.category as class_category, u.email as user_email FROM students s LEFT JOIN classes c ON c.id = s.class_id LEFT JOIN users u ON u.id = s.user_id WHERE s.school_id = ?';

    if (classId) { query += ' AND s.class_id = ?'; params.push(classId); }
    if (search) { query += ' AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.admission_number LIKE ?)'; const s = `%${search}%`; params.push(s, s, s); }
    query += ' ORDER BY s.last_name, s.first_name';

    const students = db.prepare(query).all(...params);
    return NextResponse.json(students);
  } catch (error: any) {
    console.error('STUDENT_GET_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await requestJson(req);
    const { first_name, middle_name, last_name, class_id, date_of_birth, gender, admission_number, admission_year, photo_url, schoolId, email, password } = body;
    const sId = schoolId || session.schoolId;

    if (!first_name || !last_name) return NextResponse.json({ error: 'First name and last name required' }, { status: 400 });

    const db = getDb();
    const id = uuidv4();
    let userId = null;

    if (email && password) {
      userId = uuidv4();
      const pwHash = await hashPassword(password);
      db.prepare('INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)')
        .run(userId, sId, `${first_name} ${last_name}`, email, pwHash, 'student');
    }

    db.prepare(`
      INSERT INTO students (id, school_id, admission_number, first_name, middle_name, last_name, class_id, date_of_birth, gender, photo_url, admission_year, email, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, sId, admission_number || null, first_name, middle_name || '', last_name, class_id || null, date_of_birth || '', gender || '', photo_url || '', admission_year || '', email || null, userId);

    return NextResponse.json(db.prepare('SELECT * FROM students WHERE id=?').get(id), { status: 201 });
  } catch (error: any) {
    console.error('STUDENT_POST_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

async function requestJson(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await requestJson(req);
    const { id, first_name, middle_name, last_name, class_id, date_of_birth, gender, admission_number, admission_year, photo_url, email, password } = body;
    const db = getDb();

    const student = db.prepare('SELECT * FROM students WHERE id=?').get(id) as any;
    let userId = student.user_id;

    if (email) {
      if (userId) {
        // Update user
        if (password) {
          const pwHash = await hashPassword(password);
          db.prepare('UPDATE users SET email=?, password_hash=?, name=? WHERE id=?')
            .run(email, pwHash, `${first_name} ${last_name}`, userId);
        } else {
          db.prepare('UPDATE users SET email=?, name=? WHERE id=?')
            .run(email, `${first_name} ${last_name}`, userId);
        }
      } else if (password) {
        // Create user
        userId = uuidv4();
        const pwHash = await hashPassword(password);
        db.prepare('INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)')
          .run(userId, student.school_id, `${first_name} ${last_name}`, email, pwHash, 'student');
      }
    }

    db.prepare(`
      UPDATE students SET first_name=?, middle_name=?, last_name=?, class_id=?, date_of_birth=?, gender=?, admission_number=?, admission_year=?, photo_url=?, email=?, user_id=?
      WHERE id=?
    `).run(first_name, middle_name, last_name, class_id, date_of_birth, gender, admission_number, admission_year, photo_url, email || null, userId, id);

    return NextResponse.json(db.prepare('SELECT * FROM students WHERE id=?').get(id));
  } catch (error: any) {
    console.error('STUDENT_PUT_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await requestJson(req);
    const db = getDb();

    const student = db.prepare('SELECT user_id FROM students WHERE id=?').get(id) as any;
    if (student?.user_id) {
      db.prepare('DELETE FROM users WHERE id=?').run(student.user_id);
    }

    db.prepare('DELETE FROM students WHERE id=?').run(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('STUDENT_DELETE_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}