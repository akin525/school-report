'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AttendancePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.error || !d.user) { router.push('/login'); return; }
      setUser(d.user);
      setStudent(d.student);
      const sid = d.user.school_id;

      fetch(`/api/sessions?schoolId=${sid}`).then(r => r.json()).then(sess => {
        setSessions(sess);
        const curr = sess.find((s: any) => s.is_current) || sess[0];
        if (curr) setSelectedSession(curr.id);
      });

      if (d.user.role === 'student' && d.student?.class_id) {
        setSelectedClass(d.student.class_id);
      } else {
        fetch(`/api/classes?schoolId=${sid}`).then(r => r.json()).then(cls => setClasses(cls));
      }
    });
  }, [router]);

  useEffect(() => {
    if (selectedSession && selectedClass && selectedTerm) {
      loadData();
    }
  }, [selectedSession, selectedClass, selectedTerm]);

  const loadData = async () => {
    setLoading(true);
    try {
      const sid = user.school_id;

      // Load students in class
      const studRes = await fetch(`/api/students?classId=${selectedClass}&schoolId=${sid}`);
      const studentsData = await studRes.json();
      setStudents(Array.isArray(studentsData) ? studentsData : []);

      // Load attendance records
      const attRes = await fetch(`/api/attendance?sessionId=${selectedSession}&term=${selectedTerm}&schoolId=${sid}`);
      const attendanceData = await attRes.json();
      setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
    } catch (e) {
      console.error(e);
      setStudents([]);
      setAttendance([]);
    }
    setLoading(false);
  };

  const handleSave = async (studentId: string, opened: number, present: number) => {
    setSaving(true);
    try {
      await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          sessionId: selectedSession,
          term: selectedTerm,
          times_school_opened: opened,
          times_present: present,
          schoolId: user.school_id
        })
      });
      // Update local state to reflect change without full reload
      setAttendance(prev => {
        const existing = prev.find(a => a.student_id === studentId);
        if (existing) {
          return prev.map(a => a.student_id === studentId ? { ...a, times_school_opened: opened, times_present: present } : a);
        }
        return [...prev, { student_id: studentId, times_school_opened: opened, times_present: present }];
      });
    } catch (e) {
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Attendance</h1>
          <p className="text-gray-500 text-sm mt-1">
            {user?.role === 'student' ? 'View your attendance record' : 'Manage student attendance per term'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Session</label>
            <select className="input" value={selectedSession} onChange={e => setSelectedSession(e.target.value)}>
              <option value="">Select session</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {user?.role !== 'student' && (
            <div>
              <label className="label">Class</label>
              <select className="input" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                <option value="">Select class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.arm}</option>)}
              </select>
            </div>
          )}
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
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
      ) : user?.role === 'student' ? (
        <div className="flex justify-center">
          <div className="card w-full max-w-md text-center p-8">
            <div className="text-5xl mb-6">📅</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Term Attendance Summary</h2>
            <p className="text-gray-500 mb-8">{selectedTerm === '1' ? '1st' : selectedTerm === '2' ? '2nd' : '3rd'} Term, {sessions.find(s => s.id === selectedSession)?.name}</p>

            {(() => {
              const record = attendance.find(a => a.student_id === student?.id);
              if (!record) return <p className="text-gray-400 italic">No record found for this term.</p>;

              const percent = record.times_school_opened > 0 ? Math.round((record.times_present / record.times_school_opened) * 100) : 0;

              return (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-xl">
                      <div className="text-3xl font-bold text-blue-700">{record.times_present}</div>
                      <div className="text-[10px] text-blue-600 font-bold uppercase">Days Present</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <div className="text-3xl font-bold text-gray-700">{record.times_school_opened}</div>
                      <div className="text-[10px] text-gray-500 font-bold uppercase">Days Opened</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-600">Attendance Percentage</span>
                      <span className={`text-lg font-bold ${percent >= 90 ? 'text-green-600' : percent >= 75 ? 'text-blue-600' : 'text-orange-600'}`}>{percent}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-500 ${percent >= 90 ? 'bg-green-500' : percent >= 75 ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header text-left">Student Name</th>
                <th className="table-header text-center w-32">Days Opened</th>
                <th className="table-header text-center w-32">Days Present</th>
                <th className="table-header text-center w-24">%</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                const record = attendance.find(a => a.student_id === s.id) || { times_school_opened: 0, times_present: 0 };
                const percent = record.times_school_opened > 0 ? Math.round((record.times_present / record.times_school_opened) * 100) : 0;

                return (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="font-medium text-gray-800 uppercase">{s.last_name}, {s.first_name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{s.admission_number}</div>
                    </td>
                    <td className="table-cell text-center">
                      <input
                        type="number"
                        className="w-20 text-center border rounded p-1 text-sm"
                        defaultValue={record.times_school_opened}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          if (val !== record.times_school_opened) handleSave(s.id, val, record.times_present);
                        }}
                      />
                    </td>
                    <td className="table-cell text-center">
                      <input
                        type="number"
                        className="w-20 text-center border rounded p-1 text-sm"
                        defaultValue={record.times_present}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          if (val !== record.times_present) handleSave(s.id, record.times_school_opened, val);
                        }}
                      />
                    </td>
                    <td className="table-cell text-center font-bold text-xs text-gray-600">
                      {percent}%
                    </td>
                    <td className="table-cell text-right">
                      <span className="text-[10px] text-gray-400 italic">Auto-saves on blur</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
