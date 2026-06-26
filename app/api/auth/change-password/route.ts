import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword, verifyPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new passwords required' }, { status: 400 });
    }

    const userResult = await db.select({ password_hash: users.password_hash }).from(users).where(eq(users.id, session.userId)).limit(1);
    const user = userResult[0];

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) return NextResponse.json({ error: 'Invalid current password' }, { status: 401 });

    const newHash = await hashPassword(newPassword);
    await db.update(users).set({ password_hash: newHash }).where(eq(users.id, session.userId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('CHANGE_PASSWORD_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

