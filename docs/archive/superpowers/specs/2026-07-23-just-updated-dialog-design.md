# "Je bent net geüpdatet"-dialoog — ontwerp

**Datum:** 2026-07-23
**Status:** goedgekeurd ontwerp, klaar voor implementatieplan
**Scope:** desktop-only (Tauri). De web-build "update" via een deploy en heeft geen installer/versiesprong-moment — daar gebeurt niets.

## Doel

Na een geslaagde in-app update ziet de gebruiker bij de eerstvolgende start een korte, leuke "Je bent bijgewerkt!"-dialoog met drie weetjes over de sprong die net is gemaakt:

1. **Grootteverschil** — hoeveel de installer is geslonken of gegroeid t.o.v. de vorige versie.
2. **Tijd tussen releases** — hoeveel tijd er zat tussen deze release en de vorige (de tussenpoos, niet t.o.v. vandaag).
3. **GitHub-beschrijving** — de release-`body` van de nieuwe versie ("wat is er nieuw").

Plus de versiesprong zelf (van → naar).

## Niet-doelen (YAGNI)

- Geen weergave in de web-build.
- Geen markdown-rendering van de body (net als de bestaande `UpdateDialog`: platte `<pre>`-tekst).
- Geen persistente historie/changelog van eerdere sprongen — alleen de laatste.
- Geen nieuwe Rust-code. Alles frontend (past bij "Rust blijft dun").

## Onderdelen

### 1. Detectie van "net geüpdatet" (bij opstart, alleen Tauri)

Nieuwe persistente sleutel via `settingsStore`: `ops-lastVersion` (string).

Logica bij opstart (in de bootstrap-hook, zie *Integratie*):

```
huidige = await getVersion()            // Tauri app-API; alleen zinvol in Tauri
opgeslagen = getSetting('lastVersion')  // kan undefined zijn
if (isTauri && opgeslagen && opgeslagen !== huidige) {
    → net geüpdatet: onthoud { from: opgeslagen, to: huidige }
    → setUI({ showJustUpdatedDialog: true })
}
setSetting('lastVersion', huidige)      // altijd bijwerken
```

Randgevallen:
- **Verse installatie** (`opgeslagen` is `undefined`): niets tonen, alleen wegschrijven. We poppen dus nooit op bij een schone eerste start. **Gevolg (bevestigd in review):** de release die deze feature zélf introduceert toont nog niets — er is dan nog geen `ops-lastVersion`. De dialoog debuteert pas bij de eerstvolgende update daarna. Dit is bewust en geen bug.
- **Downgrade** (opgeslagen > huidige): telt ook als "gewijzigd" → we tonen de dialoog. De grootte-/tijdregels degraderen vanzelf als de data niet klopt (zie hieronder). Acceptabel; downgrades zijn zeldzaam.
- **Web-build**: `isTauri()` is false → nooit tonen, maar we mogen `lastVersion` wel wegschrijven (schaadt niet). Om het simpel te houden schrijven we de sleutel alleen in Tauri weg.

De "van → naar" wordt in UI-state gezet zodat de dialoog het weet. Voorstel: bewaar het paar in een lichte state, bv. `ui.justUpdated: { from: string; to: string } | null`, en toon de dialoog wanneer dat gevuld is (dan is een aparte `showJustUpdatedDialog`-boolean niet eens nodig). De sluitknop zet `ui.justUpdated = null`.

### 2. Release-data ophalen (één GitHub-call, alleen als net geüpdatet)

Nieuwe service `src/services/updater/releaseInfo.ts` (buurt van `updaterService.ts`).

```ts
export interface ReleaseComparison {
  currentBody: string;              // release-body van de nieuwe versie
  daysBetween: number | null;       // hele dagen tussen vorige en huidige release
  sizeDeltaBytes: number | null;    // huidige installer − vorige installer (kan < 0)
  currentSizeBytes: number | null;  // voor eventuele weergave/tooltip
}

export async function fetchReleaseComparison(
  currentVersion: string,
  installKind: InstallKind,
): Promise<ReleaseComparison | null>;
```

