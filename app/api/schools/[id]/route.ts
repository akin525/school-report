import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const db = getDb();
  const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(id);
  if (!school) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(school);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  if (session.role !== 'superadmin' && session.schoolId !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { 
    name, address, phone, email, website, logo_url, motto, 
    nursery_max_ca1, nursery_max_ca2, nursery_max_exam,
    primary_max_ca1, primary_max_ca2, primary_max_exam,
    secondary_max_ca1, secondary_max_ca2, secondary_max_exam 
  } = await req.json();
  const db = getDb();
  db.prepare(`
    UPDATE schools SET name=?, address=?, phone=?, email=?, website=?, logo_url=?, motto=?, 
    nursery_max_ca1=?, nursery_max_ca2=?, nursery_max_exam=?,
    primary_max_ca1=?, primary_max_ca2=?, primary_max_exam=?,
    secondary_max_ca1=?, secondary_max_ca2=?, secondary_max_exam=?
    WHERE id=?
  `).run(
    name, address, phone, email, website, logo_url, motto, 
    nursery_max_ca1 ?? 20, nursery_max_ca2 ?? 20, nursery_max_exam ?? 60,
    primary_max_ca1 ?? 20, primary_max_ca2 ?? 20, primary_max_exam ?? 60,
    secondary_max_ca1 ?? 20, secondary_max_ca2 ?? 20, secondary_max_exam ?? 60, 
    id
  );

  return NextResponse.json(db.prepare('SELECT * FROM schools WHERE id=?').get(id));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM schools WHERE id=?').run(id);
  return NextResponse.json({ success: true });
}