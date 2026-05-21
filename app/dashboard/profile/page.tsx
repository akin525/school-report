'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [teacher, setTeacher] = useState<any>(null);
  const [school, setSchool] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passLoading, setPassLoading] = useState(false);
  const [passMsg, setPassMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.error || !d.user) {
        router.push('/login');
        return;
      }
      setUser(d.user);
      setStudent(d.student);
      setTeacher(d.teacher);
      setSchool(d.school);
      setLoading(false);
    }).catch(() => router.push('/login'));
  }, [router]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg({ type: '', text: '' });

    if (passForm.newPassword !== passForm.confirmPassword) {
      setPassMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (passForm.newPassword.length < 6) {
      setPassMsg({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setPassLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passForm.currentPassword,
          newPassword: passForm.newPassword
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPassMsg({ type: 'success', text: 'Password changed successfully!' });
        setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPassMsg({ type: 'error', text: data.error || 'Failed to change password' });
      }
    } catch {
      setPassMsg({ type: 'error', text: 'Network error' });
    } finally {
      setPassLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account information and security</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="md:col-span-1">
          <div className="card text-center">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-sm overflow-hidden">
              {student?.photo_url ? (
                <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-blue-700 font-bold text-3xl">{user?.name?.[0]?.toUpperCase()}</span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-800">{user?.name}</h2>
            <p className="text-sm text-blue-600 font-medium capitalize mb-4">{user?.role?.replace('_', ' ')}</p>

            <div className="text-left space-y-3 pt-4 border-t text-sm">
              <div>
                <span className="text-gray-500 block">Email</span>
                <span className="font-medium">{user?.email}</span>
              </div>
              {student && (
                <>
                  <div>
                    <span className="text-gray-500 block">Admission Number</span>
                    <span className="font-medium font-mono">{student.admission_number}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Class</span>
                    <span className="badge-primary">{student.class_name} {student.arm}</span>
                  </div>
                </>
              )}
              {teacher && (
                <div>
                  <span className="text-gray-500 block">Category</span>
                  <span className="font-medium capitalize">{teacher.category}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500 block">School</span>
                <span className="font-medium">{school?.name}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security / Settings */}
        <div className="md:col-span-2 space-y-6">
          <div className="card">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span>🔒</span> Change Password
            </h3>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="label">Current Password</label>
                <input
                  type="password"
                  className="input"
                  required
                  value={passForm.currentPassword}
                  onChange={e => setPassForm({...passForm, currentPassword: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">New Password</label>
                  <input
                    type="password"
                    className="input"
                    required
                    value={passForm.newPassword}
                    onChange={e => setPassForm({...passForm, newPassword: e.target.value})}
                  />
                </div>
                <div>
                  <label className="label">Confirm New Password</label>
                  <input
                    type="password"
                    className="input"
                    required
                    value={passForm.confirmPassword}
                    onChange={e => setPassForm({...passForm, confirmPassword: e.target.value})}
                  />
                </div>
              </div>

              {passMsg.text && (
                <div className={`p-3 rounded-lg text-sm ${passMsg.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                  {passMsg.type === 'success' ? '✓ ' : '⚠ '} {passMsg.text}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={passLoading}
                  className="btn-primary px-8"
                >
                  {passLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

          <div className="card bg-blue-50 border-blue-100">
            <h3 className="text-blue-800 font-bold mb-2">Account Help</h3>
            <p className="text-sm text-blue-700">
              If you notice any incorrect information in your profile, please contact your school administrator to have it updated.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
