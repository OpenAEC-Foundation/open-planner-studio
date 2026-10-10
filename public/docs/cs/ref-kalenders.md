# Okna kalendářů

Okno *Kalendáře* spravuje knihovnu kalendářů projektu. Určuje pracovní dny, pracovní dobu a dny volna. Také určuje, který kalendář je kalendářem projektu. Formulář vedle seznamu je stejný jako v okně *Kalendář zdroje*. Tento článek u každého pole popisuje, co dělá, jaká je výchozí hodnota a čeho si všimnete. Jak vytvořit kalendář a přiřadit ho úkolům, je popsáno v [Vytvoření a přiřazení kalendáře](docs://howto-kalender-maken-en-toewijzen). Jak aplikace počítá pracovní dny, je popsáno v [Kalendáře a pracovní dny](docs://uitleg-kalenders).

## Kde to najdete

- **Kalendáře** — *Plán › Kalendář › Kalendář* nebo *Nastavení › Kalendář › Kalendář*.
- **Kalendář úkolu** — pole *Kalendář* v okně *Upravit úkol* nebo v panelu *Vlastnosti*. Viz [Dialog úkolu a panel vlastností](docs://ref-taak-eigenschappen).
- **Kalendář zdroje** — v panelu *Zdroje*, ve sloupci *Kalendář*: vyberte kalendář, zvolte *+ Kalendář zdroje* pro nový, nebo klikněte na tužku (*Upravit…*) u zvoleného kalendáře. Viz [Panel zdrojů](docs://ref-resourcepaneel).

## Knihovna v okně Kalendáře

Vlevo je seznam kalendářů, vpravo formulář zvoleného kalendáře. Kalendář projektu má hvězdičku. Kalendář s neplatným vstupem má červený trojúhelník (*Tento kalendář obsahuje neplatné údaje*).

- **Nový kalendář** (plus) — přidá kalendář s názvem *Nový kalendář* s výchozím obsahem aplikace: pondělí až pátek, 07:00 až 16:00, 8 čistých hodin. Pokud je zapnutá volba *Zapnout stavební režim* (výchozí), jsou v něm také nizozemské svátky bez letní stavební uzávěry. Pokud je vypnutý, je seznam prázdný. Pokud tyto svátky nechcete, zvolte *Generovat svátky…* a v něm *Žádné svátky*. (Názvy *Bouwkalender NL* a *Standaardkalender* zůstávají nizozemské ve všech jazycích.)
- **Duplikovat** — zkopíruje zvolený kalendář pod názvem *{name} (kopie)*.
- **Odstranit** (koš) — odstraní zvolený kalendář. Když zbývá jen jeden kalendář, je zakázáno. Pokud byl kalendářem projektu, stane se kalendářem projektu první zbývající kalendář. Úkoly a zdroje, které kalendář používaly, se vrátí ke kalendáři projektu.
- **Nastavit jako výchozí pro projekt** — nastaví zvolený kalendář jako kalendář projektu. U kalendáře, který už je kalendářem projektu, se zobrazí *Projektový kalendář* s hvězdičkou. Účinek: každý úkol bez vlastního kalendáře se počítá v tomto kalendáři, stejně tak zdroj bez vlastního kalendáře. Úkol, kterému jste kalendář přiřadili sami, si ho ponechá.
- **Použít** — zapíše všechny změny celého seznamu do projektu najednou, přepočítá plán a zavře okno. Pokud se celkově nic nezměnilo, nepřepočítá. Je zakázáno, dokud je v některém kalendáři neplatný vstup. Enter v běžném textovém poli udělá totéž, ale okno zůstane otevřené.
- **Zrušit** — zavře okno a zahodí všechno, co jste změnili od otevření (nebo od posledního Enteru). Esc a křížek mají stejný účinek jako *Zrušit*. Klik vedle okna nedělá nic, takže nepřijdete o zadané údaje.

Ve výchozím stavu má projekt kalendář *Bouwkalender NL* (stavební režim zapnutý), nebo *Standaardkalender* (stavební režim vypnutý). Pracovní dny jsou pondělí až pátek, 07:00 až 16:00.

## Formulář

### Základní údaje

- **Název** — název v seznamu a v rozbalovacích seznamech pro úkoly a zdroje.
- **Pracovní dny** — tlačítko pro každý den v týdnu, od *Po* do *Ne*; stisknuté tlačítko je pracovní den. Pořadí se řídí podle *Týden začíná* (*Nastavení*, karta *Plán*). Výchozí je *Po* až *Pá*. Dvě rychlá tlačítka: *Po–Pá* nastaví pondělí až pátek, 07:00 až 16:00, 8 hodin; nastavená přestávka se vrátí na výchozích 12:00, 60 minut. *Nepřetržitě (24/7)* nastaví všech sedm dní, 00:00 až 24:00, 24 hodin. Účinek: úkol pracuje jen v pracovních dnech. Aplikace bez pracovních dnů kalendář nevypočítá (*Kalendář nemá nastaveny žádné pracovní dny*).
- **Začátek (hodina)** a **Dokončení (hodina)** — začátek a konec pracovního dne ve 24hodinovém formátu HH:MM. Výchozí hodnota je 07:00 a 16:00. Šipky (nebo šipkové klávesy) mění hodnotu po 15 minutách; konec může být 24:00, začátek musí být před koncem. Účinek: spolu s přestávkou určují čisté hodiny za den. Pro data úkolu ve dnech se nepočítají; pro úkoly v hodinách se počítají. Tato pole zmizí, když je zapnutá volba *Zapnout plánování v hodinách* a kalendář má pracovní dobu podle dnů v týdnu: ta pak mají přednost.
- **Začátek přestávky** a **Doba trvání přestávky (minuty)** — začátek a délka přestávky, se stejnými kroky po 15 minutách. Výchozí hodnota je 12:00 a 60 minut. Když nastavíte dobu trvání na 0, je pracovní den bez přestávky. Přestávka musí být celá v pracovním dni a nesmí zabrat celý pracovní den. Účinek: čisté hodiny jsou konec minus začátek minus přestávka; u úkolu v hodinách se v přestávce nepracuje. Tato pole zmizí za stejné podmínky jako *Začátek (hodina)*.
- **Čisté hodiny za den** — jen pro čtení: odvozená délka pracovního dne se dvěma desetinnými místy, například *8,00 h*. Výchozí hodnota je 8. Účinek: tato délka určuje, kolik hodin má den při převodu mezi dny a hodinami a u úkolů v hodinách. Viz [Dny a hodiny](docs://uitleg-dagen-en-uren).

### Pracovní doby

Tento blok je vidět jen tehdy, když je zapnutá volba *Zapnout plánování v hodinách* (*Nastavení*, karta *Plán*). Zde nastavíte pracovní doby a směny podle dne v týdnu. Viz [Nastavení pracovní doby](docs://howto-werktijden-instellen).

- **Předvolby** — tlačítka, která nastaví pracovní doby najednou: *Denní směna* (Po–Pá 08:00 až 16:00, běžný denní kalendář), *2 směny* (Po–Pá 06:00 až 22:00, 16 hodin), *3 směny* (Po–Pá 06:00 až 06:00 následující den, 24 hodin), *Noční směna* (Po–Pá 22:00 až 06:00, 8 hodin) a *24/7* (všechny dny 00:00 až 24:00). Za vestavěnými tlačítky jsou vaše vlastní předvolby, každá s křížkem pro odstranění.
- **Uložit jako předvolbu…** — uloží aktuální pracovní doby jako vaši vlastní předvolbu na tomto zařízení, aby je šlo použít v každém projektu. Zadáte název (*Název vlastní předvolby*) a kliknete na *Uložit* nebo *Zrušit*.
- **Nastavit podle dnů v týdnu…** — přepne denní kalendář na hodinový kalendář: aktuální časy se stanou bloky pracovní doby v každém pracovním dni a přestávka zůstane jako mezera. U hodinového kalendáře se tlačítko jmenuje *Skrýt pracovní hodiny* nebo *Zobrazit pracovní hodiny* a sbalí nebo rozbalí editor. U hodinového kalendáře je editor ve výchozím stavu otevřený.
- **Editor** — po dnech v týdnu seznam bloků (*blok*) se začátkem a koncem. Zaškrtávací políčko *následující den* umožní, aby blok běžel přes půlnoc (noční směna). *Přidat blok* (plus) přidá 08:00 až 16:00. *Kopírovat na pracovní dny* (jen Po–Pá) zkopíruje bloky toho dne na pondělí až pátek. Den bez bloků se nazývá *Nepracovní*. Dole je *Odvozené hodiny/den:* a jakmile má den víc než jeden blok, objeví se nápověda *Mezera mezi dvěma bloky je přerušení práce — podle potřeby upravte časy.* Účinek: bloky mají přednost. Den s bloky je pracovní den a pole *Začátek (hodina)*, *Dokončení (hodina)* a přestávka zmizí.

### Svátky

- **Generovat svátky…** — otevře generátor. *Země* vybere *Nizozemsko*, *Německo*, *Belgie*, *Francie*, *Spojené království*, *Rakousko*, *Švýcarsko* nebo *Žádné svátky*. *Region* se zobrazí jen tehdy, když země má regiony; výchozí je *Celostátní*. *Letní stavební uzávěra* se zobrazí jen pro Nizozemsko a jen když je zapnutá volba *Zapnout stavební režim*. Volby jsou *Žádná* (výchozí), *Sever*, *Střed* a *Jih*, s nápovědou *Orientační data — ověřte u Bouwend Nederland*. Řádek náhledu ukazuje, kolik svátků vznikne (*… svátků, …–…*), a dá se rozbalit na seznam. *Vygenerovat* vloží výsledek do kalendáře, který upravujete (platí až po *Použít*), *Zrušit* zavře generátor. Účinek: celý seznam *Svátky* se nahradí, včetně toho, co jste přidali sami. Roky, které generátor pokrývá, sahají od roku před zahájením projektu až do roku po konci projektu včetně (bez konce projektu: nejvýše tři roky po zahájení). Viz [Generování svátků a letní stavební uzávěry](docs://howto-feestdagen-genereren).
- **Vygenerovat znovu** — objeví se vedle tlačítka, když vygenerované svátky už nepokrývají období projektu, s textem *Svátky pokrývají …–…; projekt běží do …. Vygenerovat znovu?* Kliknutí vygeneruje stejnou volbu (země, region, letní stavební uzávěru) znovu pro nové období. Bez tohoto tlačítka jsou dny mimo vygenerované roky běžné pracovní dny.
- **Svátky** — seznam dní volna: *Popis*, *Od* a *Do* a koš u každého řádku. *Přidat svátek* přidá řádek s dnešním datem v poli *Od* a prázdným *Do*. Prázdné *Do* znamená jeden den. Bez řádků se zobrazí *Zatím žádné svátky.* Účinek: všechny dny v období jsou v tomto kalendáři nepracovní dny, pro úkoly v tomto kalendáři i pro zdroje, které ho používají. Neplatný řádek dostane červený rámeček a text (*Zadejte platné datum začátku.*, *Zadejte platné datum konce, nebo jej nechte prázdné pro jeden den.* nebo *Datum konce je před datem začátku.*) a blokuje *Použít*.

### Chybová hlášení a výjimky

Chyby v pracovní době se zobrazí pod poli a blokují *Použít*: *Zadejte platný čas začátku ve formátu HH:MM.*, *Zadejte platný čas konce ve formátu HH:MM.*, *Čas začátku musí být před časem konce.*, *Zadejte platný čas přestávky ve formátu HH:MM.*, *Doba trvání přestávky musí být celé číslo minut 0 nebo více.*, *Přerušení práce musí být celé v nastaveném pracovním dni.* a *Přerušení práce nesmí zabrat celý pracovní den.*

Kalendář zná dny volna pouze jako výjimku. Kalendář ze souboru MS Project nebo Primavera může mít také pracovní výjimky, tedy navíc jeden pracovní den; okno je nezobrazuje ani neupravuje.

## Okno Kalendář zdroje

- **Kalendář zdroje** — formulář výše, v okně jen s tlačítky *Použít* a *Zrušit*. Esc a křížek mají stejný účinek jako *Zrušit*; klik vedle okna nedělá nic a Enter zde také nic nedělá. V něm upravujete jeden kalendář: existující, nebo nový s výchozím názvem *Kalendář zdroje*, který se po *Použít* propojí se zdrojem (*Zrušit* nezanechá nic). Když ho otevřete v zobrazení *Knihovna* panelu zdrojů, upravuje kalendář v knihovně zdrojů; v zobrazení *Projekt* upravuje kalendář projektu, i když pochází z knihovny zdrojů. Účinek: kalendář zdroje určuje, kdy je zdroj k dispozici v histogramu, u přetížení a při vyrovnání; nemění data úkolu. *Použít* nepřepočítá. Pokud je kalendář také u úkolů nebo je kalendářem projektu, plán se změní: označí se jako neaktuální a *Přepočítat* ho přepočítá. Viz [Nastavení kalendáře zdroje](docs://howto-resourcekalender-instellen).
