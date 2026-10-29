# Scegliere lo schema IFC

Obiettivo: salva la tua pianificazione nello schema IFC del modello dell'edificio con cui vuoi unirla.

## Quando ti serve questo

Per impostazione predefinita, l'app salva un progetto come IFC 4.3 ADD2. Questo è il nome di IFC 4.3 nei file che creano IfcOpenShell e Bonsai. Se vuoi unire la pianificazione con un modello dell'edificio in un unico file 4D, per esempio con la ricetta *MergeProjects* di IfcOpenShell (ifcpatch), entrambi i file devono avere lo stesso schema. Se il modello dell'edificio è un file IFC4, IfcOpenShell rifiuta di unirlo con una pianificazione IFC 4.3. Scegli allora qui lo schema del modello.

## Passaggi

1. Apri *Impostazioni progetto*: *Impostazioni › Progetto › Impostazioni progetto*, oppure *File › Impostazioni progetto*.
2. Sotto *Schema IFC al salvataggio*, scegli lo schema del tuo modello dell'edificio.
3. Fai clic su *Applica*. Il progetto è ora *Non salvato*.
4. Salva con *Salva* (Ctrl+S) oppure *Salva come*.

Le tre scelte:

- *IFC 4.3 ADD2 (predefinito)* scrive `IFC4X3_ADD2` nell'intestazione del file.
- *IFC 4.3* scrive `IFC4X3`. Così scrivevano le versioni precedenti dell'app per IFC 4.3.
- *IFC4* scrive `IFC4`, per un modello dell'edificio in IFC4.

## Trappole e cosa fa l'app

**Unisci come ultimo passo.** Non aprire il file 4D unito (modello dell'edificio più pianificazione) nell'app per salvarlo di nuovo. L'app tiene solo la pianificazione: le pareti e le altre parti del modello dell'edificio vanno perse, anche se mantieni lo schema. Modifica la pianificazione nel tuo file e unisci di nuovo dopo.

**L'app chiede prima quando un file aperto ha un altro schema.** Se apri, per esempio, un file IFC4 o un file IFC 4.3 di una versione precedente dell'app, l'app non cambia semplicemente il tipo di file. La prima volta che usi *Salva* o *Salva come*, chiede prima se mantieni lo schema del file o passi a IFC 4.3 ADD2. *Mantieni IFC4* (o *Mantieni IFC 4.3*) è il pulsante che Invio seleziona. Se chiudi la domanda con Esc o con la croce, l'app non salva nulla.

**L'app chiede solo una volta per file.** La tua scelta viene salvata nel file stesso. Se lo apri di nuovo più tardi, l'app non chiede più. Se scegli tu uno schema in *Impostazioni progetto* e fai clic su *Applica*, l'app non chiede nemmeno.

**Uno schema che l'app non può scrivere**, come IFC2X3, si apre nell'app. La prima volta che salvi, la domanda lo dice, e scegli uno dei tre schemi qui sopra.

**Salvataggio automatico e recupero dopo un arresto anomalo non chiedono nulla.** Scrivono lo schema del file e lasciano la domanda per la prima volta che salvi tu stesso. Per uno schema che l'app non può scrivere, *Salvataggio automatico* non scrive nel file finché non hai risposto alla domanda.

**Un progetto nuovo non chiede nulla.** Un progetto nuovo, e un progetto di un altro formato come XER, MPP o CSV, parte da *IFC 4.3 ADD2 (predefinito)*.

**Il contenuto del file non cambia.** I tre schemi conoscono i dati di pianificazione che l'app scrive allo stesso modo. Cambia solo la riga `FILE_SCHEMA` nell'intestazione. Quindi non perdi nulla se scegli un altro schema.

**Un modello IFC 4.3 di IfcOpenShell o Bonsai** ha di solito `IFC4X3_ADD2` nell'intestazione, come il predefinito dell'app. IfcOpenShell non unisce nel modello una pianificazione con `IFC4X3`. Se hai dei dubbi, guarda la riga `FILE_SCHEMA` in cima al file del modello.

**Annulla non cambia lo schema.** Lo schema appartiene al file, come il luogo in cui è salvato. Una scelta in *Impostazioni progetto* e la risposta alla domanda al salvataggio non sono quindi un passo di *Annulla*. Per tornare indietro, scegli l'altro schema in *Impostazioni progetto*. Così *Salvataggio automatico* non scrive mai in silenzio un altro schema dopo che hai annullato una modifica.

## Vedi anche

- [Nuovo progetto e Impostazioni progetto](docs://ref-projectinfo): tutti i campi del modulo.
- [File e formati](docs://uitleg-bestanden): perché IFC è il formato proprio dell'app.
- [Aprire e salvare un file](docs://howto-bestand-openen-en-opslaan): salvare e salvare come.
