# Dny a hodiny

Úkol na 2 dny a úkol na 16 hodin vypadají stejně, ale aplikace je počítá různě. Proč můžete volit mezi dny a hodinami? A co se stane, když je hodinový úkol navázán na úkol ve dnech? V tomto článku se dozvíte, jak aplikace počítá dny a hodiny a kde zaokrouhluje. Příklad s jeřábem ukazuje čísla.

## Pojem

**Úkol ve dnech** má dobu trvání v celých pracovních dnech, například `5d`. Zabírá celé pracovní dny. V standardním kalendáři má datum začátku a dokončení bez času.

**Hodinový úkol** má dobu trvání v pracovních hodinách, například `12h` nebo `1h 30m`. Má začátek a dokončení s časem, například úterý 11:00.

Jednotka patří k úkolu, ne k projektu. Můžete kombinovat úkoly ve dnech a hodinové úkoly v jednom plánu. Tomu se říká **smíšené plánování**.

Hodiny použijete pro práci, která se nevejde do celých dnů: jeřáb, který si pronajmete na dvanáct hodin, nalévání betonu trvající šest hodin, úkol, který může začít až po obědě. Pro všechno ostatní stačí dny, a jsou přehlednější.

**Plánování v hodinách** je ve výchozím stavu vypnuté. Dokud je vypnuté, aplikace pracuje ve dnech. Pokud soubor obsahuje plánování v hodinách, například hodinové úkoly, aplikace zobrazí *Tento soubor obsahuje plánování v hodinách.* Tyto úkoly se stále počítají, ale jejich dobu trvání můžete upravit až po zapnutí plánování v hodinách.

## Jak aplikace vypočítává

### Pracovní doby a čisté hodiny

Každý kalendář má pro každý pracovní den **bloky pracovní doby** (v aplikaci se nazývají *bands*). Standardní kalendář má 07:00 až 12:00 a 13:00 až 16:00. Mezera mezi nimi je přestávka. Aplikace tyto bloky odvodí z kalendáře, z hodnot *Začátek (hodina)*, *Dokončení (hodina)* a přestávky; nic pro to nemusíte nastavovat. Když nastavíte vlastní bloky pro jednotlivé dny v týdnu, mají přednost.

**Čisté hodiny za den** jsou součtem bloků jednoho pracovního dne. Když se pracovní dny délkou liší, platí nejčastější denní součet. Při shodě platí nejvyšší. Při čtyřech dnech po 8 hodinách a pátku s 5 hodinami jsou čisté hodiny za den tedy 8.

### Úkol v hodinách

Aplikace počítá pracovní minuty od začátku přes bloky pracovní doby. Přestávky, večery, víkendy a svátky se nepočítají. Úkol na 12 hodin se proto nevejde do jednoho pracovního dne s 8 hodinami: běží dál do dalšího dne.

### Úkol ve dnech

Aplikace počítá celé pracovní dny. Hodiny za den nehrají roli. Úkol na 5 dnů se dokončí ve stejný den, ať má kalendář 6, nebo 8 hodin za den.

### Převod dnů a hodin

Den odpovídá čistým hodinám za den v kalendáři úkolu. Aplikace to používá na třech místech:

- Pro *Zobrazení doby trvání*. V nabídce *Nastavení › Projekt › Nastavení*, na kartě *Zobrazení*, zvolíte *Automaticky (vlastní jednotka každého úkolu)*, *Vždy dny* nebo *Vždy hodiny*. Úkol na 18 hodin se při *Vždy dny* zobrazí jako `2.25d(18h)`: vlastní jednotka zůstane v závorce.
- Pro prodlevu v hodinách za úkolem ve dnech (viz *Zaokrouhlení*).
- Když přepnete jednotku úkolu. Aplikace pak počítá dny od začátku úkolu, každý den s vlastními hodinami, a navrhne změnu jen tehdy, když je výsledek přesný. Dva dny se změní na `16h`. V kalendáři, kde má pátek 5 hodin, se 5 dnů od pondělí změní na `37h`. Dvanáct hodin nejde převést na celé dny v kalendáři s dny po 8 hodinách: aplikace pak jednotku nechá beze změny.

