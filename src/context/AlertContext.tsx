import React, { createContext, useState, useContext, ReactNode, useRef } from 'react';
import { StyleSheet } from 'react-native';

interface AlertOptions {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
  activeAlert: AlertOptions | null;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider = ({ children }: { children: ReactNode }) => {
  const [activeAlert, setActiveAlert] = useState<AlertOptions | null>(null);

  const showAlert = (newOptions: AlertOptions) => {
    console.log("Triggering Dynamic Island Alert:", newOptions.title);
    setActiveAlert(newOptions);
  };

  const hideAlert = () => {
    setActiveAlert(null);
  };

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert, activeAlert }}>
      {children}
      {/* 
          Modal Alert UI has been disabled in favor of Dynamic Island Alerts. 
          The state is now consumed by the DynamicIsland component.
      */}
    </AlertContext.Provider>
  );
};

export const useCustomAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useCustomAlert must be used within an AlertProvider');
  }
  return context;
};
