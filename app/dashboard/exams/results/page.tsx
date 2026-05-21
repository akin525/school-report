'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const examId = searchParams.get('id');

  const [exam, setExam] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!examId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // We'll reuse the exams GET API but for results we might need a dedicated one or filter
        // For now let's assume we can fetch submissions for an exam
        const res = await fetch(`/api/exams/results?examId=${examId}`);
        const data = await res.json();
        setExam(data.exam);
        setSubmissions(data.submissions);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [examId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/exams')} className="btn-secondary text-xs">← Back to Exams</button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{exam?.title} Results</h1>
          <p className="text-gray-500 text-sm">{exam?.subject_name} • {exam?.class_name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card text-center">
          <div className="text-3xl font-bold text-blue-700">{submissions.length}</div>
          <div className="text-xs text-gray-500 uppercase font-bold">Total Submissions</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-green-600">
            {submissions.length > 0 ? (submissions.reduce((sum, s) => sum + s.score, 0) / submissions.length).toFixed(1) : 0}
          </div>
          <div className="text-xs text-gray-500 uppercase font-bold">Average Score</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-orange-600">
            {submissions.length > 0 ? Math.max(...submissions.map(s => s.score)) : 0} / {exam?.total_marks}
          </div>
          <div className="text-xs text-gray-500 uppercase font-bold">Highest Score</div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="table-header text-left">Student Name</th>
              <th className="table-header text-left">Admission No.</th>
              <th className="table-header text-center">Score</th>
              <th className="table-header text-center">%</th>
              <th className="table-header text-right">Submitted At</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map(s => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="table-cell font-bold text-gray-800 uppercase">{s.last_name}, {s.first_name}</td>
                <td className="table-cell font-mono text-xs">{s.admission_number}</td>
                <td className="table-cell text-center font-bold text-blue-700">{s.score} / {exam.total_marks}</td>
                <td className="table-cell text-center">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                    (s.score / exam.total_marks) >= 0.7 ? 'bg-green-100 text-green-700' :
                    (s.score / exam.total_marks) >= 0.4 ? 'bg-blue-100 text-blue-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {Math.round((s.score / exam.total_marks) * 100)}%
                  </span>
                </td>
                <td className="table-cell text-right text-xs text-gray-400">
                  {new Date(s.submitted_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {submissions.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400 italic">No submissions yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ExamResultsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>}>
      <ResultsContent />
    </Suspense>
  );
}
