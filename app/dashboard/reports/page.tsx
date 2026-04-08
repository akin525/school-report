'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ReportsPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState('');
  const [user, setUser] = useState<any>(null);
  const [teacher, setTeacher] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('1');
  const [reportFormat, setReportFormat] = useState<'single' | 'cumulative'>('cumulative');
  const [reportType, setReportType] = useState<'individual' | 'broadsheet'>('individual');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('type') === 'broadsheet') setReportType('broadsheet');
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.error || !d.user) {
        router.push('/login');
        return;
      }
      const sid = d.user.school_id;
      setSchoolId(sid);
      setUser(d.user);
      setTeacher(d.teacher);

      Promise.all([
        fetch(`/api/sessions?schoolId=${sid}`).then(r => r.json()),
        fetch(`/api/classes?schoolId=${sid}`).then(r => r.json())
      ]).then(([sess, cls]) => {
        setSessions(sess);

        // Filter classes for teachers
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
    if (selectedClass && schoolId) {
      setLoading(true);
      fetch(`/api/students?classId=${selectedClass}&schoolId=${schoolId}`)
        .then(r => r.json()).then(d => { setStudents(d); setLoading(false); });
    }
  }, [selectedClass, schoolId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
        <p className="text-gray-500 text-sm mt-1">Generate report cards and broadsheets</p>
      </div>

      {/* Report Type Tabs */}
      <div className="flex gap-2">
        {[{ id: 'individual', label: '📋 Individual Report Card', icon: '👤' }, { id: 'broadsheet', label: '📊 Class Broadsheet', icon: '📊' }].map(t => (
          <button key={t.id} onClick={() => setReportType(t.id as any)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${reportType === t.id ? 'bg-blue-700 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Session</label>
            <select className="input" value={selectedSession} onChange={e => setSelectedSession(e.target.value)}>
              <option value="">Select session</option>
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
            <label className="label">Term</label>
            <select className="input" value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}>
              <option value="1">1st Term</option>
              <option value="2">2nd Term</option>
              <option value="3">3rd Term</option>
            </select>
          </div>
          <div>
            <label className="label">Report Format</label>
            <select className="input font-medium text-blue-700" value={reportFormat} onChange={e => setReportFormat(e.target.value as any)}>
              <option value="cumulative">📊 Cumulative Report</option>
              <option value="single">📋 Single Term Report</option>
            </select>
          </div>
        </div>
      </div>

      {/* Individual Report Cards */}
      {reportType === 'individual' && (
        <div>
          {!selectedClass ? (
            <div className="card text-center py-16 text-gray-400">
              <div className="text-5xl mb-4">📋</div>
              <p className="text-lg font-medium">Select a class to view students</p>
            </div>
          ) : loading ? (
            <div className="flex justify-center h-32 items-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
          ) : students.length === 0 ? (
            <div className="card text-center py-16 text-gray-400"><p className="text-lg font-medium">No students in this class</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map(student => (
                <div key={student.id} className="card hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      {student.photo_url ? (
                        <img src={student.photo_url} alt={student.first_name} className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <span className="text-blue-700 font-bold text-lg">{student.first_name?.[0]}{student.last_name?.[0]}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-gray-800 truncate">{student.last_name}, {student.first_name}</h3>
                      <p className="text-xs text-gray-500">{student.admission_number || 'No Adm. No.'}</p>
                      <p className="text-xs text-gray-500 truncate">{student.class_name}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Link
                      href={`/dashboard/reports/card?studentId=${student.id}&sessionId=${selectedSession}&term=${selectedTerm}&format=${reportFormat}`}
                      className="btn-primary text-xs py-1.5 flex-1 text-center"
                    >
                      View Report Card
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Broadsheet */}
      {reportType === 'broadsheet' && (
        <div>
          {!selectedClass || !selectedSession ? (
            <div className="card text-center py-16 text-gray-400">
              <div className="text-5xl mb-4">📊</div>
              <p className="text-lg font-medium">Select class and session to view broadsheet</p>
            </div>
          ) : (
            <div className="flex justify-center">
              <Link
                href={`/dashboard/reports/broadsheet?classId=${selectedClass}&sessionId=${selectedSession}&term=${selectedTerm}`}
                className="btn-primary px-8 py-3 text-base"
              >
                📊 View Broadsheet
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}