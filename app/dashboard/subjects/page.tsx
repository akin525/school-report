'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SubjectsPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [schoolId, setSchoolId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [filterCat, setFilterCat] = useState('');
  const [form, setForm] = useState({ name: '', code: '', category: 'secondary' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.error || !d.user) {
        router.push('/login');
        return;
      }
      setUser(d.user);
      setSchoolId(d.user.school_id);
      loadData(d.user.school_id);
    }).catch(() => {
      router.push('/login');
    });
  }, [router]);

  const loadData = async (sid: string) => {
    setLoading(true);
    const res = await fetch(`/api/subjects?schoolId=${sid}`);
    setSubjects(await res.json());
    setLoading(false);
  };

  const openModal = (sub?: any) => {
    if (sub) { setEditing(sub); setForm({ name: sub.name, code: sub.code || '', category: sub.category }); }
    else { setEditing(null); setForm({ name: '', code: '', category: 'secondary' }); }
    setShowModal(true);
  };

  const saveSubject = async () => {
    setSaving(true);
    const method = editing ? 'PUT' : 'POST';
    const body = editing ? { ...form, id: editing.id, schoolId } : { ...form, schoolId };
    const res = await fetch('/api/subjects', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { setShowModal(false); loadData(schoolId); }
    setSaving(false);
  };

  const deleteSubject = async (id: string) => {
    if (!confirm('Delete this subject?')) return;
    await fetch('/api/subjects', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    loadData(schoolId);
  };

  const filtered = filterCat ? subjects.filter(s => s.category === filterCat) : subjects;
  const categories = ['nursery', 'primary', 'secondary'];
  const catColors: Record<string, string> = { nursery: 'bg-green-100 text-green-800', primary: 'bg-blue-100 text-blue-800', secondary: 'bg-purple-100 text-purple-800' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-800">Subjects</h1><p className="text-gray-500 text-sm mt-1">{filtered.length} subject{filtered.length !== 1 ? 's' : ''}</p></div>
        {(user?.role === 'superadmin' || user?.role === 'school_admin') && (
          <button onClick={() => openModal()} className="btn-primary">+ Add Subject</button>
        )}
      </div>

      <div className="card">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterCat('')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!filterCat ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>All ({subjects.length})</button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilterCat(cat)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${filterCat === cat ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {cat} ({subjects.filter(s => s.category === cat).length})
            </button>
          ))}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center h-32 items-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><div className="text-5xl mb-4">📚</div><p className="text-lg font-medium">No subjects found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-200">
                <th className="table-header text-left">Subject Name</th>
                <th className="table-header text-left">Code</th>
                <th className="table-header text-left">Category</th>
                {(user?.role === 'superadmin' || user?.role === 'school_admin') && <th className="table-header text-left">Actions</th>}
              </tr></thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                    <td className="table-cell font-medium">{s.name}</td>
                    <td className="table-cell font-mono text-xs text-gray-600">{s.code || '—'}</td>
                    <td className="table-cell"><span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${catColors[s.category]}`}>{s.category}</span></td>
                    {(user?.role === 'superadmin' || user?.role === 'school_admin') && (
                      <td className="table-cell">
                        <div className="flex gap-2">
                          <button onClick={() => openModal(s)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                          <button onClick={() => deleteSubject(s.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Delete</button>
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

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">{editing ? 'Edit Subject' : 'Add New Subject'}</h3>
              <button onClick={() => setShowModal(false)} className="text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="label">Subject Name *</label><input className="input" placeholder="e.g. ENGLISH, MATHS" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div><label className="label">Code</label><input className="input" placeholder="e.g. ENG, MTH" value={form.code} onChange={e => setForm({...form, code: e.target.value})} /></div>
              <div><label className="label">Category *</label>
                <select className="input" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  <option value="nursery">Nursery/KG</option>
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveSubject} disabled={saving || !form.name} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Add Subject'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}