import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../config/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isUnlocked: boolean;
  setUnlocked: (unlocked: boolean) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  isAdmin: false,
  isUnlocked: false,
  setUnlocked: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUnlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setUnlocked(false);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const isAdmin = user?.email === 'chamarasecu21@gmail.com';

  return (
    <AuthContext.Provider value={{ user, loading, logout, isAdmin, isUnlocked, setUnlocked }}>
      {children}
    </AuthContext.Provider>
  );
};
