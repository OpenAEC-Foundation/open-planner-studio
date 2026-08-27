// UI-laag-helper (T11, T8-kwaliteitsreview-agenda stap 0-ter c): 15 call-sites bouwden hun
// `ImportLabels` (`{ importedProject, unassignedResource }`, doorgegeven aan `openFile`/
// `openRecentFile`/`parseExternalSource`/`refreshAllExternalAnchors`/`refreshExternalAnchorsFrom`
// en enkele losse `readIFC`/`openExampleFromString`-aanroepen) met de hand op, elke keer dezelfde
// twee sleutels. Eén plek — en de enige die een toekomstig DERDE label ooit hoeft bij te werken.
//
// `import type` (bewust, geen waarde-import): `ImportLabels` is puur een type uit `services/`, dus
// dit blijft na type-erasure een bladmodule zonder runtime-afhankelijkheid op `services/`/`state/`
// — deze module hoort in de UI-laag (`i18n/`), niet andersom. `npm run verify:cycles` bewaakt dat
// (het draait op het esbuild-metafile, dus NA type-erasure — een `import type` verschijnt daar
// niet in de graaf).
import type { ImportLabels } from '@/services/importTypes';

/**
 * Minimale vertaalfunctie die `buildImportLabels` nodig heeft: één sleutel in, tekst terug. Zowel
 * de React-hook-`t` (al gescoped op de `common`-namespace via `useTranslation('common')`) als een
 * handmatige `i18n.t`-wrapper voor niet-React call-sites (`useKeyboardShortcuts.ts`,
 * `shortcutRegistry.ts` — die draaien buiten React-lifecycle en gebruiken de globale `i18n`-
 * instantie rechtstreeks) voldoen hieraan. `key: any` is bewust: i18next's `TFunction` overloadt
 * op een LETTERLIJKE unie van alle bekende sleutels (niet `string`) — een generiek `(key: string)
 * => string` is daardoor NIET structureel compatibel met een echte `TFunction`, ongeacht welke
 * `t` een aanroeper meegeeft. `any` is hier de gebruikelijke overloop-uitweg (geen `strict`-
 * schending: expliciete `any`, geen impliciete).
 */
export type ImportLabelT = (key: any) => string;

/** Bouwt `ImportLabels` uit de `project.imported`/`project.unassignedResource`-sleutels van de
 *  `common`-namespace — spiegelt de 15 bestaande call-sites exact (zelfde sleutels, zelfde
 *  velden), puur een verhuizing van de letterlijke object-literal naar één functie. */
export function buildImportLabels(t: ImportLabelT): ImportLabels {
  return {
    importedProject: t('project.imported'),
    unassignedResource: t('project.unassignedResource'),
  };
}
