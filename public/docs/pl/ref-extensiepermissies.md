# Uprawnienia rozszerzeń

Każde uprawnienie, które rozszerzenie może wymienić w manifeście: co dozwala, co się dzieje, gdy go brakuje, i co widzisz podczas instalacji rozszerzenia. Jak zarządzasz rozszerzeniami i jak je instalujesz, opisuje [Instalowanie i zarządzanie rozszerzeniem](docs://howto-extensie-installeren).

## Czym jest uprawnienie, a czym nie

Uprawnienie to **deklaracja autora**: które części interfejsu aplikacji rozszerzenie chce używać. Nie jest to bariera. Kod rozszerzenia działa w tym samym środowisku co sama aplikacja, dlatego może zrobić więcej, niż wynika z jego uprawnień: nie ma piaskownicy. Aplikacja mówi to również w oknie instalacji. Instaluj rozszerzenia tylko od autorów, którym ufasz.

Aplikacja egzekwuje uprawnienie na jeden z trzech sposobów, a różnica ma znaczenie:

**Twarde egzekwowanie.** Gdy uprawnienia brakuje, odpowiednia metoda zgłasza błąd (po holendersku, na przykład *Extensie „…” mist permissie: ribbon*) zanim cokolwiek się stanie.

**Ostrzeżenie.** Gdy uprawnienia brakuje, metoda nadal działa, ale aplikacja zapisuje ostrzeżenie w dzienniku. W przyszłej wersji stanie się to odmową.

**Tylko informacyjne.** Uprawnienie nie jest przypisane do żadnej części interfejsu. Aplikacja pokazuje je podczas instalacji i nic poza tym z nim nie robi.

To, czego nie wymaga żadne uprawnienie, jest podstawą interfejsu rozszerzeń: odczyt projektu, kalendarza, zadań, relacji, zasobów i przydziałów; dodawanie zadań i relacji oraz zmienianie zadań; wczytywanie projektu, przeliczenie i łączenie kilku zmian; przechowywanie własnych ustawień, odczyt własnych dołączonych plików i wyświetlanie powiadomienia.

**Manifest.** Uprawnienia są w manifeście jako lista. Rozszerzenie, które instalujesz teraz, z uprawnieniem, którego ta wersja aplikacji nie zna, zostaje odrzucone. Dla rozszerzenia zapisanego wcześniej aplikacja pomija nieznane uprawnienia i odnotowuje to w dzienniku.

## Jak aplikacja pyta

Przy instalowaniu, z katalogu (*Plik › Rozszerzenia › Przeglądaj › Zainstaluj*) albo z pliku (*ZIP* lub *JS*), aplikacja pokazuje okno *Zainstalować rozszerzenie?*. Pytanie pada raz, przy instalacji: nie za każdym razem, gdy włączasz rozszerzenie.

Okno pokazuje nazwę, wersję, opis, autora i, jeśli jest, repozytorium. W polu *Pochodzenie* jest napisane, skąd rozszerzenie pochodzi (*Z internetowego katalogu rozszerzeń*, *Z pliku ZIP na tym komputerze* lub *Z pliku JavaScript na tym komputerze*) oraz czy pobranie zostało zweryfikowane: sumą kontrolną z katalogu, niezweryfikowane, bo katalog nie podaje sumy, albo plik, który sam wybrałeś. W polu *Na co się zgadzasz* jest napisane, że rozszerzenie to kod programu, który działa z takimi samymi prawami jak aplikacja, i co to w praktyce znaczy: w aplikacji desktopowej między innymi odczyt i zapis plików w dowolnym miejscu w folderze użytkownika oraz dostęp do Twoich projektów, ustawień i schowka; w przeglądarce dostęp do zapisanych projektów i ustawień, do plików, do których dałeś dostęp, oraz do sieci.

W polu *Co to rozszerzenie deklaruje* są uprawnienia z manifestu, jako krótkie etykiety z nazwą, jak niżej. Jest tam napisane: *To deklaracja autora, a nie ograniczenie — kod i tak może więcej.* Jeśli rozszerzenie nie ma uprawnień, jest tam napisane *Nic nie zadeklarowano.* Dwa uprawnienia dostają wyjaśnienie: *importSource* i *help*. Pozostałe sześć dostaje tylko swoją etykietę.

Met *Zainstaluj* wyrażasz zgodę. *Nie instaluj*, Esc i kliknięcie poza oknem odrzucają instalację.

## Uprawnienia

**ribbon** — umieść przycisk na wstążce. Działanie: rozszerzenie może dodać przycisk do grupy na karcie wstążki. Rozszerzenie bez tego uprawnienia dostaje błąd, gdy próbuje to zrobić. Przyciski pojawiają się na końcu wybranej karty, pod etykietą grupy rozszerzenia, i znikają, gdy wyłączysz rozszerzenie lub je usuniesz. Domyślnie: nie przyznane; tylko to, co jest w manifeście. Egzekwowanie: twarde. Gdzie: na karcie, którą rozszerzenie wybrało.

**events** — śledzenie zdarzeń aplikacji i wysyłanie własnych zdarzeń. Działanie: rozszerzenie może zapisać się na zdarzenia, z nich zrezygnować i wysyłać własne zdarzenia. Aplikacja sama wysyła cztery zdarzenia: projekt jest wczytany (po zaimportowaniu, otwarciu lub wczytaniu przez rozszerzenie), pusty projekt jest utworzony, harmonogram jest (ponownie) obliczony oraz użytkownik poprosił o samouczek. Ostatnie zdarzenie trafia tylko do rozszerzenia samouczka. Domyślnie: nie przyznane; tylko to, co jest w manifeście. Egzekwowanie: twarde. Gdzie: nigdzie; rozszerzenie reaguje na zdarzenie.

**backstage** — zaproponuj format importu. Działanie: rozszerzenie może zarejestrować importer. Pojawia się w *Plik › Importuj*, gdzie klikasz format i wybierasz plik. Wbudowane formaty są od tego oddzielne (zob. [Formaty importu i eksportu](docs://ref-import-exportformaten)). Domyślnie: nie przyznane; tylko to, co jest w manifeście. Egzekwowanie: ostrzeżenie. Gdy uprawnienie brakuje, rejestracja nadal działa, z ostrzeżeniem w dzienniku. To rozwiązanie przejściowe, bo istniejące rozszerzenia nie zawsze wymieniają to uprawnienie. Gdzie: *Plik › Importuj*.

**pdf-fonts** — dostarcz czcionkę dla eksportu PDF. Działanie: rozszerzenie może zarejestrować dostawcę czcionek. Eksport PDF używa jej dla znaków, których wbudowane czcionki nie obsługują, na przykład znaków chińskich, japońskich i koreańskich. Domyślnie: nie przyznane; tylko to, co jest w manifeście. Egzekwowanie: twarde. Gdzie: w PDF-ie raportu; w oknie instalacji jest tylko etykieta.

**importSource** — odczytaj oryginalne bajty zaimportowanego pliku. Działanie: rozszerzenie może zażądać pełnej zawartości pliku źródłowego zaimportowanego projektu (obecnie: pliku Primavera), w tym pól, których aplikacja celowo nie przyjmuje do projektu, na przykład pól audytu i pochodzenia, kosztów, przeglądu i lokalizacji. To jest znacznie szersze niż reszta interfejsu, dlatego jest to osobne uprawnienie. Bez tego uprawnienia aplikacja nie odczytuje ani jednego bajtu pliku źródłowego: każda metoda wtedy zgłasza błąd, zanim cokolwiek zostanie pobrane. Domyślnie: nie przyznane; tylko to, co jest w manifeście. Egzekwowanie: twarde, domyślnie odmowa. Gdzie: w oknie instalacji wraz z wyjaśnieniem: *importSource — pełne oryginalne bajty źródłowe każdego zaimportowanego pliku (np. surowy plik Primavera), łącznie z polami, które nigdy nie trafiają do projektu*

**help** — dodaj artykuły pomocy i wskazówki. Działanie: rozszerzenie może zarejestrować i wycofać artykuły pomocy (samouczki), otworzyć dołączony plik `.ifc` jako nowy dokument oraz uruchomić i zatrzymać przewodnik, który wskazuje elementy aplikacji. Dołączony projekt nigdy nie nadpisuje dokumentu, nad którym pracujesz. Otwiera się jako nowy dokument albo zajmuje tylko pustą, niezmienioną kartę. Od wersji kontraktu 1.4.0. Domyślnie: nie przyznane; tylko to, co jest w manifeście. Egzekwowanie: twarde. Gdzie: w oknie *Pomoc* (artykuły), jako nowa karta (projekt) i jako przewodnik, który wskazuje przyciski. W oknie instalacji wraz z wyjaśnieniem: *help — może dodawać artykuły pomocy, otwierać dołączone projekty jako nowy dokument i wyświetlać przewodnik wskazujący elementy aplikacji*

**filesystem** — rozszerzenie zaznacza, że używa plików. Działanie: brak. Żadna część interfejsu nie jest z tym powiązana, a aplikacja nie może tego wymusić. Domyślnie: nie przyznane; tylko to, co jest w manifeście. Egzekwowanie: tylko informacyjne. Gdzie: jako etykieta w oknie instalacji.

**network** — rozszerzenie zaznacza, że używa sieci. Działanie: brak; jak *filesystem*. Domyślnie: nie przyznane; tylko to, co jest w manifeście. Egzekwowanie: tylko informacyjne. Gdzie: jako etykieta w oknie instalacji.

## Zobacz także

- [Formaty importu i eksportu](docs://ref-import-exportformaten): formaty, które aplikacja zna sama, obok tego, co rozszerzenia dodają w *Plik › Importuj*.
- [Instalowanie i zarządzanie rozszerzeniem](docs://howto-extensie-installeren): instalowanie, wyłączanie i usuwanie rozszerzenia.
