# Zarządzanie baseline

Okno **Baseline** zarządza zapisanymi migawkami harmonogramu: zapisywaniem, zmianą nazwy, wyborem aktywnej baseline i usuwaniem.

## Otwieranie

**Planowanie** → grupa wstążki **Baseline i postęp** → **Zapisz baseline…** albo **Zarządzaj baseline…** (oba otwierają to samo okno). **Esc**, **Zamknij**, krzyżyk zamykający albo kliknięcie poza oknem zamyka je; wszystkie zmiany w tym oknie wchodzą w życie natychmiast.

## Tabela baseline

Jeden wiersz na każdą zapisaną baseline:

- **Aktywna** — przycisk radiowy; dokładnie jedna baseline może być aktywna. Aktywna baseline jest podstawą porównania dla nakładki baseline na wykresie Gantta i dla raportu odchylenia.
- **Nazwa** — edytowalna bezpośrednio w wierszu.
- **Utworzono** — data zapisania baseline.
- **Usuń** (kosz) — usuwa baseline. Jeśli jest to baseline aktywna, okno najpierw pyta o potwierdzenie („Usunąć aktywną baseline?"); potem aktywna staje się najniedawniej zapisana pozostała baseline, albo żadna, jeśli nic nie zostało.

Bez baseline okno pokazuje „Brak zapisanych baseline".

## Zapisz nową baseline

- **Pole nazwy** — wstępnie wypełnione „Baseline {n} — {data}"; dostosuj nazwę według potrzeby.
- **Zapisz** — rejestruje początek, koniec i (dla kamieni milowych) datę każdego zadania oraz czyni nową baseline aktywną.
- **Ostrzeżenie** — jeśli harmonogram jest nieaktualny od ostatniego obliczenia, pojawia się „Harmonogram jest nieaktualny — najpierw przelicz (F5)": podpowiedź, nie blokada. Baseline na nieaktualnym harmonogramie zamroziłaby niewłaściwe daty.

## Dalsza lektura

- [Baseline i postęp](docs://gids-baselines-voortgang) — nakładka baseline, raport odchylenia, postęp i data statusu.
