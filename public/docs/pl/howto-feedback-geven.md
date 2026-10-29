# Przekazywanie opinii

Cel: zgłosić błąd albo przekazać pomysł, opcjonalnie ze zrzutem ekranu, bezpośrednio z aplikacji.

## Kiedy tego potrzebujesz

Harmonogram oblicza coś, czego nie rozumiesz, przycisk nie działa tak, jak powinien, albo w aplikacji brakuje Ci jakiejś funkcji. Dobra wiadomość pomaga twórcom znaleźć problem. Dlatego aplikacja sama dodaje do opinii wersję, system operacyjny i język. To, co sam opiszesz, decyduje, czy mogą coś z tym zrobić: co zostało zrobione, czego oczekiwano i co się stało.

## Kroki

1. Kliknij przycisk *Wyślij opinię* u góry okna. Ten przycisk jest zawsze na pasku tytułu. Jego tekst zmienia się co dziesięć minut: *Wyślij opinię*, *Zgłoś błąd* i *Zaproponuj nową funkcję*. To zawsze ten sam przycisk. Otwiera się okno *Wyślij opinię*.
2. Wybierz rodzaj wiadomości. *Coś nie działa* służy do błędu: coś nie robi tego, co powinno. *Pomysł* służy do tego, czego brakuje albo co chcesz zmienić. *Pytanie lub uwaga* służy do reszty. *Coś nie działa* jest domyślnie zaznaczone.
3. Wypełnij *Tytuł*, a potem *Opis*. Puste pola pokazują przykład: w tytule na przykład *Np. Ścieżka krytyczna przeskakuje po zapisaniu*, a w opisie pytanie *Co zrobiłeś, czego się spodziewałeś i co się stało?* Dopóki przycisk *Wyślij* jest szary, szara linia obok mówi, dlaczego, na przykład *Wpisz tytuł.* albo że w tytule i opisie razem musisz wpisać co najmniej 10 znaków.
4. Jeśli chcesz odpowiedź, wypełnij swój *Adres e-mail*. To pole jest opcjonalne. Aplikacja zapamiętuje adres po udanym wysłaniu wiadomości, więc przy następnym razie jest już wpisany.
5. Jeśli chcesz coś pokazać, włącz *Dołącz zrzut ekranu*. Aplikacja robi wtedy obraz ekranu bez tego okna. Chwilę później widzisz mały podgląd z trzema przyciskami obok: *Zaznacz*, *Zrób ponownie* i *Usuń*.
6. *Zaznacz* otwiera edytor. W edytorze dodajesz na obrazku strzałki, prostokąty, odręczne linie i tekst. Za pomocą *Zakryj* rysujesz czarny obszar nad czymś, co nie może zostać wysłane, na przykład nad nazwiskiem albo kwotą. Ta część wtedy naprawdę znika z obrazu, który aplikacja wysyła. Wybierasz kolor, cofasz ostatnią czynność przyciskiem *Cofnij* albo zaczynasz od nowa przyciskiem *Wyczyść wszystko*. Kliknij *Gotowe*, aby zachować zmiany, albo *Anuluj* (lub Esc), aby je odrzucić.
7. *Zrób ponownie* robi nowy zrzut ekranu i usuwa Twoje zaznaczenia. *Usuń* usuwa zrzut ekranu i wyłącza pole wyboru.
8. Spójrz na szarą linię *Dołączono* pod formularzem. Pokazuje, co aplikacja sama dołącza: wersję, system operacyjny i język, na przykład *Dołączono: v2026.10.1 · Windows · English*.
9. Kliknij *Wyślij*. Podczas wysyłania przycisk pokazuje *Wysyłanie…*.
10. Zobaczysz *Dziękujemy, Twoja wiadomość została wysłana.* Jeśli dla Twojej wiadomości utworzono issue na GitHub, jest tam też przycisk *Zobacz na GitHub*. Kliknij *Zamknij*.

## Gdzie trafia Twoja wiadomość

Aplikacja wysyła Twoją wiadomość do Open Feedback Studio od OpenAEC. Do tego nie potrzebujesz konta, także nie na GitHub. Twórcy widzą Twoją wiadomość w swoim przeglądzie. Jeśli aplikacja jest tam połączona z GitHub, Open Feedback Studio zamienia ją także na publiczne issue na GitHub. Przy typie *Coś nie działa* issue dostaje etykietę *bug*, a przy typie *Pomysł* etykietę *enhancement*. Pod Twoim opisem jest wtedy linia z wersją Open Planner Studio, Twoim systemem operacyjnym i językiem aplikacji.

## Pułapki i co wtedy robi aplikacja

**Twoja wiadomość może stać się publiczna.** Nie wpisuj w niej niczego, czego nie chcesz udostępnić. Dotyczy to także zrzutu ekranu: obraz pokazuje wszystko, co w tym momencie widać w aplikacji, na przykład nazwy zadań i zasobów Twojego projektu. Aplikacja robi zrzut ekranu w chwili, gdy włączysz *Dołącz zrzut ekranu*. Jeśli ekran jeszcze nie jest dobry, zamknij okno, ustaw ekran, otwórz okno ponownie i kliknij *Zrób ponownie*. Użyj *Zakryj*, aby ukryć to, czego nie chcesz pokazać.

