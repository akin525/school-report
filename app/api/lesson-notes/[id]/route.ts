import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { lessonNotes, teachers, subjects, classes, sessions, students } from '@/lib/schema';
import { eq, getTableColumns } from 'drizzle-orm';
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

    // Security check for students
    if (session.role === 'student') {
      const studentResult = await db.select({ class_id: students.class_id }).from(students).where(eq(students.user_id, session.userId)).limit(1);
      const student = studentResult[0];

      const lessonNoteBasicResult = await db.select({ class_id: lessonNotes.class_id }).from(lessonNotes).where(eq(lessonNotes.id, id)).limit(1);
      const lessonNoteBasic = lessonNoteBasicResult[0];

      if (!student || !lessonNoteBasic || student.class_id !== lessonNoteBasic.class_id) {
        return NextResponse.json({ error: 'Access denied: This lesson note is not for your class' }, { status: 403 });
      }
    }

    const results = await db.select({
      ...getTableColumns(lessonNotes),
      teacher_name: teachers.name,
      subject_name: subjects.name,
      class_name: classes.name,
      class_arm: classes.arm,
      session_name: sessions.name
    })
      .from(lessonNotes)
      .leftJoin(teachers, eq(teachers.id, lessonNotes.teacher_id))
      .leftJoin(subjects, eq(subjects.id, lessonNotes.subject_id))
      .leftJoin(classes, eq(classes.id, lessonNotes.class_id))
      .leftJoin(sessions, eq(sessions.id, lessonNotes.session_id))
      .where(eq(lessonNotes.id, id))
      .limit(1);

    const lessonNote = results[0];

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

    const updateData: any = {
      title,
      content: content || null,
      file_url: fileUrl || null,
      file_name: fileName || null,
      file_type: fileType || null,
      topic: topic || null,
      updated_at: new Date()
    };

    if (term !== undefined && term !== null && term !== '') {
      updateData.term = typeof term === 'string' ? parseInt(term) : term;
    }

    await db.update(lessonNotes).set(updateData).where(eq(lessonNotes.id, id));

    const updatedResult = await db.select().from(lessonNotes).where(eq(lessonNotes.id, id)).limit(1);
    const updatedLessonNote = updatedResult[0];

    if (!updatedLessonNote) {
      return NextResponse.json({ error: 'Lesson note not found' }, { status: 404 });
    }

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
    await db.delete(lessonNotes).where(eq(lessonNotes.id, id));

    return NextResponse.json({ message: 'Lesson note deleted successfully' });
  } catch (error) {
    console.error('Error deleting lesson note:', error);
    return NextResponse.json({ error: 'Failed to delete lesson note' }, { status: 500 });
  }
}

