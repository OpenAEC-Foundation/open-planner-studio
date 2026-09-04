# Resourcebibliotheken

Werk je aan meerdere projecten met dezelfde ploegen, dezelfde onderaannemers en dezelfde kalenders, dan wil je hun tarief, kalender en type maar op één plek onderhouden — niet in elk project opnieuw uittypen en bij een wijziging overal los bijwerken. Daarvoor bestaat de resourcebibliotheek: een gedeelde bron van resources en kalenders die bij je organisatie hoort, buiten de projecten leeft, en waar meerdere projecten uit putten. Deze gids legt uit hoe die bibliotheek zich verhoudt tot een project, wat er precies meereist en wat per project blijft, en hoe je tussen beide schakelt.

## Wat je hier leert

- Het onderscheid tussen de bibliotheek (gedeeld, bedrijfsbreed) en het project (wat dít project inzet).
- Een project koppelen aan een bibliotheek, of bewust loskoppelen.
- De twee weergaven op het Resources-tabblad: **Bibliotheek** en **Project**.
- De drie soorten rijen die je in de projectweergave tegenkomt: uit de bibliotheek, projecteigen, en een wees.
- Precies wat een bibliotheekresource meeneemt naar het project, en wat je vrij per project instelt.
- De drie acties die bibliotheek en project met elkaar verbinden.
- Hoe de app kopieën bijwerkt, en wat je te kiezen krijgt als een kopie afwijkt.
- Delen, back-up en de beperkingen daarvan.

Volg mee met [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) en [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc): beide showcases delen bij het openen automatisch één demo-resourcebibliotheek, en de ploegen **Timmerlieden**, **Installateurs**, **Stukadoors** en **Schilders** komen in allebei letterlijk onder dezelfde naam terug — het directe bewijs dat één bibliotheek meerdere projecten voedt.

## Bibliotheek en project: twee werelden

De **resourcebibliotheek** is de gedeelde bron: ze hoort bij je organisatie, niet bij één project, en overleeft elk individueel project. Het **project** bepaalt wat je daarvan dít project daadwerkelijk inzet — met eigen capaciteit, beschikbaarheid en kalenderkeuze. Een project hangt aan precies één bibliotheek, of staat helemaal los: in dat laatste geval werkt alles gewoon zoals je gewend bent, alleen zonder gedeelde bron om uit te putten of naar terug te schrijven.

## Een project aan een bibliotheek koppelen

Je kiest de bibliotheek op twee plekken, die hetzelfde paneel tonen:

- De **projectwizard** ("Nieuw project"), met een bibliotheekselector.
- **Projectinfo** van een bestaand project — zowel de dialoog als **Bestand → Projectinfo**.

In diezelfde selector kies je ook **+ Nieuwe resourcebibliotheek…** om er ter plekke één aan te maken, zonder eerst naar Bestand → Bibliotheek te hoeven. **Geen bibliotheek** is een expliciete keuze in dezelfde lijst — je project ontkoppelen is dus nooit een toevallig neveneffect, maar iets wat je bewust kiest.

## Het Resources-tabblad: twee weergaven

Zodra een project aan een bibliotheek gekoppeld is, krijgt het Resources-tabblad rechtsboven een schuifknop met twee weergaven:

- **Bibliotheek** — de bron zelf beheren. Alles hier is rechtstreeks bewerkbaar, een wijziging geldt meteen voor **alle** projecten die uit deze bibliotheek putten, en valt buiten ongedaan maken (Ctrl+Z) — het is geen projectbewerking.
- **Project** — wat dít project daadwerkelijk gebruikt: de gewone projecttabel, met markeringen per rij voor herkomst en eventuele afwijkingen.

Werk je met meerdere geopende projecten die allemaal uit dezelfde bibliotheek putten, dan is er nog een derde weergave: **Bezetting**. Die toont per bibliotheekresource waar hij over álle geopende documenten heen geboekt staat, en markeert de dagen waarop de som van die boekingen boven de bedrijfscapaciteit uitkomt — dubbelbezetting tussen projecten, die geen enkel project in z'n eentje kan zien. Lees de gids [Bezettingsoverzicht](docs://gids-bezettingsoverzicht).

