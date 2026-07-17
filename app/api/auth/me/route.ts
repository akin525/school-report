import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, schools, gradingSystem, teachers, students } from '@/lib/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userResult = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      school_id: users.school_id
    }).from(users).where(eq(users.id, session.userId)).limit(1);
    const user = userResult[0];

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    let school = null;
    let teacher = null;
    let student = null;
    let grading = null;

    if (user.school_id) {
      try {
        const schoolResult = await db.select().from(schools).where(eq(schools.id, user.school_id)).limit(1);
        school = schoolResult[0] || null;
      } catch (schoolError) {
        console.error('SCHOOL_FETCH_ERROR:', schoolError);
      }

      try {
        grading = await db.select().from(gradingSystem)
          .where(eq(gradingSystem.school_id, user.school_id))
          .orderBy(desc(gradingSystem.min_score));
      } catch (gradingError) {
        console.error('GRADING_FETCH_ERROR:', gradingError);
        grading = [];
      }

      // Always try to find a teacher record for the user, regardless of role
      const teacherResult = await db.select().from(teachers).where(
        and(
          eq(teachers.user_id, user.id),
          eq(teachers.school_id, user.school_id)
        )
      ).limit(1);
      teacher = teacherResult[0] || null;

      // If student, find student record
      if (user.role === 'student') {
        const studentResult = await db.select().from(students).where(
          and(
            eq(students.user_id, user.id),
            eq(students.school_id, user.school_id)
          )
        ).limit(1);
        student = studentResult[0] || null;
      }
    }

    return NextResponse.json({ user, school, teacher, student, grading });
  } catch (error: any) {
    console.error('AUTH_ME_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
