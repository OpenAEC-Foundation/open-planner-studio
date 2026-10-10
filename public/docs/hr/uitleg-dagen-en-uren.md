# Dani i sati

Zadatak od 2 dana i zadatak od 16 sati izgledaju isto, ali aplikacija ih izračunava drugačije. Zašto možete birati između dana i sati? I što se događa kad je zadatak u satima povezan sa zadatkom u danima? U ovom članku pročitat ćete kako aplikacija broji dane i sate i gdje zaokružuje. Primjer s dizalicom prikazuje brojke.

## Pojam

**Zadatak u danima** ima trajanje u cijelim radnim danima, na primjer `5d`. Zauzima cijele radne dane. Na standardnom kalendaru ima datum početka i datum završetka bez vremena.

**Zadatak u satima** ima trajanje u radnim satima, na primjer `12h` ili `1h 30m`. Ima početak i završetak s vremenom na satu, na primjer utorak, 11:00.

Jedinica pripada zadatku, a ne projektu. U jednom rasporedu možete kombinirati zadatke u danima i zadatke u satima. To se zove **miješano planiranje**.

Sate koristite za posao koji ne stane u cijele dane: dizalicu koju unajmite na dvanaest sati, lijevanje u trajanju od šest sati, zadatak koji može početi tek nakon ručka. Za sve ostalo dovoljni su dani, a jasniji su.

**Planiranje u satima** je zadano isključeno. Dok je tako, aplikacija radi u danima. Ako datoteka ipak sadrži planiranje u satima, na primjer zadatke u satima, aplikacija prikazuje *Ova datoteka sadrži planiranje u satima.* Ti se zadaci i dalje izračunavaju, ali njihovo trajanje možete uređivati tek kad uključite planiranje u satima.

## Kako aplikacija izračunava

### Radna vremena i neto sati

Svaki kalendar ima **blokove radnog vremena** za svaki radni dan (u aplikaciji se zovu *bands*). Standardni kalendar ima od 07:00 do 12:00 i od 13:00 do 16:00. Razmak između njih je pauza. Aplikacija te blokove izvodi iz polja *Početak (sat)*, *Završetak (sat)* i pauze kalendara. Za to ne morate ništa postaviti. Ako sami postavite blokove po danu u tjednu, oni imaju prednost.

**Neto sati po danu** su zbroj blokova radnog dana. Ako se radni dani razlikuju po duljini, vrijedi najčešći dnevni zbroj, a kod izjednačenja najveći. S četiri dana od 8 sati i petkom od 5 sati neto sati po danu su zato 8.

### Zadatak u satima

Aplikacija broji radne minute od početka, kroz blokove radnog vremena. Pauze, večeri, vikendi i praznici se ne računaju. Zadatak od 12 sati zato ne stane u jedan radni dan od 8 sati: nastavlja se sljedeći dan.

### Zadatak u danima

Aplikacija broji cijele radne dane. Sati po danu nemaju nikakvu ulogu. Zadatak od 5 dana završava istog dana, bez obzira na to ima li kalendar 6 ili 8 sati po danu.

### Pretvaranje dana i sati

Dan je neto sati po danu kalendara zadatka. Aplikacija to koristi na tri mjesta:

- Za *Prikaz trajanja*. Pod *Postavke › Projekt › Postavke*, na kartici *Prikaz*, odaberete *Automatski (vlastita jedinica po zadatku)*, *Uvijek dani* ili *Uvijek sati*. Zadatak od 18 sati pod *Uvijek dani* prikazuje se kao `2.25d(18h)`: vlastita jedinica ostaje u zagradama.
- Za vrijeme odgode u satima nakon zadatka u danima (vidi *Zaokruživanje*).
- Kada promijenite jedinicu zadatka. Aplikacija tada broji dane od početka zadatka, pri čemu svaki dan ima svoje sate, i predlaže promjenu samo ako je rezultat točan. Dva dana postaju `16h`. Na kalendaru u kojem petak ima 5 sati postaju 5 dana od ponedjeljka `37h`. Dvanaest sati ne može se pretvoriti u cijele dane na kalendaru s danima od 8 sati: aplikacija tada ostavlja jedinicu kakva jest.

