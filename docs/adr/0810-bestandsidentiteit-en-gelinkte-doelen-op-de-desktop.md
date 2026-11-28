# Bestandsidentiteit en gelinkte doelen op de desktop

Of twee verschillende padteksten op de desktop hetzelfde bestand zijn, beslist het besturingssysteem via `dev` en `ino` van plugin-fs
`stat` (`compareFilePaths` in `src/services/fileAccess/fileIdentity.ts`), niet de app met een padregel. Zo delen een
andere schrijfwijze van hoofdletters, een symbolische link (ook in een bovenliggende map) en een harde link hun
identiteit, zonder kleine letters, platformdetectie of een proef die iets op schijf verandert. De uitkomst heeft drie
waarden: `same`, `different` en `unknown`. Een identiteit die ontbreekt (Windows geeft geen `dev`/`ino`) of die als
JS-getal afgerond kan zijn (`Number.isSafeInteger`), bewijst nooit dat twee bestanden verschillen; de aanroeper beslist
wat `unknown` betekent.

## Gevolgen

- Een nieuw doel is alleen bewezen met de foutvorm van `stat` voor "bestaat niet" (`missingTarget`: os error 2), niet
  met `exists() === false`. Volgens het weggehaalde commentaar (niet nagegaan) gebruikt plugin-fs daar `Path::exists`,
  dat ook `false` geeft als de metadata niet te lezen is; een scopeweigering ("forbidden path") blijft ook onbekend.
- `replaceUserFile` (`atomicWrite.ts`) schrijft een doel dat `lstat` als symbolische link of met meer dan één naam meldt
  direct, zonder tijdelijk bestand. Een hernoeming zou een gewoon bestand op de plek van de link zetten (het doel van
  de link houdt dan de oude inhoud), en bij een harde link houdt de andere naam de oude inhoud. Daarvoor geeft de app
  de crashveiligheid van het tijdelijke bestand op.
