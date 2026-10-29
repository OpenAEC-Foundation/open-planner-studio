# Bilansowanie zasobów

Masz jednego murarza i dwie ściany, które trzeba zbudować w tych samych dniach. Na papierze harmonogram działa, ale w praktyce murarz może być tylko w jednym miejscu. Bilansowanie rozwiązuje takie kolizje: sprawia, że zadania zaczynają się później, aż zasób da radę. W tym artykule przeczytasz dokładnie, co bilansowanie przesuwa, kiedy data zakończenia ustępuje i czego ono za Ciebie nie rozwiązuje.

## Idea

Zasób jest **przeciążony** w dniu roboczym, jeśli harmonogram wymaga od niego tego dnia więcej, niż może dać. To, co może dać, to jego zdolność: *Maks. jednostki* w dniach roboczych jego kalendarza. Jeśli nie pracuje tego dnia zgodnie ze swoim kalendarzem, jego zdolność wynosi 0.

**Bilansowanie** rozwiązuje to, sprawiając, że zadania zaczynają się później. Nic więcej nie robi. Nie skraca zadania, nie dzieli zadania, nie zmienia jednostek ani relacji i nie dodaje dodatkowego zasobu. Dla każdego zadania aplikacja szuka pierwszego miejsca, w którym zasoby są wolne, i przesuwa zadanie tam.

Są dwa sposoby, w oknie *Bilansuj zasoby*:

- Domyślnie data zakończenia projektu może się przesunąć. To jest bilansowanie w ścisłym sensie.
- Przy opcji *Bilansuj tylko w ramach zapasu (wygładzanie) — data zakończenia projektu pozostaje bez zmian* aplikacja przesuwa zadania tylko w ramach ich zapasu. Data zakończenia zostaje wtedy na miejscu. Jeśli to nie działa, zadanie zostaje tam, gdzie jest, a aplikacja zgłasza konflikt. Czym jest zapas, przeczytasz w [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad).

## Jak aplikacja oblicza

### Ile zadanie wymaga

Aplikacja liczy dla każdego dnia roboczego, ile jednostek każde zadanie wymaga od zasobu. To są jednostki według krzywej albo według Twojego własnego rozkładu godzin, dokładnie te same godziny na dzień, które pokazuje histogram. Zdolność zasobu to *Maks. jednostki* albo wartość kroku w zdolności rozłożonej w czasie, która obowiązuje tego dnia. Dzień jest przeciążony, jeśli zapotrzebowanie jest większe niż zdolność.

### W jakiej kolejności

Aplikacja umieszcza zadania jedno po drugim, w tej kolejności: najpierw najwyższy priorytet, potem zadanie z najmniejszym zapasem całkowitym, potem najwcześniejsze rozpoczęcie, a na końcu kolejność na tabeli zadań. Zadanie wchodzi do kolejki dopiero wtedy, gdy jego poprzedniki mają już swoje miejsce.

Priorytet to liczba od 0 do 1000, którą ustawiasz per zadanie. Domyślnie to 500. W menu kontekstowym (prawy przycisk myszy) paska zadania nazywa się ono *Priorytet*, z wyborem *Niski* (100), *Normalny* (500) i *Wysoki* (900). Zadanie, które wchodzi wcześniej, dostaje miejsce, którego chce. Zadania, które przychodzą później, muszą się dopasować wokół niego. Tak priorytet decyduje, które zadanie zostaje, a które ustępuje. Wartość 1000 jest szczególna: takie zadanie nigdy nie przesuwa się z powodu zdolności. To odpowiada opcji MS Project „Do Not Level”.

### Dokąd zadanie się przesuwa

Dla każdego zadania aplikacja zaczyna od najwcześniejszego rozpoczęcia, na jaki pozwalają relacje. Uwzględnia przy tym, że poprzedniki mogły same już zostać przesunięte. Jeśli zadanie tam się mieści, zostaje. Jeśli nie, aplikacja próbuje następnego dnia roboczego zadania, i tak dalej. Zadanie mieści się, jeśli każdego dnia trwania zadania każdy zasób ma dość wolnej zdolności. Jeśli zadanie ma kilka zasobów, muszą być wolne wszystkie w tych dniach. Zadanie więc zawsze przesuwa się w późniejsze dni, nigdy we wcześniejsze.

Aplikacja zapisuje przesunięcie jako **opóźnienie bilansowania**: liczbę dni roboczych, w kalendarzu zadania, o które zadanie zaczyna się później, niż wymagają jego relacje. Widzisz je w kolumnie *Opóźnienie bilansowania* pod *Obliczone*. Opóźnienie zapisuje się razem z plikiem projektu. Oblicz (F5) uwzględnia je jako dodatkowy czas oczekiwania przed startem. Zadania po nim przesuwają się razem z nim przez swoje relacje.

