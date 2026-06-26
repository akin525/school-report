import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { attendance } from '@/lib/schema';
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

  const filters = [eq(attendance.school_id, schoolId || '')];
  if (studentId) filters.push(eq(attendance.student_id, studentId));
  if (sessionId) filters.push(eq(attendance.session_id, sessionId));
  if (term) filters.push(eq(attendance.term, parseInt(term)));

  const results = await db.select().from(attendance).where(and(...filters));
  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { studentId, sessionId, term, times_school_opened, times_present, schoolId } = body;
  const sId = schoolId || session.schoolId;

  const existingResult = await db.select({ id: attendance.id }).from(attendance).where(
    and(
      eq(attendance.student_id, studentId),
      eq(attendance.session_id, sessionId),
      eq(attendance.term, term)
    )
  ).limit(1);
  const existing = existingResult[0];

  if (existing) {
    await db.update(attendance).set({
      times_school_opened: times_school_opened ?? 0,
      times_present: times_present ?? 0
    }).where(eq(attendance.id, existing.id));

    const updated = await db.select().from(attendance).where(eq(attendance.id, existing.id)).limit(1);
    return NextResponse.json(updated[0]);
  } else {
    const id = uuidv4();
    await db.insert(attendance).values({
      id,
      school_id: sId || '',
      student_id: studentId,
      session_id: sessionId,
      term,
      times_school_opened: times_school_opened ?? 0,
      times_present: times_present ?? 0
    });

    const created = await db.select().from(attendance).where(eq(attendance.id, id)).limit(1);
    return NextResponse.json(created[0], { status: 201 });
  }
}
