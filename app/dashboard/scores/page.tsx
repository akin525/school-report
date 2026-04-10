'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { calculateGrade } from '@/lib/grading';
import * as XLSX from 'xlsx';

export default function ScoresPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState('');
  const [school, setSchool] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [teacher, setTeacher] = useState<any>(null);
  const [grading, setGrading] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<string, any>>({});
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('1');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [mode, setMode] = useState<'subject' | 'student'>('subject');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [maxCA1, setMaxCA1] = useState(20);
  const [maxCA2, setMaxCA2] = useState(20);
  const [maxExam, setMaxExam] = useState(60);
  const [maxWeekly, setMaxWeekly] = useState(10);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkData, setBulkData] = useState<any[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.error || !d.user) {
        router.push('/login');
        return;
      }
      const sid = d.user.school_id;
      setSchoolId(sid);
      setUser(d.user);
      setTeacher(d.teacher);
      setSchool(d.school);
      setGrading(d.grading || []);

      if (d.school) {
        setMaxCA1(d.school.max_ca1 ?? 20);
        setMaxCA2(d.school.max_ca2 ?? 20);
        setMaxExam(d.school.max_exam ?? 60);
        setMaxWeekly(d.school.max_weekly ?? 10);
      }

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
    }).catch(() => {
      router.push('/login');
    });
  }, [router]);

  useEffect(() => {
    if (selectedClass && school) {
      const cls = classes.find(c => c.id === selectedClass);
      if (cls?.category === 'nursery') {
        setMaxCA1(school.nursery_max_ca1 ?? 20);
        setMaxCA2(school.nursery_max_ca2 ?? 20);
        setMaxExam(school.nursery_max_exam ?? 60);
        setMaxWeekly(school.nursery_max_weekly ?? 10);
      } else if (cls?.category === 'primary') {
        setMaxCA1(school.primary_max_ca1 ?? 20);
        setMaxCA2(school.primary_max_ca2 ?? 20);
        setMaxExam(school.primary_max_exam ?? 60);
        setMaxWeekly(school.primary_max_weekly ?? 10);
      } else {
        setMaxCA1(school.secondary_max_ca1 ?? 20);
        setMaxCA2(school.secondary_max_ca2 ?? 20);
        setMaxExam(school.secondary_max_exam ?? 60);
        setMaxWeekly(school.secondary_max_weekly ?? 10);
      }
    }
  }, [selectedClass, school, classes]);

  const loadSubjectsAndScores = useCallback(async () => {
    if (!selectedClass || !selectedSession || !selectedTerm) return;
    setLoading(true);

    // Load class subjects
    const subRes = await fetch(`/api/class-subjects?classId=${selectedClass}&schoolId=${schoolId}`);
    let subData = await subRes.json();

    // If teacher is secondary, only show assigned subjects UNLESS they are the class teacher (subject_id is null)
    if (user?.role === 'teacher' && teacher?.category === 'secondary') {
      const assignRes = await fetch(`/api/teachers/assignments?teacherId=${teacher.id}&classId=${selectedClass}&sessionId=${selectedSession}&schoolId=${schoolId}`);
      const assignData = await assignRes.json();
      const isClassTeacher = assignData.some((a: any) => a.subject_id === null);

      if (!isClassTeacher) {
        const assignedSubjectIds = new Set(assignData.map((a: any) => a.subject_id));
        subData = subData.filter((s: any) => assignedSubjectIds.has(s.subject_id));
      }
    }

    setSubjects(subData.map((d: any) => ({ id: d.subject_id, name: d.subject_name })));

    // Load students
    const studRes = await fetch(`/api/students?classId=${selectedClass}&schoolId=${schoolId}`);
    const studData = await studRes.json();
    setStudents(studData);

    // Load existing scores
    const scoreRes = await fetch(`/api/scores?classId=${selectedClass}&sessionId=${selectedSession}&term=${selectedTerm}&schoolId=${schoolId}`);
    const scoreData: any[] = await scoreRes.json();

    const scoreMap: Record<string, any> = {};
    for (const sc of scoreData) {
      scoreMap[`${sc.student_id}_${sc.subject_id}`] = { 
        ...sc,
        ca1: sc.ca1_score, 
        ca2: sc.ca2_score, 
        exam: sc.exam_score,
        // Preserve weekly scores if they exist
        t1: sc.t1 !== null && sc.t1 !== undefined ? sc.t1 : '',
        t2: sc.t2 !== null && sc.t2 !== undefined ? sc.t2 : '',
        t3: sc.t3 !== null && sc.t3 !== undefined ? sc.t3 : '',
        t4: sc.t4 !== null && sc.t4 !== undefined ? sc.t4 : '',
        t5: sc.t5 !== null && sc.t5 !== undefined ? sc.t5 : '',
        t6: sc.t6 !== null && sc.t6 !== undefined ? sc.t6 : '',
        t7: sc.t7 !== null && sc.t7 !== undefined ? sc.t7 : '',
        t8: sc.t8 !== null && sc.t8 !== undefined ? sc.t8 : '',
        t9: sc.t9 !== null && sc.t9 !== undefined ? sc.t9 : '',
        t10: sc.t10 !== null && sc.t10 !== undefined ? sc.t10 : '',
      };
    }
    setScores(scoreMap);
    setLoading(false);
  }, [selectedClass, selectedSession, selectedTerm, schoolId, user, teacher]);

  useEffect(() => {
    if (selectedClass && selectedSession && selectedTerm) loadSubjectsAndScores();
  }, [selectedClass, selectedSession, selectedTerm]);

  const updateScore = (studentId: string, subjectId: string, field: string, value: string) => {
    const key = `${studentId}_${subjectId}`;
    let max = 100;
    if (field === 'exam') max = maxExam;
    else if (field === 'ca1') max = maxCA1;
    else if (field === 'ca2') max = maxCA2;

    let num = parseFloat(value) || 0;
    if (num < 0) num = 0;
    if (num > max) num = max;
    
    setScores(prev => {
      const current = { 
        ...prev[key], 
        [field]: value === '' ? '' : num 
      };

      // Algorithm to distribute CA1/CA2 back to T1-T10 for Secondary classes
      const cls = classes.find(c => c.id === selectedClass);
      if (cls?.category === 'secondary' && (field === 'ca1' || field === 'ca2')) {
        const ca1 = field === 'ca1' ? num : (current.ca1 ?? 0);
        const ca2 = field === 'ca2' ? num : (current.ca2 ?? 0);
        const totalCA = ca1 + ca2;
        const maxCA = maxCA1 + maxCA2;
        
        if (maxCA > 0) {
          const targetWeeklySum = (totalCA / maxCA) * (maxWeekly * 10);
          let remaining = targetWeeklySum;
          
          // Distribute the target sum across 10 weeks as evenly as possible (steps of 0.5)
          for (let i = 1; i <= 10; i++) {
            const slotsLeft = 11 - i;
            let val = Math.round((remaining / slotsLeft) * 2) / 2;
            if (val > maxWeekly) val = maxWeekly;
            current[`t${i}`] = val;
            remaining = parseFloat((remaining - val).toFixed(2));
          }
        }
      }

      return { ...prev, [key]: current };
    });
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
          scoreList.push({ 
            ...sc,
            studentId: student.id, 
            subjectId: subject.id, 
            classId: selectedClass, 
            sessionId: selectedSession, 
            term: parseInt(selectedTerm), 
            ca1_score: sc.ca1 ?? 0, 
            ca2_score: sc.ca2 ?? 0, 
            exam_score: sc.exam ?? 0 
          });
        }
      }
    }
    await fetch('/api/scores', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scores: scoreList, schoolId }) });
    setSaving(false);
    setSaveMsg('Scores saved successfully!');
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const getOrdinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const handleBulkExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const allScores: any[] = [];

      wb.SheetNames.forEach(sheetName => {
        // Role-based filtering: Teachers can only upload for assigned subjects
        if (user?.role === 'teacher') {
          const isAssigned = subjects.some(s => s.name.toLowerCase() === sheetName.toLowerCase());
          if (!isAssigned) return; // Skip this sheet
        }

        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        // Find header row (usually contains "Admission Number" or similar)
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(data.length, 20); i++) {
          if (data[i]?.some(cell => cell?.toString().toLowerCase().includes('admission number'))) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) return; // Skip non-subject sheets

        const headers = data[headerRowIndex].map(h => h?.toString().trim().toLowerCase() || '');
        const admIdx = headers.findIndex(h => h.includes('admission number'));
        
        if (admIdx === -1) return;

        // Use fixed offsets based on the provided template structure
        let ca1Idx = -1, ca2Idx = -1, examIdx = -1;
        if (selectedTerm === '1') {
          ca1Idx = admIdx + 1;
          ca2Idx = admIdx + 2;
          examIdx = admIdx + 4;
        } else if (selectedTerm === '2') {
          ca1Idx = admIdx + 8;
          ca2Idx = admIdx + 9;
          examIdx = admIdx + 11;
        } else {
          ca1Idx = admIdx + 15;
          ca2Idx = admIdx + 16;
          examIdx = admIdx + 18;
        }

        // Process rows after header
        for (let i = headerRowIndex + 1; i < data.length; i++) {
          const row = data[i];
          if (!row) continue;
          
          const admNo = row[admIdx]?.toString().trim();
          // Skip empty rows or placeholder rows (like SN 0)
          if (!admNo || admNo === '0' || admNo === '0.0' || admNo.toLowerCase() === 'admission number') continue;

          allScores.push({
            subject_name: sheetName,
            admission_number: admNo,
            ca1: parseFloat(row[ca1Idx]) || 0,
            ca2: parseFloat(row[ca2Idx]) || 0,
            exam: parseFloat(row[examIdx]) || 0
          });
        }
      });

      setBulkData(allScores);
      setBulkResults(null);
      setShowBulkModal(true);
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const processBulkUpload = async () => {
    if (!selectedSession || !selectedTerm) return;
    setBulkProcessing(true);
    try {
      const res = await fetch('/api/scores/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scores: bulkData, 
          sessionId: selectedSession, 
          term: selectedTerm, 
          schoolId 
        })
      });
      const result = await res.json();
      if (res.ok) {
        setBulkResults({
          success: result.count,
          failed: result.failed,
          errors: result.errors
        });
        loadSubjectsAndScores();
      } else {
        alert('Error: ' + result.error);
      }
    } catch (e) {
      alert('Upload failed');
    }
    setBulkProcessing(false);
  };

  const displayStudents = mode === 'student' && selectedStudent
    ? students.filter(s => s.id === selectedStudent)
    : students;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Score Entry</h1>
          <p className="text-gray-500 text-sm mt-1">Enter CA and Exam scores for students</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedClass && classes.find(c => c.id === selectedClass)?.category === 'secondary' && (
            <button 
              onClick={() => router.push('/dashboard/reports/master-sheet')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all flex items-center shadow-sm"
            >
              <span className="mr-2">📝</span> Master Sheet
            </button>
          )}
          {selectedClass && selectedSession && (
            <label className="btn-secondary text-sm flex items-center gap-2 cursor-pointer shadow-sm">
              📁 Bulk Result Upload
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleBulkExcel} />
            </label>
          )}
          {saveMsg && <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded-lg text-sm font-medium animate-fade-in">✓ {saveMsg}</div>}
        </div>
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
              <button onClick={() => setMode('subject')} className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${mode === 'subject' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'}`}>By Subject</button>
              <button onClick={() => setMode('student')} className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${mode === 'student' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'}`}>By Student</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {mode === 'subject' && (
            <div>
              <label className="label">Select Subject</label>
              <select className="input" value={selectedSubject} onChange={e => {
                setSelectedSubject(e.target.value);
                setSelectedTerm('1');
              }}>
                <option value="">— Select subject —</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          {mode === 'student' && (
            <div>
              <label className="label">Select Student</label>
              <select className="input" value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
                <option value="">— Select student —</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} {s.middle_name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Score Table */}
      {!selectedClass || !selectedSession || (mode === 'subject' && !selectedSubject) ? (
        <div className="card text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">📝</div>
          <p className="text-lg font-medium">Select a session, class and {mode === 'subject' ? 'subject' : 'student'} to enter scores</p>
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
              {mode === 'subject' ? (
                <>
                  Subject: <span className="font-bold text-blue-700">{subjects.find(s => s.id === selectedSubject)?.name}</span> ·{' '}
                  <span className="font-medium">{students.length}</span> students
                </>
              ) : (
                <>
                  <span className="font-medium">{displayStudents.length}</span> student{displayStudents.length !== 1 ? 's' : ''} ·{' '}
                  <span className="font-medium">{subjects.length}</span> subjects
                </>
              )}
              <div className="mt-1">
              CA1 Max: <span className="font-medium">{maxCA1}</span> · CA2 Max: <span className="font-medium">{maxCA2}</span> · Exam Max: <span className="font-medium">{maxExam}</span>
            </div>
          </div>
          <button onClick={saveAllScores} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Saving...</> : '💾 Save All Scores'}
          </button>
        </div>

          {mode === 'subject' ? (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-gray-300">
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 border-r w-12">SN</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 border-r min-w-[200px]">Names of Pupils</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 border-r">Admission Number</th>
                      <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 border-r w-16">{maxCA1}</th>
                      <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 border-r w-16">{maxCA2}</th>
                      <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 border-r w-16 text-red-600">{maxCA1 + maxCA2}</th>
                      <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 border-r w-16">{maxExam}</th>
                      <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 border-r w-16 text-red-600">100</th>
                      <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 border-r w-16">Rank</th>
                      <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 w-16">Pos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const subjectStudents = students.map(s => {
                        const sc = scores[`${s.id}_${selectedSubject}`] || { ca1: 0, ca2: 0, exam: 0 };
                        return { ...s, total: sc.ca1 + sc.ca2 + sc.exam };
                      }).sort((a, b) => b.total - a.total);

                      return students.map((student, idx) => {
                        const key = `${student.id}_${selectedSubject}`;
                        const sc = scores[key] || { ca1: 0, ca2: 0, exam: 0 };
                        const caTotal = sc.ca1 + sc.ca2;
                        const grandTotal = caTotal + sc.exam;
                        const rank = subjectStudents.findIndex(s => s.id === student.id) + 1;

                        return (
                          <tr key={student.id} className="border-b border-gray-200 hover:bg-blue-50/30">
                            <td className="px-3 py-2 text-sm text-gray-600 border-r text-center font-mono">{idx + 1}</td>
                            <td className="px-3 py-2 text-sm font-medium text-gray-800 border-r uppercase">{student.last_name}, {student.first_name} {student.middle_name}</td>
                            <td className="px-3 py-2 text-sm text-blue-700 font-mono border-r">{student.admission_number || '—'}</td>
                            <td className="px-1 py-1 border-r">
                              <input
                                type="number" min="0" max={maxCA1} step="0.5"
                                className="w-full text-center bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 py-1"
                                value={sc.ca1 || ''}
                                onChange={e => updateScore(student.id, selectedSubject, 'ca1', e.target.value)}
                                placeholder="—"
                              />
                            </td>
                            <td className="px-1 py-1 border-r">
                              <input
                                type="number" min="0" max={maxCA2} step="0.5"
                                className="w-full text-center bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 py-1"
                                value={sc.ca2 || ''}
                                onChange={e => updateScore(student.id, selectedSubject, 'ca2', e.target.value)}
                                placeholder="—"
                              />
                            </td>
                            <td className="px-2 py-2 text-center text-sm font-bold text-red-600 border-r bg-gray-50/50">{caTotal || 0}</td>
                            <td className="px-1 py-1 border-r">
                              <input
                                type="number" min="0" max={maxExam} step="0.5"
                                className="w-full text-center bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 py-1"
                                value={sc.exam || ''}
                                onChange={e => updateScore(student.id, selectedSubject, 'exam', e.target.value)}
                                placeholder="—"
                              />
                            </td>
                            <td className="px-2 py-2 text-center text-sm font-bold text-red-600 border-r bg-gray-50/50">{grandTotal || 0}</td>
                            <td className="px-2 py-2 text-center text-sm font-bold text-gray-700 border-r">{rank}</td>
                            <td className="px-2 py-2 text-center text-sm font-bold text-red-600">{getOrdinal(rank)}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            displayStudents.map(student => (
              <div key={student.id} className="card p-0 overflow-hidden">
                <div className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold uppercase">{student.last_name}, {student.first_name} {student.middle_name}</h3>
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
                        <th className="table-header text-center">CA1 ({maxCA1})</th>
                        <th className="table-header text-center">CA2 ({maxCA2})</th>
                        <th className="table-header text-center">Exam ({maxExam})</th>
                        <th className="table-header text-center">Total (100)</th>
                        <th className="table-header text-center">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map(sub => {
                        const key = `${student.id}_${sub.id}`;
                        const sc = scores[key] || { ca1: 0, ca2: 0, exam: 0 };
                        const total = (sc.ca1 || 0) + (sc.ca2 || 0) + (sc.exam || 0);
                        const gInfo = calculateGrade(total, 100, grading);
                        return (
                          <tr key={sub.id} className="border-b border-gray-100 hover:bg-blue-50/30">
                            <td className="table-cell font-medium text-gray-800">{sub.name}</td>
                            <td className="px-2 py-1.5 text-center">
                              <input
                                type="number" min="0" max={maxCA1} step="0.5"
                                className="w-16 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                value={sc.ca1 || ''}
                                onChange={e => updateScore(student.id, sub.id, 'ca1', e.target.value)}
                                placeholder="0"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <input
                                type="number" min="0" max={maxCA2} step="0.5"
                                className="w-16 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                value={sc.ca2 || ''}
                                onChange={e => updateScore(student.id, sub.id, 'ca2', e.target.value)}
                                placeholder="0"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <input
                                type="number" min="0" max={maxExam} step="0.5"
                                className="w-16 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                value={sc.exam || ''}
                                onChange={e => updateScore(student.id, sub.id, 'exam', e.target.value)}
                                placeholder="0"
                              />
                            </td>
                            <td className="table-cell text-center font-bold text-gray-800">{total > 0 ? total.toFixed(1) : '—'}</td>
                            <td className="table-cell text-center text-sm font-bold" style={{ color: gInfo.color }}>{total > 0 ? gInfo.grade : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-800 text-white">
                        <td className="px-4 py-2 font-bold text-sm">TOTAL</td>
                        <td className="px-4 py-2 text-center text-sm font-bold">
                          {subjects.reduce((sum, sub) => sum + (scores[`${student.id}_${sub.id}`]?.ca1 || 0), 0).toFixed(1)}
                        </td>
                        <td className="px-4 py-2 text-center text-sm font-bold">
                          {subjects.reduce((sum, sub) => sum + (scores[`${student.id}_${sub.id}`]?.ca2 || 0), 0).toFixed(1)}
                        </td>
                        <td className="px-4 py-2 text-center text-sm font-bold">
                          {subjects.reduce((sum, sub) => sum + (scores[`${student.id}_${sub.id}`]?.exam || 0), 0).toFixed(1)}
                        </td>
                        <td className="px-4 py-2 text-center text-sm font-bold">
                          {subjects.reduce((sum, sub) => { const k = `${student.id}_${sub.id}`; return sum + (scores[k]?.ca1 || 0) + (scores[k]?.ca2 || 0) + (scores[k]?.exam || 0); }, 0).toFixed(1)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))
          )}

          <div className="flex justify-end">
            <button onClick={saveAllScores} disabled={saving} className="btn-primary px-8">
              {saving ? 'Saving...' : '💾 Save All Scores'}
            </button>
          </div>
        </div>
      )}

      {/* Bulk Scores Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-blue-800 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">Bulk Score Upload ({selectedTerm === '1' ? '1st' : selectedTerm === '2' ? '2nd' : '3rd'} Term)</h3>
              <button onClick={() => setShowBulkModal(false)} className="text-2xl leading-none">×</button>
            </div>
            <div className="p-6 overflow-auto flex-1">
              {!bulkResults ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    The system has detected <strong>{bulkData.length}</strong> scores across different subjects from your Excel file for the selected term.
                    <br/><br/>
                    <span className="text-red-600 font-bold">* Subjects in Excel must match your system subject names exactly.</span>
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-[10px]">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-2 border text-left">Subject (Sheet Name)</th>
                          <th className="p-2 border text-left">Adm No.</th>
                          <th className="p-2 border text-center">CA1</th>
                          <th className="p-2 border text-center">CA2</th>
                          <th className="p-2 border text-center">Exam</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkData.slice(0, 50).map((s, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="p-2 border">{s.subject_name}</td>
                            <td className="p-2 border font-mono">{s.admission_number}</td>
                            <td className="p-2 border text-center">{s.ca1}</td>
                            <td className="p-2 border text-center">{s.ca2}</td>
                            <td className="p-2 border text-center">{s.exam}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {bulkData.length > 50 && (
                      <div className="p-2 text-center text-gray-400 bg-gray-50 text-[10px]">
                        ... and {bulkData.length - 50} more records
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-700">{bulkResults.success}</div>
                      <div className="text-xs text-green-600 uppercase font-bold">Successfully Uploaded</div>
                    </div>
                    <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-red-700">{bulkResults.failed}</div>
                      <div className="text-xs text-red-600 uppercase font-bold">Failed/No Match</div>
                    </div>
                  </div>
                  {bulkResults.errors.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 text-xs font-bold border-b">Error Details</div>
                      <div className="max-h-48 overflow-y-auto p-4 space-y-1">
                        {bulkResults.errors.map((err, i) => (
                          <div key={i} className="text-[10px] text-red-600">• {err}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
              {!bulkResults ? (
                <>
                  <button onClick={() => setShowBulkModal(false)} className="btn-secondary" disabled={bulkProcessing}>Cancel</button>
                  <button onClick={processBulkUpload} disabled={bulkProcessing} className="btn-primary flex items-center gap-2">
                    {bulkProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                      </>
                    ) : 'Confirm and Upload All'}
                  </button>
                </>
              ) : (
                <button onClick={() => setShowBulkModal(false)} className="btn-primary">Close</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}