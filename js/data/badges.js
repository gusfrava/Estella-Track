// The badges, as the app shows them. The server decides who earns them (functions/rewards.js → BADGES):
// KEEP IN SYNC — `cd functions && npm test` checks both lists match.
//   id, family (icon + color), counter (what it counts), at (the value that earns it)
export const BADGES = [
  { id: 'w1', family: 'workouts', counter: 'workouts', at: 1 },
  { id: 'w10', family: 'workouts', counter: 'workouts', at: 10 },
  { id: 'w25', family: 'workouts', counter: 'workouts', at: 25 },
  { id: 'w50', family: 'workouts', counter: 'workouts', at: 50 },
  { id: 'w100', family: 'workouts', counter: 'workouts', at: 100 },
  { id: 'w250', family: 'workouts', counter: 'workouts', at: 250 },
  { id: 's2', family: 'streak', counter: 'bestStreak', at: 2 },
  { id: 's4', family: 'streak', counter: 'bestStreak', at: 4 },
  { id: 's8', family: 'streak', counter: 'bestStreak', at: 8 },
  { id: 's12', family: 'streak', counter: 'bestStreak', at: 12 },
  { id: 's26', family: 'streak', counter: 'bestStreak', at: 26 },
  { id: 's52', family: 'streak', counter: 'bestStreak', at: 52 },
  { id: 'r1', family: 'records', counter: 'records', at: 1 },
  { id: 'r10', family: 'records', counter: 'records', at: 10 },
  { id: 'r25', family: 'records', counter: 'records', at: 25 },
  { id: 'f1', family: 'social', counter: 'friends', at: 1 },
  { id: 'f5', family: 'social', counter: 'friends', at: 5 },
  { id: 'c1', family: 'social', counter: 'cheersSent', at: 1 },
  { id: 'c10', family: 'social', counter: 'cheersSent', at: 10 },
  { id: 'c50', family: 'social', counter: 'cheersSent', at: 50 },
  { id: 'cr10', family: 'social', counter: 'cheersReceived', at: 10 },
  { id: 'cp1', family: 'social', counter: 'copies', at: 1 },
];
