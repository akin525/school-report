import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { questionBank, teachers, subjects, classes, sessions } from '@/lib/schema';
import { eq, and, getTableColumns } from 'drizzle-orm';
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
      .where(and(eq(questionBank.id, id), eq(questionBank.school_id, session.schoolId || '')))
      .limit(1);

    const question = results[0];

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json(question);
  } catch (error) {
    console.error('Error fetching question:', error);
    return NextResponse.json({ error: 'Failed to fetch question' }, { status: 500 });
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
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      difficulty,
      marks,
      topic
    } = body;

    if (!questionText || !correctAnswer) {
      return NextResponse.json({ error: 'Question text and correct answer are required' }, { status: 400 });
    }

    await db.update(questionBank).set({
      question_text: questionText,
      option_a: optionA || null,
      option_b: optionB || null,
      option_c: optionC || null,
      option_d: optionD || null,
      correct_answer: correctAnswer,
      difficulty: difficulty || 'medium',
      marks: marks || 1,
      topic: topic || null,
      updated_at: new Date()
    }).where(and(eq(questionBank.id, id), eq(questionBank.school_id, session.schoolId || '')));

    const updatedResult = await db.select().from(questionBank).where(eq(questionBank.id, id)).limit(1);
    const updatedQuestion = updatedResult[0];

    if (!updatedQuestion) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json(updatedQuestion);
  } catch (error) {
    console.error('Error updating question:', error);
    return NextResponse.json({ error: 'Failed to update question' }, { status: 500 });
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
    await db.delete(questionBank).where(and(eq(questionBank.id, id), eq(questionBank.school_id, session.schoolId || '')));

    return NextResponse.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Error deleting question:', error);
    return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 });
  }
}

