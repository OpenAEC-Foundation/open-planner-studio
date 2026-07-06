# Briefing voor finder-subagents — testbatterijen planningscorrectheid

Je ontwerpt een batterij testgevallen voor de planningsmotor (CPM) van een bouwplanner.
Je schrijft GEEN code en draait niets — je levert alleen een JSON-bestand met testgevallen.

## De gouden regel (anti-circulariteit)
Leid elke verwachte uitkomst af uit **standaard CPM-theorie** (zoals in leerboeken / PMI),
NIET uit de broncode van de solver. **Lees `src/engine/scheduler/CPMSolver.ts` en
`CalendarEngine.ts` NIET.** Als je naar de code kijkt en de berekening overschrijft, vindt
de test niets. Het is juist de bedoeling dat sommige gevallen straks "falen" tegen de app —
dát zijn de kandidaat-bevindingen. Wees streng en correct volgens de theorie.

## Vaste conventies (al bevestigd via calibratie — hierop mag je bouwen)
- **Duur** staat in **werkdagen**; de **einddag telt mee** (inclusief). Een taak van 5 werkdagen
  die op maandag start, eindigt op vrijdag. Formeel: finish = de duur-de werkdag vanaf de start,
  waarbij de startdag werkdag 1 is.
- **Mijlpaal** = duur 0 → `es == ef` (start = finish, geen tijdsbeslag).
- **Schone kalender (default):** werkdagen ma–vr, **geen feestdagen**. Weekenden worden overgeslagen.
- **Anker (startdatum van taken zonder voorganger):** `2026-06-01` (een **maandag**).
- **FS (Finish→Start), lag 0:** opvolger start de **eerstvolgende werkdag NA** de finish van de voorganger.
- **SS (Start→Start), lag 0:** opvolger start op **dezelfde werkdag** als de voorganger.
- **FF (Finish→Finish), lag 0:** opvolger **eindigt gelijk met** de voorganger (de finishes worden uitgelijnd).
  Gevolg: een kortere opvolger start later, zodat ze samen eindigen.
- **SF (Start→Finish), lag 0:** opvolger **eindigt** wanneer de voorganger **start** (zeldzaam).
- **Lag L (werkdagen):** verschuif de betreffende datum met L werkdagen — L>0 later, **L<0 = lead (eerder)**.
  Voorbeeld FS lag +2: opvolger start 2 werkdagen later dan bij lag 0. FS lag −2 (lead): 2 werkdagen eerder.
- **Totale speling (tf):** aantal werkdagen dat een taak kan opschuiven zonder de projecteinddatum te verlaten.
  **Kritiek** = tf 0.
- **Vrije speling (ff):** aantal werkdagen dat een taak kan opschuiven zonder de vroegste start van zijn
  **eerstvolgende opvolger** te verlaten. Altijd geldt **ff ≤ tf**.
- **Per-taak-kalender (fase 2.8a):** elke taak rekent zijn **duur, constraints én float** in zíjn eigen
  kalender (`tasks[].calendar` → een naam uit `Case.calendars`; ontbreekt = projectkalender). De
  **relatie-lag telt in de kalender van de VOORGANGER** (`LAG_CALENDAR = 'predecessor'`, P6-default): een
  FS+2 vanuit een ma-vr-voorganger stapt de 2 lag-dagen over ma-vr, óók als de opvolger 7-daags is. De
  **FS-gap** (opvolger start de werkdag ná de voorganger-finish) rekent eveneens in de **voorganger**-
  kalender; de **succBack-aftrek** (finish→start van de opvolger) en de **successor-start-snap** in de
  **opvolger**-kalender. `ELAPSEDTIME`-lag blijft 24/7 (kalender-onafhankelijk). De backward-pass spiegelt
  dit exact (lag terug in voorganger-kalender, FS-gap-spiegel in voorganger-kalender, duur-aftrek in de
  taak-eigen kalender) — zo tellen forward en backward hetzelfde raster en is float symmetrisch.

## Werkdag-tabel (schone kalender, vanaf het anker — gebruik dit om datums op te zoeken)
wd1 2026-06-01 ma · wd2 06-02 di · wd3 06-03 wo · wd4 06-04 do · wd5 06-05 vr
wd6 06-08 ma · wd7 06-09 di · wd8 06-10 wo · wd9 06-11 do · wd10 06-12 vr
wd11 06-15 ma · wd12 06-16 di · wd13 06-17 wo · wd14 06-18 do · wd15 06-19 vr
wd16 06-22 ma · wd17 06-23 di · wd18 06-24 wo · wd19 06-25 do · wd20 06-26 vr
wd21 06-29 ma · wd22 06-30 di · wd23 07-01 wo · wd24 07-02 do · wd25 07-03 vr
wd26 07-06 ma · wd27 07-07 di · wd28 07-08 wo · wd29 07-09 do · wd30 07-10 vr
(Verleng zelf indien nodig: elke 5 werkdagen = +7 kalenderdagen; sla za/zo over.)

