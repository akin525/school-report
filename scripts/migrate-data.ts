import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import path from 'path';
import * as schema from '../lib/schema';
import * as dotenv from 'dotenv';

dotenv.config();

const SQLITE_DB_PATH = path.join(process.cwd(), 'data', 'school.db');
const MYSQL_URL = process.env.DATABASE_URL;

if (!MYSQL_URL) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

async function migrate() {
  console.log('🚀 Starting data migration from SQLite to MySQL...');

  const sqlite = new Database(SQLITE_DB_PATH);
  const connection = await mysql.createConnection(MYSQL_URL!);
  const db = drizzle(connection, { schema, mode: 'default' });

  // Migration order to respect basic hierarchy
  const tables = [
    { name: 'schools', schema: schema.schools },
    { name: 'users', schema: schema.users },
    { name: 'sessions', schema: schema.sessions },
    { name: 'classes', schema: schema.classes },
    { name: 'subjects', schema: schema.subjects },
    { name: 'teachers', schema: schema.teachers },
    { name: 'students', schema: schema.students },
    { name: 'class_subjects', schema: schema.classSubjects },
    { name: 'teacher_assignments', schema: schema.teacherAssignments },
    { name: 'grading_system', schema: schema.gradingSystem },
    { name: 'scores', schema: schema.scores },
    { name: 'attendance', schema: schema.attendance },
    { name: 'affective_traits', schema: schema.affectiveTraits },
    { name: 'physical_dev', schema: schema.physicalDev },
    { name: 'teacher_comments', schema: schema.teacherComments },
    { name: 'announcements', schema: schema.announcements },
    { name: 'lesson_notes', schema: schema.lessonNotes },
    { name: 'question_bank', schema: schema.questionBank },
    { name: 'exams', schema: schema.exams },
    { name: 'exam_submissions', schema: schema.examSubmissions },
    { name: 'timetable', schema: schema.timetable },
    { name: 'generated_questions', schema: schema.generatedQuestions }
  ];

  try {
    // Disable foreign key checks for the duration of the migration
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of tables) {
      console.log(`📦 Migrating table: ${table.name}...`);

      const rows = sqlite.prepare(`SELECT * FROM ${table.name}`).all();

      if (rows.length === 0) {
        console.log(`  - Table is empty, skipping.`);
        continue;
      }

      // Chunk inserts for performance and to stay under MySQL limits
      const CHUNK_SIZE = 100;
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);

        const processedChunk = chunk.map((row: any) => {
          const newRow = { ...row };

          // Convert SQLite date strings to JS Date objects for Drizzle/MySQL
          ['created_at', 'updated_at', 'start_time', 'end_time', 'submitted_at'].forEach(col => {
            if (newRow[col]) newRow[col] = new Date(newRow[col]);
          });

          // Parse JSON fields
          if (table.name === 'exam_submissions' && typeof newRow.answers === 'string') {
            try { newRow.answers = JSON.parse(newRow.answers); } catch { newRow.answers = {}; }
          }

          return newRow;
        });

        await db.insert(table.schema).values(processedChunk);
      }
      console.log(`  ✅ ${table.name} complete.`);
    }

    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\n✨ Data migration successfully finished!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  } finally {
    sqlite.close();
    await connection.end();
    process.exit(0);
  }
}

migrate();