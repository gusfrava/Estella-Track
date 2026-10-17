import { billingKey } from '@/core/billing-config';
import { createBillingSession } from '@/core/services/billing-session';

const key = billingKey(__DEV__);
let purchases, user;
export const billing = createBillingSession({
  async identify(uid) {
    purchases ||= (await import('react-native-purchases')).default;
    if (!await purchases.isConfigured()) purchases.configure({ apiKey: key, appUserID: uid });
    else if (user !== uid) await purchases.logIn(uid);
    user = uid;
  },
  customerInfo: () => purchases.getCustomerInfo(),
  offerings: () => purchases.getOfferings(),
  async disconnect() {
    if (purchases && await purchases.isConfigured() && !await purchases.isAnonymous()) await purchases.logOut();
    user = null;
  },
}, !!key);
