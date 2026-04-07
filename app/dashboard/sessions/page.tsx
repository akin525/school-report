'use client';
import { useState, useEffect } from 'react';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', start_year: new Date().getFullYear().toString(), end_year: (new Date().getFullYear() + 1).toString(), is_current: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { setSchoolId(d.user.school_id); loadData(d.user.school_id); });
  }, []);

  const loadData = async (sid: string) => {
    setLoading(true);
    const res = await fetch(`/api/sessions?schoolId=${sid}`);
    setSessions(await res.json());
    setLoading(false);
  };

  const openModal = (s?: any) => {
    if (s) { setEditing(s); setForm({ name: s.name, start_year: s.start_year.toString(), end_year: s.end_year.toString(), is_current: !!s.is_current }); }
    else { setEditing(null); setForm({ name: '', start_year: new Date().getFullYear().toString(), end_year: (new Date().getFullYear() + 1).toString(), is_current: false }); }
    setShowModal(true);
  };

  const saveSession = async () => {
    setSaving(true);
    const method = editing ? 'PUT' : 'POST';
    const body = editing
      ? { id: editing.id, ...form, start_year: parseInt(form.start_year), end_year: parseInt(form.end_year) }
      : { ...form, start_year: parseInt(form.start_year), end_year: parseInt(form.end_year), schoolId };
    await fetch('/api/sessions', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setShowModal(false);
    loadData(schoolId);
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-800">Academic Sessions</h1><p className="text-gray-500 text-sm mt-1">Manage school academic sessions/years</p></div>
        <button onClick={() => openModal()} className="btn-primary">+ Add Session</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 flex justify-center h-32 items-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
        ) : sessions.map(s => (
          <div key={s.id} className={`card border-2 ${s.is_current ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-xl text-gray-800">{s.name}</h3>
                <p className="text-gray-500 text-sm mt-1">{s.start_year} — {s.end_year}</p>
              </div>
              {s.is_current && <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold">CURRENT</span>}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => openModal(s)} className="btn-secondary text-xs py-1.5 px-3">Edit</button>
              {!s.is_current && (
                <button onClick={async () => { await fetch('/api/sessions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, name: s.name, start_year: s.start_year, end_year: s.end_year, is_current: true }) }); loadData(schoolId); }} className="btn-success text-xs py-1.5 px-3">Set Current</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">{editing ? 'Edit Session' : 'Add New Session'}</h3>
              <button onClick={() => setShowModal(false)} className="text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="label">Session Name *</label><input className="input" placeholder="e.g. 2024/2025" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Start Year</label><input type="number" className="input" value={form.start_year} onChange={e => setForm({...form, start_year: e.target.value})} /></div>
                <div><label className="label">End Year</label><input type="number" className="input" value={form.end_year} onChange={e => setForm({...form, end_year: e.target.value})} /></div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_current} onChange={e => setForm({...form, is_current: e.target.checked})} className="rounded" />
                <span className="text-sm font-medium text-gray-700">Set as Current Session</span>
              </label>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveSession} disabled={saving || !form.name} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Add Session'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}