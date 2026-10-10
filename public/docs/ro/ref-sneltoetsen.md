# Comenzi rapide de la tastatură

Toate combinațiile de taste ale aplicației, grupate ca în fereastra *Comenzi rapide*. Tastele sunt fixe: nu le puteți reatribui. Cum lucrați cu mouse-ul și cu meniurile este descris în ghidurile practice; aici căutați o tastă.

## Cum se citește această listă

**Mac.** Oriunde acest articol spune Ctrl, folosiți Cmd (⌘) pe un Mac. Alt este Option (⌥). Pe un Mac, fereastra *Comenzi rapide* afișează simbolurile ⌥, ⇧ și ⌘ în loc de Alt, Shift și Ctrl. Ctrl funcționează și în aplicație pe un Mac.

**Combinație exactă.** Aplicația compară exact Ctrl, Shift și Alt. Ctrl+Alt+S, așadar, nu face nimic: tastele trebuie să corespundă exact listei.

**Deschiderea ferestrei.** Apăsați Ctrl+/ sau alegeți *Setări › Comenzi rapide › Comenzi rapide*. Ctrl+/ închide din nou fereastra. Fereastra este doar în citire. Ea nu afișează toate tastele din această listă: din tastele tabelului, doar primele șase intrări, și nu tastele pentru ferestrele de dialog de la finalul acestui articol.

**Când o tastă nu funcționează.** Fiecare intrare își precizează restricțiile. Trei reguli se aplică aproape peste tot:

- Într-un câmp de introducere, într-o listă derulantă sau într-o casetă de text, aplicația nu interceptează tastele, așa că puteți scrie pur și simplu. Excepții: F5, Ctrl+S, F11 și Esc în timpul prezentării funcționează și într-un câmp. În versiunea compilată a aplicației (aplicația desktop și versiunea web de pe site) este valabil și pentru Ctrl+Shift+S, Ctrl+O și Ctrl+N.
- Cât timp este deschisă o fereastră de dialog sau o altă fereastră, tastele marcate mai jos cu *Nu într-o fereastră de dialog* nu funcționează. Același lucru este valabil pentru modul de prezentare, turul, fereastra de bun venit și întrebările care așteaptă un răspuns, de exemplu acordul la instalarea unei extensii.
- Schimbarea documentului (Ctrl+1 până la 9, Ctrl+N, Ctrl+O) nu funcționează nici cât timp *Fișier › Informații proiect* conține modificări pe care nu le-ați confirmat cu *Aplicare*. Renunțați mai întâi la ele sau aplicați-le.

## Fișier

**F5** — *Calculare*: recalculează planificarea, ca butonul *Calculare* (*Acasă › Planificare › Calculare*). Funcționează și într-un câmp de introducere.

**Ctrl+S** — *Salvare*: salvează proiectul. Funcționează și într-un câmp de introducere.

**Ctrl+Shift+S** — *Salvare ca*: întreabă unde trebuie salvat fișierul. Într-o versiune de dezvoltare nu funcționează într-un câmp de introducere.

**Ctrl+O** — *Deschidere*: deschide un fișier, de obicei într-o filă nouă. Nu într-o fereastră de dialog și nu când informațiile proiectului au modificări neaplicate.

**Ctrl+N** — *Creare proiect*: deschide fereastra *Proiect nou*. Nu într-o fereastră de dialog și nu când informațiile proiectului au modificări neaplicate.

Versiunea compilată a aplicației (aplicația desktop și versiunea web de pe site) blochează și mai multe taste ale browserului, ca să nu deranjeze: Ctrl+R și Ctrl+Shift+R (reîncărcare), F12, Ctrl+Shift+I și Ctrl+Shift+J (instrumente pentru dezvoltatori), Ctrl+U (vizualizarea sursei) și Ctrl+G, Ctrl+F și Ctrl+L (căutare și bara de adrese). Ctrl+S, Ctrl+Shift+S, Ctrl+O, Ctrl+N și F5 merg direct la aplicație.

## Editare

**Ctrl+C** — *Copiere*: copiază activitățile selectate. Doar când există o selecție. În tabelul de activități, Ctrl+C copiază celulele selectate; tabelul gestionează singur acest lucru.

**Ctrl+V** — *Lipire*: lipește activitățile copiate. În tabelul de activități lipește celulele.

**Ctrl+Z** — *Anulare*.

**Ctrl+Y** sau **Ctrl+Shift+Z** — *Refacere*: repetă ce ați anulat.

**Delete** sau **Backspace** — *Ștergere*: șterge activitățile selectate. Doar când există o selecție. Într-o celulă din tabelul de activități, Delete și Backspace șterg doar conținutul celulei (vezi *Tabel*).

