# Knihovna zdrojů

Vaše zednická parta nepracuje jen pro jeden projekt. Dnes je na domech na severu, zítra na garážích na jihu. Knihovna zdrojů je místo, kde takovou partu zaznamenáte jen jednou, aby ji používaly všechny projekty stejně. Aplikace pak dokáže vidět i to, kdy dva projekty chtějí stejné lidi ve stejný den, což žádný jednotlivý projekt vidět nedokáže. V tomto článku se dozvíte, jak spolu knihovna a projekt souvisejí a jak aplikace počítá obsazenost napříč projekty.

## Pojem

Existují dvě vrstvy.

**Knihovna zdrojů** je seznam zdrojů a kalendářů, které patří vaší organizaci: zedník, jeřáb, omítkář, s jejich typem, standardní sazbou a počtem kusů, které máte. Samotný seznam, který aplikace označuje také jako **pool**, není v souborech projektu, ale v aplikaci: v desktopové aplikaci v souboru na tomto počítači, v prohlížeči v úložišti tohoto prohlížeče. Pokud v prohlížeči vymažete data webu, knihovna zmizí, proto ji exportujte jako zálohu. Vždy existuje alespoň jedna knihovna. První se jmenuje *Mijn resourcebibliotheek* (nizozemský název) a můžete ji přejmenovat.

**Projekt** rozhoduje, kolik zdroje používá a kdy. Projekt je propojen s jednou knihovnou, nebo stojí samostatně. Samostatný projekt funguje dobře, jen bez sdíleného seznamu.

Projekt na knihovnu neodkazuje, ale ponechá si **kopii**. Když přiřadíte *Bricklayer* z knihovny k projektu, aplikace vytvoří kopii v projektu s **razítkem původu**: poznámkou, že tato kopie pochází z knihovny X a je v ní položkou Y. V tabulce zdrojů takovou kopii poznáte podle malé ikony knihovny. Kopie je běžný zdroj: úkoly se k ní dají přiřadit a je uložena přímo v samotném souboru projektu.

Kalendáře v knihovně zdrojů jsou něco jiného než seznam kalendářů vašeho projektu, který spravujete v dialogu pro kalendáře. Kalendář z knihovny se dostane do vašeho projektu spolu se zdrojem, který jej používá.

## Jak s ní aplikace pracuje

### Co rozhoduje knihovna a co projekt

Knihovna rozhoduje o tom, **čím zdroj je**: o názvu, typu, standardní sazbě za hodinu, jednotce a popisu. V kopii v projektu se tato pole zobrazují jako prostý text. Měníte je v knihovně, aby byla v každém projektu správná. Pokud chcete, aby si kopie nakonec šla vlastní cestou, odpojíte ji od knihovny.

Projekt rozhoduje o tom, **kolik a kdy**: o poli *Maximální počet jednotek*, o kapacitě, která se mění v čase (*Kapacita podle období*), a o tom, který kalendář zdroj má. Tato pole zůstávají v projektu upravitelná a nepočítají se jako odchylka od knihovny. Stejná parta může přece na spěšné zakázce běžet podle jiného kalendáře než na běžném projektu. Obsah kalendáře, který přišel spolu se zdrojem, se však od knihovny řídí.

### Kdy kopie následuje

Knihovna kopie neobnovuje průběžně, ale v pevně daných okamžicích:

- Když v knihovně něco upravíte, neupravené kopie ve všech otevřených projektech se hned přizpůsobí.
- Když otevřete projekt nebo přepnete na jinou kartu, aplikace porovná kopie s knihovnou. Pokud je neupravená kopie pozadu, aplikace ji tiše aktualizuje a krátce to oznámí: *1 položka aktualizována z knihovny* nebo *N položek aktualizováno z knihovny*.

Aplikace si pamatuje hodnoty z okamžiku, kdy se kopie vytvořila nebo aktualizovala. Pokud se kopie od těchto hodnot nyní liší, aplikace nerozhoduje, kdo má pravdu. Kopie pak dostane značku *se liší — rozhodněte*. Když otevřete soubor s takovou kopií, okno *Propojit knihovnu zdrojů* se otevře samo. Tam u každé položky zvolíte, zda platí hodnoty z knihovny, nebo zda se hodnoty z vašeho souboru dostanou do knihovny. Při přepnutí karty se žádné okno nikdy neobjeví.

Odchylka vznikne například tehdy, když vlastní zdroj v projektu propojíte s položkou knihovny se stejným názvem, ale jinými hodnotami, pomocí příkazu *Do knihovny*. Aplikace je propojí a kopii hned označí jako odchylnou.

### Kdy zdroj z knihovny zmizí

Když zdroj z knihovny odstraníte, kopie zůstane ve vašich projektech a dál funguje. Dostane značku *už není v knihovně* a potom ji můžete plně upravit, nebo ji z projektu odstranit.

### Obsazenost napříč projekty

Histogram a přetížení v projektu se dívají jen na tento jeden projekt. Knihovna ví víc: kolik zdrojů je celkem k dispozici. Zobrazení *Obsazenost* sčítá za každý den požadavky všech otevřených projektů, které jsou propojeny se stejnou knihovnou a používají kopii tohoto zdroje. Pokud je součet za den větší než kapacita knihovny, tento den se počítá jako přetížený.

O tom, co se počítá, rozhodují tři pravidla:

- Kapacita pochází z knihovny (*Maximální počet jednotek* položky knihovny, nebo její *Kapacita podle období* v daný den), ne z pole *Maximální počet jednotek* kopie v projektu. Dva projekty, z nichž každý zůstane ve svém přidělení, mohou proto dohromady stále požadovat příliš mnoho.
- Součet, který se přesně rovná kapacitě, není konflikt. Musí se požadovat víc, než je kapacita.
- Počítají se jen kopie s razítkem původu a jen v projektech, které jsou v tu chvíli otevřené v této aplikaci. Vlastní zdroj jednoho projektu není v knihovně, a proto se nepočítá. Přehled nevidí dokumenty, které se neotevřely v této aplikaci; to je uvedeno i ve spodní části samotného přehledu.