## JSON-schema voor je uitvoerbestand
```json
{
  "cases": [
    {
      "id": "rel-ff-01",
      "title": "Korte beschrijving wat je test en waarom (NL)",
      "calendar": { "workDays": [1,2,3,4,5], "holidays": [{"name":"X","startDate":"2026-06-03","endDate":"2026-06-03"}] },
      "anchor": "2026-06-01",
      "tasks": [ { "name": "A", "dur": 5 }, { "name": "B", "dur": 3 }, { "name": "M", "milestone": true } ],
      "links": [ { "pred": "A", "succ": "B", "type": "FINISH_FINISH", "lag": 0 } ],
      "expect": {
        "tasks": {
          "A": { "es": "2026-06-01", "ef": "2026-06-05", "tf": 0, "crit": true },
          "B": { "es": "2026-06-03", "ef": "2026-06-05" }
        },
        "criticalPathSet": ["A","B"],
        "projectEnd": "2026-06-05",
        "projectDuration": 5,
        "error": false
      }
    }
  ]
}
```
Velden:
- `calendar` en `anchor` zijn optioneel (default: schone kalender + 2026-06-01). Laat weg tenzij je cluster ze nodig heeft.
- `tasks[].dur` in werkdagen (default 1); `milestone:true` ⇒ duur 0. `tasks[].start` optioneel (default = anchor) voor wortel-taken.
- `links[].type` ∈ `FINISH_START | START_START | FINISH_FINISH | START_FINISH`. `lag` optioneel (default 0; mag negatief).
- `links[].lagUnit` optioneel: `WORKTIME` (default, werkdagen) of `ELAPSEDTIME` (kalenderdagen, 24/7 —
  snapt richtingbewust naar een werkdag: forward vooruit, backward achteruit).
- `links[].lagPercent` optioneel: procent-lag (MSP-semantiek) — `Math.round(voorgangerduur × pct / 100)`
  dagen in de opgegeven eenheid, per run geëvalueerd; overstemt `lag`.
- `expect.tasks[name]`: geef alléén de velden die je wilt asserten (`es,ef,ls,lf,tf,ff,crit`). Datums "YYYY-MM-DD".
- `expect.criticalPathSet`: lijst namen (volgorde-onafhankelijk vergeleken).
- `expect.drivingSet` / `expect.truncatedLeadSet`: lijst `[voorganger, opvolger, type]`-triples —
  welke relaties driving zijn (relatie-vrije-speling 0) resp. welke leads op de projectstart zijn afgekapt.
- `tasks[].constraint` optioneel: `{ type: ASAP|ALAP|SNET|SNLT|FNET|FNLT|MSO|MFO, date? }` (P6-soft:
  logica wint; late-zijde-schending = negatieve float; MSO/MFO = Start/Finish On). `tasks[].deadline`
  optioneel (zacht: alleen late datums). `expect.violatedConstraintsSet` / `expect.missedDeadlinesSet`:
  taaknaam-verzamelingen. Totale float kan negatief zijn (kritiek = tf ≤ 0).
- `expect.error`: `true` (verwacht fout), `false` (verwacht géén fout), of een substring van de foutmelding.

