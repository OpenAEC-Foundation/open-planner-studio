# Opcje bilansowania

Okno **Bilansuj zasoby** rozwiązuje nadmierne przydzielenie, przesuwając zadania. Działa w dwóch krokach: **Oblicz** buduje propozycję (nic jeszcze się nie zmienia), **Zastosuj** ją realizuje.

## Otwieranie

**Zasoby** → grupa wstążki **Bilansowanie** → **Bilansuj…**. **Esc**, krzyżyk zamykający albo kliknięcie poza oknem zamyka bez zastosowania.

## Opcje

- **Bilansuj tylko w ramach zapasu (wygładzanie) — data zakończenia projektu pozostaje bez zmian** — gdy zaznaczone, bilansowanie przesuwa zadania tylko w ramach ich zapasu całkowitego: data zakończenia nie może się przesunąć, ale nie każdy konflikt da się wtedy rozwiązać. Odznaczone (domyślnie), data zakończenia projektu może się wydłużyć, aby rozwiązać wszystkie konflikty.
- **Zasoby** — pole wyboru dla każdego zasobu: które zasoby biorą udział. Zasoby materiałowe są tu nieobecne (materiał nie jest bilansowany). Domyślnie wszystkie zasoby są zaznaczone.

## Oblicz

Wymaga aktualnego obliczenia; w przeciwnym razie okno pokazuje „Przelicz harmonogram (F5) przed bilansowaniem." Przycisk jest też wyłączony, gdy żaden zasób nie jest zaznaczony. Każda zmiana opcji unieważnia wcześniejszą propozycję — oblicz ponownie.

## Propozycja (podgląd)

- **Wiersz daty zakończenia projektu** — „bez zmian (data)" albo „stara data → nowa data" (na czerwono), jeśli projekt się wydłuża.
- **Tabela** — dla każdego przesuniętego zadania: **Zadanie**, **Poprzedni start**, **Nowy start** i **Dni przesunięcia**. Uwzględnione są też następniki bez zasobów, które przesuwają się razem przez logikę.
- Jeśli nie ma nic do zrobienia, okno zgłasza: „Żadne zadania nie wymagają przesunięcia — harmonogram jest już wolny od konfliktów."

## Pozostałe konflikty

Zadania, które nie mieszczą się w regułach, z liczbą dni konfliktu i powodem dla każdego zadania:

- „… szczyt … jedn./dzień, zdolność to … — nie da się tego rozwiązać przesunięciem." — przydział wymaga w szczycie więcej, niż zdolność zasobu; zmniejsz jednostki/dzień albo zwiększ Maks. jednostki.
- „Zasób nie pracuje we wszystkie dni potrzebne temu zadaniu — przesunięcie tego nie rozwiąże." — niedopasowanie kalendarza między zadaniem a zasobem.
- „Za mało wolnej zdolności w ramach zapasu, aby rozwiązać ten konflikt." — głównie przy wygładzaniu: brak wolnego okna w dostępnym zapasie.

## Zastosuj i cofnij

**Zastosuj** realizuje propozycję i zamyka okno; **Anuluj** zamyka bez zmian. Cofnij zastosowane bilansowanie za pomocą **Wyczyść bilansowanie** (ta sama grupa wstążki) albo Ctrl+Z.

## Dalsza lektura

- [Zasoby, histogram i bilansowanie](docs://gids-resources-histogram) — wykrywanie nadmiernego przydzielenia w histogramie i pełny przebieg bilansowania.
