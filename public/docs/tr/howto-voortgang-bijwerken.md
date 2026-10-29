# İlerlemeyi güncelleme

Hedef: işin gerçek durumunu planlamaya girmek ve planlamayı yeniden hesaplamaktır. Yani planlama hangi görevlerin bittiğini, hangilerinin devam ettiğini ve ne kadar iş kaldığını gösterir.

## Ne zaman gerekir

İlerlemeyi sabit anlarda güncellersiniz. Bunu örneğin her Cuma yaparsınız, saha şefi durumu bildirdiğinde. Bu şekilde planlama gerçekte olanları görür ve kalan işi durum tarihinden hesaplar. Uygulamanın bunu neden bu şekilde yaptığı, [İlerleme, durum tarihi ve temel plan](docs://uitleg-voortgang) rehberinde açıklanır.

## Adımlar

### 1. Durum tarihini ayarlayın

Durum tarihi, durumu değerlendirdiğiniz gündür. İlerlemeyi girmeden önce onu ayarlayın.

1. *Planlama › Temel plan ve ilerleme › Durum tarihi* yoluna gidin.
2. Tarihi gün, ay ve yıl için üç kutuya yazın (tarihinizin yazım sırasına göre), örneğin 28, 06 ve 2027, ve Enter tuşuna basın. Uygulama bir sonraki kutuya kendiliğinden geçer.
3. Proje takviminde bant var mı (*Takvimler* penceresindeki *Çalışma saatleri* bölümü)? O zaman uygulama saatle hesaplar ve sağda bir saat alanı görünür, örneğin 17:00. Başka bir saat yazın, örneğin 12:00, ve Enter tuşuna basın. Saat alanını boşaltırsanız, yalnızca tarih kalır. Yalnızca tarihi değiştirirseniz, saat aynı kalır. Saat, saat biçiminize (24 veya 12 saat) uyar. Bant yoksa uygulama tam günlerle hesaplar: o zaman saat alanı yoktur ve durum tarihi satırı günün başında yer alır.
4. Durum tarihini yeniden boşaltmak için alanın yanındaki küçük çarpıya tıklayın.

Cuma günü çalışma saatlerinden sonra durumu değerlendirirseniz, durum tarihini bir sonraki iş günü olan Pazartesi'ye ayarlayın. Uygulama kalan işi durum tarihinin başlangıcından itibaren planlar.

Durum tarihi yokken ilerleme girerseniz, uygulama durum tarihini bugüne ayarlar ve şu mesajı gösterir: *Durum tarihi bugüne ayarlandı (…)*. Bu yüzden önce durum tarihini kendiniz ayarlayın.

### 2. İlerlemeyi girin

Durumunuza uygun yolu seçin. Hepsi aynı sonucu verir.

**Özellikler panelinde tek bir görev.** Tek bir görevi güncellediğinizde işe yarar.

1. Göreve tıklayın. *Özellikler* paneli görünmüyorsa, onu *Görünüm › Paneller › Özellikler* yolundan açın.
2. *İlerleme (%)* kaydırıcısını tamamlanan yüzdeye sürükleyin.
3. Gerekirse *Gerçek başlangıç* ve *Gerçek bitiş* alanlarını doldurun, durum tarihiyle aynı şekilde. Uygulama *Kalan* alanını kendisi hesaplar. Bu alanı burada değiştiremezsiniz.

Bir kilometre taşında tek bir alan vardır: *Gerçek tarih*.

**Yüzdeyi menüden seçmek.** Hızlı bir durum için işe yarar.

1. Gantt'ta görev çubuğuna sağ tıklayın.
2. *İlerleme* öğesini seçin ve ardından %0, %25, %50, %75 veya %100 öğesini seçin.

**Birkaç görev tabloda.** Bir listenin tamamını güncellediğinizde işe yarar.

1. Görev tablosu başlığının sağındaki **+** öğesine tıklayın (*Sütun ekle*) ve *İlerleme* kategorisini açın. *Gerçek başlangıç*, *Gerçek bitiş*, *Kalan* ve *Durum* sütunlarını ekleyin. *İlerleme* sütunu zaten *Tablo* sekmesindedir.
2. Bir hücreye çift tıklayın, değeri yazın ve Enter tuşuna basın. Yüzdeyi `50` veya `50%` olarak, tarihi `25-06-2027` olarak ve kalan süreyi `1` olarak yazarsınız.
3. *Durum* için çift tıkladıktan sonra Enter tuşuna basın ve *Başlamadı*, *Devam ediyor* veya *Tamamlandı* seçin.

Kalan süreyi yazarsanız, uygulama yüzdeyi geriye doğru hesaplar. 2 iş günü süren bir görevde kalan 1 iş günü ise yüzde 50 olur. Kalan 0 ise görev tamamlanır. *Gerçek süre* sütunu (ayrıca *İlerleme* kategorisinde) tersine çalışır: yapılmış işin ne kadar olduğunu yazarsınız ve uygulama yüzdeyi hesaplar. 4 iş günü süren bir görevde gerçek süre 1 ise %25 olur. *Durum* alanında *Başlamadı* seçerseniz, yüzde 0 olur ve gerçek tarihler kaybolur.

**Bir görevin tüm alanları, Görevi düzenle penceresinde.** Görevi sağ tıklayın ve *Düzenle...* öğesini seçin. İlerleme alanları da oradadır. Bunlar yalnızca *Kaydet* düğmesine tıklayınca uygulanır.

**Bir elektronik tablodan birden çok görev.** Bkz. [İlerlemeyi elektronik tablodan içe aktarma](docs://howto-voortgang-importeren).

### 3. Planlamayı yeniden hesaplayın

Her ilerleme veya durum tarihi değişikliği planlamayı güncel olmaktan çıkarır. Durum çubuğu *Güncel değil — yeniden hesaplayın (F5)* gösterir. **Hesapla** (F5) düğmesine basın, örneğin *Planlama › Zamanlama › Hesapla* yolundan. *Otomatik hesapla* açıksa (*Ayarlar › Proje › Uygulama ayarları* altında, *Planlama* sekmesinde), uygulama bunu kendisi yapar.

## Sonucu kontrol etme

- Durum tarihinde Gantt, başlıkta tarihle birlikte kesik bir çizgi gösterir. Devam eden görevlerde çizgi, çubuktaki yüzdeye doğru dışa kabarır. Bunları *Görünüm › Temel plan ve ilerleme › İlerleme çizgisi* ve *Durum tarihi çizgisi* yollarından açıp kapatırsınız.
- Çubuğun tamamlanan kısmı griye döner; kalan kısım rengini korur. Tamamen bitmiş bir görev tamamen gri olur; adının önünde bir onay işareti vardır ve bolluk şeridi yoktur. Bir aşamanın çubuğu da türetilmiş yüzdesine kadar griye döner; böylece her aşamada işin ne kadarının bittiğini görürsünüz. Bir görevin öncüllerini veya ardıllarını gösterirseniz, bu çubuklar tamamlanmış olsalar bile vurgu renklerini korur.
- Tamamlanmış görevler asla kırmızı olmaz: durum tarihiyle tamamlanmış bir görev kritik değildir.
- Aşamalar türetilmiş bir yüzde gösterir ve planlamanın bitişi kaymış olabilir.
- Bir temel plan kaydettiyseniz, özgün planlama her çubuğun altında görünür ve *Variance* rapor türü sapmayı gösterir.

## Sorunlar ve uygulamanın yaptıkları

**Durum tarihinden sonra bir tarih.** Uygulama, durum tarihinden sonraki bir gerçek başlangıcı veya gerçek bitişi kabul etmez. Panelde alanların altında *Gerçek tarihler durum tarihinden sonra olamaz* yazar. Tabloda hücre *Gerçek tarih, durum tarihinden sonra* bildirir. Önce durum tarihini daha sonraya alın veya tarihi düzeltin.

**Yalnızca durum tarihinden sonra başlayacak bir görev.** Planlamaya göre henüz başlamamış bir görev için ilerleme girerseniz, *Gerçek başlangıcı girin* penceresi açılır. Pencere, görevin gerçekte ne zaman başladığını sorar. Öneri durum tarihidir. *İlerlemeyi uygula* ile kaydedersiniz. *İptal* ile hiçbir şey değişmez.

**Tarih girmeden %100.** Gerçek bitiş girmeden bir görevi %100 yaparsanız, gerçek bitiş durum tarihi olur. Görev daha önce bitmiş olsa bile böyledir. Sonra gerçek bitişi kendiniz girin.

**%100'ün altında bir yüzde.** Tamamlanmış bir görevi %100'ün altına geri alırsanız, gerçek bitiş silinir. Yalnızca gerçek bitişi silerseniz, yüzde 0 olur ve görev *Devam ediyor* kalır. Görevin yeniden başlamamış sayılmasını istiyorsanız, gerçek başlangıcı da silin veya tabloda *Durum* alanında *Başlamadı* seçin.

**Devam eden bir görevin süresini değiştirmek.** Yapılmış iş yapılmış kalır ve yüzde ayarlanır. 5 iş günlük ve %60'ta olan bir görevi 10 iş gününe ayarlarsanız, %30 olur. Uygulama, yapılmış işten kısa bir süreyi reddeder: *“Build inner cavity leaf” zaten %60 tamamlandı: yapılmış işten kısa bir süre olamaz. Süre değiştirilmedi.* Tabloda hücre *Bu süre, yapılmış işten daha kısa* bildirir.

**Kalan süre yuvarlanır.** Uygulama kalan süreyi tam iş gününe yuvarlar. 2 iş günlük bir görevde %50 ve %75 ikisi de kalan 1 iş günü verir.

**Özet görev.** Bir özet görevin kendi ilerlemesi yoktur. Panelde *Alt görevlerden türetilir: ilerlemeyi orada değiştirin. Özet görev hesaplamadan (F5) sonra güncellenir* yazar. Tabloda hücre *Özet görevin ilerlemesi alt görevlerinden türetilir ve burada değiştirilemez* bildirir.

**Durum tarihini daha sonraya taşımak.** Devam eden görevlerin kalan işi yeni durum tarihinde başlar. Henüz başlamamış iş bu tarihten önce olamaz. Bu yüzden durum tarihini yalnızca ilerleme güncellemesiyle birlikte taşıyın. Durum tarihini girer ama ilerleme girmezseniz, henüz başlamamış tüm iş o tarihe taşınır (Microsoft Project profili hariç).

**Bir hata.** Her ilerleme değişikliği Ctrl+Z ile tek adımda geri alınır.

## Ayrıca bakın

- [İlerleme, durum tarihi ve temel plan](docs://uitleg-voortgang): uygulamanın kalan işi ve durum tarihini nasıl hesapladığı, uygulamalı bir örnekle.
- [İlerlemeyi elektronik tablodan içe aktarma](docs://howto-voortgang-importeren): birçok görevin ilerlemesini aynı anda okuma.
- [İlerleme modunu seçme](docs://howto-voortgangsmodus-kiezen): öncülü hâlâ devam ederken başlamış bir görevle uygulamanın ne yaptığı.
- [Temel planı kaydetme ve yönetme](docs://howto-baseline-opslaan-en-beheren): özgün planlamayı kaydetme, ilerlemeyi onunla karşılaştırmak için.
