import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { students, classes, scores, subjects } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'superadmin' && session.role !== 'school_admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let mergedCount = 0;
  let deletedCount = 0;
  let updatedIdCount = 0;

  try {
    // 1. Get all students and their class categories
    const allStudents = await db.select({
      id: students.id,
      school_id: students.school_id,
      class_category: classes.category
    })
      .from(students)
      .leftJoin(classes, eq(classes.id, students.class_id));

    await db.transaction(async (tx) => {
      for (const student of allStudents) {
        // Find all subjects (by name) that use multiple Subject IDs for this student in the same session
        const inconsistentSubjects = await tx.select({
          subject_name: subjects.name,
          session_id: scores.session_id,
          id_count: sql<number>`COUNT(DISTINCT ${scores.subject_id})`
        })
          .from(scores)
          .innerJoin(subjects, eq(subjects.id, scores.subject_id))
          .where(eq(scores.student_id, student.id))
          .groupBy(subjects.name, scores.session_id)
          .having(sql`COUNT(DISTINCT ${scores.subject_id}) > 1`);

        for (const target of inconsistentSubjects) {
          // Get all score records for this subject name and session
          const allScoresForName = await tx.select({
            score: scores,
            subject_category: subjects.category,
            subject_name: subjects.name
          })
            .from(scores)
            .innerJoin(subjects, eq(subjects.id, scores.subject_id))
            .where(and(
              eq(scores.student_id, student.id),
              eq(scores.session_id, target.session_id),
              eq(subjects.name, target.subject_name || '')
            ));

          // Determine the "correct" subject ID based on category
          const possibleSubjects = await tx.select({ id: subjects.id, category: subjects.category })
            .from(subjects)
            .where(and(
              eq(subjects.school_id, student.school_id || ''),
              eq(subjects.name, target.subject_name || '')
            ));

          let correctSubjectId = possibleSubjects.find(s => (s.category || 'secondary') === (student.class_category || 'secondary'))?.id;

          if (!correctSubjectId) {
             const counts: Record<string, number> = {};
             allScoresForName.forEach(item => counts[item.score.subject_id] = (counts[item.score.subject_id] || 0) + 1);
             correctSubjectId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
          }

          // Process each term
          for (const term of [1, 2, 3]) {
            const scoresForTerm = allScoresForName.filter(item => item.score.term === term);
            if (scoresForTerm.length === 0) continue;

            const winnerEntry = scoresForTerm.find(item => item.score.subject_id === correctSubjectId);

            if (winnerEntry) {
              const winner = winnerEntry.score;
              const losers = scoresForTerm.filter(item => item.score.id !== winner.id);
              for (const loserEntry of losers) {
                const loser = loserEntry.score;
                const updateData: any = {};

                ['ca1_score', 'ca2_score', 'exam_score'].forEach((field: string) => {
                  const f = field as keyof typeof winner;
                  if (((winner[f] as number) === 0 || winner[f] === null) && (loser[f] as number) > 0) {
                    updateData[f] = loser[f];
                    (winner as any)[f] = loser[f];
                  }
                });

                for (let i = 1; i <= 10; i++) {
                  const field = `t${i}` as keyof typeof winner;
                  if ((winner[field] === null || winner[field] === undefined) && loser[field] !== null) {
                    updateData[field] = loser[field];
                  }
                }

                if (Object.keys(updateData).length > 0) {
                  await tx.update(scores).set({ ...updateData, updated_at: new Date() }).where(eq(scores.id, winner.id));
                  mergedCount++;
                }
                await tx.delete(scores).where(eq(scores.id, loser.id));
                deletedCount++;
              }
            } else {
              const bestEntry = scoresForTerm.sort((a, b) => (b.score.total || 0) - (a.score.total || 0))[0];
              await tx.update(scores).set({
                subject_id: correctSubjectId!,
                updated_at: new Date()
              }).where(eq(scores.id, bestEntry.score.id));
              updatedIdCount++;

              const others = scoresForTerm.filter(item => item.score.id !== bestEntry.score.id);
              for (const other of others) {
                await tx.delete(scores).where(eq(scores.id, other.score.id));
                deletedCount++;
              }
            }
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Cleaned up across terms. Updated ${updatedIdCount} subject IDs, merged ${mergedCount} fields and deleted ${deletedCount} redundant score records.`
    });
  } catch (error: any) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

