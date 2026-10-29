# İlişkiler ve gecikme

Neden duvar örme işi yalnızca temel tamamlandıktan sonra başlar? Ve neden çatı elemanları geç teslim edilince çatı montajı bir hafta kayar? Bunu görevleriniz arasındaki ilişkiler belirler. Bu makalede şunları okursunuz: uygulamanın hangi dört ilişki türünü tanıdığı, gecikme ve öne almanın ne yaptığı, bir gecikmenin hangi takvimde sayıldığı, bir fazdaki bir ilişkiye ne olduğu ve uygulamanın bir görevin başlangıç tarihini hangi ilişkinin belirlediğine nasıl karar verdiği.

Kurallar ve örnekler, hesaplama profili *Open Planner Studio* olan ve Pazartesiden Cumaya kadar süren bir iş haftası bulunan yeni bir proje için geçerlidir.

## Kavram

Bir **ilişki**, iki görevin birbirine bağlı olduğunu kaydeder. İlk görev **öncül**, ikinci görev **ardıl** olur. Bir ilişki bir alt sınırdır. Ardıl, ilişkinin izin verdiğinden daha erken başlayamaz veya bitemez. Ama daha geç başlayabilir veya bitebilir. Bir görevin birden çok öncülü varsa, bu ilişkilerin tümünden çıkan en geç tarihi bekler.

Dört tür vardır. Bunlar, öncülün hangi anının (başlangıç veya bitiş) ardılın hangi anına bağlı olduğuna göre ayrılır:

- **FS (Bitiş-Başlangıç).** Ardıl, öncül bittikten sonra başlar. Çatı elemanları, duvarlar ayağa kalktıktan sonra yerleştirilir. Bu, açık ara en çok kullanılan ilişkidir.
- **SS (Başlangıç-Başlangıç).** Ardıl, öncül başladıktan sonra başlar. Görevler üst üste binebilir: tesisat işi, duvar örme işi devam ederken başlayabilir.
- **FF (Bitiş-Bitiş).** Ardıl, öncül bittikten sonra biter. Derz işi, duvar örme işi bitmeden yapılamaz. Ama daha önce başlayabilir.
- **SF (Başlangıç-Bitiş).** Ardıl, öncül başladıktan sonra biter. Bu tür nadirdir. Örnek: geçici drenaj, temeldeki duvar örme işi başladıktan sonra durdurulabilir.

Bir ilişkinin ayrıca bir **gecikme** de olabilir. Bu, iki görev arasındaki bekleme süresidir, örneğin kürlenmesi gereken beton. Negatif gecikmeye **öne alma** denir. Ardıl o zaman öncül bitmeden başlar. Görevler bu nedenle üst üste biner.

## Uygulama nasıl hesaplar

### Dört tür

Uygulama her ilişki için ardılın başlayabileceği en erken tarihi hesaplar. Bir görevin tüm ilişkilerinden en geç tarihi alır. Gecikme olmadığında şöyle çalışır:

- FS ile ardıl, öncülün bitişinden sonraki ilk iş gününde başlar.
- SS ile ardıl, öncülle aynı günde başlar.
- FF ile ardıl, öncülle aynı günde biter. Başlangıcı bulmak için uygulama ardılın süresini geriye doğru sayar. Yani 3 iş günlük bir ardıl, öncülün bitişinden 2 iş günü önce başlar.
- SF ile ardıl, öncülün başladığı günde biter. Burada da uygulama ardılın süresini geriye doğru sayar.

Bunlar alt sınırlardır. Başka bir ilişki veya bir kısıtlama daha geç başlamayı isterse ardıl daha geç başlar. Tüm tarihler yalnızca **Hesapla** (F5) komutundan sonra görünür. Durum çubuğunda *Güncel değil — yeniden hesaplayın (F5)* yazdığı sürece çubuklar önceki hesaplamaya aittir.

### Gecikme ve öne alma

Bir gecikme dört şekilde yazılabilir:

