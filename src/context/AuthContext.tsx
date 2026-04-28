import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type UserRole = 'super-admin' | 'school-admin' | 'teacher' | 'student' | 'parent';

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  schoolId: string;
  displayName: string;
  uniqueId?: string;
  photoURL?: string;
  classId?: string;
  section?: string;
  assignedClasses?: string[];
  bio?: string;
  phoneNumber?: string;
  dob?: string;
  hideBirthday?: boolean;
  createdAt?: any;
  parentName?: string;
  rollNumber?: string;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (fbUser) {
        // Step 1: Root lookup for school orientation
        try {
          const rootSnap = await getDoc(doc(db, 'users', fbUser.uid));
          if (rootSnap.exists()) {
            const { schoolId } = rootSnap.data();
            if (schoolId) {
              // Step 2: Nested lookup for full profile
              unsubscribeDoc = onSnapshot(doc(db, 'schools', schoolId, 'users', fbUser.uid), (docSnap) => {
                if (docSnap.exists()) {
                  setUser({ ...docSnap.data() as AppUser, uid: fbUser.uid, schoolId });
                } else {
                  // Fallback to root data if nested not yet synced (legacy/migration)
                  setUser({ ...rootSnap.data() as AppUser, uid: fbUser.uid });
                }
                setLoading(false);
              }, (err) => {
                console.error("Nested user doc listener error:", err);
                setLoading(false);
              });
            } else {
              setUser({ ...rootSnap.data() as AppUser, uid: fbUser.uid });
              setLoading(false);
            }
          } else {
            setUser(null);
            setLoading(false);
          }
        } catch (err) {
          console.error("Auth init error:", err);
          setUser(null);
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const logout = () => auth.signOut();

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
