# Přidání závislostí

Cíl: propojit úkoly tak, aby úkol začal až po dokončení práce před ním. Kde je to třeba, přidejte mezi úkoly čekací dobu (prodlevu).

## Kdy to potřebujete

Bez závislostí aplikace neví, že zedník může začít až po zalití základů. Každý úkol pak začne v den zahájení projektu a datum dokončení nic neznamená. **Závislost** toto pořadí zaznamená. První úkol je **předchůdce**, druhý **následník**.

Závislosti přidáváte při sestavování plánu, při přidání úkolu, nebo když se ukáže, že dva úkoly na sobě přesto závisí. **Prodleva** je čekací doba mezi dvěma úkoly, například beton, který musí vytvrdnout, nebo potěr, který musí oschnout.

Výchozí typ závislosti je **FS** (Finish-Start, dokončení-zahájení): následník může začít až po dokončení předchůdce. Aplikace zná také SS, FF a SF. Ty propojují zahájení nebo dokončení se zahájením nebo dokončením. U SS (zahájení-zahájení) může omítání začít až poté, co začnou technické instalace.

Nejste si jistí, který typ potřebujete? Pod volbou typu se zobrazí věta se skutečnými názvy úkolů, například *Metselwerk může začít až po dokončení úkolu Fundering.* Když zvolíte jiný typ, věta se změní. Vidíte ji v okně *Typ závislosti*, v bloku *Závislosti* a ve sloupci *Předchůdci* nebo *Následníci*.

## Postup

Závislost lze přidat čtyřmi způsoby. Všechny vytvoří stejnou závislost. Zvolte ten, který se hodí nejlépe vaší situaci.

### Propojení dvou vybraných úkolů

Hodí se, když pracujete v tabulce úkolů.

1. V tabulce úkolů klikněte na úkol, který je první: na předchůdce.
2. Podržte Ctrl (na Macu ⌘) a klikněte na úkol, který následuje: na následníka.
3. Zvolte *Domů › Úkoly › Závislost ▾ › Propojit vybrané úkoly*. Stejné tlačítko je také na kartě *Plán › Závislosti*.

Aplikace vytvoří závislost typu dokončení-zahájení (FS) bez prodlevy a ohlásí například *Závislost vytvořena: Foundation brickwork → Lay hollow-core floor*. Tlačítko funguje jen při výběru přesně dvou úkolů.

### Kreslení závislosti v diagramu Gantt

Hodí se, když přidáváte více závislostí za sebou.

1. Zvolte *Domů › Úkoly › Závislost ▾ › Nakreslit závislost*. Nad plánem se zobrazí hlášení *Režim závislostí: v diagramu Gantt táhněte z jednoho pruhu na druhý a vytvořte závislost. Esc režim ukončí.*
2. Stiskněte na pruhu předchůdce a táhněte na pruh následníka. Za kurzorem se pohybuje čárkovaná čára se šipkou.
3. Pusťte tlačítko myši. Zobrazí se malé okno *Typ závislosti* s typem (výchozí je FS) a polem pro prodlevu.
4. Pokud je potřeba, změňte typ nebo prodlevu a stiskněte Enter, nebo klikněte mimo okno. Závislost je vytvořena.
5. Další závislost přidejte hned: režim zůstane zapnutý. Ukončete jej klávesou Esc, tlačítkem *Zastavit* v hlášení, nebo tím, že znovu zvolíte *Nakreslit závislost*.

Když v okně *Typ závislosti* stisknete Esc, nic se nezaznamená. Pro jednu závislost režim zapínat nemusíte: podržte Shift a táhněte z pruhu na pruh. Položka *Začít závislost odsud* v kontextové nabídce pruhu zapne režim závislostí. Tažení musíte provést sami. Na kartě *Tabulka* bez diagramu Gantt je *Nakreslit závislost* nedostupné.

### Přidání závislosti v panelu vlastností

Hodí se, když se díváte na jeden úkol a chcete přidat jeho předchůdce nebo následníky.

1. Vyberte úkol. Panel *Vlastnosti* je vpravo. Pokud jej nevidíte, zapněte jej na kartě *Zobrazení › Panely › Vlastnosti*.
2. V bloku *Závislosti* klikněte na *Přidat závislost*.
3. Ponechte směr na *Předchůdce*, pokud je druhý úkol první. Nebo zvolte *Následník*.
4. Napište část názvu druhého úkolu. Správný úkol vyberte šipkami a Enterem, nebo na něj klikněte.
5. Zvolte typ (výchozí je FS) a podle potřeby vyplňte prodlevu.
6. Stiskněte Enter, nebo klikněte na značku zaškrtnutí (*Vytvořit závislost*).

Závislosti úkolu se potom zobrazí v bloku *Závislosti*. U každé je číslo WBS druhého úkolu, typ a prodleva.

### Psaní závislostí do sloupce Předchůdci

Hodí se, když pracujete rychle s klávesnicí a znáte čísla WBS.

1. Klikněte na **+** vpravo v záhlaví tabulky úkolů (*Přidat sloupec*). V části *Závislosti* zvolte sloupec *Předchůdci*. Sloupec *Následníci* funguje stejně.
2. Ve sloupci *Předchůdci* klikněte na buňku následníka.
3. Napište číslo WBS předchůdce, mezeru a typ, například `2.6 FS`. Prodlevu připište hned za něj: `2.6 FS+1d`. Více předchůdců oddělte středníkem nebo čárkou: `3.1 FS; 3.2 SS+2d`.
4. Stiskněte Enter.

