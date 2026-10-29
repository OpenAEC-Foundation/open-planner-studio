# Gün ve saat

2 günlük bir görev ile 16 saatlik bir görev aynı görünür, ama uygulama bunları farklı hesaplar. Neden gün ile saat arasında seçim yapabilirsiniz? Ve saat ile ölçülen bir görev, gün ile ölçülen bir göreve bağlandığında ne olur? Bu makalede uygulamanın günleri ve saatleri nasıl saydığını ve nerede yuvarladığını okursunuz. Uygulamalı örnek sayıları gösterir.

## Kavram

Bir **gün görevi**nin süresi tam iş günü cinsinden verilir, örneğin `5d`. Tam iş günlerini kaplar. Standart takvimde saat olmadan bir başlangıç ve bir bitiş tarihi vardır.

Bir **saat görevi**nin süresi çalışma saati cinsindendir, örneğin `12h` veya `1h 30m`. Bir başlangıcı ve bir bitişi vardır, saatiyle birlikte. Örneğin salı 11:00.

Birim göreve aittir, projeye değil. Tek bir planlamada gün görevleri ile saat görevlerini bir arada kullanabilirsiniz. Buna **karma planlama** denir.

Saatleri, tam günlere sığmayan işler için kullanırsınız: on iki saat için kiraladığınız bir vinç, altı saatlik bir döküm, yalnızca öğle yemeğinden sonra başlayabilen bir görev. Diğer her şey için günler yeterlidir ve daha açıktır.

**Saat planlaması** varsayılan olarak kapalıdır. Kapalıyken uygulama günlerle çalışır. Bir dosya yine de saat planlaması içeriyorsa, örneğin saat görevleri, uygulama *Bu dosya saat bazlı planlama içeriyor.* uyarısını gösterir. Bu görevler yine hesaplanır, ama süresini yalnızca saat planlamasını açtıktan sonra düzenleyebilirsiniz.

## Uygulama nasıl hesaplar

### Çalışma saatleri ve standart iş günü

Her takvimde her iş günü için **bantlar** vardır (uygulamada *bant* olarak adlandırılır). Standart takvimde 07:00 ile 12:00 arası ve 13:00 ile 16:00 arası vardır. Aradaki boşluk **mola**dır. Uygulama bu bantları takvimin *Başlangıç (saat)* ve *Bitiş (saat)* değerlerinden ve molasından türetir; bunun için bir şey ayarlamanız gerekmez. Haftanın gününe göre kendi bantlarınızı ayarlarsanız, bunlar öncelik kazanır.

**Standart iş günü**, en sık görülen iş günüdür; uzunluğu bantlarının toplamıdır. Yani bu bir ortalama değildir: pazartesi 16 saat, salıdan cumaya 10 saat olduğunda standart iş günü 10 saattir. İş günleri uzunluk bakımından farklıysa en sık görülen günlük toplam geçerlidir; eşitlik olursa en yüksek olan. Dört gün 8 saat ve bir cuma 5 saat olduğunda standart iş günü dolayısıyla 8 saat olur. Kendi günlük saatleri olan bir takvim (örneğin Primavera P6) da bu günlük toplamla hesaplar ve takvim penceresi bunu gösterir. Kendi değeri dışa aktarma için korunur. Farklıysa takvim penceresi *Standart iş günü* altında turuncu bir blok gösterir. 10 saatlik bantlarla 1870 saatlik bir görev 187 gün sürer, kendi değeri günde 8 saat olsa bile.

### Saat görevi

Uygulama başlangıçtan itibaren çalışma dakikalarını bantlar üzerinden sayar. Molalar, akşamlar, hafta sonları ve tatiller sayılmaz. 12 saatlik bir görev bu yüzden 8 saatlik tek bir iş gününe sığmaz: ertesi güne uzanır.

### Gün görevi

Uygulama tam iş günlerini sayar. Günlük saatler bir rol oynamaz. 5 günlük bir görev, takvimde günde 6 veya 8 saat olsun, aynı günde biter.

### Gün ve saatleri dönüştürme

Bir gün, görevin takvimindeki standart iş günüdür. Uygulama bunu üç yerde kullanır:

