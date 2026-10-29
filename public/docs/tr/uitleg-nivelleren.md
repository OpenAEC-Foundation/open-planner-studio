# Kaynak dengeleme

Bir duvarcınız ve aynı günlerde örülmesi gereken iki duvarınız var. Kâğıt üzerinde planlama işe yarar, ama pratikte duvarcı yalnızca bir yerde olabilir. Dengeleme, uygulamanın bu tür çakışmaları çözme yöntemidir: kaynak yetişene kadar görevleri daha geç başlatır. Bu makalede tam olarak neyin kaydığını, bitiş tarihinin ne zaman yer değiştirdiğini ve uygulamanın sizin yerinize neyi çözmediğini okursunuz.

## Kavram

Bir kaynak bir iş gününde **aşırı atanmış** olur; planlama o gün kaynaktan sağlayabileceğinden fazlasını isterse. Sağlayabileceği miktar kapasitesidir: takviminin iş günlerindeki *Maks. birim*. Takvimine göre o gün çalışmıyorsa kapasitesi 0'dır.

**Dengeleme** bunu, görevleri daha geç başlatarak çözer. Başka bir şey yapmaz. Bir görevi kısaltmaz, bölmez, birimleri veya ilişkileri değiştirmez ve ek bir kaynak eklemez. Her görev için uygulama, kaynakların boş olduğu ilk yeri arar ve görevi oraya kaydırır.

*Kaynakları dengele* penceresinde iki yol vardır:

