import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { gradingSystem } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const schoolId = searchParams.get('schoolId');

  if (!schoolId) return NextResponse.json({ error: 'School ID required' }, { status: 400 });

  const results = await db.select().from(gradingSystem)
    .where(eq(gradingSystem.school_id, schoolId))
    .orderBy(desc(gradingSystem.min_score));

  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { school_id, grade, min_score, max_score, remark, color } = await req.json();
  const id = uuidv4();

  await db.insert(gradingSystem).values({
    id,
    school_id,
    grade,
    min_score,
    max_score,
    remark,
    color
  });

  return NextResponse.json({ success: true, id });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, grade, min_score, max_score, remark, color } = await req.json();

  await db.update(gradingSystem).set({
    grade,
    min_score,
    max_score,
    remark,
    color
  }).where(eq(gradingSystem.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await req.json();

  await db.delete(gradingSystem).where(eq(gradingSystem.id, id));
  return NextResponse.json({ success: true });
}

