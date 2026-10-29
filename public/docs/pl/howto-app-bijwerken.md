# Aktualizowanie aplikacji

Cel: sprawdzić, czy masz najnowszą wersję, zaktualizować aplikację i przeczytać, co zmieniło się w wersji.

## Kiedy tego potrzebujesz

Nowa wersja Open Planner Studio pojawia się regularnie. Chcesz wiedzieć, czy ją już masz, na przykład zanim zgłosisz błąd, albo dlatego, że rozszerzenie wymaga nowszej wersji. Albo właśnie ją zaktualizowałeś i chcesz zobaczyć, co się zmieniło.

Aktualizacja działa tylko w aplikacji desktopowej. Wersja w przeglądarce nie ma aktualizatora.

## Kroki

### Aktualizacja, gdy aplikacja sama wskazuje nową wersję

1. Uruchom aplikację desktopową. Przy starcie aplikacja w tle sprawdza, czy jest nowa wersja. Jeśli nowej wersji nie ma albo sprawdzenie się nie uda, na przykład bez internetu, nic nie zauważysz.
2. Jeśli nowa wersja jest, otwiera się okno *Aktualizacja oprogramowania*. Pokazuje ono pole *Bieżąca wersja*, pole *Nowa wersja*, komunikat *Dostępna jest nowa wersja* i pod nagłówkiem *Co nowego* tekst dotyczący tej aktualizacji.
3. Zapisz otwarte projekty.
4. Kliknij *Pobierz i zainstaluj*. Wskaźnik postępu pokazuje *Pobieranie…*, a potem następuje instalacja. Podczas pobierania nie możesz zamknąć okna.
5. Poczekaj, aż aplikacja uruchomi się ponownie sama. To jest nowa wersja.

Tuż przed zainstalowaniem aktualizacji aplikacja tworzy też migawkę do odzyskiwania po awarii Twoich otwartych projektów, zob. [Odzyskiwanie po awarii](docs://howto-herstellen-na-een-crash).

### Samodzielne sprawdzenie nowej wersji

1. Wybierz *Ustawienia › Projekt › Ustawienia aplikacji*. Możesz też wybrać *Plik › Ustawienia aplikacji* albo ikonę koła zębatego u góry.
2. Wybierz zakładkę *Zaawansowane*. W sekcji *Wersja* jest numer Twojej bieżącej wersji.
3. Kliknij *Sprawdź aktualizacje*. Otwiera się okno *Aktualizacja oprogramowania* i pokazuje *Sprawdzanie…*. Potem pokazuje *Korzystasz z najnowszej wersji* albo komunikat, że jest nowa wersja, z tym samym przyciskiem *Pobierz i zainstaluj*.

W przeglądarce ten przycisk nie robi nic szczególnego: okno od razu pokazuje *Korzystasz z najnowszej wersji*, bez sprawdzania czegokolwiek przez aplikację.

### Przeczytanie, co się zmieniło

1. Jeśli uruchamiasz aplikację desktopową po raz pierwszy w innej wersji niż ostatnio, samo otwiera się okno. Okno ma tytuł *Masz najnowszą wersję!* Po świeżej instalacji okno się nie otwiera: pierwsze uruchomienie nie jest aktualizacją. Jeśli chcesz je mimo to zobaczyć, użyj przycisku *Co nowego* (zob. poniżej).
2. Na górze widać przejście z poprzedniej wersji do nowej. Przyciskiem *Co nowego* widać tylko nową wersję.
3. Jeśli aplikacja ma wbudowane podsumowanie tej wersji, widzisz jeden główny punkt i cztery mniejsze. Główny punkt może mieć przycisk *Przeczytaj przewodnik*. Inaczej widzisz tylko przejście wersji i to, co jest poniżej.
4. Przyciskiem *Pełne informacje o wydaniu* otwierasz dziennik zmian na GitHubie. Jeśli to nie działa, pokazuje się komunikat *Nie można otworzyć informacji o wydaniu.*
5. W sekcji *Ta aktualizacja w liczbach* są: liczba dni od poprzedniego wydania, liczba commitów i liczba dodanych linii kodu. Jeśli aplikacja może sprawdzić, o ile zmienił się rozmiar pakietu instalacyjnego, pokazuje to także. Każda liczba pokazuje się tylko wtedy, gdy jest dostępna.
6. Kliknij *Rozumiem*, aby zamknąć okno.

Jeśli chcesz zobaczyć to okno później jeszcze raz, wybierz *Ustawienia › Projekt › Ustawienia aplikacji*, zakładkę *Zaawansowane* i w sekcji *Wersja* przycisk *Co nowego*. Okno otworzy się wtedy dla Twojej bieżącej wersji, bez poprzedniej wersji.

## Typowe problemy i co wtedy robi aplikacja

**Aktualizacja się nie udaje.** Okno pokazuje komunikat *Coś poszło nie tak podczas aktualizacji*, pod nim techniczny powód i przycisk *Spróbuj ponownie*.

**Zainstalowałeś aplikację jako pakiet .deb i instalacja się nie udaje.** Okno wyjaśnia: *Zaktualizuj ręcznie, uruchamiając to polecenie w terminalu, lub pobierz najnowszy pakiet.* W sekcji *Polecenie instalacji* stoi polecenie, z przyciskiem *Kopiuj polecenie*. Potem pokazuje się *Skopiowano*. Przyciskiem *Otwórz stronę pobierania* przechodzisz na stronę pobierania najnowszej wersji.

**Aplikację masz przez Snap Store.** Aplikacja wtedy sama się nie aktualizuje i przy starcie też nie sprawdza. Robi to Snap Store. W oknie widnieje komunikat *Ta wersja jest aktualizowana automatycznie przez Snap Store — nie musisz nic robić.*

**Przy starcie nic się nie pokazuje.** To jest normalne, jeśli masz już najnowszą wersję. Sprawdzenie przy starcie nie pokazuje błędów. Jeśli chcesz mieć pewność, że masz najnowszą wersję, sprawdź samodzielnie, jak wyżej.

## Zobacz także

- [Przekazywanie opinii](docs://howto-feedback-geven): zgłosić błąd w najnowszej wersji.
