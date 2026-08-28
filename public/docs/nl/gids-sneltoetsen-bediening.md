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
- Met de pijltjestoetsen door zichtbare taken of histogramresources lopen.
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
  toevoegen, kalender toewijzen, voortgang, prioriteit, pad traceren, verwijderen…), plus één
  extra balk-specifiek item bovenaan: **Relatie leggen vanaf hier**.
- **Op een takenrij zonder balk-hit** (bijvoorbeeld een rij zonder zichtbare balk op dat moment) —
  hetzelfde taakmenu, maar zonder het balk-specifieke item.
- **Op een bandkop** (de rij die een gegroepeerde set taken samenvat) — een klein menu met
  in-/uitklappen van die ene groep, plus **Alles uitklappen**/**Alles inklappen**, die alle
  groepsbanden tegelijk openen of sluiten (ook de banden binnen een band).
- **Op leeg canvas** (geen taak, geen bandkop) — **Nieuwe taak**, **Mijlpaal toevoegen**, **Plakken**
  (indien er iets op het klembord staat), **Zoom herstellen** en **Passend maken op project**.

Dit laatste menu is live geverifieerd: rechtsklikken op een lege plek in het Gantt-canvas geeft
precies deze vijf items, in deze volgorde.

## Slepen op een taakbalk

Een taakbalk vastpakken en verslepen verplaatst de taak (of, bij de rand van de balk, verandert de
duur). Zolang je aan een **rand** trekt, verschijnt er een klein donker pilletje tegen die rand met
de duur die de taak op dat moment zou krijgen — bijvoorbeeld `15d`, of `6u` bij een taak in uren.
Het loopt live mee terwijl je sleept, zodat je de nieuwe duur al ziet vóórdat je de muisknop
loslaat. Bij het verplaatsen van de héle balk verschijnt het niet: de duur verandert dan immers
niet. Houd **Shift** ingedrukt terwijl je vanaf een balk sleept, en je start in plaats daarvan het
leggen van een **relatie** naar de taak waar je loslaat — hetzelfde als **Relatie leggen vanaf hier**
in het balk-contextmenu, maar dan met de muis in één beweging.

Klik op een balk om alleen die taak te selecteren. **Ctrl/⌘+klik** op een balk voegt hem juist toe
aan of haalt hem uit de huidige selectie, in plaats van die te vervangen — zo bouw je balk voor balk
een meervoudige selectie op, handig vlak voordat je op de knop **Relatie** klikt met precies twee
taken geselecteerd, of voordat je een hele selectie taken in één keer versleept in de takentabel.

Klik eerst in de **taaklijst** of op een **Gantt-balk**. Daarna kiest **↑** de vorige zichtbare taak
en **↓** de volgende zichtbare taak. De selectie, het eigenschappenpaneel en de balkmarkering
volgen direct mee. Ingeklapte, weggefilterde of buiten de huidige sortering vallende taken worden
niet bezocht: je doorloopt precies de lijst die op dat moment zichtbaar is.

Klik in de **resourcekiezer** links in het histogram om dat oppervlak actief te maken. Daar lopen
**↑** en **↓** door dezelfde lijst: eerst **Alle resources**, daarna iedere projectresource. Zo kun
je de belasting van resources snel vergelijken zonder telkens een naam aan te klikken. Aan het begin
of einde blijft de huidige selectie staan. Pijltjes met Ctrl, Alt, Shift of ⌘ behouden hun bestaande
functie elders in de app.

## Pannen versus box-selectie

Een sleepbeweging die op lege ruimte begint, doet één van twee dingen, en dat hangt af van waar je
begint én van je scroll-modus (**Instellingen → Scrollen & zoomen**):

- **In de takentabel** (de linkerkolom met WBS/naam/duur) is een sleepbeweging op lege ruimte
  **altijd** een box-selectie — pannen gebeurt daar nooit.
- **In het Gantt-canvas zelf**: staat je scroll-modus op **Zoom + slepen** (kaart-stijl pannen, de
  standaard), dan wint pannen — precies zoals je van een kaarttoepassing zou verwachten. Sta je op
  een van de andere scroll-modi (**Positie** of **Toetsen**), dan is diezelfde sleepbeweging op leeg
  canvas een box-selectie, waarmee je meerdere taken tegelijk selecteert door er een rechthoek
  omheen te slepen.

Kortom: de takentabel selecteert altijd; het canvas pant met de línkerknop alleen in de
sleep-scroll-modus en selecteert anders.

Daarnaast is er één gebaar dat overal en altijd werkt: slepen met de **middelste muisknop**
(het scrollwiel) ingedrukt pant het beeld — in élke scroll-modus, en ongeacht of je op een balk,
in de takentabel of op lege ruimte begint. Handig als je op de Positie- of Toetsen-modus staat
maar toch even snel wilt slepen.

## Zoomen

Naast de zoomknoppen op het lint werkt **+**/**=** (of **Ctrl+=**) voor inzoomen en **-** (of
**Ctrl+-**) voor uitzoomen. Een kale **0** herstelt de zoom naar de standaardwaarde; **Ctrl+0** past
de zoom aan zodat het hele project in beeld past ("passend maken op project") — hetzelfde als de
knop met die naam in het lege-canvas-contextmenu hierboven. De tijdlijnheader past zich aan naarmate
je verder inzoomt: weeknummers verschijnen zodra er ruimte voor is, en dagnamen labelen elke kolom
zodra je dicht genoeg op dagniveau zit. Staat **Alleen werkbare dagen tonen** (Instellingen →
Tijdlijn / Zoomen) aan, dan slaan de header én de balken zelf weekenden en feestdagen helemaal over
in plaats van ze alleen grijs te tonen, zodat een taak van 5 werkdagen precies 5 kolommen breed is.

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
