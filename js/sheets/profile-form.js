// "Edit profile" sheet: change your name and username. Logic lives in controllers/profile.js.
import { openSheet, closeSheet } from '../ui/sheet.js';
import { t } from '../i18n/index.js';
import { startProfileForm, submitProfileForm, resetProfileForm } from '../controllers/profile.js';
import { profileFormHTML } from '../views/username.js';

export function openProfileSheet() {
  const L = t();
  const form = startProfileForm(true);
  openSheet(`<h2>${L.editProfile}</h2>${profileFormHTML(form, L.save)}`, s => {
    s.querySelector('#f-username').onsubmit = async e => {
      e.preventDefault();
      if (await submitProfileForm()) { closeSheet(); resetProfileForm(); }
    };
  });
}
