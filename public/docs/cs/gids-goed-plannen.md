# Dobré plánování

Co dělá plán dobrý? Ne to, jak úhledně vypadá, ale to, zda odpoví na otázku, na které záleží, až práce běží: Co se stane s předáním, pokud něco sklouzne? Tento článek vysvětluje zásady spolehlivého plánu a proč tolik váží v aplikaci Open Planner Studio: aplikace počítá jen s tím, co zadáte, a nepočítá s ničím jiným.

Příklady pocházejí ze stavebnictví: konstrukční práce, dokončovací profese, dodací lhůty, zpoždění kvůli počasí, subdodavatelé, smluvní datum předání. Zásady samy však nejsou specifické pro stavebnictví.

## Pojem

Dobrý plán není obrázek toho, v co doufáte, ale **výpočetní model**: úkoly s dobou trvání, propojené závislostmi, v kalendáři. Aplikace počítá termíny z tohoto modelu. Když se něco změní, model přepočítá a hned uvidíte, co to znamená pro ostatní.

Plánovač postupuje v pevném pořadí:

1. Cíl: milníky a datum předání.
2. Členění: fáze, pracovní balíčky, úkoly.
3. Doba trvání každého úkolu.
4. Závislosti.
5. Omezení a pevná data.
6. Kalendáře.
7. Zdroje.
8. Kritická cesta a časová rezerva.
9. Směrný plán a průběh.
10. Kontrola.

To pořadí není formalita. Když krok vynecháte, vrátí se jako překvapení: úkoly bez závislostí se neposunou, doby trvání bez kalendáře jsou špatné a směrný plán, který uložíte až dodatečně, zafixuje zpoždění místo dohody.

## Jak s ním aplikace počítá

Každý princip níže souvisí s něčím, co aplikace dělá. Proto tato část sleduje stejné pořadí.

### Začněte od cíle, ne od úkolů

Nejdříve zapište okamžiky, které jsou pevně dané. Teprve potom zapište práci, která se do nich musí vejít: zahájení přípravy staveniště, konečné povolení, vodotěsnost stavby, zahájení dokončovacích prací, předání. Těmto okamžikům se říká **milníky**. Jsou to body bez doby trvání. Zadáte je skutečně jako milník (*Domů › Úkoly › Milník ▾*). Nezadávejte je jako úkol s nulovou dobou trvání a názvem, který jen připomíná milník.

Proč je to tak: plán, který začíná seznamem úkolů, je jen součet. Součet málokdy vyjde na datum ve smlouvě. Začnete-li od milníků, položíte správnou otázku hned. Neptáte se „kolik času zabere všechno dohromady“. Ptáte se „vejde se práce mezi tyto dva okamžiky, a pokud ne, co se musí změnit“. Od požadovaného data předání postupujte zpět k tomu, kdy musí být stavba nejpozději vodotěsná. Odtud postupujte zpět k začátku.

Předání, které je dané smlouvou, dostane zaškrtávací políčko *Povinný (smluvní)*. Každý, kdo otevře soubor, tak uvidí, že tento okamžik není možné vyjednávat ani posunout. Zaškrtávací políčko je jen značka pro diagram Gantt a sestavy. Datum nechrání. Datum chráníte konečným termínem nebo omezením (viz níže).

### Rozpad: fáze, pracovní balíčky, úkoly

Pod milníky vytvoříte strukturu: fáze, pod nimi pracovní balíčky a pod nimi úkoly. Děláte to zvětšením odsazení. Úkol s dílčími úkoly se automaticky stane **souhrnným úkolem**. Aplikace z úkolů pod ním odvodí jeho pruh a jeho dobu trvání. Proto nikdy nezadávejte dobu trvání souhrnného úkolu sami.

