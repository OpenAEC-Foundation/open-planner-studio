# Wybór schematu IFC

Cel: zapisz swój harmonogram w schemacie IFC modelu budynku, z którym chcesz go scalić.

## Kiedy jest to potrzebne

Domyślnie aplikacja zapisuje projekt jako IFC 4.3 ADD2. Tak nazywa się IFC 4.3 w plikach, które tworzą IfcOpenShell i Bonsai. Jeśli chcesz scalić harmonogram z modelem budynku w jeden plik 4D, na przykład za pomocą przepisu *MergeProjects* z IfcOpenShell (ifcpatch), oba pliki muszą mieć ten sam schemat. Jeśli model budynku jest plikiem IFC4, IfcOpenShell odmówi scalenia go z harmonogramem IFC 4.3. Wtedy wybierz tutaj schemat modelu.

## Kroki

1. Otwórz *Ustawienia projektu*: *Ustawienia › Projekt › Ustawienia projektu*, albo *Plik › Ustawienia projektu*.
2. W ustawieniu *Schemat IFC przy zapisie* wybierz schemat swojego modelu budynku.
3. Kliknij *Zastosuj*. Projekt jest teraz *Niezapisane*.
4. Zapisz za pomocą przycisku *Zapisz* (Ctrl+S) albo *Zapisz jako*.

Trzy opcje:

- *IFC 4.3 ADD2 (domyślny)* zapisuje `IFC4X3_ADD2` w nagłówku pliku.
- *IFC 4.3* zapisuje `IFC4X3`. Tak zapisywały IFC 4.3 starsze wersje aplikacji.
- *IFC4* zapisuje `IFC4`, dla modelu budynku w IFC4.

## Pułapki i działanie aplikacji

**Scalenie jako ostatni krok.** Nie otwieraj scalonego pliku 4D (model budynku plus harmonogram) w aplikacji, aby zapisać go ponownie. Aplikacja zachowuje tylko harmonogram: ściany i inne części modelu budynku giną, także jeśli zachowasz schemat. Zmień harmonogram we własnym pliku, a potem scal ponownie.

**Aplikacja pyta najpierw, gdy otwarty plik ma inny schemat.** Jeśli otworzysz na przykład plik IFC4 albo plik IFC 4.3 ze starszej wersji aplikacji, aplikacja nie zmienia po prostu typu pliku. Za pierwszym razem, gdy użyjesz *Zapisz* lub *Zapisz jako*, najpierw zapyta, czy zachować schemat pliku, czy przejść na IFC 4.3 ADD2. *Zachowaj IFC4* (albo *Zachowaj IFC 4.3*) to przycisk, który wybiera Enter. Jeśli zamkniesz pytanie klawiszem Esc albo przyciskiem zamknięcia, aplikacja nic nie zapisze.

**Aplikacja pyta tylko raz na plik.** Twój wybór zapisuje się w samym pliku. Jeśli otworzysz go później, aplikacja nie zapyta znowu. Jeśli sam wybierzesz schemat w oknie *Ustawienia projektu* i klikniesz *Zastosuj*, aplikacja też nie zapyta.

**Schemat, którego aplikacja nie potrafi zapisać**, na przykład IFC2X3, otwiera się w aplikacji. Przy pierwszym zapisie pytanie to pokazuje, a ty wybierasz jeden z trzech powyższych schematów.

**Automatyczny zapis i odzyskiwanie po awarii nie pytają o nic.** Zapisują schemat pliku, a pytanie zostaje na pierwszy zapis, który wykonasz sam. Dla schematu, którego aplikacja nie potrafi zapisać, *Automatyczny zapis* nie zapisuje do pliku, dopóki nie odpowiesz na pytanie.

**Nowy projekt nie pyta o nic.** Nowy projekt oraz projekt z innego formatu, na przykład XER, MPP lub CSV, zaczyna od schematu *IFC 4.3 ADD2 (domyślny)*.

**Zawartość pliku się nie zmienia.** Wszystkie trzy schematy obsługują dane harmonogramu tak samo, więc aplikacja zapisuje je w ten sam sposób. Różni się tylko wiersz `FILE_SCHEMA` w nagłówku. Dlatego nic nie tracisz, gdy wybierzesz inny schemat.

**Model IFC 4.3 z IfcOpenShell lub Bonsai** ma zwykle `IFC4X3_ADD2` w nagłówku, tak jak domyślne ustawienie aplikacji. IfcOpenShell nie scali do niego harmonogramu z `IFC4X3`. Jeśli nie masz pewności, zajrzyj do wiersza `FILE_SCHEMA` na początku pliku modelu.

**Cofnięcie nie zmienia schematu.** Schemat należy do pliku, tak jak miejsce, w którym jest zapisany. Wybór w oknie *Ustawienia projektu* oraz odpowiedź na pytanie przy zapisie dlatego nie są krokiem, który wycofuje *Cofnij*. Aby wrócić, wybierz inny schemat w oknie *Ustawienia projektu*. Dzięki temu *Automatyczny zapis* nigdy po cichu nie zapisze innego schematu po cofnięciu zmiany.

## Zobacz także

- [Nowy projekt i Ustawienia projektu](docs://ref-projectinfo): wszystkie pola formularza.
- [Pliki i formaty](docs://uitleg-bestanden): dlaczego IFC jest własnym formatem aplikacji.
- [Otwieranie i zapisywanie pliku](docs://howto-bestand-openen-en-opslaan): *Zapisz* i *Zapisz jako*.
