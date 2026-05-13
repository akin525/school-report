import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const db = getDb();
    const lessonNote = db.prepare(`
      SELECT ln.*, t.name as teacher_name, s.name as subject_name, c.name as class_name, 
             c.arm as class_arm, sess.name as session_name
      FROM lesson_notes ln
      LEFT JOIN teachers t ON ln.teacher_id = t.id
      LEFT JOIN subjects s ON ln.subject_id = s.id
      LEFT JOIN classes c ON ln.class_id = c.id
      LEFT JOIN sessions sess ON ln.session_id = sess.id
      WHERE ln.id = ?
    `).get(id);

    if (!lessonNote) {
      return NextResponse.json({ error: 'Lesson note not found' }, { status: 404 });
    }

    return NextResponse.json(lessonNote);
  } catch (error) {
    console.error('Error fetching lesson note:', error);
    return NextResponse.json({ error: 'Failed to fetch lesson note' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      title,
      content,
      fileUrl,
      fileName,
      fileType,
      topic,
      term
    } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const db = getDb();
    const stmt = db.prepare(`
      UPDATE lesson_notes 
      SET title = ?, content = ?, file_url = ?, file_name = ?, file_type = ?, topic = ?, term = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const result = stmt.run(
      title,
      content || null,
      fileUrl || null,
      fileName || null,
      fileType || null,
      topic || null,
      term ? parseInt(term) : null,
      id
    );

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Lesson note not found' }, { status: 404 });
    }

    const updatedLessonNote = db.prepare('SELECT * FROM lesson_notes WHERE id = ?').get(id);
    return NextResponse.json(updatedLessonNote);
  } catch (error) {
    console.error('Error updating lesson note:', error);
    return NextResponse.json({ error: 'Failed to update lesson note' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const db = getDb();
    const result = db.prepare('DELETE FROM lesson_notes WHERE id = ?').run(id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Lesson note not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Lesson note deleted successfully' });
  } catch (error) {
    console.error('Error deleting lesson note:', error);
    return NextResponse.json({ error: 'Failed to delete lesson note' }, { status: 500 });
  }
}
