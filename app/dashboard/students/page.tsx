'use client';
import { useState, useEffect } from 'react';

export default function StudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [schoolId, setSchoolId] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '', class_id: '',
    date_of_birth: '', gender: '', admission_number: '', admission_year: '', photo_url: ''
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      setUser(data.user);
      const sid = data.user.school_id;
      setSchoolId(sid);
      loadData(sid);
    });
  }, []);

  const loadData = async (sid: string) => {
    setLoading(true);
    const [studRes, clsRes] = await Promise.all([
      fetch(`/api/students?schoolId=${sid}`),
      fetch(`/api/classes?schoolId=${sid}`)
    ]);
    setStudents(await studRes.json());
    setClasses(await clsRes.json());
    setLoading(false);
  };

  const openModal = (student?: any) => {
    if (student) {
      setEditing(student);
      setForm({ first_name: student.first_name, middle_name: student.middle_name || '', last_name: student.last_name, class_id: student.class_id || '', date_of_birth: student.date_of_birth || '', gender: student.gender || '', admission_number: student.admission_number || '', admission_year: student.admission_year || '', photo_url: student.photo_url || '' });
    } else {
      setEditing(null);
      setForm({ first_name: '', middle_name: '', last_name: '', class_id: '', date_of_birth: '', gender: '', admission_number: '', admission_year: '', photo_url: '' });
    }
    setShowModal(true);
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
          body: JSON.stringify({ image: base64String, filename: file.name }),
        });

        if (res.ok) {
          const { url } = await res.json();
          setForm({ ...form, photo_url: url });
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

  const saveStudent = async () => {
    setSaving(true);
    const method = editing ? 'PUT' : 'POST';
    const body = editing ? { ...form, id: editing.id, schoolId } : { ...form, schoolId };
    const res = await fetch('/api/students', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { setShowModal(false); loadData(schoolId); }
    setSaving(false);
  };

  const deleteStudent = async (id: string) => {
    if (!confirm('Delete this student? All their scores will also be deleted.')) return;
    await fetch('/api/students', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    loadData(schoolId);
  };

  const filtered = students.filter(s => {
    const matchClass = !filterClass || s.class_id === filterClass;
    const matchSearch = !search || `${s.first_name} ${s.last_name} ${s.admission_number}`.toLowerCase().includes(search.toLowerCase());
    return matchClass && matchSearch;
  });

  const getAge = (dob: string) => {
    if (!dob) return '';
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Students</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} student{filtered.length !== 1 ? 's' : ''} found</p>
        </div>
        {user?.role !== 'teacher' && (
          <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
            <span>+</span> Add Student
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <input type="text" placeholder="Search by name or admission number..." className="input flex-1" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input sm:w-48" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.arm}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">👨‍🎓</div>
            <p className="text-lg font-medium">No students found</p>
            <p className="text-sm mt-1">Add a student to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-header text-left">Photo</th>
                  <th className="table-header text-left">Admission No.</th>
                  <th className="table-header text-left">Name</th>
                  <th className="table-header text-left">Class</th>
                  <th className="table-header text-left">Age</th>
                  <th className="table-header text-left">Gender</th>
                  {user?.role !== 'teacher' && <th className="table-header text-left">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                    <td className="table-cell">
                      {s.photo_url ? (
                        <img src={s.photo_url} alt="" className="w-8 h-8 rounded-full object-cover border" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-[10px]">
                          No Pic
                        </div>
                      )}
                    </td>
                    <td className="table-cell font-mono text-xs text-blue-700">{s.admission_number || '—'}</td>
                    <td className="table-cell font-medium">{s.last_name}, {s.first_name} {s.middle_name}</td>
                    <td className="table-cell"><span className="badge-primary">{s.class_name || '—'}</span></td>
                    <td className="table-cell">{getAge(s.date_of_birth) || '—'}</td>
                    <td className="table-cell capitalize">{s.gender || '—'}</td>
                    {user?.role !== 'teacher' && (
                      <td className="table-cell">
                        <div className="flex gap-2">
                          <button onClick={() => openModal(s)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                          <button onClick={() => deleteStudent(s.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Delete</button>
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">{editing ? 'Edit Student' : 'Add New Student'}</h3>
              <button onClick={() => setShowModal(false)} className="text-white hover:text-blue-200 text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="label">First Name *</label>
                  <input className="input" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="label">Middle Name</label>
                  <input className="input" value={form.middle_name} onChange={e => setForm({...form, middle_name: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="label">Last Name (Surname) *</label>
                  <input className="input" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} />
                </div>
                <div>
                  <label className="label">Admission Number</label>
                  <input className="input" placeholder="e.g. HHC/24/00001" value={form.admission_number} onChange={e => setForm({...form, admission_number: e.target.value})} />
                </div>
                <div>
                  <label className="label">Admission Year</label>
                  <input className="input" placeholder="e.g. 2024" value={form.admission_year} onChange={e => setForm({...form, admission_year: e.target.value})} />
                </div>
                <div>
                  <label className="label">Class</label>
                  <select className="input" value={form.class_id} onChange={e => setForm({...form, class_id: e.target.value})}>
                    <option value="">Select class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.arm}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Gender</label>
                  <select className="input" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="label">Date of Birth</label>
                  <input type="date" className="input" value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} />
                </div>
                <div>
                  <label className="label">Student Picture</label>
                  <div className="flex flex-col gap-2">
                    {form.photo_url && (
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                        <img src={form.photo_url} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setForm({...form, photo_url: ''})}
                          className="absolute top-0 right-0 bg-red-500 text-white p-1 text-[10px] hover:bg-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                    {uploading && <span className="text-[10px] text-blue-600 animate-pulse">Uploading...</span>}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveStudent} disabled={saving || !form.first_name || !form.last_name} className="btn-primary">
                {saving ? 'Saving...' : editing ? 'Update Student' : 'Add Student'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}