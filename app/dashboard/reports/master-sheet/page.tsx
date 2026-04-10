'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function MasterScoreSheetPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('1');
  const [data, setData] = useState<any>(null);
  const [scores, setScores] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [school, setSchool] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.error || !d.user) {
        router.push('/login');
        return;
      }
      const sid = d.user.school_id;
      
      setSchool(d.school);
      fetch(`/api/sessions?schoolId=${sid}`).then(r => r.json()).then(sess => {
        setSessions(sess);
        const curr = sess.find((s: any) => s.is_current) || sess[0];
        if (curr) setSelectedSession(curr.id);
      });
      fetch(`/api/classes?schoolId=${sid}`).then(r => r.json()).then(cls => setClasses(cls.filter((c: any) => c.category === 'secondary')));
    });
  }, [router]);

  useEffect(() => {
    if (selectedClass) {
      fetch(`/api/subjects?classId=${selectedClass}`).then(r => r.json()).then(subjs => {
        setSubjects(subjs);
        if (subjs.length > 0) setSelectedSubject(subjs[0].id);
        else setSelectedSubject('');
      });
    } else {
      setSubjects([]);
      setSelectedSubject('');
    }
  }, [selectedClass]);

  const loadData = useCallback(async () => {
    if (!selectedSession || !selectedClass || !selectedSubject || !selectedTerm) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/master-sheet?sessionId=${selectedSession}&classId=${selectedClass}&subjectId=${selectedSubject}&term=${selectedTerm}`);
      const d = await res.json();
      setData(d);
      
      const scoreMap: Record<string, any> = {};
      d.students.forEach((student: any) => {
        const s = d.scores.find((sc: any) => sc.student_id === student.id) || {};
        scoreMap[student.id] = {
          t1: s.t1 !== null && s.t1 !== undefined ? s.t1 : '', 
          t2: s.t2 !== null && s.t2 !== undefined ? s.t2 : '', 
          t3: s.t3 !== null && s.t3 !== undefined ? s.t3 : '', 
          t4: s.t4 !== null && s.t4 !== undefined ? s.t4 : '', 
          t5: s.t5 !== null && s.t5 !== undefined ? s.t5 : '',
          t6: s.t6 !== null && s.t6 !== undefined ? s.t6 : '', 
          t7: s.t7 !== null && s.t7 !== undefined ? s.t7 : '', 
          t8: s.t8 !== null && s.t8 !== undefined ? s.t8 : '', 
          t9: s.t9 !== null && s.t9 !== undefined ? s.t9 : '', 
          t10: s.t10 !== null && s.t10 !== undefined ? s.t10 : '',
          ca1_score: s.ca1_score || 0,
          ca2_score: s.ca2_score || 0,
          exam_score: s.exam_score || 0,
          total: s.total || 0
        };
      });
      setScores(scoreMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedSession, selectedClass, selectedSubject, selectedTerm]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrint = () => window.print();

  // Get dynamic max values based on class category
  const getMaxValues = () => {
    if (!school || !data?.class) return { weekly: 10, ca1: 20, ca2: 20, exam: 60 };
    const cat = data.class.category || 'secondary';
    if (cat === 'nursery') return { weekly: school.nursery_max_weekly || 10, ca1: school.nursery_max_ca1 || 20, ca2: school.nursery_max_ca2 || 20, exam: school.nursery_max_exam || 60 };
    if (cat === 'primary') return { weekly: school.primary_max_weekly || 10, ca1: school.primary_max_ca1 || 20, ca2: school.primary_max_ca2 || 20, exam: school.primary_max_exam || 60 };
    return { weekly: school.secondary_max_weekly || 10, ca1: school.secondary_max_ca1 || 20, ca2: school.secondary_max_ca2 || 20, exam: school.secondary_max_exam || 60 };
  };

  const maxVals = getMaxValues();
  
  const schoolName = school?.secondary_name || school?.name || 'HALLMARK HEIGHTS COLLEGE';

  const handleScoreChange = (studentId: string, field: string, value: string) => {
    const numVal = parseFloat(value) || 0;
    const maxVals = getMaxValues();
    
    // Prevent entering scores higher than the set maximums
    if (field.startsWith('t') && field !== 'total') {
      if (numVal > maxVals.weekly) return;
    }
    if (field === 'exam_score' && numVal > maxVals.exam) return;
    
    setScores(prev => {
      // Ensure we don't convert empty string to 0 prematurely to track tests taken
      const current = { ...prev[studentId], [field]: value === '' ? '' : numVal };
      
      // If a weekly assessment was changed (T1-T10), scale based on ONLY tests taken (Option 2)
      if (field.startsWith('t') && field !== 'total') {
        const testsTaken = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(i => {
          const val = current[`t${i}`];
          return val !== undefined && val !== null && val !== '';
        });
        
        const weeklyTotal = testsTaken.reduce((sum, i) => sum + (parseFloat(current[`t${i}`]) || 0), 0);
        const maxWeeklyPossible = testsTaken.length * maxVals.weekly;
        const maxCAPossible = maxVals.ca1 + maxVals.ca2;
        
        // Calculate scaled CA score based only on tests actually taken
        const rawScaledCA = maxWeeklyPossible > 0 ? (weeklyTotal / maxWeeklyPossible) * maxCAPossible : 0;
        const scaledCA = Math.round(rawScaledCA * 2) / 2; // Round to nearest 0.5
        
        // Split into CA1 and CA2
        current.ca1_score = Math.ceil(scaledCA / 2);
        current.ca2_score = parseFloat((scaledCA - current.ca1_score).toFixed(1));
      }
      
      // Auto-calculate total: CA1 + CA2 + Exam
      current.total = (current.ca1_score || 0) + (current.ca2_score || 0) + (current.exam_score || 0);
      return { ...prev, [studentId]: current };
    });
  };

  const saveAllScores = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const scoreList = Object.entries(scores).map(([studentId, s]) => ({
        studentId,
        subjectId: selectedSubject,
        classId: selectedClass,
        sessionId: selectedSession,
        term: parseInt(selectedTerm),
        ...s
      }));

      const res = await fetch('/api/scores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores: scoreList })
      });

      if (res.ok) {
        setSaveMsg('Scores saved successfully!');
        setTimeout(() => setSaveMsg(''), 3000);
      } else {
        setSaveMsg('Failed to save scores');
      }
    } catch (e) {
      setSaveMsg('Error saving scores');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto min-h-screen bg-gray-50 print:bg-white print:p-0">
      <div className="no-print space-y-6 mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Master Score Sheet</h1>
            <p className="text-gray-500 text-sm">Teacher's weekly assessment record</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={saveAllScores}
              disabled={saving}
              className={`px-6 py-2.5 rounded-lg font-bold text-white shadow-md transition-all flex items-center ${saving ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
            >
              <span className="mr-2">{saving ? '⏳' : '💾'}</span> {saving ? 'Saving...' : 'Save All Scores'}
            </button>
            <button 
              onClick={handlePrint}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md transition-all flex items-center"
            >
              <span className="mr-2">🖨️</span> Print Sheet
            </button>
          </div>
        </div>

        {saveMsg && (
          <div className={`p-4 rounded-xl text-center font-bold shadow-sm border ${saveMsg.includes('Error') || saveMsg.includes('Failed') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
            {saveMsg}
          </div>
        )}

        <div className="card grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Session</label>
            <select className="input" value={selectedSession} onChange={e => setSelectedSession(e.target.value)}>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Class</label>
            <select className="input" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
              <option value="">Select class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.arm}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Subject</label>
            <select className="input" value={selectedSubject} onChange={e => {
              setSelectedSubject(e.target.value);
              setSelectedTerm('1');
            }}>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
      ) : data ? (
        <div ref={printRef} className="bg-white shadow-xl mx-auto print:shadow-none print:w-full overflow-hidden border border-gray-200" id="master-sheet">
          <div className="p-4 border-b-2 border-black text-center">
            <h2 className="text-xl font-black uppercase tracking-widest">{schoolName}</h2>
            <p className="text-xs font-bold uppercase">{school?.address || 'OLAMBE OGUN STATE'}</p>
            <h3 className="mt-2 text-lg font-bold border-y border-black inline-block px-4">MASTER SCORE SHEET</h3>
          </div>

          <div className="p-4 grid grid-cols-3 text-sm font-bold border-b border-black bg-gray-50 uppercase italic">
            <div>CLASS: <span className="border-b border-black px-2 not-italic text-blue-800">{data.class?.name} {data.class?.arm}</span></div>
            <div>SUBJECT: <span className="border-b border-black px-2 not-italic text-blue-800">{data.subject?.name}</span></div>
            <div className="text-right">SESSION: <span className="border-b border-black px-2 not-italic text-blue-800">{data.session?.name}</span></div>
          </div>

          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-gray-100 font-bold text-center">
                <th rowSpan={2} className="border border-black p-1 w-8">S/N</th>
                <th rowSpan={2} className="border border-black p-1 text-left min-w-[150px]">NAMES OF STUDENTS</th>
                <th colSpan={10} className="border border-black p-0.5">WEEKLY ASSESSMENT SCORES (W.A.S)</th>
                <th rowSpan={2} className="border border-black p-1 w-10">CA1<br/><span className="font-normal">({maxVals.ca1})</span></th>
                <th rowSpan={2} className="border border-black p-1 w-10">CA2<br/><span className="font-normal">({maxVals.ca2})</span></th>
                <th rowSpan={2} className="border border-black p-1 w-10">EXAM<br/><span className="font-normal">({maxVals.exam})</span></th>
                <th rowSpan={2} className="border border-black p-1 w-10">TOT<br/><span className="font-normal">(100)</span></th>
                <th rowSpan={2} className="border border-black p-1 text-left min-w-[100px]">REMARKS</th>
              </tr>
              <tr className="bg-gray-50 text-[8px]">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                  <th key={i} className="border border-black p-0.5 w-7 h-8">
                    T{i}<br/><span className="font-normal">({maxVals.weekly})</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.students.map((student: any, idx: number) => {
                const s = scores[student.id] || {};
                return (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors h-8">
                    <td className="border border-black text-center font-bold">{idx + 1}</td>
                    <td className="border border-black px-2 font-bold uppercase truncate">{student.last_name} {student.first_name}</td>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                      <td key={i} className="border border-black p-0">
                        <input
                          type="number"
                          className="w-full h-full text-center border-none focus:ring-1 focus:ring-blue-500 bg-transparent p-0"
                          value={s[`t${i}`] || ''}
                          onChange={e => handleScoreChange(student.id, `t${i}`, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="border border-black p-0 bg-blue-50/50">
                      <input
                        type="number"
                        readOnly
                        className="w-full h-full text-center border-none font-bold bg-transparent p-0 cursor-default"
                        value={s.ca1_score || ''}
                      />
                    </td>
                    <td className="border border-black p-0 bg-blue-50/50">
                      <input
                        type="number"
                        readOnly
                        className="w-full h-full text-center border-none font-bold bg-transparent p-0 cursor-default"
                        value={s.ca2_score || ''}
                      />
                    </td>
                    <td className="border border-black p-0 bg-orange-50/30">
                      <input
                        type="number"
                        className="w-full h-full text-center border-none font-bold focus:ring-1 focus:ring-blue-500 bg-transparent p-0"
                        value={s.exam_score || ''}
                        onChange={e => handleScoreChange(student.id, 'exam_score', e.target.value)}
                      />
                    </td>
                    <td className="border border-black text-center font-bold bg-gray-100 text-blue-700">{s.total || ''}</td>
                    <td className="border border-black px-2 text-[8px] italic text-gray-500">
                      {/* You could add a remark field here if needed */}
                    </td>
                  </tr>
                );
              })}
              {/* Fill remaining rows up to 20 for consistent look if needed */}
              {data.students.length < 15 && Array.from({ length: 15 - data.students.length }).map((_, i) => (
                <tr key={`empty-${i}`} className="h-8">
                  <td className="border border-black text-center">{data.students.length + i + 1}</td>
                  <td className="border border-black px-2"></td>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(j => (
                    <td key={j} className="border border-black"></td>
                  ))}
                  <td className="border border-black"></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="p-6 grid grid-cols-2 gap-20 text-xs font-bold mt-10">
            <div className="border-t border-black text-center pt-2 uppercase italic">Subject Teacher's Signature & Date</div>
            <div className="border-t border-black text-center pt-2 uppercase italic">Head of Department Signature & Date</div>
          </div>
        </div>
      ) : (
        <div className="card text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">📊</div>
          <p className="text-lg font-medium">Select class and subject to view master sheet</p>
        </div>
      )}

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; background: white; }
          #master-sheet { border: none !important; box-shadow: none !important; width: 100% !important; margin: 0 !important; }
          @page { size: landscape; margin: 5mm; }
          input[type=number]::-webkit-inner-spin-button, 
          input[type=number]::-webkit-outer-spin-button { 
            -webkit-appearance: none; 
            margin: 0; 
          }
        }
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
}
