# Nový projekt a Info o projektu

Pole okna *Nový projekt* a okna *Info o projektu*: co dělá každé pole, jaká je výchozí hodnota a kde platí. Jsou to dvě strany stejného formuláře. *Nový projekt* vytvoří nový projekt a má několik dalších polí. *Info o projektu* mění projekt, který máte otevřený.

## Otevření

**Nový projekt** — *Soubor › Nový*, Ctrl+N, nebo plus vpravo od karet dokumentů (*Začít projekt*, pak *Nový projekt*). Okno se otevře s kurzorem v poli *Název projektu*.

**Info o projektu** — *Nastavení › Projekt › Info o projektu* otevře formulář jako okno s názvem *Informace o projektu*. *Soubor › Info o projektu* ukáže stejný formulář na obrazovce *Soubor*. Blok *Profil výpočtu a možnosti výpočtu* je na obou místech dole. Co v něm je, popisuje [Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies).

## Vytvořit, použít a zrušit

**Vytvořit** (v okně *Nový projekt*) vytvoří projekt a otevře ho na vlastní kartě. **Použít** (v okně *Info o projektu*) zapíše vaše změny do projektu.

- **Jen při *Použít*.** Píšete do konceptu. Projekt se změní jen tehdy, když kliknete na *Použít*. *Použít* zapíše jen to, co jste skutečně změnili, jedním krokem, který lze vrátit pomocí *Vrátit zpět*. Když kliknete na *Použít* a nic jste nezměnili, nestane se nic a žádný krok se nepřidá.
- **Zrušit, křížek a Esc** zavřou okno bez uložení čehokoli. Klik vedle okna ho nezavře: to, co jste napsali, zůstane.
- **Enter** dělá totéž jako *Vytvořit* nebo *Použít*, kromě pole *Popis* a otevřeného rozbalovacího seznamu.
- **Na obrazovce *Soubor*** ukazuje *Info o projektu* dole *Změny nebyly použity — klikněte na Použít, aby se uchovaly.* tak dlouho, dokud se koncept liší. Když pak obrazovku opustíte, aplikace se zeptá, zda chcete změny použít, zahodit, nebo zrušit. Viz [Pás karet, karta po kartě](docs://ref-lint).
- **Vlastní profil výpočtu bez názvu** blokuje *Použít* a *Vytvořit*. Zadejte mu název, nebo změnu zahoďte.

## Pole v obou oknech

**Název projektu** — název projektu v záhlaví okna, na kartě a v názvu souboru při uložení. Výchozí: prázdné. Prázdné pole je povoleno: projekt se pak jmenuje *Nový plán*, zobrazený šedým textem v poli. Kde: celá obrazovka.

**Popis** — volný text. Výchozí: prázdné. Účinek: uloží se s projektem, v souboru IFC a při exportu do Primavera P6 XML. Nemá vliv na plán.

**Autor** — volný text. Výchozí: prázdné. Účinek: jde do souboru IFC a objeví se jako *Autor:* v záhlaví sestavy, kde se nedá přepsat.

**Knihovna zdrojů** — ke které knihovně zdrojů je projekt připojen. Vyberete z těchto možností: *žádná knihovna (samostatný projekt)*, vaše stávající knihovny a *+ Nová knihovna zdrojů…*. Výchozí: v okně *Nový projekt* výchozí knihovna, v okně *Info o projektu* aktuální připojení. Účinek: viz [Použití knihovny zdrojů](docs://howto-resourcebibliotheek-gebruiken). Při volbě *+ Nová knihovna zdrojů…* napíšete název do pole pod touto volbou. Knihovna vznikne až při *Vytvořit* nebo *Použít*, takže zrušení nic nezanechá. Připojení v *Info o projektu* se změní jen tehdy, když toto pole sami upravíte.

**Klient/organizace** — volný text. Výchozí: prázdné. Účinek: jde do souboru IFC a objeví se jako *Společnost:* v záhlaví sestavy.

**Datum zahájení** — den, kdy projekt začíná. Výchozí: v okně *Nový projekt* dnešní den. Co pole dělá, je uvedeno níže v části *Co dělá datum zahájení*.

**Datum dokončení** — plánované dokončení projektu. Výchozí: prázdné. Účinek: jde o informaci, ne o požadavek. Aplikace k tomuto datu neplánuje. Objeví se v záhlaví sestavy a v exportech a určuje, do kterého roku se generují svátky. Pouze u souboru Primavera, s nastavením *Přepočítat časovou rezervu až do dokončení projektu* (viz [Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies)), běží výpočet časové rezervy až do tohoto data.

**Výchozí jednotka pro nové úkoly** — viditelné jen tehdy, když je *Zapnout plánování v hodinách* zapnuté. Vyberete *Dny* nebo *Hodiny*. Výchozí: *Dny*. Účinek a podmínky: viz [Zapnutí plánování v hodinách](docs://howto-urenplanning-aanzetten).

**Profil výpočtu a možnosti výpočtu** — v okně *Info o projektu* je to celý blok. V okně *Nový projekt* jen rozbalovací seznam *Profil výpočtu* s volbami *Primavera P6*, *Microsoft Project* a *Open Planner Studio*. Výchozí: *Open Planner Studio*. Výběr profilu nastaví také výchozí možnosti tohoto profilu. Viz [Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies).

## Jen v okně Nový projekt

**Šablona fází** — které fáze má projekt na začátku. Vyberete z těchto možností: *Prázdný*, *Bytová výstavba* a *Nebytová výstavba / rekonstrukce*. Výchozí: *Prázdný*. Účinek: *Prázdný* dá projekt bez úkolů. Další dvě možnosti připraví osm fázových úkolů. Každý má dobu trvání 5 ve výchozí jednotce projektu (5 pracovních dnů, nebo 5 hodin, když v poli *Výchozí jednotka pro nové úkoly* zvolíte *Hodiny*). Úkoly nemají závislosti. Názvy, přesun a rozšíření upravíte sami. Pro šablonu *Bytová výstavba* jsou to: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking a Oplevering. Pro šablonu *Nebytová výstavba / rekonstrukce*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen a Oplevering. Názvy jsou data vašeho projektu a zůstávají holandsky, i když je jazyk rozhraní jiný. Když je *Zapnout stavební režim* vypnutý, existuje jen *Prázdný*. Viz [Nastavení](docs://ref-instellingen).

**Směna** — viditelné jen tehdy, když je *Zapnout plánování v hodinách* zapnuté. Vyberete z těchto možností: *Denní směna*, *2 směny*, *3 směny* a *24/7*. Výchozí: *Denní směna*. Účinek: *Denní směna* ponechá standardní kalendář beze změny, tedy obyčejný denní kalendář od pondělí do pátku. Ostatní tři přidají do kalendáře projektu bloky pracovní doby, stejně jako tlačítka stejného názvu v okně *Kalendáře*. Které časy to jsou, popisuje [Nastavení pracovní doby](docs://howto-werktijden-instellen). Při volbě *Denní směna* nelze v poli *Výchozí jednotka pro nové úkoly* zvolit *Hodiny*, protože denní kalendář nemá pracovní bloky.

**Sada svátků** — které volné dny získá kalendář projektu. U pole *Země* vyberete *Nizozemsko* (výchozí), *Německo*, *Belgie*, *Francie*, *Spojené království*, *Rakousko*, *Švýcarsko*, *Žádné svátky* nebo *Vlastní…*. Má-li země regiony, přidá se rozbalovací seznam *Region*. Pro *Nizozemsko* vyberete také, je-li zapnutý *Zapnout stavební režim*, pole *Letní stavební uzávěra*: *Žádná* (výchozí), *Sever*, *Střed* nebo *Jih*. Pod tím je řádek, například *Počet svátků: 36, 2025–2029*, který se pro seznam rozbalí. Roky jdou od roku před datem zahájení do roku po datu dokončení. Pokud datum dokončení chybí, jdou do tří let po roce zahájení. *Vlastní…* vytvoří kalendář bez svátků a hned po vytvoření otevře okno *Kalendáře*, abyste je mohli doplnit sami. Kalendář projektu se jmenuje *Bouwkalender NL*, nebo *Standaardkalender*, když je *Zapnout stavební režim* vypnutý. Volba je pak také *Žádné svátky*. Jak generátor pracuje, je v [Generování svátků a letní stavební uzávěry](docs://howto-feestdagen-genereren).

## Co dělá datum zahájení

Datum zahájení je pevný bod projektu. Platí tři pravidla:

- **Nové úkoly začínají v den zahájení.** Úkol, který přidáte, dostane jako plánované zahájení datum zahájení projektu.
- **Úkol s předchůdcem nikdy nezačne před datem zahájení.** Když je dokončení předchůdce dřívější, úkol počká na datum zahájení. Úkol *bez* předchůdce si ponechá své datum, i když leží před datem zahájení. To je potřeba, aby se plán z programu Microsoft Project nebo Primavera zobrazil stejně jako ve zdrojovém programu. Omezení *Musí začít (MSO)* nebo *Musí skončit (MFO)* obě pravidla poruší. Takový úkol zůstane na svém datu, i když spadne před datum zahájení.
- **Pozdější datum zahájení posune volné úkoly.** Když v okně *Info o projektu* nastavíte pozdější datum zahájení a kliknete na *Použít*, posunou se na toto datum úkoly bez předchůdce a bez omezení, které stanoví spodní mez (*Zahájit nejdříve*, *Musí začít*, *Dokončit nejdříve* nebo *Musí skončit*), a které by ležely před novým datem. Posun proběhne ve stejném kroku, který lze vrátit pomocí *Vrátit zpět*. Aplikace ukáže, kolik úkolů se posunulo. Stane se to jen tehdy, když datum zahájení změníte sami, nikdy při otevření souboru. Pozdější datum zahájení neposune zbytek plánu. To dělá *Přesunout projekt*, viz [Přesun projektu](docs://howto-project-verplaatsen).

## Viz také

- [Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies): blok *Profil výpočtu a možnosti výpočtu*.
- [Profily výpočtu a konvence](docs://uitleg-rekenprofielen): proč profil mění výsledek.
- [Přesun projektu](docs://howto-project-verplaatsen): celý plán na jiné datum zahájení.
- [Přidání úkolů a milníků](docs://howto-taken-en-mijlpalen-toevoegen): první kroky s prvními úkoly.
- [Generování svátků a letní stavební uzávěry](docs://howto-feestdagen-genereren): sada svátků podrobně.
