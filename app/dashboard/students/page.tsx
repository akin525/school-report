'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAge } from '@/lib/utils';

export default function StudentsPage() {
  const router = useRouter();
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
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkData, setBulkData] = useState<any[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [showBulkImageModal, setShowBulkImageModal] = useState(false);
  const [bulkImageFiles, setBulkImageFiles] = useState<File[]>([]);
  const [bulkImageResults, setBulkImageStatus] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

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

  const downloadTemplate = () => {
    const headers = ['first_name', 'middle_name', 'last_name', 'admission_number', 'admission_year', 'gender', 'date_of_birth', 'class_name'];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\nJohn,Doe,Smith,HHC/24/001,2024,male,2015-05-20,JS1 A";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "student_bulk_upload_template.csv");
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
          obj[header] = values[index];
        });
        
        // Map class name to ID
        if (obj.class_name) {
          const cls = classes.find(c => `${c.name} ${c.arm}`.toLowerCase() === obj.class_name.toLowerCase() || c.name.toLowerCase() === obj.class_name.toLowerCase());
          if (cls) obj.class_id = cls.id;
        }
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
      const res = await fetch('/api/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: bulkData, schoolId })
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

  const handleBulkImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setBulkImageFiles(files);
    setBulkImageStatus(null);
    setShowBulkImageModal(true);
  };

  const processBulkImages = async () => {
    setBulkProcessing(true);
    const formData = new FormData();
    bulkImageFiles.forEach(file => formData.append('images', file));
    formData.append('schoolId', schoolId);

    try {
      const res = await fetch('/api/students/bulk-images', {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      if (res.ok) {
        setBulkImageStatus({
          success: result.count,
          failed: result.failed,
          errors: result.errors
        });
        loadData(schoolId);
      } else {
        alert('Error: ' + result.error);
      }
    } catch (e) {
      alert('Upload failed');
    }
    setBulkProcessing(false);
  };

  const filtered = students.filter(s => {
    const matchClass = !filterClass || s.class_id === filterClass;
    const matchSearch = !search || `${s.first_name} ${s.last_name} ${s.admission_number}`.toLowerCase().includes(search.toLowerCase());
    return matchClass && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Students</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} student{filtered.length !== 1 ? 's' : ''} found</p>
        </div>
        {user?.role !== 'teacher' && (
          <div className="flex items-center gap-3">
            <div className="relative group">
              <button className="btn-secondary flex items-center gap-2">
                <span>📁</span> Bulk Upload
              </button>
              <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-xl hidden group-hover:block z-20">
                <button onClick={downloadTemplate} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm border-b">Download Template</button>
                <label className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm block cursor-pointer border-b">
                  Upload CSV
                  <input type="file" accept=".csv" className="hidden" onChange={handleBulkCsv} />
                </label>
                <label className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm block cursor-pointer">
                  Upload Images
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleBulkImages} />
                </label>
              </div>
            </div>
            <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
              <span>+</span> Add Student
            </button>
          </div>
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

      {/* Bulk Preview Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-blue-800 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">Preview Bulk Upload ({bulkData.length} students)</h3>
              <button onClick={() => setShowBulkModal(false)} className="text-2xl leading-none">×</button>
            </div>
            <div className="p-6 overflow-auto flex-1">
              <p className="text-sm text-gray-500 mb-4 italic">* If a class name doesn't match exactly, the class will be left empty.</p>
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 border text-left">First Name</th>
                    <th className="p-2 border text-left">Last Name</th>
                    <th className="p-2 border text-left">Adm No.</th>
                    <th className="p-2 border text-left">Class (Detected)</th>
                    <th className="p-2 border text-left">Gender</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkData.map((s, idx) => (
                    <tr key={idx}>
                      <td className="p-2 border">{s.first_name}</td>
                      <td className="p-2 border">{s.last_name}</td>
                      <td className="p-2 border">{s.admission_number}</td>
                      <td className="p-2 border">
                        {s.class_id ? (
                          <span className="text-green-600 font-medium">{s.class_name}</span>
                        ) : (
                          <span className="text-red-500 font-medium">{s.class_name || '—'} (No match)</span>
                        )}
                      </td>
                      <td className="p-2 border">{s.gender}</td>
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

      {/* Bulk Images Modal */}
      {showBulkImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-blue-800 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">Bulk Image Upload ({bulkImageFiles.length} images)</h3>
              <button onClick={() => setShowBulkImageModal(false)} className="text-2xl leading-none">×</button>
            </div>
            <div className="p-6 overflow-auto flex-1">
              {!bulkImageResults ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Images will be matched to students based on their <strong>Admission Number</strong>. 
                    Ensure the filename (without extension) matches exactly. 
                    <br/><br/>
                    Example: <code className="bg-gray-100 px-1 rounded">HHC-24-001.jpg</code> matches student with admission number <code className="bg-gray-100 px-1 rounded">HHC-24-001</code>.
                  </p>
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <h4 className="font-bold text-sm mb-2">Selected Files:</h4>
                    <div className="flex flex-wrap gap-2">
                      {bulkImageFiles.map((f, i) => (
                        <span key={i} className="text-[10px] bg-white border px-2 py-1 rounded">{f.name}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-700">{bulkImageResults.success}</div>
                      <div className="text-xs text-green-600 uppercase font-bold">Successfully Matched</div>
                    </div>
                    <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-red-700">{bulkImageResults.failed}</div>
                      <div className="text-xs text-red-600 uppercase font-bold">Failed/No Match</div>
                    </div>
                  </div>
                  {bulkImageResults.errors.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 text-xs font-bold border-b">Error Details</div>
                      <div className="max-h-48 overflow-y-auto p-4 space-y-1">
                        {bulkImageResults.errors.map((err, i) => (
                          <div key={i} className="text-[10px] text-red-600">• {err}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
              {!bulkImageResults ? (
                <>
                  <button onClick={() => setShowBulkImageModal(false)} className="btn-secondary" disabled={bulkProcessing}>Cancel</button>
                  <button onClick={processBulkImages} disabled={bulkProcessing} className="btn-primary flex items-center gap-2">
                    {bulkProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                      </>
                    ) : 'Match and Upload Images'}
                  </button>
                </>
              ) : (
                <button onClick={() => setShowBulkImageModal(false)} className="btn-primary">Close</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}