# Rapporttyper

Alle rapporter på fanen *Rapport*, med alternativene som hører til dem. Du ser hva de gjør, startverdien, hva som endrer seg i rapporten og hvor du finner dem. Hvordan du lager en rapport og lagrer den som PDF, står i [Lage og skrive ut en rapport](docs://howto-rapport-maken-en-afdrukken).

## Hvordan rapportvinduet fungerer

Åpne fanen *Rapport* (eller trykk Ctrl+P). Til venstre er kolonnen *Rapport* med nedtrekkslisten *Rapporttype*, boksen *Oversikt* med tall, boksen *Innstillinger* eller *Rapportalternativer* og nederst knappen *Eksporter PDF*. Til høyre er forhåndsvisningen. Det du ser i forhåndsvisningen, går inn i PDF-filen.

**Rapporttype** — hvilken rapport du ser. Velg mellom elleve rapporter. Standard: *Gantt-utskrift*. Hvor: *Rapport*, øverst i kolonnen *Rapport*.

**Eksporter PDF** — lager PDF-filen. Effekt: resultatet er bare en PDF. Appen sender ingenting til en skriver. Er tidsplanen utdatert, beregner appen først. Gir beregningen en feil, for eksempel på grunn av en løkke i avhengighetene, lager knappen ingen fil og viser feilen. Hvor: *Rapport*, nederst i kolonnen *Rapport*.

**Husket.** Appen husker alle rapportalternativer på denne enheten, for alle prosjektene dine. De hører ikke til prosjektfilen. Bare feltet *Selskap:* i Gantt-utskriften huskes ikke.

**Gjeldende tidsplan.** Rapportene bruker siste beregning. Er tidsplanen endret siden da, viser tabellrapportene øverst *Tidsplanen er endret siden den sist ble beregnet. Trykk Beregn (F5) for oppdaterte verdier*. Er det aldri beregnet noe, står det *Ikke beregnet ennå — trykk Beregn (F5) for datoer og slakk*. Er prosjektet i visningen *Datoer slik de er registrert*, viser rapportene datoene fra kildefilen, og en stripe sier det.

**Forkortelser.** *ad* og *wd* er arbeidsdager. *TF* er totalslakk, *FF* er fri slakk.

## Papir og retning

**Papir:** — papirstørrelsen for PDF-filen. Velg mellom A4, A3, A2 og A1. Standard: A3. Effekt: sidene er ordnet for den størrelsen. Det er ett valg for alle rapporter: det du velger for én rapport, gjelder også for de andre. På stående A4 blir en bred tabell liten, fordi tabellen skaleres til sidebredden. Hvor: *Innstillinger* (Gantt-utskrift og Ressursdiagram) eller *Rapportalternativer* (de sju tabellrapportene). Milepæloversikten og Avvik viser ingen valg.

**Retning:** — liggende eller stående. Velg mellom *Liggende* og *Stående*. Standard: *Liggende*. Effekt: som *Papir:*. Hvor: samme sted som *Papir:*.

## Gantt-utskrift

Tidsplanen som stolpediagram, med en tabell til venstre og en tidslinje til høyre, over flere sider om nødvendig. Forhåndsvisningen viser papiret med sidehodet, tabellen, tidslinjen og forklaringen. Boksen *Oversikt* teller *Aktiviteter:*, *Bladaktiviteter:*, *Kritisk:* og *Avhengigheter:*. Alle alternativer står under *Innstillinger*.

**Selskap:** — selskapet i sidehodet. Standard: selskapet fra prosjektinnstillingene. Effekt: bare sidehodet i rapporten. Det du skriver her, huskes ikke. Endre selskapet i *Innstillinger › Prosjekt › Prosjektinnstillinger*, i feltet *Oppdragsgiver/organisasjon*, og bekreft med *Bruk*.

**Forfatter:** — forfatteren i sidehodet. Kan ikke endres. Appen henter den fra prosjektinnstillingene.

**Skriftstørrelse:** — størrelsen på tekst og tabell i rapporten. Velg mellom 90%, 100%, 110% og 125%. Standard: 100%. Effekt: med større skrift vokser tekst, rader og tabell, og tidslinjen mister bredde. Uavhengig av *Tekststørrelse* i innstillingene.

**Stolpefarger:** — hva fargen på en stolpe avhenger av. Velg mellom *Kritisk linje*, *Per aktivitet — automatisk* og *Etter kategori*, med en nedtrekksliste *Kategorifelt* for *Etter kategori*. Standard: *Kritisk linje*. Effekt: dette er samme valg som *Stolpefarger* på fanen *Visning*. Endrer du det her, endrer Gantt-diagrammet på skjermen seg også. Finnes det valgte feltet ikke i dette prosjektet, står det *Dette feltet finnes ikke i dette prosjektet. Arbeidskategori brukes midlertidig*.

**Statuslinje:** — en linje ved statusdatoen. Velg mellom *Ingen*, *Statusdatolinje* og *Fremdriftslinje*. Standard: *Ingen*. Effekt: *Statusdatolinje* tegner en linje ved statusdatoen. *Fremdriftslinje* tegner zigzaglinjen som buler ut til fremdriften av hver aktivitet. Har prosjektet ingen statusdato, står det *Angi først en statusdato*, og rapporten tegner ingenting.

**Følg visning (filter, gruppering, sortering)** — bare for Gantt-utskriften. Standard: av. Effekt: av legger hele aktivitetstreet på papiret. På tegner akkurat radene på skjermen, med filteret, grupperingen, sorteringen og de lukkede fasene dine.

**Autotilpass på papir** — skalerer tidslinjen til sidebredden. Standard: på. Effekt: på skalerer tidslinjen til bredden på siden. Antall sider følger av høyden. Av bruker en fast skala (*Zoom:*) og fordeler også over bredden, og det gir raskt mange sider.

**Zoom:** — den faste skalaen for tidslinjen. Bare synlig når *Autotilpass på papir* er av. Glidebryter fra 1 til 40. Standard: 22. Effekt: en høyere verdi gjør tidslinjen bredere, så det blir flere sider over bredden.

**Tidslinje over:** — fordeler tidslinjen over flere sidebredder. Velg mellom 1 og 8 sider. Standard: 1 side. Effekt: bare med *Autotilpass på papir*. Ellers er valget avslått, og det står *Bare ved autotilpasning*. Nyttig for en lang tidsplan som du vil skrive ut i lesbar størrelse.

**Gjenta sidehodet på hver side** — Standard: på. Effekt: på legger sidehodet på hver side. Av bare på den første.

**Gjenta bunnteksten på hver side** — Standard: på. Effekt: på legger bunnteksten (prosjektnavn, utskriftsdato og forklaring) på hver side. Av bare på den siste. Et hefte uten forklaring er uleselig, derfor er den på.

**Aktivitetsnavn på stolper** — Standard: på. Effekt: navnet på aktiviteten på stolpen, der det er plass.

**Vis fullføringsgrad** — Standard: på. Effekt: den fullførte delen av stolpen blir grå, som i Gantt-diagrammet, og kolonnen *Fullf.* vises i tabellen. En fullført aktivitet får ingen slakkbånd.

**Kutt av aktivitetsnavn** — Standard: på. Effekt: på kutter navn i tabellen ved bredden på *Navnekolonne:*. Av lar kolonnen vokse med det lengste navnet. Da står det *Navnekolonnen tilpasses det lengste aktivitetsnavnet*.

**Navnekolonne:** — bredden på navnekolonnen. Bare synlig når *Kutt av aktivitetsnavn* er på. Glidebryter fra 60 til 400. Standard: 130.

**Vis overlegg for grunnlinje** — den aktive grunnlinjen ved stolpene. Standard: av. Effekt: en tynn stolpe i grunnlinjefargen under aktivitetsstolpen, bare for aktiviteter som er i grunnlinjen.

**Kritisk linje** — Standard: på. Effekt: styrer bare de røde avhengighetslinjene mellom to kritiske aktiviteter og linjen i forklaringen. Stolpene selv følger *Stolpefarger:*, uavhengig av dette valget.

**Vis slakk** — Standard: på. Effekt: slakken som et bånd bak ikke-kritiske stolper.

**Avhengigheter** — linjene mellom aktivitetene. Standard: på. Effekt: tegner piler mellom stolpene.

**Vis bare arbeidsdager** — komprimerer tidsaksen i denne rapporten. Standard: av. Effekt: helger og helligdager hoppes over, og ukebånd erstatter helgeskyggingen. Uavhengig av samme innstilling for Gantt-diagrammet på skjermen.

**Helger** — Standard: på. Effekt: skygger helger og helligdager i tidslinjen, så lenge skalaen gjør at dagene kan skilles fra hverandre. På den komprimerte aksen (*Vis bare arbeidsdager*) har denne avkrysningsboksen ingen effekt.

**Forklaring** — Standard: på. Effekt: forklaringen i bunnteksten.

**Forhåndsvisningskvalitet** — hvor skarp forhåndsvisningen er. Velg mellom *Standard*, *Høy* og *Maksimal*. Standard: *Høy*. Effekt: bare skarpheten i forhåndsvisningen på skjermen. PDF-filen endres ikke. Hvor: *Rapport*, over forhåndsvisningen.

## Ressursdiagram

Samme stolper som Gantt-utskriften, gruppert per ressurs: hvem gjør hva og når. Boksen *Oversikt* teller *Ressurser:*, *Tilordninger:* og *Uten ressurs:* (med en periode også *Utenfor perioden:*). Diagrammet deler alle alternativer av Gantt-utskriften, unntatt *Følg visning (filter, gruppering, sortering)*, *Kritisk linje* og *Avhengigheter*. Radene kommer ikke fra skjermen, en aktivitet kan stå under flere ressurser, og avhengighetene tegnes ikke der. Avkrysningsboksen *Kritisk linje* er skjult og på. Dette kommer med alternativene for Gantt-utskriften under *Innstillinger*, med disse fire avkrysningsboksene og perioden:

**Hver ressurs på en ny side** — Standard: av. Effekt: hver ressurs starter på en ny side, så du kan dele ut ett ark per mannskap eller ansatt. Av gir ett sammenhengende dokument.

**Ta med aktiviteter uten ressurs** — Standard: av. Effekt: aktivitetene uten ressurs kommer som siste bånd i diagrammet, så du ser hva ingen har tatt ennå.

**Grupper etter ressurstype** — Standard: av. Effekt: et lag på toppen: først et bånd per ressurstype (arbeidskraft, mannskap, underentreprenør, utstyr, materiell), og innenfor det per ressurs.

**Vis tildelingsenheter/dag og kurve** — Standard: på. Effekt: to kolonner etter aktivitetsnavnet, med tildelingsenhetene per dag og fordelingskurven for ressursen i båndet. Er det for lite plass til tidslinjen, utelater rapporten kolonnene og sier *Kolonnene Tildelingsenheter/d og Kurve ble utelatt: …*. Mer plass får du med større papirstørrelse eller liggende retning, mindre skriftstørrelse eller en smalere tabell.

**Rapportperiode:** — bare aktivitetene som berører perioden. Standard: *Hele prosjektet*. Effekt: tidsaksen går nøyaktig over perioden. Er det ingenting i perioden, står det *Ingen aktiviteter i rapporteringsperioden — velg en annen periode eller Hele prosjektet*. Se *Rapportperiode* nedenfor.

## Milepæloversikt

Alle milepæler i prosjektet i en tabell. Den har ingen egne alternativer. Boksen *Oversikt* teller *Milepæler*, *Obligatorisk* og *For sent*. Kolonnene er *WBS*, *Navn*, *Type* (*Automatisk*, *Start* eller *Slutt*), *Dato*, *Begrensning/tidsfrist*, *Slakk*, *Obligatorisk* og *Status*. Statusen er *For sent* hvis begrensningen er brutt, tidsfristen er savnet eller totalslakken er negativ. Ellers er den *Kritisk* hvis milepælen er kritisk etter prosjektets definisjon av kritisk. Ellers er den *Etter tidsplan*. Uten milepæler står det *Ingen milepæler i dette prosjektet*. PDF-filen bruker papiret og retningen du sist valgte for en annen rapport.

## Avvik

Gjeldende tidsplan ved siden av den aktive grunnlinjen, for bladaktiviteter. Den har ingen egne alternativer. Boksen *Oversikt* teller *Aktiviteter*, *Forsinket* og *Tidligere*, og viser *Prosjektslutt: +3 arbeidsdager* (forskjellen i arbeidsdager mellom grunnlinjens slutt og gjeldende slutt). Kolonnene er *WBS*, *Navn*, *Grunnlinje start*, *Grunnlinje slutt*, *Gjeldende start*, *Gjeldende slutt*, *Δ start (ad)*, *Δ slutt (ad)* og *Status*. Statusen følger sluttdatoen: *Forsinket* hvis slutten er senere enn i grunnlinjen, *Tidligere* hvis den er tidligere, ellers *Etter tidsplan*. *Ny* er en aktivitet som ikke er i grunnlinjen. *Fjernet* er en aktivitet som er i grunnlinjen, men ikke lenger i tidsplanen. Uten aktiv grunnlinje står det *Ingen aktiv grunnlinje — lagre en grunnlinje, eller velg en som aktiv*. PDF-filen bruker papiret og retningen du sist valgte for en annen rapport.

## Look-ahead

Hva som kjører eller starter i perioden: lista for det ukentlige møtet. Alternativene står under *Rapportalternativer*.

**Rapportperiode:** — vinduet for rapporten. Standard: *Neste måned*. Effekt: rapporten inneholder de ufullførte aktivitetene som berører perioden, også hvis de spenner over hele perioden. I tillegg kommer forsinkede aktiviteter fra før referansedagen, så lenge slutten av perioden ikke er før referansedagen.

**Nesten kritisk ≤ (ad):** — terskelverdien for *Nesten kritisk*. Tall fra 0 til 60. Standard: 5. Effekt: en aktivitet med mer enn 0 og høyst så mange arbeidsdager totalslakk teller som nesten kritisk. Ved 0 telles bare det som prosjektets beregningsalternativ *Marker nesten kritisk* markerer.

Boksen *Oversikt* teller *Aktiviteter*, *Forsinket*, *Pågår*, *Skulle ha startet*, *Starter*, *Kritisk* og *Nesten kritisk*. Statusen per rad er alltid i forhold til referansedagen: *Forsinket* (ikke fullført, og slutten er før referansedagen), *Skulle ha startet* (ikke startet, mens starten var før referansedagen), *Pågår*, *Starter* (ikke startet ennå, starter i vinduet). Kolonnene er *WBS*, *Navn*, *Start*, *Slutt*, *Rest (ad)*, *Fullf.*, *TF (wd)*, *Kritisk*, *Ressurser* og *Status*.

## Kritisk og nesten kritisk

Aktivitetene som bestemmer prosjektslutten, og de som er nesten kritiske. Alternativet står under *Rapportalternativer*.

**Nesten kritisk ≤ (ad):** — Standard: 5. Tall fra 0 til 60. Betydning og effekt er som ved Look-ahead. Undertittelen viser den valgte terskelverdien.

Rapporten inneholder de ufullførte aktivitetene som er kritiske (etter løseren og prosjektets definisjon av kritisk) eller nesten kritiske. Sorteringen er først etter slakksti, deretter etter totalslakk og til slutt etter start. Boksen *Oversikt* teller *Kritisk*, *Nesten kritisk*, *Kritiske kjeder* og *Bladaktiviteter*. Kolonnene er *WBS*, *Navn*, *Start*, *Slutt*, *Rest (ad)*, *TF (wd)*, *FF (wd)*, *Linje* og *Status*. Kolonnen *Linje* viser slakkstien hvis beregningsalternativet *Flere slakkstier* er på, ellers en strek.

## Fremdriftsrapport

Hvor prosjektet står på statusdatoen. Alternativene står under *Rapportalternativer*.

**Rapportperiode:** — Standard: *Forrige måned*. Effekt: *Fullført i den forrige perioden* teller innenfor perioden. *Starter i den neste perioden* ser fremover fra statusdatoen, til *Look-ahead t.o.m*. Med en *Siste*-periode ser den så langt fremover som perioden ser bakover.

**Nesten kritisk ≤ (ad):** — Standard: 5. Som ved Look-ahead.

Boksen *Oversikt* viser *Statusdato*, *Periode*, *Look-ahead t.o.m*, *Grunnlinje slutt*, *Prognosert slutt*, *Δ slutt (ad)*, *Planlagt* (med *(grunnlinje)* eller *(gjeldende tidsplan)*), *Faktisk* og tallene *Fullført*, *Pågår*, *Ikke startet*, *Forsinket* og *Kritisk*. Planlagt og faktisk er vektet etter varigheten til aktivitetene. Planlagt måler mot grunnlinjen hvis det finnes en aktiv grunnlinje. Ellers måler den mot gjeldende tidsplan. Seksjonene er *Fullført i den forrige perioden*, *Pågår*, *Starter i den neste perioden*, *Forsinket* og *Åpne kritiske aktiviteter*. En aktivitet kan stå i mer enn én seksjon. Hver seksjon har de samme kolonnene: *WBS*, *Navn*, *Grunnlinje slutt*, *Prognosert slutt*, *Fullf.*, *Rest (ad)*, *TF (wd)*, *Kritisk* og *Status*. Statusen per rad er *Fullført*, *Pågår*, *Ikke startet*, *Skulle ha startet* eller *Skulle ha vært ferdig*.

## Tidsplanhelse

En kontroll av tidsplanen selv på feil og uvanlige verdier, med DCMA 14-punktsvurderingen øverst. Alternativer finner du under *Rapportalternativer*.

**Høy slakk > (ad):** — Tall fra 1 til 365. Standard: 44. Effekt: en ufullført aktivitet med mer totalslakk enn dette havner under *Høy slakk*.

**Lang varighet > (ad):** — Tall fra 1 til 365. Standard: 44. Effekt: en ufullført aktivitet, ikke en milepæl, med lengre varighet havner under *Lang varighet*.

**Forsinkelse > (ad):** — Tall fra 0 til 365. Standard: 10. Effekt: en avhengighet med mer forsinkelse havner under *Lang forsinkelse*. En negativ forsinkelse (ledetid) rapporteres alltid.

**Nesten kritisk ≤ (ad):** — Tall fra 0 til 60. Standard: 5. Effekt: bestemmer kontrollen *Nesten kritisk*.

Avsnittet *DCMA 14-punktsvurdering* kommer først. Den følger de fjorten kontrollene fra det amerikanske Defense Contract Management Agency (DCMA), med formlene og normene fra deres *EVMS Program Analysis Pamphlet* (DCMA-EA PAM 200.1, oktober 2012). Per punkt ser du *Antall*, *Av* (det totale antallet som ble telt), *Verdi*, *Norm*, *Resultat* og *Detalj*. Resultatet er *Godkjent*, *Markering* eller *n/a*. For n/a står årsaken i detaljen. En markering er ikke en feil. Pamfletet ser det som en grunn til å se nærmere. Terskelverdiene under *Rapportalternativer* gjelder ikke for dette avsnittet. Det bruker alltid normene fra pamfletet.

Den teller ufullførte bladaktiviteter, uten milepæler og hengekøyer, og avhengighetene inn til slike aktiviteter. Merknaden over rapporten viser begge tallene. De fjorten punktene:

- *Logikk*: aktiviteter uten forgjenger eller etterfølger. Norm: høyst 5%.
- *Ledetider*: avhengigheter med negativ forsinkelse. Norm: ingen.
- *Forsinkelser*: avhengigheter med positiv forsinkelse, uansett hvor kort. Norm: høyst 5%.
- *Avhengighetstyper*: andelen FS-avhengigheter. Norm: minst 90%.
- *Harde begrensninger*: aktiviteter med en obligatorisk begrensning eller en MSO, MFO, SNLT eller FNLT. Norm: høyst 5%.
- *Høy slakk*: aktiviteter med mer enn 44 arbeidsdager i totalslakk. Norm: høyst 5%. Krever en beregning.
- *Negativ slakk*: aktiviteter med totalslakk under 0. Norm: ingen. Krever en beregning.
- *Høy varighet*: aktiviteter som er lengre enn 44 arbeidsdager. Den teller varigheten i grunnlinjen hvis aktiviteten står i den aktive grunnlinjen, ellers den gjeldende varigheten. Norm: høyst 5%.
- *Ugyldige datoer*: en faktisk start eller faktisk slutt etter statusdatoen, eller en prognosert start eller prognosert slutt før statusdatoen. Norm: ingen. Krever en statusdato.
- *Ressurser*: aktiviteter uten ressurs. Norm: ingen. Bare hvis prosjektet bruker ressurser; ellers n/a.
- *Forsinkede aktiviteter*: av de aktivitetene grunnlinjen sier skal være ferdig på eller før statusdatoen, andelen som blir ferdig senere eller prognostiseres senere. Norm: høyst 5%. Krever en statusdato og en aktiv grunnlinje.
- *Test for kritisk linje*: appen forlenger en kritisk aktivitet med 100 arbeidsdager og omberegner på en kopi, uten å endre prosjektet. Testen består hvis den siste aktiviteten i prosjektet da ikke blir ferdig tidligere enn denne aktiviteten. Den tester den kritiske, ufullførte aktiviteten med tidligste start. Detaljen nevner aktiviteten og hvor mange arbeidsdager sluttdatoen flyttet seg. I visningen *Datoer slik de er registrert* er denne testen n/a (*ikke beregnet*): testen beregner, og rapporten viser da datoene fra kildefilen. Trykk på Beregn (F5), så kjører testen igjen.
- *CPLI*: (lengde på kritisk linje + slakk) / lengde på kritisk linje. Lengden telles i arbeidsdager fra statusdatoen til slutten av den siste aktiviteten. Slakken er differansen mot grunnlinjens slutt for den aktiviteten, eller den beregnede slakken hvis aktiviteten ikke står i grunnlinjen. Norm: minst 0,95. Krever en statusdato.
- *BEI* (baseline-utførelsesindeks): antallet aktiviteter som er ferdig på statusdatoen, delt på antallet grunnlinjen sier skal være ferdig da, pluss aktivitetene uten grunnlinje. Norm: minst 0,95. Krever en statusdato og en aktiv grunnlinje.

To punkter avviker fra pamfletet, fordi appen ikke har begrepet. *Høy varighet* teller alle ufullførte aktiviteter. Pamfletet begrenser det til detaljplaneringsperioden (rolling wave). *Ressurser* ser bare på tildelte ressurser, ikke på kostnader. Pamfletet gir ikke noe tall for testen for kritisk linje. De 100 arbeidsdagene er appens eget valg.

Kontrollene står i denne rekkefølgen, med alvorlighetsgraden for hver. Feil: *Negativ slakk*, *Savnet tidsfrist*, *Brutt begrensning* og *Inkonsistent fremdrift* (faktisk start eller faktisk slutt etter statusdatoen, prognosert start eller prognosert slutt før statusdatoen, 100% uten faktisk slutt, faktisk slutt men ikke 100%, fremdrift uten faktisk start). Advarsel: *Uten forgjenger (åpen start)* og *Uten etterfølger (åpen slutt)* (ikke milepæler), *Lang varighet*, *Ledetid (negativ forsinkelse)*, *Hard begrensning* (en obligatorisk begrensning eller en MSO, MFO, SNLT eller FNLT), *Fremdrift utenfor rekkefølge* og *Forsinket aktivitet (mot grunnlinje)*. Informasjon: *Nesten kritisk*, *Høy slakk*, *Lang forsinkelse*, *Annen avhengighet enn FS* og *Uten ressurs* (bare hvis prosjektet bruker ressurser). Rapporten kontrollerer bare bladaktiviteter som ikke er hengekøyer. Blokken *Oversikt* teller *DCMA-flagg*, *Feil*, *Advarsler*, *Til informasjon*, *Bladaktiviteter* og *Avhengigheter*. Under DCMA-avsnittet ligger et avsnitt *Oversikt* (per kontroll alvorlighetsgraden og antallet) og et avsnitt *Funn* (hver aktivitet eller avhengighet). Uten beregning mangler kontrollene som krever slakk.

## Ressursbelastning

Per ressurs, per uke eller måned: hva som kreves mot hva som er tilgjengelig. Alternativer finner du under *Rapportalternativer*.

**Rapportperiode:** — Standard: *Hele prosjektet*. Effekt: hver uke eller måned som berører perioden tas med i sin helhet. Da viser en rad samme tall som histogrammet.

**Samling:** — Velg mellom *Per uke* og *Per måned*. Standard: *Per uke*. Effekt: én rad per kalenderuke (kolonnen *Uke fra*, med mandagen) eller per kalendermåned (kolonnen *Måned*).

**Bare perioder med overallokering** — Standard: av. Effekt: på viser bare ukene eller månedene med minst én dag med overallokering.

Kolonnene er *Ressurs*, *Type*, *Uke fra* eller *Måned*, *Påkrevd*, *Tilgjengelig*, *Avvik* (tilgjengelig minus påkrevd; negativt betyr mangel), *Topp/dag* og *Overallokering*. *Påkrevd* er summen av tildelingsenheter over dagene. Bare uker eller måneder med behov er med. Blokken *Oversikt* teller *Ressurser*, *Uker* eller *Måneder*, *Uker med overallokering* eller *Måneder med overallokering* og *Ressurser med overallokering*.

## Ressurstilordninger

Per ressurs vises aktivitetene den er knyttet til: hva gjør dette mannskapet eller kranen? Alternativer finner du under *Rapportalternativer*.

**Rapportperiode:** — Standard: *Hele prosjektet*. Effekt: med en periode tas bare tilordninger med aktiviteter som berører perioden, pluss forsinket arbeid fra før referansedagen. *Hele prosjektet* filtrerer ikke på dato.

**Ta med fullførte aktiviteter** — Standard: av. Effekt: på tar også med tilordningene for fullførte aktiviteter.

Radene er per ressurs, og innen en ressurs etter start. Blokken *Oversikt* teller *Ressurser*, *Tilordninger* og *Aktiviteter uten ressurs*. Kolonnene er *Ressurs*, *Type*, *WBS*, *Navn*, *Start*, *Slutt*, *Rest (ad)*, *Enh./dag*, *Fullf*, *Kritisk* og *Status*. *Ressurs* og *Type* vises bare på den første raden for en ressurs. Statusen per rad er den samme som i fremdriftsrapporten: *Fullført*, *Pågår*, *Ikke startet*, *Skulle ha startet* eller *Skulle ha vært ferdig*.

## WBS-oppsummering

Tidsplanen summert opp per WBS-element: oversikten for ledelsen. Alternativer finner du under *Rapportalternativer*.

**Nivå:** — opp til hvilket nivå WBS vises. Velg mellom *Hele WBS* og nivå 1 til 8. Standard: nivå 2. Effekt: undertittelen viser *Til og med nivå 2*.

**Vis aktiviteter** — Standard: av. Effekt: på viser også bladaktivitetene selv under hvert element.

Kolonnene omfatter *WBS*, *Navn*, *Start*, *Slutt*, *Grunnlinje start*, *Grunnlinje slutt*, *Varighet (wd)*, *Fullf*, *Δ slutt (ad)*, *Min. TF*, *Akt* (antall aktiviteter), *Krit*, *Pågår* og *Ferdig*. Start og slutt for en hovedaktivitet kommer fra den siste beregningen. Fremdriften er vektet på varighet over bladaktivitetene. *Min. TF* og tellingene gjelder bladaktivitetene under. Blokken *Oversikt* teller *WBS-elementer* og *Aktiviteter*.

## Rapportperiode

Fire tabellrapporter og ressursdiagrammet bruker en *Rapportperiode:*: *Look-ahead*, *Fremdriftsrapport*, *Ressursbelastning*, *Ressurstilordninger* og *Ressursdiagram*. Hver rapport husker sin egen periode. Under rullegardinmenyen står *Fra* og *Til*, med datoene valget gir.

**Referansedag.** En periode med *Neste* eller *Forrige* regnes fra prosjektets statusdato, eller fra i dag hvis det ikke er noen statusdato. Da viser tabellrapportene: *Ingen statusdato angitt — rapporten regner med i dag (…).* Hvis du endrer statusdatoen, flytter perioden seg med. Begge dagene telles med.

**Neste uke, Neste 2 uker, Neste 4 uker, Neste 6 uker, Neste 8 uker, Neste 12 uker** — fra referansedagen, og hver uke er 7 dager. Med statusdato torsdag 20. mai går *Neste uke* fra 20. til og med 26. mai, og *Neste 4 uker* fra 20. mai til og med 16. juni.

**Forrige uke, Forrige 2 uker, Forrige 4 uker, Forrige 6 uker, Forrige 8 uker, Forrige 12 uker** — de samme seks, men teller bakover: 7 dager per uke, til og med referansedagen. Med referansedagen 20. mai går *Forrige 2 uker* fra 7. til og med 20. mai.

**Neste måned, Forrige måned** — en kalendermåned frem eller tilbake, til én dag før samme dato i den andre måneden. *Neste måned* går til og med 19. juni med referansedag 20. mai. *Forrige måned* går fra 21. april til og med 20. mai.

**Hele prosjektet** — fra den første starten til den siste slutten av tidsplanen.

**Egendefinert** — din egen periode. Effekt: *Fra* og *Til* blir to datofelter. De starter med datoene fra valget du nettopp hadde. Sluttdatoen kan ikke være før startdatoen (*Sluttdatoen ligger før startdatoen.*), og begge feltene må fylles inn (*Fyll inn begge datoene.*). Hvis de angitte verdiene ikke er riktige, blir rapporten stående på den siste gyldige perioden.

## Se også

- [Lage og skrive ut en rapport](docs://howto-rapport-maken-en-afdrukken): hele veien fra rapporttype til PDF.
- [Velge rapportperiode](docs://howto-rapportageperiode-kiezen): trinnene og eksemplene.
- [Kritisk linje og slakk](docs://uitleg-kritiek-pad): hva kritisk og nesten kritisk betyr.
- [Fremdrift, statusdato og grunnlinje](docs://uitleg-voortgang): statusdatoen og grunnlinjen som rapportene bruker.
- [Løse overallokering](docs://howto-overbezetting-oplossen): hva du gjør med ukene med overallokering fra Ressursbelastning.
- [Import- og eksportformater](docs://ref-import-exportformaten): PDF ved siden av de andre formatene.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): to grunnlinjer med fremdrift og en statusdato, for å se på avviksrapporten.
