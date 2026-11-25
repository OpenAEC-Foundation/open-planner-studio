# P6 XML schrijven: wat niet meegaat

Voor een gegeven zonder bekende plek in P6 XML schrijft `writeP6XMLWithReport` niets, en gokt hij niet op een veldnaam
van P6. De planner hoort wat er niet meeging uit de exportmelding na `exportAs('p6')` (`exportP6XmlLossNotice` in
`p6XmlExportNotice.ts`, met een regel per soort; `check-p6xml-export-loss.ts` toetst dat elke verliescategorie van de
detector `detectXerExportLoss` een regel geeft). Onderbrekingen, ingekorte namen en ongeldige tekens hebben een eigen melding in `exportAs`. De writer zet voor
een deel ervan daarnaast een regel in de console; wat alleen daar staat, noemt knownbug 480.

## Gevolgen

- Een kostenresource en haar toewijzingen gaan niet mee (issue #815); de XER-writer laat ze ook weg. De melding telt
  ze (`costResources`). Dat P6 geen kostenresource kent, komt uit het weggehaalde commentaar en is niet nagegaan.
- De XER-identiteit van een taak (`p6ProjectId`, `p6TaskId`) schrijft de writer niet; na inlezen draagt de taak de
  herkomst van het XML-bestand zelf (`check-xer-p6xml-parity.ts`, assertie 2). Volgens het weggehaalde commentaar bewaart een XER-import
  zijn P6-velden en exacte bron alleen via IFC; het bronarchief staat in ADR 0048.
- Relaties met een ander project (`externalLinks`), notities, een nivelleervertraging, een stop- of hervatdatum en een
  baseline schrijft de writer niet.
- Een handmatig geplande taak gaat als gewone taak met haar rekendatums. Een taak in kalendertijd gaat voor P6 als
  werktijd; OPS leest de kalendertijd terug uit het maatrecord (ADR 0363).
- Een onderbroken taak zonder contour gaat zonder haar onderbrekingen. Een taak met een contour gaat wel met haar
  verdeling, als spreiding per toewijzing (ADR 0365).
- Van een samenvattingstaak schrijft de writer alleen het WBS-element: geen beschrijving en geen constraint. Wat hij met
  haar relaties en toewijzingen doet: knownbug 2339 en 2340.
- De naam van een feestdag of werkende uitzondering gaat verloren: de writer schrijft per datum alleen `<Date>` en
  blokken (ADR 0362). Dat P6 daar geen naam en geen einddatum kent, komt uit het weggehaalde commentaar en is niet
  nagegaan.
