# Povezivanje MCP klijenta

Cilj: omogućiti MCP klijentu da prati i radi s vašim rasporedom, uz uvid u to što radi i uz ograničenja koja sami postavite.

## Brzo: prepustite to Claudeu

Radite li s Claude Desktopom ili Claude Codeom? Tada Claude može sam instalirati vezu:

1. Kliknite *Kopiraj upit* ispod.
2. Zalijepite upit u novi razgovor s Claudeom i pošaljite ga.

Claude zatim instalira proširenje za Open Planner Studio i usput objašnjava što ono radi. Ako nešto morate učiniti sami, na primjer kliknuti *Instaliraj* u Claude Desktopu, Claude vam točno kaže koji klik treba napraviti. Za to vam nije potreban token.

```prompt
Instalirajte proširenje Open Planner Studio za mene, da biste mogli čitati i mijenjati moje građevinske rasporede u Open Planner Studiju. Učinite što više možete sami. Prije svakog koraka jednom jednostavnom rečenicom recite što ćete učiniti i zašto. Ako me trebate, pitajte po jednu stvar i pričekajte moj odgovor. Ako nešto moram učiniti sam, recite mi točno koji klik ili radnju treba napraviti i gdje.

Što trebate znati:
- Proširenje je jedna datoteka, open-planner-studio-<version>.mcpb, u najnovijem izdanju: https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest. Izravna poveznica nalazi se na https://api.github.com/repos/OpenAEC-Foundation/open-planner-studio/releases/latest (datoteka čiji naziv završava na .mcpb). Datoteka je ZIP-datoteka.
- Proširenje radi s desktop-aplikacijom Open Planner Studio i bez aplikacije. Kad je aplikacija otvorena i njezin MCP most radi, radite u planu koji je otvoren u aplikaciji. Kad je aplikacija zatvorena, radite na datotekama rasporeda u radnoj mapi koju ja odabirem.
- Za instalaciju nisu potrebni token ni lozinka. Nemojte ga tražiti od mene niti ga čitati ili prikazivati.

Ako radite u Claude Desktopu:
1. Ako možete preuzeti datoteku i otvoriti je na mom računalu, učinite to s datotekom .mcpb. Ako ne možete, dajte mi izravnu poveznicu za preuzimanje i recite mi da dvaput kliknem datoteku kad je preuzimanje završeno.
2. Claude Desktop zatim prikazuje proširenje Open Planner Studio. Recite mi da kliknem Instaliraj. Zatim mi recite da u polju Working folder odaberem mapu s mojim datotekama rasporeda.
3. Recite mi da pokrenem novi razgovor i da vas tamo pitam koje alate za Open Planner Studio vidite.

Ako radite u Claude Codeu:
1. Provjerite je li Node.js 22 ili noviji instaliran. Ako nije, recite mi kako ga instalirati i stanite.
2. Pitajte me koja mapa sadrži moje datoteke rasporeda. To je radna mapa.
3. Preuzmite datoteku .mcpb i raspakirajte je u novu, vlastitu mapu u mojoj korisničkoj mapi. Pročitajte tamo manifest.json: server.mcp_config kaže kako se server pokreće. Zamijenite ${__dirname} raspakiranom mapom, a ${user_config.workdir} radnom mapom.
4. Pokrenite claude mcp list. Ako je tamo već server s nazivom open-planner-studio, pitajte me smijete li ga zamijeniti. Nemojte prikazivati njegove postavke jer mogu sadržavati token.
5. Dodajte server za moj korisnički račun, na primjer: claude mcp add open-planner-studio --scope user -e OPS_MCP_ROOT=<radna mapa> -- node <raspakirana mapa>/server/index.mjs
6. Recite mi da pokrenem novu sesiju Claude Codea i da /mcp tamo pokaže je li open-planner-studio povezan.

Ako radite negdje drugdje, na primjer u pregledniku na claude.ai, recite mi da je za to potreban Claude Desktop ili Claude Code. Ako ne znate gdje radite, pitajte me.

Kad je instalacija gotova, objasnite u nekoliko rečenica:
- kako vam dopuštam rad u otvorenoj aplikaciji: u Open Planner Studiju odaberite Postavke › Projekt › Postavke aplikacije, karticu Napredno, i uključite Dopusti MCP vezu. Zatim kliknite Pokreni most na kartici MCP.
- da bez aplikacije promjena u datoteci postoji tek nakon što je spremite, i da ne prepisujete postojeću datoteku dok je aplikacija otvorena.
Ako korak ne uspije, recite mi u jednoj rečenici što je pošlo po zlu i što ja mogu učiniti. Nemojte nagađati.
```

