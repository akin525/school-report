import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { teachers, teacherAssignments, students, teacherComments, scores } from '@/lib/schema';
import { eq, and, isNull, inArray, asc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const sessionId = searchParams.get('sessionId');
  const term = parseInt(searchParams.get('term') || '1');
  const schoolId = session.schoolId;

  if (!classId || !sessionId) {
    return NextResponse.json({ error: 'classId and sessionId required' }, { status: 400 });
  }

  // If user is a teacher, check if they are the assigned Class Teacher for this class
  if (session.role === 'teacher') {
    const teacherResult = await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.user_id, session.userId)).limit(1);
    const teacher = teacherResult[0];
    if (!teacher) return NextResponse.json({ error: 'Teacher profile not found' }, { status: 404 });

    const assignmentResult = await db.select({ id: teacherAssignments.id }).from(teacherAssignments).where(
      and(
        eq(teacherAssignments.teacher_id, teacher.id),
        eq(teacherAssignments.class_id, classId),
        eq(teacherAssignments.session_id, sessionId),
        isNull(teacherAssignments.subject_id)
      )
    ).limit(1);

    if (assignmentResult.length === 0) {
      return NextResponse.json({ error: 'You are not assigned as the Class Teacher for this class' }, { status: 403 });
    }
  }

  // Get all students currently in the class
  const currentStudents = await db.select({
    id: students.id,
    first_name: students.first_name,
    middle_name: students.middle_name,
    last_name: students.last_name,
    admission_number: students.admission_number
  })
    .from(students)
    .where(and(eq(students.class_id, classId), eq(students.school_id, schoolId || '')));

  // Get all students who had scores or comments in this class/session
  const historicalStudents = await db.selectDistinct({
    id: students.id,
    first_name: students.first_name,
    middle_name: students.middle_name,
    last_name: students.last_name,
    admission_number: students.admission_number
  })
    .from(scores)
    .innerJoin(students, eq(students.id, scores.student_id))
    .where(and(
      eq(scores.class_id, classId),
      eq(scores.session_id, sessionId),
      eq(scores.school_id, schoolId || '')
    ));

  // Merge and deduplicate
  const studentMap = new Map();
  [...currentStudents, ...historicalStudents].forEach(s => studentMap.set(s.id, s));
  const classStudents = Array.from(studentMap.values()).sort((a, b) => {
    const fn = (a.first_name || '').localeCompare(b.first_name || '');
    if (fn !== 0) return fn;
    return (a.last_name || '').localeCompare(b.last_name || '');
  });

  if (classStudents.length === 0) {
    return NextResponse.json({ students: [], comments: [] });
  }

  // Get existing comments for these students
  const studentIds = classStudents.map(s => s.id);
  const comments = await db.select().from(teacherComments).where(
    and(
      inArray(teacherComments.student_id, studentIds),
      eq(teacherComments.session_id, sessionId),
      eq(teacherComments.term, term),
      eq(teacherComments.school_id, schoolId || '')
    )
  );

  return NextResponse.json({ students: classStudents, comments });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { classId, sessionId, term, settings, individualComments } = body;
  const schoolId = session.schoolId;

  if (!classId || !sessionId || !term) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // If user is a teacher, check if they are the assigned Class Teacher for this class
  if (session.role === 'teacher') {
    const teacherResult = await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.user_id, session.userId)).limit(1);
    const teacher = teacherResult[0];
    if (!teacher) return NextResponse.json({ error: 'Teacher profile not found' }, { status: 404 });

    const assignmentResult = await db.select({ id: teacherAssignments.id }).from(teacherAssignments).where(
      and(
        eq(teacherAssignments.teacher_id, teacher.id),
        eq(teacherAssignments.class_id, classId),
        eq(teacherAssignments.session_id, sessionId),
        isNull(teacherAssignments.subject_id)
      )
    ).limit(1);

    if (assignmentResult.length === 0) {
      return NextResponse.json({ error: 'You are not assigned as the Class Teacher for this class' }, { status: 403 });
    }
  }

  try {
    await db.transaction(async (tx) => {
      // 1. Batch Update Class Settings (Date, Signature, Next Term Starts)
      if (settings) {
        const { date, signature, nextTermStarts, coordinatorRemark, coordinatorSignature, coordinatorDate } = settings;
        const isTeacher = session.role === 'teacher';
        
        // Get all students who were in this class during this session
        const currentInClass = await tx.select({ id: students.id }).from(students).where(
          and(eq(students.class_id, classId), eq(students.school_id, schoolId || ''))
        );
        const hadScoresInClass = await tx.selectDistinct({ id: students.id })
          .from(scores)
          .innerJoin(students, eq(students.id, scores.student_id))
          .where(and(
            eq(scores.class_id, classId),
            eq(scores.session_id, sessionId),
            eq(scores.school_id, schoolId || '')
          ));

        const studentMap = new Map();
        [...currentInClass, ...hadScoresInClass].forEach(s => studentMap.set(s.id, s));
        const classStudents = Array.from(studentMap.values());

        for (const student of classStudents) {
          const existingResult = await tx.select({ id: teacherComments.id }).from(teacherComments).where(
            and(
              eq(teacherComments.student_id, student.id),
              eq(teacherComments.session_id, sessionId),
              eq(teacherComments.term, term),
              eq(teacherComments.school_id, schoolId || '')
            )
          ).limit(1);
          const existing = existingResult[0];

          if (existing) {
            const updateData: any = {
              class_teacher_date: date,
              class_teacher_signature: signature,
              next_term_starts: nextTermStarts
            };

            if (!isTeacher) {
              updateData.coordinator_remark = coordinatorRemark;
              updateData.coordinator_signature = coordinatorSignature;
              updateData.coordinator_date = coordinatorDate;
            }

            await tx.update(teacherComments).set(updateData).where(eq(teacherComments.id, existing.id));
          } else {
            await tx.insert(teacherComments).values({
              id: uuidv4(),
              school_id: schoolId || '',
              student_id: student.id,
              session_id: sessionId,
              term,
              class_teacher_date: date,
              class_teacher_signature: signature,
              next_term_starts: nextTermStarts,
              coordinator_remark: isTeacher ? null : coordinatorRemark,
              coordinator_signature: isTeacher ? null : coordinatorSignature,
              coordinator_date: isTeacher ? null : coordinatorDate
            });
          }
        }
      }

      // 2. Individual Comments Update
      if (individualComments && Array.isArray(individualComments)) {
        const isTeacher = session.role === 'teacher';
        for (const item of individualComments) {
          const { studentId, comment, coordinatorRemark } = item;
          
          const existingResult = await tx.select({ id: teacherComments.id }).from(teacherComments).where(
            and(
              eq(teacherComments.student_id, studentId),
              eq(teacherComments.session_id, sessionId),
              eq(teacherComments.term, term),
              eq(teacherComments.school_id, schoolId || '')
            )
          ).limit(1);
          const existing = existingResult[0];

          if (existing) {
            const updateData: any = {
              class_teacher_comment: comment
            };

            if (!isTeacher) {
              updateData.coordinator_remark = coordinatorRemark || null; // Simplified logic compared to original's COALESCE
            }

            await tx.update(teacherComments).set(updateData).where(eq(teacherComments.id, existing.id));
          } else {
            await tx.insert(teacherComments).values({
              id: uuidv4(),
              school_id: schoolId || '',
              student_id: studentId,
              session_id: sessionId,
              term,
              class_teacher_comment: comment,
              coordinator_remark: isTeacher ? null : (coordinatorRemark || null)
            });
          }
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Comments update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

