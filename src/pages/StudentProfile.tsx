import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  TrendingUp, 
  BookOpen, 
  Award,
  ArrowLeft,
  Activity,
  Star,
  Search,
  X,
  Download,
  FileText,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart, 
  Bar,
  AreaChart,
  Area
} from 'recharts';

const mockPerformanceData = [
  { subject: 'Math', score: 85 },
  { subject: 'Science', score: 78 },
  { subject: 'English', score: 92 },
  { subject: 'History', score: 88 },
  { subject: 'Art', score: 95 },
];

export default function StudentProfile() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [student, setStudent] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      setLoading(true);
      fetchStudentData();
      fetchGradeData();
    }
  }, [id]);

  // Handle clicks outside search results
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearching(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (val: string) => {
    setSearchTerm(val);
    if (val.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      // Simple search (case sensitive prefix for displayName)
      // For more robust search, you'd usually use a side field or external engine
      const q = query(
        collection(db, 'users'),
        where('schoolId', '==', currentUser?.schoolId),
        where('role', '==', 'student'),
        orderBy('displayName'),
        limit(5)
      );
      
      const snapshot = await getDocs(q);
      const results = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((s: any) => 
          s.displayName.toLowerCase().includes(val.toLowerCase()) || 
          s.uniqueId?.toLowerCase().includes(val.toLowerCase())
        );
      
      setSearchResults(results);
      setIsSearching(true);
    } catch (err) {
      console.error("Search error:", err);
    }
  };

  const exportToCSV = () => {
    if (!student) return;

    const academicData = grades.map(g => ({
      Type: 'Academic',
      Label: `${g.term} ${g.year}`,
      Detail: g.subject,
      Result: `${g.score}%`,
      Note: g.remarks || ''
    }));

    const attendanceData = attendance.map(a => ({
      Type: 'Attendance',
      Label: a.date,
      Detail: '',
      Result: a.status,
      Note: ''
    }));

    const contactData = [
      { Type: 'Profile', Label: 'Name', Detail: student.displayName, Result: '', Note: '' },
      { Type: 'Profile', Label: 'Email', Detail: student.email, Result: '', Note: '' },
      { Type: 'Profile', Label: 'ID', Detail: student.uniqueId, Result: '', Note: '' },
      { Type: 'Profile', Label: 'Class', Detail: student.classId, Result: '', Note: '' },
    ];

    const allData = [...contactData, ...academicData, ...attendanceData];
    
    const headers = ['Record Type', 'Label/Field', 'Details', 'Result/Status', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...allData.map(row => {
        return [row.Type, row.Label, row.Detail, row.Result, row.Note]
          .map(v => `"${String(v).replace(/"/g, '""')}"`)
          .join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `student_${student.uniqueId}_report.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchStudentData = async () => {
    try {
      const docRef = doc(db, 'users', id!);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStudent({ id: docSnap.id, ...data });
      } else {
        console.error("No such student!");
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${id}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchGradeData = async () => {
    if (!currentUser?.schoolId) return;
    try {
      const q = query(
        collection(db, 'grades'),
        where('schoolId', '==', currentUser.schoolId),
        where('studentId', '==', id),
        orderBy('year', 'asc'),
        orderBy('term', 'asc')
      );
      const snapshot = await getDocs(q);
      const gradesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setGrades(gradesData);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'grades');
    }
  };

  // Compute term-wise averages for the trend chart
  const termPerformanceTrend = React.useMemo(() => {
    const termMap: Record<string, { term: string, total: number, count: number }> = {};
    
    grades.forEach(g => {
      const key = `${g.term} ${g.year}`;
      if (!termMap[key]) {
        termMap[key] = { term: key, total: 0, count: 0 };
      }
      termMap[key].total += g.score;
      termMap[key].count += 1;
    });

    return Object.values(termMap).map(t => ({
      term: t.term,
      score: Math.round(t.total / t.count)
    }));
  }, [grades]);

  const fetchAttendanceData = async () => {
    if (!student?.schoolId || !student?.classId) return;

    try {
      const q = query(
        collection(db, 'attendance'),
        where('schoolId', '==', student.schoolId),
        where('classId', '==', student.classId),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      const records = snapshot.docs.map(d => {
        const data = d.data();
        const status = data.records?.[id!] || 'absent';
        return {
          date: data.date,
          label: new Date(data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          status: status,
          value: (status === 'present' || status === 'late') ? 100 : 0
        };
      }).reverse().slice(-14); // Last 14 records
      
      setAttendance(records);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'attendance');
    }
  };

  useEffect(() => {
    if (student) {
      fetchAttendanceData();
    }
  }, [student]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Activity className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-slate-800">Student not found</h2>
        <button onClick={() => navigate('/students')} className="mt-4 text-indigo-600 font-bold flex items-center gap-2 mx-auto">
          <ArrowLeft size={18} /> Back to Directory
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/students')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium"
          >
            <ArrowLeft size={18} />
            <span>Back to Students</span>
          </button>
          
          {currentUser?.role === 'school-admin' && (
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          )}
        </div>

        {/* Quick Student Search */}
        <div className="relative" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Jump to student (Name or ID)..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full md:w-80 pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => { setSearchTerm(''); setSearchResults([]); setIsSearching(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <AnimatePresence>
            {isSearching && searchResults.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden"
              >
                <div className="p-2">
                  {searchResults.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        navigate(`/students/${s.id}`);
                        setSearchTerm('');
                        setIsSearching(false);
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                          {s.displayName?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{s.displayName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{s.uniqueId}</p>
                        </div>
                      </div>
                      <Link to={`/students/${s.id}`} className="p-1.5 text-slate-200 group-hover:text-indigo-400">
                        <ArrowLeft size={14} className="rotate-180" />
                      </Link>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Profile Sidebar */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="dashboard-card text-center p-8">
            <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center font-bold text-3xl mx-auto mb-4 border border-indigo-100 shadow-sm">
              {student.photoURL ? <img src={student.photoURL} alt="pfp" className="w-full h-full rounded-3xl object-cover" /> : student.displayName[0]}
            </div>
            <h2 className="text-2xl font-bold text-slate-900">{student.displayName}</h2>
            <p className="text-indigo-600 font-mono text-xs font-bold mt-1 tracking-widest uppercase">Student ID: {student.uniqueId}</p>
            
            <button 
              onClick={() => navigate(`/chat?uid=${student.id}`)}
              className="mt-6 w-full py-3 bg-white border border-indigo-100 text-indigo-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all shadow-sm group"
            >
              <MessageSquare size={18} className="group-hover:scale-110 transition-transform" />
              <span>Send Message</span>
            </button>
            
            <div className="mt-8 flex justify-center gap-3">
               <div className="w-1/2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Class</p>
                  <p className="text-sm font-bold text-slate-800">{student.classId || 'N/A'}</p>
               </div>
               <div className="w-1/2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Section</p>
                  <p className="text-sm font-bold text-slate-800">{student.section || 'Default'}</p>
               </div>
            </div>
          </div>

          <div className="dashboard-card">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <User size={18} className="text-indigo-500" />
              Contact Information
            </h3>
            <div className="space-y-4">
              <ProfileInfoItem icon={Mail} label="Email Address" value={student.email} />
              <ProfileInfoItem icon={Phone} label="Phone Number" value="+1 (555) 012-3456" />
              <ProfileInfoItem icon={MapPin} label="Home Address" value="789 Science Ave, Education City" />
              <ProfileInfoItem icon={Calendar} label="Date of Birth" value="May 14, 2012" />
            </div>
          </div>

          <div className="bg-indigo-600 text-white rounded-2xl p-6 shadow-lg shadow-indigo-100">
            <div className="flex items-center gap-3 mb-4">
              <Award className="text-indigo-300" size={24} />
              <h3 className="font-bold text-lg">Top Accomplishments</h3>
            </div>
            <ul className="space-y-3 text-sm">
               <li className="flex items-center gap-2 bg-white/10 p-2 rounded-lg">
                  <Star size={14} className="text-amber-300 fill-amber-300" />
                  <span>Winner of Annual Science Fair 2025</span>
               </li>
               <li className="flex items-center gap-2 bg-white/10 p-2 rounded-lg">
                  <Star size={14} className="text-amber-300 fill-amber-300" />
                  <span>Mathematics Excellence Award</span>
               </li>
            </ul>
          </div>
        </div>

        {/* Performance & Academic content */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
             <div className="dashboard-card">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-800">Attendance Graph</h3>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                    {attendance.length > 0 
                      ? `${Math.round((attendance.filter(a => a.value === 100).length / attendance.length) * 100)}% Recent`
                      : 'No Records'}
                  </span>
               </div>
               <div className="h-[200px]">
                  {attendance.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={attendance}>
                        <defs>
                          <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const isPresent = data.status === 'present' || data.status === 'late';
                              return (
                                <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100 min-w-[120px]">
                                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                     {new Date(data.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                   </p>
                                   <div className="flex items-center gap-2">
                                     <div className={`w-2 h-2 rounded-full ${isPresent ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                     <p className={`text-xs font-bold uppercase tracking-tight ${isPresent ? 'text-emerald-700' : 'text-red-700'}`}>
                                       {data.status}
                                     </p>
                                   </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area 
                          type="stepAfter" 
                          dataKey="value" 
                          stroke="#10b981" 
                          strokeWidth={2} 
                          fillOpacity={1} 
                          fill="url(#colorAtt)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                       <Activity size={32} className="opacity-20" />
                       <p className="text-xs font-medium">No recent activity detected</p>
                    </div>
                  )}
               </div>
             </div>

             <div className="dashboard-card flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-6">
                   <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                      <TrendingUp size={24} />
                   </div>
                   <div>
                      <h4 className="font-bold text-slate-800">Academic Standing</h4>
                      <p className="text-xs text-slate-500">Based on recent assessments</p>
                   </div>
                </div>
                <div className="flex items-end gap-2">
                   <span className="text-4xl font-bold text-slate-900 data-value">A+</span>
                   <span className="text-emerald-500 text-sm font-bold mb-1">Top 5% of Class</span>
                </div>
             </div>
          </div>

          <div className="dashboard-card">
             <div className="flex items-center justify-between mb-8">
                <h3 className="font-bold text-lg text-slate-800">Subject Performance</h3>
                <div className="flex gap-2">
                   <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                      <span className="text-xs font-bold text-slate-400 uppercase">Recent Score</span>
                   </div>
                </div>
             </div>
             
             <div className="space-y-6">
                {mockPerformanceData.map((item, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-bold text-slate-700">{item.subject}</span>
                      <span className="text-sm font-mono font-bold text-indigo-600">{item.score}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${item.score}%` }}
                        transition={{ duration: 1, delay: idx * 0.1 }}
                        className={`h-full ${item.score > 90 ? 'bg-indigo-500' : item.score > 80 ? 'bg-blue-400' : 'bg-amber-400'}`}
                      ></motion.div>
                    </div>
                  </div>
                ))}
             </div>
          </div>

          <div className="dashboard-card">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <BookOpen size={18} className="text-indigo-500" />
              Recent Teacher Feedback
            </h3>
            <div className="space-y-4">
               <FeedbackItem 
                 teacher="Sarah Mitchell" 
                 subject="Advanced Mathematics" 
                 date="2 days ago" 
                 text="Excellent problem-solving skills shown during the calculus quiz. Needs to focus slightly more on detailing the steps."
               />
               <FeedbackItem 
                 teacher="James Wilson" 
                 subject="Biology" 
                 date="1 week ago" 
                 text="Great lab report on the cellular structure module. Very thorough analysis."
               />
            </div>
          </div>

          <div className="dashboard-card">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-bold text-lg text-slate-800">Academic History</h3>
                <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-wider">Historical Term Performance</p>
              </div>
              <div className="flex gap-2">
                <TrendingUp size={18} className="text-emerald-500" />
              </div>
            </div>

            {termPerformanceTrend.length === 0 ? (
              <div className="py-10 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <BookOpen className="mx-auto text-slate-200 mb-3" size={40} />
                <p className="text-sm font-medium text-slate-500 italic">No historical academic records found</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Performance Trend Chart */}
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={termPerformanceTrend}>
                      <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="term" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} 
                        dy={10}
                      />
                      <YAxis domain={[0, 100]} hide />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100 text-xs">
                                <p className="font-bold text-slate-800 mb-1">{payload[0].payload.term}</p>
                                <p className="text-indigo-600 font-bold">Avg Score: {payload[0].value}%</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-100">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50">
                      <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <th className="px-4 py-3">Term/Year</th>
                        <th className="px-4 py-3">Subject</th>
                        <th className="px-4 py-3">Grade</th>
                        <th className="px-4 py-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                      {grades.map((grade) => (
                        <tr key={grade.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-800">{grade.term} {grade.year}</td>
                          <td className="px-4 py-3 text-slate-600">{grade.subject}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              grade.score >= 90 ? 'bg-emerald-100 text-emerald-700' : 
                              grade.score >= 80 ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {grade.score}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400 italic line-clamp-1 truncate">{grade.remarks || 'No remarks'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileInfoItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center shrink-0 border border-slate-100">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-slate-700">{value}</p>
      </div>
    </div>
  );
}

function FeedbackItem({ teacher, subject, date, text }: any) {
  return (
    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="text-sm font-bold text-slate-800">{teacher}</h4>
          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tighter">{subject}</span>
        </div>
        <span className="text-[10px] text-slate-400 font-medium uppercase">{date}</span>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed italic">"{text}"</p>
    </div>
  );
}
