# Gestire le risorse

Obiettivo: creare, modificare ed eliminare risorse (persone, macchine e materiali) nel tuo progetto, così da poterle assegnare alle attività.

## Quando ti serve

Prima di mettere un muratore o una gru su un'attività, quella persona o macchina deve esistere come risorsa. La risorsa registra quanto ne hai e in quali giorni lavora. Così l'app calcola se chiedi troppo alla risorsa in un solo giorno. Modifica una risorsa quando cambia il personale, per esempio quando si aggiunge un secondo muratore.

Due termini. **Unità max** è la capacità per giorno lavorativo: 1 è una persona o una macchina, 2 sono due. Un'**assegnazione** è una risorsa su un'attività (vedi [Assegnare risorse con una curva](docs://howto-resource-toewijzen)).

## Passaggi

### Creare una risorsa

1. Scegli *Risorse › Gestisci › Nuova risorsa*. Il pannello risorse occupa l'area di lavoro e in fondo alla tabella compare una riga vuota. Puoi anche aprire il pannello con *Risorse › Gestisci › Risorse* e poi scegliere *Nuova risorsa nel progetto*.
2. Scrivi il nome, per esempio *Bricklayer*.
3. Scegli il *Tipo*: *Manodopera* (il valore predefinito), *Attrezzatura*, *Materiale*, *Subappaltatore* o *Squadra*.
4. Compila gli altri campi se serve. Ogni campo ha un valore predefinito: *Unità max* è 1 e *Calendario* è *Calendario di progetto*. *Tariffa/ora* è vuoto. Puoi compilare *Unità* solo per il tipo *Materiale*, per esempio m³.
5. Premi Invio o clicca fuori dalla riga. La risorsa compare nella tabella. Con Invio si apre subito una riga vuota sotto, per la successiva. Premi Esc quando hai finito.

La riga diventa una risorsa solo quando ha un nome. Con Esc, o se clicchi fuori senza nome, l'app non crea nulla. L'ordine in cui compili i campi non conta: puoi scegliere prima il tipo e poi scrivere il nome.

### Modificare una risorsa

Modifica i campi nella riga. L'app salva il nome, la tariffa e l'unità quando lasci il campo. L'app salva subito gli altri campi.

- L'app accetta *Unità max* solo se il valore è maggiore di 0. Con 0 o meno il campo mostra un bordo rosso e torna al valore precedente.
- *Calendario* decide in quali giorni lavora la risorsa. Scegli *Calendario di progetto* o un calendario proprio. Con *+ Calendario risorsa* ne crei uno nuovo, e la matita (*Modifica…*) apre il calendario scelto. Se un'attività lavora in un giorno in cui la risorsa non lavora secondo il suo calendario, quel giorno conta come sovrassegnato. Come creare un calendario risorsa è descritto in [Impostare un calendario risorsa](docs://howto-resourcekalender-instellen).
- *Tariffa/ora* e *Totale*: *Totale* è il numero di ore caricate di quella risorsa moltiplicato per la tariffa. Un intonacatore con 32 ore caricate e una tariffa di 50 all'ora arriva a 1.600,00. In fondo alla tabella c'è la somma di tutte le risorse.
- *Squadra* raggruppa una risorsa sotto una risorsa di tipo *Squadra*. È solo un raggruppamento: l'app non somma la capacità né il carico dei membri alla squadra.
- Il quadratino colorato a sinistra è il colore della risorsa. Serve solo per la visualizzazione e non ha effetto sulla pianificazione.

### Capacità che cambia nel tempo

Il tuo secondo muratore arriva solo il 19 luglio? Clicca la freccia accanto a *Unità max*. Sotto *Capacità scaglionata nel tempo* scegli *Aggiungi fase*. Ogni fase ha una data (*Da*) e un numero (*Unità max*). A partire da quella data vale quel numero. Senza fasi vale sempre il valore fisso.

Una nuova fase inizia con la data di oggi e 1 unità. Cambia entrambi, altrimenti vale una capacità di 1 da oggi.

### Eliminare una risorsa

1. Clicca il cestino nella riga.
2. Se la risorsa ha assegnazioni, l'app chiede una conferma, per esempio *'Bricklayer' ha 4 assegnazione/i — eliminare?* Clicca la spunta per eliminare o la croce per annullare. Senza assegnazioni la risorsa scompare subito.

Le assegnazioni della risorsa vengono eliminate con essa. Se un'attività ha un tipo di attività diverso da *Durata e unità fisse*, l'app divide il lavoro della risorsa eliminata tra le risorse rimaste. A seconda del tipo di attività, cambiano le unità delle risorse o la durata dell'attività. Se cambia la durata, la pianificazione non è più aggiornata.

Puoi annullare la creazione, la modifica e l'eliminazione con *Annulla* (Ctrl+Z).

### La panoramica compatta nella colonna laterale

*Risorse › Gestisci › Dock risorse* mette una panoramica compatta nella colonna laterale destra, accanto a *Proprietà*. Lì vedi il nome e il colore di ogni risorsa. Accanto a una risorsa sovrassegnata vedi un segnale di avvertimento (*Sovrassegnato*). Lì puoi cambiare solo *Unità max*. Se selezioni una o più attività, la panoramica mostra solo le risorse di quelle attività.

## Errori comuni e cosa fa l'app in quel caso

**Solo il tipo *Materiale* fa differenza per il calcolo.** Manodopera, Attrezzatura, Subappaltatore e Squadra sono trattati allo stesso modo. Il materiale non conta nella durata di un'attività e non viene livellato. Nell'istogramma anche la riga *Tutte le risorse* non conta il materiale.

**Nessun nome, nessuna risorsa.** Una riga vuota scompare senza lasciare traccia.

**Una nuova fase nella capacità.** Se dimentichi di cambiare la data e il numero, la capacità è 1 da oggi.

**Eliminare una risorsa che ti serve ancora.** Se la elimini per sbaglio, premi subito Ctrl+Z. Anche le assegnazioni tornano.

## Vedi anche

- [Assegnare risorse con una curva](docs://howto-resource-toewijzen): mettere una risorsa su un'attività.
- [Impostare un calendario risorsa](docs://howto-resourcekalender-instellen): fissare i giorni lavorativi di una risorsa.
- [Risolvere le risorse sovrassegnate](docs://howto-overbezetting-oplossen): cosa fare quando una risorsa ha troppo da fare in un giorno.
- [Pannello risorse](docs://ref-resourcepaneel): tutti i campi e i pulsanti del pannello risorse.
