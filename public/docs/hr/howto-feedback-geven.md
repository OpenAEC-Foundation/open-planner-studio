# Davanje povratnih informacija

Cilj: prijaviti grešku ili predati ideju, po želji sa snimkom zaslona, izravno iz aplikacije.

## Kada vam je ovo potrebno

Raspored izračunava nešto što ne razumijete, gumb ne radi kako bi trebao ili vam u aplikaciji nešto nedostaje. Dobra prijava pomaže autorima pronaći problem. Zato aplikacija sama stavlja verziju, operacijski sustav i jezik u vašu prijavu. Ono što sami opišete određuje može li se s time nešto učiniti: što ste učinili, što ste očekivali i što se dogodilo.

## Koraci

1. Kliknite gumb *Pošalji feedback* na vrhu prozora. Taj gumb je uvijek u naslovnoj traci. Njegov tekst se mijenja svakih deset minuta: *Pošalji feedback*, *Prijavi grešku* i *Dodaj novu značajku*. Uvijek je to isti gumb. Otvara se prozor *Povratne informacije*.
2. Odaberite vrstu prijave. *Nešto ne radi* je za grešku: nešto ne radi onako kako bi trebalo. *Ideja* je za ono što vam nedostaje ili što želite drugačije. *Pitanje ili napomena* je za sve ostalo. Zadano je odabrano *Nešto ne radi*.
3. Ispunite polja *Naslov* i zatim *Opis*. Prazna polja pokazuju primjer: u naslovu na primjer *Npr. Kritični put skače nakon spremanja*, a u opisu pitanje *Što ste učinili, što ste očekivali i što se dogodilo?* Dok je gumb *Pošalji* siv, siva crta pokraj njega kaže zašto, na primjer *Unesite naslov.* ili da morate u naslov i opis zajedno upisati najmanje 10 znakova.
4. Ako želite odgovor, upišite svoju *Adresu e-pošte*. To polje je neobavezno. Aplikacija pamti adresu nakon uspješne prijave, pa je sljedeći put već upisana.
5. Ako želite nešto prikazati, uključite *Priloži snimku zaslona*. Aplikacija tada napravi sliku aplikacije bez ovog prozora. Nakon kratkog trenutka vidite mali pregled s tri gumba pokraj njega: *Označi*, *Ponovno snimi* i *Ukloni*.
6. *Označi* otvara uređivač. U njemu na sliku stavljate strelice, pravokutnike, slobodne linije i tekst. S *Prekrij* crtate crno područje preko nečega što se ne smije podijeliti, na primjer imena ili iznosa. Taj dio je tada zaista uklonjen sa slike koju aplikacija šalje. Boju birate, zadnju radnju poništavate s *Poništi* ili počinjete ispočetka s *Obriši sve*. Kliknite *Gotovo* da zadržite promjene, ili *Odustani* (ili Esc) da ih odbacite.
7. *Ponovno snimi* napravi novu snimku zaslona i briše vaše oznake. *Ukloni* uklanja snimku zaslona i isključuje potvrdni okvir.
8. Pogledajte sivu crtu *Poslano uz* ispod obrasca. Ona prikazuje što aplikacija sama šalje: verziju, operacijski sustav i jezik, na primjer *Poslano uz: v2026.10.1 · Windows · English*.
9. Kliknite *Pošalji*. Dok se šalje, na gumbu piše *Slanje…*.
10. Vidite *Hvala, vaša prijava je poslana.* Ako je za vašu prijavu napravljen problem na GitHubu, pojavi se i gumb *Pogledaj na GitHubu*. Kliknite *Zatvori*.

## Kamo ide vaša prijava

Aplikacija šalje vašu prijavu u Open Feedback Studio tvrtke OpenAEC. Za to vam nije potreban račun, ni na GitHubu. Tvorci vide vašu prijavu u svom pregledu. Ako je aplikacija tamo povezana s GitHubom, Open Feedback Studio prijavu pretvara i u javni problem na GitHubu. Uz *Nešto ne radi* problem dobiva oznaku *bug*, uz *Ideja* oznaku *enhancement*. Ispod vašeg opisa se tada nalazi redak s verzijom Open Planner Studio, vašim operacijskim sustavom i jezikom aplikacije.

## Zamke i što aplikacija tada radi

**Vaša prijava može postati javna.** Ne stavljajte u nju ništa što ne želite podijeliti. To vrijedi i za snimku zaslona: slika prikazuje sve što je u tom trenutku vidljivo u aplikaciji, na primjer nazive zadataka i resursa vašeg projekta. Aplikacija snimku zaslona pravi u trenutku kad uključite *Priloži snimku zaslona*. Ako zaslon još nije ispravan, zatvorite prozor, namjestite zaslon kako treba, ponovno otvorite prozor i kliknite *Ponovno snimi*. Upotrijebite *Prekrij* da sakrijete ono što ne želite pokazati.

