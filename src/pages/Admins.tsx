import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, query, where, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { UserPlus, UserRound, Shield, Trash2, Mail, User, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateUniqueId } from '../utils/idGenerator';

export default function Admins() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    mobile: ''
  });

  useEffect(() => {
    if (user?.schoolId) {
      fetchAdmins();
    }
  }, [user]);

  const fetchAdmins = async () => {
    try {
      if (!user?.schoolId) return;
      const q = query(collection(db, 'schools', user.schoolId, 'users'), where('role', '==', 'school-admin'));
      const snapshot = await getDocs(q);
      setAdmins(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;
    setIsSaving(true);
    try {
      const uniqueId = await generateUniqueId(user.schoolId);
      // Create nested profile for pending admin
      const userRef = doc(collection(db, 'schools', user.schoolId, 'users'));
      
      await setDoc(userRef, {
        displayName: formData.name,
        email: formData.email,
        mobile: formData.mobile,
        role: 'school-admin',
        schoolId: user.schoolId,
        uniqueId,
        isActivated: false,
        createdAt: new Date().toISOString()
      });

      setIsModalOpen(false);
      setFormData({ name: '', email: '', mobile: '' });
      fetchAdmins();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'users');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (adminId: string) => {
    if (adminId === user?.uid) {
      alert("You cannot delete your own admin account.");
      return;
    }
    
    if (!window.confirm("Are you sure you want to remove this admin? they will lose all access.")) return;
    
    try {
      if (!user?.schoolId) return;
      await deleteDoc(doc(db, 'schools', user.schoolId, 'users', adminId));
      // Also potentially delete from root /users if they were activated
      try {
        await deleteDoc(doc(db, 'users', adminId));
      } catch (e) {
        // Might not exist if not activated
      }
      fetchAdmins();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${adminId}`);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <ShieldCheck className="text-brand-600" size={32} />
             System Administrators
          </h1>
          <p className="text-slate-500 font-medium italic mt-1">Manage institutional administrative access and privileges.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto shadow-lg shadow-brand-100"
        >
          <UserPlus size={20} />
          <span>Add New Admin</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-48 bg-white rounded-[2.5rem] animate-pulse border border-slate-100"></div>)
        ) : admins.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
             <Shield className="mx-auto text-slate-200 mb-4" size={64} />
             <h3 className="text-xl font-bold text-slate-500">No additional admins</h3>
             <p className="text-slate-400 mt-2">You are currently the only administrator.</p>
          </div>
        ) : (
          admins.map((admin) => (
            <motion.div 
              layout
              key={admin.id} 
              className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group relative"
            >
              <div className="flex items-start justify-between mb-4">
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${admin.isActivated ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-400'}`}>
                    {admin.displayName ? admin.displayName[0] : <User size={20} />}
                 </div>
                 <div className="flex gap-2">
                    {admin.id === user?.uid && (
                      <span className="px-2 py-1 bg-brand-600 text-white text-[8px] font-black uppercase tracking-widest rounded-lg">You</span>
                    )}
                    <span className={`px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg ${admin.isActivated ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                       {admin.isActivated ? 'Active' : 'Pending Activation'}
                    </span>
                 </div>
              </div>

              <div className="space-y-1 mb-4">
                 <h3 className="font-black text-slate-800 tracking-tight">{admin.displayName || 'Unnamed Admin'}</h3>
                 <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest font-mono">ID: {admin.uniqueId || 'N/A'}</p>
              </div>

              <div className="space-y-2 mb-6">
                 <div className="flex items-center gap-2 text-xs text-slate-500 font-medium font-mono">
                    <Mail size={14} className="text-slate-400" />
                    <span className="truncate">{admin.email}</span>
                 </div>
              </div>

              {admin.id !== user?.uid && (
                <button 
                  onClick={() => handleDelete(admin.id)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white transition-all font-black text-xs uppercase tracking-widest"
                >
                   <Trash2 size={16} />
                   Remove Privileges
                </button>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Registration Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl relative z-10 p-8 border border-slate-100"
            >
              <div className="flex items-center gap-4 mb-8">
                 <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center">
                    <UserPlus size={24} />
                 </div>
                 <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Add Administrator</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Enroll new system user</p>
                 </div>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
                  <input 
                    type="text" required placeholder="Legal Name"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-sm"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
                  <input 
                    type="email" required placeholder="admin@school.com"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-sm"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Mobile Contact</label>
                  <input 
                    type="text" required placeholder="+1 XXX XXX XXXX"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-sm"
                    value={formData.mobile}
                    onChange={e => setFormData({...formData, mobile: e.target.value})}
                  />
                </div>
                
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl mb-4">
                   <p className="text-[10px] text-amber-800 font-medium leading-relaxed italic">
                      The new administrator will receive a Unique ID. They must then use the "Activate" feature on the login page to set their password.
                   </p>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Discard
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="flex-[2] btn-primary py-4 rounded-2xl shadow-lg shadow-brand-100 flex items-center justify-center gap-2"
                  >
                    {isSaving ? 'Enrolling...' : 'Grant Access'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
