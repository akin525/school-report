'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';

export default function LessonNotesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [teacher, setTeacher] = useState<any>(null);
  const [school, setSchool] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [lessonNotes, setLessonNotes] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('1');
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [selectedNoteForQuestions, setSelectedNoteForQuestions] = useState<any>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  const [detectedTopics, setDetectedTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [generationDifficulty, setGenerationDifficulty] = useState('medium');
  const [generationType, setGenerationType] = useState('multiple_choice');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [aiProvider, setAIProvider] = useState<'gemini' | 'openai'>('openai');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    topic: '',
    fileUrl: '',
    fileName: '',
    fileType: '',
    term: '1'
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
      setStudent(d.student);
      const sid = d.user.school_id;

      if (d.user.role === 'student' && d.student?.class_id) {
        setSelectedClass(d.student.class_id);
      }

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
        fetch(`/api/subjects?classId=${selectedClass}`).then(r => r.json()).then(subjs => {
          setSubjects(subjs);
          if (subjs.length > 0) setSelectedSubject(subjs[0].id);
          else setSelectedSubject('');
        });
      }
    }
  }, [selectedClass, teacherAssignments, user]);

  useEffect(() => {
    loadLessonNotes();
  }, [selectedSession, selectedClass, selectedSubject, selectedTeacher, selectedTerm]);

  const loadLessonNotes = async () => {
    if (!user?.school_id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        schoolId: user.school_id,
        ...(selectedSession && { sessionId: selectedSession }),
        ...(selectedClass && { classId: selectedClass }),
        ...(selectedSubject && { subjectId: selectedSubject }),
        ...(selectedTeacher && { teacherId: selectedTeacher }),
        ...(selectedTerm && { term: selectedTerm })
      });
      
      const res = await fetch(`/api/lesson-notes?${params}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setLessonNotes(data);
      } else {
        setLessonNotes([]);
      }
    } catch (error) {
      console.error('Error loading lesson notes:', error);
      setLessonNotes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('schoolId', user.school_id);

    try {
      const res = await fetch('/api/upload/lesson-notes', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (res.ok) {
        if (data.extractedText) {
          setFormData(prev => ({
            ...prev,
            fileUrl: data.url,
            fileName: data.fileName,
            fileType: data.fileType,
            content: data.extractedText
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            fileUrl: data.url,
            fileName: data.fileName,
            fileType: data.fileType
          }));
        }
      } else {
        alert('Upload failed: ' + data.error);
      }
    } catch (error) {
      alert('Upload failed');
    }
  };

  const handleCreateNote = async () => {
    const tId = selectedTeacher || teacher?.id;
    if (!formData.title || !selectedSubject || !selectedClass || !selectedSession || !tId) {
      alert('Please fill in all required fields. Ensure a Teacher, Subject, and Class are selected.');
      return;
    }

    try {
      const res = await fetch('/api/lesson-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: user.school_id,
          teacherId: tId,
          subjectId: selectedSubject,
          classId: selectedClass,
          sessionId: selectedSession,
          term: parseInt(formData.term),
          title: formData.title,
          content: formData.content,
          topic: formData.topic,
          fileUrl: formData.fileUrl,
          fileName: formData.fileName,
          fileType: formData.fileType
        })
      });

      if (res.ok) {
        setShowCreateModal(false);
        setFormData({
          title: '',
          content: '',
          topic: '',
          fileUrl: '',
          fileName: '',
          fileType: '',
          term: '1'
        });
        loadLessonNotes();
      } else {
        const error = await res.json();
        alert('Failed to create lesson note: ' + error.error);
      }
    } catch (error) {
      alert('Failed to create lesson note');
    }
  };

  const handleEditNote = async () => {
    if (!formData.title || !editingNote) return;

    try {
      const res = await fetch(`/api/lesson-notes/${editingNote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setShowEditModal(false);
        setEditingNote(null);
        setFormData({
          title: '',
          content: '',
          topic: '',
          fileUrl: '',
          fileName: '',
          fileType: '',
          term: '1'
        });
        loadLessonNotes();
      } else {
        const error = await res.json();
        alert('Failed to update lesson note: ' + error.error);
      }
    } catch (error) {
      alert('Failed to update lesson note');
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lesson note?')) return;

    try {
      const res = await fetch(`/api/lesson-notes/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        loadLessonNotes();
      } else {
        alert('Failed to delete lesson note');
      }
    } catch (error) {
      alert('Failed to delete lesson note');
    }
  };

  const handleGenerateQuestions = async (note: any) => {
    setSelectedNoteForQuestions(note);
    setShowQuestionsModal(true);
    setGeneratedQuestions([]);
    setDetectedTopics([]);
    setSelectedTopic('');
    setIsGenerating(false);

    try {
      // First, get topics from the note
      const topicRes = await fetch('/api/lesson-notes/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonNoteId: note.id,
          schoolId: user.school_id,
          action: 'get-topics',
          provider: aiProvider
        })
      });

      if (topicRes.ok) {
        const topicData = await topicRes.json();
        setDetectedTopics(topicData.topics || []);
      }
    } catch (error) {
      console.error('Failed to detect topics');
    }
  };

  const startGeneration = async () => {
    if (!selectedNoteForQuestions) return;

    setIsGenerating(true);
    setGeneratedQuestions([]);

    try {
      const res = await fetch('/api/lesson-notes/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonNoteId: selectedNoteForQuestions.id,
          schoolId: user.school_id,
          numQuestions: 5,
          difficulty: generationDifficulty,
          questionType: generationType,
          selectedTopic: selectedTopic,
          provider: aiProvider
        })
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedQuestions(data.questions);
      } else {
        const error = await res.json();
        alert('Failed to generate questions: ' + error.error);
      }
    } catch (error) {
      alert('Failed to generate questions');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAIGenerateContent = async () => {
    if (!formData.topic || !selectedSubject) {
      alert('Please enter a topic and select a subject first.');
      return;
    }

    const subject = subjects.find(s => s.id === selectedSubject)?.name;
    const level = classes.find(c => c.id === selectedClass)?.name;

    setIsGeneratingContent(true);
    try {
      const res = await fetch('/api/lesson-notes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: formData.topic,
          subject: subject,
          level: level,
          provider: aiProvider
        })
      });

      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({ ...prev, content: data.content }));
        if (!formData.title) {
          setFormData(prev => ({ ...prev, title: formData.topic }));
        }
      } else {
        const error = await res.json();
        alert('Failed to generate content: ' + error.error);
      }
    } catch (error) {
      alert('Failed to generate content');
    } finally {
      setIsGeneratingContent(false);
    }
  };

  const handlePrintNote = (note: any, format: 'pdf' | 'doc' = 'pdf') => {
    const schoolName = school?.name || 'SCHOOL NAME';

    if (format === 'doc') {
      const html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>${note.title}</title>
        <style>
          body { font-family: 'Times New Roman', serif; }
          .header { text-align: center; }
          .school-name { color: #4B55C8; font-size: 24pt; font-weight: bold; }
          .address { font-size: 10pt; }
          .contact { color: #0078C8; font-size: 10pt; }
          .tel { color: #B400B4; font-size: 10pt; }
          .title { font-size: 18pt; font-weight: bold; margin-top: 20pt; }
          .info-table { width: 100%; margin-top: 20pt; border-bottom: 2px solid black; }
          .content { margin-top: 20pt; font-size: 12pt; }
        </style>
        </head>
        <body>
          <div class="header">
            <div class="school-name">${schoolName.toUpperCase()}</div>
            <div class="address">${school?.address || ''}</div>
            <div class="contact">Website: ${school?.website || ''} &nbsp;&nbsp; email: ${school?.email || ''}</div>
            <div class="tel">TEL: ${school?.phone || ''}</div>
            <div class="title">LESSON NOTE</div>
          </div>
          <table class="info-table">
            <tr>
              <td style="font-weight: bold; font-size: 14pt;">CLASS: ${(note.class_name + ' ' + (note.class_arm || '')).toUpperCase()}</td>
              <td style="text-align: right; font-weight: bold; font-size: 14pt;">SUBJECT: ${note.subject_name.toUpperCase()}</td>
            </tr>
          </table>
          <div class="content">
            <p><strong>Title:</strong> ${note.title}</p>
            ${note.topic ? `<p><strong>Topic:</strong> ${note.topic}</p>` : ''}
            <div style="white-space: pre-wrap;">${note.content || ''}</div>
          </div>
        </body>
        </html>
      `;
      const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${note.title}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const doc = new jsPDF();
    // Header
    doc.setFont("times", "bold");
    doc.setFontSize(24);
    doc.setTextColor(75, 85, 200); // Purple-ish blue
    doc.text(schoolName.toUpperCase(), 105, 20, { align: 'center' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(school?.address || '', 105, 27, { align: 'center' });

    doc.setTextColor(0, 120, 200); // Blue
    doc.text(`Website: ${school?.website || ''}    email: ${school?.email || ''}`, 105, 33, { align: 'center' });

    doc.setTextColor(180, 0, 180); // Purple
    doc.text(`TEL: ${school?.phone || ''}`, 105, 39, { align: 'center' });

    doc.setFont("times", "bold");
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text("LESSON NOTE", 105, 52, { align: 'center' });

    doc.setFontSize(14);
    doc.text(`CLASS: ${note.class_name} ${note.class_arm || ''}`.toUpperCase(), 20, 65);
    doc.text(`SUBJECT: ${note.subject_name}`.toUpperCase(), 190, 65, { align: 'right' });

    doc.setLineWidth(0.5);
    doc.line(20, 70, 190, 70);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Title: ${note.title}`, 20, 80);
    if (note.topic) {
      doc.setFont("helvetica", "normal");
      doc.text(`Topic: ${note.topic}`, 20, 88);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const contentLines = doc.splitTextToSize(note.content || '', 170);
    doc.text(contentLines, 20, 100);

    doc.save(`${note.title}_Lesson_Note.pdf`);
  };

  const handlePrintQuestions = (format: 'pdf' | 'doc' = 'pdf') => {
    const note = selectedNoteForQuestions;
    const schoolName = school?.name || 'SCHOOL NAME';
    const termName = selectedTerm === '1' ? 'FIRST' : selectedTerm === '2' ? 'SECOND' : 'THIRD';

    if (format === 'doc') {
      const questionsHtml = generatedQuestions.map((q: any, i: number) => `
        <div style="margin-bottom: 15pt;">
          <p><strong>${i + 1}. ${q.question_text}</strong></p>
          ${q.option_a ? `
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
          ` : '<div style="height: 40pt;"></div>'}
        </div>
      `).join('');

      const html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>Questions</title>
        <style>
          body { font-family: 'Times New Roman', serif; }
          .header { text-align: center; }
          .school-name { color: #4B55C8; font-size: 24pt; font-weight: bold; }
          .address { font-size: 10pt; }
          .contact { color: #0078C8; font-size: 10pt; }
          .tel { color: #B400B4; font-size: 10pt; }
          .title { font-size: 18pt; font-weight: bold; margin-top: 20pt; }
          .info-table { width: 100%; margin-top: 20pt; border-bottom: 2px solid black; }
          .section { margin-top: 15pt; font-weight: bold; font-size: 12pt; }
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
              <td style="font-weight: bold; font-size: 14pt;">CLASS: ${(note.class_name + ' ' + (note.class_arm || '')).toUpperCase()}</td>
              <td style="text-align: right; font-weight: bold; font-size: 14pt;">SUBJECT: ${note.subject_name.toUpperCase()}</td>
            </tr>
          </table>
          <div style="display: table; width: 100%; margin-top: 10pt;">
            <div style="display: table-cell; font-weight: bold;">SECTION A</div>
            <div style="display: table-cell; text-align: center; font-weight: bold;">Scores: ${generatedQuestions.length * 2} Marks</div>
          </div>
          <div style="margin-top: 20pt;">
            ${questionsHtml}
          </div>
        </body>
        </html>
      `;
      const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${note.title}_Questions.doc`;
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
    doc.text(`CLASS: ${note.class_name} ${note.class_arm || ''}`.toUpperCase(), 20, 65);
    doc.text(`SUBJECT: ${note.subject_name}`.toUpperCase(), 190, 65, { align: 'right' });

    doc.setFontSize(12);
    doc.text("SECTION A", 20, 78);
    doc.text(`Scores: ${generatedQuestions.length * 2} Marks`, 105, 78, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.line(20, 82, 190, 82);

    let y = 92;
    generatedQuestions.forEach((q: any, i: number) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const qText = `${i + 1}. ${q.question_text}`;
      const qLines = doc.splitTextToSize(qText, 170);
      doc.text(qLines, 20, y);
      y += (qLines.length * 6);

      doc.setFont("helvetica", "normal");
      if (q.option_a) {
        doc.text(`A. ${q.option_a}`, 30, y);
        doc.text(`B. ${q.option_b}`, 110, y);
        y += 6;
        doc.text(`C. ${q.option_c}`, 30, y);
        doc.text(`D. ${q.option_d}`, 110, y);
        y += 10;
      } else {
        y += 20; // Space for short answer
      }
    });

    doc.save(`${note.title}_Questions.pdf`);
  };

  const openEditModal = (note: any) => {
    setEditingNote(note);
    setFormData({
      title: note.title,
      content: note.content || '',
      topic: note.topic || '',
      fileUrl: note.file_url || '',
      fileName: note.file_name || '',
      fileType: note.file_type || '',
      term: note.term.toString()
    });
    setShowEditModal(true);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen bg-gray-50">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Lesson Notes</h1>
            <p className="text-gray-600 mt-2">
              {user?.role === 'student' ? 'Access your classroom materials and study notes' : 'Manage your lesson notes and generate assessment questions'}
            </p>
          </div>
          {user?.role !== 'student' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <span>➕</span> Create Lesson Note
            </button>
          )}
        </div>

        {/* Filters */}
        <div className={`bg-white p-6 rounded-lg shadow-sm border border-gray-200 ${user?.role === 'student' ? '' : ''}`}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className={user?.role === 'student' ? 'hidden' : ''}>
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
            <div className={user?.role === 'student' ? 'hidden' : ''}>
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
            <div className={user?.role === 'student' ? 'hidden' : ''}>
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
            <div className={user?.role === 'student' ? 'md:col-span-2' : ''}>
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

      {/* Lesson Notes List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : lessonNotes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-5xl mb-4">📚</div>
            <p className="text-lg font-medium">No lesson notes found</p>
            <p className="text-sm mt-2">Create your first lesson note to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-4 font-semibold text-gray-700">Title</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Subject</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Class</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Teacher</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Term</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Created</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lessonNotes.map((note: any) => (
                  <tr key={note.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-4">
                      <div>
                        <div className="font-medium text-gray-900">{note.title}</div>
                        {note.topic && <div className="text-sm text-gray-500">{note.topic}</div>}
                        {note.file_name && (
                          <div className="text-sm text-blue-600 flex items-center gap-1">
                            <span>📄</span> {note.file_name}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-gray-700">{note.subject_name}</td>
                    <td className="p-4 text-gray-700">{note.class_name} {note.class_arm}</td>
                    <td className="p-4 text-gray-700">{note.teacher_name}</td>
                    <td className="p-4 text-gray-700">{note.term === 1 ? '1st' : note.term === 2 ? '2nd' : '3rd'} Term</td>
                    <td className="p-4 text-gray-700">{new Date(note.created_at).toLocaleDateString()}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        {user?.role !== 'student' && (
                          <>
                            <button
                              onClick={() => openEditModal(note)}
                              className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleGenerateQuestions(note)}
                              className="text-green-600 hover:text-green-800 font-medium text-sm"
                            >
                              Generate & Print Questions
                            </button>
                          </>
                        )}
                        {note.file_url && (
                          <a
                            href={note.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-600 hover:text-purple-800 font-medium text-sm"
                          >
                            {user?.role === 'student' ? 'View/Download' : 'View File'}
                          </a>
                        )}
                        {user?.role !== 'student' && (
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-red-600 hover:text-red-800 font-medium text-sm"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Create Lesson Note</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter lesson note title"
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.topic}
                    onChange={e => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                    placeholder="Enter main topic"
                  />
                </div>
                <div className="pt-7">
                  <button
                    type="button"
                    onClick={handleAIGenerateContent}
                    disabled={isGeneratingContent}
                    className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm flex items-center gap-1 shadow-sm disabled:bg-purple-300"
                  >
                    {isGeneratingContent ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : '✨ Generate with AI'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32"
                  value={formData.content}
                  onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Enter lesson content or create directly in the editor"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload File (PDF/Word)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {formData.fileName && (
                  <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
                    <span>✅</span> {formData.fileName}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Term *</label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.term}
                  onChange={e => setFormData(prev => ({ ...prev, term: e.target.value }))}
                >
                  <option value="1">1st Term</option>
                  <option value="2">2nd Term</option>
                  <option value="3">3rd Term</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={selectedSubject}
                    onChange={e => setSelectedSubject(e.target.value)}
                  >
                    <option value="">Select Subject</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Class *</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={selectedClass}
                    onChange={e => setSelectedClass(e.target.value)}
                  >
                    <option value="">Select Class</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.arm}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(user?.role === 'superadmin' || user?.role === 'school_admin') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Teacher *</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={selectedTeacher}
                    onChange={e => setSelectedTeacher(e.target.value)}
                  >
                    <option value="">Select Teacher</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">As an admin, you must assign the note to a teacher.</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNote}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Lesson Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Edit Lesson Note</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter lesson note title"
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.topic}
                    onChange={e => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                    placeholder="Enter main topic"
                  />
                </div>
                <div className="pt-7">
                  <button
                    type="button"
                    onClick={handleAIGenerateContent}
                    disabled={isGeneratingContent}
                    className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm flex items-center gap-1 shadow-sm disabled:bg-purple-300"
                  >
                    {isGeneratingContent ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : '✨ Generate with AI'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32"
                  value={formData.content}
                  onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Enter lesson content or create directly in the editor"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Replace File (PDF/Word)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {formData.fileName && (
                  <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
                    <span>✅</span> {formData.fileName}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Term *</label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.term}
                  onChange={e => setFormData(prev => ({ ...prev, term: e.target.value }))}
                >
                  <option value="1">1st Term</option>
                  <option value="2">2nd Term</option>
                  <option value="3">3rd Term</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditNote}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Update Lesson Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Questions Modal */}
      {showQuestionsModal && selectedNoteForQuestions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Generated Questions</h2>
              <p className="text-gray-600 mt-1">{selectedNoteForQuestions.title}</p>
            </div>
            <div className="p-6">
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">AI Provider</label>
                    <select
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg text-sm"
                      value={aiProvider}
                      onChange={(e: any) => setAIProvider(e.target.value)}
                    >
                      <option value="openai">ChatGPT (OpenAI)</option>
                      <option value="gemini">Gemini (Google)</option>
                    </select>
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-blue-800 mb-2">Topic</label>
                    <select
                      className="w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      value={selectedTopic}
                      onChange={e => setSelectedTopic(e.target.value)}
                    >
                      <option value="">Whole Document</option>
                      {detectedTopics.map((topic, i) => (
                        <option key={i} value={topic}>{topic}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-2">Question Type</label>
                    <select
                      className="w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      value={generationType}
                      onChange={e => setGenerationType(e.target.value)}
                    >
                      <option value="multiple_choice">Objective (MCQ)</option>
                      <option value="short_answer">Theory (Short Answer)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-2">Difficulty</label>
                    <select
                      className="w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      value={generationDifficulty}
                      onChange={e => setGenerationDifficulty(e.target.value)}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>

                  <button
                    onClick={startGeneration}
                    disabled={isGenerating}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300 h-10"
                  >
                    {isGenerating ? 'Generating...' : 'Generate'}
                  </button>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  Choose the type of questions and difficulty level to generate from your note.
                </p>
              </div>

              {isGenerating ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600 font-medium">Analyzing content and creating questions...</p>
                </div>
              ) : generatedQuestions.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p>Select a topic above and click "Generate Questions" to begin.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {generatedQuestions.map((q, index) => (
                    <div key={q.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="font-medium text-gray-900 mb-3">
                        {index + 1}. {q.question_text}
                      </div>
                      <div className="space-y-2 ml-4">
                        <div className={`flex items-center gap-2 p-2 rounded ${q.correct_answer === 'A' ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                          <span className="font-medium">A.</span> {q.option_a}
                          {q.correct_answer === 'A' && <span className="ml-auto text-green-600 font-medium">✓ Correct</span>}
                        </div>
                        <div className={`flex items-center gap-2 p-2 rounded ${q.correct_answer === 'B' ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                          <span className="font-medium">B.</span> {q.option_b}
                          {q.correct_answer === 'B' && <span className="ml-auto text-green-600 font-medium">✓ Correct</span>}
                        </div>
                        <div className={`flex items-center gap-2 p-2 rounded ${q.correct_answer === 'C' ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                          <span className="font-medium">C.</span> {q.option_c}
                          {q.correct_answer === 'C' && <span className="ml-auto text-green-600 font-medium">✓ Correct</span>}
                        </div>
                        <div className={`flex items-center gap-2 p-2 rounded ${q.correct_answer === 'D' ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                          <span className="font-medium">D.</span> {q.option_d}
                          {q.correct_answer === 'D' && <span className="ml-auto text-green-600 font-medium">✓ Correct</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => handlePrintQuestions('pdf')}
                disabled={generatedQuestions.length === 0}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:bg-orange-300"
              >
                Print PDF
              </button>
              <button
                onClick={() => handlePrintQuestions('doc')}
                disabled={generatedQuestions.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300"
              >
                Download DOC
              </button>
              <button
                onClick={() => setShowQuestionsModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
