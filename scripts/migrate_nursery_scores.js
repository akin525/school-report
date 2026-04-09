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
  // 1. Add new columns for nursery
  db.exec("ALTER TABLE schools ADD COLUMN nursery_max_ca1 REAL DEFAULT 20");
  db.exec("ALTER TABLE schools ADD COLUMN nursery_max_ca2 REAL DEFAULT 20");
  db.exec("ALTER TABLE schools ADD COLUMN nursery_max_exam REAL DEFAULT 60");

  // 2. Default nursery values to 20/20/60
  db.exec(`
    UPDATE schools 
    SET 
      nursery_max_ca1 = 20, 
      nursery_max_ca2 = 20, 
      nursery_max_exam = 60
  `);

  console.log('Migration successful: Added nursery score limits to schools table.');
} catch (error) {
  if (error.message.includes('duplicate column name')) {
    console.log('Columns already exist, skipping migration.');
  } else {
    console.error('Migration failed:', error);
  }
} finally {
  db.close();
}
