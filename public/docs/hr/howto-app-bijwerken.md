# Ažuriranje aplikacije

Cilj: saznati imate li najnoviju verziju, ažurirati aplikaciju i pročitati što je novo u nekoj verziji.

## Kada vam ovo treba

Nova verzija aplikacije Open Planner Studio izlazi redovito. Želite znati imate li je već, na primjer prije nego što prijavite pogrešku ili zato što proširenje traži noviju verziju. Ili ste upravo ažurirali i želite vidjeti što se promijenilo.

Ažuriranje radi samo u aplikaciji za računalo. Verzija za preglednik nema alat za ažuriranje.

## Koraci

### Ažuriranje kada aplikacija sama javi da postoji nova verzija

1. Pokrenite aplikaciju za računalo. Pri pokretanju aplikacija u pozadini provjerava postoji li nova verzija. Ako nema nove verzije ili provjera ne uspije, na primjer bez interneta, ništa ne primijetite.
2. Ako postoji nova verzija, otvara se prozor *Ažuriranje softvera*. Prikazuje *Trenutna verzija* i *Nova verzija*, poruku *Dostupna je nova verzija* i, pod naslovom *Što je novo*, tekst koji ide uz ažuriranje.
3. Spremite otvorene projekte.
4. Kliknite *Preuzmi i instaliraj*. Indikator napretka prikazuje *Preuzimanje…*, a zatim slijedi instalacija. Dok se preuzima, ne možete zatvoriti prozor.
5. Pričekajte da se aplikacija sama ponovno pokrene. To je nova verzija.

Neposredno prije instalacije ažuriranja aplikacija također napravi sigurnosnu kopiju vaših otvorenih projekata (za oporavak od pada), vidi [Oporavak nakon pada](docs://howto-herstellen-na-een-crash).

### Sami provjerite postoji li nova verzija

1. Odaberite *Postavke › Projekt › Postavke*. Možete odabrati i *Datoteka › Postavke* ili zupčanik pri vrhu.
2. Odaberite karticu *Napredno*. U odjeljku *Verzija* nalazi se broj vaše trenutne verzije.
3. Kliknite *Provjeri ažuriranja*. Otvara se prozor *Ažuriranje softvera* i prikazuje *Provjera…*. Nakon toga prikazuje *Koristite najnoviju verziju* ili poruku da postoji nova verzija, uz isti gumb *Preuzmi i instaliraj*.

U pregledniku gumb *Provjeri ažuriranja* ne radi ništa posebno: prozor odmah prikazuje *Koristite najnoviju verziju*, a aplikacija ništa ne provjerava.

### Pročitajte što je novo

1. Ako aplikaciju za računalo pokrenete prvi put u drugoj verziji nego prošli put, ili nakon nove instalacije, prozor se sam otvara. Naslov prozora je *Sada ste ažurirani!*
2. Pri vrhu je prijelaz s prethodne na novu verziju. Nakon nove instalacije prikazuje se samo nova verzija.
3. Ako aplikacija za ovu verziju ima ugrađen kratki pregled, vidite jednu glavnu točku i četiri manje točke. Glavna točka može imati gumb *Pročitaj vodič*. Inače vidite samo prijelaz verzije i ono što je ispod.
4. Gumb *Sve napomene o izdanju* otvara popis promjena na GitHubu. Ako to ne uspije, prikazuje se poruka *Napomene o izdanju nije bilo moguće otvoriti.*
5. U odjeljku *Ovo ažuriranje u brojkama* nalaze se broj dana od prethodnog izdanja, broj commitova i broj dodanih redaka koda. Ako aplikacija može pronaći razliku u veličini instalacijskog paketa, prikazuje se i ona. Svaka brojka prikazuje se samo ako je dostupna.
6. Kliknite *Razumijem* da zatvorite prozor.

Ako ovaj prozor želite ponovno vidjeti kasnije, odaberite *Postavke › Projekt › Postavke*, karticu *Napredno* i u odjeljku *Verzija* gumb *Što je novo*. Prozor se tada otvara za vašu trenutnu verziju, bez prethodne verzije.

## Mogući problemi i što aplikacija tada radi

**Ažuriranje ne uspije.** Prozor prikazuje *Nešto je pošlo po krivu pri ažuriranju* s tehničkim razlogom ispod, i gumb *Pokušaj ponovno*.

**Aplikaciju ste instalirali kao .deb paket i instalacija ne uspije.** Prozor objašnjava: *Ažurirajte ručno tako da u terminalu izvršite ovu naredbu ili preuzmite najnoviji paket.* U odjeljku *Naredba za instalaciju* nalazi se naredba, uz gumb *Kopiraj naredbu* (nakon toga prikazuje se *Kopirano*). Gumb *Otvori stranicu za preuzimanje* vodi vas na stranicu za preuzimanje najnovije verzije.

**Aplikaciju imate preko Snap Storea.** Aplikacija se tada ne ažurira sama i ne provjerava ni pri pokretanju. To radi Snap Store. U prozoru se prikazuje *Ova verzija ažurira se automatski putem Snap Storea. Ne morate ništa raditi.*

**Pri pokretanju se ništa ne prikazuje.** To je normalno ako već imate najnoviju verziju. Provjera pri pokretanju ne javlja pogreške. Ako želite biti sigurni da ste ažurirani, provjerite sami, kao što je gore opisano.

## Vidi također

- [Davanje povratnih informacija](docs://howto-feedback-geven): prijavite pogrešku u najnovijoj verziji.
