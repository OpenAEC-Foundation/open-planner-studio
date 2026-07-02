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
- `expect.error`: `true` (verwacht fout), `false` (verwacht géén fout), of een substring van de foutmelding.

## Eisen aan je batterij
- Dek je cluster **breed en systematisch**. Varieer topologie (keten, parallel, diamant, meerdere voorgangers/opvolgers).
- Geef bij twijfel de voorkeur aan **structurele** asserties (`crit`, `criticalPathSet`, `tf`, `projectDuration`) bovenop datums — die zijn het meest robuust.
- Neem bewust **differentiële paren** op (bv. lag 0 vs lag +2 vs lag −2 in verder identieke netwerken), zodat een genegeerde of verkeerd geteldelag opvalt.
- Reken elke verwachte waarde met de hand na uit de theorie + de werkdag-tabel. Wees expliciet en correct.
- Schrijf **geldige JSON** (geen commentaar in het bestand) naar het opgegeven pad.
```
