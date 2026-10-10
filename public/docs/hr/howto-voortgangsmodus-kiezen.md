# Odabir načina praćenja napretka

Cilj: odlučite kako aplikacija planira preostali posao zadatka koji je već počeo dok njegov prethodnik još traje: prema ovisnosti (Retained Logic) ili prema onome što se stvarno događa (Progress Override).

## Kada vam ovo treba

Na gradilištu se često radi brže nego što logika predviđa. Soboslikar već počinje u prostorijama koje su već ožbukane, dok je žbukar još zauzet negdje drugdje. U rasporedu je to, na primjer, ovisnost završetak-početak čiji nasljednik počinje prije nego što je prethodnik završen. Aplikacija to naziva **napredak izvan redoslijeda**. Ako traka stanja prikazuje *Ovisnosti izvan redoslijeda: N*, imate takav slučaj i način praćenja napretka određuje kako aplikacija planira preostali posao nasljednika. Što oba načina rade, s primjerom, nalazi se u [Napredak, datum stanja i temeljni plan](docs://uitleg-voortgang).

## Koraci

1. Ažurirajte napredak i postavite datum stanja, kako je opisano u [Ažuriranje napretka](docs://howto-voortgang-bijwerken).
2. Idite na *Raspored › Temeljni planovi i napredak › Način praćenja napretka* i otvorite popis.
3. Odaberite *Retained Logic* ili *Progress Override*.
4. Pritisnite **Izračunaj** (F5), na primjer putem *Raspored › Raspored › Izračunaj*. Izbor čini raspored zastarjelim: traka stanja prikazuje *Zastarjelo — ponovno izračunajte (F5)*. Ako je *Automatsko izračunavanje* uključeno, aplikacija to radi sama.

Kako birate?

- **Retained Logic** je zadano. Ovisnost ostaje na snazi: preostali posao nasljednika počinje tek kad je prethodnik završen. Odaberite to ako je redoslijed stvarno fiksan ili ako želite planirati oprezno.
- **Progress Override** daje prednost stvarnosti. Preostali posao nasljednika počinje na datumu stanja, bez čekanja na prethodnika. Odaberite to ako nasljednik stvarno nastavlja raditi i ako datum završetka ne bi trebao ovisiti o prethodniku koji još traje.

## Provjera rezultata

- Kliknite poruku *Ovisnosti izvan redoslijeda: N* u traci stanja. Otvara se okno *Upozorenja*, koje je također dostupno putem *Raspored › Raspored › Upozorenja*. U njemu je svaka ovisnost s tekstom *Izvan redoslijeda: napredak nasljednika proturječi ovisnosti*, na primjer *4.2 Plastering → 4.5 Painting (FS)*.
- Pogledajte traku nasljednika. Pod Retained Logic ona traje do nakon završetka prethodnika. Pod Progress Override završava ranije. U primjeru iz objašnjenja to je utorak, 27. srpnja, naspram četvrtka, 22. srpnja.

## Zamke i što aplikacija radi

**Nema razlike.** Način djeluje samo na zadatke koji su već počeli dok prethodnik još nije završen. Bez takvog zadatka ništa se ne mijenja.

**Poruka ostaje.** Progress Override ne rješava poruku o napretku izvan redoslijeda. Način određuje kako aplikacija izračunava; proturječje između ovisnosti i napretka ostaje. Ako ovisnost više nije točna, promijenite je ([Dodavanje ovisnosti](docs://howto-relaties-leggen)).

**Pripada projektu.** Izbor se sprema s datotekom projekta, vrijedi za cijeli projekt i može se poništiti tipkama Ctrl+Z. Novi projekt postavljen je na Retained Logic.

**Datoteka P6.** Ako otvorite datoteku Primavera P6 (.xer), aplikacija preuzima način iz datoteke. Osim Retained Logic i Progress Override, P6 ima i Actual Dates. Aplikacija ne poznaje taj treći način; takva se datoteka izračunava kao Retained Logic. Poruka o uvozu to broji kao *1 postavka rasporeda P6 upotrijebila je sigurno zamjensko rješenje.*

**Profil izračuna.** U profilu Primavera P6 Progress Override također djeluje unatrag, u kasnim datumima i slobodnom hodu prethodnika (pravilo izračuna *Progress Override ignorira započetog nasljednika i unatrag*). U profilima Open Planner Studio i Microsoft Project to nije tako. Pravila pronalazite pod *Postavke › Projekt › Podaci o projektu*, u dijelu *Profil izračuna i opcije izračuna*. U primjeru iz objašnjenja taj učinak unatrag nije vidljiv.

## Vidi također

- [Napredak, datum stanja i temeljni plan](docs://uitleg-voortgang): razlika između dva načina praćenja napretka, s brojevima.
- [Ažuriranje napretka](docs://howto-voortgang-bijwerken): unos napretka na kojem djeluje način praćenja napretka.
- [Dodavanje ovisnosti](docs://howto-relaties-leggen): mijenjanje ovisnosti koja više nije točna.
