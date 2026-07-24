# Import/eksport

Open Planner Studio domyślnie przechowuje projekt jako IFC — bez osobnego pliku projektu obok niego. Ale
czasem harmonogram musi też żyć poza aplikacją: w Primavera P6, w Microsoft Project, albo jako płaska
tabela dla arkusza kalkulacyjnego. Ten przewodnik wyjaśnia, co dokładnie oznacza natywny format IFC, co
niesie ze sobą (i czego nie niesie) każdy format eksportu, oraz gdzie w aplikacji znajduje się import/eksport.

## Czego się tu nauczysz

- Co dokładnie oznacza „IFC jest formatem natywnym" dla otwierania i zapisywania.
- Co jest, a co nie jest przenoszone przy eksporcie do MS Project (MSPDI) i Primavera P6 XML.
- Co zawiera eksport CSV — i co jest celowo pominięte.
- Gdzie importować i eksportować: **Backstage → Eksportuj** i **Backstage → Importuj**.
- Jak rozszerzenia mogą dodawać dodatkowe formaty importu.

## IFC: format natywny

Projekt Open Planner Studio *jest* plikiem IFC 4x3 (standard buildingSMART). Nie ma
osobnego pliku JSON ani pliku projektu obok niego: **Zapisz** i **Otwórz** (Backstage, albo **Ctrl+S**/**Ctrl+O**)
odczytują i zapisują IFC bezpośrednio. Oznacza to, że wszystko, co robisz w aplikacji — zadania, WBS, relacje z
ograniczeniami, zasoby i przydziały, kalendarze (zarówno kalendarz projektu, jak i kalendarze
zasobów), baseline, postęp, notatki, kody zadań i pola użytkownika, łącza zewnętrzne między
projektami — trafia do tego samego pliku i wraca w pełni przy następnym **Otwarciu**. Jeśli natkniesz
się w aplikacji na nowy rodzaj danych projektowych, możesz założyć, że przechodzi on przez IFC bez utraty danych; jeśli coś
*nie* przechodzi w ten sposób, jest to wyraźnie wskazane poniżej.

IFC to również sposób, w jaki ta aplikacja łączy się z resztą zestawu narzędzi OpenAEC: ten sam plik może być odczytany
przez oprogramowanie BIM w celu powiązania 4D (harmonogram obok modelu budynku).

## Eksport do innych formatów

Otwórz **Backstage → Eksportuj** dla czterech formatów:

- **CSV (rozdzielany średnikiem)** — uniwersalny eksport tabeli. Wszystkie zadania z datami i czasami trwania.
- **MS Project XML** — otwierane w Microsoft Project. Pełna struktura WBS.
- **Primavera P6 XML** — dla Oracle Primavera P6.
- **IFC 4x3** — standard buildingSMART, taki sam jak format natywny (przydatny jako „zapisz jako" do
  osobnego pliku, albo aby udostępnić kopię bez dotykania reszty otwartych dokumentów).

Każdy format ma własne ograniczenia: im bogatszy format docelowy, tym więcej się przenosi, ale żaden z
trzech formatów zewnętrznych nie jest pełnym odzwierciedleniem IFC.

### CSV

Eksport CSV zawiera **tylko tabelę zadań**: kod WBS, nazwę, czas trwania (dni), początek, koniec,
poprzedników (jako kod tekstowy, np. `2.1FS+3d`), typ zadania, stan, ukończenie (%), rzeczywisty
początek/koniec, krytyczne (tak/nie), zapas całkowity i opis. **Zasoby, przydziały, kalendarze
i baseline są celowo pominięte** — CSV to czysto tabela zadań dla każdego, kto chce przeglądać
lub edytować harmonogram w arkuszu kalkulacyjnym, a nie wymiana projektu o pełnej wierności. Gdy **importujesz**
plik CSV z powrotem, baseline pozostają więc puste (nie było ich skąd odczytać).

### MS Project XML (MSPDI)

MSPDI jest znacznie bogatszy niż CSV: zasoby, przydziały (łącznie z ich krzywą obciążenia),
kalendarze i baseline są przenoszone. Mimo to nie wszystko da się wyrazić w MSPDI. Przy eksporcie
aplikacja ostrzega w konsoli deweloperskiej (`console.warn`) za każdym razem, gdy coś zostaje utracone, z dokładną
liczbą dotkniętych pozycji:

- **Łącza zewnętrzne** między projektami są odrzucane (referencja-„widmo" drugiego zadania pozostaje
  tylko wewnątrz aplikacji).
- **Miękkie ograniczenia Start On/Finish On** (miękkie `MSO`/`MFO`) są degradowane do SNET/FNET — kody MSPDI
  2/3 są *twarde* (Must), więc górna granica wariantu miękkiego jest tracona. Twarde `MSO`/`MFO` eksportują się dokładnie.
- **Ograniczenia drugorzędne** są tracone — MSPDI ma tylko jedno pole ograniczenia na zadanie.
- **Zadania hammock** (czas trwania pochodny) są eksportowane jako zwykłe zadanie z obliczonymi datami — MSPDI
  nie ma natywnego typu hammock/LOE.
- **Notatki zadań** celowo **nie** są eksportowane, mimo że MSPDI ma pole `<Notes>`: nasze
  notatki to forma listy kontrolnej z polami wyboru, która nie przekłada się czysto na zwykły tekst.
- **Definicja ścieżki krytycznej** (tryb/próg prawie krytyczne) i inne opcje harmonogramowania nie są
  natywnie wyrażalne w MSPDI i dlatego są tracone — te są zachowywane tylko przez IFC.

### Primavera P6 XML

Ten sam rodzaj kompromisu co MSPDI, z kilkoma osobliwościami specyficznymi dla P6:

- **Łącza zewnętrzne** i **zadania hammock** są odrzucane/upraszczane tak samo jak w MSPDI, każde
  z ostrzeżeniem.
- **Notatki zadań** są tutaj również pominięte — P6 XML nie ma odpowiedniego pola dla nich.
- **Zwłoka procentowa** na relacji (np. 40% czasu trwania poprzednika) jest „wypiekana" na stałą
  liczbę dni, ponieważ P6 nie ma koncepcji zwłoki procentowej.
- **Zwłoka w dniach kalendarzowych** (zwłoka w dniach kalendarzowych, a nie roboczych) jest eksportowana jako zwykła
  zwłoka godzinowa — P6 nie ma osobnej jednostki zwłoki na relację.
- Krzywa obciążenia **LATE_PEAK** nie ma odpowiednika w P6 i jest eksportowana jako najbliższe przybliżenie
  („Early Peak").
- Opcje harmonogramowania (podobnie jak w MSPDI) nie są eksportowane.

Te ostrzeżenia nie są niedbalstwem — są celowym, jawnym wyborem: widoczne ostrzeżenie za każdą
odrzuconą pozycję jest lepsze niż ciche utracenie danych. Otwórz na przykład przykład
[Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (ma notatki zadań
i relację ze zwłoką procentową) i wyeksportuj do P6 lub MS Project XML: konsola deweloperska
pokaże wtedy dokładnie, które pozycje zostały odrzucone lub uproszczone i w jakiej liczbie.

## Import

**Plik → Otwórz** (albo **Backstage → Otwórz**) akceptuje pliki `.ifc`, `.csv` i `.xml`. Dla pliku
`.xml` aplikacja sama wykrywa, czy jest to plik Primavera P6, czy MS Project, na podstawie
treści. Jak opisano powyżej: import CSV lub P6 tworzy projekt **bez baseline** (nie było
żadnych w źródle), podczas gdy IFC i MSPDI przenoszą baseline ze sobą.

## Importery z rozszerzeń

Poza powyższymi stałymi formatami, zainstalowane rozszerzenia mogą dodawać własne importery — na przykład dla
formatu, który nie jest domyślnie obsługiwany. Pojawiają się one pod **Backstage → Importuj**, każdy z własną
nazwą, opisem i pasującymi rozszerzeniami plików; bez zainstalowanych rozszerzeń importu ta sekcja
jest pusta. Sprawdź **Backstage → Rozszerzenia**, aby zobaczyć, co jest dostępne.

## Dalsza lektura

- Baseline są przenoszone tylko przez IFC i MS Project XML, nie przez CSV ani P6 — przeczytaj przewodnik
  [Baseline i postęp](docs://gids-baselines-voortgang), aby dowiedzieć się, jak zarejestrować baseline.
- Zasoby, przydziały i krzywe obciążenia — przeczytaj przewodnik
  [Zasoby, histogram i bilansowanie](docs://gids-resources-histogram), aby dowiedzieć się, jak są budowane, zanim
  je eksportujesz.
