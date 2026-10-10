# Activarea salvării automate

Scop: aplicația actualizează fișierul proiectului în timp ce lucrați, astfel încât nu mai trebuie să apăsați Ctrl+S.

## Când aveți nevoie de acest lucru

Lucrați o sesiune lungă la o singură planificare. Sau uitați des să salvați și doriți ca fișierul de pe disc sau dintr-un folder partajat să fie mereu actual. Salvarea automată nu înlocuiește refacerea în urma unei căderi. Refacerea în urma unei căderi este mereu activă și funcționează separat. Diferența o aflați în [Fișiere și formate](docs://uitleg-bestanden).

## Pași

1. Dacă proiectul nu are încă un fișier, salvați-l mai întâi o dată cu *Acasă › Fișier › Salvare ca*. Cât timp nu există fișier, comutatorul este gri, iar textul de ajutor spune: *Salvați mai întâi acest proiect pentru a utiliza salvarea automată.*
2. În stânga sus, în bara de sus, faceți clic pe comutatorul *Salvare automată*. Când este activat, textul de ajutor spune: *Salvarea automată este activată: modificările se scriu în acest fișier.*
3. Continuați să lucrați. De îndată ce proiectul are modificări, aplicația îl scrie în fișierul dumneavoastră, fără fereastră și cel mult o dată la zece secunde. Marcajul *Nesalvat* dispare atunci singur.
4. Dacă doriți să opriți, faceți clic încă o dată pe comutator. Textul de ajutor spune atunci: *Salvarea automată este dezactivată. Refacerea în urma unei căderi rămâne mereu activă.*

Chrome și Edge permit mai întâi doar citirea unui fișier pe care l-ați deschis. Comutatorul nu face nimic acolo până ce salvați o dată cu *Salvare* (Ctrl+S) și browserul vă acordă permisiunea de scriere. După aceea îl puteți activa. În Firefox comutatorul rămâne gri: aplicația nu poate scrie în fișierul dumneavoastră.

## Capcane și ce face aplicația atunci

**Comutatorul aparține unui singur proiect.** Fiecare filă are propria stare. După deschiderea unui proiect, comutatorul este mereu dezactivat. Aplicația nu îl reține pentru data următoare.

**Salvarea automată scrie doar în fișierul pe care îl are deja proiectul.** Dacă alegeți *Salvare ca*, din acel moment scrie în noul fișier. Aplicația scrie doar dacă există modificări.

**Scrierea poate eșua.** Dacă, de exemplu, fișierul a dispărut sau este blocat, apare mesajul *Salvarea automată a eșuat*, cu motivul. Dacă browserul nu are (sau nu mai are) permisiunea de scriere, aplicația sare peste acea rundă fără niciun semn. Aplicația nu cere permisiunea.

**Fișierul primește și modificări nedorite.** Salvarea automată scrie starea proiectului dumneavoastră așa cum este în acel moment. Dacă anulați ceva cu Ctrl+Z, fișierul primește și starea anulată, în zece secunde. Dacă doriți să păstrați o versiune mai veche, faceți mai întâi o copie cu *Salvare ca*.

**O cădere costă totuși ultimele secunde.** Aplicația scrie cel mult o dată la zece secunde. Ce ați făcut între timp nu se află încă în fișier. Refacerea în urma unei căderi are aceeași limită.

**După o refacere în browser, comutatorul este din nou gri.** Un proiect pe care îl recuperați în browser după o cădere nu mai este legat de fișierul său. Salvați-l o dată, și comutatorul funcționează din nou. Vedeți [Refacerea în urma unei căderi](docs://howto-herstellen-na-een-crash).

**Un proiect dintr-un alt format nu are fișier.** Un proiect importat dintr-un fișier CSV, XML, `.mpp` sau `.xer` primește un fișier IFC abia când îl salvați. După aceea puteți activa salvarea automată.

## Vezi și

- [Fișiere și formate](docs://uitleg-bestanden): diferența dintre salvare, salvarea automată și refacerea în urma unei căderi.
- [Deschiderea și salvarea unui fișier](docs://howto-bestand-openen-en-opslaan): salvare, salvare ca și marcajul *Nesalvat*.
- [Refacerea în urma unei căderi](docs://howto-herstellen-na-een-crash): ce vă oferă aplicația dacă nu s-a închis corect.
