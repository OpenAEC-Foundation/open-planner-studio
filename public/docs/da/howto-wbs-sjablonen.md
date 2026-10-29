# Gem og indsæt WBS-skabeloner

Mål: gem en fase med dens underopgaver og afhængigheder som skabelon, og indsæt den igen senere i samme projekt eller i et andet projekt.

## Hvornår har du brug for dette

Du planlægger hele tiden den samme slags arbejde: hvert hus har et fundament med jordarbejde, armering, støbning og hærdning. I stedet for at oprette de opgaver igen og igen og sammenkæde dem, gemmer du fasen én gang som **skabelon**. En skabelon er en gren af din WBS: én opgave med alt, der hænger under den.

## Trin

### Gem en gren som skabelon

1. Opbyg grenen, sådan som du vil genbruge den: en hovedopgave med underopgaver og afhængighederne mellem dem.
2. Højreklik på hovedopgaven, og vælg *Gem gren som skabelon*. Dette menupunkt vises kun på opgaver med underopgaver.

Appen viser *Gren gemt som skabelon 'Foundation'*. Appen spørger ikke om et navn: skabelonen får navn efter den øverste opgave i grenen.

### Indsæt en skabelon

1. Vælg den opgave, skabelonen skal ligge under, eller vælg ingen opgave.
2. Vælg *Tidsplan › Struktur › Skabeloner*. Listen viser navnet på hver skabelon og, for eksempel, *4 opgaver, 2 afhængigheder*.
3. Klik på skabelonen.

Hvis en opgave er valgt, indsættes skabelonen som den sidste underopgave under den opgave. Opgaven bliver dermed en hovedopgave. Hvis flere opgaver er valgt, gælder den opgave, du klikkede på først. Hvis ingen opgave er valgt, kommer grenen nederst i listen, på øverste niveau. Den indsatte gren er bagefter valgt.

Alle indsatte opgaver ligger på projektstartdatoen, og tidsplanen er ikke længere opdateret. Tryk på **Beregn** (F5), for eksempel via *Start › Tidsplan › Beregn*, så følger datoerne af afhængighederne. *Fortryd* fortryder hele indsættelsen i ét trin. Det at gemme eller slette en skabelon hører ikke med.

### Slet en skabelon

Åbn *Tidsplan › Struktur › Skabeloner*, og klik på den lille skraldespand til højre for skabelonen (*Slet skabelon*). Appen beder ikke om bekræftelse.

### Hvad er i en skabelon

For hver opgave gemmer en skabelon navnet, beskrivelsen, arbejdskategorien, om den er en milepæl, og varigheden i dage. Af afhængighederne beholder den dem mellem to opgaver i grenen, med type og forsinkelse. En forsinkelse i timer (`4h`) bliver ikke gemt, og den bliver til 0. En forsinkelse i arbejdsdage, kalenderdage eller procent bliver gemt.

Alt andet bliver liggende: datoer, fremdrift og faktiske datoer, tildelinger af ressourcer, koder og brugerdefinerede felter (se [Koder og brugerdefinerede felter](docs://howto-codes-en-velden)), kalenderen, begrænsninger og deadlines, prioriteten, en brugerdefineret arbejdskategori, afhængigheder med opgaver uden for grenen, og for en milepæl bliver typen og afkrydsningen *Obligatorisk (kontraktuel)* liggende. Efter indsættelsen skal du udfylde det igen: tildelinger, koder, kalender og begrænsninger er tomme, og alle opgaver starter på projektstartdatoen.

En opgave, der var i timer, kommer tilbage som dagopgave, med varigheden omregnet til en brøkdel af en arbejdsdag. En opgave på 5 timer med en arbejdsdag på 8 timer bliver til 0,625 dage.

## Faldgruber og hvad appen gør

**Skabeloner hører ikke til projektet.** Appen gemmer dem i appens lager på denne enhed, ikke i projektfilen. En kollega, der åbner din fil, ser ikke dine skabeloner. I browserversionen hører en skabelon til den browser. Hvis dine skabeloner er vigtige, så gem dem også et andet sted: læg dem i et projekt, som du gemmer som fil.

**Det samme navn kan forekomme mere end én gang.** Hvis du gemmer grenen to gange, har listen to skabeloner med samme navn. Appen overskriver intet.

**Varigheden af den øverste opgave tæller ikke.** En hovedopgave får sin varighed fra sine underopgaver, så snart du bruger Beregn.

**En opgave med tildelinger af ressourcer som mål.** Hvis du vælger en opgave med tildelinger, der endnu ingen underopgaver har, og indsætter en skabelon under den, afviser appen det. Opgaven ville blive en hovedopgave, og en hovedopgave har ingen tildelinger. Den øverste opgave i en skabelon har selv underopgaver, så tildelingerne har ingen plads at gå hen. Appen siger det til dig og ændrer intet. Vælg så en anden opgave, eller ingen, som placering. En milepæl, der får en skabelon, mister sit milepælsflag, med en besked.

**En ugyldig afhængighed i skabelonen.** Hvis en afhængighed i skabelonen ikke er tilladt, for eksempel en opgave til sin egen fase, eller hvis den allerede findes, springer appen den over. Appen fortæller dig, hvor mange afhængigheder den sprang over.

## Se også

- [Justering af strukturen](docs://howto-structuur-aanpassen): flyt eller indryk den indsatte gren.
- [Tilføjelse af afhængigheder](docs://howto-relaties-leggen): opret selv afhængigheder inde i en gren, før du gemmer den.
- [Kritisk vej og slæk](docs://uitleg-kritiek-pad): hvad der sker med den indsatte gren efter Beregn.
