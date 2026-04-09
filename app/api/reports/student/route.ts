import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { calculateGrade } from '@/lib/grading';
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

  // Get grading system
  const grading = db.prepare('SELECT * FROM grading_system WHERE school_id = ? ORDER BY min_score DESC').all(schoolId) as any[];

  // Get class teacher
  const classTeacher = db.prepare(`
    SELECT t.name
    FROM teacher_assignments ta
    JOIN teachers t ON t.id = ta.teacher_id
    WHERE ta.class_id = ? AND ta.session_id = ? AND ta.subject_id IS NULL AND ta.school_id = ?
  `).get(student.class_id, sessionId, schoolId) as any;

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

  // Get all class subjects to have a consistent max score
  const classSubjects = db.prepare('SELECT subject_id FROM class_subjects WHERE class_id = ? AND school_id = ?').all(student.class_id, schoolId) as any[];
  const classSubjectCount = classSubjects.length;

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

    // Build subject position and average map
    const subjectPositions: Record<string, number> = {};
    const subjectAverages: Record<string, number> = {};
    const subjectTotals: Record<string, number[]> = {};
    const subjectStudentCounts: Record<string, number> = {}; // To store count of students who took the exam for each subject

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
      // Calculate average based on students who took the exam for this subject
      const sum = totals.reduce((a, b) => a + b, 0);
      subjectAverages[subId] = totals.length > 0 ? Math.round((sum / totals.length) * 10) / 10 : 0;
    }

    // Class total scores for overall position
    const allStudentTotals = db.prepare(`
      SELECT student_id, SUM(total) as grand_total
      FROM scores
      WHERE class_id = ? AND session_id = ? AND term = ? AND school_id = ?
      GROUP BY student_id
    `).all(classId, sessionId, term, schoolId) as any[];

    const classSize = allStudentTotals.length;
    // Fallback: If student not found in class totals, get their total directly from scores
    let studentTotal = allStudentTotals.find(s => s.student_id === studentId)?.grand_total || 0;
    if (studentTotal === 0 && termScores.length > 0) {
      studentTotal = termScores.reduce((sum, s) => sum + (s.total || 0), 0);
    }
    const sortedTotals = [...allStudentTotals].sort((a, b) => b.grand_total - a.grand_total);
    const overallPosition = sortedTotals.findIndex(s => s.student_id === studentId) + 1;

    // Overall Percentage calculation: total score / (number of subjects taken * 100)
    const subjectsTaken = termScores.length;
    const maxScore = subjectsTaken * 100;
    const overallPercentage = maxScore > 0 ? Math.round((studentTotal / maxScore) * 100) : 0;

    termData[term] = {
      scores: termScores.map(s => ({
        ...s,
        grade: calculateGrade(s.total, 100, grading).grade,
        position: subjectPositions[s.subject_id] || 0,
        class_average: subjectAverages[s.subject_id] || 0,
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

    // Cumulative 1&2
    const validTerms12 = [t1, t2].filter(t => t && t.total > 0);
    const cum12Total = validTerms12.reduce((sum, t) => sum + (t?.total || 0), 0);
    const cum12Ave = validTerms12.length > 0 ? cum12Total / validTerms12.length : 0;
    const cum12Grade = cum12Ave > 0 ? calculateGrade(cum12Ave, 100, grading).grade : '';
    const class12Ave = validTerms12.length > 0 ? validTerms12.reduce((sum, t) => sum + (t?.class_average || 0), 0) / validTerms12.length : 0;

    // Cumulative Final (1-3)
    const validTermsFinal = [t1, t2, t3].filter(t => t && t.total > 0);
    const cumFinalTotal = validTermsFinal.reduce((sum, t) => sum + (t?.total || 0), 0);
    const cumFinalAve = validTermsFinal.length > 0 ? cumFinalTotal / validTermsFinal.length : 0;
    const cumFinalGrade = cumFinalAve > 0 ? calculateGrade(cumFinalAve, 100, grading).grade : '';
    const classFinalAve = validTermsFinal.length > 0 ? validTermsFinal.reduce((sum, t) => sum + (t?.class_average || 0), 0) / validTermsFinal.length : 0;

    return {
      subjectId: sub.id,
      subjectName: sub.name,
      term1: t1 || null,
      term2: t2 || null,
      term3: t3 || null,
      cum12Total,
      cum12Ave: Math.round(cum12Ave * 10) / 10,
      cum12Grade,
      class12Ave: Math.round(class12Ave * 10) / 10,
      cumTotal: cumFinalTotal,
      cumAve: Math.round(cumFinalAve * 10) / 10,
      cumGrade: cumFinalGrade,
      classFinalAve: Math.round(classFinalAve * 10) / 10,
    };
  });

  return NextResponse.json({
    student,
    school,
    grading,
    classTeacher: classTeacher || null,
    session: academicSession,
    termData,
    subjectCumulative,
    traits: traits.reduce((acc, t) => { acc[t.term] = t; return acc; }, {} as Record<number, any>),
    attendance: attendance.reduce((acc, a) => { acc[a.term] = a; return acc; }, {} as Record<number, any>),
    comments: comments.reduce((acc, c) => { acc[c.term] = c; return acc; }, {} as Record<number, any>),
  });
}