## Drie soorten rijen in de projectweergave

In de projectweergave kom je drie soorten rijen tegen:

1. **Uit de bibliotheek** — herkenbaar aan de markering **Uit de bibliotheek**. Naam, type, tarief/uur en eenheid zijn geërfd van de bibliotheek en worden hier als platte tekst getoond: die bewerk je niet hier, maar in de weergave **Bibliotheek**. Max. eenheden, de tijdgefaseerde beschikbaarheid en de kalenderkeuze zijn wél gewoon bewerkbaar — dat is immers de inzet op dít project.
2. **Projecteigen** — geen markering, volledig bewerkbaar. Ook een gekoppeld project kan zulke rijen hebben: handig voor eenmalige zaken die niet in de gedeelde bibliotheek horen, zoals een gehuurde kraan of een onderaannemer voor dit ene werk.
3. **Wees** — het bibliotheekorigineel is verdwenen; de rij is gemarkeerd als **niet meer in de bibliotheek**. De kopie zelf blijft gewoon bruikbaar; je kunt hem loskoppelen of verwijderen.

Elke rij begint met een klein kleurvak: de **resourcekleur**. Nieuwe resources krijgen automatisch
een vrije kleur uit een vast palet, en je kunt de kleur hier altijd zelf kiezen. De kleur is puur
presentatie — ze kleurt de balken in de rapportexport (**Rapport → Balkkleuren → Op categorie →
Resource**) en
op het scherm, maar telt niet als afwijking tussen bibliotheek en project. Op het scherm heb je twee
gradaties: **Beeld → Balkkleuren → Op categorie → Resource** kleurt de hele balk (bij meerdere
partijen gesegmenteerd naar verhouding van hun inzet, met het kritieke pad als rode rand), en de
aparte toggle **Resource-accent** (Beeld → Baselines & voortgang) zet een dun streepje in de
resourcekleur onder de balk. Dat accent staat los van de gekozen balkkleuring en kan dus ook samen
met Taaktype, Discipline of de automatische taakkleuren aanstaan.

## Wat volgt de bibliotheek mee — en wat niet

Dit is de kern om te onthouden: sommige velden zijn een bedrijfsafspraak en volgen de bibliotheek, andere zijn projectinzet en stel je vrij in, zonder dat het als afwijking geldt.

**Volgt de bibliotheek mee:**
- Naam
- Type
- Beschrijving
- Tarief/uur
- Eenheid
- De **inhoud** van een meegereisde kalender (werkdagen, uren, vrije dagen)

**Bepaal je per project, zonder dat het als afwijking telt:**
- Max. eenheden
- De tijdgefaseerde beschikbaarheid
- De **keuze** wélke kalender aan de resource hangt

Wijs je een bibliotheekresource toe, dan reist zijn kalender mee als een gekoppelde kopie die zelf ook de bibliotheek blijft volgen — vandaar dat de *inhoud* van die kalender in de linkerlijst hierboven staat. Maar de *keuze* wélke kalender aan een resource hangt, staat in de rechterlijst: dezelfde ploeg kan op een spoedklus zomaar een andere kalender draaien dan normaal, zonder dat dat een afwijking van de bibliotheek is. Dit onderscheid is subtiel maar belangrijk: verander je bij een bibliotheekresource de tarief of naam, dan wijkt de kopie af van de bibliotheek; verander je de kalenderkeuze of de max. eenheden, dan doe je precies waar dat veld voor bedoeld is.

## Drie acties die de werelden verbinden

- **Toewijzen aan project** — van bibliotheek naar project: maakt een bewerkbare kopie met herkomst.
- **Naar de bibliotheek** — van een projecteigen rij naar de gedeelde bibliotheek: koppelt meteen. Bestaat er al een item met dezelfde naam in de bibliotheek, dan koppelt de app daaraan in plaats van te dupliceren.
- **Losmaken van de bibliotheek** — de herkomst verdwijnt, alles wordt weer volledig bewerkbaar. Een meegereisde kalender gaat mee los, tenzij een andere nog-gekoppelde resource diezelfde kalender ook gebruikt.

