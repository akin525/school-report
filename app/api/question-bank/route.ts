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
      SELECT qb.*, t.name as teacher_name, s.name as subject_name, c.name as class_name, 
             c.arm as class_arm, sess.name as session_name
      FROM question_bank qb
      LEFT JOIN teachers t ON qb.teacher_id = t.id
      LEFT JOIN subjects s ON qb.subject_id = s.id
      LEFT JOIN classes c ON qb.class_id = c.id
      LEFT JOIN sessions sess ON qb.session_id = sess.id
      WHERE qb.school_id = ?
    `;
    const params: any[] = [schoolId];

    if (actualTeacherId) {
      query += ' AND qb.teacher_id = ?';
      params.push(actualTeacherId);
    }

    if (subjectId) {
      query += ' AND qb.subject_id = ?';
      params.push(subjectId);
    }
    if (classId) {
      query += ' AND qb.class_id = ?';
      params.push(classId);
    }
    if (sessionId) {
      query += ' AND qb.session_id = ?';
      params.push(sessionId);
    }
    if (term) {
      query += ' AND qb.term = ?';
      params.push(parseInt(term));
    }

    query += ' ORDER BY qb.created_at DESC';

    const questions = db.prepare(query).all(...params);
    return NextResponse.json(questions);
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

    const db = getDb();
    const questionId = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO question_bank (
        id, school_id, teacher_id, subject_id, class_id, session_id, term,
        question_text, option_a, option_b, option_c, option_d, 
        correct_answer, question_type, difficulty, marks, topic
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      questionId,
      schoolId,
      teacherId,
      subjectId,
      classId,
      sessionId,
      parseInt(term),
      questionText,
      optionA || null,
      optionB || null,
      optionC || null,
      optionD || null,
      correctAnswer,
      questionType,
      difficulty,
      marks,
      topic || null
    );

    const newQuestion = db.prepare('SELECT * FROM question_bank WHERE id = ?').get(questionId);
    return NextResponse.json(newQuestion, { status: 201 });
  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 });
  }
}
