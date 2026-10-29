# Tipi di attività: durata, unità e lavoro

Metti un intonacatore sull'intonacatura e l'attività dura quattro giorni. Se aggiungi un secondo intonacatore, il lavoro si può fare in due giorni. Può anche restare quattro giorni, con il doppio del lavoro. Entrambi hanno senso. Quale dei due sceglie l'app dipende dal **tipo di attività** impostato per l'attività. In questo articolo leggi come l'app collega durata, unità e lavoro, e che cosa tiene costante ogni tipo di attività.

## Il concetto

Tre grandezze sono collegate:

- **Durata**: per quanto tempo l'attività dura, in giorni lavorativi o in ore.
- **Unità**: quanta risorsa lavora sull'attività per giorno lavorativo. Nel pannello *Proprietà* si chiama *Unità*, in altre finestre *Unità/giorno*. Unità 1 è un intonacatore per tutta la giornata, 2 sono due intonacatori e 0,5 è mezza giornata.
- **Lavoro**: il numero totale di ore che la risorsa spende sull'attività.

La somma è: lavoro = durata × unità × ore per giorno lavorativo. Le ore per giorno lavorativo vengono dal calendario dell'attività. Un'intonacatura di quattro giorni lavorativi con un intonacatore è, con un giorno lavorativo di 8 ore, 4 × 1 × 8 = 32 ore di lavoro.

Se cambi una delle tre, almeno una delle altre due deve spostarsi, altrimenti la somma non regge più. Il tipo di attività decide quale. Lo imposti per attività, nel pannello *Proprietà*. L'app mostra il tipo di attività e il lavoro solo quando li attivi; come funziona è spiegato in [Scegliere un tipo di attività](docs://howto-werkregel-kiezen).

Un tipo di attività funziona solo su attività normali. I cardini, le fasi (attività di riepilogo), le hammock e le attività il cui *Tipo di durata* è *Tempo trascorso* non ne hanno uno: il campo *Tipo di attività* non c'è. Anche il materiale, come il calcestruzzo o la malta da intonaco, non conta. La quantità di materiale non guida mai la durata, e l'app non la modifica mai a causa di un tipo di attività.

## Come calcola l'app

### Il tipo di attività agisce su ciò che modifichi

L'app ricalcola durata, unità e lavoro solo nel momento in cui modifichi uno di questi valori: la durata dell'attività, le unità di un'assegnazione, il lavoro, una risorsa aggiunta o rimossa, oppure le ore al giorno in un calendario. **Calcola** (F5) non cambia nessuno di questi valori: F5 calcola solo le date. Anche scegliere un tipo di attività non cambia nemmeno un numero. Il tipo di attività conta alla tua modifica successiva.

Se un tipo di attività cambia la durata di un'attività, la pianificazione diventa non aggiornata. La barra di stato mostra allora *Non aggiornato — ricalcola (F5)*, a meno che *Calcola automaticamente* sia attivo.

### Quattro tipi di attività

Nel pannello *Proprietà* c'è un'icona i accanto al menu a tendina *Tipo di attività*. Passaci sopra con il puntatore, cliccala o toccala, e l'app spiega il tipo di attività che vale ora. Anche nel menu a tendina aperto ogni opzione ha un'icona i. La spiegazione inizia con una frase in grassetto. Ecco i quattro tipi di attività, con quella frase dell'app:

- **Durata e unità fisse** (*Il lavoro segue dalla durata e dalle unità.*). Questa è la predefinita. L'app non cambia mai la durata da sola e il lavoro segue dalla durata e dalle unità. Se digiti tu il lavoro, l'app adegua le unità, perché la durata è fissa.
- **Durata e lavoro fissi** (*Le unità seguono dalla durata e dal lavoro.*). L'app non cambia mai la durata da sola. Se cambi la durata, il lavoro resta e le unità si adeguano.
- **Lavoro fisso** (*La durata segue dal lavoro e dalle unità.*). Il lavoro è fisso e la durata segue dal lavoro e dalle unità.
- **Unità fisse** (*La durata segue dal lavoro e dalle unità.*). Le unità sono fisse e la durata segue dal lavoro.

Quindi due tipi di attività lasciano in pace la durata. Con gli altri due la durata si sposta quando cambi le unità, il lavoro o il numero di risorse. Con una sola risorsa, Lavoro fisso e Unità fisse fanno esattamente la stessa cosa. Differiscono quando cambi tu la durata: con Lavoro fisso il lavoro resta e le unità si adeguano, con Unità fisse restano le unità e il lavoro cresce insieme. Differiscono anche quando ci sono più risorse sull'attività (vedi sotto).

Gli esempi svolti qui sotto mostrano che cosa fa ogni tipo di attività.

### Arrotondamento

La durata che segue dalla somma viene arrotondata per eccesso dall'app. Per un'attività in giorni, fino a giorni lavorativi interi; per un'attività in ore, fino a minuti interi. Lavoro e unità restano quello che hai inserito o quello che l'app ha ricavato dalla somma. Per questo la somma a volte non torna esattamente. L'esempio sotto mostra che cosa succede allora.

