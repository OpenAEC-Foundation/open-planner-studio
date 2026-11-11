// Register, veilige defaults en opslag. Klikken, toetsen en herladen staan in settings-tabs.spec.ts.
import './domStub';
import { experimentalToggleFlags, FEATURE_FLAGS, isFeatureEnabled, parseFeatureFlagValues } from '@/utils/featureFlags';
import { loadAllSettings } from '@/utils/settingsRegistry';
import { saveExperimentalSettingsVisible, saveFeatureFlags } from '@/utils/settingsStore';

const diffs: string[] = [];
const ok = (condition: boolean, message: string) => { if (!condition) diffs.push(message); };

// Elke flag zonder nieuwe IFC-data heeft een schakelaar in Experimenteel; verbergen bestaat niet.
for (const flag of FEATURE_FLAGS) {
  ok(!('hidden' in flag), `flag ${flag.id} heeft geen verborgen-veld`);
  ok(experimentalToggleFlags().includes(flag) === !flag.writesNewIfcData,
    `flag ${flag.id}: schakelaar alleen zonder nieuwe IFC-data (open vraag bij Ethan, 10 november 2026)`);
}

FEATURE_FLAGS.push(
  { id: 'voorbeeld', nameKey: 'settings.experimentalSection', writesNewIfcData: false },
  { id: 'nieuwe-ifc', nameKey: 'settings.version', writesNewIfcData: true },
);
ok(experimentalToggleFlags().some(flag => flag.id === 'voorbeeld'), 'een nieuwe flag krijgt een schakelaar');
ok(!experimentalToggleFlags().some(flag => flag.id === 'nieuwe-ifc'), 'een flag met nieuwe IFC-data krijgt geen schakelaar');
ok(!isFeatureEnabled({}, 'voorbeeld'), 'ontbrekend is uit');
ok(!isFeatureEnabled({ voorbeeld: false }, 'voorbeeld'), 'expliciet uit blijft uit');
ok(isFeatureEnabled({ voorbeeld: true }, 'voorbeeld'), 'expliciet aan werkt voor een geregistreerde flag');
ok(!isFeatureEnabled({ onbekend: true }, 'onbekend'), 'bewaarde onbekende ids activeren geen functie');
ok(!isFeatureEnabled({ 'nieuwe-ifc': true }, 'nieuwe-ifc'), 'nieuwe IFC-data blijft uit, ook met een bewaarde true');
ok(!isFeatureEnabled(Object.create({ voorbeeld: true }) as Record<string, boolean>, 'voorbeeld'), 'geërfde waarden activeren geen functie');

for (const invalid of [undefined, null, true, 1, 'true', [], ['voorbeeld']]) {
  ok(parseFeatureFlagValues(invalid) === undefined, `ongeldige opslag geweigerd: ${JSON.stringify(invalid)}`);
}
const parsed = parseFeatureFlagValues({ voorbeeld: true, uit: false, tekst: 'true', getal: 1, leeg: null });
ok(JSON.stringify(parsed) === '{"voorbeeld":true,"uit":false}', 'alleen booleans worden gelezen');

localStorage.clear();
await saveExperimentalSettingsVisible(true);
await saveFeatureFlags({ voorbeeld: true, 'nieuwe-ifc': true });
const visible = await loadAllSettings();
ok(visible.experimentalSettingsVisible === true, 'zichtbaarheid laadt via het instellingenregister');
ok(isFeatureEnabled(visible.featureFlags ?? {}, 'voorbeeld'), 'de flagkeuze laadt via het instellingenregister');
ok(!isFeatureEnabled(visible.featureFlags ?? {}, 'nieuwe-ifc'), 'IFC-flag blijft na laden ontoegankelijk');

await saveExperimentalSettingsVisible(false);
const hidden = await loadAllSettings();
ok(hidden.experimentalSettingsVisible === false, 'verbergen wordt apart bewaard');
ok(isFeatureEnabled(hidden.featureFlags ?? {}, 'voorbeeld'), 'verbergen bewaart de actieve flagkeuze');
ok(localStorage.getItem('ops-featureFlags') === '{"voorbeeld":true,"nieuwe-ifc":true}', 'flags gebruiken de bestaande ops-opslag');

FEATURE_FLAGS.splice(0, FEATURE_FLAGS.length);
if (diffs.length > 0) {
  for (const diff of diffs) console.log(`XX  feature-flags: ${diff}`);
  process.exit(1);
}
console.log('OK  feature-flags: alle checks groen');
