# Přidání závislostí

Cíl: propojte úkoly tak, aby úkol začal až po dokončení předchozí práce. Kde je to potřeba, přidejte mezi ně čekací dobu (prodlevu).

## Kdy to potřebujete

Bez závislostí aplikace neví, že zedník může začít až po zalití základů. Každý úkol potom začne na zahájení projektu a datum dokončení nemá žádný význam. **Závislost** zaznamenává toto pořadí. První úkol je **předchůdce**, druhý je **následník**.

Přidáváte závislosti, když sestavujete plán, když přidáte úkol, nebo když se ukáže, že dva úkoly na sobě nakonec závisejí. **Prodleva** je čekací doba mezi dvěma úkoly, například beton, který musí zrát, nebo potěr, který musí vyschnout.

Výchozí typ závislosti je **FS** (dokončení-zahájení): následník může začít až po dokončení předchůdce. Aplikace zná také SS, FF a SF. Ty spojují zahájení nebo dokončení se zahájením nebo dokončením. Například u SS (zahájení-zahájení) může omítání začít až ve chvíli, kdy začnou technické instalace.

Nejste si jisti, který typ potřebujete? Pod volbou typu se zobrazí věta se skutečnými názvy úkolů, která to vysvětlí, například *Metselwerk může začít až po dokončení úkolu Fundering.* Zvolte jiný typ a věta se podle něj změní. Uvidíte ji v okně *Typ závislosti*, v bloku *Závislosti* a ve sloupci *Předchůdci* nebo *Následníci*.

## Postup

Existují čtyři způsoby, jak přidat závislost. Všechny vytvoří stejnou závislost. Vyberte si ten, který se k vaší situaci hodí nejlépe.

### Propojení dvou vybraných úkolů

Hodí se, když pracujete v seznamu úkolů.

1. V seznamu úkolů klikněte na úkol, který je první: na předchůdce.
2. Podržte Ctrl (na Macu ⌘) a klikněte na úkol, který následuje: na následníka.
3. Zvolte *Domů › Úkoly › Závislost ▾ › Propojit vybrané úkoly*. Stejné tlačítko je také v nabídce *Plánování › Závislosti*.

Aplikace vytvoří závislost dokončení-zahájení bez prodlevy a oznámí například *Závislost vytvořena: Foundation brickwork → Lay hollow-core floor*. Tlačítko funguje jen tehdy, když jsou vybrány přesně dva úkoly.

### Kreslení závislosti v diagramu Gantt

Hodí se, když přidáváte několik závislostí za sebou.

1. Zvolte *Domů › Úkoly › Závislost ▾ › Nakreslit závislost*. Nad plánem se zobrazí hlášení *Režim závislostí: v diagramu Gantt táhněte z jednoho pruhu na druhý a vytvořte závislost. Esc režim ukončí.*
2. Stiskněte pruh předchůdce a přetáhněte jej na pruh následníka. Za kurzorem se pohybuje přerušovaná čára se šipkou.
3. Uvolněte tlačítko myši. Objeví se malé okno *Typ závislosti* s typem (výchozí je FS) a polem pro prodlevu.
4. Podle potřeby změňte typ nebo prodlevu a stiskněte Enter, nebo klikněte mimo okno. Závislost se vytvoří.
5. Další závislost přidejte hned: režim zůstane zapnutý. Ukončíte ho klávesou Esc, tlačítkem *Zastavit* v hlášení, nebo tím, že znovu zvolíte *Nakreslit závislost*.

Když v okně *Typ závislosti* stisknete Esc, nic se nezaznamená. Pro jednu závislost režim zapínat nemusíte: podržte Shift a táhněte z pruhu na pruh. Položka *Začít závislost odsud* v kontextové nabídce pruhu zapne režim závislostí. Tažení musíte udělat sami. Na kartě *Tabulka* bez diagramu Gantt je *Nakreslit závislost* nedostupné.

### Přidání závislosti v panelu Vlastnosti

Hodí se, když máte otevřený jeden úkol a chcete přidat jeho předchůdce nebo následníky.

1. Vyberte úkol. Panel *Vlastnosti* je vpravo. Pokud ho nevidíte, zapněte ho v nabídce *Zobrazení › Panely › Vlastnosti*.
2. V bloku *Závislosti* klikněte na *Přidat závislost*.
3. Pokud je druhý úkol první, ponechte směr na *Předchůdce*. Jinak zvolte *Následník*.
4. Napište část názvu druhého úkolu. Správný vyberte šipkami a klávesou Enter, nebo na něj klikněte.
5. Zvolte typ (výchozí je FS) a podle potřeby vyplňte prodlevu.
6. Stiskněte Enter, nebo klikněte na značku zaškrtnutí (*Vytvořit závislost*).

Závislosti tohoto úkolu se potom zobrazí v bloku *Závislosti*. U každé je číslo WBS druhého úkolu, typ a prodleva.

### Zadávání závislostí ve sloupci Předchůdci

Hodí se, když pracujete rychle s klávesnicí a znáte čísla WBS.

1. Klikněte na **+** vpravo v záhlaví seznamu úkolů (*Přidat sloupec*). V části *Závislosti* zvolte sloupec *Předchůdci*. Sloupec *Následníci* funguje stejně.
2. Ve sloupci *Předchůdci* klikněte na buňku následníka.
3. Napište číslo WBS předchůdce, mezeru a typ, například `2.6 FS`. Prodlevu připište hned za něj: `2.6 FS+1d`. Více předchůdců oddělte středníkem nebo čárkou: `3.1 FS; 3.2 SS+2d`.
4. Stiskněte Enter.

