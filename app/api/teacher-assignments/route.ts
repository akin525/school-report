import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { teacherAssignments, teachers, classes, subjects, sessions } from '@/lib/schema';
import { eq, and, asc, getTableColumns } from 'drizzle-orm';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const teacherId = searchParams.get('teacherId');
    const sessionId = searchParams.get('sessionId');

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    // If teacherId is not provided, find teacher ID from user session
    let actualTeacherId = teacherId;
    if (!actualTeacherId && session.userId) {
      // Find teacher record associated with this user
      const teacherResult = await db.select({ id: teachers.id }).from(teachers).where(
        and(
          eq(teachers.user_id, session.userId),
          eq(teachers.school_id, schoolId)
        )
      ).limit(1);
      actualTeacherId = teacherResult[0]?.id;
    }

    const filters = [
      eq(teacherAssignments.school_id, schoolId),
      eq(teacherAssignments.teacher_id, actualTeacherId || '')
    ];

    if (sessionId) {
      filters.push(eq(teacherAssignments.session_id, sessionId));
    }

    const results = await db.select({
      ...getTableColumns(teacherAssignments),
      class_name: classes.name,
      class_arm: classes.arm,
      subject_name: subjects.name,
      session_name: sessions.name,
      teacher_name: teachers.name
    })
      .from(teacherAssignments)
      .leftJoin(classes, eq(classes.id, teacherAssignments.class_id))
      .leftJoin(subjects, eq(subjects.id, teacherAssignments.subject_id))
      .leftJoin(sessions, eq(sessions.id, teacherAssignments.session_id))
      .leftJoin(teachers, eq(teachers.id, teacherAssignments.teacher_id))
      .where(and(...filters))
      .orderBy(asc(sessions.name), asc(classes.name), asc(subjects.name));

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching teacher assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch teacher assignments' }, { status: 500 });
  }
}

