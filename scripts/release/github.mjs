// GitHub lezen, wachten op runs en het hervatverslag bijhouden. Alles gaat via `ctx`, zodat de tests
// GitHub kunnen nabootsen. Schrijven (rerun, dispatch, reactie) gaat altijd via `ctx.act`.
import { ReleaseStop } from './uitkomst.mjs';

const MINUUT = 60_000;
const UUR = 60 * MINUUT;
const TIJDZONE = 'Europe/Amsterdam';
const klok = new Intl.DateTimeFormat('en-US', { timeZone: TIJDZONE, hourCycle: 'h23', weekday: 'short', hour: 'numeric', minute: 'numeric' });
const DAGEN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Weekendstop: zaterdag 23:00 tot maandag 01:00 Nederlandse tijd, en zondag. */
export function inWeekendstop(ms) {
  const deel = Object.fromEntries(klok.formatToParts(ms).map(({ type, value }) => [type, value]));
  const dag = DAGEN.indexOf(deel.weekday);
  const minuut = Number(deel.hour) * 60 + Number(deel.minute);
  return (dag === 6 && minuut >= 23 * 60) || dag === 0 || (dag === 1 && minuut < 60);
}

export function stopBijWeekend(ctx) {
  if (inWeekendstop(ctx.now())) throw new ReleaseStop('weekendstop', 'het is tussen zaterdag 23:00 en maandag 01:00; de release gaat maandag verder');
}

/**
 * Wacht tot `probe()` een waarde geeft (niet `undefined`). Kijkt elke ronde naar de weekendstop.
 * `maxMs` = Infinity wacht zonder eindtijd (de reparatie en de nachtvertaling).
 */
export function wacht(ctx, label, probe, { intervalMs = 2 * MINUUT, maxMs = 3 * UUR } = {}) {
  const start = ctx.now();
  let gemeld = false;
  for (;;) {
    stopBijWeekend(ctx);
    const waarde = probe();
    if (waarde !== undefined) return waarde;
    if (ctx.now() - start > maxMs) {
      throw new ReleaseStop('wacht-te-lang', `${label}: na ${Math.round(maxMs / UUR)} uur nog niet klaar`);
    }
    if (!gemeld) { ctx.log(`wacht: ${label}`); gemeld = true; }
    ctx.sleep(intervalMs);
  }
}

/** Als `wacht`, maar na `maxMs` geeft hij null in plaats van een stop. */
export function wachtOfNull(ctx, label, probe, { intervalMs = 2 * MINUUT, maxMs }) {
  try {
    return wacht(ctx, label, probe, { intervalMs, maxMs });
  } catch (err) {
    if (err instanceof ReleaseStop && err.code === 'wacht-te-lang') return null;
    throw err;
  }
}

export const api = (ctx, pad) => ctx.ghJson(['api', pad]);

/** Alle items van een lijst-API met `per_page=100`, pagina voor pagina. */
export function apiAlle(ctx, pad, sleutel) {
  const alles = [];
  for (let pagina = 1; pagina < 50; pagina++) {
    const antwoord = api(ctx, `${pad}${pad.includes('?') ? '&' : '?'}per_page=100&page=${pagina}`);
    const lijst = sleutel ? antwoord?.[sleutel] : antwoord;
    if (!Array.isArray(lijst)) throw new Error(`onverwacht antwoord voor ${pad}`);
    alles.push(...lijst);
    if (lijst.length < 100) return alles;
  }
  throw new Error(`${pad}: meer dan 50 pagina's`);
}

