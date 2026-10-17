import { billingKey, isLocalBillingHost } from '../billing-config.js';
import { createBillingSession } from './billing-session.js';

const key = billingKey(isLocalBillingHost(globalThis.location?.hostname));
let client, sdk;
export const billing = createBillingSession({
  async identify(userId) {
    sdk ||= await import('https://cdn.jsdelivr.net/npm/@revenuecat/purchases-js@1.71.0/dist/Purchases.es.js');
    if (!client) client = sdk.Purchases.configure({ apiKey: key, appUserId: userId });
    else if (client.getAppUserId() !== userId) await client.changeUser(userId);
  },
  customerInfo: () => client.getCustomerInfo(),
  offerings: () => client.getOfferings(),
  async disconnect() { client?.close(); client = null; },
}, !!key);
