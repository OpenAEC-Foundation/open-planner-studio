# Kaynakları yönetme

Amaç: projenizde kaynakları (kişiler, makineler ve malzemeler) oluşturmak, düzenlemek ve silmek. Böylece kaynakları görevlere atayabilirsiniz.

## Bu bilgiye ne zaman ihtiyaç duyarsınız

Bir bricklayer veya bir vinci bir göreve koymadan önce, bu kişinin veya makinenin kaynak olarak var olması gerekir. Kaynak, ne kadar bulunduğunu ve hangi günlerde çalıştığını kaydeder. Uygulama bu bilgiyle, bir günde ondan çok şey isteyip istemediğinizi hesaplar. Kadro değiştiğinde kaynağı düzenlersiniz; örneğin ikinci bir bricklayer katıldığında.

İki terim. **Maks. birim** iş günü başına kapasitedir: 1 bir kişi veya makinedir, 2 bunlardan iki tanedir. Bir **atama**, bir görevdeki bir kaynaktır (bkz. [Eğri ile kaynak atama](docs://howto-resource-toewijzen)).

## Adımlar

### Kaynak oluşturma

1. *Kaynaklar › Yönet › Yeni kaynak* öğesini seçin. Kaynak paneli çalışma alanını kaplar ve tablonun altında boş bir satır belirir. Paneli *Kaynaklar › Yönet › Kaynaklar* yolunu seçerek de açabilirsiniz. Ardından *Projede yeni kaynak* öğesini seçin.
2. Adı yazın, örneğin *Bricklayer*.
3. *Tür* alanında bir tür seçin: *İşçilik* (varsayılan), *Ekipman*, *Malzeme*, *Taşeron* veya *Ekip*.
4. Gerekirse diğer alanları doldurun. Her alanın varsayılan bir değeri vardır: *Maks. birim* 1'dir, *Takvim* ise *Proje takvimi*. *Ücret/saat* boştur. *Birim* alanını yalnızca tür *Malzeme* olduğunda doldurabilirsiniz, örneğin m³.
5. Enter tuşuna basın veya satırın dışına tıklayın. Kaynak tabloda görünür. Enter tuşuna basarsanız, altında hemen sıradaki kaynak için boş bir satır açılır. İşiniz bittiğinde Esc tuşuna basın.

Satır ancak bir adı olduğunda kaynak olur. Esc ile veya adsız satırın dışına tıklayarak çıkarsanız, uygulama hiçbir şey oluşturmaz. Bilgileri doldurma sırası önemli değildir. Önce türü seçip sonra adı yazabilirsiniz.

### Kaynağı düzenleme

Satırdaki alanları düzenleyin. Uygulama adı, ücreti ve birimi, ilgili alandan çıktığınızda kaydeder. Diğer alanları hemen kaydeder.

- *Maks. birim* yalnızca değer 0'dan büyükse kabul edilir. 0 veya daha az olursa alan kırmızı bir kenarlık alır ve önceki değere geri döner.
- *Takvim* kaynağın hangi günlerde çalışacağını belirler. *Proje takvimi* veya kendi takvimini seçin. *+ Kaynak takvimi* ile yeni bir takvim oluşturursunuz. Kalem simgesi (*Düzenle…*) seçilen takvimi açar. Bir görev, kaynağın takvimine göre kapalı olan bir günde çalışıyorsa, o gün aşırı atanmış sayılır. Kaynak takvimi nasıl oluşturulur, [Kaynak takvimi ayarlama](docs://howto-resourcekalender-instellen) bölümünde açıklanır.
- *Ücret/saat* ve *Toplam*: *Toplam*, bu kaynağın yüklü saatlerinin ücret ile çarpımıdır. Saatlik ücreti 50 olan ve 32 saat yüklü bir sıvacının toplamı 1.600,00 tutar. Tablonun altında tüm kaynakların toplamı bulunur.
- *Ekip*, bir kaynağı *Ekip* türündeki bir kaynağın altında gruplar. Bu yalnızca bir gruplamadır: uygulama üyelerin kapasitesini veya yükünü ekibe toplamaz.
- Soldaki renkli kare kaynağın rengidir. Bu yalnızca gösterim içindir ve planlamaya hiçbir etkisi yoktur.

### Zamanla değişen kapasite

İkinci bricklayer'ınız yalnızca 19 Temmuz'da mı geliyor? *Maks. birim* yanındaki oka tıklayın. *Zamana bağlı kapasite* altında *Adım ekle* öğesini seçin. Her adımın bir tarihi (*Başlangıç*) ve bir sayısı (*Maks. birim*) vardır. O tarihten itibaren bu sayı geçerlidir. Adım yoksa sabit değer her zaman geçerlidir.

Yeni bir adım bugünün tarihi ve 1 birimle başlar. İkisini de değiştirin. Aksi halde bugünden itibaren kapasite 1 olur.

### Kaynağı silme

1. Satırdaki çöp kutusuna tıklayın.
2. Kaynağın atamaları varsa, uygulama onay ister. Örneğin: *'Bricklayer' için 4 atama var — silinsin mi?* Silmek için onay işaretine, iptal etmek için çarpıya tıklayın. Atama yoksa kaynak hemen kaybolur.

Kaynağın atamaları da onunla birlikte silinir. Bir görevin görev türü *Sabit süre ve birimler* dışındaysa, uygulama silinen kaynağın işini kalan kaynaklar arasında böler. Görev türüne bağlı olarak bu, kalan kaynakların birimlerini veya görevin süresini değiştirir. Süre değişirse planlamanız artık güncel olmaz.

Oluşturmayı, düzenlemeyi ve silmeyi *Geri al* (Ctrl+Z) ile geri alabilirsiniz.

### Yan kolondaki kısa genel bakış

*Kaynaklar › Yönet › Kaynak doku* öğesi, sağ yan kolonda *Özellikler* yanında kompakt bir genel bakış gösterir. Orada her kaynağın adını ve rengini görürsünüz. Aşırı atanmış bir kaynağın yanında bir uyarı işareti (*Aşırı yüklü*) görünür. Orada yalnızca *Maks. birim* değerini değiştirebilirsiniz. Bir veya daha fazla görev seçerseniz, genel bakış yalnızca o görevlerin kaynaklarını gösterir.

## Sorunlar ve uygulamanın o durumda yaptıkları

**Hesaplama için yalnızca *Malzeme* türü fark yaratır.** *İşçilik*, *Ekipman*, *Taşeron* ve *Ekip* aynı şekilde işlenir. *Malzeme* bir görevin süresine dahil edilmez ve dengeleme dışı kalır. Histogram'da *Tüm kaynaklar* satırı da malzemeyi saymaz.

**Adı yoksa, kaynak da yoktur.** Boş bir satır iz bırakmadan kaybolur.

**Kapasitede yeni bir adım.** Tarihi ve sayıyı değiştirmeyi unutursanız, kapasite bugünden itibaren 1 olur.

**Hâlâ ihtiyaç duyduğunuz bir kaynağı silmek.** Yanlışlıkla silerseniz, hemen Ctrl+Z tuşlarına basın. Atamalar da geri gelir.

## Ayrıca bakın

- [Eğri ile kaynak atama](docs://howto-resource-toewijzen): bir kaynağı bir göreve koymak.
- [Kaynak takvimi ayarlama](docs://howto-resourcekalender-instellen): bir kaynağın çalışma günlerini düzeltmek.
- [Aşırı atanmışlığı çözme](docs://howto-overbezetting-oplossen): bir kaynağın bir günde çok fazla işi olduğunda ne yapılacağı.
- [Kaynak paneli](docs://ref-resourcepaneel): kaynak panelinin tüm alanları ve düğmeleri.
