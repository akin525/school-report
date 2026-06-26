import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { sessions } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
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
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, start_year, end_year, is_current, schoolId } = await req.json();
  const sId = schoolId || session.schoolId;

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

  const newSession = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return NextResponse.json(newSession[0], { status: 201 });
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
