# Risolvere una risorsa sovrassegnata

Obiettivo: vedere dove una risorsa ha troppo da fare in un giorno e risolverlo, di solito con il livellamento delle attività.

## Quando ti serve questo

Sulla carta la tua pianificazione funziona, ma il muratore è assegnato a due muri che si costruiscono negli stessi giorni. L'app dice che la risorsa è **sovrassegnata**. Una risorsa è sovrassegnata in un giorno lavorativo se la pianificazione le chiede più della sua capacità in quel giorno (*Unità max*), oppure se quel giorno non lavora secondo il suo calendario.

Cerca prima dove una risorsa è sovrassegnata. Scegli poi una soluzione. Il **livellamento** è la soluzione che l'app calcola per te: fa iniziare le attività più tardi, finché la risorsa riesce a farcela. Come funziona il calcolo, lo leggi in [Livellamento risorse](docs://uitleg-nivelleren).

## Passaggi

### 1. Trova dove una risorsa è sovrassegnata

1. Guarda nella barra multifunzione in *Risorse › Sovrallocazione*. Mostra *Nessuna* oppure, in rosso, il numero di risorse sovrassegnate, per esempio *1 risorsa*. Dopo un calcolo, anche la barra di stato mostra *⚠ 1 risorsa/e sovrassegnata/e*.
2. Fai clic su quel messaggio nella barra di stato. Il pannello *Avvisi* si apre a destra, con una riga per ogni risorsa, per esempio *Bricklayer* con *Sovrassegnata per 5 giorno/i (29-06-2027 – 05-07-2027)*.
3. Fai clic su quella riga. L'app attiva l'istogramma, sceglie la risorsa e seleziona tutte le attività assegnate a quella risorsa.
4. Guarda l'istogramma sotto il Gantt. Le barre rosse sono giorni sovrassegnati. Se muovi il mouse sopra un giorno, vedi quali attività contribuiscono, per esempio *2 attività contribuiscono il 2027-06-30* con i nomi sotto.

Puoi anche attivare tu stesso l'istogramma con *Risorse › Istogramma › Istogramma*. Scegli una risorsa nell'elenco a sinistra, oppure scorri le risorse con *Precedente* e *Successiva*. Un punto rosso nell'elenco significa che quella risorsa è sovrassegnata. La riga *Tutte le risorse* somma le risorse, esclusi i materiali.

Se un'attività è selezionata, l'istogramma mostra solo il carico di quell'attività e solo le risorse assegnate a essa. Premi Esc per deselezionare e vedere di nuovo l'intero progetto.

### 2. Scegli una soluzione

