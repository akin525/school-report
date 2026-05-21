import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'superadmin' && session.role !== 'school_admin')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { schoolId } = await req.json();
    const sId = schoolId || session.schoolId;

    if (!sId) return NextResponse.json({ error: 'School ID required' }, { status: 400 });

    const db = getDb();

    // Find students without a user_id
    const studentsWithoutLogin = db.prepare(`
      SELECT * FROM students
      WHERE school_id = ? AND (user_id IS NULL OR user_id = '')
    `).all(sId) as any[];

    if (studentsWithoutLogin.length === 0) {
      return NextResponse.json({ message: 'No students found without login credentials', count: 0 });
    }

    const defaultPassword = 'password123';
    const pwHash = await hashPassword(defaultPassword);
    let successCount = 0;
    let errorCount = 0;

    // Use a transaction for better performance
    const generateTransaction = db.transaction((students: any[]) => {
      for (const student of students) {
        try {
          // Use admission number as username, if missing use first.last.last4id
          let username = student.admission_number;
          if (!username) {
            username = `${student.first_name.toLowerCase()}.${student.last_name.toLowerCase()}.${student.id.substring(0, 4)}`;
          }

          const userId = uuidv4();

          // 1. Create entry in users table
          db.prepare(`
            INSERT INTO users (id, school_id, name, email, password_hash, role)
            VALUES (?, ?, ?, ?, ?, 'student')
          `).run(userId, sId, `${student.first_name} ${student.last_name}`, username, pwHash);

          // 2. Link user to student record
          db.prepare(`
            UPDATE students SET user_id = ?, email = ? WHERE id = ?
          `).run(userId, username, student.id);

          successCount++;
        } catch (err) {
          console.error(`Failed to generate login for student ${student.id}:`, err);
          errorCount++;
        }
      }
    });

    generateTransaction(studentsWithoutLogin);

    return NextResponse.json({
      success: true,
      message: `Successfully generated logins for ${successCount} students.`,
      count: successCount,
      failed: errorCount,
      defaultPassword
    });

  } catch (error: any) {
    console.error('GENERATE_LOGINS_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
