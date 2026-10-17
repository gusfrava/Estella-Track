export const AVATARS = [
  { id: 'release-estella', name: 'Estella', price: 0 },
  { id: 'release-diego', name: 'Diego', price: 0 },
  { id: 'release-dog', name: 'Buddy', price: 0 },
  { id: 'halloween-estella', name: 'Estella', price: 100 },
  { id: 'halloween-diego', name: 'Diego', price: 100 },
  { id: 'halloween-dog', name: 'Buddy', price: 100 },
];
export const avatarById = id => AVATARS.find(a => a.id === id);
export const avatarPath = id => new URL(`../../icons/avatars/${id}.webp`, import.meta.url).href;
