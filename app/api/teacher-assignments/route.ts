import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const teacherId = searchParams.get('teacherId');
    const sessionId = searchParams.get('sessionId');

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    const db = getDb();
    
    // If teacherId is not provided, find teacher ID from user session
    let actualTeacherId = teacherId;
    if (!actualTeacherId && session.userId) {
      // Find teacher record associated with this user
      const teacher = db.prepare('SELECT id FROM teachers WHERE user_id = ? AND school_id = ?')
        .get(session.userId, schoolId) as any;
      actualTeacherId = teacher?.id;
    }

    let query = `
      SELECT ta.*, c.name as class_name, c.arm as class_arm, s.name as subject_name,
             sess.name as session_name, t.name as teacher_name
      FROM teacher_assignments ta
      LEFT JOIN classes c ON ta.class_id = c.id
      LEFT JOIN subjects s ON ta.subject_id = s.id
      LEFT JOIN sessions sess ON ta.session_id = sess.id
      LEFT JOIN teachers t ON ta.teacher_id = t.id
      WHERE ta.school_id = ? AND ta.teacher_id = ?
    `;
    const params: any[] = [schoolId, actualTeacherId];

    if (sessionId) {
      query += ' AND ta.session_id = ?';
      params.push(sessionId);
    }

    query += ' ORDER BY sess.name, c.name, s.name';

    const assignments = db.prepare(query).all(...params);
    return NextResponse.json(assignments);
  } catch (error) {
    console.error('Error fetching teacher assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch teacher assignments' }, { status: 500 });
  }
}
