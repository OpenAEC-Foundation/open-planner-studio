# Sloupce tabulky

Tabulka úkolů má 86 pevných sloupců, plus jeden sloupec na každý kód aktivity a vlastní pole projektu a osm sloupců na každý směrný plán. Tento článek u každého sloupce popisuje, co ukazuje, zda ho můžete upravit a v jaké podobě se hodnota zapisuje. Jak sloupce vybrat a uspořádat, popisuje článek [Přizpůsobení sloupců tabulky](docs://howto-tabelkolommen-aanpassen).

## Kde vybíráte sloupce

Tabulka úkolů vedle diagramu Gantt a tabulka na kartě *Tabulka* mají každá vlastní výběr sloupců. Znaménko plus vpravo v záhlaví otevře výběr sloupců (název okna *Vybrat sloupec*). Na kartě *Tabulka* můžete také použít *Tabulka › Sloupce › Sloupce…*. Výběr sloupců zobrazuje sloupce podle kategorií: *Úkol*, *Plánování*, *Omezení*, *Závislosti*, *Zdroje*, *Průběh*, *Vypočítané*, *Směrný plán*, *Vlastní* a *Technické*. Hledáte podle názvu a *Naposledy použité* je nahoře. *Obnovit výchozí* vrátí výchozí sloupce.

Ve výchozím stavu tabulka vedle diagramu Gantt zobrazuje *WBS*, *Název úkolu* a *Doba trvání*. Tabulka na kartě *Tabulka* zobrazuje *WBS*, *Název úkolu*, *Doba trvání*, *Zahájení*, *Dokončení*, *Typ úkolu*, *Kritický*, *Celková časová rezerva* a *Průběh*, plus sloupec na každý kód aktivity a vlastní pole projektu.

## Jak se hodnoty čtou a upravují

- **Vypočítané sloupce** — sloupce v kategorii *Vypočítané* a několik dalších jsou jen pro čtení: pocházejí z výpočtu. Když se pokusíte upravit buňku jen pro čtení, aplikace napíše *Tento vypočítaný sloupec nelze upravit.* Tento text je obecný pro každou buňku jen pro čtení, i když sloupec není vypočítaný. Když jsou hodnoty zastaralé, protože jste něco změnili, vedle nich se zobrazí *zastaralé*, dokud nestisknete *Přepočítat*.
- **Data** — zobrazí se v zápisu, který jste zvolili v *Nastavení* na kartě *Zobrazení* v části *Formát data*.
- **Doby trvání a časové rezervy** — doba trvání se zobrazí v jednotce úkolu (`5d`, `12h`), nebo podle *Zobrazení doby trvání* na stejné kartě (*Automaticky (vlastní jednotka každého úkolu)*, *Vždy dny* nebo *Vždy hodiny*). Časová rezerva se zobrazí v pracovních dnech, se dvěma desetinnými místy a s desetinným oddělovačem vašeho jazyka.
- **Ano/Ne** — hodnota ano/ne se zobrazí jako *Ano* nebo *Ne*; prázdná hodnota se zobrazí jako pomlčka (—).
- **Úprava** — zadejte nebo vyberte hodnotu. Neplatná hodnota se odmítne s důvodem pod buňkou, například *Zadejte platnou dobu trvání, například 5d nebo 8h.* nebo *Zadejte procento mezi 0 a 100.* Vložení bloku buněk funguje po jednotlivých buňkách. Buňky jen pro čtení se přeskočí a aplikace oznámí, kolik jich bylo.

## Úkol

- **Název úkolu** — název úkolu. Lze upravit, je povinný. Souhrnný úkol se zobrazí tučně se světle podbarveným názvem; milník se zobrazí tučně v barvě milníku (ve stejné barevné skupině jako milník v diagramu Gantt). Běžný úkol zůstává beze změny. Jde jen o formátování: výběr, přetahování a úprava fungují stejně.
- **Popis** — popis. Lze upravit; volný text.
- **WBS** — kód WBS. Lze upravit a je povinný, ale dokud je zapnuto *WBS auto*, je jen pro čtení.
- **Typ úkolu** — typ úkolu (*Stavba*, *Instalace*, *Demolice*, *Logistika*, *Kontrola/inspekce*, *Přesun*, *Renovace*, *Údržba* nebo *Ostatní*). Lze upravit v seznamu.
- **Vlastní typ úkolu** — vlastní typ úkolu z projektu, nebo pomlčka. Lze upravit v seznamu vlastních typů projektu.
- **Barva** — uložená barva úkolu, jako kód barvy, například `#1a73e8`. Lze upravit pomocí výběru barvy. Uloží se do souboru IFC, ale žádný pruh ani sestava ji nepoužívá. Barvy pruhů nastavíte na kartě *Zobrazení › Směrné plány a průběh › Barvy pruhů*.
- **Poznámky** — poznámky ve tvaru `✓ text; ○ text`. Lze upravit, dokud je jen jedna poznámka; pak upravíte její text. Při více poznámkách jsou jen pro čtení.

## Plánování

- **Milník** — zda je úkol milník. Lze upravit. Když ho zapnete, doba trvání se nastaví na 0. Aplikace to odmítne u souhrnného úkolu a u úkolu s přiřazeními.
- **Typ milníku** — *Milník zahájení* nebo *Milník dokončení*, nebo pomlčka pro automatický výběr. Lze upravit jen u milníku.
- **Povinný milník** — příznak *Povinný (smluvní)*. Lze upravit jen u milníku.
- **Priorita vyrovnání** — celé číslo od 0 do 1000, výchozí hodnota je 500. Lze upravit. Hodnota 1000 zafixuje úkol pro vyrovnání.
- **Mezery v rozdělení** — počet mezer v rozdělení, jako `Split gaps: 2`, nebo pomlčka. Jen pro čtení; upravíte je v panelu *Vlastnosti*.
- **Pravidlo pevné veličiny** — pravidlo pevné veličiny úkolu; prázdné pole znamená výchozí nastavení projektu. Lze upravit v seznamu, ale u milníku, souhrnného úkolu nebo překlenovacího úkolu je prázdné a jen pro čtení. Ve výběru sloupců se zobrazí jen tehdy, když jsou pravidla viditelná (*Zobrazit pravidla pevné veličiny a práci*, nebo když soubor pravidla obsahuje).
- **Překlenovací úkol (odvozená doba trvání)** — zda je úkol překlenovací. Lze upravit kromě milníku a souhrnného úkolu.
- **Kalendář** — identifikátor vlastního kalendáře úkolu; prázdné pole (—) znamená kalendář projektu. Zadáte nebo vyberete identifikátor z návrhů; neznámý identifikátor se odmítne. Poznámka: buňka zatím zobrazuje interní identifikátor místo názvu; raději vyberte kalendář v panelu *Vlastnosti*.
- **Typ doby trvání** — *Pracovní doba* (doba trvání se počítá v pracovních dnech nebo pracovních hodinách kalendáře) nebo *Uplynulá doba trvání* (doba trvání se počítá v nepřetržitém čase, bez kalendáře). Lze upravit.
- **Jednotka doby trvání** — *Dny* nebo *Hodiny*. Lze upravit kromě souhrnného úkolu, překlenovacího úkolu a milníku. Přepnutí funguje jen tehdy, když je převod přesný a zapnuto *Zapnout plánování v hodinách*.
- **Doba trvání** — doba trvání úkolu v jednotce úkolu nebo podle *Zobrazení doby trvání*. Lze upravit: zadejte `5d`, `12h` nebo `1h 30m`; také číslo v jednotce úkolu. Jen pro čtení u souhrnného úkolu, překlenovacího úkolu a milníku s dobou trvání 0.
- **Zahájení** — zobrazené zahájení, stejné datum jako pruh v diagramu Gantt. Lze upravit. Úkol s předchůdcem, kterému dáte nové zahájení, dostane na tomto datu omezení *Zahájit nejdříve (SNET)*. Jen pro čtení u souhrnného úkolu nebo překlenovacího úkolu, pokud není ručně plánován.
- **Dokončení** — zobrazené dokončení. Lze upravit: nové dokončení se stane novou dobou trvání. Aplikace to odmítne u dokončeného úkolu, milníku, úkolu v uplynulé době trvání a úkolu s mezerami v rozdělení. Odmítne také dokončení před zahájením (*Dokončení je před zahájením.*). Jen pro čtení u souhrnného úkolu nebo překlenovacího úkolu, pokud není ručně plánován.
- **Plánované zahájení** — kotva plánování, ze které výpočet začíná (nemusí být totožná se zobrazeným zahájením). Lze upravit; účinek je stejný jako přímé zapsání hodnoty do sloupce *Zahájení*.
- **Plánované dokončení** — zadané dokončení. Lze upravit jen u ručně plánovaného úkolu; jinak aplikace napíše *Plánované dokončení platí jen pro ručně plánovaný úkol. Změňte dokončení ve sloupci Dokončení nebo změňte dobu trvání.*

## Omezení

- **Typ omezení** — typ omezení, od *Co nejdříve (ASAP)* až po *Musí skončit (MFO)*. Lze upravit; úkol bez omezení zobrazí *ASAP*.
- **Datum omezení** — datum omezení. Lze upravit.
- **Pevné omezení** — příznak *Povinný (pevné ukotvení)*. Lze upravit jen u *MSO* a *MFO*.
- **Typ sekundárního omezení** — typ druhé hranice, nebo pomlčka. Lze upravit. Tabulka nabízí všechny typy, ale nepovolená kombinace se odmítne: sekundární omezení musí být *SNET*, *FNET*, *SNLT* nebo *FNLT*, primární omezení musí být hranice (ne *ASAP*, *ALAP*, *MSO*, *MFO* ani pevné omezení) a obě musí hranicí vymezovat opačné strany (dolní hranice *SNET*/*FNET* s horní hranicí *SNLT*/*FNLT*, nebo naopak).
- **Datum sekundárního omezení** — datum druhé hranice. Lze upravit.
- **Konečný termín** — cílové datum dokončení. Lze upravit.

## Závislosti

- **Předchůdci** — předchůdci, jako `WBS type±lag`, oddělení `; `, například `1.2 FS+2d`. Lze upravit psaním stejného tvaru. Vazbu mezi projekty zde nepřidáte, ale na kartě *Plán › Závislosti › Propojit › Přidat vazbu mezi projekty…*.
- **Následníci** — následníci ve stejném tvaru. Lze upravit.
- **Hnací vazba** — hnací vazby, které určují datum tohoto úkolu, jako `← 1.2` (předchůdce) nebo `→ 1.4` (následník). Jen pro čtení; zastaralé, dokud nestisknete *Přepočítat*.
- **Volná časová rezerva** (v kategorii *Závislosti*) — volná časová rezerva každé vazby, jako `← 1.2: 3d`. Nejde o stejný sloupec jako *Volná časová rezerva* v kategorii *Vypočítané*, který ukazuje rezervu samotného úkolu. Jen pro čtení.
- **Upozornění** — upozornění ke každé vazbě, například *Mimo pořadí* nebo *Nezahrnuto do výpočtu*. Jen pro čtení. Viz [Oznámení a upozornění](docs://ref-meldingen).

## Zdroje

- **Přiřazené zdroje** — názvy přiřazených zdrojů, oddělené čárkami. Lze upravit: přidáním názvu přiřadíte zdroj s 1 jednotkou za den, odebráním názvu se přiřazení zruší. Jen pro čtení u milníku nebo souhrnného úkolu.
- **Jednotky přiřazení za den** — jednotky na zdroj, jako `Name: 1; Name: 0.5`. Lze upravit u úkolu s přiřazeními.
- **Průběhová křivka přiřazení** — křivka na zdroj, jako `Name: Uniform`. Lze upravit u úkolu s přiřazeními.
- **Začátek pracovního okna** a **Dokončení pracovního okna** — pracovní okno na zdroj ze importovaného souboru, jako `Name: date`. Jen pro čtení.
- **Plánovaná práce (hodiny)** a **Skutečná práce (hodiny)** — plánovaná a skutečná práce na zdroj v hodinách, jako `Name: 12`, z importovaného souboru. Jen pro čtení.
- **Zbývající práce (hodiny)** — zbývající práce na zdroj v hodinách, jako `Name: 6`: uložená práce, jinak zbývající doba trvání × jednotky. Lze upravit u úkolu s přiřazeními, na které se uplatňuje pravidlo pevné veličiny. Ve výběru sloupců se zobrazí jen tehdy, když jsou pravidla viditelná.

## Průběh

- **Stav** — *Nezahájeno*, *Probíhá* nebo *Dokončeno*. Lze upravit kromě souhrnného úkolu.
- **Průběh** — procento, jako `40%`. Lze upravit číslem od 0 do 100, kromě souhrnného úkolu.
- **Skutečné zahájení** — datum, kdy úkol začal. Lze upravit kromě souhrnného úkolu.
- **Skutečné dokončení** — datum, kdy byl úkol dokončen. Lze upravit kromě souhrnného úkolu.
- **Skutečná doba trvání** — skutečná doba trvání jako číslo. Lze upravit kromě souhrnného úkolu.
- **Zbývající** — zbývající doba trvání v jednotce úkolu. Lze upravit kromě souhrnného úkolu.
- **Datum obnovení** a **Datum zastavení** — obnovení a zastavení běžícího úkolu ze souboru MS Project nebo Primavera. Jen pro čtení.

Sloupce průběhu se řídí pravidly průběhu v aplikaci: skutečné datum po datu stavu se odmítne. U souhrnného úkolu aplikace napíše *Průběh souhrnného úkolu se odvozuje z dílčích úkolů a zde se nedá měnit.*

## Vypočítané

Všechny sloupce v této kategorii jsou jen pro čtení.

- **Zpoždění vyrovnání** — o kolik pracovních dnů vyrovnání úkol zpozdilo; pomlčka, pokud se vyrovnání nepoužilo.
- **Nejdřívější zahájení** a **Nejdřívější dokončení** — nejdřívější data z výpočtu.
- **Pozdní zahájení** a **Pozdní dokončení** — nejpozdější data, kdy smí úkol ještě začít nebo skončit, aniž zpozdí projekt.
- **Volná časová rezerva** — počet pracovních dnů, o které může úkol sklouznout, aniž zpozdí následníka.
- **Celková časová rezerva** — počet pracovních dnů, o které může úkol sklouznout, aniž zpozdí dokončení projektu. Záporná, pokud nelze splnit omezení nebo konečný termín.
- **Kritický** — *Ano*, pokud je úkol na kritické cestě.
- **Rušivá časová rezerva** — celková časová rezerva minus volná časová rezerva.
- **Téměř kritický** — *Ano* u téměř kritického úkolu. Vyplní se jen tehdy, když je zapnuto *Označit téměř kritické* (*Info o projektu*, část *Profil výpočtu a možnosti výpočtu*); jinak pomlčka.
- **Cesta časové rezervy** — číslo cesty časové rezervy; 1 je nejkritičtější. Vyplní se jen tehdy, když je zapnuto *Více cest časové rezervy*; jinak pomlčka.
- **Zdroj zaznamenaných dat** — u souboru se zaznamenanými daty: *Odchyluje se* nebo *Částečně nezaznamenáno*. Ve výběru sloupců se zobrazí jen u takového souboru. U nezaznamenané osy se ve sloupcích pozdních termínů a rezerv zobrazí *Nezaznamenáno*.

Viz [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad).

## Směrný plán

U každého směrného plánu projektu se přidají sloupce. Název směrného plánu je před názvem sloupce (`<baseline> — Scheduled start`). Sloupce jsou jen pro čtení. Úkol, který ve směrném plánu není, ukáže pomlčku s popiskem *Není obsaženo v tomto směrném plánu*.

- **Plánované zahájení**, **Plánované dokončení** a **Doba trvání** — zahájení, dokončení a doba trvání tak, jak je směrný plán zaznamenal.
- **Odchylka zahájení** a **Odchylka dokončení** — počet pracovních dnů mezi směrným plánem a zobrazeným zahájením nebo dokončením, v kalendáři projektu; kladná, pokud je úkol později.
- **Odchylka doby trvání** — aktuální doba trvání minus doba trvání ve směrném plánu, v pracovních dnech.

## Vlastní

- **Kód aktivity** — jeden sloupec na každý kód aktivity, s názvem kódu. Zobrazí kód zvolené hodnoty. Lze upravit: zadejte kód nebo ho vyberte z návrhů; neznámý kód se odmítne. Pokud se kód vyskytuje vícekrát, aplikace vás požádá, abyste ho vybrali ze seznamu.
- **Vlastní pole** — jeden sloupec na každé vlastní pole, s jeho názvem. Vstup odpovídá typu: text, číslo, celé číslo, náklady, datum nebo ano/ne. Lze upravit.

Tyto sloupce patří k projektu, ve kterém je kód nebo pole. Viz [Kódy a vlastní pole](docs://howto-codes-en-velden).

## Technické

Všechny sloupce v této kategorii jsou jen pro čtení. Ukazují data, která aplikace ukládá, ale v běžném sloupci nezobrazuje, například pro kontrolu importu.

- **ID úkolu** — interní identifikátor úkolu.
- **ID nadřazeného úkolu** a **ID podřízených úkolů** — identifikátory nadřazeného a podřízených úkolů.
- **ID zdrojů** — identifikátory zdrojů u úkolu.
- **ID přiřazení**, **ID úkolu přiřazení** a **ID zdroje přiřazení** — identifikátory přiřazení, úkolů a zdrojů tohoto úkolu.
- **Doba trvání (minuty)** a **Zbývající (minuty)** — doba trvání a zbývající doba trvání v minutách; vyplní se jen u úkolu v hodinách.
- **Zpoždění vyrovnání (minuty)** a **Uplynulé zpoždění vyrovnání** — zpoždění vyrovnání z MS Project v minutách a informace, zda se počítá v nepřetržitém čase.
- **Ručně plánováno** — zda je úkol ručně plánován.
- **Typ úkolu MS Project (import)** a **Řízeno úsilím** — typ úkolu a příznak řízení úsilím tak, jak je měl MS Project.
- **Původ Primavera P6** — zdrojová pole ze souboru Primavera, jako `key: value`.
- **Výslovný souhrnný úkol** — zda je úkol výslovný souhrn bez dílčích úkolů (ze souboru Primavera).
- **Dolní mez dokončení po hodinách**, **Kotva zahájení po hodinách**, **Segmenty doby trvání po hodinách** a **Průběhové křivky po hodinách** — rozložení hodin ze souboru MS Project, jako data a počty.
- **Data kódů aktivit**, **Data vlastních polí** a **Data poznámek** — počet přiřazení kódů, vlastních polí a poznámek.
- **Data vnitřních závislostí** a **Data vazeb mezi projekty** — počet vnitřních závislostí a vazeb mezi projekty.
- U každého směrného plánu jsou tu také **Milník** a **Typ milníku**, tak, jak je směrný plán zaznamenal.
