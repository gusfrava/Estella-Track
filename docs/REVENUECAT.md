# RevenueCat development connection

The SDK connection is installed; paywalls, purchases, experiments and paid-feature restrictions are not enabled. No beta entitlements are granted automatically.

## Dashboard contract

- Entitlement: `estella_plus`
- Offering: `estella_plus_a`
- Test Store products: `estella_plus_monthly_a`, `estella_plus_annual_a`
- Both products must be attached to the entitlement and their monthly/annual Offering packages.
- Set the Offering current/default in RevenueCat.

## Development

The supplied public Test Store SDK key is in `js/billing-config.js`. The shared config and billing-session module are copied to mobile core by `mobile/scripts/sync-core.cjs`. Never put RevenueCat secret API keys in these files.

Website: serve the repository on localhost (for example `python -m http.server 8000`), open http://localhost:8000 and sign in. The pinned RevenueCat Web SDK loads on demand from jsDelivr. In browser developer tools, `window.estellaBilling.getState()` shows connection status, Firebase UID, CustomerInfo and Offerings. `await window.estellaBilling.refresh()` checks again. Public website hosts do not initialize Test Store.

Mobile: `react-native-purchases` is installed through Expo. Rebuild the development client after installing native dependencies; an old build does not contain the native SDK. Use a development build, not Expo Go preview behavior, to verify the actual native connection. Open Account to see the development-only RevenueCat connection status, customer UID, Offering IDs and refresh button. Expo's localhost web preview uses the installed Web SDK instead.

Sign in to create/identify the RevenueCat customer using the Firebase UID. Signed-out/local guests are not registered in this phase. App foreground refreshes the customer status. Logging out clears the app's billing state immediately; identity operations are serialized and stale responses ignored. Network failure is `unavailable`, not a Free-account determination.

## Lifetime beta access

After a tester has signed in to the integrated build, find their Firebase UID under RevenueCat Customers. Grant `estella_plus` with Lifetime duration, then refresh the connection in the app. A lifetime promotional grant is a real grant that also works in production within the same RevenueCat project/customer identity. Use a separate QA customer for Free, purchase and expiry testing. This connection does not automatically exclude customers from experiments or create a Beta badge; those belong to the next paywall/experiment implementation.

## Store beta and release builds

The native `__DEV__` guard disables RevenueCat initialization in release builds, including TestFlight and Google Play beta tracks. Their platform-specific public keys have not been supplied. Do not replace the release guard with the `test_` key: Test Store keys are unsuitable for store release builds. The production website is also disabled until its Web Billing setup/key is ready. No deployment or mobile build submission is part of this change.

## Verification

`node tests/billing-session.cjs` tests lifetime access, free access, account switching, logout races, offline recovery and disabled release configuration. Run `npm run lint` and `npm run typecheck` in mobile. Native device verification still requires a rebuilt development client and a signed-in test account.

Live SDK smoke check: the dedicated `estella-sdk-connection-check` customer retrieved current Offering `estella_plus_a`, packages `$rc_annual` and `$rc_monthly`, and no active entitlements. No purchase was made and no promotional access was granted. This QA customer is separate from beta testers.

Sources: https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store ; https://www.revenuecat.com/docs/getting-started/installation/expo ; https://www.revenuecat.com/docs/web/web-billing/web-sdk
