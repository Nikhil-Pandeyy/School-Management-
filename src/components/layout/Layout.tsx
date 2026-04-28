import React, { useState } from 'react';
import { 
  Bell,
  Search,
  Building2,
  Menu,
  X,
  LogOut,
  Settings,
  AlertCircle,
  MessageSquare,
  PlusCircle,
  CalendarCheck,
  TrendingUp,
  GraduationCap,
  UserSquare2,
  School,
  Users,
  LayoutDashboard,
  Shield
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import AIChatbot from '../ai/AIChatbot';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['super-admin', 'school-admin', 'teacher', 'student', 'parent'] },
  { name: 'Classes', path: '/classes', icon: School, roles: ['school-admin', 'teacher'] },
  { name: 'Students', path: '/students', icon: GraduationCap, roles: ['school-admin'] },
  { name: 'Teachers', path: '/teachers', icon: UserSquare2, roles: ['school-admin'] },
  { name: 'Admins', path: '/admins', icon: Shield, roles: ['school-admin'] },
  { name: 'Attendance', path: '/attendance', icon: CalendarCheck, roles: ['school-admin', 'teacher', 'student', 'parent'], permission: 'enableAttendance' },
  { name: 'Results', path: '/results', icon: TrendingUp, roles: ['school-admin', 'teacher', 'student', 'parent'], permission: 'enableResults' },
  { name: 'Applications', path: '/applications', icon: PlusCircle, roles: ['school-admin', 'teacher', 'student', 'parent'], permission: 'enableApplications' },
  { name: 'Chat', path: '/chat', icon: MessageSquare, roles: ['school-admin', 'teacher', 'student', 'parent'], permission: 'enableChat' },
  { name: 'Complaints', path: '/complaints', icon: AlertCircle, roles: ['school-admin', 'teacher', 'student', 'parent'], permission: 'enableComplaints' },
  { name: 'Permissions', path: '/permissions', icon: Shield, roles: ['school-admin'] },
  { name: 'Settings', path: '/settings', icon: Settings, roles: ['super-admin', 'school-admin', 'teacher', 'student', 'parent'] },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { user, logout } = useAuth();
  const [schoolPermissions, setSchoolPermissions] = React.useState<any>(null);
  const location = useLocation();

  React.useEffect(() => {
    if (user?.schoolId) {
      const unsub = onSnapshot(doc(db, 'schools', user.schoolId), (docSnap) => {
        if (docSnap.exists()) {
          setSchoolPermissions(docSnap.data().permissions || {});
        }
      });
      return () => unsub();
    }
  }, [user?.schoolId]);

  const filteredNav = navItems.filter(item => {
    const hasRole = item.roles.includes(user?.role || '');
    if (!hasRole) return false;
    
    // Check permission-based visibility (only for non-admins to actually see the restriction, 
    // though usually we hide for everyone if disabled)
    if ((item as any).permission && schoolPermissions) {
      return schoolPermissions[(item as any).permission] !== false;
    }
    
    return true;
  });

  return (
    <div className="flex h-screen bg-brand-bg overflow-hidden font-sans">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -256 }}
            animate={{ x: 0 }}
            exit={{ x: -256 }}
            className="w-64 bg-brand-slate-dark flex flex-col h-full z-40 shrink-0 border-r border-white/5"
          >
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-brand-500/20">
                  {user?.displayName?.[0] || 'E'}
                </div>
                <span className="text-white font-black text-xl tracking-tighter italic">EduCloud</span>
              </div>

              <nav className="space-y-1 pb-10">
                {filteredNav.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`sidebar-link ${
                      location.pathname === item.path
                        ? 'sidebar-link-active'
                        : 'sidebar-link-inactive'
                    }`}
                  >
                    <item.icon size={18} />
                    <span>{item.name}</span>
                  </Link>
                ))}
              </nav>
            </div>

            <div className="mt-auto p-6 space-y-4">
              <div className="bg-indigo-900/40 rounded-xl p-4 border border-indigo-500/20">
                <div className="flex items-center justify-between mb-2">
                   <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-wider">System Active</p>
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                </div>
                <div className="flex items-center gap-2 mb-3">
                   <div className="flex -space-x-1">
                      <div className="w-4 h-4 rounded-full bg-indigo-500/50 border border-white/10" />
                      <div className="w-4 h-4 rounded-full bg-indigo-400/50 border border-white/10" />
                      <div className="w-4 h-4 rounded-full bg-indigo-600/50 border border-white/10" />
                   </div>
                   <p className="text-indigo-100/60 text-[9px] font-medium leading-none">84+ Online Now</p>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-400/50 rounded-full" style={{ width: '92%' }} />
                </div>
              </div>

              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition-all text-sm font-medium"
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-sm z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-50 rounded-lg text-slate-500"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 md:hidden">
               <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                  {user?.displayName?.[0] || 'E'}
               </div>
               <span className="font-black text-sm tracking-tight italic">EduCloud</span>
            </div>
            <h2 className="text-lg font-bold text-slate-800 hidden md:block">
              {filteredNav.find(n => n.path === location.pathname)?.name || 'Dashboard'}
            </h2>
            <div className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight">
              Session 2026-27
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search records..." 
                className="w-48 lg:w-64 pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            {user?.role === 'school-admin' && (
              <Link to="/settings" className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all" title="School Profile">
                <Building2 size={20} />
              </Link>
            )}
            <button className="relative p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all">
               <Bell size={20} />
               <div className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
            </button>
            <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden md:block"></div>
            <Link to="/settings" className="w-9 h-9 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200 hover:border-brand-500 transition-all group">
               {user?.photoURL ? (
                 <img src={user.photoURL} alt="profile" className="w-full h-full object-cover" />
               ) : (
                 <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center font-bold text-slate-600 text-[10px] uppercase shadow-sm group-hover:text-brand-600">
                    {user?.displayName?.substring(0, 2) || 'JD'}
                 </div>
               )}
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-brand-bg text-slate-900">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
        <AIChatbot />
      </div>
    </div>
  );
}
