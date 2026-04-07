import { NextRequest, NextResponse } from 'next/server';
import { getSession, getGrade } from '@/lib/auth';
import getDb from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');
  const sessionId = searchParams.get('sessionId');
  const schoolId = searchParams.get('schoolId') || session.schoolId;

  if (!studentId || !sessionId) {
    return NextResponse.json({ error: 'studentId and sessionId required' }, { status: 400 });
  }

  const db = getDb();

  // Get student info
  const student = db.prepare(`
    SELECT s.*, c.name as class_name, c.category as class_category, c.arm
    FROM students s
    LEFT JOIN classes c ON c.id = s.class_id
    WHERE s.id = ? AND s.school_id = ?
  `).get(studentId, schoolId) as any;

  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  // Get school info
  const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(schoolId) as any;

  // Get session info
  const academicSession = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as any;

  // Get scores for all 3 terms
  const scores = db.prepare(`
    SELECT sc.*, sub.name as subject_name, sub.category
    FROM scores sc
    JOIN subjects sub ON sub.id = sc.subject_id
    WHERE sc.student_id = ? AND sc.session_id = ? AND sc.school_id = ?
    ORDER BY sub.name
  `).all(studentId, sessionId, schoolId) as any[];

  // Get class size per term (to calculate position)
  const classId = student.class_id;

  // For each term, calculate positions for each subject
  const termData: Record<number, any> = {};

  for (const term of [1, 2, 3]) {
    const termScores = scores.filter(s => s.term === term);

    // Get all students' scores in same class for position calculation
    const classScores = db.prepare(`
      SELECT sc.student_id, sc.subject_id, sc.total
      FROM scores sc
      WHERE sc.class_id = ? AND sc.session_id = ? AND sc.term = ? AND sc.school_id = ?
    `).all(classId, sessionId, term, schoolId) as any[];

    // Build subject position map
    const subjectPositions: Record<string, number> = {};
    const subjectTotals: Record<string, number[]> = {};

    for (const cs of classScores) {
      if (!subjectTotals[cs.subject_id]) subjectTotals[cs.subject_id] = [];
      subjectTotals[cs.subject_id].push(cs.total);
    }

    for (const [subId, totals] of Object.entries(subjectTotals)) {
      const sorted = [...totals].sort((a, b) => b - a);
      const studentScore = classScores.find(cs => cs.student_id === studentId && cs.subject_id === subId);
      if (studentScore) {
        subjectPositions[subId] = sorted.indexOf(studentScore.total) + 1;
      }
    }

    // Class total scores for overall position
    const allStudentTotals = db.prepare(`
      SELECT student_id, SUM(total) as grand_total
      FROM scores
      WHERE class_id = ? AND session_id = ? AND term = ? AND school_id = ?
      GROUP BY student_id
    `).all(classId, sessionId, term, schoolId) as any[];

    const classSize = allStudentTotals.length;
    const studentTotal = allStudentTotals.find(s => s.student_id === studentId)?.grand_total || 0;
    const sortedTotals = [...allStudentTotals].sort((a, b) => b.grand_total - a.grand_total);
    const overallPosition = sortedTotals.findIndex(s => s.student_id === studentId) + 1;

    // Max possible score = number of subjects * 100
    const subjectCount = termScores.length;
    const maxScore = subjectCount * 100;
    const overallPercentage = maxScore > 0 ? Math.round((studentTotal / maxScore) * 100) : 0;

    termData[term] = {
      scores: termScores.map(s => ({
        ...s,
        grade: getGrade(s.total),
        position: subjectPositions[s.subject_id] || 0,
        classSize,
      })),
      total: studentTotal,
      overallPercentage,
      overallPosition,
      classSize,
    };
  }

  // Get affective traits for all terms
  const traits = db.prepare('SELECT * FROM affective_traits WHERE student_id=? AND session_id=? AND school_id=?')
    .all(studentId, sessionId, schoolId) as any[];

  // Get attendance
  const attendance = db.prepare('SELECT * FROM attendance WHERE student_id=? AND session_id=? AND school_id=?')
    .all(studentId, sessionId, schoolId) as any[];

  // Get comments
  const comments = db.prepare('SELECT * FROM teacher_comments WHERE student_id=? AND session_id=? AND school_id=?')
    .all(studentId, sessionId, schoolId) as any[];

  // Build subject list (all subjects across terms)
  const allSubjectIds = new Set(scores.map(s => s.subject_id));
  const allSubjects = Array.from(allSubjectIds).map(id => {
    const s = scores.find(sc => sc.subject_id === id);
    return { id, name: s?.subject_name || '', category: s?.category || '' };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // Compute cumulative data
  const subjectCumulative = allSubjects.map(sub => {
    const t1 = termData[1]?.scores.find((s: any) => s.subject_id === sub.id);
    const t2 = termData[2]?.scores.find((s: any) => s.subject_id === sub.id);
    const t3 = termData[3]?.scores.find((s: any) => s.subject_id === sub.id);

    const validTerms = [t1, t2, t3].filter(Boolean);
    const cumTotal = validTerms.reduce((sum, t) => sum + (t?.total || 0), 0);
    const cumAve = validTerms.length > 0 ? cumTotal / validTerms.length : 0;
    const cumGrade = cumAve > 0 ? getGrade(cumAve) : '';

    return {
      subjectId: sub.id,
      subjectName: sub.name,
      term1: t1 || null,
      term2: t2 || null,
      term3: t3 || null,
      cumTotal,
      cumAve: Math.round(cumAve * 10) / 10,
      cumGrade,
    };
  });

  return NextResponse.json({
    student,
    school,
    session: academicSession,
    termData,
    subjectCumulative,
    traits: traits.reduce((acc, t) => { acc[t.term] = t; return acc; }, {} as Record<number, any>),
    attendance: attendance.reduce((acc, a) => { acc[a.term] = a; return acc; }, {} as Record<number, any>),
    comments: comments.reduce((acc, c) => { acc[c.term] = c; return acc; }, {} as Record<number, any>),
  });
}