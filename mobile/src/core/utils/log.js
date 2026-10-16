// Tagged console logging per layer: [store], [sync], [firebase], [auth], [ui].
// Debug lines only print in debug mode: add ?debug to the URL,
// or run  localStorage.setItem('estellatrack.debug','1')  in the console and reload.
// Warnings and errors always print.

export const DEBUG = (() => {
  try {
    return new URLSearchParams(location.search).has('debug')
      || localStorage.getItem('estellatrack.debug') === '1';
  } catch (e) { return false; }
})();

export function logger(scope) {
  const tag = `[${scope}]`;
  return {
    debug: (...args) => { if (DEBUG) console.log(tag, ...args); },
    warn: (...args) => console.warn(tag, ...args),
    error: (...args) => console.error(tag, ...args),
  };
}
