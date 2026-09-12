// Demo-resourcebibliotheek (issue #19, user-verzoek): de drie showcase-voorbeelden delen voortaan
// één gedeelde pool ("dezelfde ploeg in twee projecten"). Headless store-batterij (patroon
// check-library-slice.ts): draait de ECHTE Zustand-store op Node. Exitcode = poort.
import { useAppStore } from '@/state/appStore';
import { DEMO_COMPANY_ID, DEMO_LIBRARY_SEED_VERSION, buildDemoLibrarySeed } from '@/services/library/demoLibrary';
import { applyDemoLibraryToShowcaseProject } from '@/state/demoLibraryShowcase';

let checks = 0; let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`   XX ${msg}`); }
}

// --- Sanity: de bouwmodule zelf levert de afgesproken inhoud (los van de store) ---
{
  const { company, pool } = buildDemoLibrarySeed();
  assert(company.id === DEMO_COMPANY_ID, 'buildDemoLibrarySeed: vast companyId');
  assert(company.name === 'Demo resource library', 'buildDemoLibrarySeed: vaste naam-literal');
  assert(pool.calendars.length === 2, 'buildDemoLibrarySeed: 2 kalenders');
  assert(pool.calendars.some(c => c.name === 'Construction calendar NL'), 'buildDemoLibrarySeed: Construction calendar NL aanwezig');
  assert(pool.calendars.some(c => c.name === 'Masonry crew, 4-day week'), 'buildDemoLibrarySeed: Masonry crew, 4-day week aanwezig');
  assert(pool.resources.length === 14, 'buildDemoLibrarySeed: 14 resources');
  const overlapNames = ['Carpenters', 'MEP fitters', 'Plasterers', 'Painters'];
  for (const n of overlapNames) {
    assert(pool.resources.some(r => r.name === n), `buildDemoLibrarySeed: overlap-resource "${n}" aanwezig`);
  }
  for (const r of pool.resources) {
    assert(typeof r.maxUnits === 'number' && r.maxUnits > 0, `buildDemoLibrarySeed: "${r.name}" heeft een maxUnits`);
    assert(r.description.length > 0, `buildDemoLibrarySeed: "${r.name}" heeft een NL-omschrijving`);
  }
  const metselploeg = pool.resources.find(r => r.name === 'Masonry crew');
  const vierdaagse = pool.calendars.find(c => c.name === 'Masonry crew, 4-day week');
  assert(metselploeg?.type === 'CREW', 'buildDemoLibrarySeed: Masonry crew is een CREW-resource');
  assert(metselploeg?.calendarId === vierdaagse?.id, 'buildDemoLibrarySeed: Masonry crew.calendarId wijst naar de 4-daagse-week-kalender-id');
}

// --- (a) seedDemoLibrary() is idempotent: 2x aanroepen ⇒ één bibliotheek, ongewijzigde inhoud ---
{
  const before = useAppStore.getState().companies.length;
  const id1 = useAppStore.getState().seedDemoLibrary();
  assert(id1 === DEMO_COMPANY_ID, 'seedDemoLibrary: retourneert het vaste demo-companyId');

  const afterFirst = useAppStore.getState();
  assert(afterFirst.companies.length === before + 1, 'seedDemoLibrary: voegt precies één bedrijf toe');
  assert(afterFirst.companies.filter(c => c.id === DEMO_COMPANY_ID).length === 1, 'seedDemoLibrary: geen dubbel bedrijf in companies[]');
  const pool1 = afterFirst.pools[DEMO_COMPANY_ID];
  assert(!!pool1, 'seedDemoLibrary: pool aangemaakt');
  assert(pool1.calendars.length === 2, 'seedDemoLibrary: pool heeft 2 kalenders');
  assert(pool1.resources.length === 14, 'seedDemoLibrary: pool heeft 14 resources');
  const versionAfterFirst = pool1.poolVersion;

  const id2 = useAppStore.getState().seedDemoLibrary();
  const afterSecond = useAppStore.getState();
  assert(id2 === DEMO_COMPANY_ID, 'seedDemoLibrary (2e aanroep): zelfde companyId');
  assert(afterSecond.companies.filter(c => c.id === DEMO_COMPANY_ID).length === 1, 'seedDemoLibrary (2e aanroep): nog steeds precies één bedrijf');
  assert(afterSecond.pools[DEMO_COMPANY_ID].poolVersion === versionAfterFirst, 'seedDemoLibrary (2e aanroep): poolVersion ongewijzigd (geen re-seed)');
  assert(afterSecond.pools[DEMO_COMPANY_ID].resources.length === 14, 'seedDemoLibrary (2e aanroep): resource-aantal ongewijzigd (geen dubbele items)');
  assert(afterSecond.pools[DEMO_COMPANY_ID].calendars.length === 2, 'seedDemoLibrary (2e aanroep): kalender-aantal ongewijzigd (geen dubbele items)');
  // Referentie-gelijkheid: bij een echte no-op mag `set()` het pool-object niet vervangen.
  assert(afterSecond.pools[DEMO_COMPANY_ID] === pool1, 'seedDemoLibrary (2e aanroep): zelfde pool-objectreferentie (geen nieuwe set())');
}

