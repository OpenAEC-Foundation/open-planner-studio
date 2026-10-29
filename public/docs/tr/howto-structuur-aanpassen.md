# Yapıyı ayarlama

Amaç: görevleri fazlara ve alt görevlere yerleştirmek, sıralarını değiştirmek ve WBS numaralarını doğru tutmak.

## Bunu ne zaman kullanmanız gerekir

Planlamanız bir ağaçtır: altında alt görevler bulunan fazlar (özet görevler), örneğin *Foundation* ile *Groundwork*, *Reinforcement* ve *Pouring*. Bu ağacı, bir görevi bir faza bağlamak, bir görevi fazdan çıkarmak veya sıra yanlış olduğunda ayarlarsınız. **WBS kodu** (1, 1.1, 1.2, 2, …) bir görevin bu ağaçtaki numarasıdır.

## Adımlar

### Bir görevi girintileme

1. Görevi seçin. Birden fazla görev seçebilirsiniz.
2. *Planlama › Yapı › Girinti* öğesini seçin. Ayrıca Alt+→ (veya Alt+Shift+→) tuşlarını kullanabilirsiniz ya da sağ tık menüsündeki *Girinti* öğesini seçebilirsiniz.

Görev, aynı düzeydeki önceki görevin son alt görevi olur. Önceki görev bunun sonucunda özet görev olur. Bitişik bir blok seçerseniz blok bir bütün olarak girintilenir. Görevin aynı düzeyde önceki bir görevi yoksa hiçbir şey olmaz ve mesaj da görünmez.

### Bir görevin girintisini azaltma

*Planlama › Yapı › Girintiyi azalt* öğesini seçin, Alt+← (veya Alt+Shift+←) tuşlarına basın ya da sağ tık menüsünde *Girintiyi kaldır* öğesini seçin.

Görev, bağlı olduğu fazın hemen arkasında kardeş görev olur. Kendi alt görevleri de onunla birlikte gider. Bu fazda kendisinden sonra gelen görevler o fazda kalır. En üst düzeydeki bir görevin girintisi daha fazla azaltılamaz.

### Bir görevi taşıma

Üç yolunuz var.

- **Klavyeyle.** Alt+↑ ve Alt+↓ görevi aynı düzeydeki komşusuyla yer değiştirir. Özet görev, alt görevlerini de yanında taşır. Düzeyin en üstünde veya en altında hiçbir şey olmaz. Birden fazla görev seçiliyse yalnızca ilk tıkladığınız görev taşınır.
- **Görev tablosunda sürükleyerek.** Bir satırın üzerine basın ve dikey sürükleyin. Satırın üst dörtte biri *önce* anlamına gelir, alt dörtte biri *sonra*. Özet görevin ortası görevi altına son alt görev olarak asar. Sıradan bir görevin ortası en yakın kenar sayılır. Birden fazla seçimin parçası olan bir satırı sürüklerseniz, bütün seçim taşınır.
- **Gantt'ta sürükleyerek.** Çubuğu dikey olarak başka bir satıra sürükleyin. Bu, görev tablosunda sürüklemekle aynı şekilde çalışır ve tarihleri değiştirmez. Yatay sürüklerseniz bunun yerine tarihleri kaydırırsınız.

Her taşıma *Geri al* (Ctrl+Z) için tek bir adımdır.

### WBS numaralarını güncel tutma

*Planlama › Yapı* bölümündeki *WBS auto* düğmesine bakın.

- **Açık (yeni bir projede varsayılan).** Ayarı olmayan bir dosyayı açtığınızda da açık olur. Bu, yalnızca tüm WBS kodları zaten ağacın numaralandırmasına (1, 1.1, 1.2 …) uyuyorsa geçerlidir. Kodlar değişmez. Bu ayarı olmayan boş bir dosya da, yeni bir proje gibi *açık* olur. Uygulama, her ekleme, silme ve taşımada ağacın tamamını yeniden numaralandırır. WBS kodu o zaman salt okunurdur: onu görev tablosuna veya *Özellikler* paneline yazamazsınız. *WBS'yi yeniden numaralandır* devre dışıdır.
- **Kapalı.** Kendi kodları olan bir dosyada, örneğin *A1000* gibi kodlarla, ya da ağaçtan farklı tek bir kod olduğunda varsayılandır. Kodlar olduğu gibi kalır, taşıma ve girintilemeden sonra da. Kodları kendiniz yazarsınız: *WBS* sütununda veya *Özellikler* içindeki *WBS Kodu* alanında. Ya da *WBS'yi yeniden numaralandır* öğesiyle kodları bir kez yeniden numaralandırırsınız. Bu, kendi yazdığınız kodların üzerine de yazar.

*WBS auto* düğmesini açarsanız uygulama ağacı hemen numaralandırır. Hem *WBS auto* hem de *WBS'yi yeniden numaralandır* işlemleri *Geri al* ile geri alınabilir.

## Tuzaklar ve uygulamanın yaptıkları

**Filtreleme, gruplama veya sıralama açıktır.** Gördüğünüz sıra o zaman planlamanın sırası değildir, bu yüzden uygulama yapıyı kilitler. *Girinti* ve *Girintiyi azalt* devre dışıdır; ipucunda *Filtreleme/gruplama/sıralama sırasında kullanılamaz* yazar. Alt+→ ve sürükleme aynı metni, *Temizle* düğmesiyle birlikte kırmızı bir şeritte gösterir. Bu, filtreyi, gruplamayı ve sıralamayı tek seferde kaldırır. Ctrl+Z bunları geri getirmez. Şerit, çarpıya tıklayana, Ctrl+Z veya Ctrl+Y kullanana ya da başka bir belgeye geçene kadar kalır. *Girinti* ve *Girintiyi kaldır* o zaman sağ tık menüsünde yoktur.

