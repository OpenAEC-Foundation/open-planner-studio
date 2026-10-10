# Kalendáře a pracovní dny

Kolik pracovních dnů úkol zabere a ke kterému datu skončí? To závisí na kalendáři, ve kterém aplikace počítá. V tomto článku se dozvíte, co kalendář je, jak s ním aplikace počítá pracovní dny a který kalendář rozhodne, když jich je zapojeno více. Příklad s výpočty vám pomůže sledovat čísla.

## Pojem

Plán počítá v **pracovních dnech**, ne v kalendářních dnech. „Pět dnů zdění“ znamená pět dnů, kdy se pracuje. Víkend nebo státní svátek se nepočítá, takže takový úkol zabere v diáři více než pět dnů.

Které dny jsou pracovní, se zapisuje do **kalendáře**. Kalendář určuje tři věci:

- **Pracovní týden**: dny v týdnu, kdy se pracuje. Výchozí je pondělí až pátek.
- **Pracovní doba**: čas začátku, čas ukončení a přestávka. Z nich vyplývají **čisté hodiny za den**. Výchozí je 07:00 až 16:00 s hodinovou přestávkou, tedy 8 hodin.
- **Svátky**: jednotlivé dny nebo celé časové úseky, kdy se nepracuje, například Královský den, Vánoce nebo letní stavební uzávěra.

Projekt má jednu knihovnu zdrojů, v níž jsou kalendáře. Jeden z nich je **kalendář projektu**. Platí pro každý úkol, který nemá vlastní kalendář. Jednotlivému úkolu můžete dát jiný kalendář, například šestidenní pracovní týden pro subdodavatele, který pracuje i v sobotu. Také zdroj může mít vlastní kalendář, ale ten dělá něco jiného (viz níže).

## Jak aplikace vypočítává

Tento článek popisuje standardní výpočet: profil výpočtu *Open Planner Studio*, se kterým nový projekt vypočítává.

### Počítání pracovních dnů

První pracovní den úkolu se počítá jako den 1. Úkol na 5 dní proto skončí pátým pracovním dnem. Když začátek připadne na nepracovní den, úkol začne příštím pracovním dnem. Svátek nebo letní stavební uzávěra uprostřed úkolu se nepočítá: úkol přes něj jednoduše pokračuje a v diáři se prodlouží.

