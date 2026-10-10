# Generiranje praznika i kolektivnog godišnjeg odmora u građevinarstvu

Cilj: u kalendar unijeti praznike jedne države i, po potrebi, kolektivni godišnji odmor u građevinarstvu, te gdje je potrebno dodati vlastiti slobodni dan ili niz dana.

## Kada vam ovo treba

Bez praznika aplikacija jednostavno planira rad na Božić ili na Koningsdag (Kraljev dan). Novi projekt već dobiva nizozemske praznike, pod uvjetom da je *Građevinski način rada* uključen. Ponovno generirate praznike kada vam treba druga država ili regija. Isto tako ih ponovno generirate ako želite uključiti kolektivni godišnji odmor u građevinarstvu. Ili ako vaš projekt pada izvan godina za koje su praznici stvoreni. Te godine su važne. Za aplikaciju je dan izvan njih jednostavno radni dan. Kako aplikacija uzima praznik u obzir pri brojanju, možete pročitati u članku [Kalendari i radni dani](docs://uitleg-kalenders).

**Kolektivni godišnji odmor u građevinarstvu** (*bouwvak*) je kolektivni godišnji odmor nizozemske građevinske industrije, tri tjedna ljeti. U aplikaciji je zadano isključen.

## Koraci

### Generiranje praznika

1. Odaberite *Raspored › Kalendar › Kalendar* i na lijevoj strani odaberite kalendar u koji treba unijeti praznike.
2. Kliknite *Generiraj praznike…*. Ispod gumba otvara se odjeljak s izborima.
3. Odaberite *Država*: Nizozemska, Njemačka, Belgija, Francuska, Ujedinjena Kraljevina, Austrija, Švicarska ili *Bez praznika*. Za neke države pojavljuje se i popis *Regija*, na primjer savezna država u Njemačkoj. *Nacionalno* ostavlja samo praznike koji vrijede u cijeloj državi.
4. Za Nizozemsku odaberite *Kolektivni godišnji odmor u građevinarstvu*: *Nema* (zadano), *Sjever*, *Središnja* ili *Jug*. Kolektivni godišnji odmor pojavljuje se kao jedan unos na popisu, na primjer *Bouwvak (Noord)*, tri tjedna od ponedjeljka do petka. Ovaj izbor vidite samo ako je *Građevinski način rada* uključen.
5. Ispod izbora nalazi se sažetak, na primjer *Broj praznika: 21, 2026–2028*. Kliknite ga da vidite datume.
6. Kliknite *Generiraj*. Popis *Praznici* sada je ispunjen.
7. Kliknite *Primijeni*. Aplikacija odmah pokreće ponovno izračunavanje rasporeda.

Za Nizozemsku aplikacija svake godine na popis stavlja Nieuwjaar (Nova godina), Goede Vrijdag (Veliki petak), Pasen (Uskrs, dva dana), Koningsdag (Kraljev dan), Hemelvaart (Uzašašće), Pinksteren (Duhovi, dva dana) i Kerst (Božić, 25. i 26. prosinca). Ako Koningsdag padne u nedjelju, onda je 26. travnja. Bevrijdingsdag (Dan oslobođenja) je na popisu samo u lustrumskim godinama, na primjer 2025 i 2030.

Godine prate trajanje projekta: od godine prije datuma početka do godine nakon datuma završetka. Ako projekt nema datum završetka, do tri godine nakon godine početka. Datume početka i završetka prilagodite u *Postavke › Projekt › Podaci o projektu*.

### Ponovno generiranje nakon promjene trajanja projekta

Ako se vaš projekt pomakne ili dobije kasniji datum završetka, praznici više ne pokrivaju nove godine. Aplikacija to javlja u prozoru *Kalendari*, na primjer *Praznici pokrivaju 2025–2028; projekt traje do 2030. Želite li ponovno generirati?* Zatim kliknite *Ponovno generiraj*. Aplikacija koristi iste izbore kao zadnji put (država, regija, kolektivni godišnji odmor u građevinarstvu) za godine projekta. Zatim kliknite *Primijeni*. Ovu poruku vidite samo za kalendar čiji su praznici ranije generirani.

### Dodavanje vlastitog slobodnog dana ili niza dana

1. U prozoru *Kalendari* kliknite *Dodaj praznik*. Na dnu popisa pojavljuje se novi redak s današnjim datumom pod *Od*.
2. Upišite *Opis*, na primjer *Izlet tvrtke*.
3. Prilagodite *Od*. Ostavite *Do* prazno za jedan dan ili upišite posljednji slobodni dan za niz dana, na primjer za zimski odmor.
4. Kliknite *Primijeni*.

Ikonom kante iza retka uklanjate praznik.

### Uklanjanje svih praznika

Odaberite *Bez praznika* pod *Država* i kliknite *Generiraj*. Popis je tada prazan.

## Zamke i što tada radi aplikacija

**Generiranje zamjenjuje cijeli popis.** Dani koje ste sami dodali također nestanu. Dodajte ih poslije ponovno.

**Goede Vrijdag (Veliki petak) je uključen.** Ako vaša tvrtka radi na Veliki petak ili na Dan oslobođenja u lustrumskoj godini, uklonite taj redak kantom.

**Datumi kolektivnog godišnjeg odmora u građevinarstvu su preporučeni datumi.** Aplikacija ih zna za 2025 do i uključujući 2028. Za ostale godine radi grubu procjenu. Kada je izabran kolektivni godišnji odmor u građevinarstvu, aplikacija zato prikazuje *Preporučeni datumi — provjerite kod Bouwend Nederland*. Po potrebi prilagodite unos na popisu.

**Neispravan redak.** Redak bez ispravnog *Od*, *Do* koji je prije *Od* ili nečitljivog datuma dobiva crvenu poruku, na primjer *Datum završetka je prije datuma početka.* *Primijeni* je onemogućen dok ga ne ispravite.

**Kod novog projekta.** Prozor *Novi projekt* ima iste izbore pod *Skup praznika*. Ako odaberete *Prilagođeno…*, počinjete bez praznika. Nakon stvaranja otvara se prozor *Kalendari* da ih sami unesete.

## Vidi također

- [Kalendari i radni dani](docs://uitleg-kalenders): kako aplikacija uzima praznike i kolektivni godišnji odmor u građevinarstvu u obzir pri brojanju radnih dana.
- [Stvaranje i dodjela kalendara](docs://howto-kalender-maken-en-toewijzen): stvaranje vlastitog kalendara u koji unosite praznike.
- [Prozori kalendara](docs://ref-kalenders): sva polja prozora kalendara.
- [Novi projekt i Podaci o projektu](docs://ref-projectinfo): skup praznika za novi projekt.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): uz praznike projektni kalendar ima i niz slobodnih dana *Frost delay, foundations*.
