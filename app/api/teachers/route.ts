import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { teachers, users } from '@/lib/schema';
import { eq, and, asc, getTableColumns } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('schoolId') || session.schoolId;

    const results = await db.select({
      ...getTableColumns(teachers),
      user_email: users.email,
      user_role: users.role
    })
      .from(teachers)
      .leftJoin(users, eq(users.id, teachers.user_id))
      .where(eq(teachers.school_id, schoolId || ''))
      .orderBy(asc(teachers.name));

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('TEACHER_GET_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { name, email, phone, qualification, category, createLogin, password, schoolId } = await req.json();
    const sId = schoolId || session.schoolId;

    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const teacherId = uuidv4();
    let userId = null;

    if (createLogin && email && password) {
      userId = uuidv4();
      const hash = await hashPassword(password);
      await db.insert(users).values({
        id: userId,
        school_id: sId || '',
        name,
        email,
        password_hash: hash,
        role: 'teacher'
      });
    }

    await db.insert(teachers).values({
      id: teacherId,
      school_id: sId || '',
      user_id: userId,
      name,
      email: email || '',
      phone: phone || '',
      qualification: qualification || '',
      category: category || 'secondary'
    });

    const newTeacherResult = await db.select().from(teachers).where(eq(teachers.id, teacherId)).limit(1);
    return NextResponse.json(newTeacherResult[0], { status: 201 });
  } catch (error: any) {
    console.error('TEACHER_POST_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, name, email, phone, qualification, category } = await req.json();

    await db.update(teachers).set({
      name,
      email,
      phone,
      qualification,
      category
    }).where(eq(teachers.id, id));

    const updatedTeacherResult = await db.select().from(teachers).where(eq(teachers.id, id)).limit(1);
    return NextResponse.json(updatedTeacherResult[0]);
  } catch (error: any) {
    console.error('TEACHER_PUT_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await req.json();

    // Get associated user ID first
    const teacherResult = await db.select({ user_id: teachers.user_id }).from(teachers).where(eq(teachers.id, id)).limit(1);
    const teacher = teacherResult[0];
    
    if (teacher?.user_id) {
      await db.delete(users).where(eq(users.id, teacher.user_id));
    }
    
    await db.delete(teachers).where(eq(teachers.id, id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('TEACHER_DELETE_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
