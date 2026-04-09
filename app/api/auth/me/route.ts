import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const db = getDb();
  const user = db.prepare('SELECT id, name, email, role, school_id FROM users WHERE id = ?').get(session.userId) as any;
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  
  let school = null;
  let teacher = null;
  let grading = null;
  if (user.school_id) {
    school = db.prepare('SELECT * FROM schools WHERE id = ?').get(user.school_id) as any;
    grading = db.prepare('SELECT * FROM grading_system WHERE school_id = ? ORDER BY min_score DESC').all(user.school_id);
    if (user.role === 'teacher') {
      teacher = db.prepare('SELECT * FROM teachers WHERE user_id = ?').get(user.id) as any;
    }
  }
  
  return NextResponse.json({ user, school, teacher, grading });
}