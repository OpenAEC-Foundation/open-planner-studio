# Bezettingsoverzicht

Plan je meerdere projecten die uit dezelfde resourcebibliotheek putten, dan wil je zien waar elke ploeg over al die projecten heen geboekt staat — en vooral wáár de som van die boekingen boven de capaciteit van het bedrijf uitkomt. Daarvoor is het bezettingsoverzicht: de derde weergave op het Resources-tabblad, naast **Bibliotheek** en **Project**. Het is een leesvenster — je ziet er alles, je wijzigt er niets.

## Wat je hier leert

- Het overzicht openen en de tabel lezen: één rij per geboekt bibliotheekitem, uitklapbaar per document.
- Het histogram per geselecteerd bibliotheekitem lezen.
- Wanneer een resource als dubbel geboekt telt.
- Wat de ⚠-markering betekent en hoe je die oplost.
- De belangrijkste beperking: het overzicht ziet alleen wat in dit programma geopend is.
- Waarom een gedupliceerd document volwaardig meetelt.

## Het overzicht openen

Open de projecten die je wilt overzien, elk in een eigen tabblad, en ga naar het Resources-tabblad. Rechtsboven staat de schakelaar met de weergaven; kies **Bezetting**. De knop bestaat alleen wanneer het actieve project aan een bibliotheek gekoppeld is — een los project heeft geen bibliotheekcontext en dus geen bezettingsoverzicht. Het overzicht toont vervolgens uitsluitend de geopende documenten die aan diezélfde bibliotheek gekoppeld zijn; documenten aan een andere (of geen) bibliotheek dragen niets bij.

Wil je het meteen zien werken: open [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) en [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) naast elkaar — beide putten uit dezelfde demo-resourcebibliotheek, dus hun ploegen verschijnen samen in één overzicht.

## De tabel lezen

Elke hoofdrij is één bibliotheekitem dat ergens geboekt staat: de naam, in hoeveel documenten het voorkomt, de totale periode van de boekingen, en de piekbelasting afgezet tegen de bedrijfscapaciteit (bijvoorbeeld "3,0 / 2,0"). Staat het item ergens dubbel geboekt, dan draagt de rij een rode markering met het aantal conflictdagen en de eerste conflictdatums; rijen met conflicten staan bovenaan.

Klap een rij uit en je ziet één subregel per document: de documenttitel, de periode waarin de resource daar geboekt staat, en de piek binnen dat document. Zo zie je direct wélke projecten de resource claimen en wie de overlap veroorzaakt.

Bibliotheekitems zonder boeking in de geopende documenten krijgen géén rij: het overzicht toont inzet, geen catalogus — de catalogus staat in de weergave **Bibliotheek**. Projecteigen resources (zonder herkomst uit de bibliotheek) tellen evenmin mee; hun bezetting is een binnen-project-vraag en die beantwoordt het gewone histogram al.

## Het histogram per resource

Selecteer een hoofdrij en onder de tabel verschijnt een histogram voor dat bibliotheekitem: per dag de gestapelde bijdrage van elk document (elk document zijn eigen kleur, met de documenttitels als legenda), met daaroverheen de capaciteitslijn van het bibliotheekitem — knikken in de tijdgefaseerde beschikbaarheid zie je er gewoon in terug. Dagen waarop de stapel boven de lijn uitkomt zijn rood gemarkeerd: dezelfde conflictdefinitie als in de tabel, geen tweede berekening. Liggen boekingen ver uit elkaar in de tijd, dan wordt een lang leeg gat in de tijdas ingekort weergegeven met een breukteken, zodat de grafiek leesbaar blijft. Alleen meegetelde documenten voeden het histogram; een rij met uitsluitend niet-doorgerekende boekingen toont in plaats van een grafiek de ⚠-uitleg (zie hieronder).

## Wanneer telt een resource als dubbel geboekt?

Per dag telt de app de belasting van alle meetellende geopende documenten bij elkaar op en vergelijkt die som met de capaciteit van het bibliotheekitem zelf — de max. eenheden zoals die in de bibliotheek staan, inclusief de tijdgefaseerde beschikbaarheid daar. Is de som *strikt groter* dan die capaciteit, dan is de dag dubbel geboekt. Een som die precies gelijk is aan de capaciteit is dus géén conflict.