### Più risorse

Se un'attività ha più risorse, valgono due principi. Con Durata e lavoro fissi, Lavoro fisso e Unità fisse, il lavoro totale resta uguale quando aggiungi o rimuovi una risorsa. L'app lo divide in proporzione alle unità. Con Durata e unità fisse, una nuova risorsa porta invece il proprio lavoro. Con Lavoro fisso e Unità fisse decide la risorsa più lenta: per ogni risorsa è il lavoro diviso per le unità, e conta il risultato più alto.

Un esempio: due risorse hanno ciascuna 32 ore di lavoro e unità 1, insieme 4 giorni lavorativi. Imposti le unità della prima a 0,5. La durata diventa allora 8 giorni lavorativi. Con Lavoro fisso la seconda risorsa mantiene le sue 32 ore di lavoro e le sue unità scendono a 0,5. Con Unità fisse la seconda mantiene le sue unità 1 e il suo lavoro cresce a 64 ore.

### Avanzamento

Se l'attività ha già avanzamento, il tipo di attività lavora sulla parte rimanente: la durata rimanente e il lavoro rimanente. Nel pannello *Proprietà* quel lavoro è nella colonna *Lavoro (h)*. Quello che è fatto resta.

### Attività in ore

Un'attività che pianifichi in ore si calcola allo stesso modo, ma in minuti. Se solo la gru è sull'attività di 5 ore, sono 5 ore di lavoro. Con Lavoro fisso, la durata con unità 2 diventa allora 2,5 ore. Anche il solaio alveolare nel progetto di esercizio ha assegnata la squadra dei carpentieri. Richiede ancora 5 ore di lavoro, è la risorsa più lenta, quindi la durata resta 5 ore. Come si collegano ore e giorni è spiegato in [Giorni e ore](docs://uitleg-dagen-en-uren).

## Esempio svolto: l'intonacatura

L'esempio è il progetto di esercizio *House extension* dei tutorial. Nel tutorial 5 lo ricavi da solo e controlli i numeri. Qui leggi che cosa fa ogni tipo di attività.

L'intonacatura dura 4 giorni lavorativi. Ci è assegnato un intonacatore, con unità 1, e il giorno lavorativo è di 8 ore. Quindi il lavoro è 32 ore.

### Durata e unità fisse

- Imposti la durata a 6 giorni lavorativi: il lavoro sale a 48 ore, le unità restano 1.
- Imposti le unità a 2: la durata resta 4 giorni lavorativi, il lavoro diventa 64 ore.
- Digiti 48 ore in *Lavoro (h)*: la durata resta 4 giorni lavorativi, le unità diventano 1,5.
- Assegni una seconda risorsa, per esempio *Plasterer 2*, con unità 1: la durata resta 4 giorni lavorativi e quella seconda porta 32 ore di lavoro, 64 ore insieme.

### Durata e lavoro fissi

- Imposti la durata a 6 giorni lavorativi: il lavoro resta 32 ore, le unità scendono a 0,67.
- Imposti le unità a 2: la durata resta 4 giorni lavorativi. Poiché la durata è fissa, il lavoro cresce insieme a 64 ore.
- Digiti 16 ore in *Lavoro (h)*: la durata resta 4 giorni lavorativi, le unità diventano 0,5.
- Assegni una seconda risorsa, per esempio *Plasterer 2*, con unità 1: le 32 ore vengono divise, 16 ore ciascuna, e le unità diventano 0,5 per entrambe. La durata resta 4 giorni lavorativi.

### Lavoro fisso

- Imposti la durata a 6 giorni lavorativi: il lavoro resta 32 ore, le unità scendono a 0,67.
- Imposti le unità a 2: il lavoro resta 32 ore e la durata diventa 2 giorni lavorativi. Questo è il passo che fai nel tutorial 5.
- Digiti 48 ore in *Lavoro (h)*: le unità restano 1 e la durata diventa 6 giorni lavorativi.
- Assegni una seconda risorsa, per esempio *Plasterer 2*, con unità 1: le 32 ore vengono divise, 16 ore ciascuna, e la durata diventa 2 giorni lavorativi. Rimuovi di nuovo quella seconda risorsa e la durata torna 4 giorni lavorativi.

### Unità fisse

- Imposti la durata a 6 giorni lavorativi: le unità restano 1, il lavoro sale a 48 ore.
- Imposti le unità a 2: il lavoro resta 32 ore e la durata diventa 2 giorni lavorativi.
- Digiti 48 ore in *Lavoro (h)*: le unità restano 1 e la durata diventa 6 giorni lavorativi.
- Assegni una seconda risorsa, per esempio *Plasterer 2*, con unità 1: le 32 ore vengono divise, 16 ore ciascuna, e la durata diventa 2 giorni lavorativi.

### Quando la somma non torna

Con Lavoro fisso imposti le unità a 3. Il lavoro è 32 ore, quindi la durata diventa 32 ÷ (3 × 8) = 1,33 giorni lavorativi. L'app arrotonda per eccesso a 2 giorni lavorativi. Il lavoro (32 ore) e le unità (3) restano, ma 2 × 3 × 8 fa 48 ore. L'istogramma quindi distribuisce le 32 ore su 2 giorni lavorativi: 2 unità al giorno, non 3. Nel campo *Lavoro (h)* compare un segnale di avviso, *Diverge da unità × durata*, per mostrarlo.

Con due risorse con unità diverse funziona allo stesso modo. Se, con Lavoro fisso, aggiungi una seconda risorsa, per esempio *Plasterer 2*, con unità 2 all'intonacatore con unità 1, l'app divide le 32 ore nel rapporto 1 : 2, quindi 10,7 e 21,3 ore. Entrambe richiedono allora 1,33 giorni lavorativi. La durata diventa 2 giorni lavorativi.

Un file di P6 o di MS Project può anche contenere un *Lavoro (rim.)* che non è uguale a unità × durata rimanente. Compare allora lo stesso segnale di avviso. L'app non cambia da sola questo lavoro. Se cambi la durata di un'attività così, l'app segue il tipo di attività, anche quando il lavoro rimanente viene dal file. Con *Durata e unità fisse* e *Unità fisse* il lavoro rimanente diventa unità × nuova durata rimanente. Con *Durata e lavoro fissi* e *Lavoro fisso* il lavoro resta e le unità si adeguano. Se così un lavoro rimanente dal file scompare, ricevi un avviso con il vecchio e il nuovo numero di ore. Ctrl+Z ripristina il valore vecchio. La spiegazione al segnale di avviso ti dice per attività quale dei due succede.

### Un calendario diverso

Con Lavoro fisso il giorno lavorativo del calendario passa da 8 a 6 ore. Il lavoro resta 32 ore, quindi la durata diventa 32 ÷ 6 = 5,33, arrotondata per eccesso a 6 giorni lavorativi. Come l'app conta i giorni lavorativi e gli orari di lavoro è spiegato in [Calendari e giorni lavorativi](docs://uitleg-kalenders). L'app riporta: *Dopo la modifica del calendario il tipo di attività ha adeguato la durata di 1 attività (il lavoro resta, le ore al giorno sono cambiate).*

### Un'attività con avanzamento

Il paramento interno della cavità dura 5 giorni lavorativi ed è fatto al 40%: 2 giorni lavorativi sono fatti e ne restano 3 (24 ore). Con Lavoro fisso imposti le unità da 1 a 2. Il lavoro rimanente resta 24 ore e la durata rimanente diventa 1,5, arrotondata per eccesso a 2 giorni lavorativi. L'attività ora dura 2 + 2 = 4 giorni lavorativi e l'avanzamento è 50%. La percentuale si adegua, perché la parte fatta resta uguale e la parte rimanente si accorcia.

## Conseguenze e idee sbagliate

**«Lavoro fisso significa che la durata è fissa.»** No, è esattamente il contrario. Con *Durata e unità fisse* e *Durata e lavoro fissi* la durata è fissa. Con *Lavoro fisso* e *Unità fisse* la durata segue dalle altre due.

**«Se scelgo un tipo di attività, la mia pianificazione cambia.»** No. Scegliere non cambia nessun numero. Solo alla tua modifica successiva il tipo di attività decide che cosa si sposta. Con un tipo di attività che protegge il lavoro, l'app fissa il lavoro nel momento in cui scegli, così c'è un numero da proteggere. Un'attività così ha allora un *Lavoro (h)* salvato.

**«La durata è cambiata senza che io la tocchi.»** Può succedere dopo una modifica delle unità, del lavoro, del numero di risorse o delle ore al giorno, con Lavoro fisso o Unità fisse. La barra di stato mostra allora che la pianificazione non è aggiornata. Premi **Calcola** (F5) per vedere le nuove date.

**Senza assegnazione un tipo di attività non fa nulla.** Non ci sono allora né unità né lavoro a cui collegare la durata.

**I file di MS Project o di Primavera P6 mostrano sempre il tipo di attività.** Per un'attività di MS Project l'app a volte conserva l'impostazione basata sull'impegno. Quella impostazione salvata cambia il comportamento in due casi. Con *Durata e lavoro fissi* e basata sull'impegno, il lavoro si sposta quando cambi la durata, invece delle unità. Con *Unità fisse* e non basata sull’impegno, il lavoro si sposta quando aggiungi o rimuovi una risorsa, e la durata resta. Le attività che crei nell'app non hanno questa impostazione. La spiegazione dietro l'icona i tiene conto di questa impostazione.

## Vedi anche

- [Scegliere un tipo di attività](docs://howto-werkregel-kiezen): i passi per impostare il tipo di attività di un'attività.
- [Assegnare risorse con una curva](docs://howto-resource-toewijzen): mettere una risorsa su un'attività, con unità e distribuzione.
- [Giorni e ore](docs://uitleg-dagen-en-uren): come l'app converte giorni e ore.
- [Calendari e giorni lavorativi](docs://uitleg-kalenders): come l'app conta i giorni lavorativi e gli orari di lavoro.