### W ramach zapasu czy poza nim

Bez *wygładzania* aplikacja szuka dalej, aż zadanie się zmieści. Data zakończenia projektu może przez to się przesunąć.

Przy *wygładzaniu* zadanie nie może zacząć się później niż jego najpóźniejsze rozpoczęcie, czyli ostatni dzień, w którym mogłoby się zacząć bez przesunięcia daty zakończenia. Jeśli zadanie nie mieści się w tym oknie, zostaje na najwcześniejszym miejscu. Zadanie pojawia się wtedy pod *Pozostałe konflikty*.

### Co aplikacja nie przesuwa

- Zadania, które już się zaczęły lub są zakończone. Ich obciążenie się liczy, ale nigdy nie dostają opóźnienia bilansowania.
- Zadania z priorytetem 1000. Idą za swoimi poprzednikami, ale nie przesuwają się z powodu zdolności.
- Zadania bez przydziału do wybranych zasobów, kamienie milowe i fazy. Przesuwają się tylko wtedy, gdy przesunie się ich poprzednik.
- Materiał. Materiał nigdy nie jest bilansowany.

### Propozycja i zastosowanie

*Oblicz* tworzy propozycję: zadania, które się przesuwają, z starym i nowym startem oraz datą zakończenia przed i po. W harmonogramie nic się nie zmienia, dopóki nie wybierzesz *Zastosuj*. Wtedy aplikacja zapisuje opóźnienia w zadaniach i od razu przelicza harmonogram.

## Przykład: murarz przy dwóch ścianach

