# B2-iconen (OpenAEC-huisstijl)

Open Planner Studio tekent zijn interface-iconen met de **OpenAEC-iconenset B2** uit de
[OpenAEC Style Repo](https://github.com/OpenAEC-Foundation/OpenAEC-Style-Repo) in plaats van
Lucide. B2 is de huisstijlset van de OpenAEC Foundation (945 ontwerpen, getekend als gevulde
contouren in een 16px- en een 24px-master); alle OpenAEC-apps gaan dezelfde set gebruiken.

## Wat er in deze repository staat

| Pad | Inhoud |
|---|---|
| `public/icons/b2/16/<id>.svg`, `public/icons/b2/24/<id>.svg` | De masters van alleen de iconen die de app gebruikt, bytegelijk overgenomen uit `design/icon-set-b2/svg/` van de Style Repo (geen afronding, geen optimalisatie). |
| `public/icons/b2/manifest.json` | Herkomst (repository, commit), B2-revisie, en per icoon pad, grootte en SHA-256 van beide masters. |
| `src/components/common/b2IconNames.ts` | De lijst van gebruikte icoon-id's en het type `B2IconName`. Dit is de bron voor het synchronisatiescript. |
| `src/components/common/B2Icon.tsx` | Het React-component `<B2Icon name="task.add" size={24} />`. |
| `scripts/sync-b2-icons.mjs` | Kopieert de masters uit een Style Repo-checkout en schrijft het manifest. |

Huidige stand: **B2 revisie 106**, Style Repo-commit zoals vermeld in het manifest.

## Het component

- `size` is de weergavemaat in px. Tot en met 18 px tekent het component de 16px-master,
  daarboven de 24px-master. In het lint zijn grote knoppen 24 px en kleine knoppen en menu's
  16 px; panelen en dialogen houden hun bestaande pixelmaten.
- Kleur: het hoofddeel van een master is `currentColor`, het accentdeel
  `var(--icon-accent, currentColor)`. `.b2-icon` in `globals.css` zet `--icon-accent` op
  `--theme-accent`, zodat het accent het thema (licht, donker, hoog contrast) volgt. Op een
  accentachtergrond (actieve of primaire lintknop, `.btn--primary`) en bij uitgeschakelde
  bediening valt het accent terug op de hoofdkleur; `b2-icon--mono` dwingt dat af.
- `flip` spiegelt horizontaal (richtingsiconen in RTL); het icoon krijgt dan `data-b2-flip="x"`.
- Elk icoon draagt `data-b2-icon="<id>"`; browsertests selecteren daarop
  (`[data-b2-icon="planning.driving"]`).
- De markup wordt per master één keer opgehaald uit `public/icons/b2/` en in een modulecache
  gehouden; daarna rendert elk gelijknamig icoon synchroon. Tot de eerste master binnen is staat
  er een lege `<svg>` van dezelfde maat.

## Een icoon toevoegen of de set bijwerken

1. Kies de icoon-id in de Style Repo (`crates/openaec-icons/src/generated.rs` geeft per id het
   Nederlandse label en de apps; de functiecontracten staan in `harmonization/icon-set-b2/`).
2. Zet de id in `src/components/common/b2IconNames.ts`.
3. Draai, met een lokale checkout van de Style Repo:

   ```bash
   node scripts/sync-b2-icons.mjs --source ../OpenAEC-Style-Repo
   ```

   Het script kopieert beide masters, verwijdert iconen die niet meer in de lijst staan en
   schrijft het manifest opnieuw.

## Herkomst van de koppeling Lucide → B2

De vervanging volgt de bronbesluiten uit de Style Repo: daar is elke Lucide-aanroep van deze app
(gepind op commit `5a65f6b8`) gelezen en aan een B2-functiecontract gekoppeld
(`harmonization/function-icon-catalog.json`, `harmonization/icon-set-b2/function-plan.json` en de
`scripts/b2_planner_*_completion.py`). Aanroepen die na die commit zijn bijgekomen, zijn naar
analogie van de bestaande besluiten gekoppeld (bijvoorbeeld een `Info`-knopje → `help.context-hint`).
Toestandsafhankelijke plekken kiezen per toestand een eigen B2-teken: de AI-bridgestatus
(`status.bridge-off`/`-live`/`status.warning`/`status.error`), `StatusBanner` (waarschuwing of
informatie), de kolommenkiezer (`tree.expand`/`tree.collapse`), de bibliotheekkoppeling
(`status.library-item-missing`/`-deviated`) en de bezettingsweergave
(`status.schedule-preview`/`-last-result`).

Niet vervangen: logo's, cursors, modelinhoud (Gantt-canvas, histogrammen, de capaciteitsstreep in
de histogramlegenda) en iconen die extensies zelf meeleveren (`ExtensionIcon`).

## Licentie

De licentie van de B2-iconen is nog niet definitief vastgesteld: de crate `openaec-icons` in de
Style Repo staat voorlopig op LGPL-3.0-only, de Style Repo zelf op CC-BY-SA-4.0. Vóór een release
met deze iconen moet de OpenAEC Foundation die keuze bevestigen en hier vastleggen.
