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
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('last_name');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '', class_id: '',
    date_of_birth: '', gender: '', admission_number: '', admission_year: '', photo_url: '',
    email: '', password: '', phone: '', hallmark_reg_no: '', date_of_admission: '',
    religion: '', home_address: '', previous_school: '', state_of_origin: '',
    lga: '', bece_no: '', lin_no: '', status: 'active'
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkData, setBulkData] = useState<any[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [showBulkImageModal, setShowBulkImageModal] = useState(false);
  const [bulkImageFiles, setBulkImageFiles] = useState<File[]>([]);
  const [bulkImageResults, setBulkImageStatus] = useState<any>(null);
  const [generatingLogins, setGeneratingLogins] = useState(false);
  const [showAIAnalysisModal, setShowAIAnalysisModal] = useState(false);
  const [selectedStudentForAI, setSelectedStudentForAI] = useState<any>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState('');
  const [loadingAIAnalysis, setLoadingAIAnalysis] = useState(false);
  const [aiProvider, setAIProvider] = useState<'gemini' | 'openai'>('openai');

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
    try {
      const [studRes, clsRes] = await Promise.all([
        fetch('/api/students?schoolId=' + sid + '&status=' + filterStatus),
        fetch('/api/classes?schoolId=' + sid)
      ]);
      const studData = await studRes.json();
      const clsData = await clsRes.json();

      setStudents(Array.isArray(studData) ? studData : []);
      setClasses(Array.isArray(clsData) ? clsData : []);
    } catch (e) {
      console.error(e);
      setStudents([]);
      setClasses([]);
    }
    setLoading(false);
  };

  const openModal = (student?: any) => {
    if (student) {
      setEditing(student);
      setForm({
        first_name: student.first_name,
        middle_name: student.middle_name || '',
        last_name: student.last_name,
        class_id: student.class_id || '',
        date_of_birth: student.date_of_birth || '',
        gender: student.gender || '',
        admission_number: student.admission_number || '',
        admission_year: student.admission_year || '',
        photo_url: student.photo_url || '',
        email: student.email || '',
        password: '',
        phone: student.phone || '',
        hallmark_reg_no: student.hallmark_reg_no || '',
        date_of_admission: student.date_of_admission ? new Date(student.date_of_admission).toISOString().split('T')[0] : '',
        religion: student.religion || '',
        home_address: student.home_address || '',
        previous_school: student.previous_school || '',
        state_of_origin: student.state_of_origin || '',
        lga: student.lga || '',
        bece_no: student.bece_no || '',
        status: student.status || 'active',
        lin_no: student.lin_no || ''
      });
    } else {
      setEditing(null);
      setForm({ 
        first_name: '', middle_name: '', last_name: '', class_id: '', date_of_birth: '', gender: '', 
        admission_number: '', admission_year: '', photo_url: '', email: '', password: '',
        phone: '', hallmark_reg_no: '', date_of_admission: '', religion: '', home_address: '',
        previous_school: '', state_of_origin: '', lga: '', bece_no: '', lin_no: '', status: 'active'
      });
    }
    setShowModal(true);
  };

  const viewDetails = (student: any) => {
    setSelectedStudent(student);
    setShowDetailsModal(true);
  };

  const handleFileUpload = async (e: any) => {
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
          setForm(prev => ({ ...prev, photo_url: url }));
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
    if (!form.first_name || !form.last_name || !form.class_id || !form.gender) {
      alert('First name, Surname, Class and Gender are required');
      return;
    }
    setSaving(true);
    try {
      const method = editing ? 'PUT' : 'POST';
      const body = editing ? { ...form, id: editing.id, schoolId } : { ...form, schoolId };
      const res = await fetch('/api/students', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) { 
        setShowModal(false); 
        loadData(schoolId); 
      } else {
        const err = await res.json();
        alert('Error: ' + (err.error || 'Failed to save student'));
      }
    } catch (e) {
      alert('Network error or server unavailable');
    } finally {
      setSaving(false);
    }
  };

  const deleteStudent = async (id: string) => {
    if (!confirm('Delete this student? All their scores will also be deleted.')) return;
    try {
      const res = await fetch('/api/students', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (res.ok) {
        loadData(schoolId);
      } else {
        const err = await res.json();
        alert('Error: ' + (err.error || 'Failed to delete student'));
      }
    } catch (e) {
      alert('Network error or server unavailable');
    }
  };

  const downloadTemplate = () => {
    const headers = ['first_name', 'middle_name', 'last_name', 'admission_number', 'admission_year', 'gender', 'date_of_birth', 'class_name'];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "student_bulk_upload_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkCsv = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event: any) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const data = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = values[index];
        });
        
        if (obj.class_name) {
          const cls = classes.find(c => (c.name + ' ' + c.arm).toLowerCase() === obj.class_name.toLowerCase() || c.name.toLowerCase() === obj.class_name.toLowerCase());
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

  const handleBulkImages = (e: any) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setBulkImageFiles(files as File[]);
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

  const generateMissingLogins = async () => {
    if (!confirm('Generate missing student logins?')) return;
    setGeneratingLogins(true);
    try {
      const res = await fetch('/api/students/generate-logins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId })
      });
      const result = await res.json();
      if (res.ok) {
        alert(result.message);
        loadData(schoolId);
      } else {
        alert('Error: ' + result.error);
      }
    } catch (e) {
      alert('Action failed');
    } finally {
      setGeneratingLogins(false);
    }
  };

  const runAIAnalysis = async (student: any) => {
    setSelectedStudentForAI(student);
    setShowAIAnalysisModal(true);
    setAiAnalysisResult('');
    setLoadingAIAnalysis(true);
    try {
      const res = await fetch('/api/students/ai-analysis?studentId=' + student.id + '&provider=' + aiProvider);
      const data = await res.json();
      if (res.ok) {
        setAiAnalysisResult(data.analysis);
      } else {
        setAiAnalysisResult("Failed: " + data.error);
      }
    } catch (e) {
      setAiAnalysisResult("Error.");
    } finally {
      setLoadingAIAnalysis(false);
    }
  };

  const filtered = students.filter(s => {
    const matchClass = !filterClass || s.class_id === filterClass;
    const matchCategory = !filterCategory || s.class_category === filterCategory;
    const matchSearch = !search || (s.first_name + ' ' + s.last_name + ' ' + (s.admission_number || '')).toLowerCase().includes(search.toLowerCase());
    return matchClass && matchCategory && matchSearch;
  }).sort((a, b) => {
    if (sortBy === 'admission_number') {
      return (a.admission_number || '').localeCompare(b.admission_number || '');
    }
    return (a.last_name || '').localeCompare(b.last_name || '');
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Students</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} students found</p>
        </div>
        {user?.role !== 'teacher' && (
          <div className="flex items-center gap-3">
             <div className="relative group">
              <button className="btn-secondary flex items-center gap-2">📁 Bulk</button>
              <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-xl hidden group-hover:block z-20">
                <button onClick={downloadTemplate} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm border-b">Template</button>
                <label className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm block cursor-pointer border-b">
                  Upload CSV
                  <input type="file" accept=".csv" className="hidden" onChange={handleBulkCsv} />
                </label>
                <button onClick={generateMissingLogins} disabled={generatingLogins} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm border-b">Logins</button>
                <label className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm block cursor-pointer">
                  Images
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleBulkImages} />
                </label>
              </div>
            </div>
            <button onClick={() => openModal()} className="btn-primary">+ Add</button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex flex-col lg:flex-row gap-4">
          <input type="text" placeholder="Search..." className="input flex-1" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <select className="input w-full sm:w-40" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="nursery">Nursery</option>
            </select>
            <select className="input w-full sm:w-48" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.arm}</option>)}
            </select>
            <select className="input w-full sm:w-40" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); loadData(schoolId); }}>
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="graduated">Graduated</option>
              <option value="left">Left</option>
              <option value="suspended">Suspended</option>
            </select>
            <select className="input w-full sm:w-48" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="last_name">Sort by Name</option>
              <option value="admission_number">Sort by Adm. No.</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? <p className="p-8 text-center">Loading...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-4 text-left">Photo</th>
                  <th className="p-4 text-left">Adm No.</th>
                  <th className="p-4 text-left">Name</th>
                  <th className="p-4 text-left">Class</th>
                  <th className="p-4 text-left">Gender</th>
                  <th className="p-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => viewDetails(s)}>
                    <td className="p-4">
                      {s.photo_url ? (
                        <div className="w-10 h-10 rounded-full border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                           <img
                              src={s.photo_url}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as any).onerror = null;
                                (e.target as any).src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(s.first_name + " " + s.last_name) + "&background=random";
                              }}
                           />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                           No Pic
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-mono">{s.admission_number || '—'}</td>
                    <td className="p-4 font-medium">{s.last_name}, {s.first_name}</td>
                    <td className="p-4">{s.class_name} ({s.class_category})</td>
                    <td className="p-4 capitalize">{s.gender}</td>
                    <td className="p-4" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button onClick={() => openModal(s)} className="text-blue-600">Edit</button>
                        <button onClick={() => runAIAnalysis(s)} className="text-purple-600">Insight</button>
                        <button onClick={() => deleteStudent(s.id)} className="text-red-600">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
             <div className="p-6 border-b flex justify-between items-center">
                <h3 className="text-xl font-bold">{editing ? 'Edit' : 'Add'} Student</h3>
                <button onClick={() => setShowModal(false)} className="text-2xl">&times;</button>
             </div>
             <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="col-span-2 flex items-center gap-4 bg-gray-50 p-4 rounded-lg">
                      <div className="relative w-16 h-16 rounded-full border-2 border-gray-200 overflow-hidden bg-white flex items-center justify-center">
                         {form.photo_url ? (
                            <img src={form.photo_url} className="w-full h-full object-cover" alt="Student" />
                         ) : (
                            <span className="text-2xl text-gray-300">👤</span>
                         )}
                         {uploading && <div className="absolute inset-0 bg-black/20 flex items-center justify-center"><div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>}
                      </div>
                      <div className="flex-1">
                         <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Student Photo</label>
                         <input type="file" accept="image/*" className="text-xs w-full" onChange={handleFileUpload} disabled={uploading} />
                         <p className="text-[10px] text-gray-400 mt-1">PNG, JPG or WebP.</p>
                      </div>
                      {form.photo_url && (
                        <button onClick={() => setForm({...form, photo_url: ''})} className="text-xs text-red-600 hover:underline">Remove</button>
                      )}
                   </div>
                   <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Surname *</label>
                      <input className="input w-full" placeholder="Surname" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} />
                   </div>
                   <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">First Name *</label>
                      <input className="input w-full" placeholder="First Name" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} />
                   </div>
                   <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Middle Name</label>
                      <input className="input w-full" placeholder="Middle Name" value={form.middle_name} onChange={e => setForm({...form, middle_name: e.target.value})} />
                   </div>
                   <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Gender *</label>
                      <select className="input w-full" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                         <option value="">Select Gender</option>
                         <option value="male">Male</option>
                         <option value="female">Female</option>
                      </select>
                   </div>
                   <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Date of Birth</label>
                      <input type="date" className="input w-full" value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} />
                   </div>
                   <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Religion</label>
                      <input className="input w-full" placeholder="Religion" value={form.religion} onChange={e => setForm({...form, religion: e.target.value})} />
                   </div>
                   <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Phone</label>
                      <input className="input w-full" placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                   </div>
                   <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Adm No</label>
                      <input className="input w-full" placeholder="Adm No" value={form.admission_number} onChange={e => setForm({...form, admission_number: e.target.value})} />
                   </div>
                   <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Hallmark Reg No</label>
                      <input className="input w-full" placeholder="Hallmark Reg No" value={form.hallmark_reg_no} onChange={e => setForm({...form, hallmark_reg_no: e.target.value})} />
                   </div>
                   <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Adm Date</label>
                      <input type="date" className="input w-full" placeholder="Adm Date" value={form.date_of_admission} onChange={e => setForm({...form, date_of_admission: e.target.value})} />
                   </div>
                   <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Class *</label>
                      <select className="input w-full" value={form.class_id} onChange={e => setForm({...form, class_id: e.target.value})}>
                         <option value="">Select Class</option>
                         {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.arm}</option>)}
                      </select>
                   </div>
                   <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">BECE No</label>
                      <input className="input w-full" placeholder="BECE No" value={form.bece_no} onChange={e => setForm({...form, bece_no: e.target.value})} />
                   </div>
                   <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">LIN No</label>
                      <input className="input w-full" placeholder="LIN No" value={form.lin_no} onChange={e => setForm({...form, lin_no: e.target.value})} />
                   </div>
                   <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">State</label>
                      <input className="input w-full" placeholder="State" value={form.state_of_origin} onChange={e => setForm({...form, state_of_origin: e.target.value})} />
                   </div>
                   <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">LGA</label>
                      <input className="input w-full" placeholder="LGA" value={form.lga} onChange={e => setForm({...form, lga: e.target.value})} />
                   </div>
                   <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
                      <select className="input w-full" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                         <option value="active">Active</option>
                         <option value="graduated">Graduated</option>
                         <option value="left">Left</option>
                         <option value="suspended">Suspended</option>
                      </select>
                   </div>
                   <div className="col-span-2">
                      <label className="text-xs font-bold text-gray-500 uppercase">Address</label>
                      <textarea className="input w-full" placeholder="Address" value={form.home_address} onChange={e => setForm({...form, home_address: e.target.value})} />
                   </div>
                   <div className="col-span-2">
                      <label className="text-xs font-bold text-gray-500 uppercase">Previous School</label>
                      <input className="input w-full" placeholder="Previous School" value={form.previous_school} onChange={e => setForm({...form, previous_school: e.target.value})} />
                   </div>
                </div>
                <div className="flex justify-end gap-3">
                   <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                   <button onClick={saveStudent} className="btn-primary">Save</button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Details View */}
      {showDetailsModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
             <div className="bg-blue-800 p-6 text-white flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <div className="w-16 h-16 rounded-full border-2 border-white/20 overflow-hidden bg-white/10 flex items-center justify-center">
                      {selectedStudent.photo_url ? (
                        <img
                          src={selectedStudent.photo_url}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as any).onerror = null;
                            (e.target as any).src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(selectedStudent.first_name + " " + selectedStudent.last_name) + "&background=random";
                          }}
                        />
                      ) : (
                        <span className="text-3xl">👤</span>
                      )}
                   </div>
                   <div>
                      <h2 className="text-xl font-bold">{selectedStudent.last_name}, {selectedStudent.first_name}</h2>
                      <p className="text-blue-200 text-xs uppercase font-bold tracking-wider">{selectedStudent.admission_number || 'No Adm No.'}</p>
                   </div>
                </div>
                <button onClick={() => setShowDetailsModal(false)} className="text-3xl hover:text-red-400 transition-colors">&times;</button>
             </div>
             <div className="p-8 grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
                <DetailRow label="Name" value={selectedStudent.last_name + ", " + selectedStudent.first_name} />
                <DetailRow label="Adm No" value={selectedStudent.admission_number} />
                <DetailRow label="Class" value={selectedStudent.class_name} />
                <DetailRow label="Category" value={selectedStudent.class_category} />
                <DetailRow label="Gender" value={selectedStudent.gender} />
                <DetailRow label="DOB" value={selectedStudent.date_of_birth} />
                <DetailRow label="Religion" value={selectedStudent.religion} />
                <DetailRow label="Phone" value={selectedStudent.phone} />
                <DetailRow label="Reg No" value={selectedStudent.hallmark_reg_no} />
                <DetailRow label="Adm Date" value={selectedStudent.date_of_admission} />
                <DetailRow label="State" value={selectedStudent.state_of_origin} />
                <DetailRow label="LGA" value={selectedStudent.lga} />
                <DetailRow label="BECE" value={selectedStudent.bece_no} />
                <DetailRow label="LIN" value={selectedStudent.lin_no} />
                <DetailRow label="Prev School" value={selectedStudent.previous_school} />
                <DetailRow label="Status" value={selectedStudent.status} />
                <div className="col-span-2">
                   <p className="text-xs text-gray-400 uppercase font-bold mb-1">Home Address</p>
                   <p className="p-3 bg-gray-50 rounded">{selectedStudent.home_address || '—'}</p>
                </div>
             </div>
             <div className="p-6 border-t flex justify-end">
                <button onClick={() => setShowDetailsModal(false)} className="btn-primary px-8">Close</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: any) {
  return (
    <div className="py-2 border-b border-gray-50">
      <p className="text-xs text-gray-400 uppercase font-bold">{label}</p>
      <p className="font-medium">{value || '—'}</p>
    </div>
  );
}
