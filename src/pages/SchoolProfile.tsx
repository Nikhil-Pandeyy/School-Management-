import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion } from 'motion/react';
import { 
  School, 
  MapPin, 
  Mail, 
  Phone, 
  Calendar, 
  Hash, 
  ShieldCheck, 
  Edit, 
  Save, 
  X,
  CreditCard,
  Building2
} from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';

export default function SchoolProfile() {
  const { user } = useAuth();
  const [schoolData, setSchoolData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    contactEmail: '',
    phone: '',
    website: '',
    establishedYear: ''
  });

  useEffect(() => {
    if (user?.schoolId) {
      fetchSchoolData();
    }
  }, [user]);

  const fetchSchoolData = async () => {
    try {
      const docRef = doc(db, 'schools', user?.schoolId || '');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSchoolData(data);
        setFormData({
          name: data.name || '',
          address: data.address || '',
          contactEmail: data.contactEmail || '',
          phone: data.phone || '',
          website: data.website || '',
          establishedYear: data.establishedYear || ''
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `schools/${user?.schoolId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const docRef = doc(db, 'schools', user?.schoolId || '');
      await updateDoc(docRef, {
        ...formData,
        updatedAt: new Date().toISOString()
      });
      setIsEditing(false);
      fetchSchoolData();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `schools/${user?.schoolId}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !schoolData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-slate-400 font-medium">Loading school profile...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">School Profile</h1>
          <p className="text-slate-500 mt-1">Manage and view your institution's public information.</p>
        </div>
        {user?.role === 'school-admin' && (
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
              isEditing ? 'bg-slate-100 text-slate-600' : 'bg-brand-600 text-white shadow-lg shadow-brand-100 hover:bg-brand-700'
            }`}
          >
            {isEditing ? <><X size={18}/> Cancel</> : <><Edit size={18}/> Edit Profile</>}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Branding & Status */}
        <div className="md:col-span-1 space-y-6">
          <div className="dashboard-card flex flex-col items-center text-center p-8 bg-gradient-to-b from-white to-slate-50 border-none shadow-xl shadow-slate-200/50">
            <div className="w-24 h-24 bg-brand-600 rounded-3xl flex items-center justify-center text-white mb-6 shadow-2xl shadow-brand-200">
              <School size={48} />
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">{schoolData?.name}</h2>
            <div className="mt-4 flex items-center gap-2 px-3 py-1 bg-brand-50 text-brand-600 rounded-full text-xs font-bold uppercase tracking-widest">
               <ShieldCheck size={14} />
               Verified Institution
            </div>
            
            <div className="mt-8 w-full p-4 bg-white border border-slate-100 rounded-2xl text-left">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Official School Code</p>
              <div className="flex items-center justify-between">
                <span className="text-xl font-mono font-black text-slate-900 tracking-widest">{schoolData?.schoolCode}</span>
                <Hash className="text-brand-200" size={24} />
              </div>
            </div>
          </div>

          <div className="dashboard-card p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <CreditCard size={18} className="text-indigo-500" />
              Subscription Details
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Service Plan</span>
                <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase text-[10px] tracking-widest">Enterprise</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Status</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                   <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                   Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Info Form/View */}
        <div className="md:col-span-2">
          <div className="dashboard-card p-8">
            <form onSubmit={handleUpdate} className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Building2 size={12} /> Institution Name
                  </label>
                  {isEditing ? (
                    <input 
                      type="text" required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-medium focus:ring-2 focus:ring-brand-500 outline-none"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  ) : (
                    <p className="text-base font-bold text-slate-800">{schoolData?.name}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} /> Estd. Year
                  </label>
                  {isEditing ? (
                    <input 
                      type="number"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-medium focus:ring-2 focus:ring-brand-500 outline-none"
                      value={formData.establishedYear}
                      onChange={e => setFormData({...formData, establishedYear: e.target.value})}
                    />
                  ) : (
                    <p className="text-base font-bold text-slate-800">{schoolData?.establishedYear || 'Not Specified'}</p>
                  )}
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <MapPin size={12} /> Address
                  </label>
                  {isEditing ? (
                    <textarea 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-medium focus:ring-2 focus:ring-brand-500 outline-none min-h-[80px]"
                      value={formData.address}
                      onChange={e => setFormData({...formData, address: e.target.value})}
                    />
                  ) : (
                    <p className="text-base font-bold text-slate-800 leading-relaxed">{schoolData?.address || 'Address not listed'}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Mail size={12} /> Official Email
                  </label>
                  {isEditing ? (
                    <input 
                      type="email"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-medium focus:ring-2 focus:ring-brand-500 outline-none"
                      value={formData.contactEmail}
                      onChange={e => setFormData({...formData, contactEmail: e.target.value})}
                    />
                  ) : (
                    <p className="text-base font-bold text-slate-800">{schoolData?.contactEmail || 'No email registered'}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Phone size={12} /> Contact Number
                  </label>
                  {isEditing ? (
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-medium focus:ring-2 focus:ring-brand-500 outline-none"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                    />
                  ) : (
                    <p className="text-base font-bold text-slate-800">{schoolData?.phone || 'No phone number'}</p>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="pt-6 border-t border-slate-100">
                  <button 
                    type="submit" 
                    className="w-full btn-primary py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-brand-100"
                  >
                    <Save size={20} /> Save Changes
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
