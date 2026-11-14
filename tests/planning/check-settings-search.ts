// Zoeken in het instellingenpaneel (`src/components/settings/catalog/settingsSearch.ts`) en de vaste
// namen van de instellingen (`src/utils/settingIds.ts`). De koppeling met het echte paneel (welke
// rijen bij welke zoekterm in beeld staan) toetst `tests/browser/settings-tabs.spec.ts`.
//
// Draait via run.sh. Exit 0 = alles groen.
import { matchesSearch, normalizeSearchText, searchTerms, splitKeywords } from '@/components/settings/catalog/settingsSearch';
import { SETTING_IDS, SETTINGS_GROUP_IDS, isSettingId } from '@/utils/settingIds';

const fails: string[] = [];
let checks = 0;
function eq(name: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fails.push(`${name}: ${JSON.stringify(actual)} ≠ ${JSON.stringify(expected)}`);
  }
}

// Normaliseren: hoofdletters, accenten en spaties tellen niet mee.
eq('kleine letters en accenten', normalizeSearchText('  Catégorie  ÉÉN '), 'categorie een');
eq('spaties samengevoegd', normalizeSearchText('Ctrl \t+  scrollen'), 'ctrl + scrollen');
eq('lege term ⇒ geen woorden', searchTerms('   '), []);
eq('woorden', searchTerms('Task  Type'), ['task', 'type']);

// Elk woord moet ergens staan, in welke tekst dan ook; de volgorde maakt niet uit.
const texts = ['Taaktypes gebruiken', 'Kies per taak wat meebeweegt', 'Task Type', 'Duration Type'];
eq('één woord', matchesSearch(texts, searchTerms('taaktypes')), true);
eq('woorden over twee teksten', matchesSearch(texts, searchTerms('duration meebeweegt')), true);
eq('omgekeerde volgorde', matchesSearch(texts, searchTerms('type task')), true);
eq('deel van een woord', matchesSearch(texts, searchTerms('taakt')), true);
eq('een ontbrekend woord ⇒ geen treffer', matchesSearch(texts, searchTerms('taaktypes weekend')), false);
eq('zonder zoekwoorden past alles', matchesSearch([], []), true);
eq('accent in de tekst, niet in de term', matchesSearch(['Café-modus'], searchTerms('cafe')), true);
eq('accent in de term, niet in de tekst', matchesSearch(['Cafe-modus'], searchTerms('café')), true);

// Zoekwoorden zijn een vertaalde, komma-gescheiden lijst.
eq('zoekwoorden splitsen', splitKeywords(' donker, dark mode ,, nachtmodus '), ['donker', 'dark mode', 'nachtmodus']);

// Vaste namen: uniek, en isSettingId kent precies die namen.
eq('instellingen uniek', new Set(SETTING_IDS).size, SETTING_IDS.length);
eq('groepen uniek', new Set(SETTINGS_GROUP_IDS).size, SETTINGS_GROUP_IDS.length);
eq('isSettingId: bekende naam', isSettingId('compressNonWorkdays'), true);
eq('isSettingId: onbekende naam', isSettingId('compressNonWorkday'), false);

if (fails.length > 0) {
  console.log(`XX instellingen zoeken — ${fails.length} van ${checks} checks rood:`);
  for (const f of fails) console.log(`   XX ${f}`);
  process.exit(1);
}
console.log(`OK instellingen zoeken — ${checks} checks groen`);
