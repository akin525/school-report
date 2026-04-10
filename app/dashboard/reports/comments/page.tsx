'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function CommentsManagementPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [schoolId, setSchoolId] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [comments, setComments] = useState<Record<string, any>>({});
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('1');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Global Class Settings
  const [globalSettings, setGlobalSettings] = useState({
    date: '',
    signature: '',
    nextTermStarts: '',
    coordinatorRemark: '',
    coordinatorSignature: '',
    coordinatorDate: '',
  });

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.error || !d.user) {
        router.push('/login');
        return;
      }
      setUser(d.user);
      const sid = d.user.school_id;
      setSchoolId(sid);

      Promise.all([
        fetch(`/api/sessions?schoolId=${sid}`).then(r => r.json()),
        fetch(`/api/classes?schoolId=${sid}`).then(r => r.json()),
      ]).then(([sess, cls]) => {
        setSessions(sess);
        
        // If teacher, filter classes to only those where they are assigned as Class Teacher
        if (d.user.role === 'teacher' && d.teacher) {
          fetch(`/api/teachers/assignments?schoolId=${sid}&teacherId=${d.teacher.id}`).then(r => r.json()).then(assigns => {
            const classIds = assigns.filter((a: any) => a.subject_id === null).map((a: any) => a.class_id);
            setClasses(cls.filter((c: any) => classIds.includes(c.id)));
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

  const loadData = useCallback(async () => {
    if (!selectedClass || !selectedSession || !selectedTerm) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/reports/comments?classId=${selectedClass}&sessionId=${selectedSession}&term=${selectedTerm}`);
      const data = await res.json();
      
      setStudents(data.students || []);
      
      const commentMap: Record<string, any> = {};
      data.comments?.forEach((c: any) => {
        commentMap[c.student_id] = c;
      });
      setComments(commentMap);

      // Initialize global settings from the first comment found (if any)
      if (data.comments && data.comments.length > 0) {
        const first = data.comments[0];
        setGlobalSettings({
          date: first.class_teacher_date || '',
          signature: first.class_teacher_signature || '',
          nextTermStarts: first.next_term_starts || '',
          coordinatorRemark: first.coordinator_remark || '',
          coordinatorSignature: first.coordinator_signature || '',
          coordinatorDate: first.coordinator_date || '',
        });
      } else {
        setGlobalSettings({
          date: '',
          signature: '',
          nextTermStarts: '',
          coordinatorRemark: '',
          coordinatorSignature: '',
          coordinatorDate: '',
        });
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedClass, selectedSession, selectedTerm]);

  useEffect(() => {
    loadData();
  }, [selectedClass, selectedSession, selectedTerm, loadData]);

  const handleGlobalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setGlobalSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleCommentChange = (studentId: string, field: string, value: string) => {
    setComments(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [field]: value
      }
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, name: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      setGlobalSettings(prev => ({ ...prev, [name]: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const saveAll = async () => {
    if (!selectedClass || !selectedSession || !selectedTerm) return;
    setSaving(true);
    setSaveMsg('');

    const individualComments = students.map(s => ({
      studentId: s.id,
      comment: comments[s.id]?.class_teacher_comment || '',
      coordinatorRemark: comments[s.id]?.coordinator_remark || '',
    }));

    try {
      const res = await fetch('/api/reports/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: selectedClass,
          sessionId: selectedSession,
          term: parseInt(selectedTerm),
          settings: globalSettings,
          individualComments,
        }),
      });

      if (res.ok) {
        setSaveMsg('All comments and settings saved successfully!');
        setTimeout(() => setSaveMsg(''), 3000);
      } else {
        const error = await res.json();
        setSaveMsg('Error: ' + error.error);
      }
    } catch (error) {
      setSaveMsg('Error saving data');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-blue-900">Report Card Comments</h1>
          <p className="text-gray-600 mt-1">Manage class-wide settings and individual student comments</p>
        </div>
        <button
          onClick={saveAll}
          disabled={saving || loading}
          className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 ${
            saving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-200'
          }`}
        >
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>
      </div>

      {saveMsg && (
        <div className={`mb-6 p-4 rounded-xl text-center font-bold shadow-sm border ${
          saveMsg.startsWith('Error') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
        }`}>
          {saveMsg}
        </div>
      )}

      {/* Selectors */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">Academic Session</label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.name} {s.is_current ? '(Current)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">Class / Grade</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
            >
              <option value="">Select a Class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name} {c.arm ? `(${c.arm})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">Academic Term</label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
            >
              <option value="1">1st Term</option>
              <option value="2">2nd Term</option>
              <option value="3">3rd Term</option>
            </select>
          </div>
        </div>
      </div>

      {selectedClass && (
        <>
          {/* Global Batch Settings */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8 overflow-hidden">
            <div className="bg-blue-900 p-4">
              <h2 className="text-lg font-bold text-white flex items-center">
                <span className="mr-2">🌍</span> Class-Wide Shared Settings (Applies to all students)
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wider">Teacher Signing Date</label>
                  <input
                    type="date"
                    name="date"
                    value={globalSettings.date}
                    onChange={handleGlobalChange}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wider">Next Term Resumption</label>
                  <input
                    type="date"
                    name="nextTermStarts"
                    value={globalSettings.nextTermStarts}
                    onChange={handleGlobalChange}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wider">Teacher Signature (Image)</label>
                  <div className="flex items-center gap-3 p-2 bg-gray-50 border border-gray-200 rounded-xl">
                    <label className="flex-shrink-0 px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 'signature')}
                        className="hidden"
                      />
                    </label>
                    <div className="flex-1 min-w-0">
                      {globalSettings.signature ? (
                        <div className="relative group w-20 h-10 border rounded bg-white p-1">
                          <img 
                            src={globalSettings.signature} 
                            alt="Teacher Signature" 
                            className="w-full h-full object-contain"
                          />
                          <button 
                            onClick={() => setGlobalSettings(prev => ({ ...prev, signature: '' }))}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-[10px] hidden group-hover:flex items-center justify-center shadow-md"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic truncate">No image uploaded</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="md:col-span-1">
                  <label className="block text-sm font-bold text-blue-900 mb-2 uppercase tracking-wider">Batch Coordinator Remark</label>
                  <textarea
                    name="coordinatorRemark"
                    placeholder={user?.role === 'teacher' ? 'View only' : 'General remark for the whole class...'}
                    value={globalSettings.coordinatorRemark}
                    onChange={handleGlobalChange}
                    readOnly={user?.role === 'teacher'}
                    rows={2}
                    className={`w-full p-3 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm ${user?.role === 'teacher' ? 'opacity-70 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-blue-900 mb-2 uppercase tracking-wider">Coordinator Date</label>
                  <input
                    type="date"
                    name="coordinatorDate"
                    value={globalSettings.coordinatorDate}
                    onChange={handleGlobalChange}
                    readOnly={user?.role === 'teacher'}
                    className={`w-full p-3 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all ${user?.role === 'teacher' ? 'opacity-70 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-blue-900 mb-2 uppercase tracking-wider">Coordinator Signature (Image)</label>
                  <div className={`flex items-center gap-3 p-2 bg-white border border-blue-200 rounded-xl ${user?.role === 'teacher' ? 'opacity-70 cursor-not-allowed' : ''}`}>
                    <label className={`flex-shrink-0 px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors ${user?.role === 'teacher' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-blue-700'}`}>
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        disabled={user?.role === 'teacher'}
                        onChange={(e) => handleImageUpload(e, 'coordinatorSignature')}
                        className="hidden"
                      />
                    </label>
                    <div className="flex-1 min-w-0">
                      {globalSettings.coordinatorSignature ? (
                        <div className="relative group w-20 h-10 border rounded bg-white p-1">
                          <img 
                            src={globalSettings.coordinatorSignature} 
                            alt="Coord Signature" 
                            className="w-full h-full object-contain"
                          />
                          {!user || user.role !== 'teacher' ? (
                            <button 
                              onClick={() => setGlobalSettings(prev => ({ ...prev, coordinatorSignature: '' }))}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-[10px] hidden group-hover:flex items-center justify-center shadow-md"
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic truncate">No image uploaded</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Individual Students List */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-800 p-4">
              <h2 className="text-lg font-bold text-white flex items-center">
                <span className="mr-2">👤</span> Individual Student Comments
              </h2>
            </div>
            {loading ? (
              <div className="p-20 text-center">
                <div className="animate-spin inline-block w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mb-4"></div>
                <p className="text-gray-500 font-medium">Loading student list...</p>
              </div>
            ) : students.length === 0 ? (
              <div className="p-20 text-center text-gray-500 italic">
                No students found in this class.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Student Name</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Admission No.</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Class Teacher's Comment</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest w-64">Individual Coordinator Remark (Optional)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">
                            {student.first_name} {student.last_name}
                          </div>
                          <div className="text-xs text-gray-400">{student.middle_name || ''}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-600">
                            {student.admission_number || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <textarea
                            value={comments[student.id]?.class_teacher_comment || ''}
                            onChange={(e) => handleCommentChange(student.id, 'class_teacher_comment', e.target.value)}
                            placeholder="Enter teacher's comment..."
                            rows={2}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm resize-none"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <textarea
                            value={comments[student.id]?.coordinator_remark || ''}
                            onChange={(e) => handleCommentChange(student.id, 'coordinator_remark', e.target.value)}
                            placeholder={user?.role === 'teacher' ? 'Admin only' : 'Overrides batch remark...'}
                            readOnly={user?.role === 'teacher'}
                            rows={2}
                            className={`w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm resize-none ${user?.role === 'teacher' ? 'opacity-70 cursor-not-allowed' : ''}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
