import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { verifyPassword, createToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const db = getDb();
    // Search in users table (email/username)
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    // If not found, check if it's an admission number in the students table
    if (!user) {
      const student = db.prepare('SELECT user_id FROM students WHERE admission_number = ?').get(email) as any;
      if (student?.user_id) {
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(student.user_id) as any;
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
