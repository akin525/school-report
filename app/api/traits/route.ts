import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { affectiveTraits } from '@/lib/schema';
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

  const filters = [eq(affectiveTraits.school_id, schoolId || '')];
  if (studentId) filters.push(eq(affectiveTraits.student_id, studentId));
  if (sessionId) filters.push(eq(affectiveTraits.session_id, sessionId));
  if (term) filters.push(eq(affectiveTraits.term, parseInt(term)));

  const results = await db.select().from(affectiveTraits).where(and(...filters));
  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { studentId, sessionId, term, homework, punctuality, interaction, leadership, politeness, conduct, schoolId } = body;
  const sId = schoolId || session.schoolId;

  const existingResult = await db.select({ id: affectiveTraits.id }).from(affectiveTraits).where(
    and(
      eq(affectiveTraits.student_id, studentId),
      eq(affectiveTraits.session_id, sessionId),
      eq(affectiveTraits.term, term)
    )
  ).limit(1);
  const existing = existingResult[0];

  if (existing) {
    await db.update(affectiveTraits).set({
      homework,
      punctuality,
      interaction,
      leadership,
      politeness,
      conduct
    }).where(eq(affectiveTraits.id, existing.id));

    const updated = await db.select().from(affectiveTraits).where(eq(affectiveTraits.id, existing.id)).limit(1);
    return NextResponse.json(updated[0]);
  } else {
    const id = uuidv4();
    await db.insert(affectiveTraits).values({
      id,
      school_id: sId || '',
      student_id: studentId,
      session_id: sessionId,
      term,
      homework,
      punctuality,
      interaction,
      leadership,
      politeness,
      conduct
    });

    const created = await db.select().from(affectiveTraits).where(eq(affectiveTraits.id, id)).limit(1);
    return NextResponse.json(created[0], { status: 201 });
  }
}