Pravidlo pro míru podrobnosti: **úkol trvá zhruba jeden den až dva týdny**. Kratší než jeden den znamená, že plánujete stavbu místo projektu. To patří do týdenního plánu vedoucího stavby. Nepatří to do výpočtového modelu, který musí vydržet měsíce. Delší než dva týdny znamená úkol, který nelze spolehlivě odhadnout ani sledovat během realizace. Věta „finishing ground floor, 40 days, 45% complete“ neřekne nikomu, jestli to jde dobře. Při kontrolách plánu se proto často počítá, kolik úkolů trvá déle než zhruba dva měsíce. Je-li to víc než několik procent, považuje se to za nedostatek podrobností.

Příliš jemné členění škodí stejně jako příliš hrubé. Každý úkol přináší údržbu: propojení k vytvoření, průběh k zapsání a nové posouzení po každé změně. Plán se dvěma tisíci úkoly pro šestiměsíční projekt se nestane přesnějším. Přestane se udržovat. Plán, který nikdo neaktualizuje, je za tři týdny fikce. Zvolte úroveň, na které můžete průběh každý týden poctivě hlásit.

V praxi: „3. Finishing“ je fáze, „Finishing house 4“ je pracovní balíček a „Plastering house 4 ground floor“ je úkol v délce pěti dnů. Horní hranici můžete záměrně překročit u dodacích lhůt a dozoru. Dodávka okenních rámů v délce deseti týdnů je opravdu jeden nedělitelný blok čekání. Průběžný dozor patří do překlenovacího úkolu, ne do řady umělých dílů.

### Odhad doby trvání

Doba trvání je odhad, jak dlouho práce trvá. Není to odhad, jak rychle by mohla jít. Odhadujte pro běžný den s partou, kterou skutečně dostanete. Neodhadujte pro nejlepší den s nejlepší partou. Optimismus se v řetězci sčítá. Plán, v němž každý úkol počítá s nejlepším dnem, téměř nikdy nedosáhne data předání.

Volba mezi dny a hodinami má význam. Není to jen formát. Zvolte **dny** u práce, která určuje tempo na stavbě: zdění, omítání, obkládání. Pět dnů zůstane pěti dny, ať je den osm nebo devět hodin. Zvolte **hodiny**, když jsou samotné hodiny jednotkou a záleží na zbytku dne. Příklady: tříhodinová kontrola, čtrnáctihodinové betonování rozložené do dvou dnů, práce na směny. Aplikace volbu uloží u každého úkolu zvlášť.

Neschovávejte riziko do jednotlivých dob trvání. Když přidáte den všude, rezerva se ztratí. Nikdo ji pak nevidí ani neřídí. A tam, kde byla rezerva opravdu potřeba, se ukáže, že je příliš malá. Rezervu zviditelněte. Použijte explicitní nárazníkový úkol před datem předání, nebo samostatnou rezervu na počasí. Pozor na dvojí započítání: přibližně 180 pracovních dnů ročně, s nimiž počítá nizozemské stavebnictví, je smluvní roční údaj (UAV). Od něj jsou už odečteny svátky, letní stavební uzávěra *a* ztracené dny. Jsou-li svátky a uzávěra už ve vašem kalendáři projektu, zůstává jako samostatná položka jen zpoždění způsobené počasím. Zpoždění z mrazu a bouře se řídí vlastními pravidly kolektivní dohody Onwerkbaar weer Bouw & Infra. Tyto očekávané ztracené dny zapište do kalendáře nebo do samostatné položky. Neschovávejte je v době trvání zdění.

### Závislosti: bez sítě to není plán

Aplikace počítá data podle **závislostí**. Úkol začne, až to dovolí jeho předchůdci. Úkol bez závislostí na nic nenavazuje. Když se konstrukce zpozdí o dva týdny, nenavazující úkol dokončovacích prací se neposune. Plán tak klame, aniž by se cokoli označilo červeně.

Proto každý úkol dostane alespoň jednoho předchůdce a alespoň jednoho následníka. Výjimkou je pouze první úkol projektu a poslední milník. Při kontrole plánu je to první test: chybějící logiku smí mít nejvýše několik procent úkolů.

**Dokončení-zahájení je výchozí typ** a má takový zůstat: dokončen základ, potom konstrukce. Ve zdravém stavebním plánu je zhruba devět z deseti závislostí typu dokončení-zahájení. Je to požadavek čitelnosti. Dokončení-zahájení je jediný typ, kterému na stavbě každý rozumí bez vysvětlování. Při realizaci se chová předvídatelně.

