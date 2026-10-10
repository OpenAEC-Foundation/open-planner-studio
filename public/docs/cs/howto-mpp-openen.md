# Otevření souboru MS Project (.mpp)

Cíl: otevřít plán z Microsoft Project přímo v aplikaci, bez předchozího exportu.

## Kdy to potřebujete

Dodavatel, konzultant nebo klient vám pošle svůj plán jako soubor `.mpp`. Chcete jej zobrazit, přepočítat nebo dál upravovat. Aplikace čte soubory `.mpp` z MS Project 2010 až 2021 včetně. Aplikace soubor pouze čte. Nezapisuje do `.mpp` a váš soubor nikdy nezmění. Ze souboru aplikace převezme samotný plán: úkoly včetně struktury, doby trvání a omezení, závislosti s prodlevami, kalendáře, zdroje, přiřazení a průběh. Aplikace čte také data a časové rezervy, které MS Project sám určil, ale používá je jen pro zobrazení *Data tak, jak jsou uložena*, nikdy jako vstup.

## Kroky

1. Zvolte *Domů › Soubor › Otevřít* nebo stiskněte Ctrl+O. Zvolte soubor `.mpp`.
2. Projekt se otevře na nové kartě, nebo na aktuální kartě, pokud byla ještě prázdná a beze změn. Projekt nemá soubor: *Uložit* později zapíše nový soubor IFC.
3. Přečtěte si hlášení dole: *Tento projekt se počítá jako Microsoft Project. Změnit to lze v Soubor → Informace o projektu → Profil výpočtu a možnosti výpočtu*. Aplikace vypočítá tento projekt podle pravidel MS Project: profil výpočtu *Microsoft Project*. Příkazem *Otevřít profil výpočtu* přejdete k nastavení. *Číst více* otevře nápovědu o profilu výpočtu.
4. Zkontrolujte, zda je pod pásem karet lišta: *Vidíte data tak, jak jsou uložena v souboru; při přepočítání se odchýlí 4 úkoly*. U těchto úkolů se pak výsledek aplikace liší od dat, která uložil MS Project. Pod hlášením z kroku 3 je pak ještě řádek: *4 úkoly zobrazují data tak, jak jsou uložena v souboru (bez přepočtu)*. Co to znamená a jak přepnete na výpočet aplikace, je popsáno v článku [Data tak, jak jsou uložena](docs://uitleg-datums-zoals-opgeslagen).
5. Pokud se zobrazí *Tento soubor obsahuje plánování v hodinách* s tlačítkem *Zapnout plánování v hodinách*, obsahuje soubor data v hodinách. Viz [Zapnutí plánování v hodinách](docs://howto-urenplanning-aanzetten).

Pokud soubor obsahuje úkoly s přerušením práce, vyrovnáním nebo plánováním řízeným zdroji, přidá se další hlášení, například *Tento soubor MS Project obsahuje 3 úkoly s přerušením práce, vyrovnáním nebo plánováním řízeným zdroji. Jsou takto načteny a zobrazeny*. U jednoho úkolu je hlášení v jednotném čísle.

## Možné problémy a co aplikace potom dělá

**Ne všechno se přenese.** Aplikace nepřebírá směrné plány, náklady, standardní sazby, poznámky ani vlastní pole z MS Project. Kód WBS, který jste sami vyplnili v MS Project, se přebere; jinak aplikace očísluje úkoly podle struktury.

**Soubor z MS Project 2007 nebo staršího.** Aplikace soubor odmítne a zobrazí hlášení: *Tento soubor .mpp používá starý formát (Project 2007 nebo starší). Exportujte jej v MS Project jako XML (Soubor → Uložit jako → XML) a otevřete tento soubor*. Pod hlášením přidá aplikace technický důvod v angličtině.

**Soubor s heslem.** Aplikace zobrazí hlášení: *Tento soubor .mpp je chráněn heslem. Exportujte jej v MS Project jako XML (Soubor → Uložit jako → XML) a otevřete tento soubor*. I zde přichází hlášení s technickým důvodem v angličtině.

**Soubor, který není `.mpp`.** Zobrazí se *Otevření souboru se nezdařilo* s technickým důvodem.

**Přes XML se výsledek vypočítá jinak.** Když otevřete export MS Project do XML místo souboru `.mpp`, aplikace vypočítá podle profilu výpočtu *Open Planner Studio* a nezobrazí se hlášení o *Microsoft Project*. Data pak mohou být jiná než u souboru `.mpp`.

**Úprava uvolní řízení z MS Project.** Pokud upravíte úkol, jehož plán řídilo časové okno z MS Project, aplikace zobrazí hlášení jednou pro projekt: *Časové okno z MS Project po této úpravě již neřídí 2 úkoly; samotné rozložení práce dál platí a zůstává uloženo v souboru*. Pro jeden úkol je hlášení v jednotném čísle.

**Uložení nikdy nepřepíše váš soubor `.mpp`.** Projekt nemá soubor. Příkaz *Uložit* se zeptá, kam se má nový soubor IFC uložit.

## Viz také

- [Soubory a formáty](docs://uitleg-bestanden): proč se `.mpp` pouze čte a co zapíše ukládání.
- [Data tak, jak jsou uložena](docs://uitleg-datums-zoals-opgeslagen): zobrazení vlastních dat MS Project.
- [Zapnutí plánování v hodinách](docs://howto-urenplanning-aanzetten): pokud soubor obsahuje data v hodinách.
- [Otevření souboru Primavera P6 (.xer)](docs://howto-xer-openen): totéž platí i pro Primaveru.
- [Formáty pro import a export](docs://ref-import-exportformaten): u každého formátu, co se přenese a co ne.
- [Profily výpočtu a konvence](docs://uitleg-rekenprofielen): proč se soubor MS Project otevře se svým vlastním profilem výpočtu.
