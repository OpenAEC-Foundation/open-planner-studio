# Kalendarze i planowanie godzinowe

Zadanie o czasie trwania „5 dni" ma znaczenie tylko w połączeniu z kalendarzem: które dni są dniami roboczymi, w jakich godzinach wykonywana jest praca i które dni odpadają z powodu święta lub tymczasowego zamknięcia? Ten przewodnik obejmuje kalendarz projektu, kalendarze zasobów oraz opcjonalne planowanie godzinowe dla każdego, kto chce planować z dokładnością do godziny.

## Czego się tu nauczysz

- Konfigurowania kalendarza projektu: dni robocze, godziny pracy, dni wolne.
- Automatycznego generowania dni wolnych na dany rok, w tym urlopu budowlanego.
- Dodawania jednorazowego, doraźnego zamknięcia (na przykład przerwy mrozowej).
- Nadawania zasobowi własnego kalendarza, na przykład dla 4-dniowego tygodnia pracy.
- Włączania głównego przełącznika **Planowanie godzinowe** i konfigurowania pasm/zmian czasu pracy.
- Jak zadania dniowe i godzinowe współistnieją w tym samym harmonogramie.

Podążaj za przykładem [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (przerwa mrozowa, 4-dniowy kalendarz zasobu) oraz [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (planowanie godzinowe dla robót zbrojarskich i betonowania), oba dostępne również przez **Plik → Przykłady**.

## Kalendarz projektu

Kalendarze są zarządzane w oknie **Kalendarze**, otwieranym przez grupę wstążki **Kalendarz** na karcie **Planowanie** (zarówno przycisk **Kalendarz**, jak i **Dni wolne** otwierają to samo okno). To okno pokazuje po lewej stronie bibliotekę wszystkich kalendarzy w projekcie — nie tylko kalendarz projektu, ale też wszelkie kalendarze zasobów (patrz niżej) — z gwiazdką oznaczającą kalendarz, który jest aktualnie **Kalendarzem projektu**. Zaznacz kalendarz po lewej i edytuj go po prawej; użyj **Ustaw jako domyślny dla projektu**, aby uczynić inny kalendarz z listy nowym kalendarzem projektu. Dla zaznaczonego kalendarza ustawiasz:

- **Dni robocze** — które z siedmiu dni tygodnia (od pon. do niedz.) liczą się jako dzień roboczy. Domyślnie od poniedziałku do piątku.
- **Godziny pracy** — **Początek (godz.)**, **Koniec (godz.)** i wynikające z nich **Godziny dziennie**.
- **Dni wolne** — lista dni wolnych, każdy z **Opisem** oraz datą **Od**/**Do**.

Zmiany w kalendarzu projektu wchodzą w życie natychmiast przy obliczeniu: zadania, które w przeciwnym razie wypadałyby w dniu, który teraz nie jest roboczy, przesuwają się na następny dzień roboczy.

### Automatyczne generowanie dni wolnych

Zamiast wpisywać dni wolne pojedynczo, możesz je wygenerować automatycznie przez **Generuj święta…** w oknie kalendarza. Wybierz **Kraj** (Holandia, Niemcy, Belgia, Francja, Wielka Brytania, Austria, Szwajcaria) i opcjonalnie **Region**. Dla Holandii istnieje też specjalna opcja budowlana: **Urlop budowlany**, z wyborem **Północ**, **Środek** lub **Południe** (albo **Brak**). Wygenerowane daty urlopu budowlanego to daty orientacyjne — aplikacja sama o tym ostrzega: zweryfikuj dokładne daty w Bouwend Nederland dla bieżącego roku. Po wybraniu kraju/regionu okno pokazuje podgląd — na przykład „12 świąt, 1-1-2026–31-12-2026" — zanim klikniesz **Generuj**.

Jeśli wygenerujesz dni wolne dla projektu, który przekracza granicę roku lub zostanie później przedłużony, Open Planner Studio rozpoznaje, że już wygenerowane dni wolne nie obejmują już całego okresu projektu, i okno oferuje **Generuj ponownie**, aby dodać brakujące lata — bez utraty dni wolnych dodanych wcześniej ręcznie.

### Doraźne zamknięcia (na przykład przerwa mrozowa)

Nie każda przerwa w pracy to coroczne, powtarzające się święto. Dla jednorazowych, specyficznych dla projektu zamknięć — tygodnia przerwy mrozowej, lokalnego zamknięcia z powodu wydarzenia — po prostu dodajesz dodatkowy wiersz ręcznie przez **Dodaj dzień wolny** w tej samej liście: nadaj mu **Opis** (na przykład „Przerwa mrozowa") i okres **Od**/**Do**. Takie doraźne zamknięcie działa technicznie identycznie jak wygenerowane święto — obliczenie CPM bierze je pod uwagę tak samo — ale jest oddzielone od automatycznego, corocznego generowania, więc kolejne **Generuj ponownie** go nie nadpisze.

Zobacz okres przerwy mrozowej w praktyce w przykładzie [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): wspólny fundament sześciu domów zawiera okres przerwy mrozowej dodany jako osobny wpis podobny do dnia wolnego w kalendarzu, obok automatycznie wygenerowanych holenderskich świąt.

## Kalendarze zasobów

Oprócz jednego kalendarza projektu, każdy zasób może otrzymać własny kalendarz — na przykład dla podwykonawcy, który jest dostępny tylko cztery dni w tygodniu, podczas gdy reszta projektu działa pięć dni. Kalendarze zasobów są zarządzane przez pole **Kalendarz** na zasobie (z przyciskiem **Edytuj…** obok niego) lub przez okno **Kalendarz zasobu**; domyślnie zasób jest ustawiony na **Kalendarz projektu**.

Kalendarz zasobu korzysta z tego samego formularza co kalendarz projektu (**Dni robocze**, **Godziny pracy**, **Dni wolne**), ale jest czysto informacyjny dla zasobu: nie zmienia niczego w datach CPM zadania. To, na co wpływa, to **obciążenie** (histogram) i **bilansowanie**: jeśli zasób jest ustawiony na 4-dniowy tydzień, podczas gdy zadanie, do którego jest przypisany, trwa 5 dni roboczych, obciążenie zasobu pokazuje niedobór piątego dnia, a okno bilansowania (**Bilansuj zasoby**) ostrzega, że zasób nie pracuje we wszystkie dni, których potrzebuje zadanie — przesunięcie w ramach zapasu automatycznie tego niedopasowania kalendarzy nie rozwiąże.

Zobacz 4-dniowy kalendarz zasobu w praktyce: monterzy w [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) pracują na własnym kalendarzu ze skróconym tygodniem pracy, podczas gdy reszta projektu nadal działa na normalnym kalendarzu projektu.

## Planowanie godzinowe: główny przełącznik

Domyślnie Open Planner Studio działa całkowicie z granulacją **dniową** — każde zadanie ma czas trwania w pełnych dniach (roboczych). Dla zadań, które wolisz planować co do godziny (pomyśl o betonowaniu, które zaczyna się o 7:00 i musi być gotowe do 14:00, dobrze przed zmianą pogody), istnieje opcjonalne **Planowanie godzinowe**.

Włącz główny przełącznik przez **Ustawienia → Oś czasu / Powiększenie → Włącz planowanie godzinowe**. Dodaje to skalę czasu w godzinach, zmiany z pasmami czasu pracy oraz paski zadań z dokładnością do godziny; przy wyłączonym przełączniku aplikacja działa w pełni tak jak wcześniej, z granulacją dniową. Istnieje też opcja **Zezwól na mieszane planowanie dniowo-godzinowe**, którą włączasz, jeśli chcesz łączyć zadania dniowe i godzinowe w tym samym projekcie (patrz niżej).

## Pasma i zmiany czasu pracy

Przy włączonym planowaniu godzinowym kalendarz otrzymuje dodatkową warstwę: zamiast tylko „dzień roboczy tak/nie", ustawiasz **pasma czasu pracy** dla każdego dnia (sekcja **Godziny pracy** w oknie kalendarza) — dokładne przedziały czasowe, w których wykonywana jest praca. Przerwa między dwoma pasmami automatycznie staje się przerwą; aby zaplanować przerwę, po prostu dostosuj godziny sąsiadujących pasm tak, aby powstała luka.

Abyś nie musiał za każdym razem rysować pasm ręcznie, istnieją gotowe **profile zmian**:

- **Zmiana dzienna** — zwykłe godziny biurowe, jedno pasmo na dzień.
- **2 zmiany** — dwie kolejne zmiany.
- **3 zmiany** — trzy kolejne zmiany, obejmujące niemal cały dzień.
- **Zmiana nocna** — zmiana, która przechodzi przez północ.
- **24/7** — praca ciągła, bez przerwy.

Oprócz tych profili możesz też **Ustawić dla każdego dnia tygodnia…** pasma całkowicie ręcznie, na przykład jeśli piątek jest krótszy niż reszta tygodnia. Ułożyłeś własną kombinację, którą chcesz częściej wykorzystywać ponownie? Zapisz ją przez **Zapisz jako profil…** — profil jest przechowywany lokalnie na tym urządzeniu i można go potem wybrać ponownie w dowolnym projekcie. Sekcja pokazuje też **Wyliczone godziny/dzień**: liczbę efektywnych godzin pracy wynikającą ze skonfigurowanych pasm.

## Zadania godzinowe

Przy włączonym planowaniu godzinowym i zadaniu na **kalendarzu godzinowym** (kalendarzu z pasmami czasu pracy, a nie tylko z pełnymi dniami), okno edycji zadania pokazuje dodatkowe pola: **Czas trwania (godziny)** obok **Czasu trwania (dni)** oraz sumę w polu **Suma godzin**. Kalendarz godzinowy jest wymagany do wprowadzania w godzinach — spróbuj wprowadzić godziny na zwykłym kalendarzu dniowym, a podpowiedź na to wskaże.

Dokładnie tak w praktyce planowane są zadania betonowania: zadanie „Vloer storten toren A" (Betonowanie stropu wieży A) z czasem trwania, powiedzmy, 6 godzin, połączone z kalendarzem zmianowym, który tego dnia ma zmianę poranną. Zobacz ten wzorzec w dużym przykładzie [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc), który wykorzystuje planowanie godzinowe dla robót zbrojarskich i betonowania.

## Mieszanie zadań dniowych i godzinowych

Projekt nie musi działać w całości na godzinach, aby skorzystać z planowania godzinowego: przy zaznaczonym **Zezwól na mieszane planowanie dniowo-godzinowe**, zadania dniowe (na zwykłym kalendarzu projektu) i zadania godzinowe (na kalendarzu godzinowym) mogą współistnieć i wiązać się ze sobą w tym samym harmonogramie. W takim przypadku tabela zadań pokazuje czas trwania każdego zadania we własnej jednostce — zadanie dniowe w dniach, zadanie godzinowe w godzinach — i ostrzega na dole tabeli, gdy zadania z różnymi godzinami na dzień działają obok siebie, dzięki czemu pozostaje jasne, które porównania są jabłkami do jabłek, a które nie.

## Czytaj dalej

- Zobacz przerwę mrozową i 4-dniowy kalendarz zasobu w praktyce: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Zobacz planowanie godzinowe dla robót zbrojarskich i betonowania w praktyce: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Relacje oraz zwłoka/wyprzedzenie działają na tych samych jednostkach kalendarzowych — przeczytaj [Relacje i ograniczenia](docs://gids-relaties-constraints), aby poznać różnicę między zwłoką w dniach roboczych a zwłoką kalendarzową.
