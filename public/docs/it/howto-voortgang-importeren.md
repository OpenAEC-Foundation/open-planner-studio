# Importare l'avanzamento da un foglio di calcolo

Obiettivo: inserire in una sola volta nella pianificazione l'avanzamento che il personale di cantiere compila in un foglio di calcolo, senza cliccare tu stesso ogni attività.

## Quando ti serve questo

Un subappaltatore o un capocantiere non ha l'app, ma ogni settimana ti comunica a che punto è: quanto è completato in percentuale, quando ha iniziato, quando ha finito. Tu gli invii un foglio con le tue attività, lui compila tre colonne e te lo rimanda. Da quel foglio l'app legge solo tre valori per attività: completamento, inizio effettivo e fine effettiva. Il resto della tua pianificazione resta invariato. Che cosa fa l'app con questo avanzamento è spiegato in [Avanzamento, data di stato e baseline](docs://uitleg-voortgang).

## Passi

### 1. Imposta la data di stato e calcola

Imposta la data di stato come descritto in [Aggiornare l'avanzamento](docs://howto-voortgang-bijwerken). Il capocantiere inserisce le date effettive fino a quel giorno incluso. Se la pianificazione non è aggiornata, l'app la ricalcola prima di creare il foglio.

### 2. Crea il foglio

Scegli *Pianificazione › Avanzamento › Esporta foglio di avanzamento*. Lo stesso pulsante si trova sulle schede *Tabella* e *Rapporto*. L'app crea un file Excel e propone il nome *(nome progetto)-voortgang.xlsx*; nel browser il file finisce nei tuoi download. Preferisci un CSV? Scegli *File › Esporta › Foglio di avanzamento (CSV)*. Anche il foglio Excel è disponibile, come *Foglio di avanzamento (Excel)*.

Il foglio ha otto colonne. I nomi restano in inglese; dopo ogni nome c'è una breve istruzione nella lingua dell'app:

- `OPS Task ID`, `WBS` e `Name` servono solo a riconoscere l'attività. Non modificarle.
- `Start` e `Finish` sono le date pianificate, solo come informazione. L'app non le modifica mai.
- `Completion (%)`, `Actual Start` e `Actual Finish` sono quelle che compili tu.

Il foglio Excel è protetto, senza password: si possono modificare solo le tre colonne da compilare. Excel controlla che una percentuale sia tra 0 e 100 e che una data effettiva sia una data. Una fase (attività di riepilogo) è segnata in grigio con *— attività di riepilogo: non compilare*.

### 3. Fai compilare il foglio

Per ogni attività il capocantiere compila:

- `Completion (%)`: da 0 a 100, estremi inclusi. L'app legge anche i decimali, con virgola o punto (per esempio 33,3 o 33.3). L'istruzione nel CSV chiede però numeri interi: un foglio con un'altra impostazione regionale può leggere 8,38 come 838.
- `Actual Start` e `Actual Finish`: in Excel come data, con le impostazioni regionali del tuo computer; nel CSV come gg-mm-aaaa o come aaaa-mm-gg.

Ciò che resta vuoto non cambia nulla. Quindi anche una cella vuota non cancella l'avanzamento esistente; questo si può fare solo nell'app. Il capocantiere lascia completamente vuota un'attività non ancora iniziata.

### 4. Leggi il foglio

1. Scegli *Pianificazione › Avanzamento › Aggiorna l'avanzamento da un foglio* (anche sulle schede *Tabella* e *Rapporto*), oppure *File › Importa › Aggiorna l'avanzamento da un foglio*. Si apre la finestra *Aggiorna l'avanzamento da un foglio*.
2. Clicca *Scegli file…* e scegli il file `.xlsx` o `.csv` compilato.
3. Se le date in un CSV non sono chiare, l'app chiede *Prima il giorno o prima il mese?*, con la data del tuo file letta in due modi. Clicca la data giusta.
4. Ora vedi un'anteprima. In alto ci sono quattro contatori: *Applicate*, *Invariate*, *In attesa di collegamento* e *Rifiutate*. Sotto, per ogni attività, vedi che cosa cambia, per esempio *Completamento: 0% → 100%*.
5. Controlla l'anteprima e clicca *Applica*. La finestra mostra *Risultato*, con i contatori e le righe rifiutate, con il motivo. Termina con *Chiudi*.

Non puoi saltare l'anteprima. Il pulsante *Applica* è disattivato finché non c'è nulla da applicare.

### 5. Ricalcola la pianificazione

L'importazione non ricalcola da sola la pianificazione. Premi **Calcola** (F5), per esempio tramite *Pianificazione › Pianificazione › Calcola*, a meno che *Calcola automaticamente* sia attivo.

## Righe che non rientrano subito

L'app collega ogni riga a un'attività: prima tramite `OPS Task ID`, altrimenti tramite il numero WBS.

**Collegamento incerto.** Se l'app ha trovato l'attività solo tramite il numero WBS, la riga finisce sotto *Collegamento incerto*, con *Conferma* e *Modifica*. La riga viene applicata anche se non fai nulla; controlla quindi che l'attività sia giusta. *Conferma* toglie la riga da questo elenco; non cambia nulla di ciò che viene applicato. *Modifica* ti permette di scegliere un'altra attività. Con *Rimuovi collegamento* elimini un collegamento che hai fatto tu. Nota: un foglio di un altro progetto con gli stessi numeri WBS viene comunque collegato, sotto *Collegamento incerto*, e applicato quando clicchi *Applica*.

**In attesa di collegamento.** Se l'app non trova nessuna attività, o più attività con lo stesso numero WBS, la riga finisce sotto *In attesa di collegamento*. In *Scegli un'attività…* scegli l'attività giusta; cerchi per numero WBS o per nome. Se non la colleghi, la riga viene rifiutata.

## Errori frequenti e che cosa fa l'app

Una riga che non si adatta viene rifiutata, con un motivo. Il resto del foglio va avanti normalmente. Questi sono i messaggi principali:

- *La data effettiva è successiva alla data di stato.* Imposta una data di stato più tardi oppure correggi il foglio.
- *Questa attività è pianificata per iniziare dopo la data di stato: inserisci prima il suo inizio effettivo nel foglio.* L'app non inventa un inizio; inseriscilo tu nel foglio.
- *Percentuale fuori dall'intervallo 0–100. Controlla il separatore decimale: in un foglio di calcolo con impostazioni regionali diverse, "8,38" può essere letto come 838.* 
- *Le attività di riepilogo non possono ricevere avanzamento da un foglio.* L'avanzamento di una fase deriva dalle attività sotto di essa.
- *La fine effettiva precede l'inizio effettivo.*
- *Data illeggibile.* e *Percentuale illeggibile.*
- *I valori inseriti si contraddicono.* Per esempio una fine effettiva con una percentuale sotto 100.
- *Nessuna attività trovata per questa riga.* Il foglio indica un ID attività e un numero WBS che non compaiono in questo progetto.
- *Questo codice WBS compare in più attività — collega la riga manualmente.*
- *Un'altra riga ha già rivendicato questa attività.* Due righe puntano alla stessa attività.
- *Rifiutato dal pianificatore.* Un altro rifiuto della pianificazione stessa, senza un messaggio proprio.

Se viene rifiutato l'intero file, nella finestra appare uno di questi messaggi: *Questo file non ha una colonna «OPS Task ID» né «WBS» per collegare le righe alle attività.*, *Questo file non ha nessuna delle colonne Completamento, Inizio effettivo o Fine effettiva.*, *Questo file è troppo grande per essere letto come foglio di avanzamento.* (più di 16 MB), *Questo file ha troppe righe per essere letto come foglio di avanzamento.* (più di 50.000 righe), oppure *Questo file è protetto da password e non può essere letto.* oppure *Questo file non è stato possibile leggerlo come foglio di avanzamento.*

**Nessuna data di stato.** Se non c'è ancora una data di stato e l'importazione applica l'avanzamento, l'app la imposta a oggi e te lo dice. Imposta quindi tu la data prima.

**Annullare tutto in una volta.** L'intero foglio è un solo passo per Ctrl+Z.

**Solo ciò che compili.** Una riga senza differenze rispetto alla pianificazione conta come *Invariate*. Un'attività senza riga nel foglio resta come era.

## Vedi anche

- [Avanzamento, data di stato e baseline](docs://uitleg-voortgang): che cosa calcola l'app con le date effettive e le percentuali.
- [Aggiornare l'avanzamento](docs://howto-voortgang-bijwerken): inserire l'avanzamento direttamente nell'app.
