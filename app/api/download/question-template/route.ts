import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import * as XLSX from 'xlsx';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Create template data with proper column headers and sample data
    const templateData = [
      {
        'Question': 'What is the capital of France?',
        'Option A': 'London',
        'Option B': 'Berlin',
        'Option C': 'Paris',
        'Option D': 'Madrid',
        'Correct Answer': 'C',
        'Marks': 1,
        'Topic': 'Geography',
        'Difficulty': 'easy'
      },
      {
        'Question': 'What is 2 + 2?',
        'Option A': '3',
        'Option B': '4',
        'Option C': '5',
        'Option D': '6',
        'Correct Answer': 'B',
        'Marks': 1,
        'Topic': 'Mathematics',
        'Difficulty': 'easy'
      },
      {
        'Question': 'Which planet is known as the Red Planet?',
        'Option A': 'Venus',
        'Option B': 'Mars',
        'Option C': 'Jupiter',
        'Option D': 'Saturn',
        'Correct Answer': 'B',
        'Marks': 2,
        'Topic': 'Science',
        'Difficulty': 'medium'
      }
    ];

    // Add empty rows for users to fill in
    for (let i = 0; i < 7; i++) {
      templateData.push({
        'Question': '',
        'Option A': '',
        'Option B': '',
        'Option C': '',
        'Option D': '',
        'Correct Answer': '',
        'Marks': 1,
        'Topic': '',
        'Difficulty': 'medium'
      });
    }

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    const colWidths = [
      { wch: 50 }, // Question
      { wch: 20 }, // Option A
      { wch: 20 }, // Option B
      { wch: 20 }, // Option C
      { wch: 20 }, // Option D
      { wch: 15 }, // Correct Answer
      { wch: 8 },  // Marks
      { wch: 20 }, // Topic
      { wch: 12 }  // Difficulty
    ];
    worksheet['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Create response with proper headers
    const response = new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="question-bank-template.xlsx"',
        'Content-Length': buffer.length.toString(),
      },
    });

    return response;
  } catch (error: any) {
    console.error('Template download error:', error);
    return NextResponse.json({ error: 'Failed to generate template: ' + error.message }, { status: 500 });
  }
}
