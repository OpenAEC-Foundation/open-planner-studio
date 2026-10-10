# Dny a hodiny

Úkol na 2 dny a úkol na 16 hodin vypadají stejně, ale aplikace je přepočítává jinak. Proč můžete vybírat mezi dny a hodinami? A co se stane, když je úkol v hodinách navázán na úkol ve dnech? V tomto článku se dozvíte, jak aplikace počítá dny a hodiny a kde zaokrouhluje. Příklad ukazuje čísla.

## Pojem

**Úkol ve dnech** má dobu trvání v celých pracovních dnech, například `5d`. Zabírá celé pracovní dny. Ve standardním kalendáři má datum zahájení a datum dokončení bez času.

**Hodinový úkol** má dobu trvání v pracovních hodinách, například `12h` nebo `1h 30m`. Má zahájení a dokončení s časem, například úterý 11:00.

Jednotka patří úkolu, ne projektu. V jednom plánu můžete kombinovat úkoly ve dnech a hodinové úkoly. Tomu se říká **smíšené plánování**.

Hodiny použijete pro práci, která se nevejde do celých dnů: jeřáb, který si pronajmete na dvanáct hodin, betonáž o šesti hodinách, nebo úkol, který může začít až po obědě. Pro všechno ostatní stačí dny a je to přehlednější.

**Plánování v hodinách** je ve výchozím stavu vypnuté. Dokud je vypnuté, aplikace pracuje ve dnech. Pokud soubor plánování v hodinách přesto obsahuje, například úkoly v hodinách, aplikace zobrazí *Tento soubor obsahuje plánování v hodinách.* Tyto úkoly se stále přepočítávají, ale dobu trvání můžete upravit až po zapnutí plánování v hodinách.

## Jak aplikace přepočítává

### Pracovní doby a čisté hodiny

Každý kalendář má pro každý pracovní den **bloky pracovní doby** (v aplikaci se jmenují *pásma*). Standardní kalendář má 07:00 až 12:00 a 13:00 až 16:00. Mezera je přerušení práce. Aplikace odvodí tyto bloky z hodnot *Začátek (hodina)*, *Dokončení (hodina)* a přerušení práce kalendáře. Nemusíte pro to nic nastavovat. Pokud nastavíte vlastní bloky pro každý den v týdnu, mají přednost.

**Čisté hodiny za den** jsou součet bloků jednoho pracovního dne. Pokud se pracovní dny délkou liší, platí nejčastější denní součet. Při shodě platí nejvyšší součet. Při čtyřech dnech po 8 hodinách a pátku s 5 hodinami jsou čisté hodiny za den tedy 8.

### Úkol v hodinách

Aplikace počítá pracovní minuty od začátku, přes bloky pracovní doby. Přerušení práce, večery, víkendy a svátky se nepočítají. Úkol o době 12 hodin se proto nevejde do jednoho pracovního dne o 8 hodinách. Pokračuje do dalšího dne.

### Úkol ve dnech

Aplikace počítá celé pracovní dny. Hodiny za den nehrají roli. Úkol o době 5 dnů se dokončí ve stejný den, ať má kalendář 6, nebo 8 hodin za den.

### Převod dnů a hodin

Jeden den je čistý počet hodin za den v kalendáři úkolu. Aplikace to používá na třech místech:

- Pro *Zobrazení doby trvání*. V nabídce *Nastavení › Projekt › Nastavení*, na kartě *Zobrazení*, zvolíte *Automaticky (vlastní jednotka každého úkolu)*, *Vždy dny* nebo *Vždy hodiny*. Úkol o 18 hodinách se při *Vždy dny* zobrazí jako `2.25d(18h)`: vlastní jednotka zůstane v závorce.
- Pro prodlevu v hodinách za úkolem ve dnech (viz *Zaokrouhlování*).
- Když přepnete jednotku úkolu. Aplikace pak počítá dny od začátku úkolu, každý den s vlastními hodinami, a navrhne změnu jen tehdy, když je výsledek přesný. Dva dny se změní na `16h`. V kalendáři, kde má pátek 5 hodin, se 5 dnů od pondělí změní na `37h`. Dvanáct hodin nelze převést na celé dny v kalendáři s dny po 8 hodinách: aplikace pak jednotku nechá beze změny.

