# Filtry

Okno **Filtr** kontroluje, które zadania są widoczne — na wykresie Gantta i na karcie Tabela. Filtr składa się z reguł (pole + operator + wartość), opcjonalnie połączonych w grupy.

## Otwieranie

**Widok** → grupa wstążki **Wyświetlanie** → **Filtr…**. Przycisk pozostaje podświetlony, dopóki filtr jest aktywny. **Esc**, krzyżyk zamykający albo kliknięcie poza oknem zamyka bez zastosowania.

## Grupy: wszystkie albo dowolne

Na górze każdej grupy wybierasz, jak łączą się jej reguły:

- **Wszystkie poniższe (AND)** — zadanie musi spełniać każdą regułę.
- **Dowolne z poniższych (OR)** — wystarczy spełnić jedną regułę.

**+ reguła** dodaje regułę; **+ grupa** (tylko na najwyższym poziomie) dodaje zagnieżdżoną grupę, dzięki czemu możesz łączyć AND i OR — na przykład „Krytyczne to tak ORAZ (Typ to Budowa LUB Typ to Instalacja)". Bez reguł okno pokazuje: „Brak reguł — ten filtr dopasowuje wszystko."

## Reguła: pole, operator, wartość

- **Pole** — wszystkie pola zadania: WBS, Nazwa zadania, Czas trwania, Początek, Koniec, Typ, Krytyczne, Zapas całkowity, Postęp, Kamień milowy, Zapas swobodny, Zapas interferujący, Prawie krytyczne, Ścieżka zapasu i Zasoby, plus kody zadań i pola użytkownika projektu.
- **Operator** — dostosowuje się do typu pola:
- tekst: **równa się**, **różne od**, **zawiera**, **zaczyna się od**, **jest puste**;
- liczba i data: dodatkowo **mniejsze niż**, **mniejsze lub równe**, **większe niż**, **większe lub równe** i **pomiędzy** (z **Od**/**Do**);
- pola tak/nie (takie jak Krytyczne i Kamień milowy): wybór **Tak**/**Nie**;
- pola wyboru (takie jak Typ albo kod zadania): **jest jednym z**, z zaznaczalnymi wartościami.
- **Wartość** — wprowadzanie zależy od typu pola (pole tekstowe, liczba, data albo selektor); **jest puste** nie ma pola wartości.

Ikona kosza za regułą usuwa tę regułę; krzyżyk w prawym górnym rogu zagnieżdżonej grupy usuwa całą grupę.

## Zastosuj, anuluj i wyczyść

- **Zastosuj** aktywuje filtr i zamyka okno. Filtr bez reguł liczy się jako „brak filtra".
- **Anuluj** zamyka bez zastosowania zmian.
- **Wyczyść** natychmiast wyłącza aktywny filtr i opróżnia edytor.

Aktywny filtr jest częścią zapisanego layoutu — zobacz [Zapisywanie i wczytywanie layoutów](docs://ref-layouts).

## Dalsza lektura

- [Wybór kolumn](docs://ref-kolommen) — które kolumny pokazuje tabela.
