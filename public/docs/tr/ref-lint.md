# Şerit, sekme sekme

Ekranın üstündeki şeritte sekmeler vardır. Her sekmede düğme grupları vardır. Bu makale her düğmenin ne yaptığını ve sonucu nerede gördüğünüzü açıklar. Bir işi adım adım nasıl yapacağınız, nasıl yapılır kılavuzlarında yer alır. Bu makalede bir düğmenin ne olduğunu bulursunuz. Bir koşula bağlı olarak var olan veya çalışan bir düğmenin yanında bu koşul yazar.

## Şerit nasıl davranır

- **Sekmeler** — *Dosya* solda yer alır. Ardından *Ana sayfa*, *Planlama*, *Kaynaklar*, *Görünüm*, *Ayarlar*, *Tablo*, *IFC* ve *Rapor* gelir. Yalnızca yapay zeka modu açıkken *Yapay Zeka* da görünür.
- **Dar pencere** — Şerit sığmazsa düğmeler sağdan sola doğru bir simgeye küçülür. Bu durumda düğmenin adı ipucu olarak görünür. Kendi ipucu olmayan her düğme adını gösterir.
- **Şeridi daralt** — Şeridin sağ altındaki küçük ok, şeridi yalnızca simgelerden oluşan düz bir şeride çevirir. Yapay Zeka sekmesindeki *Temel plan ve ilerleme* grubu ile *Bağlantı* grubu, o zaman tek bir açılır pencereli düğmenin arkasında kaybolur. Varsayılan: genişletilmiş. Seçiminiz hatırlanır.
- **Uzantı düğmeleri** — Bir uzantı, bir sekmenin sonuna kendi grubunu ekleyebilir. Böyle bir düğme, uzantının ona verdiği işlevi yerine getirir.

## Dosya

*Dosya* öğesini tıklarsanız kendi ekranı (Backstage) çalışma alanını kaplar. Bu ekranda şerit yoktur. *Geri* ekranı kapatır. *Proje ayarları* altında bir şeyi değiştirdiyseniz ve *Uygula* demediyseniz, uygulama önce ne yapılacağını sorar.

