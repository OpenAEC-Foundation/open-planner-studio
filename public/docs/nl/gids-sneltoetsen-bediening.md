# Sneltoetsen & bediening

Deze gids somt geen sneltoetsen op — die lijst leeft al op één plek en zou hier meteen verouderen.
In plaats daarvan leggen we uit **hoe je die lijst altijd actueel opvraagt**, en welke
bedieningsconcepten (contextmenu's, slepen, box-selectie versus pannen, zoomen) belangrijk genoeg
zijn om apart te snappen.

## Wat je hier leert

- Hoe je het altijd-actuele sneltoetsenoverzicht opent.
- Wat elk van de vier contextmenu's in de Gantt-weergave bevat.
- Hoe slepen werkt: een balk verplaatsen versus een relatie leggen.
- Wanneer een sleepbeweging op leeg canvas pant en wanneer hij box-selecteert.
- Zoomen, documenttabs en presentatiemodus.
- Hoe je de rondleiding opnieuw start.

## Het altijd-actuele overzicht

Druk op **Ctrl+/** (of **Cmd+/** op macOS) om het sneltoetsenoverzicht te openen — hetzelfde venster
is ook bereikbaar via de knop **Sneltoetsen** op het lint-tabblad **Beeld**. Dit venster is
alleen-lezen en wordt rechtstreeks opgebouwd uit de broncode van de app: een nieuwe sneltoets
verschijnt hier automatisch, zonder dat iemand een aparte lijst hoeft bij te werken. Dat is ook
precies waarom deze gids de lijst niet dupliceert — een tweede, met de hand bijgehouden lijst zou
vroeg of laat gaan afwijken van wat de app werkelijk doet. Het venster groepeert per categorie:
Bestand, Bewerken, Structuur, Weergave en Navigatie.

## Contextmenu's: vier soorten, per plek waar je rechtsklikt

Rechtsklikken in de Gantt-weergave geeft een ander menu, afhankelijk van waar de muis staat:

- **Op een taakbalk** — het volledige taakmenu (bewerken, invoegen, subtaak/mijlpaal/relatie
  toevoegen, kalender toewijzen, voortgang, prioriteit, pad traceren, verwijderen…), plus twee
  extra balk-specifieke items bovenaan: **Relatie leggen vanaf hier** en **Beperking instellen…**.
- **Op een takenrij zonder balk-hit** (bijvoorbeeld een rij zonder zichtbare balk op dat moment) —
  hetzelfde taakmenu, maar zonder de twee balk-specifieke items.
- **Op een bandkop** (de rij die een gegroepeerde set taken samenvat) — een klein menu met
  in-/uitklappen van die ene groep, plus **Alles uitklappen**/**Alles inklappen** voor de hele boom.
- **Op leeg canvas** (geen taak, geen bandkop) — **Nieuwe taak**, **Mijlpaal toevoegen**, **Plakken**
  (indien er iets op het klembord staat), **Zoom herstellen** en **Passend maken op project**.

Dit laatste menu is live geverifieerd: rechtsklikken op een lege plek in het Gantt-canvas geeft
precies deze vijf items, in deze volgorde.

## Slepen op een taakbalk

Een taakbalk vastpakken en verslepen verplaatst de taak (of, bij de rand van de balk, verandert de
duur). Houd **Shift** ingedrukt terwijl je vanaf een balk sleept, en je start in plaats daarvan het
leggen van een **relatie** naar de taak waar je loslaat — hetzelfde als **Relatie leggen vanaf hier**
in het balk-contextmenu, maar dan met de muis in één beweging.

## Pannen versus box-selectie

Een sleepbeweging die op lege ruimte begint, doet één van twee dingen, en dat hangt af van waar je
begint én van je scroll-modus (**Instellingen → Scrollen & zoomen**):

- **In de takentabel** (de linkerkolom met WBS/naam/duur) is een sleepbeweging op lege ruimte
  **altijd** een box-selectie — pannen gebeurt daar nooit.
- **In het Gantt-canvas zelf**: staat je scroll-modus op **Slepen** (kaart-stijl pannen), dan wint
  pannen — precies zoals je van een kaarttoepassing zou verwachten. Sta je op een van de andere
  scroll-modi (**Positie** of **Muiswiel-toewijzing**), dan is diezelfde sleepbeweging op leeg canvas
  een box-selectie, waarmee je meerdere taken tegelijk selecteert door er een rechthoek omheen te
  slepen.

Kortom: de takentabel selecteert altijd; het canvas pant alleen in de sleep-scroll-modus en
selecteert anders.

## Zoomen

Naast de zoomknoppen op het lint werkt **+**/**=** (of **Ctrl+=**) voor inzoomen en **-** (of
**Ctrl+-**) voor uitzoomen. Een kale **0** herstelt de zoom naar de standaardwaarde; **Ctrl+0** past
de zoom aan zodat het hele project in beeld past ("passend maken op project") — hetzelfde als de
knop met die naam in het lege-canvas-contextmenu hierboven.

## Documenttabs

Heb je meerdere projecten tegelijk open (elk in zijn eigen documenttabblad), dan springt
**Ctrl+1** tot **Ctrl+9** direct naar het eerste tot en met negende documenttabblad.

## Presentatiemodus

**F11** schakelt presentatiemodus aan of uit — een schermvullende weergave zonder lint en zijpanelen,
bedoeld om de planning te tonen zonder de bewerk-chrome eromheen. **Esc** sluit presentatiemodus weer
af (en doet daarna, bij een volgende druk, het gebruikelijke "selectie opheffen").

## De rondleiding opnieuw starten

Wil je de introductie-rondleiding nog eens doorlopen (bijvoorbeeld om iemand anders de app te laten
zien), dan kan dat op twee plekken: de knop **Rondleiding** op het lint-tabblad **Beeld**, of
**Rondleiding starten** in de Backstage-navigatie (het rijtje net boven Instellingen). Beide starten
de rondleiding direct, zonder eerst de welkomstdialoog te tonen.

## Verder lezen

- Open het sneltoetsenoverzicht zelf met **Ctrl+/** — dat is de bindende bron, niet deze gids.
- Scroll- en zoomgedrag stel je in via **Instellingen → Scrollen & zoomen**, op alle drie de vaste
  plekken van de instellingen (tandwiel, lint-tabblad Instellingen, Backstage → Instellingen).
