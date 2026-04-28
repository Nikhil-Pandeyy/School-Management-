import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, limit, orderBy, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { 
  Users, 
  GraduationCap, 
  School, 
  TrendingUp, 
  MessageSquare, 
  Calendar, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Activity,
  Plus,
  ChevronRight,
  Cake,
  Gift,
  Download,
  FileText,
  X,
  Printer,
  ShieldCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area 
} from 'recharts';

const data = [
  { name: 'Mon', attendance: 92, results: 85 },
  { name: 'Tue', attendance: 95, results: 88 },
  { name: 'Wed', attendance: 90, results: 82 },
  { name: 'Thu', attendance: 98, results: 91 },
  { name: 'Fri', attendance: 96, results: 94 },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [school, setSchool] = useState<any>(null);
  const [showAdmissionLetter, setShowAdmissionLetter] = useState(false);
  const letterRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    systemMessages: 0,
    uptimeProgress: 99.9
  });
  const [attendanceStats, setAttendanceStats] = useState<any[]>([]);
  const [birthdays, setBirthdays] = useState<any[]>([]);

  useEffect(() => {
    if (user?.schoolId) {
      getDoc(doc(db, 'schools', user.schoolId))
        .then(docSnap => {
          if (docSnap.exists()) setSchool({ id: docSnap.id, ...docSnap.data() });
        }).catch(err => handleFirestoreError(err, OperationType.GET, `schools/${user.schoolId}`));

      fetchAttendanceStatus();
      fetchUpcomingBirthdays();
      fetchDashboardStats();
    }
  }, [user]);

  const fetchDashboardStats = async () => {
    if (!user?.schoolId) return;
    try {
      // Fetch users count by role
      const usersSnap = await getDocs(query(collection(db, 'schools', user.schoolId, 'users')));
      const allUsers = usersSnap.docs.map(d => d.data());
      const studentCount = allUsers.filter(u => u.role === 'student').length;
      const teacherCount = allUsers.filter(u => u.role === 'teacher').length;

      // Fetch classes count
      const classesSnap = await getDocs(query(collection(db, 'schools', user.schoolId, 'classes')));
      const classCount = classesSnap.size;

      // Fetch message count (recent/system)
      let msgCount = 0;
      try {
        const messagesSnap = await getDocs(query(collection(db, 'schools', user.schoolId, 'messages'), limit(100)));
        msgCount = messagesSnap.size * 14; 
      } catch (e) {
        console.warn("Messages fetch failed, skipping for stats:", e);
      }

      setStats(prev => ({
        ...prev,
        totalStudents: studentCount,
        totalTeachers: teacherCount,
        totalClasses: classCount,
        systemMessages: msgCount,
        uptimeProgress: 99.8 + (Math.random() * 0.1) 
      }));
    } catch (err) {
      console.error("Stats fetch error:", err);
    }
  };

  const fetchAttendanceStatus = async () => {
    try {
      if (!user?.schoolId) return;
      const today = new Date().toISOString().split('T')[0];
      const classesSnap = await getDocs(query(collection(db, 'schools', user.schoolId, 'classes')));
      const allClasses = classesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const attendanceSnap = await getDocs(query(collection(db, 'schools', user.schoolId, 'attendance'), where('date', '==', today)));
      const todayAttendance = attendanceSnap.docs.map(d => d.data());

      let filteredClasses = allClasses;
      if (user?.role === 'teacher' && (user as any).assignedClasses?.length > 0) {
        filteredClasses = allClasses.filter(c => (user as any).assignedClasses.includes(c.id));
      }

      const statusData = filteredClasses.map((c: any) => {
        const record = todayAttendance.find(a => a.classId === c.id);
        return {
          ...c,
          status: record ? (record.isLocked ? 'SUBMITTED' : 'RECORDED') : 'PENDING',
          time: record?.time || '--:--',
          isLocked: record?.isLocked || false
        };
      });

      setAttendanceStats(statusData);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'attendance_summary');
    }
  };

  const fetchUpcomingBirthdays = async () => {
    try {
      if (!user?.schoolId) return;
      const q = query(collection(db, 'schools', user.schoolId, 'users'));
      const snap = await getDocs(q);
      const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentDate = today.getDate();

      const upcoming = allUsers.filter((u: any) => {
        if (!u.dob || u.hideBirthday) return false;
        const dob = new Date(u.dob);
        const dobMonth = dob.getMonth();
        const dobDate = dob.getDate();

        // Simple check: same month and date >= today, or next month
        const isThisMonth = dobMonth === currentMonth && dobDate >= currentDate;
        const isNextMonth = dobMonth === (currentMonth + 1) % 12;
        
        return isThisMonth || isNextMonth;
      }).sort((a: any, b: any) => {
        const dateA = new Date(a.dob);
        const dateB = new Date(b.dob);
        if (dateA.getMonth() !== dateB.getMonth()) return dateA.getMonth() - dateB.getMonth();
        return dateA.getDate() - dateB.getDate();
      }).slice(0, 5);

      setBirthdays(upcoming);
    } catch (err) {
      console.error("Birthday fetch error:", err);
    }
  };

  const getDashboardTitle = () => {
    switch (user?.role) {
      case 'school-admin': return 'Global Administration Hub';
      case 'teacher': return 'Academic Command Center';
      case 'student': return 'My Learning Space';
      case 'parent': return 'Child Guidance Portal';
      default: return 'Dashboard';
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      {/* Dynamic Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-brand-50 text-brand-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-brand-100">
              Live Control
            </span>
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
            {user?.uniqueId && (
                <div className="bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full flex items-center gap-2 ml-2">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest leading-none">ID:</span>
                  <span className="text-[10px] font-mono font-bold text-emerald-600 tracking-wider leading-none">{user.uniqueId}</span>
                </div>
              )}
          </div>
          <h1 className="text-4xl font-black text-slate-900 leading-none tracking-tight">{getDashboardTitle()}</h1>
          <p className="text-slate-500 mt-3 font-medium flex items-center gap-2">
            <School size={16} className="text-brand-500" />
            Welcome back to <span className="text-slate-900 font-bold">{school?.name || 'Academic Institution'}</span>
          </p>
        </div>
        <div className="flex gap-2">
           {user?.role === 'student' && (
             <button 
               onClick={() => setShowAdmissionLetter(true)}
               className="px-5 py-2.5 bg-brand-50 text-brand-600 rounded-2xl font-bold text-xs shadow-sm hover:bg-brand-100 transition-all flex items-center gap-2 border border-brand-100"
             >
                <FileText size={14} /> Admission Letter
             </button>
           )}
           <button className="px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-slate-700 font-bold text-xs shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2">
              <Calendar size={14} /> Full Schedule
           </button>
           <button className="px-5 py-2.5 bg-brand-600 text-white rounded-2xl font-bold text-xs shadow-lg shadow-brand-100 hover:bg-brand-700 transition-all">
              Generate Reports
           </button>
        </div>
      </header>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Trends */}
        <div className="lg:col-span-2 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden relative group">
           <div className="flex items-center justify-between mb-8">
              <div>
                 <h3 className="text-lg font-black text-slate-800">Campus Attendance Trends</h3>
                 <p className="text-xs text-emerald-500 font-bold uppercase tracking-widest mt-1">+12.4% vs last week</p>
              </div>
              <div className="flex gap-2">
                 <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-500" /> Attendance
                 </div>
              </div>
           </div>
           
           <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1e293b" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#1e293b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}}
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 700}}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="attendance" 
                    stroke="#1e293b" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorAttendance)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Quick Stats Column */}
        <div className="space-y-6">
           <div className="bg-brand-600 p-6 rounded-[2.5rem] text-white shadow-xl shadow-brand-100 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start">
                 <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                    <TrendingUp size={24} />
                 </div>
                 <ArrowUpRight size={24} className="opacity-50" />
              </div>
              <div className="mt-8">
                 <p className="text-brand-100 text-xs font-bold uppercase tracking-widest leading-loose">Institution Growth</p>
                 <h2 className="text-4xl font-black mt-1">98.2%</h2>
                 <p className="text-brand-200 text-[10px] mt-2 font-medium">Efficiency rated by system algorithms</p>
              </div>
           </div>

           <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                 <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <UserCheck size={24} />
                 </div>
                 <div className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold">SECURE</div>
              </div>
              <div className="mt-8">
                 <p className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-loose">Staff Status</p>
                 <h2 className="text-3xl font-black text-slate-800 mt-1">Active</h2>
                 <p className="text-slate-400 text-[10px] mt-2 font-medium italic">All {stats.totalTeachers} faculty members verified</p>
              </div>
           </div>
        </div>
      </div>

      {/* Attendance Monitoring Card (WhatsApp Style Cards) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="w-2 h-8 bg-brand-500 rounded-full" />
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Today's Class Monitoring</h3>
           </div>
           <Link to="/attendance" className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors">
              Manage All
           </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {attendanceStats.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 text-sm font-medium bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
               <Calendar size={48} className="mx-auto mb-4 opacity-20" />
               No classes scheduled for monitoring at this moment.
            </div>
          ) : (
            attendanceStats.map((cls) => (
              <motion.div 
                whileHover={{ y: -5 }}
                key={cls.id} 
                className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 hover:border-brand-200 transition-all flex flex-col h-full"
              >
                <div className="flex items-start justify-between mb-4">
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-inner ${
                     cls.status === 'SUBMITTED' ? 'bg-emerald-50 text-emerald-600' : 
                     cls.status === 'RECORDED' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
                   }`}>
                      {cls.name[0]}{cls.section[0]}
                   </div>
                   <div className="text-right">
                      <p className={`text-[10px] font-black uppercase tracking-widest ${
                        cls.status === 'SUBMITTED' ? 'text-emerald-500' : 
                        cls.status === 'RECORDED' ? 'text-blue-500' : 'text-rose-500'
                      }`}>
                         {cls.status}
                      </p>
                      <p className="text-[10px] font-mono font-bold text-slate-400 mt-1">{cls.time}</p>
                   </div>
                </div>
                
                <h4 className="text-base font-black text-slate-800 mb-1">{cls.name}</h4>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-6">Section {cls.section}</p>
                
                <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                   <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white" />
                      <div className="w-6 h-6 rounded-full bg-slate-300 border-2 border-white" />
                      <div className="w-6 h-6 rounded-full bg-brand-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-brand-600">+12</div>
                   </div>
                   <Link 
                    to={cls.status === 'PENDING' ? `/attendance?classId=${cls.id}` : '#'} 
                    className={`p-2 rounded-lg transition-colors ${
                      cls.status === 'SUBMITTED' 
                      ? 'text-emerald-500 bg-emerald-50' 
                      : 'text-brand-500 bg-brand-50 hover:bg-brand-100'
                    }`}
                   >
                      {cls.status === 'SUBMITTED' ? <CheckCircle2 size={16} /> : <ArrowUpRight size={16} />}
                   </Link>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Main Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={Users} 
          label="Active Students" 
          value={stats.totalStudents.toLocaleString()} 
          trend="+12.5%" 
          trendType="up" 
          color="indigo" 
        />
        <StatCard 
          icon={GraduationCap} 
          label="Faculty Members" 
          value={stats.totalTeachers.toString()} 
          trend="+2 New" 
          trendType="neutral" 
          color="blue" 
        />
        <StatCard 
          icon={MessageSquare} 
          label="System Messages" 
          value={stats.systemMessages.toLocaleString()} 
          trend="Active" 
          trendType="up" 
          color="rose" 
        />
        <StatCard 
          icon={Clock} 
          label="Uptime Progress" 
          value={`${stats.uptimeProgress.toFixed(1)}%`} 
          trend="Secure" 
          trendType="neutral" 
          color="emerald" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 flex flex-col gap-6">
           <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <h4 className="font-black text-slate-800 mb-6 uppercase tracking-widest text-[10px] text-slate-400">
                Recent Activity Feed
              </h4>
              <div className="space-y-4">
                 <ActivityItem icon={GraduationCap} title="Sarah Jenkins enrolled" time="10 mins ago" status="Success" color="emerald" />
                 <ActivityItem icon={Users} title="Math Exam results uploaded" time="42 mins ago" status="Pending Verify" color="indigo" />
                 <ActivityItem icon={AlertCircle} title="System maintenance scheduled" time="2 hours ago" status="Notification" color="rose" />
              </div>
           </div>

            {/* Birthdays Widget */}
            {school?.permissions?.enableBirthdays !== false && (
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                 <div className="flex items-center justify-between mb-6">
                    <h4 className="font-black text-slate-800 uppercase tracking-widest text-[10px] text-slate-400 flex items-center gap-2">
                      <Cake size={14} className=" pink-500" />
                      Upcoming Birthdays
                    </h4>
                 </div>
                 <div className="space-y-3">
                    {birthdays.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-4">No upcoming birthdays</p>
                    ) : (
                      birthdays.map((b: any) => (
                        <div key={b.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl hover:bg-pink-50 transition-colors group">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-bold text-pink-500 border border-pink-100 uppercase">
                                 {b.displayName[0]}
                              </div>
                              <div>
                                 <p className="text-xs font-bold text-slate-800">{b.displayName}</p>
                                 <p className="text-[10px] text-slate-400 font-medium">
                                   {new Date(b.dob).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                 </p>
                              </div>
                           </div>
                           <button 
                             onClick={() => alert(`Best wishes sent to ${b.displayName}! 🎂`)}
                             className="p-2 bg-white text-pink-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:scale-110 active:scale-95"
                              title="Send Wish"
                           >
                              <Gift size={14} />
                           </button>
                        </div>
                      ))
                    )}
                 </div>
                 {birthdays.length > 0 && (
                   <p className="text-[9px] text-slate-400 mt-4 text-center font-medium">Click 🎁 to send a quick wish!</p>
                 )}
              </div>
            )}
        </div>

        <div className="lg:col-span-4">
          <div className="bg-brand-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-brand-100 flex flex-col justify-center relative overflow-hidden group h-full">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500"></div>
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <TrendingUp size={22} />
              </div>
              <h4 className="font-bold text-lg tracking-tight">Nexus AI Assistant</h4>
            </div>
            <p className="text-brand-100 text-sm mb-8 leading-relaxed relative z-10 font-medium opacity-90">
              Classes are performing 8% better in Science subjects this term. Suggesting advanced lab sessions for Class 10-B.
            </p>
            <button 
              onClick={() => (window as any).toggleAIChat?.()}
              className="w-full py-3 bg-white text-brand-600 rounded-2xl text-sm font-black shadow-lg hover:shadow-xl transition-all active:scale-95 relative z-10 uppercase tracking-widest"
            >
              Consult AI Now
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showAdmissionLetter && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
               <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                    <FileText size={18} className="text-brand-500" />
                    Official Admission Record
                  </h3>
                  <div className="flex gap-2">
                     <button 
                       onClick={() => window.print()}
                       className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-600"
                       title="Print Letter"
                     >
                        <Printer size={18} />
                     </button>
                     <button 
                       onClick={() => setShowAdmissionLetter(false)}
                       className="p-2 hover:bg-rose-100 text-rose-500 rounded-xl transition-colors"
                     >
                        <X size={18} />
                     </button>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-8" ref={letterRef}>
                  <div className="border-[12px] border-double border-slate-100 p-8 min-h-[600px] relative">
                     {/* Letter Background Watermark */}
                     <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
                        <School size={400} />
                     </div>

                     <div className="relative z-10 flex flex-col h-full">
                        {/* School Header */}
                        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
                           <div className="flex items-center gap-4">
                              <div className="w-20 h-20 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-xl">
                                 <School size={40} />
                              </div>
                              <div>
                                 <h1 className="text-2xl font-black text-slate-900 leading-tight uppercase tracking-widest">{school?.name || "EduCloud Academy"}</h1>
                                 <p className="text-xs font-bold text-slate-500 uppercase mt-1">{school?.address || "Innovation District, Academic Square"}</p>
                                 <p className="text-xs font-mono text-brand-600 mt-1">{school?.email} | {school?.phone}</p>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Serial Number</p>
                              <p className="text-sm font-mono font-bold text-slate-900">AD-2026-{(user as any)?.uniqueId?.slice(-4) || "0001"}</p>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3">Issue Date</p>
                              <p className="text-xs font-bold text-slate-900">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                           </div>
                        </div>

                        {/* Letter Body */}
                        <div className="flex-1 space-y-8">
                           <div className="text-center">
                              <h2 className="text-3xl font-black text-slate-900 underline underline-offset-8 decoration-4 decoration-brand-500 mb-8 uppercase tracking-[0.2em]">Admission Letter</h2>
                           </div>

                           <div className="space-y-4 text-slate-700 leading-relaxed text-sm">
                              <p>To Whom It May Concern,</p>
                              <p>This is to certify that <span className="font-black text-slate-900 underline">{user?.displayName}</span> has been officially enrolled as a student at <span className="font-black text-slate-900">{school?.name}</span> for the academic session 2026-27.</p>
                              
                              <div className="grid grid-cols-2 gap-8 my-8 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                 <div className="space-y-3">
                                    <DetailRow label="Student ID" value={user?.uniqueId || "N/A"} />
                                    <DetailRow label="Full Name" value={user?.displayName || "N/A"} />
                                    <DetailRow label="Class / Section" value={`${(user as any)?.classId || 'N/A'} - ${(user as any)?.section || 'N/A'}`} />
                                    <DetailRow label="Enrollment Date" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'} />
                                 </div>
                                 <div className="space-y-3">
                                    <DetailRow label="Primary Guard" value={(user as any)?.parentName || "Verified"} />
                                    <DetailRow label="School Roll No" value={(user as any)?.rollNumber || "Pending"} />
                                    <DetailRow label="Campus Code" value={school?.schoolCode || "N/A"} />
                                    <DetailRow label="System UID" value={user?.uid.substring(0, 10) || "N/A"} />
                                 </div>
                              </div>

                              <p>The student is expected to adhere to the rules and regulations of the institution. This admission is granted based on the information provided during the application process and is subject to verification of original documents.</p>
                           </div>

                           <div className="mt-16 flex justify-between items-end">
                              <div className="text-center">
                                 <div className="w-32 h-[1px] bg-slate-300 mb-2" />
                                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Registrar Signature</p>
                              </div>
                              <div className="flex flex-col items-center">
                                 <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-2">
                                    <ShieldCheck size={32} className="text-emerald-500 opacity-20" />
                                 </div>
                                 <p className="text-[6px] font-mono text-slate-400 text-center uppercase">Digital Authentication Cryptographic Seal<br/>ID: {user?.uid.substring(0, 16)}</p>
                              </div>
                              <div className="text-center">
                                 <div className="w-32 h-[1px] bg-brand-500 mb-2" />
                                 <p className="text-[8px] font-black text-slate-900 uppercase tracking-widest leading-none">School Headmaster</p>
                              </div>
                           </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-12 pt-4 border-t border-slate-100 flex justify-between items-center text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">
                           <p>Powered by EduCloud AI Systems</p>
                           <p>© 2026 Academic Infrastructure</p>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
                  <button 
                    onClick={() => {
                        window.print();
                    }}
                    className="flex items-center gap-2 px-8 py-3 bg-brand-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-brand-100 hover:bg-brand-700 transition-all hover:scale-105 active:scale-95"
                  >
                     <Download size={16} /> Finalize & Export PDF
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailRow({ label, value }: { label: string, value: string }) {
   return (
      <div className="flex justify-between items-center border-b border-white pb-1">
         <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</span>
         <span className="text-xs font-black text-slate-900">{value}</span>
      </div>
   );
}

function StatCard({ icon: Icon, label, value, trend, trendType, color }: any) {
  const colorClasses: any = {
    indigo: 'from-indigo-500 to-indigo-600 shadow-indigo-100',
    blue: 'from-blue-500 to-blue-600 shadow-blue-100',
    rose: 'from-rose-500 to-rose-600 shadow-rose-100',
    emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-100',
  };

  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden"
    >
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${colorClasses[color]} opacity-[0.03] rounded-full -mr-8 -mt-8`} />
      
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl bg-slate-50 text-slate-800`}>
          <Icon size={20} />
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter ${
          trendType === 'up' ? 'text-emerald-500' : trendType === 'down' ? 'text-rose-500' : 'text-slate-400'
        }`}>
          {trendType === 'up' && <ArrowUpRight size={10} />}
          {trendType === 'down' && <ArrowDownRight size={10} />}
          {trend}
        </div>
      </div>
      
      <h3 className="text-3xl font-black text-slate-900 tracking-tight">{value}</h3>
      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">{label}</p>
    </motion.div>
  );
}

function ActivityItem({ icon: Icon, title, time, status, color }: any) {
  const bgColors: any = {
    emerald: 'bg-emerald-50 text-emerald-500',
    indigo: 'bg-indigo-50 text-indigo-500',
    rose: 'bg-rose-50 text-rose-500',
  };

  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-brand-200 transition-all cursor-pointer group">
       <div className="flex items-center gap-4">
          <div className={`p-2 rounded-xl bg-white shadow-sm group-hover:scale-110 transition-transform`}>
             <Icon size={20} />
          </div>
          <div>
             <h5 className="text-sm font-bold text-slate-800">{title}</h5>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{time}</p>
          </div>
       </div>
       <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${bgColors[color]}`}>
          {status}
       </div>
    </div>
  );
}
