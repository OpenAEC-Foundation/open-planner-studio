# Prilagođavanje stupaca tablice

Cilj: odaberite koje stupce vidite u tablici zadataka, kojim redoslijedom i kako široke.

## Kada vam ovo treba

Na sastanku želite vidjeti rok za dovršetak i ukupan slobodni hod uz svaki zadatak. Voditelj gradilišta želi samo početak i završetak uz naziv. Ili je neki stupac tako uzak da mu je zaglavlje odrezano. Tablica zadataka sastoji se od stupaca koje sami birete: ima ih na desetke, od *Naziv zadatka* i *Trajanje* do *Rok za dovršetak*, *Slobodni hod* i *Dodijeljeni resursi*.

Postoje dvije tablice zadataka, svaka sa svojim stupcima:

- **Tablica zadataka uz Gantt** nalazi se lijevo od vremenske crte na, među ostalim, karticama *Početna*, *Raspored* i *Prikaz*. Zadano ima *WBS*, *Naziv zadatka* i *Trajanje*, pa ostaje mjesta za vremensku crtu.
- **Tablica na kartici Tablica** zauzima cijeli radni prostor. Zadano ima *WBS*, *Naziv zadatka*, *Trajanje*, *Početak*, *Završetak*, *Vrsta zadatka*, *Kritičan*, *Ukupan slobodni hod* i *Napredak*, plus po jedan stupac za svaku šifru zadatka i svako prilagođeno polje projekta.

Promjena jedne tablice ne mijenja drugu.

## Koraci

### Dodavanje stupca

1. Kliknite znak plus (**+**) s desne strane zaglavlja tablice. Na kartici *Tablica* možete upotrijebiti i *Tablica › Stupci › Stupci…*. Otvara se prozor *Odaberi stupac*.
2. Pronađite stupac. Na vrhu se, ako ste prije birali stupce, nalazi *Nedavno korišteno*. Upišite dio naziva u polje *Traži*, na primjer *rok* za *Rok za dovršetak*, ili otvorite kategoriju: *Zadatak*, *Raspored*, *Ograničenja*, *Ovisnosti*, *Resursi*, *Napredak*, *Izračunato*, *Temeljni plan*, *Prilagođeno* ili *Tehnički*.
3. Kliknite stupac. Dodaje se na kraj tablice, a prozor se zatvara.

Stupac koji je već u tablici je siv i ne može se odabrati.

### Uklanjanje stupca

Kliknite znak minus u zaglavlju stupca (*Remove: Deadline*). Ili desnom tipkom miša kliknite zaglavlje i odaberite *Remove: Deadline*. Pomoću Ctrl+Z vraćate stupac, ili ga ponovno odaberete pomoću znaka plus.

### Prilagođavanje širine

Povucite rub s desne strane zaglavlja stupca ulijevo ili udesno. Dvaput kliknite taj rub ili u izborniku zaglavlja (desna tipka miša) odaberite *Automatski prilagodi*, da stupac bude dovoljno širok za svoj sadržaj, do najviše 480 piksela. Ako je rub u fokusu, tipke sa strelicama ga proširuju ili sužavaju korak po korak.

### Prikvačivanje stupaca

Desnom tipkom miša kliknite zaglavlje i odaberite *Prikvači*. Prikvačeni stupci premještaju se na početak i ostaju lijevo kada se pomičete vodoravno. To vrijedi sve dok zajedno nisu širi od prozora. *Otkvači* ih vraća u red.

### Promjena redoslijeda

Povucite zaglavlje stupca na drugo mjesto. Prikvačeni stupac premještate među prikvačenim stupcima, a obični stupac među običnim stupcima.

### Vraćanje na zadano

Otvorite prozor *Odaberi stupac* i na dnu kliknite *Vrati na zadano*. Gumb je siv ako su stupci već zadani. Za tablicu na kartici *Tablica* dodaje se i stupac za svaku šifru zadatka i svako prilagođeno polje projekta, čak i ako ste ih ranije uklonili. Ti stupci pripadaju projektu u kojem je šifra ili polje. O tim šiframa i poljima možete čitati u [Šifre i prilagođena polja](docs://howto-codes-en-velden).

## Zamke i što aplikacija radi

**Zaglavlje je odrezano.** Uzak stupac odreže naziv, na primjer *Ukupan slobodni hod* u *Uku…*. Dvaput kliknite rub zaglavlja da se stupac prilagodi sadržaju.

**Mijenjate pogrešnu tablicu.** Stupci tablice zadataka uz Gantt i stupci na kartici *Tablica* su odvojeni. Ako ste na kartici *Prikaz* ili *Početna*, mijenjate tablicu uz Gantt. Znak plus na kartici *Tablica* mijenja veliku tablicu.

**Izgled vraća stupce.** Ako izgled ima označen dio *Stupci*, klik na gumb izgleda vraća stupce tablice zadataka uz Gantt na spremljeno stanje. Velika tablica na kartici *Tablica* ostaje netaknuta. Pogledajte [Stvaranje i korištenje izgleda](docs://howto-layouts-gebruiken).

**Stupci su na vašem uređaju, ne u projektu.** Aplikacija čuva vaš izbor stupaca za sve vaše projekte na ovom uređaju i ne sprema ga u datoteku projekta. Projekt također ne postaje „izmijenjen“. Svaku promjenu stupaca možete poništiti pomoću *Poništi* (Ctrl+Z). Koraci se zovu, na primjer, *Dodaj stupac Rok za dovršetak* i *Promijeni širinu stupca Naziv zadatka*.

## Vidi također

- [Stvaranje i korištenje izgleda](docs://howto-layouts-gebruiken): stupci na gumbu zajedno s filtrom ili sortiranjem.
- [Šifre i prilagođena polja](docs://howto-codes-en-velden): stvaranje vlastitih stupaca koje ovdje možete odabrati.
- [Stupci tablice](docs://ref-tabelkolommen): svi stupci i što prikazuju.
