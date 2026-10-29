# Nový projekt a Nastavení projektu

Pole v oknech *Nový projekt* a *Nastavení projektu*: co dělá každé pole, jaká je výchozí hodnota a kde se projeví. Obě okna ukazují stejný formulář. *Nový projekt* vytvoří nový projekt a má několik dalších polí. *Nastavení projektu* mění projekt, který máte otevřený.

## Otevření

**Nový projekt** — otevřete na kartě *Soubor › Nový*, klávesou Ctrl+N, nebo klikněte na plus napravo od záložek dokumentu (*Začít projekt*, potom *Nový projekt*). Okno se otevře s kurzorem v poli *Název projektu*.

**Nastavení projektu** — na kartě *Nastavení › Projekt › Nastavení projektu* se formulář otevře jako okno s názvem *Nastavení projektu*. Na kartě *Soubor › Nastavení projektu* se stejný formulář zobrazí na obrazovce *Soubor*. Blok *Profil výpočtu a možnosti výpočtu* je na obou místech dole; co v něm je, popisuje [Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies).

## Vytvoření, použití a zrušení

**Vytvořit** (v okně *Nový projekt*) vytvoří projekt. Pokud je aktuální záložka prázdná a nezměněná, použije ji aplikace; jinak se projekt otevře na nové záložce. **Použít** (v okně *Nastavení projektu*) zapíše vaše změny do projektu.

