import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'superadmin' && session.role !== 'school_admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  let mergedCount = 0;
  let deletedCount = 0;
  let updatedIdCount = 0;

  try {
    // 1. Get all students and their class categories
    const students = db.prepare(`
      SELECT s.id, s.school_id, c.category as class_category
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
    `).all() as any[];

    const transaction = db.transaction(() => {
      for (const student of students) {
        // Find all subjects (by name) that use multiple Subject IDs for this student in the same session
        const inconsistentSubjects = db.prepare(`
          SELECT sub.name as subject_name, sc.session_id, COUNT(DISTINCT sc.subject_id) as id_count
          FROM scores sc
          JOIN subjects sub ON sub.id = sc.subject_id
          WHERE sc.student_id = ?
          GROUP BY sub.name, sc.session_id
          HAVING id_count > 1
        `).all(student.id) as any[];

        for (const target of inconsistentSubjects) {
          // Get all score records for this subject name and session
          const allScoresForName = db.prepare(`
            SELECT sc.*, sub.category as subject_category
            FROM scores sc
            JOIN subjects sub ON sub.id = sc.subject_id
            WHERE sc.student_id = ? AND sc.session_id = ? AND sub.name = ?
          `).all(student.id, target.session_id, target.subject_name) as any[];

          // Get the unique subject IDs involved
          const subjectIds = Array.from(new Set(allScoresForName.map(s => s.subject_id)));

          // Determine the "correct" subject ID based on category
          // First, find all subjects with this name in the school
          const possibleSubjects = db.prepare('SELECT id, category FROM subjects WHERE school_id = ? AND name = ?')
            .all(student.school_id, target.subject_name) as any[];

          let correctSubjectId = possibleSubjects.find(s => (s.category || 'secondary') === (student.class_category || 'secondary'))?.id;

          // Fallback if no category match: use the ID that is most frequent in the score records
          if (!correctSubjectId) {
             const counts: Record<string, number> = {};
             allScoresForName.forEach(s => counts[s.subject_id] = (counts[s.subject_id] || 0) + 1);
             correctSubjectId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
          }

          // Process each term
          for (const term of [1, 2, 3]) {
            const scoresForTerm = allScoresForName.filter(s => s.term === term);
            if (scoresForTerm.length === 0) continue;

            const winner = scoresForTerm.find(s => s.subject_id === correctSubjectId);

            if (winner) {
              // We have a winner record. Merge any other records for this term into it.
              const losers = scoresForTerm.filter(s => s.id !== winner.id);
              for (const loser of losers) {
                const updateFields = [];
                const params = [];

                ['ca1_score', 'ca2_score', 'exam_score'].forEach(field => {
                  if ((winner[field] === 0 || winner[field] === null) && loser[field] > 0) {
                    updateFields.push(`${field} = ?`);
                    params.push(loser[field]);
                    winner[field] = loser[field];
                  }
                });

                for (let i = 1; i <= 10; i++) {
                  const field = `t${i}`;
                  if ((winner[field] === null || winner[field] === undefined) && loser[loser[field] !== null]) {
                    updateFields.push(`${field} = ?`);
                    params.push(loser[field]);
                  }
                }

                if (updateFields.length > 0) {
                  params.push(winner.id);
                  db.prepare(`UPDATE scores SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
                  mergedCount++;
                }
                db.prepare('DELETE FROM scores WHERE id = ?').run(loser.id);
                deletedCount++;
              }
            } else {
              // No record exists for the correct Subject ID in this term.
              // Move the best available record to the correct ID.
              const bestRecord = scoresForTerm.sort((a, b) => (b.total || 0) - (a.total || 0))[0];
              db.prepare('UPDATE scores SET subject_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(correctSubjectId, bestRecord.id);
              updatedIdCount++;

              // Delete any other records for this term (if any existed, though unlikely if no winner)
              const others = scoresForTerm.filter(s => s.id !== bestRecord.id);
              for (const other of others) {
                db.prepare('DELETE FROM scores WHERE id = ?').run(other.id);
                deletedCount++;
              }
            }
          }
        }
      }
    });

    transaction();

    return NextResponse.json({
      success: true,
      message: `Cleaned up across terms. Updated ${updatedIdCount} subject IDs, merged ${mergedCount} fields and deleted ${deletedCount} redundant score records.`
    });
  } catch (error: any) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
