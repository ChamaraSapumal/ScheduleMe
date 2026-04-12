import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getDatabase } from "firebase/database";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDyeN82DTpq4f6OLjVoTJZdtyqyrcjnuYU",
  authDomain: "scheduleme-f51b3.firebaseapp.com",
  databaseURL: "https://scheduleme-f51b3-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "scheduleme-f51b3",
  storageBucket: "scheduleme-f51b3.firebasestorage.app",
  messagingSenderId: "651252888372",
  appId: "1:651252888372:web:25fb8265369c8619cc6b61",
  measurementId: "G-SC0BEL1FL8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export const db = getDatabase(app);
