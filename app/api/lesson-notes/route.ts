import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
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
    const subjectId = searchParams.get('subjectId');
    const classId = searchParams.get('classId');
    const sessionId = searchParams.get('sessionId');
    const term = searchParams.get('term');

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    const db = getDb();

    let actualClassId = classId;
    if (session.role === 'student' && session.userId) {
      const student = db.prepare('SELECT class_id FROM students WHERE user_id = ?').get(session.userId) as any;
      if (student) actualClassId = student.class_id;
    }

    let query = `
      SELECT ln.*, t.name as teacher_name, s.name as subject_name, c.name as class_name, 
             c.arm as class_arm, sess.name as session_name
      FROM lesson_notes ln
      LEFT JOIN teachers t ON ln.teacher_id = t.id
      LEFT JOIN subjects s ON ln.subject_id = s.id
      LEFT JOIN classes c ON ln.class_id = c.id
      LEFT JOIN sessions sess ON ln.session_id = sess.id
      WHERE ln.school_id = ?
    `;
    const params: any[] = [schoolId];

    if (teacherId) {
      query += ' AND ln.teacher_id = ?';
      params.push(teacherId);
    }
    if (subjectId) {
      query += ' AND ln.subject_id = ?';
      params.push(subjectId);
    }
    if (actualClassId) {
      query += ' AND ln.class_id = ?';
      params.push(actualClassId);
    }
    if (sessionId) {
      query += ' AND ln.session_id = ?';
      params.push(sessionId);
    }
    if (term) {
      query += ' AND ln.term = ?';
      params.push(parseInt(term));
    }

    query += ' ORDER BY ln.created_at DESC';

    const lessonNotes = db.prepare(query).all(...params);
    return NextResponse.json(lessonNotes);
  } catch (error) {
    console.error('Error fetching lesson notes:', error);
    return NextResponse.json({ error: 'Failed to fetch lesson notes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      schoolId,
      teacherId,
      subjectId,
      classId,
      sessionId,
      term,
      title,
      content,
      fileUrl,
      fileName,
      fileType,
      topic
    } = body;

    if (!schoolId || !teacherId || !subjectId || !classId || !sessionId || !term || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDb();
    const lessonNoteId = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO lesson_notes (
        id, school_id, teacher_id, subject_id, class_id, session_id, term,
        title, content, file_url, file_name, file_type, topic
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      lessonNoteId,
      schoolId,
      teacherId,
      subjectId,
      classId,
      sessionId,
      parseInt(term),
      title,
      content || null,
      fileUrl || null,
      fileName || null,
      fileType || null,
      topic || null
    );

    const newLessonNote = db.prepare('SELECT * FROM lesson_notes WHERE id = ?').get(lessonNoteId);
    return NextResponse.json(newLessonNote, { status: 201 });
  } catch (error) {
    console.error('Error creating lesson note:', error);
    return NextResponse.json({ error: 'Failed to create lesson note' }, { status: 500 });
  }
}
