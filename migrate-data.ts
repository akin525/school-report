import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import path from 'path';
import * as schema from './lib/schema';
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

  // Order matters for foreign keys!
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
    // Disable foreign key checks for the duration of the migration to avoid order issues
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of tables) {
      console.log(`📦 Migrating table: ${table.name}...`);

      // Read all rows from SQLite
      const rows = sqlite.prepare(`SELECT * FROM ${table.name}`).all();

      if (rows.length === 0) {
        console.log(`  - Table is empty, skipping.`);
        continue;
      }

      console.log(`  - Found ${rows.length} rows.`);

      // Clear existing data in MySQL if any (be careful!)
      await db.delete(table.schema);

      // MySQL might have a limit on how many rows can be inserted at once
      // We'll chunk the inserts into groups of 100
      const CHUNK_SIZE = 100;
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);

        // Data cleaning: SQLite sometimes returns 1/0 for booleans,
        // and MySQL needs Date objects for some fields if we defined them as datetime in Drizzle
        const processedChunk = chunk.map((row: any) => {
          const newRow = { ...row };

          // Fix datetime fields (SQLite returns strings, MySQL/Drizzle expects Date or MySQL string)
          if (newRow.created_at) newRow.created_at = new Date(newRow.created_at);
          if (newRow.updated_at) newRow.updated_at = new Date(newRow.updated_at);
          if (newRow.start_time) newRow.start_time = new Date(newRow.start_time);
          if (newRow.end_time) newRow.end_time = new Date(newRow.end_time);
          if (newRow.submitted_at) newRow.submitted_at = new Date(newRow.submitted_at);

          // Handle JSON fields (SQLite stores as string, Drizzle for MySQL expects object/array)
          if (table.name === 'exam_submissions' && typeof newRow.answers === 'string') {
            try {
               newRow.answers = JSON.parse(newRow.answers);
            } catch (e) {
               newRow.answers = {};
            }
          }

          return newRow;
        });

        await db.insert(table.schema).values(processedChunk);
      }

      console.log(`  ✅ ${table.name} migration complete.`);
    }

    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\n✨ All data successfully migrated to MySQL!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  } finally {
    sqlite.close();
    await connection.end();
    process.exit(0);
  }
}

migrate();
