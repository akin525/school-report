'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TeachersPage() {
  const router = useRouter();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [schoolId, setSchoolId] = useState('');
  const [currentSession, setCurrentSession] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', qualification: '', category: 'secondary', createLogin: false, password: '' });
  const [assignForm, setAssignForm] = useState({ subjectId: '', classId: '', sessionId: '' });
  const [saving, setSaving] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkData, setBulkData] = useState<any[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.error || !d.user) {
        router.push('/login');
        return;
      }
      setUser(d.user);
      const sid = d.user.school_id;
      setSchoolId(sid);
      loadData(sid);
    }).catch(() => {
      router.push('/login');
    });
  }, [router]);

  const loadData = async (sid: string) => {
    setLoading(true);
    const [tRes, cRes, sRes, sesRes] = await Promise.all([
      fetch(`/api/teachers?schoolId=${sid}`),
      fetch(`/api/classes?schoolId=${sid}`),
      fetch(`/api/subjects?schoolId=${sid}`),
      fetch(`/api/sessions?schoolId=${sid}`)
    ]);
    const [teachersData, classesData, subjectsData, sessionsData] = await Promise.all([tRes.json(), cRes.json(), sRes.json(), sesRes.json()]);
    setTeachers(teachersData);
    setClasses(classesData);
    setSubjects(subjectsData);
    setSessions(sessionsData);
    const curr = sessionsData.find((s: any) => s.is_current) || sessionsData[0];
    if (curr) { setCurrentSession(curr.id); setAssignForm(prev => ({ ...prev, sessionId: curr.id })); }
    setLoading(false);
  };

  const loadAssignments = async (teacherId: string) => {
    const res = await fetch(`/api/teachers/assignments?schoolId=${schoolId}&teacherId=${teacherId}`);
    setAssignments(await res.json());
  };

  const openModal = (teacher?: any) => {
    if (teacher) { setEditing(teacher); setForm({ name: teacher.name, email: teacher.email || '', phone: teacher.phone || '', qualification: teacher.qualification || '', category: teacher.category || 'secondary', createLogin: false, password: '' }); }
    else { setEditing(null); setForm({ name: '', email: '', phone: '', qualification: '', category: 'secondary', createLogin: false, password: '' }); }
    setShowModal(true);
  };

  const openAssignModal = (teacher: any) => {
    setSelectedTeacher(teacher);
    setAssignForm({ subjectId: '', classId: '', sessionId: currentSession });
    loadAssignments(teacher.id);
    setShowAssignModal(true);
  };

  const saveTeacher = async () => {
    setSaving(true);
    const method = editing ? 'PUT' : 'POST';
    const body = editing ? { ...form, id: editing.id, schoolId } : { ...form, schoolId };
    const res = await fetch('/api/teachers', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { setShowModal(false); loadData(schoolId); }
    setSaving(false);
  };

  const saveAssignment = async () => {
    if (!assignForm.classId || !assignForm.sessionId) return;
    setSaving(true);
    await fetch('/api/teachers/assignments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...assignForm, teacherId: selectedTeacher.id, schoolId }) });
    loadAssignments(selectedTeacher.id);
    setSaving(false);
  };

  const deleteAssignment = async (id: string) => {
    await fetch('/api/teachers/assignments', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    loadAssignments(selectedTeacher.id);
  };

  const deleteTeacher = async (id: string) => {
    if (!confirm('Delete this teacher?')) return;
    await fetch('/api/teachers', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    loadData(schoolId);
  };

  const downloadTemplate = () => {
    const headers = ['name', 'email', 'phone', 'qualification', 'category', 'create_login', 'password'];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\nJane Doe,jane@school.com,08012345678,B.Ed,primary,yes,password123";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "teacher_bulk_upload_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const data = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj: any = {};
        headers.forEach((header, index) => {
          let val = values[index];
          if (header === 'create_login') val = (val === 'yes' || val === 'true');
          obj[header] = val;
        });
        return obj;
      });
      
      setBulkData(data);
      setShowBulkModal(true);
    };
    reader.readAsText(file);
  };

  const processBulkUpload = async () => {
    setBulkProcessing(true);
    try {
      const res = await fetch('/api/teachers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teachers: bulkData, schoolId })
      });
      if (res.ok) {
        alert('Bulk upload successful!');
        setShowBulkModal(false);
        loadData(schoolId);
      } else {
        const err = await res.json();
        alert('Error: ' + err.error);
      }
    } catch (e) {
      alert('Upload failed');
    }
    setBulkProcessing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Teachers</h1>
          <p className="text-gray-500 text-sm mt-1">{teachers.length} teacher{teachers.length !== 1 ? 's' : ''}</p>
        </div>
        {(user?.role === 'superadmin' || user?.role === 'school_admin') && (
          <div className="flex items-center gap-3">
            <div className="relative group">
              <button className="btn-secondary flex items-center gap-2">
                <span>📁</span> Bulk Upload
              </button>
              <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-xl hidden group-hover:block z-20">
                <button onClick={downloadTemplate} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm border-b">Download Template</button>
                <label className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm block cursor-pointer">
                  Upload CSV
                  <input type="file" accept=".csv" className="hidden" onChange={handleBulkCsv} />
                </label>
              </div>
            </div>
            <button onClick={() => openModal()} className="btn-primary">+ Add Teacher</button>
          </div>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-32"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
        ) : teachers.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><div className="text-5xl mb-4">👨‍🏫</div><p className="text-lg font-medium">No teachers yet</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-200">
                <th className="table-header text-left">Name</th>
                <th className="table-header text-left">Category</th>
                <th className="table-header text-left">Email</th>
                <th className="table-header text-left">Phone</th>
                <th className="table-header text-left">Qualification</th>
                {(user?.role === 'superadmin' || user?.role === 'school_admin') && <th className="table-header text-left">Actions</th>}
              </tr></thead>
              <tbody>
                {teachers.map((t, i) => (
                  <tr key={t.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                    <td className="table-cell font-medium">{t.name}</td>
                    <td className="table-cell"><span className={`badge-${t.category === 'primary' ? 'primary' : 'secondary'}`}>{t.category || 'secondary'}</span></td>
                    <td className="table-cell text-gray-600">{t.email || '—'}</td>
                    <td className="table-cell">{t.phone || '—'}</td>
                    <td className="table-cell">{t.qualification || '—'}</td>
                    {(user?.role === 'superadmin' || user?.role === 'school_admin') && (
                      <td className="table-cell">
                        <div className="flex gap-2">
                          <button onClick={() => openAssignModal(t)} className="text-green-600 hover:text-green-800 text-xs font-medium">Assign</button>
                          <button onClick={() => openModal(t)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                          <button onClick={() => deleteTeacher(t.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Delete</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Teacher Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">{editing ? 'Edit Teacher' : 'Add New Teacher'}</h3>
              <button onClick={() => setShowModal(false)} className="text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="label">Full Name *</label><input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Category</label>
                  <select className="input" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    <option value="primary">Primary Teacher</option>
                    <option value="secondary">Secondary Teacher</option>
                  </select>
                </div>
                <div><label className="label">Qualification</label><input className="input" placeholder="e.g. B.Ed, B.Sc" value={form.qualification} onChange={e => setForm({...form, qualification: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
                <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              </div>
              {!editing && (
                <div className="border-t pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.createLogin} onChange={e => setForm({...form, createLogin: e.target.checked})} className="rounded" />
                    <span className="text-sm font-medium text-gray-700">Create Login Account</span>
                  </label>
                  {form.createLogin && (
                    <div className="mt-3"><label className="label">Password</label><input type="password" className="input" value={form.password} onChange={e => setForm({...form, password: e.target.value})} /></div>
                  )}
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveTeacher} disabled={saving || !form.name} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Add Teacher'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="bg-green-700 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">Assign Subjects — {selectedTeacher.name}</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Session</label>
                  <select className="input" value={assignForm.sessionId} onChange={e => setAssignForm({...assignForm, sessionId: e.target.value})}>
                    {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div><label className="label">Class</label>
                  <select className="input" value={assignForm.classId} onChange={e => setAssignForm({...assignForm, classId: e.target.value})}>
                    <option value="">Select</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.arm}</option>)}
                  </select>
                </div>
                {selectedTeacher.category === 'secondary' && (
                  <div>
                    <label className="label">Subject (Optional if Class Teacher)</label>
                    <select className="input" value={assignForm.subjectId} onChange={e => setAssignForm({...assignForm, subjectId: e.target.value})}>
                      <option value="">Select (Assign as Class Teacher)</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <button onClick={saveAssignment} disabled={saving || !assignForm.classId} className="btn-success w-full">
                {selectedTeacher.category === 'primary' || !assignForm.subjectId ? '+ Assign Class' : '+ Assign Subject'}
              </button>
              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Current Assignments</h4>
                {assignments.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No assignments yet</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {assignments.map(a => (
                      <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div className="text-sm">
                          <span className="font-medium">{a.subject_name || 'All Subjects'}</span>
                          <span className="text-gray-500"> — {a.class_name} ({a.session_name})</span>
                        </div>
                        <button onClick={() => deleteAssignment(a.id)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
              <button onClick={() => setShowAssignModal(false)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Preview Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-blue-800 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">Preview Bulk Upload ({bulkData.length} teachers)</h3>
              <button onClick={() => setShowBulkModal(false)} className="text-2xl leading-none">×</button>
            </div>
            <div className="p-6 overflow-auto flex-1">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 border text-left">Name</th>
                    <th className="p-2 border text-left">Email</th>
                    <th className="p-2 border text-left">Category</th>
                    <th className="p-2 border text-left">Login?</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkData.map((t, idx) => (
                    <tr key={idx}>
                      <td className="p-2 border">{t.name}</td>
                      <td className="p-2 border">{t.email}</td>
                      <td className="p-2 border">{t.category}</td>
                      <td className="p-2 border">{t.create_login ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
              <button onClick={() => setShowBulkModal(false)} className="btn-secondary" disabled={bulkProcessing}>Cancel</button>
              <button onClick={processBulkUpload} disabled={bulkProcessing} className="btn-primary flex items-center gap-2">
                {bulkProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : 'Confirm and Upload All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}