# Závislosti a prodleva

Proč zdivo začne až po dokončení základu? A proč se montáž střechy opozdí o týden, když střešní prvky dorazí pozdě? To mají na svědomí závislosti mezi vašimi úkoly. V tomto článku se dozvíte, jaké čtyři typy závislostí aplikace zná, co dělají prodleva a předstih, v jakém kalendáři se prodleva počítá, co se stane se závislostí na fázi a jak aplikace určí, která závislost řídí datum zahájení úkolu.

Pravidla a příklady platí pro nový projekt s profilem výpočtu *Open Planner Studio* a pracovním týdnem od pondělí do pátku.

## Pojem

Závislost zaznamenává, že dva úkoly na sobě závisejí. První úkol je **předchůdce**, druhý **následník**. Závislost je dolní mez. Následník nikdy nesmí začít ani skončit dříve, než závislost dovolí, ale může začít nebo skončit později. Když má úkol více předchůdců, čeká na nejpozdější datum, které vyjde ze všech těchto závislostí.

Existují čtyři typy. Liší se tím, který okamžik předchůdce (zahájení, nebo dokončení) je navázán na který okamžik následníka:

- **FS (dokončení-zahájení).** Následník začne až ve chvíli, kdy je předchůdce hotový. Střešní prvky se pokládají teprve tehdy, až stojí zdi. Tento typ závislosti je zdaleka nejpoužívanější.
- **SS (zahájení-zahájení).** Následník začne až poté, co zahájí předchůdce. Úkoly se mohou překrývat: Pipework může začít, jakmile je zdivo rozestavěno.
- **FF (dokončení-dokončení).** Následník se dokončí až poté, co je předchůdce hotový. Pointing nelze dokončit dříve, než je zdivo hotové, ale může začít dříve.
- **SF (zahájení-dokončení).** Následník se dokončí až poté, co zahájí předchůdce. Tento typ je vzácný. Příklad: *Dewatering* (dočasné odvodňování) smí skončit až poté, co se zahájí zdivo na základu.

Závislost může mít také **prodlevu**: čekací dobu mezi oběma úkoly, například beton, který musí zrát. Záporná prodleva se nazývá **předstih**: následník pak začne dříve, než je předchůdce hotový, takže se úkoly překrývají.

## Jak aplikace počítá

### Čtyři typy

Pro každou závislost aplikace vypočítá nejdřívější datum, kdy může následník začít, a u úkolu vezme nejpozdější ze všech závislostí. Bez prodlevy to funguje takto:

- U FS následník začne prvním pracovním dnem po dokončení předchůdce.
- U SS následník začne ve stejný den jako předchůdce.
- U FF následník skončí ve stejný den jako předchůdce. Aby aplikace zjistila zahájení, počítá zpět přes dobu trvání následníka. Následník, který trvá 3 pracovní dny, tedy začne 2 pracovní dny před dokončením předchůdce.
- U SF následník skončí v den, kdy začne předchůdce. I tady aplikace počítá zpět přes dobu trvání následníka.

Jde o dolní meze. Následník začne později, pokud to vyžaduje jiná závislost nebo omezení. Všechna data se zobrazí až po spuštění příkazu **Přepočítat** (F5). Dokud stavový řádek ukazuje *Zastaralé — přepočítejte (F5)*, patří pruhy k předchozímu přepočtu.

### Prodleva a předstih

Prodlevu lze zapsat čtyřmi způsoby:

- V **pracovních dnech** (`3` nebo `3d`): aplikace přeskakuje volné dny a víkendy. Toto je výchozí způsob.
- V **kalendářních dnech** (`3ed`, e znamená *uplynulý* čas): počítá se každý den, včetně soboty a neděle. Tato jednotka se hodí pro něco, co pokračuje, i když se nepracuje, například zrání.
- Jako **procento** z doby trvání předchůdce (`40%`): aplikace to při každém výpočtu počítá znovu a zaokrouhluje na celé dny (2,5 dne se zaokrouhlí na 3).
- V **pracovních hodinách** (`4h`): aplikace počítá prodlevu v kalendáři prodlev, výchozí je kalendář předchůdce. Je-li předchůdce úkol ve dnech v kalendáři bez vlastních bloků pracovní doby, například ve standardním kalendáři, aplikace převede hodiny na celé pracovní dny. Zaokrouhlí je na nejbližší celý den (polovina dne se zaokrouhlí nahoru). Při pracovním dni o délce 8 hodin tedy `2h` a `3h` dají 0 dnů, `4h` až včetně `11h` dají 1 den a `12h` dají 2 dny. Má-li tento kalendář vlastní bloky pracovní doby, nebo je-li předchůdce hodinový úkol, počítá se prodleva přesně v pracovních hodinách.