- Süre gösterimi için. *Ayarlar › Proje › Uygulama ayarları* altında, *Görünüm* sekmesinde *Otomatik (göreve özgü birim)*, *Her zaman gün* veya *Her zaman saat* seçersiniz. 18 saatlik bir görev, *Her zaman gün* altında `2.25d(18h)` olarak görünür: özgün birim parantez içinde kalır.
- Gün görevinden sonra saat cinsinden bir gecikme için (bkz. *Yuvarlama*).
- Bir görevin birimini değiştirdiğinizde. Uygulama o zaman görevin başlangıcından itibaren günleri sayar, her gün kendi saatleriyle, ve sonuç tam çıkarsa süreyi hemen dönüştürür. İki gün `16h` olur. Cuma günü 5 saat olan bir takvimde, pazartesiden başlayan 5 gün `37h` olur. On iki saat, 8 saatlik günlere sahip bir takvimde tam günlere çevrilemez: uygulama birimi o zaman olduğu gibi bırakır.

### Gün görevleri ve saat görevleri birlikte

Aşağıdaki kurallar, kendi çalışma bantları olmayan bir takvimdeki bitiş-başlangıç ilişkisi için geçerlidir. Örneğin standart takvim.

- **Saat → saat.** Ardıl, öncül bittiği anda başlar; bu bir günün ortasında olsa bile.
- **Saat → gün.** Bir gün görevi asla bir günün ortasında başlamaz. Saat görevinin bittiği günden sonraki ilk iş gününde başlar. O günün kalan kısmı kullanılmaz ve saat görevinin bolluğu olarak geri döner.
- **Gün → saat.** Bir gün görevi son gününün tamamını kaplar. Saat görevi, ondan sonraki ilk iş gününde, ilk bantın başlangıcında başlar.

### Yuvarlama

Uygulama dört yerde yuvarlar veya reddeder:

- **Saat görevinden sonra gelen bir gün görevi** bir sonraki iş gününde başlar. Saat görevi, deyim yerindeyse, tam günlere yukarı yuvarlanmış sayılır.
- **Saat cinsinden bir gecikme** gecikme takviminde sayılır; varsayılan olarak öncülün takvimindedir. Öncül, standart takvim gibi kendi çalışma bantları olmayan bir takvimde bir gün görevi ise, uygulama gecikmeyi tam iş günlerine çevirir: gecikme, standart iş gününün saatlerine bölünür ve tam sayıya yuvarlanır; yarım gün yukarı yuvarlanır. Günde 8 saatte 1 saat 0 gün, 4 saat 1 gün ve 12 saat 2 gün sayılır. Bu, ardıl bir saat görevi olsa bile geçerlidir. Öncül bir saat görevi ise veya takvimi kendi çalışma bantlarına sahipse, gecikme tam olarak çalışma saatleri olarak sayılır ve mola sayılmaz.
- **Gün cinsinden bir süre** her zaman tam sayıdır. `1.5d` yazarsanız, uygulama *2d veya 12h gibi tam gün ya da saat sayısı girin.* uyarısını gösterir. Saat cinsinden bir süre `1.5h` veya `1h 30m` olabilir.
- **Birimi değiştirmek** yalnızca sonuç tam çıkarsa gerçekleşir (bkz. yukarıda).

## Uygulamalı örnek: vinç

Takvim pazartesiden cumaya, 07:00 ile 12:00 arası ve 13:00 ile 16:00 arasıdır: standart iş günü 8 saat. Proje Pazartesi 7 Haziran 2027'de başlar.

### Saat, saat ve gün

