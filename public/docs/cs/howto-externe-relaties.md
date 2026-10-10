# Vazby mezi projekty

Cíl: propojit úkol v tomto projektu s úkolem v jiném souboru projektu. Váš plán tak zohlední práci, která je plánovaná jinde.

## Kdy to potřebujete

Vaše přístavba může začít až poté, co se staveniště připraví ke stavbě. Tato práce je v projektu zhotovitele. Nebo instalatér může začít až po dokončení vaší konstrukce. Plánuje ve svém vlastním souboru. Běžná závislost funguje jen mezi úkoly ve stejném projektu. **Vazba mezi projekty** propojí úkol s úkolem v jiném souboru.

Vazba mezi projekty se nevypočítává živě podle druhého projektu. Aplikace uloží pevné **kotevní datum**: datum externího úkolu v okamžiku, kdy jej propojíte. Výpočet použije toto datum jako mez. Pokud se druhý projekt změní, ve vašem se nic nepohne, dokud kotevní datum neobnovíte.

## Postup

1. Vyberte přesně jeden úkol v tomto projektu: úkol, který závisí na externím úkolu, nebo úkol, na kterém externí úkol závisí.
2. Zvolte *Domů › Úkoly › Propojit ▾ › Přidat vazbu mezi projekty…*. Stejná nabídka je na kartě *Plán › Závislosti* a na kartě *Tabulka › Úkoly*. Položka je dostupná jen tehdy, když je vybraný přesně jeden úkol.
3. V okně *Vazba mezi projekty* zvolte jednu ze dvou cest. Pomocí tlačítka *Zdrojový soubor* vyberete soubor projektu pod položkou *Vyberte nedávný soubor* a potom *Zdrojový úkol*. Aplikace soubor čte jen pro čtení, neotevře ho jako dokument a kotevní datum převezme sama. Tato cesta funguje jen v desktopové aplikaci a jen pro soubor v seznamu nedávných souborů. Jinak je tlačítko *Zdrojový soubor* nedostupné. Při volbě *Ručně (záložní)* vyplníte *ID projektu* a *ID úkolu* externího úkolu, volitelně *Název úkolu (nepovinné)*, a *Kotevní datum*. V prohlížečové verzi je to jediná cesta.
4. V poli *Směr* zvolte, zda je externí úkol vaším předchůdcem, nebo následníkem: *Předchůdce (externí → já)* nebo *Následník (já → externí)*.
5. Zvolte *Typ závislosti* (FS, SS, FF nebo SF) a případně vyplňte pole *Prodleva (pracovní dny)*, například `0d` nebo `2d`.
6. Klikněte na *Přidat vazbu* a stiskněte **Přepočítat** (F5).

Které datum zadáte jako kotevní datum u ručního propojení, závisí na směru a typu:

- U externího **předchůdce** rozhoduje první písmeno typu. F znamená datum dokončení externího úkolu, S datum začátku. U FS a FF tedy zadáte dokončení, u SS a SF začátek.
- U externího **následníka** rozhoduje druhé písmeno. S je datum začátku externího úkolu, F datum dokončení. U FS a SS tedy zadáte začátek, u FF a SF dokončení.

Pokud plánujete v hodinách (zapnuté plánování v hodinách a úkol v kalendáři s pracovní dobou), pole *Kotevní datum* vyžaduje také čas.

Příklad: projekt stavby se dokončí v pátek 18. června 2027. Propojíte *Groundwork* s externím předchůdcem typu FS a kotevním datem 18. června 2027. Po stisknutí **Přepočítat** začne *Groundwork* v pondělí 21. června, tedy první pracovní den po kotevním datu. Externí následník funguje naopak: omezuje, jak pozdě smí váš úkol dokončit.

## Co vidíte a jak to spravujete

