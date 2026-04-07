'use client';
import { useState, useEffect } from 'react';
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

function BroadsheetContent() {
  const searchParams = useSearchParams();
  const classId = searchParams.get('classId');
  const sessionId = searchParams.get('sessionId');
  const term = searchParams.get('term') || '1';
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (classId && sessionId) {
      fetch('/api/auth/me').then(r => r.json()).then(me => {
        fetch(`/api/reports/broadsheet?classId=${classId}&sessionId=${sessionId}&term=${term}&schoolId=${me.user.school_id}`)
          .then(r => r.json()).then(d => { setData(d); setLoading(false); });
      });
    }
  }, [classId, sessionId, term]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p>Loading broadsheet...</p></div>
    </div>
  );
  if (!data) return <div className="min-h-screen flex items-center justify-center"><p className="text-red-600">No data found</p></div>;

  const { school, session, class: classInfo, classTeacher, subjects, broadsheet, classSize } = data;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Toolbar */}
      <div className="no-print bg-white border-b shadow-sm px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="btn-secondary text-sm">← Back</button>
          <span className="text-gray-600 font-medium">{classInfo?.name} — {ordinal(parseInt(term))} Term Broadsheet</span>
        </div>
        <button onClick={() => window.print()} className="btn-primary text-sm flex items-center gap-2">🖨️ Print / PDF</button>
      </div>

      <div className="p-4">
        <div className="bg-white shadow-lg overflow-x-auto" id="broadsheet" style={{ fontFamily: 'Arial, sans-serif', fontSize: '8px' }}>
          <div style={{ border: '2px solid #dc2626', padding: '8px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '8px' }}>
              {school?.logo_url && (
                <img src={school.logo_url} alt="Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
              )}
              <div style={{ textAlign: 'center' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e40af', margin: 0 }}>{school?.name}</h1>
                <p style={{ fontSize: '9px', color: '#374151', margin: '2px 0' }}>{school?.address}</p>
                <p style={{ fontSize: '9px', color: '#374151', margin: '2px 0' }}>Tel: {school?.phone}</p>
              </div>
            </div>
            <div style={{ background: '#fde047', border: '1.5px solid #dc2626', textAlign: 'center', fontWeight: 'bold', fontSize: '12px', padding: '4px', marginBottom: '8px' }}>
              CLASS BROADSHEET — {ordinal(parseInt(term))} TERM — Session: {session?.name} — Class: {classInfo?.name} {classInfo?.arm}
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', fontSize: '9px' }}>
              <span><strong>Total Students:</strong> {classSize}</span>
              <span><strong>Total Subjects:</strong> {subjects?.length}</span>
              <span><strong>Term:</strong> {ordinal(parseInt(term))}</span>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5px' }}>
                <thead>
                  <tr style={{ background: '#1e3a8a', color: 'white' }}>
                    <th style={{ padding: '4px 3px', border: '1px solid #3b82f6', textAlign: 'left', minWidth: '20px' }}>#</th>
                    <th style={{ padding: '4px 3px', border: '1px solid #3b82f6', textAlign: 'left', minWidth: '100px' }}>Student Name</th>
                    <th style={{ padding: '4px 3px', border: '1px solid #3b82f6', minWidth: '65px' }}>Adm. No.</th>
                    {subjects?.map((s: any) => (
                      <th key={s.id} style={{ padding: '4px 2px', border: '1px solid #3b82f6', textAlign: 'center', minWidth: '45px', writingMode: 'vertical-lr', transform: 'rotate(180deg)', height: '70px', verticalAlign: 'bottom' }}>
                        {s.name}
                      </th>
                    ))}
                    <th style={{ padding: '4px 3px', border: '1px solid #3b82f6', textAlign: 'center', minWidth: '50px' }}>Total</th>
                    <th style={{ padding: '4px 3px', border: '1px solid #3b82f6', textAlign: 'center', minWidth: '45px' }}>Average</th>
                    <th style={{ padding: '4px 3px', border: '1px solid #3b82f6', textAlign: 'center', minWidth: '35px' }}>Position</th>
                  </tr>
                </thead>
                <tbody>
                  {broadsheet?.sort((a: any, b: any) => a.position - b.position).map((row: any, idx: number) => (
                    <tr key={row.student.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8faff', borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '3px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280' }}>{idx + 1}</td>
                      <td style={{ padding: '3px 4px', border: '1px solid #e5e7eb', fontWeight: '600', color: '#111827' }}>
                        {row.student.last_name}, {row.student.first_name} {row.student.middle_name}
                      </td>
                      <td style={{ padding: '3px', border: '1px solid #e5e7eb', textAlign: 'center', fontFamily: 'monospace', fontSize: '7px', color: '#1d4ed8' }}>
                        {row.student.admission_number || '—'}
                      </td>
                      {subjects?.map((s: any) => {
                        const sc = row.scores[s.id];
                        return (
                          <td key={s.id} style={{ padding: '3px 2px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                            {sc ? (
                              <div>
                                <div style={{ fontWeight: 'bold', color: getGradeColor(sc.grade) }}>{sc.total}</div>
                                <div style={{ fontSize: '6px', color: getGradeColor(sc.grade) }}>{sc.grade}</div>
                              </div>
                            ) : <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                        );
                      })}
                      <td style={{ padding: '3px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold', color: '#1e40af', background: '#eff6ff' }}>
                        {row.grandTotal.toFixed(1)}
                      </td>
                      <td style={{ padding: '3px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold', color: '#1e40af', background: '#eff6ff' }}>
                        {row.average.toFixed(1)}
                      </td>
                      <td style={{ padding: '3px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold', background: row.position === 1 ? '#fef3c7' : row.position === 2 ? '#f3f4f6' : row.position === 3 ? '#fef3c7' : '#ffffff' }}>
                        {ordinal(row.position)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Subject averages footer */}
                <tfoot>
                  <tr style={{ background: '#1e3a8a', color: 'white', fontWeight: 'bold' }}>
                    <td colSpan={3} style={{ padding: '3px 4px', border: '1px solid #3b82f6', fontSize: '8px' }}>CLASS AVERAGE</td>
                    {subjects?.map((s: any) => {
                      const scores = broadsheet?.map((r: any) => r.scores[s.id]?.total || 0).filter((t: number) => t > 0);
                      const avg = scores?.length ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1) : '—';
                      return (
                        <td key={s.id} style={{ padding: '3px 2px', border: '1px solid #3b82f6', textAlign: 'center' }}>{avg}</td>
                      );
                    })}
                    <td style={{ border: '1px solid #3b82f6' }}></td>
                    <td style={{ border: '1px solid #3b82f6' }}></td>
                    <td style={{ border: '1px solid #3b82f6' }}></td>
                  </tr>
                  <tr style={{ background: '#dc2626', color: 'white', fontWeight: 'bold' }}>
                    <td colSpan={3} style={{ padding: '3px 4px', border: '1px solid #fca5a5', fontSize: '8px' }}>HIGHEST SCORE</td>
                    {subjects?.map((s: any) => {
                      const scores = broadsheet?.map((r: any) => r.scores[s.id]?.total || 0);
                      const max = scores?.length ? Math.max(...scores).toFixed(1) : '—';
                      return <td key={s.id} style={{ padding: '3px 2px', border: '1px solid #fca5a5', textAlign: 'center' }}>{max}</td>;
                    })}
                    <td style={{ border: '1px solid #fca5a5' }}></td>
                    <td style={{ border: '1px solid #fca5a5' }}></td>
                    <td style={{ border: '1px solid #fca5a5' }}></td>
                  </tr>
                  <tr style={{ background: '#374151', color: 'white', fontWeight: 'bold' }}>
                    <td colSpan={3} style={{ padding: '3px 4px', border: '1px solid #6b7280', fontSize: '8px' }}>LOWEST SCORE</td>
                    {subjects?.map((s: any) => {
                      const scores = broadsheet?.map((r: any) => r.scores[s.id]?.total || 0).filter((t: number) => t > 0);
                      const min = scores?.length ? Math.min(...scores).toFixed(1) : '—';
                      return <td key={s.id} style={{ padding: '3px 2px', border: '1px solid #6b7280', textAlign: 'center' }}>{min}</td>;
                    })}
                    <td style={{ border: '1px solid #6b7280' }}></td>
                    <td style={{ border: '1px solid #6b7280' }}></td>
                    <td style={{ border: '1px solid #6b7280' }}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Grade Scale */}
            <div style={{ marginTop: '8px', fontSize: '7px', textAlign: 'center', color: '#374151', border: '1px solid #fca5a5', padding: '4px', background: '#fef9f9' }}>
              <strong>95-100 = A+ (Distinction) | 90-94 = A (Super Performance) | 87-89 = B+ (Very High) | 83-86 = B (High) | 80-82 = B- (Good) | 77-79 = C+ (High Credit)</strong><br />
              73-76 = C (Credit) | 70-72 = C- (Average) | 67-69 = D+ (Good Pass) | 63-66 = D (Very Good Pass) | 60-62 = D- (Good Pass) | Below 59 = F (Fail)
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; background: white; }
          #broadsheet { box-shadow: none !important; }
          @page { size: A3 landscape; margin: 5mm; }
        }
        .btn-secondary { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 14px; }
        .btn-primary { background: #1d4ed8; color: white; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 14px; }
      `}</style>
    </div>
  );
}

export default function BroadsheetPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>}>
      <BroadsheetContent />
    </Suspense>
  );
}