/** De runs van een workflow, nieuwste eerst. `query` zijn de GitHub-filters. */
export function runs(ctx, workflow, query, repo = ctx.repo) {
  const qs = new URLSearchParams({ per_page: '100', ...query }).toString();
  const antwoord = api(ctx, `repos/${repo}/actions/workflows/${workflow}/runs?${qs}`);
  if (!Array.isArray(antwoord?.workflow_runs)) throw new Error(`onverwacht antwoord voor runs van ${workflow}`);
  return [...antwoord.workflow_runs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

const runUrl = (repo, run) => `https://github.com/${repo}/actions/runs/${run.id}`;

/**
 * Volg één run tot zijn eindstatus. `zoek()` geeft de nieuwste passende run of null. Rood: eenmaal
 * `gh run rerun --failed` (alleen in poging 1; een latere poging betekent dat de rerun al gebruikt is),
 * daarna een stop met `stopcode`. Geeft de groene run terug, of null als `zoek()` niets vindt.
 */
export function volgRun(ctx, { label, zoek, stopcode, repo = ctx.repo, maxMs = 3 * UUR, groen = run => run.conclusion === 'success' }) {
  let run = zoek();
  if (!run) return null;
  for (;;) {
    const id = run.id;
    run = wacht(ctx, `${label} (run ${id})`, () => {
      const nu = api(ctx, `repos/${repo}/actions/runs/${id}`);
      return nu.status === 'completed' ? nu : undefined;
    }, { maxMs });
    if (groen(run)) return run;
    // Een geslaagde run met een overgeslagen stap heeft niets om opnieuw te draaien.
    if ((run.run_attempt ?? 1) > 1 || run.conclusion === 'success') {
      throw new ReleaseStop(stopcode, `${label} is niet groen${(run.run_attempt ?? 1) > 1 ? ' na de rerun' : ''}: ${runUrl(repo, run)} (${run.conclusion})`);
    }
    ctx.act(`rerun --failed van ${label} ${runUrl(repo, run)}`, () =>
      ctx.gh(['run', 'rerun', String(run.id), '--failed', '--repo', repo]));
    // Wacht tot GitHub poging 2 heeft aangemaakt.
    run = wacht(ctx, `${label}: poging 2 van run ${id}`, () => {
      const nu = api(ctx, `repos/${repo}/actions/runs/${id}`);
      return (nu.run_attempt ?? 1) > 1 ? nu : undefined;
    }, { intervalMs: 30_000, maxMs: UUR });
  }
}

/**
 * Wacht tot alle checks op `sha` klaar zijn, met minstens één `ci.yml`-run van `event`. Rood: rerun van de
 * rode runs in poging 1, daarna een stop. Geeft de lijst check-runs terug.
 */
export function wachtOpChecks(ctx, { sha, event, label, stopcode }) {
  const ciRun = () => runs(ctx, 'ci.yml', { head_sha: sha, event }).find(run => run.head_sha === sha && run.event === event);
  const eerste = wacht(ctx, `${label}: CI start`, () => ciRun() ?? undefined, { maxMs: UUR });
  volgRun(ctx, { label, stopcode, zoek: () => ciRun() ?? eerste });
  // Ook de andere workflows op deze commit (headless-api, mcpb, ...) moeten groen zijn.
  const checks = wacht(ctx, `${label}: overige checks`, () => {
    const lijst = apiAlle(ctx, `repos/${ctx.repo}/commits/${sha}/check-runs`, 'check_runs');
    return lijst.every(c => c.status === 'completed') ? lijst : undefined;
  });
  const rood = checks.filter(c => !['success', 'skipped', 'neutral'].includes(c.conclusion));
  if (rood.length) {
    throw new ReleaseStop(stopcode, `${label}: rode checks op ${sha.slice(0, 12)}: ${rood.map(c => `${c.name} = ${c.conclusion}`).join(', ')}`);
  }
  return checks;
}

// ---------------------------------------------------------------------------------------------------
// Hervatverslag: één reactie met `<!-- ops-release:TAG -->` op de PR `Release vVERSION`.

// Het script schrijft alleen tussen deze twee markers. Alles eromheen (een ouder verslag van een agent, notities
// van de thread over fix-PR's en reviews) blijft staan. Eigen regels worden aangevuld, nooit weggehaald.
export const BEGIN = '<!-- ops-release-script:begin -->';
export const EIND = '<!-- ops-release-script:end -->';

export function verslagTekst({ tag, kop, regels, bestaand = null }) {
  const marker = `<!-- ops-release:${tag} -->`;
  let voor = `${marker}\n`;
  let na = '';
  let oud = [];
  if (bestaand) {
    const b = bestaand.indexOf(BEGIN);
    const e = bestaand.indexOf(EIND);
    if (b >= 0 && e > b) {
      voor = bestaand.slice(0, b);
      na = bestaand.slice(e + EIND.length);
      oud = bestaand.slice(b, e).split('\n').filter(r => r.startsWith('- ')).map(r => r.slice(2));
    } else {
      na = `\n\n${bestaand.replace(marker, '').trim()}`;
    }
  }
  const nieuw = regels.map(r => String(r).replace(/\s+/g, ' ').trim()).filter(r => r && !oud.includes(r));
  const blok = [BEGIN, `**${tag}: ${kop}**`, '', ...[...oud, ...nieuw].map(r => `- ${r}`), '',
    '*Bijgehouden door het releasescript (`scripts/release/run.mjs`), gestart door een AI-assistent.*', EIND].join('\n');
  return voor + blok + na;
}

/** Zoekt de reactie met de marker van `tag` op PR `nummer`. */
export function vindVerslag(ctx, nummer, tag) {
  const reacties = apiAlle(ctx, `repos/${ctx.repo}/issues/${nummer}/comments`);
  return reacties.find(r => typeof r.body === 'string' && r.body.includes(`<!-- ops-release:${tag} -->`)) ?? null;
}

/** Schrijft het verslag bij of maakt het aan. */
export function schrijfVerslag(ctx, { nummer, tag, kop, regels }) {
  const bestaand = vindVerslag(ctx, nummer, tag);
  const body = verslagTekst({ tag, kop, regels, bestaand: bestaand?.body ?? null });
  if (bestaand?.body === body) return;
  ctx.act(`hervatverslag ${tag} op PR #${nummer} bijwerken`, () => {
    const pad = bestaand ? `repos/${ctx.repo}/issues/comments/${bestaand.id}` : `repos/${ctx.repo}/issues/${nummer}/comments`;
    ctx.gh(['api', '-X', bestaand ? 'PATCH' : 'POST', pad, '--input', '-'], { input: JSON.stringify({ body }) });
  });
}
