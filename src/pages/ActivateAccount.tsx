import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc,
  deleteDoc,
  limit, 
  updateDoc 
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { motion, AnimatePresence } from 'motion/react';
import { 
  School, 
  User, 
  Hash, 
  Mail, 
  Lock, 
  Phone, 
  ChevronRight, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function ActivateAccount() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Step 1: Identification
  const [schoolCode, setSchoolCode] = useState('');
  const [uniqueId, setUniqueId] = useState('');
  
  // Step 2: Verification & Data
  const [foundUser, setFoundUser] = useState<any>(null);
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const navigate = useNavigate();

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const trimmedCode = schoolCode.trim();
      const trimmedId = uniqueId.trim();

      // 1. Find school
      const schoolQuery = query(collection(db, 'schools'), where('schoolCode', '==', trimmedCode), limit(1));
      const schoolSnapshot = await getDocs(schoolQuery);
      
      if (schoolSnapshot.empty) {
        throw new Error('School not found. Please check your 6-digit School Code.');
      }
      
      const schoolId = schoolSnapshot.docs[0].id;

      // 2. Find user record within school nesting
      const userQuery = query(collection(db, 'schools', schoolId, 'users'), where('uniqueId', '==', trimmedId), limit(1));
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        throw new Error('ID not recognized for this school. Contact your administrator.');
      }

      const userData = userSnapshot.docs[0].data();
      setFoundUser({ id: userSnapshot.docs[0].id, schoolId, ...userData });
      setEmail(userData.email || '');
      setMobile(userData.mobile || '');
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!email || !password) throw new Error('Email and Password are required');
      
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const fbUser = userCredential.user;

      // 2. Create NEW document with Auth UID
      // We copy everything from the found document and add the new activation info
      const newUserDoc = {
        ...foundUser,
        uid: fbUser.uid,
        email: email,
        mobile: mobile,
        isActivated: true,
        updatedAt: new Date().toISOString()
      };
      
      // Remove the old Firestore ID from the data object if it exists
      delete (newUserDoc as any).id;

      try {
        const schoolId = foundUser.schoolId;
        // Create root index record for faster lookup during login
        await setDoc(doc(db, 'users', fbUser.uid), {
          uid: fbUser.uid,
          schoolId,
          role: foundUser.role,
          email: email
        });

        // Create the actual profile in the school's isolated collection
        await setDoc(doc(db, 'schools', schoolId, 'users', fbUser.uid), newUserDoc);

        // 3. Delete the OLD pre-activation record (nested)
        if (foundUser.id !== fbUser.uid) {
          await deleteDoc(doc(db, 'schools', schoolId, 'users', foundUser.id));
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'users');
      }

      setStep(3);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already associated with an account. Try logging in.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 relative overflow-hidden">
      {/* Abstract Background */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-50 rounded-full mix-blend-multiply filter blur-3xl opacity-30 -mr-48 -mt-48"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-50 rounded-full mix-blend-multiply filter blur-3xl opacity-30 -ml-48 -mb-48"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 sm:p-10 relative z-10 border border-slate-100"
      >
        <button 
          onClick={() => step === 1 ? navigate('/login') : setStep(step - 1)}
          className="absolute left-8 top-8 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="flex flex-col items-center mb-8 pt-4">
          <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-brand-200">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Account Activation</h1>
          <p className="text-slate-400 mt-1 text-center text-sm font-medium">
            {step === 1 ? 'Find your school record' : step === 2 ? 'Complete your profile' : 'Success!'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 text-rose-600 text-xs rounded-2xl flex items-center gap-3 border border-rose-100 animate-shake">
            <AlertCircle size={16} className="shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.form 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleStep1} 
              className="space-y-4"
            >
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" placeholder="6-Digit School Code" required
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-400 text-sm font-medium"
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value)}
                />
              </div>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" placeholder="Your Unique ID" required
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-400 text-sm font-medium"
                  value={uniqueId}
                  onChange={(e) => setUniqueId(e.target.value)}
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full btn-primary py-4 flex items-center justify-center gap-2 group mt-6 shadow-xl shadow-brand-100 rounded-2xl"
              >
                {loading ? 'Searching...' : 'Continue Verification'}
                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.form>
          )}

          {step === 2 && (
            <motion.form 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleStep2} 
              className="space-y-4"
            >
              <div className="bg-brand-50 p-4 rounded-2xl mb-2 flex items-center gap-3 border border-brand-100">
                 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-brand-600 shadow-sm font-bold">
                    {foundUser?.displayName?.charAt(0)}
                 </div>
                 <div>
                    <p className="text-xs font-bold text-brand-600 uppercase tracking-widest">Identified As</p>
                    <p className="text-sm font-bold text-slate-800">{foundUser?.displayName}</p>
                 </div>
              </div>

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="email" placeholder="Email Address" required
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-400 text-sm font-medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" placeholder="Mobile Number" required
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-400 text-sm font-medium"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password" placeholder="Create Password" required minLength={6}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-400 text-sm font-medium"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full btn-primary py-4 flex items-center justify-center gap-2 group mt-6 shadow-xl shadow-brand-100 rounded-2xl"
              >
                {loading ? 'Activating...' : 'Activate My Account'}
                <CheckCircle2 size={18} className="group-hover:scale-110 transition-transform" />
              </button>
            </motion.form>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6 py-4"
            >
              <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                 <CheckCircle2 size={40} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Account Activated!</h3>
                <p className="text-slate-500 mt-2 text-sm">You can now login using your ID and newly created password.</p>
              </div>
              <button 
                onClick={() => navigate('/login')}
                className="w-full btn-primary py-4 rounded-2xl shadow-lg shadow-brand-200"
              >
                Go to Login
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
