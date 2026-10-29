# Przydzielanie zasobów z krzywą

Cel: przypisz zasób do zadania, z jednostkami na dzień i krzywą, która decyduje, jak te jednostki rozłożą się na dni zadania.

## Kiedy tego potrzebujesz

Gdy chcesz zobaczyć, kto pracuje gdzie i kiedy, na przykład murarz przy zewnętrznej warstwie muru szczelinowego albo dźwig przy płytach stropowych kanałowych. Bez przydziału nie ma obciążenia, więc nie ma histogramu ani przeciążenia.

Dwa pojęcia. **Jednostki** (w panelu w kolumnie *Jednostki*, w oknie *Przydziel* w polu *Jedn./dzień*) to ile zasobu pracuje przy zadaniu na dzień roboczy: 1 to jeden murarz, 2 to dwóch z nich, 0,5 to pół dnia. **Krzywa** decyduje, jak suma, czyli jednostki razy czas trwania, rozkłada się na dni robocze zadania. Praca rzadko jest równomierna: przy ścianie początek jest spokojny, środek intensywny, a koniec znów spokojny.

Zewnętrzna warstwa muru szczelinowego trwa 6 dni roboczych. Przy jednym murarzu i krzywej *Jednolity* jest to 1 jednostka na każdy z 6 dni, razem 6. Przy krzywej *Dzwonowy* jest to nadal razem 6 jednostek, ale rozkład wynosi 0, 1, 2, 2, 1 i 0.

## Kroki

