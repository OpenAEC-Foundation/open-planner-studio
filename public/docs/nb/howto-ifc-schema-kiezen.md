# Velge IFC-skjema

Mål: lagre tidsplanen din i IFC-skjemaet til bygningsmodellen du vil slå den sammen med.

## Når du trenger dette

Som standard lagrer appen et prosjekt som IFC 4.3 ADD2. Det er navnet på IFC 4.3 i filer som IfcOpenShell og Bonsai lager. Hvis du vil slå sammen tidsplanen med en bygningsmodell til én 4D-fil, for eksempel med oppskriften *MergeProjects* i IfcOpenShell (ifcpatch), må begge filene ha samme skjema. Er bygningsmodellen en IFC4-fil, nekter IfcOpenShell å slå den sammen med en tidsplan i IFC 4.3. Velg da skjemaet til modellen her.

## Steg

1. Åpne *Prosjektinnstillinger*: *Innstillinger › Prosjekt › Prosjektinnstillinger*, eller *Fil › Prosjektinnstillinger*.
2. Under *IFC-skjema ved lagring*, velg skjemaet til bygningsmodellen din.
3. Klikk på *Bruk*. Prosjektet er nå *Ikke lagret*.
4. Lagre med *Lagre* (Ctrl+S) eller *Lagre som*.

De tre valgene:

- *IFC 4.3 ADD2 (standard)* skriver `IFC4X3_ADD2` i headeren til filen.
- *IFC 4.3* skriver `IFC4X3`. Slik skrev eldre versjoner av appen IFC 4.3.
- *IFC4* skriver `IFC4`, for en bygningsmodell i IFC4.

## Fallgruver og hva appen gjør

**Slå sammen som siste steg.** Ikke åpne den sammenslåtte 4D-filen (bygningsmodell pluss tidsplan) i appen for å lagre den igjen. Appen beholder bare tidsplanen: veggene og de andre delene av bygningsmodellen går tapt, også om du beholder skjemaet. Endre tidsplanen i din egen fil, og slå sammen på nytt etterpå.

**Appen spør først når en åpnet fil har et annet skjema.** Åpner du for eksempel en IFC4-fil, eller en IFC 4.3-fil fra en eldre versjon av appen, endrer appen ikke bare filtypen. Første gang du bruker *Lagre* eller *Lagre som*, spør den først om du beholder skjemaet til filen, eller om du går over til IFC 4.3 ADD2. *Behold IFC4* (eller *Behold IFC 4.3*) er knappen som Enter velger. Lukker du spørsmålet med Esc eller krysset, lagrer appen ingenting.

**Appen spør bare én gang per fil.** Valget ditt lagres i filen selv. Åpner du den igjen senere, spør appen ikke igjen. Velger du selv et skjema i *Prosjektinnstillinger* og klikker på *Bruk*, spør appen heller ikke.

**Et skjema som appen ikke kan skrive**, for eksempel IFC2X3, åpnes i appen. Første gang du lagrer, sier spørsmålet det, og du velger ett av de tre skjemaene over.

**Automatisk lagring og gjenoppretting ved brudd spør ingenting.** De skriver skjemaet til filen, og spørsmålet blir stående til du lagrer selv for første gang. For et skjema som appen ikke kan skrive, skriver *Automatisk lagring* ikke til filen før du har svart på spørsmålet.

**Et nytt prosjekt spør ingenting.** Et nytt prosjekt, og et prosjekt fra et annet format som XER, MPP eller CSV, starter med *IFC 4.3 ADD2 (standard)*.

**Innholdet i filen endres ikke.** De tre skjemaene støtter tidsplandataene som appen skriver på samme måte. Bare linjen `FILE_SCHEMA` i headeren er forskjellig. Du mister altså ingenting når du velger et annet skjema.

**En IFC 4.3-modell fra IfcOpenShell eller Bonsai** har vanligvis `IFC4X3_ADD2` i headeren, som standardvalget i appen. IfcOpenShell slår ikke sammen en tidsplan med `IFC4X3` inn i den. Er du i tvil, se på linjen `FILE_SCHEMA` øverst i modellfilen.

**Angre endrer ikke skjemaet.** Skjemaet hører til filen, på samme måte som stedet der den er lagret. Et valg i *Prosjektinnstillinger* og svaret på spørsmålet når du lagrer, er derfor ikke ett steg i *Angre*. Vil du gå tilbake, velg det andre skjemaet i *Prosjektinnstillinger*. Da skriver *Automatisk lagring* aldri stille et annet skjema etter at du har angret en endring.

## Se også

- [Nytt prosjekt og Prosjektinnstillinger](docs://ref-projectinfo): alle felter i vinduet.
- [Filer og formater](docs://uitleg-bestanden): hvorfor IFC er appens eget format.
- [Åpne og lagre en fil](docs://howto-bestand-openen-en-opslaan): lagre og lagre som.
