import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { schools, sessions, users } from '@/lib/schema';
import { eq, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.role === 'superadmin') {
    const allSchools = await db.select().from(schools).orderBy(asc(schools.name));
    return NextResponse.json(allSchools);
  } else {
    const schoolResult = await db.select().from(schools).where(eq(schools.id, session.schoolId || "")).limit(1);
    const school = schoolResult[0];
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

  const schoolId = uuidv4();

  await db.insert(schools).values({
    id: schoolId,
    name,
    nursery_name: nursery_name || '',
    primary_name: primary_name || '',
    secondary_name: secondary_name || '',
    address: address || '',
    phone: phone || '',
    email: email || '',
    website: website || '',
    logo_url: logo_url || '',
    nursery_max_ca1: nursery_max_ca1 ?? 20,
    nursery_max_ca2: nursery_max_ca2 ?? 20,
    nursery_max_exam: nursery_max_exam ?? 60,
    nursery_max_weekly: nursery_max_weekly ?? 10,
    primary_max_ca1: primary_max_ca1 ?? 20,
    primary_max_ca2: primary_max_ca2 ?? 20,
    primary_max_exam: primary_max_exam ?? 60,
    primary_max_weekly: primary_max_weekly ?? 10,
    secondary_max_ca1: secondary_max_ca1 ?? 20,
    secondary_max_ca2: secondary_max_ca2 ?? 20,
    secondary_max_exam: secondary_max_exam ?? 60,
    secondary_max_weekly: secondary_max_weekly ?? 10,
    max_ca1: primary_max_ca1 ?? 20,
    max_ca2: primary_max_ca2 ?? 20,
    max_exam: primary_max_exam ?? 60,
    max_weekly: primary_max_weekly ?? 10
  });

  // Create session for the school
  const sessionId = uuidv4();
  const year = new Date().getFullYear();
  await db.insert(sessions).values({
    id: sessionId,
    school_id: schoolId,
    name: `${year}/${year+1}`,
    start_year: year,
    end_year: year + 1,
    is_current: 1
  });

  // Create admin user if provided
  if (adminEmail && adminPassword) {
    const hash = await hashPassword(adminPassword);
    await db.insert(users).values({
      id: uuidv4(),
      school_id: schoolId,
      name: adminName || 'School Admin',
      email: adminEmail,
      password_hash: hash,
      role: 'school_admin'
    });
  }

  const schoolResult = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1);
  return NextResponse.json(schoolResult[0], { status: 201 });
}
