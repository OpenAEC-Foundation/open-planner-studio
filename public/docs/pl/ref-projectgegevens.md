# Informacje o projekcie

Okno **Informacje o projekcie** zawiera metadane projektu oraz sekcję **Obliczenia** z opcjami harmonogramowania. Ten sam formularz działa też jako kreator projektu dla **Nowy**.

## Otwieranie

- **Ustawienia** (karta wstążki) → grupa wstążki **Projekt** → **Info o projekcie**.
- Okno Ustawienia (koło zębate ⚙) → karta **Ogólne** → **Informacje o projekcie...**
- **Plik** → **Info o projekcie** — uproszczony wariant w Backstage, tylko z polami metadanych (bez sekcji Obliczenia).

**Zastosuj** zatwierdza wszystkie zmiany naraz; **Anuluj**, **Esc** albo kliknięcie poza oknem je odrzuca. **Enter** działa tak samo jak Zastosuj.

## Metadane

- **Nazwa projektu** — nazwa na pasku tytułu i karcie dokumentu.
- **Opis** — wolny tekst.
- **Inżynier** i **Firma** — wolny tekst; zapisywane w pliku IFC.
- **Data rozpoczęcia** — początek projektu, od którego liczy się obliczenie.
- **Data zakończenia** — informacyjny koniec projektu.

## Obliczenia

Opcje harmonogramowania dla tego projektu — są zapisywane wraz z plikiem, nie z aplikacją, więc podróżują na inne komputery. Jeśli tu coś zmienisz, harmonogram jest automatycznie przeliczany po **Zastosuj**.

- **Definicja krytyczności** — **Zapas całkowity ≤ próg** (z **Progiem (dni robocze)**, domyślnie 0) albo **Najdłuższa ścieżka**.
- **Obliczanie zapasu** — **Najmniejszy (początek/koniec)** (domyślnie), **Zapas początku** lub **Zapas końca**.
- **Zadania z otwartym końcem krytyczne** — oznacza zadania bez następnika jako krytyczne.
- **Oznaczaj jako prawie krytyczne** — zaznaczenie odsłania dodatkowy **Próg** (domyślnie 2 dni robocze; jednostka podąża za Wyświetlaniem czasu trwania, więc ewentualnie godziny): zadania z małym zapasem otrzymują znacznik „prawie krytyczne".
- **Wiele ścieżek zapasu** — zaznaczenie odsłania **Metodę** (**Zapas swobodny (peeling)** lub **Zapas całkowity (ranking)**) i **Maks. ścieżek** (domyślnie 10): obliczenie numeruje wtedy najważniejsze ścieżki zapasu.
- **Kalendarz zwłoki** — który kalendarz liczy zwłokę relacji: **Poprzednik** (domyślnie), **Następnik**, **24-godzinny** lub **Kalendarz projektu**.

Sposób odczytywania tych wyników opisano w [Ścieżka krytyczna i analiza zaawansowana](docs://gids-kritiek-pad-analyse).

## Kreator projektu (Nowy)

**Nowy** otwiera to samo okno jako kreator (tytuł **Nowy projekt**, przycisk **Utwórz**). Oprócz pól metadanych kreator zawiera:

- **Szablon faz** — **Pusty**, **Budownictwo mieszkaniowe** lub **Budownictwo użytkowe / remont**: wypełnia nowy projekt strukturą faz.
- **Zmiana** — widoczne tylko przy włączonym planowaniu godzinowym: **Zmiana dzienna** (domyślnie), **2 zmiany**, **3 zmiany** lub **24/7**.
- **Zestaw świąt** — generuje kalendarz projektu: wybierz kraj (z regionem i urlopem budowlanym, tam gdzie ma to zastosowanie), **Bez świąt**, albo **Niestandardowy…** — ten ostatni otwiera okno dialogowe kalendarza zaraz po utworzeniu, abyś mógł skomponować kalendarz ręcznie. Zobacz [Okno dialogowe kalendarza](docs://ref-kalenderdialoog).

Sekcja Obliczenia jest nieobecna w kreatorze; ustaw ją potem przez jedno z powyższych wejść.
