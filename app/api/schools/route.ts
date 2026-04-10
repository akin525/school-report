import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  if (session.role === 'superadmin') {
    const schools = db.prepare('SELECT * FROM schools ORDER BY name').all();
    return NextResponse.json(schools);
  } else {
    const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(session.schoolId);
    return NextResponse.json(school ? [school] : []);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { 
    name, nursery_name, primary_name, secondary_name, address, phone, email, website, logo_url, adminName, adminEmail, adminPassword, 
    nursery_max_ca1, nursery_max_ca2, nursery_max_exam, nursery_max_weekly,
    primary_max_ca1, primary_max_ca2, primary_max_exam, primary_max_weekly,
    secondary_max_ca1, secondary_max_ca2, secondary_max_exam, secondary_max_weekly 
  } = await req.json();
  if (!name) return NextResponse.json({ error: 'School name required' }, { status: 400 });

  const db = getDb();
  const schoolId = uuidv4();

  db.prepare(`
    INSERT INTO schools (
      id, name, nursery_name, primary_name, secondary_name, address, phone, email, website, logo_url, 
      nursery_max_ca1, nursery_max_ca2, nursery_max_exam, nursery_max_weekly,
      primary_max_ca1, primary_max_ca2, primary_max_exam, primary_max_weekly,
      secondary_max_ca1, secondary_max_ca2, secondary_max_exam, secondary_max_weekly,
      max_ca1, max_ca2, max_exam, max_weekly
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    schoolId, name, nursery_name || '', primary_name || '', secondary_name || '', address || '', phone || '', email || '', website || '', logo_url || '', 
    nursery_max_ca1 ?? 20, nursery_max_ca2 ?? 20, nursery_max_exam ?? 60, nursery_max_weekly ?? 10,
    primary_max_ca1 ?? 20, primary_max_ca2 ?? 20, primary_max_exam ?? 60, primary_max_weekly ?? 10,
    secondary_max_ca1 ?? 20, secondary_max_ca2 ?? 20, secondary_max_exam ?? 60, secondary_max_weekly ?? 10,
    primary_max_ca1 ?? 20, primary_max_ca2 ?? 20, primary_max_exam ?? 60, primary_max_weekly ?? 10
  );

  // Create session for the school
  const sessionId = uuidv4();
  const year = new Date().getFullYear();
  db.prepare(`
    INSERT INTO sessions (id, school_id, name, start_year, end_year, is_current)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(sessionId, schoolId, `${year}/${year+1}`, year, year+1);

  // Create admin user if provided
  if (adminEmail && adminPassword) {
    const hash = await hashPassword(adminPassword);
    db.prepare(`
      INSERT INTO users (id, school_id, name, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?, 'school_admin')
    `).run(uuidv4(), schoolId, adminName || 'School Admin', adminEmail, hash);
  }

  const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(schoolId);
  return NextResponse.json(school, { status: 201 });
}