### Zadaci u danima i zadaci u satima zajedno

Pravila u nastavku vrijede za ovisnost završetak-početak na kalendaru bez vlastitih blokova radnog vremena, kao što je standardni kalendar.

- **Zadatak u satima → zadatak u satima.** Nasljednik počinje čim je prethodnik završen, čak i ako je to usred dana.
- **Zadatak u satima → zadatak u danima.** Zadatak u danima nikad ne počinje usred dana. Počinje prvoga radnog dana nakon dana u kojem završava zadatak u satima. Ostatak tog dana ostaje neiskorišten i vraća se kao vremenska rezerva zadatka u satima.
- **Zadatak u danima → zadatak u satima.** Zadatak u danima zauzima cijeli svoj posljednji dan. Zadatak u satima počinje prvoga radnog dana nakon njega, na početku prvog bloka radnog vremena.

### Zaokruživanje

Aplikacija zaokružuje ili odbija na četiri mjesta:

- **Zadatak u danima nakon zadatka u satima** počinje sljedećeg radnog dana. Zadatak u satima je, takoreći, zaokružen na cijele dane.
- **Vrijeme odgode u satima** broji se u kalendaru za vrijeme odgode, zadano u kalendaru prethodnika. Ako je prethodnik zadatak u danima na kalendaru bez vlastitih blokova radnog vremena, kao što je standardni kalendar, aplikacija pretvara vrijeme odgode u cijele radne dane: vrijeme odgode podijeljeno s neto satima po danu, zaokruženo na cijeli broj; pola dana zaokružuje se naviše. Pri 8 sati po danu 1 sat broji se kao 0 dana, 4 sata kao 1 dan i 12 sati kao 2 dana. To vrijedi i kad je nasljednik zadatak u satima. Ako je prethodnik zadatak u satima ili kalendar ima vlastite blokove radnog vremena, vrijeme odgode broji se točno u radnim satima i pauza se ne računa.
- **Trajanje u danima** uvijek je cijeli broj. Ako upišete `1.5d`, aplikacija prijavljuje *Unesite cijeli broj dana ili sati, na primjer 2d ili 12h.* Trajanje u satima može biti `1.5h` ili `1h 30m`.
- **Promjena jedinice** dogodi se samo ako je rezultat točan (vidi gore).

## Primjer: dizalica

Kalendar je od ponedjeljka do petka, od 07:00 do 12:00 i od 13:00 do 16:00: 8 neto sati po danu. Projekt počinje u ponedjeljak, 7. lipnja 2027.

### Dva zadatka u satima i zadatak u danima

*Place crane* traje 12 sati. Ponedjeljak ima 8 radnih sati (5 do 12:00 i 3 nakon pauze), a utorak posljednja 4 sata. Zadatak traje od ponedjeljka 07:00 do **utorka, 8. lipnja, 11:00**.

*Adjust elements* traje 8 sati i slijedi s ovisnošću završetak-početak. Počinje odmah u utorak u 11:00: to je 1 sat do pauze i 3 sata nakon nje. Posljednja 4 sata su srijeda od 07:00 do 11:00. Završetak je **srijeda, 9. lipnja, 11:00**.

*Finishing* traje 2 dana i slijedi nakon *Adjust elements*. Zadatak u danima ne počinje usred dana, pa počinje **u četvrtak, 10. lipnja**, i završava u petak, 11. lipnja.

### Zaokruživanje na prijelazu

Ako izostavite *Adjust elements* i izravno povežete *Finishing* s *Place crane*, *Finishing* počinje u srijedu, 9. lipnja, i završava u četvrtak, 10. lipnja. Ostatak utorka (4 radna sata) ne može se iskoristiti. Te 4 sata ponovno vidite kao ukupan slobodni hod zadatka *Place crane*: pola radnog dana.

