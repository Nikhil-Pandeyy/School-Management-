import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { Shield, CheckCircle2, Lock, Save, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const MODULES = [
  { id: 'enableAttendance', name: 'Attendance Tracking', desc: 'Allow teachers to mark and manage daily student attendance.' },
  { id: 'enableResults', name: 'Results & Academics', desc: 'Enable grade entry and result management modules.' },
  { id: 'enableChat', name: 'Internal Messaging', desc: 'Activate the school-wide chat system for staff and students.' },
  { id: 'enableApplications', name: 'Applications & Leaves', desc: 'Process student leave requests and permission forms digitally.' },
  { id: 'enableComplaints', name: 'Helpdesk & Complaints', desc: 'Allow users to raise issues and track their resolution.' },
  { id: 'enableBirthdays', name: 'Birthday Celebrations', desc: 'Show upcoming birthdays on dashboard and allow wishing.' },
  { id: 'allowStudentToStudentChat', name: 'Student-to-Student Chat', desc: 'Toggle whether students can initiate private chats with other students.' }
];

export default function Permissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    if (user?.schoolId) {
      fetchPermissions();
    }
  }, [user]);

  const fetchPermissions = async () => {
    try {
      const snap = await getDoc(doc(db, 'schools', user!.schoolId));
      if (snap.exists()) {
        const data = snap.data();
        setPermissions(data.permissions || {
          enableAttendance: true,
          enableResults: true,
          enableChat: true,
          enableApplications: true,
          enableComplaints: true,
          enableBirthdays: true
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `schools/${user?.schoolId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (moduleId: string) => {
    setPermissions((prev: any) => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  const handleSave = async () => {
    if (!user?.schoolId) return;
    setIsSaving(true);
    setMessage(null);
    try {
      await setDoc(doc(db, 'schools', user.schoolId), {
        permissions,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setMessage({ type: 'success', text: 'Permissions updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `schools/${user.schoolId}`);
      setMessage({ type: 'error', text: 'Failed to update permissions.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <Shield className="text-brand-600" size={32} />
             Permission Control
          </h1>
          <p className="text-slate-500 font-medium italic mt-1">Configure module visibility and access for your institution.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary py-3 px-8 flex items-center gap-3 shadow-lg shadow-brand-100 disabled:opacity-50"
        >
          <Save size={18} />
          <span>{isSaving ? 'Saving...' : 'Deploy Changes'}</span>
        </button>
      </header>

      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-2xl flex items-center gap-3 font-bold border ${
              message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'
            }`}
          >
             {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
             {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MODULES.map((module) => (
          <div 
            key={module.id}
            className={`p-6 rounded-[2.5rem] border transition-all relative overflow-hidden group ${
              permissions[module.id] ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-80'
            }`}
          >
             <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-2xl ${permissions[module.id] ? 'bg-brand-50 text-brand-600' : 'bg-slate-200 text-slate-400'}`}>
                   {permissions[module.id] ? <CheckCircle2 size={24} /> : <Lock size={24} />}
                </div>
                <button 
                  onClick={() => handleToggle(module.id)}
                  className={`w-12 h-6 rounded-full relative transition-colors ${permissions[module.id] ? 'bg-brand-600' : 'bg-slate-300'}`}
                >
                   <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${permissions[module.id] ? 'left-6.5' : 'left-0.5'}`}></div>
                </button>
             </div>

             <h3 className={`text-lg font-black tracking-tight mb-2 ${permissions[module.id] ? 'text-slate-800' : 'text-slate-400'}`}>
                {module.name}
             </h3>
             <p className={`text-xs leading-relaxed font-semibold ${permissions[module.id] ? 'text-slate-500' : 'text-slate-400 opacity-60'}`}>
                {module.desc}
             </p>

             {!permissions[module.id] && (
               <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px] pointer-events-none" />
             )}
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2.5rem] flex gap-4">
         <div className="mt-1 text-amber-600"><AlertCircle size={24} /></div>
         <div>
            <p className="text-sm font-black text-amber-900 uppercase tracking-widest mb-1">Warning: Global Visibility</p>
            <p className="text-xs text-amber-800/80 font-medium leading-relaxed">
               Disabling a module will hide it from the navigation menu for all users (Teachers, Students, and Parents). This action does not delete any data but restricts access. Please ensure your staff is informed before making these changes.
            </p>
         </div>
      </div>
    </div>
  );
}
