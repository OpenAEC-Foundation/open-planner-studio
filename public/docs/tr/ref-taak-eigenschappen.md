# Görev penceresi ve özellikler paneli

Bir görevi iki yerde düzenleyebilirsiniz: *Görevi düzenle* penceresinde ve *Özellikler* panelinde. Bu iki yer neredeyse tüm alanları ortak kullanır. Bu makale her alan için ne yaptığını, varsayılan değerinin ne olduğunu ve bunu planlamada nasıl fark edeceğinizi açıklar. Bir görevin nasıl oluşturulup ayarlanacağını [Görev ve kilometre taşı ekleme](docs://howto-taken-en-mijlpalen-toevoegen) makalesinde bulursunuz. Hesaplamanın neden o sonucu verdiğini [Kritik yol ve bolluk](docs://uitleg-kritiek-pad) makalesi açıklar.

## İki yer

- **Görevi düzenle** — ilk seçili görevin penceresi. Bu pencereyi F2 ile açın, Gantt'ta bir çubuğa çift tıklayarak açın veya Gantt'ta ya da tabloda bir göreve sağ tıklayıp *Düzenle...* seçin. Değişiklikleriniz, *Kaydet* (Enter) düğmesine tıklayana kadar taslakta kalır. *İptal* (Esc) bunları atar. Ad boş olduğu sürece *Kaydet* devre dışıdır. Kaydetme, *Geri al* altında tek bir adım sayılır. Bu, *Görev türü*, *İlişkiler*, *Atamalar* ve *Kodlar ve alanlar* bölümlerinde yaptıklarınızı da kapsar. Bu bölümler düzenleme sırasında projeyi zaten etkiler. *İptal* bunları geri alır.
- **Özellikler** — sağdaki sütundaki panel, etkin görev için. Her değişiklik hemen etkili olur. Aynı alandaki art arda değişiklikler *Geri al* altında tek bir adım sayılır. Görev yoksa panel *Özelliklerini görüntülemek için bir görev seçin* yazar. Açmak veya kapatmak için *Görünüm › Paneller › Özellikler* yolunu kullanın. Varsayılan: açık. Panel, Gantt'ın yanında ve *Tablo* sekmesinde durur. Panel, *IFC* ve *Rapor* sekmelerinde ya da tam kaynak panelinin altında durmaz.

Yalnızca pencerede: *Üst görev* ile *Kaydet* ve *İptal* düğmeleri. Yalnızca panelde: çöp kutusu (*Görevi sil*), alttaki *Hesapla* düğmesi, *Kesintiler* bölümü, *Görev türü* altındaki üç işaret (uzun çalışılmayan dönem, MS Project, kayıtlı tarihler) ve *İlişkiler* bölümünde ilişki ekleme ve bağlı bir göreve gitme. Diğer tüm alanlar iki yerde de vardır. Pencere, *İlişkiler*, *Atamalar* ve *Kodlar ve alanlar* bölümlerini yalnızca mevcut bir görev için gösterir.

Tarihleri etkileyen bir şeyi değiştirdiyseniz *Hesapla* düğmesine basın. *Otomatik hesapla* açık değilse hesaplama kendiliğinden yapılmaz.

## Genel

- **Ad** (pencerede *Ad \**) — görevin adı. Gantt'ta, tabloda ve raporlarda görünür. Zorunlu: boş ad kaydedilmez. Yeni görev için varsayılan: *Yeni görev*.
- **WBS kodu** — görevin yapı kodu, örneğin `RB-301`. Zorunlu. *Planlama › Yapı › WBS auto* açıkken alan devre dışıdır (ipucu: *WBS kodları otomatik olarak numaralandırılır (Planlama → Yapı)*), çünkü kodları uygulama yönetir.
- **Açıklama** — serbest metin. Hesaplamaya etkisi yoktur. Tabloda *Açıklama* sütunu olarak gösterebilirsiniz.
- **İş kategorisi** — görevin iş kategorisi. Liste şu gruplara ayrılır: *Yerleşik iş kategorileri* (*İnşaat*, *Kurulum*, *Yıkım*, *Lojistik*, *Denetim*, *Taşıma*, *Yenileme*, *Bakım*), *İş kategorilerim* ve *Bu projeden*. *Diğer* yalnızca görevin zaten bu iş kategorisi varsa görünür. En altta *+ Yeni iş kategorisi…* ve *İş kategorilerini yönetin…* bulunur. Varsayılan: üst görevin iş kategorisi; üst görev yoksa *İnşaat* (İnşaat modu açıkken, varsayılan) veya *Diğer*. Etkisi: hesaplamaya etki etmez. İş kategorisine göre gruplayabilir, filtreleyebilir ve çubukları iş kategorisine göre renklendirebilirsiniz. Uygulama özel iş kategorinizi cihazınızda saklar. Bir iş kategorisini seçtiğinizde projeye bir kopya eklenir (*Bu projeden*). *+ Yeni iş kategorisi…* alanına *İş kategorilerim* içinde zaten bulunan bir ad yazarsanız, uygulama harf büyüklüğü farklı olsa bile ikinci bir iş kategorisi oluşturmaz. Mevcut olanı seçer. *İş kategorilerini yönetin…* bölümünde yalnızca kendi iş kategorilerinizi düzenler veya kaldırırsınız. Boş bir ad veya zaten var olan bir ad kaydedilmez. Açık projenin kullandığı bir iş kategorisini kaldırırsanız, uygulama önce sorar. Projedeki kopya kalır. *Bu projeden* altındaki bir iş kategorisi, örneğin başka birinin dosyasından gelen bir kategori, yalnızca *İş kategorilerini yönetin…* içinde *İş kategorilerime ekleyin* düğmesine tıklarsanız kendi listenize girer.
- **Takvim** — takvim, görevin süresini, bitişini ve bolluğunu saydığı takvimdir. Varsayılan: *Proje takvimi: {name}*. Etkisi: kendi takvimi olan bir görev, proje takvimindekinden farklı günlerde çalışır. Bir değişiklikten sonra *Hesapla* tarihleri yeniden hesaplar. Bkz. [Takvimler ve iş günleri](docs://uitleg-kalenders).
- **Üst görev** (yalnızca pencerede) — görevi başka bir görevin altına taşır. Varsayılan: mevcut üst görev. *- Yok (kök) -* seçerseniz görev en üst düzeye gelir. İlişkilerde bir döngü oluşturacak bir seçim, *Kaydet* ile bir mesajla reddedilir ve pencere açık kalır.

## Notlar

- **Notlar** — göreve ait bir kontrol listesi. *Not ekle* yeni bir satır ekler. Onay işareti (*Bitti*) satırın üstünü çizer. Çöp kutusu (*Sil*) satırı siler. Satır yoksa *Henüz not yok* yazar. Hesaplamaya etkisi yoktur. Tablodaki *Notlar* sütunu notları önünde ✓ veya ○ ile gösterir.

## Kilometre taşı

- **Kilometre taşı** — görevi bir kilometre taşına çevirir. Varsayılan: kapalı. Etkisi: süre 0 olur. Uygulama bunu bir özet görev (alt görevleri olan görev) ve kaynak atamaları olan bir görev için reddeder, bir mesajla. Önce atamaları kaldırın. Bu seçimi yeniden kaldırırsanız *Kilometre taşı türü* ve *Zorunlu (sözleşmesel)* kaybolur.
- **Kilometre taşı türü** (yalnızca kilometre taşı için) — *Otomatik*, *Başlangıç kilometre taşı* veya *Bitiş kilometre taşı*. Varsayılan: *Otomatik*. Etkisi: başlangıç kilometre taşı günün başına, bitiş kilometre taşı günün sonuna yerleşir. *Otomatik* seçiliyken kilometre taşı bir öncül olduğunda başlangıç kilometre taşı sayılır ve günün başında durur.
- **Zorunlu (sözleşmesel)** (yalnızca kilometre taşı için) — sözleşmesel bir kilometre taşını işaretler, örneğin bir denetim veya teslim. Varsayılan: kapalı. Etkisi: Gantt ve raporlar için bir işarettir. Bir tarihi korumaz. Bunun için bir kısıtlama veya son tarih kullanırsınız.

## Zaman

- **Başlangıç** (pencerede *Başlangıç tarihi*) — hesaplanan başlangıcı gösterir. Bu, Gantt çubuğu ve *Başlangıç* sütunundaki tarihle aynıdır. Ham planlama çıpası değildir. Bir görev başladıysa, bu gerçek başlangıçtır ve alan salt okunurdur. Bu durumda *Gerçek başlangıç* alanını değiştirin. Aksi halde bu, hesaplanan başlangıçtır. Zorunlu: boş alan önceki değere döner. Tarih yazmanın etkisi: yeni tarih planlama çıpası olur (*Planlanan başlangıç* sütunu). Görevin bir öncülü varsa ve henüz başlamadıysa, uygulama yeni başlangıcı bu tarihte *Şu tarihten önce başlamaz (SNET)* kısıtlaması olarak kaydeder (veya var olan bir SNET'i taşır) ve bir mesaj gösterir. *Hesapla* sonrasında görev bu nedenle daha erken başlamaz. *ASAP* veya *SNET* dışında bir kısıtlama varsa, uygulama başlangıcı uygulamaz. Başlangıcı hangi kısıtlamanın belirlediğini de söyler.
- **Süre** — görevin ne kadar çalıştığı. Gün için `5d`, saat için `12h` veya `1h 30m` yazın (`u`, `hour` ve `hours` de çalışır). Birimsiz bir sayı, görevin biriminde sayılır. Günler her zaman tam sayıdır. Saatlerde ondalık sayı olabilir. Geçersiz bir giriş *2d veya 12h gibi tam gün ya da saat sayısı girin* mesajını verir ve alan geri döner. Yeni görev için varsayılan: 5 gün (kilometre taşı için 0). Alan şu durumlarda devre dışıdır: özet görev, hamak ve süresi 0 olan kilometre taşı. Bunların süresi başka görevlerden gelir veya sıfırdır. Saat cinsindeki bir görev, *Saat planlamasını etkinleştir* kapalıyken devre dışıdır. Bu adla bir düğme vardır. Etkisi: *Hesapla* sonrasında süre, bitiş tarihini görevin takviminde belirler. Görevin kaynakları ve bir görev türü varsa, görev türü işin mi yoksa birimin mi hareket edeceğine karar verir. Görev zaten kısmen tamamlandıysa, yapılan işten kısa bir süre girmek reddedilir. Bkz. [Gün ve saat](docs://uitleg-dagen-en-uren).
- **Süre birimi** — *Gün* veya *Saat* seçimi. Yanında bir bilgi düğmesi vardır. Yalnızca *Saat planlamasını etkinleştir* ve *Karma gün/saat planlamasına izin ver* açıkken görünür (ikincisi, saat planlaması açıkken varsayılan olarak açıktır). Etkisi: başka bir birim seçtiğinizde, sonuç tam çıkarsa uygulama süreyi hemen dönüştürür. *Geri al* bunu tek adımda geri alır. Tam uymazsa birim aynı kalır ve uygulama bunu söyler. Geçerli çalışma saati olmayan bir takvim, geçişi reddeder.
- **Görev türü** — süre × birimler = iş denkleminde, üçünden biri değiştiğinde hangi köşenin sabit kalacağını belirler. Seçenekler: *Proje varsayılanı (Sabit süre ve birimler)*, *Sabit süre ve birimler*, *Sabit süre ve iş*, *Sabit iş* ve *Sabit birimler*. Varsayılan: proje varsayılanı. Alanın yanındaki i simgesi, şu an geçerli olan görev türünü açıklar. Açılan listede her seçeneğin de böyle bir i simgesi vardır. MS Project'ten gelen bir görev için bu açıklama, kayıtlı efor odaklı ayarını dikkate alır. Yalnızca *Görev türlerini kullanın* açıkken (*Uygulama ayarları*, *Planlama* sekmesi, *Hesaplama* başlığı) veya dosya kendisi görev türü ya da kayıtlı iş taşıyorsa görünür. Ayrıca yalnızca sıradan bir görev için görünür: özet görev, kilometre taşı, hamak veya geçen süre cinsinden bir görev için değil. Bkz. [Görev türleri: süre, birimler ve iş](docs://uitleg-werkregels).

## Hamak

- **Hamak** (türetilmiş süre) — süreyi kendi süresi yerine iki başka görevden türetir. Varsayılan: kapalı. Yalnızca sıradan bir görev için. Kilometre taşı veya özet görev için değil. Açıksa: *Başlangıç driver'ı* bitiş-başlangıç veya başlangıç-başlangıç ilişkisi olan öncülleri gösterir. *Bitiş driver'ı* bitiş-bitiş veya başlangıç-bitiş ilişkisi olan öncülleri gösterir. Her öncülün yanında ilişki türü yazar. Bitiş driver'ınız yoksa uygulama şunu yazar: *Bitiş driver'ı yok (FF/SF) — aralık sıfır uzunluğa döner.* Süre bu durumda sıfır olur. Bkz. [Hamak yapmak](docs://howto-hammock).

## Kısıtlama ve son tarih

Bir özet görevde kısıtlamanın veya son tarihin etkisi yoktur. Hesaplama yalnızca uç görevleri hesaplar. Bir özet görevin tarihlerini alt görevlerinden türetir.

- **Kısıtlama** — görev için bir tarih sınırı. Seçenekler: *Mümkün olduğunca erken (ASAP)*, *Mümkün olduğunca geç (ALAP)*, *Şu tarihten önce başlamaz (SNET)*, *Şu tarihten sonra başlamaz (SNLT)*, *Şu tarihten önce bitmez (FNET)*, *Şu tarihten sonra bitmez (FNLT)*, *Şu tarihte başlamalı (MSO)* ve *Şu tarihte bitmeli (MFO)*. Varsayılan: *ASAP*. Bu bir kısıtlama değildir. *ASAP* seçerseniz görevin tüm kısıtlamaları kaybolur. *ALAP* seçerseniz ikincil kısıtlama kaybolur. *Hesapla* sonrası etki: bir sınır görevi taşır veya bolluğu negatif yapar. Bkz. [Kısıtlamalar ve son tarihler](docs://uitleg-constraints).
- **Kısıtlama tarihi** — kısıtlamaya ait tarih. Her kısıtlama için görünür, *ALAP* hariç. Zorunlu. Yeni bir kısıtlama, planlanan başlangıcı tarih olarak alır.
- **Zorunlu (sabitleme mantığı)** — yalnızca *MSO* ve *MFO* için. Varsayılan: kapalı. Açıksa tarih serttir. İlişkileri geçersiz kılar ve çubuğu öncüllerinden önce bile sabitler. İhlal, yukarı akışta negatif bolluk olur. Bunu ilk kez açtığınızda bir açıklama bir kez görünür.
- **İkincil kısıtlama** ve **İkincil tarih** — ikinci bir sınır. Yalnızca *SNET*, *FNET*, *SNLT* veya *FNLT* olabilir ya da *(yok)* seçilebilir. Birincil kısıtlama *ASAP*, *ALAP* veya sabit bir zorunlu tarih dışında bir şey olduğunda görünür. Her zaman yumuşaktır. Yasak bir kombinasyon kırmızı bir çerçeve ve bir neden gösterir. İkincil kısıtlama sabit olamaz. MSO/MFO veya sabit bir sabitlemeyle birlikte olamaz. ASAP/ALAP ile birlikte olamaz. Bir sınır olmalıdır. Birincil ve ikincil aynı tarafı sınırlayamaz. Geçerli bir çift örneğin SNET ile FNLT'dir.
- **Son tarih** — bitiş için bir hedef tarih. Boş = son tarih yok. Etkisi: görev bunun nedeniyle taşınmaz. Erken bitiş daha sonraysa bolluk negatif olur ve uygulama *Son tarih … kaçırıldı — erken bitiş …* yazar.

## İlerleme

- **İlerleme (%)** — 0 ile 100 arasında bir kaydırıcı. Varsayılan: 0. Etkisi: 0'dan büyükse uygulama eksik bir *Gerçek başlangıç* değerini doldurur. 100 ise *Gerçek bitiş* değerini doldurur. Durum buna uyar: gerçek başlangıç yoksa *Başlamadı*, gerçek başlangıç varsa *Devam ediyor* ve gerçek bitiş varsa *Tamamlandı*. Kalan süre (*Kalan*) süre × (1 − ilerleme) değeridir. Gün cinsindeki bir görevde tam güne, saat cinsindeki bir görevde tam dakikaya yuvarlanır. Yapılan iş durum tarihine kadar ölçülür. Durum tarihi yoksa uygulama bunu bugüne ayarlar ve bunu söyler. Özet görevde alan devre dışıdır. İlerlemesi *Hesapla* sonrasında alt görevlerinden gelir (*Alt görevlerden türetilir: ilerlemeyi orada değiştirin. Özet görev hesaplamadan (F5) sonra güncellenir*).
- **Gerçek başlangıç** — görevin gerçekten başladığı tarih. Durum tarihinden sonraki bir tarih reddedilir. Görev tablosunda ve *Gerçek başlangıcı girin* sorusunda, gerçek bitişten sonraki bir tarih de reddedilir. Görev yalnızca durum tarihinden sonra başlamak üzere planlanmışsa ve şimdi ilerleme alıyorsa, pencere *Gerçek başlangıcı girin* sorar. Kilometre taşında *Gerçek başlangıç* ve *Gerçek bitiş* yerine tek bir alan, *Gerçek tarih*, vardır.
- **Gerçek bitiş** — görevin gerçekten tamamlandığı tarih. Bunu doldurmak ilerlemeyi 100 yapar ve durumu *Tamamlandı* olarak ayarlar. Bunu silmek ilerlemeyi 0'a ve durumu *Devam ediyor* olarak geri alır. Durum tarihinden sonraki bir tarih reddedilir, *Gerçek başlangıç* gibi.
- **Kalan** — salt okunur (kilometre taşında yoktur). Görevin biriminde kalan süre.

Pencere bu kuralları taslağa uygular. Bunlar yalnızca *Kaydet* sonrasında geçerli olur. Bkz. [İlerleme, durum tarihi ve temel plan](docs://uitleg-voortgang).

## CPM-sonucu

- **CPM-sonucu** — son hesaplamanın salt okunur görünümü: *Erken başlangıç*, *Erken bitiş*, *Geç başlangıç*, *Geç bitiş*, *Toplam bolluk*, *Serbest bolluk*, *Engelleyici bolluk* ve *Kritik yol* (*Evet* veya *Hayır*). Bolluk iş günü cinsinden ve iki ondalık basamakla gösterilir. Güncel değil mi veya henüz hesaplanmadı mı? *Hesapla* düğmesine basın.

## İlişkiler

- **İlişkiler** — bu görevin ilişkileri. Her ilişki için bir satır vardır: bağlı görev (panelde WBS kodu, o yoksa ad; pencerede ad), belirleyici ilişkiyse bir şimşek simgesi (*Belirleyici ilişki (driving)*, bir hesaplamadan sonra), ilişki türü (*FS*, *SS*, *FF* veya *SF*), gecikme ve bir çöp kutusu. Panelde WBS kodu bir düğmedir. Üzerine gelirseniz görevi gösterir, tıklarsanız ona gidersiniz. Kodun önündeki küçük işaret rolü gösterir: öncül için altın renkli bir yuvarlak, ardıl için mor bir kare. Bu renkler [Bir yolu izlemek](docs://howto-pad-traceren) ile aynıdır. Rol ayrıca düğmenin adında da yer alır, ekran okuyucusu için. Pencerede bu düz metindir. Bölümü yalnızca görevin ilişkisi varsa görürsünüz.
- **Gecikme** — bir sayı ve bir birim yazın: `2d` iş günü, `3ed` takvim günü, `2u` veya `2h` çalışma saati, `3eu` veya `3eh` takvim saati, `50%` öncülün süresinin yüzdesi, `-25e%` takvim süresinde bir yüzde. Eksi işareti bunu bir öne almaya çevirir. Birimsiz bir giriş iş günü sayılır. Geçersiz bir giriş alanı kırmızı yapar ve geri döner. Bkz. [İlişkiler ve gecikme](docs://uitleg-relaties).
- **İlişki ekle** (yalnızca panelde) — taslak bir satır açar. Altında *Yön* seçin: *Öncül* veya *Ardıl*. *Görev ara*… ile WBS kodu veya ada göre görevi bulun. Türü ve gecikmeyi seçin ve *İlişkiyi oluştur* ile onaylayın (ya da *İptal*). Yinelenen bir ilişki veya görevin kendi üst görevi ile bir ilişki, bir mesajla reddedilir ve satır açık kalır.

## Kesintiler

Yalnızca panelde görünür. Kilometre taşı, özet görev, hamak, geçen süre ile ölçülen görev ve elle planlanan görev için görünmez. Kesinti için çok kısa olan görevlerde de görünmez.

- **Kesintiler** — görev içinde iş yapılmayan dönemler. Her kesinti için bir satır: *sonra* (kesintiden önce ne kadar iş yapılır), *ara* (uzunluğu) ve birim (*iş günü*; saatle ölçülen bir görev için *saat*). Altta, kesintiden sonraki parçanın başlangıç–bitişi yer alır. Dengeleme ile eklenen bir kesinti *dengeleme* rozetini taşır. Uzunluğu 0 olan bir kesinti kaldırılır. Satırdaki çöp kutusu simgesi (*Kesintiyi kaldır*) de kesintiyi kaldırır. Etkisi: çubuk kesintili çizilir ve *Hesapla* çalıştırıldıktan sonra bitiş, kesinti kadar kayar.
- **Kesinti ekle** — en uzun parçanın ortasına bir birim uzunluğunda kesinti ekler. Kesinti için yer yoksa bu düğme devre dışıdır.
- **Tüm kesintileri kaldır** — kesintiler kaynak dosyadan burada düzenlenemeyen bir biçimde geliyorsa görünür (*Bu kesintiler kaynak dosyadan burada düzenlenemeyen bir biçimde geliyor*). Bu durumda yalnızca tarihleri görürsünüz.

Bkz. [Bir görevi bölme](docs://howto-taak-splitsen).

## Atamalar

- **Atamalar** — bu görevdeki kaynaklar. Her kaynak bir satırdadır: bir ok, kaynak renginde küçük bir kare, ad, *Birim*, *İş (sa)* ve bir çöp kutusu (*Kaldır*). Satırların üstündeki başlık sütunların adını gösterir. Adına tıklayarak *Eğri*, altındaki *Saat dağılımı…* düğmesini ve *Taşı…* seçeneğini gösterin. Tekrar tıklayarak bunları gizleyin. Atamanın *Tekdüze* dışında bir eğrisi veya kendi saat dağılımı varsa, adın yanında bir çubuk simgesi görünür; satır daraltılmış olsa bile. Listenin altında *Kaynak ata* bulunur; bu liste kaynağı günde 1 birimle atar. Kaynak yoksa *Önce kaynak oluşturun (Kaynaklar sekmesi)* yazısı görünür. Tüm kaynaklar atanmışsa *Tüm kaynaklar zaten atanmış* yazısı görünür. Kilometre taşı veya özet görev için atamanın mümkün olmadığı yazılır.
- **Birim** — görevin kaynaktan günde ne kadar kullandığı; 0'dan büyük bir sayı. Alan en fazla iki ondalık gösterir; tam değer ipucundadır. Virgül veya nokta yazabilirsiniz. Etkisi: histogramdaki yük ve aşırı atanmışlık ve bir görev türü ile birlikte iş. Atama Primavera P6'dan (`.xer` veya P6 XML) geliyorsa ve iş kalmışsa, bu kalan orandır (P6'da *Kalan birim/zaman*). Planlanan oran, tablo sütunu *Günlük planlanmış birim* içinde saklı kalır.
- **İş (sa)** — bu kaynak için saat cinsinden kalan iş. Yalnızca görev türleri görünürse ve görevin bir görev türü varsa görünür. Malzeme için bir çizgi (–) görünür. Başlıktaki kilit, görev türünün hangi köşeyi koruduğunu gösterir (*Görev türü tarafından korunuyor …*). Alandaki uyarı üçgeni (*Birim × süreden farklı*), kayıtlı işin birim × kalan süreye eşit olmadığı anlamına gelir. Histogram o zaman kayıtlı işi izler.
- **Eğri** — işin süre boyunca nasıl yayıldığı: *Tekdüze*, *Başta yüklü*, *Sonda yüklü*, *Çan eğrisi*, *Erken zirve*, *Geç zirve*, *Çift zirve* veya *Kaplumbağa*. Varsayılan: *Tekdüze*. Atamanın kendi saat dağılımı varsa *Kontur* yazar ve liste devre dışıdır. İçe aktarılan bir eğri *İçe aktarılan eğri* olarak adlandırılır.
- **Saat dağılımı…** — bu atamanın iş günü başına saat dağılımını açar. Bkz. [Saat dağılımını ayarlama](docs://howto-urenverdeling-aanpassen).
- **Taşı…** — atamayı, kaynağı henüz bulunmayan başka bir yaprak göreve taşır. Yalnızca böyle bir görev varsa görünür.

## Kodlar ve alanlar

- **Kodlar ve alanlar** — yalnızca projede etkinlik kodu veya özel alan varsa görünür. Her etkinlik kodu, *(yok)* ve değerleri `kod — açıklama` biçiminde içeren bir listedir. Her türde en fazla bir değer seçersiniz. Her özel alanın türüne uygun bir girişi vardır: *Metin*, *Sayı*, *Tam sayı*, *Maliyet*, *Tarih* veya *Evet/hayır*. Etkisi: hesaplamaya etkisi yoktur. Bunlara göre gruplayabilir ve filtreleyebilirsiniz; sütun olarak da gösterebilirsiniz. Bkz. [Kodlar ve özel alanlar](docs://howto-codes-en-velden).

## Görev türünün altındaki işaretçiler

Yalnızca panelde ve yalnızca ilgili olduklarında görünür.

- **Uzun çalışılmayan dönem** — *Bu görev, … günlük çalışmaya kapalı bir dönemi kapsıyor (… - …)*, veya tatilin ya da inşaat tatilinin adı eklenmiş hâlde. Görev, en az bir tatil içeren, kesintisiz 8 gün veya daha uzun bir dönemi kapsıyorsa görünür. Bu bir uyarıdır, engel değildir. Planlamanın bu şekilde amaçlanıp amaçlanmadığını kontrol edin.
- **MS Project işaretçisi** — bir blok: *MS Project'ten gelen saat dağılımını izliyor*, *Düzenlemeden sonra MS Project tarih penceresi artık uygulanmıyor — …* veya *Özel saat dağılımı*, yanında *Daha fazla bilgi*. Bir MS Project dosyasındaki saat dağılımının hâlâ tarihleri belirleyip belirlemediğini gösterir.
- **Kayıtlı tarihler** — bir blok, *Zaman* başlığının hemen altında, *Başlangıç* satırının üstünde; uygulama tarihleri dosyadan gösterdiği sürece. Turuncu: *Dosyada yer alan tarihleri görürsünüz, uygulamanın hesabını değil.* (Primavera dosyası için *Primavera'nın kaydettiği tarihleri görürsünüz, uygulamanın hesabını değil.*), altında *Yeniden hesaplamada bu görev değişir.* veya *Yeniden hesaplamada bu görev aynı kalır.* Dosya bu görev için her şeyi içermiyorsa üçüncü bir satır gelir ve eksik değerleri gösterir: *Dosya bu görev için her şeyi içermiyor. Eksik: …* (Primavera için *Primavera bu görev için her şeyi kaydetmedi. Eksik: …*). Blok turuncu kalır. *Daha fazla bilgi* ile birlikte. Bkz. [Kayıtlı tarihler](docs://uitleg-datums-zoals-opgeslagen).

## Panelin üstü ve altı

- **Görevi sil** — başlık *Görev* yanındaki çöp kutusu simgesi. Bu, görevi alt görevleriyle birlikte siler. Bu tek bir adım olarak yapılır ve *Geri al* ile geri alınabilir. Bundan sonra planlama güncel değildir, *Hesapla* düğmesine basana kadar.
- **Hesapla** — alttaki düğme; *Ana sayfa › Zamanlama › Hesapla* ile aynı hesaplama.

## Burada bulamayacağınız şeyler

- **Dengeleme önceliği** — pencerede veya panelde yer almaz. Sağ tıklayıp *Öncelik* öğesini seçerek ayarlarsınız (*Düşük* = 100, *Normal* = 500, *Yüksek* = 900). Ayrıca *Dengeleme önceliği* sütununa 0 ile 1000 arasında bir sayı yazabilirsiniz. Varsayılan: 500. Etkisi: dengeleme, önce daha yüksek önceliğe sahip görevleri yerinde tutar. 1000 görevi sabitler; dengeleme onu hiçbir zaman taşımaz. Bkz. [Dengeleme](docs://uitleg-nivelleren).
- **Diğer görev verileri** — bir görevin taşıdığı diğer veriler, örneğin *Elle planlandı* ve *Renk* sütunları ile teknik sütunlar, yalnızca tabloda bulunur. Bkz. [Tablo sütunları](docs://ref-tabelkolommen).