// --- (c) een bestaande bibliotheek met hetzelfde id wordt NIET overschreven (ook niet de inhoud) ---
{
  const s = useAppStore.getState();
  const pool = s.pools[DEMO_COMPANY_ID];
  const someResId = pool.resources[0].id;
  s.updatePoolResource(DEMO_COMPANY_ID, someResId, { description: 'DOOR GEBRUIKER BEWERKT — mag niet terugveren' });
  const editedDescription = useAppStore.getState().pools[DEMO_COMPANY_ID].resources.find(r => r.id === someResId)?.description;
  assert(editedDescription === 'DOOR GEBRUIKER BEWERKT — mag niet terugveren', 'setup (c): pool-item is bewerkt vóór de re-seed');

  useAppStore.getState().seedDemoLibrary();
  const afterReseed = useAppStore.getState().pools[DEMO_COMPANY_ID].resources.find(r => r.id === someResId)?.description;
  assert(afterReseed === 'DOOR GEBRUIKER BEWERKT — mag niet terugveren', 'seedDemoLibrary: bestaande (door de gebruiker bewerkte) pool wordt NIET overschreven');
}

// --- (b) wiring: seed+bind+link (applyDemoLibraryToShowcaseProject) stempelt PRECIES de
// ondubbelzinnige naam-matches — niet de rest — met het demo-companyId ---
{
  useAppStore.getState().newProject();
  const timmerId = useAppStore.getState().addResource({ name: 'Carpenters', type: 'LABOR', description: '', maxUnits: 4 });
  const schilderId = useAppStore.getState().addResource({ name: 'Painters', type: 'LABOR', description: '', maxUnits: 4 });
  const onbekendeId = useAppStore.getState().addResource({ name: 'Onbekende Specialist', type: 'LABOR', description: '', maxUnits: 1 });

  applyDemoLibraryToShowcaseProject();

  const after = useAppStore.getState();
  assert(after.project.companyId === DEMO_COMPANY_ID, 'wiring: project gekoppeld aan de demo-bibliotheek (bindProjectToCompany)');

  const timmer = after.resources.find(r => r.id === timmerId);
  const schilder = after.resources.find(r => r.id === schilderId);
  const onbekende = after.resources.find(r => r.id === onbekendeId);
  assert(timmer?.libraryOrigin?.companyId === DEMO_COMPANY_ID, 'wiring: "Carpenters" krijgt libraryOrigin met het demo-companyId');
  assert(schilder?.libraryOrigin?.companyId === DEMO_COMPANY_ID, 'wiring: "Painters" krijgt libraryOrigin met het demo-companyId');
  assert(onbekende?.libraryOrigin === undefined, 'wiring: een niet-matchende resource blijft ongestempeld (alleen ondubbelzinnige matches)');

  // Geen afwijkingenscherm/-signaal opgedrongen (dit is een demo, geen vraag).
  assert(after.ui.showLibraryLinkDialog === false, 'wiring: geen afwijkingenscherm getoond (auto-link zonder gebruikersvraag)');
}

// --- F2 (critreview, issue #19): een showcase-kalender met een naam die de demo-pool ook draagt
// ("Construction calendar NL") mag NIET automatisch gekoppeld/overschreven worden — alleen resources koppelen.
// Reproduceert de "6 Rijwoningen De Akkers"-bevinding: een bewust gemodelleerde kalender met een
// eigen hoursPerDay en een "Frost delay, foundations"-vakantie, die de demo-versie (hoursPerDay 8, geen
// vakanties) anders stil zou overschrijven en zo de CPM-invoer zou veranderen.
{
  useAppStore.getState().newProject();
  useAppStore.getState().addResource({ name: 'Painters', type: 'LABOR', description: '', maxUnits: 4 });
  const bouwkalenderId = useAppStore.getState().addCalendar({
    name: 'Construction calendar NL',
    description: 'Showcase-specifieke bouwkalender met vorstverlet.',
    workDays: [1, 2, 3, 4, 5],
    workStartHour: 7,
    workEndHour: 16,
    hoursPerDay: 9, // wijkt bewust af van de demo-versie (8) — zou anders 9→8 stilzwijgend veranderen.
    holidays: [{ name: 'Frost delay, foundations', startDate: '2027-01-10', endDate: '2027-01-24' }],
  });
  const before = useAppStore.getState().calendars.find(c => c.id === bouwkalenderId);
  assert(before?.hoursPerDay === 9, 'setup F2: showcase-kalender heeft eigen hoursPerDay (9) vóór de koppeling');
  assert(before?.holidays.length === 1, 'setup F2: showcase-kalender heeft zijn "Frost delay, foundations"-vakantie vóór de koppeling');

  applyDemoLibraryToShowcaseProject();

  const after = useAppStore.getState();
  const bouwkalenderAfter = after.calendars.find(c => c.id === bouwkalenderId);
  assert(bouwkalenderAfter?.libraryOrigin === undefined, 'F2: kalender met naam-match blijft ONGESTEMPELD (alleen resources worden gekoppeld)');
  assert(bouwkalenderAfter?.hoursPerDay === 9, 'F2: kalender-hoursPerDay blijft ongewijzigd (9, niet overschreven naar de demo-waarde 8)');
  assert(
    bouwkalenderAfter?.holidays.length === 1 && bouwkalenderAfter.holidays[0].name === 'Frost delay, foundations',
    'F2: kalender behoudt zijn "Frost delay, foundations"-vakantie (niet gewist door de demo-versie)',
  );

  // Negatieve controle: resources op datzelfde project worden WEL gekoppeld (de fix schakelt alleen
  // kalenders uit, niet de hele koppelfunctie) — anders zou dit blok toevallig groen zijn omdat er
  // helemaal niets meer gekoppeld wordt.
  const schilder = after.resources.find(r => r.name === 'Painters');
  assert(schilder?.libraryOrigin?.companyId === DEMO_COMPANY_ID, 'F2 negatieve controle: resource-koppeling (Painters) werkt nog gewoon');
}

