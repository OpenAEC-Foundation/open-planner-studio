# Zarządzanie i instalowanie rozszerzeń

Rozszerzenia dodają funkcje do aplikacji, takie jak dodatkowe formaty importu czy niestandardowe przyciski wstążki. Są one na poziomie aplikacji: należą do tej instalacji na tym urządzeniu, nie do pliku projektu.

## Otwieranie

**Plik** → **Rozszerzenia** (Backstage). Na górze znajdują się dwie karty — **Zainstalowane** i **Przeglądaj** — obok przycisków **ZIP** i **JS**, z polem wyszukiwania poniżej (**Szukaj rozszerzeń...**).

## Zainstalowane

Jedna karta na rozszerzenie z nazwą, wersją, kategorią, opisem i autorem, plus:

- **Przełącznik włącz/wyłącz** — włącza lub wyłącza rozszerzenie bez jego usuwania.
- **Usuń** — kliknij **Potwierdź** jeszcze raz, aby usunąć na stałe.

Rozszerzenie, którego nie udało się wczytać, pokazuje komunikat błędu na swojej karcie. Bez rozszerzeń karta zgłasza: „Nie zainstalowano jeszcze żadnych rozszerzeń."

## Przeglądaj (katalog)

Karta **Przeglądaj** pobiera internetowy katalog rozszerzeń (wymagane połączenie internetowe). Każdy wpis katalogu to karta z przyciskiem **Zainstaluj**; już zainstalowane rozszerzenia pokazują odznakę **Zainstalowane**. Jeśli wczytywanie się nie powiedzie, pojawia się komunikat błędu z przyciskiem **Spróbuj ponownie**.

## Instalowanie z pliku

- **ZIP** — instaluje ZIP rozszerzenia (z `manifest.json` + `main.js`).
- **JS** — instaluje pojedynczy plik `.js` z osadzonym manifestem.

Po instalacji rozszerzenie jest od razu włączone, a wszelkie przyciski wstążki pojawiają się natychmiast.

## Importowanie przez rozszerzenia

**Plik** → **Importuj** wymienia formaty importu oferowane przez zainstalowane rozszerzenia; kliknij format i wybierz plik. Bez rozszerzeń importu strona zgłasza: „Brak rozszerzeń importu. Dodaj je w sekcji Rozszerzenia." Wbudowane formaty importu (CSV, MS Project, P6) są oddzielne od tego — zobacz [Import/eksport](docs://gids-import-export).

## Pisanie własnych rozszerzeń

Przewodnik dla autorów rozszerzeń (manifest, API, uprawnienia) znajduje się w repozytorium: `github.com/OpenAEC-Foundation/open-planner-studio`, plik `docs/extensions.md`.
