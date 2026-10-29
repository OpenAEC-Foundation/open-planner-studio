# Spostare un progetto

Obiettivo: spostare tutta la pianificazione a una nuova data di inizio, e vedere prima che effetto ha sulla fine.

## Quando ti serve

L'inizio dei lavori cambia: il permesso arriva più tardi, oppure riusi la pianificazione di una casa precedente per la successiva. Spostare ogni attività una per una richiede molto lavoro. Con **Sposta progetto** inserisci una sola nuova data di inizio e l'app sposta tutto insieme.

La fine del progetto non sempre si sposta della stessa quantità dell'inizio. Il **calendario** non si sposta insieme: festività, ferie edili e fermo invernale restano su date fisse. Un esempio: con *Home › File › Nuovo* crei un progetto con *Data di inizio* 29-09-2026, *Paese* su *Paesi Bassi* e *Ferie edili* su *Nessuna*. Ci inserisci una pianificazione di 30 giorni lavorativi che finisce il 9 novembre 2026. Se la sposti al 14 dicembre 2026, 76 giorni solari dopo, finisce il 26 gennaio 2027. Sono 78 giorni dopo, perché il 25 dicembre e il 1 gennaio ora sono giorni liberi nella tua pianificazione. La durata resta di 30 giorni lavorativi. L'anteprima nella finestra mostra questo prima che tu cambi qualcosa.

## Passi

1. Scegli *Pianificazione › Pianificazione › Sposta progetto…*. Il pulsante è disattivato finché il progetto non ha una data di inizio.
2. Sotto *Inizio attuale del progetto* vedi dove il progetto inizia adesso. Sotto *Nuovo inizio del progetto* scegli la nuova data.
3. Se il progetto ha delle baseline, compare la casella *Sposta anche le baseline*. Lasciala disattivata se vuoi continuare a vedere lo spostamento come scostamento (vedi le insidie).
4. Clicca su *Calcola anteprima*. L'app calcola per intero la pianificazione spostata, senza modificare nulla nel tuo progetto.
5. Controlla l'anteprima (vedi sotto). Se è corretta, clicca su *Sposta*.

Nell'anteprima vedi:

- lo spostamento in giorni solari (*Spostamento: 76 giorni solari in avanti*);
- *Inizio del progetto* e *Fine del progetto*, da prima a dopo;
- un avviso rosso se il calendario interferisce, oppure il messaggio che la durata del progetto resta invariata;
- il numero di attività spostate e che cos'altro si sposta insieme;
- gli avvisi che devi leggere (vedi le insidie).

L'app calcola subito la nuova pianificazione, quindi non devi usare **Calcola** (F5), e adatta la vista a tutto il progetto. Tutto insieme è un'unica azione per *Annulla* (Ctrl+Z).

Il pulsante *Sposta* funziona solo dopo un'anteprima senza errori, e solo se la nuova data è diversa da quella attuale. Se cambi la data o la casella, l'anteprima scompare e devi calcolare di nuovo.

### Cosa si sposta insieme e cosa no

Si sposta: l'inizio e la fine di ogni attività, l'inizio effettivo e la fine effettiva, le date dei vincoli (anche di un vincolo fisso obbligatorio, vedi [Vincoli e scadenze](docs://uitleg-constraints)), le scadenze, la data di stato, gli ancoraggi delle relazioni esterne e i passi di disponibilità delle risorse. Anche l'inizio del progetto e, se l'hai compilata, la data di fine del progetto si spostano.

Non si sposta:

- i calendari, quindi festività, ferie edili e fermo invernale;
- le baseline, a meno che tu non attivi *Sposta anche le baseline*;
- un campo personalizzato compilato di tipo *Data*.

## Insidie e cosa fa l'app

**La fine si sposta di un numero diverso di giorni.** Se l'anteprima vede che la fine si sposta di più o di meno giorni solari dell'inizio, oppure che la durata del progetto in giorni lavorativi cambia, mostra un avviso rosso con i numeri. Puoi comunque annullare.

**Le baseline restano dove sono.** Una baseline serve a misurare lo scostamento. Se sposti il progetto con la casella disattivata, vedi lo spostamento come scostamento dalla baseline. Se attivi la casella, le baseline si spostano insieme alla pianificazione. Si spostano solo le loro date. La data in cui la baseline è stata salvata resta uguale.

**Un progetto in corso.** Le date effettive si spostano insieme. In un progetto in cui hai già inserito l'avanzamento, questo non è sempre ciò che vuoi. L'app avvisa: *Controlla se è corretto per un progetto in corso.*

**Relazioni esterne.** L'ancoraggio nel tuo progetto si sposta insieme, ma il progetto di origine non si sposta. Aggiorna le relazioni esterne dopo lo spostamento con *Home › Attività › Collegamento ▾ › Aggiorna tutte le relazioni esterne*. Vedi [Relazioni esterne verso un altro progetto](docs://howto-externe-relaties).

**Festività che non arrivano abbastanza lontano.** Un calendario con festività generate copre un certo numero di anni. Se la pianificazione spostata va oltre, l'app calcola quell'anno senza festività. L'anteprima avvisa, per esempio: *Le festività generate del calendario «Bouwkalender NL» coprono 2025–2029; la pianificazione spostata arriva al 2030. Rigenera le festività.* Sposta prima il progetto. Apri poi *Pianificazione › Calendario › Calendario*: accanto alle festività ora c'è scritto *Rigenera*. Conferma con *Applica* e l'app ricalcola. L'intervallo delle nuove festività segue le date del progetto, quindi rigenerare prima dello spostamento non serve.

**La data è nel passato.** Questo è consentito, ma l'anteprima lo segnala: *La nuova data di inizio è nel passato.*

**Cambiare l'inizio del progetto in Impostazioni progetto è un'altra cosa.** Se cambi la data di inizio in *Impostazioni › Progetto › Impostazioni progetto* e scegli *Applica*, la pianificazione non si sposta. Si spostano alla nuova data solo le attività senza predecessore o vincolo che si troverebbero prima del nuovo inizio, e l'app ti dice quante sono. Se vuoi spostare tutto, usa *Sposta progetto…*.

## Vedi anche

- [Percorso critico e margine](docs://uitleg-kritiek-pad): come la pianificazione calcola e perché la fine si sposta.
- [Aggiungere relazioni](docs://howto-relaties-leggen): le relazioni restano semplicemente dove sono quando sposti il progetto.
- [Nuovo progetto e Impostazioni progetto](docs://ref-projectinfo): che cosa fa la data di inizio in Impostazioni progetto.
