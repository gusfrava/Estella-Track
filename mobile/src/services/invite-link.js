// Friend invites are links with ?add=<username> (the website's invite format). The app accepts them from any
// address (the website, its own domain, estellatrack://) and reads only that parameter. The username is cleaned
// as the website's findByUsername does; '' when the link isn't an invite.
export function inviteFrom(link) {
  const query = String(link || '').split('#')[0].split('?')[1] || '';
  for (const pair of query.split('&')) {
    const [key, value = ''] = pair.split('=');
    if (key !== 'add') continue;
    try { return decodeURIComponent(value.replace(/\+/g, ' ')).toLowerCase().replace(/[^a-z0-9_.]/g, ''); }
    catch { return ''; }
  }
  return '';
}
