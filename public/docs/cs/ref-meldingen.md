# Oznámení a varování

Aplikace vám ukazuje, co se děje, na čtyřech místech: stavový řádek dole, panel *Varování* v pravém sloupci, oznámení, která se krátce objeví dole na obrazovce, a proužky pod pásem karet. Tento článek popisuje u každého místa, co uvidíte, kdy se to objeví a co s tím můžete udělat. Proč je plán kritický a proč vzniká přetížení, popisuje [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad); řešení přetížení je v [Řešení přetížení](docs://howto-overbezetting-oplossen); vytváření závislostí je v [Vytváření závislostí](docs://howto-relaties-leggen).

## Rozdíl mezi těmito čtyřmi

- **Stavový řádek** — pevný řádek s počítadly. Pocházejí z posledního přepočtu a zůstanou, dokud znovu nepřepočítáte.
- **Panel varování** — seznam za těmito počítadly, se vším, co našel poslední přepočet. Kliknutím se dostanete k úkolu, závislosti nebo zdroji. Vychází z posledního přepočtu; nic se neukládá.
- **Oznámení** — krátké zprávy o tom, co jste právě udělali (uložení se nezdařilo, závislost byla odmítnuta, import byl přečten). Informace zase zmizí, chyba zůstane, dokud ji nezavřete. Nejsou v panelu.
- **Proužek pod pásem karet** — barevný proužek s vysvětlením a jedním tlačítkem. Patří ke stavu dokumentu nebo režimu a zůstane, dokud tento stav platí. Viz *Proužky pod pásem karet*.

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

## Proužky pod pásem karet

Proužek je přímo pod pásem karet, nad pracovní plochou. Má text a jedno tlačítko. Proužek pro režim nemá křížek; ostatní proužky zavřete křížkem. Pět proužků:

- **Režim závislostí** — *Režim závislostí: v diagramu Gantt táhněte z jednoho pruhu na druhý a vytvořte závislost. Esc režim ukončí.* Zůstane, dokud bude zapnutý režim závislostí. Tlačítko: *Zastavit*. Viz [Vytváření závislostí](docs://howto-relaties-leggen).
- **Režim rozdělení úkolu** — *Klikněte na pruh v den, kdy přerušení práce začíná, a táhněte doprava pro jeho délku. Esc režim ukončí.* Zůstane, dokud bude zapnutý režim *Rozdělit úkol*. Tlačítko: *Zastavit*.
- **Plánování v hodinách v souboru** — *Tento soubor obsahuje plánování v hodinách.* Objeví se, když otevřený soubor obsahuje plánování v hodinách, zatímco je vypnuté *Zapnout plánování v hodinách*. Tlačítko: *Zapnout plánování v hodinách*. Viz [Zapnutí plánování v hodinách](docs://howto-urenplanning-aanzetten).
- **Struktura je uzamčena** — *Není k dispozici při filtrování, seskupování nebo řazení*. Objeví se, když aplikace odmítne zvětšit odsazení nebo zmenšit odsazení, protože je tabulka úkolů filtrovaná, seskupená nebo seřazená. Tlačítko: *Vymazat*, které odstraní filtr, seskupení a řazení.
- **Datumy tak, jak jsou uloženy** — po otevření souboru, ve kterém přepočítání posunulo datumy: *Přepočítání posunulo N z M úkolů od datumů v souboru.* s tlačítkem *Zobrazit uložené datumy*. Dokud je zobrazení zapnuté: *Zobrazujete datumy tak, jak jsou uloženy v souboru …* s tlačítkem *Přepočítat*. Viz [Datumy tak, jak jsou uloženy](docs://uitleg-datums-zoals-opgeslagen).

## Oznámení

Oznámení se zobrazují dole na obrazovce, také v tabulce, v Zákulisí a v režimu prezentace. Oznámení je *chyba* nebo *informace*. Chyba je červená a zůstane, dokud kliknete na křížek. Informace zmizí po 5 sekundách (oznámení s velkým množstvím vysvětlení zůstane déle). Časovače začnou znovu, jakmile se zásobník změní. Každé oznámení má vpravo nahoře křížek (popisek *Zavřít oznámení*), který oznámení hned zavře. Kliknutí na text oznámení nic neudělá. Odmítnutí je vždy chyba. Oznámení říká, že aplikace neprovedla něco, co jste udělali, například odmítnutou závislost, dobu trvání, začátek nebo milník. Když se na chvíli odvrátíte, nepřehlédnete je. Odmítnutí zmizí po Ctrl+Z nebo Ctrl+Y a také když přejdete na jiný dokument, protože už není správné. Jiná chyba, například *Uložení se nezdařilo*, zůstane. Platí to i tehdy, když ostatní část stejné akce uspěla, například při vložení do několika buněk. Týká-li se akce několika úkolů, řádek pod oznámením uvede, které úkoly se nezměnily, například *Nezměněno: Foundation, Masonry.* Při více než pěti úkolech končí řádek textem *a dalších N úkolů*. Stejné odmítnutí se při opakování sloučí do jednoho řádku s počítadlem. Nejvýše tři oznámení se zobrazí najednou. Přijde-li čtvrté, odejde nejdříve nejstarší informace. Není-li žádná informace, odejde nejstarší odmítnutí, potom nejstarší trvalé úvodní oznámení a až poté nejstarší chyba. Informace nebo odmítnutí tak nikdy nevytlačí jinou chybu, například *Uložení se nezdařilo*. Zásobník se odsune od tlačítek otevřeného dialogu a od trvalých panelů akcí. Oznámení při otevírání souboru zůstane, dokud na křížek neklikněte, pokud aplikace při otevírání doplnila, nahradila, opravila nebo vynechala data. Jde o řádek s nálezy parseru nebo kalendáře, s problémy se zápisem čísel, se záložními hodnotami výčtu, s nastaveními plánování P6 s bezpečnou záložní hodnotou, s ochranným záložním směrným plánem, s osiřelými propojeními na směrný plán, s úkoly bez plánovaného začátku, kterým se začátek doplnil, se závislostmi mezi projekty nebo s úkoly bez projektu, které se nenačetly (P6 XML), s něčím ze souboru MS Project, co se nenačetlo (MS Project XML a `.mpp`), nebo s nepoužitelným zdrojovým archivem XER. Zůstane také u oznámení o duplicitních ID a o závislostech, které se nepočítají. Obsahuje-li oznámení jen informace bez takové změny (například počet projektů, dokumentů nebo kódování textu), zmizí po 5 sekundách.

- **Počítadlo ×N** — oznámení s pevným klíčem sloučí opakování do jednoho řádku s počítadlem, například chybu při ukládání, která se pořád vrací, nebo odmítnutou závislost, kterou opakujete. Ne každé oznámení to dělá.
- **Číst více** — některá oznámení mají link *Číst více* nebo vlastní téma (například *Typy úkolů vysvětleny*) do příručky v Zákulisí › Nápověda.
- **Tlačítko akce** — oznámení o profilu výpočtu má tlačítko *Otevřít profil výpočtu*, které vede do Informace o projektu.

Seznam níže je výběr seskupený podle témat. Pokud nic jiného neuvádí, jde o informaci.

### Ukládání, otevírání a zotavení systému po chybě

- **Ukládání se nezdařilo** (chyba) — *Uložení se nezdařilo* s důvodem pod ním. Při ukládání, ukládání jako a exportu sestavy.
- **Uloženo jako stažení** (informace) — *Uloženo jako stažení: „{name}“ je nyní ve vaší složce pro stažené soubory. …* Při příkazu *Uložit jako* a při exportech, když prostředí nedovolí aplikaci zapisovat přímo na místo, které jste zvolili. Dvě stažení těsně za sebou se sloučí.
- **Uloženo jako stažení (vysvětlení)** (informace, 15 sekund) — *Uloženo jako stažení: „{name}“ je ve vaší složce pro stažené soubory. Tento prohlížeč nedovolí aplikaci zapisovat na vlastní místo, …* Při příkazu *Uložit* v prohlížeči, který ukládá jen stažením. Jednou za relaci, s linkem na vysvětlení souborů.
- **Prohlížeč nezapisuje zpět** (informace, 15 sekund) — *Tento prohlížeč nedovolí aplikaci zapisovat zpět do „{name}“. …* Při příkazu *Uložit* projektu, který má soubor, když musí prohlížeč znovu žádat o místo. Jednou za relaci, s linkem na vysvětlení souborů.
- **Automatické ukládání se nezdařilo** (chyba) — *Automatické ukládání se nezdařilo* s důvodem. Platí pro automatické ukládání do souboru a pro zotavení systému po chybě.
- **Knihovnu zdrojů nelze uložit** (chyba) — *Knihovnu zdrojů nelze uložit*, při ukládání knihovny zdrojů.
- **Otevření souboru se nezdařilo** (chyba) — *Otevření souboru se nezdařilo* s důvodem. Například u nedávného souboru nebo importovaného souboru.
- **Starý nebo chráněný .mpp** (chyba) — *Tento soubor .mpp používá starší formát (Project 2007 nebo starší)…* nebo *Tento soubor .mpp je chráněn heslem…*, obě s radou exportovat soubor v MS Project jako XML a otevřít tento soubor.
- **Neplatný soubor XER** (chyba) — jeden z textů *XER…*, například *Tento soubor není platný nebo podporovaný soubor XER.* nebo *Soubor XER obsahuje duplicitní tabulku.*, s přidaným důvodem.
- **IFC nelze načíst** (chyba) — *IFC nelze načíst* s důvodem v zobrazení IFC.
- **Obnovení** (chyba) — *Obnovený soubor se nepodařilo přečíst*, *Obnovení se nezdařilo* a *N obnovovacích souborů se nepodařilo načíst a bylo přeskočeno.* Při obnovení po neočekávaném vypnutí.
- **Větev uložena jako šablona** (informace) — *Větev uložena jako šablona „{name}“*.
- **Hlášení z rozšíření** (informace, nebo chyba, když rozšíření hlásí chybu) — *Rozšíření {name}: {message}*. Rozšíření smí zobrazit nejvýše tři nová hlášení za 10 sekund, aby nezaplnilo zásobník. Když krok průvodce rozšíření selže, zobrazí se *Krok rozšíření {name} selhal. Průvodce pokračuje.*, a když nelze otevřít soubor projektu rozšíření, zobrazí se *Soubor projektu {file} z rozšíření {name} se nepodařilo otevřít.* Obě jsou chyby.
- **Mezitím přišla změna** (chyba) — *Mezitím přišla změna od AI asistenta nebo rozšíření. …* Když zrušíte dialog úkolu, zatímco AI nebo rozšíření mezitím něco změnily: úpravy úkolu z doby před touto změnou se nevrátí zpět. Zůstanou jako běžné kroky pod příkazem *Vrátit zpět*.

### Výpočet

- **Plán nelze přepočítat** (chyba) — *Plán nelze přepočítat* s důvodem pod ním (viz *Důvody chyby plánu*). Při příkazu *Přepočítat*, při přepnutí dokumentu a při otevření souboru.
- **Datum stavu nastaveno na dnešek** (informace) — *Datum stavu nastaveno na dnešek ({date}).* Při zápisu průběhu v projektu bez data stavu. Aplikace měří průběh až do data stavu, takže bez data stavu nemůže průběh zpracovat. Jiné datum nastavíte na kartě *Plán › Směrné plány a průběh › Datum stavu*. S linkem *Číst více* na [Průběh, datum stavu a směrný plán](docs://uitleg-voortgang).
- **Doba trvání kratší než provedená práce** (chyba) — *Úkol „{name}“ je již dokončen z {N} %: doba trvání nemůže být kratší než již provedená práce. Doba trvání nebyla změněna*.

### Závislosti a hierarchie

- **Závislost odmítnuta** (chyba) — *Tato závislost již existuje*, *Závislost mezi úkolem a jeho vlastním nadřazeným souhrnným úkolem (i vyšším) není povolena.* nebo *Tato závislost by v plánu vytvořila cyklus ({cycle}) a nebyla vytvořena.* Cyklus uvádí úkoly, takže víte, kterou závislost odstranit nebo obrátit jako první.
- **Přesunutí odmítnuto** (chyba) — *Toto přesunutí by vytvořilo cyklus v plánu ({cycle}): závislosti souhrnného úkolu platí také pro jeho dílčí úkoly. Nic nebylo přesunuto*.
- **Závislosti po přesunutí vypadnou** (informace) — *Po přesunutí spojuje N závislostí úkol s jeho vlastním souhrnným úkolem; ty se již do výpočtu nezapočítávají.*
- **Závislosti přeskočeny při vložení** (chyba) — *N závislostí nebylo vytvořeno: neplatné propojení…*, při vložení ze schránky nebo při vložení větve. Řádek pod tím uvede, které závislosti, například *Nevytvořeno: Foundation → Masonry.*
- **Závislosti po importu nezapočítány** (informace) — *Nepodařilo se zahrnout N závislost(i) do výpočtu. Zkontrolujte sloupce Předchůdci a Následníci.*
- **Duplicitní ID po importu** (informace) — *Objekty s duplicitním ID v tomto souboru: N. Dostaly vlastní ID…*

### Úprava úkolů

- **Začátek zapsán jako omezení** (informace) — *„{name}“ nezačne před {date} (SNET).* Když změníte začátek úkolu s předchůdcem. Předchůdce určuje začátek, proto aplikace zapíše vaše datum jako omezení *Zahájit nejdříve* (SNET). Po přepočítání (F5) úkol nezačne před tímto datem. Pokud úkol už takové omezení měl, zobrazí se *„{name}“ nyní nezačne před {date} (SNET).*; u více úkolů najednou se zobrazí počet. S linkem *Číst více* na [Omezení a konečné termíny](docs://uitleg-constraints).
- **Začátek nebyl použit** (chyba) — *Nový začátek úkolu „{name}“ nebyl použit: úkol má předchůdce a omezení {type} {date}, a ty určují jeho začátek. Změňte toto omezení, aby se začátek posunul.*
- **Milník odmítnut** (chyba) — *„{task}“ má přiřazení zdrojů a nemůže se stát milníkem. Nejprve odeberte přiřazení.* nebo *„{task}“ je souhrnný úkol s dílčími úkoly a nemůže se stát milníkem.* Při převodu v dialogu úkolu, v panelu vlastností, v kontextové nabídce a v tabulce.
- **Přiřazení přesunuta do dílčího úkolu** (informace) — *Přiřazení přesunuto do dílčího úkolu „{child}“.* nebo *N přiřazení přesunuto do dílčího úkolu „{child}“.* Když rozšíření dá úkolu s přiřazeními dílčí úkoly. Tento úkol se stane souhrnným úkolem a souhrnný úkol nenese přiřazení sám. Proto se přiřazení přesunou do prvního nového dílčího úkolu. V samotné aplikaci to zvolíte v okně *Úkol se stane souhrnným úkolem*; toto hlášení se neobjeví. S linkem *Číst více* na [Úprava struktury](docs://howto-structuur-aanpassen).
- **Příznak milníku odstraněn** (informace) — *„{phase}“ už není milník.* Když milník dostane dílčí úkoly. Milník je okamžik bez dílčích úkolů. S dílčími úkoly se stane souhrnným úkolem. S linkem *Číst více* na [Úprava struktury](docs://howto-structuur-aanpassen).
- **Otázka je zastaralá** (chyba) — *Úkoly nebo přiřazení se změnily, zatímco otázka byla otevřená. Nic se nezměnilo; zkuste to znovu.* Když vyberete v okně *Úkol se stane souhrnným úkolem*, ale otázka už neodpovídá.
- **Souhrnný úkol odmítnut** (chyba) — *„{phase}“ nemůže být souhrnným úkolem: …* s důvodem a *Nic se nezměnilo.* Když rozšíření dá úkolu s přiřazeními dílčí úkoly a přiřazení nelze přesunout do prvního nového dílčího úkolu. V samotné aplikaci se toto hlášení nezobrazí. Tam se okno *Úkol se stane souhrnným úkolem* zeptá, co udělat, a *Přesunout* je pak nedostupné.
- **Buňky přeskočeny při vložení** (chyba) — *Přeskočeno N buněk: jsou jen pro čtení (například automaticky číslovaný kód WBS nebo vypočítaný sloupec).*
- **Propojení vymazána při vložení** (informace) — *N propojení v tomto dokumentu neexistovalo a bylo vymazáno (kalendáře úkolů, vlastní druhy práce, kódy aktivit nebo vlastní pole ze zdrojového dokumentu).*
- **Struktura je zamčená** (chyba, červená lišta pod pásem karet) — *Není k dispozici při filtrování, seskupování nebo řazení* s tlačítkem *Vymazat*. Když je seznam filtrován, seskupen nebo řazen, nejde zvětšit ani zmenšit odsazení a nejde přetahovat úkoly. Nejde ani použít *Vložit nad* a *Vložit pod* (nabídka pravého tlačítka nebo klávesová zkratka). Lišta zůstane, dokud na křížek neklikněte, nepoužijete Ctrl+Z nebo Ctrl+Y, nebo nepřejdete na jiný dokument. Viz [Úprava struktury](docs://howto-structuur-aanpassen).
- **Úkol přidán na konec** (chyba) — *Nový úkol byl přidán na konec. Při filtrování, seskupování nebo řazení jej aplikace nemůže zařadit pod váš výběr.* S tlačítkem *Vymazat*. U tlačítek *Úkol* a *Milník ▾* se to stane, když je vybrán úkol a seznam je filtrován, seskupen nebo řazen. Úkol se přidá, ale dole. *Vymazat* odebere filtr, seskupení a řazení a zavře oznámení. Viz [Přidání úkolů a milníků](docs://howto-taken-en-mijlpalen-toevoegen).
- **Typ úkolu upravil doby trvání** (informace) — *Typ úkolu po změně kalendáře upravil dobu trvání: N úkolů (práce zůstává, hodiny za den se změnily).* S linkem *Typy úkolů vysvětleny*.

### Primavera P6 XML

- **Soubor P6 XML otevřen** (informace) — *Soubor P6 XML otevřen: N dokumentů projektu.* Po otevření souboru P6 XML.
- **Nepřevzato** (zůstane) — *N závislostí mezi projekty nebylo převzato jako závislost.* a *N úkolů bez projektu nebylo načteno.* Zkontrolujte, zda je váš plán úplný.
- **Prázdný nebo nepoužitelný** (chyba) — nic se neotevře. Tři důvody: *V tomto souboru nejsou žádné úkoly, které může aplikace načíst.*, *Úkoly nemají ObjectId. …* a *Soubor používá názvy sloupců XER … Otevřete samotný soubor .xer.*

### Primavera (XER)

- **Soubor XER otevřen** (informace) — *Soubor XER otevřen: N projektových dokumentů.* Jedno oznámení na soubor, i když soubor otevře několik projektů. Má link *Číst více* a řádky s podrobnostmi pod ním. Vždy se zobrazí *Nalezeno N projektů.* Jen když je počet vyšší než 0: *Přeskočeno N prázdných projektů.*, *Vyloučeno N projektů směrného plánu.*, *Vytvořeno N směrných plánů.*, *Ignorováno N osiřelých propojení na směrný plán.*, *Byl použit ochranný záložní směrný plán.* a *Zachováno N vazeb mezi projekty.* Jen pro kódování jiné než UTF-8: *Kódování textu zjištěno jako {encoding}.* Dále, když je počet vyšší než 0: *N nálezů parseru.*, *N nálezů kalendáře.*, *N problémů se zápisem čísel.*, *N záložních hodnot výčtu* a *N nastavení plánování P6 používají bezpečnou záložní hodnotu.*
- **Data podle Primavery** (podrobný řádek ve stejném oznámení) — *N úkolů zobrazuje data tak, jak je Primavera uložila (bez přepočtu).* Počet N zahrnuje každý úkol, pro který soubor uložil data, i ty, které se neliší. Nebo, pokud režim nebyl zapnutý, *N úkolů se liší od dat v souboru – můžete je zobrazit.*
- **Zdrojový archiv XER nelze použít** (informace) — *Zdrojový archiv XER v tomto souboru je nepoužitelný a byl vynechán; samotný projekt byl otevřen úplně.* S důvodem (například *Důvod: kontrolní součet neodpovídá zdrojovým bajtům – archiv je poškozen.*) a následkem (*Plán, profil výpočtu a všechna data projektu z IFC jsou úplné. …*). Když otevřete soubor IFC, ve kterém dříve uložený zdrojový archiv XER nejde použít. Také při obnovení po neočekávaném vypnutí, když úložiště obnovení už zdrojový archiv nemá.
- **Export ztrácí informace XER** (informace) — *Při exportu do formátu {format} se ztratí zdrojové informace XER.* Po úspěšném exportu do jiného formátu než IFC, u projektu s daty, která existují jen v souboru XER. S linkem *Číst více*.

### Import, export a profil výpočtu

- **Data podle souboru** (informace) — *N úkolů zobrazuje data tak, jak jsou uložena v souboru (bez přepočtu).* (Počet N zahrnuje každý úkol se zaznamenanými daty.) nebo *N úkolů se liší od dat v souboru – můžete je zobrazit.* Při otevření souboru se zaznamenanými daty.
- **Práce a typy úkolů viditelné** (informace) — *Tento soubor obsahuje uloženou práci nebo typy úkolů. Typ úkolu a zbývající práce jsou v tomto projektu viditelné.*
- **Plán z MS Project načten** (informace) — *Tento soubor MS Project obsahuje N úkolů s přerušením práce, vyrovnáním nebo plánováním řízeným zdroji. Jsou takto načteny a zobrazeny.*
- **Přerušení nebyla exportována** (informace) — *N úkolů s přerušeními práce bylo exportováno bez přerušení práce: MS Project a P6 znají přerušení pouze jako rozložení práce.* Při exportu do MS Project nebo Primavery.
- **Zahájení projektu posunuto** (informace) — *N úkolů se posunulo se zahájením projektu.* Když nastavíte pozdější zahájení projektu. Posunou se jen úkoly bez předchůdce a bez omezení, které by leželo před novým datem zahájení. Ty se posunou na toto datum. S linkem *Číst více* na [Nový projekt a Informace o projektu](docs://ref-projectinfo).
- **Okno dat už neřídí** (informace) — *Okno dat MS Project po této úpravě už neřídí N úkolů; …* Jednou za dokument.
- **Zaokrouhlené zpoždění vyrovnání** (informace) — *Vyrovnání zaokrouhluje zpoždění vyrovnání z MS Project (přesné na minuty) na celé pracovní dny. Týká se N úkolů.* Jednou za dokument.
- **Profil výpočtu použit** (informace) — *Tento projekt se počítá jako {profile}. Změnit to lze v nabídce Soubor → Informace o projektu → Profil výpočtu a možnosti výpočtu.* S tlačítkem *Otevřít profil výpočtu*. Po použití profilu následuje, je-li třeba, *Po použití se posunulo N úkolů.*
