import { v4 as uuidv4 } from 'uuid';

export function parseQuestionsFromText(text: string) {
  const questions: any[] = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  let currentQuestion: any = null;

  // Patterns (using non-global for line matching, and global for extracting multiple items)
  const questionRegex = /^(\d+)[.\)]\s*(.*)/;
  const optionRegexGlobal = /\(([a-dA-D])\)\s*([^(\n]+)/g;
  const altOptionRegexGlobal = /([a-dA-D])[.\)]\s*([^a-dA-D\n]+)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const qMatch = line.match(questionRegex);

    if (qMatch) {
      if (currentQuestion) {
        questions.push(currentQuestion);
      }

      currentQuestion = {
        id: uuidv4(),
        questionNumber: parseInt(qMatch[1]),
        questionText: qMatch[2].trim(),
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctAnswer: '',
        marks: 1,
        topic: '',
        difficulty: 'medium'
      };

      // Check for options in the same line as the question
      const optionsInSameLine = Array.from(qMatch[2].matchAll(optionRegexGlobal));

      if (optionsInSameLine.length > 0) {
        // Extract question text before the first option
        const firstOptionIndex = qMatch[2].search(/\([a-dA-D]\)/);
        if (firstOptionIndex !== -1) {
          currentQuestion.questionText = qMatch[2].substring(0, firstOptionIndex).trim();
        }

        optionsInSameLine.forEach(m => {
          const letter = m[1].toUpperCase();
          currentQuestion[`option${letter}`] = m[2].trim();
        });
      }
    } else if (currentQuestion) {
      // Look for options in this line
      const optionsInLine = Array.from(line.matchAll(optionRegexGlobal));

      if (optionsInLine.length > 0) {
        optionsInLine.forEach(m => {
          const letter = m[1].toUpperCase();
          currentQuestion[`option${letter}`] = m[2].trim();
        });
      } else {
        // Try a. or a) format
        const altOptionsInLine = Array.from(line.matchAll(altOptionRegexGlobal));

        // Only if line starts with an option or we already in option mode
        if (altOptionsInLine.length > 0 && /^[a-dA-D][.\)]/.test(line)) {
          altOptionsInLine.forEach(m => {
            const letter = m[1].toUpperCase();
            currentQuestion[`option${letter}`] = m[2].trim();
          });
        } else {
          // If we haven't found options yet, this might be continuation of question text
          if (!currentQuestion.optionA && !currentQuestion.optionB && !currentQuestion.optionC && !currentQuestion.optionD) {
            currentQuestion.questionText += ' ' + line;
          }
        }
      }
    }
  }

  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  return questions.length > 0 ? questions : [{
    id: uuidv4(),
    questionNumber: 1,
    questionText: 'No questions could be parsed from the text. Please ensure questions are properly formatted with clear numbering (e.g., 1.) and options (e.g., (a)).',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: '',
    marks: 1,
    topic: '',
    difficulty: 'medium',
    note: 'Check if the text structure matches the expected format.'
  }];
}