Co napíšete, nahradí celou buňku. Pokud v ní už předchůdci jsou, napište je také (viz úskalí). Když v buňce místo psaní stisknete Enter nebo F2, otevře se pole, které stávající závislosti zachová. Vyhledáte úkol podle čísla WBS nebo názvu a pro každou závislost zvolíte typ a prodlevu.

### Nastavení nebo změna prodlevy

Prodlevu napíšete do pole vedle typu, u každého z výše uvedených způsobů. Existující prodlevu změníte v bloku *Závislosti*: klikněte do pole pro prodlevu, napište novou hodnotu a stiskněte Enter.

- `3` nebo `3d`: 3 pracovní dny. Víkend se nepočítá. Aplikace zobrazí `+3d`.
- `3ed`: 3 kalendářní dny. Víkend se počítá, jako u betonu, který vytvrzuje i v sobotu a v neděli.
- `-1`: záporná prodleva (předstih). Následník může začít o den dříve, takže se úkoly překryjí.
- `4h`: 4 pracovní hodiny; aplikace to zobrazí jako `+4u`. Je-li předchůdce úkol ve dnech v kalendáři bez vlastních bloků pracovní doby, například ve standardním kalendáři, aplikace převede tuto hodnotu na celé pracovní dny, zaokrouhlené na nejbližší celý den: `4h` pak působí jako 1 den, `2h` jako 0. V kalendáři s vlastními bloky pracovní doby nebo po hodinovém úkolu se prodleva počítá přesně v hodinách.
- `50%`: polovina doby trvání předchůdce.

Příklad: beton základů musí vytvrdnout, než na něm může zedník pracovat. Proto dostane *Pour foundation → Foundation brickwork* závislost FS s prodlevou `3`. Pokud se betonáž koná v pátek 18. června 2027, začne zdivo až po příkazu **Přepočítat** ve čtvrtek 24. června. Pondělí až středa je čekací doba. S `3ed` se počítá i víkend a zdivo začne v úterý 22. června.

### Na závěr: přepočítat

Nová závislost zatím žádný pruh nepřesune. Ve stavovém řádku se zobrazí *Zastaralé — přepočítejte (F5)*. Stiskněte **Přepočítat** (F5), například přes *Domů › Plán › Přepočítat*. Teprve potom dostanou následníci nová data. Chcete-li, aby to aplikace dělala za vás, na kartě *Nastavení* otevřete *Projekt › Nastavení* a na kartě *Plán* zapněte volbu *Automaticky přepočítat*.

## Úskalí a co aplikace dělá

**Obrácené pořadí.** U *Propojit vybrané úkoly* rozhoduje pořadí kliknutí, ne pořadí v seznamu. Když kliknete nejdřív na pozdější úkol, je závislost obráceně. Odstraňte ji v bloku *Závislosti* ikonou koše a přidejte ji znovu.

**Psaní do sloupce smaže, co tam bylo.** Pokud buňka obsahuje `3.4 FS; 3.2 FS` a vy napíšete jen `3.2 FS`, závislost s 3.4 zmizí bez hlášení. Napište všechny předchůdce. Chcete-li k nim přidat další, použijte Enter nebo F2. Nebo vraťte změnu klávesami Ctrl+Z.

**Cyklus.** Když přidáte závislost, která vede zpět k úkolu dříve v řetězu, plán by nikdy nemohl začít. Aplikace takovou závislost odmítne: *Tato závislost by v plánu vytvořila cyklus (…) a nebyla vytvořena*, úkoly cyklu jsou v závorce. Nejdřív odstraňte závislost, která cyklus uzavírá.

**Úkol a jeho nadřazený souhrnný úkol.** Závislost mezi úkolem a souhrnným úkolem, pod kterým leží, není možná. Aplikace hlásí: *Závislost mezi úkolem a jeho vlastním nadřazeným souhrnným úkolem (i vyšším) není povolena.*

**Duplicita.** Pokud závislost už existuje, aplikace hlásí *Tato závislost již existuje* a nic se nezmění.

**Kratší hlášení ve sloupci.** Sloupec *Předchůdci* hlásí stejná odmítnutí kratším textem pod buňkou: *Tato změna by vytvořila cyklus v plánu.*, *Tato závislost už existuje.* nebo *Úkol nemůže mít závislost na svém vlastním souhrnném úkolu.* Pokud napíšete jen číslo WBS, například `3.1`, chybí typ a buňka hlásí *Použijte například 1.2 FS+2d.* Buňka zůstane otevřená. Opravte zadání, nebo stiskněte Esc a zrušte je.

**Žádné půldny prodlevy.** Prodleva ve dnech je vždy celé číslo: `1.5` se změní na `+2d`. Hodinová prodleva za úkolem ve dnech v kalendáři bez vlastních bloků pracovní doby se zaokrouhlí na celé pracovní dny. Nečitelný vstup, například slovo, se neuloží: pole se vrátí k předchozí hodnotě.

## Viz také

- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): co aplikace počítá z vašich závislostí a proč se úkol stane kritickým.
- [Závislosti a prodleva](docs://uitleg-relaties): co dělají čtyři typy závislosti a prodleva s daty.
- [Sledování cesty](docs://howto-pad-traceren): zobrazení řetězu předchůdců a následníků.
- [Dialog úkolu a panel vlastností](docs://ref-taak-eigenschappen): pole pro závislosti a prodlevu v panelu a v dialogu.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): řetěz závislostí dokončení-zahájení s jednou závislostí zahájení-zahájení (stěny a střecha, prodleva 2 dny) a jednou závislostí dokončení-dokončení (obklady a malování, prodleva 1 den).