### Úkoly ve dnech a hodinové úkoly dohromady

Pravidla níže platí pro závislost dokončení-zahájení v kalendáři bez vlastních bloků pracovní doby, například ve standardním kalendáři.

- **Hodina → hodina.** Následník začíná ve chvíli, kdy se předchůdce dokončí, i když je to uprostřed dne.
- **Hodina → den.** Úkol ve dnech nikdy nezačíná uprostřed dne. Začíná prvním pracovním dnem po dni, kdy se hodinový úkol dokončí. Zbytek toho dne zůstane nevyužitý a vrátí se jako časová rezerva hodinového úkolu.
- **Den → hodina.** Úkol ve dnech zabírá celý svůj poslední den. Hodinový úkol začíná prvním pracovním dnem po něm, na začátku prvního bloku pracovní doby.

### Zaokrouhlování

Aplikace zaokrouhluje, nebo odmítne, na čtyřech místech:

- **Úkol ve dnech za hodinovým úkolem** začíná dalším pracovním dnem. Hodinový úkol se tak jakoby zaokrouhlí nahoru na celé dny.
- **Prodleva v hodinách** se počítá v kalendáři prodlevy, standardně v kalendáři předchůdce. Když je předchůdce úkol ve dnech v kalendáři bez vlastních bloků pracovní doby, například ve standardním kalendáři, aplikace převede prodlevu na celé pracovní dny: prodleva vydělená čistými hodinami za den, zaokrouhlená na celé číslo; půl dne se zaokrouhlí nahoru. Při 8 hodinách za den se 1 hodina počítá jako 0 dnů, 4 hodiny jako 1 den a 12 hodin jako 2 dny. To platí i tehdy, když je následník hodinový úkol. Když je předchůdce hodinový úkol, nebo má jeho kalendář vlastní bloky pracovní doby, prodleva se počítá přesně v pracovních hodinách a přerušení práce se nepočítá.
- **Doba trvání ve dnech** je vždy celé číslo. Když zadáte `1.5d`, aplikace zobrazí *Zadejte celé číslo dnů nebo hodin, například 2d nebo 12h.* Doba trvání v hodinách může být `1.5h`, nebo `1h 30m`.
- **Přepnutí jednotky** proběhne jen tehdy, když je výsledek přesný (viz výše).

## Příklad: jeřáb

Kalendář platí od pondělí do pátku od 07:00 do 12:00 a od 13:00 do 16:00: 8 čistých hodin za den. Zahájení projektu je v pondělí 7. června 2027.

### Hodina, hodina a den

*Osazení jeřábu* trvá 12 hodin. Pondělí má 8 pracovních hodin (5 do 12:00 a 3 po přerušení práce) a úterý zbylé 4 hodiny. Úkol běží od pondělí 07:00 do **úterý 8. června 11:00**.

*Seřízení prvků* trvá 8 hodin a navazuje závislostí dokončení-zahájení. Začíná hned v úterý v 11:00: je to 1 hodina do přerušení práce a 3 hodiny po něm. Poslední 4 hodiny připadnou na středu od 07:00 do 11:00. Dokončení je **středa 9. června 11:00**.

*Finishing* trvá 2 dny a navazuje na *Seřízení prvků*. Úkol ve dnech nezačíná uprostřed dne, proto začíná **ve čtvrtek 10. června** a dokončí se v pátek 11. června.

### Zaokrouhlení při přechodu

Když vynecháte *Seřízení prvků* a *Finishing* navážete přímo na *Osazení jeřábu*, začne *Finishing* ve středu 9. června a dokončí se ve čtvrtek 10. června. Zbytek úterý (4 pracovní hodiny) nelze využít. Tyto 4 hodiny uvidíte znovu jako celkovou časovou rezervu úkolu *Osazení jeřábu*: půl pracovního dne.

