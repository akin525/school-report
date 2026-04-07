import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'hallmark-school-secret-key-2024-super-secure'
);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(payload: {
  userId: string;
  schoolId: string | null;
  role: string;
  name: string;
  email: string;
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as {
      userId: string;
      schoolId: string | null;
      role: string;
      name: string;
      email: string;
    };
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function getGrade(score: number, maxScore: number = 100): string {
  const pct = (score / maxScore) * 100;
  if (pct >= 95) return 'A+';
  if (pct >= 90) return 'A';
  if (pct >= 87) return 'B+';
  if (pct >= 83) return 'B';
  if (pct >= 80) return 'B-';
  if (pct >= 77) return 'C+';
  if (pct >= 73) return 'C';
  if (pct >= 70) return 'C-';
  if (pct >= 67) return 'D+';
  if (pct >= 63) return 'D';
  if (pct >= 60) return 'D-';
  return 'F';
}

export function getGradeLabel(grade: string): string {
  const labels: Record<string, string> = {
    'A+': 'Distinction',
    'A': 'Super Performance',
    'B+': 'Very High',
    'B': 'High',
    'B-': 'Good',
    'C+': 'High Credit',
    'C': 'Credit',
    'C-': 'Average',
    'D+': 'Good Pass',
    'D': 'Very Good Pass',
    'D-': 'Good Pass',
    'F': 'Fail',
  };
  return labels[grade] || '';
}