'use client';
import { useState, useEffect, useCallback } from 'react';

export default function ScoresPage() {
  const [schoolId, setSchoolId] = useState('');
  const [user, setUser] = useState<any>(null);
  const [teacher, setTeacher] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<string, { ca: number; exam: number }>>({});
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('1');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [mode, setMode] = useState<'class' | 'student'>('class');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [maxCA, setMaxCA] = useState(70);
  const [maxExam, setMaxExam] = useState(30);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      const sid = d.user.school_id;
      setSchoolId(sid);
      setUser(d.user);
      setTeacher(d.teacher);
      Promise.all([
        fetch(`/api/sessions?schoolId=${sid}`).then(r => r.json()),
        fetch(`/api/classes?schoolId=${sid}`).then(r => r.json()),
      ]).then(([sess, cls]) => {
        setSessions(sess);
        
        // If teacher, filter classes to only those they are assigned to
        if (d.user.role === 'teacher') {
          fetch(`/api/teachers/assignments?teacherId=${d.teacher.id}&schoolId=${sid}`)
            .then(r => r.json())
            .then(assigns => {
              const assignedClassIds = new Set(assigns.map((a: any) => a.class_id));
              setClasses(cls.filter((c: any) => assignedClassIds.has(c.id)));
            });
        } else {
          setClasses(cls);
        }

        const curr = sess.find((s: any) => s.is_current) || sess[0];
        if (curr) setSelectedSession(curr.id);
      });
    });
  }, []);

  const loadSubjectsAndScores = useCallback(async () => {
    if (!selectedClass || !selectedSession || !selectedTerm) return;
    setLoading(true);

    // Load class subjects
    const subRes = await fetch(`/api/class-subjects?classId=${selectedClass}&schoolId=${schoolId}`);
    let subData = await subRes.json();

    // If teacher is secondary, only show assigned subjects
    if (user?.role === 'teacher' && teacher?.category === 'secondary') {
      const assignRes = await fetch(`/api/teachers/assignments?teacherId=${teacher.id}&classId=${selectedClass}&sessionId=${selectedSession}&schoolId=${schoolId}`);
      const assignData = await assignRes.json();
      const assignedSubjectIds = new Set(assignData.map((a: any) => a.subject_id));
      subData = subData.filter((s: any) => assignedSubjectIds.has(s.subject_id));
    }

    setSubjects(subData.map((d: any) => ({ id: d.subject_id, name: d.subject_name })));

    // Detect CA/Exam max based on class category
    const cls = classes.find((c: any) => c.id === selectedClass);
    if (cls?.category === 'nursery' || cls?.category === 'primary') { setMaxCA(40); setMaxExam(60); }
    else { setMaxCA(70); setMaxExam(30); }

    // Load students
    const studRes = await fetch(`/api/students?classId=${selectedClass}&schoolId=${schoolId}`);
    const studData = await studRes.json();
    setStudents(studData);

    // Load existing scores
    const scoreRes = await fetch(`/api/scores?classId=${selectedClass}&sessionId=${selectedSession}&term=${selectedTerm}&schoolId=${schoolId}`);
    const scoreData: any[] = await scoreRes.json();

    const scoreMap: Record<string, { ca: number; exam: number }> = {};
    for (const sc of scoreData) {
      scoreMap[`${sc.student_id}_${sc.subject_id}`] = { ca: sc.ca_score, exam: sc.exam_score };
    }
    setScores(scoreMap);
    setLoading(false);
  }, [selectedClass, selectedSession, selectedTerm, schoolId, classes]);

  useEffect(() => {
    if (selectedClass && selectedSession && selectedTerm) loadSubjectsAndScores();
  }, [selectedClass, selectedSession, selectedTerm]);

  const updateScore = (studentId: string, subjectId: string, field: 'ca' | 'exam', value: string) => {
    const key = `${studentId}_${subjectId}`;
    const max = field === 'ca' ? maxCA : maxExam;
    let num = parseFloat(value) || 0;
    if (num < 0) num = 0;
    if (num > max) num = max;
    setScores(prev => ({ ...prev, [key]: { ...prev[key], ca: prev[key]?.ca ?? 0, exam: prev[key]?.exam ?? 0, [field]: num } }));
  };

  const getGrade = (total: number) => {
    if (total >= 95) return { g: 'A+', color: 'text-emerald-700 font-bold' };
    if (total >= 90) return { g: 'A', color: 'text-green-700 font-bold' };
    if (total >= 87) return { g: 'B+', color: 'text-blue-700 font-bold' };
    if (total >= 83) return { g: 'B', color: 'text-blue-600' };
    if (total >= 80) return { g: 'B-', color: 'text-cyan-600' };
    if (total >= 77) return { g: 'C+', color: 'text-cyan-500' };
    if (total >= 73) return { g: 'C', color: 'text-yellow-600' };
    if (total >= 70) return { g: 'C-', color: 'text-yellow-500' };
    if (total >= 67) return { g: 'D+', color: 'text-orange-600' };
    if (total >= 63) return { g: 'D', color: 'text-orange-500' };
    if (total >= 60) return { g: 'D-', color: 'text-red-500' };
    return { g: 'F', color: 'text-red-700 font-bold' };
  };

  const saveAllScores = async () => {
    if (!selectedClass || !selectedSession || !selectedTerm) return;
    setSaving(true);
    const scoreList: any[] = [];
    for (const student of students) {
      for (const subject of subjects) {
        const key = `${student.id}_${subject.id}`;
        const sc = scores[key];
        if (sc !== undefined) {
          scoreList.push({ studentId: student.id, subjectId: subject.id, classId: selectedClass, sessionId: selectedSession, term: parseInt(selectedTerm), ca_score: sc.ca ?? 0, exam_score: sc.exam ?? 0 });
        }
      }
    }
    await fetch('/api/scores', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scores: scoreList, schoolId }) });
    setSaving(false);
    setSaveMsg('Scores saved successfully!');
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const displayStudents = mode === 'student' && selectedStudent
    ? students.filter(s => s.id === selectedStudent)
    : students;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl font-bold text-gray-800">Score Entry</h1><p className="text-gray-500 text-sm mt-1">Enter CA and Exam scores for students</p></div>
        {saveMsg && <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded-lg text-sm font-medium">✓ {saveMsg}</div>}
      </div>

      {/* Filter Bar */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Session</label>
            <select className="input" value={selectedSession} onChange={e => setSelectedSession(e.target.value)}>
              <option value="">Select session</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Class</label>
            <select className="input" value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedStudent(''); }}>
              <option value="">Select class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.arm}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Term</label>
            <select className="input" value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}>
              <option value="1">1st Term</option>
              <option value="2">2nd Term</option>
              <option value="3">3rd Term</option>
            </select>
          </div>
          <div>
            <label className="label">View Mode</label>
            <div className="flex gap-2">
              <button onClick={() => setMode('class')} className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${mode === 'class' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'}`}>All Students</button>
              <button onClick={() => setMode('student')} className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${mode === 'student' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'}`}>Single</button>
            </div>
          </div>
        </div>
        {mode === 'student' && students.length > 0 && (
          <div className="mt-4">
            <label className="label">Select Student</label>
            <select className="input" value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
              <option value="">— Select student —</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} {s.middle_name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Score Table */}
      {!selectedClass || !selectedSession ? (
        <div className="card text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">📝</div>
          <p className="text-lg font-medium">Select a session and class to enter scores</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center h-32 items-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
      ) : subjects.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-lg font-medium">No subjects assigned to this class.</p>
          <p className="text-sm mt-1">Go to Classes to assign subjects first.</p>
        </div>
      ) : displayStudents.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-lg font-medium">No students in this class yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{displayStudents.length}</span> student{displayStudents.length !== 1 ? 's' : ''} ·{' '}
              <span className="font-medium">{subjects.length}</span> subjects ·{' '}
              CA max: <span className="font-medium">{maxCA}</span> · Exam max: <span className="font-medium">{maxExam}</span>
            </div>
            <button onClick={saveAllScores} disabled={saving} className="btn-primary flex items-center gap-2">
              {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Saving...</> : '💾 Save All Scores'}
            </button>
          </div>

          {displayStudents.map(student => (
            <div key={student.id} className="card p-0 overflow-hidden">
              <div className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between">
                <div>
                  <h3 className="font-bold">{student.last_name}, {student.first_name} {student.middle_name}</h3>
                  <p className="text-gray-400 text-xs">{student.admission_number || 'No Admission No.'}</p>
                </div>
                <div className="text-right text-xs text-gray-400">
                  Term {selectedTerm} Scores
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="table-header text-left w-48">Subject</th>
                      <th className="table-header text-center">CA ({maxCA})</th>
                      <th className="table-header text-center">Exam ({maxExam})</th>
                      <th className="table-header text-center">Total (100)</th>
                      <th className="table-header text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map(sub => {
                      const key = `${student.id}_${sub.id}`;
                      const sc = scores[key] || { ca: 0, exam: 0 };
                      const total = (sc.ca || 0) + (sc.exam || 0);
                      const grade = getGrade(total);
                      return (
                        <tr key={sub.id} className="border-b border-gray-100 hover:bg-blue-50/30">
                          <td className="table-cell font-medium text-gray-800">{sub.name}</td>
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="number" min="0" max={maxCA} step="0.5"
                              className="w-20 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                              value={sc.ca || ''}
                              onChange={e => updateScore(student.id, sub.id, 'ca', e.target.value)}
                              placeholder="0"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="number" min="0" max={maxExam} step="0.5"
                              className="w-20 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                              value={sc.exam || ''}
                              onChange={e => updateScore(student.id, sub.id, 'exam', e.target.value)}
                              placeholder="0"
                            />
                          </td>
                          <td className="table-cell text-center font-bold text-gray-800">{total > 0 ? total.toFixed(1) : '—'}</td>
                          <td className={`table-cell text-center text-sm ${grade.color}`}>{total > 0 ? grade.g : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-800 text-white">
                      <td className="px-4 py-2 font-bold text-sm">TOTAL</td>
                      <td className="px-4 py-2 text-center text-sm font-bold">
                        {subjects.reduce((sum, sub) => sum + (scores[`${student.id}_${sub.id}`]?.ca || 0), 0).toFixed(1)}
                      </td>
                      <td className="px-4 py-2 text-center text-sm font-bold">
                        {subjects.reduce((sum, sub) => sum + (scores[`${student.id}_${sub.id}`]?.exam || 0), 0).toFixed(1)}
                      </td>
                      <td className="px-4 py-2 text-center text-sm font-bold">
                        {subjects.reduce((sum, sub) => { const k = `${student.id}_${sub.id}`; return sum + (scores[k]?.ca || 0) + (scores[k]?.exam || 0); }, 0).toFixed(1)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <button onClick={saveAllScores} disabled={saving} className="btn-primary px-8">
              {saving ? 'Saving...' : '💾 Save All Scores'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}