**Zahájení-zahájení s prodlevou** patří k práci, která skutečně běží souběžně a nečeká. Klasický případ je řada řadových domů nebo věž s patry: montér jde tři dny za zdičem. To je zahájení-zahájení s prodlevou tři dny. Není to dokončení-zahájení na uměle rozsekaném úkolu. Vedle toho dejte dokončení-dokončení. Jinak by následník mohl teoreticky skončit dřív než předchůdce. Na stavbě se zahájení-dokončení použije téměř nikdy.

Zahájení-zahájení kreslete raději mezi úkoly než mezi fázemi. Je-li předchůdcem fáze, aplikace nechá následníka čekat na úkol v té fázi, který začíná **naposledy**. Nečeká na první. Aplikace tak nikdy nenaplánuje příliš brzy. Občas ale vznikne o něco později, než jste zamýšleli. Dokončení-zahájení a dokončení-dokončení s fází jako předchůdcem čekají na dokončení posledního úkolu v ní. To obvykle přesně znamenáte.

Prodlevy používejte úsporně, a záporné zvlášť. Prodleva je čekání bez viditelného důvodu. Nikdo později nepozná, proč jsou mezi úkoly sedm dnů. Jde-li o zrání betonu, zapište ji jako prodlevu v kalendářních dnech, protože beton zraje i o víkendu. Ještě lépe je skutečný úkol „zrání“, který každý vidí a sleduje. Záporný předstih, tedy překrytí, by tam vlastně být neměl. Při kontrole plánu je norma nula. Chcete-li překrytí, rozdělte předchůdce, nebo použijte zahájení-zahájení.

### Omezení a pevná data: co nejméně

Každý úkol začíná „co nejdříve“. Ve většině případů má takto zůstat. **Omezení** je limit data vedle závislostí. Čím více jich přidáte, tím méně plán počítá a tím více se mění v kresbu. Plán plný pevných dat vypadá stabilně. Právě proto skrývá riziko: nehýbe se, takže nevaruje.

Použijte omezení jen pro pevný vnější termín, který na plán nemá vliv. Příklady: povolení, které nebude konečné před 1. březnem (*Zahájit nejdříve*), uzavírka, kterou udělil úřad, datum připojení od správce sítí. „Chci tento úkol v květnu“ není vnější skutečnost. Vyřešíte to logikou nebo jinou dobou trvání. Jako hrubé pravidlo: pevný limit data má nejvýše několik procent zbývajících úkolů.

Nikdy nezadávejte počáteční datum jen proto, aby úkol byl tam, kde chcete. U úkolu s předchůdcem aplikace zadaný (nebo přetažený) začátek převede na omezení *Zahájit nejdříve (SNET)*. Úkol pak stojí tam, kde chcete. Zůstane tam, i když se celý řetěz před ním zpozdí.

Chcete-li sledovat datum, aniž byste ovlivnili výpočet, použijte **konečný termín**. Nic nepřesouvá. Jakmile ale úkol termín nesplní, ukáže zápornou časovou rezervu a upozornění. Přesně to chcete vidět. Pevné ukotvení (*Povinný (pevné ukotvení)*) si nechte pro extrémní případ. Počítejte s tím, že dává zápornou časovou rezervu v řetězu před ním. Plán tím říká, že se to nevejde. Neříká, že se něco rozbilo.

### Kalendáře: nejdříve projekt, potom výjimky

Všechna doba trvání se počítá v pracovních dnech nebo pracovních hodinách kalendáře. Nastavte tedy kalendář projektu pořádně dřív, než zadáte doby trvání. Nastavte pracovní dny, pracovní doby, svátky a letní stavební uzávěru. Kalendář, který opravíte v polovině, posune celý plán. Hned přidejte předvídatelné uzavírky: mrazové období, kdy se beton neleje, a firemní dovolenou mezi Vánocemi a Novým rokem.

