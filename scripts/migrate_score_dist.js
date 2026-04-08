const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(process.cwd(), 'data', 'school.db');

if (!fs.existsSync(DB_PATH)) {
  console.error('Database file not found at:', DB_PATH);
  process.exit(1);
}

const db = new Database(DB_PATH);

try {
  // 1. Add new columns for primary
  db.exec("ALTER TABLE schools ADD COLUMN primary_max_ca1 REAL DEFAULT 20");
  db.exec("ALTER TABLE schools ADD COLUMN primary_max_ca2 REAL DEFAULT 20");
  db.exec("ALTER TABLE schools ADD COLUMN primary_max_exam REAL DEFAULT 60");

  // 2. Add new columns for secondary
  db.exec("ALTER TABLE schools ADD COLUMN secondary_max_ca1 REAL DEFAULT 20");
  db.exec("ALTER TABLE schools ADD COLUMN secondary_max_ca2 REAL DEFAULT 20");
  db.exec("ALTER TABLE schools ADD COLUMN secondary_max_exam REAL DEFAULT 60");

  // 3. Migrate data from old columns to new columns
  db.exec(`
    UPDATE schools 
    SET 
      primary_max_ca1 = max_ca1, 
      primary_max_ca2 = max_ca2, 
      primary_max_exam = max_exam,
      secondary_max_ca1 = max_ca1, 
      secondary_max_ca2 = max_ca2, 
      secondary_max_exam = max_exam
  `);

  console.log('Migration successful: Added primary and secondary score limits to schools table.');
} catch (error) {
  if (error.message.includes('duplicate column name')) {
    console.log('Columns already exist, skipping migration.');
  } else {
    console.error('Migration failed:', error);
  }
} finally {
  db.close();
}
