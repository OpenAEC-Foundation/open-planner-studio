# Okno dialogowe kalendarza

Okno **Kalendarze** zarządza biblioteką kalendarzy projektu: listą wszystkich kalendarzy po lewej, formularzem edycji zaznaczonego kalendarza po prawej.

## Otwieranie

- **Planowanie** → grupa wstążki **Kalendarz** → przycisk **Kalendarz** albo **Dni wolne**.
- **Ustawienia** (karta wstążki) → grupa wstążki **Kalendarz** → **Kalendarz**.
- Z kreatora projektu: wybranie **Niestandardowy…** jako kalendarza otwiera to okno po utworzeniu.

## Zastosowanie i anulowanie

Wszystkie edycje — w tym nowy/duplikat/usuń — odbywają się w kopii roboczej. **Zastosuj** (albo **Enter**) zapisuje wszystko naraz i przelicza harmonogram; **Anuluj**, **Esc**, krzyżyk zamykający albo kliknięcie poza oknem odrzuca wszystkie zmiany.

## Biblioteka (lewa kolumna)

- **Lista** — wszystkie kalendarze; gwiazdka oznacza **Kalendarz projektu** (domyślny dla zadań bez własnego kalendarza).
- **+** — **Nowy kalendarz**.
- **Duplikuj** — kopia zaznaczonego kalendarza.
- **Usuń** — niemożliwe dla ostatniego kalendarza; usunięcie domyślnego kalendarza projektu czyni innym kalendarz domyślnym.
- **Ustaw jako domyślny dla projektu** — czyni zaznaczony kalendarz kalendarzem projektu (przycisk nad formularzem).

## Formularz (prawa kolumna)

- **Nazwa** — dowolna nazwa.
- **Dni robocze** — przyciski **Pon** do **Nd**; włączony = dzień roboczy. Gotowe ustawienia: **Pon–Pt** (standardowy tydzień, 07–16, 8 godz./dzień) i **Ciągły (24/7)**.
- **Początek (godz.)** / **Koniec (godz.)** / **Godziny dziennie** — czas pracy obowiązujący dla całego dnia. Ukryte, gdy kalendarz ma pasma czasu pracy i planowanie godzinowe jest włączone; wtedy pasma decydują o godzinach.

## Godziny pracy (tylko przy włączonym planowaniu godzinowym)

- **Wyliczone godziny/dzień** — liczba kontrolna, wyliczona z pasm.
- Gotowe ustawienia: **Zmiana dzienna**, **2 zmiany**, **3 zmiany**, **Zmiana nocna**, **24/7** — każde ustawia pasma czasu pracy za jednym razem.
- **Zapisz jako profil…** — zapisz bieżące godziny pracy jako własny profil (na tym urządzeniu); własne profile pojawiają się jako przyciski z krzyżykiem usuwania.
- **Ustaw dla każdego dnia tygodnia…** / **Pokaż/ukryj godziny pracy** — otwiera lub zwija edytor pasm.
- **Edytor pasm** — dla każdego dnia tygodnia lista pasm czasowych (początek–koniec), każde z polem wyboru **następny dzień** (zmiana nocna przez północ), **Dodaj pasmo** (przerwa między dwoma pasmami to przerwa), **Kopiuj do wszystkich dni roboczych**, suma godzin na dzień oraz wyliczone godziny/dzień na dole. Zobacz [Kalendarze i planowanie godzinowe](docs://gids-kalenders-uren).

## Generuj święta…

Generuje listę dni wolnych na podstawie reguł dla całego okresu projektu:

- **Kraj** — Holandia, Niemcy, Belgia, Francja, Wielka Brytania, Austria, Szwajcaria albo **Bez świąt**.
- **Region** — tylko dla krajów z zestawami regionalnymi; domyślnie **Krajowe**.
- **Urlop budowlany** — tylko Holandia: **Brak**, **Północ**, **Środek** lub **Południe**; z podpowiedzią, że są to daty orientacyjne.
- **Podgląd** — wiersz podsumowania („n świąt, rok–rok"), rozwijalny do pełnej listy.
- **Generuj** zastępuje listę dni wolnych; **Anuluj** zamyka blok.
- Jeśli projekt sięga teraz poza wygenerowane lata, na górze pojawia się podpowiedź z przyciskiem **Generuj ponownie**.

## Dni wolne

Sama lista: dla każdego wiersza **Opis**, **Od**, **Do** i przycisk usuwania; **Dodaj dzień wolny** tworzy nowy wiersz. Wielodniowe okresy (urlop budowlany, przerwa mrozowa) to po prostu wiersz z dłuższym przedziałem Od–Do.
