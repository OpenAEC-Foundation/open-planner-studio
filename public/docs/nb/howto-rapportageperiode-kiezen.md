# Velge rapportperiode

Mål: bestem hvilket tidsrom en rapport dekker, for eksempel de neste fire ukene eller måneden juni.

## Når du trenger dette

Ukemøtet vil vite hva som skjer de neste fire ukene. Den månedlige rapporten dekker juni. Uten periode får du hele tidsplanen på papir. Fem rapporter bruker derfor en *Rapportperiode:*: *Look-ahead*, *Fremdriftsrapport*, *Ressursbelastning*, *Ressurstilordninger* og *Ressursdiagram*. De andre rapportene har ingen periode.

Perioden er ikke knyttet til en kalendermåned, men til en **referansedag**: statusdatoen for prosjektet ditt (dagen du måler fremdriften på, se [Fremdrift, statusdato og grunnlinje](docs://uitleg-voortgang)), eller i dag hvis prosjektet ikke har en statusdato. *Neste 4 uker* regnes fra den dagen. Hvis du flytter statusdatoen, flytter perioden seg med den.

## Steg

### 1. Angi statusdatoen

Hvis du bruker et relativt valg, for eksempel *Neste 4 uker* eller *Forrige måned*, må du først angi statusdatoen. Velg *Tidsplan › Grunnlinjer og fremdrift* og fyll inn feltet *Statusdato*. Med krysset ved siden av (*Tøm statusdato*) fjerner du datoen igjen. Hvis du bruker en fast periode (steg 4), trenger du ikke dette.

### 2. Velg en rapport med periode

Åpne fanen *Rapport* og velg en av de fem rapportene under *Rapporttype*. Listen *Rapportperiode:* står under *Rapportalternativer*. For Ressursdiagram står den under *Innstillinger*, under de fire avmerkingsboksene for den rapporten.

Hver rapport husker sin egen periode. Dette er startverdiene:

- *Look-ahead*: *Neste måned*.
- *Fremdriftsrapport*: *Forrige måned*.
- *Ressursbelastning*, *Ressurstilordninger* og *Ressursdiagram*: *Hele prosjektet*.

### 3. Velg en periode fra listen

Listen har *Neste uke*, *Neste 2 uker*, *Neste 4 uker*, *Neste 6 uker*, *Neste 8 uker*, *Neste 12 uker*, *Neste måned*, de samme sju med *Forrige*, *Hele prosjektet* og *Egendefinert*. Under listen står *Fra* og *Til* med datoene som valget gir. Du kan bare lese dem her.

Begge dagene telles med. Hvis statusdatoen er torsdag 20. mai, går *Neste uke* fra 20. til 26. mai, begge dager inkludert, og *Neste 4 uker* fra 20. mai til 16. juni, begge dager inkludert (28 dager). *Neste måned* varer til én dag før samme dato i neste måned, her t.o.m. 19. juni. *Forrige 2 uker* går fra 7. til 20. mai, begge dager inkludert.

*Hele prosjektet* tar tidsplanen fra første start til siste slutt.

### 4. Eller velg Egendefinert

Med *Egendefinert* blir *Fra* og *Til* to datofelt. De starter med datoene fra valget du nettopp hadde. Fyll inn begge, for eksempel 1. og 14. juni. Hvis datoene ikke er riktige, viser rapporten fortsatt den sist gyldige perioden. Rapporten viser det i rødt:

- *Sluttdatoen ligger før startdatoen.* hvis *Til* er tidligere enn *Fra*.
- *Fyll inn begge datoene.* hvis en av dem er tom.

### 5. Les perioden i rapporten

For Look-ahead, Ressursbelastning og Ressurstilordninger står perioden under tittelen, for eksempel *Periode: 20-05-2027 – 19-06-2027*. Hvis du velger *Hele prosjektet*, legges *Hele prosjektet* til etter datoene. Fremdriftsrapport viser perioden i oppsummeringen under *Periode*. Ressursdiagram lar tidsaksen dekke perioden nøyaktig.

### Hva perioden gjør per rapport

Perioden fungerer ikke likt i alle rapporter.

- **Look-ahead** tar med de uferdige aktivitetene som berører perioden, også hvis de strekker seg over hele perioden. Forsinkede aktiviteter fra før referansedagen tas også med, så lenge slutten av perioden ikke ligger før referansedagen. En egendefinert periode helt i fortiden er et tilbakeblikk: den viser bare det som pågikk da og ennå ikke var ferdig, uten dagens etterslep.
- **Fremdriftsrapport** bruker perioden for *Fullført i den forrige perioden*. Avsnittet *Starter i den neste perioden* ser fremover fra statusdatoen, til datoen ved *Look-ahead t.o.m* i oppsummeringen. Hvis du velger et valg med *Forrige*, ser rapporten like langt fremover som den ser bakover: med *Forrige 2 uker* og statusdato 20. mai står det *Look-ahead t.o.m* 3. juni. En egendefinert periode eller *Hele prosjektet* som ligger helt i fortiden, speiles ikke.
- **Ressursbelastning** viser hver uke eller måned som berører perioden, i sin helhet. Hvis perioden din går fra onsdag til onsdag, ser du derfor hele uker, så en rad viser alltid samme tall som histogrammet.
- **Ressurstilordninger** viser tilordningene til aktiviteter som berører perioden. Med *Hele prosjektet* filtreres det ikke på dato.
- **Ressursdiagram** viser bare aktivitetene som berører perioden. I oppsummeringen teller *Utenfor perioden:* hvor mange aktiviteter som er utelatt.

## Fallgruver og hva appen gjør

**Det er ingen statusdato.** Appen bruker da dagens dato. For de fire tabellrapportene med periode (*Look-ahead*, *Fremdriftsrapport*, *Ressursbelastning* og *Ressurstilordninger*) står det øverst, ved et relativt valg, *Ingen statusdato angitt — rapporten regner med i dag (29-09-2026).*, med dagens dato på enheten din. *Ressursdiagram* viser ikke dette. Se derfor på *Fra* og *Til*: de ligger da rundt i dag, ikke rundt tidsplanen din.

**Perioden ligger utenfor tidsplanen din.** Da er rapporten tom. *Ressursdiagram* sier det med *Ingen aktiviteter i rapporteringsperioden — velg en annen periode eller Hele prosjektet.* (i listen heter valget *Hele prosjektet*). I de andre rapportene ser du null aktiviteter eller ingen rader.

**Datoene står i ditt eget format.** *Fra* og *Til* følger datoformatet i innstillingene dine, bortsett fra i datofeltene under *Egendefinert*: de viser formatet i nettleseren din.

**Perioden beveger seg med.** Et relativt valg, for eksempel *Neste måned*, bestemmes på nytt hver gang. Hvis statusdatoen endres, eller hvis det ikke finnes en statusdato og det er en dag senere, flytter perioden seg med én gang. Vil du ha en fast periode, velg *Egendefinert*.

**Valget gjelder for alle prosjektene dine.** En egendefinert periode gjelder også for alle prosjektene dine på denne enheten, ikke bare for det åpne prosjektet.

## Se også

- [Lage og skrive ut en rapport](docs://howto-rapport-maken-en-afdrukken): hele veien fra rapporttype til PDF.
- [Fremdrift, statusdato og grunnlinje](docs://uitleg-voortgang): hva statusdatoen er, og hvorfor appen regner med den.
- [Løse overallokering](docs://howto-overbezetting-oplossen): hva du gjør med de overbelastede ukene fra Ressursbelastning.
- [Rapporttyper](docs://ref-rapporttypes): alle rapporttyper og alternativene deres.