### Úkol ve dnech a hodinový úkol dohromady

Následující pravidla platí pro závislost dokončení-zahájení v kalendáři bez vlastních bloků pracovní doby, například ve standardním kalendáři.

- **Hodina → hodina.** Následník začne ve chvíli, kdy je předchůdce dokončen, i když je to uprostřed dne.
- **Hodina → den.** Úkol ve dnech nikdy nezačíná uprostřed dne. Začne první pracovní den po dni, ve kterém se dokončí hodinový úkol. Zbytek toho dne zůstane nevyužit a vrátí se jako časová rezerva hodinového úkolu.
- **Den → hodina.** Úkol ve dnech obsadí celý svůj poslední den. Hodinový úkol začne první pracovní den po něm, na začátku prvního bloku pracovní doby.

### Zaokrouhlení

Aplikace zaokrouhluje nebo odmítá na čtyřech místech:

- **Úkol ve dnech po hodinovém úkolu** začne další pracovní den. Hodinový úkol se tak jakoby zaokrouhlí nahoru na celé dny.
- **Prodleva v hodinách** se počítá v kalendáři prodlevy; výchozí je kalendář předchůdce. Je-li předchůdce úkol ve dnech v kalendáři bez vlastních bloků pracovní doby, například ve standardním kalendáři, aplikace převede prodlevu na celé pracovní dny: prodleva vydělená čistými hodinami za den, zaokrouhlená na celé číslo; polovina dne se zaokrouhlí nahoru. Při 8 hodinách za den se 1 hodina počítá jako 0 dnů, 4 hodiny jako 1 den a 12 hodin jako 2 dny. To platí i tehdy, když je následník hodinový úkol. Je-li předchůdce hodinový úkol, nebo má jeho kalendář vlastní bloky pracovní doby, počítá se prodleva přesně v pracovních hodinách a přestávka se nepočítá.
- **Doba trvání ve dnech** je vždy celé číslo. Když zadáte `1.5d`, aplikace zobrazí *Zadejte celé číslo dnů nebo hodin, například 2d nebo 12h.* Doba trvání v hodinách smí být `1.5h` nebo `1h 30m`.
- **Přepnutí jednotky** proběhne jen tehdy, když je výsledek přesný (viz výše).

## Příklad: jeřáb

Kalendář je od pondělí do pátku od 07:00 do 12:00 a od 13:00 do 16:00: 8 čistých hodin za den. Projekt začíná v pondělí 7. června 2027.

### Hodinový úkol, hodinový úkol a úkol ve dnech

*Place crane* trvá 12 hodin. Pondělí má 8 pracovních hodin (5 do 12:00 a 3 po přestávce) a v úterý zbylé 4 hodiny. Úkol běží od pondělí 07:00 do **úterý 8. června 11:00**.

*Adjust elements* trvá 8 hodin a navazuje závislostí dokončení-zahájení. Začne hned v úterý v 11:00: to je 1 hodina do přestávky a 3 hodiny po ní. Zbylé 4 hodiny připadnou na středu od 07:00 do 11:00. Dokončení je **středa 9. června 11:00**.

*Finishing* trvá 2 dny a navazuje na *Adjust elements*. Úkol ve dnech nezačíná uprostřed dne, proto začne **čtvrtek 10. června** a dokončí se v pátek 11. června.

### Zaokrouhlení při přechodu

Když vynecháte *Adjust elements* a navážete *Finishing* přímo na *Place crane*, začne *Finishing* ve středu 9. června a dokončí se ve čtvrtek 10. června. Zbytek úterý (4 pracovní hodiny) nelze využít. Ty 4 hodiny uvidíte znovu jako celkovou časovou rezervu úkolu *Place crane*: půl pracovního dne.

Když pořadí obrátíte, je to jednodušší. *Pour foundation* trvá 2 dny, od pondělí 7. do úterý 8. června. *Place crane* nyní trvá 4 hodiny a navazuje. Začne **ve středu 9. června v 07:00** a dokončí se v 11:00.

