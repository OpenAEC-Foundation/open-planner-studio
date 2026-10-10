# Odabir, brisanje i poništavanje zadataka

Cilj: odabrati zadatke, ukloniti ih i poništiti pogrešku.

## Kada to trebate

Gotovo svaka radnja u rasporedu djeluje na odabrane zadatke, na primjer brisanje, kopiranje, uvlačenje ili uključivanje i isključivanje kontrolne točke. Zadatke uklanjate kada posao otpadne ili kada revidirate raspored. Aplikacija pri brisanju ne traži potvrdu. Zato je *Poništi* vaša sigurnosna mreža.

## Koraci

### Odabir zadataka

- **Jedan zadatak.** Kliknite redak u tablici zadataka ili traku u Gantt dijagramu.
- **Više zadataka.** Ctrl+klik (⌘+klik na Macu) dodaje zadatak u odabir ili ga uklanja. U tablici zadataka Shift+klik odabire sve zadatke od aktivnog zadatka do onoga na koji ste kliknuli.
- **Svi vidljivi zadaci.** Ctrl+A, dok je fokus u tablici zadataka ili u Gantt dijagramu. Zadaci koje skriva filtar nisu obuhvaćeni, kao ni podzadaci u sažetoj fazi.
- **Okvir u Gantt dijagramu.** Držite Ctrl i povucite preko prazne pozadine. Odabrani su svi zadaci u redcima koje okvir dodiruje, čak i ako je njihova traka pored okvira. Važna je samo visina okvira, ne vremenska os. Ako otpustite Ctrl tek nakon tipke miša, zadaci se dodaju postojećem odabiru. Inače ga zamjenjuju. Bez Ctrl to povlačenje pomiče vremensku os. Tako je zadano.
- **Ništa.** Pritisnite Esc ili kliknite na praznu pozadinu Gantt dijagrama.

Ako odaberete zadatak sažetka, njegovi podzadaci se ne odabiru zajedno s njim. Brisanje i kopiranje ih ipak obuhvaćaju.

### Brisanje zadataka

Odaberite zadatke i upotrijebite jedan od ovih načina:

- *Početna › Uređivanje › Izbriši*. Isti gumb nalazi se na kartici *Tablica*.
- Delete ili Backspace, ako fokus nije u tablici zadataka. Zato prvo kliknite traku u Gantt dijagramu.
- *Izbriši* u izborniku desnog klika. Ako je zadatak na koji ste kliknuli dio odabira, to se primjenjuje na cijeli odabir. Inače samo na taj jedan zadatak.
- Mala ikona kante za smeće na vrhu okna *Svojstva* (savjet *Izbriši zadatak*). Time se briše zadatak koji okno prikazuje.

Aplikacija ne traži potvrdu. Ako izbrišete više zadataka odjednom, to je jedan korak za *Poništi*.

Zajedno s njima nestaje: svi podzadaci obrisanog zadatka sažetka, sve ovisnosti od i do obrisanih zadataka te njihove dodjele resursa. Ako izbrišete posljednji podzadatak zadatka sažetka, on ostaje kao običan zadatak. Ako je uključen *WBS auto*, aplikacija ponovno numerira stablo. Raspored nakon toga više nije ažuran: pritisnite **Izračunaj** (F5), osim ako je *Automatsko izračunavanje* uključeno.

### Sažimanje i proširivanje

Zadatak sažetka ima trokutić ispred naziva u tablici zadataka. Kliknite ga da sakrijete ili prikažete njegove podzadatke. Pomoću naredbi *Prikaz › Pregled › Sažmi* i *Proširi* to radite za odabrane zadatke sažetka ili za sve njih ako ništa nije odabrano. Izbornik desnog klika zadatka sažetka također ima *Sažmi* i *Proširi*. U prikazu s grupiranjem gumbi rade na grupama.

Aplikacija pamti sažimanje i proširivanje za svaki otvoreni dokument. To nije dio *Poništi* i nije u datoteci projekta.

### Poništavanje i ponavljanje

- *Početna › Uređivanje › Poništi* i *Ponovi* (također na kartici *Tablica*), strelice u naslovnoj traci ili Ctrl+Z za poništavanje, a Ctrl+Y ili Ctrl+Shift+Z za ponavljanje.
- Ako nakon poništavanja učinite nešto novo, *Ponovi* više nije dostupno.

*Poništi* obuhvaća promjene u podacima projekta (zadaci, ovisnosti, resursi, kalendari i slično) te primjenu izgleda. Promjene stupaca u tablici zadataka također su koraci: dodavanje, uklanjanje, premještanje, promjena veličine, automatsko prilagođavanje, prikvačivanje i vraćanje izgleda stupaca na zadano. Ti koraci pripadaju samoj tablici zadataka i vrijede za cijelu aplikaciju, a ne za jedan dokument. Aplikacija čuva posljednjih sto koraka po dokumentu, a za vrlo velike projekte manje.

## Zamke i što aplikacija radi

**Tipka Delete u tablici zadataka ne briše zadatak.** Ako je fokus u tablici zadataka, Delete (ili Backspace) briše sadržaj odabranih ćelija. Za obaveznu ili izračunatu ćeliju, na primjer naziv ili trajanje, aplikacija to odbija i ispod tablice zadataka prikaže poruku. Za naziv, na primjer, poruka glasi: *Ova vrijednost je obavezna i ne može ostati prazna.* Tada se ne briše ništa, ni u drugim odabranim ćelijama. Kliknite traku u Gantt dijagramu ili upotrijebite *Izbriši* (na kartici *Tablica*, gdje nema Gantt dijagrama: *Tablica › Uređivanje › Izbriši* ili izbornik desnog klika).

**Cijela faza nestaje odjednom.** Ako izbrišete zadatak sažetka, njegovi podzadaci, njihove ovisnosti i dodjele nestaju zajedno s njim. *Poništi* (Ctrl+Z) vraća sve, uključujući ovisnosti i dodjele.

**Što se ne vraća.** Odabir, sažimanje i proširivanje te gumb *Obriši* u traci *Nije dostupno tijekom filtriranja, grupiranja ili sortiranja* nisu dio *Poništi*. Ako pritisnete Ctrl+Z nakon *Obriši*, poništite prethodni korak, a ne radnju *Obriši*.

**Uklanjanje zadatka o kojem drugi ovise.** Ovisnosti od i do tog zadatka također nestaju. Zadaci koji su bili vezani samo uz njega odvajaju se i nakon **Izračunaj** ponovno dobivaju vlastiti planirani početak. Po potrebi dodajte nove ovisnosti, pogledajte [Dodavanje ovisnosti](docs://howto-relaties-leggen).

## Vidi također

- [Dodavanje zadataka i kontrolnih točaka](docs://howto-taken-en-mijlpalen-toevoegen): suprotnu radnju te kopiranje zadataka.
- [Prilagođavanje strukture](docs://howto-structuur-aanpassen): premjestite zadatak pod drugu fazu umjesto da ga uklonite.
- [Povlačenje, pomicanje i zumiranje u Gantt dijagramu](docs://howto-gantt-bedienen): okvir za odabir i načini pomicanja.
- [Izbornici desnog klika](docs://ref-contextmenus): što *Izbriši* i ostale stavke rade s odabirom.
