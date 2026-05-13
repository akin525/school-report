'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { parseQuestionsFromText } from '@/lib/question-parser';
import jsPDF from 'jspdf';

export default function QuestionBankPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [teacher, setTeacher] = useState<any>(null);
  const [school, setSchool] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('1');
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [uploadResults, setUploadResults] = useState<any[]>([]);

  const updateUploadResult = (index: number, field: string, value: any) => {
    setUploadResults(prev => prev.map((q, i) =>
      i === index ? { ...q, [field]: value } : q
    ));
  };

  // Form state for manual question creation
  const [formData, setFormData] = useState({
    questionText: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: '',
    marks: 1,
    topic: '',
    difficulty: 'medium'
  });

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.error || !d.user) {
        router.push('/login');
        return;
      }
      setUser(d.user);
      setSchool(d.school);
      setTeacher(d.teacher);
      const sid = d.user.school_id;
      
      fetch(`/api/sessions?schoolId=${sid}`).then(r => r.json()).then(sess => {
        setSessions(sess);
        const curr = sess.find((s: any) => s.is_current) || sess[0];
        if (curr) setSelectedSession(curr.id);
      });
      
      // Fetch teacher assignments to filter classes and subjects
      fetch(`/api/teacher-assignments?schoolId=${sid}`).then(r => r.json()).then(assignments => {
        setTeacherAssignments(assignments);
        
        // If user is admin or no assignments, fetch all classes and subjects
        if (d.user.role === 'superadmin' || d.user.role === 'school_admin' || assignments.length === 0) {
          fetch(`/api/classes?schoolId=${sid}`).then(r => r.json()).then(cls => setClasses(cls));
          fetch(`/api/subjects?schoolId=${sid}`).then(r => r.json()).then(subjs => setSubjects(subjs));
        } else {
          // Extract unique classes from assignments
          const uniqueClasses = assignments.reduce((acc: any[], assignment: any) => {
            if (!acc.find((c: any) => c.id === assignment.class_id)) {
              acc.push({
                id: assignment.class_id,
                name: assignment.class_name,
                arm: assignment.class_arm
              });
            }
            return acc;
          }, []);
          setClasses(uniqueClasses);
          
          // Extract unique subjects from assignments
          const uniqueSubjects = assignments.reduce((acc: any[], assignment: any) => {
            if (assignment.subject_id && !acc.find((s: any) => s.id === assignment.subject_id)) {
              acc.push({
                id: assignment.subject_id,
                name: assignment.subject_name
              });
            }
            return acc;
          }, []);
          setSubjects(uniqueSubjects);
        }
      });
      
      // Only fetch all teachers if user is admin
      if (d.user.role === 'superadmin' || d.user.role === 'school_admin') {
        fetch(`/api/teachers?schoolId=${sid}`).then(r => r.json()).then(tch => setTeachers(tch));
      } else {
        // For teachers, only show themselves
        setTeachers([{
          id: d.teacher?.id || d.user.id,
          name: d.user.name
        }]);
      }
    });
  }, [router]);

  useEffect(() => {
    // Filter subjects based on selected class from teacher assignments or fetch all subjects
    if (selectedClass) {
      if (teacherAssignments.length > 0 && user?.role !== 'superadmin' && user?.role !== 'school_admin') {
        // Filter subjects based on teacher assignments
        const classSubjects = teacherAssignments
          .filter(assignment => assignment.class_id === selectedClass && assignment.subject_id)
          .reduce((acc: any[], assignment: any) => {
            if (!acc.find((s: any) => s.id === assignment.subject_id)) {
              acc.push({
                id: assignment.subject_id,
                name: assignment.subject_name
              });
            }
            return acc;
          }, []);
        setSubjects(classSubjects);
        if (classSubjects.length > 0) setSelectedSubject(classSubjects[0].id);
        else setSelectedSubject('');
      } else {
        // Fetch all subjects for the selected class (admin or no assignments)
        fetch(`/api/subjects?classId=${selectedClass}`).then(r => r.json()).then(subjs => setSubjects(subjs));
      }
    }
  }, [selectedClass, teacherAssignments, user]);

  useEffect(() => {
    loadQuestions();
  }, [selectedSession, selectedClass, selectedSubject, selectedTeacher, selectedTerm]);

  const loadQuestions = async () => {
    if (!user?.school_id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        schoolId: user.school_id,
        ...(selectedTeacher && { teacherId: selectedTeacher }),
        ...(selectedSubject && { subjectId: selectedSubject }),
        ...(selectedClass && { classId: selectedClass }),
        ...(selectedSession && { sessionId: selectedSession }),
        ...(selectedTerm && { term: selectedTerm })
      });
      
      const res = await fetch(`/api/question-bank?${params}`);
      const data = await res.json();
      setQuestions(data);
    } catch (error) {
      console.error('Error loading questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!selectedClass || !selectedSubject || !selectedSession || !selectedTerm) {
      alert('Please select a Session, Class, Subject, and Term from the filters before uploading.');
      event.target.value = ''; // Reset the input
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('schoolId', user.school_id);
    formData.append('teacherId', selectedTeacher || teacher?.id || user.id);
    formData.append('subjectId', selectedSubject);
    formData.append('classId', selectedClass);
    formData.append('sessionId', selectedSession);
    formData.append('term', selectedTerm);

    try {
      const res = await fetch('/api/upload/questions', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (res.ok) {
        setUploadResults(data.questions || []);
        if (!data.questions || data.questions.length === 0) {
          setShowUploadModal(false);
        }
      } else {
        alert('Upload failed: ' + (data.error || res.statusText));
      }
    } catch (error: any) {
      alert('Upload error: ' + error.message);
    }
  };

  const handleBulkPaste = async () => {
    if (!pastedText.trim()) return;

    if (!selectedClass || !selectedSubject || !selectedSession || !selectedTerm) {
      alert('Please select a Session, Class, Subject, and Term from the filters before parsing.');
      return;
    }

    try {
      // Parse locally to avoid API route issues and improve speed
      const questions = parseQuestionsFromText(pastedText);

      if (questions && questions.length > 0) {
        setUploadResults(questions);
        setShowPasteModal(false);
        setShowUploadModal(true); // Re-use the upload modal to show the preview table
        setPastedText('');
      } else {
        alert('No questions could be parsed. Please check the format.');
      }
    } catch (error: any) {
      alert('Parsing error: ' + error.message);
    }
  };

  const handleCreateQuestion = async () => {
    if (!formData.questionText || !formData.correctAnswer) {
      alert('Please fill in question text and correct answer');
      return;
    }

    try {
      const res = await fetch('/api/question-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: user.school_id,
          teacherId: selectedTeacher || teacher?.id || user.id,
          subjectId: selectedSubject,
          classId: selectedClass,
          sessionId: selectedSession,
          term: selectedTerm,
          questionText: formData.questionText,
          optionA: formData.optionA,
          optionB: formData.optionB,
          optionC: formData.optionC,
          optionD: formData.optionD,
          correctAnswer: formData.correctAnswer,
          marks: formData.marks,
          topic: formData.topic,
          difficulty: formData.difficulty
        })
      });

      if (res.ok) {
        setShowCreateModal(false);
        setFormData({
          questionText: '',
          optionA: '',
          optionB: '',
          optionC: '',
          optionD: '',
          correctAnswer: '',
          marks: 1,
          topic: '',
          difficulty: 'medium'
        });
        loadQuestions();
      } else {
        const error = await res.json();
        alert('Failed to create question: ' + error.error);
      }
    } catch (error) {
      alert('Failed to create question');
    }
  };

  const handleEditQuestion = async () => {
    if (!formData.questionText || !formData.correctAnswer) {
      alert('Please fill in question text and correct answer');
      return;
    }

    try {
      const res = await fetch(`/api/question-bank/${editingQuestion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setShowEditModal(false);
        setEditingQuestion(null);
        setFormData({
          questionText: '',
          optionA: '',
          optionB: '',
          optionC: '',
          optionD: '',
          correctAnswer: '',
          marks: 1,
          topic: '',
          difficulty: 'medium'
        });
        loadQuestions();
      } else {
        const error = await res.json();
        alert('Failed to update question: ' + error.error);
      }
    } catch (error) {
      alert('Failed to update question');
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      const res = await fetch(`/api/question-bank/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        loadQuestions();
      } else {
        alert('Failed to delete question');
      }
    } catch (error) {
      alert('Failed to delete question');
    }
  };

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printConfig, setPrintConfig] = useState({
    numMcq: 40,
    numTheory: 5,
    format: 'pdf' as 'pdf' | 'doc'
  });

  const handlePrintQuestions = (format: 'pdf' | 'doc' = 'pdf') => {
    setPrintConfig(prev => ({ ...prev, format }));
    setShowPrintModal(true);
  };

  const executePrint = () => {
    setShowPrintModal(false);

    if (questions.length === 0) {
      alert("No questions to print");
      return;
    }

    // Filter questions by type
    const mcqs = questions.filter(q => q.option_a && q.option_b);
    const theories = questions.filter(q => !q.option_a);

    // Take selected number of questions
    const selectedMcqs = mcqs.slice(0, printConfig.numMcq);
    const selectedTheories = theories.slice(0, printConfig.numTheory);

    const schoolName = school?.name || 'SCHOOL NAME';
    const termName = selectedTerm === '1' ? 'FIRST' : selectedTerm === '2' ? 'SECOND' : selectedTerm === '3' ? 'THIRD' : '';
    const className = classes.find(c => c.id === selectedClass)?.name || '';
    const classArm = classes.find(c => c.id === selectedClass)?.arm || '';
    const subjectName = subjects.find(s => s.id === selectedSubject)?.name || '';

    if (printConfig.format === 'doc') {
      const mcqHtml = selectedMcqs.map((q: any, i: number) => `
        <div style="margin-bottom: 12pt;">
          <p><strong>${i + 1}. ${q.question_text}</strong></p>
          <table style="width: 100%;">
            <tr>
              <td style="width: 50%;">A. ${q.option_a}</td>
              <td style="width: 50%;">B. ${q.option_b}</td>
            </tr>
            <tr>
              <td style="width: 50%;">C. ${q.option_c}</td>
              <td style="width: 50%;">D. ${q.option_d}</td>
            </tr>
          </table>
        </div>
      `).join('');

      const theoryHtml = selectedTheories.map((q: any, i: number) => `
        <div style="margin-bottom: 20pt;">
          <p><strong>${i + 1}. ${q.question_text}</strong></p>
          <div style="height: 60pt; border-bottom: 1px dotted #ccc;"></div>
        </div>
      `).join('');

      const html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>Examination</title>
        <style>
          body { font-family: 'Times New Roman', serif; }
          .header { text-align: center; }
          .school-name { color: #4B55C8; font-size: 24pt; font-weight: bold; }
          .address { font-size: 10pt; }
          .contact { color: #0078C8; font-size: 10pt; }
          .tel { color: #B400B4; font-size: 10pt; }
          .title { font-size: 18pt; font-weight: bold; margin-top: 20pt; }
          .info-table { width: 100%; margin-top: 15pt; border-bottom: 2px solid black; }
          .section-header { font-weight: bold; font-size: 14pt; margin-top: 20pt; text-decoration: underline; background: #eee; padding: 5pt; }
        </style>
        </head>
        <body>
          <div class="header">
            <div class="school-name">${schoolName.toUpperCase()}</div>
            <div class="address">${school?.address || ''}</div>
            <div class="contact">Website: ${school?.website || ''} &nbsp;&nbsp; email: ${school?.email || ''}</div>
            <div class="tel">TEL: ${school?.phone || ''}</div>
            <div class="title">${termName} TERM EXAMINATION</div>
          </div>
          <table class="info-table">
            <tr>
              <td style="font-weight: bold; font-size: 14pt;">CLASS: ${(className + ' ' + classArm).toUpperCase()}</td>
              <td style="text-align: right; font-weight: bold; font-size: 14pt;">SUBJECT: ${subjectName.toUpperCase()}</td>
            </tr>
          </table>

          ${selectedMcqs.length > 0 ? `
            <div class="section-header">SECTION A (OBJECTIVE) - ${selectedMcqs.length * 1} Marks</div>
            <div style="margin-top: 10pt;">${mcqHtml}</div>
          ` : ''}

          ${selectedTheories.length > 0 ? `
            <div class="section-header">SECTION B (THEORY) - ${selectedTheories.length * 10} Marks</div>
            <div style="margin-top: 10pt;">${theoryHtml}</div>
          ` : ''}
        </body>
        </html>
      `;
      const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${subjectName}_Exam.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const doc = new jsPDF();
    // Header
    doc.setFont("times", "bold");
    doc.setFontSize(24);
    doc.setTextColor(75, 85, 200);
    doc.text(schoolName.toUpperCase(), 105, 20, { align: 'center' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(school?.address || '', 105, 27, { align: 'center' });
    doc.setTextColor(0, 120, 200);
    doc.text(`Website: ${school?.website || ''}    email: ${school?.email || ''}`, 105, 33, { align: 'center' });
    doc.setTextColor(180, 0, 180);
    doc.text(`TEL: ${school?.phone || ''}`, 105, 39, { align: 'center' });

    doc.setFont("times", "bold");
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text(`${termName} TERM EXAMINATION`, 105, 52, { align: 'center' });

    doc.setFontSize(14);
    doc.text(`CLASS: ${className} ${classArm}`.toUpperCase(), 20, 65);
    doc.text(`SUBJECT: ${subjectName}`.toUpperCase(), 190, 65, { align: 'right' });

    doc.setLineWidth(0.5);
    doc.line(20, 70, 190, 70);

    let y = 80;

    if (selectedMcqs.length > 0) {
      doc.setFontSize(12);
      doc.text(`SECTION A (OBJECTIVE)`, 20, y);
      y += 8;
      selectedMcqs.forEach((q: any, i: number) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        const qLines = doc.splitTextToSize(`${i + 1}. ${q.question_text}`, 170);
        doc.text(qLines, 20, y);
        y += (qLines.length * 6);
        doc.setFont("helvetica", "normal");
        doc.text(`A. ${q.option_a}`, 30, y);
        doc.text(`B. ${q.option_b}`, 110, y);
        y += 6;
        doc.text(`C. ${q.option_c}`, 30, y);
        doc.text(`D. ${q.option_d}`, 110, y);
        y += 10;
      });
    }

    if (selectedTheories.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; } else { y += 10; }
      doc.setFont("times", "bold");
      doc.setFontSize(12);
      doc.text(`SECTION B (THEORY)`, 20, y);
      y += 8;
      selectedTheories.forEach((q: any, i: number) => {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        const qLines = doc.splitTextToSize(`${i + 1}. ${q.question_text}`, 170);
        doc.text(qLines, 20, y);
        y += (qLines.length * 6) + 20; // Extra space for answer
      });
    }

    doc.save(`${subjectName}_Exam.pdf`);
  };

  const openEditModal = (question: any) => {
    setEditingQuestion(question);
    setFormData({
      questionText: question.question_text,
      optionA: question.option_a,
      optionB: question.option_b,
      optionC: question.option_c,
      optionD: question.option_d,
      correctAnswer: question.correct_answer,
      marks: question.marks,
      topic: question.topic,
      difficulty: question.difficulty
    });
    setShowEditModal(true);
  };

  const saveUploadedQuestions = async () => {
    if (uploadResults.length === 0) return;

    // Check if all questions have answers
    const missingAnswers = uploadResults.filter(q => !q.correctAnswer);
    if (missingAnswers.length > 0) {
      alert(`Please select the correct answer for all ${uploadResults.length} questions before saving.`);
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.all(
        uploadResults.map((question: any) =>
          fetch('/api/question-bank', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              schoolId: user.school_id,
              teacherId: selectedTeacher || teacher?.id || user.id,
              subjectId: selectedSubject,
              classId: selectedClass,
              sessionId: selectedSession,
              term: selectedTerm,
              questionText: question.questionText,
              optionA: question.optionA,
              optionB: question.optionB,
              optionC: question.optionC,
              optionD: question.optionD,
              correctAnswer: question.correctAnswer,
              marks: question.marks,
              topic: question.topic,
              difficulty: question.difficulty
            })
          }).then(async r => ({ ok: r.ok, status: r.status, data: await r.json() }))
        )
      );

      const failed = results.filter(r => !r.ok);
      if (failed.length > 0) {
        alert(`Failed to save ${failed.length} questions. Please check if all fields are filled.`);
        console.error('Save failures:', failed);
      } else {
        setUploadResults([]);
        setShowUploadModal(false);
        loadQuestions();
        alert('All questions saved successfully!');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save uploaded questions due to a network error.');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/download/question-template');
      if (!response.ok) {
        throw new Error('Failed to download template');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'question-bank-template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('Failed to download template');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen bg-gray-50">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Question Bank</h1>
            <p className="text-gray-600 mt-2">Upload questions from Excel/Word/PDF or create manually</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex rounded-lg shadow-sm">
              <button
                onClick={() => handlePrintQuestions('pdf')}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 border border-transparent rounded-l-lg hover:bg-red-700 focus:z-10 focus:ring-2 focus:ring-red-500 transition-all active:scale-95"
              >
                <span className="text-lg">🖨️</span> PDF
              </button>
              <button
                onClick={() => handlePrintQuestions('doc')}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-700 border-l border-blue-800 rounded-r-lg hover:bg-blue-800 focus:z-10 focus:ring-2 focus:ring-blue-500 transition-all active:scale-95"
              >
                <span className="text-lg">📄</span> Word (DOC)
              </button>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg hover:from-blue-700 hover:to-indigo-800 shadow-md hover:shadow-lg transition-all active:scale-95"
            >
              <span className="text-xl">✨</span> Create Question
            </button>

            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 shadow-sm transition-all"
              >
                <span>📁</span> Upload
              </button>
              <button
                onClick={() => setShowPasteModal(true)}
                className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 shadow-sm transition-all"
              >
                <span>📋</span> Bulk Paste
              </button>
            </div>

            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-all"
            >
              <span>📥</span> Template
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Session</label>
              <select
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedSession}
                onChange={e => setSelectedSession(e.target.value)}
              >
                <option value="">All Sessions</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
              <select
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
              >
                <option value="">All Classes</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.arm}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
              <select
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedSubject}
                onChange={e => setSelectedSubject(e.target.value)}
              >
                <option value="">All Subjects</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Teacher</label>
              <select
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedTeacher}
                onChange={e => setSelectedTeacher(e.target.value)}
              >
                <option value="">All Teachers</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Term</label>
              <select
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedTerm}
                onChange={e => setSelectedTerm(e.target.value)}
              >
                <option value="">All Terms</option>
                <option value="1">1st Term</option>
                <option value="2">2nd Term</option>
                <option value="3">3rd Term</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-5xl mb-4">📝</div>
            <p className="text-lg font-medium">No questions found</p>
            <p className="text-sm mt-2">Upload questions or create your first question to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-4 font-semibold text-gray-700">Question</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Topic</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Type</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Difficulty</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Marks</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Created</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((question: any, index: number) => (
                  <tr key={question.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-4">
                      <div className="max-w-md">
                        <span className="font-medium">{index + 1}.</span> {question.question_text}
                        {question.note && (
                          <div className="text-sm text-yellow-600 mt-1">⚠️ {question.note}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-gray-700">{question.topic || '-'}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                        {question.question_type?.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        question.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                        question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {question.difficulty?.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-gray-700">{question.marks}</td>
                    <td className="p-4 text-gray-700">
                      {new Date(question.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(question)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(question.id)}
                          className="text-red-600 hover:text-red-800 font-medium text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {uploadResults.length > 0 ? 'Preview & Edit Questions' : 'Upload Questions'}
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  {uploadResults.length > 0 ? 'Review parsed questions and select correct answers before saving' : 'Upload Excel, Word, or PDF file containing questions'}
                </p>
              </div>
              <button onClick={() => { setShowUploadModal(false); setUploadResults([]); }} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="p-6">
              {uploadResults.length === 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select File</label>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.doc,.docx,.pdf,.csv"
                    onChange={handleFileUpload}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Supported formats: Excel (.xlsx, .xls, .csv), Word (.doc, .docx), PDF (.pdf)
                  </p>
                </div>
              )}

              {uploadResults.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Preview ({uploadResults.length} questions)</h3>
                  <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-2 text-left">Question</th>
                          <th>Option A</th>
                          <th>Option B</th>
                          <th>Option C</th>
                          <th>Option D</th>
                          <th>Answer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadResults.map((question: any, index: number) => (
                          <tr key={index} className="border-b">
                            <td className="p-2">
                              <textarea
                                className="w-full p-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                value={question.questionText}
                                rows={2}
                                onChange={e => updateUploadResult(index, 'questionText', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                className="w-full p-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                value={question.optionA}
                                onChange={e => updateUploadResult(index, 'optionA', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                className="w-full p-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                value={question.optionB}
                                onChange={e => updateUploadResult(index, 'optionB', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                className="w-full p-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                value={question.optionC}
                                onChange={e => updateUploadResult(index, 'optionC', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                className="w-full p-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                value={question.optionD}
                                onChange={e => updateUploadResult(index, 'optionD', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <select
                                className="w-full p-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 font-bold text-blue-600"
                                value={question.correctAnswer}
                                onChange={e => updateUploadResult(index, 'correctAnswer', e.target.value)}
                              >
                                <option value="">Select</option>
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                                <option value="D">D</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-3 mt-4">
                    <button
                      onClick={() => setShowUploadModal(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveUploadedQuestions}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Save All Questions
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {showEditModal ? 'Edit Question' : 'Create New Question'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Question Text *</label>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24"
                  value={formData.questionText}
                  onChange={e => setFormData(prev => ({ ...prev, questionText: e.target.value }))}
                  placeholder="Enter your question here..."
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Option A</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.optionA}
                    onChange={e => setFormData(prev => ({ ...prev, optionA: e.target.value }))}
                    placeholder="Option A"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Option B</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.optionB}
                    onChange={e => setFormData(prev => ({ ...prev, optionB: e.target.value }))}
                    placeholder="Option B"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Option C</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.optionC}
                    onChange={e => setFormData(prev => ({ ...prev, optionC: e.target.value }))}
                    placeholder="Option C"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Option D</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.optionD}
                    onChange={e => setFormData(prev => ({ ...prev, optionD: e.target.value }))}
                    placeholder="Option D"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Correct Answer *</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.correctAnswer}
                    onChange={e => setFormData(prev => ({ ...prev, correctAnswer: e.target.value }))}
                  >
                    <option value="">Select correct answer</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Marks</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.marks}
                    onChange={e => setFormData(prev => ({ ...prev, marks: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.topic}
                    onChange={e => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                    placeholder="Question topic (optional)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.difficulty}
                    onChange={e => setFormData(prev => ({ ...prev, difficulty: e.target.value }))}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setEditingQuestion(null);
                  setFormData({
                    questionText: '',
                    optionA: '',
                    optionB: '',
                    optionC: '',
                    optionD: '',
                    correctAnswer: '',
                    marks: 1,
                    topic: '',
                    difficulty: 'medium'
                  });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={showEditModal ? handleEditQuestion : handleCreateQuestion}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {showEditModal ? 'Update Question' : 'Create Question'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Bulk Paste Questions</h2>
              <button onClick={() => setShowPasteModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Paste your questions here. Use numbering (1.) and options (a, b, c, d).
              </p>
              <textarea
                className="w-full h-80 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="Example:&#10;1. What is Biology?&#10;(a) Study of life (b) Study of rocks (c) Study of stars (d) Study of numbers"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
              />
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowPasteModal(false)}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkPaste}
                  className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold"
                >
                  Parse Questions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Config Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-6 text-white">
              <h2 className="text-xl font-bold">Print Configuration</h2>
              <p className="text-gray-400 text-sm">Select number of questions for {printConfig.format.toUpperCase()}</p>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Objective Questions (MCQs)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={printConfig.numMcq}
                      onChange={(e) => setPrintConfig(prev => ({ ...prev, numMcq: parseInt(e.target.value) }))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <input
                      type="number"
                      value={printConfig.numMcq}
                      onChange={(e) => setPrintConfig(prev => ({ ...prev, numMcq: parseInt(e.target.value) || 0 }))}
                      className="w-16 p-1 text-center border rounded font-bold"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Available in bank: {questions.filter(q => q.option_a).length}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Theory Questions
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={printConfig.numTheory}
                      onChange={(e) => setPrintConfig(prev => ({ ...prev, numTheory: parseInt(e.target.value) }))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                    <input
                      type="number"
                      value={printConfig.numTheory}
                      onChange={(e) => setPrintConfig(prev => ({ ...prev, numTheory: parseInt(e.target.value) || 0 }))}
                      className="w-16 p-1 text-center border rounded font-bold"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Available in bank: {questions.filter(q => !q.option_a).length}</p>
                </div>
              </div>

              <div className="pt-4 border-t flex gap-3">
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executePrint}
                  className={`flex-1 px-4 py-2.5 text-sm font-bold text-white rounded-lg shadow-md transition-all active:scale-95 ${
                    printConfig.format === 'pdf' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-700 hover:bg-blue-800'
                  }`}
                >
                  Generate {printConfig.format.toUpperCase()}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
