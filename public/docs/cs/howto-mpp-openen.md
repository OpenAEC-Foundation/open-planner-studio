# Otevření souboru MS Project (.mpp)

Cíl: otevřít plán z Microsoft Project přímo v aplikaci, bez předchozího exportu.

## Kdy to potřebujete

Dodavatel, konzultant nebo klient vám pošle svůj plán jako soubor `.mpp`. Chcete jej zobrazit, přepočítat nebo dál upravovat. Aplikace čte soubory `.mpp` z MS Project 2010 až 2021 včetně. Aplikace soubor pouze čte. Nezapisuje do `.mpp` a váš soubor nikdy nezmění. Ze souboru aplikace převezme samotný plán: úkoly včetně struktury, doby trvání a omezení, závislosti s prodlevami, kalendáře, zdroje, přiřazení a průběh. Aplikace čte také data a časové rezervy, které MS Project sám určil, ale používá je jen pro zobrazení *Data tak, jak jsou uložena*, nikdy jako vstup.

## Kroky

1. Zvolte *Domů › Soubor › Otevřít* nebo stiskněte Ctrl+O. Zvolte soubor `.mpp`.
2. Projekt se otevře na nové kartě, nebo na aktuální kartě, pokud byla ještě prázdná a beze změn. Projekt nemá soubor: *Uložit* později zapíše nový soubor IFC. Potom se krátce zobrazí okno s vysvětlením, co aplikace ze souboru převzala a jak funguje ukládání; viz [Otevření a uložení souboru](docs://howto-bestand-openen-en-opslaan).
3. Přečtěte si hlášení dole: *Tento projekt se počítá jako Microsoft Project. Změnit to lze v nabídce Soubor → Informace o projektu → Profil výpočtu a možnosti výpočtu.* Aplikace vypočítá tento projekt podle pravidel MS Project: profil výpočtu *Microsoft Project*. Příkazem *Otevřít profil výpočtu* přejdete k nastavení. *Číst více* otevře nápovědu o profilu výpočtu.
4. Zkontrolujte, zda je pod pásem karet lišta: *Vidíte data tak, jak jsou uložena v souboru; při přepočítání se odchýlí 4 úkoly*. U těchto úkolů se pak výsledek aplikace liší od dat, která uložil MS Project. Pod hlášením z kroku 3 je pak ještě řádek: *4 úkoly zobrazují data tak, jak jsou uložena v souboru (bez přepočtu)*. Co to znamená a jak přepnete na výpočet aplikace, je popsáno v článku [Data tak, jak jsou uložena](docs://uitleg-datums-zoals-opgeslagen).
5. Pokud se zobrazí *Tento soubor obsahuje plánování v hodinách.* s tlačítkem *Zapnout plánování v hodinách*, obsahuje soubor data v hodinách. Viz [Zapnutí plánování v hodinách](docs://howto-urenplanning-aanzetten).

Pokud soubor obsahuje úkoly s přerušením práce, vyrovnáním nebo plánováním řízeným zdroji, přidá se další hlášení, například *Tento soubor MS Project obsahuje 3 úkoly s přerušením práce, vyrovnáním nebo plánováním řízeným zdroji. Jsou takto načteny a zobrazeny.* U jednoho úkolu je hlášení v jednotném čísle.

## Možné problémy a co aplikace potom dělá

**Ne všechno se přenese.** Po otevření vám aplikace v jednom hlášení řekne, co nepřebrala: *Ne všechno z tohoto souboru MS Project bylo převzato.* Pod ním je jeden řádek pro každou položku s počtem, například *2 směrné plány nebyly převzaty.* U souboru `.mpp` je pak prvním řádkem tohoto hlášení věta o profilu výpočtu z kroku 3. Hlášení zůstane zobrazeno, dokud kliknete na křížek. Když se nic neztratí, toto hlášení neuvidíte. Řádek se může týkat:

- vložených projektů (podprojektů): aplikace je načte jako běžný úkol bez propojení s druhým souborem;
- externích úkolů z jiného projektu: aplikace je načte jako běžný úkol;
- směrných plánů: ze souboru `.mpp` aplikace nepřebírá žádný směrný plán, z XML souboru MS Project jen směrný plán 0 úkolů, a z něj jen data a dobu trvání (u úkolu v hodinách také čas; ne práci a náklady, a ne směrné plány zdrojů a přiřazení);
- u XML z MS Project: přiřazení, jehož směrný plán má jiná data než jeho úkol. Aplikace si uchová jen směrný plán úkolu; když jsou data stejná, nic se neztratí a aplikace nic nehlásí. Jiný čas téhož dne se také počítá jako rozdíl;
- vlastních polí s hodnotami, například vlastní pole, hodnoty z číselníku a kódy struktury (v souboru `.mpp` aplikace pole ano/ne do hlášení nezahrne);
- poznámky (i poznámka jen s obrázkem) u zdrojů a přiřazení, a ze souboru `.mpp` také u úkolů (z XML souboru MS Project se poznámka úkolu převezme jako jeho popis);
- hypertextové odkazy;
- pevné náklady úkolů;
- sazby zdrojů: ze souboru `.mpp` žádnou sazbu, z XML souboru MS Project jen standardní sazbu;
- jen u XML z MS Project: ručně plánované úkoly (aplikace je naplánuje automaticky), neaktivní úkoly (zahrnou se do výpočtu) a zpoždění vyrovnání;
- jen u souboru `.mpp`: kritická prahová hodnota z MS Project; aplikace používá prahovou hodnotu 0.

Kód WBS, který jste sami vyplnili v MS Project, se přebere; jinak aplikace očísluje úkoly podle struktury.

**Soubor z MS Project 2007 nebo staršího.** Aplikace soubor odmítne a zobrazí hlášení: *Tento soubor .mpp používá starý formát (Project 2007 nebo starší). Exportujte jej v MS Project jako XML (Soubor → Uložit jako → XML) a otevřete tento soubor*. Pod hlášením přidá aplikace technický důvod v angličtině.

**Soubor s heslem.** Aplikace zobrazí hlášení: *Tento soubor .mpp je chráněn heslem. Exportujte jej v MS Project jako XML (Soubor → Uložit jako → XML) a otevřete tento soubor*. I zde přichází hlášení s technickým důvodem v angličtině.

**Soubor, který není `.mpp`.** Zobrazí se *Otevření souboru se nezdařilo* s technickým důvodem.

**Přes XML se výsledek vypočítá jinak.** Když otevřete export MS Project do XML místo souboru `.mpp`, aplikace vypočítá podle profilu výpočtu *Open Planner Studio* a nezobrazí se hlášení o *Microsoft Project*. Data pak mohou být jiná než u souboru `.mpp`. I při exportu do XML vám aplikace řekne, co nepřebrala; viz *Ne všechno se přenese*.

**Úprava uvolní řízení z MS Project.** Pokud upravíte úkol, jehož plán řídilo časové okno z MS Project, aplikace zobrazí hlášení jednou pro projekt: *Časové okno z MS Project po této úpravě již neřídí 2 úkoly; samotné rozložení práce dál platí a zůstává uloženo v souboru.* Pro jeden úkol je hlášení v jednotném čísle.

**Uložení nikdy nepřepíše váš soubor `.mpp`.** Projekt nemá soubor. Příkaz *Uložit* se zeptá, kam se má nový soubor IFC uložit.

## Viz také

- [Soubory a formáty](docs://uitleg-bestanden): proč se `.mpp` pouze čte a co zapíše ukládání.
- [Data tak, jak jsou uložena](docs://uitleg-datums-zoals-opgeslagen): zobrazení vlastních dat MS Project.
- [Zapnutí plánování v hodinách](docs://howto-urenplanning-aanzetten): pokud soubor obsahuje data v hodinách.
- [Otevření souboru Primavera P6 (.xer)](docs://howto-xer-openen): totéž platí i pro Primaveru.
- [Formáty pro import a export](docs://ref-import-exportformaten): u každého formátu, co se přenese a co ne.
- [Profily výpočtu a konvence](docs://uitleg-rekenprofielen): proč se soubor MS Project otevře se svým vlastním profilem výpočtu.
