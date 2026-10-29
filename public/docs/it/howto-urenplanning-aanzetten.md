# Attivare la pianificazione oraria

Obiettivo: pianificare attività in orari di lavoro, insieme alle attività in giorni.

## Quando ti serve questo

Noleggi una gru a ore, non a giorni. Un getto di sei ore non entra in un intero giorno lavorativo. Una squadra notturna lavora in orari diversi dalla squadra diurna. Per questo tipo di lavoro vuoi una durata in ore e un inizio e una fine con un orario. Attivi questa opzione anche quando apri un file e l'app mostra *Questo file contiene una pianificazione oraria.* Perché l'app conta giorni e ore in modo diverso, puoi leggerlo in [Giorni e ore](docs://uitleg-dagen-en-uren).

## Passaggi

### Attivazione della pianificazione oraria

1. Scegli *Impostazioni › Progetto › Impostazioni app* e apri la scheda *Pianificazione*.
2. Sotto *Pianificazione oraria* spunta *Attiva pianificazione oraria*. Funziona subito. Nel messaggio *Questo file contiene una pianificazione oraria.* il pulsante *Attiva pianificazione oraria* fa lo stesso.
3. Sotto si trova *Consenti pianificazione mista giorno/ora*, attivo per impostazione predefinita. Con questa impostazione scegli per attività se conta in giorni o in ore. Se la disattivi, l'elenco *Unità di durata* scompare. Puoi comunque digitare una durata con un'unità, ad esempio `12h`.

Questo cambia più della sola durata di un'attività: in *Vista › Scala temporale* puoi scegliere la scala *Ora*, la finestra *Calendari* può dare a un calendario normale le fasce orarie (il blocco *Orari di lavoro*; un calendario che ha già delle fasce mostra sempre questo blocco), e la finestra *Nuovo progetto* riceve le opzioni *Turno* e *Unità predefinita per le nuove attività*.

### Pianificare un'attività in ore

1. Seleziona l'attività e guarda nel pannello *Proprietà*, sotto *Tempo*, il campo *Durata*.
2. Digita la durata con un'unità e premi Invio: `12h` (`12u`, l'abbreviazione olandese, funziona anche) per dodici ore, `1h 30m` per un'ora e mezza. Anche `1.5h` va bene. Un numero senza unità conta nell'unità che l'attività ha già.
3. Se vuoi convertire un'attività esistente, scegli l'unità *Ore* sotto *Unità di durata*. L'app converte subito la durata, ad esempio da `2` giorni a `16` ore. Per tornare indietro, usa *Annulla*.
4. Tornare ai giorni si può fare con `2d` o con l'unità *Giorni*.
5. Premi **Calcola** (F5), ad esempio tramite *Home › Pianificazione › Calcola*. L'attività ha ora un inizio e una fine con un orario.
6. Se vuoi vedere le ore nel Gantt, scegli la scala *Ora* nell'elenco sotto *Vista › Scala temporale*.

### Nuove attività in ore come impostazione predefinita

1. Scegli *Impostazioni › Progetto › Impostazioni progetto*.
2. Sotto *Unità predefinita per le nuove attività* scegli l'unità *Ore* e fai clic su *Applica*.

Una nuova attività parte quindi con 5 ore invece di 5 giorni. Le attività esistenti non cambiano. Con un nuovo progetto la stessa scelta si trova nella finestra *Nuovo progetto*. Se lì scegli *Turno diurno* sotto *Turno*, *Ore* è disattivato. Scegli un altro turno, oppure imposta l'unità predefinita dopo la creazione in *Impostazioni progetto*.

## Trabocchetti e cosa fa l'app in quel caso

**Nessun orario di lavoro valido.** Se il calendario dell'attività non ha orari di lavoro utilizzabili, l'app mostra *Questo calendario non ha orari di lavoro validi. Controlla giorni e orari lavorativi.* Durante il calcolo può comparire il messaggio *L'attività in ore 'name' non ha orari di lavoro validi nel suo calendario*.

**Niente decimali con i giorni.** Una durata in giorni è un numero intero. `1.5d` mostra il messaggio *Inserisci un numero intero di giorni o ore, ad esempio 2d o 12h.* Se vuoi un giorno e mezzo, indica la durata in ore.

**Una conversione che non può essere esatta.** Dodici ore non entrano in giorni interi di 8 ore. In *Proprietà* e in *Modifica attività* l'app mostra allora un blocco giallo con *12h non corrisponde a giorni interi in questo calendario. L'unità non è cambiata.* e lascia l'unità così com'è. La tabella attività mostra un messaggio più breve: *Questa durata non può essere convertita esattamente nell'altra unità.*

**Il campo è disattivato.** Per una fase, un hammock o un cardine con durata zero, la durata dipende da altro e non puoi digitarla.

**Disattivare di nuovo la pianificazione oraria.** Le attività in ore restano e vengono ancora calcolate. Allora non puoi modificarne la durata; il campo mostra *Attiva la pianificazione oraria per modificare questa attività in ore.*, con un pulsante per riattivarla.

## Vedi anche

- [Giorni e ore](docs://uitleg-dagen-en-uren): come l'app conta le ore, cosa succede quando giorni e ore si incontrano e dove arrotonda.
- [Impostare gli orari di lavoro](docs://howto-werktijden-instellen): gli orari di un calendario per giorno della settimana.
- [Aggiungere relazioni](docs://howto-relaties-leggen): un ritardo in ore tra due attività.
- [Impostazioni app](docs://ref-instellingen): l'impostazione Attiva pianificazione oraria e che cos'altro cambia.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): contiene attività in ore (rebar fixing and pouring) con un calendario orario proprio, *Hourly calendar, rebar fixing & pouring*.
