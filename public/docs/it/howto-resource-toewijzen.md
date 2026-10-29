# Assegnare risorse con una curva

Obiettivo: mettere una risorsa su un'attività, con unità al giorno e una curva che decide come queste unità si distribuiscono sui giorni dell'attività.

## Quando ti serve

Appena vuoi vedere chi lavora dove e quando: il muratore sul paramento esterno della cavità, la gru sulle lastre alveolari del solaio. Senza assegnazione non c'è carico, quindi nessun istogramma e nessuna risorsa sovrassegnata.

Due termini. Le **unità** (nel pannello la colonna *Unità*, nella finestra *Assegna* il campo *Unità/giorno*) indicano quanto della risorsa lavora sull'attività per giorno lavorativo: 1 è un muratore, 2 sono due muratori, 0,5 è mezza giornata. La **curva** decide come il totale, unità per durata, si distribuisce sui giorni lavorativi dell'attività. Il lavoro è raramente regolare: su un muro l'inizio è tranquillo, il centro intenso e la fine di nuovo tranquilla.

Il paramento esterno della cavità richiede 6 giorni lavorativi. Con un muratore e la curva *Uniforme* sono 1 unità su ciascuno dei 6 giorni, in totale 6. Con la curva *A campana* il totale resta 6 unità, ma la distribuzione diventa 0, 1, 2, 2, 1 e 0.

## Passaggi

Puoi assegnare una risorsa in due modi. La risorsa deve già esistere (vedi [Gestire le risorse](docs://howto-resources-beheren)).

### Tramite la barra multifunzione

1. Seleziona un'attività nella tabella attività. Deve essere un'attività normale, non un cardine e non una fase.
2. Scegli *Risorse › Assegnazione › Assegna ▾*.
3. Nella finestra compila *Unità/giorno* (predefinito 1) e scegli la *Curva* (predefinita *Uniforme*). Si applicano alla risorsa che scegli adesso.
4. Fai clic sulla risorsa. La finestra si chiude e l'assegnazione è presente.

Per una seconda risorsa apri di nuovo la finestra. Le risorse già presenti sull'attività non compaiono nell'elenco.

### Tramite il pannello proprietà

1. Seleziona l'attività. Il pannello *Proprietà* si trova a destra; se non lo vedi, attivalo con *Vista › Pannelli › Proprietà*.
2. Nel blocco *Assegnazioni*, in fondo, scegli la risorsa in *Assegna risorsa*. L'assegnazione inizia con 1 unità e la curva *Uniforme*.
3. Per ogni assegnazione cambia *Unità*. Fai clic sul nome della risorsa per mostrare la *Curva* e scegli lì un'altra curva.

Così cambi anche un'assegnazione esistente. Con il cestino (*Rimuovi*) alla fine della riga togli l'assegnazione dall'attività. La risorsa stessa resta. Con *Sposta in…* (visibile dopo un clic sul nome) sposti l'assegnazione su un'altra attività.

### Le curve

- *Uniforme*: uguale ogni giorno. È il valore predefinito e si adatta a un lavoro ugualmente intenso ogni giorno.
- *Caricato all'inizio*: l'inizio è più pesante della fine. Si adatta a lavori che iniziano con uno sforzo intenso, come il tracciamento.
- *Caricato alla fine*: la fine è più pesante dell'inizio. Si adatta a lavori che diventano più intensi verso il completamento.
- *A campana*: un picco al centro, con inizio e fine tranquilli. Si adatta a un muro che inizia piano, è a pieno ritmo al centro e poi rallenta.
- *Picco anticipato*: un picco prima del centro. Si adatta a lavori che raggiungono subito il ritmo pieno.
- *Picco tardivo*: un picco dopo il centro. Si adatta a lavori il cui momento intenso arriva solo tardi.
- *Doppio picco*: due picchi. Si adatta a lavori con due momenti intensi.
- *Tartaruga*: inizio e fine tranquilli con un picco ampio al centro. Si adatta a lavori lunghi che salgono e scendono gradualmente.

La curva cambia solo la distribuzione. La durata, le date e il totale restano uguali. Dopo non serve ricalcolare. L'istogramma si aggiorna subito. Scegli *Risorse › Istogramma › Istogramma* per vederlo. Se selezioni un'attività, l'istogramma mostra solo il carico di quell'attività.

## Insidie e cosa fa l'app in quel caso

**Una curva può spingere il picco sopra le tue unità.** Con un numero intero come unità, l'app arrotonda il valore per giorno a unità intere, e il totale resta uguale. Un muratore con unità pari a 1 sul paramento esterno della cavità e la curva *A campana* dà 0, 1, 2, 2, 1, 0. Nei due giorni centrali sono 2 unità, contro *Unità max* di 1. L'istogramma colora quei giorni di rosso e la risorsa risulta sovrassegnata. Scegli un'altra curva, oppure distribuisci tu le ore (vedi [Regolare la distribuzione oraria](docs://howto-urenverdeling-aanpassen)). Con unità come 0,5 l'app arrotonda a centesimi. Su un'attività breve con unità intere la forma diventa quindi grossolana: su 10 giorni *Tartaruga* con unità pari a 1 dà la distribuzione 0, 1, 1, 2, 2, 1, 1, 1, 1, 0, esattamente uguale a *Picco anticipato*.

**Nessun cardine né fase.** Il pulsante *Assegna* è allora disattivato, e nel pannello *Proprietà* compare *Le assegnazioni non sono possibili sui cardini.* oppure *Le assegnazioni non sono possibili sulle attività di riepilogo.*

**Una risorsa solo una volta per attività.** Se la risorsa è già sull'attività, non compare più nell'elenco. Se tutte le risorse sono già sull'attività, l'app dice *Tutte le risorse sono già assegnate.* Se non esiste ancora nessuna risorsa, dice *Crea prima le risorse (scheda Risorse).*

**Le unità devono essere maggiori di 0.** L'app non accetta un valore di 0 o meno.

**Materiale.** Per una risorsa di materiale le unità sono la quantità al giorno, nell'unità di misura della risorsa, per esempio m³. Il materiale non conta nella durata dell'attività.

**Un tipo di attività può adattare la durata.** Se l'attività è su *Lavoro fisso* o *Unità fisse*, una seconda risorsa cambia la durata dell'attività. La pianificazione allora non è più aggiornata; premi **Calcola** (F5). Vedi [Tipi di attività: durata, unità e lavoro](docs://uitleg-werkregels).

**Una distribuzione propria.** Se l'assegnazione ha già una distribuzione oraria propria, la curva è disattivata e mostra *Contorno*. Rilascia prima quella distribuzione tramite *Distribuzione ore…*.

**Annullare.** Puoi annullare la creazione, la modifica o la rimozione di un'assegnazione con *Annulla* (Ctrl+Z).

## Vedi anche

- [Regolare la distribuzione oraria](docs://howto-urenverdeling-aanpassen): impostare tu stesso le ore al giorno.
- [Risolvere una risorsa sovrassegnata](docs://howto-overbezetting-oplossen): cosa fare quando una risorsa ha troppo lavoro da fare in un giorno.
- [Tipi di attività: durata, unità e lavoro](docs://uitleg-werkregels): cosa succede alla durata quando cambi le unità.
- [Pannello risorse](docs://ref-resourcepaneel): tutti i campi e i pulsanti del pannello risorse.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): tutti e cinque i tipi di risorsa, sei delle otto curve e una gru a torre con un gradino di capacità dal 30 agosto 2027.
