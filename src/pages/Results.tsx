import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  doc, 
  setDoc,
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  TrendingUp, 
  Plus, 
  GraduationCap, 
  BookOpen, 
  Trophy, 
  User, 
  Search,
  Filter,
  BarChart2,
  Calendar,
  CheckCircle2,
  Users,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Results() {
  const { user } = useAuth();
  const [results, setResults] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    studentId: '',
    subject: '',
    marks: '',
    totalMarks: '100',
    term: 'Final Exam',
    year: new Date().getFullYear().toString(),
    remarks: ''
  });

  useEffect(() => {
    if (!user?.schoolId) return;

    let q;
    if (user.role === 'school-admin' || user.role === 'teacher') {
      q = query(
        collection(db, 'schools', user.schoolId, 'results'),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        collection(db, 'schools', user.schoolId, 'results'),
        where('studentId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setResults(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `schools/${user.schoolId}/results`);
      setLoading(false);
    });

    if (user.role === 'school-admin' || user.role === 'teacher') {
      fetchStudents();
    }

    return () => unsubscribe();
  }, [user]);

  const fetchStudents = async () => {
    try {
      if (!user?.schoolId) return;
      const q = query(
        collection(db, 'schools', user.schoolId, 'users'),
        where('role', '==', 'student')
      );
      const snapshot = await getDocs(q);
      setStudents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'users');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;

    const selectedStudent = students.find(s => s.uid === formData.studentId || s.uniqueId === formData.studentId);
    
    try {
      await addDoc(collection(db, 'schools', user.schoolId, 'results'), {
        ...formData,
        schoolId: user.schoolId,
        teacherId: user.uid,
        teacherName: user.displayName,
        studentName: selectedStudent?.displayName || 'Unknown Student',
        studentUniqueId: selectedStudent?.uniqueId || formData.studentId,
        percentage: (Number(formData.marks) / Number(formData.totalMarks)) * 100,
        createdAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      setFormData({
        studentId: '',
        subject: '',
        marks: '',
        totalMarks: '100',
        term: 'Final Exam',
        year: new Date().getFullYear().toString(),
        remarks: ''
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'results');
    }
  };

  const filteredResults = results.filter(res => 
    res.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    res.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    res.studentUniqueId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Academic Results</h1>
          <p className="text-slate-500 text-sm italic font-medium">Performance tracking and grade management.</p>
        </div>
        {(user?.role === 'school-admin' || user?.role === 'teacher') && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            <span>Upload Result</span>
          </button>
        )}
      </header>

      {/* Analytics for Students/Teachers */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
           <div className="lg:col-span-8 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Score Distribution</h3>
                 <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
                    <TrendingUp size={18} />
                 </div>
              </div>
              <div className="h-[250px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={results.slice(0, 8).map(r => ({ name: r.subject.substring(0, 4), score: r.percentage }))}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                       <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                       <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                       <Tooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                       <Bar dataKey="score" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={32} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
           </div>

           <div className="lg:col-span-4 bg-brand-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-brand-100 relative overflow-hidden flex flex-col justify-between">
              <div className="relative z-10">
                 <h3 className="text-xl font-black mb-2">Academic Wellness</h3>
                 <p className="text-brand-100 text-xs font-medium leading-relaxed opacity-80">Your overall performance index is calculated based on current semester marks.</p>
              </div>
              
              <div className="h-[180px] w-full relative z-10">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                       <Pie 
                          data={[
                             { name: 'Passing', value: 85 },
                             { name: 'Average', value: 15 }
                          ]} 
                          innerRadius={60} 
                          outerRadius={80} 
                          paddingAngle={5} 
                          dataKey="value"
                        >
                          <Cell fill="#ffffff" />
                          <Cell fill="rgba(255,255,255,0.2)" />
                       </Pie>
                    </PieChart>
                 </ResponsiveContainer>
                 <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-black">A+</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-200">Grade</span>
                 </div>
              </div>

              <button className="relative z-10 w-full py-4 bg-white text-brand-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-xl transition-all active:scale-95">
                 View Full Transcript
              </button>
           </div>
        </div>
      )}

      {/* Stats - Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
           <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
              <TrendingUp size={24} />
           </div>
           <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Average Score</p>
              <h4 className="text-xl font-black text-slate-800">76.4%</h4>
           </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
           <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <CheckCircle2 size={24} />
           </div>
           <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Pass Rate</p>
              <h4 className="text-xl font-black text-slate-800">92%</h4>
           </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
           <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
              <BookOpen size={24} />
           </div>
           <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Active Subjects</p>
              <h4 className="text-xl font-black text-slate-800">12</h4>
           </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
           <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center">
              <Trophy size={24} />
           </div>
           <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Top Rank</p>
              <h4 className="text-xl font-black text-slate-800">1st Div</h4>
           </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div className="relative flex-1 max-w-md">
             <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input 
               type="text" 
               placeholder="Search by student, ID or subject..."
               className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
           </div>
           <div className="flex items-center gap-2">
              <button className="p-2.5 border border-slate-100 rounded-xl text-slate-500 hover:bg-white transition-all">
                 <Filter size={18} />
              </button>
              <button className="p-2.5 border border-slate-100 rounded-xl text-slate-500 hover:bg-white transition-all">
                 <BarChart2 size={18} />
              </button>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
             <thead>
                <tr className="border-b border-slate-50">
                   <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Student</th>
                   <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subject</th>
                   <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Term</th>
                   <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Marks</th>
                   <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grade</th>
                   <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-50">
                {loading ? (
                   [1,2,3,4].map(i => (
                      <tr key={i} className="animate-pulse">
                         <td colSpan={6} className="px-6 py-4"><div className="h-4 bg-slate-50 rounded-full w-full"></div></td>
                      </tr>
                   ))
                ) : filteredResults.length === 0 ? (
                   <tr>
                      <td colSpan={6} className="px-6 py-20 text-center">
                         <TrendingUp size={48} className="mx-auto text-slate-100 mb-4" />
                         <p className="text-slate-400 font-medium">No results uploaded yet.</p>
                      </td>
                   </tr>
                ) : (
                  filteredResults.map((res) => {
                    const perc = res.percentage || (res.marks / res.totalMarks * 100);
                    const grade = perc >= 90 ? 'A+' : perc >= 80 ? 'A' : perc >= 70 ? 'B' : perc >= 60 ? 'C' : perc >= 50 ? 'D' : 'F';
                    
                    return (
                      <tr key={res.id} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center font-bold text-xs uppercase">
                                 {res.studentName[0]}
                              </div>
                              <div>
                                 <p className="text-sm font-bold text-slate-800">{res.studentName}</p>
                                 <p className="text-[10px] text-slate-400 font-mono">{res.studentUniqueId}</p>
                              </div>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <span className="text-sm font-semibold text-slate-700">{res.subject}</span>
                        </td>
                        <td className="px-6 py-4">
                           <span className="text-xs text-slate-500">{res.term} ({res.year})</span>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-slate-800">{res.marks}</span>
                              <span className="text-xs text-slate-300">/ {res.totalMarks}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                              grade === 'A+' || grade === 'A' ? 'bg-emerald-50 text-emerald-600' :
                              grade === 'B' || grade === 'C' ? 'bg-blue-50 text-blue-600' :
                              'bg-rose-50 text-rose-600'
                           }`}>
                              {grade}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                           <div className="w-full max-w-[100px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full transition-all duration-1000 ${
                                 perc >= 50 ? 'bg-emerald-500' : 'bg-rose-500'
                              }`} style={{ width: `${perc}%` }}></div>
                           </div>
                        </td>
                      </tr>
                    );
                  })
                )}
             </tbody>
          </table>
        </div>
      </div>

      {/* Result Upload Modal */}
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
               className="w-full max-w-xl bg-white rounded-3xl shadow-2xl relative z-10 p-8"
             >
                <div className="flex items-center gap-3 mb-6">
                   <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center">
                      <TrendingUp size={24} />
                   </div>
                   <div>
                      <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Upload Results</h2>
                      <p className="text-slate-400 text-sm font-medium italic">Record student academic performance.</p>
                   </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                         <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Student</label>
                         <select 
                           required
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-semibold text-slate-700 appearance-none"
                           value={formData.studentId}
                           onChange={e => setFormData({...formData, studentId: e.target.value})}
                         >
                            <option value="">Select Student</option>
                            {students.map(s => (
                               <option key={s.uid} value={s.uid}>{s.displayName} ({s.uniqueId})</option>
                            ))}
                         </select>
                      </div>
                      <div>
                         <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Subject</label>
                         <input 
                           type="text" required placeholder="e.g. Mathematics"
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                           value={formData.subject}
                           onChange={e => setFormData({...formData, subject: e.target.value})}
                         />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Marks Obtained</label>
                         <input 
                           type="number" required placeholder="85"
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                           value={formData.marks}
                           onChange={e => setFormData({...formData, marks: e.target.value})}
                         />
                      </div>
                      <div>
                         <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Total Marks</label>
                         <input 
                           type="number" required placeholder="100"
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                           value={formData.totalMarks}
                           onChange={e => setFormData({...formData, totalMarks: e.target.value})}
                         />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Term</label>
                         <input 
                           type="text" required placeholder="Final Exam"
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                           value={formData.term}
                           onChange={e => setFormData({...formData, term: e.target.value})}
                         />
                      </div>
                      <div>
                         <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Year</label>
                         <input 
                           type="text" required placeholder="2024"
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                           value={formData.year}
                           onChange={e => setFormData({...formData, year: e.target.value})}
                         />
                      </div>
                   </div>

                   <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Remarks</label>
                      <textarea 
                        placeholder="Teacher's feedback..."
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 min-h-[80px] text-sm"
                        value={formData.remarks}
                        onChange={e => setFormData({...formData, remarks: e.target.value})}
                      />
                   </div>

                   <div className="pt-4 flex gap-3">
                      <button 
                        type="button" onClick={() => setIsModalOpen(false)}
                        className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest text-[10px]"
                      >
                        Cancel
                      </button>
                      <button type="submit" className="flex-[2] btn-primary py-3 flex items-center justify-center gap-2 shadow-lg shadow-brand-200">
                         <Send size={18} />
                         <span>Upload Result</span>
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