- **Jen při použití.** Píšete do konceptu. Projekt se změní až ve chvíli, kdy kliknete na *Použít*. *Použít* zapíše jen to, co jste skutečně změnili, v jednom kroku v *Vrátit zpět*. Když kliknete na *Použít* bez změny, nic se nestane a žádný krok se nepřidá.
- **Zrušit, křížek a Esc** zavřou okno bez uložení čehokoli. Klik vedle okna ho nezavře: zůstane, co jste napsali.
- **Enter** dělá totéž co *Vytvořit* nebo *Použít*, kromě pole *Popis* a otevřeného rozbalovacího seznamu.
- **Na obrazovce Soubor** se dole u *Nastavení projektu* zobrazí *Změny nebyly použity — klikněte na Použít, aby se uchovaly.*, dokud se váš koncept liší. Když pak obrazovku opustíte, aplikace se zeptá, zda chcete použít, zahodit, nebo zrušit. Viz [Pás karet, záložku po záložce](docs://ref-lint).
- **Vlastní profil výpočtu bez názvu** blokuje *Použít* a *Vytvořit*. Zadejte mu název, nebo změnu zahoďte.

## Pole v obou oknech

**Název projektu** — název projektu v titulku okna, na záložce a v názvu souboru při uložení. Výchozí hodnota: prázdné. Prázdné pole je povoleno: projekt se pak jmenuje *Nový plán* a zobrazí se šedým textem v poli. Kde: celá obrazovka.

**Popis** — volný text. Výchozí hodnota: prázdné. Účinek: uloží se k projektu, do souboru IFC a do exportu do Primavera P6 XML. Na plán nemá vliv.

**Autor** — volný text. Výchozí hodnota: prázdné. Účinek: zapíše se do souboru IFC a v záhlaví sestavy se zobrazí jako *Autor:*. Tam ho nemůžete přepsat.

**Knihovna zdrojů** — ke které knihovně zdrojů je projekt připojen. Vyberte *žádná knihovna (samostatný projekt)*, některou stávající knihovnu, nebo *+ Nová knihovna zdrojů*. Výchozí hodnota: v okně *Nový projekt* výchozí knihovna, v okně *Nastavení projektu* aktuální propojení. Účinek: viz [Použití knihovny zdrojů](docs://howto-resourcebibliotheek-gebruiken). Když zvolíte *+ Nová knihovna zdrojů*, zadáte název do pole pod ním. Knihovna se vytvoří až po kliknutí na *Vytvořit* nebo *Použít*, takže při zrušení nezůstane nic. Propojení v okně *Nastavení projektu* se změní jen tehdy, když sami upravíte toto pole.

**Klient/organizace** — volný text. Výchozí hodnota: prázdné. Účinek: zapíše se do souboru IFC a v záhlaví sestavy se zobrazí jako *Společnost:*.

**Datum zahájení** — zahájení projektu. Výchozí hodnota: v okně *Nový projekt* dnešní den. Co pole dělá, je níže v části *Co dělá datum zahájení*.

**Datum dokončení** — plánované dokončení projektu. Výchozí hodnota: prázdné. Účinek: jde o údaj, ne o požadavek: aplikace neplánuje směrem k tomuto datu. Objeví se v záhlaví sestavy a v exportech a určuje, až do kterého roku se generují svátky. Jen pro soubor Primavera s nastavením *Přepočítat časovou rezervu až do dokončení projektu* (viz [Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies)) běží výpočet časové rezervy až do tohoto data.

**Výchozí jednotka pro nové úkoly** — vidět je jen tehdy, když je zapnutá volba *Zapnout plánování v hodinách*. Vyberte ze seznamu *Dny* a *Hodiny*. Výchozí hodnota: *Dny*. Účinek a podmínky: viz [Zapnutí plánování v hodinách](docs://howto-urenplanning-aanzetten).

**Profil výpočtu a možnosti výpočtu** — v okně *Nastavení projektu* celý blok, v okně *Nový projekt* jen rozbalovací seznam *Profil výpočtu* s volbami *Primavera P6*, *Microsoft Project* a *Open Planner Studio*. Výchozí hodnota: *Open Planner Studio*. Když zvolíte profil, nastaví se také výchozí možnosti tohoto profilu. Viz [Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies).

## Jen v okně Nastavení projektu

**Schéma IFC při ukládání** — které schéma IFC je v záhlaví uloženého souboru. K dispozici jsou *IFC 4.3 ADD2 (výchozí)*, *IFC 4.3* a *IFC4*. Výchozí hodnota: *IFC 4.3 ADD2 (výchozí)*; u otevřeného souboru IFC schéma tohoto souboru. Účinek: mění se jen záhlaví souboru, ne obsah. Použijte ho, když chcete sloučit plán s modelem budovy ve stejném schématu. Pokud má otevřený soubor jiné schéma než výchozí, aplikace se při prvním uložení zeptá, zda ho chcete zachovat. Volba zde se počítá jako odpověď. Změna schématu zde není krokem v *Vrátit zpět*: schéma patří k souboru. Viz [Výběr schématu IFC](docs://howto-ifc-schema-kiezen).

## Jen v okně Nový projekt

**Šablona fází** — které fáze má projekt na začátku. Vyberte ze seznamu *Prázdný*, *Bytová výstavba* a *Nebytová výstavba / rekonstrukce*. Výchozí hodnota: *Prázdný*. Účinek: *Prázdný* dá projekt bez úkolů. Zbylé dvě vloží osm připravených úkolů fází. Každý má dobu trvání 5 ve výchozí jednotce projektu (5 pracovních dnů, nebo 5 hodin, když zvolíte *Hodiny* u pole *Výchozí jednotka pro nové úkoly*) a nemá závislosti. Názvy, polohu a délku upravíte sami. Pro šablonu *Bytová výstavba* jde o tyto úkoly: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking a Oplevering. Pro šablonu *Nebytová výstavba / rekonstrukce* jde o: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen a Oplevering. Názvy jsou data vašeho projektu a zůstávají nizozemské, i když máte jiný jazyk rozhraní. Pokud je volba *Zapnout stavební režim* vypnutá, existuje jen *Prázdný*. Viz [Nastavení aplikace](docs://ref-instellingen).

**Směna** — vidět ji je jen tehdy, když je zapnutá volba *Zapnout plánování v hodinách*. Vyberte ze seznamu *Denní směna*, *2 směny*, *3 směny* a *24/7*. Výchozí hodnota: *Denní směna*. Účinek: *Denní směna* ponechá standardní kalendář beze změny, tedy obyčejný denní kalendář od pondělí do pátku. Další tři vloží do kalendáře projektu bloky pracovní doby, jako stejnojmenná tlačítka v okně *Kalendáře*. Které časy to jsou, je v [Nastavení pracovní doby](docs://howto-werktijden-instellen). U možnosti *Denní směna* nejde zvolit *Hodiny* u pole *Výchozí jednotka pro nové úkoly*, protože denní kalendář nemá bloky pracovní doby.

**Sada svátků** — které volné dny dostane kalendář projektu. U pole *Země* vyberete *Nizozemsko* (výchozí), *Německo*, *Belgie*, *Francie*, *Spojené království*, *Rakousko*, *Švýcarsko*, *Žádné svátky* nebo *Vlastní*. Pokud má země regiony, přidá se rozbalovací seznam *Region*. U Nizozemska také vyberete, pokud je zapnutý *Zapnout stavební režim*, v poli *Letní stavební uzávěra*: *Žádná* (výchozí), *Sever*, *Střed* nebo *Jih*. Pod tím je řádek, například *Počet svátků: 36, 2025–2029*, který rozbalíte pro seznam. Roky jdou od roku před datem zahájení do roku po datu dokončení, nebo do tří let po roce zahájení, pokud datum dokončení chybí. Volba *Vlastní* vytvoří kalendář bez svátků a hned po vytvoření otevře okno *Kalendáře*, abyste je mohli doplnit sami. Kalendář projektu se jmenuje *Bouwkalender NL*, nebo *Standaardkalender*, pokud je volba *Zapnout stavební režim* vypnutá; pak je k dispozici i *Žádné svátky*. Jak generátor funguje, popisuje [Generování svátků a letní stavební uzávěry](docs://howto-feestdagen-genereren).

## Co dělá datum zahájení

Datum zahájení je pevný bod projektu. Platí tři pravidla:

- **Nové úkoly začínají datem zahájení.** Úkol, který přidáte, dostane jako plánovaný začátek zahájení projektu.
- **Úkol s předchůdcem nikdy nezačne před datem zahájení.** Když je dokončení předchůdce dřívější, úkol počká na datum zahájení. Úkol *bez* předchůdce si ponechá své datum, i když leží před datem zahájení. To je nutné, aby se plán z Microsoft Project nebo Primavery zobrazil tak, jak ho ukazuje zdrojový program. Omezení *Musí začít (MSO)* nebo *Musí skončit (MFO)* porušuje obě pravidla: takový úkol zůstane na svém datu, i když připadne před datum zahájení.
- **Pozdější datum zahájení posune volné úkoly.** Když nastavíte datum zahájení později v *Nastavení projektu* a kliknete na *Použít*, posunou se na toto datum úkoly bez předchůdce, které leží před novým datem a nemají omezení s dolní mezí (*Zahájit nejdříve*, *Musí začít*, *Dokončit nejdříve* nebo *Musí skončit*). Posun proběhne ve stejném kroku v *Vrátit zpět*. Aplikace oznámí, kolik úkolů se posunulo. K posunu dojde jen tehdy, když změníte datum zahájení sami, nikdy při otevření souboru. Pozdější datum zahájení neposune zbytek plánu: to udělá *Přesunout projekt*, viz [Přesun projektu](docs://howto-project-verplaatsen).

## Viz také

- [Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies): blok *Profil výpočtu a možnosti výpočtu*.
- [Profily výpočtu a konvence](docs://uitleg-rekenprofielen): proč profil mění výsledek.
- [Přesun projektu](docs://howto-project-verplaatsen): celý plán na jiné zahájení.
- [Přidání úkolů a milníků](docs://howto-taken-en-mijlpalen-toevoegen): jak začít prvními úkoly.
- [Generování svátků a letní stavební uzávěry](docs://howto-feestdagen-genereren): sada svátků podrobně.
- [Výběr schématu IFC](docs://howto-ifc-schema-kiezen): uložení pro model budovy v IFC4.
