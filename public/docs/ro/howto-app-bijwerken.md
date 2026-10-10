# Actualizarea aplicației

Scop: aflați dacă aveți cea mai recentă versiune, actualizați aplicația și citiți ce este nou într-o versiune.

## Când aveți nevoie de aceasta

O versiune nouă a Open Planner Studio apare regulat. Doriți să știți dacă o aveți deja, de exemplu înainte să semnalați o eroare sau pentru că o extensie cere o versiune mai nouă. Sau tocmai ați actualizat și doriți să vedeți ce s-a schimbat.

Actualizarea funcționează doar în aplicația desktop. Versiunea pentru browser nu are program de actualizare.

## Pași

### Actualizați când aplicația indică o versiune nouă

1. Porniți aplicația desktop. La pornire, aplicația verifică în fundal dacă există o versiune nouă. Dacă nu există o versiune nouă sau verificarea eșuează, de exemplu fără internet, nu observați nimic.
2. Dacă există o versiune nouă, se deschide fereastra *Actualizare software*. Aceasta afișează *Versiune curentă*, *Versiune nouă*, mesajul *Este disponibilă o versiune nouă* și, sub *Noutăți*, textul care însoțește actualizarea.
3. Salvați proiectele deschise.
4. Faceți clic pe *Descărcare și instalare*. O bară de progres afișează *Se descarcă…*, apoi urmează instalarea. Nu puteți închide fereastra cât timp se descarcă.
5. Așteptați până când aplicația se repornește singură. Aceasta este versiunea nouă.

Chiar înainte de instalarea actualizării, aplicația face și un instantaneu de refacere (pentru refacerea în urma unei căderi) al lucrărilor dumneavoastră deschise, vedeți [Refacerea în urma unei căderi](docs://howto-herstellen-na-een-crash).

### Verificați singur dacă există o versiune nouă

1. Alegeți *Setări › Proiect › Setări*. Puteți alege și *Fișier › Setări*, sau pictograma roată din partea de sus.
2. Alegeți fila *Avansat*. Sub *Versiune* este numărul versiunii dumneavoastră curente.
3. Faceți clic pe *Verificare actualizări*. Se deschide fereastra *Actualizare software* și afișează *Se verifică…*. Apoi afișează *Aveți instalată cea mai recentă versiune* sau mesajul că există o versiune nouă, cu același buton *Descărcare și instalare*.

În browser, acest buton nu face nimic special: fereastra afișează imediat *Aveți instalată cea mai recentă versiune*, fără ca aplicația să verifice ceva.

### Citiți noutățile

1. Dacă porniți aplicația desktop pentru prima dată într-o versiune diferită de cea de data trecută, sau după o instalare nouă, se deschide singură o fereastră. Fereastra are titlul *Sunteți la zi!*
2. Sus se afișează trecerea de la versiunea anterioară la versiunea nouă. După o instalare nouă se afișează doar versiunea nouă.
3. Dacă aplicația are un rezumat încorporat pentru această versiune, vedeți un punct principal și patru puncte mai mici. Punctul principal poate avea un buton *Citire ghid*. Altfel vedeți doar trecerea de versiune și ce este dedesubt.
4. Cu *Vizualizare note complete de lansare* deschideți jurnalul modificărilor pe GitHub. Dacă aceasta nu funcționează, apare mesajul *Notele de lansare nu au putut fi deschise.*
5. Sub *Această actualizare în cifre* se află numărul de zile de la lansarea anterioară, numărul de commituri și numărul de linii de cod adăugate. Dacă aplicația poate afla diferența de dimensiune a pachetului de instalare, și aceasta se afișează. Fiecare cifră se afișează doar dacă este disponibilă.
6. Faceți clic pe *Înțeles* ca să închideți fereastra.

Dacă doriți să vedeți din nou această fereastră mai târziu, alegeți *Setări › Proiect › Setări*, fila *Avansat*, și sub *Versiune* butonul *Ce este nou*. Fereastra se deschide atunci pentru versiunea dumneavoastră curentă, fără versiune anterioară.

## Probleme și ce face atunci aplicația

**Actualizarea eșuează.** Fereastra afișează *A apărut o eroare la actualizare*, cu motivul tehnic afișat dedesubt, și butonul *Reîncercare*.

**Ați instalat aplicația ca pachet .deb, iar instalarea eșuează.** Fereastra explică: *Actualizați manual rulând această comandă într-un terminal sau descărcați cel mai recent pachet.* Sub *Comandă de instalare* se află comanda, cu butonul *Copiere comandă* (după aceea afișează *Copiat*). Cu *Deschidere descărcări* ajungeți la pagina de descărcare a celei mai recente versiuni.

**Aveți aplicația prin Snap Store.** Atunci aplicația nu se actualizează singură și nu verifică nici la pornire. Snap Store face aceasta. În fereastră se afișează *Această versiune se actualizează automat prin Snap Store — nu trebuie să faceți nimic.*

**La pornire nu apare nimic.** Aceasta este normală dacă aveți deja cea mai recentă versiune. Verificarea de la pornire nu afișează erori. Dacă doriți să fiți sigur că aveți cea mai recentă versiune, verificați singur, cum este descris mai sus.

## Vezi și

- [Trimiterea de feedback](docs://howto-feedback-geven): semnalați o eroare din cea mai recentă versiune.
