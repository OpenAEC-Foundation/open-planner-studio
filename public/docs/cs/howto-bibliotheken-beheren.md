# Správa a sdílení knihoven zdrojů

Cíl: vytvářet a odstraňovat knihovny zdrojů, vkládat do nich kalendáře a exportovat nebo importovat knihovnu jako zálohu nebo pro použití na jiném počítači.

## Kdy to potřebujete

Knihovna zdrojů není v souborech projektu, ale v aplikaci. V desktopové aplikaci je v souboru na tomto počítači. V prohlížeči je v úložišti tohoto prohlížeče. Nesynchronizuje se. Když v prohlížeči smažete data webu, knihovna zdrojů zmizí. Proto ji exportujte jako zálohu. Když chce kolega pracovat se stejnými pracovními četami a standardními sazbami, předáte mu knihovnu také jako soubor. Má-li vaše organizace více provozních společností s vlastními četami, vytvořte pro každou z nich samostatnou knihovnu zdrojů. Pro nový projekt zvolíte, kterou knihovnu zdrojů použije.

Co knihovna zdrojů je, přečtete v článku [Knihovna zdrojů](docs://uitleg-resourcebibliotheek). Zdroje samotné zde neupravujete. Upravujete je v panelu zdrojů. Viz [Použití knihovny zdrojů](docs://howto-resourcebibliotheek-gebruiken).

## Kroky

### Otevřete obrazovku správy

Zvolte *Soubor › Knihovna*. Vlevo je seznam *Knihovny zdrojů*. Vpravo jsou podrobnosti knihovny, na kterou kliknete: název, tlačítka a seznam *Kalendáře*. Nahoře je uvedeno, že zdroje spravujete na kartě *Zdroje*.

### Vytvořte, přejmenujte a zvolte výchozí knihovnu

1. Klikněte na plus nad seznamem (*Přidat knihovnu zdrojů*). Přidá se knihovna *Nová knihovna zdrojů* a hned se vybere.
2. Napište nový název do pole pro název nahoře v pravé části a stiskněte Enter. Nebo klikněte mimo pole. Aplikace nepřijme prázdný název.
3. Klikněte na *Nastavit jako výchozí*. U nových projektů se pak tato knihovna předvybere. Výchozí knihovna má v seznamu hvězdičku.

### Vložte kalendář do knihovny zdrojů

1. Pod seznamem *Kalendáře* klikněte na *Z projektu*. Otevře se seznam kalendářů vašeho aktivního projektu.
2. Klikněte na malou šipku za kalendářem, který chcete převzít. Nad seznamem je uvedeno *Přidáno.* Kalendář, který je už propojen s touto knihovnou, má za názvem *již propojeno*.
3. Kalendář je teď v seznamu *Kalendáře* knihovny. Ikonou tužky (*Upravit*) změníte název. Uložíte ho ikonou zaškrtnutí. Ikona koše kalendář okamžitě odstraní, bez potvrzení. Kopie v projektech zůstanou.

Za *Kalendáře* je číslo verze, například *v2*. Při každé změně knihovny se zvýší. Kalendář knihovny se přenese do projektu, když přiřadíte zdroj, který ho používá. Přiřadíte ho zdroji na kartě *Zdroje*, v zobrazení *Knihovna*, ve sloupci *Kalendář*.

### Exportujte knihovnu

1. Zvolte knihovnu v seznamu.
2. Klikněte na *Exportovat*.
3. V desktopové aplikaci a v prohlížečích Chrome a Edge zvolíte, kam se soubor uloží. V jiných prohlížečích se soubor uloží rovnou do složky pro stahování. Aplikace vám to řekne. Soubor se jmenuje `bibliotheek-` následovaný názvem knihovny, s koncovkou `.ifc`.

Pod tlačítky je uvedeno *Export je zároveň vaše záloha: uložte soubor na bezpečné místo.*

### Importujte knihovnu

1. Klikněte na *Importovat*. Otevře se okno *Importovat knihovnu zdrojů* pro knihovnu, kterou jste v seznamu vybrali.
2. Klikněte na *Vybrat soubor…* a vyberte soubor `.ifc` z exportu. Když soubor knihovnu neobsahuje, je uvedeno *Tento soubor IFC neobsahuje knihovnu zdrojů.*
3. Aplikace ukáže, co soubor obsahuje, například *Kalendáře: 2, zdroje: 5 (verze 3).*
4. Zvolte, co chcete udělat. Viz níže.
5. Klikněte na *Přidat* nebo *Nahradit*. Chcete-li import ukončit, klikněte na *Zrušit*.

Máte dvě možnosti:

- *Přidat jako novou knihovnu zdrojů*: soubor se stane samostatnou knihovnou vedle vašich stávajících knihoven. Pod tím je uvedeno, pod jakým názvem, například *Bude přidána jako „Mijn resourcebibliotheek (2)“.* Nic se neztratí a váš aktivní projekt zůstane propojen se svou vlastní knihovnou.
- *Nahradit existující knihovnu zdrojů*: celý obsah zvolené knihovny se nahradí obsahem ze souboru. Aplikace to také uvádí: *Import nahradí CELÝ obsah vybrané knihovny zdrojů.* Máte-li dvě nebo více knihoven, zvolíte ji v poli *Importovat do knihovny zdrojů*. Je-li vaše knihovna novější než soubor, aplikace varuje: *Vaše lokální knihovna zdrojů je novější — import může přepsat vaše změny.*

Aplikace navrhne volbu sama. U souboru, který obsahoval výchozí knihovnu zdrojů, je předvybráno *Přidat jako novou knihovnu zdrojů*. Pokud knihovna ze souboru už na vašem počítači existuje a není výchozí, je předvybráno *Nahradit existující knihovnu zdrojů* a zvolena právě tato knihovna. Když si nejste jistí, zvolte přidání. Tím nic nepřepíšete.

### Odstraňte knihovnu

1. Zvolte knihovnu v seznamu a klikněte na *Odebrat knihovnu zdrojů*. Tlačítko je u poslední knihovny šedé, protože vždy zůstane jedna.
2. Potvrďte tlačítkem *Odstranit*. Otázka zní *Odebrat tuto knihovnu zdrojů?* Jsou-li k ní propojeny otevřené projekty, je uvedeno *Tato knihovna zdrojů je propojena s 1 otevřeným projektem. Odebráním se propojení tohoto projektu zruší. Pokračovat?* U více projektů je uvedeno totéž s počtem, například *propojena s 2 otevřenými projekty*.

Knihovna je potom pryč i se všemi zdroji a kalendáři v ní. Otevřené projekty, které ji používaly, se odpojí. Jejich zdroje zůstanou jako běžné zdroje projektu. Chcete-li obsah zachovat, nejprve knihovnu exportujte.

### Předejte projekt spolu s knihovnou

Soubor projektu obsahuje vlastní kopie zdrojů. Chcete-li také předat celou knihovnu, postupujte takto. Samotný export je také popsán v článku [Exportování](docs://howto-exporteren).

1. Otevřete projekt, který je propojen s knihovnou, a zvolte *Soubor › Export*.
2. Zaškrtněte *Uložit soubor knihovny zdrojů vedle*. Zaškrtávací pole je tu jen pro propojený projekt.
3. Zvolte dlaždici *IFC 4x3* a soubor uložte. Aplikace potom ještě žádá druhý soubor. Jmenuje se stejně jako projekt, za jménem má `-bibliotheek` a obsahuje knihovnu.

Zaškrtávací pole funguje jen pro export IFC, ne pro ostatní formáty exportu. Váš kolega importuje druhý soubor, jak je popsáno výše.

## Úskalí a co aplikace potom udělá

**Dva plánovači, dvě knihovny.** Aplikace nesynchronizuje knihovny mezi počítači. Okno importu o tom vždy zobrazí varování: *Poznámka: knihovny se mezi počítači nesynchronizují. Pokud dva plánovači pracují se stejnou knihovnou zdrojů, mohou se jejich knihovny rozejít. Pokud vaše organizace sdílí čety mezi provoznými společnostmi, zvolte záměrně jednu sdílenou knihovnu zdrojů.*

**Nahrazení přepíše všechno.** Vše, co jste měli ve zvolené knihovně, je pryč. Změna knihovny nespadá pod *Vrátit zpět*. Nejste-li si jistí, nejprve knihovnu exportujte.

**Odstranění kalendáře ze seznamu proběhne okamžitě.** Aplikace nežádá o potvrzení, kdežto při odstranění zdroje ano. To vypadá jako nedostatek. Změny knihovny nespadají pod *Vrátit zpět*.

## Viz také

- [Knihovna zdrojů](docs://uitleg-resourcebibliotheek): jak spolu souvisí knihovna a projekt.
- [Použití knihovny zdrojů](docs://howto-resourcebibliotheek-gebruiken): propojení zdrojů, jejich přiřazení a řešení odchylek.
- [Exportování](docs://howto-exporteren): formáty exportu, včetně IFC se souborem knihovny zdrojů.
