'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<any[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [schoolId, setSchoolId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [classSubjectIds, setClassSubjectIds] = useState<string[]>([]);
  const [form, setForm] = useState({ name: '', arm: '', level: '', category: 'secondary' });
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
    const [cRes, sRes] = await Promise.all([fetch(`/api/classes?schoolId=${sid}`), fetch(`/api/subjects?schoolId=${sid}`)]);
    setClasses(await cRes.json());
    setAllSubjects(await sRes.json());
    setLoading(false);
  };

  const openModal = (cls?: any) => {
    if (cls) { setEditing(cls); setForm({ name: cls.name, arm: cls.arm || '', level: cls.level || '', category: cls.category || 'secondary' }); }
    else { setEditing(null); setForm({ name: '', arm: '', level: '', category: 'secondary' }); }
    setShowModal(true);
  };

  const openSubjectModal = async (cls: any) => {
    setSelectedClass(cls);
    const res = await fetch(`/api/class-subjects?classId=${cls.id}&schoolId=${schoolId}`);
    const data = await res.json();
    setClassSubjectIds(data.map((d: any) => d.subject_id));
    setShowSubjectModal(true);
  };

  const saveClass = async () => {
    setSaving(true);
    const method = editing ? 'PUT' : 'POST';
    const body = editing ? { ...form, id: editing.id, schoolId } : { ...form, schoolId };
    const res = await fetch('/api/classes', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { setShowModal(false); loadData(schoolId); }
    setSaving(false);
  };

  const saveSubjects = async () => {
    setSaving(true);
    await fetch('/api/class-subjects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classId: selectedClass.id, subjectIds: classSubjectIds, schoolId }) });
    setSaving(false);
    setShowSubjectModal(false);
  };

  const deleteClass = async (id: string) => {
    if (!confirm('Delete this class?')) return;
    await fetch('/api/classes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    loadData(schoolId);
  };

  const toggleSubject = (id: string) => {
    setClassSubjectIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const byCategory = ['nursery', 'primary', 'secondary'];
  const categoryLabels: Record<string, string> = { nursery: '🌱 Nursery/KG', primary: '📖 Primary', secondary: '🎓 Secondary' };

  const filteredSubjects = allSubjects.filter(s => s.category === selectedClass?.category);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-800">Classes & Arms</h1><p className="text-gray-500 text-sm mt-1">{classes.length} class{classes.length !== 1 ? 'es' : ''}</p></div>
        {(user?.role === 'superadmin' || user?.role === 'school_admin') && (
          <button onClick={() => openModal()} className="btn-primary">+ Add Class</button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center h-32 items-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        byCategory.map(cat => {
          const catClasses = classes.filter(c => c.category === cat);
          if (!catClasses.length) return null;
          return (
            <div key={cat}>
              <h2 className="text-lg font-bold text-gray-700 mb-3">{categoryLabels[cat]}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {catClasses.map(cls => (
                  <div key={cls.id} className="card hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg">{cls.name} {cls.arm}</h3>
                        <p className="text-gray-500 text-sm">{cls.level}</p>
                        <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${cat === 'nursery' ? 'bg-green-100 text-green-700' : cat === 'primary' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{cat}</span>
                      </div>
                    </div>
                    {(user?.role === 'superadmin' || user?.role === 'school_admin') && (
                      <div className="flex gap-2 mt-4">
                        <button onClick={() => openSubjectModal(cls)} className="btn-success text-xs py-1.5 px-3">📚 Subjects</button>
                        <button onClick={() => openModal(cls)} className="btn-secondary text-xs py-1.5 px-3">Edit</button>
                        <button onClick={() => deleteClass(cls.id)} className="btn-danger text-xs py-1.5 px-3">Delete</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Class Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">{editing ? 'Edit Class' : 'Add New Class'}</h3>
              <button onClick={() => setShowModal(false)} className="text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="label">Class Name *</label><input className="input" placeholder="e.g. Year 7, Pry 1, Kg 1" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div><label className="label">Arm</label><input className="input" placeholder="e.g. A, B, Gold" value={form.arm} onChange={e => setForm({...form, arm: e.target.value})} /></div>
              <div><label className="label">Level</label><input className="input" placeholder="e.g. Year 7" value={form.level} onChange={e => setForm({...form, level: e.target.value})} /></div>
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
              <button onClick={saveClass} disabled={saving || !form.name} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Add Class'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Subject Assignment Modal */}
      {showSubjectModal && selectedClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="bg-green-700 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">Subjects for {selectedClass.name} {selectedClass.arm}</h3>
              <button onClick={() => setShowSubjectModal(false)} className="text-2xl leading-none">×</button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Select subjects offered in this class:</p>
              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                {filteredSubjects.map(s => (
                  <label key={s.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={classSubjectIds.includes(s.id)} onChange={() => toggleSubject(s.id)} className="rounded text-blue-600" />
                    <span className="text-sm font-medium text-gray-700">{s.name}</span>
                  </label>
                ))}
                {filteredSubjects.length === 0 && <p className="text-sm text-gray-400 col-span-2 text-center py-4">No subjects for this category. Add subjects first.</p>}
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                <span>{classSubjectIds.length} subjects selected</span>
                <button onClick={() => setClassSubjectIds([])} className="text-red-500 hover:text-red-700">Clear All</button>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
              <button onClick={() => setShowSubjectModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveSubjects} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Subjects'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}