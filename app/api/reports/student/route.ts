import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { calculateGrade } from '@/lib/grading';
import { db } from '@/lib/db';
import { students, classes, schools, gradingSystem, teacherAssignments, teachers, sessions, scores, subjects, classSubjects, affectiveTraits, attendance, teacherComments } from '@/lib/schema';
import { eq, and, isNull, desc, asc, sql, getTableColumns } from 'drizzle-orm';

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

  // Security check: Students can only view their own report card
  if (session.role === 'student') {
    const studentUserResult = await db.select({ id: students.id }).from(students).where(eq(students.user_id, session.userId)).limit(1);
    const studentUser = studentUserResult[0];
    if (!studentUser || studentUser.id !== studentId) {
      return NextResponse.json({ error: 'Unauthorized: You can only view your own report card' }, { status: 403 });
    }
  }

  // Get student info
  const studentResult = await db.select({
    id: students.id,
    school_id: students.school_id,
    admission_number: students.admission_number,
    first_name: students.first_name,
    middle_name: students.middle_name,
    last_name: students.last_name,
    class_id: students.class_id,
    date_of_birth: students.date_of_birth,
    gender: students.gender,
    photo_url: students.photo_url,
    admission_year: students.admission_year,
    class_name: classes.name,
    class_category: classes.category,
    arm: classes.arm
  })
    .from(students)
    .leftJoin(classes, eq(classes.id, students.class_id))
    .where(and(eq(students.id, studentId), eq(students.school_id, schoolId || '')))
    .limit(1);

  const student = studentResult[0];

  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  // Get school info
  const schoolResult = await db.select().from(schools).where(eq(schools.id, schoolId || '')).limit(1);
  const school = schoolResult[0];

  // Get grading system
  const grading = await db.select().from(gradingSystem)
    .where(eq(gradingSystem.school_id, schoolId || ''))
    .orderBy(desc(gradingSystem.min_score));

  // Get class teacher
  const classTeacherResult = await db.select({ name: teachers.name })
    .from(teacherAssignments)
    .innerJoin(teachers, eq(teachers.id, teacherAssignments.teacher_id))
    .where(and(
      eq(teacherAssignments.class_id, student.class_id || ''),
      eq(teacherAssignments.session_id, sessionId),
      isNull(teacherAssignments.subject_id),
      eq(teacherAssignments.school_id, schoolId || '')
    ))
    .limit(1);
  const classTeacher = classTeacherResult[0];

  // Get session info
  const sessionResult = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  const academicSession = sessionResult[0];

  // Get scores for all 3 terms
  const allScores = await db.select({
    ...getTableColumns(scores),
    subject_name: subjects.name,
    category: subjects.category
  })
    .from(scores)
    .innerJoin(subjects, eq(subjects.id, scores.subject_id))
    .where(and(
      eq(scores.student_id, studentId),
      eq(scores.session_id, sessionId),
      eq(scores.school_id, schoolId || '')
    ))
    .orderBy(asc(subjects.name));

  const termData: Record<number, any> = {};

  for (const term of [1, 2, 3]) {
    const termScores = allScores.filter((s: any) => s.term === term);

    // Get all students' scores in same class for position calculation
    const classScores = await db.select({
      student_id: scores.student_id,
      subject_id: scores.subject_id,
      ca1_score: scores.ca1_score,
      ca2_score: scores.ca2_score,
      exam_score: scores.exam_score,
      t1: scores.t1, t2: scores.t2, t3: scores.t3, t4: scores.t4, t5: scores.t5,
      t6: scores.t6, t7: scores.t7, t8: scores.t8, t9: scores.t9, t10: scores.t10,
      total: scores.total
    })
      .from(scores)
      .where(and(
        eq(scores.class_id, student.class_id || ''),
        eq(scores.session_id, sessionId),
        eq(scores.term, term),
        eq(scores.school_id, schoolId || '')
      ));

    // Build subject position and average map
    const subjectPositions: Record<string, number> = {};
    const subjectAverages: Record<string, number> = {};
    const subjectTotals: Record<string, number[]> = {};

    for (const cs of classScores) {
      if (!subjectTotals[cs.subject_id]) subjectTotals[cs.subject_id] = [];
      const manualTotal = (cs.ca1_score || 0) + (cs.ca2_score || 0) + (cs.exam_score || 0) +
                         [cs.t1, cs.t2, cs.t3, cs.t4, cs.t5, cs.t6, cs.t7, cs.t8, cs.t9, cs.t10].reduce((acc, v) => acc + (v ? parseFloat(v as any) : 0), 0);
      const effectiveTotal = cs.total || manualTotal || 0;
      subjectTotals[cs.subject_id].push(effectiveTotal);
    }

    for (const [subId, totals] of Object.entries(subjectTotals)) {
      const sorted = [...totals].sort((a, b) => b - a);
      const studentScore = classScores.find(cs => cs.student_id === studentId && cs.subject_id === subId);
      if (studentScore) {
        const manualTotal = (studentScore.ca1_score || 0) + (studentScore.ca2_score || 0) + (studentScore.exam_score || 0) +
                           [studentScore.t1, studentScore.t2, studentScore.t3, studentScore.t4, studentScore.t5, studentScore.t6, studentScore.t7, studentScore.t8, studentScore.t9, studentScore.t10].reduce((acc, v) => acc + (v ? parseFloat(v as any) : 0), 0);
        const effectiveTotal = studentScore.total || manualTotal || 0;
        subjectPositions[subId] = sorted.indexOf(effectiveTotal) + 1;
      }
      const sum = totals.reduce((a, b) => a + b, 0);
      subjectAverages[subId] = totals.length > 0 ? Math.round((sum / totals.length) * 10) / 10 : 0;
    }

    // Class total scores for overall position
    const allStudentTotalsMap: Record<string, number> = {};
    classScores.forEach(cs => {
      const manualTotal = (cs.ca1_score || 0) + (cs.ca2_score || 0) + (cs.exam_score || 0) +
                         [cs.t1, cs.t2, cs.t3, cs.t4, cs.t5, cs.t6, cs.t7, cs.t8, cs.t9, cs.t10].reduce((acc, v) => acc + (v ? parseFloat(v as any) : 0), 0);
      const effectiveTotal = cs.total || manualTotal || 0;
      allStudentTotalsMap[cs.student_id] = (allStudentTotalsMap[cs.student_id] || 0) + effectiveTotal;
    });

    const allStudentTotalsList = Object.entries(allStudentTotalsMap).map(([id, total]) => ({ student_id: id, grand_total: total }));
    const classSize = allStudentTotalsList.length;
    let studentTotal = allStudentTotalsMap[studentId] || 0;

    const sortedTotals = [...allStudentTotalsList].sort((a, b) => b.grand_total - a.grand_total);
    const overallPosition = sortedTotals.findIndex(s => s.student_id === studentId) + 1;

    // Map scores and ensure total is calculated if it's 0 but ca/exam exists
    const processedTermScores = termScores.map((s: any) => {
      const manualTotal = (s.ca1_score || 0) + (s.ca2_score || 0) + (s.exam_score || 0) +
                         [s.t1, s.t2, s.t3, s.t4, s.t5, s.t6, s.t7, s.t8, s.t9, s.t10].reduce((acc, v) => acc + (v ? parseFloat(v) : 0), 0);
      const effectiveTotal = (s.total || manualTotal || 0);

      return {
        ...s,
        total: effectiveTotal,
        grade: calculateGrade(effectiveTotal, 100, grading).grade,
        position: subjectPositions[s.subject_id] || 0,
        class_average: subjectAverages[s.subject_id] || 0,
        classSize,
      };
    });

    const studentTotalAdjusted = processedTermScores.reduce((sum, s) => sum + (s.total || 0), 0);
    const subjectsTaken = processedTermScores.length;
    const maxScorePossible = subjectsTaken * 100;
    const overallPercentage = maxScorePossible > 0 ? Math.round((studentTotalAdjusted / maxScorePossible) * 100) : 0;

    termData[term] = {
      scores: processedTermScores,
      total: studentTotalAdjusted,
      overallPercentage,
      overallPosition,
      classSize,
    };
  }

  // Get affective traits
  const traits = await db.select().from(affectiveTraits)
    .where(and(
      eq(affectiveTraits.student_id, studentId),
      eq(affectiveTraits.session_id, sessionId),
      eq(affectiveTraits.school_id, schoolId || '')
    ));

  // Get attendance
  const attendanceResults = await db.select().from(attendance)
    .where(and(
      eq(attendance.student_id, studentId),
      eq(attendance.session_id, sessionId),
      eq(attendance.school_id, schoolId || '')
    ));

  // Get comments
  const commentsResults = await db.select().from(teacherComments)
    .where(and(
      eq(teacherComments.student_id, studentId),
      eq(teacherComments.session_id, sessionId),
      eq(teacherComments.school_id, schoolId || '')
    ));

  // Build subject list
  const allSubjectIds = new Set(allScores.map((s: any) => s.subject_id));
  const allSubjects = Array.from(allSubjectIds).map(id => {
    const s = allScores.find((sc: any) => sc.subject_id === id) as any;
    return { id, name: s?.subject_name || '', category: s?.category || '' };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // Compute cumulative data
  const subjectCumulative = allSubjects.map(sub => {
    const t1 = termData[1]?.scores.find((s: any) => s.subject_id === sub.id);
    const t2 = termData[2]?.scores.find((s: any) => s.subject_id === sub.id);
    const t3 = termData[3]?.scores.find((s: any) => s.subject_id === sub.id);

    const validTerms12 = [t1, t2].filter(t => t && (t.total || 0) > 0);
    const cum12Total = validTerms12.reduce((sum, t) => sum + (t?.total || 0), 0);
    const cum12Ave = validTerms12.length > 0 ? cum12Total / validTerms12.length : 0;
    const cum12Grade = cum12Ave > 0 ? calculateGrade(cum12Ave, 100, grading).grade : '';
    const class12Ave = validTerms12.length > 0 ? validTerms12.reduce((sum, t) => sum + (t?.class_average || 0), 0) / validTerms12.length : 0;

    const validTermsFinal = [t1, t2, t3].filter(t => t && (t.total || 0) > 0);
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
    attendance: attendanceResults.reduce((acc, a) => { acc[a.term] = a; return acc; }, {} as Record<number, any>),
    comments: commentsResults.reduce((acc, c) => { acc[c.term] = c; return acc; }, {} as Record<number, any>),
  });
}
