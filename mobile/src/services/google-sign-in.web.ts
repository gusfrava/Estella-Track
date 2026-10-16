// The browser preview signs in with the Firebase popup (services/firebase.js), as the website does.
export const googleSignInAvailable = false;
export const googleIdToken = async (): Promise<string | null> => null;
export const googleSignOut = async () => {};
