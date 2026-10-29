# Giorni e ore

Un'attività di 2 giorni e un'attività di 16 ore sembrano uguali, ma l'app le calcola in modo diverso. Perché puoi scegliere tra giorni e ore? E che cosa succede quando un'attività in ore è legata a un'attività in giorni? In questo articolo leggi come l'app conta giorni e ore, e dove arrotonda. L'esempio svolto mostra i numeri.

## Il concetto

Un'**attività in giorni** ha una durata in giorni lavorativi interi, ad esempio `5d`. Occupa giorni lavorativi interi. Sul calendario standard ha una data di inizio e una data di fine, senza orario.

Un'**attività in ore** ha una durata in ore lavorative, ad esempio `12h` o `1h 30m`. Ha un inizio e una fine con un orario, ad esempio martedì alle 11:00.

L'unità appartiene all'attività, non al progetto. Puoi mescolare attività in giorni e attività in ore in una stessa pianificazione. Questo si chiama **pianificazione mista**.

Usi le ore per le lavorazioni che non si adattano a giorni interi: una gru che noleggi per dodici ore, un getto di sei ore, un'attività che può iniziare solo dopo la pausa pranzo. Per tutto il resto bastano i giorni, e sono più chiari.

La **pianificazione oraria** è disattivata per impostazione predefinita. Finché è disattivata, l'app lavora in giorni. Se un file contiene una pianificazione oraria, per esempio attività in ore, l'app segnala *Questo file contiene una pianificazione oraria.* Queste attività vengono comunque calcolate, ma puoi modificarne la durata solo dopo aver attivato la pianificazione oraria.

## Come l'app calcola

### Orari di lavoro e giorno lavorativo standard

