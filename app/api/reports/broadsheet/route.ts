import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { calculateGrade } from '@/lib/grading';
import { db } from '@/lib/db';
import { classes, schools, sessions, gradingSystem, teacherAssignments, teachers, students, scores, subjects } from '@/lib/schema';
import { eq, and, isNull, desc, asc, inArray, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const sessionId = searchParams.get('sessionId');
  const termParam = searchParams.get('term');
  const schoolId = searchParams.get('schoolId') || session.schoolId;

  if (!classId || !sessionId || !termParam) {
    return NextResponse.json({ error: 'classId, sessionId and term required' }, { status: 400 });
  }

  const term = parseInt(termParam);

  // Get class info
  const classInfoResult = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);
  const classInfo = classInfoResult[0];

  const schoolResult = await db.select().from(schools).where(eq(schools.id, schoolId || '')).limit(1);
  const school = schoolResult[0];

  const academicSessionResult = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  const academicSession = academicSessionResult[0];

  const grading = await db.select().from(gradingSystem)
    .where(eq(gradingSystem.school_id, schoolId || ''))
    .orderBy(desc(gradingSystem.min_score));

  // Get class teacher
  const classTeacherResult = await db.select({ name: teachers.name })
    .from(teacherAssignments)
    .innerJoin(teachers, eq(teachers.id, teacherAssignments.teacher_id))
    .where(and(
      eq(teacherAssignments.class_id, classId),
      eq(teacherAssignments.session_id, sessionId),
      isNull(teacherAssignments.subject_id),
      eq(teacherAssignments.school_id, schoolId || '')
    ))
    .limit(1);
  const classTeacher = classTeacherResult[0];

  // Get all students in class (either currently assigned or had scores in this class/session)
  const currentStudents = await db.select().from(students)
    .where(and(eq(students.class_id, classId), eq(students.school_id, schoolId || '')));

  const historicalStudentsResult = await db.selectDistinct({
    id: students.id,
    school_id: students.school_id,
    user_id: students.user_id,
    first_name: students.first_name,
    middle_name: students.middle_name,
    last_name: students.last_name,
    admission_number: students.admission_number,
    photo_url: students.photo_url,
    class_id: students.class_id,
    gender: students.gender,
    status: students.status
  })
    .from(scores)
    .innerJoin(students, eq(students.id, scores.student_id))
    .where(and(
      eq(scores.class_id, classId),
      eq(scores.session_id, sessionId),
      eq(scores.school_id, schoolId || '')
    ));

  // Merge and deduplicate students
  const studentMap = new Map();
  [...currentStudents, ...historicalStudentsResult].forEach(s => {
    studentMap.set(s.id, s);
  });
  const classStudents = Array.from(studentMap.values()).sort((a, b) => {
    const ln = (a.last_name || '').localeCompare(b.last_name || '');
    if (ln !== 0) return ln;
    return (a.first_name || '').localeCompare(b.first_name || '');
  });

  // Get all subjects that have scores for this class/term
  const subjectsWithScores = await db.selectDistinct({
    id: subjects.id,
    name: subjects.name,
    category: subjects.category
  })
    .from(scores)
    .innerJoin(subjects, eq(subjects.id, scores.subject_id))
    .where(and(
      eq(scores.class_id, classId),
      eq(scores.session_id, sessionId),
      eq(scores.term, term),
      eq(scores.school_id, schoolId || '')
    ))
    .orderBy(asc(subjects.name));

  // Get all scores
  const allScores = await db.select().from(scores)
    .where(and(
      eq(scores.class_id, classId),
      eq(scores.session_id, sessionId),
      eq(scores.term, term),
      eq(scores.school_id, schoolId || '')
    ));

  // Build broadsheet data
  const broadsheetRaw = classStudents.map(student => {
    const studentScores: Record<string, any> = {};
    let grandTotal = 0;
    let subjectCount = 0;

    for (const subject of subjectsWithScores) {
      const score = allScores.find(s => s.student_id === student.id && s.subject_id === subject.id && Number(s.term) === term);
      if (score) {
        let extraTotal = 0;
        [score.t1, score.t2, score.t3, score.t4, score.t5, score.t6, score.t7, score.t8, score.t9, score.t10].forEach(v => {
          if (v) extraTotal += Number(v);
        });
        const caTotal = Math.max((score.ca1_score || 0) + (score.ca2_score || 0), extraTotal);
        const manualTotal = caTotal + (score.exam_score || 0);
        const effectiveTotal = Math.min(100, score.total && score.total > 0 && score.total <= 100 ? score.total : manualTotal);

        studentScores[subject.id] = {
          ca: (score.ca1_score || 0) + (score.ca2_score || 0),
          exam: score.exam_score,
          total: effectiveTotal,
          grade: calculateGrade(effectiveTotal, 100, grading).grade,
        };
        grandTotal += effectiveTotal;
        subjectCount++;
      } else {
        studentScores[subject.id] = null;
      }
    }

    const average = subjectCount > 0 ? grandTotal / subjectCount : 0;

    return {
      student,
      scores: studentScores,
      grandTotal,
      average: Math.round(average * 10) / 10,
      position: 0,
    };
  });

  // Calculate positions
  const sortedByTotal = [...broadsheetRaw].sort((a, b) => b.grandTotal - a.grandTotal);
  const broadsheet = broadsheetRaw.map(row => ({
    ...row,
    position: sortedByTotal.findIndex(r => r.student.id === row.student.id) + 1,
  }));

  // Calculate subject positions
  for (const subject of subjectsWithScores) {
    const subjectScores = broadsheet
      .filter(r => r.scores[subject.id] !== null)
      .sort((a, b) => (b.scores[subject.id]?.total || 0) - (a.scores[subject.id]?.total || 0));

    for (const row of broadsheet) {
      if (row.scores[subject.id]) {
        row.scores[subject.id] = {
          ...row.scores[subject.id],
          position: subjectScores.findIndex(r => r.student.id === row.student.id) + 1,
          classSize: subjectScores.length,
        };
      }
    }
  }

  return NextResponse.json({
    school,
    session: academicSession,
    grading,
    class: classInfo,
    classTeacher: classTeacher || null,
    term,
    subjects: subjectsWithScores,
    broadsheet,
    classSize: classStudents.length,
  });
}
