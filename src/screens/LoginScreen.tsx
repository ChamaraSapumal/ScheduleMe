import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';
import { AuthContext } from '../context/AuthContext';
import { useCustomAlert } from '../context/AlertContext';
import { colors, spacing } from '../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function LoginScreen() {
  const { setUnlocked } = useContext(AuthContext);
  const { showAlert } = useCustomAlert();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleAuth = async () => {
    console.log(`Starting ${isRegistering ? 'Registration' : 'Login'} for: ${email}`);
    if (!email || !password) {
      showAlert({ title: 'Error', message: 'Please enter both email and password.' });
      return;
    }
    
    try {
      if (isRegistering) {
        console.log("Calling createUserWithEmailAndPassword...");
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        console.log("Calling signInWithEmailAndPassword...");
        await signInWithEmailAndPassword(auth, email, password);
      }
      console.log("Auth success! Setting isUnlocked to true.");
      setUnlocked(true);
    } catch (error: any) {
      console.error("Auth Exception:", error.code, error.message);
      showAlert({ title: 'Authentication Error', message: error.message });
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Decorative Circles */}
      <View style={styles.cyanCircle} />
      <View style={styles.yellowCircle} />

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <MaterialCommunityIcons name="clock-outline" size={48} color={colors.textPrimary} />
          <Text style={styles.title}>ScheduleMe</Text>
        </View>

        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          
          <TouchableOpacity style={styles.button} onPress={handleAuth}>
            <Text style={styles.buttonText}>
              {isRegistering ? 'Sign up' : 'Sign in'} <MaterialCommunityIcons name="arrow-right" size={16} />
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)}>
            <Text style={styles.toggleText}>
              {isRegistering ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cyanCircle: {
    position: 'absolute',
    top: -50,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.primary,
    opacity: 0.9,
  },
  yellowCircle: {
    position: 'absolute',
    bottom: -50,
    right: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: colors.secondary,
    opacity: 0.9,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    zIndex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: spacing.s,
  },
  formContainer: {
    width: '100%',
  },
  input: {
    backgroundColor: colors.cardBackground,
    color: colors.textPrimary,
    padding: spacing.m,
    borderRadius: 12,
    marginBottom: spacing.m,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.textPrimary,
    padding: spacing.m,
    borderRadius: 30, // Pill shape like in mockup
    alignItems: 'center',
    marginTop: spacing.m,
  },
  buttonText: {
    color: colors.textDark,
    fontSize: 18,
    fontWeight: 'bold',
  },
  toggleText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.l,
    fontSize: 14,
  },
});
