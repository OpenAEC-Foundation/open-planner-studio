# Trimiterea de feedback

Scop: semnalați o eroare sau transmiteți o idee, opțional cu o captură de ecran, direct din aplicație.

## Când aveți nevoie de acest lucru

Aplicația calculează ceva ce nu înțelegeți, un buton nu face ce ar trebui sau vă lipsește ceva din aplicație. O sesizare bună ajută dezvoltatorii să găsească problema. De aceea aplicația adaugă ea însăși în sesizare versiunea, sistemul de operare și limba. Ce descrieți dumneavoastră decide dacă ei pot face ceva cu ea: ce ați făcut, ce ați așteptat și ce s-a întâmplat.

## Pași

1. Apăsați butonul *Trimitere feedback* din partea de sus a ferestrei. Acest buton se află întotdeauna în bara de titlu. Textul lui se schimbă la fiecare zece minute: *Trimitere feedback*, *Semnalare bug* și *Adăugare funcție nouă*. Este întotdeauna același buton. Se deschide fereastra *Trimiteți feedback*.
2. Alegeți tipul de sesizare. *Ceva nu funcționează* este pentru o eroare: ceva nu face ce ar trebui. *Idee* este pentru ceva ce vă lipsește sau ce doriți să fie altfel. *Întrebare sau observație* este pentru celelalte situații. *Ceva nu funcționează* este selectat implicit.
3. Completați câmpurile *Titlu* și apoi *Descriere*. Câmpurile goale arată un exemplu: un titlu, de exemplu *De exemplu: Drumul critic se mută brusc după salvare*, iar pentru descriere întrebarea *Ce ați făcut, ce ați așteptat și ce s-a întâmplat?* Cât timp butonul *Trimitere* este gri, o linie gri de lângă el spune de ce, de exemplu *Introduceți un titlu.* sau că trebuie să scrieți cel puțin 10 caractere în titlu și descriere împreună.
4. Dacă doriți un răspuns, completați câmpul *Adresă de e-mail*. Acest câmp este opțional. Aplicația reține adresa după o sesizare trimisă cu succes, deci este deja acolo data următoare.
5. Dacă doriți să arătați ceva, activați *Atașare captură de ecran*. Aplicația face atunci o imagine a aplicației fără această fereastră. Puțin mai târziu vedeți o previzualizare mică, cu trei butoane alături: *Adnotare*, *Reluare captură* și *Eliminare*.
6. *Adnotare* deschide un editor. În el adăugați săgeți, dreptunghiuri, linii libere și text pe imagine. Cu *Acoperire* desenați o zonă neagră peste ceva ce nu trebuie să ajungă mai departe, de exemplu un nume sau o sumă. Acea parte este apoi cu adevărat eliminată din imaginea pe care o trimite aplicația. Alegeți culoarea, anulați ultima acțiune cu *Anulare* sau începeți din nou cu *Ștergere totală*. Apăsați *Gata* pentru a păstra modificările, sau *Anulare* (sau Esc) pentru a renunța la ele.
7. *Reluare captură* face o captură de ecran nouă și șterge adnotările. *Eliminare* elimină captura de ecran și dezactivează caseta de bifare.
8. Uitați-vă la linia gri *Trimis împreună cu* sub formular. Ea arată ce trimite aplicația singură: versiunea, sistemul de operare și limba, de exemplu *Trimis împreună cu: v2026.10.1 · Windows · English*.
9. Apăsați *Trimitere*. În timpul trimiterii, butonul afișează *Se trimite…*.
10. Vedeți *Vă mulțumim, sesizarea a fost trimisă.* Dacă pentru sesizarea dumneavoastră a fost creată o problemă pe GitHub, apare și butonul *Vizualizare pe GitHub*. Apăsați *Închidere*.

## Unde ajunge sesizarea dumneavoastră

Aplicația trimite sesizarea dumneavoastră către Open Feedback Studio de la OpenAEC. Pentru aceasta nu aveți nevoie de un cont, nici pe GitHub. Dezvoltatorii văd sesizarea dumneavoastră în prezentarea lor generală. Dacă aplicația este legată de GitHub acolo, Open Feedback Studio transformă sesizarea și într-o problemă publică pe GitHub. Cu *Ceva nu funcționează*, problema primește eticheta *bug*, iar cu *Idee* eticheta *enhancement*. Sub descrierea dumneavoastră apare apoi o linie cu versiunea Open Planner Studio, sistemul dumneavoastră de operare și limba aplicației.

## Capcane și ce face aplicația atunci

**Sesizarea dumneavoastră poate deveni publică.** Nu puneți în ea nimic ce nu doriți să împărtășiți. Acest lucru se aplică și la captura de ecran: imaginea arată tot ce este vizibil în aplicație în acel moment, de exemplu numele activităților și resursele proiectului dumneavoastră. Aplicația face captura de ecran în momentul în care activați *Atașare captură de ecran*. Dacă ecranul nu este încă în regulă, închideți fereastra, aduceți ecranul în starea dorită, deschideți din nou fereastra și apăsați *Reluare captură*. Folosiți *Acoperire* pentru a ascunde ce nu doriți să arătați.