Zasób możesz przydzielić na dwa sposoby. Zasób musi już istnieć (zobacz [Zarządzanie zasobami](docs://howto-resources-beheren)).

### Przez wstążkę

1. Zaznacz jedno zadanie w tabeli zadań. Musi to być zwykłe zadanie, nie kamień milowy i nie zadanie sumaryczne.
2. Wybierz *Zasoby › Przydział › Przydziel ▾*.
3. W oknie wpisz w polu *Jedn./dzień* (domyślnie 1) i wybierz *Krzywa* (domyślnie *Jednolity*). Te wartości dotyczą zasobu, który teraz wybierzesz.
4. Kliknij zasób. Okno zamknie się, a przydział jest dodany.

Dla drugiego zasobu otwierasz okno ponownie. Zasoby, które już są przy zadaniu, nie pojawiają się na liście.

### Przez panel właściwości

1. Zaznacz zadanie. Panel *Właściwości* znajduje się po prawej. Jeśli go nie widzisz, włącz go przez *Widok › Panele › Właściwości*.
2. W bloku *Przydziały*, na samym dole, wybierz zasób przy *Przydziel zasób*. Nowy przydział ma 1 jednostkę i krzywą *Jednolity*.
3. Dla każdego przydziału zmień *Jednostki*. Kliknij nazwę zasobu, aby pokazać *Krzywa*, i wybierz tam inną krzywą.

Tak zmieniasz też istniejący przydział. Ikoną kosza (*Usuń*) na końcu wiersza usuwasz przydział z zadania. Sam zasób zostaje. Przy *Przenieś do…* (pokazuje się po kliknięciu nazwy) przenosisz przydział do innego zadania.

### Krzywe

- *Jednolity*: taki sam każdego dnia. To jest domyślna krzywa i pasuje do pracy, która każdego dnia jest równie intensywna.
- *Obciążony na początku*: początek jest cięższy niż koniec. Pasuje do pracy, która zaczyna się intensywnie, na przykład wytyczanie.
- *Obciążony na końcu*: koniec jest cięższy niż początek. Pasuje do pracy, która przybiera na intensywności w miarę zbliżania się do końca.
- *Dzwonowy*: szczyt w środku, cichy początek i koniec. Pasuje do ściany, która zaczyna się spokojnie, w środku działa pełną parą i potem zwalnia.
- *Wczesny szczyt*: szczyt przed środkiem. Pasuje do pracy, która szybko nabiera tempa.
- *Późny szczyt*: szczyt po środku. Pasuje do pracy, której intensywny okres przychodzi dopiero później.
- *Podwójny szczyt*: dwa szczyty. Pasuje do pracy z dwoma intensywnymi momentami.
- *Żółw*: cichy początek i koniec, z szerokim szczytem w środku. Pasuje do długiej pracy, która stopniowo nabiera tempa i stopniowo zwalnia.

Krzywa zmienia tylko rozkład. Czas trwania, daty i suma zostają takie same. Potem nie musisz przeliczać. Histogram zmienia się od razu. Aby go zobaczyć, wybierz *Zasoby › Histogram › Histogram*. Jeśli zaznaczysz zadanie, histogram pokazuje tylko obciążenie tego zadania.

## Pułapki i co aplikacja robi wtedy

**Krzywa może podnieść szczyt powyżej Twoich jednostek.** Przy całkowitych jednostkach aplikacja zaokrągla wartość na dzień do całych jednostek, a suma pozostaje taka sama. Murarz z jednostkami 1 przy zewnętrznej warstwie muru szczelinowego i krzywej *Dzwonowy* daje 0, 1, 2, 2, 1, 0. W dwóch środkowych dniach to 2 jednostki, a *Maks. jednostki* wynosi 1. Histogram koloruje te dni na czerwono, a zasób uznaje się za przeciążony. Wybierz inną krzywą albo rozłóż godziny sam (zobacz [Dostosowywanie rozkładu godzin](docs://howto-urenverdeling-aanpassen)). Przy jednostkach takich jak 0,5 aplikacja zaokrągla do setnych. Przy krótkim zadaniu z całkowitymi jednostkami kształt rozkładu staje się mniej dokładny: przez 10 dni *Żółw* z jednostkami 1 daje rozkład 0, 1, 1, 2, 2, 1, 1, 1, 1, 0, dokładnie tak samo jak *Wczesny szczyt*.

**Kamień milowy lub zadanie sumaryczne.** Wtedy przycisk *Przydziel* jest wyłączony, a *Właściwości* mówią *Przydziały nie są możliwe dla kamieni milowych.* albo *Przydziały nie są możliwe dla zadań sumarycznych.*

**Zasób tylko raz przy zadaniu.** Jeśli zasób już jest przy zadaniu, nie ma go już na liście. Jeśli wszystkie zasoby są już przy zadaniu, aplikacja pokazuje *Wszystkie zasoby są już przydzielone.* Jeśli nie ma jeszcze żadnego zasobu, pokazuje *Najpierw utwórz zasoby (karta Zasoby).*

**Jednostki muszą być większe niż 0.** Aplikacja nie przyjmuje wartości 0 lub mniejszej.

**Materiał.** Dla zasobu materiałowego jednostki to ilość na dzień, w jednostce tego zasobu, na przykład m³. Materiał nie wlicza się do czasu trwania zadania.

**Typ zadania może zmienić czas trwania.** Jeśli typ zadania to *Stała praca* albo *Stałe jednostki*, drugi zasób zmienia czas trwania zadania. Harmonogram jest wtedy nieaktualny. Naciśnij **Oblicz** (F5). Zobacz [Typy zadań: czas trwania, jednostki i praca](docs://uitleg-werkregels).

**Rozkład własny.** Jeśli przydział ma już własny rozkład godzin, krzywa jest wyłączona i pokazuje *Kontur*. Najpierw zwolnij ten rozkład przez *Rozkład godzin…*.

**Cofanie.** Utworzenie, zmianę lub usunięcie przydziału możesz cofnąć przyciskiem *Cofnij* (Ctrl+Z).

## Zobacz też

- [Dostosowywanie rozkładu godzin](docs://howto-urenverdeling-aanpassen): ręczne ustawianie godzin na dzień.
- [Rozwiązywanie przeciążenia](docs://howto-overbezetting-oplossen): co zrobić, gdy zasób ma w jednym dniu za dużo pracy.
- [Typy zadań: czas trwania, jednostki i praca](docs://uitleg-werkregels): co się dzieje z czasem trwania, gdy zmienisz jednostki.
- [Panel zasobów](docs://ref-resourcepaneel): wszystkie pola i przyciski panelu zasobów.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): wszystkie pięć typów zasobów, sześć z ośmiu krzywych i dźwig wieżowy ze zmianą zdolności od 30 sierpnia 2027.
