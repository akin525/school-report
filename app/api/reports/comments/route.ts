import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const sessionId = searchParams.get('sessionId');
  const term = parseInt(searchParams.get('term') || '1');
  const schoolId = session.schoolId;

  if (!classId || !sessionId) {
    return NextResponse.json({ error: 'classId and sessionId required' }, { status: 400 });
  }

  const db = getDb();

  // If user is a teacher, check if they are the assigned Class Teacher for this class
  if (session.role === 'teacher') {
    const teacher = db.prepare('SELECT id FROM teachers WHERE user_id = ?').get(session.userId) as any;
    if (!teacher) return NextResponse.json({ error: 'Teacher profile not found' }, { status: 404 });

    const assignment = db.prepare(`
      SELECT id FROM teacher_assignments 
      WHERE teacher_id = ? AND class_id = ? AND session_id = ? AND subject_id IS NULL
    `).get(teacher.id, classId, sessionId);

    if (!assignment) {
      return NextResponse.json({ error: 'You are not assigned as the Class Teacher for this class' }, { status: 403 });
    }
  }

  // Get all students in the class
  const students = db.prepare(`
    SELECT id, first_name, middle_name, last_name, admission_number
    FROM students
    WHERE class_id = ? AND school_id = ?
    ORDER BY first_name, last_name
  `).all(classId, schoolId) as any[];

  // Get existing comments for these students
  const comments = db.prepare(`
    SELECT * FROM teacher_comments
    WHERE student_id IN (${students.map(() => '?').join(',')})
    AND session_id = ? AND term = ? AND school_id = ?
  `).all(...students.map(s => s.id), sessionId, term, schoolId) as any[];

  return NextResponse.json({ students, comments });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { classId, sessionId, term, settings, individualComments } = body;
  const schoolId = session.schoolId;

  if (!classId || !sessionId || !term) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const db = getDb();

  // If user is a teacher, check if they are the assigned Class Teacher for this class
  if (session.role === 'teacher') {
    const teacher = db.prepare('SELECT id FROM teachers WHERE user_id = ?').get(session.userId) as any;
    if (!teacher) return NextResponse.json({ error: 'Teacher profile not found' }, { status: 404 });

    const assignment = db.prepare(`
      SELECT id FROM teacher_assignments 
      WHERE teacher_id = ? AND class_id = ? AND session_id = ? AND subject_id IS NULL
    `).get(teacher.id, classId, sessionId);

    if (!assignment) {
      return NextResponse.json({ error: 'You are not assigned as the Class Teacher for this class' }, { status: 403 });
    }
  }

  try {
    const transaction = db.transaction(() => {
      // 1. Batch Update Class Settings (Date, Signature, Next Term Starts)
      if (settings) {
        const { date, signature, nextTermStarts, coordinatorRemark, coordinatorSignature, coordinatorDate } = settings;
        const isTeacher = session.role === 'teacher';
        
        // Get all students in this class to update their individual records
        const students = db.prepare('SELECT id FROM students WHERE class_id = ? AND school_id = ?').all(classId, schoolId) as any[];

        for (const student of students) {
          const existing = db.prepare(`
            SELECT id FROM teacher_comments 
            WHERE student_id = ? AND session_id = ? AND term = ? AND school_id = ?
          `).get(student.id, sessionId, term, schoolId) as any;

          if (existing) {
            // If teacher, only update class teacher specific fields
            if (isTeacher) {
              db.prepare(`
                UPDATE teacher_comments 
                SET class_teacher_date = ?, class_teacher_signature = ?, next_term_starts = ?
                WHERE id = ?
              `).run(date, signature, nextTermStarts, existing.id);
            } else {
              db.prepare(`
                UPDATE teacher_comments 
                SET class_teacher_date = ?, class_teacher_signature = ?, next_term_starts = ?, 
                    coordinator_remark = ?, coordinator_signature = ?, coordinator_date = ?
                WHERE id = ?
              `).run(date, signature, nextTermStarts, coordinatorRemark, coordinatorSignature, coordinatorDate, existing.id);
            }
          } else {
            // New entry: only add coordinator fields if not a teacher
            db.prepare(`
              INSERT INTO teacher_comments (
                id, school_id, student_id, session_id, term, 
                class_teacher_date, class_teacher_signature, next_term_starts,
                coordinator_remark, coordinator_signature, coordinator_date
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              uuidv4(), schoolId, student.id, sessionId, term, date, signature, nextTermStarts, 
              isTeacher ? null : coordinatorRemark, 
              isTeacher ? null : coordinatorSignature, 
              isTeacher ? null : coordinatorDate
            );
          }
        }
      }

      // 2. Individual Comments Update
      if (individualComments && Array.isArray(individualComments)) {
        const isTeacher = session.role === 'teacher';
        for (const item of individualComments) {
          const { studentId, comment, coordinatorRemark } = item;
          
          const existing = db.prepare(`
            SELECT id FROM teacher_comments 
            WHERE student_id = ? AND session_id = ? AND term = ? AND school_id = ?
          `).get(studentId, sessionId, term, schoolId) as any;

          if (existing) {
            if (isTeacher) {
              db.prepare(`
                UPDATE teacher_comments 
                SET class_teacher_comment = ?
                WHERE id = ?
              `).run(comment, existing.id);
            } else {
              db.prepare(`
                UPDATE teacher_comments 
                SET class_teacher_comment = ?, coordinator_remark = COALESCE(?, coordinator_remark)
                WHERE id = ?
              `).run(comment, coordinatorRemark || null, existing.id);
            }
          } else {
            db.prepare(`
              INSERT INTO teacher_comments (
                id, school_id, student_id, session_id, term, class_teacher_comment, coordinator_remark
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(uuidv4(), schoolId, studentId, sessionId, term, comment, isTeacher ? null : (coordinatorRemark || null));
          }
        }
      }
    });

    transaction();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Comments update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
