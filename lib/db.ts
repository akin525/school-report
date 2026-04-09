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
      address TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      logo_url TEXT,
      motto TEXT,
      nursery_max_ca1 REAL DEFAULT 20,
      nursery_max_ca2 REAL DEFAULT 20,
      nursery_max_exam REAL DEFAULT 60,
      primary_max_ca1 REAL DEFAULT 20,
      primary_max_ca2 REAL DEFAULT 20,
      primary_max_exam REAL DEFAULT 60,
      secondary_max_ca1 REAL DEFAULT 20,
      secondary_max_ca2 REAL DEFAULT 20,
      secondary_max_exam REAL DEFAULT 60,
      max_ca1 REAL DEFAULT 20,
      max_ca2 REAL DEFAULT 20,
      max_exam REAL DEFAULT 60,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Users (superadmin, school_admin, teacher)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      school_id TEXT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('superadmin','school_admin','teacher')),
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
  `);
}

export default getDb;