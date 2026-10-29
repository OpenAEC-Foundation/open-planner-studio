# Spajanje AI pomoćnika (MCP)

Cilj: omogućiti AI pomoćniku da prati vaš raspored i radi na njemu. Vi vidite što pomoćnik radi. Ograničenja postavljate sami.

## Kada vam ovo treba

Želite da AI pomoćnik čita, analizira ili mijenja vaš raspored. Na primjer, da izradi prvi WBS, ispravi zadatke ili objasni kritični put. To radi preko **Model Context Protocol** (MCP): standarda koji AI pomoćniku omogućuje korištenje alata nekog programa. Za to Open Planner Studio pokreće mali poslužitelj na vašem računalu, **most**. Most nudi skup alata. Svi imaju naziv koji počinje s `planner_`: čitanje i mijenjanje zadataka, ovisnosti, resursa, kalendara, temeljnih planova, dokumenata i datoteka. Koji alati postoje i koje pozive aplikacija odbija, opisano je u [AI alati](docs://ref-ai-tools). Zašto povezivanje tako radi, opisano je u [Kako radi povezivanje s AI-jem](docs://uitleg-ai-koppeling).

Most radi samo u desktop-aplikaciji. Ako AI način rada uključite u pregledniku, vidite karticu *AI*. Gumb *Pokreni most* je tada siv, uz tekst *Most radi samo u desktop-aplikaciji*. Ostatak ovog članka odnosi se na desktop-aplikaciju. U pregledniku su siva i *Napravi sigurnosnu kopiju* i *Otvori mapu sigurnosnih kopija*.

## Koraci

### 1. Uključite AI način rada

1. Odaberite *Postavke › Projekt › Postavke aplikacije*. Također možete odabrati *Datoteka › Postavke aplikacije* ili zupčanik na vrhu.
2. Odaberite karticu *Napredno* i uključite *Omogući AI način rada*. Kartica *AI* pojavljuje se na vrpci.
3. Ako želite da most bude aktivan čim se aplikacija pokrene, uključite i *Automatski pokreni most*. Ta se postavka uključuje samo kad je AI način rada uključen. Radi samo u stolnoj aplikaciji. Zadano je isključena, jer je otvaranje porta namjerna odluka.

Ako isključite AI način rada, most se zaustavi i kartica *AI* nestane.

### 2. Pokrenite most

1. Idite na karticu *AI* i kliknite *Pokreni most* pod *Poslužitelj*.
2. Pogledajte status uz gumb. Tu piše *Isključeno*, *Aktivno na portu 3877*, *Port 3877 je zauzet* ili *Greška*. Ako pokretanje uspije, piše *Aktivno na portu 3877* i gumb se zove *Zaustavi most*. Uz *Port 3877 je zauzet* ili *Greška* gumb ostaje *Pokreni most*. Pogledajte dio o mogućim problemima.

Most sluša samo na vašem računalu, na jednom portu. Zadano je to port 3877. U grupi *Povezivanje* možete pod *Port* odabrati drugi port, ali samo dok je most zaustavljen.

### 3. Povežite pomoćnika

1. Kliknite *Poveži* pod *Povezivanje*. Otvara se prozor *Podaci za povezivanje*.
2. Odaberite što vaš klijent treba. Pogledajte u nastavku.
3. Token je skriven. Ikonom s okom prikazujete token. Gumbi za kopiranje uvijek kopiraju pravu vrijednost, čak i kad je token na ekranu skriven.
4. Zamolite pomoćnika da zatraži popis alata. Ta provjera je i u upitu za povezivanje: pomoćnik treba vidjeti alate s prefiksom `planner_`. Očekivani broj je u upitu za povezivanje.

Prozor nudi tri načina povezivanja:

- *Fragment konfiguracije*: dio konfiguracije koji zalijepite u postavke MCP-a vašeg klijenta.
- *Upit za povezivanje*: tekst koji zalijepite u AI pomoćnika. Nakon toga se pomoćnik sam poveže.
- *Krajnja točka* i *Autentifikacija*: zasebni podaci. Krajnja točka je `http://localhost:3877/mcp` s transportom *streamable HTTP*. Svaki zahtjev mora imati zaglavlje `Authorization: Bearer`, nakon čega slijedi vaš token. Vaš klijent mora također podržavati MCP sesije: kad se poveže, most daje kod sesije u zaglavlju `Mcp-Session-Id` i odbija svaki sljedeći zahtjev bez tog koda. Claude Code i `mcp-remote` to rade sami.

**Ponovno se povežite nakon ažuriranja aplikacije.** Ako je vaš AI klijent već bio povezan sa starijom verzijom aplikacije, još ne šalje kod sesije i most odbija svaki zahtjev. Zato se povežite ponovno nakon ažuriranja: pokrenite novu sesiju u Claude Code i potpuno zatvorite Claude Desktop, pa ga ponovno pokrenite.

**Claude Code.** Fragment konfiguracije izravno odgovara alatu Claude Code. U terminalu upišite ovu naredbu, s vlastitim tokenom umjesto `<token>`:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Fragment možete staviti i u datoteku `.mcp.json` u mapi projekta. Tada tu datoteku nemojte staviti u git, jer token daje pristup vašem planu. Poslužitelj iz `.mcp.json` mora se prvi put odobriti u Claude Code.

**Claude Desktop.** Fragment konfiguracije ne odgovara izravno aplikaciji Claude Desktop. U datoteci `claude_desktop_config.json` navodite program koji Claude Desktop sam pokreće, a ne adresu. Zato upotrijebite vanjski alat `mcp-remote` kao posrednika; potreban je Node.js. U aplikaciji Claude Desktop odaberite *Postavke › Programer › Uredi konfiguraciju*, u datoteku stavite ovo (s vlastitim tokenom) i ponovno pokrenite Claude Desktop:

```
{
  "mcpServers": {
    "open-planner-studio": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3877/mcp", "--header", "Authorization:${AUTH_HEADER}"],
      "env": { "AUTH_HEADER": "Bearer <token>" }
    }
  }
}
```

Token je namjerno u `env`, a ne u `args`: u sustavu Windows aplikacija Claude Desktop pokvari argument koji sadrži razmak. *Prilagođeni konektor* u aplikaciji Claude (*Prilagodi › Konektori*) ne radi s mostom. Claude se tada povezuje iz oblaka Anthropic, a taj ne može doći do mosta na vašem računalu.

U grupi *Povezivanje* nalazi se i polje *Token*. To je dugi, nasumični kod koji aplikacija stvara za vas i sprema na ovom računalu. U prozoru piše *Ovaj token daje pristup otvorenom planu. Nemojte ga dijeliti s drugima.* Ikonom *Novi token* stvarate novi token. Aplikacija prvo pita *Stvaranjem novog tokena prekidaju se sve postojeće veze. Želite li nastaviti?* Ako most radi, ponovno se pokreće s novim tokenom. Stari token više ne radi.

### 4. Pogledajte što AI radi

1. Kliknite *Panel zadatka* pod *Dnevnik*. U bočnom području otvara se panel *AI zadatak*.
2. Svaki poziv mosta zauzima jedan redak, najnoviji je na vrhu: vrijeme, što se dogodilo, koliko je trajalo i je li uspjelo ili nije. Kliknite redak da proširite *Argumenti* i *Odgovor*.
3. Gumbom *Obriši* ispraznite popis. Panel čuva zadnjih 500 poziva. Dok se ništa nije dogodilo, piše *Još nema AI zadatka. Pozivi mosta prikazat će se ovdje.*

Kad je AI način rada uključen, u donjem desnom kutu trake stanja nalazi se točka s *AI*. Njezina boja pokazuje stanje mosta. Klik na nju vodi vas na karticu *AI*.

### 5. Postavite ograničenja

Pod *Sigurnost* nalaze se gumbi kojima ograničavate AI:

- *Pauziraj*: AI privremeno ništa ne smije mijenjati, čitanje je i dalje dopušteno. Most ostaje aktivan. Gumb se mijenja u *Nastavi*.
- *Samo za čitanje*: dok je ova opcija uključena, odbijaju se svi alati koji nešto mijenjaju.
- *Automatska sigurnosna kopija: uključena*: prije prve promjene koju AI napravi u dokumentu, aplikacija zapisuje IFC sigurnosnu kopiju. Zadano je uključena. Gumbom je isključite, a tada piše *Automatska sigurnosna kopija: isključena*. To se događa jednom po dokumentu, svaki put kad pokrenete most.
- *Napravi sigurnosnu kopiju*: odmah pravi sigurnosnu kopiju aktivnog dokumenta. Zatim piše *Sigurnosna kopija je napravljena:* s nazivom datoteke.
- *Otvori mapu sigurnosnih kopija*: otvara mapu sa sigurnosnim kopijama.

Sigurnosne kopije nalaze se u mapi `ai-backups` u mapi s podacima aplikacije. Aplikacija čuva nedavne kopije, a od starijih zadržava samo dio. Točno kako to radi, opisano je u [AI alati](docs://ref-ai-tools).

### 6. Neka pomoćnik dobro planira

Pomoćnik dobro planira samo ako poznaje pravila planiranja. Zašto je to važno i što ta pravila sadrže, pročitajte u [Kako radi povezivanje s AI-jem](docs://uitleg-ai-koppeling). Ovo radite sami:

1. **Za osnovna pravila ne morate ništa raditi.** Ona dolaze pri povezivanju. Hoće li ih vaš klijent staviti u svoj sistemski upit, ovisi o klijentu.
2. **Neka pomoćnik pročita vodič.** Upit za povezivanje iz prozora *Podaci za povezivanje* traži od pomoćnika da vodič za planiranje pročita alatom `planner_get_planning_guide`. Ako ne koristite taj upit, recite pomoćniku: *Pročitajte vodič za planiranje alatom planner_get_planning_guide prije nego što išta promijenite.* Vodič možete sami pročitati na `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Neobavezno: instalirajte vještine.** Ovo radi samo s pomoćnikom koji podržava vještine. Stavite `SKILL.md` datoteke za *goed-plannen* i *progress-update* u mapu `.claude/skills/goed-plannen/SKILL.md` i `.claude/skills/progress-update/SKILL.md` u projektnoj mapi u kojoj pomoćnik radi, ili pod `~/.claude/skills/` za svaki projekt.

Datoteke dobijete na dva načina. Zamolite pomoćnika da pozove alat `planner_get_planning_guide` s `part` postavljenim na `skill`. Odgovor sadrži oba teksta i, za svaku vještinu, mjesta gdje pripada. Ili ih preuzmite s `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` i `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Ako je *goed-plannen* još uvijek tu iz starije verzije aplikacije, zamijenite je. Taj stari tekst je na nizozemskom i upućuje na članak pomoći umjesto na vodič za pomoćnike.

Je li pomoćnik zaista pročitao vodič, vidite u *Panelu zadatka*: tamo je poziv alata `planner_get_planning_guide`. Konačni odgovor treba sadržavati popis pretpostavki: procijenjena trajanja, odabranu razradu, ovisnosti koje je sam stvorio i svako ograničenje koje je postavio. Ako taj popis nedostaje, zatražite ga. Nakon ažuriranja napretka prema *progress-update* odgovor treba navesti datum stanja, novi datum završetka i odstupanje u odnosu na temeljni plan.

## Mogući problemi i što aplikacija tada radi

**AI nešto mijenja što želite poništiti.** Svaka promjena koju napravi AI jedan je korak. Poništavate je naredbom *Poništi* (Ctrl+Z). Niz promjena koje AI predaje kao jednu cjelinu jedan je korak. Nakon toga se projekt prikazuje kao nespremljen. Nakon promjene raspored se ponovno izračunava, pa sami ne morate pritisnuti F5.

**Aplikacija odbija poziv AI-ja.** Uz *Pauziraj* i *Samo za čitanje* aplikacija odbija sve promjene. Čitanje ostaje moguće, uključujući ponovno izračunavanje zastarjelog rasporeda. Ako sami uređujete, na primjer povlačite traku ili upisujete u polje, AI dobije datume iz vremena prije vaše izmjene, s napomenom da su zastarjeli. Ako je otvoren dijalog, na primjer postavke, dijalog zadatka ili prozor za dobrodošlicu, ili je uključen način prezentacije, aplikacija odbija sve pozive, uključujući čitanje, dok ne zatvorite dijalog. AI tada dobije poruku o grešci s internim nazivom onoga što je otvoreno, na primjer `showTaskDialog`. Samo `planner_get_planning_guide` i dalje radi, jer ne čita vaš raspored.

**Prebacujete karticu dok AI radi.** AI radi na dokumentu u kojem je napravljena prva promjena. Ako u međuvremenu prebacite karticu, aplikacija odbija njegovu sljedeću promjenu, dok ne potvrdi da želi raditi na drugoj kartici. Tako se ništa ne nađe u krivom projektu.

**AI piše ili otvara datoteku.** AI može raspored zapisati kao IFC datoteku i otvoriti datoteku rasporeda kao novu karticu. To može samo unutar vaše korisničke mape. Postojeću datoteku prepisuje samo ako to izričito zatraži.

**Status je *Port 3877 je zauzet*.** Drugi program koristi taj port. Poruka aplikacije prikazuje se ispod toga. Polje *Port* tada ostaje zaključano (*Može se mijenjati samo dok je poslužitelj zaustavljen.*), iako most ne radi, i nema gumba za zaustavljanje. To je poznat nedostatak. Dok se ne popravi, isključite *Omogući AI način rada* i ponovno ga uključite. Status se tada vraća na *Isključeno* i možete odabrati drugi port. Zatim ponovno kopirajte podatke za povezivanje, jer krajnja točka sadrži port.

**Klijent se ne može povezati nakon novog tokena.** Novi token prekida sve postojeće veze. Dajte klijentu novi token ili ponovno zalijepite fragment konfiguracije.

**Sami ste zaustavili most i on se sam ne pokreće.** *Automatski pokreni most* radi jednom pri svakom pokretanju aplikacije. Ako most zaustavite sami, aplikacija ga neće tiho ponovno uključiti.

**Kartica *AI* je nestala.** AI način rada je isključen. Uključite ga u koraku 1.

**Web-stranica u pregledniku ne može razgovarati s mostom.** Most odbija svaki zahtjev koji dolazi iz preglednika i svaki zahtjev bez ispravnog tokena.

## Pogledajte i

- [Davanje povratnih informacija](docs://howto-feedback-geven): ako povezivanje radi drukčije nego što je ovdje opisano, prijavite to.
- [Kako radi povezivanje s AI-jem](docs://uitleg-ai-koppeling): što je povezivanje, zašto pomoćnik radi u vašem otvorenom projektu i što smije, a što ne smije raditi.
- [AI alati](docs://ref-ai-tools): svi alati `planner_*` po grupama, kodovi grešaka i koliko se sigurnosnih kopija čuva.
- [Dobro planiranje](docs://gids-goed-plannen): načela planiranja. Pomoćnik ih dobiva u engleskoj verziji, s dodanim alatima.
- [Postavke aplikacije](docs://ref-instellingen): AI postavke.