Ogni calendario ha **fasce orarie** per ogni giorno lavorativo (nell'app si chiamano *fasce*). Il calendario standard ha dalle 07:00 alle 12:00 e dalle 13:00 alle 16:00. Lo spazio tra i due è la pausa. L'app ricava queste fasce dall'*Inizio (ora)* del calendario, dalla *Fine (ora)* e dalla pausa; non devi impostare nulla. Se imposti fasce tue per giorno della settimana, hanno la precedenza.

Il **giorno lavorativo standard** è il giorno lavorativo che ricorre più spesso; la sua durata è la somma delle sue fasce. Non è quindi una media: con lunedì di 16 ore e da martedì a venerdì di 10 ore, il giorno lavorativo standard è di 10 ore. Se i giorni lavorativi hanno lunghezze diverse, si applica il totale giornaliero più frequente; in caso di parità, il più alto. Con quattro giorni di 8 ore e un venerdì di 5 ore, il giorno lavorativo standard è quindi di 8 ore. Anche un calendario con ore al giorno proprie (per esempio da Primavera P6) calcola con questo totale giornaliero, e la finestra del calendario lo mostra. Il suo valore proprio viene conservato per l'esportazione. Se è diverso, la finestra del calendario mostra un blocco arancione sotto *Giorno lavorativo standard*. Un'attività di 1870 ore su fasce di 10 ore dura quindi 187 giorni, anche se il suo valore proprio è 8 ore al giorno.

### Un'attività in ore

L'app conta i minuti lavorativi a partire dall'inizio, attraverso le fasce orarie. Pause, serate, fine settimana e festività non contano. Un'attività di 12 ore quindi non entra in un giorno lavorativo di 8 ore: continua nel giorno successivo.

### Un'attività in giorni

L'app conta i giorni lavorativi interi. Le ore al giorno non hanno alcun ruolo. Un'attività di 5 giorni finisce lo stesso giorno, sia che il calendario abbia 6 sia che abbia 8 ore al giorno.

### Convertire giorni e ore

Un giorno corrisponde al giorno lavorativo standard del calendario dell'attività. L'app lo usa in tre punti:

- Per la *Visualizzazione della durata*. Sotto *Impostazioni › Progetto › Impostazioni app*, scheda *Aspetto*, scegli *Automatica (unità propria per attività)*, *Sempre giorni* o *Sempre ore*. Un'attività di 18 ore si mostra con *Sempre giorni* come `2.25d(18h)`: l'unità propria resta tra parentesi.
- Per un ritardo in ore dopo un'attività in giorni (vedi *Arrotondamento*).
- Quando cambi l'unità di un'attività. L'app conta allora i giorni dall'inizio dell'attività, ogni giorno con le proprie ore, e converte subito la durata se il risultato è esatto. Due giorni diventano `16h`. Su un calendario dove il venerdì ha 5 ore, 5 giorni dal lunedì diventano `37h`. Dodici ore non si possono convertire in giorni interi su un calendario con giorni di 8 ore: in quel caso l'app lascia l'unità com'è.

### Attività in giorni e attività in ore insieme

Le regole seguenti valgono per una relazione fine-inizio su un calendario senza fasce orarie proprie, come il calendario standard.

- **Ore → ore.** Il successore inizia nel momento in cui il predecessore finisce, anche se questo accade a metà giornata.
- **Ore → giorni.** Un'attività in giorni non inizia mai a metà giornata. Inizia il primo giorno lavorativo dopo il giorno in cui finisce l'attività in ore. Il resto di quel giorno non viene usato e torna come margine dell'attività in ore.
- **Giorni → ore.** Un'attività in giorni occupa tutto il suo ultimo giorno. L'attività in ore inizia il primo giorno lavorativo dopo, all'inizio della prima fascia oraria.

### Arrotondamento

L'app arrotonda, o rifiuta, in quattro punti:

- **Un'attività in giorni dopo un'attività in ore** inizia il giorno lavorativo successivo. L'attività in ore viene, per così dire, arrotondata a giorni interi.
- **Un ritardo in ore** conta nel calendario del ritardo, per impostazione predefinita quello del predecessore. Se il predecessore è un'attività in giorni su un calendario senza fasce orarie proprie, come il calendario standard, l'app converte il ritardo in giorni lavorativi interi: il ritardo diviso per le ore del giorno lavorativo standard, arrotondato a un numero intero; da mezza giornata in su si arrotonda per eccesso. Con 8 ore al giorno, 1 ora conta come 0 giorni, 4 ore come 1 giorno e 12 ore come 2 giorni. Questo vale anche se il successore è un'attività in ore. Se il predecessore è un'attività in ore, o il suo calendario ha fasce orarie proprie, il ritardo conta esattamente in ore lavorative e la pausa non conta.
- **Una durata in giorni** è sempre un numero intero. Se scrivi `1.5d`, l'app segnala *Inserisci un numero intero di giorni o ore, ad esempio 2d o 12h.* Una durata in ore può essere `1.5h`, oppure `1h 30m`.
- **Cambiare l'unità** avviene solo se il risultato è esatto (vedi sopra).

## Esempio svolto: la gru

Il calendario va da lunedì a venerdì dalle 07:00 alle 12:00 e dalle 13:00 alle 16:00: un giorno lavorativo standard di 8 ore. La data di inizio del progetto è lunedì 7 giugno 2027.

### Ore, ore e giorno

*Place crane* dura 12 ore. Lunedì ha 8 ore lavorative (5 fino alle 12:00 e 3 dopo la pausa) e martedì le ultime 4 ore. L'attività va da lunedì 07:00 a **martedì 8 giugno alle 11:00**.

*Adjust elements* dura 8 ore e segue con una relazione fine-inizio. Inizia subito martedì alle 11:00: sono 1 ora fino alla pausa e 3 ore dopo. Le ultime 4 ore sono mercoledì dalle 07:00 alle 11:00. La fine è **mercoledì 9 giugno alle 11:00**.

*Finishing* dura 2 giorni e segue *Adjust elements*. Un'attività in giorni non inizia a metà giornata, quindi inizia **giovedì 10 giugno** e finisce venerdì 11 giugno.

### Arrotondamento nel passaggio

Se togli *Adjust elements* e colleghi *Finishing* direttamente a *Place crane*, *Finishing* inizia mercoledì 9 giugno e finisce giovedì 10 giugno. Il resto di martedì (4 ore lavorative) non si può usare. Vedi quelle 4 ore di nuovo come margine totale di *Place crane*: mezza giornata lavorativa.

Inverti l'ordine e il calcolo è più semplice. *Pour foundation* dura 2 giorni, da lunedì 7 a martedì 8 giugno. *Place crane* dura ora 4 ore e segue. Inizia **mercoledì 9 giugno alle 07:00** e finisce alle 11:00.

### Un ritardo in ore

Tra *Place crane* (12 ore) e *Adjust elements* (8 ore) metti un ritardo di 2 ore. *Adjust elements* allora non inizia alle 11:00 ma martedì alle **14:00**: 1 ora fino alla pausa e 1 ora dopo. La fine slitta a **mercoledì 9 giugno alle 14:00**.

Dopo un'attività in giorni un ritardo funziona in modo diverso. *Pour foundation* finisce martedì 8 giugno. Senza ritardo *Finishing* inizia mercoledì 9 giugno. Con un ritardo di 4 ore, cioè mezza giornata, l'app arrotonda per eccesso: *Finishing* inizia **giovedì 10 giugno**. Con un ritardo di 1 ora l'app arrotonda per difetto, e *Finishing* inizia semplicemente mercoledì.

### Un venerdì pomeriggio libero

Ora il venerdì ha solo una fascia, dalle 07:00 alle 12:00: 5 ore. Gli altri giorni restano a 8 ore. Il giorno lavorativo standard resta 8 ore, perché è il totale giornaliero più frequente. Una settimana ha ora 37 ore lavorative.

Un'attività di 40 ore da lunedì 7 giugno alle 07:00 usa da lunedì a giovedì (32 ore) e il venerdì (5 ore). Le ultime 3 ore cadono il lunedì successivo, dalle 07:00 alle 10:00. La fine è **lunedì 14 giugno alle 10:00**. Un'attività di 5 giorni occuperebbe 37 ore da lunedì, ed è quello che l'app propone se cambi l'unità da 5 giorni a ore.

Nel tutorial 4, sulla pianificazione oraria, pianifichi tu stesso un lavoro con la gru in ore.

## Conseguenze e malintesi

**«8 ore sono 1 giorno.»** Solo se il calendario ha giorni di 8 ore. Sul calendario con il venerdì pomeriggio libero, 5 giorni sono 37 ore, non 40.

**«Se imposto più ore al giorno, la mia attività in giorni finisce prima.»** No. Un'attività in giorni conta giorni lavorativi interi. Le ore al giorno cambiano solo il valore di un giorno in ore, per esempio nella visualizzazione e per un ritardo in ore. Solo per un'attività con risorse e con il tipo di attività *Lavoro fisso* o *Unità fisse* la durata cambia insieme alle ore al giorno, perché il lavoro resta uguale: 40 ore di lavoro sono 5 giorni a 8 ore al giorno e 7 giorni a 6 ore al giorno.

**«Un'attività di 8 ore dura un giorno.»** Solo se inizia all'inizio della giornata. Se inizia più tardi, come *Adjust elements* martedì alle 11:00, continua nel giorno successivo.

**Un calendario con fasce orarie proprie** si comporta in modo diverso dal calendario standard. Ottieni un calendario così impostando orari di lavoro per giorno della settimana, oppure scegliendo un preset di turni (*2 turni*, *3 turni*, *Turno notturno* o *24/7*). Su un calendario così un ritardo in ore conta esattamente in ore lavorative, anche dopo un'attività in giorni.

**Disattivare la pianificazione oraria** non cancella nulla. Le attività in ore restano e vengono comunque calcolate, ma non puoi modificarle finché non riattivi la pianificazione oraria.

## Vedi anche

- [Attivare la pianificazione oraria](docs://howto-urenplanning-aanzetten): i passi per pianificare un'attività in ore.
- [Impostare gli orari di lavoro](docs://howto-werktijden-instellen): regolare le fasce orarie di un calendario.
- [Calendari e giorni lavorativi](docs://uitleg-kalenders): come l'app conta i giorni lavorativi e quale calendario vince.
- [Aggiungere relazioni](docs://howto-relaties-leggen): i passi per aggiungere una relazione o un ritardo.
