const assert = require('node:assert/strict');
(async () => {
  const { inviteFrom } = await import('../mobile/src/services/invite-link.js');
  // Invites from any address: the app's scheme, the website today, a future domain, an in-app path.
  assert.equal(inviteFrom('estellatrack://?add=Maya.Lifts'), 'maya.lifts');
  assert.equal(inviteFrom('https://gusfrava.github.io/Estella-Track/?add=leo_trains'), 'leo_trains');
  assert.equal(inviteFrom('https://estellatrack.app/?add=sofi%2Emoves#top'), 'sofi.moves');
  assert.equal(inviteFrom('/friends?tab=1&add=sam'), 'sam');
  assert.equal(inviteFrom('https://estellatrack.app/invite?add=maya.lifts'), 'maya.lifts');   // the link Invite friends shares
  // Not an invite.
  for (const link of ['/', '/?foo=1', '/routine/abc', 'estellatrack://', '', null, undefined, '?adder=x', '#?add=x']) assert.equal(inviteFrom(link), '', String(link));
  // Cleaned like the website's findByUsername; broken encodings are ignored.
  assert.equal(inviteFrom('?add=%3Cscript%3E'), 'script');
  assert.equal(inviteFrom('?add=%E0%A4%A'), '');
  console.log('PASS: invite links from the app scheme, the website and other domains; non-invites and bad encodings ignored.');
})().catch(e => { console.error(e); process.exit(1); });
