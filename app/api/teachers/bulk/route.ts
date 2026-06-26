import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { teachers as teachersTable, users } from '@/lib/schema';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { teachers: data, schoolId } = await req.json();
    const sId = schoolId || session.schoolId;

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'No teacher data provided' }, { status: 400 });
    }

    let count = 0;
    await db.transaction(async (tx) => {
      for (const teacher of data) {
        const teacherId = uuidv4();
        let userId = null;

        if (teacher.create_login && teacher.email && teacher.password) {
          userId = uuidv4();
          const hash = await hashPassword(teacher.password);
          await tx.insert(users).values({
            id: userId,
            school_id: sId || '',
            name: teacher.name,
            email: teacher.email,
            password_hash: hash,
            role: 'teacher'
          });
        }

        await tx.insert(teachersTable).values({
          id: teacherId,
          school_id: sId || '',
          user_id: userId,
          name: teacher.name || '',
          email: teacher.email || '',
          phone: teacher.phone || '',
          qualification: teacher.qualification || '',
          category: teacher.category || 'secondary'
        });
        count++;
      }
    });

    return NextResponse.json({ success: true, count });
  } catch (error: any) {
    console.error('Bulk teacher upload error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process bulk upload' }, { status: 500 });
  }
}

