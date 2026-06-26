import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { exams, subjects, classes, examSubmissions, students } from '@/lib/schema';
import { eq, and, desc, getTableColumns } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'student') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('examId');

    if (!examId) return NextResponse.json({ error: 'examId required' }, { status: 400 });

    const examResult = await db.select({
      ...getTableColumns(exams),
      subject_name: subjects.name,
      class_name: classes.name
    })
      .from(exams)
      .innerJoin(subjects, eq(subjects.id, exams.subject_id))
      .innerJoin(classes, eq(classes.id, exams.class_id))
      .where(eq(exams.id, examId))
      .limit(1);

    const submissions = await db.select({
      ...getTableColumns(examSubmissions),
      first_name: students.first_name,
      last_name: students.last_name,
      admission_number: students.admission_number
    })
      .from(examSubmissions)
      .innerJoin(students, eq(students.id, examSubmissions.student_id))
      .where(eq(examSubmissions.exam_id, examId))
      .orderBy(desc(examSubmissions.submitted_at));

    return NextResponse.json({ exam: examResult[0], submissions });
  } catch (error: any) {
    console.error('EXAM_RESULTS_GET_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

