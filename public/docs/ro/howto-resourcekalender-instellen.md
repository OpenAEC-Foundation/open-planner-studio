# Configurarea unui calendar de resurse

Scop: de notat în ce zile este disponibilă o resursă, astfel încât histograma, supraalocarea și redistribuirea să se calculeze cu acest calendar.

## Când aveți nevoie de acest lucru

Brigada de zidari lucrează numai de luni până joi. Macaraua este pe alt proiect în primele două săptămâni din august. Un subcontractant are patru zile lucrătoare fixe. Fără un calendar propriu, aplicația presupune că resursa lucrează în zilele din calendarul proiectului.

Un calendar de resurse nu modifică nicio dată a activității. El stabilește doar când este disponibilă resursa. Dacă o activitate are loc într-o zi în care resursa nu lucrează, capacitatea în acea zi este 0, iar ziua este considerată supraalocată. Dacă doriți ca activitatea în sine să se desfășoare în alte zile, dați activității un calendar propriu ([Crearea și atribuirea unui calendar](docs://howto-kalender-maken-en-toewijzen)). Diferența este explicată în [Calendare și zile lucrătoare](docs://uitleg-kalenders).

## Pași

### Crearea unui calendar nou de resurse

1. Alegeți *Resurse › Gestionare › Resurse*. Se deschide panoul de resurse. Dacă resursa nu există încă, creați-o cu *Resursă nouă în proiect*.
2. Găsiți rândul resursei. În coloana *Calendar* valoarea implicită este *Calendar de proiect*: resursa urmează atunci calendarul proiectului.
3. În lista respectivă, alegeți *+ Calendar de resurse*. Se deschide fereastra *Calendar de resurse*. Ea are aceleași câmpuri ca formularul de calendar: *Nume*, *Zile lucrătoare*, timpul de lucru și *Sărbători*. Noul calendar începe ca o copie a calendarului standard și se numește *Calendar de resurse*.
4. Dați calendarului un nume potrivit resursei, de exemplu *Crew Mon–Thu*, și stabiliți zilele lucrătoare: dezactivați vineri sub *Zile lucrătoare*. Sărbătorile sau perioadele de oprire le adăugați în lista *Sărbători* cu *Adăugare sărbătoare*.
5. Faceți clic pe *Aplicare*. Calendarul se află acum în biblioteca de resurse a proiectului și este legat de resursă, într-un singur pas, pe care îl anulați cu *Anulare*. Cu *Anulare* nu se creează nimic.

### Alegerea sau ajustarea unui calendar existent

În coloana *Calendar*, alegeți un calendar din listă. *Calendar de proiect* elimină din nou calendarul propriu. Dacă doriți să ajustați calendarul ales, faceți clic pe creionul de lângă listă (*Editare…*). Se deschide fereastra *Calendar de resurse* cu calendarul actual.

### Verificarea rezultatului

1. Dacă bara de stare afișează *Învechit — recalculați (F5)*, apăsați **Calculare** (F5).
2. Alegeți *Resurse › Histogramă › Histogramă* și faceți clic pe resursa din lista din stânga histogramei. Zilele în care resursa nu lucrează, dar este planificată, apar cu roșu. Dacă treceți cu mouse-ul peste una dintre ele, bara afișează, de exemplu, *Nu lucrează în această zi conform calendarului „Crew Mon–Thu”*.
3. Sub *Resurse › Supraalocare* se află numărul de resurse supraalocate, iar bara de stare afișează, de exemplu, *1 resursă(e) supraalocată(e)*.

## Capcane și ce face aplicația atunci

**Numai zilele contează, nu orele.** Un calendar de resurse stabilește în ce zile lucrează resursa. Câte unități de atribuire sunt disponibile în acea zi rezultă din *Capacitate maximă* a resursei, nu din timpul de lucru din calendar.

**Redistribuirea nu rezolvă întotdeauna această problemă.** Dacă nu există o perioadă în care fiecare zi a activității cade într-o zi lucrătoare a resursei, deplasarea nu ajută. Alegeți *Resurse › Redistribuire › Nivel…* și faceți clic pe *Calculare*. Activitatea apare apoi sub *Conflicte rămase*, cu motivul *Resursa nu lucrează în toate zilele necesare acestei activități — deplasarea nu rezolvă acest lucru*. Atribuiți atunci activitatea altei resurse sau dați-i un calendar propriu.

**Un calendar comun.** Lista arată toate calendarele proiectului, deci și *Calendar de proiect* și calendarele activităților. Dacă ajustați un astfel de calendar cu creionul, planificarea activităților care îl folosesc se modifică și ea, iar bara de stare afișează *Învechit — recalculați (F5)*. Mai bine creați un calendar propriu pentru resursă.

**Supraalocarea nu este întotdeauna cauzată de calendar.** O resursă care lucrează în fiecare zi poate fi supraalocată și ea. Textul de sugestie menționează calendarul numai dacă ziua nu este o zi lucrătoare a resursei.

## Vezi și

- [Calendare și zile lucrătoare](docs://uitleg-kalenders): de ce un calendar de resurse nu mută nicio dată.
- [Crearea și atribuirea unui calendar](docs://howto-kalender-maken-en-toewijzen): câmpurile formularului de calendar.
- [Generarea sărbătorilor și a concediului colectiv din construcții](docs://howto-feestdagen-genereren): punerea sărbătorilor și a perioadelor de oprire în calendar.
- [Ferestrele calendarului](docs://ref-kalenders): toate câmpurile ferestrelor de calendar.
