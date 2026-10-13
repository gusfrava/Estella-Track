// YouTube links: read a video id out of whatever link people paste, and build the links/embeds we use.
// Nothing here talks to YouTube; the player only loads when someone taps "Ver técnica".

const ID = /^[A-Za-z0-9_-]{11}$/;

// "https://youtu.be/abc…", "youtube.com/watch?v=abc…", "/shorts/abc…", "/embed/abc…", "m.youtube.com/…" or a bare id
// → the 11-character id, or '' if it isn't a YouTube video link.
export function youTubeId(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  if (ID.test(s)) return s;
  let url;
  try { url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch (e) { return ''; }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id = '';
  if (host === 'youtu.be') id = url.pathname.split('/')[1] || '';
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v') || '';
    const m = url.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/);
    if (!id && m) id = m[2];
  }
  return ID.test(id) ? id : '';
}

// Privacy-enhanced embed (no YouTube cookies until the video plays).
export const embedUrl = id => `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&autoplay=1`;
export const watchUrl = id => `https://www.youtube.com/watch?v=${id}`;
export const searchUrl = query => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
