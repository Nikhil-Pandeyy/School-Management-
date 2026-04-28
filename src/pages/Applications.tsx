import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  setDoc, 
  doc, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  FilePlus, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Send, 
  ChevronRight, 
  Search,
  Filter,
  User,
  Calendar,
  FileText,
  AlertCircle,
  Paperclip,
  ShieldCheck,
  FileIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';

const APP_TYPES = ["Leave", "Medical Leave", "Permission", "Complaint", "Admission", "Bonafide", "Transfer Certificate"];

export default function Applications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [filePreview, setFilePreview] = useState<{name: string, type: string}[]>([]);
  
  const [formData, setFormData] = useState({ 
    type: 'Leave', 
    title: '', 
    content: '', 
    fromDate: format(new Date(), 'yyyy-MM-dd'),
    toDate: format(new Date(), 'yyyy-MM-dd'),
    urgency: 'Normal'
  });

  const [reviewNote, setReviewNote] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.schoolId) return;

    let q;
    if (user.role === 'school-admin') {
      q = query(
        collection(db, 'schools', user.schoolId, 'applications'), 
        orderBy('createdAt', 'desc')
      );
    } else if (user.role === 'teacher') {
       q = query(
        collection(db, 'schools', user.schoolId, 'applications'), 
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        collection(db, 'schools', user.schoolId, 'applications'), 
        where('studentId', '==', user.uid), 
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setApplications(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'applications');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).map(f => ({ name: f.name, type: f.type }));
      setFilePreview(files);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;

    try {
      await addDoc(collection(db, 'schools', user.schoolId, 'applications'), {
        schoolId: user.schoolId,
        studentId: user.uid,
        studentName: user.displayName,
        studentRole: user.role,
        classId: user.classId || 'N/A',
        uniqueId: user.uniqueId || 'N/A',
        ...formData,
        attachments: filePreview, // Simulating file upload storage
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      setFilePreview([]);
      setFormData({ 
        type: 'Leave', 
        title: '', 
        content: '', 
        fromDate: format(new Date(), 'yyyy-MM-dd'),
        toDate: format(new Date(), 'yyyy-MM-dd'),
        urgency: 'Normal'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'applications');
    }
  };

  const handleReview = async (id: string, status: 'approved' | 'rejected') => {
    if (!user?.schoolId) return;
    try {
      await setDoc(doc(db, 'schools', user.schoolId, 'applications', id), { 
        status, 
        reviewedBy: user?.displayName,
        reviewNote: reviewNote || '',
        reviewedAt: new Date().toISOString()
      }, { merge: true });
      setReviewingId(null);
      setReviewNote('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `schools/${user.schoolId}/applications/${id}`);
    }
  };

  const filteredApps = applications.filter(app => {
    if (activeTab === 'all') return true;
    return app.status === activeTab;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-600';
      case 'rejected': return 'bg-rose-100 text-rose-600';
      default: return 'bg-amber-100 text-amber-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 size={12} />;
      case 'rejected': return <XCircle size={12} />;
      default: return <Clock size={12} />;
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Applications Hub</h1>
          <p className="text-slate-500 text-sm italic font-medium">Official requests and administrative applications.</p>
        </div>
        {(user?.role !== 'super-admin') && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <FilePlus size={20} />
            <span>Apply Now</span>
          </button>
        )}
      </header>

      {/* Tabs */}
      <div className="flex bg-white/50 p-1 rounded-xl w-fit border border-slate-200">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === tab 
                ? 'bg-white text-brand-600 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse border border-slate-100"></div>)
        ) : filteredApps.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
             <FileText className="mx-auto text-slate-100 mb-4" size={64} />
             <h3 className="text-xl font-bold text-slate-500">No applications found</h3>
             <p className="text-slate-400 mt-2">There are no records in this category.</p>
          </div>
        ) : (
          filteredApps.map((app) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={app.id} 
              className={`bg-white border rounded-2xl p-6 transition-all hover:shadow-xl hover:border-brand-100 group ${
                app.status === 'pending' ? 'border-amber-100' : 'border-slate-100'
              }`}
            >
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                       <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                         app.type.includes('Leave') ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-50 text-slate-500'
                       }`}>
                         {app.type}
                       </span>
                       <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${getStatusColor(app.status)}`}>
                         {getStatusIcon(app.status)}
                         {app.status}
                       </div>
                       {app.urgency === 'Urgent' && (
                         <span className="bg-rose-50 text-rose-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">Urgent</span>
                       )}
                       {app.type === 'Admission' && (
                         <button 
                           onClick={() => window.print()}
                           className="bg-brand-50 text-brand-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1 hover:bg-brand-100 transition-colors"
                         >
                            <FileText size={10} /> Download Receipt
                         </button>
                       )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">APP-{app.id.substring(0,8).toUpperCase()}</span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-800 mb-2">{app.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4">{app.content}</p>

                  <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-400">
                    <div className="flex items-center gap-1.5">
                       <Calendar size={14} className="text-slate-300" />
                       <span>{format(new Date(app.fromDate), 'MMM d')} - {format(new Date(app.toDate), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                       <User size={14} className="text-slate-300" />
                       <span className="text-slate-600 font-bold">{app.studentName}</span>
                       <span className="text-slate-300 uppercase">({app.studentRole})</span>
                    </div>
                    {app.attachments && app.attachments.length > 0 && (
                      <div className="flex items-center gap-2 text-indigo-500">
                        <Paperclip size={14} />
                        <span>{app.attachments.length} attachment(s)</span>
                      </div>
                    )}
                  </div>

                  {app.attachments && app.attachments.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {app.attachments.map((file: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-500 group-hover:border-brand-200 transition-colors">
                           <FileIcon size={12} className="text-indigo-400" />
                           {file.name}
                        </div>
                      ))}
                    </div>
                  )}

                  {app.reviewNote && (
                    <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                        <ShieldCheck size={10} /> Administrative Review
                      </p>
                      <p className="text-xs text-slate-600 italic">"{app.reviewNote}"</p>
                      <p className="text-[10px] text-brand-500 font-bold mt-2">— Reviewed by {app.reviewedBy}</p>
                    </div>
                  )}
                </div>

                {(user?.role === 'school-admin' || user?.role === 'teacher') && app.status === 'pending' && (
                  <div className="flex flex-col gap-2 min-w-[200px]">
                    {reviewingId === app.id ? (
                      <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                        <textarea 
                          placeholder="Review note (optional)..."
                          className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 min-h-[80px]"
                          value={reviewNote}
                          onChange={e => setReviewNote(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleReview(app.id, 'approved')}
                            className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors shadow-sm"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => handleReview(app.id, 'rejected')}
                            className="flex-1 py-2 bg-rose-500 text-white rounded-lg text-xs font-bold hover:bg-rose-600 transition-colors shadow-sm"
                          >
                            Reject
                          </button>
                        </div>
                        <button 
                          onClick={() => setReviewingId(null)}
                          className="w-full text-[10px] font-bold text-slate-400 hover:text-slate-600 py-1"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setReviewingId(app.id)}
                        className="w-full py-2.5 bg-brand-50 text-brand-600 rounded-xl text-xs font-bold hover:bg-brand-100 transition-all flex items-center justify-center gap-2"
                      >
                        Review Application <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* New Application Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
              onClick={() => setIsModalOpen(false)}
            ></motion.div>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-xl bg-white rounded-3xl shadow-2xl relative z-10 p-8 overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center">
                   <FilePlus size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Application Inquiry</h2>
                  <p className="text-slate-400 text-sm font-medium italic">General administrative request.</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Request Type</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-medium"
                      value={formData.type}
                      onChange={e => setFormData({...formData, type: e.target.value})}
                    >
                      {APP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Urgency</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-medium"
                      value={formData.urgency}
                      onChange={e => setFormData({...formData, urgency: e.target.value})}
                    >
                      <option value="Normal">Normal</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Subject</label>
                  <input 
                    type="text" required placeholder="Brief title of your request"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">From Date</label>
                    <input 
                      type="date" required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                      value={formData.fromDate}
                      onChange={e => setFormData({...formData, fromDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">To Date</label>
                    <input 
                      type="date" required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                      value={formData.toDate}
                      onChange={e => setFormData({...formData, toDate: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Detailed Inquiry</label>
                  <textarea 
                    required placeholder="Explain your request in detail..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 min-h-[120px] text-sm leading-relaxed"
                    value={formData.content}
                    onChange={e => setFormData({...formData, content: e.target.value})}
                  />
                </div>

                <div>
                   <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1 flex items-center justify-between">
                     <span>Upload Evidence (PDF/JPG/PNG)</span>
                     <span className="text-brand-500 lowercase font-normal italic">Simulated</span>
                   </label>
                   <div className="relative">
                      <input 
                        type="file" multiple
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div className="w-full px-4 py-3 bg-brand-50/50 border border-dashed border-brand-200 rounded-xl flex items-center justify-center gap-2 text-sm text-brand-600 font-bold hover:bg-brand-50 transition-colors">
                        <Paperclip size={18} />
                        {filePreview.length > 0 ? `${filePreview.length} File(s) Selected` : "Drop files here or click to upload"}
                      </div>
                   </div>
                   {filePreview.length > 0 && (
                     <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-400">
                        {filePreview.map((f, i) => <span key={i}>{f.name}</span>)}
                     </div>
                   )}
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest text-[10px]"
                  >
                    Discard
                  </button>
                  <button type="submit" className="flex-[2] btn-primary py-3 flex items-center justify-center gap-2 shadow-lg shadow-brand-200">
                     <Send size={18} />
                     <span>Forward Application</span>
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
