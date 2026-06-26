import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { announcements, users, classes } from '@/lib/schema';
import { eq, and, or, isNull, desc, getTableColumns } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('schoolId') || session.schoolId;
    const classId = searchParams.get('classId');

    const filters: any[] = [eq(announcements.school_id, schoolId || '')];

    if (session.role === 'student') {
      const roleFilter = or(eq(announcements.target_role, 'all'), eq(announcements.target_role, 'student'));
      if (roleFilter) filters.push(roleFilter);

      if (classId) {
        const classFilter = or(isNull(announcements.target_class_id), eq(announcements.target_class_id, classId));
        if (classFilter) filters.push(classFilter);
      } else {
        filters.push(isNull(announcements.target_class_id));
      }
    } else if (session.role === 'teacher') {
      const teacherRoleFilter = or(eq(announcements.target_role, 'all'), eq(announcements.target_role, 'teacher'));
      if (teacherRoleFilter) filters.push(teacherRoleFilter);
    }

    const results = await db.select({
      ...getTableColumns(announcements),
      creator_name: users.name,
      target_class_name: classes.name
    })
      .from(announcements)
      .innerJoin(users, eq(users.id, announcements.created_by))
      .leftJoin(classes, eq(classes.id, announcements.target_class_id))
      .where(and(...filters))
      .orderBy(desc(announcements.created_at));

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('ANNOUNCEMENTS_GET_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { title, content, target_role, target_class_id, schoolId } = await req.json();
    const sId = schoolId || session.schoolId;

    if (!title || !content) return NextResponse.json({ error: 'Title and content required' }, { status: 400 });

    const id = uuidv4();
    await db.insert(announcements).values({
      id,
      school_id: sId || '',
      title,
      content,
      target_role: target_role || 'all',
      target_class_id: target_class_id || null,
      created_by: session.userId
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('ANNOUNCEMENTS_POST_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await db.delete(announcements).where(eq(announcements.id, id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('ANNOUNCEMENTS_DELETE_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