Obrnite redoslijed i bit će jednostavnije. *Pour foundation* traje 2 dana, od ponedjeljka 7. do utorka 8. lipnja. *Place crane* sada traje 4 sata i slijedi. Počinje **u srijedu, 9. lipnja u 07:00**, a završava u 11:00.

### Vrijeme odgode u satima

Između *Place crane* (12 sati) i *Adjust elements* (8 sati) postavite vrijeme odgode od 2 sata. *Adjust elements* tada ne počinje u 11:00, nego u utorak u **14:00**: 1 sat do pauze i 1 sat nakon nje. Završetak se pomiče na **srijedu, 9. lipnja, 14:00**.

Nakon zadatka u danima vrijeme odgode radi drugačije. *Pour foundation* završava u utorak, 8. lipnja. Bez vremena odgode *Finishing* počinje u srijedu, 9. lipnja. S vremenom odgode od 4 sata to je pola dana, a aplikacija zaokružuje naviše: *Finishing* počinje **u četvrtak, 10. lipnja**. S vremenom odgode od 1 sata aplikacija zaokružuje naniže, a *Finishing* jednostavno počinje u srijedu.

### Slobodno popodne u petak

Sada petak ima samo jedan blok, od 07:00 do 12:00: 5 sati. Ostali dani ostaju na 8 sati. Neto sati po danu ostaju 8, jer je to najčešći dnevni zbroj. Tjedan sada ima 37 radnih sati.

Zadatak od 40 sati, od ponedjeljka, 7. lipnja u 07:00, koristi ponedjeljak do četvrtka (32 sata) i petak (5 sati). Posljednja 3 sata padaju na sljedeći ponedjeljak, od 07:00 do 10:00. Završetak je **ponedjeljak, 14. lipnja, 10:00**. Zadatak od 5 dana zauzimao bi 37 sati od ponedjeljka, i to aplikacija predlaže ako promijenite jedinicu s 5 dana na sate.

U lekciji 4, o planiranju u satima, sami planirate posao s dizalicom u satima.

## Posljedice i pogrešna tumačenja

**„8 sati je 1 dan.“** Samo ako kalendar ima dane od 8 sati. Na kalendaru sa slobodnim popodnevom u petak 5 dana je 37 sati, a ne 40.

**„Ako postavim više sati po danu, moj zadatak u danima završava ranije.“** Ne. Zadatak u danima broji cijele radne dane. Sati po danu mijenjaju samo to koliko vrijedi dan u satima, na primjer u prikazu i za vrijeme odgode u satima. Samo za zadatak s resursima i pravilom rada *Fiksni rad* ili *Fiksne jedinice* trajanje se mijenja s time, jer rad ostaje isti: 40 sati rada odgovara 5 dana po 8 sati i 7 dana po 6 sati.

**„Zadatak od 8 sati traje jedan dan.“** Samo ako počinje na početku dana. Ako počinje kasnije, kao *Adjust elements* u utorak u 11:00, nastavlja se sljedeći dan.

**Kalendar s vlastitim blokovima radnog vremena** ponaša se drugačije od standardnog kalendara. Takav kalendar dobit ćete postavljanjem radnih vremena po danu u tjednu ili odabirom predloška smjena (*2 smjene*, *3 smjene*, *Noćna smjena* ili *24/7*). Na takvom kalendaru vrijeme odgode u satima broji se točno u radnim satima, također nakon zadatka u danima.

**Isključivanje planiranja u satima ništa ne briše.** Zadaci u satima ostaju i još se izračunavaju, ali ih ne možete uređivati dok ponovno ne uključite planiranje u satima.

## Vidi također

- [Uključivanje planiranja u satima](docs://howto-urenplanning-aanzetten): koraci za planiranje zadatka u satima.
- [Postavljanje radnih vremena](docs://howto-werktijden-instellen): podešavanje blokova radnog vremena kalendara.
- [Kalendari i radni dani](docs://uitleg-kalenders): kako aplikacija broji radne dane i koji kalendar ima prednost.
- [Dodavanje ovisnosti](docs://howto-relaties-leggen): koraci za dodavanje ovisnosti ili vremena odgode.
