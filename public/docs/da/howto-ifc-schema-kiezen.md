# Valg af IFC-skema

Mål: gem din tidsplan i IFC-skemaet for den bygningsmodel, du vil sammenflette den med.

## Hvornår har du brug for dette

Som standard gemmer appen et projekt som IFC 4.3 ADD2. Det er navnet på IFC 4.3 i de filer, som IfcOpenShell og Bonsai opretter. Hvis du vil sammenflette tidsplanen med en bygningsmodel til én 4D-fil, for eksempel med opskriften *MergeProjects* i IfcOpenShell (ifcpatch), skal begge filer have samme skema. Hvis bygningsmodellen er en IFC4-fil, afviser IfcOpenShell at sammenflette den med en tidsplan i IFC 4.3. Vælg så skemaet for modellen her.

## Trin

1. Åbn *Projektindstillinger*: *Indstillinger › Projekt › Projektindstillinger*, eller *Fil › Projektindstillinger*.
2. Under *IFC-skema ved lagring*, vælg skemaet for din bygningsmodel.
3. Klik på *Anvend*. Projektet er nu *Ikke gemt*.
4. Vælg *Gem* (Ctrl+S) eller *Gem som*.

De tre valg:

- *IFC 4.3 ADD2 (standard)* skriver `IFC4X3_ADD2` i headeren i filen.
- *IFC 4.3* skriver `IFC4X3`. Sådan skrev ældre versioner af appen IFC 4.3.
- *IFC4* skriver `IFC4`, til en bygningsmodel i IFC4.

## Faldgruber og hvad appen gør

**Sammenflet som sidste trin.** Åbn ikke den sammenflettede 4D-fil (bygningsmodel plus tidsplan) i appen for at gemme den igen. Appen beholder kun tidsplanen: væggene og de andre dele af bygningsmodellen går tabt, også hvis du beholder skemaet. Ændr tidsplanen i din egen fil, og sammenflet dem igen bagefter.

**Appen spørger først, når en åbnet fil har et andet skema.** Hvis du åbner for eksempel en IFC4-fil eller en IFC 4.3-fil fra en ældre version af appen, ændrer appen ikke bare filtypen. Første gang du bruger *Gem* eller *Gem som*, spørger den først, om du vil beholde filens skema, eller gå til IFC 4.3 ADD2. *Behold IFC4* (eller *Behold IFC 4.3*) er knappen, som Enter vælger. Lukker du spørgsmålet med Esc eller krydset, gemmer appen ingenting.

**Appen spørger kun én gang per fil.** Dit valg gemmes i selve filen. Åbner du den igen senere, spørger appen ikke igen. Vælger du selv et skema i *Projektindstillinger* og klikker på *Anvend*, spørger appen heller ikke.

**Et skema, som appen ikke kan skrive**, for eksempel IFC2X3, åbner i appen. Første gang du gemmer, siger spørgsmålet det, og du vælger et af de tre skemaer herover.

**Automatisk gem og genoprettelse efter nedbrud spørger ikke.** De skriver filens skema, og de beholder spørgsmålet, til den første gang du selv gemmer. For et skema, som appen ikke kan skrive, skriver *Automatisk gem* ikke til filen, før du har besvaret spørgsmålet.

**Et nyt projekt spørger ikke.** Et nyt projekt og et projekt fra et andet format, for eksempel XER, MPP eller CSV, starter med *IFC 4.3 ADD2 (standard)*.

**Indholdet af filen ændrer sig ikke.** De tre skemaer kender de tidsplandata, som appen skriver på samme måde. Kun linjen `FILE_SCHEMA` i headeren er forskellig. Du mister altså ingenting, når du vælger et andet skema.

**En IFC 4.3-model fra IfcOpenShell eller Bonsai** har normalt `IFC4X3_ADD2` i headeren, ligesom standarden i appen. IfcOpenShell sammenfletter ikke en tidsplan med `IFC4X3` ind i den. Er du i tvivl, så kig på linjen `FILE_SCHEMA` øverst i modelfilen.

**Fortryd ændrer ikke skemaet.** Skemaet hører til filen, ligesom stedet hvor den er gemt. Et valg i *Projektindstillinger* og svaret på spørgsmålet, når du gemmer, er derfor ikke et trin i *Fortryd*. Vil du gå tilbage, vælger du det andet skema i *Projektindstillinger*. Så skriver *Automatisk gem* aldrig et andet skema uden at give besked, efter at du har fortrudt en redigering.

## Se også

- [Nyt projekt og Projektindstillinger](docs://ref-projectinfo): alle felter i formularen.
- [Filer og formater](docs://uitleg-bestanden): hvorfor IFC er appens eget format.
- [Åbning og gemning af en fil](docs://howto-bestand-openen-en-opslaan): gem og gem som.
