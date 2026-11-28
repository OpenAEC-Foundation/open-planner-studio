# Opslagworker: een merge valt na een eerste start niet terug op de hoofdthread

Een gewoon verzoek aan de opslagworker rekent bij een startprobleem zelf op de hoofdthread, zoals main. Een merge doet
dat alleen zolang er in deze sessie nog nooit een worker startte; daarna wordt een startprobleem een mislukte opslag
(`IfcSaveWorkerError` met `not-started`, `compute` in `ifcSaveWorker.ts`). Een merge is er alleen bij een document met
een gebouwmodel of gegevens van een ander programma, en zo'n opslag duurt lang: Ctrl+S van een model van 157 MB
duurde in de desktopapp ruim 33 s (knownbug 1936). Zwaar merge-rekenwerk op de hoofdthread kan het venster blokkeren. Startte er
al eens een worker, dan is de omgeving er geschikt voor en is een mislukte opslag die de planner opnieuw kan proberen
beter dan een venster dat vastzit: de worker is dan gestopt en de volgende merge start een nieuwe. Startte er nog nooit
een (geen `Worker`, of een constructor die faalt), dan rekent de merge op de hoofdthread, zoals `planner_export_ifc`
dat altijd doet; anders kan zo'n omgeving een model nooit opslaan.