Przykład pochodzi z praktycznego projektu samouczków *House extension*, w takim stanie, jaki jest tuż przed bilansowaniem w samouczku 5. W samouczku 5 robisz to sam i sprawdzasz liczby. W tym przykładzie tynkowanie ma typ zadania *Stała praca*, a tynkarz pracuje z jednostkami 2, jak w [Typy zadań: czas trwania, jednostki i praca](docs://uitleg-werkregels).

Po stropie z płyt drążonych, ukończonym w poniedziałek 28 czerwca, wewnętrzna warstwa murowa (5 dni roboczych) i zewnętrzna warstwa murowa (6 dni roboczych) zaczynają się obie we wtorek 29 czerwca. Obie są przypisane do murarza, z jednostkami 1 i *Maks. jednostki* 1. Po wewnętrznej warstwie idą elementy dachu (praca dźwigu 6 godzin) i pokrycie dachu (2 dni robocze). Ramy czekają na pokrycie dachu i na zewnętrzną warstwę murową. Odbiór jest w poniedziałek 30 sierpnia.

### Przeciążenie

Wewnętrzna warstwa biegnie od 29 czerwca do 5 lipca włącznie, zewnętrzna od 29 czerwca do 6 lipca włącznie. Od 29 czerwca do 5 lipca włącznie to 5 dni roboczych, w których harmonogram wymaga 2 jednostki od murarza ze zdolnością 1. Murarz jest w tych 5 dniach przeciążony.

### Kolejność

Oba zadania mają priorytet 500. Ramy okienne są dostarczane dopiero 14 lipca (w samouczku 3 ustawiasz dla nich ograniczenie *Rozpocznij nie wcześniej niż (SNET)*). Przez to wewnętrzna warstwa ma zapas 3 dni roboczych, a zewnętrzna 5. Wewnętrzna warstwa ma najmniejszy zapas, więc wchodzi pierwsza. Zostaje od 29 czerwca do 5 lipca włącznie.

### Przesunięcie

Zewnętrzna warstwa nie może zacząć się 29 czerwca. Pierwszy dzień, w którym murarz znów jest wolny, to wtorek 6 lipca. To 5 dni roboczych później niż najwcześniejsze rozpoczęcie, więc opóźnienie bilansowania wynosi 5. Zewnętrzna warstwa biegnie teraz od 6 lipca do 13 lipca włącznie. Ramy i tak zaczynają się dopiero 14 lipca, więc odbiór zostaje w poniedziałek 30 sierpnia. Okno pokazuje *Data zakończenia projektu: bez zmian (30-08-2027)* i jedną linię: *Build outer cavity leaf*, stary start 29-06-2027, nowy start 06-07-2027, *5 d*.

Przesunięcie o 5 dni roboczych to dokładnie zapas zewnętrznej warstwy. Dlatego *bilansowanie* daje tutaj ten sam wynik. Zewnętrzna warstwa nie ma już zapasu i jest krytyczna.

### Co, jeśli ramy nie przyjdą 14 lipca

Bez tego ograniczenia ramy mogą zacząć się w piątek 9 lipca, a odbiór przypada w środę 25 sierpnia. Zewnętrzna warstwa ma wtedy zapas tylko 2 dni roboczych.

- Bez *bilansowania* zewnętrzna warstwa i tak przesuwa się o 5 dni roboczych. Teraz ramy muszą czekać: zaczynają się 14 lipca, czyli 3 dni roboczych później. Wszystko po nich przesuwa się razem z nimi, a odbiór przechodzi z 25 sierpnia na 30 sierpnia, także 3 dni roboczych później.
- Przy *bilansowaniu* nic się nie przesuwa. Zewnętrzna warstwa nie mieści się w swoich 2 dniach roboczych zapasu. Okno pokazuje konflikt *Build outer cavity leaf*, 5 dni, z powodem *Za mało wolnej zdolności w ramach zapasu, aby rozwiązać ten konflikt*.

### Co, jeśli zewnętrzna warstwa dostanie priorytet

Jeśli dasz zewnętrznej warstwie priorytet *Wysoki* (900), wejdzie pierwsza. Zostaje na 29 czerwca, a wtedy wewnętrzna warstwa ustępuje: przesuwa się o 6 dni roboczych, od 7 lipca do 13 lipca włącznie. Wewnętrzna warstwa ma zapas tylko 3 dni roboczych, więc przesunięcie o 6 dni roboczych to 3 dni za dużo. Elementy dachu, ramy i wszystko po nich przesuwają się razem z nimi. Odbiór przechodzi z poniedziałku 30 sierpnia na czwartek 2 września. To samo przeciążenie daje więc inną datę zakończenia, zależnie od tego, które zadanie się nie przesuwa.

### Co, jeśli przyjdzie drugi murarz

Jeśli ustawisz *Maks. jednostki* murarza na 2, przeciążenie znika. *Oblicz* zgłasza *Żadne zadania nie wymagają przesunięcia — harmonogram jest już wolny od konfliktów*.

## Skutki i błędne przekonania

**„Bilansowanie znajduje najkrótszy harmonogram.”** Nie. Aplikacja pracuje zadanie po zadaniu w ustalonej kolejności i nie szuka najlepszego rozwiązania dla całości. Zobacz przykład z priorytetem: inny priorytet daje inną datę zakończenia.

**„Zbilansowane zadanie jest bezpieczne.”** Bilansowanie korzysta z zapasu. Przesunięte zadanie ma wtedy mniej zapasu albo nie ma go wcale, i może stać się krytyczne, jak zewnętrzna warstwa powyżej. Jeśli wtedy się spóźni, odbiór się przesunie.

**„Bilansowanie idzie za moimi późniejszymi zmianami.”** Nie. Opóźnienie bilansowania to stała liczba dni roboczych. Jeśli wewnętrzna warstwa po bilansowaniu stanie się krótsza, zewnętrzna warstwa nadal zacznie się o 5 dni roboczych później, mimo że nie jest to już potrzebne. Zbilansuj wtedy ponownie. Aplikacja zaczyna od nowa.

**Nie wszystko da się rozwiązać przesunięciem.** Jeśli zasób nie pracuje w dniach, których zadanie potrzebuje, albo zadanie przez swoją krzywą wymaga tego dnia więcej, niż zasób może dać, przeciążenie zostaje. Aplikacja wtedy przy zadaniu podaje, dlaczego.

**Materiał nie jest bilansowany.** Jeśli materiał wymaga tego dnia więcej, niż wynosi jego zdolność, aplikacja zgłasza to jako przeciążenie, ale bilansowanie go nie rusza.

**Zadania przypięte.** Jeśli wszystkie kolidujące zadania mają priorytet 1000, okno zgłasza *Żadne zadania nie wymagają przesunięcia — harmonogram jest już wolny od konfliktów*, a przeciążenie zostaje. Dlatego po zastosowaniu sprawdź komunikat *Nadmierne przydzielenie* na wstążce.

## Zobacz też

- [Rozwiązywanie przeciążenia](docs://howto-overbezetting-oplossen): kroki, aby znaleźć przeciążenie i je zbilansować.
- [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad): czym jest zapas i kiedy zadanie staje się krytyczne.
- [Typy zadań: czas trwania, jednostki i praca](docs://uitleg-werkregels): jak czas trwania zadania przesuwa się razem z jednostkami.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): trzy wieże, które potrzebują tych samych ekip i dźwigu wieżowego, oraz to, co bilansowanie z tym robi.
