# Permisiuni ale extensiilor

Fiecare permisiune pe care o extensie o poate enumera în manifest: ce permite, ce se întâmplă când lipsește și ce vedeți din ea la instalarea unei extensii. Cum gestionați și instalați extensiile este descris în [Instalarea și gestionarea unei extensii](docs://howto-extensie-installeren).

## Ce este și ce nu este o permisiune

O permisiune este o **declarație a autorului**: ce părți ale interfeței aplicației dorește extensia să folosească. Ea nu este o barieră. Codul unei extensii rulează în același mediu ca aplicația și poate, prin urmare, să facă mai mult decât spun permisiunile: nu există sandbox. Aplicația spune acest lucru și în fereastra de instalare. Instalați doar extensii de la autori în care aveți încredere.

Aplicația aplică o permisiune în unul din trei moduri, iar diferența contează:

**Aplicare strictă.** Dacă permisiunea lipsește, metoda corespunzătoare aruncă o eroare (în neerlandeză, de exemplu *Extensie "…" mist permissie: ribbon*) înainte ca ceva să se întâmple.

**Avertisment.** Dacă permisiunea lipsește, metoda funcționează în continuare, dar aplicația scrie un avertisment în jurnal. Într-o versiune viitoare devine un refuz.

**Doar informativ.** Permisiunea nu are atașată nicio parte a interfeței. Aplicația o afișează la instalare și nu face nimic altceva cu ea.

Ce nu necesită nicio permisiune este baza interfeței extensiilor: citirea proiectului, a calendarului, a activităților, a dependențelor, a resurselor și a atribuirilor; adăugarea de activități și dependențe și modificarea activităților; încărcarea unui proiect, recalcularea și gruparea mai multor modificări; păstrarea propriilor setări, citirea propriilor fișiere incluse și afișarea unei notificări.

**Manifestul.** Permisiunile se află în manifest, sub formă de listă. O extensie pe care o instalați acum, cu o permisiune pe care această versiune a aplicației nu o cunoaște, este refuzată. Pentru o extensie veche deja salvată, aplicația elimină permisiunile necunoscute și raportează acest lucru în jurnal.

## Cum solicită aplicația

La instalare, din catalog (*Fișier › Extensii › Răsfoire › Instalare*) sau dintr-un fișier (*ZIP* sau *JS*), aplicația afișează fereastra *Instalați extensia?*. Întrebarea apare o singură dată, la instalare: nu de fiecare dată când activați extensia.

Fereastra arată numele, versiunea, descrierea, autorul și, dacă există, depozitul. Sub *Proveniență* arată de unde provine extensia (*Din catalogul online de extensii*, *Dintr-un fișier ZIP de pe acest calculator* sau *Dintr-un fișier JavaScript de pe acest calculator*) și dacă descărcarea a fost verificată: cu suma de control din catalog, neverificată pentru că catalogul nu oferă una, sau un fișier pe care l-ați ales dumneavoastră. Sub *Ce acceptați* arată că o extensie este cod de program care rulează cu aceleași drepturi ca aplicația, și ce înseamnă asta în practică: în aplicația desktop, printre altele, citirea și scrierea de fișiere oriunde în folderul dumneavoastră de utilizator, plus acces la proiectele, setările și clipboard-ul dumneavoastră; în browser, acces la proiectele și setările salvate, la fișierele la care ați acordat acces și la rețea.

Sub *Ce spune această extensie că folosește* sunt permisiunile din manifest, sub forma unor etichete scurte, cu numele ca mai jos. Apare: *Aceasta este declarația autorului, nu o restricție: codul poate face oricum mai mult.* Dacă extensia nu are permisiuni, apare *Nimic declarat.* Două permisiuni primesc o explicație: *importSource* și *help*. Celelalte șase primesc doar eticheta lor.

Cu *Instalare* acceptați. *Anulare*, tasta Esc și clicul în afara ferestrei refuză instalarea.

## Permisiunile

**ribbon** — plasează un buton în panglică. Efect: extensia poate adăuga un buton într-un grup de pe o filă de panglică. O extensie fără această permisiune primește o eroare când încearcă. Butoanele apar la capătul filei alese, sub o etichetă de grup a extensiei, și dispar când dezactivați sau eliminați extensia. Implicit: nu este acordată; doar ce este în manifest. Aplicare: strictă. Unde: pe fila aleasă de extensie.

**events** — urmărește evenimentele aplicației și trimite singură evenimente. Efect: extensia se poate abona și dezabona la evenimente și poate trimite singură evenimente. Aplicația însăși trimite trei: un proiect este încărcat (după import, deschidere sau încărcare de către o extensie), este creat un proiect gol și planificarea este (re)calculată. Implicit: nu este acordată; doar ce este în manifest. Aplicare: strictă. Unde: nicăieri; extensia reacționează la eveniment.

**backstage** — oferă un format de import. Efect: extensia poate înregistra un importor; acesta apare în *Fișier › Importare*, unde faceți clic pe un format și alegeți un fișier. Formatele integrate sunt separate de această permisiune (vezi [Formate de import și export](docs://ref-import-exportformaten)). Implicit: nu este acordată; doar ce este în manifest. Aplicare: avertisment. Dacă permisiunea lipsește, înregistrarea funcționează în continuare, cu un avertisment în jurnal. Aceasta este o regulă de tranziție, pentru că extensiile existente nu enumeră întotdeauna permisiunea. Unde: *Fișier › Importare*.

**pdf-fonts** — oferă un font pentru exportul PDF. Efect: extensia poate înregistra un furnizor de fonturi. Exportul PDF îl folosește pentru caracterele pe care fonturile integrate nu le acoperă, cum sunt caracterele chinezești, japoneze și coreene. Implicit: nu este acordată; doar ce este în manifest. Aplicare: strictă. Unde: în PDF-ul unui raport; în fereastra de instalare există doar eticheta.

**importSource** — citește octeții originali ai unui fișier importat. Efect: extensia poate cere conținutul complet al fișierului sursă al unui proiect importat (deocamdată: un fișier Primavera), inclusiv câmpurile pe care aplicația le lasă intenționat afară din proiectul dumneavoastră, cum sunt câmpurile de audit și de proveniență, costurile, câmpurile de revizuire și de locație. Este mult mai larg decât restul interfeței și de aceea este o permisiune separată. Fără această permisiune, aplicația nu citește niciun octet din fișierul sursă: fiecare metodă aruncă atunci o eroare înainte ca ceva să fie preluat. Implicit: nu este acordată; doar ce este în manifest. Aplicare: strictă, refuzată implicit. Unde: în fereastra de instalare vine și o explicație: *importSource — toți octeții sursă originali ai fiecărui fișier importat (de exemplu un fișier Primavera brut), inclusiv câmpurile care nu ajung niciodată în proiect.*

**help** — adaugă articole și îndrumări de Ajutor. Efect: extensia poate înregistra și retrage articole de Ajutor (tutoriale), poate deschide un fișier `.ifc` inclus ca document nou și poate porni și opri un ghid care indică părți ale aplicației. Un proiect inclus nu suprascrie niciodată documentul cu care lucrați: se deschide ca document nou sau preia doar o filă goală, nemodificată. Începând cu versiunea 1.4.0 a contractului. Implicit: nu este acordată; doar ce este în manifest. Aplicare: strictă. Unde: în fereastra *Ajutor* (articolele), ca filă nouă (proiectul) și ca ghid care indică butoane. În fereastra de instalare vine și o explicație: *help — poate adăuga articole de Ajutor, poate deschide proiectele incluse ca document nou și poate afișa un ghid care indică părți ale aplicației.*

**filesystem** — extensia spune că folosește fișiere. Efect: niciunul; nicio parte a interfeței nu este legată de ea, iar aplicația nu o poate aplica. Implicit: nu este acordată; doar ce este în manifest. Aplicare: doar informativă. Unde: ca etichetă în fereastra de instalare.

**network** — extensia spune că folosește rețeaua. Efect: niciunul; la fel ca *filesystem*. Implicit: nu este acordată; doar ce este în manifest. Aplicare: doar informativă. Unde: ca etichetă în fereastra de instalare.

## Vezi și

- [Formate de import și export](docs://ref-import-exportformaten): formatele pe care le cunoaște aplicația, alături de ce adaugă extensiile sub *Fișier › Importare*.
- [Instalarea și gestionarea unei extensii](docs://howto-extensie-installeren): instalarea, dezactivarea și eliminarea unei extensii.
