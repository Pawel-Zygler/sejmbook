// Votes of MPs on laws that raised or cut taxes in the X term (data/tax-votes.json, Sejm API).
// Every law is the Sejm's final vote (III reading, "całość projektu"); votes per MP are coded
// Y = za, N = przeciw, A = wstrzymał się, '-' = nieobecny. An MP missing from a vote had no mandate then.

export const DIRECTIONS = ['raise', 'cut', 'mixed'];
export const VOTE_CODES = ['Y', 'N', 'A', '-'];
export const VOTE_LABEL = { Y: 'za', N: 'przeciw', A: 'wstrzymał(a) się', '-': 'nieobecny/a' };
export const DIRECTION_LABEL = { raise: 'Podwyżki podatków', cut: 'Obniżki podatków', mixed: 'Zmiany mieszane' };

const emptyTally = () => ({ laws: 0, Y: 0, N: 0, A: 0, '-': 0, items: [] });

/**
 * Per-direction tally of one MP's votes: { raise, cut, mixed }, each { laws, Y, N, A, '-', items }.
 * Items are newest first. Laws voted before the MP took the mandate (no vote recorded) are left out.
 */
export function mpTaxTally(taxData, mpId) {
  const out = { raise: emptyTally(), cut: emptyTally(), mixed: emptyTally() };
  for (const law of taxData?.laws ?? []) {
    if (!DIRECTIONS.includes(law.direction)) throw new RangeError(`Unknown direction: ${law.direction}`);
    const vote = law.votes?.[mpId];
    if (vote == null) continue;
    if (!VOTE_CODES.includes(vote)) throw new RangeError(`Unknown vote code: ${vote}`);
    const t = out[law.direction];
    t.laws++;
    t[vote]++;
    t.items.push({ law, vote });
  }
  for (const t of Object.values(out)) t.items.sort((a, b) => b.law.date.localeCompare(a.law.date));
  return out;
}

const plural = (n, one, few, many) => {
  if (n === 1) return one;
  const d = n % 10, h = n % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};
export const lawsWord = (n) => `${n} ${plural(n, 'ustawa', 'ustawy', 'ustaw')}`;

/** "13 ustaw: 7 za, 3 przeciw, 1 wstrzymał(a) się, 2 nieobecny/a" (zero counts are skipped). */
export function tallySentence(t) {
  if (!t || t.laws === 0) return 'brak głosowań w czasie mandatu';
  const parts = VOTE_CODES.filter((c) => t[c] > 0).map((c) => `${t[c]} ${VOTE_LABEL[c]}`);
  return `${lawsWord(t.laws)}: ${parts.join(', ')}`;
}

export const processUrl = (law) => `https://www.sejm.gov.pl/Sejm10.nsf/PrzebiegProc.xsp?nr=${encodeURIComponent(law.process)}`;
export const votingUrl = (law) => `https://www.sejm.gov.pl/Sejm10.nsf/agent.xsp?symbol=glosowania&NrKadencji=10&NrPosiedzenia=${law.sitting}&NrGlosowania=${law.votingNumber}`;

/** Status of the law after the Sejm vote, as far as the API shows it. */
export function lawStatus(law) {
  if (law.veto) return 'weto Prezydenta';
  if (!law.dzu) return 'jeszcze nie w Dzienniku Ustaw';
  return law.dzu;
}
