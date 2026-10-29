# Rapor dönemini seçmek

Amaç: bir raporun hangi zaman aralığını kapsayacağını belirlemek, örneğin önümüzdeki dört hafta veya Haziran ayı.

## Bunu ne zaman kullanırsınız

Haftalık toplantıda önümüzdeki dört haftada ne olacağı sorulur. Aylık rapor Haziran ayını kapsar. Dönem olmadan rapor tüm planlamayı çıktı olarak verir. Bu nedenle beş rapor bir *Rapor dönemi:* kullanır: *İleriye bakış (look-ahead)*, *İlerleme raporu*, *Kaynak yükü*, *Kaynak atamaları* ve *Kaynak diyagramı*. Diğer raporların dönemi yoktur.

Dönem bir takvim ayına değil, bir **referans gününe** bağlıdır: projenizin durum tarihine (ilerlemeyi ölçtüğünüz gün, bkz. [İlerleme, durum tarihi ve temel plan](docs://uitleg-voortgang)), veya proje durum tarihi yoksa bugüne. *Gelecek 4 hafta* bu günden itibaren sayılır. Durum tarihini değiştirirseniz, pencere de onunla birlikte kayar.

## Adımlar

### 1. Durum tarihini ayarlayın

Göreli bir seçenekle çalışıyorsanız, örneğin *Gelecek 4 hafta* veya *Geçen ay*, önce durum tarihini ayarlayın. *Planlama › Temel plan ve ilerleme* öğesini seçin ve *Durum tarihi* alanını doldurun. Yanındaki çarpıya (*Durum tarihini temizle*) tıklayarak tarihi yeniden kaldırırsınız. Sabit bir dönemle çalışıyorsanız (4. adım), bunu yapmanız gerekmez.

### 2. Dönemi olan bir rapor seçin

*Rapor* sekmesini açın ve *Rapor türü* bölümünde beş raporun birini seçin. *Rapor dönemi:* listesi *Rapor seçenekleri* altındadır. Kaynak diyagramında bu liste *Ayarlar* altındadır; bu raporun dört onay kutusunun altında.

Her rapor kendi dönemini hatırlar. Bunlar başlangıç değerleridir:

- *İleriye bakış (look-ahead)*: *Gelecek ay*.
- *İlerleme raporu*: *Geçen ay*.
- *Kaynak yükü*, *Kaynak atamaları* ve *Kaynak diyagramı*: *Tüm proje*.

### 3. Listeden bir dönem seçin

Listede *Gelecek hafta*, *Gelecek 2 hafta*, *Gelecek 4 hafta*, *Gelecek 6 hafta*, *Gelecek 8 hafta*, *Gelecek 12 hafta*, *Gelecek ay*, aynı yedi seçeneğin geçmişe dönük hali, *Tüm proje* ve *Özel* bulunur. Listenin altında *Başlangıç* ve *Bitiş* yer alır; bunlar seçimin ürettiği tarihleri gösterir. Bu tarihleri burada yalnızca okuyabilirsiniz.

Her iki gün de dahildir. Durum tarihi Perşembe 20 Mayıs ise, *Gelecek hafta* 20 ile 26 Mayıs arasını kapsar, dahil. *Gelecek 4 hafta* 20 Mayıs ile 16 Haziran arasını kapsar, dahil (28 gün). *Gelecek ay* aynı tarihin bir gün öncesine kadar sürer, sonraki ayda; burada 19 Haziran'a kadar, dahil. *Son 2 hafta* 7 ile 20 Mayıs arasını kapsar, dahil.

*Tüm proje* planlamayı ilk başlangıçtan son bitişe kadar alır.

### 4. Veya Özel seçin

*Özel* seçildiğinde *Başlangıç* ve *Bitiş* iki tarih alanı olur. Bu alanlar, az önce seçtiğiniz seçeneğin tarihleriyle başlar. İkisini de doldurun, örneğin 1 ve 14 Haziran. Giriş doğru değilse rapor son geçerli dönemde kalır ve kırmızı renkte şunu gösterir:

- *Bitiş tarihi başlangıç tarihinden önce.* Bu, *Bitiş* tarihi *Başlangıç* tarihinden önceyse görünür.
- *Her iki tarihi de girin.* Bu, iki tarihten biri boşsa görünür.

### 5. Dönemi raporda okuyun

İleriye bakış (look-ahead), Kaynak yükü ve Kaynak atamaları raporlarında dönem başlığın altında yer alır, örneğin *Dönem: 20-05-2027 – 19-06-2027*. *Tüm proje* seçerseniz, *Tüm proje* tarihlerin arkasına eklenir. İlerleme raporu dönemi özetteki *Dönem* satırında gösterir. Kaynak diyagramında zaman ekseni tam olarak dönemi kapsar.

### Dönemin her rapordaki etkisi

Dönem her raporda aynı şekilde çalışmaz.

- **İleriye bakış (look-ahead)** dönemle kesişen tamamlanmamış görevleri alır, dönemin tamamını kapsasalar bile. Referans gününden önce bitiş tarihi geçmiş görevler de dahil edilir; dönemin sonu referans gününden önce olmadığı sürece. Tamamen geçmişte kalan bir *Özel* dönem geriye bakıştır: yalnızca o zaman devam eden ve henüz bitmemiş görevleri gösterir, bugünkü birikimi göstermez.
- **İlerleme raporu** dönemi *Geçen dönemde tamamlananlar* bölümünde kullanır. Bölüm *Gelecek dönemde başlayanlar* durum tarihinden itibaren ileriye bakar, özetteki *İleriye bakış bitişi* tarihine kadar. Geçmişe dönük bir dönem seçerseniz, rapor geriye baktığı kadar ileriye bakar: *Son 2 hafta* ve durum tarihi 20 Mayıs ise *İleriye bakış bitişi* 3 Haziran'ı gösterir. Tamamen geçmişte kalan bir *Özel* dönem veya *Tüm proje* yansıtılmaz.
- **Kaynak yükü** dönemle kesişen her haftayı veya ayı tamamen gösterir. Dönem çarşambadan çarşambaya sürüyorsa tam haftalar görürsünüz; böylece bir satır her zaman histogramla aynı sayıyı gösterir.
- **Kaynak atamaları** dönemle kesişen görevlerin atamalarını gösterir. *Tüm proje* ile tarihe göre filtreleme yapılmaz.
- **Kaynak diyagramı** yalnızca dönemle kesişen görevleri gösterir. Özetteki *Dönem dışında:* kaç görevin dışarıda bırakıldığını sayar.

## Tuzaklar ve uygulamanın yaptığı şeyler

**Durum tarihi yok.** Uygulama o zaman bugünü kullanır. Dönemi olan dört tablo raporu (*İleriye bakış (look-ahead)*, *İlerleme raporu*, *Kaynak yükü* ve *Kaynak atamaları*) bunu en üstte gösterir; göreli bir dönemde şu metni gösterir: *Durum tarihi ayarlanmadı — rapor bugünü kullanıyor (29-09-2026).* Bu metinde bugünün tarihi yer alır. Kaynak diyagramı bunu bildirmez. Bu nedenle *Başlangıç* ve *Bitiş* tarihlerine bakın: bunlar bugünün çevresinde olur, planlamanızın çevresinde değil.

**Dönem planlamanızın dışında kalır.** Bu durumda rapor boştur. *Kaynak diyagramı* bunu şöyle belirtir: *Rapor döneminde görev yok — başka bir dönem veya Tüm proje seçin.* (listede bu seçenek *Tüm proje* olarak adlandırılır). Diğer raporlarda sıfır görev veya hiç satır görürsünüz.

**Tarihler sizin biçiminizde görünür.** *Başlangıç* ve *Bitiş*, ayarlarınızdaki tarih biçimini izler. *Özel* seçeneğinin tarih alanları bunun dışındadır: bunlar tarayıcınızın tarih biçimini gösterir.

**Dönem birlikte kayar.** Göreli bir seçenek, örneğin *Gelecek ay*, her seferinde yeniden belirlenir. Durum tarihi değişirse, veya durum tarihi yoksa bir gün sonra, dönem hemen birlikte kayar. Sabit bir dönem istiyorsanız *Özel* seçin.

**Seçim tüm projelerinizde geçerlidir.** Özel bir dönem, bu cihazdaki tüm projelerinizde de geçerlidir; yalnızca açık proje için değil.

## Ayrıca bakın

- [Rapor oluşturmak ve yazdırmak](docs://howto-rapport-maken-en-afdrukken): rapor türünden PDF'e kadar tüm yol.
- [İlerleme, durum tarihi ve temel plan](docs://uitleg-voortgang): durum tarihinin ne olduğu ve uygulamanın neden bununla hesap yaptığı.
- [Aşırı atanmışlığı çözmek](docs://howto-overbezetting-oplossen): Kaynak yükü bölümündeki aşırı atanmış haftalarla ne yapacağınız.
- [Rapor türleri](docs://ref-rapporttypes): tüm rapor türleri ve bunların seçenekleri.
