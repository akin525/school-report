'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function QuizzesPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [availableTerms, setAvailableTerms] = useState<number[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [termsLoading, setTermsLoading] = useState(false);
  const [topics, setTopics] = useState<string[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<any>(null); // { subjectId, questions, currentIdx, answers, result }
  const [quizLoading, setQuizLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/quizzes');
      const data = await res.json();
      setSubjects(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadTerms = async (subject: any) => {
    setSelectedSubject(subject);
    setSelectedTerm(null);
    setTermsLoading(true);
    try {
      const res = await fetch(`/api/quizzes?subjectId=${subject.id}&terms=true`);
      const data = await res.json();
      setAvailableTerms(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setTermsLoading(false);
    }
  };

  const loadTopics = async (term: string) => {
    setSelectedTerm(term);
    setTopicsLoading(true);
    try {
      const res = await fetch(`/api/quizzes?subjectId=${selectedSubject.id}&term=${term}&topics=true`);
      const data = await res.json();
      setTopics(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setTopicsLoading(false);
    }
  };

  const startQuiz = async (subjectId: string, term: string, topic: string = 'mix') => {
    setQuizLoading(true);
    try {
      const res = await fetch(`/api/quizzes?subjectId=${subjectId}&term=${term}&topic=${topic}&limit=10`);
      const questions = await res.json();
      if (questions.length === 0) {
        alert('No questions available for this selection.');
        return;
      }
      setActiveQuiz({
        subjectId,
        term,
        topic,
        questions,
        currentIdx: 0,
        answers: {},
        result: null
      });
      // 1 minute per question
      setTimeLeft(questions.length * 60);
    } catch (e) {
      alert('Failed to load quiz');
    } finally {
      setQuizLoading(false);
    }
  };

  const submitQuiz = useCallback(async (isAuto = false) => {
    if (!isAuto && !confirm('Are you sure you want to submit?')) return;
    setQuizLoading(true);
    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: activeQuiz.subjectId,
          answers: activeQuiz.answers
        })
      });
      const result = await res.json();
      setActiveQuiz((prev: any) => ({ ...prev, result }));
    } catch (e) {
      alert('Failed to submit quiz');
    } finally {
      setQuizLoading(false);
    }
  }, [activeQuiz]);

  useEffect(() => {
    let timer: any;
    if (activeQuiz && !activeQuiz.result && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            submitQuiz(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeQuiz, timeLeft, submitQuiz]);

  const handleAnswer = (questionId: string, option: string) => {
    setActiveQuiz((prev: any) => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: option }
    }));
  };

  const nextQuestion = () => {
    setActiveQuiz((prev: any) => ({
      ...prev,
      currentIdx: Math.min(prev.currentIdx + 1, prev.questions.length - 1)
    }));
  };

  const prevQuestion = () => {
    setActiveQuiz((prev: any) => ({
      ...prev,
      currentIdx: Math.max(prev.currentIdx - 1, 0)
    }));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getTermName = (t: string | number | null) => {
    if (!t || t === 'mix') return 'Mixed Terms';
    if (t == 1) return '1st Term';
    if (t == 2) return '2nd Term';
    if (t == 3) return '3rd Term';
    return `${t} Term`;
  };

  if (activeQuiz) {
    if (activeQuiz.result) {
      return (
        <div className="max-w-2xl mx-auto py-8">
          <div className="card text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Quiz Completed!</h2>
            <p className="text-gray-500 mb-6">You've finished the assessment.</p>

            <div className="bg-blue-50 rounded-2xl p-8 mb-8 border-2 border-blue-100">
              <div className="text-5xl font-bold text-blue-700 mb-2">{activeQuiz.result.score} / {activeQuiz.result.totalMarks}</div>
              <div className="text-xl font-semibold text-blue-600">{activeQuiz.result.percentage}%</div>
            </div>

            <div className="space-y-4 mb-8 text-left">
              <h3 className="font-bold text-gray-700">Review Questions:</h3>
              {activeQuiz.questions.map((q: any, idx: number) => {
                const res = activeQuiz.result.results.find((r: any) => r.questionId === q.id);
                return (
                  <div key={q.id} className={`p-4 rounded-lg border ${res.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <p className="font-medium text-sm mb-2">{idx + 1}. {q.question_text}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className={res.selectedAnswer === 'A' ? 'font-bold underline' : ''}>A. {q.option_a}</div>
                      <div className={res.selectedAnswer === 'B' ? 'font-bold underline' : ''}>B. {q.option_b}</div>
                      <div className={res.selectedAnswer === 'C' ? 'font-bold underline' : ''}>C. {q.option_c}</div>
                      <div className={res.selectedAnswer === 'D' ? 'font-bold underline' : ''}>D. {q.option_d}</div>
                    </div>
                    <div className="mt-2 text-[10px] font-bold">
                      Your answer: <span className={res.isCorrect ? 'text-green-700' : 'text-red-700'}>{res.selectedAnswer || 'None'}</span>
                      {!res.isCorrect && <span className="ml-3 text-green-700">Correct: {res.correctAnswer}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={() => { setActiveQuiz(null); setSelectedSubject(null); setSelectedTerm(null); }} className="btn-primary px-8">Back to Quizzes</button>
          </div>
        </div>
      );
    }

    const q = activeQuiz.questions[activeQuiz.currentIdx];
    const progress = ((activeQuiz.currentIdx + 1) / activeQuiz.questions.length) * 100;

    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => { if(confirm('Exit quiz? Progress will be lost.')) setActiveQuiz(null); }} className="text-gray-500 hover:text-gray-700 flex items-center gap-2">
            <span>←</span> Exit Quiz
          </button>
          <div className="flex items-center gap-4">
            <div className={`text-lg font-bold px-4 py-2 rounded-lg border-2 ${timeLeft < 60 ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
              ⏱️ {formatTime(timeLeft)}
            </div>
            <div className="text-sm font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              Question {activeQuiz.currentIdx + 1} of {activeQuiz.questions.length}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 h-2 rounded-full mb-8 overflow-hidden">
          <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
        </div>

        <div className="card mb-8 min-h-[400px] flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex justify-between items-start mb-6">
               <div>
                 <h2 className="text-2xl font-bold text-gray-800">{q.question_text}</h2>
                 <div className="flex gap-2 mt-2">
                   <span className="text-[10px] bg-blue-100 px-2 py-1 rounded uppercase font-bold text-blue-700">{getTermName(q.term)}</span>
                   {q.topic && <span className="text-[10px] bg-gray-100 px-2 py-1 rounded uppercase font-bold text-gray-500">{q.topic}</span>}
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['A', 'B', 'C', 'D'].map(opt => (
                <button
                  key={opt}
                  onClick={() => handleAnswer(q.id, opt)}
                  className={`p-6 text-left rounded-xl border-2 transition-all hover:border-blue-300 group ${activeQuiz.answers[q.id] === opt ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md' : 'border-gray-100 bg-white'}`}
                >
                  <div className="flex items-center">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mr-4 border-2 transition-colors ${activeQuiz.answers[q.id] === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-400 border-gray-200 group-hover:border-blue-200'}`}>
                      {opt}
                    </span>
                    <span className="text-lg">{q[`option_${opt.toLowerCase()}`]}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-8 border-t mt-8">
            <button onClick={prevQuestion} disabled={activeQuiz.currentIdx === 0} className="btn-secondary disabled:opacity-30">Previous</button>
            {activeQuiz.currentIdx === activeQuiz.questions.length - 1 ? (
              <button onClick={() => submitQuiz()} disabled={quizLoading} className="btn-primary bg-green-600 hover:bg-green-700 px-12 text-lg">
                {quizLoading ? 'Submitting...' : 'Submit Quiz'}
              </button>
            ) : (
              <button onClick={nextQuestion} className="btn-primary px-12 text-lg">Next Question</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Self Assessment Quizzes</h1>
          <p className="text-gray-500 text-sm mt-1">Practice and test your knowledge on various subjects</p>
        </div>
        {selectedSubject && (
          <button onClick={() => { setSelectedSubject(null); setSelectedTerm(null); }} className="text-blue-600 font-medium hover:underline flex items-center gap-1">
            <span>←</span> Back to all subjects
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : selectedSubject ? (
        <div className="max-w-2xl mx-auto">
          <div className="card border-t-4 border-t-blue-600">
             <div className="flex justify-between items-center mb-6">
               <h2 className="text-2xl font-bold text-gray-800">{selectedSubject.name}</h2>
               {selectedTerm && (
                 <button onClick={() => setSelectedTerm(null)} className="text-sm text-blue-600 font-medium hover:underline">
                   Change Term
                 </button>
               )}
             </div>

             {!selectedTerm ? (
               <>
                 <p className="text-gray-500 mb-6 italic">Select a term to view specific topics, or choose "Mixed Terms" to practice everything.</p>
                 {termsLoading ? (
                   <div className="flex justify-center py-8">
                     <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                   </div>
                 ) : (
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <button
                       onClick={() => loadTopics('mix')}
                       className="p-6 text-left rounded-xl border-2 border-blue-100 bg-blue-50 hover:border-blue-300 transition-all group shadow-sm"
                     >
                       <div className="text-2xl mb-2">🌀</div>
                       <h4 className="font-bold text-blue-900 group-hover:text-blue-700">Mixed Terms</h4>
                       <p className="text-xs text-blue-600 mt-1">Practice questions from all terms</p>
                     </button>
                     {availableTerms.map(t => (
                       <button
                         key={t}
                         onClick={() => loadTopics(t.toString())}
                         className="p-6 text-left rounded-xl border-2 border-gray-100 hover:border-blue-300 hover:bg-gray-50 transition-all group shadow-sm"
                       >
                         <div className="text-2xl mb-2">📅</div>
                         <h4 className="font-bold text-gray-800 group-hover:text-blue-700">{getTermName(t)}</h4>
                         <p className="text-xs text-gray-500 mt-1">Focus on questions from this term</p>
                       </button>
                     ))}
                   </div>
                 )}
               </>
             ) : (
               <>
                 <p className="text-gray-500 mb-6 italic">
                   Current: <span className="font-bold text-blue-700">{getTermName(selectedTerm)}</span>.
                   Choose a specific topic or take a mixed quiz.
                 </p>
                 {topicsLoading ? (
                   <div className="flex justify-center py-8">
                     <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                   </div>
                 ) : (
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <button
                       onClick={() => startQuiz(selectedSubject.id, selectedTerm, 'mix')}
                       className="p-6 text-left rounded-xl border-2 border-blue-100 bg-blue-50 hover:border-blue-300 transition-all group shadow-sm"
                     >
                       <div className="text-2xl mb-2">🌀</div>
                       <h4 className="font-bold text-blue-900 group-hover:text-blue-700">Mix (All {getTermName(selectedTerm)} Topics)</h4>
                       <p className="text-xs text-blue-600 mt-1">Random questions from this term</p>
                     </button>

                     {topics.map(topic => (
                       <button
                         key={topic}
                         onClick={() => startQuiz(selectedSubject.id, selectedTerm, topic)}
                         className="p-6 text-left rounded-xl border-2 border-gray-100 hover:border-blue-300 hover:bg-gray-50 transition-all group shadow-sm"
                       >
                         <div className="text-2xl mb-2">📌</div>
                         <h4 className="font-bold text-gray-800 group-hover:text-blue-700">{topic}</h4>
                         <p className="text-xs text-gray-500 mt-1">Focus only on this topic</p>
                       </button>
                     ))}
                   </div>
                 )}
               </>
             )}
          </div>
        </div>
      ) : subjects.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">📝</div>
          <p className="text-lg font-medium">No quizzes available for your class yet</p>
          <p className="text-sm mt-2">Check back later once your teachers upload questions.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map(sub => (
            <div key={sub.id} className="card hover:shadow-lg transition-all border-t-4 border-t-blue-600 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-2xl">
                    📚
                  </div>
                  <span className="badge-primary">{sub.question_count} Questions</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">{sub.name}</h3>
                <p className="text-sm text-gray-500 mb-6">Test your understanding of {sub.name} with randomized questions.</p>
              </div>

              <button
                onClick={() => loadTerms(sub)}
                disabled={sub.question_count === 0 || quizLoading}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {quizLoading ? 'Loading...' : 'Start Practice Quiz'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