- **İş günü** cinsinden (`3` veya `3d`): uygulama tatil günlerini ve hafta sonlarını atlar. Bu varsayılan seçenektir.
- **Takvim günü** cinsinden (`3ed`, e harfi *geçen* süreyi gösterir): her gün sayılır, cumartesi ve pazar dahil. Bu birim, iş yapılmadan süren işler içindir, örneğin kürlenme.
- Öncülün **süresinin yüzdesi** olarak (`40%`): uygulama bunu her hesaplamada yeniden bulur ve tam güne yuvarlar (2,5 gün 3 gün olur).
- **Çalışma saatleri** cinsinden (`4h`): uygulama gecikmeyi gecikme takvimine göre sayar. Varsayılan olarak bu, öncülün takvimidir. Öncül bir gün görevi ise ve takvimin kendi çalışma bantları yoksa (örneğin standart takvim), uygulama saatleri tam iş gününe çevirir ve en yakın tam güne yuvarlar. Yarım gün yukarı yuvarlanır. İş günü 8 saat olduğunda `2h` ve `3h` bu nedenle 0 gün eder. `4h`'den `11h`'ye kadar (bu dahil) 1 gün eder ve `12h` 2 gün eder. Takvimin kendi çalışma bantları varsa veya öncül bir saat görevi ise, gecikme tam olarak çalışma saatleri olarak sayılır.

FS ile N iş günlük bir gecikme için kural şöyledir: öncülün bitişinden sonraki N iş günü bekleme süresidir. Ardıl, bundan sonraki iş gününde başlar. SS ve FF ile gecikme sırasıyla öncülün başlangıcına ve bitişine eklenir. Negatif gecikme geriye doğru sayar. FS ile 1 iş günlük bir öne alma, ardılın öncülün bittiği günde başlamasına izin verir.

Öne alma, bir görevi proje başlangıcından önceye taşıyamaz. Bu olacaksa uygulama ardılı proje başlangıcında tutar. Bunu *Uyarılar* panelinde bildirir: *Öncelik proje başlangıcıyla kesildi — ilişki tam olarak uygulanmıyor*.

### Gecikmenin hangi takvimde sayıldığı

Her görevin kendi takvimi olabilir. İş günü cinsinden bir gecikmede, hangi takvimin iş günlerini sayacağı önemlidir. Bunu *Gecikme takvimi* ayarı belirler. Dört seçenek vardır: *Öncül*, *Ardıl*, *24 saat* ve *Proje takvimi*. Standart olarak gecikme, **öncülün** takvimine göre sayılır. Bu ayarı *Ayarlar › Proje › Proje ayarları* altında bulursunuz. Ayar, *Hesaplama profili ve seçenekleri* bloğunda, *Bu projenin hesaplama seçenekleri* bölümündedir. Seçim proje dosyasına aittir. Yalnızca *Uygula* düğmesine tıkladıktan sonra geçerli olur. Planlama bunun ardından yeniden hesaplanır.

*Gecikme takvimi* için hangi seçeneği seçerseniz seçin, takvim günü cinsinden bir gecikme (`3ed`) her zaman tüm günleri sayar.

### Özet görevlerdeki ilişkiler

Bir ilişkiyi, içindeki bir görev yerine bir faza (bir özet göreve) koyabilirsiniz. Uygulama bu ilişkiyi iç hesaplamada fazdaki her göreve koyar:

