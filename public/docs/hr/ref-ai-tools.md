# AI alati (planner_*)

Svi alati koje AI pomoćnik može pozvati preko mosta, po skupini, s opisom što rade i što odbijaju. Svi počinju s `planner_`. Upit za povezivanje u prozoru *Podaci za povezivanje* navodi trenutni broj. AI pomoćnik dobiva cijeli popis s opisima direktno od mosta (`tools/list`). Zašto veza radi ovako, opisano je u [Kako radi AI veza](docs://uitleg-ai-koppeling). Kako je uključite, opisano je u [Povezivanje AI pomoćnika (MCP)](docs://howto-ai-assistent-koppelen).

## Kako čitati ovaj popis

**Čitanje** znači: alat ništa ne mijenja. To vrijedi i dok je *Pauziraj* uključen i dok je *Samo za čitanje* uključen. Otvoreni dijalog alat ipak blokira (vidi *Kad se alat odbije* dolje). Alat za čitanje uvijek daje aktualne datume. Ako je raspored zastario, alat ga najprije ponovno izračuna, također dok je *Pauziraj* ili *Samo za čitanje* uključen. Te funkcije blokiraju promjene, a ne ponovni izračun pri čitanju. Ako ste usred uređivanja (povlačite traku ili upisujete u polje), alat ne računa ponovno. AI pomoćnik tada dobiva datume kakvi su bili prije vaše izmjene, s obaviješću da su zastarjeli. Ako je projekt u prikazu *Datumi kako su zabilježeni*, alat ne računa ponovno. AI pomoćnik tada dobiva zabilježene datume, s obaviješću da nisu ponovno izračunati.

**Promjena** znači: alat mijenja vaš projekt. Odbija ga se dok je *Pauziraj* uključen, dok je *Samo za čitanje* uključen i kad je otvoren dijalog. To vrijedi i za alate bez oznake u popisu dolje (`planner_undo`, `planner_redo`, alati za datoteke i alati za dokumente, osim `planner_list_documents`). Svaka promjena je jedan korak u vašoj povijesti poništavanja. Ako se podaci projekta promijene, aplikacija sama ponovno izračunava raspored. Ne morate pritisnuti *Izračunaj*. Prije prve promjene po dokumentu aplikacija zapisuje sigurnosnu kopiju, ako je *Automatska sigurnosna kopija* uključena.

**Skupno** znači: jedan poziv može sadržavati više stavki. Nevaljana stavka se tada odbija s razlogom, a valjane stavke ostaju. Odgovor navodi odbijene stavke.

## Čitanje: raspored

- `planner_get_project_info` (čitanje) — pojedinosti o projektu i najvažnije brojke: broj zadataka, ovisnosti, resursa i kontrolnih točaka, datum stanja, završetak i trajanje projekta, je li raspored zastario, profil izračuna i sažetak kalendara. Dobar prvi poziv.
- `planner_get_project_overview` (čitanje) — cijelo stablo WBS-a u jednom odgovoru: za svaki ID zadatka WBS, naziv, trajanje, rani datumi, napredak, je li kritičan, te odlazne ovisnosti s ID-om ovisnosti.
- `planner_list_tasks` (čitanje) — zadaci s filtrima (kritični, status, vremenski prozor, zadaci bez ovisnosti) i podjelom na stranice.
- `planner_get_task` (čitanje) — jedan zadatak u detalju: datumi, vremenska rezerva, napredak, ograničenja, rok za dovršetak, kalendar, dodjele, prethodnici i nasljednici, prekidi.
- `planner_get_critical_path` (čitanje) — kritični zadaci i njihov ukupan slobodni hod i ovisnosti koje određuju kritični put.
- `planner_list_resources` (čitanje) — resursi s kapacitetom, standardnom tarifom, kalendarom, ekipom, raspoloživošću i sažetkom njihovih dodjela. Ako resurs dolazi iz biblioteke, prikazuje koja polja su zaključana.
- `planner_get_resource_histogram` (čitanje) — opterećenje u odnosu na kapacitet po resursu, po danu, tjednu ili mjesecu (zadano je tjedan). Bez vremenskog prozora i bez resursa daje sažetak po resursu. S vremenskim prozorom ili resursima daje cijeli niz i zadatke koji uzrokuju preopterećenje resursa.
- `planner_get_calendars` (čitanje) — svi kalendari s punom definicijom i brojem zadataka i resursa koji ih koriste.

## Čitanje: temeljni planovi i odstupanja

- `planner_list_baselines` (čitanje) — spremljeni temeljni planovi i koji je aktivan.
- `planner_compare_baseline` (čitanje) — aktualni plan u odnosu na aktivni temeljni plan: samo zadaci koji se razlikuju i razlika u završetku projekta, u radnim danima na aktualnom kalendaru projekta. Bez aktivnog temeljnog plana alat odbija poziv.
- `planner_analyze_delay` (čitanje) — analiza kašnjenja u odnosu na aktivni temeljni plan: razlika u isporuci i kritični zadaci koji su se pomaknuli. Bez aktivnog temeljnog plana alat odbija poziv.

## Zadaci i struktura

- `planner_add_tasks` (promjena, skupno) — stvara zadatke, uključujući ugniježđeni WBS u jednom pozivu. Svaki zadatak dobiva vlastiti privremeni naziv (`tmp-…`), da podzadatak može upućivati na nadređeni zadatak. Bez trajanja zadatak dobiva 5 radnih dana. Kontrolna točka ima trajanje 0. Svi zadaci jednog poziva uspijevaju zajedno ili propadaju zajedno.
- `planner_update_tasks` (promjena, skupno) — mijenja polja postojećih zadataka: naziv, opis, trajanje s jedinicom (dani ili sati), vrstu trajanja, vrstu zadatka, kontrolnu točku, obavezno, prioritet, ograničenje, rok za dovršetak, kalendar i pravilo rada. Također napredak: postotak dovršenog, stvarni početak i stvarni završetak. Svako drugo polje se odbija s razlogom.
- `planner_delete_tasks` (promjena) — briše zadatke, uključujući cijelo podstablo, ovisnosti i dodjele. Odgovor točno navodi što je otišlo zajedno s njima.
- `planner_move_task` (promjena) — premješta zadatak pod drugi nadređeni zadatak, s položajem. Kružna referenca ili stavljanje zadatka pod samog sebe se odbija.
- `planner_set_task_splits` (promjena) — postavlja prekide jednog zadatka: nakon koliko radnih dana (ili radnih sati) rada, i koliko radnih dana (ili radnih sati) traje prekid. Prazan popis uklanja sve prekide. Vidi [Dijeljenje zadatka](docs://howto-taak-splitsen).

## Ovisnosti

- `planner_add_dependencies` (promjena, skupno) — stvara ovisnosti s vrstom (`FS`, `SS`, `FF`, `SF` ili dugi oblik) i vremenom odgode, na primjer `+2d`.
- `planner_update_dependencies` (promjena, skupno) — mijenja vrstu, vrijeme odgode, prethodnika ili nasljednika postojeće ovisnosti, po ID-u ovisnosti. To je jedan korak, umjesto da se ovisnost briše i ponovno stvara.
- `planner_remove_dependencies` (promjena, skupno) — briše ovisnosti po ID-u ovisnosti.

## Projekt i kalendari

- `planner_update_project` (promjena) — naziv, opis, autor, tvrtka, datum početka, datum završetka, datum stanja, način praćenja napretka i zadano pravilo rada za projekt. Datum početka je sidro za nove zadatke. Ako ga AI pomoćnik kasnije postavi, pomiču se samo slobodni zadaci (bez prethodnika i bez ograničenja koje postavlja donju granicu, kao *ne početi prije*). Odgovor navodi koliko ih je kao `anchorsClamped`. Ostatak rasporeda ostaje na mjestu, vidi [Novi projekt i Podaci o projektu](docs://ref-projectinfo). Datum stanja nije oznaka, nego referentni datum izračuna. Na rasporedu bez napretka sve se pomiče zajedno. Datum završetka je samo metapodatak.
- `planner_move_project` (promjena) — pomiče cijeli postojeći raspored na novi datum početka. Kalendari se ne pomiču zajedno, pa se završetak može pomaknuti za drugačiji broj dana nego početak. Temeljni planovi ostaju, osim ako AI pomoćnik izričito zatraži da se pomaknu i oni. Vidi [Pomicanje projekta](docs://howto-project-verplaatsen).
- `planner_update_calendar` (promjena, skupno) — mijenja ili stvara kalendare: radne dane, radne sate, pauzu, blokove radnog vremena, praznike (generira ih za državu i regiju ili navodi ručno) i iznimke radnih dana. Ne može promijeniti koji kalendar je kalendar projekta.

## Resursi i jedinice dodjele

- `planner_manage_resources` (promjena, skupno) — stvara, mijenja ili briše resurse: naziv, vrstu (radna snaga, oprema, materijal, podizvođač ili ekipa), opis, maksimalan postotak jedinica, trošak po satu, jedinicu, kalendar, ekipu i raspoloživost kroz vrijeme. Odbija brisanje resursa koji ima dodjele, dok AI pomoćnik to izričito ne potvrdi. Za resurs iz biblioteke su naziv, vrsta, opis, standardna tarifa i jedinica zaključani.
- `planner_manage_assignments` (promjena, skupno) — dodaje, mijenja, premješta ili uklanja dodjele: jedinice po radnom danu, krivulju i preostali posao. Samo na zadatku bez podzadataka, i isti resurs samo jednom po zadatku. Što promjena jedinica radi s trajanjem, ovisi o pravilu rada zadatka, kao u [Pravila rada: trajanje, jedinice i rad](docs://uitleg-werkregels).
- `planner_level_resources` (promjena) — uravnoteživanje preopterećenja resursa. Zadano unutar vremenske rezerve, pa završetak ostaje. S `constrainToFloat: false` se završetak može pomaknuti. S probnim pokretanjem AI pomoćnik najprije dobiva pregled bez ikakvih promjena. Preskače materijal. Vidi [Uravnoteživanje resursa](docs://uitleg-nivelleren).
- `planner_clear_leveling` (promjena) — briše sva kašnjenja zbog uravnoteživanja.

## Upravljanje temeljnim planovima

- `planner_save_baseline` (promjena) — sprema aktualni raspored kao temeljni plan i odmah ga čini aktivnim. Najprije ponovno izračunava zastarjele datume. Ne može se koristiti u skripti.
- `planner_activate_baseline` (promjena) — čini temeljni plan aktivnim, ili nijedan.
- `planner_rename_baseline` (promjena) — preimenuje temeljni plan.
- `planner_delete_baseline` (promjena) — briše jedan temeljni plan. Ako je to bio aktivni, postaje aktivan posljednji preostali temeljni plan, ili nijedan ako ništa nije ostalo.

## Poništavanje

- `planner_undo` i `planner_redo` — poništava ili ponavlja jedan korak u aktivnom dokumentu. Povijest je ista kao vaša. Odgovor navodi je li se zaista išta vratilo.

## Dokumenti i datoteke

- `planner_list_documents` (čitanje) — svi otvoreni dokumenti s naslovom, je li aktivan i je li izmijenjen, brojem zadataka, datumom početka projekta i izračunatim završetkom.
- `planner_new_document` — novi, prazan dokument u vlastitoj kartici, bez prozora *Novi projekt*.
- `planner_duplicate_document` — kopira aktivni dokument u novu karticu, za scenarij što ako ili varijantu ponude. Kopija je odvojena i nema putanju datoteke.
- `planner_switch_document` — čini drugi dokument aktivnim. Također je način da potvrdite, nakon promjene kartice, na kojem dokumentu AI pomoćnik radi.
- `planner_import_schedule` — otvara datoteku s rasporedom s diska kao dokument: `.ifc`, `.xml` (Primavera P6 ili MS Project, prepoznaje se po sadržaju), `.csv`, `.xer` i `.mpp` (MS Project 2010 do 2021). Ništa se ne spaja s aktualnim planom. CSV nema kalendar, pa se datumi mogu pomaknuti. Samo unutar vaše korisničke mape. Nakon uvoza CSV, XML ili `.mpp` dokument nema datoteku u koju se može spremiti. Samo IFC preuzima njegovu putanju.
- `planner_export_ifc` — zapisuje aktivni dokument kao IFC 4.3 datoteku. Samo unutar vaše korisničke mape, a postojeća datoteka se prepisuje samo na izričit zahtjev. Projekt ostaje nespremljen.

## Vodič i podrijetlo izvora

- `planner_get_planning_guide` (čitanje) — engleski vodič za AI pomoćnike (načela iz [Dobro planiranje](docs://gids-goed-plannen), s alatima za svako načelo), dvije vještine *goed-plannen* (postavljanje rasporeda) i *progress-update* (ažuriranje napretka), ili sve. Izbor se radi s `part`: `guide`, `skill` (obje vještine) ili `both`. Zadano je `both`. Za svaku vještinu vraća mjesta gdje pripada i adrese za preuzimanje. Parametar `language` se još prihvaća za starije AI pomoćnike, ali tekst je uvijek engleski. Ne dira raspored.
- `planner_inspect_xer_provenance` (čitanje) — pregledava zadržano značenje izvora otvorene Primavera P6 datoteke (`.xer`): što je datoteka sadržavala, s brojevima uvoza i dijagnostike. Slobodni tekst iz datoteke je zadano nevidljiv. AI pomoćnik ga mora izričito zatražiti. Ne može se koristiti u skripti.

## Skripta

- `planner_batch` — pokreće skriptu s najviše 100 koraka kao jednu promjenu: jedan korak poništavanja, jedan ponovni izračun, jedna sigurnosna kopija. Ako korak strukturalno propadne, cijela skripta se vraća. Odgovor navodi za svaki korak što je izvršeno, što je propalo i što nije stiglo na red. Privremeni nazivi (`tmp-…`) iz `planner_add_tasks` vrijede u kasnijim koracima. Kao korak nisu dopušteni: `planner_batch` sam, poništavanje i ponavljanje, alati za dokumente i datoteke, `planner_save_baseline`, `planner_get_planning_guide` i `planner_inspect_xer_provenance`. Skripta nije programski jezik. Nema varijabli, uvjeta ni petlji.

## Kad se alat odbije

AI pomoćnik tada dobiva odgovor s kodom greške i objašnjenjem.

- `PAUSED` — funkcija *Pauziraj* je uključena.
- `READ_ONLY` — funkcija *Samo za čitanje* je uključena.
- `DIALOG_OPEN` — otvoren je dijalog. To vrijedi i za čitanje, osim za `planner_get_planning_guide`. Odgovor navodi što je otvoreno, po internom nazivu, na primjer `showTaskDialog`.
- `DOC_DRIFT` — prebacili ste karticu dok je AI pomoćnik radio. On mora potvrditi s `planner_switch_document` na kojem dokumentu radi.
- `VALIDATION` — argumenti ne odgovaraju shemi ili tražena promjena nije dopuštena. Odgovor navodi polje.
- `NOT_FOUND` — ID ili dokument ne postoji.
- `CYCLE` — promjena bi stvorila kružnu referencu. Sve u tom pozivu se vraća.
- `SCOPE` — putanja datoteke leži izvan vaše korisničke mape.
- `BACKUP_FAILED` — sigurnosna kopija prije promjene nije uspjela. Promjena nije izvršena.
- `INTERNAL` — neočekivana greška pri izvršavanju alata, na primjer datotečna operacija koja nije uspjela. Odgovor daje izvornu poruku greške.
- `STALE_PRECONDITION` — dio je ugovora mosta, ali nijedan trenutni alat ne vraća taj kod.

Zahtjev koji je čekao u redu dulje od 110 sekundi aplikacija više ne izvršava. Klijent je već dobio istek vremena. Izvršavanje bi pri ponovnom pokušaju promijenilo stvari dvaput. Poziv koji traje dulje od 120 sekundi dobiva istek vremena od mosta.

## Što AI pomoćnik ne može postaviti

Po zadatku AI pomoćnik ne može postaviti: hamak, ručno planiranje, drugo ograničenje, bilješke, boju, šifre zadataka, prilagođena polja, međuzavisnosti projekata i ručno kašnjenje zbog uravnoteživanja. Aplikacija sama izračunava WBS-šifru. Na razini projekta ne može promijeniti profil izračuna i opcije izračuna. Postavke, tema, jezik, proširenja i ažuriranja su izvan dosega, kao i biblioteka resursa. Nema ni izvješća, izgleda, filtera ni prikaza. Zašto je tako, opisano je u [Kako radi AI veza](docs://uitleg-ai-koppeling).

## Što aplikacija sprema

- **Token** je na ovom računalu, u spremljenim postavkama aplikacije. Ima 64 znaka i nasumičan je. *Novi token* ga zamjenjuje.
- **Priključak** je zadano 3877 i može se promijeniti samo dok je most zaustavljen.
- **Panel aktivnosti** čuva zadnjih 500 poziva, samo dok je aplikacija otvorena. Argumenti i odgovori se skraćuju nakon 20 kB po polju. *Obriši* prazni popis.
- **Sigurnosne kopije** su u mapi `ai-backups` u mapi s podacima aplikacije. *Otvori mapu sigurnosnih kopija* vas tamo odvodi. Nazivaju se `<project name>-<timestamp>.ifc`. Spremljena datoteka projekta ima jednu mapu za sve sesije. Dokument koji nikad niste spremili dobiva vlastitu mapu po sesiji. Po dokumentu se napravi jedna sigurnosna kopija svaki put kad pokrenete most. Uz to nastaju i sigurnosne kopije koje sami napravite gumbom *Napravi sigurnosnu kopiju*.
- **Proređivanje** se odvija samo od sebe, po mapi. Za zadnjih 7 dana zadržavaju se sve kopije, najviše 20. Kopije koje je napravila aktivna sesija uvijek ostaju. Nakon toga ostaje po jedna kopija tjedno, do 30 dana stara. Po jedna kopija mjesečno ostaje do godinu dana stara, a zatim po jedna godišnje. Sigurnosne kopije dokumenta koji nikad niste spremili nestaju potpuno nakon godinu dana. Datoteke u mapi koje ne pripadaju aplikaciji ostaju netaknute.

## Vidi također

- [Kako radi AI veza](docs://uitleg-ai-koppeling): zašto je most ovako postavljen i što AI pomoćnik smije, a što ne smije.
- [Povezivanje AI pomoćnika (MCP)](docs://howto-ai-assistent-koppelen): pokrenite most, povežite se i instalirajte vještinu.
- [Postavke](docs://ref-instellingen): dva AI prekidača.
- [Obavijesti i upozorenja](docs://ref-meldingen): AI točka u traci stanja.
