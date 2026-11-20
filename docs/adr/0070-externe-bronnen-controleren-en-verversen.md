# Externe bronnen: controleren en verversen zonder achterhaalde stand

De ankers van externe relaties komen uit andere bestanden, die tijdens een controle of een verversing kunnen
veranderen, en de planner kan intussen zelf verder werken of een andere route op dezelfde bron starten. Het lezen is
asynchroon, het schrijven niet. We kozen daarom voor een vaste volgorde: eerst alles lezen zonder iets te muteren,
dan in één keer schrijven, en een gelezen uitkomst weggooien zodra een andere route de bron intussen veranderde. Het
gedrag voor de planner staat in `docs/relaties-tussen-projecten.md`; dit besluit gaat over hoe de store dat
waarmaakt (`fileSlice.ts`).

## Gevolgen

- De versie van een bestand met pad (de wijzigingstijd) wordt vóór het lezen bepaald. Verandert het bestand tijdens
  het lezen, dan is de bewaarde versie ouder dan de inhoud en meldt de volgende controle het als nieuw; andersom
  kan niet. Lukt het opvragen van de wijzigingstijd niet, dan blijft de versie onbekend.
- Er loopt hoogstens één controle tegelijk (`checkExternalSources`). Een verzoek tijdens een controle geeft één extra
  ronde erna, net als een controle die een uitkomst moest weggooien.
- Per document en bron houdt de store een teller bij. Elke route die de uitgangssituatie van een bron verandert
  (*Alle externe relaties vernieuwen*, *Bron vernieuwen*, *Bronbestanden kiezen…*, *Accepteren*, *Later*, de
  MCP-tool) verhoogt hem via `dropSourceUpdates`. Een controle legt de tellers vast vóór haar eerste `await`; is een
  teller daarna veranderd, dan publiceert ze voor die bron niets en markeert ze niets als afgehandeld
  (`check-external-open-source.ts` 14 tot en met 17).
- Afgehandeld is de versie die de app echt las, niet de versie die de site bij `versions(id)` noemde. *Later*
  onthoudt de versie en, voor een voorstel uit een geopend document zonder versie, de vingerafdruk van de voorgestelde
  ankers. Beide gelden alleen in deze sessie en per storecontext.
- *Alle externe relaties vernieuwen* is één gebaar en dus één undo-stap. De route leest eerst alle bronnen, zonder te
  muteren, ketent dan de pure `refreshFromSources` over de takenlijst en schrijft één keer, met één `runCPM`. Een
  bulktransactie om de lus heen kan niet: er zit een `await` in, en de onderdrukking van undo-stappen geldt voor de
  hele storecontext, zodat elke bewerking van de planner tijdens het lezen haar eigen undo-stap zou verliezen.
- Een verversing is een gewone bewerking: undo-snapshot, `finishMutation` met `stale` en daarna `runCPM` binnen het
  event. Ze verlaat zo de modus *Datums zoals opgeslagen* op een manier die terug te draaien is; zonder snapshot was
  de modus na een verversing onherstelbaar weg, en zou een undo van een oudere bewerking de modus terugzetten terwijl
  de ankers al ververst zijn.
- Is na het lezen een ander document actief, dan schrijft de route niets.
- De bronnen met pad komen in de keten vóór de bronnen zonder pad. Een bron zonder pad ververst daarna alleen
  koppelingen zonder pad met hetzelfde project-id.
- Een onthouden handvat dat inmiddels een ander project bevat, is niet deze bron: lezen geeft dan `null`.
