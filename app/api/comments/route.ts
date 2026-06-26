import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { teacherComments } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');
  const sessionId = searchParams.get('sessionId');
  const term = searchParams.get('term');
  const schoolId = searchParams.get('schoolId') || session.schoolId;

  const filters = [eq(teacherComments.school_id, schoolId || '')];
  if (studentId) filters.push(eq(teacherComments.student_id, studentId));
  if (sessionId) filters.push(eq(teacherComments.session_id, sessionId));
  if (term) filters.push(eq(teacherComments.term, parseInt(term)));

  const results = await db.select().from(teacherComments).where(and(...filters));
  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { studentId, sessionId, term, class_teacher_comment, class_teacher_date, class_teacher_signature,
    coordinator_remark, coordinator_date, coordinator_signature, next_term_starts, schoolId } = body;
  const sId = schoolId || session.schoolId;
  const isTeacher = session.role === 'teacher';

  const existingResult = await db.select({ id: teacherComments.id }).from(teacherComments).where(
    and(
      eq(teacherComments.student_id, studentId),
      eq(teacherComments.session_id, sessionId),
      eq(teacherComments.term, term)
    )
  ).limit(1);
  const existing = existingResult[0];

  if (existing) {
    const updateData: any = {
      class_teacher_comment,
      class_teacher_date,
      class_teacher_signature,
      next_term_starts
    };

    if (!isTeacher) {
      updateData.coordinator_remark = coordinator_remark;
      updateData.coordinator_date = coordinator_date;
      updateData.coordinator_signature = coordinator_signature;
    }

    await db.update(teacherComments).set(updateData).where(eq(teacherComments.id, existing.id));

    const updated = await db.select().from(teacherComments).where(eq(teacherComments.id, existing.id)).limit(1);
    return NextResponse.json(updated[0]);
  } else {
    const id = uuidv4();
    await db.insert(teacherComments).values({
      id,
      school_id: sId || '',
      student_id: studentId,
      session_id: sessionId,
      term,
      class_teacher_comment,
      class_teacher_date,
      class_teacher_signature,
      coordinator_remark: isTeacher ? null : coordinator_remark,
      coordinator_date: isTeacher ? null : coordinator_date,
      coordinator_signature: isTeacher ? null : coordinator_signature,
      next_term_starts
    });

    const created = await db.select().from(teacherComments).where(eq(teacherComments.id, id)).limit(1);
    return NextResponse.json(created[0], { status: 201 });
  }
}
