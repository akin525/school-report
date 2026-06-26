import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, students } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword, createToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Search in users table (email/username)
    const usersResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
    let user = usersResult[0];

    // If not found, check if it's an admission number in the students table
    if (!user) {
      const studentsResult = await db.select().from(students).where(eq(students.admission_number, email)).limit(1);
      const student = studentsResult[0];
      if (student?.user_id) {
        const studentUserResult = await db.select().from(users).where(eq(users.id, student.user_id)).limit(1);
        user = studentUserResult[0];
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await createToken({
      userId: user.id,
      schoolId: user.school_id,
      role: user.role,
      name: user.name,
      email: user.email,
    });

    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, schoolId: user.school_id },
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
