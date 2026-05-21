'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AnnouncementsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ title: '', content: '', target_role: 'all', target_class_id: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.error || !d.user) { router.push('/login'); return; }
      setUser(d.user);
      setStudent(d.student);
      loadAnnouncements(d.user.school_id, d.user.role, d.student?.class_id);
      if (d.user.role !== 'student') {
        fetch(`/api/classes?schoolId=${d.user.school_id}`).then(r => r.json()).then(cls => setClasses(cls));
      }
    });
  }, [router]);

  const loadAnnouncements = async (schoolId: string, role: string, classId?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ schoolId, role });
      if (classId) params.append('classId', classId);
      const res = await fetch(`/api/announcements?${params}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setAnnouncements(data);
      } else {
        setAnnouncements([]);
      }
    } catch (e) {
      console.error(e);
      setAnnouncements([]);
    }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, schoolId: user.school_id })
      });
      if (res.ok) {
        setShowModal(false);
        setFormData({ title: '', content: '', target_role: 'all', target_class_id: '' });
        loadAnnouncements(user.school_id, user.role, student?.class_id);
      }
    } catch (e) { alert('Failed to save announcement'); }
    finally { setSaving(false); }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    await fetch(`/api/announcements?id=${id}`, { method: 'DELETE' });
    loadAnnouncements(user.school_id, user.role, student?.class_id);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Announcements</h1>
          <p className="text-gray-500 text-sm mt-1">Important updates and news from the school</p>
        </div>
        {user?.role !== 'student' && (
          <button onClick={() => setShowModal(true)} className="btn-primary">+ Post Announcement</button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
      ) : announcements.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">📢</div>
          <p className="text-lg font-medium">No announcements found</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {announcements.map(ann => (
            <div key={ann.id} className="card relative group">
              {user?.role !== 'student' && (
                <button onClick={() => deleteAnnouncement(ann.id)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  🗑️
                </button>
              )}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-xl flex-shrink-0">📢</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-bold text-gray-800">{ann.title}</h3>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                      {new Date(ann.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-600 whitespace-pre-wrap">{ann.content}</p>
                  <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
                    <span>By: <span className="font-semibold text-gray-500">{ann.creator_name}</span></span>
                    {ann.target_class_name && (
                      <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">Class: {ann.target_class_name}</span>
                    )}
                    <span className="capitalize">Target: {ann.target_role}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">Post New Announcement</h3>
              <button onClick={() => setShowModal(false)} className="text-white text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Title</label>
                <input className="input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Mid-term Break Notice" />
              </div>
              <div>
                <label className="label">Content</label>
                <textarea className="input" rows={4} value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} placeholder="Write your message here..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Target Audience</label>
                  <select className="input" value={formData.target_role} onChange={e => setFormData({...formData, target_role: e.target.value})}>
                    <option value="all">Everyone</option>
                    <option value="teacher">Teachers Only</option>
                    <option value="student">Students Only</option>
                  </select>
                </div>
                <div>
                  <label className="label">Specific Class (Optional)</label>
                  <select className="input" value={formData.target_class_id} onChange={e => setFormData({...formData, target_class_id: e.target.value})}>
                    <option value="">All Classes</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.arm}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving || !formData.title || !formData.content} className="btn-primary">
                {saving ? 'Posting...' : 'Post Announcement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