- Varsayılan olarak proje bitiş tarihi kayabilir. Bu, gerçek anlamda dengelemedir.
- *Yalnızca bolluk içinde dengele (yumuşatma) — proje bitiş tarihi sabit kalır* onay kutusunu işaretlerseniz uygulama görevleri yalnızca bolluk içinde kaydırır. Bitiş tarihi yerinde kalır. Bu işe yaramazsa görev yerinde kalır ve uygulama bir çakışma bildirir. Bolluğun ne olduğunu [Kritik yol ve bolluk](docs://uitleg-kritiek-pad) bölümünde okursunuz.

## Uygulama nasıl hesaplar

### Bir görevin ne kadar talep ettiği

Her iş günü için uygulama, her görevin bir kaynaktan kaç birim talep ettiğini sayar. Bu, eğriye göre veya kendi saat dağılımınıza göre hesaplanan birimdir; histogramda gösterilen günlük saatlerle tam olarak aynıdır. Kaynağın kapasitesi *Maks. birim* değeridir veya o güne uygulanan zamana bağlı kapasitedeki adımın değeridir. Talep kapasiteden büyükse bir gün aşırı atanmış olur.

### Hangi sırayla

Uygulama görevleri teker teker, şu sırayla yerleştirir: önce en yüksek öncelik, sonra en az toplam bolluğa sahip görev, sonra en erken başlangıç ve son olarak görev tablosundaki sıra. Bir görev ancak öncülleri yerlerini aldıktan sonra sıraya gelir.

Öncelik, görev başına ayarladığınız 0 ile 1000 arasında bir sayıdır. Varsayılan değer 500'dür. Bir görev çubuğunun sağ tık menüsünde buna *Öncelik* denir; seçenekler *Düşük* (100), *Normal* (500) ve *Yüksek* (900)'dür. Daha önce sıraya gelen görev istediği yeri alır. Sonra gelen görevler ona uymak zorundadır. Öncelik, hangi görevin yerinde kalacağını ve hangisinin yol vereceğini böylece belirler. Değer 1000 özeldir: böyle bir görev kapasite nedeniyle asla kaymaz. Bu, MS Project'teki “Do Not Level” seçeneğidir.

### Bir görev nereye kayar

Uygulama her görev için, ilişkiler tarafından izin verilen en erken başlangıçla başlar. Bu, öncülleri de zaten kaymış olabilir diye hesaba katar. Görev orada sığarsa yerinde kalır. Sığmazsa uygulama görevin bir sonraki iş gününü dener, bu şekilde devam eder. Bir görev, görevin her gününde her kaynağın yeterince boş olmasıyla sığar. Bir görevin birden çok kaynağı varsa, hepsi o günlerde boş olmalıdır. Bu nedenle bir görev her zaman daha ileri tarihe kayar, asla daha erkene değil.

Uygulama kaymayı bir **dengeleme gecikmesi** olarak kaydeder. Bu, görevin takviminde, ilişkiler tarafından gerektirilenden kaç iş günü geç başladığını gösteren bir sayıdır. Bunu *Hesaplanan* altındaki *Kaynak dengeleme gecikmesi* sütununda görürsünüz. Gecikme proje dosyasıyla birlikte kaydedilir. *Hesapla* (F5) bunu, başlangıçtan önce ek bir bekleme süresi olarak hesaba katar. Ondan sonra gelen görevler, ilişkiler üzerinden birlikte kayar.

### Bolluk içinde veya ötesinde

*Yumuşatma* olmadan uygulama, görev sığana kadar aramaya devam eder. Bunun sonucunda proje bitiş tarihi kayabilir.

*Yumuşatma* açıkken bir görev, geç başlangıcından daha geç başlayamaz. Geç başlangıç, bitiş tarihi kaymadan başlayabileceği son gündür. Görev bu aralığa sığmazsa en erken yerinde kalır. Görev, bunun ardından *Kalan çakışmalar* altında görünür.

### Uygulamanın kaydırmadıkları

- Zaten başlamış veya bitmiş görevler. Yükleri sayılır, ama asla dengeleme gecikmesi almazlar.
- Öncelik 1000 olan görevler. Öncülleri izlerler, ama kapasite nedeniyle kaymazlar.
- Seçilen kaynaklara ait atamaları olmayan görevler, kilometre taşları ve fazlar. Bunlar yalnızca bir öncül kayarsa birlikte kayar.
- Malzeme. Bu asla dengelenmez.

### Öneri ve uygulama

*Hesapla* bir öneri oluşturur: kaydırılacak görevler, eski ve yeni başlangıçlarıyla, ve bitiş tarihi önce ve sonra. *Uygula* seçene kadar planlamada hiçbir şey değişmez. Ardından uygulama gecikmeleri görevlere yazar ve planlama hemen yeniden hesaplanır.

## Uygulamalı örnek: iki duvarda duvarcı

Bu örnek, eğitim 5'teki dengelemeden hemen önceki hâliyle *House extension* alıştırma projesidir. Eğitim 5'te bunu kendiniz yaparsınız ve sayıları kontrol edersiniz. Bu örnekte sıva işi *Sabit iş* türündedir ve sıvacı 2 birimle çalışır; bu, [Görev türleri: süre, birim ve iş](docs://uitleg-werkregels) bölümündeki gibidir.

Boşluklu döşeme Pazartesi 28 Haziran'da bitince, iç yaprak (5 iş günü) ve dış yaprak (6 iş günü) ikisi de Salı 29 Haziran'da başlar. İkisi de duvarcıya atanmıştır; birim 1 ve *Maks. birim* 1'dir. İç yapraktan sonra çatı elemanları (6 saatlik bir vinç işi) ve çatı kaplama (2 iş günü) gelir. Pencere çerçeveleri çatı kaplamayı ve dış yaprağı bekler. Teslim Pazartesi 30 Ağustos'tadır.

### Aşırı atanmışlık

İç yaprak 29 Haziran'dan 5 Temmuz dahil, dış yaprak 29 Haziran'dan 6 Temmuz dahil sürer. 29 Haziran ile 5 Temmuz dahil, yani 5 iş günü boyunca, planlama, kapasitesi 1 olan bir duvarcıdan 2 birim ister. Duvarcı bu 5 günde aşırı atanmış olur.

### Sıra

İki görevin de önceliği 500'dür. Pencere çerçeveleri yalnızca 14 Temmuz'da teslim edilir (eğitim 3'te bunun için *Şu tarihten önce başlamaz (SNET)* adlı bir kısıtlama ayarlarsınız). Sonuçta iç yaprağın 3 iş günü, dış yaprağın 5 iş günü bolluğu vardır. İç yaprağın en az bolluğu vardır, bu yüzden önce gelir. 29 Haziran'dan 5 Temmuz dahil yerinde kalır.

### Kayma

Dış yaprak 29 Haziran'da başlayamaz. Duvarcının yeniden boş olduğu ilk gün Salı 6 Temmuz'dur. Bu, en erken başlangıçtan 5 iş günü sonra demektir; bu nedenle dengeleme gecikmesi 5'tir. Dış yaprak şimdi 6 Temmuz'dan 13 Temmuz dahil sürer. Çerçeveler zaten yalnızca 14 Temmuz'da başlar; bu yüzden teslim Pazartesi 30 Ağustos'ta kalır. Pencere *Proje bitiş tarihi: değişmedi (30-08-2027)* iletisini verir ve tek bir satır gösterir: *Build outer cavity leaf*, eski başlangıç 29-06-2027, yeni başlangıç 06-07-2027, *5 g*.

Kaydırılan 5 iş günü, dış yaprağın bolluğunun tam olarak aynısıdır. Bu yüzden *dengeleme* burada aynı sonucu verir. Dış yaprağın artık bolluğu kalmadı ve kritiktir.

### Çerçeveler 14 Temmuz'da gelmezse

Bu kısıtlama olmadan çerçeveler Cuma 9 Temmuz'da başlayabilir ve teslim Çarşamba 25 Ağustos'tadır. Dış yaprağın o zaman yalnızca 2 iş günü bolluğu kalır.

- *Dengeleme* olmadan dış yaprak yine 5 iş günü kayar. Şimdi çerçevelerin beklemesi gerekir: 14 Temmuz'da başlarlar, 3 iş günü daha geç. Onlardan sonra gelen her şey de kayar ve teslim 25 Ağustos'tan 30 Ağustos'a geçer; bu da 3 iş günü daha geç demektir.
- *Dengeleme* açıkken hiçbir şey kaymaz. Dış yaprak, 2 iş günlük bolluğuna sığmaz. Pencere şu çakışmayı gösterir: *Build outer cavity leaf*, 5 gün, nedeni: *Bu çakışmayı çözmek için bolluk içinde yeterli boş kapasite yok.*

### Dış yaprak öncelik alırsa

Dış yaprağa öncelik *Yüksek* (900) verirseniz, o önce gelir. 29 Haziran'da yerinde kalır ve şimdi iç yaprak yol verir: 6 iş günü daha geç, 7 Temmuz'dan 13 Temmuz dahil. İç yaprağın yalnızca 3 iş günü bolluğu var; 6 iş günü kaydırmak bu yüzden 3 gün fazla olur. Çatı elemanları, çerçeveler ve sonrasındaki her şey birlikte kayar. Teslim Pazartesi 30 Ağustos'tan Perşembe 2 Eylül'e geçer. Bu yüzden aynı aşırı atanmışlık, hangi görevin yerinde kaldığına bağlı olarak farklı bir bitiş tarihi verir.

### Ya ikinci bir duvarcı gelirse

Duvarcının *Maks. birim* değerini 2 yaparsanız artık aşırı atanmışlık olmaz. *Hesapla* şu iletiyi gösterir: *Hiçbir görevin taşınması gerekmiyor — plan zaten çakışmasız.*

## Sonuçlar ve yanlış anlamalar

**“Dengeleme en kısa planlamayı bulur.”** Hayır. Uygulama görevleri sabit bir sırayla, teker teker çalışır ve en iyi genel çözümü aramaz. Önceliğe ilişkin örneğe bakın: başka bir öncelik başka bir bitiş tarihi verir.

**“Dengelenmiş bir görev güvendedir.”** Dengeleme bolluğu kullanır. Kaydırılmış görevin o zaman daha az bolluğu kalır veya hiç kalmaz; yukarıdaki dış yaprak gibi kritik olabilir. Sonra gecikirse teslim kayar.

**“Dengeleme sonraki değişikliklerimi izler.”** Hayır. Gecikme sabit bir iş günü sayısıdır. Dengelemeden sonra iç yaprak kısalırsa dış yaprak yine 5 iş günü daha geç başlar; oysa artık gerek yoktur. O hâlde yeniden dengeleyin. Uygulama sıfırdan başlar.

**Her şey kaydırmayla çözülemez.** Kaynak, görevin ihtiyaç duyduğu günlerde çalışmıyorsa veya görevin eğrisi bir günde kaynağın sağlayabileceğinden fazlasını isterse, aşırı atanmışlık kalır. Uygulama bunun nedenini görevde belirtir.

**Malzeme dengelenmez.** Malzeme bir günde kapasitesinden fazla isterse uygulama bunu aşırı atanmışlık olarak bildirir, ama dengeleme onu olduğu gibi bırakır.

**Sabitlenmiş görevler.** Çakışan tüm görevler öncelik 1000'deyse pencere *Hiçbir görevin taşınması gerekmiyor — plan zaten çakışmasız.* iletisini gösterir, ama aşırı atanmışlık kalır. Bu yüzden uygulamadan sonra şeritteki *Aşırı atama* iletisine bakın.

## Ayrıca bakın

- [Aşırı atanmışlığı çözme](docs://howto-overbezetting-oplossen): aşırı atanmışlığı bulmak ve dengelemek için adımlar.
- [Kritik yol ve bolluk](docs://uitleg-kritiek-pad): bolluğun ne olduğu ve bir görevin neden kritik olduğu.
- [Görev türleri: süre, birim ve iş](docs://uitleg-werkregels): bir görevin süresinin birimlerle birlikte nasıl değiştiği.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): üç kulenin aynı ekiplere ve kule vincine ihtiyaç duyması ve dengelemenin bununla ne yaptığı.
