import getDb from './db';
import { hashPassword } from './auth';
import { v4 as uuidv4 } from 'uuid';

export async function seedDatabase() {
  const db = getDb();

  // Check if already seeded
  const existing = db.prepare('SELECT COUNT(*) as count FROM schools').get() as { count: number };
  if (existing.count > 0) return;

  const schoolId = uuidv4();
  const sessionId = uuidv4();
  const adminId = uuidv4();

  // Insert school
  db.prepare(`
    INSERT INTO schools (id, name, address, phone, email, website)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    schoolId,
    'Hallmark Heights College',
    '8, Adams Ajakaiye Street, Off Temidire Road, Lambe, Ogun State',
    '07025091096, 08082042760, 08033489584, 08037188564',
    'info@hallmarkschools.ng',
    'hallmarkschools.ng'
  );

  // Insert session
  db.prepare(`
    INSERT INTO sessions (id, school_id, name, start_year, end_year, is_current)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(sessionId, schoolId, '2024/2025', 2024, 2025);

  // Insert superadmin
  const superAdminId = uuidv4();
  const superAdminHash = await hashPassword('admin123');
  db.prepare(`
    INSERT INTO users (id, school_id, name, email, password_hash, role)
    VALUES (?, NULL, ?, ?, ?, 'superadmin')
  `).run(superAdminId, 'Super Admin', 'superadmin@system.com', superAdminHash);

  // Insert school admin
  const adminHash = await hashPassword('admin123');
  db.prepare(`
    INSERT INTO users (id, school_id, name, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?, 'school_admin')
  `).run(adminId, schoolId, 'School Admin', 'admin@hallmarkschools.ng', adminHash);

  // Insert classes
  const classes = [
    { id: uuidv4(), name: 'Kg 1', arm: 'A', level: 'Kg 1', category: 'nursery' },
    { id: uuidv4(), name: 'Pry 1', arm: 'A', level: 'Pry 1', category: 'primary' },
    { id: uuidv4(), name: 'Year 7', arm: 'A', level: 'Year 7', category: 'secondary' },
    { id: uuidv4(), name: 'Year 8', arm: 'A', level: 'Year 8', category: 'secondary' },
    { id: uuidv4(), name: 'Year 9', arm: 'A', level: 'Year 9', category: 'secondary' },
    { id: uuidv4(), name: 'Year 10', arm: 'A', level: 'Year 10', category: 'secondary' },
    { id: uuidv4(), name: 'Year 11', arm: 'A', level: 'Year 11', category: 'secondary' },
    { id: uuidv4(), name: 'Year 12', arm: 'A', level: 'Year 12', category: 'secondary' },
  ];

  const insertClass = db.prepare(`
    INSERT INTO classes (id, school_id, name, arm, level, category) VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const cls of classes) {
    insertClass.run(cls.id, schoolId, cls.name, cls.arm, cls.level, cls.category);
  }

  // Insert subjects
  const subjects = [
    // Secondary
    { name: 'ENGLISH', category: 'secondary' },
    { name: 'ENGLISH LITT', category: 'secondary' },
    { name: 'MATHS', category: 'secondary' },
    { name: 'FURTH MATHS', category: 'secondary' },
    { name: 'ECONOMICS', category: 'secondary' },
    { name: 'COMMERCE', category: 'secondary' },
    { name: 'GOVERNMENT', category: 'secondary' },
    { name: 'PHYSICS', category: 'secondary' },
    { name: 'CHEMISTRY', category: 'secondary' },
    { name: 'BIOLOGY', category: 'secondary' },
    { name: 'CIVIC EDU.', category: 'secondary' },
    { name: 'CRK/IRK', category: 'secondary' },
    { name: 'BUSINESS STD', category: 'secondary' },
    { name: 'YORUBA', category: 'secondary' },
    { name: 'FRENCH', category: 'secondary' },
    { name: 'AGRIC SCIENCE', category: 'secondary' },
    { name: 'GEOGRAPHY', category: 'secondary' },
    { name: 'ICT', category: 'secondary' },
    { name: 'CATERING', category: 'secondary' },
    { name: 'CCA', category: 'secondary' },
    { name: 'PHOTOGRAPHY', category: 'secondary' },
    { name: 'MARKETING', category: 'secondary' },
    { name: 'TECH. DRAWN', category: 'secondary' },
    { name: 'HISTORY', category: 'secondary' },
    { name: 'MUSIC', category: 'secondary' },
    { name: 'ACCOUNTS', category: 'secondary' },
    { name: 'SOCIAL STUDS.', category: 'secondary' },
    { name: 'HOME ECONS.', category: 'secondary' },
    { name: 'BASIC SCIENCE', category: 'secondary' },
    { name: 'BASIC TECH.', category: 'secondary' },
    { name: 'P.H.E', category: 'secondary' },
    { name: 'TRADE', category: 'secondary' },
    { name: 'GLOBAL PESR', category: 'secondary' },
    // Primary
    { name: 'ENGLISH', category: 'primary' },
    { name: 'PHONIC SPELL.', category: 'primary' },
    { name: 'MATHS', category: 'primary' },
    { name: 'SOCIAL STUDS.', category: 'primary' },
    { name: 'NVR', category: 'primary' },
    { name: 'BASIC SCIENCE', category: 'primary' },
    { name: 'HANDWRITING', category: 'primary' },
    { name: 'VERBAL REAS.', category: 'primary' },
    { name: 'QUANTITATIVE', category: 'primary' },
    { name: 'CRK/IRK', category: 'primary' },
    { name: 'PRESENTATION', category: 'primary' },
    { name: 'YORUBA', category: 'primary' },
    { name: 'FRENCH', category: 'primary' },
    { name: 'CCA', category: 'primary' },
    // Nursery/KG
    { name: 'ENGLISH', category: 'nursery' },
    { name: 'PHONIC SPELL.', category: 'nursery' },
    { name: 'MATHS', category: 'nursery' },
    { name: 'SOCIAL STUDS.', category: 'nursery' },
    { name: 'NVR', category: 'nursery' },
    { name: 'BASIC SCIENCE', category: 'nursery' },
    { name: 'NUMBER WORK', category: 'nursery' },
    { name: 'LITERACY', category: 'nursery' },
    { name: 'SENSORIAL', category: 'nursery' },
    { name: 'HEALTH HABIT', category: 'nursery' },
    { name: 'COLOURING', category: 'nursery' },
    { name: 'RHYMES', category: 'nursery' },
  ];

  const insertSubject = db.prepare(`
    INSERT INTO subjects (id, school_id, name, category) VALUES (?, ?, ?, ?)
  `);
  for (const sub of subjects) {
    insertSubject.run(uuidv4(), schoolId, sub.name, sub.category);
  }

  console.log('Database seeded successfully');
}