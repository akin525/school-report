'use client';
import { useState, useEffect } from 'react';

export default function SchoolsPage() {
  const [schools, setSchools] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', website: '', logo_url: '', adminName: '', adminEmail: '', adminPassword: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { setUser(d.user); loadSchools(); });
  }, []);

  const loadSchools = async () => {
    setLoading(true);
    const res = await fetch('/api/schools');
    setSchools(await res.json());
    setLoading(false);
  };

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

  const saveSchool = async () => {
    setSaving(true);
    const res = await fetch('/api/schools', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) { setShowModal(false); loadSchools(); setForm({ name: '', address: '', phone: '', email: '', website: '', logo_url: '', adminName: '', adminEmail: '', adminPassword: '' }); }
    setSaving(false);
  };

  const deleteSchool = async (id: string) => {
    if (!confirm('Delete this school and ALL its data? This cannot be undone.')) return;
    await fetch(`/api/schools/${id}`, { method: 'DELETE' });
    loadSchools();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-800">Schools Management</h1><p className="text-gray-500 text-sm mt-1">Multi-tenant: manage all schools in the system</p></div>
        {user?.role === 'superadmin' && <button onClick={() => setShowModal(true)} className="btn-primary">+ Add School</button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 flex justify-center h-32 items-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
        ) : schools.map(s => (
          <div key={s.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                {s.logo_url ? <img src={s.logo_url} className="w-12 h-12 rounded-xl object-cover" alt={s.name} /> : <span className="text-blue-700 font-bold text-lg">🏫</span>}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-gray-800 text-base">{s.name}</h3>
                {s.address && <p className="text-gray-500 text-xs mt-1 truncate">{s.address}</p>}
                {s.phone && <p className="text-gray-500 text-xs">{s.phone}</p>}
                {s.email && <p className="text-blue-500 text-xs truncate">{s.email}</p>}
                {s.website && <p className="text-blue-400 text-xs">{s.website}</p>}
              </div>
            </div>
            {user?.role === 'superadmin' && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                <button onClick={() => deleteSchool(s.id)} className="btn-danger text-xs py-1.5 px-3">Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">Add New School</h3>
              <button onClick={() => setShowModal(false)} className="text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="label">School Logo</label>
                <div className="flex items-center gap-4">
                  {form.logo_url ? (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border">
                      <img src={form.logo_url} alt="Logo Preview" className="w-full h-full object-cover" />
                      <button onClick={() => setForm({...form, logo_url: ''})} className="absolute top-0 right-0 bg-red-500 text-white p-1 text-[10px] hover:bg-red-600">×</button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-2xl">🏫</div>
                  )}
                  <input type="file" accept="image/*" className="text-xs" onChange={handleFileUpload} disabled={uploading} />
                  {uploading && <span className="text-[10px] text-blue-600 animate-pulse">Uploading...</span>}
                </div>
              </div>
              <div><label className="label">School Name *</label><input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div><label className="label">Address</label><input className="input" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
                <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
              </div>
              <div><label className="label">Website</label><input className="input" value={form.website} onChange={e => setForm({...form, website: e.target.value})} /></div>
              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-700 mb-3">Admin Account (Optional)</h4>
                <div className="space-y-3">
                  <div><label className="label">Admin Name</label><input className="input" value={form.adminName} onChange={e => setForm({...form, adminName: e.target.value})} /></div>
                  <div><label className="label">Admin Email</label><input type="email" className="input" value={form.adminEmail} onChange={e => setForm({...form, adminEmail: e.target.value})} /></div>
                  <div><label className="label">Admin Password</label><input type="password" className="input" value={form.adminPassword} onChange={e => setForm({...form, adminPassword: e.target.value})} /></div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveSchool} disabled={saving || !form.name} className="btn-primary">{saving ? 'Creating...' : 'Create School'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}