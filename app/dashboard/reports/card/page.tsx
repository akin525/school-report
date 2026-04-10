'use client';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getGradeColor(grade: string): string {
  if (grade === 'A+') return '#166534';
  if (grade === 'A') return '#15803d';
  if (grade === 'B+' || grade === 'B') return '#1d4ed8';
  if (grade === 'B-' || grade === 'C+') return '#0e7490';
  if (grade === 'C' || grade === 'C-') return '#b45309';
  if (grade === 'D+' || grade === 'D' || grade === 'D-') return '#c2410c';
  if (grade === 'F') return '#991b1b';
  return '#374151';
}

function ReportCardContent() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get('studentId');
  const sessionId = searchParams.get('sessionId');
  const termParam = parseInt(searchParams.get('term') || '3');
  const format = searchParams.get('format') || 'cumulative';
  const [report, setReport] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editComments, setEditComments] = useState(false);
  const [comments, setComments] = useState<Record<number, any>>({});
  const [traits, setTraits] = useState<Record<number, any>>({});
  const [attendance, setAttendance] = useState<Record<number, any>>({});
  const [saving, setSaving] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (studentId && sessionId) {
      fetch(`/api/auth/me`).then(r => r.json()).then(me => {
        setUser(me.user);
        fetch(`/api/reports/student?studentId=${studentId}&sessionId=${sessionId}&schoolId=${me.user.school_id}`)
          .then(r => r.json()).then(data => {
            setReport(data);
            setComments(data.comments || {});
            setTraits(data.traits || {});
            setAttendance(data.attendance || {});
            setLoading(false);
          });
      });
    }
  }, [studentId, sessionId]);

  const saveComments = async (term: number) => {
    setSaving(true);
    const c = comments[term] || {};
    const a = attendance[term] || {};
    const t = traits[term] || {};
    
    // Ensure schoolId is passed
    const payload = { 
      studentId, 
      sessionId, 
      term, 
      schoolId: report.school.id, 
      ...c 
    };

    await Promise.all([
      fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
      fetch('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId, sessionId, term, schoolId: report.school.id, ...a }) }),
      fetch('/api/traits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId, sessionId, term, schoolId: report.school.id, ...t }) }),
    ]);
    setSaving(false);
    // Reload
    const me = await fetch('/api/auth/me').then(r => r.json());
    const fresh = await fetch(`/api/reports/student?studentId=${studentId}&sessionId=${sessionId}&schoolId=${me.user.school_id}`).then(r => r.json());
    setReport(fresh);
    setComments(fresh.comments || {});
    setTraits(fresh.traits || {});
    setAttendance(fresh.attendance || {});
  };

  const handlePrint = () => window.print();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p>Loading report card...</p></div>
    </div>
  );
  if (!report || !report.student) return <div className="min-h-screen flex items-center justify-center"><p className="text-red-600">Report not found</p></div>;

  const { student, school, session, subjectCumulative, termData, classTeacher } = report;

  const getMaxValues = () => {
    if (!school || !student) return { ca1: 20, ca2: 20, exam: 60 };
    const cat = student.class_category || 'secondary';
    if (cat === 'nursery') return { ca1: school.nursery_max_ca1 || 20, ca2: school.nursery_max_ca2 || 20, exam: school.nursery_max_exam || 60 };
    if (cat === 'primary') return { ca1: school.primary_max_ca1 || 20, ca2: school.primary_max_ca2 || 20, exam: school.primary_max_exam || 60 };
    return { ca1: school.secondary_max_ca1 || 20, ca2: school.secondary_max_ca2 || 20, exam: school.secondary_max_exam || 60 };
  };

  const maxVals = getMaxValues();

  const getSchoolName = () => {
    if (!school || !student) return '';
    const cat = student.class_category || 'secondary';
    if (cat === 'nursery') return school.nursery_name || school.name;
    if (cat === 'primary') return school.primary_name || school.name;
    return school.secondary_name || school.name;
  };

  const schoolName = getSchoolName();

  // Determine what term to show in the first columns for single report
  const activeTerm = format === 'single' ? termParam : 1;
  const activeTermLabel = activeTerm === 1 ? '1st TERM' : activeTerm === 2 ? '2nd TERM' : '3rd TERM';
  const activeTermBg = activeTerm === 1 ? '#fef2f2' : activeTerm === 2 ? '#f0f9ff' : '#fafaf0';

  const getAge = (dob: string) => {
    if (!dob) return '';
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  };

  const traitOptions = ['A', 'B', 'C', 'D', 'E'];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Toolbar - no print */}
      <div className="no-print bg-white border-b shadow-sm px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="btn-secondary text-sm">← Back</button>
          <span className="text-gray-600 font-medium">{student.last_name}, {student.first_name} — Report Card</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setEditComments(!editComments)} className="btn-secondary text-sm">
            {editComments ? '👁 View Mode' : '✏️ Edit Comments'}
          </button>
          {editComments && (
            <button onClick={() => { saveComments(1); saveComments(2); saveComments(3); }} disabled={saving} className="btn-success text-sm">
              {saving ? 'Saving...' : '💾 Save Changes'}
            </button>
          )}
          <button onClick={handlePrint} className="btn-primary text-sm flex items-center gap-2">
            🖨️ Print / PDF
          </button>
        </div>
      </div>

      {/* Report Card */}
      <div className="p-4 flex justify-center">
        <div ref={printRef} id="report-card" className="bg-white shadow-lg" 
          style={{ 
            width: format === 'single' ? '210mm' : '297mm', 
            minHeight: format === 'single' ? '285mm' : '200mm', 
            fontFamily: 'Arial, sans-serif', 
            fontSize: '9px' 
          }}>

          {/* OUTER BORDER */}
          <div style={{ border: '3px solid #dc2626', padding: '6px', minHeight: format === 'single' ? '275mm' : '190mm' }}>

            {/* HEADER ROW */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>

              {/* LEFT SIDEBAR - Affective Traits */}
              <div style={{ width: '90px', border: '1.5px solid #dc2626', padding: '4px', flexShrink: 0 }}>
                <div style={{ fontWeight: 'bold', fontSize: '7px', color: '#dc2626', marginBottom: '3px', textAlign: 'center', lineHeight: 1.2 }}>
                  AFFECTIVE<br />TRAITS AND<br />BEHAVIOURS
                </div>
                {[
                  { label: 'Class/HomeWork', key: 'homework' },
                  { label: 'Punctuality', key: 'punctuality' },
                  { label: 'Interaction', key: 'interaction' },
                  { label: 'Leadership Ability', key: 'leadership' },
                  { label: 'Politeness/ Respect', key: 'politeness' },
                ].map(trait => (
                  <div key={trait.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #fee2e2', padding: '2px 0', gap: '2px' }}>
                    <span style={{ fontSize: '7px', lineHeight: 1.2, flex: 1 }}>{trait.label}</span>
                    <div style={{ display: 'flex', gap: '1px', flexWrap: 'wrap' }}>
                      {[1,2,3].filter(t => format === 'cumulative' ? t <= termParam : t === termParam).map(term => (
                        editComments ? (
                          <select key={term} value={traits[term]?.[trait.key] || ''} onChange={e => setTraits(prev => ({ ...prev, [term]: { ...prev[term], [trait.key]: e.target.value } }))}
                            style={{ width: '18px', fontSize: '6px', border: '1px solid #ccc', padding: '0' }}>
                            <option value="">-</option>
                            {traitOptions.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <span key={term} style={{ width: '14px', height: '12px', border: '1px solid #dc2626', fontSize: '7px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {traits[term]?.[trait.key] || ''}
                          </span>
                        )
                      ))}
                    </div>
                  </div>
                ))}
                {/* Term labels */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1px', marginTop: '2px' }}>
                  {['1','2','3'].filter(t => format === 'cumulative' ? parseInt(t) <= termParam : parseInt(t) === termParam).map(t => <span key={t} style={{ width: '14px', fontSize: '6px', textAlign: 'center', color: '#6b7280' }}>T{t}</span>)}
                </div>

                {/* Physical Dev */}
                <div style={{ marginTop: '4px', fontSize: '7px', color: '#374151', borderTop: '1px solid #dc2626', paddingTop: '3px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '2px', color: '#dc2626' }}>PHYSICAL DEV:</div>
                  <div style={{ marginBottom: '1px' }}>
                    Wt: <span style={{ borderBottom: '1px solid #999' }}>{editComments ? '' : ''}</span> kg
                  </div>
                  <div>Ht: <span style={{ borderBottom: '1px solid #999' }}></span> m</div>
                </div>

                {/* Attendance */}
                <div style={{ marginTop: '4px', fontSize: '7px', borderTop: '1px solid #dc2626', paddingTop: '3px' }}>
                  <div style={{ fontWeight: 'bold', color: '#dc2626', marginBottom: '2px' }}>ATTENDANCE:</div>
                  {[1,2,3].filter(t => format === 'cumulative' ? t <= termParam : t === termParam).map(term => (
                    <div key={term} style={{ marginBottom: '2px' }}>
                      <span style={{ fontWeight: 'bold' }}>T{term}: </span>
                      {editComments ? (
                        <span>
                          <input type="number" placeholder="Opened" value={attendance[term]?.times_school_opened || ''} onChange={e => setAttendance(prev => ({ ...prev, [term]: { ...prev[term], times_school_opened: parseInt(e.target.value) || 0 } }))} style={{ width: '28px', fontSize: '6px', border: '1px solid #ccc' }} />
                          /
                          <input type="number" placeholder="Present" value={attendance[term]?.times_present || ''} onChange={e => setAttendance(prev => ({ ...prev, [term]: { ...prev[term], times_present: parseInt(e.target.value) || 0 } }))} style={{ width: '28px', fontSize: '6px', border: '1px solid #ccc' }} />
                        </span>
                      ) : (
                        <span>{attendance[term]?.times_present || '—'}/{attendance[term]?.times_school_opened || '—'}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Key to Rating */}
                <div style={{ marginTop: '4px', fontSize: '6.5px', borderTop: '1px solid #dc2626', paddingTop: '3px' }}>
                  <div style={{ fontWeight: 'bold', color: '#dc2626', marginBottom: '2px' }}>KEY TO RATING:</div>
                  <div>A- Excellent</div>
                  <div>B- Good</div>
                  <div>C- Fair</div>
                  <div>D- Poor</div>
                  <div>E- Very Poor</div>
                </div>

                {/* Conduct */}
                <div style={{ marginTop: '4px', fontSize: '6.5px', borderTop: '1px solid #dc2626', paddingTop: '3px' }}>
                  <div style={{ fontWeight: 'bold', color: '#dc2626', marginBottom: '2px' }}>CONDUCT:</div>
                  {['COMMENDABLE', 'GOOD', 'FAIR'].map(c => (
                    <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '1px' }}>
                      <span style={{ width: '8px', height: '8px', border: '1px solid #dc2626', display: 'inline-block' }}></span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* MAIN CONTENT */}
              <div style={{ flex: 1 }}>
                {/* School Header - Redesigned for better look */}
                <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 60px', alignItems: 'center', gap: '10px', marginBottom: '8px', borderBottom: '2px solid #dc2626', paddingBottom: '6px' }}>
                  {/* Logo */}
                  <div style={{ width: '60px', height: '60px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {school.logo_url ? (
                      <img src={school.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', border: '2px solid #1e40af', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e40af', textAlign: 'center', lineHeight: 1.1 }}>
                          {schoolName.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* School Info - Centered and Prominent */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '26px', fontWeight: '900', color: '#1e40af', lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                      {schoolName}
                    </div>
                    <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', marginBottom: '1px' }}>
                      {school.address}
                    </div>
                    <div style={{ fontSize: '8px', color: '#1d4ed8' }}>
                      {school.website && <span style={{ marginRight: '8px' }}>🌐 {school.website}</span>}
                      {school.email && <span style={{ marginRight: '8px' }}>✉️ {school.email}</span>}
                      {school.phone && <span>📞 {school.phone}</span>}
                    </div>
                    {school.motto && (
                      <div style={{ fontSize: '10px', fontStyle: 'italic', fontWeight: 'bold', color: '#dc2626', marginTop: '2px' }}>
                        Motto: {school.motto}
                      </div>
                    )}
                  </div>

                  {/* Student Photo */}
                  <div style={{ width: '65px', height: '75px', border: '2px solid #dc2626', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', borderRadius: '2px' }}>
                    {student.photo_url ? (
                      <img src={student.photo_url} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ textAlign: 'center', fontSize: '7px', color: '#9ca3af' }}>
                        <div style={{ fontSize: '20px' }}>👤</div>
                        <div>PHOTO</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Session Banner */}
                <div style={{ background: '#fde047', border: '1.5px solid #dc2626', textAlign: 'center', fontWeight: 'bold', fontSize: '11px', padding: '3px', marginBottom: '4px', color: '#1e1e1e' }}>
                  EXAMS REPORT SHEET - for Session/Yr: _ {session?.start_year} _ /_{session?.end_year}____
                </div>

                {/* Student Info Grid */}
                <div style={{ border: '1.5px solid #dc2626', marginBottom: '4px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', borderBottom: '1px solid #dc2626' }}>
                      <div style={{ padding: '2px 4px', borderRight: '1px solid #dc2626', width: '75px' }}></div>
                    <div style={{ padding: '2px 4px', borderRight: '1px solid #dc2626', textAlign: 'center', fontWeight: 'bold', fontSize: '8px', background: '#fee2e2' }}>FIRST NAME</div>
                    <div style={{ padding: '2px 4px', borderRight: '1px solid #dc2626', textAlign: 'center', fontWeight: 'bold', fontSize: '8px', background: '#fee2e2' }}>MIDDLE NAME</div>
                    <div style={{ padding: '2px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '8px', background: '#fee2e2' }}>SURNAME</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', borderBottom: '1px solid #dc2626' }}>
                    <div style={{ padding: '2px 4px', borderRight: '1px solid #dc2626', fontWeight: 'bold', fontSize: '8px', whiteSpace: 'nowrap' }}>NAME OF PUPIL :</div>
                    <div style={{ padding: '2px 4px', borderRight: '1px solid #dc2626', fontWeight: 'bold', fontSize: '9px', textAlign: 'center', color: '#1e40af' }}>{student.first_name}</div>
                    <div style={{ padding: '2px 4px', borderRight: '1px solid #dc2626', fontWeight: 'bold', fontSize: '9px', textAlign: 'center', color: '#1e40af' }}>{student.middle_name || '—'}</div>
                    <div style={{ padding: '2px 4px', fontWeight: 'bold', fontSize: '9px', textAlign: 'center', color: '#1e40af' }}>{student.last_name}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr auto auto 1fr', borderBottom: '1px solid #dc2626', fontSize: '8px' }}>
                    <div style={{ padding: '2px 4px', borderRight: '1px solid #dc2626', fontWeight: 'bold', whiteSpace: 'nowrap' }}>YEAR / CLASS / ARM :</div>
                    <div style={{ padding: '2px 4px', borderRight: '1px solid #dc2626', color: '#1e40af', fontWeight: 'bold', minWidth: '60px' }}>{student.class_name}</div>
                    <div style={{ padding: '2px 4px', borderRight: '1px solid #dc2626' }}></div>
                    <div style={{ padding: '2px 4px', borderRight: '1px solid #dc2626', fontWeight: 'bold', whiteSpace: 'nowrap' }}>ADM.YR :</div>
                    <div style={{ padding: '2px 4px', color: '#1e40af', fontWeight: 'bold' }}>{student.admission_year || '—'}</div>
                    <div></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto auto 1fr auto auto', fontSize: '8px', borderBottom: '1px solid #dc2626' }}>
                    <div style={{ padding: '2px 4px', borderRight: '1px solid #dc2626', fontWeight: 'bold', whiteSpace: 'nowrap' }}>NO. IN CLASS :</div>
                    <div style={{ padding: '2px 4px', borderRight: '1px solid #dc2626', color: '#1e40af', fontWeight: 'bold' }}>{termData[1]?.classSize || '—'}</div>
                    <div style={{ padding: '2px 4px', borderRight: '1px solid #dc2626', fontWeight: 'bold' }}>AGE:</div>
                    <div style={{ padding: '2px 4px', borderRight: '1px solid #dc2626', color: '#1e40af', fontWeight: 'bold' }}>{getAge(student.date_of_birth) ? `${getAge(student.date_of_birth)} Yrs` : '—'}</div>
                    <div style={{ padding: '2px 4px', borderRight: '1px solid #dc2626', fontWeight: 'bold' }}>BIRTH DATE:</div>
                    <div style={{ padding: '2px 4px', borderRight: '1px solid #dc2626', color: '#1e40af', fontWeight: 'bold' }}>{student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : '—'}</div>
                    <div></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto auto', fontSize: '8px' }}>
                    <div style={{ padding: '2px 4px', borderRight: '1px solid #dc2626', fontWeight: 'bold', whiteSpace: 'nowrap' }}>ADMISSION No :</div>
                    <div style={{ padding: '2px 4px', borderRight: '1px solid #dc2626', color: '#1e40af', fontWeight: 'bold' }}>{student.admission_number || '—'}</div>
                    <div style={{ padding: '2px 4px', borderRight: '1px solid #dc2626', fontWeight: 'bold' }}>ADMISSION YR:</div>
                    <div style={{ padding: '2px 4px', color: '#1e40af', fontWeight: 'bold' }}>{student.admission_year || '—'}</div>
                  </div>
                </div>

                {/* Term Overall Scores */}
                <div style={{ display: 'grid', gridTemplateColumns: format === 'single' ? '1fr' : 'repeat(3, 1fr)', gap: '3px', marginBottom: '3px' }}>
                  {(format === 'cumulative' ? [1, 2, 3] : [termParam]).map(term => (
                    <div key={term} style={{ border: '1.5px solid #dc2626', textAlign: 'center', padding: '2px', background: termData[term]?.overallPercentage ? '#eff6ff' : '#f9fafb' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '7px', color: '#1e40af' }}>{ordinal(term)} TERM OVERALL SCORE:</div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px', color: (termData[term]?.overallPercentage || 0) >= 70 ? '#166534' : '#dc2626' }}>
                        {termData[term]?.overallPercentage ?? ''}%
                      </div>
                    </div>
                  ))}
                </div>

                {/* MAIN SCORES TABLE */}
                <div style={{ border: '1.5px solid #dc2626', overflow: 'hidden', marginBottom: '3px', width: '100%' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5px' }}>
                    <thead>
                      <tr style={{ background: '#fee2e2' }}>
                        <td rowSpan={2} style={{ padding: '2px 3px', fontWeight: 'bold', border: '1px solid #fca5a5', width: '70px', fontSize: '8px', color: '#991b1b' }}>SUBJECTS</td>
                        {/* Primary Term (Dynamic) */}
                        <td colSpan={6} style={{ padding: '1px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #fca5a5', background: activeTermBg, color: '#1e40af', fontSize: '7px' }}>{activeTermLabel}</td>
                        {/* Remaining terms only if cumulative */}
                        {format === 'cumulative' && (
                          <>
                            <td colSpan={6} style={{ padding: '1px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #fca5a5', background: '#f0f9ff', color: '#1e40af', fontSize: '7px' }}>2nd TERM</td>
                            <td colSpan={3} style={{ padding: '1px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #fca5a5', background: '#f0fdf4', color: '#166534', fontSize: '7px' }}>CUM(1&2)</td>
                            <td colSpan={6} style={{ padding: '1px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #fca5a5', background: '#fafaf0', color: '#1e40af', fontSize: '7px' }}>3rd TERM</td>
                            <td colSpan={3} style={{ padding: '1px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #fca5a5', background: '#f0fdf4', color: '#166534', fontSize: '7px' }}>CUMULATIVE</td>
                          </>
                        )}
                      </tr>
                      <tr style={{ background: '#fff7f7', fontSize: '6.5px' }}>
                        {/* Primary Term cols */}
                        <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold', whiteSpace: 'nowrap' }}>C.A</td>
                        <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Exam</td>
                        <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Total</td>
                        <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Ave</td>
                        <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Pos</td>
                        <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Grd</td>
                        {format === 'cumulative' && (
                          <>
                            {/* 2nd Term cols */}
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>C.A</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Exam</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Total</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Ave</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Pos</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Grd</td>
                            {/* Cum 1&2 */}
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Total</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Ave</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Grd</td>
                            {/* 3rd Term cols */}
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>C.A</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Exam</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Total</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Ave</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Pos</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Grd</td>
                            {/* Final Cum */}
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Total</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Ave</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold' }}>Grd</td>
                          </>
                        )}
                      </tr>
                      <tr style={{ background: '#fee2e2', fontSize: '7px', fontWeight: 'bold', color: '#991b1b' }}>
                        <td style={{ padding: '1px 3px', border: '1px solid #fca5a5' }}>Marks Obtainable</td>
                        <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5' }}>{(maxVals.ca1 || 0) + (maxVals.ca2 || 0)}</td>
                        <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5' }}>{maxVals.exam || 0}</td>
                        <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5' }}>100</td>
                        <td colSpan={3} style={{ border: '1px solid #fca5a5' }}></td>
                        {format === 'cumulative' && (
                          <>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5' }}>{(maxVals.ca1 || 0) + (maxVals.ca2 || 0)}</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5' }}>{maxVals.exam || 0}</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5' }}>100</td>
                            <td colSpan={2} style={{ border: '1px solid #fca5a5' }}></td>
                            <td style={{ border: '1px solid #fca5a5' }}></td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5' }}>100</td>
                            <td colSpan={2} style={{ border: '1px solid #fca5a5' }}></td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5' }}>{(maxVals.ca1 || 0) + (maxVals.ca2 || 0)}</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5' }}>{maxVals.exam || 0}</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5' }}>100</td>
                            <td colSpan={2} style={{ border: '1px solid #fca5a5' }}></td>
                            <td style={{ border: '1px solid #fca5a5' }}></td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5' }}>100</td>
                            <td colSpan={2} style={{ border: '1px solid #fca5a5' }}></td>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {subjectCumulative.map((row: any, idx: number) => {
                        const t1 = row.term1;
                        const t2 = row.term2;
                        const t3 = row.term3;
                        const ta = format === 'single' ? (activeTerm === 1 ? t1 : activeTerm === 2 ? t2 : t3) : t1;
                        const hasData = t1 || t2 || t3;
                        return (
                          <tr key={row.subjectId} style={{ background: idx % 2 === 0 ? '#ffffff' : '#fef9f9', borderBottom: '1px solid #fee2e2' }}>
                            <td style={{ padding: '1.5px 3px', fontWeight: '600', border: '1px solid #fca5a5', fontSize: '7.5px', color: '#1e1e1e' }}>{row.subjectName}</td>
                            {/* Primary Term (Dynamic) */}
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', color: '#374151' }}>{(ta?.ca1_score || 0) + (ta?.ca2_score || 0) || ''}</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', color: '#374151' }}>{ta?.exam_score || ''}</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold', color: '#1e1e1e' }}>{ta?.total || ''}</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontSize: '7px', color: '#6b7280' }}>{ta?.class_average !== undefined && ta?.class_average !== null ? Number(ta.class_average).toFixed(1) : ''}</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontSize: '7px' }}>{ta?.position ? ordinal(ta.position) : ''}</td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold', color: ta ? getGradeColor(ta.grade) : '#374151' }}>{ta?.grade || ''}</td>
                            
                            {format === 'cumulative' && (
                              <>
                                {/* 2nd Term */}
                                <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', color: '#374151' }}>{(t2?.ca1_score || 0) + (t2?.ca2_score || 0) || ''}</td>
                                <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', color: '#374151' }}>{t2?.exam_score || ''}</td>
                                <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold', color: '#1e1e1e' }}>{t2?.total || ''}</td>
                                <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontSize: '7px', color: '#6b7280' }}>{t2?.class_average !== undefined && t2?.class_average !== null ? Number(t2.class_average).toFixed(1) : ''}</td>
                                <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontSize: '7px' }}>{t2?.position ? ordinal(t2.position) : ''}</td>
                                <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold', color: t2 ? getGradeColor(t2.grade) : '#374151' }}>{t2?.grade || ''}</td>
                                {/* Cum 1+2 - Using student's average in 'Total' column as requested */}
                                <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold', background: '#f0fdf4', color: '#166534' }}>{(termParam >= 2 && (t1 || t2)) ? row.cum12Ave : ''}</td>
                                <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', background: '#f0fdf4', color: '#166534' }}>{(termParam >= 2 && (t1 || t2)) ? row.class12Ave : ''}</td>
                                <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold', background: '#f0fdf4', color: (termParam >= 2 && (t1 || t2)) ? getGradeColor(row.cum12Grade) : '#374151' }}>{(termParam >= 2 && (t1 || t2)) ? row.cum12Grade : ''}</td>
                                {/* 3rd Term */}
                                <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', color: '#374151' }}>{(t3?.ca1_score || 0) + (t3?.ca2_score || 0) || ''}</td>
                                <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', color: '#374151' }}>{t3?.exam_score || ''}</td>
                                <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold', color: '#1e1e1e' }}>{t3?.total || ''}</td>
                                <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontSize: '7px', color: '#6b7280' }}>{t3?.class_average !== undefined && t3?.class_average !== null ? Number(t3.class_average).toFixed(1) : ''}</td>
                                <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontSize: '7px' }}>{t3?.position ? ordinal(t3.position) : ''}</td>
                                <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold', color: t3 ? getGradeColor(t3.grade) : '#374151' }}>{t3?.grade || ''}</td>
                                {/* Final Cumulative - Using student's average in 'Total' column as requested */}
                                <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold', background: '#f0fdf4', color: '#166534' }}>{(termParam >= 3 && hasData) ? row.cumAve : ''}</td>
                                <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', background: '#f0fdf4', color: '#166534' }}>{(termParam >= 3 && hasData) ? row.classFinalAve : ''}</td>
                                <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 'bold', background: '#f0fdf4', color: (termParam >= 3 && hasData) ? getGradeColor(row.cumGrade) : '#374151' }}>{(termParam >= 3 && hasData) ? row.cumGrade : ''}</td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                      {/* TOTAL ROW */}
                      <tr style={{ background: '#1e3a8a', color: 'white', fontWeight: 'bold' }}>
                        <td style={{ padding: '2px 3px', border: '1px solid #3b82f6', fontSize: '8px' }}>TOTAL</td>
                        <td colSpan={2} style={{ border: '1px solid #3b82f6' }}></td>
                        <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #3b82f6', fontSize: '8px' }}>{termData[activeTerm]?.total || ''}</td>
                        <td colSpan={2} style={{ border: '1px solid #3b82f6' }}></td>
                        <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #3b82f6', fontSize: '8px', color: '#fde047' }}>{termData[activeTerm]?.overallPosition ? ordinal(termData[activeTerm].overallPosition) : ''}</td>
                        
                        {format === 'cumulative' && (
                          <>
                            <td colSpan={2} style={{ border: '1px solid #3b82f6' }}></td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #3b82f6', fontSize: '8px' }}>{termData[2]?.total || ''}</td>
                            <td colSpan={2} style={{ border: '1px solid #3b82f6' }}></td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #3b82f6', fontSize: '8px', color: '#fde047' }}>{termData[2]?.overallPosition ? ordinal(termData[2].overallPosition) : ''}</td>
                            <td colSpan={3} style={{ border: '1px solid #3b82f6' }}></td>
                            <td colSpan={3} style={{ border: '1px solid #3b82f6' }}></td>
                            <td style={{ padding: '1px 2px', textAlign: 'center', border: '1px solid #3b82f6', fontSize: '8px' }}>{termData[3]?.total || ''}</td>
                            <td colSpan={2} style={{ border: '1px solid #3b82f6' }}></td>
                            <td colSpan={3} style={{ border: '1px solid #3b82f6' }}></td>
                          </>
                        )}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Traits and Attendance Section */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  {/* Behavioural Assessment */}
                  <div style={{ border: '1.5px solid #dc2626' }}>
                    <div style={{ background: '#fee2e2', padding: '2px', textAlign: 'center', fontWeight: 'bold', fontSize: '8px', borderBottom: '1.5px solid #dc2626', color: '#991b1b' }}>
                      BEHAVIOURAL ASSESSMENT
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7px' }}>
                      <thead>
                        <tr style={{ background: '#fff7f7' }}>
                          <th style={{ border: '1px solid #fca5a5', padding: '1px 3px', textAlign: 'left' }}>TRAIT</th>
                          <th style={{ border: '1px solid #fca5a5', padding: '1px', width: '25px' }}>1st</th>
                          <th style={{ border: '1px solid #fca5a5', padding: '1px', width: '25px' }}>2nd</th>
                          <th style={{ border: '1px solid #fca5a5', padding: '1px', width: '25px' }}>3rd</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { key: 'punctuality', label: 'Punctuality' },
                          { key: 'neatness', label: 'Neatness' },
                          { key: 'politeness', label: 'Politeness' },
                          { key: 'honesty', label: 'Honesty' },
                          { key: 'cooperation', label: 'Cooperation' },
                          { key: 'leadership', label: 'Leadership' },
                          { key: 'attentiveness', label: 'Attentiveness' }
                        ].map(t => (
                          <tr key={t.key}>
                            <td style={{ border: '1px solid #fca5a5', padding: '1px 3px' }}>{t.label}</td>
                            <td style={{ border: '1px solid #fca5a5', textAlign: 'center', fontWeight: 'bold' }}>{traits[1]?.[t.key] || '-'}</td>
                            <td style={{ border: '1px solid #fca5a5', textAlign: 'center', fontWeight: 'bold' }}>{traits[2]?.[t.key] || '-'}</td>
                            <td style={{ border: '1px solid #fca5a5', textAlign: 'center', fontWeight: 'bold' }}>{traits[3]?.[t.key] || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Attendance Section */}
                  <div style={{ border: '1.5px solid #dc2626' }}>
                    <div style={{ background: '#fee2e2', padding: '2px', textAlign: 'center', fontWeight: 'bold', fontSize: '8px', borderBottom: '1.5px solid #dc2626', color: '#991b1b' }}>
                      ATTENDANCE RECORD
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7px' }}>
                      <thead>
                        <tr style={{ background: '#fff7f7' }}>
                          <th style={{ border: '1px solid #fca5a5', padding: '1px 3px', textAlign: 'left' }}>TERM</th>
                          <th style={{ border: '1px solid #fca5a5', padding: '1px' }}>Present</th>
                          <th style={{ border: '1px solid #fca5a5', padding: '1px' }}>Absent</th>
                          <th style={{ border: '1px solid #fca5a5', padding: '1px' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[1, 2, 3].map(t => (
                          <tr key={t}>
                            <td style={{ border: '1px solid #fca5a5', padding: '1px 3px', fontWeight: 'bold' }}>{ordinal(t)} Term</td>
                            <td style={{ border: '1px solid #fca5a5', textAlign: 'center' }}>{attendance[t]?.days_present || '0'}</td>
                            <td style={{ border: '1px solid #fca5a5', textAlign: 'center' }}>{attendance[t]?.days_absent || '0'}</td>
                            <td style={{ border: '1px solid #fca5a5', textAlign: 'center', fontWeight: 'bold' }}>{attendance[t]?.total_days || '0'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ padding: '4px', fontSize: '6.5px', color: '#4b5563', borderTop: '1px solid #fca5a5', background: '#fef9f9' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '2px', textDecoration: 'underline' }}>TRAIT RATING KEY:</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
                        <div>5 - Excellent</div>
                        <div>4 - Very Good</div>
                        <div>3 - Good</div>
                        <div>2 - Fair</div>
                        <div>1 - Poor</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grading Scale */}
                <div style={{ fontSize: '6.5px', textAlign: 'center', color: '#374151', marginBottom: '3px', lineHeight: 1.5, border: '1px solid #fee2e2', padding: '2px', background: '#fef9f9' }}>
                  <strong>95-100 = A+ (Distinction), 90-94 = A (Super Performance), 87-89 = B+ (Very High), 83-86 = B (High),</strong><br />
                  80-82 = B- (Good), 77-79 = C+ (High Credit), 73-76 = C (Credit), 70-72 = C- (Average), 67-69 = D+ (Good Pass),<br />
                  63-66 = D (Very Good Pass), 60-62 = D- (Good Pass), Below 59 = F (Fail)
                </div>

                {/* Comments Section */}
                <div style={{ display: 'grid', gridTemplateColumns: format === 'single' ? '1fr' : 'repeat(3, 1fr)', gap: '3px', marginBottom: '3px' }}>
                    {(format === 'cumulative' ? [1, 2, 3] : [termParam]).map(term => (
                    <div key={term} style={{ border: '1.5px solid #dc2626', padding: '4px', fontSize: '7.5px' }}>
                      <div style={{ fontWeight: 'bold', color: '#1e40af', marginBottom: '2px', fontSize: '7px', borderBottom: '1px solid #fca5a5', paddingBottom: '1px' }}>
                        Class Teacher's Comment:
                      </div>
                      {editComments ? (
                        <textarea
                          value={comments[term]?.class_teacher_comment || ''}
                          onChange={e => setComments(prev => ({ ...prev, [term]: { ...prev[term], class_teacher_comment: e.target.value } }))}
                          style={{ width: '100%', fontSize: '7px', border: '1px solid #ccc', padding: '2px', minHeight: '35px', resize: 'none' }}
                          placeholder="Enter teacher comment..."
                        />
                      ) : (
                        <div style={{ fontSize: '7.5px', color: '#374151', minHeight: '35px', lineHeight: 1.4 }}>
                          {comments[term]?.class_teacher_comment || ''}
                        </div>
                      )}
                      <div style={{ marginTop: '3px', fontSize: '6.5px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>Signature:</span>
                            {comments[term]?.class_teacher_signature ? (
                              <img 
                                src={comments[term].class_teacher_signature} 
                                alt="Signature" 
                                style={{ height: '30px', maxWidth: '60px', objectFit: 'contain' }}
                              />
                            ) : (
                              <span>___________</span>
                            )}
                          </div>
                          {editComments ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <label style={{ background: '#3b82f6', color: 'white', padding: '1px 3px', borderRadius: '2px', fontSize: '5px', cursor: 'pointer' }}>
                                Upload
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onload = (evt) => {
                                        const base64 = evt.target?.result as string;
                                        setComments(prev => ({ ...prev, [term]: { ...prev[term], class_teacher_signature: base64 } }));
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }} 
                                />
                              </label>
                              <input type="text" placeholder="Date" value={comments[term]?.class_teacher_date || ''} onChange={e => setComments(prev => ({ ...prev, [term]: { ...prev[term], class_teacher_date: e.target.value } }))} style={{ width: '45px', fontSize: '6px', border: '1px solid #ccc' }} />
                            </div>
                          ) : (
                            <span>Date: {comments[term]?.class_teacher_date || ''}</span>
                          )}
                        </div>
                        {/*<div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{classTeacher?.name || '—'}</div>*/}
                      </div>
                      <div style={{ marginTop: '4px', fontWeight: 'bold', color: '#1e40af', fontSize: '7px', borderTop: '1px solid #fca5a5', paddingTop: '2px', marginBottom: '2px' }}>
                        Coordinator's Remarks:
                      </div>
                      {editComments ? (
                        <textarea
                          value={comments[term]?.coordinator_remark || ''}
                          onChange={e => setComments(prev => ({ ...prev, [term]: { ...prev[term], coordinator_remark: e.target.value } }))}
                          readOnly={user?.role === 'teacher'}
                          style={{ width: '100%', fontSize: '7px', border: '1px solid #ccc', padding: '2px', minHeight: '28px', resize: 'none', opacity: user?.role === 'teacher' ? 0.7 : 1 }}
                          placeholder={user?.role === 'teacher' ? 'Admin only' : 'Coordinator remark...'}
                        />
                      ) : (
                        <div style={{ fontSize: '7.5px', color: '#374151', minHeight: '28px', lineHeight: 1.4 }}>
                          {comments[term]?.coordinator_remark || ''}
                        </div>
                      )}
                      <div style={{ marginTop: '2px', fontSize: '6.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>Signature:</span>
                          {comments[term]?.coordinator_signature ? (
                            <img 
                              src={comments[term].coordinator_signature} 
                              alt="Signature" 
                              style={{ height: '30px', maxWidth: '90px', objectFit: 'contain' }}
                            />
                          ) : (
                            <span>___________</span>
                          )}
                        </div>
                        {editComments ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {user?.role !== 'teacher' && (
                              <label style={{ background: '#3b82f6', color: 'white', padding: '1px 3px', borderRadius: '2px', fontSize: '5px', cursor: 'pointer' }}>
                                Upload
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onload = (evt) => {
                                        const base64 = evt.target?.result as string;
                                        setComments(prev => ({ ...prev, [term]: { ...prev[term], coordinator_signature: base64 } }));
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }} 
                                />
                              </label>
                            )}
                            <input 
                              type="text" 
                              placeholder="Date" 
                              value={comments[term]?.coordinator_date || ''} 
                              onChange={e => setComments(prev => ({ ...prev, [term]: { ...prev[term], coordinator_date: e.target.value } }))} 
                              readOnly={user?.role === 'teacher'}
                              style={{ width: '45px', fontSize: '6px', border: '1px solid #ccc', opacity: user?.role === 'teacher' ? 0.7 : 1 }} 
                            />
                          </div>
                        ) : (
                          <span>Date: {comments[term]?.coordinator_date || ''}</span>
                        )}
                      </div>
                      <div style={{ marginTop: '3px', fontSize: '6.5px', borderTop: '1px solid #fca5a5', paddingTop: '2px' }}>
                        {editComments ? (
                          <div>
                            <span style={{ fontWeight: 'bold' }}>Next Term Starts:</span>
                            <input type="text" value={comments[term]?.next_term_starts || ''} onChange={e => setComments(prev => ({ ...prev, [term]: { ...prev[term], next_term_starts: e.target.value } }))} style={{ width: '80px', fontSize: '6px', border: '1px solid #ccc', marginLeft: '3px' }} />
                          </div>
                        ) : (
                          <span>{term === 1 ? '2nd' : term === 2 ? '3rd' : 'Next Session'} Term Starts: <strong>{comments[term]?.next_term_starts || '_______________'}</strong></span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Save button in edit mode */}
                {editComments && (
                  <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                    <button onClick={() => { [1,2,3].filter(t => format === 'cumulative' ? t <= termParam : t === termParam).forEach(t => saveComments(t)); }} disabled={saving}
                      style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 16px', fontSize: '9px', cursor: 'pointer', fontWeight: 'bold' }}>
                      {saving ? 'Saving...' : '💾 Save All Comments'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; background: white; }
          #report-card { box-shadow: none !important; width: 100% !important; height: auto !important; min-height: 0 !important; }
          @page { 
            size: A4 ${format === 'single' ? 'portrait' : 'landscape'}; 
            margin: 3mm; 
          }
        }
      `}</style>
    </div>
  );
}

export default function ReportCardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>}>
      <ReportCardContent />
    </Suspense>
  );
}
                                                                                                                                                                                                                                                                                                                                                                                