import { NextRequest, NextResponse } from 'next/server';
import { getSession, getGrade } from '@/lib/auth';
import getDb from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const sessionId = searchParams.get('sessionId');
  const term = searchParams.get('term');
  const schoolId = searchParams.get('schoolId') || session.schoolId;

  if (!classId || !sessionId || !term) {
    return NextResponse.json({ error: 'classId, sessionId and term required' }, { status: 400 });
  }

  const db = getDb();

  // Get class info
  const classInfo = db.prepare('SELECT * FROM classes WHERE id=?').get(classId) as any;
  const school = db.prepare('SELECT * FROM schools WHERE id=?').get(schoolId) as any;
  const academicSession = db.prepare('SELECT * FROM sessions WHERE id=?').get(sessionId) as any;

  // Get class teacher
  const classTeacher = db.prepare(`
    SELECT t.name
    FROM teacher_assignments ta
    JOIN teachers t ON t.id = ta.teacher_id
    WHERE ta.class_id = ? AND ta.session_id = ? AND ta.subject_id IS NULL AND ta.school_id = ?
  `).get(classId, sessionId, schoolId) as any;

  // Get all students in class
  const students = db.prepare(`
    SELECT * FROM students WHERE class_id=? AND school_id=? ORDER BY last_name, first_name
  `).all(classId, schoolId) as any[];

  // Get all subjects for this class
  const subjects = db.prepare(`
    SELECT DISTINCT sub.id, sub.name, sub.category
    FROM scores sc
    JOIN subjects sub ON sub.id = sc.subject_id
    WHERE sc.class_id=? AND sc.session_id=? AND sc.term=? AND sc.school_id=?
    ORDER BY sub.name
  `).all(classId, sessionId, parseInt(term), schoolId) as any[];

  // Get all scores
  const allScores = db.prepare(`
    SELECT * FROM scores
    WHERE class_id=? AND session_id=? AND term=? AND school_id=?
  `).all(classId, sessionId, parseInt(term), schoolId) as any[];

  // Build broadsheet data
  const broadsheetRaw = students.map(student => {
    const studentScores: Record<string, any> = {};
    let grandTotal = 0;
    let subjectCount = 0;

    for (const subject of subjects) {
      const score = allScores.find(s => s.student_id === student.id && s.subject_id === subject.id);
      if (score) {
        studentScores[subject.id] = {
          ca: score.ca_score,
          exam: score.exam_score,
          total: score.total,
          grade: getGrade(score.total),
        };
        grandTotal += score.total;
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
  for (const subject of subjects) {
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
    class: classInfo,
    classTeacher: classTeacher || null,
    term: parseInt(term),
    subjects,
    broadsheet,
    classSize: students.length,
  });
}