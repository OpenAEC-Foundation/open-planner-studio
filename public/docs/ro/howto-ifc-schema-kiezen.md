# Alegerea schemei IFC

Obiectiv: salvați planificarea în schema IFC a modelului de clădire cu care doriți să o îmbinați.

## Când aveți nevoie de aceasta

În mod implicit, aplicația salvează un proiect ca IFC 4.3 ADD2. Acesta este numele IFC 4.3 în fișierele pe care le creează IfcOpenShell și Bonsai. Dacă doriți să îmbinați planificarea cu un model de clădire într-un singur fișier 4D, de exemplu cu rețeta *MergeProjects* din IfcOpenShell (ifcpatch), ambele fișiere trebuie să aibă aceeași schemă. Dacă modelul de clădire este un fișier IFC4, IfcOpenShell refuză să îl îmbine cu o planificare IFC 4.3. Atunci alegeți aici schema modelului.

## Pași

1. Deschideți *Setări proiect*: *Setări › Proiect › Setări proiect*, sau *Fișier › Setări proiect*.
2. Sub *Schema IFC la salvare*, alegeți schema modelului dumneavoastră de clădire.
3. Faceți clic pe *Aplicare*. Proiectul este acum *Nesalvat*.
4. Salvați cu *Salvare* (Ctrl+S) sau *Salvare ca*.

Cele trei alegeri:

- *IFC 4.3 ADD2 (implicit)* scrie `IFC4X3_ADD2` în antetul fișierului.
- *IFC 4.3* scrie `IFC4X3`. Așa scriau versiunile mai vechi ale aplicației IFC 4.3.
- *IFC4* scrie `IFC4`, pentru un model de clădire în IFC4.

## Capcane și ce face aplicația

**Îmbinarea ca ultim pas.** Nu deschideți fișierul 4D îmbinat (model de clădire plus planificare) în aplicație ca să îl salvați din nou. Aplicația păstrează doar planificarea: pereții și celelalte părți ale modelului de clădire se pierd, chiar dacă păstrați schema. Modificați planificarea în fișierul dumneavoastră și îmbinați din nou după aceea.

**Aplicația întreabă mai întâi dacă fișierul deschis are altă schemă.** Dacă deschideți, de exemplu, un fișier IFC4, sau un fișier IFC 4.3 dintr-o versiune mai veche a aplicației, aplicația nu schimbă pur și simplu tipul fișierului. La prima utilizare a *Salvare* sau *Salvare ca*, aplicația întreabă mai întâi dacă păstrați schema fișierului sau treceți la IFC 4.3 ADD2. *Păstrare IFC4* (sau *Păstrare IFC 4.3*) este butonul pe care îl alege tasta Enter. Dacă închideți întrebarea cu Esc sau cu crucea, aplicația nu salvează nimic.

**Aplicația întreabă o singură dată pentru fiecare fișier.** Alegerea dumneavoastră se păstrează în chiar fișierul. Dacă îl deschideți din nou mai târziu, aplicația nu mai întreabă. Dacă alegeți singur o schemă în *Setări proiect* și faceți clic pe *Aplicare*, aplicația nu întreabă nici atunci.

**O schemă pe care aplicația nu o poate scrie**, de exemplu IFC2X3, se deschide în aplicație. La prima salvare, întrebarea spune acest lucru, iar dumneavoastră alegeți una dintre cele trei scheme de mai sus.

**Salvarea automată și refacerea în urma unei căderi nu întreabă nimic.** Ele scriu schema fișierului și păstrează întrebarea pentru prima salvare pe care o faceți singur. Pentru o schemă pe care aplicația nu o poate scrie, *Salvare automată* nu scrie în fișier până ce ați răspuns la întrebare.

**Un proiect nou nu întreabă nimic.** Un proiect nou și un proiect dintr-un alt format, de exemplu XER, MPP sau CSV, pornește cu *IFC 4.3 ADD2 (implicit)*.

**Conținutul fișierului nu se schimbă.** Cele trei scheme cunosc datele de planificare pe care aplicația le scrie în același mod. Doar linia `FILE_SCHEMA` din antet diferă. Deci nu pierdeți nimic dacă alegeți altă schemă.

**Un model IFC 4.3 din IfcOpenShell sau Bonsai** are de obicei `IFC4X3_ADD2` în antet, la fel ca valoarea implicită a aplicației. IfcOpenShell nu îmbină o planificare cu `IFC4X3` în model. Dacă nu sunteți sigur, uitați-vă la linia `FILE_SCHEMA` de la începutul fișierului modelului.

**Anularea nu schimbă schema.** Schema aparține fișierului, la fel ca locul unde este salvat. O alegere în *Setări proiect* și răspunsul la întrebarea de la salvare nu sunt, prin urmare, un pas în *Anulare*. Pentru a reveni, alegeți cealaltă schemă în *Setări proiect*. Astfel, *Salvare automată* nu scrie niciodată în tăcere o altă schemă după ce anulați o modificare.

## Vezi și

- [Proiect nou și Setări proiect](docs://ref-projectinfo): toate câmpurile formularului.
- [Fișiere și formate](docs://uitleg-bestanden): de ce IFC este formatul propriu al aplicației.
- [Deschiderea și salvarea unui fișier](docs://howto-bestand-openen-en-opslaan): salvare și salvare ca.
