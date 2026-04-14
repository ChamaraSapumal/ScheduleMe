import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';
import { AuthContext } from '../context/AuthContext';
import { useCustomAlert } from '../context/AlertContext';
import { colors, spacing } from '../theme';
import { sendWelcomeEmail } from '../utils/emailjsService';

export default function LoginScreen() {
  const { setUnlocked, completeOnboarding, hasSeenOnboarding, resetOnboarding } = useContext(AuthContext);
  const { showAlert } = useCustomAlert();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authMode, setAuthMode] = useState<'none' | 'login' | 'register'>('none');

  const handleAuth = async () => {
    if (!email || !password) {
      showAlert({ title: 'Error', message: 'Please enter both email and password.' });
      return;
    }
    
    try {
      if (authMode === 'register') {
        if (password !== confirmPassword) {
          showAlert({ title: 'Error', message: 'Passwords do not match.' });
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await resetOnboarding(userCredential.user.uid); // Forcefully clear flag for THIS specific new user
        
        // Fire & Forget Welcome Email unconditionally
        try {
          sendWelcomeEmail(email, email.split('@')[0]);
          console.log("Triggered welcome email.");
        } catch (e) {
          console.log("Email trigger failed:", e);
        }
        
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        // They are an existing user logging in on a new device, skip the tour:
        if (hasSeenOnboarding === false) {
          await completeOnboarding();
        }
      }
      setUnlocked(true);
    } catch (error: any) {
      showAlert({ title: 'Authentication Error', message: error.message });
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Background Abstract Geometric Art */}
      <View style={styles.artContainer} pointerEvents="none">
        {/* Beige abstract shape */}
        <View style={[styles.shape, styles.shapeBeige]} />
        {/* Black abstract shape */}
        <View style={[styles.shape, styles.shapeBlack]} />
        {/* Yellow abstract shape */}
        <View style={[styles.shape, styles.shapeYellow]} />
      </View>

      <View style={styles.content}>
        {authMode === 'none' ? (
          <View style={styles.landingContent}>
            <Text style={styles.heroText}>Secure.{"\n"}Anonymous.{"\n"}Private.</Text>
            
            <View style={styles.landingActions}>
              <TouchableOpacity style={styles.btnGetStarted} onPress={() => setAuthMode('register')}>
                <Text style={styles.btnGetStartedText}>Get started</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => setAuthMode('login')}>
                <Text style={styles.btnLinkText}>
                  Already have an{"\n"}account? <Text style={{ textDecorationLine: 'underline' }}>Log in</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.authSheet}>
            <TouchableOpacity onPress={() => { setAuthMode('none'); Keyboard.dismiss(); }} style={styles.backButton}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            <Text style={styles.authTitle}>{authMode === 'login' ? 'Welcome Back' : 'Create Account'}</Text>
            
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
            {authMode === 'register' && (
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                placeholderTextColor={colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            )}
            
            <TouchableOpacity style={styles.btnAction} onPress={handleAuth}>
              <Text style={styles.btnActionText}>
                {authMode === 'register' ? 'Sign up' : 'Log in'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9', // slightly offwhite base for geometric art pop
  },
  artContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  shape: {
    position: 'absolute',
  },
  shapeBeige: {
    backgroundColor: colors.secondary, // Beige
    width: 350,
    height: 400,
    borderRadius: 80,
    transform: [{ rotate: '-35deg' }],
    top: -150,
    left: -100,
  },
  shapeBlack: {
    backgroundColor: '#000',
    width: 250,
    height: 380,
    borderRadius: 60,
    transform: [{ rotate: '45deg' }],
    top: 50,
    right: -120,
    borderBottomLeftRadius: 0,
  },
  shapeYellow: {
    backgroundColor: colors.primary, // Yellow
    width: 500,
    height: 120,
    transform: [{ rotate: '-25deg' }],
    top: 400,
    left: -100,
  },
  content: {
    flex: 1,
    padding: spacing.l,
    justifyContent: 'flex-end', // Pushes content to bottom half
    paddingBottom: spacing.xxl * 1.5,
  },
  landingContent: {
    width: '100%',
  },
  heroText: {
    fontSize: 42,
    fontWeight: '900',
    color: '#000',
    lineHeight: 50,
    marginBottom: spacing.xxl,
  },
  landingActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnGetStarted: {
    backgroundColor: '#000',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginRight: spacing.l,
  },
  btnGetStartedText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  btnLinkText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  authSheet: {
    backgroundColor: '#FFF',
    padding: spacing.xl,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  backButton: {
    marginBottom: spacing.l,
  },
  backText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
  authTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000',
    marginBottom: spacing.l,
  },
  input: {
    backgroundColor: colors.cardBackground,
    color: '#000',
    padding: spacing.m,
    borderRadius: 12,
    marginBottom: spacing.m,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  btnAction: {
    backgroundColor: '#000',
    padding: spacing.m,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.s,
  },
  btnActionText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
