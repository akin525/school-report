import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { subjects, students, classSubjects } from '@/lib/schema';
import { eq, and, asc, ne, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const schoolId = searchParams.get('schoolId') || session.schoolId;
  const category = searchParams.get('category') as 'nursery' | 'primary' | 'secondary' | null;
  const classId = searchParams.get('classId');

  // Security check: Students should only see subjects for their own class
  if (session.role === 'student') {
    const studentResult = await db.select({ class_id: students.class_id }).from(students).where(eq(students.user_id, session.userId)).limit(1);
    const student = studentResult[0];
    if (!student?.class_id) return NextResponse.json([]);

    const results = await db.select({
      id: subjects.id,
      school_id: subjects.school_id,
      name: subjects.name,
      code: subjects.code,
      category: subjects.category,
      created_at: subjects.created_at
    })
      .from(subjects)
      .innerJoin(classSubjects, eq(classSubjects.subject_id, subjects.id))
      .where(and(eq(classSubjects.class_id, student.class_id), eq(subjects.school_id, schoolId || '')))
      .orderBy(asc(subjects.name));

    return NextResponse.json(results);
  }

  if (classId) {
    const results = await db.select({
      id: subjects.id,
      school_id: subjects.school_id,
      name: subjects.name,
      code: subjects.code,
      category: subjects.category,
      created_at: subjects.created_at
    })
      .from(subjects)
      .innerJoin(classSubjects, eq(classSubjects.subject_id, subjects.id))
      .where(and(eq(classSubjects.class_id, classId), eq(subjects.school_id, schoolId || '')))
      .orderBy(asc(subjects.name));

    return NextResponse.json(results);
  }

  const filters = [eq(subjects.school_id, schoolId || '')];
  if (category) filters.push(eq(subjects.category, category));

  const results = await db.select().from(subjects)
    .where(and(...filters))
    .orderBy(asc(subjects.category), asc(subjects.name));

  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { name, code, category, schoolId } = await req.json();
    const sId = schoolId || session.schoolId;

    // Check for existing subject with same name and category
    const existingResult = await db.select({ id: subjects.id }).from(subjects).where(
      and(
        eq(subjects.school_id, sId || ''),
        eq(subjects.name, name),
        eq(subjects.category, category || 'secondary')
      )
    ).limit(1);
    
    if (existingResult.length > 0) {
      return NextResponse.json({ error: `Subject "${name}" already exists in this category` }, { status: 400 });
    }

    const id = uuidv4();
    await db.insert(subjects).values({
      id,
      school_id: sId,
      name,
      code: code || '',
      category: category || 'secondary'
    });

    const newSubject = await db.select().from(subjects).where(eq(subjects.id, id)).limit(1);
    return NextResponse.json(newSubject[0], { status: 201 });
  } catch (error: any) {
    console.error('SUBJECT_POST_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, name, code, category } = await req.json();

    // Check for existing subject with same name and category (excluding self)
    const currentSubjectResult = await db.select({ school_id: subjects.school_id }).from(subjects).where(eq(subjects.id, id)).limit(1);
    const currentSubject = currentSubjectResult[0];

    if (!currentSubject) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });

    const existingResult = await db.select({ id: subjects.id }).from(subjects).where(
      and(
        eq(subjects.name, name),
        eq(subjects.category, category),
        ne(subjects.id, id),
        eq(subjects.school_id, currentSubject.school_id)
      )
    ).limit(1);
    
    if (existingResult.length > 0) {
      return NextResponse.json({ error: `Subject "${name}" already exists in this category` }, { status: 400 });
    }

    await db.update(subjects).set({
      name,
      code,
      category,
      // updated_at is handled by default in schema if we had it, but subjects doesn't have it in schema.ts yet
    }).where(eq(subjects.id, id));

    const updatedSubject = await db.select().from(subjects).where(eq(subjects.id, id)).limit(1);
    return NextResponse.json(updatedSubject[0]);
  } catch (error: any) {
    console.error('SUBJECT_PUT_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await req.json();
  await db.delete(subjects).where(eq(subjects.id, id));
  return NextResponse.json({ success: true });
}
