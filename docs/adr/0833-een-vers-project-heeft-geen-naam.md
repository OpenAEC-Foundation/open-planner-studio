# Een vers project heeft geen naam

Een nieuw project krijgt in de data een lege naam (`createDefaultProject` in `src/state/defaults.ts`). Elke
weergaveplek valt bij een lege naam terug op `common:project.untitled`. Een gestempelde tekst zou de taal van dat
moment in het IFC-bestand zetten, en die verandert daarna niet meer mee met de taal van de app. Zelfde lijn als het
volgnummer van een naamloos document (ADR 0612) en de lege naam bij het lezen (ADR 0042).
