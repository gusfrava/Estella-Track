// Who shows toasts: native-ui's ToastHost registers here (the app root and every open sheet, since sheets are separate
// windows on Android) and the top-most host shows the message. No imports, so any module can call toast().
const hosts = [];
export const toast = message => hosts.at(-1)?.(message);   // { icon?, title, body? }
export function addToastHost(show) { hosts.push(show); return () => { const i = hosts.indexOf(show); if (i >= 0) hosts.splice(i, 1); }; }
