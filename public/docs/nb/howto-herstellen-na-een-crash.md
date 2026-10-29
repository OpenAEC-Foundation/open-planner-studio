# Gjenopprette etter et brudd

Mål: få tilbake arbeidet ditt etter at appen eller nettleseren stoppet uventet, og du ikke hadde lagret.

## Når du trenger dette

Laptopen døde, appen frøs eller nettleserfanen krasjet, og du hadde ennå ikke lagret de siste endringene. Så snart det er en endring et sted, lagrer appen gjenopprettingskopier av alle åpne prosjekter i bakgrunnen, høyst én gang hvert tiende sekund. Kopien er atskilt fra prosjektfilen din. Hva forskjellen er mellom lagring og Automatisk lagring, leser du i [Filer og formater](docs://uitleg-bestanden).

## Steg

1. Start appen igjen. I nettleseren laster du samme fane på nytt: gjenopprettingskopien tilhører den ene fanen.
2. Hvis appen fant kopier, vises vinduet *Gjenopprett ulagret arbeid*. *Open Planner Studio ble ikke avsluttet normalt. Følgende dokumenter hadde ulagrede endringer som kan gjenopprettes:* For hvert prosjekt vises navnet, stien til filen hvis prosjektet har en fil (i nettleseren bare filnavnet), antall aktiviteter og tidspunktet for kopien, for eksempel *21 aktiviteter* og *Lagret: Sep 29, 2026 9:41 AM*. Tidspunktet følger innstillingen din for *Tidsformat*. Vinduet kan også vise prosjekter som du ikke har endret.
3. Velg *Gjenopprett*. Enter gjør det samme. Appen åpner alle prosjektene i listen, hver i en fane, med tilstanden fra den siste kopien.
4. Kontroller prosjektene dine og lagre dem med en gang med Ctrl+S.

Hvis du ikke vil gjenopprette, har du to valg. *Ikke gjenopprett* sletter kopiene, og det kan du ikke angre. Lukker du vinduet med Escape, med krysset eller ved å klikke ved siden av, blir kopiene liggende, og appen spør igjen ved neste start.

Spørsmålstegnet øverst til høyre i vinduet åpner denne artikkelen uten at du må velge noe. Mens du leser i Hjelp, venter vinduet. Når du går tilbake, er det der igjen, og du kan fortsatt gjenopprette.

## Fallgruver og hva appen gjør da

**Du får tilstanden fra den siste kopien.** Det du gjorde de siste sekundene før bruddet, kan mangle. Et prosjekt som hadde endringer, er merket *Ikke lagret* igjen. Historikken for *Angre* er tom: du kan ikke angre steg fra før bruddet. Zoom, rulleposisjon og markering bygges opp på nytt.

**På skrivebordet beholder et gjenopprettet prosjekt filen sin, i nettleseren gjør det ikke.** På skrivebordet skriver *Lagre* til den opprinnelige filen, med den gjenopprettede tilstanden. I nettleseren er et gjenopprettet prosjekt ikke lenger koblet til filen sin: *Lagre* spør hvor filen skal lagres. Bryteren for *Automatisk lagring* er også grå da, til du har lagret prosjektet én gang.

**Et prosjekt i visningen *Datoer slik de ble registrert* blir i den visningen.** Se [Datoer slik de ble registrert](docs://uitleg-datums-zoals-opgeslagen).

**På skrivebordet vises vinduet ikke ved hver start.** Gjenopprettingskopiene ligger i appens datamappe, som IFC-filer med et navn som begynner med *recovery*. Lukker du appen på vanlig måte, rydder den bort sine egne kopier. Vinduet vises derfor etter en uventet avslutning, etter en omstart for en oppdatering av appen, eller hvis du utsatte gjenopprettingen ved en tidligere start.

**I nettleseren lagres kopien per fane.** Kopien ligger i nettleserens lagring. En ny fane eller et nytt vindu viser ikke kopiene fra en annen fane. Kopier av faner som ikke finnes lenger, slettes etter sju dager, så snart appen skriver kopier igjen.

**I nettleseren vises vinduet også etter at du har lastet siden på nytt på vanlig måte.** Det skjer også når du hadde lagret alt. Hvis du lagret rett før du lastet siden på nytt, og ikke endret noe etter det, kan du trygt velge *Ikke gjenopprett*: filen din er oppdatert.

**Vinduet vises ikke.** Da fant appen ingen kopi. Det skjer hvis du ikke har endret noe ennå, hvis du bruker en ny fane i nettleseren, hvis du tidligere forkastet gjenopprettingen med *Ikke gjenopprett*, eller hvis bruddet kom før appen lagret den første kopien: det kan ta opptil omtrent ti sekunder etter din første endring.

**En kopi er skadet.** Appen melder *Den gjenopprettede filen kunne ikke leses*, med årsaken, og tilbyr de andre prosjektene. Velger du *Gjenopprett*, sletter appen etterpå alle kopiene, også den som ikke kan leses. Er ingen kopi lesbar i det hele tatt, vises ikke vinduet, og kopiene blir liggende.

**Gjenoppretting mislykkes.** Appen melder *Gjenoppretting mislyktes* med årsaken. Kopiene blir liggende, og spørsmålet kommer tilbake ved neste start.

**Noen av prosjektene kan ikke lastes.** Appen melder: *2 gjenopprettingsfiler kunne ikke lastes og er hoppet over.* For én fil står det *1 gjenopprettingsfil kunne ikke lastes og er hoppet over.* De andre prosjektene gjenopprettes. Fordi noe er hoppet over, blir alle kopiene liggende, og vinduet kommer tilbake ved neste start med samme liste. Velg da *Ikke gjenopprett* hvis du allerede har fått tilbake alt som kunne gjenopprettes.

## Se også

- [Filer og formater](docs://uitleg-bestanden): lagring, Automatisk lagring og gjenoppretting ved brudd side om side.
- [Slå på automatisk lagring](docs://howto-automatisch-opslaan): la appen oppdatere filen din selv.
- [Åpne og lagre en fil](docs://howto-bestand-openen-en-opslaan): lagre etter gjenoppretting.
- [Datoer slik de ble registrert](docs://uitleg-datums-zoals-opgeslagen): hva som skjer med et prosjekt i den visningen.
