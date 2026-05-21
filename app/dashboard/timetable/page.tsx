'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const DAYS = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
];

export default function TimetablePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [timetable, setTimetable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ day_of_week: 1, start_time: '08:00', end_time: '09:00', subject_id: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.error || !d.user) { router.push('/login'); return; }
      setUser(d.user);
      setStudent(d.student);
      const sid = d.user.school_id;

      if (d.user.role === 'student' && d.student?.class_id) {
        setSelectedClass(d.student.class_id);
      } else {
        fetch(`/api/classes?schoolId=${sid}`).then(r => r.json()).then(cls => setClasses(cls));
      }
    });
  }, [router]);

  useEffect(() => {
    if (selectedClass) {
      loadTimetable(selectedClass);
      fetch(`/api/subjects?classId=${selectedClass}`).then(r => r.json()).then(subjs => setSubjects(subjs));
    }
  }, [selectedClass]);

  const loadTimetable = async (classId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/timetable?classId=${classId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setTimetable(data);
      } else {
        setTimetable([]);
      }
    } catch (e) {
      console.error(e);
      setTimetable([]);
    }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, class_id: selectedClass, schoolId: user.school_id })
      });
      if (res.ok) {
        setShowModal(false);
        loadTimetable(selectedClass);
      }
    } catch (e) { alert('Failed to save timetable'); }
    finally { setSaving(false); }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    await fetch(`/api/timetable?id=${id}`, { method: 'DELETE' });
    loadTimetable(selectedClass);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Class Timetable</h1>
          <p className="text-gray-500 text-sm mt-1">
            {user?.role === 'student' ? `Timetable for ${student?.class_name}` : 'Manage weekly schedule for classes'}
          </p>
        </div>
        {user?.role !== 'student' && (
          <div className="flex items-center gap-3">
            <select className="input sm:w-48" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
              <option value="">Select Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.arm}</option>)}
            </select>
            <button onClick={() => setShowModal(true)} disabled={!selectedClass} className="btn-primary">+ Add Entry</button>
          </div>
        )}
      </div>

      {!selectedClass ? (
        <div className="card text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">📅</div>
          <p className="text-lg font-medium">Select a class to view its timetable</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {DAYS.map(day => {
            const entries = timetable.filter(e => e.day_of_week === day.id).sort((a, b) => a.start_time.localeCompare(b.start_time));
            return (
              <div key={day.id} className="space-y-3">
                <div className="bg-gray-800 text-white px-3 py-2 rounded-lg text-center font-bold text-sm">
                  {day.name}
                </div>
                <div className="space-y-2">
                  {entries.length === 0 ? (
                    <div className="text-center py-4 text-gray-400 text-xs italic">No lessons</div>
                  ) : (
                    entries.map(entry => (
                      <div key={entry.id} className="card p-3 border-l-4 border-l-blue-600 relative group">
                        {user?.role !== 'student' && (
                          <button onClick={() => deleteEntry(entry.id)} className="absolute top-1 right-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 text-[10px]">×</button>
                        )}
                        <div className="font-bold text-gray-800 text-sm truncate" title={entry.subject_name}>{entry.subject_name}</div>
                        <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-1">
                          <span>🕒</span> {entry.start_time} - {entry.end_time}
                        </div>
                        {entry.teacher_name && (
                          <div className="text-[10px] text-blue-600 font-medium mt-1 truncate">
                            👨‍🏫 {entry.teacher_name}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">Add Timetable Entry</h3>
              <button onClick={() => setShowModal(false)} className="text-white text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Day of Week</label>
                <select className="input" value={formData.day_of_week} onChange={e => setFormData({...formData, day_of_week: parseInt(e.target.value)})}>
                  {DAYS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Time</label>
                  <input type="time" className="input" value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} />
                </div>
                <div>
                  <label className="label">End Time</label>
                  <input type="time" className="input" value={formData.end_time} onChange={e => setFormData({...formData, end_time: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="label">Subject</label>
                <select className="input" value={formData.subject_id} onChange={e => setFormData({...formData, subject_id: e.target.value})}>
                  <option value="">Select Subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving || !formData.subject_id} className="btn-primary">
                {saving ? 'Saving...' : 'Add to Timetable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
