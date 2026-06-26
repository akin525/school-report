import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { questionBank, teachers, subjects, classes, sessions } from '@/lib/schema';
import { eq, and, desc, getTableColumns } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Security check: Students are not allowed to access the raw question bank
    if (session.role === 'student') {
      return NextResponse.json({ error: 'Access denied: Students cannot access the question bank directly' }, { status: 403 });
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

    // If teacherId is not provided, find teacher ID from user session
    let actualTeacherId = teacherId;
    if (!actualTeacherId && session.userId) {
      // Find teacher record associated with this user
      const teacherResult = await db.select({ id: teachers.id }).from(teachers).where(
        and(
          eq(teachers.user_id, session.userId),
          eq(teachers.school_id, schoolId)
        )
      ).limit(1);
      actualTeacherId = teacherResult[0]?.id;
    }

    const filters = [eq(questionBank.school_id, schoolId)];

    if (actualTeacherId) {
      filters.push(eq(questionBank.teacher_id, actualTeacherId));
    }
    if (subjectId) {
      filters.push(eq(questionBank.subject_id, subjectId));
    }
    if (classId) {
      filters.push(eq(questionBank.class_id, classId));
    }
    if (sessionId) {
      filters.push(eq(questionBank.session_id, sessionId));
    }
    if (term) {
      filters.push(eq(questionBank.term, parseInt(term)));
    }

    const results = await db.select({
      ...getTableColumns(questionBank),
      teacher_name: teachers.name,
      subject_name: subjects.name,
      class_name: classes.name,
      class_arm: classes.arm,
      session_name: sessions.name
    })
      .from(questionBank)
      .leftJoin(teachers, eq(teachers.id, questionBank.teacher_id))
      .leftJoin(subjects, eq(subjects.id, questionBank.subject_id))
      .leftJoin(classes, eq(classes.id, questionBank.class_id))
      .leftJoin(sessions, eq(sessions.id, questionBank.session_id))
      .where(and(...filters))
      .orderBy(desc(questionBank.created_at));

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching question bank:', error);
    return NextResponse.json({ error: 'Failed to fetch question bank' }, { status: 500 });
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
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      questionType = 'multiple_choice',
      difficulty = 'medium',
      marks = 1,
      topic
    } = body;

    if (!schoolId || !teacherId || !subjectId || !classId || !sessionId || !term || !questionText || !correctAnswer) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const id = uuidv4();
    await db.insert(questionBank).values({
      id,
      school_id: schoolId,
      teacher_id: teacherId,
      subject_id: subjectId,
      class_id: classId,
      session_id: sessionId,
      term: parseInt(term),
      question_text: questionText,
      option_a: optionA || null,
      option_b: optionB || null,
      option_c: optionC || null,
      option_d: optionD || null,
      correct_answer: correctAnswer,
      question_type: questionType,
      difficulty: difficulty,
      marks: marks,
      topic: topic || null
    });

    const newQuestion = await db.select().from(questionBank).where(eq(questionBank.id, id)).limit(1);
    return NextResponse.json(newQuestion[0], { status: 201 });
  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 });
  }
}

