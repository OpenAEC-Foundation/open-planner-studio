# Vytvoření a použití rozložení

Cíl: přepínat mezi zobrazeními vašeho plánu jedním kliknutím, například jen kritické úkoly, úkoly podle čet nebo jiné pořadí řazení.

## Kdy to potřebujete

Na stavební poradě chce klient vidět jen kritické úkoly. Potom chce vedoucí stavby podle čet vidět, kdo je kdy potřeba. Potom chcete znovu celý plán. Znovu a znovu nastavovat filtry, seskupení a pořadí řazení je zdlouhavé. **Rozložení** uloží takové zobrazení jako tlačítko na pásu karet.

Rozložení může uložit šest věcí: filtr, seskupení, řazení, sloupce tabulky úkolů vedle diagramu Gantt, časovou osu, čáry závislostí a překryvy (směrný plán, čára průběhu, čára data stavu, zvýraznění zdrojů, pásmo časové rezervy a barvy pruhů). Při kliknutí na tlačítko se změní jen to, co zaškrtnete. Zbytek vašeho zobrazení zůstane beze změny.

Filtrujete, seskupujete a řadíte pomocí rozložení. Samostatná tlačítka *Filtr…*, *Seskupit…* a *Řadit…* existují teď jen za skrytým nastavením (viz část Úskalí).

## Postup

### Použití existujícího rozložení

1. Zvolte kartu *Zobrazení*. Ve skupině *Rozložení* je tlačítko pro každé rozložení. Ve výchozím stavu je to *Diagram zdrojů*.
2. Klikněte na něj. *Diagram zdrojů* seskupí úkoly podle zdrojů, v každé skupině je seřadí podle začátku a vypne čáry závislostí. Úkol se dvěma zdroji se zobrazí pod oběma.
3. Klikněte znovu, tím rozložení vypnete. Zobrazení se vrátí do stavu před vaším kliknutím.

Každé kliknutí je jeden krok pro *Vrátit zpět* (Ctrl+Z), a to zapnutí i vypnutí.

### Vytvoření vlastního rozložení

1. Ve skupině *Rozložení* klikněte na *Nové rozložení*. Otevře se okno *Nové rozložení*.
2. Zadejte *Název* a v poli *Ikona* zvolte ikonu.
3. Pod nadpisem *Co toto rozložení ukládá?* jsou šest částí, každá se zaškrtávacím polem. Nové okno začíná se všemi částmi zaškrtnutými a naplněnými tím, co je teď na obrazovce. Odškrtněte vše, co rozložení nesmí měnit. Pokud chcete jen filtr, nechte zapnutý pouze *Filtr*. Tlačítko *Převzít aktuální zobrazení* znovu naplní všechny části tím, co je na obrazovce.
4. Nastavte jednotlivé části.
5. Klikněte na *Uložit*.

Rozložení je teď tlačítko na pásu karet, ale ještě se nepoužije. Klikněte na tlačítko, tím ho zapnete.

### Nastavení filtru

V části *Filtr* vytváříte pravidla. Klikněte na *+ pravidlo* a v něm zvolte *Pole*, *Operátor* a hodnotu. Chcete-li jen kritické úkoly, nastavte pole *Kritický*, operátor *je rovno* a hodnotu *Ano*. Mezi pole patří *Název úkolu*, *Zahájení*, *Dokončení*, *Celková časová rezerva*, *Průběh* a *Milník*, dále vaše vlastní kódy aktivit a pole a také *Zdroje*. Operátory závisí na druhu pole: u textu můžete zvolit *obsahuje*, u čísel a dat *mezi*.

Jaké operátory dostanete, závisí na druhu pole:

- Text (*Název úkolu*, *WBS*): *je rovno*, *není rovno*, *obsahuje*, *začíná na* a *je prázdné*.
- Číslo a datum (*Celková časová rezerva*, *Zahájení*, *Průběh*): *je rovno*, *není rovno*, *menší než*, *menší nebo rovno*, *větší než*, *větší nebo rovno*, *mezi* a *je prázdné*. U *mezi* jsou dvě pole: u čísla s nápovědou *Od* a *Do*, u data bez nápovědy (první datum je zahájení, druhé dokončení).
- Ano/ne (*Kritický*, *Milník*, *Téměř kritický*): *je rovno* a *není rovno*, s hodnotou *Ano* nebo *Ne*.
- Výběr (*Typ*, kód aktivity): *je rovno*, *není rovno*, *je jedno z* (s hodnotami se zaškrtávacími políčky) a *je prázdné*.
- *Zdroje*: *je jedno z* a *je prázdné*.
- *Probíhá*: jen *mezi*, se dvěma daty (od a do).

S polem *Probíhá*, operátorem *mezi* a dvěma daty dostanete všechny úkoly, které v tom období běží v kterémkoli okamžiku, například vše aktivní v červnu.

Několik pravidel spojíte pomocí seznamu nahoře: *Všechny níže (AND)* zobrazí úkoly, které splňují všechna pravidla, *Kterékoli níže (OR)* úkoly, které splňují alespoň jedno pravidlo. Tlačítkem *+ skupina* přidáte podskupinu s vlastními pravidly.

Filtr se dívá na samotné úkoly. Fáze (souhrnné úkoly), pod které takový úkol spadá, zůstanou vidět šedě, takže uvidíte, kam úkol patří. Pokud také seskupíte, tyto šedé fáze zmizí.

### Seskupení a řazení