**Snimka zaslona je prevelika.** Aplikacija prije slanja smanjuje snimku zaslona. Ako je i nakon toga prevelika, prijava se šalje bez slike. Zaslon s zahvalom tada kaže *Snimka zaslona bila je prevelika i nije poslana.*

**Slanje ne uspijeva.** U prozoru se pojavi poruka, a vaš tekst ostaje. Postoje četiri slučaja:

- *Prijava nije prihvaćena.* Provjerite tekst i adresu e-pošte. Prijava koja se uglavnom sastoji od poveznica se odbija.
- *Poslali ste mnogo prijava u kratkom vremenu.* Pokušajte ponovno za sat vremena.
- *Slanje nije uspjelo.* Nema veze ili poslužitelj ne odgovara. Pokušajte ponovno ili kliknite *Otvori na GitHubu*. Taj gumb nije prikazan ako je prethodni pokušaj slanja bio neizvjestan (vidi dolje).
- *Nismo sigurni je li vaša prijava stigla. Pričekajte minutu pa je pošaljite ponovno; ako je već tamo, to ćemo vidjeti automatski.* Veza je prekinuta nakon što je aplikacija poslala vašu prijavu. Vaš tekst ostaje. Nema gumba *Otvori na GitHubu*, jer vaša prijava još može stići. To tako ostaje dok se prijava ne pošalje ili ne bude već zaprimljena, i ako u međuvremenu zatvorite prozor pa ga ponovno otvorite.

**Vaša prijava je već zaprimljena.** Ako pošaljete prijavu koja je već tu, obrazac ostaje, a iznad njega piše: *Ova prijava je već zaprimljena. Želite li nešto dodati? Tada promijenite tekst i pošaljite ga ponovno.* Vaš tekst ostaje i vaša adresa e-pošte se pamti. Kliknite *Zatvori* ako ništa ne želite dodati; sljedeći put je obrazac prazan. Ako upišete još nešto, poruka nestaje i možete ponovno poslati. Gumb se tada opet zove *Spremi i zatvori*, a vaš tekst se zadržava.

**Otvori na GitHubu.** To je put bez Open Feedback Studio. Za njega je potreban račun na GitHubu. Bez snimke zaslona stranica GitHuba na kojoj stvarate novi problem odmah se otvara u pregledniku, s već upisanim naslovom i opisom. Sa snimkom zaslona najprije vidite *Skoro je gotovo — snimka zaslona je na međuspremniku.* s četiri koraka. Kliknite *U redu, idi na GitHub*, kliknite u veliko tekstualno polje na stranici problema i pritisnite Ctrl+V (Cmd+V na Macu). Zatim kliknite *Pošalji novi problem* na dnu. Tek tada je vaša prijava poslana.

**Lijepljenje ne uspijeva.** Na putu preko GitHuba snimka zaslona se ujedno sprema kao datoteka na vašem računalu. U aplikaciji za računalo prozor navodi putanju: *Ne možete zalijepiti? Snimku zaslona smo spremili i u* tu putanju *— povucite tu datoteku u tekstualno polje.* U pregledniku aplikacija sliku preuzima kao `feedback-` s brojem i nastavkom `.png`. Nalazite je u mapi za preuzimanja i povlačite je u tekstualno polje.

**Snimanje zaslona ne uspijeva.** Pojavi se poruka *Snimanje zaslona nije uspjelo. Povratne informacije i dalje možete poslati bez snimke zaslona.* Potvrdni okvir se isključuje, a prijavu možete poslati bez slike.

**Zatvorite prozor prije slanja.** Ako je u obrascu nešto upisano, gumb na dnu zove se *Spremi i zatvori*. Kod praznog obrasca zove se *Zatvori*. *Spremi i zatvori*, križić i Esc zatvaraju prozor, a vaša prijava se čuva kao nacrt dok je ne pošaljete ili ne kliknete *Obriši*. Kad ponovno otvorite prozor, vrsta prijave, vaš tekst, adresa e-pošte i snimka zaslona s oznakama i dalje su tu. Nacrt se čuva dok je aplikacija otvorena. Nakon što zatvorite aplikaciju, nacrt je nestao. Nakon uspješne prijave obrazac je ponovno prazan. Ako sami želite početi ispočetka, kliknite *Obriši* dolje lijevo. Klik pokraj prozora ga ne zatvara. Dok se šalje, Esc ne zatvara prozor.

## Vidi također

- [Ažuriranje aplikacije](docs://howto-app-bijwerken): prije prijave provjerite imate li najnoviju verziju.
