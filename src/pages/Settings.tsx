import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Settings as SettingsIcon, 
  User, 
  Globe, 
  Moon, 
  Sun, 
  Bell, 
  Shield, 
  ChevronRight, 
  LogOut,
  Camera,
  Save,
  CheckCircle2,
  AlertCircle,
  School
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, getDoc, getDocs, query, collection, where } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { resizeImage } from '../utils/imageUtils';

const LANGUAGES = [
  { code: 'en', name: 'English (US)' },
  { code: 'hi', name: 'Hindi (हिन्दी)' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'fr', name: 'French (Français)' },
  { code: 'ar', name: 'Arabic (العربية)' }
];

export default function Settings() {
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState<'profile' | 'personal' | 'language' | 'notifications' | 'security' | 'school' | 'data' | 'subscription'>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const [profileData, setProfileData] = useState({
    displayName: user?.displayName || '',
    bio: user?.bio || '',
    phoneNumber: user?.phoneNumber || '',
    hideBirthday: user?.hideBirthday || false
  });

  const [personalData, setPersonalData] = useState({
    fullName: '',
    personalEmail: '',
    personalPhone: '',
    homeAddress: '',
    emergencyContact: '',
    bankAccount: '',
    taxId: ''
  });

  const [schoolData, setSchoolData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    subscriptionStatus: 'active',
    trialStartedAt: null as string | null,
    trialEndsAt: null as string | null
  });

  const [appConfig, setAppConfig] = useState({
    language: 'en',
    darkMode: false,
    emailNotifications: true,
    pushNotifications: true
  });

  useEffect(() => {
    if (activeSection === 'personal' && user?.uid && !personalData.fullName) {
      getDoc(doc(db, 'users', user.uid, 'private', 'personal'))
        .then(docSnap => {
          if (docSnap.exists()) {
            const data = docSnap.data() as any;
            setPersonalData({
              fullName: data.fullName || '',
              personalEmail: data.personalEmail || '',
              personalPhone: data.personalPhone || '',
              homeAddress: data.homeAddress || '',
              emergencyContact: data.emergencyContact || '',
              bankAccount: data.bankAccount || '',
              taxId: data.taxId || ''
            });
          }
        }).catch(err => console.error("Error fetching personal data:", err));
    }
  }, [activeSection, user?.uid]);

  useEffect(() => {
    if ((activeSection === 'school' || activeSection === 'subscription') && user?.schoolId) {
      getDoc(doc(db, 'schools', user.schoolId))
        .then(docSnap => {
          if (docSnap.exists()) {
            const data = docSnap.data() as any;
            setSchoolData({
              name: data.name || '',
              address: data.address || '',
              phone: data.phone || '',
              email: data.email || '',
              subscriptionStatus: data.subscriptionStatus || 'trial',
              trialStartedAt: data.trialStartedAt || null,
              trialEndsAt: data.trialEndsAt || null
            });
          }
        }).catch(err => handleFirestoreError(err, OperationType.GET, `schools/${user.schoolId}`));
    }
  }, [activeSection, user?.schoolId]);

  const handlePersonalUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      await setDoc(doc(db, 'users', user.uid, 'private', 'personal'), {
        ...personalData,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setStatusMessage({ type: 'success', text: 'Personal data updated securely!' });
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: 'Failed to update personal data.' });
    } finally {
      setIsSaving(false);
    }
  };

  const activateTrial = async () => {
    if (!user?.schoolId) return;
    setIsSaving(true);
    const now = new Date();
    const ends = new Date();
    ends.setDate(now.getDate() + 15);

    try {
      await setDoc(doc(db, 'schools', user.schoolId), {
        subscriptionStatus: 'trial',
        trialStartedAt: now.toISOString(),
        trialEndsAt: ends.toISOString(),
        updatedAt: now.toISOString()
      }, { merge: true });
      
      setSchoolData(prev => ({
        ...prev,
        subscriptionStatus: 'trial',
        trialStartedAt: now.toISOString(),
        trialEndsAt: ends.toISOString()
      }));
      
      setStatusMessage({ type: 'success', text: '15-Day Free Trial Activated!' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `schools/${user.schoolId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setIsSaving(true);
    setStatusMessage(null);

    try {
      // 1. Update Auth Profile
      await updateProfile(auth.currentUser, {
        displayName: profileData.displayName
      });

      // 2. Update Firestore User Record
      await setDoc(doc(db, 'users', user!.uid), {
        displayName: profileData.displayName,
        bio: profileData.bio,
        phoneNumber: profileData.phoneNumber,
        hideBirthday: profileData.hideBirthday,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setStatusMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user?.uid}`);
      setStatusMessage({ type: 'error', text: 'Failed to update profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  const navItems = [
    { id: 'profile', name: 'Profile Account', icon: User, desc: 'Manage your public information' },
    { id: 'personal', name: 'Personal File', icon: Shield, desc: 'Sensitive & Private Data' },
    { id: 'language', name: 'Language & Region', icon: Globe, desc: 'Choose your preferred language' },
    { id: 'notifications', name: 'Notifications', icon: Bell, desc: 'Control alerts and emails' },
    { id: 'security', name: 'Security & Access', icon: Shield, desc: 'Password and account safety' },
    ...(user?.role === 'school-admin' ? [
      { id: 'school', name: 'School Branding', icon: School, desc: 'Customize institution profile' },
      { id: 'subscription', name: 'Subscription', icon: Bell, desc: 'Manage Trial & Payments' }
    ] : []),
    { id: 'data', name: 'Data & Export', icon: Globe, desc: 'Download your information' }
  ];

  const handleSchoolUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'schools', user.schoolId), {
        name: schoolData.name,
        address: schoolData.address,
        phone: schoolData.phone,
        email: schoolData.email,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setStatusMessage({ type: 'success', text: 'School profile updated!' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `schools/${user.schoolId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const exportStudentsCSV = async () => {
    if (!user?.schoolId) return;
    try {
      const snap = await getDocs(query(collection(db, 'schools', user.schoolId, 'users'), where('role', '==', 'student')));
      const students = snap.docs.map(d => d.data());
      const headers = ['ID', 'Name', 'Email', 'Class', 'Section', 'EnrollmentDate'];
      const csv = [
        headers.join(','),
        ...students.map(s => `${s.uniqueId},"${s.displayName}",${s.email},"${s.classId}","${s.section}","${s.createdAt?.toDate?.() || ''}"`)
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', `students_${user?.schoolId}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Settings</h1>
        <p className="text-slate-500 text-sm font-medium italic">Personalize your EduCloud AI experience.</p>
      </header>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-72 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as any)}
              className={`w-full text-left p-4 rounded-2xl transition-all group border ${
                activeSection === item.id 
                  ? 'bg-brand-600 border-brand-600 text-white shadow-xl shadow-brand-100 scale-[1.02]' 
                  : 'bg-white border-slate-100 text-slate-600 hover:border-brand-200'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-xl transition-colors ${
                  activeSection === item.id ? 'bg-white/20' : 'bg-slate-50 group-hover:bg-brand-50 group-hover:text-brand-600'
                }`}>
                  <item.icon size={20} />
                </div>
                <div>
                   <p className="font-bold text-sm">{item.name}</p>
                   <p className={`text-[10px] font-medium leading-tight ${activeSection === item.id ? 'text-brand-100' : 'text-slate-400'}`}>
                     {item.desc}
                   </p>
                </div>
              </div>
            </button>
          ))}
          
          <div className="pt-4 mt-4 border-t border-slate-100">
             <button 
               onClick={logout}
               className="w-full text-left p-4 rounded-2xl text-rose-500 bg-rose-50 hover:bg-rose-100 transition-all font-black uppercase tracking-widest text-[10px] flex items-center justify-between"
             >
                <span>Terminate Session</span>
                <LogOut size={16} />
             </button>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 min-h-[500px]">
           <AnimatePresence mode="wait">
              {activeSection === 'profile' && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-8"
                >
                   <div className="flex items-center gap-6">
                      <div className="relative group">
                         <div className="w-24 h-24 bg-slate-100 rounded-3xl overflow-hidden border-4 border-white shadow-lg relative">
                            {user?.photoURL ? (
                              <img src={user.photoURL} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <User size={48} />
                              </div>
                            )}
                            {isSaving && (
                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              </div>
                            )}
                         </div>
                         <label className="absolute -bottom-2 -right-2 p-2 bg-brand-600 text-white rounded-xl shadow-lg border-2 border-white hover:scale-110 transition-transform cursor-pointer">
                            <Camera size={16} />
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file || !auth.currentUser) return;
                                
                                setIsSaving(true);
                                setStatusMessage(null);
                                
                                try {
                                  const base64String = await new Promise<string>((resolve, reject) => {
                                    const reader = new FileReader();
                                    reader.onloadend = () => resolve(reader.result as string);
                                    reader.onerror = reject;
                                    reader.readAsDataURL(file);
                                  });

                                  // Resize for Firestore (better quality but still compressed)
                                  const firestorePhoto = await resizeImage(base64String, 400, 400, 0.7);

                                  // Update Auth with a very tiny preview or null to avoid "URL too long" error
                                  // Auth photoURL is limited in size; Firestore is where we store the actual data
                                  await updateProfile(auth.currentUser!, { photoURL: null });
                                  
                                  // Update Firestore - This is our source of truth for the profile picture
                                  await setDoc(doc(db, 'users', user!.uid), {
                                    photoURL: firestorePhoto,
                                    updatedAt: new Date().toISOString()
                                  }, { merge: true });
                                  
                                  setStatusMessage({ type: 'success', text: 'Profile picture updated!' });
                                } catch (err: any) {
                                  console.error("Profile picture update error:", err);
                                  setStatusMessage({ type: 'error', text: err.message || 'Failed to update profile picture.' });
                                } finally {
                                  setIsSaving(false);
                                }
                              }}
                            />
                         </label>
                      </div>
                      <div>
                         <h3 className="text-xl font-bold text-slate-800">{user?.displayName}</h3>
                         <p className="text-sm font-mono text-slate-400">{user?.uniqueId}</p>
                         <div className="mt-2 flex gap-2">
                            <span className="px-2 py-0.5 rounded bg-brand-50 text-brand-600 text-[10px] font-bold uppercase tracking-widest">{user?.role}</span>
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-widest">Active</span>
                         </div>
                      </div>
                   </div>

                   <form onSubmit={handleProfileUpdate} className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                         <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
                            <input 
                              type="text" 
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-semibold"
                              value={profileData.displayName}
                              onChange={e => setProfileData({...profileData, displayName: e.target.value})}
                            />
                         </div>
                         <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Phone Number</label>
                            <input 
                              type="tel" 
                              placeholder="+1 234 567 890"
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-semibold"
                              value={profileData.phoneNumber}
                              onChange={e => setProfileData({...profileData, phoneNumber: e.target.value})}
                            />
                         </div>
                      </div>

                      <div>
                         <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Short Biography</label>
                         <textarea 
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm min-h-[100px] leading-relaxed"
                           placeholder="Tell us a bit about yourself..."
                           value={profileData.bio}
                           onChange={e => setProfileData({...profileData, bio: e.target.value})}
                         />
                      </div>

                      <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between mt-4">
                         <div>
                            <p className="text-sm font-bold text-slate-800">Private Birthday</p>
                            <p className="text-[10px] text-slate-400 font-medium">Hide your birthday from the upcoming birthdays list.</p>
                         </div>
                         <button 
                           type="button"
                           onClick={() => setProfileData({...profileData, hideBirthday: !profileData.hideBirthday})}
                           className={`w-12 h-6 rounded-full relative transition-colors ${profileData.hideBirthday ? 'bg-brand-600' : 'bg-slate-300'}`}
                         >
                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${profileData.hideBirthday ? 'left-6.5' : 'left-0.5'}`}></div>
                         </button>
                      </div>

                      <div className="pt-4 flex items-center justify-between">
                         <AnimatePresence>
                           {statusMessage && (
                             <motion.div 
                               initial={{ opacity: 0, y: 10 }}
                               animate={{ opacity: 1, y: 0 }}
                               exit={{ opacity: 0 }}
                               className={`flex items-center gap-2 text-sm font-bold ${statusMessage.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}
                             >
                                {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                                {statusMessage.text}
                             </motion.div>
                           )}
                         </AnimatePresence>
                         <button 
                           type="submit" 
                           disabled={isSaving}
                           className="btn-primary py-3 px-8 flex items-center gap-2 shadow-lg shadow-brand-100 disabled:opacity-50"
                         >
                            <Save size={18} />
                            <span>{isSaving ? 'Synchronizing...' : 'Save Changes'}</span>
                         </button>
                      </div>
                   </form>
                </motion.div>
              )}

              {activeSection === 'personal' && (
                <motion.div
                  key="personal"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-8"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center">
                      <Shield size={32} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">Personal File</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">High Security Data Storage</p>
                    </div>
                  </div>

                  <div className="p-4 bg-brand-50 border border-brand-100 rounded-2xl flex gap-4">
                    <div className="mt-1 text-brand-600"><Shield size={20} /></div>
                    <p className="text-[11px] text-brand-700 font-medium leading-relaxed">
                      Data in this section is stored in a separate encrypted subcollection and is only accessible to you. It will not be visible on your public profile or to other staff members.
                    </p>
                  </div>

                  <form onSubmit={handlePersonalUpdate} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Legal Full Name</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-semibold"
                          value={personalData.fullName}
                          onChange={e => setPersonalData({...personalData, fullName: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Private Email</label>
                        <input 
                          type="email" 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-semibold"
                          value={personalData.personalEmail}
                          onChange={e => setPersonalData({...personalData, personalEmail: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Private Phone</label>
                        <input 
                          type="tel" 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-semibold"
                          value={personalData.personalPhone}
                          onChange={e => setPersonalData({...personalData, personalPhone: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Home Address</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-semibold"
                          value={personalData.homeAddress}
                          onChange={e => setPersonalData({...personalData, homeAddress: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Bank Account Info</label>
                        <input 
                          type="text" 
                          placeholder="Routing/Account or IBAN"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-semibold"
                          value={personalData.bankAccount}
                          onChange={e => setPersonalData({...personalData, bankAccount: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Tax ID / SSN</label>
                        <input 
                          type="text" 
                          placeholder="XXX-XX-XXXX"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-semibold"
                          value={personalData.taxId}
                          onChange={e => setPersonalData({...personalData, taxId: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="pt-4 flex items-center justify-between">
                      {statusMessage && (
                        <div className={`text-sm font-bold ${statusMessage.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {statusMessage.text}
                        </div>
                      )}
                      <button 
                        type="submit" 
                        disabled={isSaving}
                        className="btn-primary py-3 px-8 flex items-center gap-2 shadow-lg shadow-brand-100 disabled:opacity-50"
                      >
                         <Save size={18} />
                         <span>{isSaving ? 'Saving...' : 'Secure Update'}</span>
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {activeSection === 'subscription' && (
                <motion.div
                  key="subscription"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-8"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-brand-600 text-white rounded-2xl flex items-center justify-center">
                      <Bell size={32} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">Subscription Plan</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Manage institutional access</p>
                    </div>
                  </div>

                  <div className={`p-8 rounded-[32px] border-2 transition-all ${schoolData.subscriptionStatus === 'trial' ? 'border-brand-200 bg-brand-50/30' : 'border-slate-100 bg-slate-50'}`}>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <span className="px-3 py-1 bg-white border border-brand-200 rounded-full text-[10px] font-black text-brand-600 uppercase tracking-widest">Current Status</span>
                        <h4 className="text-3xl font-black text-slate-900 mt-2 uppercase tracking-tight">
                          {schoolData.subscriptionStatus === 'trial' ? '15-Day Free Trial' : 'Professional Active'}
                        </h4>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account ID</p>
                        <p className="text-sm font-mono font-bold text-slate-800">{user?.schoolId?.substring(0, 8)}</p>
                      </div>
                    </div>

                    {schoolData.subscriptionStatus === 'trial' ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-brand-600">
                          <CheckCircle2 size={16} />
                          <p className="text-sm font-bold">End-to-End Encryption Included</p>
                        </div>
                        <div className="flex items-center gap-2 text-brand-600">
                          <CheckCircle2 size={16} />
                          <p className="text-sm font-bold">Priority Support Access</p>
                        </div>
                        
                        <div className="mt-8 pt-8 border-t border-brand-100">
                           <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Trial Period</p>
                           <div className="h-2 w-full bg-brand-200/30 rounded-full overflow-hidden">
                              <div className="h-full bg-brand-600 w-2/3"></div>
                           </div>
                           <div className="flex justify-between mt-2 text-[10px] font-bold text-brand-600 font-mono">
                              <span>STARTED: {schoolData.trialStartedAt ? new Date(schoolData.trialStartedAt).toLocaleDateString() : 'N/A'}</span>
                              <span>EXPIRES: {schoolData.trialEndsAt ? new Date(schoolData.trialEndsAt).toLocaleDateString() : 'N/A'}</span>
                           </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <p className="text-sm text-slate-500 leading-relaxed font-medium">Your institution is currently on a legacy active plan. Upgrade to the new AI-Powered infrastructure for advanced features.</p>
                        
                        <button 
                          onClick={activateTrial}
                          disabled={isSaving}
                          className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-brand-100 hover:scale-[1.01] transition-all disabled:opacity-50"
                        >
                           {isSaving ? 'Processing Gateway...' : 'Activate 15-Day Free Trial'}
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="p-6 bg-white border border-slate-100 rounded-3xl hover:border-brand-200 transition-colors">
                        <h5 className="font-bold text-slate-800 text-sm mb-1">Standard Billing</h5>
                        <p className="text-xs text-slate-400 mb-4">$49.00 / Month</p>
                        <button className="text-[10px] font-black text-brand-600 uppercase tracking-widest flex items-center gap-2">
                           Setup Managed Payments <ChevronRight size={14} />
                        </button>
                     </div>
                     <div className="p-6 bg-white border border-slate-100 rounded-3xl hover:border-brand-200 transition-colors">
                        <h5 className="font-bold text-slate-800 text-sm mb-1">Enterprise Cloud</h5>
                        <p className="text-xs text-slate-400 mb-4">Contact Sales</p>
                        <button className="text-[10px] font-black text-brand-600 uppercase tracking-widest flex items-center gap-2">
                           View Pricing Table <ChevronRight size={14} />
                        </button>
                     </div>
                  </div>
                </motion.div>
              )}

              {activeSection === 'language' && (
                <motion.div
                  key="language"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6"
                >
                   <div className="space-y-4">
                      <h3 className="text-xl font-bold text-slate-800">Choose Language</h3>
                      <p className="text-sm text-slate-500 leading-relaxed italic">Select the language for the platform interface and localized data display.</p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                         {LANGUAGES.map((lang) => (
                           <button
                             key={lang.code}
                             onClick={() => setAppConfig({...appConfig, language: lang.code})}
                             className={`p-4 rounded-2xl flex items-center justify-between transition-all border ${
                                appConfig.language === lang.code 
                                  ? 'bg-brand-50 border-brand-200 text-brand-600 shadow-sm' 
                                  : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
                             }`}
                           >
                              <span className="font-bold text-sm">{lang.name}</span>
                              {appConfig.language === lang.code && <CheckCircle2 size={18} className="text-brand-500" />}
                           </button>
                         ))}
                      </div>
                   </div>

                   <div className="pt-8 mt-8 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                            {appConfig.darkMode ? <Moon size={24} /> : <Sun size={24} />}
                         </div>
                         <div>
                            <p className="font-bold text-sm text-slate-800">Visual Mode</p>
                            <p className="text-xs text-slate-400">Switch between light and dark themes</p>
                         </div>
                      </div>
                      <button 
                        onClick={() => setAppConfig({...appConfig, darkMode: !appConfig.darkMode})}
                        className={`w-14 h-8 rounded-full relative transition-colors ${appConfig.darkMode ? 'bg-brand-600' : 'bg-slate-200'}`}
                      >
                         <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm ${appConfig.darkMode ? 'left-7' : 'left-1'}`}></div>
                      </button>
                   </div>
                </motion.div>
              )}

              {activeSection === 'security' && (
                <motion.div
                  key="security"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6"
                >
                   <div className="space-y-6">
                      <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-4">
                         <div className="mt-1 text-amber-600"><AlertCircle size={20} /></div>
                         <div>
                            <p className="text-sm font-bold text-amber-800">Account Security Information</p>
                            <p className="text-[11px] text-amber-700/80 leading-relaxed mt-1">To change your password or security credentials, please contact the IT administration desk for your school. Multi-factor authentication is managed by your organization's policy.</p>
                         </div>
                      </div>

                      <div className="space-y-4">
                         <button className="w-full p-4 rounded-2xl border border-slate-100 flex items-center justify-between text-slate-600 hover:bg-slate-50 transition-all font-bold text-sm">
                            <span>Enable Two-Factor Authentication</span>
                            <ChevronRight size={18} />
                         </button>
                         <button className="w-full p-4 rounded-2xl border border-slate-100 flex items-center justify-between text-slate-600 hover:bg-slate-50 transition-all font-bold text-sm">
                            <span>Active Sessions History</span>
                            <ChevronRight size={18} />
                         </button>
                         <button className="w-full p-4 rounded-2xl border border-rose-100 flex items-center justify-between text-rose-600 hover:bg-rose-50 transition-all font-bold text-sm">
                            <span>Deactivate My Account</span>
                            <AlertCircle size={18} />
                         </button>
                      </div>
                   </div>
                </motion.div>
              )}

              {activeSection === 'school' && (
                <motion.div
                  key="school"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-8"
                >
                   <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center">
                         <School size={32} />
                      </div>
                      <div>
                         <h3 className="text-xl font-bold text-slate-800">School Profile</h3>
                         <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Institutional Identity</p>
                      </div>
                   </div>

                   <form onSubmit={handleSchoolUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                         <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Official Institution Name</label>
                         <input 
                           type="text" 
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-semibold"
                           value={schoolData.name}
                           onChange={e => setSchoolData({...schoolData, name: e.target.value})}
                         />
                      </div>
                      <div>
                         <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Contact Email</label>
                         <input 
                           type="email" 
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-semibold"
                           value={schoolData.email}
                           onChange={e => setSchoolData({...schoolData, email: e.target.value})}
                         />
                      </div>
                      <div>
                         <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Contact Phone</label>
                         <input 
                           type="tel" 
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-semibold"
                           value={schoolData.phone}
                           onChange={e => setSchoolData({...schoolData, phone: e.target.value})}
                         />
                      </div>
                      <div className="md:col-span-2">
                         <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Physical Address</label>
                         <textarea 
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm min-h-[80px]"
                           value={schoolData.address}
                           onChange={e => setSchoolData({...schoolData, address: e.target.value})}
                         />
                      </div>
                      <button type="submit" className="btn-primary py-3 px-8 flex items-center justify-center gap-2 group">
                         <Save size={18} />
                         <span>Update Institution</span>
                      </button>
                   </form>
                </motion.div>
              )}

              {activeSection === 'data' && (
                <motion.div
                  key="data"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6"
                >
                   <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                      <h3 className="text-lg font-black text-slate-800 mb-2">Export Student Directory</h3>
                      <p className="text-xs text-slate-500 mb-6 leading-relaxed">Download a complete list of currently enrolled students in CSV format for offline processing and archiving.</p>
                      <button 
                        onClick={exportStudentsCSV}
                        className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold text-xs hover:bg-slate-100 transition-all shadow-sm"
                      >
                         <Globe size={16} className="text-brand-500" />
                         Download Students.csv
                      </button>
                   </div>

                   <div className="p-6 bg-rose-50 rounded-2xl border border-rose-100">
                      <h3 className="text-lg font-black text-rose-900 mb-2">Account Deletion</h3>
                      <p className="text-xs text-rose-700 mb-6 leading-relaxed">Permanently delete your profile and all associated data from our servers. This action is irreversible.</p>
                      <button className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-700 transition-all shadow-md">
                         Request Deletion
                      </button>
                   </div>
                </motion.div>
              )}
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