Let op: de capaciteit komt uit de bibliotheek, niet uit de projecten. Twee projecten die elk keurig binnen hun eigen max. eenheden blijven, kunnen samen alsnog dubbel geboekt zijn — het bedrijf heeft simpelweg minder krachten dan beide projecten samen claimen. En ook één document dat in z'n eentje boven de bedrijfscapaciteit boekt, verschijnt hier als conflict; de uitklap laat dan meteen zien dat er maar één veroorzaker is.

## De ⚠-markering: alvast doorgerekend, of toch niet meegeteld?

Plannen rekent niet vanzelf door: je drukt F5 (of de knop **Berekenen**) in een document zelf. Wijzig je iets sinds de laatste berekening, dan blijft dát document zijn oude datums tonen tot je daar F5 drukt — maar het bezettingsoverzicht wacht daar niet op. Voor zo'n gewijzigd document rekent het overzicht zelf, achter de schermen, alvast met de actuele taken en relaties door, en de boeking telt gewoon mee met de verse cijfers. De ⚠ bij zo'n boeking is dan informatief: "alvast doorgerekend voor dit overzicht — het document zelf toont oudere datums tot je daar F5 drukt". Boven de tabel staat in dat geval een even informatieve banner. Heb je de instelling **Automatisch berekenen** aanstaan, dan worden gewijzigde documenten bij het openen van het overzicht meteen écht bijgewerkt — je hoeft dan nergens meer F5 te drukken en je ziet dus ook geen markering.

Eén uitzondering: het document dat je op dat moment zelf aan het bewerken bent — het actieve tabblad — wordt hier bewust *niet* alvast doorgerekend, want dan zou het overzicht bij elke toetsaanslag de hele planning opnieuw uitrekenen. Dat document telt mee met zijn laatst berekende cijfers, precies dezelfde als die je er in de balkenplanning naast ziet staan; heb je er sinds de laatste berekening iets in gewijzigd, dan zegt de markering "verouderd: dit zijn de laatst berekende cijfers — druk F5 in dit document". Met **Automatisch berekenen** aan lopen die cijfers hooguit een fractie van een seconde achter.

Alleen wanneer die alvast-berekening zelf niet lukt — bijvoorbeeld door een cyclus in de relaties, of een andere rekenfout — telt het document écht niet mee in de sommen, pieken en conflictdagen. Zo'n boeking blijft zichtbaar maar toont "—" in plaats van cijfers, met een ⚠ die wél om actie vraagt: activeer dat document (klik zijn tabblad), los de fout daar op, druk **F5**, en schakel terug naar het bezettingsoverzicht. Boven de tabel staat dan de waarschuwing dat er documenten buiten de telling vallen.

Kortom: de ⚠ zelf is meestal onschuldig — het overzicht heeft het document dan al zelf doorgerekend. Pas een "—" in plaats van cijfers betekent dat er in dat document iets moet worden opgelost.

## Alleen dit programma

Het bezettingsoverzicht ziet uitsluitend de documenten die in dít programma geopend zijn. Een ander venster of een andere toepassing op dezelfde computer telt niet mee — en al helemaal niet een collega die op een andere machine plant. Er is geen gedeelde opslag tussen programma-instanties: boekingen die elders geopend staan, bestaan hier lokaal niet en tellen dus niet mee — ook niet als jullie dezelfde bibliotheek delen via export en import. Onder de tabel staat deze grens als permanente voetnoot, zodat je er nooit omheen kunt lezen.

Ook bestanden die ergens op schijf staan maar niet geopend zijn, tellen niet mee: het overzicht gaat over *open* documenten, niet over alles op schijf. Hoe het delen van bibliotheken tussen machines wél werkt — en welke beperkingen daarbij horen — lees je in de gids [Resourcebibliotheken](docs://gids-resourcebibliotheken).

## Duplicaten tellen volwaardig mee

Dupliceer je een document, bijvoorbeeld om een variant te verkennen, dan is dat duplicaat een volwaardig geopend document en tellen zijn boekingen gewoon mee. Origineel plus variant samen kunnen zo een dubbelbezetting tonen die er in werkelijkheid maar één keer is. Het overzicht filtert daar bewust niet stil op: wie varianten vergelijkt, sluit ze even of leest eromheen.

## Verder lezen

- Hoe bibliotheek en project zich tot elkaar verhouden — koppelen, herkomst, afwijkingen: de gids [Resourcebibliotheken](docs://gids-resourcebibliotheken).
- Bezetting bínnen één project — het histogram en nivellering: de gids [Resources, histogram & nivellering](docs://gids-resources-histogram).
