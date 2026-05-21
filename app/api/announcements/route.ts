import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('schoolId') || session.schoolId;
    const role = searchParams.get('role');
    const classId = searchParams.get('classId');

    const db = getDb();

    let query = `
      SELECT a.*, u.name as creator_name, c.name as target_class_name
      FROM announcements a
      JOIN users u ON u.id = a.created_by
      LEFT JOIN classes c ON c.id = a.target_class_id
      WHERE a.school_id = ?
    `;
    const params: any[] = [schoolId];

    if (session.role === 'student') {
      query += ' AND (target_role = "all" OR target_role = "student")';
      if (classId) {
        query += ' AND (target_class_id IS NULL OR target_class_id = ?)';
        params.push(classId);
      } else {
        query += ' AND target_class_id IS NULL';
      }
    } else if (session.role === 'teacher') {
      query += ' AND (target_role = "all" OR target_role = "teacher")';
    }

    query += ' ORDER BY a.created_at DESC';

    const announcements = db.prepare(query).all(...params);
    return NextResponse.json(announcements);
  } catch (error: any) {
    console.error('ANNOUNCEMENTS_GET_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { title, content, target_role, target_class_id, schoolId } = await req.json();
    const sId = schoolId || session.schoolId;

    if (!title || !content) return NextResponse.json({ error: 'Title and content required' }, { status: 400 });

    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO announcements (id, school_id, title, content, target_role, target_class_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, sId, title, content, target_role || 'all', target_class_id || null, session.userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('ANNOUNCEMENTS_POST_ERROR:', error);
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
    db.prepare('DELETE FROM announcements WHERE id = ?').run(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('ANNOUNCEMENTS_DELETE_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