- Öncül olarak **faz**, FS veya FF ile: ardıl, fazdaki bitişi en geç olan görev bitene kadar bekler.
- Ardıl olarak **faz**, FS veya SS ile: fazdaki her görev öncülü bekler. Bu, fazdaki diğer görevlerden bağımsızdır.
- Öncül olarak **faz**, SS veya SF ile: ardıl, fazdaki en **son** başlayan görevin başlangıcını bekler. Fazın kendi başlangıcını beklemez. Bu, beklediğinizden daha temkinlidir: ardıl hiçbir zaman çok erken başlamaz, ama belki istediğinizden daha geç başlar. Ardılın fazın başlangıcına bağlı olmasını istiyorsanız, ilişkiyi fazdaki ilk göreve koyun.
- Ardıl olarak **faz**, FF veya SF ile: fazdaki her görev bitiş koşulunu kendisi karşılamalıdır. FF ile bitiş, öncülün bitişinde veya sonrasında olmalıdır. SF ile başlangıç, öncülün başlangıcında veya sonrasında olmalıdır. Bu, çok daha önce yapılabilecek bir görev için bile geçerlidir. Böyle bir ilişkiyi bunun yerine fazdaki son göreve koyun.

Bir görev ile içinde bulunduğu faz arasında bir ilişkiye izin verilmez.

### Belirleyici ilişkiler