## Eisen aan je batterij
- Dek je cluster **breed en systematisch**. Varieer topologie (keten, parallel, diamant, meerdere voorgangers/opvolgers).
- Geef bij twijfel de voorkeur aan **structurele** asserties (`crit`, `criticalPathSet`, `tf`, `projectDuration`) bovenop datums — die zijn het meest robuust.
- Neem bewust **differentiële paren** op (bv. lag 0 vs lag +2 vs lag −2 in verder identieke netwerken), zodat een genegeerde of verkeerd geteldelag opvalt.
- Reken elke verwachte waarde met de hand na uit de theorie + de werkdag-tabel. Wees expliciet en correct.
- Schrijf **geldige JSON** (geen commentaar in het bestand) naar het opgegeven pad.
```

---

## Fase 2.8b — UUR-batterij (`cases-hours.json`): minuut-tabel per referentiekalender (§8.3/§9)

Uur-cases rekenen op **minuut-granulariteit**. De harness accepteert (golf 3, §8.1):
- **`tasks[].dur`** als string met **hele eenheden**: `"12u"`/`"4h"`/`"2d 4u"`/`"90m"`/`"1d"` ⇒ `durationMinutes`
  (via `parseDuration` in de **effectieve kalender**: een dag = `hoursPerDay × 60` min). Een getal blijft werkdagen (dag-modus).
- **Uur-kalenders** via `calendar.workTime`/`calendars[].workTime` (banden). Afwezig ⇒ dag-kalender (byte-identiek).
- **`links[].lag`** als string (`"4u"`/`"24u"`) ⇒ `lagMinutes` (in de **voorganger**-kalender); `lagMinutes` mag ook
  rechtstreeks (negatief = lead, bv. `-120`). `lagUnit: "ELAPSEDTIME"` telt 24/7-klokminuten.
- **`statusDate`** mag een datetime zijn; **`tasks[].remainingMinutes`** stuurt uur-voortgang; **`durationMinutesRaw`**
  zet `durationMinutes` rauw (voor de dag-kalender-invariant, §8.3).
- **Verwachtingen**: uur-taak ⇒ `"YYYY-MM-DDTHH:mm"`; dag-taak ⇒ `"YYYY-MM-DD"` (exacte string-gelijkheid).
  `tf`/`ff` in eigen-kalender-**werkdagen** (fractioneel in uur-modus: `minuten / (hoursPerDay×60)`; bv. 240m op H8 = `0.5`).

### Referentiedagen (geverifieerd met `date`)
ma **6** juli 2026 · di 7 · wo 8 · do 9 · vr 10 · za 11 · zo 12 · ma **13** · di 14. Anker uur-cases = **2026-07-06** (ma).

### Grens-conventie (§4.1)
Band = **`[start, end)`**. `nextWorkInstant(t)` = `t` als `t ∈ [bandstart, bandeind)`, anders de eerstvolgende bandstart;
een instant **exact op een band-eind** is *niet* werkend (werk stopt daar) ⇒ snapt naar de volgende bandstart.
`prevWorkInstant(t)` = `t` als `t ∈ (bandstart, bandeind]`. **FS-opvolger** = `nextWorkInstant(exclusieve pred-finish) + lag`,
lag telt in de **voorganger**-kalender. `addWorkMinutes` telt vanaf de startinstant en springt bij een bandgrens naar de
volgende bandstart. Wrap-band (over middernacht) hoort bij de **startweekdag**; een holiday onderdrukt alleen de shift die
op díé dag **start** (de staart van de vorige nacht loopt door — Bevinding 9).

### Minuut-tabel (minuten-vanaf-middernacht)
`00:00=0 · 02:00=120 · 06:00=360 · 08:00=480 · 10:00=600 · 12:00=720 · 12:30=750 · 14:00=840 · 14:30=870 ·`
`16:00=960 · 16:30=990 · 18:00=1080 · 22:00=1320 · 24:00/volgende-00:00=1440 · wrap-eind 06:00=1800`

| Kalender | workDays | Banden per werkdag (min) | Netto/dag | `hoursPerDay` | Werk-intervallen (voorbeeld) |
|---|---|---|---|---|---|
| **H8**      | ma-vr | `[480,960)` (08:00-16:00) | 480 | 8 | `[ma 08:00, ma 16:00)`, `[di 08:00, di 16:00)`, … weekend-gat … `[ma13 08:00, …)` |
| **H-break** | ma-vr | `[480,720)`+`[750,990)` (08-12 + 12:30-16:30) | 480 | 8 | lunch 12:00-12:30 niet-werkend; 6u vanaf 08:00 ⇒ **14:30** |
| **Night**   | ma-vr | `[1320,1800)` (22:00→**06:00** wrap) | 480 | 8 | `[ma 22:00, di 06:00)`, `[di 22:00, wo 06:00)`, … `[vr 22:00, za 06:00)`; za/zo geen shift |
| **24/7**    | ma-zo | `[0,1440)` (00:00-24:00) alle 7 | 1440 | 24 | naadloos, geen gaten; WORKTIME-lag ≡ ELAPSEDTIME-lag |
| **H10**     | ma-vr | `[480,1080)` (08:00-18:00) | 600 | 10 | `[ma 08:00, ma 18:00)`, … (dag = **600** min) |
| **DagMV**   | ma-vr | — (geen `workTime`) | — | opgegeven | bevroren dag-lussen; EF = laatste werkdag (date-only) |

**Cross-modus (§4.3):** dag-voorganger levert `predDoneAt = (EF-dag + 1) @ 00:00`; uur-voorganger levert `EF`-instant.
Uur-opvolger consumeert `nextWorkInstant(predDoneAt)`; dag-opvolger `nextWorkDay(ceilToWorkDay(predDoneAt))`
(`ceilToWorkDay` = zelfde dag op 00:00, anders de volgende). `durationMinutes` op een **dag-kalender** wordt genegeerd
(`scheduleDuration` wint, Bevinding 2). Voorbeeld-narekening: 720m op H8 vanaf ma 08:00 = ma 480 (08-16) + di 240 (08-12) ⇒ **di 12:00**.
