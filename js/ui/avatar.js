import { avatarById, avatarPath } from '../data/avatars.js';
import { getWallet } from '../state/rewards.js';
import { esc } from '../utils/format.js';

export function accountAvatarHTML(initial) {
  const wallet = getWallet();
  const avatar = avatarById(wallet?.avatarId);
  return avatar && (!avatar.price || wallet?.avatars?.[avatar.id])
    ? `<img class="account-avatar-image" src="${avatarPath(avatar.id)}" alt="">`
    : esc(initial);
}
