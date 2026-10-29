# Livellamento delle risorse

Hai un muratore e due muri che devono essere costruiti negli stessi giorni. Sulla carta la pianificazione funziona, ma nella pratica lui può essere in un solo posto alla volta. Il livellamento è il modo in cui l'app risolve questi conflitti: fa iniziare le attività più tardi, finché la risorsa ce la fa. In questo articolo leggi esattamente che cosa sposta il livellamento, quando la data di fine cede e che cosa non risolve per te.

## Il concetto

Una risorsa è **sovrassegnata** in un giorno lavorativo se la pianificazione chiede più di quanto lei può fornire quel giorno. Ciò che può fornire è la sua capacità: *Unità max* nei giorni lavorativi del suo calendario. Se quel giorno non lavora secondo il suo calendario, la sua capacità è 0.

**Livellamento** risolve questo facendo iniziare le attività più tardi. Non fa altro. Non accorcia un'attività, non la divide, non cambia unità o relazioni e non aggiunge una risorsa in più. Per ogni attività l'app cerca il primo punto in cui le risorse sono libere e sposta lì l'attività.

Ci sono due modi, nella finestra *Livella risorse*:

- Per impostazione predefinita la data di fine del progetto può spostarsi. Questo è il livellamento in senso stretto.
- Con la casella *Livella solo entro il margine (attenuazione) — la data di fine progetto resta invariata* l'app sposta le attività solo entro il loro margine. La data di fine resta quindi dov'è. Se questo non funziona, l'attività resta dov'è e l'app segnala un conflitto. Che cos'è il margine, lo leggi in [Percorso critico e margine](docs://uitleg-kritiek-pad).

## Come calcola l'app

### Quanto chiede un'attività

Per giorno lavorativo l'app conta quante unità ogni attività chiede a una risorsa. Sono le unità secondo la curva o secondo la tua distribuzione oraria, cioè esattamente le stesse ore per giorno che mostra l'istogramma. La capacità della risorsa è *Unità max*, oppure il valore del passo nella capacità per fasi temporali che vale quel giorno. Un giorno è sovrassegnato se la richiesta è maggiore della capacità.

### In quale ordine

L'app piazza le attività una per una, in quest'ordine: prima la priorità più alta, poi l'attività con il margine totale minore, poi l'inizio anticipato più presto, e infine l'ordine nella tabella attività. Un'attività entra in gioco solo quando i suoi predecessori hanno già il loro posto.

La priorità è un numero da 0 a 1000 che imposti per attività. Il valore predefinito è 500. Nel menu contestuale di una barra attività si chiama *Priorità*, con le scelte *Bassa* (100), *Normale* (500) e *Alta* (900). Un'attività che entra prima ottiene il posto che vuole. Le attività che seguono devono adattarsi intorno a lei. Così la priorità decide quale attività resta e quale cede. Il valore 1000 è speciale: un'attività con questo valore non si sposta mai per la capacità. È l'opzione «Non livellare» di MS Project.

### Dove si sposta un'attività

Per ogni attività l'app parte dall'inizio anticipato che le relazioni permettono. Tiene conto del fatto che i predecessori possono essersi già spostati. Se l'attività entra lì, resta. Se non entra, l'app prova il giorno lavorativo successivo dell'attività, e così via. Un'attività entra se, in ogni giorno dell'attività, ogni risorsa è abbastanza libera. Se un'attività ha più risorse, devono essere tutte libere in quei giorni. Quindi un'attività si sposta sempre più tardi, mai più presto.

L'app registra lo spostamento come **ritardo di livellamento**: un numero di giorni lavorativi, nel calendario dell'attività, di cui l'attività inizia più tardi di quanto richiedano le relazioni. Lo vedi nella colonna *Ritardo di livellamento*, sotto *Calcolato*. Il ritardo viene salvato con il file del progetto. *Calcola* (F5) lo considera come tempo di attesa extra prima dell'inizio. Le attività dopo di lei si spostano tramite le relazioni.

### Entro il margine o oltre

Senza *attenuazione* l'app continua a cercare finché l'attività entra. Di conseguenza la data di fine del progetto può spostarsi.

Con *attenuazione* un'attività non può iniziare più tardi del suo inizio posticipato. Questo è l'ultimo giorno in cui potrebbe iniziare senza spostare la data di fine. Se l'attività non entra in quella finestra, resta nel suo inizio anticipato. L'attività compare allora sotto *Conflitti rimanenti*.

### Che cosa l'app non sposta

- Attività già iniziate o terminate. Il loro carico conta, ma non ricevono mai un ritardo di livellamento.
- Attività con priorità 1000. Seguono i loro predecessori, ma non si spostano per la capacità.
- Attività senza un'assegnazione alle risorse selezionate, cardini e fasi. Si spostano solo se un predecessore si sposta.
- Materiale. Non viene mai livellato.

### Proposta e applicazione

*Calcola* fa una proposta: le attività che si spostano, con inizio vecchio e nuovo, e la data di fine prima e dopo. Nella tua pianificazione non cambia nulla finché non scegli *Applica*. Poi l'app scrive i ritardi nelle attività e ricalcola subito la pianificazione.

## Esempio svolto: il muratore su due muri

L'esempio è il progetto di esercitazione dei tutorial *House extension*, così com'è subito prima del livellamento nel tutorial 5. Nel tutorial 5 lo fai tu stesso e controlli i numeri. In questo esempio l'intonacatura usa il tipo *Lavoro fisso* e l'intonacatore lavora con unità di 2, come in [Tipi di attività: durata, unità e lavoro](docs://uitleg-werkregels).

Dopo il solaio alveolare, finito lunedì 28 giugno, il paramento interno (5 giorni lavorativi) e il paramento esterno (6 giorni lavorativi) iniziano entrambi martedì 29 giugno. Entrambi sono assegnati al muratore, con unità di 1 e *Unità max* di 1. Dopo il paramento interno vengono gli elementi del tetto (un'attività con gru di 6 ore) e la copertura (2 giorni lavorativi). I telai aspettano la copertura e il paramento esterno. La consegna è lunedì 30 agosto.

### Il muratore è sovrassegnato

Il paramento interno va dal 29 giugno al 5 luglio compreso, il paramento esterno dal 29 giugno al 6 luglio compreso. Dal 29 giugno al 5 luglio compreso, cioè 5 giorni lavorativi, la pianificazione chiede 2 unità a un muratore con capacità 1. Il muratore è quindi sovrassegnato in quei 5 giorni.

### L'ordine

Entrambe le attività hanno priorità 500. I telai delle finestre sono consegnati solo il 14 luglio (nel tutorial 3 imposti per loro un vincolo *Iniziare non prima del (SNET)*). Di conseguenza il paramento interno ha 3 giorni lavorativi di margine, e quello esterno 5. Il paramento interno ha il margine minore e quindi viene per primo. Resta dal 29 giugno al 5 luglio compreso.

### Lo spostamento

Il paramento esterno non può iniziare il 29 giugno. Il primo giorno in cui il muratore è di nuovo libero è martedì 6 luglio. Sono 5 giorni lavorativi dopo l'inizio anticipato, quindi il ritardo di livellamento è 5. Il paramento esterno va ora dal 6 luglio al 13 luglio compreso. I telai iniziano comunque solo il 14 luglio, quindi la consegna resta lunedì 30 agosto. La finestra segnala *Data di fine progetto: invariata (30-08-2027)* e mostra una riga: *Build outer cavity leaf*, inizio vecchio 29-06-2027, inizio nuovo 06-07-2027, *5 g*.

I 5 giorni lavorativi di spostamento sono esattamente il margine del paramento esterno. Per questo *livellamento* dà qui lo stesso risultato. Il paramento esterno non ha più margine e ora è critico.

### Se i telai non arrivano il 14 luglio

Senza quel vincolo i telai possono iniziare venerdì 9 luglio, e la consegna è mercoledì 25 agosto. Il paramento esterno ha allora solo 2 giorni lavorativi di margine.

- Senza *livellamento* il paramento esterno si sposta comunque di 5 giorni lavorativi. Ora i telai devono aspettare: iniziano il 14 luglio, 3 giorni lavorativi dopo. Tutto ciò che viene dopo di loro si sposta, e la consegna passa dal 25 agosto al 30 agosto, anch'essa di 3 giorni lavorativi.
- Con *livellamento* non si sposta niente. Il paramento esterno non entra nei suoi 2 giorni lavorativi di margine. La finestra mostra il conflitto *Build outer cavity leaf*, 5 giorni, con il motivo *Capacità libera insufficiente entro il margine per risolvere questo conflitto*.

### E se il paramento esterno ha la priorità

Se dai al paramento esterno la priorità *Alta* (900), viene per primo. Resta il 29 giugno e ora cede il paramento interno: si sposta di 6 giorni lavorativi, dal 7 luglio al 13 luglio compreso. Il paramento interno ha solo 3 giorni lavorativi di margine, quindi spostarlo di 6 giorni è 3 di troppo. Gli elementi del tetto, i telai e tutto ciò che viene dopo si spostano di conseguenza. La consegna passa da lunedì 30 agosto a giovedì 2 settembre. Lo stesso muratore sovrassegnato dà quindi una data di fine diversa, a seconda di quale attività resta ferma.

### E se arriva un secondo muratore

Se imposti *Unità max* del muratore a 2, il muratore non è più sovrassegnato. *Calcola* segnala *Nessuna attività deve essere spostata — la pianificazione è già priva di conflitti*.

## Conseguenze e fraintendimenti

**«Il livellamento trova la pianificazione più corta.»** No. L'app lavora attività per attività, in un ordine fisso, e non cerca la migliore soluzione complessiva. Vedi l'esempio con la priorità: un'altra priorità dà un'altra data di fine.

**«Un'attività livellata è al sicuro.»** Il livellamento usa il margine. L'attività spostata ha allora meno margine, o nessuno, e può diventare critica, come il paramento esterno sopra. Se poi slitta, la consegna si sposta.

**«Il livellamento segue le mie modifiche successive.»** No. Il ritardo è un numero fisso di giorni lavorativi. Se il paramento interno diventa più corto dopo il livellamento, il paramento esterno inizia comunque 5 giorni lavorativi dopo, anche se non serve più. Livella di nuovo, allora. L'app riparte da zero.

**Non tutto si risolve spostando.** Se la risorsa non lavora nei giorni che l'attività richiede, oppure se l'attività, con la sua curva, chiede in un giorno più di quanto la risorsa può fornire, la risorsa resta sovrassegnata. L'app indica il motivo sull'attività.

**Il materiale non viene livellato.** Se il materiale chiede più della sua capacità in un giorno, l'app lo segnala come sovrassegnato, ma il livellamento lo lascia com'è.

**Attività bloccate.** Se tutte le attività in conflitto hanno priorità 1000, la finestra segnala *Nessuna attività deve essere spostata — la pianificazione è già priva di conflitti*, mentre la risorsa resta sovrassegnata. Dopo aver applicato, controlla quindi il messaggio *Sovrallocazione* nella barra multifunzione.

## Vedi anche

- [Risolvere una risorsa sovrassegnata](docs://howto-overbezetting-oplossen): i passi per trovare una risorsa sovrassegnata e livellarla.
- [Percorso critico e margine](docs://uitleg-kritiek-pad): che cos'è il margine e perché un'attività diventa critica.
- [Tipi di attività: durata, unità e lavoro](docs://uitleg-werkregels): come la durata di un'attività si muove insieme alle unità.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): tre torri che hanno bisogno delle stesse squadre e della gru a torre, e che cosa fa il livellamento in quel caso.
