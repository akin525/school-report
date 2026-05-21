'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ExamsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '', subject_id: '', class_id: '', session_id: '', term: '1',
    start_time: '', end_time: '', duration_minutes: 60, total_marks: 100
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.error || !d.user) { router.push('/login'); return; }
      setUser(d.user);
      setStudent(d.student);
      const sid = d.user.school_id;

      loadExams(sid);
      if (d.user.role !== 'student') {
        fetch(`/api/classes?schoolId=${sid}`).then(r => r.json()).then(cls => setClasses(cls));
        fetch(`/api/subjects?schoolId=${sid}`).then(r => r.json()).then(sub => setSubjects(sub));
        fetch(`/api/sessions?schoolId=${sid}`).then(r => r.json()).then(sess => {
          setSessions(sess);
          const curr = sess.find((s: any) => s.is_current) || sess[0];
          if (curr) setFormData(prev => ({ ...prev, session_id: curr.id }));
        });
      }
    });
  }, [router]);

  const loadExams = async (sid: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/exams?schoolId=${sid}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setExams(data);
      } else {
        setExams([]);
        console.error('Expected array of exams, got:', data);
      }
    } catch (e) {
      console.error(e);
      setExams([]);
    }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, schoolId: user.school_id })
      });
      if (res.ok) {
        setShowModal(false);
        loadExams(user.school_id);
      }
    } catch (e) { alert('Failed to save exam'); }
    finally { setSaving(false); }
  };

  const isExamActive = (exam: any) => {
    const now = new Date();
    const start = new Date(exam.start_time);
    const end = new Date(exam.end_time);
    return now >= start && now <= end;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Online Exams</h1>
          <p className="text-gray-500 text-sm mt-1">
            {user?.role === 'student' ? 'Take your timed assessments online' : 'Schedule and manage online exams'}
          </p>
        </div>
        {user?.role !== 'student' && (
          <button onClick={() => setShowModal(true)} className="btn-primary">+ Schedule Exam</button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
      ) : exams.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">📝</div>
          <p className="text-lg font-medium">No exams scheduled</p>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {exams.map(exam => {
            const active = isExamActive(exam);
            const finished = new Date() > new Date(exam.end_time);
            const upcoming = new Date() < new Date(exam.start_time);

            return (
              <div key={exam.id} className="card hover:shadow-lg transition-all border-t-4 border-t-blue-600">
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase ${
                    active ? 'bg-green-100 text-green-700' :
                    finished ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {active ? '● Active Now' : finished ? 'Finished' : 'Upcoming'}
                  </span>
                  <div className="text-right">
                    <div className="text-xs font-bold text-gray-500">{exam.subject_name}</div>
                    <div className="text-[10px] text-gray-400">{exam.class_name}</div>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-gray-800 mb-2 truncate">{exam.title}</h3>

                <div className="space-y-2 text-xs text-gray-600 mb-6">
                  <div className="flex justify-between"><span>📅 Start:</span> <span className="font-medium">{new Date(exam.start_time).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>🕒 Duration:</span> <span className="font-medium">{exam.duration_minutes} mins</span></div>
                  <div className="flex justify-between"><span>🎯 Marks:</span> <span className="font-medium">{exam.total_marks}</span></div>
                </div>

                {user?.role === 'student' ? (
                  exam.student_score !== null ? (
                    <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-center font-bold">
                      Scored: {exam.student_score} / {exam.total_marks}
                    </div>
                  ) : active ? (
                    <button
                      onClick={() => router.push(`/dashboard/exams/take?id=${exam.id}`)}
                      className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-md"
                    >
                      🚀 Start Exam Now
                    </button>
                  ) : (
                    <button disabled className="w-full py-3 bg-gray-100 text-gray-400 rounded-xl font-bold cursor-not-allowed">
                      {upcoming ? 'Waiting for Start Time' : 'Exam Ended'}
                    </button>
                  )
                ) : (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <span className="text-xs text-gray-400">{exam.submission_count} Submissions</span>
                    <button onClick={() => router.push(`/dashboard/exams/results?id=${exam.id}`)} className="text-blue-600 font-bold text-xs hover:underline">View Results →</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="bg-blue-800 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">Schedule Online Exam</h3>
              <button onClick={() => setShowModal(false)} className="text-white text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="label">Exam Title</label>
                <input className="input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. First Term Mathematics CA" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Subject</label>
                  <select className="input" value={formData.subject_id} onChange={e => setFormData({...formData, subject_id: e.target.value})}>
                    <option value="">Select Subject</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Class</label>
                  <select className="input" value={formData.class_id} onChange={e => setFormData({...formData, class_id: e.target.value})}>
                    <option value="">Select Class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.arm}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Time</label>
                  <input type="datetime-local" className="input" value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} />
                </div>
                <div>
                  <label className="label">End Time (Deadline)</label>
                  <input type="datetime-local" className="input" value={formData.end_time} onChange={e => setFormData({...formData, end_time: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Duration (Minutes)</label>
                  <input type="number" className="input" value={formData.duration_minutes} onChange={e => setFormData({...formData, duration_minutes: parseInt(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="label">Total Marks</label>
                  <input type="number" className="input" value={formData.total_marks} onChange={e => setFormData({...formData, total_marks: parseInt(e.target.value) || 0})} />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving || !formData.title || !formData.class_id} className="btn-primary">
                {saving ? 'Scheduling...' : 'Schedule Exam'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
