# Oporavak nakon pada

Cilj: vratiti rad nakon neočekivanog prekida aplikacije ili preglednika, kada niste spremili promjene.

## Kada vam ovo treba

Prijenosno računalo se ugasilo, aplikacija se zamrznula ili se kartica preglednika srušila, a vi još niste spremili zadnje promjene. Čim se bilo gdje nešto promijeni, aplikacija u pozadini čuva kopije za oporavak svih vaših otvorenih projekata, najviše jednom svakih deset sekundi. Ta kopija odvojena je od vaše datoteke projekta. Razliku između spremanja i automatskog spremanja pročitajte u [Datoteke i formati](docs://uitleg-bestanden).

## Koraci

1. Ponovno pokrenite aplikaciju. U pregledniku ponovno učitajte istu karticu: kopija za oporavak pripada toj jednoj kartici.
2. Ako je aplikacija pronašla kopije, pojavljuje se prozor *Vraćanje nespremljenog rada*: *Aplikacija Open Planner Studio nije se ispravno zatvorila. Sljedeći dokumenti imali su nespremljene promjene koje se mogu vratiti:* Za svaki projekt prikazuje se naziv, putanja datoteke ako projekt ima datoteku (u pregledniku samo naziv datoteke), broj zadataka i vrijeme kopije, na primjer *21 zadatak* i *Spremljeno: 29. ruj 2026., 9:41*. Prozor može prikazivati i projekte koje niste mijenjali.
3. Odaberite *Vrati*. Aplikacija otvara sve projekte s popisa, svaki u svojoj kartici, sa stanjem zadnje kopije. Tipka Enter radi isto.
4. Provjerite svoje projekte i odmah ih spremite pomoću Ctrl+S.

Ako ne želite vratiti, imate dvije mogućnosti. *Ne vraćaj* briše kopije, a to se ne može poništiti. Ako zatvorite prozor tipkom Escape, križićem ili klikom pored njega, kopije ostaju, a aplikacija pita ponovno pri sljedećem pokretanju.

Upitnik u gornjem desnom kutu prozora otvara ovaj članak bez odabira. Dok čitate u Pomoći, prozor čeka. Kada se vratite, prozor je ponovno tu i još uvijek možete vratiti projekte.

## Zamke i što aplikacija tada radi

**Dobit ćete stanje zadnje kopije.** Ono što ste učinili u zadnjim sekundama prije pada možda nedostaje. Projekt koji je imao promjene ponovno je označen kao *Nije spremljeno*. Povijest *Poništi* je prazna: korake iz razdoblja prije pada ne možete poništiti. Zumiranje, položaj pomicanja i odabir se obnavljaju.

**Na računalu oporavljeni projekt zadržava svoju datoteku, u pregledniku je ne zadržava.** Na računalu *Spremi* zapisuje u izvornu datoteku, s oporavljenim stanjem. U pregledniku oporavljeni projekt više nije povezan sa svojom datotekom: *Spremi* pita gdje datoteka treba biti. Prekidač *Automatsko spremanje* tada je također siv, sve dok jednom ne spremite projekt.

**Projekt u prikazu *Datumi kako su zabilježeni* ostaje u tom prikazu.** Pogledajte [Datumi kako su zabilježeni](docs://uitleg-datums-zoals-opgeslagen).

**Na računalu prozor se ne pojavljuje pri svakom pokretanju.** Kopije za oporavak nalaze se u mapi s podacima aplikacije, kao IFC datoteke čiji naziv počinje s *recovery*. Ako aplikaciju zatvorite na uobičajen način, ona briše svoje kopije. Prozor se zato pojavljuje nakon neočekivanog prekida, nakon ponovnog pokretanja zbog ažuriranja aplikacije ili ako ste oporavak odgodili pri prethodnom pokretanju.

**U pregledniku se kopija čuva po kartici.** Kopija je u pohrani preglednika. Nova kartica ili novi prozor ne nudi kopije neke druge kartice. Kopije kartica koje više ne postoje brišu se nakon sedam dana, čim aplikacija ponovno zapisuje kopije.

**U pregledniku prozor se pojavljuje i nakon običnog ponovnog učitavanja.** To se događa i ako ste sve spremili. Ako ste spremili neposredno prije ponovnog učitavanja i poslije toga ništa niste promijenili, možete mirne duše odabrati *Ne vraćaj*: vaša datoteka je ažurna.

**Prozor se ne pojavljuje.** Tada aplikacija nije pronašla kopiju. To se događa ako još niste ništa promijenili, ako u pregledniku koristite novu karticu, ako ste oporavak ranije odbacili s *Ne vraćaj*, ili ako je pad nastao prije nego što je aplikacija spremila prvu kopiju: to može trajati do otprilike deset sekundi nakon vaše prve promjene.

**Kopija je oštećena.** Aplikacija javlja *Oporavljenu datoteku nije bilo moguće pročitati*, s razlogom, i nudi ostale projekte. Ako odaberete *Vrati*, aplikacija zatim briše sve kopije, uključujući onu koja se ne može pročitati. Ako nijedna kopija uopće nije čitljiva, prozor se ne pojavljuje i kopije ostaju.

**Vraćanje ne uspijeva.** Aplikacija javlja *Vraćanje nije uspjelo*, s razlogom. Kopije ostaju, a pitanje se vraća pri sljedećem pokretanju.

**Neke projekte nije moguće učitati.** Aplikacija javlja: *2 datoteke za oporavak nije bilo moguće učitati i preskočene su.* Za jednu datoteku piše *1 datoteka za oporavak nije bilo moguće učitati i preskočena je.* Ostali projekti se vraćaju. Pošto je nešto preskočeno, sve kopije ostaju, a prozor se pri sljedećem pokretanju vraća s istim popisom. Zatim odaberite *Ne vraćaj* ako ste već vratili sve što se moglo vratiti.

## Vidi također

- [Datoteke i formati](docs://uitleg-bestanden): spremanje, automatsko spremanje i oporavak od pada jedno uz drugo.
- [Uključivanje automatskog spremanja](docs://howto-automatisch-opslaan): omogućivanje da aplikacija sama ažurira vašu datoteku.
- [Otvaranje i spremanje datoteke](docs://howto-bestand-openen-en-opslaan): spremanje nakon oporavka.
- [Datumi kako su zabilježeni](docs://uitleg-datums-zoals-opgeslagen): što se događa s projektom u tom prikazu.
