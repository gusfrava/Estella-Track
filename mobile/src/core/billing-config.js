// Public SDK keys, never RevenueCat secret API keys.
export const BILLING = Object.freeze({
  testKey: 'test_FEDtGvZVuSKAtgNiGKsxLMmfOzk',
  entitlement: 'estella_plus',
  offering: 'estella_plus_a',
  paywallsEnabled: false,
});

// Test Store must never initialize in TestFlight, Play testing tracks or releases.
// Production/store keys will be added when those providers are configured.
export const billingKey = development => development ? BILLING.testKey : null;
export const isLocalBillingHost = hostname => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
