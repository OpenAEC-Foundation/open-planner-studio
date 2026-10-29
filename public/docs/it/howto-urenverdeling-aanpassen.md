# Modificare la distribuzione delle ore

Obiettivo: per un'assegnazione, decidi tu quanto lavora la risorsa su ogni giorno lavorativo dell'attività, invece di usare una curva standard.

## Quando ti serve

Una curva come *A campana* è una forma fissa. A volte ne sai di più. Il muratore inizia il paramento esterno della cavità a metà potenza, perché il ponteggio è ancora in montaggio, e poi lavora a tempo pieno. Oppure vuoi tenere un picco appena sotto la capacità. Allora modifichi la **distribuzione delle ore**.

Lavori con **fasi**: giorni lavorativi consecutivi in cui la risorsa lavora con le stesse unità. La distribuzione cambia solo le ore al giorno di questa assegnazione. Le date dell'attività non cambiano.

## Passaggi

L'esempio è il paramento esterno della cavità: 6 giorni lavorativi, un muratore, 48 ore.

1. Seleziona l'attività. Il pannello *Proprietà* è a destra; se non lo vedi, attivalo con *Vista › Pannelli › Proprietà*.
2. Nel blocco *Assegnazioni* clicca sul nome del muratore. *Curva* e il pulsante *Distribuzione ore…* compaiono sotto di esso. Clicca su *Distribuzione ore…*. Si apre la finestra *Distribuzione ore per fasi*. Parti da ciò che l'app registra al momento: per questo paramento esterno della cavità, una fase di 6 giorni con unità pari a 1.
3. Se serve, scegli un punto di partenza in *Applica forma:*. Con *A campana* l'app crea cinque fasi: 0,18 unità il primo e l'ultimo giorno, 0,84 il secondo e il quinto giorno e 1,98 i due giorni centrali. Il totale resta 48 ore.

### Modificare le fasi

Puoi lavorare nella tabella o nella striscia sopra di essa.

- Digita un altro valore di *Impegno (unità/giorno)* in una fase. Le colonne *Ore/giorno* e *Ore* si calcolano di conseguenza.
- Cambia il numero di *Giorni* di una fase. L'ultima fase va sempre fino alla fine dell'attività e prende i giorni che restano.
- Scegli *Dividi* per dividere una fase in due, per 6 giorni in 3 e 3. Scegli *Unisci* per unire una fase con la successiva.
- Nella striscia trascini un confine per allungare o accorciare una fase, trascini il bordo superiore per impostare l'impegno e fai doppio clic su un giorno per dividere una fase.

### Applicare

Scegli *Applica*. Con *Annulla* la finestra si chiude senza modifiche.

Un esempio. Scegli *Dividi*, imposta *Giorni* della prima fase a 2 e l'impegno di quella fase a 0,5. La seconda fase dura quindi 4 giorni con impegno 1. Il totale è 2 × 0,5 × 8 + 4 × 1 × 8 = 40 ore.

Dopo *Applica* la curva dell'assegnazione passa a *Contorno*, disattivata. *Unità* resta com'era. Accanto al nome compare ora un'icona di grafico, anche quando l'assegnazione è chiusa. L'istogramma e le risorse sovrassegnate si aggiornano subito secondo la nuova distribuzione. Ricalcolare non serve, perché nessuna data si sposta.

### Rilasciare la distribuzione

Se l'assegnazione ha una distribuzione propria, la finestra ha anche *Rilascia distribuzione*. Così elimini la tua distribuzione e l'app torna a *Unità* e alla curva. Scegli questa opzione anche se vuoi cambiare la curva, perché il menu a tendina *Curva* è disattivato finché c'è una distribuzione propria.

## Insidie e cosa fa allora l'app

**Il totale cambia con questo.** Non dividi le ore, le decidi tu. Se imposti una fase a 0,5 invece di 0,18, il totale aumenta. Il totale in ore si trova in fondo alla finestra, quindi controllalo prima di cliccare su *Applica*.

**Cosa fanno le unità dopo dipende dal tipo di attività.** Con *Durata e unità fisse* altri valori di *Unità* non cambiano nulla nella distribuzione. Con *Durata e lavoro fissi* l'app scala le ore al giorno insieme alle nuove unità: con unità pari a 2 invece di 1 ogni giorno raddoppia, e raddoppia anche il totale (da 32 a 64 ore), mentre la durata resta uguale. Con *Lavoro fisso* le unità cambiano la durata dell'attività: la distribuzione viene allora compressa o allungata sulla nuova durata, con lo stesso totale. Con *Unità fisse* le unità cambiano anche la durata; controlla dopo il totale in fondo alla finestra.

**Se cambi la durata dell'attività, la distribuzione si allunga con essa.** La forma resta uguale. Con *Durata e unità fisse* e con *Unità fisse* il totale cresce in proporzione alla durata: se la durata di un'attività con una distribuzione propria raddoppia da 4 a 8 giorni lavorativi, anche il totale raddoppia, da 32 a 64 ore. Con *Durata e lavoro fissi* e con *Lavoro fisso* il totale resta uguale (32 ore resta 32 ore) e le unità calano.

**Il lavoro segue la distribuzione.** *Lavoro (h)* diventa la somma delle tue fasi, anche con *Lavoro fisso*. La durata dell'attività non cambia per questo.

**Unità non valide.** Un impegno vuoto o negativo riceve un bordo rosso e *Applica* viene allora disattivato. Una fase con impegno 0 è consentita. Una fase così resta entro la durata dell'attività.

**Tutto vale per questa sola assegnazione.** L'app lo dice da sé: *La distribuzione cambia solo le ore al giorno di questa assegnazione; le date e le divisioni dell'attività restano come sono.* Altre risorse della stessa attività mantengono la propria distribuzione.

**Il livellamento segue la distribuzione.** Lo strumento di livellamento conta le stesse ore al giorno dell'istogramma.

**Annullamento.** *Applica* e *Rilascia distribuzione* sono ciascuno un passo per *Annulla* (Ctrl+Z).

## Vedi anche

- [Risorse assegnate con una curva](docs://howto-resource-toewijzen): assegnare una risorsa a un'attività e scegliere una curva.
- [Risolvere le risorse sovrassegnate](docs://howto-overbezetting-oplossen): cosa fare quando una risorsa ha troppo da fare in un giorno.
