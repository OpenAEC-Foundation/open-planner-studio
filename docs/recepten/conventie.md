# Een nieuwe rekenconventie toevoegen

Een **conventie** is een regel die per planningspakket verschilt (P6 doet het zo, MS Project anders) en
niet per bestand. Verschilt iets per bestand, dan is het een **projectoptie** (`ProjectOptionKey`) of —
als de waarde uit het bronbestand komt maar een pakketregel is — een **per-bestand-conventie** die de
lezer als override zet (zoals A19, `p6UseRemainingStartForProgress` uit `rem_target_link_flag`). Twijfel
je: regel B uit de goal prompt (`docs/superpowers/plans/2026-09-22-goalprompt-x12-naar-nul.md`) beslist.
Zie *Rekenprofielen* in `CLAUDE.md` en de spec `docs/superpowers/specs/2026-09-22-rekenprofielen-design.md`.

**Dit is een toelichting, geen vervanging.** Loopt het ooit achter, dan heeft de code gelijk.

---

## De stappen

1. **Type.** Voeg de boolean toe aan `SchedulingOptions` (`src/types/project.ts`) met een docblok (wat,
   waar in de motor, P6/MS Project/OPS), en aan de unie `ConventionKey`. De compiler dwingt daarna
   stap 2 af (`_everyConventionNamed` in het register) en houdt `ProjectOptionKey` disjunct.
2. **Register-rij** in `CONVENTIONS` (`src/engine/scheduler/conventions/registry.ts`): groep (nieuwe
   conventies: `'C'` — een legacy-XER-blob zonder profiel-pset migreert dan naar het P6-profiel
   zonder afwijkingen, dus met de conventie op de P6-waarde; zie `legacyOptionsToProfile`), de drie
   ingebouwde waarden, `gatedByP6Source: false` (nieuwe conventies hebben geen `p6Source`-verleden),
   `perFile` (komt de waarde per bestand uit de bron? beschrijvend; zie stap 4) en `since` = vandaag. `legacyValue` = het gedrag vóór vandaag (bijna altijd de OPS-waarde): dat geldt
   voor bestanden mét `OPS_SchedulingProfile` die de sleutel nog niet kennen. De volgorde in de lijst is
   de sleutelvolgorde in de IFC-JSON: voeg achteraan toe.
3. **Motor.** Lees uitsluitend `schedulingOptions.<id>`. Nooit het bronformaat, nooit een lezer-import:
   `npm run verify:conventions` faalt anders. Een nieuwe lezing van een herkomstveld (`p6ProjectId`
   e.d.) laat de gepinde datagate-telling stijgen en maakt de poort ook rood — bespreek dat eerst.
4. **Lezer** (alleen bij een per-bestand-conventie): de lezer zet de bestandswaarde als override op het
   profiel, en de register-rij krijgt `perFile: true`. Het bewerkmodel leidt daaruit
   `PER_FILE_CONVENTION_KEYS` af (`src/state/schedulingProfileDraft.ts`) en draagt de waarde over bij
   elke profielwissel, ook naar een eigen profiel of sjabloon. `switchProfile` kijkt bewust niet naar
   `perFile` (op een ingebouwd id blijven alle afwijkingen letterlijk staan).
5. **i18n**: `conventions.<id>.label` en `.help` in alle 14 `common.json`-bestanden (`npm run verify:i18n`;
   `check-conventions-registry.ts` eist per locale beide teksten en precies de registersleutels).
6. **Gids**: één regel onder "De tweeëntwintig conventies" in `public/docs/{nl,en}/gids-rekenprofielen.md`
   (pas het aantal aan, ook in de kop en in "Wat je hier leert").
7. **Tests**: `check-conventions-registry.ts` dekt de rij vanzelf; voeg een aan/uit-fixture met een
   met de hand afgeleid verschil toe (mutatiebewijs, patroon `check-conventions-p6-flags.ts`).
8. **Landingspoort**: `npm run measure:profiles` vóór de commit — geen exacte cel mag inexact worden
   onder welk profiel met orakel ook (regel A).

IFC hoeft niets: `OPS_SchedulingProfile` schrijft alle conventies opgelost; oude bestanden vallen via
`legacyValue` terug. Zie `docs/ifc-round-trip.md`.
