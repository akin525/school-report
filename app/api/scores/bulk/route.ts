import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { students, classes, subjects, teacherAssignments, scores as scoresTable } from '@/lib/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { scores: data, sessionId, term, schoolId } = await req.json();
    const sId = schoolId || session.schoolId;

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'No scores data provided' }, { status: 400 });
    }

    let teacherId = '';
    if (session.role === 'teacher') {
      const { teachers } = await import('@/lib/schema');
      const teacherResult = await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.user_id, session.userId)).limit(1);
      const teacher = teacherResult[0];
      if (!teacher) return NextResponse.json({ error: 'Teacher record not found' }, { status: 404 });
      teacherId = teacher.id;
    }

    // Fetch all subjects for fuzzy name matching
    const allSubjects = await db.select().from(subjects).where(eq(subjects.school_id, sId || ''));

    // subjectLookup by category then by name
    const subjectLookup = new Map<string, Map<string, any>>();

    allSubjects.forEach(s => {
      const cat = s.category || 'secondary';
      if (!subjectLookup.has(cat)) subjectLookup.set(cat, new Map());

      const catMap = subjectLookup.get(cat)!;
      catMap.set(s.name.toLowerCase(), s);
      const sanitized = s.name.replace(/[:\\/?*\[\]]/g, "_").substring(0, 31).toLowerCase();
      catMap.set(sanitized, s);
    });

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    await db.transaction(async (tx) => {
      const assignmentCache = new Map<string, { assignedSubjectIds: Set<string>, isClassTeacher: boolean }>();

      for (const item of data) {
        try {
          // 1. Get student
          const studentResult = await tx.select({
            id: students.id,
            class_id: students.class_id,
            class_category: classes.category
          })
            .from(students)
            .leftJoin(classes, eq(classes.id, students.class_id))
            .where(and(eq(students.admission_number, item.admission_number), eq(students.school_id, sId || '')))
            .limit(1);

          const student = studentResult[0];
          if (!student) {
            results.failed++;
            results.errors.push(`Student "${item.admission_number}" not found.`);
            continue;
          }

          // 2. Get subject within the student's class category
          const cat = student.class_category || 'secondary';
          const catMap = subjectLookup.get(cat);
          const subject = catMap?.get(item.subject_name.toLowerCase());

          if (!subject) {
            results.failed++;
            results.errors.push(`Subject "${item.subject_name}" not found in category "${cat}".`);
            continue;
          }

          // 3. Role-based validation
          if (session.role === 'teacher') {
            const cacheKey = student.class_id || 'no_class';
            if (!assignmentCache.has(cacheKey)) {
              const assigns = await tx.select({ subject_id: teacherAssignments.subject_id })
                .from(teacherAssignments)
                .where(and(
                  eq(teacherAssignments.teacher_id, teacherId),
                  eq(teacherAssignments.class_id, student.class_id || ''),
                  eq(teacherAssignments.session_id, sessionId),
                  eq(teacherAssignments.school_id, sId || '')
                ));

              assignmentCache.set(cacheKey, {
                assignedSubjectIds: new Set(assigns.filter(a => a.subject_id).map(a => a.subject_id!)),
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

          const termValue = parseInt(item.term || term);

          await tx.insert(scoresTable).values({
            id: uuidv4(),
            school_id: sId || '',
            student_id: student.id,
            class_id: student.class_id || '',
            session_id: sessionId,
            term: termValue,
            subject_id: subject.id,
            ca1_score: item.ca1 || 0,
            ca2_score: item.ca2 || 0,
            exam_score: item.exam || 0,
            total: (item.ca1 || 0) + (item.ca2 || 0) + (item.exam || 0)
          }).onDuplicateKeyUpdate({
            set: {
              ca1_score: item.ca1 || 0,
              ca2_score: item.ca2 || 0,
              exam_score: item.exam || 0,
              total: (item.ca1 || 0) + (item.ca2 || 0) + (item.exam || 0),
              updated_at: new Date()
            }
          });

          results.success++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(`Error processing ${item.admission_number}: ${err.message}`);
        }
      }
    });

    return NextResponse.json({ success: true, count: results.success, failed: results.failed, errors: results.errors });
  } catch (error: any) {
    console.error('Bulk score upload error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process bulk upload' }, { status: 500 });
  }
}

