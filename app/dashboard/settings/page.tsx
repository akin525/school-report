'use client';
import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [school, setSchool] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', website: '', logo_url: '', motto: '', max_ca1: 20, max_ca2: 20, max_exam: 60 });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setUser(d.user);
      setSchool(d.school);
      if (d.school) {
        setForm({
          name: d.school.name || '', address: d.school.address || '', phone: d.school.phone || '',
          email: d.school.email || '', website: d.school.website || '', logo_url: d.school.logo_url || '', motto: d.school.motto || '',
          max_ca1: d.school.max_ca1 ?? 20, max_ca2: d.school.max_ca2 ?? 20, max_exam: d.school.max_exam ?? 60
        });
      }
    });
  }, []);

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
    const res = await fetch(`/api/schools/${school.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) { setMsg('Settings saved successfully!'); setTimeout(() => setMsg(''), 3000); }
    setSaving(false);
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
          <label className="label">School Name *</label>
          <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} disabled={user?.role === 'teacher'} />
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

        <h2 className="text-lg font-bold text-gray-700 border-b pb-3 pt-4">Score Distribution</h2>
        <p className="text-xs text-gray-500 mb-2">Define how the total 100% score is shared. Total must be 100.</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">CA1 Max</label>
            <input type="number" className="input" value={form.max_ca1} onChange={e => setForm({...form, max_ca1: parseFloat(e.target.value) || 0})} disabled={user?.role === 'teacher'} />
          </div>
          <div>
            <label className="label">CA2 Max</label>
            <input type="number" className="input" value={form.max_ca2} onChange={e => setForm({...form, max_ca2: parseFloat(e.target.value) || 0})} disabled={user?.role === 'teacher'} />
          </div>
          <div>
            <label className="label">Exam Max</label>
            <input type="number" className="input" value={form.max_exam} onChange={e => setForm({...form, max_exam: parseFloat(e.target.value) || 0})} disabled={user?.role === 'teacher'} />
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className={`${(form.max_ca1 + form.max_ca2 + form.max_exam) === 100 ? 'text-green-600' : 'text-red-600'} font-bold`}>
            Total: {form.max_ca1 + form.max_ca2 + form.max_exam}%
          </span>
          {(form.max_ca1 + form.max_ca2 + form.max_exam) !== 100 && (
            <span className="text-red-500 text-xs">Must equal 100%</span>
          )}
        </div>

        {user?.role !== 'teacher' && (
          <div className="flex justify-end pt-2">
            <button onClick={saveSettings} disabled={saving || !form.name || (form.max_ca1 + form.max_ca2 + form.max_exam) !== 100} className="btn-primary px-8">
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
    </div>
  );
}