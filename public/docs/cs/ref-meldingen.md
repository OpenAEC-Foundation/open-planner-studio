# Oznámení a varování

Aplikace vám ukazuje, co se děje, na třech místech: stavový řádek dole, panel *Varování* v pravém sloupci a oznámení, která se krátce objeví dole na obrazovce. Tento článek popisuje u každého místa, co uvidíte, kdy se to objeví a co s tím můžete udělat. Proč je plán kritický a proč vzniká přetížení, popisuje [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad); řešení přetížení je v [Řešení přetížení](docs://howto-overbezetting-oplossen); vytváření závislostí je v [Vytváření závislostí](docs://howto-relaties-leggen).

## Rozdíl mezi těmito třemi

- **Stavový řádek** — pevný řádek s počítadly. Pocházejí z posledního přepočtu a zůstanou, dokud znovu nepřepočítáte.
- **Panel varování** — seznam za těmito počítadly, se vším, co našel poslední přepočet. Kliknutím se dostanete k úkolu, závislosti nebo zdroji. Vychází z posledního přepočtu; nic se neukládá.
- **Oznámení** — krátké zprávy o tom, co jste právě udělali (uložení se nezdařilo, závislost byla odmítnuta, import byl přečten). Zase zmizí a nejsou v panelu.

## Stavový řádek

Stavový řádek dole zobrazuje zleva doprava:

- **Úkoly:** — počet listových úkolů (souhrnné úkoly se nepočítají).
- **Milníky:** — počet milníků.
- **Kritická cesta: N úkolů, N pracovních dnů** — počet kritických úkolů a doba trvání projektu. Zobrazí se jen po přepočtu.
- **Dokončení:** — dokončení projektu z přepočtu. Zobrazí se jen po přepočtu; prázdný projekt žádné nemá.
- **N nesplněných konečných termínů**, **N porušených omezení**, **N závislostí s průběhem mimo posloupnost** a **N zdrojů s přetížením** — každé je tlačítko s varovnou značkou. Zobrazí se jen tehdy, když je počítadlo vyšší než 0 a existuje přepočet. Kliknutím se otevře panel *Varování* (bublina nápovědy: *Otevřít panel varování (podrobnosti a navigace)*). Pokud jste na kartě *IFC* nebo *Sestava*, aplikace zároveň přejde na *Domů*, protože pravý sloupec tam neexistuje. Počítadlo **N zdrojů s přetížením** se obnoví také po změnách zdrojů a přiřazení; ostatní počítadla se změní až po přepočítání (*Přepočítat*). Čtyři počítadla jsou výběr: co panel navíc ukazuje (ořezaný předstih, ignorovaná závislost, překlenovací úkol bez hnací vazby dokončení, omezené datum dokončení, chyba plánu), ve stavovém řádku není.
- **Plán je zastaralý — přepočítejte (F5)** — s varovnou značkou (bublina nápovědy: *Plán je zastaralý — přepočítejte (F5)*). Zobrazí se, jakmile změníte něco, co ovlivní plán, a ještě nepřepočítáte. Pokud je zapnutá možnost *Automaticky přepočítat*, zůstane skryto, kromě případu, kdy přepočet skončil chybou; pak zůstane zobrazeno.
- **Výběr: N úkol(ů)** — počet vybraných úkolů; zobrazí se jen při výběru.
- **Měřítko:** a **Zoom: Npx/den** — měřítko časové osy a úroveň zoomu. Měřítko se řídí zoomem.
- **Neuloženo** — dokud má dokument změny, které nejsou v souboru.
- **AI** — barevná tečka se slovem AI, jen když je zapnutý režim AI. Bublina nápovědy říká *Most AI:* s *Vypnuto*, *Aktivní na portu N*, *Port N je obsazen* nebo *Chyba*. Kliknutím otevřete kartu *AI*.
- **Ladicí terminál** — tlačítko terminálu, jen když je ladicí terminál zapnutý; zobrazí nebo skryje terminál (*Zobrazit ladicí terminál* / *Skrýt ladicí terminál*).

## Panel varování

- **Otevření** — v nabídce *Plán › Plán › Varování*, v nabídce *Zobrazení › Panely › Varování*, nebo počítadlem ve stavovém řádku. Panel je v pravém sloupci pod panelem *Vlastnosti* a dokem zdrojů; když je sloupec sbalený, rozbalí se. Ve výchozím stavu je zavřený a mezi spuštěními aplikace se nepamatuje. Když je pod jinými panely, změníte jeho výšku tažením za okraj; tato výška se pamatuje. Křížek vpravo nahoře jej zavře (*Zavřít varování*).
- **Řádek záhlaví** — *Chyby: N, varování: N*. Pokud zatím nic nebylo přepočítáno, říká *Zatím nepřepočítáno — stiskněte Přepočítat (F5) a spusťte kontroly.*
- **Přepočítat** — tlačítko v řádku záhlaví. Zobrazí se, dokud je plán zastaralý nebo ještě nepřepočítaný. Dělá totéž co *Přepočítat* na pásu karet.
- **Varovná značka v řádku záhlaví** — když je plán zastaralý, s bublinou nápovědy *Plán je zastaralý — tento seznam pochází z posledního přepočtu. Přepočítat (F5).* Seznam se neskryje, jen se označí jako zastaralý.
- **Prázdný seznam** — *Žádná varování. Plán splňuje všechny kontroly.*
- **Řádek** — nahoře místo (úkol, závislost, zdroj nebo projekt) a pod ním popis. Chyba má vlastní osmiúhelníkovou značku, varování trojúhelníkovou. Úkol se zobrazí jako `název WBS`. Závislost se zobrazí jako `předchůdce → následník (FS+2d)`, s typem a prodlevou. Kliknutím přejdete na místo (bublina nápovědy *Přejít na: …*), viz níže. Řádek, který patří vašemu aktivnímu úkolu (u závislosti jejímu následníkovi) nebo zdroji zvolenému v histogramu, je zvýrazněn.
- **Pořadí** — nejdřív chyby. Potom podle druhu, v pořadí seznamu níže. Uvnitř druhu v pořadí dokumentu (u závislosti podle následníka, u zdroje podle seznamu zdrojů). Úkol, závislost nebo zdroj, který se smazal po posledním přepočtu, z výpisu zmizí.

### Druhy varování

- **Chyba plánu** — *Plán nelze přepočítat: …* s důvodem za tím, viz níže. Kliknutím: u cyklu aplikace vybere všechny úkoly v cyklu a přejde na první; u jiných chyb není kam přejít a řádek není tlačítko.
- **Konečný termín nesplněn** — *Konečný termín {date} nesplněn — nejdřívější dokončení {date}*. Úkol má konečný termín a přepočet ho nesplňuje. Kliknutím přejdete na úkol. Oprava: upravte logiku nebo dobu trvání, nebo posuňte konečný termín.
- **Porušené omezení** — *Omezení {type and date} je přepsáno logikou (záporná časová rezerva)*. Omezení nejde splnit, aniž by se porušila logika; časová rezerva je záporná. Kliknutím přejdete na úkol. Viz [Omezení](docs://uitleg-constraints).
- **Mimo posloupnost** — *Mimo posloupnost: průběh následníka je v rozporu se závislostí*. Průběh následníka neodpovídá typu závislosti, například když následník už probíhá, ale předchůdce u závislosti dokončení-zahájení ještě není dokončen. Kliknutím vyberete oba úkoly; následník je aktivní. Zkontrolujte skutečné datumy nebo závislost.
- **Předstih ořezán** — *Předstih ořezán zahájením projektu — závislost není plně využita*. Předstih (záporná prodleva) závislosti sahá před zahájení projektu. Kliknutím vyberete oba úkoly.
- **Závislost ignorována** — *Závislost ignorována: předchůdce nebo následník chybí, nebo není listový úkol*. Přepočet tuto závislost nepoužije. Kliknutím vyberete úkoly, které ještě existují. Viz [Závislosti](docs://uitleg-relaties).
- **Překlenovací úkol bez hnací vazby dokončení** — *Překlenovací úkol bez hnací vazby dokončení (žádný předchůdce FF/SF): doba trvání klesne na nulu*. Kliknutím přejdete na úkol. Viz [Překlenovací úkoly](docs://howto-hammock).
- **Datum dokončení omezeno** — *Datum dokončení omezeno: kalendář nenechává pro úkol žádné pracovní okno*. Přepočet narazil na limit počtu dnů, které prohledává, například kvůli velmi dlouhému souvislému úseku volna v kalendáři. Kliknutím přejdete na úkol. Viz [Kalendáře a pracovní dny](docs://uitleg-kalenders).
- **Přetížení** — *Přetížení v počtu dnů: N (první – poslední)*, s přidanou větou *zdroj v těchto dnech podle svého kalendáře nepracuje*, pokud jsou všechny dny volno, nebo *z toho N dnů zdroj podle svého kalendáře nepracuje*, pokud jde o směs. Kliknutím vyberete úkoly s přiřazením na tomto zdroji, zapnete histogram a v něm zvolíte tento zdroj. Z karet *Tabulka*, *IFC* nebo *Sestava* aplikace přejde na *Zdroje*. Viz [Panel zdrojů](docs://ref-resourcepaneel).

### Důvody chyby plánu

- *Cyklus závislostí mezi úkoly: {path}* — závislosti tvoří cyklus. Úkoly jsou v cestě; obraťte nebo odstraňte jednu závislost.
- *Kalendář nemá nastaveny žádné pracovní dny* — v kalendáři nastavte alespoň jeden pracovní den, viz [Okna kalendáře](docs://ref-kalenders).
- *Neplatná doba trvání v dnech pro úkol '{task}'* a *Neplatná doba trvání v hodinách pro úkol '{task}'* — doba trvání úkolu není platné číslo.
- *Hodinový úkol '{task}' nemá v kalendáři platné pracovní hodiny* — úkol v hodinách v kalendáři bez pracovních hodin.
- *Neplatné datum začátku pro úkol '{task}'* — datum začátku úkolu není platné.

## Oznámení

Oznámení se zobrazují v dolní části obrazovky, také v tabulce, v Backstage a v režimu prezentace. Oznámení je *chyba* nebo *informace*. Chyba zůstane, dokud ji kliknutím nezavřete. Informace zmizí po 5 sekundách. Časovače začnou znovu, jakmile se seznam oznámení změní. Kliknutím na oznámení ho zavřete (popisek *Zavřít oznámení*). Najednou se zobrazí nejvýše tři oznámení. Když přijde čtvrté, nejdřív zmizí nejstarší informace. Pokud žádná informace není, zmizí nejstarší oznámení. Chyba tak nikdy nezmizí kvůli informaci. Seznam oznámení se posune mimo tlačítka otevřeného dialogu a mimo pevné lišty s akcemi.

- **Počítadlo ×N** — oznámení s pevným klíčem spojí opakování do jednoho řádku s počítadlem. Například chyba při ukládání, která se stále vrací, nebo závislost, kterou aplikace odmítla a vy ji opakovaně zkoušíte vytvořit. Ne každé oznámení to dělá.
- **Číst více** — některá oznámení mají volbu *Číst více* nebo vlastní téma (například *Vysvětlení pravidel pevné veličiny*), které vede do průvodce v Backstage › Nápověda.
- **Tlačítko akce** — oznámení o profilu výpočtu má tlačítko *Otevřít profil výpočtu*, které vede do sekce Informace o projektu.

Seznam níže je výběr seskupený podle témat. Pokud není uvedeno jinak, jde o informaci.

### Ukládání, otevírání a zotavení systému po chybě

- **Ukládání selhalo** (chyba) — *Uložení se nezdařilo* a pod tím důvod. Zobrazí se při ukládání, ukládání jako a při exportu sestavy.
- **Uloženo jako stažení** (informace) — *Uloženo jako stažení: „{name}“ je nyní ve složce Stahování. …* Zobrazí se u *Uložit jako* a při exportech, když prostředí neumožní aplikaci zapsat přímo na místo, které jste zvolili. Dvě stažení těsně za sebou se sloučí.
- **Uloženo jako stažení (vysvětlení)** (informace) — *Uloženo jako stažení: „{name}“ je ve složce Stahování. Tento prohlížeč neumožňuje aplikaci zapisovat na vlastní místo, …* Zobrazí se u *Uložit* v prohlížeči, který ukládá jen stažením. Jednou za sezení, s možností přejít na vysvětlení souborů.
- **Prohlížeč nezapisuje zpět** (informace) — *Tento prohlížeč neumožňuje aplikaci zapsat zpět do „{name}“. …* Zobrazí se u *Uložit* projektu, který má soubor, když musí prohlížeč znovu požádat o místo. Jednou za sezení, s možností přejít na vysvětlení souborů.
- **Automatické ukládání selhalo** (chyba) — *Automatické ukládání se nezdařilo* a důvod. Platí pro automatické ukládání do souboru i pro zotavení systému po chybě.
- **Knihovnu zdrojů nelze uložit** (chyba) — *Knihovnu zdrojů nelze uložit*, při ukládání knihovny zdrojů.
- **Otevření souboru selhalo** (chyba) — *Otevření souboru se nezdařilo* a důvod. Například u nedávno otevřeného souboru nebo u importovaného souboru.
- **Starý nebo chráněný soubor .mpp** (chyba) — *Tento soubor .mpp má starší formát (Project 2007 nebo starší)…* nebo *Tento soubor .mpp je chráněn heslem…*, obojí s radou exportovat soubor jako XML v MS Project a otevřít tento soubor.
- **Neplatný soubor XER** (chyba) — jeden z textů *XER…*, například *Tento soubor není platný nebo podporovaný soubor XER.* nebo *Soubor XER obsahuje duplicitní tabulku.*, s přidaným důvodem.
- **IFC nelze načíst** (chyba) — *IFC nelze načíst* s důvodem v zobrazení IFC.
- **Zotavení** (chyba) — *Obnovený soubor se nepodařilo přečíst*, *Obnovení se nezdařilo* a *N obnovovacích souborů se nepodařilo načíst a bylo přeskočeno.* Zobrazí se při zotavení po neočekávaném vypnutí.
- **Větev uložena jako šablona** (informace) — *Větev uložena jako šablona „{name}“*.
- **Hlášení z rozšíření** (informace, nebo chyba, pokud rozšíření hlásí chybu) — *Rozšíření {name}: {message}*. Rozšíření smí zobrazit nejvýše tři nová oznámení za 10 sekund, aby seznam nezaplnilo. Pokud krok průvodce rozšíření selže, zobrazí se *Krok rozšíření {name} selhal. Průvodce pokračuje.*, a pokud nejde otevřít soubor projektu rozšíření, zobrazí se *Soubor projektu {file} z rozšíření {name} se nepodařilo otevřít.* Obě jsou chyby.
- **Změna mezitím** (informace) — *Změna od AI asistenta nebo rozšíření přišla mezitím. …* Zobrazí se, když zrušíte dialog úkolu, zatímco AI nebo rozšíření mezitím něco změnilo. Úpravy úkolu z doby před touto změnou se nevrátí a zůstanou jako běžné kroky pod *Vrátit zpět*.

### Výpočet

- **Plán nelze přepočítat** (chyba) — *Plán nelze přepočítat* a pod tím důvod (viz *Důvody chyby plánu*). Zobrazí se po kliknutí na *Přepočítat*, při přepnutí dokumentu a při otevření souboru.
- **Datum stavu nastaveno na dnešek** (informace) — *Datum stavu zatím nebylo nastaveno: nyní je nastaveno na dnešek ({date}), protože průběh se měří až do data stavu. Změnit ho lze na kartě Plán → Datum stavu.* Zobrazí se při zadávání průběhu v projektu bez data stavu.
- **Doba trvání kratší než provedená práce** (informace) — *Úkol „{name}“ je již dokončen z {N} %: doba trvání nemůže být kratší než již provedená práce. Doba trvání nebyla změněna.*

### Závislosti a hierarchie

- **Závislost vytvořena** (informace) — *Závislost vytvořena: {predecessor} → {successor}*.
- **Závislost odmítnuta** (informace) — *Tato závislost již existuje*, *Závislost mezi úkolem a jeho vlastním nadřazeným souhrnným úkolem (i vyšším) není povolena.* nebo *Tato závislost by v plánu vytvořila cyklus ({cycle}) a nebyla vytvořena.* Cyklus uvádí úkoly, takže víte, kterou závislost nejdřív odstranit nebo obrátit.
- **Přesun odmítnut** (informace) — *Toto přesunutí by vytvořilo cyklus v plánu ({cycle}): závislosti souhrnného úkolu platí také pro jeho dílčí úkoly. Nic nebylo přesunuto.*
- **Závislosti po přesunu vypadnou** (informace) — *Po přesunutí spojují N závislosti úkol s jeho vlastním souhrnným úkolem; ty se již do výpočtu nezapočítávají.*
- **Závislosti přeskočeny při vložení** (informace) — *N závislostí nebylo vytvořeno: neplatné propojení…*, při vložení nebo vkládání větve.
- **Závislosti po importu nezapočítány** (informace) — *Nepodařilo se zahrnout N závislost(i) do výpočtu. Zkontrolujte sloupce Předchůdci a Následníci.*
- **Duplicitní id po importu** (informace) — *Objekty s duplicitním id v tomto souboru: N. Dostaly vlastní id…*

### Úprava úkolů

- **Začátek zapsán jako omezení** (informace) — *„{name}“ má předchůdce: nový začátek je zapsán jako omezení Zahájit nejdříve (SNET) {date}. Po přepočítání (F5) úkol nezačne před tímto datem.* Zobrazí se, když změníte začátek úkolu s předchůdcem. Pokud úkol už takové omezení měl, oznámení říká, že se omezení přesunulo. U několika úkolů najednou uvádí počet.
- **Začátek nebyl použit** (informace) — *Nový začátek úkolu „{name}“ nebyl použit: úkol má předchůdce a omezení {type} {date}, a tyto určují jeho začátek. Změňte toto omezení, abyste začátek posunuli.*
- **Úkol nelze převést na milník** (informace) — *'{task}' má přiřazení zdrojů a nemůže se stát milníkem. Nejprve odeberte přiřazení.* nebo *'{task}' je souhrnný úkol s dílčími úkoly a nemůže se stát milníkem.* Zobrazí se při převodu v dialogu úkolu, v panelu vlastností, v kontextové nabídce a v tabulce.
- **Přiřazení přesunuta do dílčího úkolu** (informace) — *Přiřazení {resources} bylo přesunuto z úkolu '{phase}' do nového dílčího úkolu '{child}': souhrnný úkol sám žádná přiřazení nenese.* Zobrazí se, když úkol s přiřazeními dostane dílčí úkoly.
- **Označení milníku odstraněno** (informace) — *Milník '{phase}' má nyní dílčí úkoly a stal se souhrnným úkolem; označení milníku bylo odstraněno.*
- **Souhrnný úkol odmítnut** (informace) — *„{phase}“ nemůže být souhrnným úkolem: …* s důvodem a *Nic nebylo změněno.*
- **Buňky přeskočeny při vložení** (informace) — *Přeskočeno N buněk: jsou jen pro čtení (například automaticky číslovaný kód WBS nebo vypočítaný sloupec).*
- **Odkazy vymazány při vložení** (informace) — *N propojení v tomto dokumentu neexistovalo a bylo vymazáno (kalendáře úkolů, vlastní typy úkolů, kódy aktivit nebo vlastní pole ze zdrojového dokumentu).*
- **Doba trvání upravena pravidlem pevné veličiny** (informace) — *Pravidlo pevné veličiny po změně kalendáře upravilo dobu trvání: N úkolů (práce zůstává, hodiny za den se změnily).* S volbou *Vysvětlení pravidel pevné veličiny*.

### Primavera (XER)

- **Soubor XER otevřen** (informace) — *Soubor XER otevřen: N projektových dokumentů.* Jedno oznámení na soubor, i když soubor otevře několik projektů, s volbou *Číst více* a podrobnostmi pod ním. Vždy se zobrazí *Nalezeno N projektů.* Jen když je počet vyšší než 0: *Přeskočeno N prázdných projektů.*, *Vyloučeno N projektů směrného plánu.*, *Vytvořeno N směrných plánů.*, *Ignorováno N osiřelých propojení na směrný plán.*, *Byl použit ochranný záložní směrný plán.* a *Zachováno N vazeb mezi projekty.* Jen u kódování jiného než UTF-8: *Kódování textu zjištěno jako {encoding}.* Dále, když je počet vyšší než 0: *N nálezů parseru.*, *N nálezů kalendáře.*, *N problémů se zápisem čísel.*, *N záložních hodnot výčtu* a *N nastavení plánování P6 používají bezpečnou záložní hodnotu.*
- **Data tak, jak je uložila Primavera** (podrobnost ve stejném oznámení) — *N úkolů zobrazuje data tak, jak je Primavera uložila (bez přepočtu).*, nebo, pokud se režim nezapnul, *N úkolů se liší od dat v souboru – můžete je zobrazit.*
- **Zdrojový archiv XER nelze použít** (informace) — *Zdrojový archiv XER v tomto souboru je nepoužitelný a byl vynechán; samotný projekt byl otevřen úplně.* S důvodem (například *Důvod: kontrolní součet neodpovídá zdrojovým bajtům – archiv je poškozen*) a důsledkem (*Plán, profil výpočtu a všechna data projektu z IFC jsou úplná. …*). Zobrazí se při otevření souboru IFC, ve kterém nelze použít dříve uložený zdrojový archiv XER.
- **Export ztratí informace XER** (informace) — *Při exportu do formátu {format} se ztratí zdrojové informace XER.* Zobrazí se po úspěšném exportu do jiného formátu než IFC u projektu s daty, která existují jen v souboru XER. S volbou *Číst více*.

### Import, export a profil výpočtu

- **Data jako v souboru** (informace) — *N úkolů zobrazuje data tak, jak jsou uložena v souboru (bez přepočtu).* nebo *N úkolů se liší od dat v souboru – můžete je zobrazit.* Zobrazí se při otevření souboru se zaznamenanými daty.
- **Práce a pravidla pevné veličiny jsou vidět** (informace) — *Tento soubor obsahuje uloženou práci nebo vlastní pravidla pevné veličiny; pravidlo pevné veličiny a zbývající práce jsou v tomto projektu viditelné.*
- **Plán z MS Projectu načten** (informace) — *Tento soubor MS Project obsahuje N úkolů s přerušením práce, vyrovnáním nebo plánováním řízeným zdroji. Jsou takto načteny a zobrazeny.*
- **Přerušení nebyla exportována** (informace) — *N úkolů s přerušeními práce bylo exportováno bez přerušení práce: MS Project a P6 znají přerušení pouze jako rozložení práce.* Zobrazí se při exportu do MS Projectu nebo Primavery.
- **Zahájení projektu posunuto** (informace) — *Zahájení projektu posunuto: N kotev úkolů bez předchůdce nebo omezení bylo posunuto na nové datum zahájení.*
- **Časové okno už neřídí** (informace) — *Časové okno MS Projectu po této úpravě už neřídí N úkolů; …* Jednou za dokument.
- **Zpoždění vyrovnání zaokrouhleno** (informace) — *Vyrovnání zaokrouhluje zpoždění vyrovnání z MS Project (přesné na minuty) na celé pracovní dny. Týká se N úkolů.* Jednou za dokument.
- **Profil výpočtu použit** (informace) — *Tento projekt se počítá jako {profile}. Změnit to lze v Soubor → Informace o projektu → Profil výpočtu a možnosti výpočtu.* S tlačítkem *Otevřít profil výpočtu*. Po použití profilu následuje, pokud je potřeba, *Po použití se posunulo N úkolů.*
