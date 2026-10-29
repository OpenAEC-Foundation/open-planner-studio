# Wybór trybu postępu

Cel: zdecydować, jak aplikacja planuje pozostałą pracę zadania, które już się rozpoczęło, podczas gdy jego poprzednik jeszcze trwa: zgodnie z relacją (Retained Logic) czy zgodnie z tym, co się naprawdę dzieje (Progress Override).

## Kiedy jest to potrzebne

Na placu budowy roboty często wyprzedzają logikę. Malarz już zaczyna w pomieszczeniach, które zostały otynkowane, podczas gdy tynkarz jest jeszcze zajęty w innym miejscu. W harmonogramie to na przykład relacja zakończenie-rozpoczęcie (FS), w której następnik zaczyna się przed zakończeniem poprzednika. Aplikacja nazywa to **postęp poza kolejnością**. Jeśli pasek stanu pokazuje *Relacje poza kolejnością: N*, masz taki przypadek. Tryb postępu decyduje, jak aplikacja planuje pozostałą pracę następnika. Co robią oba tryby, z przykładem obliczeniowym, opisano w [Postęp, data statusu i plan bazowy](docs://uitleg-voortgang).

## Kroki

1. Zaktualizuj postęp i ustaw datę statusu, zgodnie z opisem w [Aktualizacja postępu](docs://howto-voortgang-bijwerken).
2. Przejdź do *Planowanie › Plan bazowy i postęp › Tryb postępu* i otwórz listę.
3. Wybierz *Retained Logic* lub *Progress Override*.
4. Naciśnij **Oblicz** (F5), na przykład przez *Planowanie › Harmonogram › Oblicz*. Wybór sprawia, że harmonogram jest nieaktualny: pasek stanu pokazuje *Nieaktualne — przelicz (F5)*. Jeśli *Oblicz automatycznie* jest włączone, aplikacja robi to sama.

Jak wybrać?

- **Retained Logic** jest ustawieniem domyślnym. Relacja pozostaje w mocy: pozostała praca następnika zaczyna się dopiero wtedy, gdy poprzednik jest zakończony. Wybierz to, jeśli kolejność jest naprawdę stała albo jeśli chcesz planować ostrożnie.
- **Progress Override** stawia rzeczywistość na pierwszym miejscu. Pozostała praca następnika zaczyna się w dacie statusu, bez czekania na poprzednika. Wybierz to, jeśli następnik naprawdę dalej pracuje i data zakończenia nie ma zależeć od poprzednika, który jeszcze trwa.

## Sprawdzanie wyniku

- Kliknij komunikat *Relacje poza kolejnością: N* na pasku stanu. Otworzy się panel *Ostrzeżenia*, dostępny także przez *Planowanie › Harmonogram › Ostrzeżenia*. Każda relacja jest w nim wymieniona z tekstem *Poza kolejnością: postęp następnika przeczy relacji*, na przykład *4.2 Plastering → 4.5 Painting (FS)*.
- Zwróć uwagę na pasek następnika. Przy Retained Logic trwa on aż do czasu po zakończeniu poprzednika. Przy Progress Override kończy się wcześniej. W przykładzie z wyjaśnienia to wtorek 27 lipca wobec czwartku 22 lipca.

## Pułapki i co robi aplikacja

**Brak różnicy.** Tryb działa tylko na zadania, które już się rozpoczęły, a ich poprzednik jeszcze się nie zakończył. Bez takiego zadania nic się nie zmienia.

**Komunikat pozostaje.** Progress Override nie rozwiązuje komunikatu o postępie poza kolejnością. Tryb decyduje, jak aplikacja liczy. Sprzeczność między relacją a postępem pozostaje. Jeśli relacja nie jest już właściwa, zmień ją ([Dodawanie relacji](docs://howto-relaties-leggen)).

**Należy do projektu.** Wybór zapisuje się w pliku projektu, obowiązuje dla całego projektu i można go cofnąć skrótem Ctrl+Z. Nowy projekt jest ustawiony na Retained Logic.

**Plik P6.** Jeśli otworzysz plik Primavera P6 (.xer), aplikacja pobiera tryb z pliku. Oprócz Retained Logic i Progress Override P6 ma także Actual Dates. Aplikacja nie zna tego trzeciego trybu. Taki plik liczy się jako Retained Logic. Komunikat importu liczy to jako *1 ustawienie planowania P6 użyło bezpiecznej wartości zastępczej.*

**Profil obliczeń.** W profilu Primavera P6 Progress Override działa także wstecz, w późnych terminach i w zapasie swobodnym poprzednika (konwencja *Progress Override pomija rozpoczętego następnika także wstecz*). W profilach Open Planner Studio i Microsoft Project tak nie jest. Konwencje znajdziesz w *Ustawienia › Projekt › Ustawienia projektu*, w bloku *Profil obliczeń i opcje*. W przykładzie z wyjaśnienia tego skutku wstecz nie widać.

## Zobacz też

- [Postęp, data statusu i plan bazowy](docs://uitleg-voortgang): różnica między obydwoma trybami, z liczbami.
- [Aktualizacja postępu](docs://howto-voortgang-bijwerken): wpisywanie postępu, na którym działa tryb.
- [Dodawanie relacji](docs://howto-relaties-leggen): zmiana relacji, która nie jest już właściwa.
