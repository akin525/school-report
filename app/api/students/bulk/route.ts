import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { students as studentsTable } from '@/lib/schema';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { students: data, schoolId } = await req.json();
    const sId = schoolId || session.schoolId;

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'No student data provided' }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      // Chunk the inserts to avoid large transaction overhead if needed,
      // but for standard bulk uploads, one batch is usually fine.
      const values = data.map((student: any) => ({
        id: uuidv4(),
        school_id: sId || '',
        admission_number: student.admission_number || null,
        first_name: student.first_name || '',
        middle_name: student.middle_name || '',
        last_name: student.last_name || '',
        class_id: student.class_id || null,
        date_of_birth: student.date_of_birth || '',
        gender: student.gender || '',
        admission_year: student.admission_year || '',
        email: student.email || null
      }));

      // MySQL might have limits on number of rows in one INSERT, but standard uploads are small.
      await tx.insert(studentsTable).values(values);
    });

    return NextResponse.json({ success: true, count: data.length });
  } catch (error: any) {
    console.error('Bulk student upload error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process bulk upload' }, { status: 500 });
  }
}

