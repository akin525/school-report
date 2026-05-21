import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { getSession } from '@/lib/auth';
import path from 'path';
import fs from 'fs/promises';
import mammoth from 'mammoth';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
        lessonNoteId,
        schoolId,
        numQuestions = 5,
        difficulty = 'medium',
        questionType = 'multiple_choice',
        action = 'generate',
        selectedTopic = ''
    } = body;

    if (!lessonNoteId || !schoolId) {
      return NextResponse.json({ error: 'Lesson note ID and school ID are required' }, { status: 400 });
    }

    const db = getDb();
    
    const lessonNote = db.prepare('SELECT * FROM lesson_notes WHERE id = ? AND school_id = ?')
      .get(lessonNoteId, schoolId) as any;

    if (!lessonNote) {
      return NextResponse.json({ error: 'Lesson note not found' }, { status: 404 });
    }

    let htmlContent = lessonNote.content || '';
    let rawText = lessonNote.content || '';

    if (lessonNote.file_url) {
      try {
        const filePath = path.join(process.cwd(), 'public', lessonNote.file_url);
        const fileBuffer = await fs.readFile(filePath);

        if (lessonNote.file_url.endsWith('.docx') || lessonNote.file_url.endsWith('.doc')) {
          const htmlResult = await mammoth.convertToHtml({ buffer: fileBuffer });
          const textResult = await mammoth.extractRawText({ buffer: fileBuffer });
          htmlContent += '\n' + htmlResult.value;
          rawText += '\n' + textResult.value;
        } else if (lessonNote.file_url.endsWith('.txt')) {
          const txt = fileBuffer.toString();
          htmlContent += '\n' + txt;
          rawText += '\n' + txt;
        }
      } catch (fileError) {
        console.error('Error reading lesson note file:', fileError);
      }
    }

    if (action === 'get-topics') {
      const topics = detectTopics(htmlContent, rawText);
      return NextResponse.json({ topics });
    }
    
    let textToProcess = rawText;
    if (selectedTopic) {
        textToProcess = extractRelevantSection(rawText, htmlContent, selectedTopic);
    }

    let generatedQuestions = [];
    try {
      const { generateQuestionsFromNote } = await import('@/lib/ai');
      generatedQuestions = await generateQuestionsFromNote(textToProcess, numQuestions, difficulty, questionType, body.provider);
    } catch (aiError) {
      console.error('AI Generation failed, falling back to rule-based generation:', aiError);
      generatedQuestions = generateSmartQuestions(textToProcess, numQuestions, difficulty, questionType);
    }

    const savedQuestions = [];
    for (const question of generatedQuestions) {
      const questionId = uuidv4();
      const questionBankId = uuidv4();
      
      const generatedStmt = db.prepare(`
        INSERT INTO generated_questions (
          id, school_id, lesson_note_id, question_text, option_a, option_b, 
          option_c, option_d, correct_answer, difficulty, question_type, correct_answer_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      generatedStmt.run(
        questionId,
        schoolId,
        lessonNoteId,
        question.question_text,
        question.option_a || '',
        question.option_b || '',
        question.option_c || '',
        question.option_d || '',
        questionType === 'multiple_choice' ? (question.correct_answer || 'A') : 'A',
        question.difficulty,
        questionType,
        questionType === 'short_answer' ? question.correct_answer : null
      );
      
      const questionBankStmt = db.prepare(`
        INSERT INTO question_bank (
          id, school_id, teacher_id, subject_id, class_id, session_id, term,
          question_text, option_a, option_b, option_c, option_d, 
          correct_answer, question_type, difficulty, marks, topic
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      questionBankStmt.run(
        questionBankId,
        schoolId,
        lessonNote.teacher_id,
        lessonNote.subject_id,
        lessonNote.class_id,
        lessonNote.session_id,
        lessonNote.term,
        question.question_text,
        question.option_a || null,
        question.option_b || null,
        question.option_c || null,
        question.option_d || null,
        question.correct_answer || 'Pending',
        questionType,
        question.difficulty,
        difficulty === 'hard' ? 5 : difficulty === 'medium' ? 2 : 1,
        selectedTopic ? `Topic: ${selectedTopic}` : 'Generated from Lesson Note: ' + lessonNote.title
      );

      savedQuestions.push({
        id: questionId,
        questionBankId: questionBankId,
        ...question
      });
    }

    return NextResponse.json({ 
      message: 'Questions generated successfully',
      questions: savedQuestions 
    });
  } catch (error) {
    console.error('Error generating questions:', error);
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
    try {
      const session = await getSession();
      if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const { searchParams } = new URL(request.url);
      const lessonNoteId = searchParams.get('lessonNoteId');
      const schoolId = searchParams.get('schoolId');
      if (!lessonNoteId || !schoolId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
      const db = getDb();
      const questions = db.prepare('SELECT * FROM generated_questions WHERE lesson_note_id = ? AND school_id = ? ORDER BY created_at DESC').all(lessonNoteId, schoolId);
      return NextResponse.json(questions);
    } catch (e) { return NextResponse.json({ error: 'Error' }, { status: 500 }); }
}

function detectTopics(html: string, raw: string) {
  const topics = new Set<string>();
  const boldMatches = html.matchAll(/<(b|strong|h[1-6])>(.*?)<\/\1>/gi);
  for (const match of boldMatches) {
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    if (text.length > 3 && text.length < 50 && !text.includes('http')) topics.add(text);
  }
  const lines = raw.split('\n');
  for (const line of lines) {
    const clean = line.trim();
    if (clean.length > 3 && clean.length < 50 && clean === clean.toUpperCase() && /[A-Z]/.test(clean)) topics.add(clean);
  }
  return Array.from(topics);
}

function extractRelevantSection(raw: string, html: string, topic: string) {
    const index = raw.indexOf(topic);
    if (index === -1) return raw;
    return raw.substring(index, index + 2500);
}

function generateSmartQuestions(text: string, count: number, difficulty: string, type: string) {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 350);

  // Extract keywords to use as plausible distractors
  const allWords = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
  const commonKeywords = allWords.filter(w => w.length > 5);
  const uniqueKeywords = Array.from(new Set(commonKeywords));

  const questions: any[] = [];
  const usedSentences = new Set();

  const factPatterns = [
    /^(.*?) is (a|the|an|defined as) (.*)$/i,
    /^(.*?) refers to (.*)$/i,
    /^(.*?) means (.*)$/i,
    /^(.*?) are (a|the|an|defined as) (.*)$/i
  ];

  for (const sentence of sentences) {
    if (questions.length >= count) break;
    for (const pattern of factPatterns) {
      const match = sentence.match(pattern);
      if (match) {
        const subject = match[1].trim();
        const definition = match[3] || match[2].trim();
        if (subject.split(' ').length <= 6) {
          if (type === 'multiple_choice') {
            // Pick distractors from other keywords in the same text
            const distractors = uniqueKeywords
                .filter(w => w !== subject.toLowerCase() && !definition.toLowerCase().includes(w))
                .sort(() => 0.5 - Math.random())
                .slice(0, 3);

            // Fill in placeholders if we don't have enough context-relevant words
            while(distractors.length < 3) distractors.push("None of the above");

            questions.push({
              question_text: `Based on the lesson, what does "${subject}" mean?`,
              option_a: capitalize(definition),
              option_b: capitalize(distractors[0]),
              option_c: capitalize(distractors[1]),
              option_d: capitalize(distractors[2]),
              correct_answer: "A",
              difficulty
            });
          } else {
            questions.push({
              question_text: `Briefly define or explain "${subject}" as discussed in this lesson.`,
              option_a: '', option_b: '', option_c: '', option_d: '',
              correct_answer: definition,
              difficulty
            });
          }
          usedSentences.add(sentence);
          break;
        }
      }
    }
  }

  if (questions.length < count) {
    for (const sentence of sentences) {
      if (questions.length >= count) break;
      if (usedSentences.has(sentence)) continue;
      const words = sentence.split(' ');
      if (words.length > 10) {
        if (type === 'multiple_choice') {
          const keywordIndex = Math.floor(words.length / 2);
          const keyword = words[keywordIndex].replace(/[,.;()]/g, '').toLowerCase();

          if (keyword.length > 4) {
            const maskedSentence = words.map((w, i) => i === keywordIndex ? '__________' : w).join(' ');

            // Get similar length words from the text as distractors
            const distractors = uniqueKeywords
                .filter(w => w !== keyword && Math.abs(w.length - keyword.length) <= 3)
                .sort(() => 0.5 - Math.random())
                .slice(0, 3);

            while(distractors.length < 3) distractors.push("unrelated term");

            questions.push({
              question_text: `Complete this sentence: "${maskedSentence}"`,
              option_a: capitalize(keyword),
              option_b: capitalize(distractors[0]),
              option_c: capitalize(distractors[1]),
              option_d: capitalize(distractors[2]),
              correct_answer: "A",
              difficulty
            });
            usedSentences.add(sentence);
          }
        } else {
          questions.push({
            question_text: `Explain the following statement from the notes: "${sentence}"`,
            option_a: '', option_b: '', option_c: '', option_d: '',
            correct_answer: 'Manual grading required',
            difficulty
          });
          usedSentences.add(sentence);
        }
      }
    }
  }

  return type === 'multiple_choice' ? questions.map(q => randomizeAnswer(q)) : questions;
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function randomizeAnswer(q: any) {
  const options = [
    { key: 'A', text: q.option_a },
    { key: 'B', text: q.option_b },
    { key: 'C', text: q.option_c },
    { key: 'D', text: q.option_d }
  ];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  const correctOption = options.find(o => o.text === q.option_a);
  return {
    ...q,
    option_a: options[0].text,
    option_b: options[1].text,
    option_c: options[2].text,
    option_d: options[3].text,
    correct_answer: correctOption ? correctOption.key : 'A'
  };
}
