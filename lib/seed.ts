import { db } from './db';
import { schools, sessions, users, classes as classesTable, subjects as subjectsTable, teachers, teacherAssignments } from './schema';
import { hashPassword } from './auth';
import { v4 as uuidv4 } from 'uuid';
import { sql, eq, and } from 'drizzle-orm';

export async function seedDatabase() {
  // Check if already seeded
  const schoolsCount = await db.select({ count: sql<number>`count(*)` }).from(schools);
  if (schoolsCount[0].count > 0) return;

  const schoolId = uuidv4();
  const sessionId = uuidv4();
  const adminId = uuidv4();

  // Insert school
  await db.insert(schools).values({
    id: schoolId,
    name: 'Hallmark Heights College',
    address: '8, Adams Ajakaiye Street, Off Temidire Road, Lambe, Ogun State',
    phone: '07025091096, 08082042760, 08033489584, 08037188564',
    email: 'info@hallmarkschools.ng',
    website: 'hallmarkschools.ng'
  });

  // Insert session
  await db.insert(sessions).values({
    id: sessionId,
    school_id: schoolId,
    name: '2024/2025',
    start_year: 2024,
    end_year: 2025,
    is_current: 1
  });

  // Insert superadmin
  const superAdminId = uuidv4();
  const superAdminHash = await hashPassword('admin123');
  await db.insert(users).values({
    id: superAdminId,
    school_id: null,
    name: 'Super Admin',
    email: 'superadmin@system.com',
    password_hash: superAdminHash,
    role: 'superadmin'
  });

  // Insert school admin
  const adminHash = await hashPassword('admin123');
  await db.insert(users).values({
    id: adminId,
    school_id: schoolId,
    name: 'School Admin',
    email: 'admin@hallmarkschools.ng',
    password_hash: adminHash,
    role: 'school_admin'
  });

  // Insert classes
  const classesData = [
    { id: uuidv4(), name: 'Kg 1', arm: 'A', level: 'Kg 1', category: 'nursery' as const },
    { id: uuidv4(), name: 'Pry 1', arm: 'A', level: 'Pry 1', category: 'primary' as const },
    { id: uuidv4(), name: 'Year 7', arm: 'A', level: 'Year 7', category: 'secondary' as const },
    { id: uuidv4(), name: 'Year 8', arm: 'A', level: 'Year 8', category: 'secondary' as const },
    { id: uuidv4(), name: 'Year 9', arm: 'A', level: 'Year 9', category: 'secondary' as const },
    { id: uuidv4(), name: 'Year 10', arm: 'A', level: 'Year 10', category: 'secondary' as const },
    { id: uuidv4(), name: 'Year 11', arm: 'A', level: 'Year 11', category: 'secondary' as const },
    { id: uuidv4(), name: 'Year 12', arm: 'A', level: 'Year 12', category: 'secondary' as const },
  ];

  for (const cls of classesData) {
    await db.insert(classesTable).values({
      id: cls.id,
      school_id: schoolId,
      name: cls.name,
      arm: cls.arm,
      level: cls.level,
      category: cls.category
    });
  }

  // Insert subjects
  const subjectsData = [
    // Secondary
    { name: 'ENGLISH', category: 'secondary' as const },
    { name: 'ENGLISH LITT', category: 'secondary' as const },
    { name: 'MATHS', category: 'secondary' as const },
    { name: 'FURTH MATHS', category: 'secondary' as const },
    { name: 'ECONOMICS', category: 'secondary' as const },
    { name: 'COMMERCE', category: 'secondary' as const },
    { name: 'GOVERNMENT', category: 'secondary' as const },
    { name: 'PHYSICS', category: 'secondary' as const },
    { name: 'CHEMISTRY', category: 'secondary' as const },
    { name: 'BIOLOGY', category: 'secondary' as const },
    { name: 'CIVIC EDU.', category: 'secondary' as const },
    { name: 'CRK/IRK', category: 'secondary' as const },
    { name: 'BUSINESS STD', category: 'secondary' as const },
    { name: 'YORUBA', category: 'secondary' as const },
    { name: 'FRENCH', category: 'secondary' as const },
    { name: 'AGRIC SCIENCE', category: 'secondary' as const },
    { name: 'GEOGRAPHY', category: 'secondary' as const },
    { name: 'ICT', category: 'secondary' as const },
    { name: 'CATERING', category: 'secondary' as const },
    { name: 'CCA', category: 'secondary' as const },
    { name: 'PHOTOGRAPHY', category: 'secondary' as const },
    { name: 'MARKETING', category: 'secondary' as const },
    { name: 'TECH. DRAWN', category: 'secondary' as const },
    { name: 'HISTORY', category: 'secondary' as const },
    { name: 'MUSIC', category: 'secondary' as const },
    { name: 'ACCOUNTS', category: 'secondary' as const },
    { name: 'SOCIAL STUDS.', category: 'secondary' as const },
    { name: 'HOME ECONS.', category: 'secondary' as const },
    { name: 'BASIC SCIENCE', category: 'secondary' as const },
    { name: 'BASIC TECH.', category: 'secondary' as const },
    { name: 'P.H.E', category: 'secondary' as const },
    { name: 'TRADE', category: 'secondary' as const },
    { name: 'GLOBAL PESR', category: 'secondary' as const },
    // Primary
    { name: 'ENGLISH', category: 'primary' as const },
    { name: 'PHONIC SPELL.', category: 'primary' as const },
    { name: 'MATHS', category: 'primary' as const },
    { name: 'SOCIAL STUDS.', category: 'primary' as const },
    { name: 'NVR', category: 'primary' as const },
    { name: 'BASIC SCIENCE', category: 'primary' as const },
    { name: 'HANDWRITING', category: 'primary' as const },
    { name: 'VERBAL REAS.', category: 'primary' as const },
    { name: 'QUANTITATIVE', category: 'primary' as const },
    { name: 'CRK/IRK', category: 'primary' as const },
    { name: 'PRESENTATION', category: 'primary' as const },
    { name: 'YORUBA', category: 'primary' as const },
    { name: 'FRENCH', category: 'primary' as const },
    { name: 'CCA', category: 'primary' as const },
    // Nursery/KG
    { name: 'ENGLISH', category: 'nursery' as const },
    { name: 'PHONIC SPELL.', category: 'nursery' as const },
    { name: 'MATHS', category: 'nursery' as const },
    { name: 'SOCIAL STUDS.', category: 'nursery' as const },
    { name: 'NVR', category: 'nursery' as const },
    { name: 'BASIC SCIENCE', category: 'nursery' as const },
    { name: 'NUMBER WORK', category: 'nursery' as const },
    { name: 'LITERACY', category: 'nursery' as const },
    { name: 'SENSORIAL', category: 'nursery' as const },
    { name: 'HEALTH HABIT', category: 'nursery' as const },
    { name: 'COLOURING', category: 'nursery' as const },
    { name: 'RHYMES', category: 'nursery' as const },
  ];

  for (const sub of subjectsData) {
    await db.insert(subjectsTable).values({
      id: uuidv4(),
      school_id: schoolId,
      name: sub.name,
      category: sub.category
    });
  }

  // Insert sample teachers and assignments
  const teacherId = uuidv4();
  const teacherUserId = uuidv4();
  const teacherHash = await hashPassword('teacher123');
  
  // Insert teacher user
  await db.insert(users).values({
    id: teacherUserId,
    school_id: schoolId,
    name: 'John Teacher',
    email: 'teacher@hallmarkschools.ng',
    password_hash: teacherHash,
    role: 'teacher'
  });
  
  // Insert teacher
  await db.insert(teachers).values({
    id: teacherId,
    school_id: schoolId,
    user_id: teacherUserId,
    name: 'John Teacher',
    email: 'teacher@hallmarkschools.ng',
    qualification: 'B.Ed Mathematics',
    category: 'secondary'
  });
  
  // Get class and subject IDs for assignments
  const year7ClassResult = await db.select({ id: classesTable.id }).from(classesTable).where(and(eq(classesTable.name, 'Year 7'), eq(classesTable.school_id, schoolId))).limit(1);
  const year7Class = year7ClassResult[0];

  const year8ClassResult = await db.select({ id: classesTable.id }).from(classesTable).where(and(eq(classesTable.name, 'Year 8'), eq(classesTable.school_id, schoolId))).limit(1);
  const year8Class = year8ClassResult[0];

  const mathsSubjectResult = await db.select({ id: subjectsTable.id }).from(subjectsTable).where(and(eq(subjectsTable.name, 'MATHS'), eq(subjectsTable.school_id, schoolId))).limit(1);
  const mathsSubject = mathsSubjectResult[0];

  const englishSubjectResult = await db.select({ id: subjectsTable.id }).from(subjectsTable).where(and(eq(subjectsTable.name, 'ENGLISH'), eq(subjectsTable.school_id, schoolId))).limit(1);
  const englishSubject = englishSubjectResult[0];

  const physicsSubjectResult = await db.select({ id: subjectsTable.id }).from(subjectsTable).where(and(eq(subjectsTable.name, 'PHYSICS'), eq(subjectsTable.school_id, schoolId))).limit(1);
  const physicsSubject = physicsSubjectResult[0];
  
  // Insert teacher assignments
  const assignmentsData = [
    { classId: year7Class?.id, subjectId: mathsSubject?.id },
    { classId: year7Class?.id, subjectId: englishSubject?.id },
    { classId: year8Class?.id, subjectId: mathsSubject?.id },
    { classId: year8Class?.id, subjectId: physicsSubject?.id },
  ];

  for (const assignment of assignmentsData) {
    if (assignment.classId && assignment.subjectId) {
      await db.insert(teacherAssignments).values({
        id: uuidv4(),
        school_id: schoolId,
        teacher_id: teacherId,
        subject_id: assignment.subjectId,
        class_id: assignment.classId,
        session_id: sessionId
      });
    }
  }

  console.log('Database seeded successfully');
}
