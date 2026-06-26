import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { students, subjects, classSubjects, questionBank } from '@/lib/schema';
import { eq, and, sql, getTableColumns, inArray, asc, isNotNull, ne } from 'drizzle-orm';

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

    // Get student's class
    const studentResult = await db.select({ class_id: students.class_id }).from(students).where(eq(students.user_id, session.userId)).limit(1);
    const student = studentResult[0];
    if (!student) return NextResponse.json({ error: 'Student record not found' }, { status: 404 });

    if (!subjectId) {
      const questionCountSubquery = db.select({
        subject_id: questionBank.subject_id,
        count: sql<number>`COUNT(*)`.as('count')
      }).from(questionBank).where(eq(questionBank.class_id, student.class_id || '')).groupBy(questionBank.subject_id).as('qc');

      const results = await db.select({
        id: subjects.id,
        name: subjects.name,
        question_count: sql<number>`COALESCE(${questionCountSubquery.count}, 0)`
      })
        .from(subjects)
        .innerJoin(classSubjects, eq(classSubjects.subject_id, subjects.id))
        .leftJoin(questionCountSubquery, eq(questionCountSubquery.subject_id, subjects.id))
        .where(eq(classSubjects.class_id, student.class_id || ''));

      return NextResponse.json(results);
    }

    if (termsOnly) {
      const results = await db.selectDistinct({ term: questionBank.term })
        .from(questionBank)
        .where(and(eq(questionBank.subject_id, subjectId), eq(questionBank.class_id, student.class_id || '')))
        .orderBy(asc(questionBank.term));

      return NextResponse.json(results.map(t => t.term));
    }

    if (topicsOnly) {
      const filters = [
        eq(questionBank.subject_id, subjectId),
        eq(questionBank.class_id, student.class_id || ''),
        isNotNull(questionBank.topic),
        ne(questionBank.topic, '')
      ];

      if (term && term !== 'mix') {
        filters.push(eq(questionBank.term, parseInt(term)));
      }

      const results = await db.selectDistinct({ topic: questionBank.topic })
        .from(questionBank)
        .where(and(...filters));

      return NextResponse.json(results.map(t => t.topic));
    }

    // Get random questions
    const filters = [
      eq(questionBank.subject_id, subjectId),
      eq(questionBank.class_id, student.class_id || '')
    ];

    if (term && term !== 'mix') {
      filters.push(eq(questionBank.term, parseInt(term)));
    }

    if (topic && topic !== 'mix') {
      filters.push(eq(questionBank.topic, topic));
    }

    const results = await db.select({
      id: questionBank.id,
      question_text: questionBank.question_text,
      option_a: questionBank.option_a,
      option_b: questionBank.option_b,
      option_c: questionBank.option_c,
      option_d: questionBank.option_d,
      question_type: questionBank.question_type,
      marks: questionBank.marks,
      topic: questionBank.topic,
      term: questionBank.term
    })
      .from(questionBank)
      .where(and(...filters))
      .orderBy(sql`RAND()`)
      .limit(limit);

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('QUIZ_GET_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { subjectId, answers } = await req.json();
    if (!subjectId || !answers) return NextResponse.json({ error: 'Missing subjectId or answers' }, { status: 400 });

    const questionIds = Object.keys(answers);
    if (questionIds.length === 0) return NextResponse.json({ score: 0, total: 0 });

    const correctAnswers = await db.select({ id: questionBank.id, correct_answer: questionBank.correct_answer, marks: questionBank.marks })
      .from(questionBank)
      .where(inArray(questionBank.id, questionIds));

    let score = 0;
    let totalMarks = 0;
    const results = correctAnswers.map(q => {
      const isCorrect = q.correct_answer === answers[q.id];
      if (isCorrect) score += (q.marks || 1);
      totalMarks += (q.marks || 1);
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
      percentage: totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0,
      results
    });
  } catch (error: any) {
    console.error('QUIZ_POST_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

