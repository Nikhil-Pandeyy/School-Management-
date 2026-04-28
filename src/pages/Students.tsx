import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { Plus, GraduationCap, Search, Filter, MoreVertical, Hash, UserPlus, ExternalLink, X, Trash2, AlertTriangle, Upload, Download, FileDown, FileUp, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { generateUniqueId } from '../utils/idGenerator';
import Papa from 'papaparse';

export default function Students() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const classFilter = searchParams.get('classId');
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    address: '',
    age: '',
    dob: '',
    classId: classFilter || '',
    section: ''
  });

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<any>(null);
  const [deletionRemark, setDeletionRemark] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.schoolId) {
      fetchStudents();
      fetchClasses();
    }
  }, [user, classFilter]);

  const fetchStudents = async () => {
    try {
      if (!user?.schoolId) return;
      const q = query(collection(db, 'schools', user.schoolId, 'users'), where('role', '==', 'student'));
      const snapshot = await getDocs(q);
      setStudents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      if (!user?.schoolId) return;
      const q = query(collection(db, 'schools', user.schoolId, 'classes'));
      const snapshot = await getDocs(q);
      setClasses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'classes');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;
    try {
      const uniqueId = await generateUniqueId(user.schoolId);
      const userRef = doc(collection(db, 'schools', user.schoolId, 'users'));
      await setDoc(userRef, {
        uid: userRef.id,
        displayName: formData.name,
        email: formData.email || `${uniqueId}@school.com`,
        mobile: formData.mobile,
        address: formData.address,
        age: Number(formData.age),
        dob: formData.dob,
        role: 'student',
        schoolId: user.schoolId,
        uniqueId,
        classId: formData.classId,
        section: formData.section,
        hideBirthday: false,
        createdAt: new Date().toISOString()
      });

      // Update class student count
      if (formData.classId) {
        const classRef = doc(db, 'schools', user.schoolId, 'classes', formData.classId);
        const classData = classes.find(c => c.id === formData.classId);
        await updateDoc(classRef, { studentCount: (classData?.studentCount || 0) + 1 });
      }

      setIsModalOpen(false);
      setFormData({ name: '', email: '', mobile: '', address: '', age: '', dob: '', classId: '', section: '' });
      fetchStudents();
      fetchClasses();
    } catch (err) {
      console.error(err);
    }
  };

  const calculateWords = (text: string) => {
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    return words.length;
  };

  const handleDeleteStudent = async () => {
    const wordCount = calculateWords(deletionRemark);
    if (wordCount < 50) {
      alert(`Please write at least 50 words. Current count: ${wordCount}`);
      return;
    }

    if (!studentToDelete || !user?.schoolId) return;
    
    setIsDeleting(true);
    try {
      // 1. Log the deletion to a audit log subcollection
      await addDoc(collection(db, 'schools', user.schoolId, 'deletion_logs'), {
        deletedUserId: studentToDelete.id,
        deletedUserName: studentToDelete.displayName,
        remark: deletionRemark,
        deletedBy: user.uid,
        deletedAt: new Date().toISOString()
      });

      // 2. Mark as deleted within the school's user collection
      await updateDoc(doc(db, 'schools', user.schoolId, 'users', studentToDelete.id), {
        role: 'deleted_student',
        deletionRemark: deletionRemark,
        deletedAt: new Date().toISOString()
      });

      // 3. Update class student count
      if (studentToDelete.classId) {
        const classRef = doc(db, 'schools', user.schoolId, 'classes', studentToDelete.classId);
        const classData = classes.find(c => c.id === studentToDelete.classId);
        if (classData && classData.studentCount > 0) {
          await updateDoc(classRef, { studentCount: classData.studentCount - 1 });
        }
      }

      setIsDeleteModalOpen(false);
      setStudentToDelete(null);
      setDeletionRemark('');
      fetchStudents();
      fetchClasses();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'users');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const data = results.data as any[];
          console.log("Parsing results:", data);
          
          let successCount = 0;
          for (const row of data) {
            if (!row.name || !user?.schoolId) continue;

            const uniqueId = await generateUniqueId(user.schoolId);
            const userRef = doc(collection(db, 'schools', user.schoolId, 'users'));
            
            // Map common CSV headers
            const studentData = {
              uid: userRef.id,
              displayName: row.name || row.Name || row['Student Name'],
              email: row.email || row.Email || `${uniqueId}@school.com`,
              mobile: row.mobile || row.Mobile || row.Phone || '',
              address: row.address || row.Address || '',
              age: Number(row.age || row.Age || 0),
              role: 'student',
              schoolId: user.schoolId,
              uniqueId,
              classId: formData.classId || '', // Default to selected class if any
              section: row.section || row.Section || '',
              createdAt: new Date().toISOString()
            };

            await setDoc(userRef, studentData);
            
            // Note: We're not updating class student counts in bulk to avoid excessive writes in this demo
            // In production, we'd use a transaction or batch
            successCount++;
          }

          alert(`Successfully uploaded ${successCount} students!`);
          fetchStudents();
          fetchClasses();
        } catch (err) {
          console.error("Bulk upload error:", err);
          alert("Error during bulk upload. Please check format.");
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }
    });
  };

  const downloadStudentList = () => {
    const dataToExport = filteredStudents.map(s => ({
      'Student ID': s.uniqueId,
      'Name': s.displayName,
      'Class': classes.find(c => c.id === s.classId)?.name || 'N/A',
      'Section': s.section || '',
      'Mobile': s.mobile || '',
      'Email': s.email || '',
      'Address': s.address || ''
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Student_Directory_${new Date().toLocaleDateString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         s.uniqueId?.includes(searchTerm);
    const matchesClass = classFilter ? s.classId === classFilter : true;
    return matchesSearch && matchesClass;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {classFilter ? `Students of ${classes.find(c => c.id === classFilter)?.name || 'Class'}` : 'Student Directory'}
          </h1>
          <p className="text-slate-500 text-sm">
            {classFilter ? 'Viewing all students registered in this specific class.' : 'Manage student enrollment and personal records.'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 self-start sm:self-auto">
          <div className="flex flex-wrap items-center gap-3">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleBulkUpload} 
              accept=".csv" 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all text-sm shadow-sm disabled:opacity-50"
            >
              <FileUp size={18} className="text-brand-500" />
              <span>{isUploading ? 'Uploading...' : 'Bulk Upload'}</span>
            </button>
            
            <button 
              onClick={downloadStudentList}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all text-sm shadow-sm"
            >
              <FileDown size={18} className="text-emerald-500" />
              <span>Export List</span>
            </button>

            <button 
              onClick={() => setIsModalOpen(true)}
              className="btn-primary flex items-center gap-2 px-6"
            >
              <UserPlus size={20} />
              <span>Register</span>
            </button>
          </div>
          <a 
            href="#"
            onClick={(e) => {
              e.preventDefault();
              const sample = [
                ['name', 'email', 'mobile', 'age', 'address', 'section'],
                ['John Doe', 'john@example.com', '1234567890', '15', '123 Street', 'A'],
                ['Jane Smith', 'jane@example.com', '0987654321', '14', '456 Avenue', 'B']
              ];
              const csv = sample.map(row => row.join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'sample_students.csv';
              a.click();
            }}
            className="text-[10px] font-bold text-brand-600 hover:underline uppercase tracking-widest"
          >
            Download Sample CSV Format
          </a>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name or ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 transition-all font-medium text-slate-700"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        {classFilter && (
          <button 
            onClick={() => navigate('/students')}
            className="px-4 py-2.5 bg-brand-50 text-brand-600 border border-brand-100 rounded-xl font-bold flex items-center gap-2 hover:bg-brand-100 transition-all"
          >
            <X size={18} />
            <span>Clear Filter</span>
          </button>
        )}
        <button className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-medium flex items-center gap-2 hover:bg-slate-50">
          <Filter size={18} />
          <span>Filters</span>
        </button>
      </div>

      {/* Student List Table */}
      <div className="dashboard-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">ID</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Student Name</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Class</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Mobile</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                 [1,2,3,4,5].map(i => <tr key={i} className="animate-pulse">
                   <td className="px-6 py-4"><div className="h-4 w-12 bg-slate-100 rounded"></div></td>
                   <td className="px-6 py-4"><div className="h-4 w-32 bg-slate-100 rounded"></div></td>
                   <td className="px-6 py-4"><div className="h-4 w-16 bg-slate-100 rounded"></div></td>
                   <td className="px-6 py-4"><div className="h-4 w-40 bg-slate-100 rounded"></div></td>
                   <td className="px-6 py-4"></td>
                 </tr>)
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">No students found</td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm font-bold text-brand-600">{student.uniqueId}</td>
                    <td className="px-6 py-4">
                      <Link to={`/students/${student.id}`} className="flex items-center gap-3 group">
                         <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs group-hover:bg-indigo-100 transition-colors overflow-hidden">
                            {student.photoURL ? (
                              <img src={student.photoURL} alt={student.displayName} className="w-full h-full object-cover" />
                            ) : (
                              student.displayName[0]
                            )}
                         </div>
                         <span className="font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">{student.displayName}</span>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <span className="font-medium text-slate-800">{classes.find(c => c.id === student.classId)?.name || 'N/A'}</span>
                        <span className="text-slate-400 ml-1">- {student.section}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{student.mobile ||'---'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => navigate(`/chat?uid=${student.id}`)}
                          className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                          title="Message Student"
                        >
                          <MessageSquare size={18} />
                        </button>
                        <Link 
                          to={`/students/${student.id}`}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="View Profile"
                        >
                          <ExternalLink size={18} />
                        </Link>
                        <div className="relative">
                           <button 
                             onClick={() => setActiveMenu(activeMenu === student.id ? null : student.id)}
                             className={`p-2 rounded-lg transition-colors ${activeMenu === student.id ? 'bg-slate-100 text-slate-600' : 'text-slate-400 hover:bg-slate-100'}`}
                           >
                             <MoreVertical size={18} />
                           </button>
                           {activeMenu === student.id && (
                             <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-xl z-20 py-1">
                                <button 
                                  onClick={() => {
                                    setStudentToDelete(student);
                                    setIsDeleteModalOpen(true);
                                    setActiveMenu(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                >
                                   <Trash2 size={14} /> Remove Student
                                </button>
                             </div>
                           )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl relative z-10 p-8"
          >
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Register Student</h2>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
                  <input 
                    type="text" required placeholder="Full Name"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                  <input 
                    type="email" placeholder="Email Address"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Mobile</label>
                  <input 
                    type="text" required placeholder="Mobile Number"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                    value={formData.mobile}
                    onChange={e => setFormData({...formData, mobile: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Age</label>
                  <input 
                    type="number" required placeholder="Age"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                    value={formData.age}
                    onChange={e => setFormData({...formData, age: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Date of Birth</label>
                <input 
                  type="date" required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                  value={formData.dob}
                  onChange={e => setFormData({...formData, dob: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Address</label>
                <input 
                  type="text" required placeholder="Home Address"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Class</label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                    value={formData.classId}
                    onChange={e => setFormData({...formData, classId: e.target.value})}
                  >
                    <option value="">Select Class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-1">Section</label>
                   <input 
                    type="text" placeholder="A, B..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                    value={formData.section}
                    onChange={e => setFormData({...formData, section: e.target.value})}
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary py-3">Register</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Deletion Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
              onClick={() => {
                setIsDeleteModalOpen(false);
                setStudentToDelete(null);
                setDeletionRemark('');
              }} 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] w-full max-w-xl p-10 shadow-2xl relative z-10"
            >
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-8">
                 <AlertTriangle size={32} />
              </div>
              
              <h2 className="text-3xl font-black text-slate-800 mb-2">Confirm Deletion</h2>
              <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                You are about to delete <span className="font-bold text-slate-800">{studentToDelete?.displayName}</span>. 
                According to school policy, you must provide a detailed justification (minimum 50 words) before this student can be removed from the system.
              </p>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Deletion Remarks / Justification</label>
                     <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${calculateWords(deletionRemark) >= 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {calculateWords(deletionRemark)} / 50 words
                     </span>
                  </div>
                  <textarea
                    rows={6}
                    placeholder="Provide a detailed reason for deleting this student record..."
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 text-sm leading-relaxed"
                    value={deletionRemark}
                    onChange={(e) => setDeletionRemark(e.target.value)}
                  />
                </div>
                
                <div className="flex gap-4 pt-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsDeleteModalOpen(false);
                      setStudentToDelete(null);
                      setDeletionRemark('');
                    }}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Cancel Action
                  </button>
                  <button 
                    onClick={handleDeleteStudent}
                    disabled={isDeleting || calculateWords(deletionRemark) < 50}
                    className="flex-2 py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all disabled:opacity-50 shadow-lg shadow-rose-100"
                  >
                    {isDeleting ? 'Processing...' : 'Permanently Delete Record'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
