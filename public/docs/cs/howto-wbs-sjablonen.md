# Ukládání a vkládání šablon WBS

Cíl: uložit fázi s jejími dílčími úkoly a závislostmi jako šablonu a později ji znovu vložit do stejného nebo jiného projektu.

## Kdy to potřebujete

Pořád plánujete stejný druh práce. Každý dům má základy se zemními pracemi, výztuží, betonáží a ošetřováním betonu. Místo toho, abyste ty úkoly pokaždé znovu vytvářeli a propojovali, uložíte fázi jednou jako **šablonu**. Šablona je větev vaší WBS: jeden úkol se vším, co je pod ním.

## Postup

### Uložení větve jako šablony

1. Sestavte větev tak, jak ji chcete znovu použít: souhrnný úkol s dílčími úkoly a závislostmi mezi nimi.
2. Klikněte pravým tlačítkem na ten souhrnný úkol a zvolte *Uložit větev jako šablonu*. Tato položka nabídky se zobrazí jen u úkolů s dílčími úkoly.

Aplikace zobrazí hlášení *Větev uložena jako šablona „Foundation“*. Aplikace se nezeptá na název: šablona dostane název podle horního úkolu větve.

### Vkládání šablony

1. Vyberte úkol, pod který má šablona patřit, nebo nevyberte nic.
2. Zvolte na kartě *Plán › Struktura › Šablony*. Seznam ukazuje název každé šablony a například *Úkoly: 4, závislosti: 2*.
3. Klikněte na šablonu.

Když je vybraný úkol, šablona se vloží jako poslední dílčí úkol pod tento úkol. Tento úkol se tím stane souhrnným úkolem. Když je vybráno více úkolů, rozhodne ten, na který jste klikli jako první. Když nic nevyberete, větev se vloží na konec seznamu, na nejvyšší úroveň. Vložená větev se potom vybere.

Všechny vložené úkoly začínají datem zahájení projektu a plán už není aktuální. Stiskněte **Přepočítat** (F5), například na kartě *Domů › Plán › Přepočítat*, a data se nastaví podle závislostí. Vložení se dá vrátit jedním krokem příkazem *Vrátit zpět*. Uložení nebo odstranění šablony do tohoto kroku nepatří.

### Odstranění šablony

Otevřete na kartě *Plán › Struktura › Šablony* a klikněte na malý koš vpravo od šablony (*Odstranit šablonu*). Aplikace nežádá o potvrzení.

### Co šablona obsahuje

Pro každý úkol šablona uchovává název, popis, typ úkolu, to, zda je milníkem, a dobu trvání ve dnech. Ze závislostí zachovává jen ty mezi dvěma úkoly uvnitř větve, včetně typu a prodlevy.

Ostatní se neuloží: data, průběh a skutečná data, přiřazení zdrojů, kódy a vlastní pole (viz [Kódy a vlastní pole](docs://howto-codes-en-velden)), kalendář, omezení a konečné termíny, prioritu, vlastní typ úkolu, u milníku druh a zaškrtávací políčko *Povinný (smluvní)*, a závislosti s úkoly mimo větev. Po vložení je doplníte znovu: přiřazení, kódy, kalendář a omezení jsou prázdné a všechny úkoly začínají datem zahájení projektu.

Úkol v hodinách se vrátí jako úkol ve dnech a jeho doba trvání se převede na zlomek pracovního dne. Úkol s dobou trvání 5 hodin se při pracovním dni 8 hodin změní na 0,625 dne.

## Úskalí a chování aplikace

**Šablony nepatří k projektu.** Aplikace je uchovává v úložišti aplikace na tomto zařízení, ne v souboru projektu. Kolega, který otevře váš soubor, vaše šablony nevidí. Ve webové verzi šablona patří danému prohlížeči. Pokud jsou pro vás šablony důležité, uložte je i jinde: vložte je do projektu, který uložíte jako soubor.

**Stejný název se může objevit vícekrát.** Když větev uložíte dvakrát, seznam obsahuje dvě šablony se stejným názvem. Aplikace nic nepřepisuje.

**Doba trvání horního úkolu se nepoužije.** Souhrnný úkol získá dobu trvání z dílčích úkolů, jakmile provedete přepočítání.

**Úkol s přiřazeními zdrojů jako cíl.** Když vyberete úkol s přiřazeními, který zatím nemá dílčí úkoly, a vložíte pod něj šablonu, aplikace to odmítne. Úkol by se stal souhrnným úkolem a ten přiřazení nenese. Horní úkol šablony má vlastní dílčí úkoly, takže přiřazení nemají kam jít. Aplikace vás upozorní a nic nezmění. Potom zvolte jiný úkol nebo žádný jako místo. Milník, který dostane šablonu, ztratí příznak milníku. Aplikace o tom zobrazí zprávu.

**Neplatná závislost v šabloně.** Když závislost v šabloně není povolena, například úkol na vlastní fázi, nebo už existuje, aplikace ji přeskočí a řekne vám, kolik závislostí přeskočila.

## Viz také

- [Úprava struktury](docs://howto-structuur-aanpassen): přesunete vloženou větev nebo použijete příkaz *zvětšit odsazení*.
- [Přidávání závislostí](docs://howto-relaties-leggen): vytvoříte závislosti uvnitř větve sami, dřív než ji uložíte.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): co se stane s vloženou větví po přepočítání.
