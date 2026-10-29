# Impostare gli orari di lavoro

Obiettivo: registrare per giorno della settimana a quali orari un calendario lavora, così che le attività in ore si svolgano negli orari giusti.

## Quando ti serve

Il venerdì pomeriggio non si lavora. La squadra lavora dalle 06:00 alle 22:00 su due turni. C'è una squadra di notte. La pausa dura meno di un'ora. Finché pianifichi solo in giorni, bastano *Inizio (ora)*, *Fine (ora)* e la pausa ([Creare e assegnare un calendario](docs://howto-kalender-maken-en-toewijzen)). Se pianifichi le attività in ore, l'app conta i minuti lavorativi all'interno delle **fasce orarie** del calendario. Nell'app si chiamano *fasce*: una fascia è un periodo continuo di tempo lavorativo in un giorno della settimana, e uno spazio tra due fasce è una pausa. Che cosa significa questo per la tua pianificazione è spiegato in [Giorni e ore](docs://uitleg-dagen-en-uren).

Per dare a un calendario normale delle fasce orarie ti serve *Attiva pianificazione oraria* ([Attivare la pianificazione oraria](docs://howto-urenplanning-aanzetten)). Se il calendario ha già delle fasce, per esempio da un file di MS Project, il riquadro *Orari di lavoro* è sempre presente e puoi cambiare le fasce anche con la pianificazione oraria disattivata.

## Passaggi

### Scegliere una preimpostazione di turni

1. Scegli *Pianificazione › Calendario › Calendario* e seleziona il calendario a sinistra.
2. Nel riquadro *Orari di lavoro* clicca una preimpostazione. Sostituisce i giorni lavorativi e gli orari di lavoro del calendario.
3. Clicca *Applica*.

Ogni preimpostazione fa questo:

- *Turno diurno*: dal lunedì al venerdì dalle 08:00 alle 16:00 senza pausa. Così il calendario torna un calendario normale, senza fasce orarie.
- *2 turni*: dal lunedì al venerdì dalle 06:00 alle 14:00 e dalle 14:00 alle 22:00, 16 ore in totale.
- *3 turni*: dal lunedì al venerdì tre turni: dalle 06:00 alle 14:00, dalle 14:00 alle 22:00 e dalle 22:00 alle 06:00 del giorno successivo, 24 ore in totale.
- *Turno notturno*: dal lunedì al venerdì dalle 22:00 alle 06:00 del giorno successivo, 8 ore.
- *24/7*: tutti e sette i giorni dalle 00:00 alle 24:00.

### Impostare gli orari di lavoro per giorno della settimana

1. Nel riquadro *Orari di lavoro* clicca *Imposta per giorno della settimana…*. Sotto i pulsanti compare una riga per ogni giorno della settimana, con l'orario di lavoro di quel giorno. Il calendario ha ora fasce orarie per ogni giorno della settimana. Se il calendario le ha già, questa panoramica è subito aperta; il pulsante si chiama allora *Nascondi orari di lavoro* e la richiude.
2. Regola l'ora di inizio e l'ora di fine di ogni fascia nei due campi orari. Scrivi l'ora e premi Invio, oppure usa le frecce (15 minuti per passo). I campi seguono il *Formato dell'ora* nelle impostazioni; *13:00* e *1:00 PM* funzionano entrambi.
3. Se vuoi inserire una pausa, clicca **+** (*Aggiungi fascia*) per quel giorno e regola gli orari delle fasce in modo che ci sia una pausa tra le due. Una nuova fascia inizia alle 08:00 e finisce alle 16:00.
4. Per una fascia che va oltre la mezzanotte, spunta *giorno successivo*. La fascia conta per il giorno in cui inizia.
5. Clicca il cestino dietro una fascia per eliminarla. Un giorno senza fasce appare come *Non lavorativo*.
6. Per un giorno dal lunedì al venerdì, clicca il simbolo di copia (*Copia su tutti i giorni lavorativi*) per copiare le fasce di quel giorno su tutti i giorni dal lunedì al venerdì.
7. Sopra il riquadro *Orari di lavoro* c'è *Giorno lavorativo standard*: gli orari di lavoro per giorno che l'app ricava dalle fasce e con cui calcola. Il numero cambia subito quando modifichi le fasce. Se il calendario ha delle ore per giorno proprie (per esempio da Primavera P6), quel valore proprio viene mantenuto e va con l'esportazione, finché una preimpostazione non lo sostituisce. Se quel valore proprio è diverso dal *Giorno lavorativo standard*, appare subito sotto il numero un riquadro arancione, per esempio: *Il file ha un proprio giorno lavorativo di 8h. Questo valore viene mantenuto all'esportazione verso MS Project e P6. Lì un giorno vale 8h, qui 10h.* Il riquadro scompare appena le fasce danno la stessa somma per giorno, o quando una preimpostazione sostituisce il valore proprio. Il riquadro non cambia il calcolo. Clicca *Applica*.

**Esempio: un venerdì pomeriggio libero.** Clicca *Imposta per giorno della settimana…*. Elimina la seconda fascia (dalle 13:00 alle 16:00) per *Ven*. Il venerdì ora ha 5 ore, gli altri giorni 8. Il *Giorno lavorativo standard* resta di 8 ore.

### Salvare una preimpostazione propria

1. Clicca *Salva come preimpostazione…* e scrivi un nome nel campo *Nome preimpostazione*.
2. Clicca *Salva*. La preimpostazione ora appare tra le altre, e puoi usarla in ogni progetto. Con la croce accanto la elimini di nuovo.

Una preimpostazione propria è salvata su questo dispositivo, non nel file di progetto.

## Errori comuni e cosa fa l'app

**Una preimpostazione sostituisce tutto.** Se scegli una preimpostazione, i giorni lavorativi e gli orari di lavoro che hai impostato prima spariscono. Le festività restano.

**I pulsanti dei giorni cambiano le fasce.** Se disattivi un giorno sotto *Giorni lavorativi*, spariscono le fasce di quel giorno. Se lo riattivi, riprende le fasce che aveva quando hai aperto la finestra (o dopo l'ultima preimpostazione); altrimenti prende quelle del primo giorno lavorativo. *Lun–ven* fa lo stesso per il lunedì fino al venerdì e toglie le fasce di sabato e domenica. *Continuo (24/7)* sostituisce tutte le fasce: ogni giorno ottiene dalle 00:00 alle 24:00.

**Regolare gli orari di lavoro con la pianificazione oraria disattivata.** Un calendario con fasce orarie conserva il riquadro *Orari di lavoro*, anche quando disattivi la pianificazione oraria. Lì cambi semplicemente le fasce. Se scegli *Turno diurno*, torna un calendario normale con i campi *Inizio (ora)*, *Fine (ora)* e la pausa; rimettere delle fasce è allora possibile solo con la pianificazione oraria attiva.

**Nessun orario di lavoro utilizzabile.** Un calendario senza fasce o senza giorni lavorativi non può gestire un'attività in ore. L'app segnala allora *Questo calendario non ha orari di lavoro validi. Controlla giorni e orari lavorativi.*

## Vedi anche

- [Giorni e ore](docs://uitleg-dagen-en-uren): come l'app conta gli orari di lavoro e ricava il giorno lavorativo standard.
- [Attivare la pianificazione oraria](docs://howto-urenplanning-aanzetten): pianificare un'attività in ore.
- [Calendari e giorni lavorativi](docs://uitleg-kalenders): quale calendario vale per quale attività.
- [Finestre del calendario](docs://ref-kalenders): tutti i campi delle finestre del calendario.
