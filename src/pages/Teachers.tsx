import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, query, where, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { useNavigate } from 'react-router-dom';
import { UserPlus, UserRound, Search, MoreVertical, Briefcase, GraduationCap, ChevronRight, School, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';
import { generateUniqueId } from '../utils/idGenerator';

export default function Teachers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    mobile: '', 
    address: '', 
    qualification: '', 
    age: '', 
    dob: '',
    subject: '' 
  });
  const [assignData, setAssignData] = useState({ classId: '', section: '' });

  useEffect(() => {
    if (user?.schoolId) {
      fetchTeachers();
      fetchClasses();
    }
  }, [user]);

  const fetchTeachers = async () => {
    if (!user?.schoolId) return;
    const q = query(collection(db, 'schools', user.schoolId, 'users'), where('role', '==', 'teacher'));
    const snapshot = await getDocs(q);
    setTeachers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  const fetchClasses = async () => {
    if (!user?.schoolId) return;
    const q = query(collection(db, 'schools', user.schoolId, 'classes'));
    const snapshot = await getDocs(q);
    setClasses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
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
        email: formData.email,
        mobile: formData.mobile,
        address: formData.address,
        qualification: formData.qualification,
        age: Number(formData.age),
        dob: formData.dob,
        subject: formData.subject,
        role: 'teacher',
        schoolId: user.schoolId,
        uniqueId,
        hideBirthday: false,
        createdAt: new Date().toISOString()
      });

      setIsModalOpen(false);
      setFormData({ name: '', email: '', mobile: '', address: '', qualification: '', age: '', dob: '', subject: '' });
      fetchTeachers();
    } catch (err) {
      console.error(err);
    }
  };

  const openAssignModal = (teacher: any) => {
    setSelectedTeacher(teacher);
    setIsAssignModalOpen(true);
  };

  const handleAssignClass = async (classId: string) => {
    if (!user?.schoolId || !selectedTeacher) return;
    try {
      const currentAssigned = selectedTeacher.assignedClasses || [];
      const isAlreadyAssigned = currentAssigned.includes(classId);
      
      let updatedClasses;
      if (isAlreadyAssigned) {
        updatedClasses = currentAssigned.filter((id: string) => id !== classId);
      } else {
        updatedClasses = [...currentAssigned, classId];
      }

      await updateDoc(doc(db, 'schools', user.schoolId, 'users', selectedTeacher.id), {
        assignedClasses: updatedClasses,
        updatedAt: new Date().toISOString()
      });

      fetchTeachers();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `schools/${user.schoolId}/users/${selectedTeacher.id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Faculty Management</h1>
          <p className="text-slate-500 text-sm">Register teachers and assign them to respective classes.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto shadow-lg shadow-brand-100"
        >
          <UserPlus size={20} />
          <span>Add Teacher</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-64 bg-white rounded-3xl animate-pulse border border-slate-100"></div>)
        ) : teachers.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
             <UserRound className="mx-auto text-slate-200 mb-4" size={64} />
             <h3 className="text-xl font-bold text-slate-500">No teachers registered yet</h3>
             <p className="text-slate-400 mt-2">Begin by inviting your teaching staff.</p>
          </div>
        ) : (
          teachers.map((teacher) => (
            <div key={teacher.id} className="dashboard-card group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
                    <MoreVertical size={18} />
                 </button>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-xl overflow-hidden">
                   {teacher.photoURL ? (
                     <img src={teacher.photoURL} alt={teacher.displayName} className="w-full h-full object-cover" />
                   ) : (
                     teacher.displayName[0]
                   )}
                </div>
                <div>
                   <h3 className="font-bold text-slate-800">{teacher.displayName}</h3>
                   <p className="text-xs font-mono text-brand-600 uppercase tracking-tighter">ID: {teacher.uniqueId}</p>
                </div>
                <button 
                    onClick={() => navigate(`/chat?uid=${teacher.id}`)}
                    className="ml-auto p-2 bg-brand-50 text-brand-600 rounded-xl hover:bg-brand-600 hover:text-white transition-all shadow-sm group"
                    title="Send Private Message"
                >
                    <MessageSquare size={18} className="group-hover:scale-110 transition-transform" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Qualification</p>
                  <p className="text-sm font-medium text-slate-700">{teacher.qualification || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Subject</p>
                   <p className="text-sm font-medium text-slate-700">{teacher.subject || 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex flex-wrap gap-1.5">
                  {(teacher.assignedClasses || []).length > 0 ? (
                    teacher.assignedClasses.map((cId: string) => {
                      const cls = classes.find(c => c.id === cId);
                      return (
                        <div key={cId} className="px-2 py-1 bg-brand-50 text-brand-600 rounded-lg text-[10px] font-bold border border-brand-100 flex items-center gap-1">
                           <Briefcase size={10} />
                           {cls ? `${cls.name}-${cls.section}` : 'Class'}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400 italic">No classes assigned</p>
                  )}
                </div>
              </div>

              <button 
                onClick={() => openAssignModal(teacher)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-brand-100 text-brand-600 font-bold text-sm bg-brand-50/50 hover:bg-brand-50 transition-all"
              >
                <GraduationCap size={16} />
                <span>Assign Class</span>
                <ChevronRight size={14} className="ml-auto" />
              </button>
            </div>
          ))
        )}
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
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Register Teacher</h2>
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
                    type="email" required placeholder="Email Address"
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
                  type="text" required placeholder="Residential Address"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Qualification</label>
                  <input 
                    type="text" required placeholder="e.g. M.Sc, B.Ed"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                    value={formData.qualification}
                    onChange={e => setFormData({...formData, qualification: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Subject</label>
                  <input 
                    type="text" required placeholder="Primary Subject"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                    value={formData.subject}
                    onChange={e => setFormData({...formData, subject: e.target.value})}
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

      {/* Assign Class Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAssignModalOpen(false)}></div>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl relative z-10 p-8"
          >
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Class Assignments</h2>
            <p className="text-slate-500 text-sm mb-6">Manage specific classes for <span className="font-bold text-slate-900">{selectedTeacher?.displayName}</span>.</p>
            
            <div className="space-y-4">
              <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {classes.map(c => {
                  const isAssigned = (selectedTeacher?.assignedClasses || []).includes(c.id);
                  return (
                    <div 
                      key={c.id} 
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${isAssigned ? 'bg-brand-50 border-brand-200' : 'bg-slate-50 border-slate-100'}`}
                    >
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{c.name} - {c.section}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Classroom ID: {c.id.substring(0, 8)}</p>
                      </div>
                      <button 
                        onClick={() => handleAssignClass(c.id)}
                        className={`px-4 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${
                          isAssigned 
                          ? 'bg-rose-500 text-white shadow-md shadow-rose-100' 
                          : 'bg-white text-brand-600 border border-brand-100 hover:bg-brand-50'
                        }`}
                      >
                        {isAssigned ? 'Remove' : 'Assign'}
                      </button>
                    </div>
                  );
                })}
              </div>
              
              <button 
                onClick={() => setIsAssignModalOpen(false)}
                className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-colors"
              >
                Finished
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
