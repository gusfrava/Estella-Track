export const AVATARS = [
  { id: 'release-estella', name: 'Estella', price: 0 },
  { id: 'release-diego', name: 'Diego', price: 0 },
  { id: 'release-dog', name: 'Buddy', price: 0 },
  { id: 'halloween-estella', name: 'Estella', price: 100 },
  { id: 'halloween-diego', name: 'Diego', price: 100 },
  { id: 'halloween-dog', name: 'Buddy', price: 100 },
];
export const avatarById = id => AVATARS.find(a => a.id === id);
const IMAGES = {
  "halloween-diego": require('../../../assets/avatars/halloween-diego.webp'),
  "halloween-dog": require('../../../assets/avatars/halloween-dog.webp'),
  "halloween-estella": require('../../../assets/avatars/halloween-estella.webp'),
  "release-diego": require('../../../assets/avatars/release-diego.webp'),
  "release-dog": require('../../../assets/avatars/release-dog.webp'),
  "release-estella": require('../../../assets/avatars/release-estella.webp'),
};
export const avatarPath = id => IMAGES[id];
