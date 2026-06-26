import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { classSubjects, subjects } from '@/lib/schema';
import { eq, and, asc, getTableColumns } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const schoolId = searchParams.get('schoolId') || session.schoolId;

  if (!classId) return NextResponse.json({ error: 'classId required' }, { status: 400 });

  const results = await db.select({
    ...getTableColumns(classSubjects),
    subject_name: subjects.name,
    subject_code: subjects.code,
    category: subjects.category
  })
    .from(classSubjects)
    .innerJoin(subjects, eq(subjects.id, classSubjects.subject_id))
    .where(and(eq(classSubjects.class_id, classId), eq(classSubjects.school_id, schoolId || '')))
    .orderBy(asc(subjects.name));

  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { classId, subjectIds, schoolId } = await req.json();
  const sId = schoolId || session.schoolId;

  await db.transaction(async (tx) => {
    await tx.delete(classSubjects).where(and(eq(classSubjects.class_id, classId), eq(classSubjects.school_id, sId || '')));

    if (subjectIds.length > 0) {
      const values = subjectIds.map((subjectId: string) => ({
        id: uuidv4(),
        class_id: classId,
        subject_id: subjectId,
        school_id: sId || ''
      }));
      await tx.insert(classSubjects).values(values);
    }
  });

  return NextResponse.json({ success: true });
}