Bir ardılın birden çok öncülü varsa, genellikle tek bir ilişki başlangıç tarihini belirler. Bu, ardılın şu an başladığından bir gün bile erken başlamasını engelleyen ilişkidir. Böyle bir ilişkiye **belirleyici** denir. Eşitlik olduğunda birden çok belirleyici ilişki olabilir. Belirleyici ilişkiyi şu işaretlerden tanırsınız: *Öncüller* ve *Ardıllar* sütunlarındaki şimşek sembolü, *Belirleyici* sütunu (tablo başlığının sağındaki **+**, *İlişkiler* altında) ve bir yolu izlediğinizde daha koyu renk tonu. Bu yolu nasıl açacağınız, [Bir yolu izleme](docs://howto-pad-traceren) bölümünde yazılıdır.

Belirleyici olma durumu tarihler hakkında bir şey söyler, süre hakkında değil. Kısa bir öncül de belirleyici olabilir, örneğin uzun bir gecikme yüzünden. Bunu aşağıdaki örnekte görürsünüz.

## Çalışılmış örnek

Örnekler ayrı mini projeler kullanır. Hepsi Pazartesi 7 Haziran 2027'de başlar, aksi belirtilmedikçe. Kritik yol ve bolluk gibi terimler [Kritik yol ve bolluk](docs://uitleg-kritiek-pad) bölümünde açıklanır. Kendiniz bir ilişki ağı kurup bunu kontrol etmek, eğitim 2 olan “İlişkiler ve kritik yol”da yaptığınız şeydir.

### Dört tür yan yana

*Pour foundation* 5 iş günü sürer: Pazartesi 7 ila Cuma 11 Haziran. *Build walls* (5 iş günü) FS ile devam eder ve Pazartesi 14 ila Cuma 18 Haziran arasında sürer. *Build walls*'a bağlı dört görev vardır. Her biri 3 iş günü sürer ve her biri farklı bir türdedir:

- *Place roof elements* (FS) Pazartesi 21 Haziran'da başlar. Bu, duvar örme işinden sonraki ilk iş günüdür. Çarşamba 23 Haziran'da biter.
- *Pipework* (SS) Pazartesi 14 Haziran'da, duvar örme işiyle birlikte başlar. Çarşamba 16 Haziran'da biter.
- *Pointing* (FF) Cuma 18 Haziran'da, duvar örme işiyle birlikte bitmek zorundadır. 3 iş günü olduğu için Çarşamba 16 Haziran'da başlar.
- *Dewatering* (SF) Pazartesi 14 Haziran'da biter. Bu, duvar örme işinin başladığı gündür. 3 iş günü geriye sayılınca (Perşembe 10, Cuma 11, Pazartesi 14 Haziran) Perşembe 10 Haziran'da başlar.

Yalnızca *Place roof elements* kritik yol üzerindedir. Proje Çarşamba 23 Haziran'da biter. *Pipework*, *Pointing* ve *Dewatering* sırasıyla 5, 3 ve 7 iş günü bolluğa sahiptir.

### Sayılarla gecikme ve öne alma

*Pour foundation* Cuma 18 Haziran'da biter. *Build walls* (2 iş günü) FS ile devam eder. Gecikmenin başlangıç tarihine etkisi şöyledir:

- Gecikme olmadan duvar örme işi Pazartesi 21 Haziran'da başlar.
- `3` gecikmesiyle (üç iş günü) Pazartesi 21, Salı 22 ve Çarşamba 23 Haziran bekleme süresidir. Duvar örme işi Perşembe 24 Haziran'da başlar.
- `3ed` gecikmesiyle (üç takvim günü) Cumartesi, Pazar ve Pazartesi sayılır. Duvar örme işi Salı 22 Haziran'da başlar.
- `-1` ile (bir iş günlük öne alma) duvar örme işi Cuma 18 Haziran'da başlar. Bu, dökümün tamamlandığı gündür.
- `40%` ile gecikme, 5 iş gününün %40'ı yani 2 iş günüdür. Duvar örme işi Çarşamba 23 Haziran'da başlar.
- `50%` ile gecikme 2,5 iş günüdür ve 3 iş gününe yuvarlanır. Duvar örme işi Perşembe 24 Haziran'da başlar.

### Gecikmeyi hangi takvim sayar

*Build walls* (4 iş günü) proje takvimindedir, Pazartesiden Cumaya. Perşembe 10 Haziran'da biter. *Pointing* (2 iş günü) FS ile ve `3` gecikmesiyle devam eder. Bu görev, Cumartesi ve Pazar da iş günü olan bir takvimdedir. Başlangıç tarihi o zaman *Gecikme takvimi* ayarına bağlıdır:

- *Öncül* (varsayılan): gecikme duvar örme işinin takviminde sayılır. Cuma 11, Pazartesi 14 ve Salı 15 Haziran bekleme süresidir. Pointing Çarşamba 16 Haziran'da başlar.
- *Ardıl*: gecikme Pointing'in takviminde sayılır. Cuma 11, Cumartesi 12 ve Pazar 13 Haziran bekleme süresidir. Pointing Pazartesi 14 Haziran'da başlar.
- *24 saat*: her takvim günü sayılır. Burada da Cuma, Cumartesi ve Pazar bekleme süresidir. Pointing Pazartesi 14 Haziran'da başlar.
- *Proje takvimi*: gecikme proje takviminde sayılır, tıpkı *Öncül* gibi. Pointing Çarşamba 16 Haziran'da başlar.

### Bir fazdaki ilişkiler

*Foundation* iki görevli bir fazdır: önce *Excavate* (2 iş günü, Pazartesi 7 ve Salı 8 Haziran), ardından *Pour* (3 iş günü, Çarşamba 9 ila Cuma 11 Haziran). *Build walls*, *Foundation* fazını FS ile izler ve Pazartesi 14 Haziran'da başlar. Uygulama onu, bitmesi en son olan görev *Pour*'u bekletir.

Ardıl olarak bir faz: *Permit* (3 iş günü, Çarşamba 9 Haziran'da biter) FS ile *Yapı* fazına gider. Bu fazda önce *Build walls* (4 iş günü), ardından *Lay floor* (2 iş günü) vardır. Fazdaki her görev *Permit*'i bekler. *Build walls* Perşembe 10 Haziran'da başlar ve Salı 15 Haziran'da biter. *Lay floor* de duvar örme işini bekler ve Çarşamba 16 ila Perşembe 17 Haziran arasında sürer.

Bir fazdan SS ile: *Finishing* fazı, *Plastering* (2 iş günü, 7 ve 8 Haziran), ardından *Painting* (3 iş günü, 9 ila 11 Haziran) ve ardından *Snagging* (2 iş günü, 14 ve 15 Haziran) görevlerini içerir. *Cleaning*, fazı SS ile izler. Pazartesi 7 Haziran'da başlamasını beklersiniz. Ama uygulama *Cleaning*'i, en son başlayan görev *Snagging*'in başlangıcını bekletir: Pazartesi 14 Haziran.

### Belirleyici olan

*Pour foundation* (2 iş günü) Pazartesi 7 ila Salı 8 Haziran arasında sürer. Ardından iki dal gelir:

- *Build walls* (5 iş günü): Çarşamba 9 ila Salı 15 Haziran.
- *Order roof elements* (2 iş günü): Çarşamba 9 ve Perşembe 10 Haziran.

*Place roof elements* (3 iş günü) ikisini de izler: duvar örme işinden sonra FS ile, ve siparişten sonra FS ile ve `5` gecikmesiyle (teslim süresi). Duvar örme işinden bakıldığında yerleştirme Çarşamba 16 Haziran'da başlayabilirdi. Siparişten bakıldığında Cuma 11, Pazartesi 14, Salı 15, Çarşamba 16 ve Perşembe 17 Haziran bekleme süresidir. Yerleştirme Cuma 18 Haziran'da başlar. Sipariş ilişkisi bu nedenle belirleyicidir, sipariş duvar örme işinden çok daha kısa olsa bile. Duvar örme işinin 2 iş günü bolluğu vardır.

## Sonuçlar ve yanlış anlamalar

**“Bir ilişki görevleri sabitler.”** Hayır, ilişki bir alt sınırdır. Bir ardıl en erken, ilişkinin verdiği tarihte başlar. Başka bir ilişki veya bir kısıtlama bunu isterse daha geç başlar. Kısıtlamaların nasıl uyduğu, [Kısıtlamalar ve son tarihler](docs://uitleg-constraints) bölümünde açıklanır.

**“SS, görevlerin aynı anda başladığı anlamına gelir.”** SS yalnızca ardılın öncülden önce başlayamayacağını söyler. Ardılın daha geç biten başka bir öncülü varsa, ardıl daha geç başlar.

**“FF ile ardıl aynı günde başlar.”** Hayır, FF ile bitiş tarihleri çakışır. Bu nedenle kısa bir ardıl, örnekteki Pointing gibi, öncülden daha geç başlar.

**“Gün cinsinden bir gecikme takvim günlerini sayar.”** Varsayılan olarak gecikme iş günü sayılır, öncülün takvimine göre. Hafta sonunun da sayıldığı kürlenme veya kuruma için takvim günü (`ed`) kullanırsınız.

**“İlişkisiz bir görev sorun değildir.”** Öncülü olmayan bir görev, planlanmış başlangıç tarihinde başlar. Ardılı olmayan bir görev ise projenin sonuna kadar bolluk alır. Bir ilişkiyi unutursanız, görev bu nedenle çok yer varmış gibi görünür. Yanlış anlamalara bakın: [Kritik yol ve bolluk](docs://uitleg-kritiek-pad).

**“Bir fazdaki ilişki tek bir ilişkidir.”** Hesaplama için bu, fazdaki her görev için bir ilişki demektir. Görevleri bir faza veya bir fazdan taşırsanız, bu görevlere uygulanan ilişkiler de değişir.

## Ayrıca bakınız

- [İlişki ekleme](docs://howto-relaties-leggen): görevler arasında ilişki oluşturma ve bir gecikme ayarlama adımları.
- [Kritik yol ve bolluk](docs://uitleg-kritiek-pad): uygulamanın ilişkilerinizden hesapladıkları ve bir görevin neden kritik olduğu.
- [Kısıtlamalar ve son tarihler](docs://uitleg-constraints): ilişkilerle birlikte tarih anlaşmaları.
- [Bir yolu izleme](docs://howto-pad-traceren): bir görevin öncesindeki ve sonrasındaki zinciri görünür kılma.
- [Hamak oluşturma](docs://howto-hammock): türetilmiş süresi olan, SS ve FF türünde ilişkilere bağlı bir görev.
- [Başka bir projeye dış ilişkiler](docs://howto-externe-relaties): başka bir proje dosyasındaki bir görevle ilişkiler.
