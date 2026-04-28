import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Plus, School, Users, Search, MoreVertical, Trash2, Edit, X, User, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';

export default function Classes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [studentsInClass, setStudentsInClass] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [newClass, setNewClass] = useState({ name: '', section: '', teacherId: '', isActive: true });
  const [teachers, setTeachers] = useState<any[]>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);

  useEffect(() => {
    if (user?.schoolId) {
      fetchClasses();
      fetchTeachers();
    }
  }, [user]);

  const fetchClasses = async () => {
    try {
      if (!user?.schoolId) return;
      const q = query(collection(db, 'schools', user.schoolId, 'classes'));
      const snapshot = await getDocs(q);
      setClasses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'classes');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      if (!user?.schoolId) return;
      const q = query(collection(db, 'schools', user.schoolId, 'users'), where('role', '==', 'teacher'));
      const snapshot = await getDocs(q);
      setTeachers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'users');
    }
  };

  const fetchStudents = async (classId: string) => {
    setLoadingStudents(true);
    try {
      if (!user?.schoolId) return;
      const q = query(
        collection(db, 'schools', user.schoolId, 'users'), 
        where('classId', '==', classId),
        where('role', '==', 'student')
      );
      const snapshot = await getDocs(q);
      setStudentsInClass(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'users');
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;
    try {
      if (editingClass) {
        await updateDoc(doc(db, 'schools', user.schoolId, 'classes', editingClass.id), {
          name: newClass.name,
          section: newClass.section,
          teacherId: newClass.teacherId,
          isActive: newClass.isActive,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'schools', user.schoolId, 'classes'), {
          ...newClass,
          schoolId: user.schoolId,
          studentCount: 0,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingClass(null);
      setNewClass({ name: '', section: '', teacherId: '', isActive: true });
      fetchClasses();
    } catch (err) {
      handleFirestoreError(err, editingClass ? OperationType.UPDATE : OperationType.CREATE, 'classes');
    }
  };

  const handleDelete = async (classId: string) => {
    if (!window.confirm('Are you sure you want to delete this class? This cannot be undone.')) return;
    try {
      if (!user?.schoolId) return;
      await deleteDoc(doc(db, 'schools', user.schoolId, 'classes', classId));
      fetchClasses();
      setActiveMenu(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `classes/${classId}`);
    }
  };

  const openEditModal = (cls: any) => {
    setEditingClass(cls);
    setNewClass({ 
      name: cls.name, 
      section: cls.section, 
      teacherId: cls.teacherId || '', 
      isActive: cls.isActive !== undefined ? cls.isActive : true 
    });
    setIsModalOpen(true);
    setActiveMenu(null);
  };

  const toggleClassStatus = async (cls: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (!user?.schoolId) return;
      await updateDoc(doc(db, 'schools', user.schoolId, 'classes', cls.id), {
        isActive: !cls.isActive
      });
      fetchClasses();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `classes/${cls.id}`);
    }
  };

  const handleEnrollStudent = async () => {
    if (!enrollStudentId.trim() || !selectedClassId || !user?.schoolId) return;
    setIsEnrolling(true);
    try {
      const q = query(collection(db, 'schools', user.schoolId, 'users'), 
        where('uniqueId', '==', enrollStudentId.trim()),
        where('role', '==', 'student')
      );
      const snap = await getDocs(q);
      
      if (snap.empty) {
        alert('Student not found with this ID');
        setIsEnrolling(false);
        return;
      }

      const studentDoc = snap.docs[0];
      await updateDoc(doc(db, 'schools', user.schoolId, 'users', studentDoc.id), {
        classId: selectedClassId
      });

      // Update class student count
      const classRef = doc(db, 'schools', user.schoolId, 'classes', selectedClassId);
      const classSnap = await getDocs(query(collection(db, 'schools', user.schoolId, 'users'), where('classId', '==', selectedClassId), where('role', '==', 'student')));
      await updateDoc(classRef, { studentCount: classSnap.size });

      setEnrollStudentId('');
      setIsAddStudentModalOpen(false);
      fetchStudents(selectedClassId); // Refresh list
      fetchClasses(); // Refresh class counts
      alert('Student enrolled successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Class Management</h1>
          <p className="text-slate-500 text-sm">Create and organize school classes and sections.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus size={20} />
          <span>New Class</span>
        </button>
      </div>

      {/* Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-40 bg-white rounded-2xl animate-pulse border border-slate-100"></div>)
        ) : classes.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300">
             <School className="mx-auto text-slate-300 mb-4" size={48} />
             <h3 className="text-lg font-bold text-slate-600">No classes found</h3>
             <p className="text-slate-400 text-sm">Start by creating your first class section.</p>
          </div>
        ) : (
          classes.map((cls) => (
            <div 
              key={cls.id} 
              onClick={() => {
                setSelectedClassId(cls.id);
                fetchStudents(cls.id);
              }}
              className="dashboard-card group cursor-pointer hover:shadow-lg transition-all"
            >
              <div className="flex justify-between items-start mb-6">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  cls.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                }`}>
                  <School size={24} />
                </div>
                <div className="relative">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenu(activeMenu === cls.id ? null : cls.id);
                    }}
                    className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <MoreVertical size={20} />
                  </button>
                  {activeMenu === cls.id && (
                    <div className="absolute right-0 mt-2 w-36 bg-white border border-slate-100 rounded-xl shadow-xl z-20 overflow-hidden py-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); openEditModal(cls); }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Edit size={14} /> Edit
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(cls.id); }}
                        className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{cls.name}</h3>
                  <p className="text-slate-500 text-sm font-medium">Section {cls.section}</p>
                </div>
                <div 
                  onClick={(e) => toggleClassStatus(cls, e)}
                  className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${
                    cls.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${
                    cls.isActive ? 'left-6' : 'left-1'
                  }`}></div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-500">
                  <Users size={16} />
                  <span className="text-sm font-medium">{cls.studentCount || 0} Students</span>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/students?classId=${cls.id}`);
                  }}
                  className="text-[10px] font-bold text-brand-600 hover:bg-brand-50 px-2 py-1 rounded transition-colors"
                >
                  View All
                </button>
                <div className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-widest ${
                  cls.isActive ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 bg-slate-50'
                }`}>
                   {cls.isActive ? 'Active' : 'Inactive'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Students In Class Modal */}
      <AnimatePresence>
        {selectedClassId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
               onClick={() => setSelectedClassId(null)}
             ></motion.div>
             <motion.div 
               initial={{ scale: 0.9, opacity: 0, y: 20 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.9, opacity: 0, y: 20 }}
               className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[80vh]"
             >
               <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center">
                      <GraduationCap size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-800">Students List</h2>
                      <p className="text-xs text-slate-500 font-medium">
                        {classes.find(c => c.id === selectedClassId)?.name} - Section {classes.find(c => c.id === selectedClassId)?.section}
                      </p>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                   <button 
                     onClick={() => setIsAddStudentModalOpen(true)}
                     className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition-all flex items-center gap-2 shadow-sm"
                   >
                      <Plus size={14} /> Enroll Student
                   </button>
                   <button 
                    onClick={() => setSelectedClassId(null)}
                    className="p-2 text-slate-400 hover:bg-white hover:text-slate-600 rounded-full transition-all"
                   >
                     <X size={20} />
                   </button>
                 </div>
               </div>

               <div className="flex-1 overflow-y-auto p-6">
                 {loadingStudents ? (
                   <div className="space-y-4">
                     {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse"></div>)}
                   </div>
                 ) : studentsInClass.length === 0 ? (
                   <div className="text-center py-12">
                     <User className="mx-auto text-slate-200 mb-4" size={48} />
                     <p className="text-slate-400 font-medium">No students enrolled in this class yet.</p>
                   </div>
                 ) : (
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     {studentsInClass.map((student) => (
                       <div 
                         key={student.id} 
                         onClick={() => {
                           setSelectedClassId(null);
                           navigate(`/students/${student.id}`);
                         }}
                         className="p-4 rounded-2xl border border-slate-100 flex items-center gap-3 hover:border-brand-200 transition-colors bg-white hover:shadow-sm cursor-pointer"
                       >
                          <div className="w-10 h-10 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                             {student.photoURL ? (
                               <img src={student.photoURL} alt={student.displayName} className="w-full h-full object-cover" />
                             ) : (
                               <div className="w-full h-full flex items-center justify-center text-slate-400">
                                 <User size={20} />
                               </div>
                             )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{student.displayName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">ID: {student.uniqueId || 'N/A'}</p>
                          </div>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Integration (Create/Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl relative z-10 p-8"
          >
            <h2 className="text-2xl font-bold text-slate-800 mb-6">
              {editingClass ? 'Edit Class' : 'Create New Class'}
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Class Name / Grade</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Class 10"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                  value={newClass.name}
                  onChange={e => setNewClass({...newClass, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Section</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. A, B, or C"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                  value={newClass.section}
                  onChange={e => setNewClass({...newClass, section: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Assign Class Teacher (Optional)</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                  value={newClass.teacherId}
                  onChange={e => setNewClass({...newClass, teacherId: e.target.value})}
                >
                  <option value="">Select Teacher</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.displayName}</option>)}
                </select>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                 <span className="text-sm font-semibold text-slate-700">Active Status</span>
                 <div 
                  onClick={() => setNewClass({...newClass, isActive: !newClass.isActive})}
                  className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${
                    newClass.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${
                    newClass.isActive ? 'left-6' : 'left-1'
                  }`}></div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 btn-primary py-3"
                >
                  {editingClass ? 'Update Class' : 'Create Class'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Add Student Modal */}
      <AnimatePresence>
        {isAddStudentModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
              onClick={() => setIsAddStudentModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl relative z-10"
            >
              <h2 className="text-2xl font-black text-slate-800 mb-2">Enroll Student</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-8">Enter the unique student ID to assign them to this class.</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Student Unique ID</label>
                  <input
                    type="text"
                    placeholder="e.g. ST-1001"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 font-mono tracking-widest text-sm"
                    value={enrollStudentId}
                    onChange={(e) => setEnrollStudentId(e.target.value.toUpperCase())}
                  />
                </div>
                
                <div className="flex gap-4 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsAddStudentModalOpen(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleEnrollStudent}
                    disabled={isEnrolling || !enrollStudentId.trim()}
                    className="flex-1 py-4 bg-brand-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-700 transition-all disabled:opacity-50 shadow-lg shadow-brand-100"
                  >
                    {isEnrolling ? 'Enrolling...' : 'Confirm'}
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