## Příklad: zednická parta ve dvou projektech

Knihovna zdrojů obsahuje zdroj *Bricklayer* s polem *Maximální počet jednotek* 3: tři zedníci na výplatní pásce. Dva projekty ho používají, oba s kopií, která má *Maximální počet jednotek* 2.

- Projekt Houses North má úkol *Bricklaying facades* v délce 5 pracovních dnů od pondělí 7. června 2027, se 2 jednotkami přiřazení za den. Úkol běží od 7. do 11. června včetně.
- Projekt Garages South má úkol *Bricklaying garages* v délce 4 pracovních dnů od středy 9. června 2027, se 2 jednotkami přiřazení za den. Víkend se nepočítá, takže úkol pokrývá 9., 10., 11. a 14. června.

V každém projektu se od zedníka požaduje 2 ze svých 2 jednotek přiřazení. Žádný z projektů nehlásí přetížení: na kartě *Zdroje › Přetížení* oba říkají *Žádné*. Dohromady však překračují 3 zedníky. Aplikace počítá po dnech:

- pondělí 7. a úterý 8. června: 2 (jen Houses North)
- středa 9., čtvrtek 10. a pátek 11. června: 2 + 2 = 4
- pondělí 14. června: 2 (jen Garages South)

Špička je 4 oproti kapacitě 3. Přehled ukazuje zedníka s *2 dokumenty*, období *2027-06-07 – 2027-06-14*, *4.0 / 3.0* pro špičku a kapacitu a *3 dny přetíženy*: 9., 10. a 11. června.

Co se stane, když něco změníte:

- Pokud *Bricklaying facades* potrvá 6 pracovních dnů, poběží až do pondělí 14. června. I tento den dosáhne 2 + 2 = 4, takže přehled ukáže *4 dny přetíženy*: 9., 10., 11. a 14. června. Špička zůstane 4.
- Pokud knihovna má *Maximální počet jednotek* 4, ukáže *4.0 / 4.0* a žádný konflikt není, protože součet není větší než kapacita.
- Pokud *Garages South* pracuje s 1 jednotkou přiřazení za den místo 2, špička je 3 a přehled ukáže *3.0 / 3.0*: žádný konflikt.
- Pokud *Garages South* začne až v pondělí 14. června, projekty se nepřekrývají. Období se změní na *2027-06-07 – 2027-06-17* a špička je *2.0 / 3.0*.

Kroky, jak to zkontrolovat ve vašich vlastních projektech, najdete v článku [Použití přehledu obsazenosti](docs://howto-bezettingsoverzicht-gebruiken).

## Důsledky a omyly

**„Knihovnu sdílím s kolegy.“** Ne. Knihovna žije v aplikaci (v desktopové aplikaci v souboru na tomto počítači, v prohlížeči v úložišti tohoto prohlížeče) a nesynchronizuje se. Pokud dva plánovači pracují se stejnou knihovnou zdrojů, jejich knihovny se mohou rozejít. Sdílet můžete exportem a importem, viz [Správa a sdílení knihoven zdrojů](docs://howto-bibliotheken-beheren). Pokud vaše organizace sdílí party napříč provozními společnostmi, vyberte si záměrně jednu sdílenou knihovnu. Přehled také vidí jen projekty, které jsou otevřené v této aplikaci.

**„Když změním knihovnu, změní se všechno v mých projektech.“** Mění se jen to, čím zdroj je: název, typ, standardní sazba, jednotka a popis. *Maximální počet jednotek*, kapacita v čase a výběr kalendáře v projektu zůstanou, jak jsou.

**„Změnu v knihovně mohu vrátit zpět.“** Ne. Knihovna patří aplikaci a ne projektu, takže změny v ní jsou mimo *Vrátit zpět* (Ctrl+Z). Zobrazení *Knihovna* na to upozorňuje samo: *Tím se upravuje knihovna a platí to pro všechny projekty — nelze to vrátit zpět.* Odstranění z knihovny také vyžaduje potvrzení a nelze jej vrátit zpět.

**„Přehled obsazenosti vyřeší dvojí rezervaci.“** Ne, přehled je jen okno pro čtení. Ukazuje, ve kterých dnech dva projekty dohromady požadují příliš mnoho. Vyrovnání (*Zdroje › Vyrovnání › Vyrovnat…*, viz [Vyrovnání zdrojů](docs://uitleg-nivelleren)) se dívá na zdroje jednoho projektu a ostatní projekty nebere v úvahu. Přesuňte úkol v jednom z projektů sami, nebo změňte kapacitu v knihovně, pokud se opravdu přidá někdo další.

**„Můj vlastní zdroj se počítá do obsazenosti.“** Jen když je v knihovně. Zdroj, který jste vytvořili jen v projektu, například najatý jeřáb pro jednu zakázku, nemá razítko původu, a proto není v přehledu. Pomocí příkazu *Do knihovny* ho přidáte.

## Viz také

- [Použití knihovny zdrojů](docs://howto-resourcebibliotheek-gebruiken): propojení, přiřazování zdrojů a řešení odchylek.
- [Správa a sdílení knihoven zdrojů](docs://howto-bibliotheken-beheren): vytváření, export a import knihoven.
- [Použití přehledu obsazenosti](docs://howto-bezettingsoverzicht-gebruiken): hledání dvojích rezervací napříč projekty.
- [Správa zdrojů](docs://howto-resources-beheren): zdroje jednoho projektu.
