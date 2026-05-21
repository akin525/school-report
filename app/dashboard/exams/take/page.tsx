'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ExamContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const examId = searchParams.get('id');

  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const submitExam = useCallback(async (auto = false) => {
    if (!auto && !confirm('Are you sure you want to submit your exam?')) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/exams/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, answers })
      });
      if (res.ok) {
        alert('Exam submitted successfully!');
        router.push('/dashboard/exams');
      } else {
        const data = await res.json();
        alert('Error: ' + data.error);
      }
    } catch (e) {
      alert('Failed to submit exam. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  }, [examId, answers, router]);

  useEffect(() => {
    if (!examId) return;

    fetch(`/api/exams/questions?examId=${examId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          alert(data.error);
          router.push('/dashboard/exams');
          return;
        }
        setExam(data.exam);
        setQuestions(data.questions);

        // Calculate remaining time
        const end = new Date(data.exam.end_time).getTime();
        const now = new Date().getTime();
        const remainingByDeadline = Math.floor((end - now) / 1000);
        const remainingByDuration = data.exam.duration_minutes * 60;

        setTimeLeft(Math.min(remainingByDeadline, remainingByDuration));
        setLoading(false);
      });
  }, [examId, router]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || submitting) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev !== null && prev <= 1) {
          clearInterval(timer);
          submitExam(true);
          return 0;
        }
        return prev !== null ? prev - 1 : null;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, submitting, submitExam]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  const q = questions[currentIdx];
  const progress = ((currentIdx + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border p-4 md:p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-4 z-10">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{exam?.title}</h1>
            <p className="text-sm text-gray-500">{exam?.subject_name} • {questions.length} Questions</p>
          </div>
          <div className={`text-2xl font-mono font-bold px-6 py-2 rounded-xl border-2 ${timeLeft && timeLeft < 300 ? 'text-red-600 border-red-100 bg-red-50 animate-pulse' : 'text-blue-700 border-blue-100 bg-blue-50'}`}>
            {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
          </div>
        </div>

        {/* Progress */}
        <div className="w-full bg-gray-200 h-2 rounded-full mb-8 overflow-hidden">
          <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-2xl shadow-xl border p-6 md:p-10 mb-8 min-h-[400px] flex flex-col justify-between">
          {questions.length === 0 ? (
            <div className="text-center py-20 text-gray-400">No questions found for this exam.</div>
          ) : (
            <>
              <div>
                <div className="flex items-center gap-3 mb-6">
                   <span className="w-10 h-10 bg-blue-700 text-white rounded-full flex items-center justify-center font-bold">{currentIdx + 1}</span>
                   <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Question</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-10 leading-relaxed">{q.question_text}</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['A', 'B', 'C', 'D'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                      className={`p-6 text-left rounded-2xl border-2 transition-all group ${answers[q.id] === opt ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-md ring-4 ring-blue-50' : 'border-gray-100 hover:border-blue-200 bg-white'}`}
                    >
                      <div className="flex items-center gap-4">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-colors ${answers[q.id] === opt ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>{opt}</span>
                        <span className="text-lg font-medium">{q[`option_${opt.toLowerCase()}`]}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-10 border-t mt-12">
                <button
                  onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
                  disabled={currentIdx === 0}
                  className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                >
                  ← Previous
                </button>

                <div className="flex gap-3">
                  {currentIdx === questions.length - 1 ? (
                    <button
                      onClick={() => submitExam()}
                      disabled={submitting}
                      className="px-10 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50"
                    >
                      {submitting ? 'Submitting...' : 'Finish & Submit Exam'}
                    </button>
                  ) : (
                    <button
                      onClick={() => setCurrentIdx(prev => Math.min(questions.length - 1, prev + 1))}
                      className="px-10 py-3 bg-blue-700 text-white rounded-xl font-bold hover:bg-blue-800 transition-all shadow-lg hover:shadow-xl active:scale-95"
                    >
                      Next Question →
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Question Grid (Desktop) */}
        <div className="bg-white rounded-2xl border p-4 flex flex-wrap gap-2 justify-center">
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIdx(i)}
              className={`w-10 h-10 rounded-lg text-xs font-bold transition-all ${
                currentIdx === i ? 'bg-blue-700 text-white scale-110 shadow-md' :
                answers[questions[i].id] ? 'bg-green-100 text-green-700 border-green-200 border' :
                'bg-gray-50 text-gray-400 border border-gray-100 hover:bg-gray-100'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TakeExamPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>}>
      <ExamContent />
    </Suspense>
  );
}
