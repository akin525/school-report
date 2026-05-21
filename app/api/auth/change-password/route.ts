import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword, verifyPassword } from '@/lib/auth';
import getDb from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new passwords required' }, { status: 400 });
    }

    const db = getDb();
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(session.userId) as any;

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) return NextResponse.json({ error: 'Invalid current password' }, { status: 401 });

    const newHash = await hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, session.userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('CHANGE_PASSWORD_ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
