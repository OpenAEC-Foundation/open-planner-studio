# Postavljanje kalendara resursa

Cilj: zabilježiti na koje je dane resurs dostupan, kako bi histogram, preopterećenje resursa i uravnoteživanje računali s time.

## Kada vam ovo treba

Ekipa zidara radi samo od ponedjeljka do četvrtka. Kran je u prva dva tjedna kolovoza na drugom projektu. Podizvođač ima četiri fiksna radna dana. Bez vlastitog kalendara aplikacija pretpostavlja da resurs radi u iste dane kao kalendar projekta.

Kalendar resursa ne mijenja nijedan datum zadatka. Određuje samo kada je resurs dostupan. Ako zadatak radi na dan kada resurs ne radi, kapacitet tog dana je 0 i dan se broji kao preopterećenje resursa. Ako zadatak sam treba raditi u druge dane, dajte mu vlastiti kalendar ([Stvaranje i dodjela kalendara](docs://howto-kalender-maken-en-toewijzen)). Razlika je objašnjena u članku [Kalendari i radni dani](docs://uitleg-kalenders).

## Koraci

### Stvaranje novog kalendara resursa

1. Odaberite *Resursi › Upravljanje › Resursi*. Otvara se okno resursa. Ako resurs još ne postoji, stvorite ga pomoću naredbe *Novi resurs u projektu*.
2. Pronađite redak resursa. U stupcu *Kalendar* zadana vrijednost je *Kalendar projekta*: resurs tada slijedi kalendar projekta.
3. Na tom popisu odaberite *+ Kalendar resursa*. Otvara se prozor *Kalendar resursa*. Ima ista polja kao obrazac kalendara: *Naziv*, *Radni dani*, radno vrijeme i *Praznici*. Novi kalendar počinje kao kopija standardnog kalendara i zove se *Kalendar resursa*.
4. Dajte kalendaru naziv koji odgovara resursu, na primjer *Crew Mon–Thu*, i postavite radne dane: kliknite petak da ga isključite ispod naslova *Radni dani*. Praznike ili zastoje unosite na popis *Praznici* pomoću naredbe *Dodaj praznik*.
5. Kliknite *Primijeni*. Kalendar je sada u biblioteci projekta i povezan je s resursom, u jednom koraku koji poništite pomoću naredbe *Poništi*. Ako kliknete *Odustani*, ništa nije stvoreno.

### Odabir ili prilagodba postojećeg kalendara

U stupcu *Kalendar* odaberite kalendar s popisa. *Kalendar projekta* opet uklanja vlastiti kalendar. Ako želite prilagoditi odabrani kalendar, kliknite olovku pored popisa (*Uredi…*). Otvara se prozor *Kalendar resursa* s trenutnim kalendarom.

### Pregled rezultata

1. Ako traka stanja prikazuje *Zastarjelo — ponovno izračunajte (F5)*, pritisnite **Izračunaj** (F5).
2. Odaberite *Resursi › Histogram › Histogram* i kliknite resurs na popisu lijevo od histograma. Dani na kojima resurs ne radi, a planiran je, crveni su. Ako zadržite pokazivač miša iznad jednog od njih, savjet prikazuje, na primjer, *Prema kalendaru „Crew Mon–Thu” ne radi na ovaj dan*.
3. U izborniku *Resursi › Preopterećenje* nalazi se broj preopterećenih resursa, a traka stanja prikazuje, na primjer, *Preopterećenja resursa: 1*.

## Zamke i što aplikacija tada radi

**Broje se samo dani, ne sati.** Kalendar resursa određuje na koje dane resurs radi. Koliko je jedinica dodjele tog dana dostupno, određuje *Maksimalan postotak jedinica* resursa, a ne radno vrijeme u kalendaru.

**Uravnoteživanje ne rješava uvijek ovaj problem.** Ako ne postoji razdoblje u kojem je svaki dan zadatka radni dan resursa, pomicanje ne pomaže. Odaberite *Resursi › Uravnoteživanje › Razriješi…* i kliknite *Izračunaj*. Zadatak se tada nalazi ispod naslova *Preostali sukobi*, s razlogom *Resurs ne radi na sve dane koje zadatak treba — pomicanje to ne rješava.* Zatim dodijelite zadatak drugom resursu ili mu dajte vlastiti kalendar.

**Zajednički kalendar.** Popis prikazuje sve kalendare projekta, dakle i kalendar projekta i kalendare zadataka. Ako takav kalendar prilagodite olovkom, mijenja se i raspored zadataka koji ga koriste, a traka stanja prikazuje *Zastarjelo — ponovno izračunajte (F5)*. Bolje je napraviti vlastiti kalendar za resurs.

**Preopterećenje resursa nije uvijek posljedica kalendara.** Resurs koji radi svaki dan može također imati preopterećenje resursa: savjet spominje kalendar samo ako dan nije radni dan resursa.

## Vidi također

- [Kalendari i radni dani](docs://uitleg-kalenders): zašto kalendar resursa ne pomiče nijedan datum.
- [Stvaranje i dodjela kalendara](docs://howto-kalender-maken-en-toewijzen): polja obrasca kalendara.
- [Generiranje praznika i kolektivnog godišnjeg odmora u građevinarstvu](docs://howto-feestdagen-genereren): unos praznika i zastoja u kalendar.
- [Prozori kalendara](docs://ref-kalenders): sva polja prozora kalendara.
