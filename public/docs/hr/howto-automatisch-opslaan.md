# Uključivanje automatskog spremanja

Cilj: aplikacija ažurira vašu projektnu datoteku dok radite, pa ne morate stalno pritiskati Ctrl+S.

## Kad vam ovo treba

Radite dugu sesiju na jednom rasporedu ili stalno zaboravljate spremiti, a želite da datoteka na disku ili u dijeljenoj mapi ostane ažurna. Automatsko spremanje ne zamjenjuje oporavak od pada: taj je uvijek uključen i radi odvojeno od ovoga. Razliku između njih pročitajte u [Datoteke i formati](docs://uitleg-bestanden).

## Koraci

1. Ako projekt još nema datoteku, prvo ga jednom spremite pomoću *Početna › Datoteka › Spremi kao*. Dok datoteke nema, prekidač je siv, a savjet glasi: *Spremite ovaj projekt prvo da biste mogli koristiti automatsko spremanje.*
2. Na vrhu, lijevo, u gornjoj traci kliknite prekidač *Automatsko spremanje*. Kad je uključen, savjet glasi: *Automatsko spremanje je uključeno: promjene se zapisuju u ovu datoteku.*
3. Nastavite raditi. Čim projekt ima promjene, aplikacija ih zapisuje u vašu datoteku, bez dijaloškog prozora i najviše jednom svakih deset sekundi. Oznaka *Nije spremljeno* tada sama nestaje.
4. Ako želite prestati, kliknite prekidač još jednom. Savjet tada glasi: *Automatsko spremanje je isključeno. Oporavak od pada ostaje uvijek aktivan.*

Chrome i Edge najprije dopuštaju samo čitanje datoteke koju ste otvorili. Prekidač ne radi dok ne spremite jednom pomoću *Spremi* (Ctrl+S) i dok preglednik ne dade dopuštenje za pisanje. Tada ga možete uključiti. U Firefoxu prekidač ostaje siv: aplikacija u njemu ne može pisati u vašu datoteku.

## Zamke i što aplikacija tada radi

**Prekidač pripada jednom projektu.** Svaka kartica ima vlastito stanje. Nakon otvaranja projekta prekidač je uvijek isključen, a aplikacija ga ne pamti za sljedeći put.

**Automatsko spremanje piše samo u datoteku koju projekt već ima.** Ako odaberete *Spremi kao*, od tada piše u novu datoteku. Aplikacija piše samo ako ima promjena.

**Pisanje može ne uspjeti.** Ako je datoteka, na primjer, nestala ili zaključana, pojavljuje se poruka *Automatsko spremanje nije uspjelo* s navedenim razlogom. Ako preglednik nema (ili više nema) dopuštenje za pisanje, aplikacija taj ciklus tiho preskoči: ne traži dopuštenje.

**Datoteka dobiva i promjene koje ne biste željeli zadržati.** Automatsko spremanje zapisuje stanje projekta kakvo je u tom trenutku. Ako nešto poništite pomoću Ctrl+Z, datoteka unutar deset sekundi dobiva i to poništeno stanje. Ako želite zadržati stariju verziju, prvo napravite kopiju pomoću *Spremi kao*.

**Pri padu aplikacije ipak se gubi zadnjih nekoliko sekundi.** Aplikacija piše najviše jednom svakih deset sekundi, pa ono što ste učinili između tih zapisa još nije u vašoj datoteci. Oporavak od pada ima isto ograničenje.

**Nakon oporavka u pregledniku prekidač je ponovno siv.** Projekt koji u pregledniku vratite nakon pada više nije povezan sa svojom datotekom. Spremite ga jednom, pa prekidač opet radi. Pogledajte [Oporavak nakon pada](docs://howto-herstellen-na-een-crash).

**Projekt iz drugog formata nema datoteku.** Datoteka u formatu CSV, XML, `.mpp` ili `.xer` tek pri spremanju dobiva IFC datoteku. Tada možete uključiti automatsko spremanje.

## Pogledajte također

- [Datoteke i formati](docs://uitleg-bestanden): razlika između spremanja, automatskog spremanja i oporavka od pada.
- [Otvaranje i spremanje datoteke](docs://howto-bestand-openen-en-opslaan): spremanje, spremanje kao i oznaka *Nije spremljeno*.
- [Oporavak nakon pada](docs://howto-herstellen-na-een-crash): što aplikacija nudi ako se nije uredno zatvorila.