Implementatie:
- `GET https://api.github.com/repos/OpenAEC-Foundation/open-planner-studio/releases?per_page=30`
  (ongeauthenticeerd; deze call vuurt alleen éénmalig na een update — ruim binnen de 60/uur ratelimit).
- Vind de **huidige** release: `tag_name === 'v' + currentVersion'` (met tolerante match: met/zonder `v`-prefix).
- Vind de **vorige** release: de eerstvolgende in de lijst ná de huidige (lijst is nieuw→oud), of anders de release met de hoogste `published_at` die ouder is dan de huidige. Sla pre-releases/drafts over.
- `daysBetween` = afgerond aantal hele dagen tussen `previous.published_at` en `current.published_at`.
- `sizeDeltaBytes` = `assetSize(current) − assetSize(previous)`, waarbij `assetSize` de juiste installer-asset kiest (zie hieronder). Ontbreekt één van beide → `null`.
- `currentBody` = `current.body ?? ''`.

**Installer-asset kiezen** — `pickInstallerAsset(assets, installKind, os)`:

| install-kind | platform | asset-match (naam) |
|--------------|----------|--------------------|
| `appimage`   | linux    | eindigt op `.AppImage` |
| `deb`        | linux    | eindigt op `amd64.deb` |
| `native`     | windows  | eindigt op `-setup.exe` (NSIS-installer) |
| `native`     | macos    | eindigt op `.dmg` |
| `snap`       | linux    | (geen GitHub-asset) → `null` |

`.sig`-, `latest.json`- en updater-`.zip`/`.tar.gz`-assets worden genegeerd voor de grootte. De OS-detectie voor `native` gebeurt via `@tauri-apps/plugin-os` (`platform()`), dynamisch geïmporteerd achter een `isTauri()`-tak. De exacte asset-namen worden bij implementatie geverifieerd tegen een echte release (bv. v2026.7.11-assets); de tabel is best-effort en de code degradeert netjes bij geen match.

**Foutafhandeling:** elke fout (offline, ratelimit, JSON-fout, release niet gevonden) → de functie geeft de velden die het wél kon bepalen, en `null` voor de rest; bij een totale fout `null`. De dialoog toont dan alleen wat beschikbaar is (minimaal de versiesprong).

### 3. De dialoog — `src/components/dialogs/JustUpdatedDialog.tsx`

Gemount in `App.tsx` naast de andere `ui.show*`-dialogen. Gebruikt het bestaande `Dialog`-component en dezelfde stijlklassen/tokens als `UpdateDialog` voor een consistente look.

Inhoud (elke regel verschijnt alleen als de bijbehorende data er is):

```
┌─────────────────────────────────────┐
│  🎉  Je bent bijgewerkt!        [X]  │
│      v2026.7.10  →  v2026.7.11       │
│                                      │
│  ↓ 3,2 MB kleiner dan de vorige      │   ← alleen bij sizeDeltaBytes != null
│  ⏱ 12 dagen sinds de vorige release  │   ← alleen bij daysBetween != null
│                                      │
│  ── Wat is er nieuw ──               │   ← alleen bij niet-lege body
│  <pre> GitHub-release-beschrijving   │
│                                      │
│                        [ Sluiten ]   │
└─────────────────────────────────────┘
```

Gedrag:
- Bij openen: `getInstallKind()` + `fetchReleaseComparison(to, installKind)` aanroepen; tijdens laden een subtiele "…"-staat, geen blokkerende spinner.
- Body als `<pre className="whitespace-pre-wrap break-words … font-sans">` met scrollbare `max-h`, identiek aan `UpdateDialog`.
- Grootteverschil: geformatteerd met `formatBytes` (in v1 verhuisd naar `src/utils/formatBytes.ts`, zie plan), met richting/teken. Let op: `formatBytes` rendert binaire MiB met punt-decimaal en 2 decimalen ("1.04 MB"), niet de komma uit de mockup — bewust geaccepteerd, geen bytes-lokalisatie in v1. Bij delta 0 → "even groot".
- Tijd: `daysBetween` in mensvriendelijke tekst via i18n (dagen; bij ≥ ~60 dagen eventueel "maanden", maar dagen volstaat voor v1).
- Esc / backdrop / Sluiten → `ui.justUpdated = null`.