## Bijwerken en afwijkingen

De app controleert op vier vaste momenten of jouw kopieën nog bij de bibliotheek passen: bij het **openen** van een bestand, bij het **wisselen** van document, na een **bewerking in de bibliotheek**, en na **crash-herstel**.

- Loopt een kopie alleen achter (jij hebt hem niet zelf aangepast, de bibliotheek intussen wel), dan wordt hij **stil bijgewerkt** — je ziet alleen een korte melding, geen vraag.
- Is een kopie lokaal (of door iemand anders) aangepast, dan verschijnt de markering **wijkt af — beslis**, en vraagt de app per item wat er moet gebeuren: **Bibliotheekwaarden gebruiken**, **Bestandswaarden overnemen in de bibliotheek**, of **Later beslissen**.

Deze keuzes zijn niet met Ctrl+Z terug te draaien — de tweede optie wijzigt namelijk de bibliotheek zelf, en die valt buiten de projecthistorie.

## Delen en back-up

Een projectbestand is altijd zelfstandig compleet: geef je het aan iemand zonder jouw bibliotheek, dan werkt alles gewoon, alleen zonder gedeelde bron. Een bibliotheek exporteer en importeer je via **Bestand → Bibliotheek** — dat is tevens je back-up.

Bij het importeren kies je zelf uit twee opties:

- **Toevoegen als nieuwe resourcebibliotheek** — de bibliotheek uit het bestand komt er gewoon bij, als extra bibliotheek naast je bestaande, en overschrijft nooit iets van jou. Had de afzender zelf al eens een tweede, eigen bibliotheek aangemaakt (bijvoorbeeld voor een aparte onderaannemer), dan heeft die bibliotheek een eigen identiteit die met haar meereist: een meegestuurd project herkent de crews en kalenders die het al gebruikte dan meteen weer als bibliotheekitems, zonder dat jij iets hoeft na te lopen. Had de afzender maar één, nooit-gesplitste bibliotheek — de meest voorkomende situatie — dan werkt die herkenning niet vanzelf: je koppelt het meegestuurde project in dat geval zelf even aan de nieuwe bibliotheek, waarna de herkenning op naam het verdere werk doet. Bestaat dezelfde bibliotheek al bij jou, dan komt er gewoon een aparte kopie naast te staan.
- **Een bestaande resourcebibliotheek vervangen** — de volledige inhoud van de bibliotheek die je kiest wordt overschreven door wat er in het bestand staat. Is jouw eigen versie nieuwer dan wat je importeert, dan waarschuwt de app daarvoor vooraf.

Welke optie al aangevinkt staat, hangt af van het bestand: herkent de app de bibliotheek nog niet, dan staat "toevoegen" aan; herkent de app 'm wel (dezelfde bibliotheek, een andere versie), dan staat "vervangen" aan met die bibliotheek al gekozen.

Bibliotheken synchroniseren niet vanzelf tussen machines: werken twee planners met dezelfde bibliotheek op verschillende computers, dan kunnen die uit elkaar gaan lopen.

## Demo-resourcebibliotheek in de voorbeelden

Open je een van de showcase-voorbeelden (**Bestand → Voorbeelden** of via deze Help), dan maakt de app eenmalig een **Demo-resourcebibliotheek** aan en koppelt het geopende voorbeeld eraan. [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) en [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) delen dezelfde ploegen uit die bibliotheek, zodat je meteen ziet hoe één bibliotheek meerdere projecten voedt. Je eigen, bestaande resourcebibliotheken blijven daarbij volledig ongemoeid.

## Verder lezen

- Resources toewijzen, het histogram lezen en nivelleren — dat draait allemaal om de projectkant van resources: lees de gids [Resources, histogram & nivellering](docs://gids-resources-histogram).
- Een meegereisde kalender werkt met dezelfde bouwstenen als elke andere kalender — lees de gids [Kalenders & uren-planning](docs://gids-kalenders-uren).
- Zie het delen van ploegen tussen projecten zelf terug in [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) en [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