Zdroji dejte vlastní kalendář jen tehdy, když se skutečně liší. Příklady: montér fasád, který přichází čtyři dny v týdnu, nebo parta, která má jiný termín letní uzávěry. Kalendář zdroje nezmění ani jedno datum úkolu. Úkol běží dál podle kalendáře úkolu nebo projektu. Kalendář zdroje jen ukáže, že zdroj v některém pracovním dni úkolu nepracuje. Projeví se to jako přetížení v histogramu. Tento rozdíl se těžko odhaluje, pokud nevíte, že jste ho sami vytvořili.

### Zdroje: kdo to udělá a je to možné

Plán bez zdrojů odpoví jen na polovinu otázky. Jakmile přiřadíte party a techniku, histogram ukáže to, co časová osa sama neukáže. Příklad: 14. června potřebujete tři omítkářské party, a máte jen dvě.

Začněte se zdroji, které omezují. Ne každý šroub musí být v plánu. Patří tam věžový jeřáb, vlastní party, subdodavatelé s kapacitním stropem a dlouhé dodací lhůty. Každému zdroji dejte poctivou kapacitu. Dva omítkáři znamenají dva, ne „dva, ale v nouzi tři“.

Čtěte histogram jako otázku, ne jako chybu. Červeně nad čarou znamená, že plán chce ten den víc, než máte. Někdy je odpovědí: posuňte. Často je odpovědí: tohle nebude fungovat. A právě to jsem chtěl vědět. **Vyrovnání** posouvá úkoly, dokud poptávka nezapadne do kapacity. Může-li datum dokončení ustoupit, dovolte to. Je-li datum předání pevné, vyrovnávejte jen v rámci časové rezervy (zaškrtávací políčko *Vyrovnat jen v rámci časové rezervy — datum dokončení projektu zůstane pevné*). Datum dokončení pak zůstane na místě. Zbyde zaznamenaný zbývající konflikt. To je poctivější výsledek než plán, který jen vypadá vyřešeně.

Nevyrovnávejte, když je poptávka strukturálně větší než kapacita. Vyrovnání přeskládá existující práci v čase. Nenajme další omítkáře a nepostaví druhý jeřáb. Tři věže, které potřebují stejnou partu ve stejnou dobu, jsou i po vyrovnání stále třemi věžemi, které potřebují stejnou partu. Jediné, co se změní, je, že se předání posune. Pomohou pak etapizace, dodatečná kapacita nebo jiná práce. Nevyrovnávejte ani dřív, než jsou zadány logika a doby trvání. Vyrovnávali byste plán, který bude zítra jiný.

### Kritická cesta a časová rezerva: kde je plán zranitelný

Aplikace nepřepočítává při každé změně. Přepočítejte příkazem **Přepočítat** (F5) a teprve potom čtěte. Když stavový řádek ukazuje *Zastaralé — přepočítejte (F5)*, díváte se na předchozí výpočet, ne na tento. Při nastavení *Automaticky přepočítat* to aplikace udělá sama.

**Kritická cesta** je řetěz bez časové rezervy. Každý den, který se tam ztratí, znamená pozdější předání. Tam patří vaše kontrola a vaši nejlepší lidé. Nedívejte se jen na červenou. **Celková časová rezerva** říká, o kolik může úkol pozdě doběhnout, aniž se ovlivní předání. **Volná časová rezerva** říká, o kolik může doběhnout, aniž se posune jeho následník. Rozdíl nemění datum dokončení nikomu. Překáží ale někomu v práci. Je užitečný, když pracujete se subdodavateli, které nelze dvakrát přeplánovat.

Sledujte tři signály. Úkol s několika dny časové rezervy není bezpečný. Je téměř kritický. Při nastavení *Označit téměř kritické* dostanou takové úkoly vlastní barvu. Úkol s extrémní rezervou (při kontrolách plánu více než 44 pracovních dnů, asi dva měsíce) téměř vždy postrádá následníka. Ukáže vám to přímo na mezery v síti. A záporná časová rezerva není nikdy chyba výpočtu. Plán tím říká, že konečný termín nebo pevné datum se nevejde.