### Prodleva v hodinách

Mezi *Place crane* (12 hodin) a *Adjust elements* (8 hodin) vložíte prodlevu 2 hodiny. *Adjust elements* pak nezačne v 11:00, ale v úterý v **14:00**: 1 hodina do přestávky a 1 hodina po ní. Dokončení se posune na **středu 9. června 14:00**.

Po úkolu ve dnech se prodleva chová jinak. *Pour foundation* se dokončí v úterý 8. června. Bez prodlevy začne *Finishing* ve středu 9. června. Když je prodleva 4 hodiny, je to půl dne, a aplikace ji zaokrouhlí nahoru: *Finishing* začne **ve čtvrtek 10. června**. Když je prodleva 1 hodina, aplikace zaokrouhlí dolů a *Finishing* začne prostě ve středu.

### Volné odpoledne v pátek

Nyní má pátek jen jeden blok, od 07:00 do 12:00: 5 hodin. Ostatní dny zůstávají na 8 hodinách. Čisté hodiny za den zůstávají 8, protože je to nejčastější denní součet. Týden má nyní 37 pracovních hodin.

Úkol na 40 hodin od pondělí 7. června v 07:00 zabere od pondělí do čtvrtka (32 hodin) a v pátek (5 hodin). Zbylé 3 hodiny připadnou na následující pondělí od 07:00 do 10:00. Dokončení je **pondělí 14. června 10:00**. Úkol na 5 dnů by od pondělí zabral 37 hodin, a to aplikace navrhne, když přepnete jednotku z 5 dnů na hodiny.

V kurzu 4 o plánování v hodinách naplánujete práci s jeřábem v hodinách sami.

## Důsledky a nedorozumění

**„8 hodin je 1 den.“** Platí jen tehdy, když má kalendář dny po 8 hodinách. V kalendáři s volným pátečním odpolednem je 5 dnů 37 hodin, ne 40.

**„Když nastavíte více hodin za den, váš úkol ve dnech se dokončí dřív.“** Ne. Úkol ve dnech počítá celé pracovní dny. Hodiny za den mění jen to, kolik hodin má jeden den, například v zobrazení a u prodlevy v hodinách. Jen u úkolu, ke kterému jsou přiřazeny zdroje, a s pravidlem pevné veličiny *Pevná práce* nebo *Pevné jednotky* se doba trvání změní spolu s tím, protože práce zůstane stejná: 40 hodin práce je 5 dnů po 8 hodinách za den a 7 dnů po 6 hodinách za den.

**„Úkol na 8 hodin trvá jeden den.“** Platí jen tehdy, když začne na začátku dne. Když začne později, jako *Adjust elements* v úterý v 11:00, běží dál do dalšího dne.

**Kalendář s vlastními bloky pracovní doby** se chová jinak než standardní kalendář. Takový kalendář dostanete tak, že nastavíte pracovní dobu pro jednotlivé dny v týdnu, nebo zvolíte předvolbu pro směny (*2 směny*, *3 směny*, *Noční směna* nebo *24/7*). V takovém kalendáři se prodleva v hodinách počítá přesně v pracovních hodinách, i po úkolu ve dnech.

**Vypnutí plánování v hodinách nic neodstraní.** Úkoly v hodinách zůstanou a dál se počítají, ale nemůžete je upravovat, dokud plánování v hodinách znovu nezapnete.

## Viz také

- [Zapnutí plánování v hodinách](docs://howto-urenplanning-aanzetten): postup, jak naplánovat úkol v hodinách.
- [Nastavení pracovní doby](docs://howto-werktijden-instellen): úprava bloků pracovní doby kalendáře.
- [Kalendáře a pracovní dny](docs://uitleg-kalenders): jak aplikace počítá pracovní dny a který kalendář má přednost.
- [Přidání závislostí](docs://howto-relaties-leggen): postup pro přidání závislosti nebo prodlevy.
