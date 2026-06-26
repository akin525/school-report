import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { lessonNotes, teachers, subjects, classes, sessions, students } from '@/lib/schema';
import { eq, and, desc, getTableColumns } from 'drizzle-orm';
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

    let actualClassId = classId;
    if (session.role === 'student' && session.userId) {
      const studentResult = await db.select({ class_id: students.class_id }).from(students).where(eq(students.user_id, session.userId)).limit(1);
      const student = studentResult[0];
      if (student) actualClassId = student.class_id;
    }

    const filters = [eq(lessonNotes.school_id, schoolId)];
    if (teacherId) filters.push(eq(lessonNotes.teacher_id, teacherId));
    if (subjectId) filters.push(eq(lessonNotes.subject_id, subjectId));
    if (actualClassId) filters.push(eq(lessonNotes.class_id, actualClassId));
    if (sessionId) filters.push(eq(lessonNotes.session_id, sessionId));
    if (term) filters.push(eq(lessonNotes.term, parseInt(term)));

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
      .where(and(...filters))
      .orderBy(desc(lessonNotes.created_at));

    return NextResponse.json(results);
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

    const id = uuidv4();
    await db.insert(lessonNotes).values({
      id,
      school_id: schoolId,
      teacher_id: teacherId,
      subject_id: subjectId,
      class_id: classId,
      session_id: sessionId,
      term: parseInt(term),
      title,
      content: content || null,
      file_url: fileUrl || null,
      file_name: fileName || null,
      file_type: fileType || null,
      topic: topic || null
    });

    const newResult = await db.select().from(lessonNotes).where(eq(lessonNotes.id, id)).limit(1);
    return NextResponse.json(newResult[0], { status: 201 });
  } catch (error) {
    console.error('Error creating lesson note:', error);
    return NextResponse.json({ error: 'Failed to create lesson note' }, { status: 500 });
  }
}

