import { avatarById, avatarPath } from '../data/avatars.js';
import { getWallet } from '../state/rewards.js';
import { esc } from '../utils/format.js';

// Equipping an icon doesn't change workout/progress content. Avoid restarting those views.
export function isAvatarOnlyWalletChange(next, previous) {
  if (!next || !previous) return false;
  const rewardData = ({ avatarId, avatars, updatedAt, ...rest }) => rest;
  return JSON.stringify(rewardData(next)) === JSON.stringify(rewardData(previous));
}

export function accountAvatarHTML(initial) {
  const wallet = getWallet();
  const avatar = avatarById(wallet?.avatarId);
  return avatar && (!avatar.price || wallet?.avatars?.[avatar.id])
    ? `<img class="account-avatar-image" src="${avatarPath(avatar.id)}" alt="">`
    : esc(initial);
}