**Captura de ecran este prea mare.** Aplicația micșorează captura de ecran înainte de trimitere. Dacă este încă prea mare după aceea, sesizarea dumneavoastră se trimite fără imagine. Ecranul de mulțumire afișează atunci *Captura de ecran era prea mare și nu a fost trimisă.*

**Trimiterea nu funcționează.** Un mesaj apare în fereastră, iar textul dumneavoastră rămâne. Există patru cazuri:

- *Sesizarea nu a fost acceptată.* Verificați textul și adresa de e-mail. O sesizare formată în cea mai mare parte din linkuri este refuzată.
- *Ați trimis multe sesizări într-un interval scurt.* Încercați din nou peste o oră.
- *Trimiterea nu a reușit.* Nu există conexiune sau serverul nu răspunde. Încercați din nou sau apăsați *Deschidere pe GitHub*. Acest buton nu apare dacă o încercare anterioară nu a fost sigură (vedeți mai jos).
- *Nu suntem siguri dacă sesizarea dumneavoastră a ajuns. Așteptați un minut și trimiteți-o din nou; dacă este deja acolo, vom vedea asta automat.* Conexiunea s-a întrerupt după ce aplicația a trimis sesizarea dumneavoastră. Textul dumneavoastră rămâne. Nu există butonul *Deschidere pe GitHub*, pentru că sesizarea dumneavoastră poate încă să ajungă. Așa rămâne până când sesizarea dumneavoastră este trimisă sau deja primită, chiar dacă închideți fereastra între timp și o deschideți din nou.

**Sesizarea dumneavoastră a ajuns deja la noi.** Dacă trimiteți o sesizare care este deja acolo, formularul rămâne, iar deasupra apare acest text: *Această sesizare a ajuns deja la noi. Doriți să adăugați ceva? Modificați atunci textul și trimiteți din nou.* Textul dumneavoastră rămâne, iar adresa de e-mail este reținută. Apăsați *Închidere* dacă nu doriți să adăugați nimic; data următoare formularul este gol. Dacă scrieți ceva în plus, mesajul dispare și puteți trimite din nou; butonul se numește atunci din nou *Salvare și închidere*, iar textul dumneavoastră este păstrat.

**Deschidere pe GitHub.** Aceasta este calea fără Open Feedback Studio. Pentru aceasta aveți chiar nevoie de un cont pe GitHub. Fără captură de ecran, pagina GitHub pe care creați o problemă nouă se deschide imediat în browser, cu titlul și descrierea dumneavoastră deja completate. Cu captură de ecran vedeți mai întâi *Aproape gata — captura de ecran este în clipboard.* cu patru pași. Apăsați *Deschidere GitHub*, faceți clic în zona mare de text a paginii problemei și apăsați Ctrl+V (Cmd+V pe Mac). Apoi apăsați *Trimitere problemă nouă* din partea de jos. Abia atunci este trimisă sesizarea dumneavoastră.

**Lipirea nu funcționează.** Pe calea GitHub, captura de ecran este salvată și ca fișier pe calculatorul dumneavoastră. În aplicația desktop, fereastra menționează calea: *Nu puteți lipi? Am salvat și captura de ecran în* calea respectivă *— trageți fișierul respectiv în zona de text.* În browser, aplicația descarcă imaginea ca `feedback-` cu un număr și extensia `.png`. O găsiți în dosarul dumneavoastră de descărcări și o trageți în zona de text.

**Captura de ecran eșuează.** Aplicația afișează *Crearea capturii de ecran a eșuat. Puteți trimite feedback și fără captură de ecran.* Caseta de bifare se dezactivează, iar sesizarea dumneavoastră poate fi trimisă fără imagine.

**Închideți fereastra înainte de trimitere.** Dacă există ceva în formular, butonul de jos se numește *Salvare și închidere*; cu un formular gol se numește *Închidere*. *Salvare și închidere*, crucea și Esc închid fereastra, iar sesizarea dumneavoastră este păstrată ca ciornă până o trimiteți sau apăsați *Golire*. Când deschideți din nou fereastra, tipul, textul, adresa de e-mail și captura de ecran cu adnotări sunt încă acolo. Ciorna este păstrată cât timp aplicația este deschisă; după ce închideți aplicația, ea dispare. După o sesizare trimisă cu succes, formularul este din nou gol. Dacă doriți să începeți singur din nou, apăsați *Golire* din stânga jos. Un clic lângă fereastră nu o închide. Cât timp se trimite, Esc nu închide fereastra.

## Vezi și

- [Actualizarea aplicației](docs://howto-app-bijwerken): înainte de a trimite o sesizare, verificați dacă aveți cea mai recentă versiune.