- **Più capacità.** Se arriva davvero un secondo muratore, imposta *Unità max* su 2 (vedi [Gestire le risorse](docs://howto-resources-beheren)). La risorsa non è più sovrassegnata.
- **Meno unità al giorno.** Abbassa *Unità* o scegli un'altra curva per l'assegnazione (vedi [Assegnare risorse con una curva](docs://howto-resource-toewijzen)).
- **Metti le attività una dopo l'altra.** Aggiungi una relazione tra le due attività, così la seconda inizia solo quando la prima è completata (vedi [Aggiungere relazioni](docs://howto-relaties-leggen)).
- **Livellamento.** L'app fa iniziare un'attività più tardi.

### 3. Livellamento

1. Assicurati che la pianificazione sia stata calcolata con **Calcola** (F5), per esempio tramite *Home › Pianificazione › Calcola*.
2. Scegli *Risorse › Livellamento › Livella…*. Si apre la finestra *Livella risorse*.
3. Decidi se la data di fine del progetto può cambiare. Se lasci la casella *Livella solo entro il margine (attenuazione) — la data di fine progetto resta invariata* non selezionata, la data di fine può spostarsi. Se la selezioni, l'app sposta le attività solo entro il loro margine.
4. Sotto *Risorse* trovi le risorse che verranno livellate. Per impostazione predefinita sono selezionate tutte le risorse, tranne i materiali. Deseleziona una risorsa che vuoi lasciare com'è.
5. Fai clic su *Calcola*. Mentre calcola, mostra *Calcolo in corso…* e puoi interrompere con *Interrompi*. La pianificazione non cambia ancora: è una proposta.
6. Leggi la proposta. In alto c'è la data di fine, per esempio *Data di fine progetto: invariata (30-08-2027)* oppure *Data di fine progetto: 25-08-2027 → 30-08-2027*. Sotto c'è una tabella con, per ogni attività, l'*Inizio precedente*, il *Nuovo inizio* e i *Giorni spostati*, per esempio *Build outer cavity leaf*, 29-06-2027, 06-07-2027 e *5 d*.
7. Scegli *Applica*. L'app scrive gli slittamenti nelle attività e ricalcola subito la pianificazione. Premere F5 non è necessario. *Annulla* chiude la finestra senza modifiche.
8. Controlla *Risorse › Sovrallocazione*. Ora mostra *Nessuna*.

Se cambi un'opzione nella finestra dopo aver fatto clic su *Calcola*, la proposta scompare. Fai allora di nuovo clic su *Calcola*. Se la pianificazione cambia mentre l'app calcola, l'app mostra *La pianificazione è cambiata durante il calcolo. Fai di nuovo clic su Calcola.*

### Decidere quale attività resta ferma

L'app colloca le attività una per una. Le attività che vengono prima restano dove sono. Prima vanno le attività con la priorità più alta. Con la stessa priorità, prima va l'attività con il margine minore.

Se vuoi decidere tu quale attività resta ferma, dalle una priorità più alta. Fai clic destro sulla barra dell'attività nel Gantt e scegli *Priorità*, poi *Bassa* (100), *Normale* (500) o *Alta* (900). *Normale* è il valore predefinito. Puoi anche scrivere tu stesso un numero da 0 a 1000 nella colonna *Priorità di livellamento*: fai clic sul **+** a destra dell'intestazione della tabella attività (*Aggiungi colonna*) e scegli quella colonna sotto *Pianificazione*. Più alto è il numero, più è probabile che l'attività resti ferma. L'app non accetta un numero sopra 1000. Un'attività con priorità 1000 non si sposta mai per la capacità.

### Annullare e ripetere

- *Annulla* (Ctrl+Z) annulla *Applica* in un solo passo.
- *Risorse › Livellamento › Cancella livellamento* rimuove tutto il livellamento dalle attività. Il pulsante è grigio finché non c'è livellamento. Così la risorsa torna sovrassegnata, come prima.
- Se da allora hai cambiato la pianificazione, basta scegliere di nuovo *Livella…*. L'app riparte da zero: i vecchi slittamenti non contano.

## Problemi e cosa fa l'app

**Non ancora calcolata.** Se la pianificazione non è stata calcolata, la finestra mostra *Calcola la pianificazione (F5) prima di livellare.* e *Calcola* non è disponibile.

**Conflitti rimanenti.** Non tutte le risorse sovrassegnate si risolvono spostando le attività. Le attività che restano sono elencate sotto *Conflitti rimanenti*, con il numero di giorni e il motivo:

- *Capacità libera insufficiente entro il margine per risolvere questo conflitto.* Lo vedi con l'*attenuazione*: entro il margine dell'attività non c'è un momento libero. Deseleziona la casella e la data di fine può cambiare.
- *La risorsa non lavora in tutti i giorni richiesti da questa attività — lo spostamento non risolve il problema.* La risorsa ha giorni di riposo nel suo calendario, a metà dell'attività. Cambia il calendario o l'attività.
- *Bricklayer raggiunge un picco di 2 unità/giorno, la capacità è 1 — non risolvibile spostando.* Con la sua curva, l'attività da sola chiede in un giorno più di quanto la risorsa può fornire. Scegli un'altra curva o abbassa le unità.

**L'app dice** *Nessuna attività deve essere spostata — la pianificazione è già priva di conflitti.* Se questa riga compare insieme all'elenco *Conflitti rimanenti* nella proposta, fidati dell'elenco. La riga dice solo che non c'è niente da spostare. Se la riga compare senza elenco, mentre *Risorse › Sovrallocazione* segnala ancora una risorsa, allora tutte le attività in conflitto sono fissate alla priorità 1000 oppure sono già iniziate. Non si spostano e la finestra non le segnala come conflitto. Controlla quindi sempre *Sovrallocazione* dopo aver applicato.

**Attività che non si spostano.** Un'attività già iniziata o completata non si sposta mai. Il suo carico conta comunque. Anche i cardini e le fasi non si spostano.

**I materiali non vengono livellati.** Se una risorsa materiale chiede più delle sue *Unità max* in un giorno, risulta sovrassegnata in *Sovrallocazione*, ma non compare nella finestra di livellamento.

**Il livellamento non si adatta.** I ritardi di livellamento restano come sono stati calcolati. Se cambi più tardi la durata di un'attività, un'attività livellata resta dov'è, anche se quel posto non serve più. Livella allora di nuovo.

**Sovrassegnata a causa del calendario.** Se la risorsa non lavora in un giorno secondo il suo calendario, il pannello *Avvisi* dice per esempio *Sovrassegnata per 5 giorno/i (29-06-2027 – 05-07-2027), di cui 1 giorno/i in cui la risorsa non lavora secondo il suo calendario*. Se un'attività attraversa sempre un giorno così, cioè il secondo motivo sopra, il livellamento non lo risolve.

## Vedi anche

- [Livellamento risorse](docs://uitleg-nivelleren): che cosa sposta il livellamento, entro il margine e oltre, e che cosa non fa.
- [Gestire le risorse](docs://howto-resources-beheren): regolare la capacità e il calendario di una risorsa.
- [Aggiungere relazioni](docs://howto-relaties-leggen): mettere le attività una dopo l'altra.
- [Notifiche e avvisi](docs://ref-meldingen): l'avviso su una risorsa sovrassegnata nel pannello *Avvisi*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): gli intonacatori sono sovrassegnati per 5 giorni. Con *Livella solo entro il margine (attenuazione) — la data di fine progetto resta invariata* selezionata, la fine resta al 17 agosto 2027 e resta un conflitto rimanente. Con la casella non selezionata (predefinita) tutto si risolve e la fine si sposta al 24 agosto 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): la gru a torre è sovrassegnata per 65 giorni e gli intonacatori per 15 giorni. Con la casella *Livella solo entro il margine (attenuazione) — la data di fine progetto resta invariata* non selezionata, il livellamento sposta la fine dal 9 maggio al 12 ottobre 2028.