- **Yeni** — *Yeni proje* penceresini açar ve Backstage'i kapatır. Alanlar [Yeni proje ve Proje bilgisi](docs://ref-projectinfo) sayfasında yer alır.
- **Aç** — Bir dosya seçer ve dosyayı belge olarak açar. Backstage'i kapatır.
- **Son açılanlar** — Yakın zamanda açılmış projelerin bir listesi. Bir tıklama projeyi açar. Yalnızca ortam dosyaları yeniden açabildiğinde görünür: masaüstü uygulamasında ve Chrome ile Edge gibi dosya erişimi sunan tarayıcılarda. Diğer tarayıcılarda düğme vardır, ama sayfa boş kalır.
- **Örnekler** — Uygulamayla gelen örnek planlar. Bunlar *Tam kapsamlı örnek planlar* (rozet *Tüm özellikler*) ve *Basit örnekler* olarak ayrılmıştır. Bir tıklama birini yeni bir sekmede açar.
- **Kaydet** — Projeyi bu belgenin dosyasına yazar. Belgenin henüz bir dosyası yoksa, önce bir ad ve yer seçersiniz. IFC dışındaki bir biçimde açtığınız dosyanın üzerine hiçbir zaman yazılmaz. Bu durumda *Kaydet* bir IFC dosyası için ad ve yer ister.
- **Farklı kaydet** — Yeni bir ad veya yer seçer ve oraya IFC olarak kaydeder.
- **Dışa aktar** — Her dışa aktarma biçimi için açıklamalı bir kart. Bir tıklama projeyi dönüştürür ve kaydeder, ardından sizi *Ana sayfa* sekmesine geri götürür. Planlamada bir döngü varsa, hata Backstage'de görünür ve siz orada kalırsınız. Proje bir kaynak kitaplığına bağlıysa, altta *Kitaplık dosyasını da kaydet* onay kutusu görünür; bu yalnızca IFC kartında çalışır.
- **İçe aktar** — Üstte *Bir tablodan ilerlemeyi güncelle* kartı yer alır (görev yoksa devre dışıdır). Altında uzantıların eklediği içe aktarıcılar yer alır.
- **Yazdır** — *Baskı önizlemeyi aç* düğmesi sizi *Rapor* sekmesine götürür.
- **Proje ayarları** — Bu projenin meta verileri ve hesaplama profili. Değişiklikler yalnızca *Uygula* düğmesinden sonra etkili olur. Bkz. [Yeni proje ve Proje bilgisi](docs://ref-projectinfo) ve [Hesaplama profilleri ve kurallar](docs://uitleg-rekenprofielen).
- **Ayarlar** — *Uygulama ayarları* penceresiyle aynı ayarlar.
- **Uzantılar** — Uzantıların yönetimi ve kurulumu; bkz. [Bir uzantıyı kurma ve yönetme](docs://howto-extensie-installeren).
- **Kaynak kitaplığı** — Kaynak kitaplıklarının yönetimi; bkz. [Kaynak kitaplıklarını yönetme ve paylaşma](docs://howto-bibliotheken-beheren).
- **Yardım** — Uygulamanın yerleşik belgeleri; F1 ile de açılır. Arama alanı başlıkları, alt başlıkları ve metnin kendisini arar. Makaleler dört bölümde yer alır: *Eğitimler*, *Nasıl yapılır*, *Açıklamalar* ve *Referans*. *Belge dili* altında *Uygulama dilini takip et* seçersiniz ya da listeden bir dil seçersiniz. Hollandaca ve İngilizce kaynak dillerdir; diğer dillerde yalnızca çevrilmiş makaleler vardır. Bir makale sizin dilinizde yoksa, bir bildirimle birlikte İngilizce sürümünü okursunuz. Bu seçim bu cihazda saklanır ve uygulamanın dilinden ayrıdır. Birçok pencerede ve *Özellikler*, *Kaynaklar* ve *Uyarılar* panellerinde sağ üstte bir soru işareti vardır (*Bu konuyla ilgili yardım*). Bu, o pencere veya panel hakkındaki makaleyi açar. Pencerede henüz kaydedilmemiş bir şey girdiyseniz, uygulama önce *Kaydet*, *İptal* (girdiğiniz şeyi atar) veya *Geri* (pencerede kalır) sorar. Sonra pencere kapanır ve Yardım açılır. Bazı pencereler, örneğin *Görevi düzenle* ve *Kaynakları dengele*, her zaman sorar. Giriş yoksa Yardım hemen açılır.
- **Turu başlat** — Backstage'i kapatır ve turu 1. adımda başlatır.
- **Projeyi kapat** — Etkin belgeyi kapatır. Kaydedilmemiş değişiklikleri varsa, uygulama onay ister.

## Ana sayfa

### Ana sayfa › Dosya

- **Yeni**, **Kaydet**, **Aç** ve **Farklı kaydet** — *Dosya* sekmesindekiyle aynı işlemler.
- **Son açılanlar** — Son projelerin açılır listesi; bir tıklama birini açar. Yalnızca *Dosya › Son açılanlar* ile aynı koşulda görünür. Son açılan dosya yoksa *Son açılan dosya yok* yazar.
- **Dışa aktar** — Dışa aktarma biçimlerinin (kısa adlarıyla) açılır listesi. Bir tıklama projeyi dönüştürür ve kaydeder.

### Ana sayfa › Düzenle

- **Geri al** — Son değişikliği geri alır. Geri alınacak bir şey yoksa devre dışıdır.
- **Yinele** — Son geri alınan değişikliği yeniden uygular. Yinelenecek bir şey yoksa devre dışıdır.
- **Sil** — Seçili görevleri, alt görevleriyle birlikte tek adımda siler. Seçim yoksa devre dışıdır.

### Ana sayfa › Görevler

- **Görev** — *Yeni görev* adında bir görev ekler; süresi 5 iş günüdür ve proje başlangıcında başlar. (*Saat planlamasını etkinleştir* açıksa ve *Proje ayarları* altındaki *Yeni görevler için varsayılan birim* saat ise süre 5 saattir.) Bir görev seçiliyse ve görünüm düz bir ağaçsa, yeni görev seçili en alt görevin hemen altına gelir (ipucu: *Yeni görev, seçimin hemen altına eklenir*). Seçim yoksa en alta eklenir (ipucu: *Yeni görev listenin sonuna eklenir*). Seçim varken filtreleme, gruplama veya sıralama yapılıyorsa, yeni görev yine en alta eklenir. Kırmızı bir bildirim, uygulamanın yeni görevi seçiminizin altına koyamadığını söyler; bildirimde *Temizle* düğmesi vardır. Yeni görev tek seçim olur, Gantt oraya atlar ve adı *Özellikler* panelinde üzerine yazılmaya hazırdır.
- **Kilometre taşı ▾** — Bir kilometre taşı (süresi 0) ekleyen açılır liste; yeri *Görev* ile aynıdır. *Başlangıç kilometre taşı* ve *Bitiş kilometre taşı* kilometre taşının türünü belirler. Yeni kilometre taşı *Yeni kilometre taşı* adını alır ve iş kategorisi *Diğer* olur. *Denetim noktası (zorunlu)* bir bitiş kilometre taşı oluşturur; iş kategorisi *Denetim* olur ve *Zorunlu (sözleşmesel)* işaretini alır. Adı *Yeni denetim noktası* olur.
- **Bağla ▾** — Dört sabit işlemi olan açılır liste. Ana düğmenin anlamı hiç değişmez. Dört işlem için bkz. *Planlama › İlişkiler*.
- **Görevi böl** — Bölme modunu açar veya kapatır. Açıkken şeridin altında bir bilgi satırı, bölmenin başlayacağı çubuğa tıklayıp uzunluğu kadar sağa sürüklemeniz gerektiğini açıklar. Gantt görünmüyorsa devre dışıdır (*Tablo*, *IFC* ve *Rapor* sekmelerinde ve tam kaynak paneli altında). İpucu o zaman *Yalnızca Gantt şeması görünürken kullanılabilir* yazar. Bkz. [Bir görevi bölme](docs://howto-taak-splitsen).

### Ana sayfa › Planlama

- **Hesapla** — Planlamayı hesaplar: tarihler, bolluk, kritik yol ve kaynak yükü. Bu kendiliğinden olmaz. Yalnızca *Otomatik hesapla* açıksa olur (*Uygulama ayarları*, *Planlama* sekmesi, *Hesaplama* başlığı). Planlama güncel değilken durum çubuğu *Güncel değil — yeniden hesaplayın (F5)* yazar.

### Ana sayfa › Yakınlaştırma

- **Yakınlaştır +** — Zaman eksenini gün başına 10 piksel yakınlaştırır.
- **Uzaklaştır -** — Zaman eksenini gün başına 10 piksel uzaklaştırır.

## Planlama

### Planlama › Planlama

*Hesapla* düğmesi, *Ana sayfa* sekmesindekiyle aynıdır.

- **Projeyi taşı…** — *Projeyi taşı* penceresini açar. Proje başlangıcı yoksa devre dışıdır. Bkz. [Bir projeyi taşıma](docs://howto-project-verplaatsen).
- **Uyarılar** — Sağdaki sütundaki *Uyarılar* panelini gösterir veya gizler. Panel görünürken düğme vurgulanır. Açmak, daraltılmış bir sütunu genişletir. Panelin içeriği [Bildirimler ve uyarılar](docs://ref-meldingen) sayfasında açıklanır.

### Planlama › İlişkiler

Bu grupta *Bağla ▾* düğmesi (dört işlemle) ve *Görevi böl* düğmesi vardır (*Ana sayfa* sekmesiyle aynı). Dört işlem:

- **İlişki çiz** — Bağlama modunu açar veya kapatır. Açıkken onay işareti görünür ve ana düğme vurgulanır. Bir ilişki oluşturmak için Gantt'ta bir çubuktan diğerine sürüklersiniz. Şeridin altındaki bir bilgi satırı, nasıl durdurabileceğinizi açıklar (*Durdur* veya Esc). Gantt görünmüyorsa devre dışıdır.
- **Seçili görevleri bağla** — İki görev arasında gecikmesiz bir bitiş-başlangıç ilişkisi oluşturur; önce seçilen görev öncül olur. Yalnızca tam olarak iki görev seçiliyken kullanılabilir (aksi halde *Tam olarak iki görev seçin*). Yinelenen bir ilişki veya bir döngü, bir mesajla reddedilir.
- **Dış ilişki ekle…** — Seçili göreve dış bir öncül veya ardıl eklemek için bir pencere açar. Yalnızca tam olarak bir görev seçiliyken kullanılabilir (aksi halde *Tam olarak bir görev seçin*).
- **Tüm dış ilişkileri yenile** — Tüm dış ilişkilerin bağlantı noktalarını yeniler ve menüde kaç tanesinin güncellendiğini veya eksik olduğunu bildirir. Yalnızca projede dış ilişki varsa kullanılabilir (aksi halde *Bu projede dış ilişki yok*).

İlişkilerin neden böyle olduğunu öğrenmek için bkz. [İlişki oluşturma](docs://howto-relaties-leggen) ve [İlişkiler ve gecikme](docs://uitleg-relaties).

### Planlama › Yol izleme

- **Öncüller** — Gantt'ta seçili görevlerin öncüllerini zincir zincir vurgular.
- **Ardıllar** — Seçili görevlerin ardıllarını vurgular.

Bu iki seçeneği aynı anda açabilirsiniz; bir düğmeye ikinci kez tıklamak o yönü yeniden kapatır. Belirleyici ilişkiler daha güçlü bir tonla vurgulanır. Bkz. [Bir yolu izleme](docs://howto-pad-traceren).

### Planlama › Takvim

- **Takvim** — *Takvimler* penceresini açar; bu pencerede projenin takvim kitaplığı yer alır. Bkz. [Takvim pencereleri](docs://ref-kalenders).

### Planlama › Yapı

- **Kodlar ve alanlar** — *Kodlar ve alanlar* penceresini açar; etkinlik kodları ve özel alanlar için. Bkz. [Kodlar ve özel alanlar](docs://howto-codes-en-velden).
- **WBS auto** — WBS kodlarının otomatik numaralandırmasını açar veya kapatır. Varsayılan: yeni bir projede açık. Ayar olmayan bir dosya açtığınızda: açık, dosya boşsa veya kodlar ağacın numaralandırmasıyla zaten eşleşiyorsa; aksi halde kapalı. Açıkken tüm ağaç bir seferde yeniden numaralanır, kodlar her yapı değişikliğini izler ve paneldeki ve iletişim kutusundaki *WBS Kodu* alanı devre dışı kalır.
- **WBS'yi yeniden numaralandır** — WBS kodlarını ağaçtaki konuma göre bir kez yeniden numaralandırır (1.2.3). *WBS auto* açıkken devre dışıdır.
- **Şablonlar** — Kaydedilmiş WBS şablonlarının açılır listesi; her şablonda görev ve ilişki sayısı yazar. Bir tıklama şablonu seçili görevin altına ekler; seçim yoksa en üst düzeye ekler. Çöp kutusu simgesi bir şablonu siler. Şablon yoksa, bunun nasıl kaydedileceğini yazar (bir özet göreve sağ tıklayın, *Dalı şablon olarak kaydet*). Bkz. [WBS şablonlarını kaydetme ve ekleme](docs://howto-wbs-sjablonen).
- **Girintile** — Seçili görevleri, önlerindeki görevin alt görevi yapar. Seçim yoksa ve filtreleme, gruplama veya sıralama yaptığınız anda devre dışıdır; ipucu o zaman *Filtreleme/gruplama/sıralama sırasında kullanılamaz* yazar.
- **Girintiyi azalt** — Seçili görevleri bir düzey yukarı taşır; doğrudan şu anki üst görevlerinin arkasına. Aynı koşullar *Girintile* için de geçerlidir.

### Planlama › Temel plan ve ilerleme

- **Temel planları yönet…** — Temel plan penceresini açar. Bkz. [Temel plan kaydetme ve yönetme](docs://howto-baseline-opslaan-en-beheren).
- **Durum tarihi** — İlerlemeyi ölçtüğünüz tarih. Bir tarih yazın; çarpı (*Durum tarihini temizle*) bunu kaldırır. Proje takviminde çalışma saati bantları varsa, uygulama saat cinsinden hesaplar ve tarihin yanında bir saat alanı görünür (MS Project genellikle 17:00 saklar). Saat dikkate alınır: 17:00 yerine 12:00 girilirse kalan işte yarım gün fark çıkar. Çalışma saati bantları yoksa uygulama tam günlerle hesaplar ve saat alanı yoktur. Sonuç: ilerleme bu tarihe kadar ölçülür; Gantt'taki durum tarihi çizgisi ile ilerleme çizgisi bu tarihte yer alır. Bkz. [İlerleme, durum tarihi ve temel plan](docs://uitleg-voortgang).
- **İlerleme modu** — *Retained Logic* ile *Progress Override* arasında bir seçim. Varsayılan: *Retained Logic*. Sonuç: *Retained Logic* ile başlamış bir ardılın kalan işi ilişkiyi izler. *Progress Override* ile kalan iş, öncülü beklemeden durum tarihinde başlar. Bkz. [İlerleme modunu seçme](docs://howto-voortgangsmodus-kiezen).

Daraltılmış şeritte bu üç düğme, *Temel plan ve ilerleme* başlıklı tek bir bayrak düğmesinin arkasında yer alır.

### Planlama › İlerleme

- **İlerleme sayfasını dışa aktar** — Görevleri içeren bir `.xlsx` sayfası oluşturur; uygulama dışında ilerlemeyi doldurmak için. Görev yoksa devre dışıdır.
- **Bir tablodan ilerlemeyi güncelle** — Geri gelen bir sayfa için içe aktarma penceresini açar. Görev yoksa devre dışıdır. Bkz. [Bir tablodan ilerleme içe aktarma](docs://howto-voortgang-importeren).

Bu grup *Tablo* ve *Rapor* sekmelerinde de vardır.

## Kaynaklar

### Kaynaklar › Yönetim

- **Kaynaklar** — Tam kaynak panelini açar; bu panel çalışma alanını kaplar. Bu paneli görürken düğme vurgulanır. Bkz. [Kaynak paneli](docs://ref-resourcepaneel).
- **Kaynak dok'u** — Kompakt kaynak panelini Gantt'ın yanındaki sağ sütuna yerleştirir. Dok görünürken düğme vurgulanır; ikinci bir tıklama onu kapatır. Dokta yalnızca ad, renk, aşırı yüklenme uyarısı ve *Maks. birim* gösterilir. Bir görev seçiliyse yalnızca o görevlerin kaynakları gösterilir.
- **Yeni kaynak** — Tam kaynak panelini, yeni bir kaynak için boş bir taslak satırıyla açar. Bir ad girene kadar hiçbir şey oluşturulmaz. Başka yere tıklarsanız geriye hiçbir şey kalmaz. Kaynak, görünüme bağlı olarak kaynak kitaplığına veya projeye eklenir.

### Kaynaklar › Atama

- **Ata ▾** — Seçili göreve bir kaynak atar. Yalnızca tam olarak bir görev seçiliyken kullanılabilir; bu görev alt görevi olmayan bir görev olmalı ve kilometre taşı olmamalıdır. Aksi halde düğme gri görünür. Menüde önce *Birim/gün* (varsayılan 1) ve *Eğri* (varsayılan *Tekdüze*) ayarlarsınız. Bir kaynağa tıklamak onu bu değerlerle atar. Menü yalnızca görevde henüz olmayan kaynakları listeler. Bkz. [Bir eğriyle kaynak atama](docs://howto-resource-toewijzen).

### Kaynaklar › Histogram

- **Histogram** — Gantt'ın altındaki histogram bilgi satırını gösterir veya gizler. Varsayılan: kapalı. Seçiminiz hatırlanır.
- **Önceki** ve **Sonraki** — Histogram bilgi satırındaki seçicide kaynaklar arasında adım adım ilerler. Gezinme sırasında ek bir adım olarak *Tüm kaynaklar* da vardır. Histogram kapalıysa veya projede kaynak yoksa devre dışıdır.

### Kaynaklar › Dengeleme

- **Dengele…** — *Kaynakları dengele* penceresini açar. Bkz. [Dengeleme](docs://uitleg-nivelleren).
- **Dengelemeyi temizle** — Dengelemenin uyguladığı ertelemeleri ve bölünmeleri kaldırır. Hiçbir görevin dengeleme sonucu yoksa devre dışıdır.

### Kaynaklar › Aşırı atanmışlık

- **Aşırı atanmışlık** — Bir düğme değil, bir sayaçtır: en az bir aşırı yüklü günü olan kaynakların sayısı veya *Yok*. Bir tane bile varsa kırmızı olur ve bir uyarı simgesi gösterir. Sayı, *Hesapla* komutundan sonra ve kaynaklar ile atamalar değiştikçe yenilenir. Görevlerin tarihlerini değiştirirseniz, bu yalnızca *Hesapla* komutundan sonra sayılır.

## Görünüm

### Görünüm › Zaman ölçeği

- **Yakınlaştır +** ve **Yakınlaştır -** — zaman eksenini günde 10 piksel yakınlaştırır veya uzaklaştırır.
- **Sıfırla** — yakınlaştırmayı varsayılan değere, günde 30 piksele geri ayarlar.
- **Projeye sığdır** — yakınlaştırır ve kaydırır, böylece tüm proje görünüme sığar.
- **Ölçek seçimi** — içinde *Yıl*, *Çeyrek*, *Ay*, *Hafta*, *Gün* bulunan bir liste ve yalnızca *Saat planlamasını etkinleştir* açık olduğunda *Saat*. Bir seçim sabit bir yakınlaştırma ayarlar. Gösterilen değer geçerli yakınlaştırmayı izler; altında bu yakınlaştırma günde piksel olarak gösterilir.

### Görünüm › Görüntüleme

- **Sütunlar…**, **Filtre…**, **Grupla…** ve **Sırala…** — yalnızca *Klasik görünüm düğmelerini göster* açık olduğunda görünür (*Uygulama ayarları*, sekme *Gelişmiş*, başlık *Eski özellikler*). Varsayılan: kapalı. *Sütunlar*… sizi *Tablo* sekmesine götürür ve sütun seçiciyi orada açar. *Filtre*… kayıtlı filtre yoksa hemen filtre penceresini açar. Kayıtlı filtreler varsa bir menü açılır; bu menüde *Filtre*…, *Temizle* (yalnızca bir filtre etkinken) ve kayıtlı filtreler bulunur. *Grupla*… en fazla iki düzeye izin verir. *Sırala*… daha fazla düzeye izin verir. Bir düğme, ilgili görünüm ayarı etkin olduğunda yanar. Geçerli şeritte bunu düzen düğmeleriyle yaparsınız; bkz. [Düzen oluşturma ve kullanma](docs://howto-layouts-gebruiken).

### Görünüm › Ana hat

- **Daralt** — seçili özet görevleri daraltır; seçim yoksa hepsini daraltır. Gruplanmış bir görünümde tüm grupları daraltır; seçimin etkisi yoktur.
- **Genişlet** — tersi.

### Görünüm › Düzen

- **Düzen düğmeleri** — her düzen, bir simge ve bir adı olan bir anahtardır. *Kaynak diyagramı* da dahildir. Bir tık düzeni açar. Bir tık daha onu kapatır ve tıklamadan önceki görünümü geri getirir. Farklı bölümleri olan düzenler birlikte açık olabilir. Bir düzene sağ tıklayın: *Düzenle*…, *Çoğalt* ve *Sil* (onaydan sonra). Dahil olan bir düzen yalnızca çoğaltılabilir.
- **Yeni düzen** — yeni bir düzen için düzen penceresini açar.

### Görünüm › Sunum

- **Sunum** — sunum modunu açar veya kapatır (durdurmak için Esc; masaüstü uygulamasında ayrıca F11): yalnızca Gantt ekranın tamamını doldurur. Bkz. [Büyük ekranda sunmak](docs://howto-presentatie).
- **Bölünmüş görünüm** — Gantt'ı iki zaman penceresine böler. İkisi de geçerli yakınlaştırma ve konumunuzla başlar (yüzde 50 bölünme). Ya da onu yeniden tek pencereye döndürür. Varsayılan: kapalı. Bkz. [Bölünmüş görünümü ve mini haritayı kullanma](docs://howto-split-view-en-mini-map).
- **Mini harita** — mini haritayı gösterir veya gizler. Varsayılan: kapalı. Seçiminiz hatırlanır.

### Görünüm › Paneller

- **Özellikler** — sağ sütundaki *Özellikler* panelini gösterir veya gizler. Varsayılan: açık. Bkz. [Görev penceresi ve özellikler paneli](docs://ref-taak-eigenschappen).

*Kaynaklar*, *Kaynak doku* ve *Histogram* düğmeleri *Kaynaklar* üzerindekilerle aynıdır; *Uyarılar* düğmesi de *Planlama* üzerindekiyle aynıdır.

**Sağ sütun.** Gantt'ın sağındaki sütun, *Özellikler*, *Kaynak doku* veya *Uyarılar* panellerinden en az biri açık olduğu anda görünür. Hiçbiri açık değilse sütun yoktur. Tam bir panel çalışma alanını kaplarsa, örneğin tam kaynak paneli, sütun kaybolur. Yalnızca *Tablo* sekmesinde kalır.

- **Genişlik** — çalışma alanı ile sütun arasındaki ayırıcıyı sürükleyin. Tek bir genişlik, sütundaki tüm paneller için geçerlidir.
- **Bölme** — iki panel açıksa, aralarındaki kenarlığı sürükleyin. Bir panel açıksa, o panel sütunun tamamını doldurur.
- **Daralt** — üstbilgideki *Yan sütunu daralt* düğmesi sütunu gizler. Üzerinde *Yan sütunu genişlet* düğmesi bulunan dar bir alan, sütunu önceki panellerle birlikte geri getirir.
- **Kapat** — her panelin başlığında bir çarpı vardır. Bu, şeritteki düğmeyle aynı anahtardır.
- **Tam panel** — kaynak doku içinde *Tam panel* düğmesi tam kaynak panelini açar.

### Görünüm › Temel planlar ve ilerleme

Bu grubun adı *Planlama* üzerindeki grupla aynıdır, ama Gantt'ın çizim seçeneklerini içerir.

- **Temel plan kaplaması** — etkin temel planı her görev çubuğunun altında ince bir çubuk olarak gösterir. Varsayılan: açık. Etkin bir temel plan yoksa görülecek bir şey yoktur.
- **İlerleme çizgisi** — durum tarihinde bir çizgi çizer; bu çizgi her görev için ilerlemesine göre dışa doğru kabarır. Varsayılan: açık. Durum tarihi yoksa görülecek bir şey yoktur. İlerleme çizgisi açık olduğunda bu çizgi aynı zamanda durum tarihinin işaretidir.
- **Durum tarihi çizgisi** — durum tarihinde kesikli bir çizgi çizer. Varsayılan: açık. Bu çizgiyi yalnızca ilerleme çizgisi kapalıyken görürsünüz; aksi halde o çizgi onun yerini alır. Başlıktaki tarihi gösteren etiket, bu iki çizgiden en az biri açık olduğu sürece kalır. Etiket tarih biçiminizi izler, örneğin 20-09-2006. Uygulama saat cinsinden hesaplıyorsa çizgi ve etiket o saatte konumlanır; etiket ayrıca saati de gösterir, örneğin 20-09-2006 17:00.
- **Çubuk renkleri** — çubukların nasıl renkleneceğini seçer: *Kritik yol* (varsayılan), *Görev başına — otomatik* veya alan seçimiyle *Kategoriye göre*. Bu alan bu projede yoksa menü, *İş kategorisi* alanının geçici olarak kullanıldığını söyler. *Kritik yol* dışında, kırmızı bir kontur kritik yolu işaretler. Bu seçim rapor için de geçerlidir.
- **Kaynak vurgusu** — her yaprak çubuğun altına kaynağın renginde ince bir çizgi çizer. Çizgi, günlük birimlere orantılı olarak bölünür. Varsayılan: kapalı.
- **Bolluk alanı** — kritik olmayan bir çubuğun arkasına, görevin geç bitişine kadar yeşil bir alan çizer. Varsayılan: açık.
- **İlişki çizgileri** — görevler arasındaki ilişki çizgilerini gösterir veya gizler. Varsayılan: açık. Bu seçim belgeye ve düzene aittir.

## Ayarlar

### Ayarlar › Proje

- **Proje ayarları** — *Proje ayarları* penceresini açar: projenin meta verileri ve *Hesaplama profili ve seçenekleri* bloğunda projenin nasıl hesaplandığı. Bkz. [Yeni proje ve Proje ayarları](docs://ref-projectinfo).
- **Uygulama ayarları** — *Uygulama ayarları* penceresini açar; sekmeler *Görünüm*, *Planlama* ve *Gelişmiş*. Aynı ayarlar *Dosya › Uygulama ayarları* altındadır.

### Ayarlar › Takvim

*Takvim* düğmesi, *Planlama* üzerindekiyle aynıdır.

### Ayarlar › Klavye kısayolları

- **Klavye Kısayolları** — *Klavye Kısayolları* penceresini açar.

## Tablo

*Tablo* sekmesi görevleri Gantt yerine tam bir tablo olarak gösterir. *Dosya*, *Düzenle*, *Görevler*, *Zamanlama* ve *Yol izleme* grupları, *Ana sayfa* ve *Planlama* üzerindekilerle aynıdır ve aynı seçimi işler. Burada *Yakınlaştırma* grubu yoktur, çünkü yakınlaştırma yalnızca Gantt'ın zaman eksenini ölçekler. *Görevi böl* ve *İlişki çiz* düğmeleri burada devre dışıdır: Gantt yoktur.

### Tablo › Sütunlar

- **Sütunlar…** — bu tablonun sütun seçicisini açar. Aynı seçici, tablo başlığındaki artı işaretiyle de açılır. İpucu metni *Tablo görünümünün sütunlarını seçin* der. Bkz. [Tablo sütunlarını ayarlama](docs://howto-tabelkolommen-aanpassen) ve [Tablo sütunları](docs://ref-tabelkolommen).

## IFC

Sekme çalışma alanında IFC panelini gösterir. Şeritte burada düğme yoktur; yalnızca *IFC - Industry Foundation Classes, projenin şemasında (varsayılan IFC 4.3 ADD2)* metin satırı vardır.

## Rapor

### Rapor › Rapor

- **Yazdır** — yalnızca bu sekmede bulunur. Burada hiçbir şey yapmaz, çünkü *Rapor* zaten açıktır. Rapor seçenekleri rapor ekranındadır.

## Yapay Zeka

*Yapay Zeka* sekmesi yalnızca *Yapay zeka modunu etkinleştir* açıkken bulunur (*Uygulama ayarları*, sekme *Gelişmiş*, başlık *Yapay zeka modu*). Varsayılan: kapalı. Bunu kapatmak sekmeyi kaldırır ve köprüyü durdurur. Bir yapay zeka asistanı, burada başlattığınız bir MCP köprüsü üzerinden planlamanızla çalışır. Bkz. [Bir yapay zeka asistanı bağlama (MCP)](docs://howto-ai-assistent-koppelen).

### Yapay Zeka › Sunucu

- **Köprüyü başlat** ve **Köprüyü durdur** — MCP köprüsünü başlatır veya durdurur. Yanında durum yer alır: *Kapalı*, *Port … üzerinde canlı*, *… portu kullanımda* (neden de gösterilir) veya *Hata*. Web sürümünde bu düğmeler devre dışıdır; ipucu metni *Köprü yalnızca masaüstü uygulamasında çalışır.* der. Aynı durum, durum çubuğunda *Yapay Zeka* ile birlikte bir nokta olarak görünür.

### Yapay Zeka › Bağlantı

- **Port** — köprünün portu. Varsayılan: 3877. Yalnızca durum *Kapalı* olduğunda düzenlenebilir (ipucu metni: *Yalnızca sunucu durdurulduğunda düzenlenebilir.*).
- **Token** — köprünün parolası; gizli gösterilir. Küçük düğmeler: *Token'ı göster*/*Token'ı gizle*, *Kopyala* ve *Yeni token*. *Yeni token* önce onay ister, çünkü yeni bir token mevcut tüm bağlantıları keser. Köprü çalışıyorsa yeni token ile yeniden başlar.
- **Bağlan** — bağlantı ayrıntılarını gösterir: uç nokta, token, bir yapılandırma parçası ve yapay zeka ajanınıza yapıştıracağınız bir bağlantı istemi.

### Yapay Zeka › Güvenlik

- **Duraklat** / **Devam et** — yapay zekanın tüm değişikliklerini geçici olarak reddeder. Okumaya izin verilir ve köprü canlı kalır. Düğme duraklatılmışken kırmızı yanar.
- **Salt okunur** — açık olduğunda değiştiren tüm araçları reddeder.
- **Otomatik yedekleme: açık** / **Otomatik yedekleme: kapalı** — her belge için ilk yapay zeka değişikliğinden önce otomatik olarak bir IFC yedeği yazar. Varsayılan: açık.
- **Şimdi yedekle** — hemen bir yedek yazar ve dosya adını bildirir. Yalnızca masaüstü uygulamasında.
- **Yedek klasörünü aç** — yedeklerin olduğu klasörü açar. Yalnızca masaüstü uygulamasında.

### Yapay Zeka › Etkinlik

- **Etkinlik paneli** — köprüye yapılan çağrıları, argümanları ve yanıtları içeren *Yapay zeka etkinliği* panelini gösterir veya gizler.
