import React, { createContext, useState, useContext, ReactNode, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing, Pressable } from 'react-native';
import { colors, spacing } from '../theme';

interface AlertOptions {
  title: string;
  message: string;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider = ({ children }: { children: ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<AlertOptions | null>(null);
  
  const scaleValue = useRef(new Animated.Value(0.8)).current;
  const opacityValue = useRef(new Animated.Value(0)).current;

  const showAlert = (newOptions: AlertOptions) => {
    console.log("Showing Custom Alert:", newOptions.title);
    setOptions(newOptions);
    setVisible(true);
    
    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(opacityValue, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start();
  };

  const hideAlert = () => {
    Animated.parallel([
      Animated.timing(scaleValue, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      setVisible(false);
      setOptions(null);
    });
  };

  const handleConfirm = () => {
    if (options?.onConfirm) options.onConfirm();
    hideAlert();
  };

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <Modal
        transparent
        visible={visible}
        animationType="none"
        onRequestClose={hideAlert}
      >
        <Pressable style={styles.overlay} onPress={hideAlert}>
          <Animated.View 
            style={[
              styles.modalContainer, 
              { 
                opacity: opacityValue,
                transform: [{ scale: scaleValue }]
              }
            ]}
          >
            <View style={styles.content}>
               <View style={styles.iconCircle}>
                  <Text style={styles.iconText}>!</Text>
               </View>
               <Text style={styles.title}>{options?.title}</Text>
               <Text style={styles.message}>{options?.message}</Text>
            </View>
            
            <View style={styles.footer}>
              {options?.showCancel && (
                <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={hideAlert}>
                  <Text style={styles.cancelText}>{options.cancelText || 'Cancel'}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.button} onPress={handleConfirm}>
                <Text style={styles.confirmText}>{options?.confirmText || 'OK'}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.cardBackground,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  content: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconCircle: {
     width: 56,
     height: 56,
     borderRadius: 28,
     backgroundColor: 'rgba(91, 194, 216, 0.15)',
     justifyContent: 'center',
     alignItems: 'center',
     marginBottom: spacing.m,
  },
  iconText: {
     color: colors.primary,
     fontSize: 24,
     fontWeight: 'bold',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: spacing.s,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.l,
    paddingTop: 0,
    gap: spacing.m,
  },
  button: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: spacing.m,
    alignItems: 'center',
    borderRadius: 16,
    elevation: 4,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  confirmText: {
    color: colors.textDark,
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelText: {
    color: colors.textSecondary,
    fontWeight: 'bold',
    fontSize: 16,
  },
});
