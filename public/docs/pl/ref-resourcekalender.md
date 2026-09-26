# Kalendarz zasobu

Okno **Kalendarz zasobu** edytuje własny kalendarz pojedynczego zasobu — na przykład brygady, która pracuje cztery dni w tygodniu. Formularz jest identyczny jak w [oknie dialogowym kalendarza](docs://ref-kalenderdialoog); ten artykuł opisuje tylko różnice.

## Otwieranie

- Otwórz panel zasobów: **Zasoby** → grupa wstążki **Zarządzaj** → **Zasoby** (pełny panel) albo **Dok zasobów** (zadokowany obok wykresu Gantta).
- W kolumnie **Kalendarz** zasobu wybierz kalendarz i kliknij ikonę ołówka (**Edytuj…**) obok niego, aby go edytować; nowy kalendarz utwórz przez tę samą rozwijaną listę.

## Różnice względem okna dialogowego kalendarza

- **Jeden kalendarz naraz** — brak listy biblioteki po lewej, brak gwiazdki domyślnego dla projektu; tylko formularz.
- **Zastosuj** zapisuje kalendarz; **Anuluj**, **Esc**, krzyżyk zamykający albo kliknięcie poza oknem odrzuca zmiany. Nowy kalendarz utworzony przez **+ Kalendarz zasobu** na liście rozwijanej powstaje dopiero po **Zastosuj** i jest wtedy od razu przypisywany do zasobu (razem jeden krok Cofnij); po **Anuluj** nic nie zostaje. Zaczyna od tych samych ustawień domyślnych co **+** w oknie kalendarzy.
- **Brak automatycznego przeliczenia** — **Zastosuj** nie przelicza harmonogramu. W roli kalendarza zasobu kalendarz nie zmienia dat CPM; wpływa na obciążenie (histogram) i bilansowanie, które ponownie uruchamiasz sam, odpowiednio przez F5 lub **Bilansuj…**. Lista rozwijana oferuje jednak wszystkie kalendarze projektu: jeśli edytujesz tu kalendarz, który jest też kalendarzem projektu lub zadania, harmonogram się zmienia. Zostaje wtedy oznaczony jako nieaktualny, a F5 przelicza go ponownie.

## Pola

Zobacz [okno dialogowe kalendarza](docs://ref-kalenderdialoog) po pełny opis pól: **Nazwa**, **Dni robocze** (z gotowymi ustawieniami Pon–Pt i Ciągły (24/7)), **Początek (godz.)** / **Koniec (godz.)** / **Godziny dziennie**, sekcję **Godziny pracy** (przy włączonym planowaniu godzinowym), **Generuj święta…** oraz listę **Dni wolne**.

## Dalsza lektura

- [Kalendarze i planowanie godzinowe](docs://gids-kalenders-uren) — kiedy kalendarz zasobu jest właściwym wyborem.
- [Zasoby, histogram i bilansowanie](docs://gids-resources-histogram) — jak kalendarz zasila obciążenie i bilansowanie.
