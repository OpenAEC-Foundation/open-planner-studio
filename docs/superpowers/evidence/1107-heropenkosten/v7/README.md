# Meting van de echte duuractie vóór wijziging van de checks

Op beginstand d6549d032, schoon. Alleen deze proef en haar uitvoer zijn toegevoegd; geen productcode of check gewijzigd.
Alle tien bestanden schrijven via zowel het eigenschappenpaneel als de tabel (20 merges) en geven na volledig
heropenen dezelfde canon als gewone opslag op main 20b9af79a zonder model na dezelfde actie en F5.

Paneel: TaskDurationField.apply maakt de volledige time-patch uit de geparste duur, TaskPropertiesPanel.update roept
updateTask(id, {time}, {coalesceKey}) aan. taskSlice.updateTask voert captureTriangle, carryRemainingThroughDurationEdit
en settleDurationEdit uit. De rest van een niet-gestarte taak met een expliciete bronrest volgt daarin de nieuwe duur.
Tabel: FullTaskGrid roept runGridMutation aan met cell-edit, columnId task.time.scheduleDuration, route task-schedule
en dezelfde ParsedTaskDuration als waarde. Het raster gebruikt dezelfde werkregels. De proef meet beide paden echt.

Bij dagenmaat is de invoer scheduleDuration + 1, durationUnit days, durationMinutes undefined; bij urenmaat de bestaande
invoer durationMinutes + 480 met de echte afleiding hourTaskScheduleDuration op de taakkalender. Dit behoudt het bestaande
invoergebaar van de proef (één werkdag respectievelijk 480 werkminuten), zonder de werkregels na te bouwen.

17-cijfers-villa, Set up site, beide routes gelijk:

| stap | duur | rest |
|---|---:|---:|
| vóór invoer | 2.3333333333333335 | 2.3333333333333335 |
| na echte actie | 3.3333333333333335 | 3.3333333333333335 |
| na F5 | 3.3333333333333335 | 3.3333333333333335 |
| na open-stappen domein | 3.3333333333333335 | 3.3333333333333335 |
| na merge en volledige heropening | 3.333333 | 3.333333 |

De gewijzigde duur en gewijzigde rest mogen volgens het besluit van Trias afronden. Er is geen getypeerde weigering.
De gewone opslag op main geeft dezelfde planning. Geen toestemming om een ongewijzigd veld af te ronden.

Reproduceren vanaf de repo-root, elke run een eigen slot:

    flock /tmp/ops-zwaar.lock node docs/superpowers/evidence/1107-heropenkosten/v7/meten.mjs main
    flock /tmp/ops-zwaar.lock node docs/superpowers/evidence/1107-heropenkosten/v7/meten.mjs merge

De main-run bundelt de eigen code uit git archive van exact 20b9af79a in een tijdelijke map, geen andere worktree.
main.json is de tijdelijke volledige vergelijkinginvoer, opnieuw te genereren; de taakwaarden staan compact in
main-samenvatting.json. merge.json bevat alle stappen, de exacte storeargumenten, meldingen en de vergelijking per route.

De eerste vergelijking vergat de vaste testklok in de main-run. De eerste drie oude bestanden kregen daardoor een andere
CreatedAt; alle merges schreven al. Die fout in de proef is hersteld door ook op main installDeterminism te gebruiken.
Daarna zijn beide afzonderlijke runs herhaald: 20/20 schrijven, 20/20 dezelfde planning. De eerste merge-uitkomsten en logs
blijven herkenbaar bewaard; zij zijn geen productbevinding. Geen telling of eindchecks uitgevoerd voor deze meting.
