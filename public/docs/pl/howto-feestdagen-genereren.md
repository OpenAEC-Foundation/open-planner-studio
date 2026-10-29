# Generowanie świąt i urlopu budowlanego

Cel: wypełnić kalendarz świętami danego kraju i ewentualnie urlopem budowlanym, a tam, gdzie trzeba, dodać własny dzień lub okres wolny.

## Kiedy tego potrzebujesz

Bez świąt aplikacja po prostu planuje pracę w Boże Narodzenie albo w Dzień Króla. Nowy projekt dostaje już holenderskie święta, o ile *Tryb budowlany* jest włączony. Generujesz je ponownie, jeśli potrzebujesz innego kraju lub regionu, jeśli chcesz uwzględnić urlop budowlany albo jeśli projekt wypada poza latami, dla których utworzono święta. Te lata mają znaczenie: dla aplikacji dzień poza nimi jest zwykłym dniem roboczym. Jak aplikacja uwzględnia święto przy liczeniu, przeczytasz w [Kalendarze i dni robocze](docs://uitleg-kalenders).

**Urlop budowlany** (*bouwvak*) to urlop, który branża budowlana w Holandii bierze wspólnie, trzy tygodnie latem. W aplikacji jest domyślnie wyłączony.

## Kroki

### Generowanie świąt

1. Wybierz *Planowanie › Kalendarz › Kalendarz* i po lewej stronie wybierz kalendarz, do którego mają trafić święta.
2. Kliknij *Generuj święta…*. Pod przyciskiem otwiera się blok z wyborami.
3. Wybierz *Kraj*: Holandia, Niemcy, Belgia, Francja, Wielka Brytania, Austria, Szwajcaria albo *Bez świąt*. Dla części krajów pojawia się też lista *Region*, na przykład kraj związkowy w Niemczech. *Krajowe* zostawia tylko święta, które obowiązują wszędzie.
4. Dla Holandii wybierz *Urlop budowlany*: *Brak* (domyślnie), *Północ*, *Środek* albo *Południe*. Urlop budowlany pojawia się na liście jako jeden okres, na przykład *Bouwvak (Noord)*, trzy tygodnie od poniedziałku do piątku. Ten wybór widzisz tylko wtedy, gdy *Tryb budowlany* jest włączony.
5. Pod wyborami znajduje się podsumowanie, na przykład *21 świąt, 2026–2028*. Kliknij je, aby zobaczyć daty.
6. Kliknij *Generuj*. Lista *Dni wolne* jest teraz wypełniona.
7. Kliknij *Zastosuj*. Aplikacja od razu przelicza harmonogram.

Dla Holandii aplikacja co roku umieszcza na liście Nieuwjaar, Goede Vrijdag, Pasen (dwa dni), Koningsdag, Hemelvaart, Pinksteren (dwa dni) i Kerst (25 i 26 grudnia) (Nowy Rok, Wielki Piątek, Wielkanoc, Dzień Króla, Wniebowstąpienie, Zielone Świątki i Boże Narodzenie). Jeśli Koningsdag wypada w niedzielę, przypada 26 kwietnia. Bevrijdingsdag (Dzień Wyzwolenia) znajduje się na liście tylko w latach podzielnych przez pięć, na przykład w 2025 i 2030.

Lata zależą od okresu projektu: od roku przed datą początkową do roku po dacie końcowej. Jeśli projekt nie ma daty końcowej, sięgają do trzech lat po roku daty początkowej. Zmieniasz początek i koniec w *Ustawienia › Projekt › Ustawienia projektu*.

### Ponowne generowanie po nowym okresie projektu

Jeśli projekt się przesunie albo dostanie późniejszą datę końcową, święta nie obejmują już nowych lat. Aplikacja pokazuje to w oknie *Kalendarze*, na przykład *Święta obejmują 2025–2028. Wygenerować ponownie do 2030 włącznie?* Następnie kliknij *Generuj ponownie*. Aplikacja używa tych samych wyborów co ostatnio (kraj, region, urlop budowlany) dla lat projektu. Potem kliknij *Zastosuj*. Ten komunikat widzisz tylko przy kalendarzu, którego święta zostały wygenerowane wcześniej.

### Dodawanie własnego dnia lub okresu wolnego

1. W oknie *Kalendarze* kliknij *Dodaj dzień wolny*. Na dole listy pojawia się nowy wiersz z dzisiejszą datą pod *Od*.
2. Wpisz *Opis*, na przykład *Wyjazd firmowy*.
3. Dostosuj *Od*. Zostaw *Do* puste przy jednym dniu albo wpisz ostatni dzień wolny przy okresie, na przykład na zimowe ferie.
4. Kliknij *Zastosuj*.

Za pomocą kosza przy wierszu usuwasz dzień wolny.

### Usuwanie wszystkich świąt

Wybierz *Bez świąt* w polu *Kraj* i kliknij *Generuj*. Lista jest wtedy pusta.

## Pułapki i co wtedy robi aplikacja

**Generowanie zastępuje całą listę.** Dni, które dodasz samodzielnie, też znikną. Dodaj je potem ponownie.

**Goede Vrijdag jest uwzględniony.** Jeśli Twoja firma pracuje w Wielki Piątek albo w Bevrijdingsdag w roku podzielnym przez pięć, usuń ten wiersz za pomocą kosza.

**Daty urlopu budowlanego są orientacyjne.** Aplikacja zna je w latach 2025–2028 włącznie; dla innych lat podaje przybliżone szacunki. Po wybraniu urlopu budowlanego pokazuje więc *Daty orientacyjne — zweryfikuj w Bouwend Nederland*. W razie potrzeby dostosuj okres na liście.

**Nieprawidłowy wiersz.** Wiersz bez prawidłowej daty *Od*, z datą *Do* wcześniejszą niż *Od* albo z nieczytelną datą dostaje czerwony komunikat, na przykład *Data końcowa jest wcześniejsza niż data początkowa.* Przycisk *Zastosuj* jest wyłączony, dopóki nie poprawisz wiersza.

**Przy nowym projekcie.** Okno *Nowy projekt* ma te same wybory w polu *Zestaw świąt*. Przy wyborze *Niestandardowe…* zaczynasz bez świąt; po utworzeniu otwiera się okno *Kalendarze*, aby móc je uzupełnić samodzielnie.

## Zobacz także

- [Kalendarze i dni robocze](docs://uitleg-kalenders): jak aplikacja uwzględnia święta i urlop budowlany przy liczeniu dni roboczych.
- [Tworzenie i przypisywanie kalendarza](docs://howto-kalender-maken-en-toewijzen): tworzenie własnego kalendarza, w którym umieścisz święta.
- [Okna kalendarzy](docs://ref-kalenders): wszystkie pola okien kalendarzy.
- [Nowy projekt i Ustawienia projektu](docs://ref-projectinfo): zestaw świąt dla nowego projektu.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): obok świąt kalendarz projektu ma okres wolny *Frost delay, foundations*.
