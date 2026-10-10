# Nastavení kalendáře zdroje

Cíl: zaznamenat, ve kterých dnech je zdroj k dispozici, aby s ním histogram, přetížení a vyrovnání vypočítávaly.

## Kdy to potřebujete

Parta zedníků pracuje jen od pondělí do čtvrtka. Jeřáb je v prvních dvou týdnech srpna na jiném projektu. Subdodavatel má čtyři pevné pracovní dny. Bez vlastního kalendáře aplikace předpokládá, že zdroj pracuje ve dnech projektového kalendáře.

Kalendář zdroje nemění vůbec žádné datum úkolu. Určuje jen, kdy je zdroj k dispozici. Je-li úkol naplánován na den, v němž zdroj nepracuje, je kapacita toho dne 0 a den se počítá jako přetížení. Pokud chcete, aby úkol běžel v jiné dny, dejte úkolu vlastní kalendář ([Vytvoření kalendáře a jeho přiřazení](docs://howto-kalender-maken-en-toewijzen)). Rozdíl popisuje článek [Kalendáře a pracovní dny](docs://uitleg-kalenders).

## Postup

### Vytvoření nového kalendáře zdroje

1. Zvolte *Zdroje › Správa › Zdroje*. Otevře se panel zdrojů. Pokud zdroj ještě neexistuje, vytvořte ho pomocí *Nový zdroj v projektu*.
2. Najděte řádek zdroje. Ve sloupci *Kalendář* je výchozí hodnota *Projektový kalendář*: zdroj pak sleduje projektový kalendář.
3. V tomto seznamu zvolte *+ Kalendář zdroje*. Otevře se okno *Kalendář zdroje*. Má stejná pole jako formulář kalendáře: *Název*, *Pracovní dny*, pracovní doby a *Svátky*. Nový kalendář začne jako kopie standardního kalendáře a jmenuje se *Kalendář zdroje*.
4. Dejte kalendáři název, který se hodí ke zdroji, například *Crew Mon–Thu*, a nastavte pracovní dny: klikněte na pátek pod *Pracovní dny* a vypněte ho. Svátky nebo odstávky zadejte do seznamu *Svátky* pomocí *Přidat svátek*.
5. Klikněte na *Použít*. Kalendář je nyní v knihovně projektu a propojen se zdrojem, a to v jednom kroku, který vrátíte tlačítkem *Vrátit zpět*. Pomocí *Zrušit* se nic nevytvoří.

### Výběr nebo úprava existujícího kalendáře

Ve sloupci *Kalendář* zvolte kalendář ze seznamu. Položka *Projektový kalendář* odstraní vlastní kalendář zdroje. Pokud chcete zvolený kalendář upravit, klikněte na tužku vedle seznamu (*Upravit…*). Otevře se okno *Kalendář zdroje* s aktuálním kalendářem.

### Kontrola výsledku

1. Pokud stavový řádek ukazuje *Zastaralé — přepočítejte (F5)*, stiskněte **Přepočítat** (F5).
2. Zvolte *Zdroje › Histogram › Histogram* a klikněte na zdroj v seznamu vlevo od histogramu. Dny, kdy zdroj nepracuje, ale je naplánován, jsou červeně označeny. Když nad některým z nich podržíte kurzor myši, pruh zobrazí například *Podle kalendáře „Crew Mon–Thu“ v tento den nepracuje*.
3. Na kartě *Zdroje › Přetížení* je počet zdrojů s přetížením. Stavový řádek zobrazí například *Přetížení zdrojů: 1*.

## Úskalí a co aplikace potom udělá

**Počítají se jen dny, ne hodiny.** Kalendář zdroje určuje, ve kterých dnech zdroj pracuje. Kolik jednotek přiřazení je ten den k dispozici, plyne z pole *Maximální počet jednotek* zdroje, ne z pracovních dob v kalendáři.

**Vyrovnání ne vždy tento problém vyřeší.** Když neexistuje žádné období, v němž každý den úkolu připadá na pracovní den zdroje, posun nepomůže. Zvolte *Zdroje › Vyrovnání › Vyrovnat…* a klikněte na *Přepočítat*. Úkol je pak pod položkou *Zbývající konflikty* s důvodem *Zdroj nepracuje ve všech dnech, které tento úkol potřebuje — posun tento problém nevyřeší*. Potom přiřaďte úkol jinému zdroji, nebo mu dejte vlastní kalendář.

**Sdílený kalendář.** Seznam ukazuje všechny kalendáře projektu, tedy i projektový kalendář a kalendáře úkolů. Když takový kalendář upravíte tužkou, změní se i plán úkolů, které ho používají, a stavový řádek zobrazí *Zastaralé — přepočítejte (F5)*. Raději vytvořte pro zdroj vlastní kalendář.

**Přetížení nemusí být vždy kvůli kalendáři.** Zdroj, který pracuje každý den, může být také přetížen. Popisek zmíní kalendář jen tehdy, když den není pracovním dnem zdroje.

## Viz také

- [Kalendáře a pracovní dny](docs://uitleg-kalenders): proč kalendář zdroje nemění žádné datum úkolu.
- [Vytvoření kalendáře a jeho přiřazení](docs://howto-kalender-maken-en-toewijzen): pole formuláře kalendáře.
- [Generování svátků a letní stavební uzávěry](docs://howto-feestdagen-genereren): zadávání svátků a odstávek do kalendáře.
- [Okna kalendáře](docs://ref-kalenders): všechna pole oken kalendáře.