*Place crane* 12 saat sürer. Pazartesi 8 çalışma saati vardır (12:00'a kadar 5 ve molanın ardından 3) ve salıda kalan son 4 saat. Görev pazartesi 07:00'den **salı 8 Haziran 11:00**'e kadar sürer.

*Adjust elements* 8 saat sürer ve bir bitiş-başlangıç ilişkisiyle bunu izler. Salı günü 11:00'de hemen başlar: molaya kadar 1 saat ve molanın ardından 3 saat. Kalan son 4 saat çarşamba günü 07:00'den 11:00'e kadardır. Bitiş **çarşamba 9 Haziran 11:00**'dir.

*Finishing* 2 gün sürer ve *Adjust elements* görevini izler. Bir gün görevi bir günün ortasında başlamaz; bu yüzden **perşembe 10 Haziran**'da başlar ve cuma 11 Haziran'da biter.

### Geçişte yuvarlama

*Adjust elements* görevini atlarsanız ve *Finishing* görevini doğrudan *Place crane* görevine bağlarsanız, *Finishing* çarşamba 9 Haziran'da başlar ve perşembe 10 Haziran'da biter. Salının kalan kısmı (4 çalışma saati) kullanılamaz. Bu 4 saati, *Place crane* görevinin toplam bolluğu olarak yeniden görürsünüz: yarım iş günü.

Sırayı tersine çevirirseniz, daha basittir. *Pour foundation* 2 gün sürer, pazartesi 7 Haziran'dan salı 8 Haziran'a kadar. *Place crane* şimdi 4 saat sürer ve ardından gelir. **Çarşamba 9 Haziran 07:00'de** başlar ve 11:00'de biter.

### Saat cinsinden bir gecikme

*Place crane* (12 saat) ile *Adjust elements* (8 saat) arasına 2 saatlik bir gecikme koyarsınız. *Adjust elements* o zaman 11:00'de değil, salı günü **14:00**'te başlar: bu, molaya kadar 1 saat ve molanın ardından 1 saat demektir. Bitiş de **çarşamba 9 Haziran 14:00**'e kayar.

Bir gün görevinden sonra gecikme farklı davranır. *Pour foundation* salı 8 Haziran'da biter. Gecikme olmadan *Finishing* çarşamba 9 Haziran'da başlar. 4 saatlik bir gecikme yarım gündür ve uygulama bunu yukarı yuvarlar: *Finishing* **perşembe 10 Haziran**'da başlar. 1 saatlik bir gecikmede uygulama aşağı yuvarlar ve *Finishing* basitçe çarşamba günü başlar.

### Boş bir cuma öğleden sonrası

Şimdi cumanın yalnızca bir bandı vardır, 07:00 ile 12:00 arası: 5 saat. Diğer günler 8 saatte kalır. Standart iş günü 8 saat olarak kalır, çünkü en sık görülen günlük toplam budur. Bir hafta şimdi 37 çalışma saatine sahiptir.

Pazartesi 7 Haziran 07:00'den başlayan 40 saatlik bir görev, pazartesiden perşembeye (32 saat) ve cumaya (5 saat) kadar sürer. Son 3 saat, ertesi pazartesi 07:00 ile 10:00 arasına düşer. Bitiş **pazartesi 14 Haziran 10:00**'dır. Pazartesiden başlayan 5 günlük bir görev 37 saat kaplardı ve 5 günü saate çevirmek için birimi değiştirirseniz uygulamanın önerdiği de budur.

Eğitim 4'te, saat planlaması üzerine, bir vinç görevini kendiniz saat olarak planlarsınız.

## Sonuçlar ve yanlış anlamalar

**“8 saat 1 gündür.”** Yalnızca takvimde 8 saatlik günler varsa. Boş cuma öğleden sonrası olan takvimde 5 gün 37 saattir, 40 değil.

**“Günde daha fazla saat ayarlarsam, gün görevim daha erken biter.”** Hayır. Bir gün görevi tam iş günlerini sayar. Günlük saatler yalnızca bir günün saat cinsinden değerini değiştirir, örneğin gösterimde ve saat cinsinden bir gecikme için. Yalnızca kaynakları olan ve *Sabit iş* veya *Sabit birimler* görev türüne sahip bir görevde süre bununla birlikte değişir, çünkü iş aynı kalır: 40 saatlik iş, günde 8 saatte 5 gün ve günde 6 saatte 7 gündür.

**“8 saatlik bir görev bir gün sürer.”** Yalnızca günün başında başlarsa. Daha sonra başlarsa, örneğin salı 11:00'de *Adjust elements* gibi, ertesi güne uzanır.

**Kendi çalışma bantları olan bir takvim** standart takvimden farklı davranır. Böyle bir takvimi, haftanın günlerine göre çalışma saatlerini ayarlayarak ya da bir vardiya ön ayarını seçerek (*2 vardiya*, *3 vardiya*, *Gece vardiyası* veya *24/7*) elde edersiniz. Böyle bir takvimde saat cinsinden bir gecikme, bir gün görevinden sonra da tam olarak çalışma saati olarak sayılır.

**Saat planlamasını kapatmak** hiçbir şeyi silmez. Saat görevleri kalır ve yine hesaplanır, ama saat planlamasını yeniden açana kadar bunları düzenleyemezsiniz.

## Ayrıca bakın

- [Saat planlamasını açma](docs://howto-urenplanning-aanzetten): bir görevi saat cinsinden planlamanın adımları.
- [Çalışma saatlerini ayarlama](docs://howto-werktijden-instellen): bir takvimin çalışma bantlarını ayarlama.
- [Takvimler ve iş günleri](docs://uitleg-kalenders): uygulamanın iş günlerini nasıl saydığı ve hangi takvimin geçerli olduğu.
- [İlişki ekleme](docs://howto-relaties-leggen): bir ilişki veya gecikme eklemenin adımları.
