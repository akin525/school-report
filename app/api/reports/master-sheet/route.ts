import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { sessions, classes, subjects, students, scores } from '@/lib/schema';
import { eq, and, asc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const sessionId = searchParams.get('sessionId');
  const subjectId = searchParams.get('subjectId');
  const term = parseInt(searchParams.get('term') || '1');
  const schoolId = session.schoolId;

  if (!classId || !sessionId || !subjectId) {
    return NextResponse.json({ error: 'classId, sessionId, and subjectId are required' }, { status: 400 });
  }

  // Get session info
  const academicSessionResult = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  const academicSession = academicSessionResult[0];
  
  // Get class info
  const classInfoResult = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);
  const classInfo = classInfoResult[0];
  
  // Get subject info
  const subjectInfoResult = await db.select().from(subjects).where(eq(subjects.id, subjectId)).limit(1);
  const subjectInfo = subjectInfoResult[0];

  // Get all students in the class
  const classStudents = await db.select({
    id: students.id,
    first_name: students.first_name,
    middle_name: students.middle_name,
    last_name: students.last_name,
    admission_number: students.admission_number
  })
    .from(students)
    .where(and(eq(students.class_id, classId), eq(students.school_id, schoolId || '')))
    .orderBy(asc(students.last_name), asc(students.first_name));

  // Get scores for the specific subject, class, and term
  const subjectScores = await db.select().from(scores).where(
    and(
      eq(scores.class_id, classId),
      eq(scores.session_id, sessionId),
      eq(scores.subject_id, subjectId),
      eq(scores.term, term),
      eq(scores.school_id, schoolId || '')
    )
  );

  return NextResponse.json({
    session: academicSession,
    class: classInfo,
    subject: subjectInfo,
    students: classStudents,
    scores: subjectScores,
    term
  });
}

