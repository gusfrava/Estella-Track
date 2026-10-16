import { FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
export function configuredAuth(app: FirebaseApp) {
  try { return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) }); }
  catch (error) { if ((error as { code?: string }).code === 'auth/already-initialized') return getAuth(app); throw error; }
}
