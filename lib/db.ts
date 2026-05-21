import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'school.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(db: Database.Database) {
  db.exec(`
    -- Schools (multi-tenant)
    CREATE TABLE IF NOT EXISTS schools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nursery_name TEXT,
      primary_name TEXT,
      secondary_name TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      logo_url TEXT,
      motto TEXT,
      nursery_max_ca1 REAL DEFAULT 20,
      nursery_max_ca2 REAL DEFAULT 20,
      nursery_max_exam REAL DEFAULT 60,
      nursery_max_weekly REAL DEFAULT 10,
      primary_max_ca1 REAL DEFAULT 20,
      primary_max_ca2 REAL DEFAULT 20,
      primary_max_exam REAL DEFAULT 60,
      primary_max_weekly REAL DEFAULT 10,
      secondary_max_ca1 REAL DEFAULT 20,
      secondary_max_ca2 REAL DEFAULT 20,
      secondary_max_exam REAL DEFAULT 60,
      secondary_max_weekly REAL DEFAULT 10,
      max_ca1 REAL DEFAULT 20,
      max_ca2 REAL DEFAULT 20,
      max_exam REAL DEFAULT 60,
      max_weekly REAL DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Users (superadmin, school_admin, teacher)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      school_id TEXT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('superadmin','school_admin','teacher','student')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );

    -- Academic Sessions
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      name TEXT NOT NULL,
      start_year INTEGER NOT NULL,
      end_year INTEGER NOT NULL,
      is_current INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );
  `);

  // Helper to add column if not exists
  const addColumn = (table: string, col: string, type: string) => {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    } catch (e) {
      // Column likely exists
    }
  };

  // Schools migrations
  addColumn('schools', 'nursery_name', 'TEXT');
  addColumn('schools', 'primary_name', 'TEXT');
  addColumn('schools', 'secondary_name', 'TEXT');
  addColumn('schools', 'nursery_max_ca1', 'REAL DEFAULT 20');
  addColumn('schools', 'nursery_max_ca2', 'REAL DEFAULT 20');
  addColumn('schools', 'nursery_max_exam', 'REAL DEFAULT 60');
  addColumn('schools', 'nursery_max_weekly', 'REAL DEFAULT 10');
  addColumn('schools', 'primary_max_ca1', 'REAL DEFAULT 20');
  addColumn('schools', 'primary_max_ca2', 'REAL DEFAULT 20');
  addColumn('schools', 'primary_max_exam', 'REAL DEFAULT 60');
  addColumn('schools', 'primary_max_weekly', 'REAL DEFAULT 10');
  addColumn('schools', 'secondary_max_ca1', 'REAL DEFAULT 20');
  addColumn('schools', 'secondary_max_ca2', 'REAL DEFAULT 20');
  addColumn('schools', 'secondary_max_exam', 'REAL DEFAULT 60');
  addColumn('schools', 'secondary_max_weekly', 'REAL DEFAULT 10');

  db.exec(`
    -- Classes / Arms
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      name TEXT NOT NULL,
      arm TEXT,
      level TEXT,
      category TEXT DEFAULT 'secondary' CHECK(category IN ('nursery','primary','secondary')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );

    -- Subjects
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT,
      category TEXT DEFAULT 'secondary' CHECK(category IN ('nursery','primary','secondary')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );

    -- Teachers
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      user_id TEXT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      qualification TEXT,
      category TEXT DEFAULT 'secondary' CHECK(category IN ('primary','secondary')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Teacher-Subject-Class Assignments
    CREATE TABLE IF NOT EXISTS teacher_assignments (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      subject_id TEXT, -- Made optional for Primary teachers
      class_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      UNIQUE(teacher_id, subject_id, class_id, session_id)
    );

    -- Students
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      admission_number TEXT UNIQUE,
      first_name TEXT NOT NULL,
      middle_name TEXT,
      last_name TEXT NOT NULL,
      class_id TEXT,
      date_of_birth TEXT,
      gender TEXT,
      photo_url TEXT,
      admission_year TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
    );

    -- Class Subjects (which subjects are offered in a class)
    CREATE TABLE IF NOT EXISTS class_subjects (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      school_id TEXT NOT NULL,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      UNIQUE(class_id, subject_id)
    );

    -- Scores
    CREATE TABLE IF NOT EXISTS scores (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      term INTEGER NOT NULL CHECK(term IN (1,2,3)),
      ca1_score REAL DEFAULT 0,
      ca2_score REAL DEFAULT 0,
      exam_score REAL DEFAULT 0,
      t1 REAL, t2 REAL, t3 REAL, t4 REAL, t5 REAL,
      t6 REAL, t7 REAL, t8 REAL, t9 REAL, t10 REAL,
      total REAL GENERATED ALWAYS AS (ca1_score + ca2_score + exam_score) STORED,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      UNIQUE(student_id, subject_id, session_id, term)
    );
  `);

  // Scores migrations for weekly scores (t1-t10)
  for (let i = 1; i <= 10; i++) {
    addColumn('scores', `t${i}`, 'REAL');
  }

  db.exec(`
    -- Affective Traits
    CREATE TABLE IF NOT EXISTS affective_traits (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      term INTEGER NOT NULL,
      homework TEXT,
      punctuality TEXT,
      interaction TEXT,
      leadership TEXT,
      politeness TEXT,
      conduct TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(student_id, session_id, term)
    );

    -- Attendance
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      term INTEGER NOT NULL,
      times_school_opened INTEGER DEFAULT 0,
      times_present INTEGER DEFAULT 0,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(student_id, session_id, term)
    );

    -- Grading System (per school)
    CREATE TABLE IF NOT EXISTS grading_system (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      grade TEXT NOT NULL,
      min_score REAL NOT NULL,
      max_score REAL NOT NULL,
      remark TEXT,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );

    -- Physical Development
    CREATE TABLE IF NOT EXISTS physical_dev (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      term INTEGER NOT NULL,
      weight_from REAL,
      weight_to REAL,
      height_from REAL,
      height_to REAL,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(student_id, session_id, term)
    );

    -- Teacher Comments
    CREATE TABLE IF NOT EXISTS teacher_comments (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      term INTEGER NOT NULL,
      class_teacher_comment TEXT,
      class_teacher_signature TEXT,
      class_teacher_date TEXT,
      coordinator_remark TEXT,
      coordinator_signature TEXT,
      coordinator_date TEXT,
      next_term_starts TEXT,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(student_id, session_id, term)
    );

    -- Lesson Notes
    CREATE TABLE IF NOT EXISTS lesson_notes (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      term INTEGER NOT NULL CHECK(term IN (1,2,3)),
      title TEXT NOT NULL,
      content TEXT,
      file_url TEXT,
      file_name TEXT,
      file_type TEXT,
      topic TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    -- Generated Questions (Multiple Choice)
    CREATE TABLE IF NOT EXISTS generated_questions (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      lesson_note_id TEXT NOT NULL,
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      correct_answer_text TEXT,
      question_type TEXT DEFAULT 'multiple_choice',
      difficulty TEXT DEFAULT 'medium' CHECK(difficulty IN ('easy','medium','hard')),
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (lesson_note_id) REFERENCES lesson_notes(id) ON DELETE CASCADE
    );

    -- Question Bank (Teacher Uploaded Questions)
    CREATE TABLE IF NOT EXISTS question_bank (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      term INTEGER NOT NULL CHECK(term IN (1,2,3)),
      question_text TEXT NOT NULL,
      option_a TEXT,
      option_b TEXT,
      option_c TEXT,
      option_d TEXT,
      correct_answer TEXT NOT NULL,
      question_type TEXT DEFAULT 'multiple_choice' CHECK(question_type IN ('multiple_choice','short_answer','essay','true_false')),
      difficulty TEXT DEFAULT 'medium' CHECK(difficulty IN ('easy','medium','hard')),
      marks INTEGER DEFAULT 1,
      file_url TEXT,
      file_name TEXT,
      file_type TEXT,
      topic TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );
  `);

  // Migrations for newer columns in question tables
  addColumn('students', 'user_id', 'TEXT');
  addColumn('students', 'email', 'TEXT');

  // Fix users table constraint by recreating it if 'student' role is missing
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as any;
    if (tableInfo && !tableInfo.sql.includes("'student'")) {
      console.log("Migrating users table to support student role...");
      db.exec(`
        PRAGMA foreign_keys=OFF;
        BEGIN TRANSACTION;
        CREATE TABLE users_new (
          id TEXT PRIMARY KEY,
          school_id TEXT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('superadmin','school_admin','teacher','student')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
        );
        INSERT INTO users_new (id, school_id, name, email, password_hash, role, created_at)
        SELECT id, school_id, name, email, password_hash, role, created_at FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
        COMMIT;
        PRAGMA foreign_keys=ON;
      `);
    }
  } catch (e) {
    console.error("Migration failed:", e);
  }

  addColumn('generated_questions', 'question_type', "TEXT DEFAULT 'multiple_choice'");
  addColumn('generated_questions', 'correct_answer_text', 'TEXT');
  addColumn('generated_questions', 'note', 'TEXT');
  addColumn('question_bank', 'note', 'TEXT');

  // AI Settings for Schools
  addColumn('schools', 'openai_api_key', 'TEXT');
  addColumn('schools', 'gemini_api_key', 'TEXT');
  addColumn('schools', 'ai_enabled', 'INTEGER DEFAULT 1');

  db.exec(`
    -- Announcements
    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      target_role TEXT DEFAULT 'all',
      target_class_id TEXT,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (target_class_id) REFERENCES classes(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Timetable
    CREATE TABLE IF NOT EXISTS timetable (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      teacher_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
    );

    -- Exams (Timed Sessions)
    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      title TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      term INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      duration_minutes INTEGER NOT NULL,
      total_marks INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Exam Submissions
    CREATE TABLE IF NOT EXISTS exam_submissions (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      score REAL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      answers TEXT, -- JSON string of answers
      FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(exam_id, student_id)
    );

    -- Exam Questions Mapping
    CREATE TABLE IF NOT EXISTS exam_questions (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      marks INTEGER DEFAULT 1,
      order_index INTEGER,
      FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES question_bank(id) ON DELETE CASCADE
    );
  `);
}

export default getDb;