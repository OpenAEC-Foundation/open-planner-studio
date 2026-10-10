# Generování svátků a letní stavební uzávěry

Cíl: mít v kalendáři vyplněné svátky země a případně letní stavební uzávěru a tam, kde je potřeba, přidat vlastní den nebo období volna.

## Kdy to potřebujete

Bez svátků aplikace naplánuje práci i na Vánoce nebo Královský den. Nový projekt už dostane nizozemské svátky, pokud je zapnutý *Stavební režim*. Svátky znovu generujete, když potřebujete jinou zemi nebo region, když chcete zahrnout letní stavební uzávěru, nebo když váš projekt spadá mimo roky, pro které byly svátky vytvořeny. Ty roky jsou důležité: pro aplikaci je den mimo ně jen pracovní den. Jak aplikace při počítání zohledňuje svátek, přečtete si v článku [Kalendáře a pracovní dny](docs://uitleg-kalenders).

**Letní stavební uzávěra** je společné období volna ve stavebnictví v Nizozemsku, tři týdny v létě. V aplikaci je ve výchozím stavu vypnutá.

## Postup

### Generování svátků

1. Zvolte *Plán › Kalendář › Kalendář* a vlevo vyberte kalendář, do kterého mají svátky patřit.
2. Klikněte na *Generovat svátky…*. Pod tlačítkem se otevře panel s volbami.
3. Zvolte pole *Země*: Nizozemsko, Německo, Belgie, Francie, Spojené království, Rakousko, Švýcarsko, nebo *Žádné svátky*. U některých zemí se navíc zobrazí seznam *Region*, například spolková země v Německu. Volba *Celostátní* ponechá jen svátky, které platí v celé zemi.
4. Pro Nizozemsko zvolte pole *Letní stavební uzávěra*: *Žádná* (výchozí), *Sever*, *Střed* nebo *Jih*. Letní stavební uzávěra se v seznamu zobrazí jako jedno období, například *Letní stavební uzávěra (Sever)*, tři týdny od pondělí do pátku. Tuto volbu uvidíte jen tehdy, když je *Stavební režim* zapnutý.
5. Pod volbami je přehled, například *Počet svátků: 21, 2026–2028*. Klikněte na něj a zobrazte si data.
6. Klikněte na *Vygenerovat*. Seznam *Svátky* je nyní vyplněný.
7. Klikněte na *Použít*. Aplikace ihned přepočítá plán.

Pro Nizozemsko aplikace každý rok zapíše do seznamu tyto svátky: Nový rok, Velký pátek, Velikonoce (dva dny), Královský den, Nanebevstoupení Páně, Letnice (dva dny) a Vánoce (25. a 26. prosince). Pokud Královský den připadne na neděli, je 26. dubna. Den osvobození je v seznamu jen v lustrových letech, tedy v letech dělitelných pěti, například 2025 a 2030.

Roky se řídí obdobím projektu: od roku před datem začátku do roku po datu konce. Pokud projekt nemá datum konce, platí nejvýše tři roky po roce začátku. Začátek a konec upravíte na kartě *Nastavení › Projekt › Info o projektu*.

### Nové vygenerování po změně období projektu

Pokud se váš projekt posune nebo dostane pozdější datum konce, svátky už nové roky nepokrývají. Aplikace to oznámí v okně *Kalendáře*, například: *Svátky pokrývají 2025–2028; projekt běží do 2030. Vygenerovat znovu?* Klikněte na *Vygenerovat znovu*. Aplikace použije stejné volby jako minule (země, region, letní stavební uzávěra) pro roky projektu. Potom klikněte na *Použít*. Tuto zprávu uvidíte jen u kalendáře, jehož svátky byly vygenerovány dříve.

### Přidání vlastního dne nebo období volna

1. V okně *Kalendáře* klikněte na *Přidat svátek*. Na konci seznamu se objeví nový řádek s dnešním datem ve sloupci *Od*.
2. Vyplňte *Popis*, například *Firemní výlet*.
3. Upravte *Od*. Pro jeden den nechte *Do* prázdné, nebo pro období vyplňte poslední den volna, například pro zimní volno.
4. Klikněte na *Použít*.

Ikonou koše za řádkem svátek odstraníte.

### Odstranění všech svátků

V poli *Země* zvolte *Žádné svátky* a klikněte na *Vygenerovat*. Seznam je potom prázdný.

## Časté problémy a co aplikace udělá

**Generování nahradí celý seznam.** Dny, které jste přidali sami, zmizí také. Přidejte je potom znovu.

**Velký pátek je zahrnut.** Pokud vaše firma pracuje na Velký pátek, nebo v lustrovém roce na Den osvobození, odstraňte ten řádek pomocí ikony koše.

**Data letní stavební uzávěry jsou orientační.** Aplikace je zná pro roky 2025 až 2028 včetně. Pro jiné roky je odhaduje přibližně. Pokud zvolíte letní stavební uzávěru, zobrazí se proto *Orientační data — ověřte u Bouwend Nederland*. Pokud je potřeba, upravte období v seznamu.

**Neplatný řádek.** Řádek bez platného *Od*, řádek s *Do* před *Od* nebo řádek s nečitelným datem dostane červenou zprávu, například *Datum konce je před datem začátku*. Tlačítko *Použít* je neaktivní, dokud problém neopravíte.

**U nového projektu.** V okně *Nový projekt* jsou stejné volby v poli *Sada svátků*. Pokud zvolíte *Vlastní…*, začnete bez svátků. Po vytvoření se otevře okno *Kalendáře*, abyste je mohli doplnit sami.

## Viz také

- [Kalendáře a pracovní dny](docs://uitleg-kalenders): jak aplikace při počítání pracovních dnů zohledňuje svátky a letní stavební uzávěru.
- [Vytvoření a přiřazení kalendáře](docs://howto-kalender-maken-en-toewijzen): vytvoření vlastního kalendáře, do kterého zapíšete svátky.
- [Okna kalendářů](docs://ref-kalenders): všechna pole oken kalendářů.
- [Nový projekt a Info o projektu](docs://ref-projectinfo): sada svátků pro nový projekt.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): kromě svátků má kalendář projektu období volna *Frost delay, foundations*.
