import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { sessions, students, classes } from '@/lib/schema';
import { eq, desc, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const schoolId = searchParams.get('schoolId') || session.schoolId;

  const results = await db.select().from(sessions)
    .where(eq(sessions.school_id, schoolId || ''))
    .orderBy(desc(sessions.start_year));

  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { name, start_year, end_year, is_current, schoolId, promote_students } = body;
    const sId = schoolId || session.schoolId;

    // 1. Validation: New session must not be lower than previous
    const existingSessions = await db.select().from(sessions)
      .where(eq(sessions.school_id, sId || ''))
      .orderBy(desc(sessions.start_year))
      .limit(1);
    
    if (existingSessions.length > 0 && start_year <= existingSessions[0].start_year) {
      return NextResponse.json({ 
        error: `New session start year (${start_year}) must be greater than previous session (${existingSessions[0].start_year})` 
      }, { status: 400 });
    }

    if (is_current) {
      await db.update(sessions).set({ is_current: 0 }).where(eq(sessions.school_id, sId || ''));
    }

    const id = uuidv4();
    await db.insert(sessions).values({
      id,
      school_id: sId,
      name,
      start_year,
      end_year,
      is_current: is_current ? 1 : 0
    });

    // 2. Automatic Student Promotion
    if (promote_students) {
      const allStudents = await db.select().from(students)
        .where(and(eq(students.school_id, sId || ''), eq(students.status, 'active')));
      
      const allClasses = await db.select().from(classes)
        .where(eq(classes.school_id, sId || ''));

      for (const student of allStudents) {
        if (!student.class_id) continue;
        
        const currentClass = allClasses.find(c => c.id === student.class_id);
        if (!currentClass) continue;

        // Simple promotion logic: increment number in class name
        const match = currentClass.name.match(/(.*?\s*)(\d+)/);
        if (match) {
          const prefix = match[1];
          const num = parseInt(match[2]);
          const nextClassName = prefix + (num + 1);
          
          const nextClass = allClasses.find(c => 
            c.name.toLowerCase() === nextClassName.toLowerCase() && 
            c.arm === currentClass.arm
          );

          if (nextClass) {
            await db.update(students).set({ class_id: nextClass.id }).where(eq(students.id, student.id));
          } else {
            // Graduating logic
            if (currentClass.name.includes('3') && currentClass.category === 'secondary') {
               await db.update(students).set({ status: 'graduated' }).where(eq(students.id, student.id));
            }
          }
        }
      }
    }

    const newSession = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return NextResponse.json(newSession[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, name, start_year, end_year, is_current } = await req.json();

  const existingResult = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  const existing = existingResult[0];
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (is_current) {
    await db.update(sessions).set({ is_current: 0 }).where(eq(sessions.school_id, existing.school_id));
  }

  await db.update(sessions).set({
    name,
    start_year,
    end_year,
    is_current: is_current ? 1 : 0
  }).where(eq(sessions.id, id));

  const updatedSession = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return NextResponse.json(updatedSession[0]);
}