Když pořadí obrátíte, je to jednodušší. *Pour foundation* trvá 2 dny, od pondělí 7. do úterý 8. června. *Osazení jeřábu* nyní trvá 4 hodiny a navazuje. Začíná **ve středu 9. června v 07:00** a dokončí se v 11:00.

### Prodleva v hodinách

Mezi *Osazení jeřábu* (12 hodin) a *Seřízení prvků* (8 hodin) vložíte prodlevu 2 hodiny. *Seřízení prvků* pak nezačne v 11:00, ale v úterý v **14:00**: 1 hodina do přerušení práce a 1 hodina po něm. Dokončení se posune na **středu 9. června 14:00**.

Po úkolu ve dnech funguje prodleva jinak. *Pour foundation* se dokončí v úterý 8. června. Bez prodlevy začne *Finishing* ve středu 9. června. S prodlevou 4 hodin je to půl dne a aplikace ji zaokrouhlí nahoru: *Finishing* začne **ve čtvrtek 10. června**. S prodlevou 1 hodiny aplikace zaokrouhlí dolů a *Finishing* prostě začne ve středu.

### Volné odpoledne v pátek

Nyní má pátek jen jeden blok, od 07:00 do 12:00: 5 hodin. Ostatní dny zůstávají na 8 hodinách. Čisté hodiny za den zůstávají 8, protože to je nejčastější denní součet. Týden má nyní 37 pracovních hodin.

Úkol o době 40 hodin od pondělí 7. června v 07:00 zabere pondělí až čtvrtek (32 hodin) a pátek (5 hodin). Poslední 3 hodiny připadnou na následující pondělí od 07:00 do 10:00. Dokončení je **pondělí 14. června 10:00**. Úkol o době 5 dnů by zabral od pondělí 37 hodin, a to aplikace navrhne, když přepnete jednotku 5 dnů na hodiny.

V kurzu 4 o plánování v hodinách si naplánujete práci s jeřábem v hodinách sami.

## Důsledky a časté omyly

**„8 hodin je 1 den.“** Jen tehdy, když má kalendář dny po 8 hodinách. V kalendáři s volným pátečním odpolednem je 5 dnů 37 hodin, ne 40.

**„Když nastavím víc hodin za den, úkol ve dnech skončí dřív.“** Ne. Úkol ve dnech počítá celé pracovní dny. Hodiny za den mění jen to, kolik hodin má den, například v zobrazení a u prodlevy v hodinách. Jen u úkolu, který má zdroje a pravidlo pevné veličiny *Pevná práce* nebo *Pevné jednotky*, se s tím mění doba trvání, protože práce zůstane stejná: 40 hodin práce je 5 dnů po 8 hodinách za den a 7 dnů po 6 hodinách za den.

**„Úkol o době 8 hodin trvá jeden den.“** Jen tehdy, když začne na začátku dne. Když začne později, jako *Seřízení prvků* v úterý v 11:00, pokračuje do dalšího dne.

**Kalendář s vlastními bloky pracovní doby** se chová jinak než standardní kalendář. Takový kalendář vznikne, když nastavíte pracovní dobu podle dnů v týdnu, nebo když zvolíte předvolbu směn (*2 směny*, *3 směny*, *Noční směna* nebo *24/7*). V takovém kalendáři se prodleva v hodinách počítá přesně v pracovních hodinách, i po úkolu ve dnech.

**Vypnutí plánování v hodinách** nic neodstraní. Úkoly v hodinách zůstanou a dál se přepočítávají, ale neupravíte je, dokud plánování v hodinách znovu nezapnete.

## Viz také

- [Zapnutí plánování v hodinách](docs://howto-urenplanning-aanzetten): postup pro naplánování úkolu v hodinách.
- [Nastavení pracovní doby](docs://howto-werktijden-instellen): úprava bloků pracovní doby kalendáře.
- [Kalendáře a pracovní dny](docs://uitleg-kalenders): jak aplikace počítá pracovní dny a který kalendář má přednost.
- [Přidání závislostí](docs://howto-relaties-leggen): postup pro přidání závislosti nebo prodlevy.
