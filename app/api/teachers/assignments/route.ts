import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { teacherAssignments, teachers, subjects, classes, sessions } from '@/lib/schema';
import { eq, and, asc, getTableColumns, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const schoolId = searchParams.get('schoolId') || session.schoolId;
  const teacherId = searchParams.get('teacherId');
  const sessionId = searchParams.get('sessionId');
  const classId = searchParams.get('classId');

  const filters = [eq(teacherAssignments.school_id, schoolId || '')];
  if (teacherId) filters.push(eq(teacherAssignments.teacher_id, teacherId));
  if (sessionId) filters.push(eq(teacherAssignments.session_id, sessionId));
  if (classId) filters.push(eq(teacherAssignments.class_id, classId));

  const results = await db.select({
    ...getTableColumns(teacherAssignments),
    teacher_name: teachers.name,
    subject_name: subjects.name,
    class_name: classes.name,
    session_name: sessions.name
  })
    .from(teacherAssignments)
    .innerJoin(teachers, eq(teachers.id, teacherAssignments.teacher_id))
    .leftJoin(subjects, eq(subjects.id, teacherAssignments.subject_id))
    .innerJoin(classes, eq(classes.id, teacherAssignments.class_id))
    .innerJoin(sessions, eq(sessions.id, teacherAssignments.session_id))
    .where(and(...filters))
    .orderBy(asc(teachers.name), asc(subjects.name));

  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { teacherId, subjectId, classId, sessionId, schoolId } = await req.json();
  const sId = schoolId || session.schoolId;

  const id = uuidv4();
  try {
    // Check if a primary teacher is already assigned to this class (subject-less)
    if (!subjectId) {
      const existingResult = await db.select({ id: teacherAssignments.id }).from(teacherAssignments).where(
        and(
          eq(teacherAssignments.teacher_id, teacherId),
          eq(teacherAssignments.class_id, classId),
          eq(teacherAssignments.session_id, sessionId),
          isNull(teacherAssignments.subject_id)
        )
      ).limit(1);

      if (existingResult.length > 0) return NextResponse.json({ error: 'Teacher is already assigned to this class' }, { status: 409 });
    }

    await db.insert(teacherAssignments).values({
      id,
      school_id: sId || '',
      teacher_id: teacherId,
      subject_id: subjectId || null,
      class_id: classId,
      session_id: sessionId
    });

    const newResult = await db.select().from(teacherAssignments).where(eq(teacherAssignments.id, id)).limit(1);
    return NextResponse.json(newResult[0], { status: 201 });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE') || e.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'Assignment already exists' }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await req.json();
  await db.delete(teacherAssignments).where(eq(teacherAssignments.id, id));
  return NextResponse.json({ success: true });
}