**F2** — *Editare...*: deschide fereastra de dialog a activității pentru prima activitate selectată. Doar când există o selecție. Nu într-o fereastră de dialog. Într-o celulă din tabelul de activități, F2 pornește editarea celulei.

**Ctrl+A** — *Selectare tot*: selectează toate activitățile. Nu într-o fereastră de dialog.

**Esc** — *Anulare selecție*: anulează selecția și, în același timp, oprește modul de dependențe, modul de scindare și urmărirea traseului. Închide și fereastra de dialog a activității și privirea de ansamblu asupra proiectului. În timpul prezentării, Esc închide doar prezentarea (vezi *Vizualizare*). Într-un câmp de introducere, Esc nu face niciuna dintre acestea.

## Structură

**Alt+Shift+→** sau **Alt+→** — *Indenta*: mută activitățile selectate cu un nivel mai jos în WBS. Doar cu o selecție, nu într-o fereastră de dialog.

**Alt+Shift+←** sau **Alt+←** — *Indenta negativ*: mută activitățile selectate cu un nivel mai sus. Doar cu o selecție, nu într-o fereastră de dialog.

Indenta, indenta negativ și inserarea deasupra sau dedesubt funcționează doar în vizualizarea simplă, de arbore: fără filtru, grupare sau sortare. În orice altă vizualizare, aplicația le refuză cu un mesaj, deoarece ordinea afișată nu mai este ordinea proiectului. Inserarea fără selecție funcționează în orice vizualizare.

**Insert** — *Inserare deasupra*: inserează o activitate nouă deasupra celei selectate cel mai sus, la același nivel. Fără selecție, activitatea se adaugă jos, în orice vizualizare. Nu într-o fereastră de dialog.

**Ctrl+I** — *Inserare dedesubt*: inserează o activitate nouă sub cea selectată cel mai jos, la același nivel. Fără selecție, activitatea se adaugă jos. Nu într-o fereastră de dialog.

**Ctrl+M** — *Adăugare jalon*: adaugă un jalon nou la capătul listei, chiar dacă aveți o activitate selectată. Nu într-o fereastră de dialog.

**Alt+↑** — *Mutare activitate în sus*: mută prima activitate selectată cu un loc mai sus, în cadrul nivelului ei. Doar cu o selecție, nu într-o fereastră de dialog.

**Alt+↓** — *Mutare activitate în jos*: la fel, cu un loc mai jos.

## Vizualizare

**F11** — *Prezentare*: pornește sau oprește modul de prezentare. Aplicația cere și browserului sau ferestrei ecranul complet. Funcționează și într-un câmp de introducere.

**Esc** (în timpul prezentării) — *Ieșire din prezentare*. Funcționează și într-un câmp de introducere. Aceasta are prioritate față de *Anulare selecție*.

**Ctrl+=** — *Mărire*: mărește cronologia cu un pas fix. Nu într-un câmp de introducere.

**Ctrl+-** — *Micșorare*: micșorează cu un pas fix.

**+** sau **=** — *Mărire*: mărește cu 10% în jurul mijlocului zonei Gantt. Nu într-un câmp de introducere, și doar când zona Gantt este vizibilă (deci nu pe filele *Tabel*, *IFC* și *Raport*).

**-** — *Micșorare*: micșorează cu 10%. Aceleași restricții.

**0** — *Resetare zoom*: readuce zoomul la valoarea implicită și derulează la început. Aceleași restricții.

**Ctrl+0** — *Potrivire la proiect*: ajustează zoomul astfel încât întregul proiect să încapă în vizualizare. Aceleași restricții.

