'use client';
import { useState, useEffect } from 'react';
 import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();
  const [school, setSchool] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [form, setForm] = useState({ 
    name: '', nursery_name: '', primary_name: '', secondary_name: '', address: '', phone: '', email: '', website: '', logo_url: '', motto: '', 
    nursery_max_ca1: 20, nursery_max_ca2: 20, nursery_max_exam: 60, nursery_max_weekly: 10,
    primary_max_ca1: 20, primary_max_ca2: 20, primary_max_exam: 60, primary_max_weekly: 10,
    secondary_max_ca1: 20, secondary_max_ca2: 20, secondary_max_exam: 60, secondary_max_weekly: 10
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [grading, setGrading] = useState<any[]>([]);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [editingGrade, setEditingGrade] = useState<any>(null);
  const [gradeForm, setGradeForm] = useState({ grade: '', min_score: 0, max_score: 0, remark: '', color: '#000000' });
  const [savingGrade, setSavingGrade] = useState(false);
  const [msg, setMsg] = useState('');

  const loadGrading = async (sid: string) => {
    const res = await fetch(`/api/grading?schoolId=${sid}`);
    const data = await res.json();
    setGrading(data);
  };

  const openGradeModal = (grade?: any) => {
    if (grade) {
      setEditingGrade(grade);
      setGradeForm({ grade: grade.grade, min_score: grade.min_score, max_score: grade.max_score, remark: grade.remark, color: grade.color });
    } else {
      setEditingGrade(null);
      setGradeForm({ grade: '', min_score: 0, max_score: 0, remark: '', color: '#000000' });
    }
    setShowGradeModal(true);
  };

  const saveGrade = async () => {
    setSavingGrade(true);
    const url = '/api/grading';
    const method = editingGrade ? 'PUT' : 'POST';
    const body = editingGrade ? { ...gradeForm, id: editingGrade.id } : { ...gradeForm, school_id: user.school_id };

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      setShowGradeModal(false);
      loadGrading(user.school_id);
    }
    setSavingGrade(false);
  };

  const deleteGrade = async (id: string) => {
    if (!confirm('Delete this grade?')) return;
    await fetch('/api/grading', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    loadGrading(user.school_id);
  };

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.error || !d.user) {
        router.push('/login');
        return;
      }
      setUser(d.user);
      setSchool(d.school);
      loadGrading(d.user.school_id);
      if (d.school) {
        setForm({
          name: d.school.name || '',
          nursery_name: d.school.nursery_name || '',
          primary_name: d.school.primary_name || '',
          secondary_name: d.school.secondary_name || '',
          address: d.school.address || '', phone: d.school.phone || '',
          email: d.school.email || '', website: d.school.website || '', logo_url: d.school.logo_url || '', motto: d.school.motto || '',
          nursery_max_ca1: d.school.nursery_max_ca1 ?? 20,
          nursery_max_ca2: d.school.nursery_max_ca2 ?? 20,
          nursery_max_exam: d.school.nursery_max_exam ?? 60,
          nursery_max_weekly: d.school.nursery_max_weekly ?? d.school.max_weekly ?? 10,
          primary_max_ca1: d.school.primary_max_ca1 ?? d.school.max_ca1 ?? 20, 
          primary_max_ca2: d.school.primary_max_ca2 ?? d.school.max_ca2 ?? 20, 
          primary_max_exam: d.school.primary_max_exam ?? d.school.max_exam ?? 60,
          primary_max_weekly: d.school.primary_max_weekly ?? d.school.max_weekly ?? 10,
          secondary_max_ca1: d.school.secondary_max_ca1 ?? d.school.max_ca1 ?? 20, 
          secondary_max_ca2: d.school.secondary_max_ca2 ?? d.school.max_ca2 ?? 20, 
          secondary_max_exam: d.school.secondary_max_exam ?? d.school.max_exam ?? 60,
          secondary_max_weekly: d.school.secondary_max_weekly ?? d.school.max_weekly ?? 10
        });
      }
    }).catch(() => {
      router.push('/login');
    });
  }, [router]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64String, filename: file.name, subDir: 'schools' }),
        });

        if (res.ok) {
          const { url } = await res.json();
          setForm({ ...form, logo_url: url });
        } else {
          alert('Upload failed');
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload error');
      setUploading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`/api/schools/${school.id}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(form) 
      });
      
      if (res.ok) { 
        setMsg('Settings saved successfully!'); 
        setTimeout(() => setMsg(''), 3000); 
      } else {
        const err = await res.json();
        alert('Failed to save: ' + (err.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Network error while saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (!school) return (
    <div className="card text-center py-16 text-gray-400"><div className="text-5xl mb-4">⚙️</div><p>No school data available</p></div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">School Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Update your school information and details</p>
      </div>

      {msg && <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded-lg text-sm font-medium">✓ {msg}</div>}

      <div className="card space-y-5">
        <h2 className="text-lg font-bold text-gray-700 border-b pb-3">School Information</h2>
        <div>
          <label className="label">School Name (General/Fallback) *</label>
          <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} disabled={user?.role === 'teacher'} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label text-xs">Nursery Section Name</label>
            <input className="input text-sm" placeholder="e.g. Hallmark Nursery School" value={form.nursery_name} onChange={e => setForm({...form, nursery_name: e.target.value})} disabled={user?.role === 'teacher'} />
          </div>
          <div>
            <label className="label text-xs">Primary Section Name</label>
            <input className="input text-sm" placeholder="e.g. Hallmark Primary School" value={form.primary_name} onChange={e => setForm({...form, primary_name: e.target.value})} disabled={user?.role === 'teacher'} />
          </div>
          <div>
            <label className="label text-xs">Secondary Section Name</label>
            <input className="input text-sm" placeholder="e.g. Hallmark Heights College" value={form.secondary_name} onChange={e => setForm({...form, secondary_name: e.target.value})} disabled={user?.role === 'teacher'} />
          </div>
        </div>
        <div>
          <label className="label">Address</label>
          <textarea className="input" rows={2} value={form.address} onChange={e => setForm({...form, address: e.target.value})} disabled={user?.role === 'teacher'} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} disabled={user?.role === 'teacher'} /></div>
          <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} disabled={user?.role === 'teacher'} /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div><label className="label">Website</label><input className="input" placeholder="e.g. hallmarkschools.ng" value={form.website} onChange={e => setForm({...form, website: e.target.value})} disabled={user?.role === 'teacher'} /></div>
          <div>
            <label className="label">School Logo</label>
            <div className="flex items-center gap-3">
              {form.logo_url ? (
                <div className="relative w-12 h-12 rounded border overflow-hidden">
                  <img src={form.logo_url} className="w-full h-full object-cover" alt="Logo" />
                  {user?.role !== 'teacher' && <button onClick={() => setForm({...form, logo_url: ''})} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 text-[8px]">×</button>}
                </div>
              ) : (
                <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-xl">🏫</div>
              )}
              {user?.role !== 'teacher' && <input type="file" accept="image/*" className="text-xs w-full" onChange={handleFileUpload} disabled={uploading} />}
            </div>
            {uploading && <p className="text-[10px] text-blue-600 animate-pulse mt-1">Uploading logo...</p>}
          </div>
        </div>
        <div>
          <label className="label">School Motto</label>
          <input className="input" placeholder=" Excellence in Education" value={form.motto} onChange={e => setForm({...form, motto: e.target.value})} disabled={user?.role === 'teacher'} />
        </div>

        <h2 className="text-lg font-bold text-gray-700 border-b pb-3 pt-4">Nursery Score Distribution</h2>
        <p className="text-xs text-gray-500 mb-2">Define limits for Nursery classes. Total CA+Exam must be 100.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="label">Weekly Max</label>
            <input type="number" className="input" value={form.nursery_max_weekly} onChange={e => setForm({...form, nursery_max_weekly: parseFloat(e.target.value) || 0})} disabled={user?.role === 'teacher'} />
          </div>
          <div>
            <label className="label">CA1 Max</label>
            <input type="number" className="input" value={form.nursery_max_ca1} onChange={e => setForm({...form, nursery_max_ca1: parseFloat(e.target.value) || 0})} disabled={user?.role === 'teacher'} />
          </div>
          <div>
            <label className="label">CA2 Max</label>
            <input type="number" className="input" value={form.nursery_max_ca2} onChange={e => setForm({...form, nursery_max_ca2: parseFloat(e.target.value) || 0})} disabled={user?.role === 'teacher'} />
          </div>
          <div>
            <label className="label">Exam Max</label>
            <input type="number" className="input" value={form.nursery_max_exam} onChange={e => setForm({...form, nursery_max_exam: parseFloat(e.target.value) || 0})} disabled={user?.role === 'teacher'} />
          </div>
        </div>
        <div className="flex items-center justify-between text-sm mb-4">
          <span className={`${(form.nursery_max_ca1 + form.nursery_max_ca2 + form.nursery_max_exam) === 100 ? 'text-green-600' : 'text-red-600'} font-bold`}>
            Total (CA1+CA2+Exam): {form.nursery_max_ca1 + form.nursery_max_ca2 + form.nursery_max_exam}%
          </span>
          {(form.nursery_max_ca1 + form.nursery_max_ca2 + form.nursery_max_exam) !== 100 && (
            <span className="text-red-500 text-xs">Must equal 100%</span>
          )}
        </div>

        <h2 className="text-lg font-bold text-gray-700 border-b pb-3 pt-4">Primary Score Distribution</h2>
        <p className="text-xs text-gray-500 mb-2">Define limits for Primary classes. Total CA+Exam must be 100.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="label">Weekly Max</label>
            <input type="number" className="input" value={form.primary_max_weekly} onChange={e => setForm({...form, primary_max_weekly: parseFloat(e.target.value) || 0})} disabled={user?.role === 'teacher'} />
          </div>
          <div>
            <label className="label">CA1 Max</label>
            <input type="number" className="input" value={form.primary_max_ca1} onChange={e => setForm({...form, primary_max_ca1: parseFloat(e.target.value) || 0})} disabled={user?.role === 'teacher'} />
          </div>
          <div>
            <label className="label">CA2 Max</label>
            <input type="number" className="input" value={form.primary_max_ca2} onChange={e => setForm({...form, primary_max_ca2: parseFloat(e.target.value) || 0})} disabled={user?.role === 'teacher'} />
          </div>
          <div>
            <label className="label">Exam Max</label>
            <input type="number" className="input" value={form.primary_max_exam} onChange={e => setForm({...form, primary_max_exam: parseFloat(e.target.value) || 0})} disabled={user?.role === 'teacher'} />
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className={`${(form.primary_max_ca1 + form.primary_max_ca2 + form.primary_max_exam) === 100 ? 'text-green-600' : 'text-red-600'} font-bold`}>
            Total (CA1+CA2+Exam): {form.primary_max_ca1 + form.primary_max_ca2 + form.primary_max_exam}%
          </span>
          {(form.primary_max_ca1 + form.primary_max_ca2 + form.primary_max_exam) !== 100 && (
            <span className="text-red-500 text-xs">Must equal 100%</span>
          )}
        </div>

        <h2 className="text-lg font-bold text-gray-700 border-b pb-3 pt-4">Secondary Score Distribution</h2>
        <p className="text-xs text-gray-500 mb-2">Define limits for Secondary classes. Total CA+Exam must be 100.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="label">Weekly Max</label>
            <input type="number" className="input" value={form.secondary_max_weekly} onChange={e => setForm({...form, secondary_max_weekly: parseFloat(e.target.value) || 0})} disabled={user?.role === 'teacher'} />
          </div>
          <div>
            <label className="label">CA1 Max</label>
            <input type="number" className="input" value={form.secondary_max_ca1} onChange={e => setForm({...form, secondary_max_ca1: parseFloat(e.target.value) || 0})} disabled={user?.role === 'teacher'} />
          </div>
          <div>
            <label className="label">CA2 Max</label>
            <input type="number" className="input" value={form.secondary_max_ca2} onChange={e => setForm({...form, secondary_max_ca2: parseFloat(e.target.value) || 0})} disabled={user?.role === 'teacher'} />
          </div>
          <div>
            <label className="label">Exam Max</label>
            <input type="number" className="input" value={form.secondary_max_exam} onChange={e => setForm({...form, secondary_max_exam: parseFloat(e.target.value) || 0})} disabled={user?.role === 'teacher'} />
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className={`${(form.secondary_max_ca1 + form.secondary_max_ca2 + form.secondary_max_exam) === 100 ? 'text-green-600' : 'text-red-600'} font-bold`}>
            Total (CA1+CA2+Exam): {form.secondary_max_ca1 + form.secondary_max_ca2 + form.secondary_max_exam}%
          </span>
          {(form.secondary_max_ca1 + form.secondary_max_ca2 + form.secondary_max_exam) !== 100 && (
            <span className="text-red-500 text-xs">Must equal 100%</span>
          )}
        </div>

        {user?.role !== 'teacher' && (
          <div className="flex justify-end pt-2">
            <button 
              onClick={saveSettings} 
              disabled={
                saving || !form.name || 
                (form.nursery_max_ca1 + form.nursery_max_ca2 + form.nursery_max_exam) !== 100 ||
                (form.primary_max_ca1 + form.primary_max_ca2 + form.primary_max_exam) !== 100 ||
                (form.secondary_max_ca1 + form.secondary_max_ca2 + form.secondary_max_exam) !== 100
              } 
              className="btn-primary px-8"
            >
              {saving ? 'Saving...' : '💾 Save Settings'}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-bold text-gray-700 border-b pb-3 mb-4">Account Information</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium">{user?.name}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="font-medium">{user?.email}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Role</span><span className="badge-primary capitalize">{user?.role?.replace('_', ' ')}</span></div>
        </div>
      </div>
      <div className="card mt-6">
        <div className="flex items-center justify-between border-b pb-3 mb-4">
          <h2 className="text-lg font-bold text-gray-700">Grading System</h2>
          {user?.role !== 'teacher' && (
            <button onClick={() => openGradeModal()} className="btn-primary text-sm px-4 py-1.5">+ Add Grade</button>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-4 italic">* Define the grade boundaries for your school. These will be used for report cards and broadsheets.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2 border">Grade</th>
                <th className="px-4 py-2 border">Min Score</th>
                <th className="px-4 py-2 border">Max Score</th>
                <th className="px-4 py-2 border">Remark</th>
                <th className="px-4 py-2 border">Color</th>
                {user?.role !== 'teacher' && <th className="px-4 py-2 border">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {grading.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border font-bold" style={{ color: g.color }}>{g.grade}</td>
                  <td className="px-4 py-2 border">{g.min_score}%</td>
                  <td className="px-4 py-2 border">{g.max_score}%</td>
                  <td className="px-4 py-2 border italic text-gray-600">{g.remark}</td>
                  <td className="px-4 py-2 border">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded border shadow-sm" style={{ background: g.color }}></div>
                      <span className="text-[10px] text-gray-400 font-mono">{g.color}</span>
                    </div>
                  </td>
                  {user?.role !== 'teacher' && (
                    <td className="px-4 py-2 border">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openGradeModal(g)} className="text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => deleteGrade(g.id)} className="text-red-600 hover:underline">Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {grading.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No grading rules found. Please add some.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grade Modal */}
      {showGradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-blue-800 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">{editingGrade ? 'Edit Grade' : 'Add New Grade'}</h3>
              <button onClick={() => setShowGradeModal(false)} className="text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Grade Name (e.g., A+)</label>
                <input type="text" className="input" value={gradeForm.grade} onChange={e => setGradeForm({...gradeForm, grade: e.target.value})} placeholder="A+" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Min Score (%)</label>
                  <input type="number" step="0.1" className="input" value={gradeForm.min_score} onChange={e => setGradeForm({...gradeForm, min_score: parseFloat(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="label">Max Score (%)</label>
                  <input type="number" step="0.1" className="input" value={gradeForm.max_score} onChange={e => setGradeForm({...gradeForm, max_score: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
              <div>
                <label className="label">Remark/Comment</label>
                <input type="text" className="input" value={gradeForm.remark} onChange={e => setGradeForm({...gradeForm, remark: e.target.value})} placeholder="Distinction" />
              </div>
              <div>
                <label className="label">Display Color</label>
                <div className="flex gap-2">
                  <input type="color" className="h-10 w-20 p-1 border rounded cursor-pointer" value={gradeForm.color} onChange={e => setGradeForm({...gradeForm, color: e.target.value})} />
                  <input type="text" className="input font-mono uppercase" value={gradeForm.color} onChange={e => setGradeForm({...gradeForm, color: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
              <button onClick={() => setShowGradeModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveGrade} disabled={savingGrade || !gradeForm.grade} className="btn-primary px-8">
                {savingGrade ? 'Saving...' : '💾 Save Grade'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
