# Generare festività e ferie edili

Obiettivo: avere nel calendario le festività di un paese, ed eventualmente le ferie edili, e aggiungere dove serve un giorno o un periodo libero di tua scelta.

## Quando ti serve questo

Senza festività l'app pianifica semplicemente lavoro a Natale o a Koningsdag. Un nuovo progetto riceve già le festività olandesi, purché *Modalità cantiere* sia attiva. Genera di nuovo se ti serve un altro paese o regione, se vuoi includere le ferie edili, o se il tuo progetto cade al di fuori degli anni per cui sono state create le festività. Questi anni contano: per l'app un giorno fuori da questi anni è semplicemente un giorno lavorativo. Come l'app tiene conto di una festività nel conteggio, lo puoi leggere in [Calendari e giorni lavorativi](docs://uitleg-kalenders).

Le ferie edili sono le ferie collettive del settore edile olandese, tre settimane in estate. Nell'app sono disattivate come impostazione predefinita.

## Passaggi

### Generare festività

1. Scegli *Pianificazione › Calendario › Calendario* e seleziona a sinistra il calendario in cui devono finire le festività.
2. Clicca su *Genera festività…*. Sotto il pulsante si apre un blocco con le scelte.
3. Scegli il *Paese*: Paesi Bassi, Germania, Belgio, Francia, Regno Unito, Austria, Svizzera, oppure *Nessuna festività*. Per alcuni paesi compare anche un elenco *Regione*, per esempio uno stato federato in Germania. *Nazionale* lascia solo le festività che valgono in tutto il paese.
4. Per i Paesi Bassi scegli *Ferie edili*: *Nessuna* (predefinito), *Nord*, *Centro* o *Sud*. Le ferie edili compaiono nell'elenco come un unico periodo, per esempio *Ferie edili (Nord)*, tre settimane da lunedì a venerdì. Questa scelta compare solo se *Modalità cantiere* è attiva.
5. Sotto le scelte c'è un riepilogo, per esempio *21 festività, 2026–2028*. Clicca su di esso per vedere le date.
6. Clicca su *Genera*. L'elenco *Festività* è ora compilato.
7. Clicca su *Applica*. L'app ricalcola subito la pianificazione.

Per i Paesi Bassi l'app inserisce ogni anno nell'elenco Nieuwjaar, Goede Vrijdag, Pasen (due giorni), Koningsdag, Hemelvaart, Pinksteren (due giorni) e Kerst (25 e 26 dicembre) (Capodanno, Venerdì Santo, Pasqua, Giorno del Re, Ascensione, Pentecoste e Natale). Se Koningsdag cade di domenica, è il 26 aprile. Bevrijdingsdag (Giorno della Liberazione) è nell'elenco solo negli anni di lustro, come 2025 e 2030.

Gli anni seguono il periodo del progetto: dall'anno prima della data di inizio fino all'anno dopo la data di fine. Se il progetto non ha una data di fine, fino a tre anni dopo l'anno di inizio. Modifichi inizio e fine in *Impostazioni › Progetto › Impostazioni progetto*.

### Rigenerare dopo un nuovo periodo di progetto

Se il tuo progetto viene spostato, o ottiene una data di fine successiva, le festività non coprono più i nuovi anni. L'app lo segnala nella finestra *Calendari*, per esempio *Le festività coprono 2025–2028; vuoi rigenerarle fino al 2030 compreso?* Clicca poi su *Rigenera*. L'app usa le stesse scelte di prima (paese, regione, ferie edili) per gli anni del progetto. Clicca poi su *Applica*. Questo messaggio compare solo per un calendario le cui festività sono state generate in precedenza.

### Aggiungere un giorno o un periodo libero di tua scelta

1. Nella finestra *Calendari*, clicca su *Aggiungi festività*. In fondo all'elenco compare una nuova riga, con la data di oggi sotto *Da*.
2. Compila la *Descrizione*, per esempio *Gita aziendale*.
3. Regola *Da*. Lascia *A* vuoto per un solo giorno, oppure inserisci l'ultimo giorno di ferie per un periodo, per esempio per una vacanza invernale.
4. Clicca su *Applica*.

Con il cestino alla fine di una riga elimini una festività.

### Rimuovere tutte le festività

Scegli *Nessuna festività* sotto *Paese* e clicca su *Genera*. L'elenco resta quindi vuoto.

## Errori comuni e cosa fa l'app in quel caso

**Generare sostituisce l'intero elenco.** Anche i giorni che hai aggiunto tu spariscono. Aggiungili di nuovo dopo.

**Goede Vrijdag è inclusa.** Se la tua azienda lavora a Goede Vrijdag, o a Bevrijdingsdag in un anno di lustro, rimuovi quella riga con il cestino.

**Le date delle ferie edili sono date indicative.** L'app le conosce per il 2025 fino al 2028 compreso; per altri anni fa una stima approssimativa. Con le ferie edili scelte, l'app mostra quindi *Date indicative — verificare con Bouwend Nederland*. Se serve, regola il periodo nell'elenco.

**Una riga non valida.** Una riga senza una *Da* valida, una *A* che cade prima di *Da* o una data illeggibile riceve un messaggio rosso, per esempio *La data di fine è precedente alla data di inizio.* *Applica* è disattivato finché non correggi la riga.

**Con un nuovo progetto.** La finestra *Nuovo progetto* ha le stesse scelte sotto *Set di festività*. Con *Personalizzato…* parti senza festività; dopo la creazione si apre la finestra *Calendari*, così puoi compilarle tu stesso.

## Vedi anche

- [Calendari e giorni lavorativi](docs://uitleg-kalenders): come l'app tiene conto di festività e ferie edili nel conteggio dei giorni lavorativi.
- [Creare e assegnare un calendario](docs://howto-kalender-maken-en-toewijzen): creare un calendario tuo in cui inserire festività.
- [Finestre dei calendari](docs://ref-kalenders): tutti i campi delle finestre dei calendari.
- [Nuovo progetto e Impostazioni progetto](docs://ref-projectinfo): il set di festività per un nuovo progetto.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): oltre alle festività, il calendario del progetto ha un periodo libero *Frost delay, foundations*.
