import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, addDoc, getDocs, query, where, orderBy, setDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AlertCircle, MessageSquarePlus, CheckCircle2, Clock, Send, ChevronRight, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

export default function Complaints() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ title: '', message: '' });

  useEffect(() => {
    if (user?.schoolId) {
      fetchComplaints();
    }
  }, [user]);

  const fetchComplaints = async () => {
    let q;
    if (user?.role === 'school-admin') {
      q = query(collection(db, 'schools', user.schoolId, 'complaints'), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'schools', user?.schoolId as string, 'complaints'), where('userId', '==', user?.uid), orderBy('createdAt', 'desc'));
    }
    const snapshot = await getDocs(q);
    setComplaints(snapshot.docs.map(d => ({ id: d.id, ...d.data() as any })));
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;
    try {
      await addDoc(collection(db, 'schools', user.schoolId, 'complaints'), {
        schoolId: user.schoolId,
        userId: user.uid,
        userName: user.displayName,
        userRole: user.role,
        ...formData,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      setFormData({ title: '', message: '' });
      fetchComplaints();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolve = async (id: string) => {
    const resolution = prompt("Enter resolution message:");
    if (!resolution || !user?.schoolId) return;
    
    try {
      await setDoc(doc(db, 'schools', user.schoolId, 'complaints', id), { 
        status: 'resolved',
        resolution: resolution,
        resolvedAt: new Date().toISOString()
      }, { merge: true });
      fetchComplaints();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Complaints & Suggestions</h1>
          <p className="text-slate-500 text-sm">Help us improve by sharing your concerns or feedback.</p>
        </div>
        {user?.role !== 'school-admin' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <MessageSquarePlus size={20} />
            <span>Raise Issue</span>
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          [1,2].map(i => <div key={i} className="h-60 bg-white rounded-3xl animate-pulse border border-slate-100"></div>)
        ) : complaints.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
             <AlertCircle className="mx-auto text-slate-200 mb-4" size={64} />
             <h3 className="text-xl font-bold text-slate-500">All clear!</h3>
             <p className="text-slate-400 mt-2">No active complaints or suggestions at this time.</p>
          </div>
        ) : (
          complaints.map((comp) => (
            <motion.div 
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              key={comp.id} 
              className={`dashboard-card flex flex-col justify-between ${comp.status === 'resolved' ? 'bg-slate-50/50' : 'bg-white'}`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    comp.status === 'resolved' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {comp.status === 'resolved' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                    {comp.status}
                  </div>
                  <span className="text-xs text-slate-400 font-medium">#{comp.id.substring(0,6)}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">{comp.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-3">{comp.message}</p>
                {comp.resolution && (
                  <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50 mb-6">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 italic">Resolution Outcome</p>
                    <p className="text-xs text-emerald-800 leading-relaxed font-medium">{comp.resolution}</p>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                      <User size={14} />
                   </div>
                   <div>
                      <p className="text-xs font-bold text-slate-700">{comp.userName}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-tighter">{comp.userRole}</p>
                   </div>
                </div>
                {user?.role === 'school-admin' && comp.status === 'pending' && (
                  <button 
                    onClick={() => handleResolve(comp.id)}
                    className="flex items-center gap-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 px-3 py-2 rounded-lg transition-colors"
                  >
                    Resolve Now <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Raise Issue Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl relative z-10 p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center">
                 <MessageSquarePlus size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Support Request</h2>
                <p className="text-slate-500 text-sm">Tell us what's on your mind.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Subject</label>
                <input 
                  type="text" required placeholder="Brief title of the issue"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Message</label>
                <textarea 
                  required placeholder="Describe the issue or suggestion in detail..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 min-h-[150px]"
                  value={formData.message}
                  onChange={e => setFormData({...formData, message: e.target.value})}
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  Discard
                </button>
                <button type="submit" className="flex-1 btn-primary py-3 flex items-center justify-center gap-2">
                   <Send size={18} />
                   <span>Send Feedback</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