### Směrný plán před zahájením, potom ho držte aktuální

Pořiďte **směrný plán** ihned po schválení plánu a dřív, než se do země zabodne lopata (*Plán › Směrné plány a průběh › Spravovat směrné plány…*). Nejdříve přepočítejte. Směrný plán uloží data posledního výpočtu. Bez tohoto odkazu můžete později říct jen *že* věci jdou jinak. Neřeknete *o kolik* ani *od kdy*. A právě to potřebujete na poradě na stavbě, u vícepráce a při jednání o zpoždění.

Směrný plán ukládá data, ne předpoklady, na nichž stojí. Právě na ty se ptají, jakmile se mluví o zpoždění. Proto při pořízení krátce zapište, na čem plán stojí (v praxi plánování: *základ plánu*). Uveďte, jaké výkonové hodnoty jste použili. Uveďte, který kalendář a proč je takto nastavený. Uveďte, co jste do plánu úmyslně nezahrnuli. Uveďte, kdo dodal předpokládané dodací lhůty, a kdo plán schválil. Půl strany stačí.

Potom je udržování aktuálního plánu rytmus, ne projekt. Aktualizujte každý týden ve stejném pořadí. Nastavte **datum stavu** na datum výkazu. Zadejte skutečné zahájení a skutečné dokončení u toho, co začalo a skončilo. Opravte zbývající dobu trvání u toho, co běží. Potom přepočítejte. Samotné procento nestačí. Skutečná data jsou fakta, na něž se později bude hledět.

Vezměte na vědomí, co dělá datum stavu. Práce, která ještě nezačala, se aplikací posune na datum stavu a úkoly za ní se posunou s ní. Výjimkou je profil výpočtu Microsoft Project. Pokud tedy zapomenete odsouhlasit dokončený úkol nebo milník, posune se doprava sám. To není chyba. Je to model, který odmítá předstírat, že se v minulosti ještě něco může stát. Dostanete-li varování *Mimo pořadí*, práce proběhla v jiném pořadí, než předepisuje logika. Obvykle je to důvod změnit pořadí, ne varování odklikat. Nový směrný plán pořiďte jen při skutečné změně rozsahu. Pořiďte ho vedle prvního, ne přes něj.

Nakonec: plán je spolehlivý jen tehdy, když mu věří ti, kdo práci dělají. Nechte vedoucího stavby a subdodavatele porovnávat týdenní plán s tímto modelem. Pokud týden co týden splníte jen polovinu dohodnutého, problém leží spíš v plánu než v provedení.

## Příklad: tři volby, které plán tiše zkreslí

Čísla pocházejí ze dvou příkladů, které jsou propracované jinde v nápovědě: cvičný projekt *House extension* z kurzů a malá síť pro přístavbu. Tady jde o to, co každá volba udělá s vaším plánem. Sami si to vyzkoušíte v kurzu 2 (závislosti a kritická cesta) a v kurzu 3 (omezení a konečný termín).

### Zapomenutá závislost

V přístavbě stavba začne v pondělí 7. června 2027 a předání je v pátek 6. srpna. *Build outer cavity leaf* (6 pracovních dnů) má jako následníka *Install window frames*, protože okenní rámy jsou ve fasádě. S touto závislostí má vnější vrstva 2 pracovní dny časové rezervy.

Když tuto závislost zapomenete, má vnější vrstva najednou 23 pracovních dnů časové rezervy až do předání. Na papíře může mít zpoždění několik týdnů, aniž by na něj někdo čekal. Nic se neobarví červeně a neobjeví se žádné varování. Jen s volbou výpočtu *Úkoly s otevřeným dokončením jsou kritické* se takový úkol bez následníka stane kritickým, takže je mezera vidět.

### Zadané datum místo závislosti

Malá síť: *Groundwork* (3 pracovní dny), *Pour foundation* (2), *Brickwork* (5) a *Roofing* (3) jeden za druhým, od pondělí 7. června 2027. Projekt je hotový ve středu 23. června.

