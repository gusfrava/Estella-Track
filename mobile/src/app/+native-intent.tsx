import { inviteFrom } from '@/services/invite-link';

// Incoming links on Android and iOS (App Links, Universal Links, estellatrack://): an invite opens Amigos with that
// person's card, whatever address it came from. Everything else is routed as usual.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const add = inviteFrom(path);
    return add ? `/friends?add=${encodeURIComponent(add)}` : path;
  } catch {
    return path;
  }
}
