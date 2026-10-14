// The weekly streak on the server, with the same rules as the app (js/state/selectors.js → weekHistory / streakFrom):
// a week counts when its goal is met (with no goal: trained at all); you start with 1 comodín and earn one for every
// 4 goal weeks in a row (hold 2 at most); a finished week that falls short uses one automatically while a streak is alive.
// Works on a friend card's data: weeks = { weekKey: '024' }, goals = { weekKey: days }.
const card = require('./card');

const JOKER_START = 1, JOKER_EVERY = 4, JOKER_MAX = 2;

function goalAt(goals, wk) {
  const from = Object.keys(goals || {}).filter(k => k <= wk).sort().pop();
  return from ? Number(goals[from]) || null : null;
}

// Streak length (weeks in a row that count) at the end of week `upTo`, treating `upTo` as finished.
function streakAt(weeks, goals, upTo) {
  const keys = [...Object.keys(weeks || {}), ...Object.keys(goals || {})].filter(k => k <= upTo).sort();
  if (!keys.length) return 0;
  let jokers = null, run = 0, alive = false, streak = 0;
  for (let k = keys[0]; k <= upTo; k = card.addDays(k, 7)) {
    const n = String((weeks || {})[k] || '').length, goal = goalAt(goals, k);
    if (goal && jokers === null) jokers = JOKER_START;
    let counts;
    if (n > 0 && n >= (goal || 1)) {
      counts = true;
      if (goal && ++run % JOKER_EVERY === 0) jokers = Math.min(JOKER_MAX, jokers + 1);
    } else if (goal && alive && jokers > 0) { counts = true; jokers -= 1; }
    else { counts = false; run = 0; }
    alive = counts;
    streak = counts ? streak + 1 : 0;
  }
  return streak;
}

module.exports = { goalAt, streakAt };
