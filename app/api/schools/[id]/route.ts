import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { schools } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const results = await db.select().from(schools).where(eq(schools.id, id)).limit(1);
  const school = results[0];
  if (!school) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(school);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    if (session.role !== 'superadmin' && session.schoolId !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { 
      name, nursery_name, primary_name, secondary_name, address, phone, email, website, logo_url, motto, 
      nursery_max_ca1, nursery_max_ca2, nursery_max_exam, nursery_max_weekly,
      primary_max_ca1, primary_max_ca2, primary_max_exam, primary_max_weekly,
      secondary_max_ca1, secondary_max_ca2, secondary_max_exam, secondary_max_weekly,
      openai_api_key, gemini_api_key, ai_enabled
    } = await req.json();
    
    await db.update(schools).set({
      name,
      nursery_name: nursery_name || '',
      primary_name: primary_name || '',
      secondary_name: secondary_name || '',
      address: address || '',
      phone: phone || '',
      email: email || '',
      website: website || '',
      logo_url: logo_url || '',
      motto: motto || '',
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
      openai_api_key: openai_api_key ?? null,
      gemini_api_key: gemini_api_key ?? null,
      ai_enabled: ai_enabled ?? 1,
    }).where(eq(schools.id, id));

    const updatedResult = await db.select().from(schools).where(eq(schools.id, id)).limit(1);
    return NextResponse.json(updatedResult[0]);
  } catch (error: any) {
    console.error('SCHOOL_PUT_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  await db.delete(schools).where(eq(schools.id, id));
  return NextResponse.json({ success: true });
}
