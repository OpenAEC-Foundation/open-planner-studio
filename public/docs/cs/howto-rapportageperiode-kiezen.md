# Výběr období sestavy

Cíl: rozhodněte, jaký časový úsek sestava pokrývá, například následující čtyři týdny nebo měsíc června.

## Kdy to potřebujete

Týdenní schůzka chce vědět, co se stane v následujících čtyřech týdnech. Měsíční sestava pokrývá červen. Bez období dostanete celý plán na papíře. Pět sestav proto pracuje s položkou *Období sestavy:* – *Look-ahead*, *Sestava průběhu*, *Vytížení zdrojů*, *Přiřazení zdrojů* a *Diagram zdrojů*. Ostatní sestavy žádné období nemají.

Období není vázané na kalendářní měsíc, ale na **referenční den**: datum stavu vašeho projektu (den, kdy měříte průběh, viz [Průběh, datum stavu a směrný plán](docs://uitleg-voortgang)), nebo dnešní den, když projekt nemá datum stavu. *Příští 4 týdny* počítají od tohoto dne. Když změníte datum stavu, okno se posune spolu s ním.

## Kroky

### 1. Nastavte datum stavu

Pokud pracujete s relativní volbou, například *Příští 4 týdny* nebo *Uplynulý měsíc*, nastavte nejdřív datum stavu. Na kartě *Plán* zvolte *Směrné plány a průběh* a vyplňte pole *Datum stavu*. Křížkem vedle něj (*Vymazat datum stavu*) datum opět odstraníte. Pokud pracujete s pevným obdobím (krok 4), toto nepotřebujete.

### 2. Zvolte sestavu s obdobím

Otevřete kartu *Sestava* a v poli *Typ sestavy* zvolte jednu z pěti sestav. Seznam *Období sestavy:* je v části *Možnosti sestavy*. U Diagramu zdrojů je to v části *Nastavení*, pod čtyřmi zaškrtávacími políčky této sestavy.

Každá sestava si pamatuje své vlastní období. Toto jsou počáteční hodnoty:

- *Look-ahead*: *Příští měsíc*.
- *Sestava průběhu*: *Uplynulý měsíc*.
- *Vytížení zdrojů*, *Přiřazení zdrojů* a *Diagram zdrojů*: *Celý projekt*.

### 3. Zvolte období ze seznamu

Seznam obsahuje *Příští týden*, *Příští 2 týdny*, *Příští 4 týdny*, *Příštích 6 týdnů*, *Příštích 8 týdnů*, *Příštích 12 týdnů* a *Příští měsíc*, a stejných sedm voleb pro minulost, například *Uplynulý měsíc*. Dále *Celý projekt* a *Vlastní*. Pod seznamem jsou pole *Od* a *Do* s daty, které volba vytvoří. Tyto hodnoty zde můžete pouze číst.

Oba dny se počítají. Když je datum stavu čtvrtek 20. května, *Příští týden* běží od 20. do 26. května včetně a *Příští 4 týdny* od 20. května do 16. června včetně (28 dní). *Příští měsíc* běží až do jednoho dne před stejným dnem v příštím měsíci, zde až do 19. června včetně. *Uplynulé 2 týdny* běží od 7. do 20. května včetně.

*Celý projekt* zahrnuje plán od prvního začátku po poslední dokončení.

### 4. Nebo zvolte Vlastní

Při volbě *Vlastní* se *Od* a *Do* změní na dvě pole pro datum. Začínají s daty volby, kterou jste měli předtím. Vyplňte obě, například 1. a 14. června. Pokud vstup není správný, sestava zůstane u posledního platného období a zobrazí červené hlášení:

- *Datum konce je před datem začátku.* když je *Do* dřívější než *Od*.
- *Vyplňte obě data.* když je jedno z obou polí prázdné.

### 5. Přečtěte si období v sestavě

U sestav *Look-ahead*, *Vytížení zdrojů* a *Přiřazení zdrojů* je období pod nadpisem, například *Období: 20-05-2027 – 19-06-2027*. Když zvolíte *Celý projekt*, za data se přidá *Celý projekt*. Sestava průběhu ukazuje období v souhrnu u položky *Období*. Diagram zdrojů nastaví časovou osu přesně na období.

### Co období dělá u jednotlivých sestav

Období nefunguje ve všech sestavách stejně.

- **Look-ahead** zahrne nedokončené úkoly, které se období dotýkají, i když období celé překrývají. Zahrnuty jsou i zpožděné úkoly z doby před referenčním dnem, pokud období nekončí před referenčním dnem. Vlastní období zcela v minulosti je pohled zpět: ukáže jen to, co tehdy běželo a ještě není dokončeno, bez dnešního zaostání.
- **Sestava průběhu** použije období pro sekci *Dokončeno v uplynulém období*. Sekce *Začíná v příštím období* hledí dopředu od data stavu, až do data u položky *Výhled do* v souhrnu. Když zvolíte uplynulé období, sestava hledí dopředu stejně daleko, jak hledí zpět: s volbou *Uplynulé 2 týdny* a datem stavu 20. května ukáže *Výhled do* 3. června. Vlastní období nebo *Celý projekt*, které leží zcela v minulosti, se nezrcadlí.
- **Vytížení zdrojů** ukazuje každý týden nebo měsíc, který se období dotýká, celý. Když vaše období běží od středy do středy, vidíte proto celé týdny, takže řádek vždy ukazuje stejné číslo jako histogram.
- **Přiřazení zdrojů** ukazuje přiřazení úkolů, které se období dotýkají. Při volbě *Celý projekt* se nefiltruje podle data.
- **Diagram zdrojů** ukazuje jen úkoly, které se období dotýkají. V souhrnu *Mimo období:* počítá, kolik úkolů se vynechalo.

## Úskalí a co aplikace dělá

**Datum stavu není nastaveno.** Aplikace pak použije dnešek. U čtyř tabulkových sestav s obdobím (*Look-ahead*, *Sestava průběhu*, *Vytížení zdrojů* a *Přiřazení zdrojů*) se nahoře u relativního období zobrazí *Datum stavu není nastaveno — sestava počítá s dneškem (29-09-2026).* s dnešním datem vašeho zařízení. Diagram zdrojů toto nehlásí. Proto se podívejte na *Od* a *Do*: ty jsou pak kolem dneška, ne kolem vašeho plánu.

**Období leží mimo váš plán.** Sestava je pak prázdná. Diagram zdrojů to řekne hlášením *V sestavovaném období nejsou žádné úkoly — zvolte jiné období nebo Celý projekt.* (v seznamu se tato volba jmenuje *Celý projekt*). U ostatních sestav uvidíte nulový počet úkolů nebo žádné řádky.

**Data jsou ve vašem vlastním formátu.** *Od* a *Do* se řídí formátem data z vašeho nastavení, kromě polí pro datum u volby *Vlastní*: ty ukazují formát vašeho prohlížeče.

**Období se posouvá.** Relativní volba, například *Příští měsíc*, se určuje znovu pokaždé: když se změní datum stavu, nebo bez data stavu den později, období se posune hned. Pokud chcete pevné období, zvolte *Vlastní*.

**Volba platí pro všechny vaše projekty.** Vlastní období platí také pro všechny vaše projekty na tomto zařízení, ne jen pro otevřený projekt.

## Viz také

- [Vytváření a tisk sestavy](docs://howto-rapport-maken-en-afdrukken): celá cesta od typu sestavy k PDF.
- [Průběh, datum stavu a směrný plán](docs://uitleg-voortgang): co je datum stavu a proč s ním aplikace počítá.
- [Řešení přetížení](docs://howto-overbezetting-oplossen): co dělat s týdny s přetížením z Vytížení zdrojů.
- [Typy sestav](docs://ref-rapporttypes): všechny typy sestav a jejich možnosti.