Když pro *Brickwork* zadáte začátek v pondělí 21. června, protože cihly přijdou až tehdy, stane se z něj omezení *zahájit nejdříve*. Brickwork se posune o týden a projekt je hotový ve středu 30. června. *Groundwork* a *Pour foundation* získají 5 pracovních dnů časové rezervy a už nejsou kritické. Pokud cihly nakonec přijdou dříve, brickwork zůstane na 21. června: teď řídí datum, ne logika.

Když místo toho zadáte středu 9. června, dřív než je hotový základ, nic se nestane: závislosti stejně dovolí začít brickwork až v pondělí 14. června.

### Konečný termín místo omezení

Když chcete, aby byl *Roofing* hotový v pátek 18. června, zadejte tam konečný termín. Nic se nepohne: roofing zůstane od pondělí 21. do středy 23. června. Řetěz ale dostane −3 pracovní dny časové rezervy a aplikace hlásí *Konečný termín 18-06-2027 nesplněn — nejdřívější dokončení 23-06-2027*. Hned vidíte, že dohoda nesedí. Nevidíte jen pruh na správném místě s řetězem, který ten termín nesplňuje.

## Důsledky a mylné představy

- **Úkoly bez předchůdce nebo následníka.** Nejčastější a nejškodlivější chyba: tyto úkoly se nepohnou s ostatními a dostanou falešnou časovou rezervu.
- **Zadávání dat nebo tahání pruhů místo vytváření závislostí.** Tím se tiše nastaví omezení.
- **Příliš mnoho omezení a pevné ukotvení použité jako záložka.** Plán pak už nepočítá, jen kreslí.
- **Úkoly trvající tři měsíce nebo půl dne.** Použitelný rozsah je zhruba od jednoho dne do dvou týdnů.
- **Optimistické doby trvání a rezerva skrytá v každém úkolu** místo viditelného nárazníku.
- **Zpoždění kvůli počasí a letní stavební uzávěra nejsou v kalendáři.** Stejně se tam nakonec dostanou, a to až v lednu.
- **Prodlevy místo úkolů.** Sedm dní nepojmenovaného čekání je po třech měsících nevysvětlitelných.
- **Vyrovnání dřív, než je logika hotová**, nebo pokračování ve vyrovnávání proti strukturálnímu nedostatku kapacity.
- **Zapomenutí přepočítat.** *Neaktuální* na stavovém řádku znamená, že se díváte na předchozí výpočet.
- **Žádný směrný plán, nebo směrný plán uložený až po zahájení.**
- **Průběh zapsaný jen jako procento**, bez skutečných dat a bez data stavu.
- **Zavření panelu *Varování* bez přečtení.** Právě tam se sejdou nesplněné konečné termíny, porušená omezení, závislosti mimo posloupnost a zdroje s přetížením (*Plán › Plán › Varování*).

## Viz také

- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): jak aplikace počítá nejdřívější a pozdní termíny a časovou rezervu.
- [Závislosti a prodleva](docs://uitleg-relaties): čtyři typy závislostí, prodleva a závislosti na fázi.
- [Omezení a konečné termíny](docs://uitleg-constraints): co dělá každé omezení a konečný termín s výpočtem.
- [Kalendáře a pracovní dny](docs://uitleg-kalenders): jak aplikace počítá pracovní dny a který kalendář má přednost.
- [Dny a hodiny](docs://uitleg-dagen-en-uren): plánování ve dnech, v hodinách nebo smíšeně.
- [Vyrovnání zdrojů](docs://uitleg-nivelleren): co vyrovnání posouvá a co ne.
- [Průběh, datum stavu a směrný plán](docs://uitleg-voortgang): co dělá datum stavu a jak se čte odchylka.
- [Přidání úkolů a milníků](docs://howto-taken-en-mijlpalen-toevoegen): zadávání milníků a úkolů.
- [Přidání závislostí](docs://howto-relaties-leggen): propojení úkolů.
- [Připojení AI asistenta (MCP)](docs://howto-ai-assistent-koppelen): asistent, který plánuje podle těchto zásad.
- [Upozornění a varování](docs://ref-meldingen): všechna varování na jednom místě.
