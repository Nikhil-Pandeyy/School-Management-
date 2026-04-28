import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { Calendar as CalendarIcon, Check, X, Save, AlertCircle, School, Users, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

export default function Attendance() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTime, setSelectedTime] = useState(format(new Date(), 'HH:mm'));
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (user?.schoolId) {
      fetchClasses();
    }
  }, [user]);

  useEffect(() => {
    if (selectedClass && selectedDate) {
      checkExistingAttendance();
    }
  }, [selectedClass, selectedDate]);

  const fetchClasses = async () => {
    try {
      if (!user?.schoolId) return;
      // If teacher has assigned classes, filter by those
      const classesQuery = query(collection(db, 'schools', user.schoolId, 'classes'));
      const snapshot = await getDocs(classesQuery);
      let classList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (user?.role === 'teacher' && user.assignedClasses?.length > 0) {
        classList = classList.filter(c => user.assignedClasses.includes(c.id));
      }
      
      setClasses(classList);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'classes');
    }
  };

  const checkExistingAttendance = async () => {
    try {
      if (!user?.schoolId || !selectedClass) return;
      const attendanceId = `${selectedClass}_${selectedDate}`;
      const docSnap = await getDocs(query(collection(db, 'schools', user.schoolId, 'attendance'), where('classId', '==', selectedClass), where('date', '==', selectedDate)));
      
      if (!docSnap.empty) {
        const data = docSnap.docs[0].data();
        setAttendance(data.records || {});
        setRemarks(data.remarks || '');
        setSelectedTime(data.time || selectedTime);
        setIsLocked(data.isLocked || false);
      } else {
        setIsLocked(false);
        setAttendance({});
        setRemarks('');
      }
    } catch (err) {
      console.error("Error checking attendance:", err);
    }
  };

  const handleClassSelect = async (classId: string) => {
    setSelectedClass(classId);
    setLoading(true);
    try {
      if (!user?.schoolId) return;
      const q = query(collection(db, 'schools', user.schoolId, 'users'), where('classId', '==', classId), where('role', '==', 'student'));
      const snapshot = await getDocs(q);
      const studentsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudents(studentsData);
      
      // Default all to present if not already loaded from existing
      if (!isLocked) {
        const initialAttendance: any = {};
        studentsData.forEach(s => initialAttendance[s.id] = 'present');
        setAttendance(initialAttendance);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!remarks.trim() || !user?.schoolId) {
      alert("Please provide remarks before submitting.");
      return;
    }

    try {
      setLoading(true);
      const attendanceId = `${selectedClass}_${selectedDate}`;
      
      await setDoc(doc(db, 'schools', user.schoolId, 'attendance', attendanceId), {
        schoolId: user.schoolId,
        classId: selectedClass,
        teacherId: user.uid,
        date: selectedDate,
        time: selectedTime,
        records: attendance,
        remarks,
        markedBy: user.displayName,
        submittedAt: new Date().toISOString(),
        isLocked: true // Lock after teacher submission
      }, { merge: true });

      alert("Attendance submitted and locked!");
      setIsLocked(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'attendance');
    } finally {
      setLoading(false);
    }
  };

  if (user?.role === 'student') {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">My Attendance</h1>
          <p className="text-slate-500 text-sm">Track your daily presence and performance alerts.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="dashboard-card md:col-span-1">
              <p className="text-sm font-medium text-slate-500 mb-2">Overall Presence</p>
              <div className="flex items-center gap-4">
                 <h2 className="text-4xl font-bold text-slate-900 data-value">94%</h2>
                 <div className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-xs font-bold">EXCELLENT</div>
              </div>
              <div className="h-2 bg-slate-100 rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: '94%' }}></div>
              </div>
           </div>

           <div className="dashboard-card md:col-span-2">
              <h3 className="font-bold text-slate-800 mb-4">Recent Records</h3>
              <div className="space-y-3">
                 {history.slice(0, 5).map((h, i) => (
                   <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <CalendarIcon size={16} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-700">{h.date}</span>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold ${h.records[user.uid] === 'present' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        {h.records[user.uid]?.toUpperCase() || 'N/A'}
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mark Attendance</h1>
          <p className="text-slate-500 text-sm">Select class and record daily attendance for students.</p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm">
            <CalendarIcon size={18} className="text-brand-500" />
            <input 
              type="date" 
              className="outline-none bg-transparent font-bold text-slate-700"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm">
            <CalendarIcon size={18} className="text-brand-500" />
            <input 
              type="time" 
              className="outline-none bg-transparent font-bold text-slate-700"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Real-time Summary Bar */}
      {selectedClass && students.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Total Strength</p>
              <div className="flex items-end justify-between">
                 <h2 className="text-3xl font-black text-slate-800">{students.length}</h2>
                 <Users size={24} className="text-slate-200" />
              </div>
           </div>
           <div className="bg-emerald-500 p-6 rounded-[2rem] text-white shadow-xl shadow-emerald-100 flex flex-col justify-between">
              <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-4">Present Today</p>
              <div className="flex items-end justify-between">
                 <h2 className="text-3xl font-black">{Object.values(attendance).filter(v => v === 'present').length}</h2>
                 <Check size={24} className="opacity-60" />
              </div>
           </div>
           <div className="bg-rose-500 p-6 rounded-[2rem] text-white shadow-xl shadow-rose-100 flex flex-col justify-between">
              <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-4">Absent Today</p>
              <div className="flex items-end justify-between">
                 <h2 className="text-3xl font-black">{Object.values(attendance).filter(v => v === 'absent').length}</h2>
                 <X size={24} className="opacity-60" />
              </div>
           </div>
           <div className="bg-brand-600 p-6 rounded-[2rem] text-white shadow-xl shadow-brand-100 flex flex-col justify-between">
              <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-4">Completion Status</p>
              <div className="flex items-end justify-between">
                 <h2 className="text-3xl font-black">{Math.round((Object.keys(attendance).length / students.length) * 100)}%</h2>
                 <TrendingUp size={24} className="opacity-60" />
              </div>
           </div>
        </div>
      )}

      {isLocked && !loading && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-800 shadow-sm">
           <AlertCircle size={24} className="text-amber-500 flex-shrink-0" />
           <div className="flex-1">
              <p className="font-bold">Attendance Locked</p>
              <p className="text-sm">Attendance for this class on {selectedDate} has already been submitted and locked. Contact the administrator to rectify any errors.</p>
           </div>
           {user?.role === 'school-admin' && (
             <button 
               onClick={async () => {
                 try {
                   const attendanceId = `${selectedClass}_${selectedDate}`;
                   await updateDoc(doc(db, 'schools', user.schoolId, 'attendance', attendanceId), { isLocked: false });
                   setIsLocked(false);
                   alert('Attendance unlocked for rectification.');
                 } catch (err) {
                   handleFirestoreError(err, OperationType.UPDATE, `schools/${user?.schoolId}/attendance/${selectedClass}_${selectedDate}`);
                 }
               }}
               className="px-4 py-2 bg-white border border-amber-300 text-amber-700 rounded-xl font-bold text-xs hover:bg-amber-100 transition-all shadow-sm"
             >
               Unlock & Rectify
             </button>
           )}
        </div>
      )}

      <div className="dashboard-card">
        <label className="block text-sm font-bold text-slate-600 mb-4 uppercase tracking-widest">Select Class Section</label>
        <div className="flex flex-wrap gap-3">
          {classes.map(cls => (
            <button 
              key={cls.id}
              onClick={() => handleClassSelect(cls.id)}
              className={`px-6 py-3 rounded-2xl font-bold transition-all border ${
                selectedClass === cls.id 
                ? 'bg-brand-600 border-brand-600 text-white shadow-lg shadow-brand-100' 
                : 'bg-white border-slate-200 text-slate-600 hover:border-brand-500'
              }`}
            >
              {cls.name} - {cls.section}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedClass && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="dashboard-card p-0 overflow-hidden">
               <table className="w-full">
                 <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Student</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {students.map(student => (
                     <tr key={student.id}>
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">
                                {student.displayName[0]}
                             </div>
                             <div>
                               <p className="font-semibold text-slate-800">{student.displayName}</p>
                               <p className="text-xs text-slate-400 font-mono">ID: {student.uniqueId}</p>
                             </div>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex items-center justify-center gap-4">
                             <button 
                               onClick={() => !isLocked && setAttendance({...attendance, [student.id]: 'present'})}
                               disabled={isLocked}
                               className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${attendance[student.id] === 'present' ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 text-slate-400'} ${isLocked ? 'cursor-not-allowed opacity-80' : ''}`}
                             >
                               <Check size={20} />
                             </button>
                             <button 
                               onClick={() => !isLocked && setAttendance({...attendance, [student.id]: 'absent'})}
                               disabled={isLocked}
                               className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${attendance[student.id] === 'absent' ? 'bg-red-500 text-white shadow-md' : 'bg-slate-100 text-slate-400'} ${isLocked ? 'cursor-not-allowed opacity-80' : ''}`}
                             >
                               <X size={20} />
                             </button>
                           </div>
                        </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>

            <div className="dashboard-card">
              <div className="flex items-center gap-2 mb-4 text-slate-800">
                <AlertCircle size={18} className="text-brand-500" />
                <h3 className="font-bold">Remarks & Submission</h3>
              </div>
              <textarea 
                placeholder="Enter remarks for today's session (required)..."
                required
                disabled={isLocked}
                className={`w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 min-h-[100px] outline-none focus:ring-2 focus:ring-brand-500 ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
              />
              <div className="mt-6 flex justify-end">
                <button 
                  onClick={handleSubmit}
                  disabled={loading || !remarks.trim() || isLocked}
                  className={`btn-primary px-8 py-3 flex items-center gap-2 ${isLocked ? 'opacity-50 cursor-not-allowed bg-slate-400 hover:bg-slate-400' : ''}`}
                >
                  <Save size={20} />
                  <span>{isLocked ? 'Already Submitted' : 'Submit Attendance'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
