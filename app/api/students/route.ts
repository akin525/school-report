import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { students, classes, users, scores } from '@/lib/schema';
import { eq, and, or, like, asc, getTableColumns, inArray, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('schoolId') || session.schoolId;
    const classId = searchParams.get('classId');
    const sessionId = searchParams.get('sessionId');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const status = searchParams.get('status') || 'active';
    const sortBy = searchParams.get('sortBy') || 'last_name';

    // Security check: Students should only see themselves
    if (session.role === 'student') {
      const results = await db.select({
        ...getTableColumns(students),
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
    if (status !== 'all') filters.push(eq(students.status, status as any));

    if (classId) {
      if (sessionId) {
        // If sessionId is provided, we want students who were in this class during that session
        // (identified by having scores in that class/session) OR are currently in it.
        const historicalStudentIdsResult = await db.selectDistinct({ id: scores.student_id })
          .from(scores)
          .where(and(
            eq(scores.class_id, classId),
            eq(scores.session_id, sessionId),
            eq(scores.school_id, schoolId || '')
          ));
        const historicalIds = historicalStudentIdsResult.map(r => r.id);

        if (historicalIds.length > 0) {
          filters.push(or(
            eq(students.class_id, classId),
            inArray(students.id, historicalIds)
          ));
        } else {
          filters.push(eq(students.class_id, classId));
        }
      } else {
        filters.push(eq(students.class_id, classId));
      }
    }

    if (category) filters.push(eq(classes.category, category as any));
    if (search) {
      const s = `%${search}%`;
      const searchFilter = or(
        like(students.first_name, s),
        like(students.last_name, s),
        like(students.admission_number, s)
      );
      if (searchFilter) filters.push(searchFilter);
    }

    let orderBy = asc(students.last_name);
    if (sortBy === 'admission_number') orderBy = asc(students.admission_number);
    else if (sortBy === 'first_name') orderBy = asc(students.first_name);

    const allStudents = await db.select({
      ...getTableColumns(students),
      class_name: classes.name,
      class_category: classes.category,
      user_email: users.email
    })
      .from(students)
      .leftJoin(classes, eq(classes.id, students.class_id))
      .leftJoin(users, eq(users.id, students.user_id))
      .where(and(...filters))
      .orderBy(orderBy);

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

    const body = await req.json();
    const { 
      first_name, middle_name, last_name, class_id, date_of_birth, gender, 
      admission_number, hallmark_reg_no, date_of_admission, admission_year,
      status, 
      photo_url, schoolId, email, password, phone, religion, home_address, 
      previous_school, state_of_origin, lga, bece_no, lin_no
    } = body;
    const sId = schoolId || session.schoolId;

    if (!first_name || !last_name) {
      return NextResponse.json({ error: 'First name and last name are required' }, { status: 400 });
    }

    const clean = (val: any, useEmptyString = false) => {
      if (val === undefined || val === null) return useEmptyString ? '' : null;
      const s = String(val).trim();
      return s === '' ? (useEmptyString ? '' : null) : s;
    };

    const id = uuidv4();
    let userId = null;

    const cleanEmail = clean(email);
    if (cleanEmail && password) {
      userId = uuidv4();
      const pwHash = await hashPassword(password);
      await db.insert(users).values({
        id: userId,
        school_id: sId,
        name: `${first_name} ${last_name}`,
        email: cleanEmail,
        password_hash: pwHash,
        role: 'student'
      });
    }

    await db.insert(students).values({
      id,
      school_id: sId,
      admission_number: clean(admission_number),
      hallmark_reg_no: clean(hallmark_reg_no),
      date_of_admission: clean(date_of_admission) ? new Date(date_of_admission) : null,
      first_name: first_name.trim(),
      middle_name: clean(middle_name, true),
      last_name: last_name.trim(),
      class_id: clean(class_id),
      date_of_birth: clean(date_of_birth, true),
      gender: clean(gender, true),
      religion: clean(religion, true),
      home_address: clean(home_address, true),
      previous_school: clean(previous_school, true),
      state_of_origin: clean(state_of_origin, true),
      lga: clean(lga, true),
      bece_no: clean(bece_no, true),
      lin_no: clean(lin_no, true),
      photo_url: clean(photo_url),
      admission_year: clean(admission_year, true),
      status: (clean(status) || 'active') as any,
      email: cleanEmail || '',
      phone: clean(phone, true),
      user_id: userId
    });

    const newStudentResult = await db.select().from(students).where(eq(students.id, id)).limit(1);
    return NextResponse.json(newStudentResult[0], { status: 201 });
  } catch (error: any) {
    console.error('STUDENT_POST_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { 
      id, first_name, middle_name, last_name, class_id, date_of_birth, gender, 
      admission_number, hallmark_reg_no, date_of_admission, admission_year,
      status, 
      photo_url, email, password, phone, religion, home_address, 
      previous_school, state_of_origin, lga, bece_no, lin_no
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    if (!first_name || !last_name) {
      return NextResponse.json({ error: 'First name and last name are required' }, { status: 400 });
    }

    const studentResult = await db.select().from(students).where(eq(students.id, id)).limit(1);
    const student = studentResult[0];
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    // Robust utility to ensure empty strings are converted to NULL
    // Fallback to empty string for fields that might be NOT NULL in user's DB
    const clean = (val: any, useEmptyString = false) => {
      if (val === undefined || val === null) return useEmptyString ? '' : null;
      const s = String(val).trim();
      return s === '' ? (useEmptyString ? '' : null) : s;
    };

    let userId = clean(student.user_id);
    const cleanEmail = clean(email);

    if (cleanEmail) {
      if (userId) {
        // Update user
        const userUpdate: any = { email: cleanEmail, name: `${first_name} ${last_name}` };
        if (password) userUpdate.password_hash = await hashPassword(password);
        await db.update(users).set(userUpdate).where(eq(users.id, userId));
      } else if (password) {
        // Create user
        userId = uuidv4();
        const pwHash = await hashPassword(password);
        await db.insert(users).values({
          id: userId,
          school_id: student.school_id,
          name: `${first_name} ${last_name}`,
          email: cleanEmail,
          password_hash: pwHash,
          role: 'student'
        });
      }
    }

    const updateData: any = {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      status: (clean(status) || 'active'),
      user_id: userId,
      // Use empty strings for these to avoid "cannot be null" errors in older DB schemas
      phone: clean(phone, true),
      email: clean(email, true),
      religion: clean(religion, true),
      home_address: clean(home_address, true),
      previous_school: clean(previous_school, true),
      state_of_origin: clean(state_of_origin, true),
      lga: clean(lga, true),
      bece_no: clean(bece_no, true),
      lin_no: clean(lin_no, true),
      admission_year: clean(admission_year, true),
    };

    if (class_id !== undefined) updateData.class_id = clean(class_id);
    if (date_of_birth !== undefined) updateData.date_of_birth = clean(date_of_birth);
    if (gender !== undefined) updateData.gender = clean(gender);
    if (photo_url !== undefined) updateData.photo_url = clean(photo_url);

    // Keep admission_number as NULL if empty to avoid unique constraint conflicts
    if (admission_number !== undefined) {
      const val = clean(admission_number);
      if (val !== student.admission_number) updateData.admission_number = val;
    }
    if (hallmark_reg_no !== undefined) {
      const val = clean(hallmark_reg_no);
      if (val !== student.hallmark_reg_no) updateData.hallmark_reg_no = val;
    }

    // Safe Date handling
    if (date_of_admission !== undefined) {
      const d = clean(date_of_admission);
      updateData.date_of_admission = d ? new Date(d) : null;
    }

    await db.update(students).set(updateData).where(eq(students.id, id));

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

    const { id } = await req.json();

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
