import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { motion, AnimatePresence } from 'motion/react';
import { School, Mail, Lock, User, PlusCircle, ArrowRight, LogIn, Hash } from 'lucide-react';

type LoginMode = 'admin' | 'user' | 'register' | 'activate';

export default function Login() {
  const [mode, setMode] = useState<LoginMode>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // User mode fields
  const [schoolCode, setSchoolCode] = useState('');
  const [uniqueId, setUniqueId] = useState('');

  // Activation fields
  const [activationCode, setActivationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Register fields
  const [schoolName, setSchoolName] = useState('');
  const [displayName, setDisplayName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'admin') {
        await signInWithEmailAndPassword(auth, email, password);
        navigate('/');
      } else if (mode === 'register') {
        // Registration for School Admin
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const fbUser = userCredential.user;

        // Create School Doc with unique numeric schoolCode
        const schoolId = Math.random().toString(36).substring(2, 9).toUpperCase();
        const schoolCodeNum = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits

        await setDoc(doc(db, 'schools', schoolId), {
          name: schoolName,
          schoolCode: schoolCodeNum,
          createdAt: new Date().toISOString(),
          subscriptionStatus: 'trial'
        });

        const userData = {
          uid: fbUser.uid,
          email,
          role: 'school-admin',
          schoolId,
          displayName,
          uniqueId: 'ADM-' + Math.floor(100 + Math.random() * 899).toString(),
          createdAt: new Date().toISOString()
        };

        // Create User Doc (Global Index)
        await setDoc(doc(db, 'users', fbUser.uid), { 
          uid: fbUser.uid, 
          email, 
          schoolId, 
          role: 'school-admin' 
        });

        // Create User Doc (Nested Profile)
        await setDoc(doc(db, 'schools', schoolId, 'users', fbUser.uid), userData);

        setSuccess(`Registration successful! Your School Code is: ${schoolCodeNum}. Please share this with your staff and students.`);
        setTimeout(() => navigate('/'), 3000);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUserAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // 1. Find school by schoolCode
      const schoolQuery = query(collection(db, 'schools'), where('schoolCode', '==', schoolCode), limit(1));
      const schoolSnapshot = await getDocs(schoolQuery).catch(err => handleFirestoreError(err, OperationType.GET, 'schools'));
      
      if (!schoolSnapshot || schoolSnapshot.empty) {
        throw new Error('Invalid School Code');
      }
      
      const schoolDoc = schoolSnapshot.docs[0];
      const schoolId = schoolDoc.id;

      // 2. Find user by schoolId and uniqueId within the nested school structure
      const userQuery = query(collection(db, 'schools', schoolId, 'users'), where('uniqueId', '==', uniqueId), limit(1));
      const userSnapshot = await getDocs(userQuery).catch(err => handleFirestoreError(err, OperationType.GET, `schools/${schoolId}/users`));

      if (!userSnapshot || userSnapshot.empty) {
        throw new Error('Invalid User ID for this school');
      }

      const userData = userSnapshot.docs[0].data();
      const userEmail = userData.email;

      if (!userData.isActivated) {
        throw new Error('Your account is not activated yet. Please click the "Activate" tab or the link below to set your password.');
      }

      // 3. Authenticate
      try {
        await signInWithEmailAndPassword(auth, userEmail, password);
        navigate('/');
      } catch (authErr: any) {
        if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/wrong-password') {
          throw new Error('Invalid password. If you forgot your password, contact your school admin.');
        }
        throw authErr;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const fbUser = result.user;
      
      const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
      if (!userDoc.exists()) {
        setError('No account found for this Google email. Please register your school first.');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-brand-100 rounded-full blur-[120px] opacity-40 -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-1/4 h-1/4 bg-sky-100 rounded-full blur-[100px] opacity-40 translate-y-1/2 -translate-x-1/2"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 p-8 z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-brand-200">
            <School size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">EduCloud AI</h1>
          <p className="text-slate-500 mt-2 text-center text-sm">
            {mode === 'admin' ? 'Administrative Access Console' : 
             mode === 'user' ? 'Student & Faculty Portal' : 
             'New School Boarding'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-50 p-1 rounded-2xl mb-8">
           <button 
             onClick={() => { setMode('admin'); setError(''); setSuccess(''); }}
             className={`flex-1 py-2 text-[10px] font-bold rounded-xl transition-all ${mode === 'admin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
           >
             ADMIN
           </button>
           <button 
             onClick={() => { setMode('user'); setError(''); setSuccess(''); }}
             className={`flex-1 py-2 text-[10px] font-bold rounded-xl transition-all ${mode === 'user' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
           >
             USER
           </button>
           <button 
             onClick={() => navigate('/activate')}
             className="flex-1 py-2 text-[10px] font-bold rounded-xl text-brand-600 hover:bg-brand-50 transition-all uppercase"
           >
             ACTIVATE
           </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 italic">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-50 text-emerald-600 text-sm rounded-xl border border-emerald-100 font-medium">
            {success}
          </div>
        )}

        <form onSubmit={mode === 'user' ? handleUserAuth : handleAdminAuth} className="space-y-4">
          <AnimatePresence mode="wait">
            {mode === 'register' ? (
              <motion.div 
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="relative">
                  <School className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" placeholder="School Name" required
                    className="login-input"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" placeholder="Your Name" required
                    className="login-input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="email" placeholder="Admin Email" required
                    className="login-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="password" placeholder="Password" required
                    className="login-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </motion.div>
            ) : mode === 'admin' ? (
              <motion.div 
                key="admin"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="email" placeholder="Admin Email" required
                    className="login-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="password" placeholder="Password" required
                    className="login-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="user"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" placeholder="6-Digit School Code" required
                    className="login-input"
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" placeholder="Your Unique ID (e.g. 10001)" required
                    className="login-input"
                    value={uniqueId}
                    onChange={(e) => setUniqueId(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="password" placeholder="Account Password" required
                    className="login-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="pt-2">
                  <button 
                    type="button"
                    onClick={() => navigate('/activate')}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-4"
                  >
                    Don't have a password yet? Activate your account here
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full btn-primary py-3.5 flex items-center justify-center gap-2 group mt-6 shadow-xl shadow-brand-100"
          >
            {loading ? 'Verifying...' : (mode === 'admin' || mode === 'user' ? 'Sign In' : 'Create School')}
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        {mode === 'admin' && (
          <>
            <div className="my-6 flex items-center gap-4 text-slate-300">
              <div className="flex-1 h-px bg-slate-100"></div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Or use OAuth</span>
              <div className="flex-1 h-px bg-slate-100"></div>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-3 px-4 bg-white border border-slate-200 rounded-xl flex items-center justify-center gap-3 text-slate-600 font-semibold hover:bg-slate-50 transition-colors shadow-sm"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              Continue with Google
            </button>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-slate-100 text-center space-y-3">
          {mode === 'register' ? (
            <p className="text-slate-500 text-sm">
              Back to login? 
              <button 
                onClick={() => setMode('admin')}
                className="ml-2 text-brand-600 font-semibold hover:underline"
              >
                Sign In
              </button>
            </p>
          ) : (
            <>
              <p className="text-slate-500 text-sm">
                School not registered? 
                <button 
                  onClick={() => setMode('register')}
                  className="ml-2 text-brand-600 font-semibold hover:underline"
                >
                  Register School
                </button>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

