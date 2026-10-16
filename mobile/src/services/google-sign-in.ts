import Constants, { ExecutionEnvironment } from 'expo-constants';

// Native Google sign-in needs the library's native code: development and store builds have it, Expo Go doesn't.
export const googleSignInAvailable = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let configured = false;
async function oneTap() {
  const lib = await import('react-native-nitro-google-signin');
  if (!configured) { lib.GoogleOneTapSignIn.configure({ webClientId: 'autoDetect' }); configured = true; }   // web client from google-services.json
  return lib;
}

// The Google ID token Firebase signs in with, or null when the person closes the account picker.
// Always shows the account picker, like the website's prompt: 'select_account'.
export async function googleIdToken(): Promise<string | null> {
  const { GoogleOneTapSignIn, isSuccessResponse } = await oneTap();
  await GoogleOneTapSignIn.checkPlayServices();
  const response = await GoogleOneTapSignIn.presentExplicitSignIn();
  return isSuccessResponse(response) && response.data ? response.data.idToken : null;
}

// Forget the chosen Google account so the next sign-in asks again.
export async function googleSignOut() {
  if (!configured) return;
  try { await (await oneTap()).GoogleOneTapSignIn.signOut(); } catch { /* signing out of Firebase still happens */ }
}
