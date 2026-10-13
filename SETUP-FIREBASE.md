# Connect Estella to Firebase

This takes about 10 minutes. You only do it once.

## 1. Create the project
Go to console.firebase.google.com, click **Add project** and call it `estella-track`. You can turn Google Analytics off.

## 2. Register the web app and copy the config
In the project overview, click the **</>** (Web) icon. Give it a nickname, leave Firebase Hosting unchecked, and click **Register app**.

Firebase shows a `firebaseConfig` block. Open `js/config.js` and paste the six values into `FIREBASE_CONFIG`: apiKey, authDomain, projectId, storageBucket, messagingSenderId and appId. That's the only file you need to edit.

These values are safe to publish on GitHub. What protects the data is the security rules in step 5.

## 3. Turn on sign-in methods
Go to **Build → Authentication → Get started → Sign-in method**.
- Enable **Email/Password**. Leave "Email link" off.
- Enable **Google** and pick your email as the support email.

## 4. Authorize your GitHub Pages domain
Go to **Authentication → Settings → Authorized domains → Add domain** and add `YOUR-USERNAME.github.io`. Without this step, Google sign-in fails on the live site.

## 5. Create the database and lock it down
Go to **Build → Firestore Database → Create database**. Choose **production mode** and a location near you (for example `us-east1`). You can't change the location later.

Then open the **Rules** tab, replace everything with the contents of `firestore.rules`, and click **Publish**. With these rules, each person can only read and write their own data.

## 6. Optional: Spanish emails
The password reset email follows the language the app is set to (ES/EN). To edit the email text, go to **Authentication → Templates**.

## 7. Test it
Push the whole folder to your GitHub Pages repo, open the site, create an account and add a routine. Then sign in on another phone and your routine will be there.

Opening `index.html` by double-clicking it won't work. Use the GitHub Pages URL, or a local server (see README.md). If something fails, add `?debug` to the URL and check the browser console.

## How it works
- Each user's data lives in one Firestore document, `users/{uid}`.
- The app also keeps a copy on the phone, so it opens fast and works offline at the gym. It syncs when you're back online.
- The first time someone signs in on a phone that already has routines from the version without accounts, those routines move into their account.
- Signing out removes that account's copy from the phone.
