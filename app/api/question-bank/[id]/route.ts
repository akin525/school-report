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
    const question = db.prepare(`
      SELECT qb.*, t.name as teacher_name, s.name as subject_name, c.name as class_name, 
             c.arm as class_arm, sess.name as session_name
      FROM question_bank qb
      LEFT JOIN teachers t ON qb.teacher_id = t.id
      LEFT JOIN subjects s ON qb.subject_id = s.id
      LEFT JOIN classes c ON qb.class_id = c.id
      LEFT JOIN sessions sess ON qb.session_id = sess.id
      WHERE qb.id = ? AND qb.school_id = ?
    `).get(id, session.schoolId);

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

    const db = getDb();
    const stmt = db.prepare(`
      UPDATE question_bank 
      SET question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?,
          correct_answer = ?, difficulty = ?, marks = ?, topic = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND school_id = ?
    `);

    const result = stmt.run(
      questionText,
      optionA || null,
      optionB || null,
      optionC || null,
      optionD || null,
      correctAnswer,
      difficulty || 'medium',
      marks || 1,
      topic || null,
      id,
      session.schoolId
    );

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const updatedQuestion = db.prepare('SELECT * FROM question_bank WHERE id = ?').get(id);
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
    const db = getDb();
    const result = db.prepare('DELETE FROM question_bank WHERE id = ? AND school_id = ?')
      .run(id, session.schoolId);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Error deleting question:', error);
    return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 });
  }
}
