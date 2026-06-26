import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { students, classes, users } from '@/lib/schema';
import { eq, and, or, like, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('schoolId') || session.schoolId;
    const classId = searchParams.get('classId');
    const search = searchParams.get('search');

    // Security check: Students should only see themselves
    if (session.role === 'student') {
      const results = await db.select({
        id: students.id,
        school_id: students.school_id,
        user_id: students.user_id,
        email: students.email,
        admission_number: students.admission_number,
        first_name: students.first_name,
        middle_name: students.middle_name,
        last_name: students.last_name,
        class_id: students.class_id,
        date_of_birth: students.date_of_birth,
        gender: students.gender,
        photo_url: students.photo_url,
        admission_year: students.admission_year,
        created_at: students.created_at,
        class_name: classes.name,
        class_category: classes.category,
        user_email: users.email
      })
        .from(students)
        .leftJoin(classes, eq(classes.id, students.class_id))
        .leftJoin(users, eq(users.id, students.user_id))
        .where(eq(students.user_id, session.userId))
        .limit(1);

      return NextResponse.json(results);
    }

    const filters: any[] = [eq(students.school_id, schoolId || '')];
    if (classId) filters.push(eq(students.class_id, classId));
    if (search) {
      const s = `%${search}%`;
      const searchFilter = or(
        like(students.first_name, s),
        like(students.last_name, s),
        like(students.admission_number, s)
      );
      if (searchFilter) filters.push(searchFilter);
    }

    const allStudents = await db.select({
      id: students.id,
      school_id: students.school_id,
      user_id: students.user_id,
      email: students.email,
      admission_number: students.admission_number,
      first_name: students.first_name,
      middle_name: students.middle_name,
      last_name: students.last_name,
      class_id: students.class_id,
      date_of_birth: students.date_of_birth,
      gender: students.gender,
      photo_url: students.photo_url,
      admission_year: students.admission_year,
      created_at: students.created_at,
      class_name: classes.name,
      class_category: classes.category,
      user_email: users.email
    })
      .from(students)
      .leftJoin(classes, eq(classes.id, students.class_id))
      .leftJoin(users, eq(users.id, students.user_id))
      .where(and(...filters))
      .orderBy(asc(students.last_name), asc(students.first_name));

    return NextResponse.json(allStudents);
  } catch (error: any) {
    console.error('STUDENT_GET_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await requestJson(req);
    const { first_name, middle_name, last_name, class_id, date_of_birth, gender, admission_number, admission_year, photo_url, schoolId, email, password } = body;
    const sId = schoolId || session.schoolId;

    if (!first_name || !last_name) return NextResponse.json({ error: 'First name and last name required' }, { status: 400 });

    const id = uuidv4();
    let userId = null;

    if (email && password) {
      userId = uuidv4();
      const pwHash = await hashPassword(password);
      await db.insert(users).values({
        id: userId,
        school_id: sId,
        name: `${first_name} ${last_name}`,
        email: email,
        password_hash: pwHash,
        role: 'student'
      });
    }

    await db.insert(students).values({
      id,
      school_id: sId,
      admission_number: admission_number || null,
      first_name,
      middle_name: middle_name || '',
      last_name,
      class_id: class_id || null,
      date_of_birth: date_of_birth || '',
      gender: gender || '',
      photo_url: photo_url || '',
      admission_year: admission_year || '',
      email: email || null,
      user_id: userId
    });

    const newStudentResult = await db.select().from(students).where(eq(students.id, id)).limit(1);
    return NextResponse.json(newStudentResult[0], { status: 201 });
  } catch (error: any) {
    console.error('STUDENT_POST_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

async function requestJson(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await requestJson(req);
    const { id, first_name, middle_name, last_name, class_id, date_of_birth, gender, admission_number, admission_year, photo_url, email, password } = body;

    const studentResult = await db.select().from(students).where(eq(students.id, id)).limit(1);
    const student = studentResult[0];
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    let userId = student.user_id;

    if (email) {
      if (userId) {
        // Update user
        const updateData: any = { email, name: `${first_name} ${last_name}` };
        if (password) {
          updateData.password_hash = await hashPassword(password);
        }
        await db.update(users).set(updateData).where(eq(users.id, userId));
      } else if (password) {
        // Create user
        userId = uuidv4();
        const pwHash = await hashPassword(password);
        await db.insert(users).values({
          id: userId,
          school_id: student.school_id,
          name: `${first_name} ${last_name}`,
          email: email,
          password_hash: pwHash,
          role: 'student'
        });
      }
    }

    await db.update(students).set({
      first_name,
      middle_name,
      last_name,
      class_id,
      date_of_birth,
      gender,
      admission_number,
      admission_year,
      photo_url,
      email: email || null,
      user_id: userId
    }).where(eq(students.id, id));

    const updatedStudentResult = await db.select().from(students).where(eq(students.id, id)).limit(1);
    return NextResponse.json(updatedStudentResult[0]);
  } catch (error: any) {
    console.error('STUDENT_PUT_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await requestJson(req);

    const studentResult = await db.select({ user_id: students.user_id }).from(students).where(eq(students.id, id)).limit(1);
    const student = studentResult[0];

    if (student?.user_id) {
      await db.delete(users).where(eq(users.id, student.user_id));
    }

    await db.delete(students).where(eq(students.id, id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('STUDENT_DELETE_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
