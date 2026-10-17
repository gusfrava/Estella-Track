import { Purchases } from '@revenuecat/purchases-js';
import { billingKey, isLocalBillingHost } from '@/core/billing-config';
import { createBillingSession } from '@/core/services/billing-session';

const key = billingKey(__DEV__ && isLocalBillingHost(globalThis.location?.hostname));
let client;
export const billing = createBillingSession({
  async identify(uid) {
    if (!client) client = Purchases.configure({ apiKey: key, appUserId: uid });
    else if (client.getAppUserId() !== uid) await client.changeUser(uid);
  },
  customerInfo: () => client.getCustomerInfo(),
  offerings: () => client.getOfferings(),
  async disconnect() { client?.close(); client = null; },
}, !!key);