**Ctrl+/** — *Afișare comenzi rapide*: deschide și închide fereastra *Comenzi rapide*. Funcționează și când este deschisă o altă fereastră de dialog, dar nu în timpul turului și al ferestrei de bun venit.

**Ctrl+Shift+H** — *Histogramă*: pornește sau oprește histograma, ca butonul *Histogramă* (*Resurse › Histogramă › Histogramă* sau *Vizualizare › Panouri › Histogramă*). Aplicația reține alegerea dumneavoastră.

**Ctrl+Shift+L** — *Avertismente*: pornește sau oprește panoul de avertismente, ca butonul *Avertismente* (*Vizualizare › Panouri › Avertismente* sau *Planificare › Planificare › Avertismente*).

## Navigare

**Ctrl+P** — *Trecere la fila Raport*: vă duce la fila *Raport*. Nu este, deci, o comandă de tipărire. Nu într-o fereastră de dialog.

**F1** — *Deschidere ajutor*: deschide *Fișier › Ajutor*. Nu într-un câmp de introducere și nu într-o fereastră de dialog. Într-o fereastră, folosiți semnul întrebării din dreapta sus: se deschide ajutorul despre articolul acelei ferestre (vezi [Panglica, filă cu filă](docs://ref-lint), la *Ajutor*).

**Ctrl+1** până la **Ctrl+9** — *Comutare document*: trece la primul până la al nouălea document deschis. Dacă documentul nu există, nu se întâmplă nimic. Nu într-o fereastră de dialog și nu când informațiile proiectului au modificări neaplicate.

**Ctrl+Home** — *Derulare la azi*: derulează cronologia astfel încât o dată să fie în stânga vizualizării. Aceasta este data raportului de stare, dacă ați stabilit una, altfel ziua de azi. Așadar, eticheta spune „azi”, chiar dacă cronologia sare la data raportului de stare. Zoomul și începutul cronologiei rămân cum erau. Dacă o celulă din tabelul de activități are focusul, Ctrl+Home trece în schimb la prima celulă a tabelului (vezi *Tabel*).

## Tabel

Aceste taste funcționează în tabelul de activități (pe fila *Tabel* și în tabelul din stânga diagramei Gantt) când o celulă are focusul. Fereastra *Comenzi rapide* afișează primele șase intrări; restul nu sunt în ea.

**Tab** și **Shift+Tab** — *Celula următoare/anterioară*: trece la celula următoare sau anterioară și, la capătul unui rând, la rândul următor. La ultima celulă (Tab) sau la prima (Shift+Tab), focusul părăsește tabelul.

**Enter** sau **F2** — *Editare celulă*: deschide editorul celulei. Dacă celula este doar în citire, tabelul afișează un mesaj.

**O literă, o cifră sau alt caracter** — *Tastarea înlocuiește conținutul celulei*: pornește editarea și înlocuiește conținutul cu ce tastați.

**Insert** — *Inserare deasupra*: inserează o activitate deasupra rândului activ.

**Delete** sau **Backspace** — *Ștergere conținut celulă*: șterge conținutul celulelor selectate, nu activitatea în sine. Fereastra *Comenzi rapide* listează doar Delete.

**Esc** — *Anulare selecție*: mută focusul pe tabelul în ansamblu, astfel încât următorul Tab să părăsească tabelul, și anulează selecția, așa cum este descris mai sus.

**Tastele săgeată** — duc la celula de deasupra, de dedesubt, din stânga sau din dreapta. Adăugați Shift pentru a extinde selecția.

**Home** și **End** — la prima sau la ultima coloană a rândului. Cu Ctrl adăugat, la prima celulă din primul rând și la ultima celulă din ultimul rând. Adăugați Shift pentru a extinde selecția.

**Page Up** și **Page Down** — cu o înălțime de ecran în sus sau în jos. Adăugați Shift pentru a extinde selecția.

**Enter** (în timpul editării) — confirmă introducerea și trece la aceeași coloană din rândul următor. Shift+Enter trece la rândul anterior.

**Esc** (în timpul editării) — anulează editarea fără să păstreze introducerea.

Tabelul de resurse are propria gestionare a tastelor între câmpurile de introducere; aceasta nu este în listă.

## Ferestre de dialog și alte ferestre

Aceste taste nu sunt în fereastra *Comenzi rapide*.

**Esc** — închide fereastra de dialog cea mai de sus (anulează). În *Fișier* (Backstage) Esc închide și ecranul, cu excepția cazului în care o fereastră de dialog sau o listă derulantă deschisă este deasupra.

**Enter** — confirmă fereastra de dialog cea mai de sus, ca butonul principal, în ferestrele care îl acceptă. Enter nu face asta într-o casetă de text cu mai multe rânduri, într-o listă derulantă deschisă sau în timpul introducerii IME.

**Esc** în timpul unui gest în Gantt — anulează un dreptunghi de selecție (selecția rămâne cum era) și un gest de scindare (o scindare deja făcută se anulează).

**Enter** și **Esc** în selectorul tipului de dependență — Enter confirmă, Esc anulează.

**Săgeata stânga** și **săgeata dreapta** pe separatorul dintre tabelul de activități și cronologie — mută separatorul câte 10 pixeli, 40 cu Shift. Separatorul trebuie să aibă focusul de la tastatură.

**Săgeata sus** și **săgeata jos** în lista de resurse a histogramei — alegeți resursa anterioară sau următoare. Câmpul histogramei trebuie să aibă focusul.

## Vezi și

- [Realizarea și tipărirea unui raport](docs://howto-rapport-maken-en-afdrukken): de ce Ctrl+P nu deschide o fereastră de tipărire.
- [Scindarea unei activități](docs://howto-taak-splitsen): gestul de scindare pe care Esc îl anulează.
- [Prezentarea pe un ecran mare](docs://howto-presentatie): F11 și Esc în practică.
- [Activarea AutoSave](docs://howto-automatisch-opslaan): salvarea cu Ctrl+S, alături de AutoSave.
- [Tragerea, panoramarea și zoomul în Gantt](docs://howto-gantt-bedienen): gesturile mouse-ului, alături de taste.
