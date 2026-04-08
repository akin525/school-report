import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { scores, sessionId, term, schoolId } = await req.json();
    const sId = schoolId || session.schoolId;

    if (!Array.isArray(scores) || scores.length === 0) {
      return NextResponse.json({ error: 'No scores data provided' }, { status: 400 });
    }

    const db = getDb();

    // 1. Determine teacher assignments if the user is a teacher
    let teacherAssignments: any[] = [];
    let isClassTeacher = false;
    let teacherId = '';

    if (session.role === 'teacher') {
      const teacher = db.prepare('SELECT id FROM teachers WHERE user_id = ?').get(session.userId) as any;
      if (!teacher) return NextResponse.json({ error: 'Teacher record not found' }, { status: 404 });
      teacherId = teacher.id;

      // We need to check assignments per student's class, but bulk upload usually targets one class.
      // Let's assume the frontend sends scores for a specific context.
      // For safety, we'll check assignments for each row's student class.
    }
    
    // Check for student existence by admission number and get their ID
    const studentStmt = db.prepare('SELECT id, class_id FROM students WHERE admission_number = ? AND school_id = ?');
    
    // Check for subject existence by name
    const subjectStmt = db.prepare('SELECT id FROM subjects WHERE name = ? AND school_id = ?');

    // Check for teacher assignments
    const assignmentStmt = db.prepare(`
      SELECT subject_id FROM teacher_assignments 
      WHERE teacher_id = ? AND class_id = ? AND session_id = ? AND school_id = ?
    `);

    const upsertScoreStmt = db.prepare(`
      INSERT INTO scores (id, school_id, student_id, class_id, session_id, term, subject_id, ca1_score, ca2_score, exam_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(student_id, subject_id, session_id, term) DO UPDATE SET
        ca1_score = excluded.ca1_score,
        ca2_score = excluded.ca2_score,
        exam_score = excluded.exam_score,
        updated_at = CURRENT_TIMESTAMP
    `);

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    const transaction = db.transaction((data) => {
      // Cache for assignments to avoid repeated DB calls for same class
      const assignmentCache = new Map<string, { assignedSubjectIds: Set<string>, isClassTeacher: boolean }>();

      for (const item of data) {
        try {
          // 1. Get student
          const student = studentStmt.get(item.admission_number, sId) as any;
          if (!student) {
            results.failed++;
            results.errors.push(`Student "${item.admission_number}" not found.`);
            continue;
          }

          // 2. Get subject
          const subject = subjectStmt.get(item.subject_name, sId) as any;
          if (!subject) {
            results.failed++;
            results.errors.push(`Subject "${item.subject_name}" not found.`);
            continue;
          }

          // 3. Role-based validation
          if (session.role === 'teacher') {
            const cacheKey = student.class_id;
            if (!assignmentCache.has(cacheKey)) {
              const assigns = assignmentStmt.all(teacherId, student.class_id, sessionId, sId) as any[];
              assignmentCache.set(cacheKey, {
                assignedSubjectIds: new Set(assigns.filter(a => a.subject_id).map(a => a.subject_id)),
                isClassTeacher: assigns.some(a => a.subject_id === null)
              });
            }

            const { assignedSubjectIds, isClassTeacher } = assignmentCache.get(cacheKey)!;
            if (!isClassTeacher && !assignedSubjectIds.has(subject.id)) {
              results.failed++;
              results.errors.push(`Access denied: You are not assigned to "${item.subject_name}" in ${item.admission_number}'s class.`);
              continue;
            }
          }

          upsertScoreStmt.run(
            uuidv4(),
            sId,
            student.id,
            student.class_id,
            sessionId,
            parseInt(term),
            subject.id,
            item.ca1 || 0,
            item.ca2 || 0,
            item.exam || 0
          );
          results.success++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(`Error processing ${item.admission_number}: ${err.message}`);
        }
      }
    });

    transaction(scores);

    return NextResponse.json({ success: true, count: results.success, failed: results.failed, errors: results.errors });
  } catch (error: any) {
    console.error('Bulk score upload error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process bulk upload' }, { status: 500 });
  }
}
