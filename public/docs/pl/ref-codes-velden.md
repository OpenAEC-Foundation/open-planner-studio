# Kody i pola (okno dialogowe struktury)

Okno **Kody i pola** zarządza definicjami struktury projektu: **kodami zadań** (swobodnie definiowalnymi wymiarami, takimi jak Lokalizacja albo Branża) i **polami użytkownika** (typowanymi polami użytkownika). Wartości dla każdego zadania wypełnia się następnie przez panel właściwości albo [okno dialogowe zadania](docs://ref-taakdialoog).

## Otwieranie

**Planowanie** → grupa wstążki **Struktura** → **Kody i pola**. **Esc**, krzyżyk zamykający albo kliknięcie poza oknem je zamyka. Wszystkie zmiany wchodzą w życie natychmiast (i można je cofnąć przez Ctrl+Z) — nie ma osobnego przycisku zapisu.

## Kody zadań

„Swobodnie definiowalne wymiary (np. Lokalizacja, Branża) do grupowania i filtrowania — maksymalnie jedna wartość każdego typu na zadanie."

Jeden blok na typ kodu:

- **Nazwa typu kodu** — edytowalna bezpośrednio.
- **Usuń typ kodu** (kosz) — usuwa typ wraz ze wszystkimi wartościami i przypisaniami na zadaniach.
- Jeden wiersz na wartość: **Kod** (krótka etykieta), **Opis** i selektor **Koloru** (koloruje między innymi grupowania), plus przycisk usuwania.
- **Dodaj wartość** — nowa wartość pod tym typem.

Na dole: pole wejściowe **Nowy typ kodu (np. Lokalizacja)** + przycisk **Dodaj typ kodu** (Enter też działa).

## Pola użytkownika

„Typowane pola użytkownika pokazywane jako kolumny w tabeli i edytowalne dla każdego zadania."

Jeden wiersz na pole: **nazwa** (edytowalna bezpośrednio), **typ** (tylko do odczytu po utworzeniu) i przycisk usuwania.

Na dole: pole wejściowe **Nowe pole (np. Wykonawca)**, selektor typu — **Tekst**, **Liczba**, **Liczba całkowita**, **Koszt**, **Data** lub **Tak/nie** — oraz przycisk **Dodaj pole** (Enter też działa). Typu nie można zmienić po utworzeniu; w razie potrzeby utwórz nowe pole.

## Gdzie pojawiają się definicje

- Jako sekcja wpisów **Kody i pola** dla każdego zadania w panelu właściwości i w oknie dialogowym zadania.
- Jako kolumny w widoku tabeli (pola użytkownika) i jako wymiar grupowania/filtrowania (kody zadań).

## Dalsza lektura

- [Planowanie i WBS](docs://gids-plannen-wbs) — strukturyzowanie harmonogramu, w tym kody i pola w praktyce.