**Zrzut ekranu jest za duży.** Aplikacja zmniejsza zrzut ekranu przed wysłaniem. Jeśli nadal jest za duży, wiadomość jest wysyłana bez obrazu. Ekran z podziękowaniem pokazuje wtedy *Zrzut ekranu był za duży i nie został dołączony.*

**Wysyłanie nie działa.** W oknie pojawia się komunikat, a Twój tekst zostaje. Są cztery przypadki:

- *Wiadomość nie została przyjęta.* Sprawdź tekst i adres e-mail. Wiadomość, która składa się głównie z linków, zostaje odrzucona.
- *Wysłano wiele wiadomości w krótkim czasie.* Spróbuj ponownie za godzinę.
- *Wysyłanie się nie powiodło.* Nie ma połączenia albo serwer nie odpowiada. Spróbuj ponownie albo kliknij *Otwórz na GitHub*. Tego przycisku nie ma, jeśli wcześniejsza próba była niepewna (zob. niżej).
- *Nie wiemy na pewno, czy Twoja wiadomość dotarła. Poczekaj minutę i wyślij ją ponownie; jeśli już tam jest, zobaczymy to automatycznie.* Połączenie zerwało się po tym, jak aplikacja wysłała Twoją wiadomość. Twój tekst zostaje. Nie ma przycisku *Otwórz na GitHub*, bo Twoja wiadomość jeszcze może dotrzeć. Tak zostaje, dopóki wiadomość nie zostanie wysłana albo już przyjęta, także jeśli w międzyczasie zamkniesz okno i otworzysz je ponownie.

**Twoja wiadomość jest już przyjęta.** Jeśli wyślesz wiadomość, która już tam jest, formularz zostaje, a nad nim widzisz: *Ta wiadomość jest już u nas. Chcesz coś dodać? Zmień wtedy tekst i wyślij ponownie.* Twój tekst zostaje, a adres e-mail jest zapamiętany. Kliknij *Zamknij*, jeśli nic nie chcesz dodać; następnym razem formularz jest pusty. Jeśli wpiszesz coś więcej, komunikat znika i możesz wysłać ponownie; przycisk nazywa się wtedy znowu *Zapisz i zamknij*, a Twój tekst zostaje.

**Otwórz na GitHub.** To jest droga bez Open Feedback Studio. Dla tej drogi potrzebujesz konta na GitHub. Bez zrzutu ekranu strona GitHub, na której tworzysz nowe issue, otwiera się od razu w Twojej przeglądarce, z już wpisanym tytułem i opisem. Ze zrzutem ekranu najpierw zobaczysz komunikat *Prawie gotowe — zrzut ekranu jest w schowku.* Obok niego są cztery kroki. Kliknij *OK, przejdź do GitHub*, kliknij w dużym polu tekstowym na stronie issue i naciśnij Ctrl+V (Cmd+V na Macu). Potem kliknij na dole *Prześlij nowe issue*. Dopiero wtedy Twoja wiadomość zostaje wysłana.

**Wklejanie nie działa.** Na drodze przez GitHub zrzut ekranu jest też zapisany jako plik na komputerze. W aplikacji na komputer okno podaje ścieżkę: *Nie można wkleić? Zrzut ekranu zapisaliśmy też do* tej ścieżki *— przeciągnij ten plik do pola tekstowego.* W przeglądarce aplikacja pobiera obraz jako `feedback-` z numerem i rozszerzeniem `.png`. Znajdziesz go w folderze pobranych plików i przeciągniesz do pola tekstowego.

**Zrzut ekranu się nie udaje.** Pojawia się komunikat *Nie udało się przechwycić zrzutu ekranu. Nadal możesz wysłać opinię bez zrzutu ekranu.* Pole wyboru się wyłącza i możesz wysłać wiadomość bez obrazka.

**Zamykasz okno przed wysłaniem.** Jeśli w formularzu coś jest, przycisk na dole nazywa się *Zapisz i zamknij*; przy pustym formularzu nazywa się *Zamknij*. *Zapisz i zamknij*, krzyżyk i Esc zamykają okno, a Twoja wiadomość zostaje zachowana jako szkic, dopóki jej nie wyślesz albo nie klikniesz *Wyczyść*. Gdy ponownie otworzysz okno, rodzaj wiadomości, tekst, adres e-mail i zrzut ekranu z zaznaczeniami nadal są. Szkic zostaje zachowany, dopóki aplikacja jest otwarta; po zamknięciu aplikacji znika. Po udanym wysłaniu formularz jest znowu pusty. Jeśli chcesz zacząć od nowa, kliknij na dole po lewej *Wyczyść*. Kliknięcie obok okna go nie zamyka. Podczas wysyłania Esc nie zamyka okna.

## Zobacz też

- [Aktualizacja aplikacji](docs://howto-app-bijwerken): przed opinią sprawdź, czy masz najnowszą wersję.
