# Import průběhu z tabulky

Cíl: vložit průběh, který pracovníci na stavbě vyplní v tabulce, do plánu najednou. Nemusíte klikat na každý úkol zvlášť.

## Kdy to potřebujete

Subdodavatel nebo stavbyvedoucí aplikaci nemá, ale stav hlásí každý týden: kolik procent je hotovo, kdy práce začala a kdy skončila. Pošlete mu list s vašimi úkoly. On vyplní tři sloupce a pošle list zpět. Z něj aplikace načte u každého úkolu jen tři hodnoty: procento dokončení, skutečné zahájení a skutečné dokončení. Zbytek vašeho plánu zůstane beze změny. Co aplikace s tímto průběhem dělá, je popsáno v [Průběh, datum stavu a směrný plán](docs://uitleg-voortgang).

## Postup

### 1. Nastavte datum stavu a přepočítejte

Nastavte datum stavu stejně, jak je popsáno v [Aktualizace průběhu](docs://howto-voortgang-bijwerken). Stavbyvedoucí vyplní skutečná data až do tohoto dne včetně. Pokud je plán neaktuální, aplikace ho přepočítá dřív, než se list vytvoří.

### 2. Vytvořte list

Zvolte na kartě *Plán › Průběh › Exportovat tabulku průběhu*. Stejné tlačítko je na kartách *Tabulka* a *Sestava*. Aplikace vytvoří soubor Excel a navrhne název *(název projektu)-průběh.xlsx*. V prohlížeči se soubor uloží do vašich stažených souborů. Dáváte přednost CSV? Zvolte na kartě *Soubor › Export › Tabulka průběhu (CSV)*. List Excel je k dispozici také, jako *Tabulka průběhu (Excel)*.

List má osm sloupců. Názvy sloupců zůstávají anglicky. Za každým názvem následuje krátký pokyn v jazyce aplikace:

- `OPS Task ID`, `WBS` a `Name` slouží jen k tomu, aby bylo možné úkol poznat. Nechte je beze změny.
- `Start` a `Finish` jsou plánovaná data, jen pro informaci. Aplikace je nikdy nezapisuje zpět.
- `Completion (%)`, `Actual Start` a `Actual Finish` vyplňujete vy.

List Excel je chráněn bez hesla. Upravit lze jen tři sloupce pro vyplnění. Excel kontroluje, že procento je mezi 0 a 100 a že skutečné datum je datum. Fáze (souhrnný úkol) je šedě označena textem *— souhrnný úkol: nevyplňujte*.

### 3. Nechte list vyplnit

U každého úkolu stavbyvedoucí vyplní:

- `Completion (%)`: 0 až včetně 100. V listu Excel jsou povolena desetinná čísla (například 33,3). Pokyn u CSV žádá celá čísla.
- `Actual Start` a `Actual Finish`: v Excelu jako datum podle vlastního regionálního nastavení; v CSV ve formátu dd-mm-rrrr.

Co zůstane prázdné, se nezmění. Prázdná buňka tedy neodstraní ani stávající průběh. To lze udělat jen v aplikaci. Úkol, který nezačal, nechá zcela prázdný.

### 4. Načtěte list

1. Zvolte na kartě *Plán › Průběh › Aktualizovat průběh z tabulky* (také na kartách *Tabulka* a *Sestava*), nebo na kartě *Soubor › Importovat › Aktualizovat průběh z tabulky*. Otevře se okno *Aktualizovat průběh z tabulky*.
2. Klikněte na *Vybrat soubor…* a zvolte vyplněný soubor `.xlsx` nebo `.csv`.
3. Jsou-li data v CSV nejednoznačná, aplikace se zeptá *Nejdřív den, nebo měsíc?* a ukáže datum z vašeho souboru přečtené oběma způsoby. Klikněte na datum, které je správné.
4. Nyní vidíte náhled. Nahoře jsou čtyři počítadla: *Použito*, *Beze změny*, *Čeká na propojení* a *Odmítnuto*. Pod nimi je u každého úkolu vidět, co se změní, například *Procento dokončení: 0% → 100%*.
5. Zkontrolujte náhled a klikněte na *Použít*. Okno ukáže *Výsledek*, počítadla a řádky, které byly odmítnuty, s důvodem. Dokončete tlačítkem *Zavřít*.

Náhled nelze přeskočit. Tlačítko *Použít* je neaktivní, dokud není co použít.

### 5. Přepočítejte plán

Načtení samo o sobě plán nepřepočítá. Stiskněte **Přepočítat** (F5), například na kartě *Plán › Plán › Přepočítat*, pokud není zapnuto *Automaticky přepočítat*.

## Řádky, které nelze jen tak zařadit

Aplikace propojí každý řádek s úkolem. Nejdřív podle `OPS Task ID`, jinak podle čísla WBS.

**Propojení je pochybné.** Pokud aplikace úkol našla jen podle čísla WBS, je řádek v části *Propojení je pochybné* s tlačítky *Potvrdit* a *Změnit*. Řádek se použije i tehdy, když neuděláte nic. Proto zkontrolujte, že je úkol správný. *Potvrdit* odebere řádek z tohoto seznamu. Nic nemění na tom, co se použije. *Změnit* umožní zvolit jiný úkol. Tlačítkem *Zrušit propojení* odstraníte propojení, které jste vytvořili sami. Poznámka: list z jiného projektu se stejnými čísly WBS se přesto propojí, a to v části *Propojení je pochybné*, a použije se, až kliknete na *Použít*.

**Čeká na propojení.** Pokud aplikace nenašla žádný úkol, nebo jich bylo více se stejným číslem WBS, je řádek v části *Čeká na propojení*. U položky *Vyberte úkol…* zvolte správný úkol. Vyhledáte jej podle čísla WBS nebo podle názvu. Pokud řádek nepropojíte, bude odmítnut.

## Úskalí a co aplikace dělá

Řádek, který nesedí, je odmítnut s důvodem. Zbytek listu se zpracuje dál. Toto jsou hlavní hlášení:

- *Skutečné datum je po datu stavu.* Nastavte datum stavu později, nebo list opravte.
- *Tento úkol podle plánu začíná až po datu stavu. Nejprve v listu vyplňte jeho skutečné zahájení.* Aplikace si začátek nevymýšlí. Doplňte jej do listu.
- *Procento je mimo rozsah 0–100. Zkontrolujte desetinný oddělovač: 8,38 může tabulkový procesor s jiným nastavením jazyka načíst jako 838.*
- *Souhrnné úkoly nemohou z listu získat průběh.* Průběh fáze vyplyne z úkolů, které jsou pod ní.
- *Skutečné dokončení je před skutečným zahájením.*
- *Nečitelné datum.* a *Nečitelné procento.*
- *Zadané hodnoty si odporují.* Například skutečné dokončení s procentem nižším než 100.
- *Pro tento řádek nebyl nalezen žádný úkol.* List uvádí ID úkolu a číslo WBS, které se v tomto projektu nevyskytují.
- *Tento kód WBS se vyskytuje u více úkolů. Propojte řádek ručně.*
- *Jiný řádek již tento úkol obsadil.* Dva řádky ukazují na stejný úkol.
- *Odmítnuto plánovačem.* Jiné odmítnutí od samotného plánovače, bez vlastního hlášení.

Pokud je odmítnut celý soubor, objeví se v okně jedno z těchto hlášení: *Tento soubor nemá sloupec „OPS Task ID“ ani „WBS“, podle kterého by bylo možné řádky propojit s úkoly.*, *Tento soubor nemá žádný ze sloupců Procento dokončení, Skutečné zahájení nebo Skutečné dokončení.*, *Tento soubor je příliš velký na čtení jako list s průběhem.* (více než 16 MB), *Tento soubor má příliš mnoho řádků na čtení jako list s průběhem.* (více než 50 000 řádků) nebo *Tento soubor je chráněn heslem a nelze jej přečíst.* nebo *Tento soubor nešlo přečíst jako list s průběhem.*

**Žádné datum stavu.** Pokud datum stavu ještě není nastaveno a import použije průběh, aplikace nastaví dnešní datum a upozorní vás na to. Nastavte datum stavu proto nejdřív sami.

**Vše zpět jedním krokem.** Celý list je pro Ctrl+Z jeden krok.

**Jen to, co vyplníte.** Řádek bez rozdílu oproti plánu se počítá jako *Beze změny*. Úkol bez řádku v listu zůstane beze změny.

## Viz také

- [Průběh, datum stavu a směrný plán](docs://uitleg-voortgang): co aplikace vypočítá ze skutečných dat a procent.
- [Aktualizace průběhu](docs://howto-voortgang-bijwerken): zadání průběhu přímo v aplikaci.
