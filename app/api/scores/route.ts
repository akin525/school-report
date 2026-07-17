import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { scores, subjects, students } from '@/lib/schema';
import { eq, and, asc, getTableColumns, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const schoolId = searchParams.get('schoolId') || session.schoolId;
  let studentId = searchParams.get('studentId');
  const classId = searchParams.get('classId');
  const sessionId = searchParams.get('sessionId');
  const term = searchParams.get('term');
  const subjectId = searchParams.get('subjectId');

  // Security check: Students can only see their own scores
  if (session.role === 'student') {
    const studentResult = await db.select({ id: students.id }).from(students).where(eq(students.user_id, session.userId)).limit(1);
    const student = studentResult[0];
    if (!student) return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    studentId = student.id;
  }

  const filters = [eq(scores.school_id, schoolId || '')];
  if (studentId) filters.push(eq(scores.student_id, studentId));
  if (classId) filters.push(eq(scores.class_id, classId));
  if (sessionId) filters.push(eq(scores.session_id, sessionId));
  if (term) filters.push(eq(scores.term, parseInt(term)));
  if (subjectId) filters.push(eq(scores.subject_id, subjectId));

  const results = await db.select({
    ...getTableColumns(scores),
    subject_name: subjects.name,
    first_name: students.first_name,
    last_name: students.last_name,
    admission_number: students.admission_number
  })
    .from(scores)
    .innerJoin(subjects, eq(subjects.id, scores.subject_id))
    .innerJoin(students, eq(students.id, scores.student_id))
    .where(and(...filters))
    .orderBy(asc(students.last_name), asc(students.first_name), asc(subjects.name));

  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { studentId, subjectId, classId, sessionId, term, ca1_score, ca2_score, exam_score, schoolId,
    t1, t2, t3, t4, t5, t6, t7, t8, t9, t10 } = body;
  const sId = schoolId || session.schoolId;

  // Upsert logic
  const existingResult = await db.select({ id: scores.id }).from(scores).where(
    and(
      eq(scores.student_id, studentId),
      eq(scores.subject_id, subjectId),
      eq(scores.session_id, sessionId),
      eq(scores.term, term)
    )
  ).limit(1);
  const existing = existingResult[0];

  const scoreData = {
    ca1_score: ca1_score ?? 0,
    ca2_score: ca2_score ?? 0,
    exam_score: exam_score ?? 0,
    t1: (t1 === '' || t1 === undefined) ? null : t1,
    t2: (t2 === '' || t2 === undefined) ? null : t2,
    t3: (t3 === '' || t3 === undefined) ? null : t3,
    t4: (t4 === '' || t4 === undefined) ? null : t4,
    t5: (t5 === '' || t5 === undefined) ? null : t5,
    t6: (t6 === '' || t6 === undefined) ? null : t6,
    t7: (t7 === '' || t7 === undefined) ? null : t7,
    t8: (t8 === '' || t8 === undefined) ? null : t8,
    t9: (t9 === '' || t9 === undefined) ? null : t9,
    t10: (t10 === '' || t10 === undefined) ? null : t10,
    total: (ca1_score ?? 0) + (ca2_score ?? 0) + (exam_score ?? 0) +
           ([t1, t2, t3, t4, t5, t6, t7, t8, t9, t10].map(v => v ? Number(v) : 0).reduce((a, b) => a + b, 0)),
    updated_at: new Date()
  };

  if (existing) {
    await db.update(scores).set(scoreData).where(eq(scores.id, existing.id));
    const updated = await db.select().from(scores).where(eq(scores.id, existing.id)).limit(1);
    return NextResponse.json(updated[0]);
  } else {
    const id = uuidv4();
    await db.insert(scores).values({
      id,
      school_id: sId,
      student_id: studentId,
      subject_id: subjectId,
      class_id: classId,
      session_id: sessionId,
      term,
      ...scoreData
    });
    const created = await db.select().from(scores).where(eq(scores.id, id)).limit(1);
    return NextResponse.json(created[0], { status: 201 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { scores: scoreList, schoolId } = await req.json(); // bulk update
  const sId = schoolId || session.schoolId;

  await db.transaction(async (tx) => {
    for (const sc of scoreList) {
      const existingResult = await tx.select({ id: scores.id }).from(scores).where(
        and(
          eq(scores.student_id, sc.studentId),
          eq(scores.subject_id, sc.subjectId),
          eq(scores.session_id, sc.sessionId),
          eq(scores.term, sc.term)
        )
      ).limit(1);
      const existing = existingResult[0];

      const scoreData = {
        ca1_score: sc.ca1_score ?? 0,
        ca2_score: sc.ca2_score ?? 0,
        exam_score: sc.exam_score ?? 0,
        t1: (sc.t1 === '' || sc.t1 === undefined) ? null : sc.t1,
        t2: (sc.t2 === '' || sc.t2 === undefined) ? null : sc.t2,
        t3: (sc.t3 === '' || sc.t3 === undefined) ? null : sc.t3,
        t4: (sc.t4 === '' || sc.t4 === undefined) ? null : sc.t4,
        t5: (sc.t5 === '' || sc.t5 === undefined) ? null : sc.t5,
        t6: (sc.t6 === '' || sc.t6 === undefined) ? null : sc.t6,
        t7: (sc.t7 === '' || sc.t7 === undefined) ? null : sc.t7,
        t8: (sc.t8 === '' || sc.t8 === undefined) ? null : sc.t8,
        t9: (sc.t9 === '' || sc.t9 === undefined) ? null : sc.t9,
        t10: (sc.t10 === '' || sc.t10 === undefined) ? null : sc.t10,
        total: (sc.ca1_score ?? 0) + (sc.ca2_score ?? 0) + (sc.exam_score ?? 0) +
               ([sc.t1, sc.t2, sc.t3, sc.t4, sc.t5, sc.t6, sc.t7, sc.t8, sc.t9, sc.t10].map(v => v ? Number(v) : 0).reduce((a, b) => a + b, 0)),
        updated_at: new Date()
      };

      if (existing) {
        await tx.update(scores).set(scoreData).where(eq(scores.id, existing.id));
      } else {
        await tx.insert(scores).values({
          id: uuidv4(),
          school_id: sId,
          student_id: sc.studentId,
          subject_id: sc.subjectId,
          class_id: sc.classId,
          session_id: sc.sessionId,
          term: sc.term,
          ...scoreData
        });
      }
    }
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.role !== 'school_admin' && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');
  const classId = searchParams.get('classId');
  const sessionId = searchParams.get('sessionId');
  const termParam = searchParams.get('term');
  const subjectId = searchParams.get('subjectId');
  const schoolId = searchParams.get('schoolId') || session.schoolId;

  if (!studentId || !classId || !sessionId || !termParam) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  const term = parseInt(termParam);
  const filters = [
    eq(scores.school_id, schoolId || ''),
    eq(scores.student_id, studentId),
    eq(scores.class_id, classId),
    eq(scores.session_id, sessionId),
    eq(scores.term, term)
  ];

  if (subjectId) {
    filters.push(eq(scores.subject_id, subjectId));
  }

  const result = await db.delete(scores).where(and(...filters));

  return NextResponse.json({
    success: true,
    message: `Deleted score record(s).`
  });
}