V části *Seskupit* přidáte pole pomocí *+ úroveň*. Úrovně seskupení jsou nejvýše dvě. Bez seskupení vidíte strom WBS. V části *Řadit* přidáte pole pomocí *+ úroveň* a zvolíte *Vzestupně* nebo *Sestupně*. Při dvou úrovních rozhoduje druhá úroveň, když jsou hodnoty na první úrovni stejné.

### Rychlé vyzkoušení bez tlačítka

V okně klikněte na *Použít bez uložení*. Zaškrtnuté části se hned použijí na obrazovce, ale žádné tlačítko se nepřidá. To se hodí pro filtr, který potřebujete jen jednou. Ctrl+Z to zruší.

### Změna, kopírování a odstranění rozložení

Klikněte pravým tlačítkem na tlačítko rozložení. Zvolíte *Upravit…*, *Duplikovat* nebo *Odstranit*. *Odstranit* nejdřív požádá o potvrzení. Kopie se jmenuje *název (kopie)*. Vestavěné rozložení, například *Diagram zdrojů*, nelze upravit ani odstranit. Zduplikujete je a vytvoříte si vlastní verzi.

### Více rozložení najednou

Rozložení, která neukládají stejné části, mohou být zapnutá současně. Pokud máte rozložení, které ukládá jen filtr *Kritický je rovno Ano* (nazvěte ho například *Jen kritické*), a zapnete ho spolu s rozložením *Diagram zdrojů* (seskupení, řazení, čáry závislostí), dostanete kritické úkoly podle zdrojů. Pokud dvě rozložení ukládají stejnou část, například filtr, druhé ji převezme a první se vypne. Když to druhé rozložení znovu vypnete, vrátíte se do zobrazení z doby před prvním kliknutím, ne k prvnímu rozložení.

## Úskalí a co dělá aplikace

**Zapomenete odškrtnout části.** Rozložení, které ukládá i sloupce, časovou osu a překryvy, je při každém kliknutí vrátí do uloženého stavu. Vaše přiblížení se pak změní, i když jste chtěli jen filtr. Zkontrolujte v okně, že jsou zaškrtnuté jen části, které chcete.

**Nedokončené pravidlo nic nezobrazí.** Pokud u pole ano/ne nezvolíte hodnotu (stále je tam *—*), nebo necháte prázdná data u pole *Probíhá*, žádný úkol nevyhovuje a seznam zůstane prázdný. Pravidlo dokončete.

**Ruční změna vypne rozložení.** Když sami změníte část, kterou rozložení ukládá, například *Čáry závislostí*, zatímco je zapnutý *Diagram zdrojů*, toto rozložení vypadne a ostatní části se vrátí do zobrazení z doby před rozložením. Přibližování vypne rozložení, které ukládá časovou osu, a rozšíření sloupce vypne rozložení, které ukládá sloupce. Zbytek zobrazení zůstane beze změny. *Diagram zdrojů* časovou osu neukládá, takže přibližování na něj nemá vliv.

**Sloupce platí pro tabulku úkolů vedle diagramu Gantt.** Část *Sloupce* ukládá sloupce tabulky vlevo od časové osy. Tabulka na kartě *Tabulka* si ponechá vlastní sloupce. Výběr sloupců je popsán v článku [Úprava sloupců tabulky](docs://howto-tabelkolommen-aanpassen).

**Odsazení úkolů je vypnuté.** Dokud je zapnutý filtr, seskupení nebo řazení, není zobrazené pořadí stejné jako pořadí v plánu. *Zvětšit odsazení* a *Zmenšit odsazení* jsou pak vypnuté a nápověda u nich říká *Není k dispozici při filtrování, seskupování nebo řazení*. Chcete-li strukturu znovu upravit, vypněte rozložení, jak je popsáno v článku [Úprava struktury](docs://howto-structuur-aanpassen).

**Stavový řádek se nemění podle zobrazení.** *Úkoly:* ve stavovém řádku ukazuje počet úkolů celého projektu, i když filtr zobrazí jen jejich část.

**Rozložení jsou ve vašem zařízení, ne v projektu.** Aplikace uchovává vaše rozložení a sloupce pro všechny vaše projekty na tomto zařízení. Překryvy z rozložení (směrný plán, čára průběhu a další) platí pro všechny vaše projekty. Filtr, seskupení a řazení, která jsou právě zapnutá, patří k otevřenému projektu, ale nejdou do souboru projektu. Po uložení a novém otevření projektu je zobrazení opět čisté. Také neoznačí projekt jako „změněný“.

**Samostatná tlačítka jsou skrytá.** *Sloupce…*, *Filtr…*, *Seskupit…* a *Řadit…* jako samostatná tlačítka na kartě *Zobrazení* jsou starý způsob zobrazení. Vrátíte je volbou *Zobrazit klasická tlačítka zobrazení* v části *Starší funkce* na kartě *Pokročilé* v okně nastavení (⚙ v záhlaví okna). Dávejte přednost rozložením.

## Viz také

- [Úprava sloupců tabulky](docs://howto-tabelkolommen-aanpassen): výběr, přesouvání a připínání samotných sloupců.
- [Vytvoření a tisk sestavy](docs://howto-rapport-maken-en-afdrukken): přenesení zobrazení na papír pomocí *Sledovat zobrazení*.
- [Úprava struktury](docs://howto-structuur-aanpassen): proč nelze při filtrování zvětšit odsazení.
