# Utilizarea prezentării ocupării

Scop: vedeți în ce zile două sau mai multe proiecte deschise cer împreună mai mult dintr-o resursă decât are biblioteca de resurse.

## Când aveți nevoie de aceasta

Echipa dumneavoastră de zidari lucrează la fațadele unui proiect și la garajele altui proiect. În fiecare proiect echipa pare bine planificată, pentru că histograma și supraalocarea privesc doar acel proiect. Abia când puneți proiectele unul lângă altul, reiese că în aceleași zile cer împreună mai mulți zidari decât aveți. Prezentarea ocupării face această comparație pentru dumneavoastră.

Prezentarea numără doar resursele care provin din biblioteca de resurse, în proiectele conectate la aceeași bibliotecă. Cum se calculează aceasta, citiți în [Biblioteca de resurse](docs://uitleg-resourcebibliotheek).

## Pași

### 1. Pregătiți proiectele

1. Deschideți proiectele pe care doriți să le comparați, fiecare în propria filă, consultați [Lucrul cu mai multe proiecte în același timp](docs://howto-meerdere-projecten). Prezentarea vede doar proiectele deschise în această aplicație.
2. Conectați fiecare proiect la aceeași bibliotecă și folosiți resursa din bibliotecă în fiecare proiect. Fără conexiune la bibliotecă, panoul de resurse nu afișează prezentarea. Consultați [Utilizarea bibliotecii de resurse](docs://howto-resourcebibliotheek-gebruiken).
3. Calculați proiectele cu *Calculare* (F5) sau activați *Calculare automată*. Ce face prezentarea cu proiectele învechite este descris mai jos, la „Capcane și ce face aplicația atunci”.

### 2. Deschideți prezentarea

1. Mergeți la unul dintre proiecte și alegeți *Resurse › Gestionare › Resurse*.
2. În dreapta sus, alegeți *Ocupare*. Prezentarea aparține bibliotecii proiectului în care vă aflați. Nu puteți modifica nimic în acest panou: este o fereastră doar în citire.

### 3. Citiți tabelul

Fiecare resursă din bibliotecă, rezervată în cel puțin un proiect deschis, primește un rând. Resursele fără rezervare nu sunt listate. Rândurile cu cele mai multe zile cu supraalocare sunt sus, apoi în ordine alfabetică.

- *Documente* arată în câte proiecte este rezervată resursa, de exemplu *2 documente*.
- *Perioadă* merge de la prima până la ultima zi cu încărcare, scrisă ca aaaa-ll-zz, de exemplu *2027-06-07 – 2027-06-14*.
- *Vârf / Capacitate* pune cea mai mare încărcare zilnică a tuturor proiectelor împreună în raport cu capacitatea resursei din bibliotecă, de exemplu *4,0 / 3,0*. Dacă există cel puțin o zi cu supraalocare, aceasta se arată cu roșu.
- Un marcaj roșu după rând, de exemplu *3 zile cu supraalocare*, numără zilele în care suma este mai mare decât capacitatea. Dacă țineți mouse-ul peste el, vedeți datele.

### 4. Consultați fiecare proiect

1. Faceți clic pe săgeata mică din fața numelui unei resurse. Rândul se deschide.
2. Sus sunt datele cu supraalocare, primele cinci, apoi *… și încă 3* dacă sunt mai multe. Dedesubt se află, pentru fiecare proiect, numele cu perioada și vârful acelui singur proiect, de exemplu *Houses North 2027-06-07 – 2027-06-11 Vârf: 2,0*.
3. Faceți clic pe rândul însuși pentru a vedea jos o histogramă. Fiecare proiect are propria culoare, iar barele sunt stivuite. Linia punctată este capacitatea din bibliotecă. Dacă se schimbă în timp, vedeți trepte. Zilele cu supraalocare primesc un fundal roșu în spatele barelor. Faceți clic încă o dată pe rând pentru a închide din nou histograma. Fără un rând ales, apare textul *Selectați o resursă pentru a vedea histograma.*

### 5. Rezolvați problema

Prezentarea arată problema, dar nu o rezolvă. Aveți două opțiuni:

- Mutați o activitate într-unul dintre proiecte sau reduceți-i unitățile de atribuire pe zi. Apoi recalculați proiectul respectiv cu F5.
- Dacă cineva se alătură cu adevărat, măriți *Capacitate maximă* a resursei din bibliotecă. Faceți acest lucru în *Resurse › Gestionare › Resurse*, vederea *Bibliotecă*.

*Nivel…* în panglică nu ajută aici: se uită doar la resursele proiectului în care vă aflați, consultați [Redistribuirea resurselor](docs://uitleg-nivelleren).

## Capcane și ce face aplicația atunci

**Prezentarea este goală.** Apare textul *Nicio resursă din bibliotecă nu este rezervată în documentele deschise.* Atunci niciun proiect deschis nu are o resursă din bibliotecă la o activitate.

**Nu vedeți butonul *Ocupare*.** Proiectul în care vă aflați nu este conectat la o bibliotecă.

**Un proiect nu se numără.** Proiectul nu este deschis în această aplicație, este conectat la altă bibliotecă sau resursa din el este o resursă proprie a acelui proiect. La baza prezentării apare întotdeauna textul *Această prezentare vede doar documentele deschise în această aplicație.* Nicio copie a unei resurse care a fost între timp scoasă din bibliotecă nu se numără.

**O copie sau o variantă se numără integral.** Fiecare proiect deschis, conectat la bibliotecă, se numără, chiar dacă este o copie sau o variantă a unui alt proiect deschis, de exemplu o variantă pe care un asistent de inteligență artificială a creat-o cu `planner_duplicate_document`. Originalul și varianta împreună pot atunci arăta o supraalocare care în realitate există doar o dată. Prezentarea nu filtrează discret acest lucru: închideți pentru moment varianta sau citiți ținând cont de ea.

**Un proiect este învechit.** Un proiect este învechit dacă ați modificat ceva în planificare fără să-l recalculați. Prezentarea tratează atunci acel proiect în felul următor:

- Pentru un proiect care nu este filă activă, prezentarea calculează singură în prealabil, fără să modifice proiectul. Deasupra tabelului apare atunci textul *Documentele modificate au fost calculate din timp pentru această prezentare; apăsați F5 în document sau activați „Calculare automată” pentru a face acest lucru permanent.* După proiect apare textul *Calculat din timp pentru această prezentare — documentul în sine arată datele mai vechi până apăsați F5 acolo sau activați „Calculare automată”.* Dacă *Calculare automată* este activată (*Setări › Proiect › Setări*, filă *Planificare*), aplicația recalculează într-adevăr astfel de proiecte imediat ce deschideți prezentarea, iar mesajul dispare. Dacă și proiectul activ este învechit, în locul acestuia deasupra tabelului apare mesajul de la punctul următor.
- Prezentarea nu calculează singură proiectul în care vă aflați. Dacă acel proiect este învechit, apare textul *Un document modificat nu a fost recalculat încă; este inclus aici cu ultimele cifre calculate. Apăsați F5 în acel document sau activați „Calculare automată”.* iar după proiect *Învechit: acestea sunt ultimele cifre calculate — apăsați F5 în acest document.* Atenție: *ultimele cifre calculate* nu este chiar corect. Prezentarea ia vechile date de început, dar deja o durată sau o atribuire modificată. Cifrele pot diferi astfel atât de planificarea veche, cât și de cea nouă, precum și de barele din Gantt. Aveți încredere în ele doar după F5.
- Dacă prezentarea nu poate calcula un proiect, de exemplu dintr-o buclă în dependențele sale, acel proiect nu se numără. Proiectul apare totuși în listă, cu textul *Nu se numără: planificarea nu este calculată — activați acest document și apăsați F5.* iar deasupra tabelului textul *Cel puțin un document nu este calculat și nu este inclus în ocupare.*

**Prezentarea nu corespunde cu ce așteptați.** Capacitatea provine din bibliotecă (*Capacitate maximă* a elementului din bibliotecă sau *Capacitate pe etape de timp* a acestuia în acea zi), nu din *Capacitate maximă* a copiei din proiect. O sumă egală cu capacitatea nu este un conflict.

## Vezi și

- [Biblioteca de resurse](docs://uitleg-resourcebibliotheek): cum se numără ocuparea, cu un exemplu detaliat.
- [Utilizarea bibliotecii de resurse](docs://howto-resourcebibliotheek-gebruiken): conectarea proiectelor și atribuirea resurselor.
- [Rezolvarea supraalocării](docs://howto-overbezetting-oplossen): supraalocare în cadrul unui singur proiect.
