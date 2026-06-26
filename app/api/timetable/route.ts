import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { timetable, subjects, teachers } from '@/lib/schema';
import { eq, and, asc, getTableColumns } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('classId');

    if (!classId) return NextResponse.json({ error: 'classId required' }, { status: 400 });

    const results = await db.select({
      ...getTableColumns(timetable),
      subject_name: subjects.name,
      teacher_name: teachers.name
    })
      .from(timetable)
      .innerJoin(subjects, eq(subjects.id, timetable.subject_id))
      .leftJoin(teachers, eq(teachers.id, timetable.teacher_id))
      .where(eq(timetable.class_id, classId))
      .orderBy(asc(timetable.day_of_week), asc(timetable.start_time));

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('TIMETABLE_GET_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { class_id, day_of_week, start_time, end_time, subject_id, teacher_id, schoolId } = await req.json();
    const sId = schoolId || session.schoolId;

    if (!class_id || !day_of_week || !start_time || !end_time || !subject_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const id = uuidv4();
    await db.insert(timetable).values({
      id,
      school_id: sId || '',
      class_id,
      day_of_week,
      start_time,
      end_time,
      subject_id,
      teacher_id: teacher_id || null
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('TIMETABLE_POST_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await db.delete(timetable).where(eq(timetable.id, id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('TIMETABLE_DELETE_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