Pravidlo pro prodlevu N pracovních dnů u FS: N pracovních dnů po dokončení předchůdce je čekací doba. Následník začne následující pracovní den. U SS a FF se prodleva přičte k zahájení, respektive k dokončení předchůdce. Záporná prodleva se počítá zpět: předstih o 1 pracovní den u FS nechá následníka začít v den, kdy předchůdce dokončí.

Předstih nemůže posunout úkol před zahájení projektu. Kdyby k tomu mělo dojít, aplikace ponechá následníka v den zahájení projektu a v panelu *Varování* uvede: *Předstih ořezán zahájením projektu — závislost není plně využita*.

### V jakém kalendáři se prodleva počítá

Každý úkol může mít vlastní kalendář. U prodlevy v pracovních dnech záleží na tom, který kalendář počítá pracovní dny. O tom rozhoduje volba *Kalendář prodlev* se čtyřmi možnostmi: *Předchůdce*, *Následník*, *24hodinový* a *Projektový kalendář*. Výchozí je, že se prodleva počítá v kalendáři **předchůdce**. Volbu najdete na kartě *Nastavení › Projekt › Info o projektu*, v bloku *Profil výpočtu a možnosti výpočtu*, v poli *Možnosti výpočtu tohoto projektu*. Volba patří do souboru projektu a platí až po kliknutí na *Použít*. Plán se pak přepočítá.

Prodleva v kalendářních dnech (`3ed`) počítá vždy všechny dny, ať zvolíte kteroukoli možnost volby *Kalendář prodlev*.

### Závislosti souhrnných úkolů

Závislost můžete přidat na fázi (souhrnný úkol) místo na úkol uvnitř ní. Aplikace ji interně přidá na každý úkol ve fázi:

- Fáze jako **předchůdce** u FS nebo FF: následník čeká, dokud poslední úkol fáze nebude dokončen.
- Fáze jako **následník** u FS nebo SS: každý úkol ve fázi čeká na předchůdce nezávisle na ostatních úkolech ve fázi.
- Fáze jako **předchůdce** u SS nebo SF: následník čeká na zahájení úkolu ve fázi, který začíná jako poslední, a ne na zahájení samotné fáze. To je opatrnější, než byste čekali: následník nikdy nezačne příliš brzy, ale možná později, než chcete. Pokud chcete, aby následník sledoval zahájení fáze, dejte závislost na první úkol ve fázi.
- Fáze jako **následník** u FF nebo SF: každý úkol ve fázi musí splnit požadavek na dokončení sám (u FF nejdříve v den dokončení předchůdce, u SF nejdříve v den zahájení předchůdce), i úkol, který mohl být hotov mnohem dřív. Takovou závislost raději dejte na poslední úkol ve fázi.

Závislost mezi úkolem a fází, do které patří, není povolena.

### Hnací vazby