To, co napíšete, nahradí celou buňku. Pokud v ní už předchůdci jsou, napište je také (viz Úskalí a co aplikace dělá). Když v buňce místo psaní stisknete Enter nebo F2, otevře se pole, které stávající závislosti zachová. Vyhledáte úkol podle čísla WBS nebo názvu a u každé závislosti zvolíte typ a prodlevu.

### Nastavení nebo změna prodlevy

Prodlevu napíšete do pole vedle typu, u každého z výše uvedených způsobů. Existující prodlevu změníte v bloku *Závislosti*: klikněte do pole prodlevy, napište novou hodnotu a stiskněte Enter.

- `3` nebo `3d`: 3 pracovní dny. Víkend se nepočítá. Aplikace zobrazí `+3d`.
- `3ed`: 3 kalendářní dny. Víkend se počítá, například u betonu, který zraje i v sobotu a v neděli.
- `-1`: záporná prodleva (předstih). Následník může začít o den dříve, takže se úkoly překrývají.
- `4h`: 4 pracovní hodiny; aplikace to zobrazí jako `+4u`. Pokud je předchůdce úkol na dny v kalendáři bez vlastních bloků pracovní doby, například ve standardním kalendáři, aplikace prodlevu převede na celé pracovní dny, zaokrouhlené na nejbližší celý den: `4h` pak platí jako 1 den, `2h` jako 0. V kalendáři s vlastními bloky pracovní doby nebo po hodinovém úkolu se prodleva počítá přesně v hodinách.
- `50%`: polovina doby trvání předchůdce.

Příklad: beton základu musí zrát, než na něm může zedník pracovat, takže *Pour foundation → Foundation brickwork* dostane závislost FS s prodlevou `3`. Pokud se zalévání koná v pátek 18. června 2027, zdění začne ve čtvrtek 24. června, až po **Přepočítat**. Pondělí až středa jsou čekací doba. S `3ed` se víkend počítá a zdění začne v úterý 22. června.

### Nakonec přepočítejte

Nová závislost zatím žádné pruhy nepřesune. Stavový řádek ukazuje *Zastaralé — přepočítejte (F5)*. Stiskněte **Přepočítat** (F5), například v nabídce *Domů › Plán › Přepočítat*. Teprve potom dostanou následníci nová data. Chcete-li, aby to aplikace udělala za vás, zapněte v nabídce *Nastavení › Projekt › Nastavení*, na kartě *Plánování*, položku *Automaticky přepočítat*.

## Úskalí a co aplikace dělá

**Obrácené pořadí.** U *Propojit vybrané úkoly* záleží na pořadí, ve kterém klikáte, ne na pořadí v seznamu. Když kliknete nejdřív na pozdější úkol, závislost je obráceně. Smažte ji v bloku *Závislosti* tlačítkem s ikonou koše a přidejte ji znovu.

**Psaní do sloupce smaže, co tam bylo.** Pokud buňka obsahuje `3.4 FS; 3.2 FS` a vy napíšete jen `3.2 FS`, závislost s 3.4 zmizí bez hlášení. Napište všechny předchůdce, nebo stiskněte Enter či F2 a přidejte je k existujícím. Případně vraťte změnu klávesami Ctrl+Z.

**Cyklus.** Když přidáte závislost, která vede zpět k úkolu dříve v řetězu, plán by nikdy nemohl začít. Aplikace takovou závislost odmítne: *Tato závislost by v plánu vytvořila cyklus (…) a nebyla vytvořena*, úkoly cyklu jsou v závorkách. Nejdřív smažte závislost, která cyklus uzavírá.

**Úkol a jeho nadřazený souhrn.** Závislost mezi úkolem a souhrnným úkolem, pod kterým leží, není možná. Aplikace hlásí: *Závislost mezi úkolem a jeho vlastním nadřazeným souhrnným úkolem (i vyšším) není povolena.*

**Duplicita.** Pokud závislost už existuje, aplikace hlásí *Tato závislost již existuje* a nic se nezmění.

**Kratší hlášení ve sloupci.** Sloupec *Předchůdci* vrací stejná odmítnutí, ale kratším textem pod buňkou: *Tato změna by vytvořila cyklus v plánu.*, *Tato závislost už existuje.* nebo *Úkol nemůže mít závislost na svém vlastním souhrnném úkolu.* Pokud napíšete jen číslo WBS, například `3.1`, chybí typ a buňka hlásí *Použijte například 1.2 FS+2d.* Buňka zůstane otevřená. Opravte zápis, nebo stiskněte Esc a zrušte to.

**Žádné půldny prodlevy.** Prodleva ve dnech je vždy celé číslo: `1.5` se změní na `+2d`. Prodleva v hodinách po úkolu na dny v kalendáři bez vlastních bloků pracovní doby se zaokrouhlí na celé pracovní dny. Nečitelný zápis, například slovo, se neuloží: pole se vrátí na předchozí hodnotu.

## Viz také

- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): co aplikace přepočítává ze vašich závislostí a proč je úkol kritický.
- [Závislosti a prodleva](docs://uitleg-relaties): co čtyři typy závislostí a prodleva dělají s daty.
- [Sledování cesty](docs://howto-pad-traceren): zobrazení řetězu předchůdců a následníků.
- [Dialog úkolu a panel Vlastnosti](docs://ref-taak-eigenschappen): pole pro závislosti a prodlevu v panelu a v dialogu.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): řetěz závislostí dokončení-zahájení s jednou závislostí zahájení-zahájení (stěny a střecha, prodleva 2 dny) a jednou závislostí dokončení-dokončení (obklady a malování, prodleva 1 den).
