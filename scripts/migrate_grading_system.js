const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(process.cwd(), 'data', 'school.db');

if (!fs.existsSync(DB_PATH)) {
  console.error('Database file not found at:', DB_PATH);
  process.exit(1);
}

const db = new Database(DB_PATH);

const defaultGrades = [
  { grade: 'A+', min: 95, max: 100, remark: 'Distinction', color: '#166534' },
  { grade: 'A', min: 90, max: 94.9, remark: 'Super Performance', color: '#15803d' },
  { grade: 'B+', min: 87, max: 89.9, remark: 'Very High', color: '#1d4ed8' },
  { grade: 'B', min: 83, max: 86.9, remark: 'High', color: '#1d4ed8' },
  { grade: 'B-', min: 80, max: 82.9, remark: 'Good', color: '#0e7490' },
  { grade: 'C+', min: 77, max: 79.9, remark: 'High Credit', color: '#0e7490' },
  { grade: 'C', min: 73, max: 76.9, remark: 'Credit', color: '#b45309' },
  { grade: 'C-', min: 70, max: 72.9, remark: 'Average', color: '#b45309' },
  { grade: 'D+', min: 67, max: 69.9, remark: 'Good Pass', color: '#c2410c' },
  { grade: 'D', min: 63, max: 66.9, remark: 'Very Good Pass', color: '#c2410c' },
  { grade: 'D-', min: 60, max: 62.9, remark: 'Good Pass', color: '#c2410c' },
  { grade: 'F', min: 0, max: 59.9, remark: 'Fail', color: '#991b1b' },
];

try {
  // Create table if not exists
  db.exec(`
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
    )
  `);

  const schools = db.prepare('SELECT id FROM schools').all();
  const insertStmt = db.prepare('INSERT INTO grading_system (id, school_id, grade, min_score, max_score, remark, color) VALUES (?, ?, ?, ?, ?, ?, ?)');

  const transaction = db.transaction(() => {
    for (const school of schools) {
      // Check if school already has grades
      const exists = db.prepare('SELECT 1 FROM grading_system WHERE school_id = ?').get(school.id);
      if (!exists) {
        for (const g of defaultGrades) {
          insertStmt.run(uuidv4(), school.id, g.grade, g.min, g.max, g.remark, g.color);
        }
      }
    }
  });

  transaction();
  console.log('Migration successful: Populated default grading system for existing schools.');
} catch (error) {
  console.error('Migration failed:', error);
} finally {
  db.close();
}