Hodiny za den nemají na data úkolu ve dnech žádný vliv. Počítají se jen pracovní týden a svátky. Pracovní doba se uplatní až u hodinového úkolu; to je popsáno v článku [Dny a hodiny](docs://uitleg-dagen-en-uren).

### Který kalendář rozhoduje

Aplikace vybírá pro každý úkol jeden kalendář:

1. Když má úkol vlastní kalendář, aplikace vypočítá celý úkol v tomto kalendáři: dobu trvání, datum dokončení a časovou rezervu.
2. Když úkol žádný vlastní nemá, platí kalendář projektu. Když úkol ukazuje na kalendář, který už neexistuje, použije také kalendář projektu.

Souhrnný úkol (fáze) nemá vlastní práci, a proto nemá ani vlastní kalendář. Jeho doba trvání vyplývá z dat jeho úkolů a aplikace ho počítá v kalendáři projektu.

Kalendář **zdroje** nemá na data žádný vliv. V plánu, který si v aplikaci sami sestavíte, určuje jen, kdy je zdroj k dispozici: v histogramu, při přetížení a při vyrovnání.

### Úkoly na různých kalendářích

Když jsou propojeny dva úkoly s různými kalendáři, platí toto:

- U závislosti dokončení-zahájení začne následník prvním pracovním dnem po dokončení předchůdce, počítaným v kalendáři **následníka**. Když úkol skončí v pátek, následník se šestidenním pracovním týdnem začne v sobotu.
- Výchozí je, že se **prodleva** počítá v kalendáři **předchůdce**. Změnit to můžete v nabídce *Nastavení › Projekt › Info o projektu*, v bloku *Profil výpočtu a možnosti výpočtu*, pod nadpisem *Možnosti výpočtu tohoto projektu*, volbou *Kalendář prodlev*: *Předchůdce* (výchozí), *Následník*, *24hodinový* nebo *Projektový kalendář*.
- **Celková časová rezerva** se počítá v pracovních dnech kalendáře samotného úkolu. V tomto profilu se **volná časová rezerva** počítá v kalendáři následníka.

Co přesně prodleva je, popisuje článek [Přidání závislostí](docs://howto-relaties-leggen); co je časová rezerva, popisuje článek [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad).

### V diagramu Gantt

Šedé pozadí v diagramu Gantt vždy ukazuje nepracovní dny **kalendáře projektu**. Úkol s vlastním kalendářem tak může přes šedý den pokračovat, například šestidenní úkol přes sobotu. Souvislé svátky široké tři dny nebo víc se zobrazí se svým názvem, například *Bouwvak (Noord)*. K tomu nedojde, když je zapnuto *Zobrazit jen pracovní dny*. Pokud nechcete šedé dny vidět vůbec, zapněte *Zobrazit jen pracovní dny* v nabídce *Nastavení › Projekt › Nastavení*, na kartě *Zobrazení*, v nadpisu *Časová osa*.

## Příklad: plán stavby

Příklad používá standardní kalendář *Bouwkalender NL*: pondělí až pátek, s nizozemskými státními svátky. Všechny úkoly trvají celý počet dnů. V kurzu o kalendářích (kurz 3) si takový kalendář sami vytvoříte.

### Víkend, svátek a letní stavební uzávěra

*Brickwork* trvá 5 pracovních dnů a začíná ve čtvrtek 13. května 2027. Čtvrtek 13. a pátek 14. května jsou den 1 a 2. Víkend a Svatodušní pondělí 17. května se nepočítají. Úterý 18., středa 19. a čtvrtek 20. května jsou den 3, 4 a 5. Úkol skončí **ve čtvrtek 20. května**: osm kalendářních dnů pro pět pracovních dnů.

Letní stavební uzávěra rozdíl ještě zvětší. Vezměte *Bouwvak (Noord)*, od 26. července do 13. srpna 2027 včetně, a stejný úkol na 5 pracovních dnů od pátku 23. července. Pátek 23. července je den 1. Potom kalendář tři týdny stojí na místě. Pondělí 16. až čtvrtek 19. srpna jsou den 2 až 5. Dokončení je **čtvrtek 19. srpna**, 28 kalendářních dnů po začátku. Bez letní stavební uzávěry by úkol skončil ve čtvrtek 29. července.

### Úkol v sobotu

Tři úkoly na sebe navazují, všechny se závislostí dokončení-zahájení bez prodlevy: *Groundwork* (4 dny), *Pour foundation* (3 dny) a *Brickwork* (5 dnů). Projekt začíná v pondělí 24. května 2027.

Pokud jsou všechny tři v kalendáři projektu, *Groundwork* běží od pondělí 24. do čtvrtka 27. května. *Pour foundation* běží od pátku 28. května do úterý 1. června (pátek, pondělí, úterý). *Brickwork* běží od středy 2. června do úterý 8. června. Projekt skončí **v úterý 8. června**.

Dejte *Pour foundation* kalendář *Six-day week* (pondělí až sobota) a sobota se počítá. Úkol běží od pátku 28. května do **pondělí 31. května** (pátek, sobota, pondělí). *Brickwork* zůstává v kalendáři projektu, začíná v úterý 1. června a skončí **v pondělí 7. června**. Celý projekt je o den kratší, protože jeden úkol pracuje v sobotu.

### Prodleva přes dva kalendáře

*Pour floor* (six-day week, 4 dny) začíná v pondělí 31. května a skončí ve čtvrtek 3. června. *Pointing* (kalendář projektu, 3 dny) navazuje s prodlevou 2 pracovní dny. Bez prodlevy by *Pointing* začínal v pátek 4. června.

- Ve výchozím nastavení se prodleva počítá v kalendáři předchůdce, tedy six-day week. Od pátku 4. června je první pracovní den sobota 5. června a druhý pondělí 7. června. *Pointing* začíná **v pondělí 7. června** a skončí ve středu 9. června.
- Když nastavíte *Kalendář prodlev* na volbu *Následník*, počítá se kalendář projektu. Sobota se pak nepočítá: první pracovní den je pondělí 7. června a druhý úterý 8. června. *Pointing* začíná **v úterý 8. června** a skončí ve čtvrtek 10. června.

### Časová rezerva ve vlastním kalendáři

*Brickwork* (5 dnů, kalendář projektu) i *Crane hire* (3 dny, six-day week) začínají v pondělí 24. května. Oba jsou předchůdci úkolu *Fit window frames* (2 dny, kalendář projektu).

*Brickwork* skončí v pátek 28. května, takže *Fit window frames* začíná v pondělí 31. května. *Crane hire* je už ve středu 26. května dokončen. Celková časová rezerva *Crane hire* se počítá v jeho vlastním kalendáři: čtvrtek 27., pátek 28. a sobota 29. května, tedy **3 pracovní dny**. Kdyby *Crane hire* byl v kalendáři projektu, bylo by to 2 pracovní dny. Volná časová rezerva je 2 pracovní dny (čtvrtek a pátek), protože ji aplikace počítá v kalendáři následníka.

### Kalendář zdroje

V jiném příkladovém projektu má zdroj *Bricklaying crew* kalendář *Crew Mon–Thu* (pondělí až čtvrtek). Je přiřazen s 1 jednotkou přiřazení za den k úkolu *Brickwork* (5 dnů, kalendář projektu, od pondělí 31. května do pátku 4. června).

Datumy *Brickwork* se nemění. Pátek 4. června je ale v histogramu červený s hlášením *Podle kalendáře „Crew Mon–Thu“ v tento den nepracuje* a pás karet hlásí jeden zdroj pod nadpisem *Přetížení*. Vyrovnání tento problém nevyřeší. Posun nepomůže, protože pět pracovních dnů za sebou vždy obsahuje pátek. V okně *Vyrovnání zdrojů* je proto úkol uveden pod nadpisem *Zbývající konflikty*, s důvodem *Zdroj nepracuje ve všech dnech, které tento úkol potřebuje — posun tento problém nevyřeší.*

## Důsledky a nedorozumění

**„Kalendář zdroje mi posouvá úkoly.“** Ne. Kalendář zdroje nemění žádné datum. Pouze zviditelní přetížení. Když chcete, aby úkol sám běžel v jiné dny, dejte úkolu vlastní kalendář.

**„Když přepnu kalendář projektu, všechno se posune.“** Posunou se jen úkoly bez vlastního kalendáře. Úkol, kterému jste kalendář ze seznamu dali sami, si ho ponechá, i když jde náhodou o původní kalendář projektu. Když kalendář odstraníte, úkoly a zdroje, které ho používaly, přejdou na kalendář projektu.

**„Svátky v něm přece jsou, že?“** Svátky existují jen pro roky, pro které byly vytvořeny. Den mimo tyto roky je jednoduše pracovní den. V dialogu kalendáře to aplikace říká s hlášením *Svátky pokrývají 2025–2028; projekt běží do 2030. Vygenerovat znovu?*

**„Více hodin za den mi úkol zkrátí.“** U úkolu ve dnech to neplatí: počítají se celé pracovní dny, ať má den 6 nebo 8 hodin. Jen u úkolu se zdroji a pravidlem pevné veličiny *Pevná práce* nebo *Pevné jednotky* se doba trvání s hodinami změní.

**Kalendář bez pracovních dnů** aplikace nedokáže přepočítat. Výpočet hlásí *Kalendář nemá nastaveny žádné pracovní dny*.

## Viz také

- [Dny a hodiny](docs://uitleg-dagen-en-uren): jak aplikace počítá pracovní hodiny a co se stane, když se setkají úkoly ve dnech a hodinové úkoly.
- [Vytvoření a přiřazení kalendáře](docs://howto-kalender-maken-en-toewijzen): postup, jak si vytvořit vlastní kalendář a přiřadit ho úkolům.
- [Generování svátků a letní stavební uzávěry](docs://howto-feestdagen-genereren): vyplnění svátků země a letní stavební uzávěry.
- [Nastavení kalendáře zdroje](docs://howto-resourcekalender-instellen): zapsání dostupnosti zdroje.
- [Okna kalendářů](docs://ref-kalenders): všechna pole oken kalendářů.
