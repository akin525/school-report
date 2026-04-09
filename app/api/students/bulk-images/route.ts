import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import getDb from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const formData = await req.formData();
    const schoolId = formData.get('schoolId') as string || session.schoolId;
    const files = formData.getAll('images') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    const db = getDb();
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'students');
    await mkdir(uploadDir, { recursive: true });

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    const updateStmt = db.prepare('UPDATE students SET photo_url = ? WHERE admission_number = ? AND school_id = ?');

    for (const file of files) {
      try {
        // Extract admission number from filename (e.g., "ADM001.jpg" -> "ADM001")
        const admissionNumber = path.parse(file.name).name;
        
        // Save file
        const ext = path.extname(file.name);
        const newFilename = `${uuidv4()}${ext}`;
        const filePath = path.join(uploadDir, newFilename);
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filePath, buffer);

        const photoUrl = `/uploads/students/${newFilename}`;

        // Update database
        const info = updateStmt.run(photoUrl, admissionNumber, schoolId);

        if (info.changes > 0) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`Student with admission number "${admissionNumber}" not found.`);
        }
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Error processing ${file.name}: ${err.message}`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      count: results.success, 
      failed: results.failed,
      errors: results.errors 
    });
  } catch (error: any) {
    console.error('Bulk image upload error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process bulk images' }, { status: 500 });
  }
}
