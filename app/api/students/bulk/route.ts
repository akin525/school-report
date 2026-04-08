import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { students, schoolId } = await req.json();
    const sId = schoolId || session.schoolId;

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'No student data provided' }, { status: 400 });
    }

    const db = getDb();
    const insertStmt = db.prepare(`
      INSERT INTO students (id, school_id, admission_number, first_name, middle_name, last_name, class_id, date_of_birth, gender, admission_year)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Use a transaction for bulk insert
    const transaction = db.transaction((data) => {
      for (const student of data) {
        const id = uuidv4();
        insertStmt.run(
          id,
          sId,
          student.admission_number || null,
          student.first_name || '',
          student.middle_name || '',
          student.last_name || '',
          student.class_id || null,
          student.date_of_birth || '',
          student.gender || '',
          student.admission_year || ''
        );
      }
    });

    transaction(students);

    return NextResponse.json({ success: true, count: students.length });
  } catch (error: any) {
    console.error('Bulk student upload error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process bulk upload' }, { status: 500 });
  }
}
