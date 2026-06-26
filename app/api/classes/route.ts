import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { classes, students } from '@/lib/schema';
import { eq, and, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const schoolId = searchParams.get('schoolId') || session.schoolId;
  const category = searchParams.get('category') as 'nursery' | 'primary' | 'secondary' | null;

  // Security check: Students should only see their own class
  if (session.role === 'student') {
    const studentResult = await db.select({ class_id: students.class_id }).from(students).where(eq(students.user_id, session.userId)).limit(1);
    const student = studentResult[0];
    if (!student?.class_id) return NextResponse.json([]);

    const myClassResult = await db.select().from(classes).where(eq(classes.id, student.class_id)).limit(1);
    const myClass = myClassResult[0];
    return NextResponse.json(myClass ? [myClass] : []);
  }

  let baseQuery = db.select().from(classes).where(eq(classes.school_id, schoolId || ''));

  if (category) {
    const results = await db.select().from(classes).where(
      and(
        eq(classes.school_id, schoolId || ''),
        eq(classes.category, category)
      )
    ).orderBy(asc(classes.category), asc(classes.name));
    return NextResponse.json(results);
  }

  const allCategoryClasses = await db.select().from(classes)
    .where(eq(classes.school_id, schoolId || ''))
    .orderBy(asc(classes.category), asc(classes.name));

  return NextResponse.json(allCategoryClasses);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, arm, level, category, schoolId } = await req.json();
  const sId = schoolId || session.schoolId;
  if (!sId) return NextResponse.json({ error: 'School ID required' }, { status: 400 });

  const id = uuidv4();
  await db.insert(classes).values({
    id,
    school_id: sId,
    name,
    arm: arm || '',
    level: level || name,
    category: category || 'secondary'
  });

  const newClass = await db.select().from(classes).where(eq(classes.id, id)).limit(1);
  return NextResponse.json(newClass[0], { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, name, arm, level, category } = await req.json();
  await db.update(classes).set({
    name,
    arm,
    level,
    category
  }).where(eq(classes.id, id));

  const updatedClass = await db.select().from(classes).where(eq(classes.id, id)).limit(1);
  return NextResponse.json(updatedClass[0]);
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await req.json();
  await db.delete(classes).where(eq(classes.id, id));
  return NextResponse.json({ success: true });
}
