import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { students, users } from '@/lib/schema';
import { eq, and, or, isNull } from 'drizzle-orm';
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

    // Find students without a user_id
    const studentsWithoutLogin = await db.select().from(students).where(
      and(
        eq(students.school_id, sId),
        or(isNull(students.user_id), eq(students.user_id, ''))
      )
    );

    if (studentsWithoutLogin.length === 0) {
      return NextResponse.json({ message: 'No students found without login credentials', count: 0 });
    }

    const defaultPassword = 'password123';
    const pwHash = await hashPassword(defaultPassword);
    let successCount = 0;
    let errorCount = 0;

    await db.transaction(async (tx) => {
      for (const student of studentsWithoutLogin) {
        try {
          // Use admission number as username, if missing use first.last.last4id
          let username = student.admission_number;
          if (!username) {
            username = `${student.first_name.toLowerCase()}.${student.last_name.toLowerCase()}.${student.id.substring(0, 4)}`;
          }

          const userId = uuidv4();

          // 1. Create entry in users table
          await tx.insert(users).values({
            id: userId,
            school_id: sId,
            name: `${student.first_name} ${student.last_name}`,
            email: username, // Using username as email/identifier
            password_hash: pwHash,
            role: 'student'
          });

          // 2. Link user to student record
          await tx.update(students).set({
            user_id: userId,
            email: username
          }).where(eq(students.id, student.id));

          successCount++;
        } catch (err) {
          console.error(`Failed to generate login for student ${student.id}:`, err);
          errorCount++;
        }
      }
    });

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

