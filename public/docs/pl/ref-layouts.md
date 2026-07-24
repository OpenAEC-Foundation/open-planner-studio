# Zapisywanie i wczytywanie layoutów

Layout to zapisana konfiguracja widoku: kolumny, grupowanie, sortowanie, filtr i skala czasu w jednym pakiecie. Layouty są globalne dla aplikacji (na tym urządzeniu) — nie należą do jednego pliku projektu, więc możesz ich użyć w dowolnym dokumencie.

## Otwieranie

**Widok** → grupa wstążki **Layout**. Zawiera selektor z Twoimi layoutami i trzy przyciski:

- **Zapisz jako…** i **Zarządzaj…** — oba otwierają okno **Zarządzaj layoutami** (poniżej).
- **Aktualizuj** — nadpisuje layout wybrany w selektorze bieżącym widokiem; wyłączony, dopóki wybrane jest **(brak)**.

Wybór layoutu w selektorze stosuje go natychmiast.

## Okno Zarządzaj layoutami

Bez zapisanych layoutów okno pokazuje „Brak zapisanych layoutów." W przeciwnym razie jeden wiersz na layout z:

- **Nazwa** — edytowalna bezpośrednio w wierszu (zmiana nazwy).
- **Zastosuj** (znacznik) — najpierw pyta o potwierdzenie: „Zastosować layout …? Spowoduje to zastąpienie bieżących kolumn/grupowania/sortowania/filtra/skali."
- **Aktualizuj** — nadpisuje layout bieżącym widokiem, bez potwierdzenia.
- **Usuń** (ikona kosza) — najpierw pyta o potwierdzenie.

Potwierdzenia pojawiają się jako małe okno dialogowe w aplikacji; **Esc** albo **Anuluj** przerywa.

## Zapisz layout jako…

Na dole okna: wpisz **Nazwę** i kliknij **Zapisz** — bieżący widok zostaje zapisany jako nowy layout i staje się aktywny. Bez nazwy layout otrzymuje domyślną nazwę „Nazwa".

## Co zapisuje layout

- Kolumny (widoczność, kolejność, szerokość) — zobacz [Wybór kolumn](docs://ref-kolommen).
- Grupowanie i sortowanie (**Widok** → **Grupuj…** / **Sortuj…**).
- Filtr — zobacz [Filtry](docs://ref-filters).
- Skala czasu wykresu Gantta.

Niezawarte: szczegóły poziomu powiększenia, szerokości paneli i zaznaczenia.
