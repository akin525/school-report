const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export type AIProvider = 'gemini' | 'openai';

export async function generateWithOpenAI(prompt: string, responseFormat: 'json_object' | 'text' = 'json_object') {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // Cost-effective and fast
      messages: [{ role: "user", content: prompt }],
      response_format: { type: responseFormat },
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API failed with status ${response.status}: ${errorBody}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content;
}

export async function generateWithGemini(prompt: string, responseMimeType: string = "application/json") {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + GEMINI_API_KEY;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        response_mime_type: responseMimeType
      }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API failed with status ${response.status}: ${errorBody}`);
  }

  const result = await response.json();
  const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!aiText) {
    throw new Error('No content returned from Gemini');
  }

  return aiText;
}

/**
 * Generic content generation that tries OpenAI first if configured, else Gemini
 */
export async function generateAIContent(prompt: string, isJson: boolean = true, provider?: AIProvider) {
  const preferredProvider = provider || (OPENAI_API_KEY ? 'openai' : 'gemini');

  if (preferredProvider === 'openai') {
    try {
      return await generateWithOpenAI(prompt, isJson ? 'json_object' : 'text');
    } catch (e) {
      if (GEMINI_API_KEY) return await generateWithGemini(prompt, isJson ? 'application/json' : 'text/plain');
      throw e;
    }
  } else {
    try {
      return await generateWithGemini(prompt, isJson ? 'application/json' : 'text/plain');
    } catch (e) {
      if (OPENAI_API_KEY) return await generateWithOpenAI(prompt, isJson ? 'json_object' : 'text');
      throw e;
    }
  }
}

export async function generateQuestionsFromNote(content: string, count: number, difficulty: string, type: string, provider?: AIProvider) {
  const prompt = `
    Based on the following lesson note content, generate ${count} ${type} questions.
    Difficulty level: ${difficulty}.

    Return the response as a JSON array of objects with the following structure:
    [
      {
        "question_text": "The question string",
        "option_a": "Option A string",
        "option_b": "Option B string",
        "option_c": "Option C string",
        "option_d": "Option D string",
        "correct_answer": "A, B, C, or D",
        "difficulty": "${difficulty}"
      }
    ]

    If question type is 'short_answer', options can be empty and 'correct_answer' should be the expected short answer.

    IMPORTANT: Return ONLY the JSON array.

    CONTENT:
    ${content.substring(0, 8000)}
  `;

  const aiResponse = await generateAIContent(prompt, true, provider);
  const parsed = JSON.parse(aiResponse);
  // OpenAI sometimes wraps in a property if prompt wasn't explicit enough about array-only
  return Array.isArray(parsed) ? parsed : (parsed.questions || parsed.data || []);
}
