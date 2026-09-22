// Backdrop-klik en bewerkbare dialogen (issue #158) — broncodepoort.
//
// De bug: de nieuw-project-wizard sloot bij een klik naast het paneel en gooide daarmee stil alles
// weg wat de gebruiker al had ingetypt. Hetzelfde patroon zat in vijftien andere dialogen met
// invoervelden of een lokale bewerkbuffer (taak, kalender, filter, contour, imports, …), omdat de
// gedeelde `Dialog` de backdrop-close per dialoog laat kiezen en de migratie het bestaande gedrag
// letterlijk overnam.
//
// De regel sinds #158 (zie het doc-commentaar in `src/components/common/Dialog.tsx`):
//   `onBackdropClick` alleen op een dialoog ZONDER bewerkbare invoer — informatie- en keuzedialogen.
//   Alles met een invoerveld sluit uitsluitend via Annuleren/X/Escape.
//
// Deze poort bewaakt dat mechanisch, in twee richtingen:
//   (a) elk bestand onder src/ dat `onBackdropClick=` doorgeeft staat op de allowlist hieronder,
//       en bevat zelf geen invoerelement (`<input`, `<textarea`, `<select`, `<Select`);
//   (b) elk allowlist-item gebruikt de prop ook echt (geen spookvermelding die de lijst laat
//       verwateren);
//   (c) de twee dialogen met een eigen overlay (FeedbackDialog met textarea, SettingsDialog)
//       hangen geen klik-handler aan hun overlay.
//
// Draait via run.sh. Exit 0 = alles groen. Tijdzone-onafhankelijk.
import fs from 'node:fs';
import path from 'node:path';

const diffs: string[] = [];
let checks = 0;
function ok(label: string, cond: boolean, detail?: string): void {
  checks++;
  if (!cond) diffs.push(detail ? `${label}: ${detail}` : label);
}

/** Dialogen zonder bewerkbare invoer waar een klik naast het paneel gewoon "sluiten" mag betekenen. */
const ALLOWLIST = new Set([
  'src/components/dialogs/ConfirmDialog.tsx',            // ja/nee — backdrop = annuleren
  'src/components/dialogs/UpdateDialog.tsx',             // informatie; tijdens download al uitgeschakeld
  'src/components/dialogs/RecoveryDialog.tsx',           // keuze; sluiten laat de recovery-bestanden staan
  'src/components/dialogs/StatsDialog.tsx',              // leesweergave
  'src/components/dialogs/ShortcutsDialog.tsx',          // leesweergave
  'src/components/dialogs/AiConnectionDetailsDialog.tsx', // leesweergave
  'src/components/dialogs/NewOrOpenProjectDialog.tsx',   // keuze zonder invoer
  'src/components/dialogs/ExtensionConsentDialog.tsx',   // toestemming — backdrop = weigeren
  'src/components/dialogs/JustUpdatedDialog.tsx',        // leesweergave
  'src/components/dialogs/LibraryLinkDialog.tsx',        // keuzes werken direct op de store; "later beslissen" is een geldige uitgang
]);

const INPUT_MARKERS = ['<input', '<textarea', '<select', '<Select'];

function walk(dir: string, out: string[]): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const root = process.cwd();
const files = walk(path.join(root, 'src'), []).map(f => path.relative(root, f).split(path.sep).join('/'));
const backdropUsers = new Set<string>();

for (const rel of files) {
  if (rel === 'src/components/common/Dialog.tsx') continue;
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  if (!/\bonBackdropClick=/.test(src)) continue;
  backdropUsers.add(rel);
  ok(`onBackdropClick alleen op een dialoog zonder invoer: ${rel}`, ALLOWLIST.has(rel),
    'niet op de allowlist — een dialoog met invoer sluit alleen via Annuleren/X/Esc (issue #158)');
  const marker = INPUT_MARKERS.find(m => src.includes(m));
  ok(`allowlist-dialoog bevat geen invoerelement: ${rel}`, marker === undefined,
    `bevat \`${marker}\` — dan hoort de backdrop-close eraf én het bestand van de allowlist`);
}

for (const rel of ALLOWLIST) {
  ok(`allowlist-item bestaat: ${rel}`, fs.existsSync(path.join(root, rel)));
  ok(`allowlist-item gebruikt onBackdropClick nog: ${rel}`, backdropUsers.has(rel),
    'spookvermelding — haal hem van de allowlist');
}

// (c) eigen overlays zonder `Dialog`: de overlay-div mag geen klik-handler dragen.
const feedback = fs.readFileSync(path.join(root, 'src/components/dialogs/FeedbackDialog.tsx'), 'utf8');
const feedbackOverlay = /<div\s+className="feedback-dialog-overlay"\s*>/.test(feedback);
ok('FeedbackDialog-overlay heeft geen klik-handler (textarea erin)', feedbackOverlay,
  'de overlay-div van FeedbackDialog draagt weer een onClick of extra props — de tekst gaat dan verloren bij een misklik');

const settings = fs.readFileSync(path.join(root, 'src/components/dialogs/SettingsDialog.tsx'), 'utf8');
const settingsOverlayMatch = settings.match(/<div\s+className="settings-overlay"[^>]*>/);
ok('SettingsDialog-overlay heeft geen klik-handler', settingsOverlayMatch !== null && !/onClick/.test(settingsOverlayMatch[0]),
  settingsOverlayMatch ? `gevonden: ${settingsOverlayMatch[0]}` : 'geen `<div className="settings-overlay"` gevonden — pas deze poort aan');

if (diffs.length > 0) {
  console.error(`FAIL dialog-backdrop: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  dialog-backdrop: ${checks}/${checks} (${backdropUsers.size} dialogen met backdrop-close, allemaal zonder invoer)`);
