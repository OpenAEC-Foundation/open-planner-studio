# Kako radi veza s AI pomoćnikom

Što se zapravo događa kad AI pomoćnik radi u vašem rasporedu? U ovom članku čitate što je veza, zašto se razlikuje od razmjene datoteke, koja ograničenja aplikacija sama nameće i kako pomoćnik saznaje kako raspored treba izraditi. Primjer na kraju brojkama pokazuje što pomoćnik može učiniti odjednom i što od toga zadržite.

## Pojam

AI pomoćnik, kao što je program za razgovor ili pomoćnik za programiranje, može raditi s drugim programom preko **Model Context Protocol** (MCP). Open Planner Studio u toj razmjeni preuzima ulogu poslužitelja. Aplikacija za radnu površinu pokreće mali poslužitelj na vašem računalu, **most**. Pomoćnik se na njega spoji i dobiva popis **alata**: instrumenata s imenom koje počinje s `planner_`, na primjer čitanje zadataka, dodavanje ovisnosti ili spremanje temeljnog plana. Koji su alati dostupni, piše u [AI alati](docs://ref-ai-tools).

Zanimljivo je da pomoćnik radi u projektu koji u tom trenutku imate otvoren, a ne u kopiji. Ništa ne izvozite i ništa ne uvozite. Nema trenutka u kojem vi i pomoćnik gledate u dvije različite verzije. Zadatak koji pomoćnik doda odmah se pojavi u Gantt prikazu. Aplikacija to ne pojednostavljuje: pomoćnik radi s istim izračunom, istom poviješću poništavanja i istim pravilima kao vi.

Kako uključite vezu, piše u [Povezivanje AI pomoćnika (MCP)](docs://howto-ai-assistent-koppelen). Dalje čitate kako ona radi.

## Kako aplikacija to obrađuje

### Poslužitelj koji čuje samo vaše računalo

Most sluša samo na vašem računalu (`127.0.0.1`), na jednom priključku, standardno 3877. Prima zahtjeve samo na adresi `/mcp` i samo s vašim **tokenom** u zaglavlju `Authorization: Bearer`. Zahtjev bez ispravnog tokena odbija. Zahtjev koji dolazi iz preglednika most prepoznaje po zaglavlju `Origin` i također odbija. Tako web-stranica koju slučajno imate otvorenu ne može razgovarati s vašim rasporedom. Zahtjeve obrađuje strogo jedan po jedan.

Komunikacija je običan HTTP na vašem računalu. Aplikacija sama ništa ne šalje van. Što pomoćnik radi s rasporedom koji čita, na primjer što njegov pružatelj s time radi, ovisi o pomoćniku i izvan je aplikacije.

### Pomoćnik radi na jednom dokumentu

Pri svojoj prvoj promjeni most veže pomoćnika uz dokument koji je tada aktivan. Ako nakon toga sami prebacite na drugu karticu, aplikacija odbija sljedeću promjenu pomoćnika (kod `DOC_DRIFT`) dok pomoćnik s `planner_switch_document` ne potvrdi na kojem dokumentu želi raditi. Tako ništa ne završi u pogrešnom projektu. Pomoćnik koji sam otvori ili udvostruči dokument, nakon toga radi u tom novom dokumentu.

### Svaka promjena pokreće ponovno izračunavanje

U aplikaciji planirate ručno: nešto promijenite, zatim pritisnete *Izračunaj* (F5), osim ako je uključeno *Automatsko izračunavanje*. Za promjenu pomoćnika to ne vrijedi. Svaka radnja pisanja pomoćnika ide kroz jednu transakciju. Ako se u njoj promijene podaci projekta, aplikacija na kraju sama ponovno izračuna, za cijelu skriptu jednom. Alat za čitanje uvijek daje aktualne datume: ako raspored nije aktualan, na primjer zato što ste sami nešto promijenili i još niste pritisnuli *Izračunaj*, alat za čitanje najprije ponovno izračuna. Postoji jedna iznimka: ako je projekt u prikazu *Datumi kako su zabilježeni* (nakon uvoza), alat za čitanje tiho ne izračunava ponovno, jer bi zamijenio te datume. Pomoćnik tada dobiva zabilježene datume, s napomenom da nisu ponovno izračunati. Promjena koju sam pomoćnik napravi uvijek ponovno izračunava, i tada. Nakon promjene pomoćnika ne morate pritisnuti *Izračunaj*. Pomoćnik zatim rezultat, kao što su završetak projekta i kritični put, čita natrag alatima za čitanje. Vidi također [Datumi kako su zabilježeni](docs://uitleg-datums-zoals-opgeslagen).

### Skripta je jedan korak

Pomoćnik može niz koraka poslati kao cjelinu s `planner_batch`, skriptom od najviše 100 koraka. Tako dobivate jedan korak poništavanja, jedno ponovno izračunavanje i jednu sigurnosnu kopiju. Ako jedan korak strukturno ne uspije, na primjer nepoznat alat ili kružna referenca, aplikacija vraća cijelu skriptu. Nikad ne ostajete s napola završenim rasporedom. Odbijanje jedne stavke unutar grupnog koraka, na primjer jednog neispravnog retka napretka od dvadeset, je blaže: ta stavka ostaje van, a ostale se izvrše. Odbijanja su na vrhu odgovora.

### Vaša ograničenja

Četiri stvari sami postavljate u kartici *AI*:

- *Pauziraj* i *Samo za čitanje* ostavljaju pomoćnika povezanim, ali odbijaju svaku promjenu. Čitanje ostaje moguće, uključujući ponovno izračunavanje neaktualnog rasporeda pri čitanju. To su izračunata polja, a ne podaci projekta, pa se ne dodaje korak poništavanja i projekt se ne računa kao promijenjen. Ako ste sami usred uređivanja, na primjer povlačite traku ili upisujete u polje, alat za čitanje ne izračunava ponovno: pomoćnik tada dobiva datume iz vremena prije vaše izmjene, s napomenom da su zastarjeli.
- Otvoreni dijalog blokira sve. Ako su, na primjer, otvoreni dijalog zadatka, postavke, način prezentacije ili prozor dobrodošlice, aplikacija odbija i čitanje, jer ste usred ručne radnje. Pomoćnik dobiva kod greške `DIALOG_OPEN`. Poruka navodi interni naziv onoga što je otvoreno, na primjer `showTaskDialog` za dijalog zadatka.
- Automatska sigurnosna kopija zapisuje IFC kopiju prije prve promjene po dokumentu. Ako ta kopija ne uspije, aplikacija promjenu ne izvrši.
- *Panel zadatka* prikazuje svaki poziv, s argumentima i odgovorom.

Uz to dolazi vaš normalan *Poništi* (Ctrl+Z). Pomoćnik dijeli tu povijest s vama i ima sam `planner_undo` i `planner_redo`.

### Što pomoćnik ne može

Most je namjerno uži od aplikacije. Ono što pomoćnik ne može, obično ima jedan od tri razloga.

**Seže dalje od projekta.** Pomoćnik ne može mijenjati biblioteku resursa. Biblioteka je zajednička za sve vaše projekte i nalazi se izvan povijesti poništavanja. Jedna promjena standardne tarife tada bi djelovala i na projekte koji uopće nisu otvoreni. Za resurs iz biblioteke ostaju fiksni naziv, vrsta, opis, standardna tarifa i jedinica, baš kao u oknu resursa. Ono što odlučuje projekt, ostaje pomoćniku: maksimalan postotak jedinica, dostupnost tijekom vremena, kalendar i ekipa. Također ne može odabrati koji kalendar vrijedi kao kalendar projekta. Može čitati profil izračuna i mogućnosti izračuna, ali ih ne može mijenjati. Može samo postaviti način praćenja napretka i zadano pravilo rada za projekt. Alata za postavke, temu, jezik, proširenja ili ažuriranja nema.

**Nije pogodno za pouzdanu provjeru.** Pomoćnik ne može postaviti hamak, ručno planirati zadatak, postaviti drugo ograničenje, unijeti bilješke, boje, šifre zadatka, prilagođena polja ili međuzavisnosti projekata, i ne može ručno postaviti kašnjenje zbog uravnoteživanja. Ni WBS šifru ne bira; to aplikacija sama izvodi.

**Dotiče se nečega što sami morate odlučiti.** Napredak bilježi samo ako postoji datum stanja. Pomoćnik ga sam ne bira: to je vaš referentni datum. Ako zadatak koji nije počeo ima planirani početak nakon datuma stanja, mora dati stvarni početak. Datoteke čita i piše samo unutar vaše korisničke mape, a postojeću datoteku prepisuje samo ako to izričito traži. Izvoz nije isto što i *Spremi*: projekt u aplikaciji ostaje nespremljen.

### Kako pomoćnik zna kako planirati

Pomoćnik koji zna alate ipak može izraditi raspored koji nijedan planer ne može upotrijebiti: zadatke bez ovisnosti, fiksni datum na svakom zadatku ili razradu koja je predetaljna. Zato mu aplikacija daje tri stvari.

**Osnovna pravila u handshakeu.** Pri povezivanju most šalje kratak tekst u polju `instructions` MCP handshakea. Mnogi klijenti taj tekst stavljaju u svoj sistemski upit; hoće li to učiniti vaš, ovisi o klijentu. Pravila: počnite od kontrolnih točaka i roka isporuke, izradite zadatke od otprilike jednog dana do dva tjedna, raspored vodite ovisnostima umjesto fiksnih datuma, ograničenja koristite samo za čvrste vanjske datume, prvo popravite neuspjelo izračunavanje, za dosljedan niz koristite `planner_batch`, napredak bilježite samo s vašim datumom stanja i stvarnim datumima koje navedete, a na kraju kažite što ste pretpostavili i što ste namjerno izostavili.

**Vodič za pomoćnike.** Alat `planner_get_planning_guide` vraća vodič posebno napisan za pomoćnike. Slijedi ista načela kao [Dobro planiranje](docs://gids-goed-plannen), ali pomoćnik radi drugačije od vas: ne pritišće F5 niti klikće na vrpcu, nego poziva alate, a aplikacija za njega ponovno izračunava. Zato vodič za svako načelo navodi alate koje pomoćnik za to koristi i objašnjava što pomoćnik radi s *Datumi kako su zabilježeni* ili s neuspjelim izračunavanjem. Vodič je na engleskom, kao sve što pomoćnik čita preko te veze. Alat i dalje prihvaća izbor jezika za starije pomoćnike, ali to ne mijenja tekst. Sami je možete pročitati na `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. Uputa za povezivanje iz prozora *Podaci za povezivanje* traži od pomoćnika da najprije pročita vodič. Alat radi i dok je otvoren dijalog, dok je pauziran i u načinu samo za čitanje, jer ne čita vaš raspored.

**Dvije vještine.** Vještina je mala datoteka s uputama koju pomoćnik u svakoj sesiji čita uz sebe. Ima ih dvije, jer su to dvije vrste posla. Postavljanje rasporeda je stvar logike; ažuriranje napretka je stvar činjenica koje znate samo vi. Vještina *goed-plannen* služi za postavljanje ili preuređivanje rasporeda: redoslijed u kojem se alati koriste, pravilo ponovnog izračunavanja, `planner_batch` i dužnost da se navedu pretpostavke. Vještina *progress-update* služi za tjedno ažuriranje napretka: najprije vaš datum stanja, zatim stvarni početak i završetak te postotak dovršenog, a potom izvješće o odstupanju od temeljnog plana, kritičnom putu i novom datumu završetka. Načela planiranja same su u vodiču. Obje vještine su na engleskom. Alat vraća obje, uz mjesto gdje pripadaju. Kako ih instalirate, piše u [Povezivanje AI pomoćnika (MCP)](docs://howto-ai-assistent-koppelen).

## Primjer

Zamolite pomoćnika: izgradite dogradnju s foundation, brickwork i roof, tim redom. Datum početka vašeg projekta je ponedjeljak, 2. ožujka 2026. Pomoćnik najprije čita vodič, a zatim šalje jednu skriptu:

1. početak projekta 2. ožujka 2026.;
2. tri zadatka: Foundation od 5 radnih dana, Brickwork od 10 i Roof od 4;
3. dvije ovisnosti završetak-početak: od Foundation do Brickwork, od Brickwork do Roof.

Aplikacija izvrši tri koraka i ponovno izračuna. Ako pomoćnik nakon toga čita natrag, nalazi: završetak projekta je četvrtak, 26. ožujka 2026., trajanje projekta je 19 radnih dana, sva tri zadatka su kritična. To se slaže sa zbrojem: 5 + 10 + 4 je 19 radnih dana, a 19 radnih dana nakon ponedjeljka, 2. ožujka, završava u četvrtak, 26. ožujka. Cijela skripta je jedan korak u vašoj povijesti. Jedan *Poništi* uklanja tri zadatka, dvije ovisnosti i novi datum početka projekta.

Sada scenarij „što ako“. Zatim zamolite pomoćnika da ažurira napredak, pa on postavlja datum stanja na ponedjeljak, 16. ožujka. Datum stanja nije oznaka: zadatak koji nije počeo ne smije biti prije tog datuma, pa se pomakne na njega. Bez ijednog unosa napretka cijeli se raspored zato pomiče: Foundation traje od 16. do 20. ožujka, Brickwork od 23. ožujka do 7. travnja, a Roof od 8. do 13. travnja. Završetak projekta skače s 26. ožujka na 13. travnja. Raspored se pomakne za dva radna tjedna, a kalendar u ovom primjeru, *Bouwkalender NL*, ima Veliki petak (3. travnja) i Uskrs (5. i 6. travnja). Ta dva slobodna dana u tjednu pomiču završetak za još dva dana. Zato pomoćnik datum stanja postavlja samo na vaš zahtjev i samo kad ima stvarnog napretka za upisati.

## Posljedice za vaš raspored i česte zablude

**Pomoćnik nema vlastitu kopiju.** Što on promijeni, mijenja vaš projekt. Ako je Automatska sigurnosna kopija uključena, prije njegove prve promjene imate IFC sigurnosnu kopiju. Uz *Samo za čitanje* može analizirati bez ikakve promjene.

**Novi token prekida sve veze.** Token je lozinka mosta. Novi token čini stari neispravnim, čak i kad most radi, a pomoćniku se mora dati novi.

**To da pomoćnik kaže da je uspjelo nije dokaz.** Panel zadatka prikazuje koji je alat zaista pozvao i što je vraćeno. Odbijanje gotovo uvijek navodi polje koje je bilo pogrešno i put koji radi.

**Pomoćnik ne može scenarij „što ako“ s poništavanjem.** Povijest poništavanja dijeli s vama, pa za varijante udvostručuje dokument s `planner_duplicate_document`. Kopija je odvojena, nema putanju datoteke i prikazuje se kao nespremljena. Pomoćnik ne zatvara varijante; to odlučujete vi.

**Izvoz od strane pomoćnika nije spremanje.** Piše IFC datoteku na putanju koju sam odabere, unutar vaše korisničke mape, a postojeću datoteku prepisuje samo ako to izričito traži. Vaš projekt u aplikaciji ostaje nespremljen i zadržava svoje odredište za spremanje. Ako uveze datoteku, ona se otvara u novoj kartici ili u praznoj, nepromijenjenoj kartici.

## Vidi također

- [Povezivanje AI pomoćnika (MCP)](docs://howto-ai-assistent-koppelen): koraci za pokretanje mosta, povezivanje pomoćnika i instalaciju vještine.
- [AI alati](docs://ref-ai-tools): svi alati po skupini, što odbijaju i koliko dugo se čuvaju sigurnosne kopije.
- [Dobro planiranje](docs://gids-goed-plannen): načela planiranja; pomoćnik ih dobiva u engleskoj verziji s dodanim alatima.
- [Napredak, datum stanja i temeljni plan](docs://uitleg-voortgang): što datum stanja čini s vašim rasporedom.
