# P6 XML schrijven: wat niet meegaat

Voor een gegeven zonder bekende plek in P6 XML schrijft `writeP6XMLWithReport` niets, en gokt hij niet op een veldnaam
van P6. Na `exportAs('p6')` noemt de exportmelding (`exportP6XmlLossNotice` in `p6XmlExportNotice.ts`) de verliezen die
zij telt, met een regel per soort, en de broninformatie, codes en eigen velden waarvoor de detector
`detectXerExportLoss` een categorie geeft. Een verlies dat zij niet telt, zoals de kalender van een samenvattingstaak
(knownbug 2342), meldt zij niet. `check-p6xml-export-loss.ts` vergelijkt de regels voor een reeks invoeren; voor
notities en de definities van codes en eigen velden toetst zij dat detector en melding overeenkomen, voor de
broninformatie geeft zij twee categorienamen rechtstreeks aan de melding en verwacht zij één regel, en met het
P6-profiel verwacht zij voor `schedule-options-and-provenance` geen regel. Onderbrekingen, ingekorte namen en
ongeldige tekens hebben een eigen melding in `exportAs`. De writer zet bij een deel van de weglatingen daarnaast een
regel in de console; voor elke soort daarvan heeft de melding een regel, of bij onderbrekingen de eigen melding, ook
voor de nivelleervertraging (`levelingDelays`) en de kalendertijd (`elapsedDurations`).

## Gevolgen

- Een kostenresource en haar toewijzingen gaan niet mee (issue #815); de XER-writer laat ze ook weg. De melding telt
  ze (`costResources`). Dat P6 geen kostenresource kent, komt uit het weggehaalde commentaar en is niet nagegaan.
- De writer geeft taken en project nieuwe `ObjectId`'s (ADR 0360) en schrijft `p6TaskId` en `p6ProjectId` uit de bron
  niet; na inlezen draagt een activiteit de identiteit van het XML-bestand zelf (`check-xer-p6xml-parity.ts`, assertie
  2). Een WBS-rij krijgt van de lezer geen `p6TaskId` of `p6ProjectId`. Het
  exacte XER-bronarchief gaat alleen in het IFC mee (ADR 0048).
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
