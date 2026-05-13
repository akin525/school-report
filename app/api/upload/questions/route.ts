import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { parseQuestionsFromText } from '@/lib/question-parser';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const schoolId = formData.get('schoolId') as string;
    const teacherId = formData.get('teacherId') as string;
    const subjectId = formData.get('subjectId') as string;
    const classId = formData.get('classId') as string;
    const sessionId = formData.get('sessionId') as string;
    const term = formData.get('term') as string;

    const missing = [];
    if (!schoolId) missing.push('schoolId');
    if (!teacherId) missing.push('teacherId');
    if (!subjectId) missing.push('subjectId');
    if (!classId) missing.push('classId');
    if (!sessionId) missing.push('sessionId');
    if (!term) missing.push('term');

    if (missing.length > 0) {
      return NextResponse.json({
        error: `Missing required parameters: ${missing.join(', ')}. Please ensure Session, Class, and Subject are selected.`
      }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only PDF, Word, Excel, and CSV files are allowed' 
      }, { status: 400 });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File size too large. Maximum size is 10MB' 
      }, { status: 400 });
    }

    // Generate unique filename
    const ext = path.extname(file.name);
    const newFilename = `${uuidv4()}${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'questions', schoolId);
    
    // Ensure directory exists
    await mkdir(uploadDir, { recursive: true });
    
    const filePath = path.join(uploadDir, newFilename);
    
    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Parse questions from file
    let questions = [];
    
    if (file.type.includes('excel') || file.type.includes('spreadsheet') || ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
      questions = await parseExcelFile(filePath);
    } else if (file.type.includes('word') || ext === '.docx' || ext === '.doc') {
      questions = await parseWordFile(filePath);
    } else if (file.type.includes('pdf') || ext === '.pdf') {
      questions = await parsePDFFile(filePath);
    }

    // Clean up uploaded file after parsing
    try {
      const fs = require('fs').promises;
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Error cleaning up file:', error);
    }

    const relativePath = `/uploads/questions/${schoolId}/${newFilename}`;
    
    return NextResponse.json({ 
      success: true,
      questions,
      fileName: file.name,
      fileType: file.type,
      uploadedPath: relativePath
    });
  } catch (error: any) {
    console.error('Question upload error:', error);
    return NextResponse.json({ error: 'Upload failed: ' + error.message }, { status: 500 });
  }
}

async function parseExcelFile(filePath: string) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const questions = data.map((row: any, index: number) => {
      // Try to map Excel columns to question structure
      return {
        id: uuidv4(),
        questionNumber: index + 1,
        questionText: row['Question'] || row['question'] || row['Question Text'] || '',
        optionA: row['Option A'] || row['A'] || '',
        optionB: row['Option B'] || row['B'] || '',
        optionC: row['Option C'] || row['C'] || '',
        optionD: row['Option D'] || row['D'] || '',
        correctAnswer: row['Correct Answer'] || row['Answer'] || '',
        marks: parseInt(row['Marks'] || row['Mark'] || '1'),
        topic: row['Topic'] || '',
        difficulty: row['Difficulty'] || 'medium'
      };
    }).filter(q => q.questionText.trim() !== '');
    
    return questions;
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    return [];
  }
}

async function parseWordFile(filePath: string) {
  try {
    const fs = require('fs').promises;
    const buffer = await fs.readFile(filePath);
    
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    
    // Parse questions from the extracted text
    const questions = parseQuestionsFromText(text);
    
    return questions;
  } catch (error) {
    console.error('Error parsing Word file:', error);
    return [{
      id: uuidv4(),
      questionNumber: 1,
      questionText: 'Word file parsing failed - please check file format',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctAnswer: '',
      marks: 1,
      topic: '',
      difficulty: 'medium',
      note: 'Failed to parse Word document: ' + (error as Error).message
    }];
  }
}

async function parsePDFFile(filePath: string) {
  return [{
    id: uuidv4(),
    questionNumber: 1,
    questionText: 'PDF file parsing - please extract manually',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: '',
    marks: 1,
    topic: '',
    difficulty: 'medium',
    note: 'PDF file parsing requires additional library implementation'
  }];
}