Alt+↑ ve Alt+↓ böyle bir görünümde yine çalışır, mesaj çıkmadan. Yalnızca filtre varsa yeni sırayı hemen görürsünüz. Sıralama varsa planlamadaki sıra gerçekten değişir, ama bunu yalnızca *Temizle* sonrasında görürsünüz.

**WBS auto kapalıysa.** Bu, kendi kodları olan bir dosyada ya da ayarı *kapalı* olarak kaydeden bir dosyada olur. Yeni bir görev, ağaçtaki yerine uyan kodu alır, başka bir görev o kodu zaten kullanıyor olsa bile. Böylece aynı numaralar çift görünebilir. Girintilemeden sonra da kodlar ağaçla artık eşleşmez. *WBS'yi yeniden numaralandır* ikisini de düzeltir.

**Bir kilometre taşına alt görev eklenir.** Bir kilometre taşı bir andır ve alt görevi olmaz. Uygulama kilometre taşı işaretini kaldırır ve bunu size bildirir.

**Kaynak atamaları olan bir göreve alt görev eklenir.** Özet görev kendi başına atama taşımaz. Bu yüzden uygulama önce bunlarla ne yapılacağını sorar, *Görev özet göreve dönüşür* penceresinde. Bu, bir görevi girintilediğinizde, bir görevde *Alt görev ekle* veya *Kilometre taşı ekle* kullandığınızda, bir şablon eklediğinizde ve *Görevi düzenle* içinde yeni bir *Üst görev* seçtiğinizde olur; mevcut bir görev için de yeni bir görev için de. *Görevi düzenle* içinde soru kaydetmeden önce gelir. Orada *İptal* seçerseniz *Görevi düzenle* değişikliklerinizle birlikte açık kalır. Şunu seçersiniz:

- *İptal*: hiçbir şey değişmez, yapı da olduğu gibi kalır.
- *Atamayı kaldırın*: görev alt görevlerini alır, atamaları kaldırılır. Bu atamaların gerçek işi de silinir.
- *Taşı “…”*: atamalar, bunları taşıyabilecek ilk yeni alt göreve gider, gerçek işleriyle birlikte. Bir kilometre taşı veya özet görev atama taşımaz.

Bu alt görevde aynı kaynak zaten varsa veya uygun bir alt görev yoksa *Taşı* devre dışıdır. Penceredeki turuncu bir blok nedenini söyler.

Bir atamada zaten gerçek iş varsa, turuncu blok kaynak başına kaç saat olduğunu söyler, örneğin *Metselaar atamasında zaten 8 saat gerçek iş kayıtlı. Atamayı kaldırırsanız bu iş silinir.* Bu durumda *İptal* varsayılan düğmedir: Enter hiçbir şeyi değiştirmez. Atamayı yine de kaldırmak istiyorsanız *Atamayı kaldırın* düğmesine kendiniz tıklayın.

Pencere açık olduğunda pencerenin dışındaki hiçbir kısayol çalışmaz. Buna *Geri al*, *Yapıştır*, Delete, F5 ve Ctrl+S da dahildir. Tek bir işlem aynı anda birden fazla özet görev oluşturursa pencere kaynakları göreve göre gösterir ve seçiminiz hepsi için geçerli olur. Tek bir *Geri al* (Ctrl+Z) bütün işlemi geri alır.

**Bir ilişki döngü oluşturabilir.** Özet görevin ilişkileri alt görevlerine de uygulanır. Bu yüzden bir taşıma döngü oluşturacaksa uygulama bunu reddeder ve *Bu taşıma planlamada bir döngü oluştururdu (…)* mesajını gösterir. Hiçbir şey değişmez.

**Bir görev ile kendi fazı arasındaki ilişki.** Bir görevi, zaten ilişkisi olan bir faza koyarsanız, bu ilişki kalır, ama hesaplamada artık sayılmaz. Uygulama bunu size bildirir. Özet görevlerdeki ilişkiler hakkında daha fazla bilgiyi [İlişkiler ve gecikme](docs://uitleg-relaties) makalesinde bulabilirsiniz.

**Planlamanız artık güncel olmaz.** Başka bir faza taşıma tarihleri değiştirebilir. **Hesapla** (F5) komutunu çalıştırın. Yalnızca aynı faz içinde sırayı değiştirmek tarihleri değiştirmez.

## Ayrıca bakın

- [Görev ve kilometre taşı ekleme](docs://howto-taken-en-mijlpalen-toevoegen): yeni görevleri doğru yere koyun.
- [WBS şablonlarını kaydetme ve ekleme](docs://howto-wbs-sjablonen): tüm bir fazı yeniden kullanın.
- [Görevler arasına ilişki oluşturma](docs://howto-relaties-leggen): görevleri birbirine bağlayın.
- [Görevleri seçme, silme ve geri alma](docs://howto-taken-selecteren-verwijderen): bir taşımayı geri alın.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): dört faz ve alt görevleri, girintileme ile nasıl kurulduğunu gösterir.
