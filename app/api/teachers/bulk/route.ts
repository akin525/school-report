import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { teachers, schoolId } = await req.json();
    const sId = schoolId || session.schoolId;

    if (!Array.isArray(teachers) || teachers.length === 0) {
      return NextResponse.json({ error: 'No teacher data provided' }, { status: 400 });
    }

    const db = getDb();
    const insertTeacherStmt = db.prepare(`
      INSERT INTO teachers (id, school_id, user_id, name, email, phone, qualification, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertUserStmt = db.prepare(`
      INSERT INTO users (id, school_id, name, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Use a transaction for consistency
    const results = [];
    for (const teacher of teachers) {
      const teacherId = uuidv4();
      let userId = null;

      // Teachers created via bulk upload get a default password if login is requested
      if (teacher.create_login && teacher.email && teacher.password) {
        userId = uuidv4();
        const hash = await hashPassword(teacher.password);
        insertUserStmt.run(userId, sId, teacher.name, teacher.email, hash, 'teacher');
      }

      insertTeacherStmt.run(
        teacherId,
        sId,
        userId,
        teacher.name || '',
        teacher.email || '',
        teacher.phone || '',
        teacher.qualification || '',
        teacher.category || 'secondary'
      );
      results.push(teacherId);
    }

    return NextResponse.json({ success: true, count: results.length });
  } catch (error: any) {
    console.error('Bulk teacher upload error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process bulk upload' }, { status: 500 });
  }
}