### 4. i18n

Nieuwe sleutels onder `updates.justUpdated.*` in namespace **`common`**, voor alle 14 locales (`nl` canoniek + `en, fr, de, es, zh, it, pt, pl, tr, ar, ja, ko, fa`). Minimaal:

- `title` — "Je bent bijgewerkt!"
- `whatsNew` — "Wat is er nieuw"
- `smaller` / `larger` / `sameSize` — "{{size}} kleiner dan de vorige" / "{{size}} groter dan de vorige" / "even groot als de vorige"
- `daysSincePrevious` — "{{count}} dagen sinds de vorige release" (met plural-vorm)
- `close` — bestaat al (hergebruik `close`).

Fallback is Engels (`fallbackLng: 'en'`), zoals in de rest van de app.

## Integratie-aanrakingen

| Bestand | Wijziging |
|---------|-----------|
| `src/utils/settingsStore.ts` | `loadLastVersion()` / `saveLastVersion()` (patroon van `loadWelcomeSeen`/`saveWelcomeSeen`). |
| `src/hooks/useSettingsBootstrap.ts` (of `useUpdateCheck.ts`) | Detectie-logica bij opstart; zet `ui.justUpdated`. |
| `src/state/slices/types.ts` + `uiSlice.ts` | Nieuwe UI-state `justUpdated: { from, to } \| null` (default `null`). |
| `src/services/updater/releaseInfo.ts` | **Nieuw** — `fetchReleaseComparison` + `pickInstallerAsset`. |
| `src/components/dialogs/JustUpdatedDialog.tsx` | **Nieuw** — de dialoog. |
| `src/App.tsx` | `JustUpdatedDialog` mounten. |
| `src/i18n/locales/*/common.json` | Nieuwe `updates.justUpdated.*`-sleutels (14 locales). |

## Testen / verificatie

Geen scheduling-code geraakt → de CPM-suite is niet van toepassing. `tsc` (via `npm run build`) is de statische poort.

Handmatige/self-test-verificatie (browser dev-build kan de Tauri-tak niet draaien, dus):
- **Detectie-unit**: de vergelijk-/detectielogica zo schrijven dat ze headless (esbuild+node) te testen is met gemockte `getVersion`/`getSetting` — verse install, gelijk, gewijzigd, downgrade.
- **`pickInstallerAsset`**: pure functie, headless testbaar met voorbeeld-asset-lijsten per install-kind/OS.
- **`fetchReleaseComparison`**: testen met een gemockte `fetch`-respons (twee releases) → juiste `daysBetween`/`sizeDeltaBytes`/`body`; en foutpaden → nette degradatie.
- **Dialoog visueel**: via een dev-only hook de `ui.justUpdated` forceren in de browser dev-build om de layout/degradatie-varianten (alle regels, ontbrekende size, ontbrekende tijd, lege body) te bekijken; eindoordeel visueel over aan de gebruiker.

## Beslist

- **Iconen:** lucide (consistent met de rest) — `ArrowDown`/`ArrowUp` voor kleiner/groter, `Clock` voor de tijd, `PartyPopper` (of vergelijkbaar) in de titel. Geen emoji.
- **Tijd:** alleen in **dagen** ("{{count}} dagen sinds de vorige release"), ook bij lange periodes. Geen maanden/weken.

## Open puntjes (klein, tijdens bouw beslissen)

- Exacte asset-naam-patronen verifiëren tegen een echte release.
- macOS `native`: `.dmg` als installer-grootte (updater gebruikt `.app.tar.gz`, maar de `.dmg` is wat de gebruiker "downloadt" — consistenter voor het weetje).
