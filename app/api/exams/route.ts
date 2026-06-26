import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { exams, subjects, classes, users, students, examSubmissions } from '@/lib/schema';
import { eq, and, desc, getTableColumns, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('schoolId') || session.schoolId;
    const classId = searchParams.get('classId');

    const submissionCountSubquery = db.select({
      exam_id: examSubmissions.exam_id,
      count: sql`COUNT(*)`.as('count')
    }).from(examSubmissions).groupBy(examSubmissions.exam_id).as('sc');

    const filters = [eq(exams.school_id, schoolId || '')];

    let studentIdForScore: string | undefined;

    if (session.role === 'student') {
      const studentResult = await db.select({ class_id: students.class_id, id: students.id }).from(students).where(eq(students.user_id, session.userId)).limit(1);
      const student = studentResult[0];
      if (student) {
        filters.push(eq(exams.class_id, student.class_id || ''));
        studentIdForScore = student.id;
      }
    } else if (classId) {
      filters.push(eq(exams.class_id, classId));
    }

    const studentScoreSubquery = studentIdForScore ?
      db.select({
        exam_id: examSubmissions.exam_id,
        score: examSubmissions.score
      }).from(examSubmissions).where(eq(examSubmissions.student_id, studentIdForScore)).as('ss') : null;

    let query = db.select({
      ...getTableColumns(exams),
      subject_name: subjects.name,
      class_name: classes.name,
      creator_name: users.name,
      submission_count: sql`COALESCE(${submissionCountSubquery.count}, 0)`,
      ...(studentScoreSubquery ? { student_score: studentScoreSubquery.score } : {})
    })
      .from(exams)
      .innerJoin(subjects, eq(subjects.id, exams.subject_id))
      .innerJoin(classes, eq(classes.id, exams.class_id))
      .innerJoin(users, eq(users.id, exams.created_by))
      .leftJoin(submissionCountSubquery, eq(submissionCountSubquery.exam_id, exams.id));

    if (studentScoreSubquery) {
      query = query.leftJoin(studentScoreSubquery, eq(studentScoreSubquery.exam_id, exams.id)) as any;
    }

    const results = await query.where(and(...filters)).orderBy(desc(exams.start_time));
    return NextResponse.json(results);
  } catch (error: any) {
    console.error('EXAMS_GET_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { title, subject_id, class_id, session_id, term, start_time, end_time, duration_minutes, total_marks, schoolId } = await req.json();
    const sId = schoolId || session.schoolId;

    if (!title || !subject_id || !class_id || !start_time || !end_time || !duration_minutes) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const id = uuidv4();
    await db.insert(exams).values({
      id,
      school_id: sId || '',
      title,
      subject_id,
      class_id,
      session_id,
      term,
      start_time: new Date(start_time),
      end_time: new Date(end_time),
      duration_minutes,
      total_marks: total_marks || 100,
      created_by: session.userId
    });

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('EXAMS_POST_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

