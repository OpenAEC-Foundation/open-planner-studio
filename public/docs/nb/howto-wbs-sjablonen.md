# Lagre og sette inn WBS-maler

Mål: lagre en fase med delaktivitetene og avhengighetene som en mal, og sett den senere inn igjen i samme prosjekt eller i et annet.

## Når du trenger dette

Du planlegger hele tiden samme type arbeid. Hvert hus har et fundament med grunnarbeid, armering, støping og herding. I stedet for å lage de samme aktivitetene om og om igjen og koble dem sammen, lagrer du fasen én gang som en **mal**. En mal er en gren av WBS-en din: én aktivitet med alt som hører under den.

## Steg

### Lagre en gren som mal

1. Bygg grenen slik du vil bruke den igjen: en hovedaktivitet med delaktiviteter og avhengighetene mellom dem.
2. Høyreklikk hovedaktiviteten og velg *Lagre gren som mal*. Menyvalget vises bare på aktiviteter med delaktiviteter.

Appen viser *Gren lagret som mal 'Foundation'*. Appen spør ikke om et navn. Malen får navnet etter den øverste aktiviteten i grenen.

### Sette inn en mal

1. Velg aktiviteten malen skal ligge under, eller velg ingenting.
2. Velg *Tidsplan › Struktur › Maler*. Listen viser navnet på hver mal og, for eksempel, *4 aktiviteter, 2 avhengigheter*.
3. Klikk på malen.

Hvis en aktivitet er valgt, legges malen inn som den siste delaktiviteten under den aktiviteten. Den aktiviteten blir dermed en hovedaktivitet. Hvis flere aktiviteter er valgt, gjelder den du klikket på først. Hvis ingenting er valgt, legges grenen nederst i listen, på øverste nivå. Etterpå er den innsatte grenen valgt.

Alle innsatte aktiviteter får prosjektstarten som startdato, og tidsplanen er ikke lenger oppdatert. Trykk **Beregn** (F5), for eksempel via *Hjem › Tidsplan › Beregn*. Da følger datoene av avhengighetene. Med *Angre* angrer du hele innsettingen i ett trinn. Lagring og sletting av en mal er ikke en del av det.

### Slette en mal

Åpne *Tidsplan › Struktur › Maler* og klikk på den lille søppelbøtta til høyre for malen (*Slett mal*). Appen ber ikke om bekreftelse.

### Hva som er med i en mal

For hver aktivitet beholder en mal navnet, beskrivelsen, arbeidskategorien, om aktiviteten er en milepæl, og varigheten i dager. Av avhengighetene beholder den bare dem mellom to aktiviteter i grenen, med type og forsinkelse. En forsinkelse i timer (`4h`) beholdes ikke og blir 0. En forsinkelse i arbeidsdager, kalenderdager eller prosent beholdes.

Alt annet blir igjen. Det gjelder datoer, fremdrift og faktiske datoer, tilordninger til ressurser, koder og egendefinerte felt (se [Koder og egendefinerte felt](docs://howto-codes-en-velden)), kalenderen, begrensninger og tidsfrister, prioriteten, en egendefinert arbeidskategori, for en milepæl typen og avkrysningsboksen *Obligatorisk (kontraktuelt)*, og avhengigheter til aktiviteter utenfor grenen. Etter innsetting må du fylle dem inn igjen: tilordninger, koder, kalender og begrensninger er tomme, og alle aktiviteter får prosjektstarten som startdato.

En aktivitet som var målt i timer, kommer tilbake som en dagbasert aktivitet. Varigheten blir omregnet til en brøkdel av en arbeidsdag. En aktivitet på 5 timer med en arbeidsdag på 8 timer blir 0,625 dager.

## Fallgruver og hva appen gjør

**Maler hører ikke til prosjektet.** Appen lagrer dem i lagringen sin på denne enheten, ikke i prosjektfilen. En kollega som åpner filen din, ser ikke malene dine. I nettleserversjonen hører en mal til den nettleseren. Er malene viktige for deg, må du også ta vare på dem et annet sted. Legg dem for eksempel i et prosjekt som du lagrer som fil.

**Samme navn kan forekomme flere ganger.** Lagrer du grenen to ganger, har listen to maler med samme navn. Appen overskriver ingenting.

**Varigheten til den øverste aktiviteten teller ikke.** En hovedaktivitet får varigheten sin fra delaktivitetene, så snart du bruker *Beregn*.

**En aktivitet med ressurstilordninger som mål.** Velger du en aktivitet med tilordninger, men uten delaktiviteter, og setter inn en mal under den, avviser appen det. Aktiviteten ville bli en hovedaktivitet, og en hovedaktivitet har ingen tilordninger. Den øverste aktiviteten i en mal har selv delaktiviteter, så det er ikke plass til tilordningene. Appen melder fra og endrer ingenting. Velg da en annen aktivitet, eller ingenting, som plassering. En milepæl som får en mal, mister flagget for milepæl. Appen viser en melding om det.

**En ugyldig avhengighet i malen.** Er en avhengighet i malen ikke tillatt, hopper appen over den. Det gjelder også hvis den allerede finnes. Et eksempel er en avhengighet fra en aktivitet til sin egen fase. Appen sier hvor mange avhengigheter den hoppet over.

## Se også

- [Justere strukturen](docs://howto-structuur-aanpassen): flytte eller rykke inn den innsatte grenen.
- [Legge til avhengigheter](docs://howto-relaties-leggen): lage avhengigheter i en gren selv før du lagrer den.
- [Kritisk linje og slakk](docs://uitleg-kritiek-pad): hva som skjer med den innsatte grenen etter *Beregn*.
