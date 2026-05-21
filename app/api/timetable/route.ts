import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('classId');

    if (!classId) return NextResponse.json({ error: 'classId required' }, { status: 400 });

    const db = getDb();
    const timetable = db.prepare(`
      SELECT t.*, s.name as subject_name, tch.name as teacher_name
      FROM timetable t
      JOIN subjects s ON s.id = t.subject_id
      LEFT JOIN teachers tch ON tch.id = t.teacher_id
      WHERE t.class_id = ?
      ORDER BY t.day_of_week, t.start_time
    `).all(classId);

    return NextResponse.json(timetable);
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

    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO timetable (id, school_id, class_id, day_of_week, start_time, end_time, subject_id, teacher_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, sId, class_id, day_of_week, start_time, end_time, subject_id, teacher_id || null);

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

    const db = getDb();
    db.prepare('DELETE FROM timetable WHERE id = ?').run(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('TIMETABLE_DELETE_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
