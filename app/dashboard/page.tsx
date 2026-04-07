'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Stats {
  students: number;
  teachers: number;
  classes: number;
  subjects: number;
  schools?: number;
}
// new branch

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [school, setSchool] = useState<any>(null);
  const [stats, setStats] = useState<Stats>({ students: 0, teachers: 0, classes: 0, subjects: 0 });
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      // Init DB first
      await fetch('/api/init');
      const meRes = await fetch('/api/auth/me');
      if (!meRes.ok) return;
      const meData = await meRes.json();
      setUser(meData.user);
      setSchool(meData.school);

      const schoolId = meData.user.school_id;
      if (schoolId) {
        const [studRes, teachRes, classRes, subRes, sessRes] = await Promise.all([
          fetch(`/api/students?schoolId=${schoolId}`),
          fetch(`/api/teachers?schoolId=${schoolId}`),
          fetch(`/api/classes?schoolId=${schoolId}`),
          fetch(`/api/subjects?schoolId=${schoolId}`),
          fetch(`/api/sessions?schoolId=${schoolId}`),
        ]);
        const [students, teachers, classes, subjects, sessions] = await Promise.all([
          studRes.json(), teachRes.json(), classRes.json(), subRes.json(), sessRes.json()
        ]);
        setStats({ students: students.length, teachers: teachers.length, classes: classes.length, subjects: subjects.length });
        setCurrentSession(sessions.find((s: any) => s.is_current) || sessions[0]);
      } else if (meData.user.role === 'superadmin') {
        const schoolsRes = await fetch('/api/schools');
        const schools = await schoolsRes.json();
        setStats(prev => ({ ...prev, schools: schools.length }));
      }
      setLoading(false);
    };
    init();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const statCards = [
    { label: 'Total Students', value: stats.students, icon: '👨‍🎓', color: 'blue', href: '/dashboard/students' },
    { label: 'Total Teachers', value: stats.teachers, icon: '👨‍🏫', color: 'green', href: '/dashboard/teachers' },
    { label: 'Classes', value: stats.classes, icon: '🏛️', color: 'purple', href: '/dashboard/classes' },
    { label: 'Subjects', value: stats.subjects, icon: '📚', color: 'orange', href: '/dashboard/subjects' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
  };

  const quickLinks = [
    { href: '/dashboard/students', icon: '👨‍🎓', title: 'Manage Students', desc: 'Add, edit, view student records' },
    { href: '/dashboard/scores', icon: '📝', title: 'Enter Scores', desc: 'Input CA and exam scores by term' },
    { href: '/dashboard/reports', icon: '📊', title: 'Generate Reports', desc: 'Print individual report cards' },
    { href: '/dashboard/reports?type=broadsheet', icon: '📋', title: 'Broadsheet', desc: 'View class performance overview' },
    { href: '/dashboard/teachers', icon: '👨‍🏫', title: 'Manage Teachers', desc: 'Add teachers & assign subjects' },
    { href: '/dashboard/classes', icon: '🏛️', title: 'Manage Classes', desc: 'Configure classes and arms' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Welcome, {user?.name}! 👋</h1>
            <p className="text-blue-200 mt-1">{school?.name || 'Multi-School System'}</p>
            {school?.address && <p className="text-blue-300 text-sm mt-1">{school.address}</p>}
          </div>
          {currentSession && (
            <div className="bg-white bg-opacity-20 rounded-xl p-4 text-center">
              <p className="text-blue-200 text-xs uppercase font-semibold">Current Session</p>
              <p className="text-white font-bold text-xl">{currentSession.name}</p>
              <span className="inline-block mt-1 bg-green-400 text-green-900 text-xs px-2 py-0.5 rounded-full font-semibold">Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <Link key={card.label} href={card.href}
            className={`card border-2 ${colorMap[card.color]} hover:shadow-md transition-shadow cursor-pointer group`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{card.label}</p>
                <p className="text-3xl font-bold mt-1">{card.value}</p>
              </div>
              <span className="text-4xl group-hover:scale-110 transition-transform">{card.icon}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map(link => (
            <Link key={link.href} href={link.href}
              className="card hover:shadow-md hover:border-blue-300 transition-all group cursor-pointer">
              <div className="flex items-start gap-4">
                <span className="text-3xl group-hover:scale-110 transition-transform">{link.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-800">{link.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{link.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Grade Scale Reference */}
      <div className="card">
        <h2 className="text-lg font-bold text-gray-800 mb-4">📊 Grading Scale Reference</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
          {[
            { grade: 'A+', range: '95-100', label: 'Distinction', color: 'bg-green-100 text-green-800' },
            { grade: 'A', range: '90-94', label: 'Super Perf.', color: 'bg-green-100 text-green-800' },
            { grade: 'B+', range: '87-89', label: 'Very High', color: 'bg-blue-100 text-blue-800' },
            { grade: 'B', range: '83-86', label: 'High', color: 'bg-blue-100 text-blue-800' },
            { grade: 'B-', range: '80-82', label: 'Good', color: 'bg-cyan-100 text-cyan-800' },
            { grade: 'C+', range: '77-79', label: 'High Credit', color: 'bg-cyan-100 text-cyan-800' },
            { grade: 'C', range: '73-76', label: 'Credit', color: 'bg-yellow-100 text-yellow-800' },
            { grade: 'C-', range: '70-72', label: 'Average', color: 'bg-yellow-100 text-yellow-800' },
            { grade: 'D+', range: '67-69', label: 'Good Pass', color: 'bg-orange-100 text-orange-800' },
            { grade: 'D', range: '63-66', label: 'VG Pass', color: 'bg-orange-100 text-orange-800' },
            { grade: 'D-', range: '60-62', label: 'Pass', color: 'bg-red-100 text-red-800' },
            { grade: 'F', range: '0-59', label: 'Fail', color: 'bg-red-200 text-red-900' },
          ].map(g => (
            <div key={g.grade} className={`rounded-lg p-2 text-center ${g.color}`}>
              <div className="font-bold text-base">{g.grade}</div>
              <div className="font-medium">{g.range}</div>
              <div className="opacity-80">{g.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}