Pokud má následník více předchůdců, obvykle určuje jeho datum zahájení jedna závislost: ta, která brání tomu, aby následník začal o jediný den dříve, než začíná nyní. Taková závislost je **hnací vazba**. Při shodě existuje více hnacích vazeb. Hnací vazbu poznáte podle symbolu blesku ve sloupcích *Předchůdci* a *Následníci* v tabulce, podle sloupce *Hnací* (**+** napravo v záhlaví tabulky, pod *Závislosti*) a podle silnějšího odstínu, když sledujete cestu. Jak cestu otevřít, je popsáno v [Sledování cesty](docs://howto-pad-traceren).

Hnací vazba říká něco o datech, ne o době trvání. Krátký předchůdce může tvořit hnací vazbu také, například kvůli dlouhé prodlevě. Uvidíte to v příkladu níže.

## Propracovaný příklad

Příklady používají samostatné mini-projekty. Všechny začínají v pondělí 7. června 2027, pokud není uvedeno jinak. Pojmy jako kritická cesta a časová rezerva jsou vysvětleny v článku [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad). Síť závislostí vytvoříte sami a zkontrolujete ji v kurzu 2, „Závislosti a kritická cesta“.

### Čtyři typy vedle sebe

*Pour foundation* trvá 5 pracovních dnů: od pondělí 7. do pátku 11. června. *Build walls* (5 pracovních dnů) navazuje s FS a běží od pondělí 14. do pátku 18. června. Na *Build walls* navazují čtyři úkoly po 3 pracovních dnech, každý s jiným typem závislosti:

- *Place roof elements* (FS) začíná v pondělí 21. června, první pracovní den po zdivu, a je hotový ve středu 23. června.
- *Pipework* (SS) začíná v pondělí 14. června spolu se zdivem a je hotový ve středu 16. června.
- *Pointing* (FF) musí být dokončen v pátek 18. června spolu se zdivem. Při 3 pracovních dnech tedy začíná ve středu 16. června.
- *Dewatering* (SF) musí skončit v pondělí 14. června, tedy v den, kdy začíná zdivo. Počítáme-li zpět 3 pracovní dny (čtvrtek 10., pátek 11., pondělí 14. června), vychází zahájení ve čtvrtek 10. června.

Jen *Place roof elements* leží na kritické cestě. Projekt je hotový ve středu 23. června. *Pipework* má 5 pracovních dnů časové rezervy, *Pointing* 3 pracovní dny a *Dewatering* 7 pracovních dnů.

### Prodleva a předstih v číslech

*Pour foundation* je hotový v pátek 18. června. Následuje *Build walls* (2 pracovní dny) s FS. Takto prodleva mění datum zahájení:

- Bez prodlevy začíná zdivo v pondělí 21. června.
- S prodlevou `3` (tři pracovní dny) jsou čekací dobou pondělí 21., úterý 22. a středa 23. června. Zdivo začíná ve čtvrtek 24. června.
- S prodlevou `3ed` (tři kalendářní dny) se počítají sobota, neděle a pondělí. Zdivo začíná v úterý 22. června.
- S prodlevou `-1` (předstih o jeden pracovní den) začíná zdivo v pátek 18. června, v den, kdy je betonáž hotová.
- S prodlevou `40%` je prodleva 40 % z 5 pracovních dnů, tedy 2 pracovní dny. Zdivo začíná ve středu 23. června.
- S prodlevou `50%` je prodleva 2,5 pracovního dne, zaokrouhlená na 3 pracovní dny. Zdivo začíná ve čtvrtek 24. června.

### Který kalendář počítá prodlevu

*Build walls* (4 pracovní dny) je v projektovém kalendáři (pondělí až pátek) a je hotový ve čtvrtek 10. června. *Pointing* (2 pracovní dny) navazuje s FS a prodlevou `3` a je v kalendáři, kde jsou pracovními dny i sobota a neděle. Datum zahájení pak závisí na volbě *Kalendář prodlev*:

- *Předchůdce* (výchozí): prodleva se počítá v kalendáři zdiva. Čekací dobou jsou pátek 11., pondělí 14. a úterý 15. června. Pointing začíná ve středu 16. června.
- *Následník*: prodleva se počítá v kalendáři úkolu pointing. Čekací dobou jsou pátek 11., sobota 12. a neděle 13. června. Pointing začíná v pondělí 14. června.
- *24hodinový*: počítá se každý kalendářní den. I zde jsou čekací dobou pátek, sobota a neděle. Pointing začíná v pondělí 14. června.
- *Projektový kalendář*: prodleva se počítá v projektovém kalendáři, stejně jako při volbě *Předchůdce*. Pointing začíná ve středu 16. června.

### Závislosti na fázi

*Foundation* je fáze se dvěma úkoly: *Excavate* (2 pracovní dny, pondělí 7. a úterý 8. června) a potom *Pour* (3 pracovní dny, středa 9. až pátek 11. června). *Build walls* navazuje na fázi *Foundation* s FS a začíná v pondělí 14. června: aplikace ho nechá čekat na *Pour*, poslední úkol, který se dokončí.

Pokud je fáze následníkem: *Permit* (3 pracovní dny, hotový ve středu 9. června) vede s FS do fáze *Struktura*. Fáze obsahuje *Build walls* (4 pracovní dny) a potom *Lay floor* (2 pracovní dny). Každý úkol ve fázi čeká na *Permit*: *Build walls* začíná ve čtvrtek 10. června a je hotový v úterý 15. června. *Lay floor* také čeká na zdivo a běží od středy 16. do čtvrtku 17. června.

U SS z fáze: fáze *Finishing* obsahuje *Plastering* (2 pracovní dny, 7. a 8. června), potom *Painting* (3 pracovní dny, 9. až 11. června) a potom *Snagging* (2 pracovní dny, 14. a 15. června). *Cleaning* navazuje na fázi s SS. Čekali byste zahájení v pondělí 7. června, ale aplikace nechá *Cleaning* čekat na zahájení *Snagging*, úkolu, který začíná jako poslední: v pondělí 14. června.

### Která vazba je hnací

*Pour foundation* (2 pracovní dny) běží od pondělí 7. do úterý 8. června. Následují dvě větve:

- *Build walls* (5 pracovních dnů): středa 9. až úterý 15. června.
- *Order roof elements* (2 pracovní dny): středa 9. a čtvrtek 10. června.

*Place roof elements* (3 pracovní dny) navazuje na obě: s FS po zdivu a s FS a prodlevou `5` po Order roof elements (dodací lhůta). Od zdiva by pokládání mohlo začít ve středu 16. června. Od Order roof elements jsou čekací dobou pátek 11., pondělí 14., úterý 15., středa 16. a čtvrtek 17. června; pokládání začíná v pátek 18. června. Závislost na Order roof elements je proto hnací vazbou, ačkoli je tento úkol mnohem kratší než zdivo. Zdivo má 2 pracovní dny časové rezervy.

## Důsledky a mylné představy

**„Závislost úkoly pevně určuje.“** Ne, závislost je dolní mez. Následník začne nejdříve v den, který závislost určí, a později, pokud to vyžaduje jiná závislost nebo omezení. Jak se omezení zapojují, je vysvětleno v článku [Omezení a konečné termíny](docs://uitleg-constraints).

**„SS znamená, že úkoly začínají ve stejnou dobu.“** SS jen říká, že následník nesmí začít před předchůdcem. Pokud má následník dalšího předchůdce, který se dokončí později, začne později.

**„U FF začíná následník ve stejný den.“** Ne, u FF se shodují termíny dokončení. Krátký následník proto začne později než předchůdce, jako pointing v příkladu.

**„Prodleva ve dnech počítá kalendářní dny.“** Výchozí je, že se prodleva počítá v pracovních dnech, v kalendáři předchůdce. U zrání nebo schnutí, kdy se počítá i víkend, použijete kalendářní dny (`ed`).

**„Úkol bez závislostí není problém.“** Úkol bez předchůdce začne v plánovaném datu zahájení a úkol bez následníka dostane časovou rezervu až do dokončení projektu. Když závislost zapomenete, úkol proto vypadá, jako by měl dost prostoru. Podívejte se na mylné představy v článku [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad).

**„Závislost na fázi je jedna závislost.“** Pro výpočet jde o jednu závislost na každý úkol ve fázi. Když přesunete úkoly do fáze nebo z ní, změní se i závislosti, které na ně působí.

## Viz také

- [Přidání závislostí](docs://howto-relaties-leggen): postup, jak propojit úkoly a nastavit prodlevu.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): co aplikace počítá ze vašich závislostí a proč se úkol stane kritickým.
- [Omezení a konečné termíny](docs://uitleg-constraints): dohody o datech spolu se závislostmi.
- [Sledování cesty](docs://howto-pad-traceren): zviditelnění řetězce úkolů před nebo za úkolem.
- [Vytvoření překlenovacího úkolu](docs://howto-hammock): úkol s odvozenou dobou trvání, zavěšený na závislostech typu SS a FF.
- [Vazby mezi projekty](docs://howto-externe-relaties): závislosti s úkolem v jiném souboru projektu.
