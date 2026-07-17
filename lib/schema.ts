import { mysqlTable, varchar, text, double, int, datetime, mysqlEnum, boolean, json, uniqueIndex, longtext } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const schools = mysqlTable('schools', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: text('name').notNull(),
  nursery_name: text('nursery_name'),
  primary_name: text('primary_name'),
  secondary_name: text('secondary_name'),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  website: text('website'),
  logo_url: longtext('logo_url'),
  motto: text('motto'),
  nursery_max_ca1: double('nursery_max_ca1').default(20),
  nursery_max_ca2: double('nursery_max_ca2').default(20),
  nursery_max_exam: double('nursery_max_exam').default(60),
  nursery_max_weekly: double('nursery_max_weekly').default(10),
  primary_max_ca1: double('primary_max_ca1').default(20),
  primary_max_ca2: double('primary_max_ca2').default(20),
  primary_max_exam: double('primary_max_exam').default(60),
  primary_max_weekly: double('primary_max_weekly').default(10),
  secondary_max_ca1: double('secondary_max_ca1').default(20),
  secondary_max_ca2: double('secondary_max_ca2').default(20),
  secondary_max_exam: double('secondary_max_exam').default(60),
  secondary_max_weekly: double('secondary_max_weekly').default(10),
  max_ca1: double('max_ca1').default(20),
  max_ca2: double('max_ca2').default(20),
  max_exam: double('max_exam').default(60),
  max_weekly: double('max_weekly').default(10),
  openai_api_key: text('openai_api_key'),
  gemini_api_key: text('gemini_api_key'),
  ai_enabled: int('ai_enabled').default(1),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const users = mysqlTable('users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  school_id: varchar('school_id', { length: 36 }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  password_hash: text('password_hash').notNull(),
  role: mysqlEnum('role', ['superadmin', 'school_admin', 'teacher', 'student']).notNull(),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const sessions = mysqlTable('sessions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  school_id: varchar('school_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  start_year: int('start_year').notNull(),
  end_year: int('end_year').notNull(),
  is_current: int('is_current').default(0),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const classes = mysqlTable('classes', {
  id: varchar('id', { length: 36 }).primaryKey(),
  school_id: varchar('school_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  arm: varchar('arm', { length: 255 }),
  level: varchar('level', { length: 255 }),
  category: mysqlEnum('category', ['nursery', 'primary', 'secondary']).default('secondary'),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const subjects = mysqlTable('subjects', {
  id: varchar('id', { length: 36 }).primaryKey(),
  school_id: varchar('school_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }),
  category: mysqlEnum('category', ['nursery', 'primary', 'secondary']).default('secondary'),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const teachers = mysqlTable('teachers', {
  id: varchar('id', { length: 36 }).primaryKey(),
  school_id: varchar('school_id', { length: 36 }).notNull(),
  user_id: varchar('user_id', { length: 36 }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  qualification: text('qualification'),
  category: mysqlEnum('category', ['primary', 'secondary']).default('secondary'),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const students = mysqlTable('students', {
  id: varchar('id', { length: 36 }).primaryKey(),
  school_id: varchar('school_id', { length: 36 }).notNull(),
  user_id: varchar('user_id', { length: 36 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  admission_number: varchar('admission_number', { length: 100 }).unique(),
  hallmark_reg_no: varchar('hallmark_reg_no', { length: 100 }),
  date_of_admission: datetime('date_of_admission'),
  first_name: varchar('first_name', { length: 100 }).notNull(),
  middle_name: varchar('middle_name', { length: 100 }),
  last_name: varchar('last_name', { length: 100 }).notNull(),
  class_id: varchar('class_id', { length: 36 }),
  date_of_birth: varchar('date_of_birth', { length: 50 }),
  gender: varchar('gender', { length: 20 }),
  religion: varchar('religion', { length: 50 }),
  home_address: text('home_address'),
  previous_school: text('previous_school'),
  state_of_origin: varchar('state_of_origin', { length: 100 }),
  lga: varchar('lga', { length: 100 }),
  bece_no: varchar('bece_no', { length: 100 }),
  lin_no: varchar('lin_no', { length: 100 }),
  photo_url: longtext('photo_url'),
  admission_year: varchar('admission_year', { length: 10 }),
  status: mysqlEnum('status', ['active', 'graduated', 'left', 'suspended']).default('active'),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const scores = mysqlTable('scores', {
  id: varchar('id', { length: 36 }).primaryKey(),
  school_id: varchar('school_id', { length: 36 }).notNull(),
  student_id: varchar('student_id', { length: 36 }).notNull(),
  subject_id: varchar('subject_id', { length: 36 }).notNull(),
  class_id: varchar('class_id', { length: 36 }).notNull(),
  session_id: varchar('session_id', { length: 36 }).notNull(),
  term: int('term').notNull(),
  ca1_score: double('ca1_score').default(0),
  ca2_score: double('ca2_score').default(0),
  exam_score: double('exam_score').default(0),
  t1: double('t1'), t2: double('t2'), t3: double('t3'), t4: double('t4'), t5: double('t5'),
  t6: double('t6'), t7: double('t7'), t8: double('t8'), t9: double('t9'), t10: double('t10'),
  total: double('total').default(0), // MySQL doesn't support easy GENERATED ALWAYS AS in Drizzle without custom SQL
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    scoresUniqueIdx: uniqueIndex('scores_unique_idx').on(table.student_id, table.subject_id, table.session_id, table.term),
  };
});

export const gradingSystem = mysqlTable('grading_system', {
  id: varchar('id', { length: 36 }).primaryKey(),
  category: mysqlEnum('category', ['nursery', 'primary', 'secondary']).default('secondary'),
  school_id: varchar('school_id', { length: 36 }).notNull(),
  grade: varchar('grade', { length: 10 }).notNull(),
  min_score: double('min_score').notNull(),
  max_score: double('max_score').notNull(),
  remark: varchar('remark', { length: 255 }),
  color: varchar('color', { length: 50 }),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const attendance = mysqlTable('attendance', {
  id: varchar('id', { length: 36 }).primaryKey(),
  school_id: varchar('school_id', { length: 36 }).notNull(),
  student_id: varchar('student_id', { length: 36 }).notNull(),
  session_id: varchar('session_id', { length: 36 }).notNull(),
  term: int('term').notNull(),
  times_school_opened: int('times_school_opened').default(0),
  times_present: int('times_present').default(0),
});

export const teacherAssignments = mysqlTable('teacher_assignments', {
  id: varchar('id', { length: 36 }).primaryKey(),
  school_id: varchar('school_id', { length: 36 }).notNull(),
  teacher_id: varchar('teacher_id', { length: 36 }).notNull(),
  subject_id: varchar('subject_id', { length: 36 }),
  class_id: varchar('class_id', { length: 36 }).notNull(),
  session_id: varchar('session_id', { length: 36 }).notNull(),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const announcements = mysqlTable('announcements', {
  id: varchar('id', { length: 36 }).primaryKey(),
  school_id: varchar('school_id', { length: 36 }).notNull(),
  title: text('title').notNull(),
  content: longtext('content').notNull(),
  target_role: varchar('target_role', { length: 50 }).default('all'),
  target_class_id: varchar('target_class_id', { length: 36 }),
  created_by: varchar('created_by', { length: 36 }).notNull(),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const lessonNotes = mysqlTable('lesson_notes', {
  id: varchar('id', { length: 36 }).primaryKey(),
  school_id: varchar('school_id', { length: 36 }).notNull(),
  teacher_id: varchar('teacher_id', { length: 36 }).notNull(),
  subject_id: varchar('subject_id', { length: 36 }).notNull(),
  class_id: varchar('class_id', { length: 36 }).notNull(),
  session_id: varchar('session_id', { length: 36 }).notNull(),
  term: int('term').notNull(),
  title: text('title').notNull(),
  content: longtext('content'),
  file_url: text('file_url'),
  file_name: text('file_name'),
  file_type: varchar('file_type', { length: 100 }),
  topic: text('topic'),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const questionBank = mysqlTable('question_bank', {
  id: varchar('id', { length: 36 }).primaryKey(),
  school_id: varchar('school_id', { length: 36 }).notNull(),
  teacher_id: varchar('teacher_id', { length: 36 }).notNull(),
  subject_id: varchar('subject_id', { length: 36 }).notNull(),
  class_id: varchar('class_id', { length: 36 }).notNull(),
  session_id: varchar('session_id', { length: 36 }).notNull(),
  term: int('term').notNull(),
  question_text: longtext('question_text').notNull(),
  option_a: longtext('option_a'),
  option_b: longtext('option_b'),
  option_c: longtext('option_c'),
  option_d: longtext('option_d'),
  correct_answer: text('correct_answer').notNull(),
  question_type: varchar('question_type', { length: 50 }).default('multiple_choice'),
  difficulty: varchar('difficulty', { length: 20 }).default('medium'),
  marks: int('marks').default(1),
  file_url: text('file_url'),
  file_name: text('file_name'),
  file_type: varchar('file_type', { length: 100 }),
  topic: text('topic'),
  note: text('note'),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const exams = mysqlTable('exams', {
  id: varchar('id', { length: 36 }).primaryKey(),
  school_id: varchar('school_id', { length: 36 }).notNull(),
  title: text('title').notNull(),
  subject_id: varchar('subject_id', { length: 36 }).notNull(),
  class_id: varchar('class_id', { length: 36 }).notNull(),
  session_id: varchar('session_id', { length: 36 }).notNull(),
  term: int('term').notNull(),
  start_time: datetime('start_time').notNull(),
  end_time: datetime('end_time').notNull(),
  duration_minutes: int('duration_minutes').notNull(),
  total_marks: int('total_marks').notNull(),
  created_by: varchar('created_by', { length: 36 }).notNull(),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const examSubmissions = mysqlTable('exam_submissions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  exam_id: varchar('exam_id', { length: 36 }).notNull(),
  student_id: varchar('student_id', { length: 36 }).notNull(),
  score: double('score'),
  submitted_at: datetime('submitted_at').default(sql`CURRENT_TIMESTAMP`),
  answers: json('answers'),
});

export const classSubjects = mysqlTable('class_subjects', {
  id: varchar('id', { length: 36 }).primaryKey(),
  class_id: varchar('class_id', { length: 36 }).notNull(),
  subject_id: varchar('subject_id', { length: 36 }).notNull(),
  school_id: varchar('school_id', { length: 36 }).notNull(),
});

export const teacherComments = mysqlTable('teacher_comments', {
  id: varchar('id', { length: 36 }).primaryKey(),
  school_id: varchar('school_id', { length: 36 }).notNull(),
  student_id: varchar('student_id', { length: 36 }).notNull(),
  session_id: varchar('session_id', { length: 36 }).notNull(),
  term: int('term').notNull(),
  class_teacher_comment: text('class_teacher_comment'),
  class_teacher_signature: longtext('class_teacher_signature'),
  class_teacher_date: varchar('class_teacher_date', { length: 50 }),
  coordinator_remark: text('coordinator_remark'),
  coordinator_signature: longtext('coordinator_signature'),
  coordinator_date: varchar('coordinator_date', { length: 50 }),
  next_term_starts: varchar('next_term_starts', { length: 50 }),
});

export const affectiveTraits = mysqlTable('affective_traits', {
  id: varchar('id', { length: 36 }).primaryKey(),
  school_id: varchar('school_id', { length: 36 }).notNull(),
  student_id: varchar('student_id', { length: 36 }).notNull(),
  session_id: varchar('session_id', { length: 36 }).notNull(),
  term: int('term').notNull(),
  homework: text('homework'),
  punctuality: text('punctuality'),
  interaction: text('interaction'),
  leadership: text('leadership'),
  politeness: text('politeness'),
  conduct: text('conduct'),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const physicalDev = mysqlTable('physical_dev', {
  id: varchar('id', { length: 36 }).primaryKey(),
  school_id: varchar('school_id', { length: 36 }).notNull(),
  student_id: varchar('student_id', { length: 36 }).notNull(),
  session_id: varchar('session_id', { length: 36 }).notNull(),
  term: int('term').notNull(),
  weight_from: double('weight_from'),
  weight_to: double('weight_to'),
  height_from: double('height_from'),
  height_to: double('height_to'),
});

export const timetable = mysqlTable('timetable', {
  id: varchar('id', { length: 36 }).primaryKey(),
  school_id: varchar('school_id', { length: 36 }).notNull(),
  class_id: varchar('class_id', { length: 36 }).notNull(),
  day_of_week: int('day_of_week').notNull(),
  start_time: varchar('start_time', { length: 20 }).notNull(),
  end_time: varchar('end_time', { length: 20 }).notNull(),
  subject_id: varchar('subject_id', { length: 36 }).notNull(),
  teacher_id: varchar('teacher_id', { length: 36 }),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const generatedQuestions = mysqlTable('generated_questions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  school_id: varchar('school_id', { length: 36 }).notNull(),
  lesson_note_id: varchar('lesson_note_id', { length: 36 }).notNull(),
  question_text: text('question_text').notNull(),
  option_a: text('option_a').notNull(),
  option_b: text('option_b').notNull(),
  option_c: text('option_c').notNull(),
  option_d: text('option_d').notNull(),
  correct_answer: varchar('correct_answer', { length: 10 }).notNull(),
  correct_answer_text: text('correct_answer_text'),
  question_type: varchar('question_type', { length: 50 }).default('multiple_choice'),
  difficulty: varchar('difficulty', { length: 20 }).default('medium'),
  note: text('note'),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
});
