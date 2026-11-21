// Issue #912: het sjabloon Woningbouw vulde zijn fasen altijd in het Nederlands, ook als de app in
// het Engels stond. De fasenamen volgen nu de interfacetaal op het moment van aanmaken; daarna zijn
// het gewone projectgegevens (een latere taalwissel hernoemt niets). Deze batterij bewaakt:
//   1. elk sjabloon geeft in nl precies de vertrouwde Nederlandse namen (geen ongemerkte wijziging);
//   2. in en komen Engelse namen, zonder één Nederlandse naam of ruwe sleutel;
//   3. elke fasesleutel bestaat in nl en en, en een taal zonder vertaling valt terug op het Engels;
//   4. het aanmaakscherm geeft de vertaalfunctie door (bron-assert op ProjectInfoPanelContent).
// Exit 0 = groen.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import i18next from 'i18next';
import nlMenu from '@/i18n/locales/nl/menu.json';
import enMenu from '@/i18n/locales/en/menu.json';
import { PROJECT_TEMPLATES, templatePhases } from '@/utils/projectTemplates';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

const make = async (lng: string) => {
  const inst = i18next.createInstance();
  await inst.init({
    lng, fallbackLng: 'en', ns: ['menu'], defaultNS: 'menu',
    // `de` zonder fasesleutels: de terugval op het Engels die een nog niet vertaalde taal krijgt.
    resources: { nl: { menu: nlMenu }, en: { menu: enMenu }, de: { menu: {} } },
    interpolation: { escapeValue: false },
  });
  return inst.getFixedT(lng, 'menu');
};

const tNl = await make('nl');
const tEn = await make('en');
const tDe = await make('de');

// 1. nl: de namen zoals ze altijd waren.
eq('01 nl woningbouw', templatePhases('woningbouw', tNl), [
  'Bouwplaats & grondwerk', 'Fundering', 'Ruwbouw / casco', 'Dak',
  'Gevel & afbouw', 'Installaties (W/E)', 'Afwerking', 'Oplevering',
]);
eq('02 nl utiliteit', templatePhases('utiliteit', tNl), [
  'Sloop & strip-out', 'Grondwerk & fundering', 'Hoofddraagconstructie', 'Gevel & dak',
  'Installaties (W/E)', 'Afbouw', 'Inregelen & testen', 'Oplevering',
]);
eq('03 leeg blijft leeg', templatePhases('empty', tEn), []);

// 2. en: Engels, geen Nederlandse naam, geen ruwe sleutel.
for (const tmpl of PROJECT_TEMPLATES) {
  const nl = templatePhases(tmpl.key, tNl);
  const en = templatePhases(tmpl.key, tEn);
  eq(`04 ${tmpl.key}: evenveel fasen in nl en en`, en.length, nl.length);
  eq(`05 ${tmpl.key}: geen Nederlandse naam in en`, en.filter(name => nl.includes(name)), []);
  eq(`06 ${tmpl.key}: geen ruwe sleutel in en`, en.filter(name => name.startsWith('newProject.')), []);
  eq(`07 ${tmpl.key}: geen ruwe sleutel in nl`, nl.filter(name => name.startsWith('newProject.')), []);
  eq(`08 ${tmpl.key}: unieke namen in en`, new Set(en).size, en.length);
  // 3. Een taal zonder vertaling toont het Engels, net als de rest van de interface.
  eq(`09 ${tmpl.key}: terugval op en`, templatePhases(tmpl.key, tDe), en);
}
eq('10 woningbouw en', templatePhases('woningbouw', tEn)[0], 'Site setup & groundwork');

// 4. Het aanmaakscherm vertaalt bij aanmaak met de menu-vertaalfunctie.
const panel = readFileSync(join(process.cwd(), 'src/components/settings/ProjectInfoPanelContent.tsx'), 'utf8');
eq('11 aanmaakscherm geeft tMenu door', /phaseNames:\s*templatePhases\(template,\s*tMenu\)/.test(panel), true);

if (diffs.length) {
  for (const d of diffs) console.log(`XX ${d}`);
  console.log(`check-project-template-i18n: ${diffs.length}/${checks} afwijkingen`);
  process.exit(1);
}
console.log(`check-project-template-i18n: ${checks} checks groen`);