// --- (e) Seed-VERSIE: een bestaande demo-pool van vóór de capaciteitscorrectie wordt bijgewerkt ---
// Waarom: `seedDemoLibrary` was idempotent op de AANWEZIGHEID van het bedrijf, dus een installatie
// die de demo-bibliotheek ooit geseed had kreeg een latere inhoudscorrectie nooit te zien — en zag
// in het bezettingsoverzicht een muur van rode rijen. De migratie mag daarbij geen id's veranderen
// (herkomststempels in open/opgeslagen projecten wijzen daarnaar) en niets verwijderen.
{
  useAppStore.setState({ companies: [], pools: {} } as never);
  const { company, pool } = buildDemoLibrarySeed();
  // Simuleer een pool van vóór deze versie: oude (te krappe) capaciteiten, geen seedVersion, en
  // één item dat de oude seed nog niet kende.
  const oud = {
    ...pool,
    seedVersion: undefined,
    poolVersion: 3,
    resources: pool.resources
      .filter((r) => r.name !== 'Lift supplier')
      .map((r) => r.name === 'Carpenters' ? { ...r, maxUnits: 4, description: 'oude omschrijving' }
        : r.name === 'Tilers' ? { ...r, maxUnits: 3 }
          : r.name === 'Kitchen fitters' ? { ...r, maxUnits: 2 } : r),
  };
  const idsVoor = new Map(oud.resources.map((r) => [r.name, r.id]));
  useAppStore.setState({ companies: [company], pools: { [DEMO_COMPANY_ID]: oud } } as never);

  useAppStore.getState().seedDemoLibrary();
  const na = useAppStore.getState().pools[DEMO_COMPANY_ID];
  const byName = (n: string) => na.resources.find((r) => r.name === n);

  assert(na.seedVersion === DEMO_LIBRARY_SEED_VERSION, 'migratie: seedVersion gezet op de huidige inhoudsversie');
  assert(byName('Carpenters')?.maxUnits === 14, `migratie: Carpenters-capaciteit bijgewerkt (heeft: ${byName('Carpenters')?.maxUnits})`);
  assert(byName('Tilers')?.maxUnits === 16, `migratie: Tilers-capaciteit bijgewerkt (heeft: ${byName('Tilers')?.maxUnits})`);
  assert(byName('Kitchen fitters')?.maxUnits === 9, `migratie: Kitchen fitters-capaciteit bijgewerkt (heeft: ${byName('Kitchen fitters')?.maxUnits})`);
  assert(byName('Carpenters')?.description !== 'oude omschrijving', 'migratie: omschrijving bijgewerkt');
  assert(!!byName('Lift supplier'), 'migratie: ontbrekend item toegevoegd');
  assert(na.resources.length === 14, `migratie: niets verwijderd, geen duplicaten (heeft: ${na.resources.length})`);
  for (const [naam, id] of idsVoor) {
    assert(byName(naam)?.id === id, `migratie: id van "${naam}" ongewijzigd (stempels blijven geldig)`);
  }
  assert(na.poolVersion === 4, `migratie: pool gebumpt zodat gekoppelde projecten herclassificeren (heeft: ${na.poolVersion})`);
  assert(byName('Plasterers')?.maxUnits === 3, 'migratie: het bedoelde knelpunt Plasterers blijft krap (3)');
  assert(byName('Masonry crew')?.maxUnits === 1, 'migratie: het bedoelde knelpunt Masonry crew blijft krap (1)');

  // Tweede aanroep ⇒ no-op: geen bump, dezelfde objectreferentie.
  const poolNaEerste = useAppStore.getState().pools[DEMO_COMPANY_ID];
  useAppStore.getState().seedDemoLibrary();
  assert(useAppStore.getState().pools[DEMO_COMPANY_ID] === poolNaEerste,
    'migratie (2e aanroep): no-op — zelfde pool-objectreferentie, geen extra bump');
}

console.log(`demo-library: ${checks - fails}/${checks} groen`);
process.exit(fails > 0 ? 1 : 0);
