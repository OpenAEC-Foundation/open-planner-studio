# Nastavení pracovní doby

Cíl: zaznamenat pro každý den v týdnu, v kolik hodin kalendář pracuje, aby úkoly v hodinách probíhaly ve správný čas.

## Kdy to potřebujete

Pátecí odpoledne je volno. Parta pracuje ve dvou směnách od 06:00 do 22:00. Je tu i noční parta. Přestávka je kratší než hodina. Pokud plánujete jen ve dnech, stačí *Začátek (hodina)*, *Dokončení (hodina)* a přestávka ([Vytvoření kalendáře a jeho přiřazení](docs://howto-kalender-maken-en-toewijzen)). Pokud plánujete úkoly v hodinách, aplikace počítá pracovní minuty v rámci **bloků pracovní doby** kalendáře. V aplikaci se tyto bloky jmenují *blok*: blok je souvislý úsek pracovní doby v jednom dni v týdnu a mezera mezi dvěma bloky je přestávka. Co to znamená pro váš plán, popisuje [Dny a hodiny](docs://uitleg-dagen-en-uren).

Abyste běžnému kalendáři přidali bloky pracovní doby, potřebujete *Zapnout plánování v hodinách* ([Zapnutí plánování v hodinách](docs://howto-urenplanning-aanzetten)). Pokud kalendář bloky už má, například ze souboru MS Project, je sekce *Pracovní hodiny* vždy vidět a bloky můžete měnit i při vypnutém plánování v hodinách.

## Postup

### Výběr předvolby směn

1. Zvolte na kartě *Plán › Kalendář › Kalendář* a vlevo vyberte kalendář.
2. V sekci *Pracovní hodiny* klikněte na předvolbu. Nahradí pracovní dny a pracovní dobu kalendáře.
3. Klikněte na *Použít*.

Každá předvolba udělá toto:

- *Denní směna*: od pondělí do pátku od 08:00 do 16:00 bez přestávky. Tím se kalendář změní zpět na běžný kalendář bez bloků pracovní doby.
- *2 směny*: od pondělí do pátku od 06:00 do 14:00 a od 14:00 do 22:00, celkem 16 hodin.
- *3 směny*: od pondělí do pátku tři směny: od 06:00 do 14:00, od 14:00 do 22:00 a od 22:00 do 06:00 následujícího dne, celkem 24 hodin.
- *Noční směna*: od pondělí do pátku od 22:00 do 06:00 následujícího dne, 8 hodin.
- *24/7*: všech sedm dní od 00:00 do 24:00.

### Nastavení pracovní doby podle dne v týdnu

1. V sekci *Pracovní hodiny* klikněte na *Nastavit po dnech…*. Pod tlačítky se pro každý den objeví řádek s pracovní dobou toho dne. Kalendář teď má bloky pracovní doby pro každý den. Pokud kalendář bloky už má, je tento přehled otevřen hned; tlačítko se pak jmenuje *Skrýt pracovní hodiny* a přehled sbalí.
2. Upravte začátek a konec každého bloku ve dvou časových polích. Zadejte čas a stiskněte Enter, nebo použijte šipky (jeden krok je 15 minut). Pole se řídí nastavením *Formát času*; *13:00* i *1:00 PM* fungují.
3. Pokud chcete zařadit přestávku, klikněte pro daný den na **+** (*Přidat blok*) a upravte časy bloků tak, aby mezi nimi byla mezera. Nový blok začíná v 08:00 a končí v 16:00.
4. Blok, který běží přes půlnoc, zaškrtněte volbou *následující den*. Blok se počítá do dne, ve kterém začíná.
5. Kliknutím na koš za blokem jej odstraníte. Den bez bloků se zobrazí jako *Nepracovní*.
6. U dne od pondělí do pátku klikněte na symbol kopírování (*Kopírovat na pracovní dny*), aby se bloky tohoto dne zkopírovaly na pondělí až pátek.
7. Nad sekcí *Pracovní hodiny* je *Standardní pracovní den*: pracovní doba za den, kterou aplikace odvozuje z bloků a podle které počítá. Číslo se změní ihned, když změníte bloky. Pokud kalendář má vlastní hodiny za den (například z Primavera P6), zachová se tato vlastní hodnota a přenese se při exportu, dokud ji nenahradí předvolba. Pokud se tato vlastní hodnota liší od *Standardní pracovní den*, pod číslem se objeví oranžové hlášení, například: *Soubor má vlastní pracovní den o délce 8 h. Ten se zachová při exportu do MS Project a P6. Tam se jeden den počítá jako 8 h, zde jako 10 h.* Hlášení zmizí, jakmile bloky dají stejný součet za den, nebo když předvolba nahradí vlastní hodnotu. Hlášení nemění výpočet. Klikněte na *Použít*.

**Příklad: volné páteční odpoledne.** Klikněte na *Nastavit po dnech…*. U *Pá* odstraňte druhý blok (13:00 až 16:00). Pátek má teď 5 hodin, ostatní dny 8. *Standardní pracovní den* zůstává 8 hodin.

### Uložení vlastní předvolby

1. Klikněte na *Uložit jako předvolbu…* a do pole *Název vlastní předvolby* zadejte název.
2. Klikněte na *Uložit*. Předvolba je teď mezi ostatními předvolbami a můžete ji použít v libovolném projektu. Křížkem vedle ní ji zase odstraníte.

Vlastní předvolba se ukládá na tomto zařízení, ne do projektového souboru.

## Úskalí a co aplikace potom udělá

**Předvolba nahradí všechno.** Když zvolíte předvolbu, zmizí pracovní dny a pracovní doba, které jste dříve nastavili. Svátky zůstanou.

**Tlačítka dnů mění bloky.** Když den pod *Pracovní dny* vypnete, bloky tohoto dne zmizí. Když ho znovu zapnete, dostane zpět bloky, které měl, když jste dialog otevřeli (nebo po poslední předvolbě). Jinak dostane bloky prvního pracovního dne. *Po–Pá* udělá totéž pro pondělí až pátek a odstraní bloky soboty a neděle. *Nepřetržitě (24/7)* nahradí všechny bloky: každý den dostane 00:00 až 24:00.

**Úprava pracovní doby při vypnutém plánování v hodinách.** Kalendář s bloky pracovní doby si zachová sekci *Pracovní hodiny*, i když vypnete plánování v hodinách. Bloky tam jednoduše změníte. Když zvolíte *Denní směna*, kalendář se změní zpět na běžný kalendář s poli *Začátek (hodina)*, *Dokončení (hodina)* a přestávkou. Bloky pak lze vrátit jen se zapnutým plánováním v hodinách.

**Žádná použitelná pracovní doba.** Kalendář bez bloků nebo bez pracovních dnů nelze pro úkol v hodinách použít. Aplikace pak hlásí *Tento kalendář nemá platné pracovní hodiny. Zkontrolujte pracovní dny a pracovní hodiny.*

## Viz také

- [Dny a hodiny](docs://uitleg-dagen-en-uren): jak aplikace počítá pracovní hodiny a odvozuje standardní pracovní den.
- [Zapnutí plánování v hodinách](docs://howto-urenplanning-aanzetten): plánování úkolu v hodinách.
- [Kalendáře a pracovní dny](docs://uitleg-kalenders): který kalendář platí pro který úkol.
- [Okna kalendáře](docs://ref-kalenders): všechna pole oken kalendáře.
