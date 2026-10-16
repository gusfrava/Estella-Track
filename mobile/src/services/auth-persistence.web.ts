import { FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
export const configuredAuth = (app: FirebaseApp) => getAuth(app);
