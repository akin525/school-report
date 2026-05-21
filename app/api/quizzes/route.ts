import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get('subjectId');
    const term = searchParams.get('term');
    const topic = searchParams.get('topic');
    const topicsOnly = searchParams.get('topics') === 'true';
    const termsOnly = searchParams.get('terms') === 'true';
    const limit = parseInt(searchParams.get('limit') || '10');

    const db = getDb();

    // Get student's class
    const student = db.prepare('SELECT class_id FROM students WHERE user_id = ?').get(session.userId) as any;
    if (!student) return NextResponse.json({ error: 'Student record not found' }, { status: 404 });

    if (!subjectId) {
      // Return list of subjects that have questions for this class
      const subjects = db.prepare(`
        SELECT DISTINCT s.id, s.name, (SELECT COUNT(*) FROM question_bank qb WHERE qb.subject_id = s.id AND qb.class_id = ?) as question_count
        FROM subjects s
        JOIN class_subjects cs ON cs.subject_id = s.id
        WHERE cs.class_id = ?
      `).all(student.class_id, student.class_id);
      return NextResponse.json(subjects);
    }

    if (termsOnly) {
      const terms = db.prepare(`
        SELECT DISTINCT term FROM question_bank
        WHERE subject_id = ? AND class_id = ?
        ORDER BY term ASC
      `).all(subjectId, student.class_id);
      return NextResponse.json(terms.map((t: any) => t.term));
    }

    if (topicsOnly) {
      let query = `
        SELECT DISTINCT topic FROM question_bank
        WHERE subject_id = ? AND class_id = ? AND topic IS NOT NULL AND topic != ''
      `;
      const params: any[] = [subjectId, student.class_id];
      if (term && term !== 'mix') {
        query += ' AND term = ?';
        params.push(parseInt(term));
      }
      const topics = db.prepare(query).all(...params);
      return NextResponse.json(topics.map((t: any) => t.topic));
    }

    // Get random questions for the subject and class
    let query = `
      SELECT id, question_text, option_a, option_b, option_c, option_d, question_type, marks, topic, term
      FROM question_bank
      WHERE subject_id = ? AND class_id = ?
    `;
    const params: any[] = [subjectId, student.class_id];

    if (term && term !== 'mix') {
      query += ' AND term = ?';
      params.push(parseInt(term));
    }

    if (topic && topic !== 'mix') {
      query += ' AND topic = ?';
      params.push(topic);
    }

    query += ' ORDER BY RANDOM() LIMIT ?';
    params.push(limit);

    const questions = db.prepare(query).all(...params);
    return NextResponse.json(questions);
  } catch (error: any) {
    console.error('QUIZ_GET_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { subjectId, answers } = await req.json(); // answers is { questionId: selectedOption }
    if (!subjectId || !answers) return NextResponse.json({ error: 'Missing subjectId or answers' }, { status: 400 });

    const db = getDb();
    const questionIds = Object.keys(answers);

    if (questionIds.length === 0) return NextResponse.json({ score: 0, total: 0 });

    // Fetch correct answers for these questions
    const placeholders = questionIds.map(() => '?').join(',');
    const correctAnswers = db.prepare(`
      SELECT id, correct_answer, marks FROM question_bank WHERE id IN (${placeholders})
    `).all(...questionIds) as any[];

    let score = 0;
    let totalMarks = 0;
    const results = correctAnswers.map(q => {
      const isCorrect = q.correct_answer === answers[q.id];
      if (isCorrect) score += q.marks;
      totalMarks += q.marks;
      return {
        questionId: q.id,
        correctAnswer: q.correct_answer,
        selectedAnswer: answers[q.id],
        isCorrect
      };
    });

    return NextResponse.json({
      score,
      totalMarks,
      percentage: Math.round((score / totalMarks) * 100),
      results
    });
  } catch (error: any) {
    console.error('QUIZ_POST_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