Želite li to učiniti sami ili koristite drugi MCP klijent? Tada slijedite korake u nastavku.

## Kada vam ovo treba

Želite da MCP klijent čita, analizira ili mijenja vaš raspored. Na primjer da izradi prvi WBS, ispravi zadatke ili objasni kritični put. To funkcionira preko **Model Context Protocol** (MCP): standarda koji AI programu, **MCP klijentu**, omogućuje da koristi alate drugog programa. Zato Open Planner Studio na vašem računalu pokreće mali server, **most**. Nudi skup alata, a svi imaju naziv koji počinje s `planner_`: čitanje i mijenjanje zadataka, ovisnosti, resursa, kalendara, temeljnih planova, dokumenata i datoteka. Koji alati postoje i što ne dopuštaju, to je opisano u [MCP alati](docs://ref-ai-tools). MCP klijent radi u projektu koji imate otvoren, a ne u kopiji: zadatak koji doda odmah se pojavljuje u Gantt-prikazu. Koristi isti izračun i istu povijest radnji za naredbu *Poništi* kao vi.

Most radi samo u desktop-aplikaciji. Ako u pregledniku dopustite MCP vezu, vidite karticu *MCP*, ali gumb *Pokreni most* je siv, s tekstom *Most radi samo u desktop-aplikaciji.* Ostatak ovog članka odnosi se na desktop-aplikaciju. U pregledniku su također sivi gumbi *Napravi sigurnosnu kopiju* i *Otvori mapu sigurnosnih kopija*.

## Koraci

### 1. Dopustite MCP-vezu

1. Odaberite *Postavke › Projekt › Postavke aplikacije*. Možete odabrati i *Datoteka › Postavke aplikacije* ili zupčanik na vrhu.
2. Odaberite karticu *Napredno* i uključite *Dopusti MCP-vezu*. Kartica *MCP* pojavljuje se u vrpci.
3. Ako želite da most bude aktivan čim se aplikacija pokrene, uključite i *Automatski pokreni most*. Ta opcija radi samo kad je *Dopusti MCP-vezu* uključena i samo u aplikaciji za računalo. Zadano je isključena, jer je otvaranje porta namjerna odluka.

Ako isključite MCP-vezu, most se zaustavlja i kartica *MCP* nestaje.

### 2. Pokrenite most

1. Idite na karticu *MCP* i kliknite *Pokreni most* u grupi *Poslužitelj*.
2. Pogledajte stanje pored gumba. Piše *Isključeno*, *Aktivno na portu 3877*, *Port 3877 je zauzet* ili *Greška*. Ako pokretanje uspije, piše *Aktivno na portu 3877*, a gumb se zove *Zaustavi most*. Ako piše *Port 3877 je zauzet* ili *Greška*, gumb ostaje *Pokreni most*; pogledajte zamke.

Most osluškuje samo na vašem računalu, na jednom portu. Zadano je to 3877. U grupi *Povezivanje* možete u polju *Port* odabrati drugi port, ali samo dok je most zaustavljen. Komunikacija je običan HTTP na vašem računalu. Sama aplikacija ništa ne šalje van. Što MCP-klijent radi s vašim rasporedom, primjerice što njegov pružatelj radi s time, izvan je aplikacije.

### 3. Povežite MCP-klijenta

1. Kliknite *Poveži* u grupi *Povezivanje*. Otvara se prozor *Podaci za povezivanje*.
2. Odaberite što vaš klijent treba, pogledajte u nastavku.
3. Token je skriven. Ikonom oka ga prikažete. Gumbi za kopiranje uvijek kopiraju pravu vrijednost, čak i kad ekran skriva token.
4. Pustite MCP-klijent da zatraži popis alata. Ta je provjera i u upitu za povezivanje: klijent treba vidjeti alate s prefiksom `planner_`; očekivani broj nalazi se u upitu za povezivanje.

Prozor nudi četiri načina povezivanja:

- *Prepusti to Claudeu*: isti upit kao na vrhu ovog članka, uz gumb *Kopiraj upit*. Namijenjen je za Claude Desktop i Claude Code. Za to vam ne treba token.
- *Fragment konfiguracije*: dio konfiguracije koji zalijepite u MCP-postavkama vašeg klijenta.
- *Upit za povezivanje*: tekst koji zalijepite u svoj MCP-klijent, nakon čega se klijent sam poveže.
- *Krajnja točka* i *Autentifikacija*: zasebni podaci. Krajnja točka je `http://localhost:3877/mcp` s prijenosom *streamable HTTP*. Svaki zahtjev treba zaglavlje `Authorization: Bearer`, iza kojeg slijedi vaš token. Vaš klijent mora podržavati i MCP-sesije: kad se poveže, most mu daje kod sesije u zaglavlju `Mcp-Session-Id` i odbija svaki sljedeći zahtjev bez tog koda. Claude Code i `mcp-remote` to rade sami.

**Ponovno se povežite nakon ažuriranja aplikacije.** Ako je vaš MCP-klijent već bio povezan sa starijom verzijom aplikacije, on još ne šalje kod sesije i most odbija svaki zahtjev. Zato se nakon ažuriranja ponovno povežite: u Claude Code pokrenite novu sesiju, a Claude Desktop potpuno zatvorite i ponovno pokrenite.

**Claude Code.** Fragment konfiguracije može se izravno upotrijebiti u Claude Code. U terminalu unesite ovu naredbu, sa svojim tokenom umjesto `<token>`:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Fragment možete staviti i u datoteku `.mcp.json` u mapi projekta. Tu datoteku zatim nemojte stavljati u git, jer token daje pristup vašem planu. Poslužitelj iz `.mcp.json` mora se u Claude Code prvi put odobriti.

**Claude Desktop.** Za Claude Desktop postoji proširenje: datoteka `open-planner-studio-<version>.mcpb`. Claude Desktop ga instalira dvostrukim klikom. Za to vam ne treba Node.js. Proširenje radi s aplikacijom i bez aplikacije. Brže je s upitom na vrhu ovog članka; u nastavku su koraci koje izvodite ručno.

1. Preuzmite datoteku `.mcpb` s najnovijeg izdanja: `https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest`.
2. Dvaput kliknite datoteku. Claude Desktop se otvara i prikazuje proširenje *Open Planner Studio*. Instalirajte je. Ako dvostruki klik ne radi, u Claude Desktopu otvorite *Postavke › Proširenja* i datoteku tamo instalirajte.
3. U polju *Working folder* odaberite mapu s datotekama vašeg rasporeda. Claude koristi tu mapu samo dok je aplikacija zatvorena. Claude tada čita i piše samo u toj mapi.
4. Uključite proširenje i pokrenite novi razgovor. Pitajte Claudea koje alate Open Planner Studio vidi.

Ne unosite ni token ni port: dok most radi, proširenje aplikaciju pronalazi samostalno. Za svaki zahtjev od Claudea proširenje ponovno bira:

- *Aplikacija je otvorena i most radi*: Claude radi u planu koji je otvoren u aplikaciji. Svaku promjenu odmah vidite u aplikaciji.
- *Aplikacija je zatvorena ili je most isključen*: Claude radi s datotekom rasporeda u radnoj mapi. Promjena je u datoteci tek kad Claude spremi datoteku. Automatskog spremanja nema. Dok je aplikacija otvorena, Claude ne prepisuje postojeću datoteku, nego sprema pod novim imenom.

Ako se aplikacija otvori ili zatvori dok Claude radi, proširenje se prebacuje i javlja to Claudeu. Claude zatim prvo ponovno odabere ili otvori plan, i tek onda nešto mijenja. Ako Claude još ima promjene bez aplikacije koje nisu spremljene, proširenje nastavlja raditi bez aplikacije dok ih Claude ne spremi. Tako se ne gubi nijedan rad. Ako proširenje ne može doći do aplikacije i nema upotrebljive radne mape, Claude vidi samo alat `open_planner_studio_status`, s porukom koja vam kaže što treba učiniti.

**Claude Desktop bez proširenja.** Ako ne možete koristiti proširenje, povežite Claude Desktop s vanjskim alatom `mcp-remote`. Fragment konfiguracije ne može se izravno upotrijebiti u Claude Desktopu: u datoteci `claude_desktop_config.json` navodite program koji Claude Desktop sam pokreće, a ne adresu. `mcp-remote` treba Node.js. U Claude Desktopu odaberite *Postavke › Developer › Edit Config*, u datoteku stavite ovo (sa svojim tokenom) i ponovno pokrenite Claude Desktop:

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

Token je u `env`, a ne u `args`, namjerno: na Windowsu Claude Desktop kvari argument koji sadrži razmak. *Prilagođeni konektor* u Claudeu (*Customize › Connectors*) ne radi s mostom. Claude se tada povezuje iz oblaka tvrtke Anthropic, a taj oblak ne može doći do mosta na vašem računalu.

U grupi *Povezivanje* nalazi se i polje *Token*. To je dug, nasumičan kod koji aplikacija za vas stvara i čuva na ovom računalu. U prozoru piše *Ovaj token daje pristup otvorenom planu. Nemojte ga dijeliti s drugima.* Ikonom *Novi token* stvarate novi token. Aplikacija najprije pita *Stvaranjem novog tokena prekidaju se sve postojeće veze. Želite li nastaviti?* Ako most radi, ponovno se pokreće s novim tokenom, a stari više ne radi.

**Kako proširenje pronalazi aplikaciju.** Dok most radi, aplikacija za računalo zapisuje port i token u datoteku `mcp/runtime.json` u mapi s podacima aplikacije. Proširenje za Claude Desktop čita tu datoteku pri svakom zahtjevu. Na Linuxu i macOS-u tu datoteku može čitati samo vaš korisnički račun. Na Windowsu zadana ACL-postavka vaše profilne mape štiti datoteku; aplikacija to posebno ne provjerava. Kad zaustavite most ili isključite *Dopusti MCP-vezu*, aplikacija datoteku uklanja. Aplikacija vodi i popis otvorenih datoteka u `mcp/open-files.json`, čak i kad je *Dopusti MCP-vezu* isključena. Dok ta datoteka postoji, proširenje i MCP-poslužitelj bez sučelja ne prepisuju nijednu postojeću datoteku, pa ni datoteku koju ste upravo otvorili, a koja još nije na popisu. Nova datoteka je dopuštena. Čitanje je također dopušteno: Claude tada vidi verziju na disku, bez vaših promjena koje još nisu spremljene.

### 4. Pogledajte što MCP-klijent radi

1. Kliknite *Panel zadatka* u grupi *Dnevnik*. U bočnom dijelu prozora otvara se panel *MCP-dnevnik*.
2. Svaki poziv mosta nalazi se u jednom retku, najnoviji je na vrhu: vrijeme, što se dogodilo, koliko je trajalo i je li uspio ili nije. Kliknite redak da se prikažu *Argumenti* i *Odgovor*.
3. Gumbom *Obriši* ispraznite popis. Panel čuva zadnjih 500 poziva. Dok se ništa nije dogodilo, piše *Još nema MCP-aktivnosti. Pozivi mosta prikazat će se ovdje.*

Kad je *Dopusti MCP-vezu* uključena, u traci stanja, dolje desno, nalazi se točka s *MCP*. Njezina boja pokazuje stanje mosta, a klik na nju vodi vas na karticu *MCP*.

### 5. Postavite ograničenja

U grupi *Sigurnost* nalaze se gumbi kojima ograničavate MCP-klijent:

- *Pauziraj*: MCP-klijent privremeno ništa ne smije mijenjati, čitanje je i dalje dopušteno. Most ostaje aktivan. Gumb postaje *Nastavi*.
- *Samo za čitanje*: svi alati koji nešto mijenjaju odbijaju se dok je to uključeno.
- *Automatska sigurnosna kopija: uključena*: prije prve promjene koju MCP-klijent napravi u dokumentu, aplikacija zapisuje IFC-sigurnosnu kopiju. To je zadano uključeno. Gumbom to isključite, a tada piše *Automatska sigurnosna kopija: isključena*. To se događa jednom po dokumentu, svaki put kad pokrenete most.
- *Napravi sigurnosnu kopiju*: odmah napravi sigurnosnu kopiju aktivnog dokumenta. Nakon toga piše *Sigurnosna kopija stvorena:* s nazivom datoteke.
- *Otvori mapu sigurnosnih kopija*: otvara mapu sa sigurnosnim kopijama.

Sigurnosne kopije su u mapi `ai-backups` u mapi s podacima aplikacije. Aplikacija čuva nedavne sigurnosne kopije, a starije prorjeđuje; točan način opisan je u [MCP-alatima](docs://ref-ai-tools).

### 6. Pustite MCP-klijent da dobro planira

MCP-klijent dobro planira samo ako poznaje pravila planiranja. Ovo sami radite:

1. **Ne radite ništa za osnovna pravila.** Ona dolaze uz povezivanje: most ih šalje u polju `instructions` MCP-rukovanja. Hoće li ih klijent staviti u svoj sustavski upit, ovisi o klijentu.
2. **Pustite da se vodič pročita.** Upit za povezivanje iz prozora *Podaci za povezivanje* traži od MCP-klijenta da pročita vodič alatom `planner_get_planning_guide`. Ako ne koristite upit, zapitajte se: *Pročitajte vodič za planiranje alatom planner_get_planning_guide prije nego što bilo što promijenite.* Vodič možete sami pročitati na `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Izborno: instalirajte vještine.** To radi samo s MCP-klijentom koji podržava vještine. Stavite `SKILL.md` od *goed-plannen* i *progress-update* u `.claude/skills/goed-plannen/SKILL.md` i `.claude/skills/progress-update/SKILL.md` u mapu projekta u kojoj radi MCP-klijent, ili u `~/.claude/skills/` za svaki projekt.

Datoteke možete dobiti na dva načina. Zamolite MCP-klijent da pozove alat `planner_get_planning_guide` s parametrom `part` postavljenim na `skill`: odgovor sadrži oba teksta i, za svaku vještinu, mjesta na kojima ona pripada. Ili ih preuzmite s `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` i `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Ako je *goed-plannen* još tu iz starije verzije aplikacije, zamijenite ga: taj stari tekst je na nizozemskom i upućuje na članak Pomoći umjesto na vodič za MCP-klijente.

Je li MCP-klijent zaista pročitao vodič, to vidite kad otvorite *Panel zadatka*: tada postoji poziv `planner_get_planning_guide`. Konačni odgovor koji MCP-klijent daje treba sadržavati popis pretpostavki: procijenjena trajanja, odabranu razradu, ovisnosti koje je sam stvorio i svako ograničenje koje je postavio. Ako taj popis nedostaje, zatražite ga. Nakon ažuriranja napretka prema *progress-update*, odgovor treba navesti datum stanja, novi datum završetka i odstupanje u odnosu na temeljni plan.

## Zamke i što aplikacija tada radi

**MCP-klijent mijenja nešto što želite poništiti.** Svaka promjena koju napravi MCP-klijent jedan je korak koji poništite naredbom *Poništi* (Ctrl+Z). Niz promjena koje MCP-klijent predaje kao cjelinu jedan je korak. Nakon toga projekt se prikazuje kao nespremljen. Nakon promjene raspored se ponovno izračunava, pa sami ne morate pritisnuti F5.

**Aplikacija odbija poziv MCP-klijenta.** S *Pauziraj* i *Samo za čitanje* aplikacija odbija sve promjene, a čitanje ostaje moguće, uključujući ponovno izračunavanje zastarjelog rasporeda. Ako sami nešto uređujete, na primjer povlačite traku ili upisujete u polje, MCP-klijent dobije datume iz vremena prije vaše izmjene, uz obavijest da su zastarjeli. Ako imate otvoren dijalog, na primjer postavke, dijalog zadatka ili prozor dobrodošlice, ili je uključen način prezentacije, aplikacija odbija sve pozive, pa i čitanje, dok ne zatvorite dijalog. MCP-klijent tada dobije poruku o grešci s internim nazivom onoga što je otvoreno, na primjer `showTaskDialog`. Samo `planner_get_planning_guide` i dalje radi, jer ne čita vaš raspored.

**Prebacujete kartice dok MCP-klijent radi.** MCP-klijent radi u dokumentu u kojem je nastala njegova prva promjena. Ako u međuvremenu prebacite karticu, aplikacija odbija njegovu sljedeću promjenu dok ne potvrdi da želi raditi na drugoj kartici. Tako ništa ne završi u pogrešnom projektu. Ako MCP-klijent sam otvori ili kopira dokument, nakon toga radi u tom novom dokumentu.

**MCP-klijent piše ili otvara datoteku.** MCP-klijent može zapisati raspored kao IFC-datoteku i otvoriti datoteku rasporeda kao novu karticu. Može to samo unutar vaše korisničke mape. Postojeću datoteku prepisuje samo ako to izričito zatraži.

**Stanje je *Port 3877 je zauzet*.** Drugi program koristi port. Poruka aplikacije prikazuje se ispod toga. Polje za port tada ostaje zaključano (*Može se mijenjati samo dok je poslužitelj zaustavljen.*), iako most ne radi, i nema gumba za zaustavljanje. To je poznat nedostatak. Dok se to ne popravi: isključite *Dopusti MCP-vezu*, pa je ponovno uključite. Stanje je tada opet *Isključeno*, a možete odabrati drugi port. Zatim ponovno kopirajte podatke za povezivanje, jer krajnja točka sadrži port.

**Klijent se ne može povezati nakon novog tokena.** Novi token prekida sva postojeća povezivanja. Dajte klijentu novi token ili ponovno zalijepite fragment konfiguracije. Proširenje u Claude Desktopu novi token čita samostalno; tamo ne morate ništa raditi.

**Sami ste zaustavili most, a on se ne pokreće sam.** *Automatski pokreni most* radi jednom pri svakom pokretanju aplikacije. Ako sami zaustavite most, aplikacija ga sama ponovno ne uključuje.

**Kartica *MCP* je nestala.** Opcija *Dopusti MCP-vezu* je isključena. Uključite je u koraku 1.

**Web-stranica u pregledniku ne može komunicirati s mostom.** Most odbija svaki zahtjev koji dolazi iz preglednika i svaki zahtjev bez ispravnog tokena.

## Bez aplikacije

Postoji i poslužitelj koji radi bez aplikacije za računalo: **MCP poslužitelj bez zaslona**. Nudi iste alate `planner_*`, ali radi s datotekom rasporeda na disku umjesto s otvorenim projektom. Zato ne vidite promjene u Gantt dijagramu, a naredba *Poništi* u aplikaciji se na njih ne primjenjuje. Upotrijebite ga kad ne želite otvoriti aplikaciju ili kad ste na računalu bez zaslona.

Proširenje za Claude Desktop pokreće ovaj poslužitelj samostalno kad je aplikacija zatvorena (pogledajte korak 3). Koraci u nastavku namijenjeni su drugom MCP klijentu, na primjer Claude Code.

Izdanje ne uključuje gotov poslužitelj za preuzimanje. Izgradite ga iz izvornog koda naredbom `npm run build:mcp-server`; za to vam je potreban Node.js 22 ili noviji. Rezultat je jedna datoteka, `server.mjs`.

1. Odaberite radnu mapu u kojoj su vaše datoteke rasporeda. Poslužitelj čita i zapisuje samo u toj mapi.
2. Povežite svoj MCP klijent. Za Claude Code naredba je navedena ispod ovih koraka.
3. Zatražite od MCP klijenta da otvori raspored, na primjer `~/plan.ifc`. U ovom poslužitelju `~` znači radnu mapu.
4. Zatražite od MCP klijenta da spremi rezultat. Nema automatskog spremanja: MCP klijent datoteku zapisuje pomoću alata `planner_export_ifc`. Ono što se ne spremi, izgubi se kad se poslužitelj zaustavi.

Za korak 2 u Claude Code-u unesite ovu naredbu u terminalu, sa svojim putanjama:

```
claude mcp add open-planner -- node /path/to/server.mjs --root /path/to/working-folder
```

Prije prve promjene po dokumentu poslužitelj izrađuje MCP sigurnosnu kopiju, kao i aplikacija. MCP klijent koji odabere putanju izvan radne mape, pa i preko prečaca (simboličke veze), dobiva odbijanje. Dok je aplikacija otvorena, poslužitelj ne prepisuje postojeću datoteku.

## Pogledajte i

- [Davanje povratnih informacija](docs://howto-feedback-geven): ako se veza ponaša drugačije nego što je ovdje opisano, prijavite to.
- [MCP alati](docs://ref-ai-tools): svi alati `planner_*` po skupini, kodovi pogrešaka i koliko se dugo čuvaju sigurnosne kopije.
- [Postavke aplikacije](docs://ref-instellingen): MCP postavke.