- Vazby mezi projekty se zobrazují jako text ve sloupcích *Předchůdci* a *Následníci* v tabulce úkolů. Přidáte je pomocí **+** v záhlaví tabulky, pod položkou *Závislosti*. Zobrazí se název projektu a úkolu a typ. Malý trojúhelník s popiskem *Zdroj chybí* ukazuje, že zdroj nebyl přečten. Podržte myš nad vazbou. Zobrazí se projekt (řádek *ID projektu* ukáže název projektu, jakmile je znám), ID úkolu, kotevní datum a stav zdroje.
- V diagramu Gantt je u úkolu šedý přízračný pruh. U předchůdce pruh končí na kotevním datu, u následníka na něm začíná. Čárkovaný okraj s červeným popiskem *zastaralé* znamená, že zdroj nebyl přečten. U ručně zadané vazby to platí vždy.
- Klikněte pravým tlačítkem na vazbu ve sloupci. Nabídka obsahuje *Upravit vazbu mezi projekty…* a *Odstranit závislost*. Pokud má vazba zdrojový soubor, je tam i *Obnovit zdroj*.
- Zvolte *Propojit ▾ › Obnovit všechny vazby mezi projekty*, aby aplikace znovu přečetla zdrojové soubory a aktualizovala kotevní data. To funguje jen v desktopové aplikaci. Pokud máte jen ručně zadané vazby, aplikace hlásí *Žádné zdroje vhodné k obnovení (chybí cesta k souboru).* Po obnovení stiskněte **Přepočítat**.
- Změníte-li typ nebo směr tak, že kotevní datum potřebuje jinou stranu externího úkolu (začátek místo dokončení, nebo naopak), aplikace u ručně zadané vazby požádá o nové kotevní datum: *Vyberte nové kotevní datum: typ závislosti nyní používá druhou stranu zdrojového úkolu.* U vazby se zdrojovým souborem aplikace kotevní datum přečte znovu sama.

## Úskalí a co aplikace dělá

**Druhý projekt se nepřesouvá spolu s vaším.** Pokud se externí úkol posune, váš plán dál počítá se starým kotevním datem, dokud je neobnovíte, nebo kotevní datum nezměníte. U ručního postupu změníte kotevní datum sami. Klikněte pravým tlačítkem na vazbu a zvolte *Upravit vazbu mezi projekty…*.

**Externí předchůdce je dolní mez.** Pokud váš úkol začíná později, než kotevní datum vyžaduje, kvůli vlastním předchůdcům, platí ta závislost. Kotevní datum úkol jen posouvá.

**Externí následník je horní mez.** Pokud je kotevní datum příliš těsné, uvidíte to jako zápornou časovou rezervu u svého úkolu a u úkolů před ním. Žádné samostatné varování se k tomu nezobrazí, proto sledujte sloupec *Celková časová rezerva*.

**Jen pevná prodleva.** U vazby mezi projekty nelze zadat prodlevu v kalendářních dnech ani v procentech. Aplikace hlásí: *Vazby mezi projekty podporují jen pevnou prodlevu v pracovních dnech nebo v pracovní době.* Pracovní dny se počítají podle kalendáře vašeho úkolu. Prodleva v hodinách se počítá jen u úkolu plánovaného v hodinách. U úkolu v dnech ji výpočet ignoruje. V tom případě použijte pracovní dny.

**ID projektu jiného souboru.** ID projektu není v žádném poli ani sloupci. Je uloženo jako `InternalProjectId` v IFC daného projektu: otevřete projekt, přejděte na kartu *IFC* a zvolte *Generovat IFC*. Výpočet používá jen kotevní datum. ID není pouhý popisek. Při obnovení aplikace nejprve pozná zdrojový soubor podle ID projektu, potom podle cesty k souboru. Zadáte-li u ručně vytvořené vazby stejné ID jako u zdrojového souboru, vazba se při obnovení toho souboru aktualizuje spolu s ním. ID úkolu v druhém projektu najdete v tabulce toho projektu, ve sloupci *ID úkolu* pod položkou *Technické*.

## Viz také

- [Závislosti a prodleva](docs://uitleg-relaties): jak aplikace počítá závislost a prodlevu.
- [Přidání závislostí](docs://howto-relaties-leggen): závislosti mezi úkoly ve stejném projektu.
- [Omezení a konečné termíny](docs://uitleg-constraints): omezení termínů úkolu bez jiného projektu.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): obsahuje vazbu mezi projekty u úkolu *Car park paving* (externí předchůdce).
