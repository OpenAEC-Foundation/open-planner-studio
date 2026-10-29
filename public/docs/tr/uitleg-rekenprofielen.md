# Hesaplama profilleri ve kurallar

Aynı planlama, hangi hesaplama kurallarını uyguladığınıza bağlı olarak farklı tarihler verebilir. Bu makale, Primavera P6 ile Microsoft Project'in birkaç noktada neden farklı hesapladığını açıklar. Ayrıca uygulamanın bu farkı bir **hesaplama profili** içinde nasıl kaydettiğini anlatır. Bir profilin, proje bazında kendiniz ayarladığınız hesaplama seçeneklerinden nasıl farklı olduğunu da gösterir. Küçük bir ağ üzerinde işlenmiş bir örnek, bunun tarihleri nasıl etkilediğini gösterir.

## Kavram

Görevler, ilişkiler ve bir takvim planlamanın çoğunu belirler, ama hepsini değil. Durum tarihini ayarladığınızda, henüz başlamamış işe ne olur? Zaten devam eden bir görevin kalan işi nerede başlar? Bir son tarih kaçırıldığında, bir görevin serbest bolluğu nedir? Ağ bu konuda bir şey söylemez. Bir planlama yazılımının bunun için bir kural seçmesi gerekir. Uygulama, Primavera P6'nın kuralıyla Microsoft Project'in kuralının farklı olduğu birkaç nokta bilir.

Uygulama böyle bir seçime bir **kural** adını verir. Bir **hesaplama profili**, tek bir yazılıma ait kurallar kümesidir. Uygulamada üç profil vardır:

- *Open Planner Studio*: Yeni bir projenin hesaplandığı profil. Hiçbir kural açık değildir.
- *Primavera P6*: Uygulamanın P6'dan bildiği kurallar.
- *Microsoft Project*: Uygulamanın Microsoft Project'ten bildiği kurallar.

Profil dolayısıyla bir yazılımın nasıl hesapladığını belirtir. Projenizden istediğiniz şey profilin parçası değildir. Bunlar **hesaplama seçenekleridir**: örneğin, bir görevin kritik sayılması için en fazla ne kadar bolluk olması gerektiği ya da bir gecikmenin hangi takvimde sayıldığı gibi seçimler. Bunları proje bazında siz ayarlarsınız.

## Uygulama nasıl hesaplar

### Kurallar ve hesaplama seçenekleri

Bir kural bir anahtardır: açık veya kapalı. Profil, hangi anahtarların açık olduğunu belirler. Bir hesaplama seçeneği ise sizin yaptığınız bir seçimdir. Farkı uygulamada kendisinde görebilirsiniz, *Hesaplama profili ve seçenekleri* bloğunda:

- **Kurallar** *Bu profilin kuralları* bölümünde yer alır. Konuya göre gruplanmıştır, örneğin *İlerleme ve tamamlanan iş*, *İlişkiler ve gecikme* ve *Bolluk ve geç tarihler*. Bu bölüm ilk başta kapalıdır. Başlığı, kaç kural olduğunu gösterir. Profil sapıyorsa, başlıkta ayrıca *değiştirildi: 1* etiketi görünür. Bölümü açmak için başlığa tıklayın. Yerleşik bir profilde her satırda *AÇIK* veya *KAPALI* etiketi vardır. Bu değerler bilgi amaçlıdır, değiştirilemez. Özel bir profilde her satırda bir onay kutusu vardır. Onay kutusunun yanında temel değer yazılıdır (*temel: açık* veya *temel: kapalı*). Seçiminiz bu değerden farklıysa, satır öne çıkar ve *temele dön* görünür. Satırdan sonraki i simgesi o kuralın açıklamasını gösterir. Bu simgenin üstüne fareyle gelin, Tab tuşuyla ona gidin veya dokunun. Bir kuralı değiştirmek istiyorsanız, önce bu açıklamayı okuyun. Bir kural yalnızca saat planlamasıyla veya yalnızca .xer dosyasındaki görevlerle ilgiliyse, yanında mavi bir etiket bunu söyler: *yalnızca saat planlamasında* veya *yalnızca .xer görevleri*. Saat planlaması şu anlama gelir: çalışma bantları olan bir takvim, süresi saat cinsinden olan bir görev veya *Gecikme takvimi* alanının *24 saat* olarak ayarlanmış olması. Yalnızca gün takvimi ve günlerle ölçülen görevleri olan bir proje, *yalnızca saat planlamasında* etiketli bir kuralın hiçbir etkisini fark etmez. Gecikme takvimi *24 saat* olarak ayarlanmışsa bu geçerli değildir: o zaman gecikme saat olarak sayılır ve gecikmeyle ilgili bir kural bir şeyi değiştirebilir.
- **Hesaplama seçenekleri** *Bu projenin hesaplama seçenekleri* bölümünde yer alır: diğerlerinin yanı sıra *Kritik tanımı*, *Bolluk hesaplaması*, *Açık uçlu görevler kritik*, *Kritiğe yakın olarak işaretle* ve *Gecikme takvimi*. Bunlar bu proje için ne istediğinizi belirtir, bir yazılımın nasıl hesapladığını değil. Ne yaptıkları [Kritik yol ve bolluk](docs://uitleg-kritiek-pad) ve [İlişkiler ve gecikme](docs://uitleg-relaties) makalelerinde açıklanır.

Her birine bir örnek. “Bir görevin toplam bolluğu 0 veya daha azsa kritiktir” bir hesaplama seçeneğidir: eşiği 4 olarak ayarlayabilirsiniz. Bu durumda 4 iş günü veya daha az bolluğu olan her şey kritik olur. “Henüz başlamamış iş durum tarihine taşınır” bir kuraldır: Open Planner Studio ve Primavera P6 bunu yapar, Microsoft Project yapmaz.

Profil ve hesaplama seçenekleri uygulamaya değil, proje dosyasına aittir. Projeyi kaydederseniz, bunlar onunla birlikte taşınır. Bu yüzden aynı uygulamadaki iki proje farklı bir profille hesaplayabilir. Profili olmayan bir proje, Open Planner Studio olarak hesaplanır.

Projeniz bir .xer dosyasından geliyorsa, blokta ayrıca altta *Kaynak dosyadaki ayarlar* görünür. Bunlar yalnızca Primavera P6'nın bildiği ve dosyayla birlikte gelen hesaplama seçenekleridir. Bunları burada değiştiremezsiniz. Varsayılan ayarlar düğmesi ve başka bir profil seçmek de bunları olduğu gibi bırakır. Yeni bir proje bunlara sahip değildir, *Primavera P6* seçseniz bile.

### Profili nerede seçersiniz

Yeni bir proje için profil, *Yeni proje* penceresindedir. Bu pencereyi *Ana sayfa › Dosya › Yeni* yolunu izleyerek açarsınız. Orada *Hesaplama profili* bir açılır listedir. Orada bir profil seçerseniz, uygulama daha önce doldurduğunuz hesaplama seçeneklerini o profilin varsayılanlarıyla değiştirir. Yalnızca kaynak dosyadaki ayarlar kalır. *Primavera P6* ile *Bolluk hesaplaması* o zaman *Bitiş bolluğu* olur. *Microsoft Project* ve *Open Planner Studio* ile her hesaplama seçeneği varsayılan değerindedir. Bu yüzden *Bolluk hesaplaması* *Otomatik (varsayılan)* olur. Bir durum tarihiyle MS Project'in kendisi de bu şekilde hesaplar: başlamış bir görev bitiş bolluğunu alır, diğer her görev ise başlangıç ve bitiş bolluğunun küçüğünü alır.

Mevcut bir proje için profili *Ayarlar › Proje › Proje ayarları* altında, *Hesaplama profili ve seçenekleri* bloğunda, *Hesaplama profili* açılır listesinde seçersiniz. Aynı yere *Dosya › Proje ayarları* yolunu izleyerek de ulaşabilirsiniz. Burada profili değiştirmek yalnızca kuralları değiştirir. Hesaplama seçenekleriniz olduğu gibi kalır. Hesaplama seçenekleriniz profilin varsayılanından farklıysa, seçeneklerin üstündeki turuncu blok bunu söyler. Bu çoğu zaman bilerek yapılmıştır, örneğin seçenekler açılan dosyadan geldiği için. Yine de varsayılanı istiyorsanız, bu blokta *… varsayılan ayarlarını kullan* seçeneğini seçin. Çarpı işareti bu açılan dosya için bloğu gizler.

*Uygula* düğmesine basana kadar bir değişiklik yalnızca formda bulunur. *Uygula* ile uygulama planlamayı hemen yeniden hesaplar. Bunu *Otomatik hesapla* kapalı olsa bile yapar. Görevler taşındıysa, kaç görev taşındığını söyler, örneğin *Uygulamadan sonra 4 görev kaydı.* Bu geçişin tamamı *Geri al* için tek bir adımdır. Proje ayarları açıkken *Geri al* veya *Yinele* basarsanız, blok projenin durumunu izler. Blokta kendiniz bir şey değiştirdiyseniz, seçiminiz kalır ve sarı bir blok, *Uygula* düğmesinin bu seçimi yeniden uygulayacağını söyler.

Üç yerleşik profil değiştirilemez. Başka kurallar için özel bir profil oluşturursunuz; bunu bu uygulamadaki diğer projeler için şablon olarak da saklayabilirsiniz. Proje her zaman kendi kopyasını taşır: şablonu daha sonra değiştirirseniz, proje onunla birlikte değişmez. Adımlar [Bir hesaplama profili seçme veya oluşturma](docs://howto-rekenprofiel-kiezen) makalesinde yer alır.

### Uygulama profili kendisi ne zaman seçer

Bir dosya açtığınızda, uygulama biçime göre bir profil önerir:

- Bir .mpp dosyası (Microsoft Project) *Microsoft Project* profiliyle açılır.
- Bir .xer dosyası (Primavera P6) *Primavera P6* profiliyle açılır.
- *MS Project XML*, *Primavera P6 XML* veya *CSV (noktalı virgülle ayrılmış)* biçimindeki bir dosya, profil mesajı olmadan *Open Planner Studio* ile açılır.
- Kendi projeniz (.ifc) kendi içinde kayıtlı profille açılır.

Bir .mpp veya .xer dosyası için uygulama profili bildirir: *Bu proje Microsoft Project olarak hesaplanıyor. Değiştirmek için “Dosya” → “Proje Bilgileri” → “Hesaplama profili ve seçenekleri” yolunu izleyin.* Mesajdaki *Hesaplama profilini aç* düğmesi sizi doğrudan Proje ayarlarına götürür. Bir .xer dosyasında bu satır, dosyanın açılış mesajındaki ilk ayrıntı satırıdır. Mesaj hakkında daha fazlası şu makalelerde yer alır: [Bir Primavera P6 dosyasını (.xer) açma](docs://howto-xer-openen) ve [Bir MS Project dosyasını (.mpp) açma](docs://howto-mpp-openen).

Bir .mpp dosyası için uygulama yalnızca profili ayarlar. Hesaplama seçenekleri boş kalır; tıpkı *Microsoft Project* profiliyle yeni bir projede olduğu gibi: *Bolluk hesaplaması* *Otomatik (varsayılan)* olur. Açılmış bir .mpp dosyası ile *Microsoft Project* profiliyle yeni bir proje bu yüzden bolluğu aynı şekilde hesaplar.

## Örnek: bir ağ, üç profil

Bu örnek küçük bir ağdır. Takvimde Pazartesi'den Cuma'ya kadar bir iş haftası vardır ve bu haftalarda tatil günü yoktur. İlerleme modu Retained Logic'tir (varsayılan). Proje Pazartesi, 7 Haziran 2027'de başlar. Tüm görevler iş günü cinsindendir.

- *Pour foundation*: 5 iş günü, Pazartesi 7 Haziran'dan başlayarak planlanmış.
- *Lay walls*: 5 iş günü, *Pour foundation* görevinden sonra (bitiş-başlangıç).
- *Order window frames*: 3 iş günü, öncülü yok, Pazartesi 7 Haziran'dan başlayarak planlanmış.
- *Fit roof*: 2 iş günü, *Lay walls* ve *Order window frames* görevlerinden sonra. Bu görevin bitişi teslimdir.

Sayılar uygulamanın hesaplama motoruyla hesaplandı. Bunları *Özellikler* panelinde, *CPM Sonucu* altında okursunuz.

**Durum tarihi ve ilerleme olmadan, üç profil de bu ağı aynı hesaplar.** *Pour foundation* Pazartesi 7'den Cuma 11 Haziran'a kadar sürer. *Lay walls* Pazartesi 14'ten Cuma 18 Haziran'a kadar sürer. *Fit roof* Pazartesi 21 ve Salı 22 Haziran'da sürer. Teslim Salı 22 Haziran'dır. *Order window frames* (Pazartesi 7'den Çarşamba 9 Haziran'a kadar) 7 iş günü toplam bolluğa sahiptir.

Şimdi durumu kaydedersiniz. Durum tarihi Çarşamba 9 Haziran'dır. Temel Pazartesi 7 Haziran'da başladı ve %60 seviyesinde duruyor. Kalan iş bu nedenle 2 iş günüdür (5 × %40). *Order window frames* başlamadı. [İlerleme ve durum tarihi](docs://uitleg-voortgang) makalesinde bunların nasıl çalıştığı yer alır. Burada soru, profilin bununla ne yaptığıdır.

### Open Planner Studio

Temelin kalan işi durum tarihinde başlar: Çarşamba 9 ve Perşembe 10 Haziran. Erken başlangıç, gerçek başlangıç olarak kalır: Pazartesi 7 Haziran. Erken bitiş Perşembe 10 Haziran'dır. *Lay walls* Cuma 11'den Perşembe 17 Haziran'a kadar sürer. *Fit roof* Cuma 18 ve Pazartesi 21 Haziran'da sürer.

*Order window frames* Pazartesi 7 Haziran'a planlanmıştı, ama başlamadı. Henüz başlamamış iş geçmişte olamaz. Bu nedenle uygulama onu durum tarihine taşır: Çarşamba 9'dan Cuma 11 Haziran'a kadar, 4 iş günü toplam bolluk ile. Teslim Pazartesi 21 Haziran'dır.

### Primavera P6

Her şey Open Planner Studio ile aynıdır, bir nokta dışında: *Pour foundation* görevinin erken başlangıcı Çarşamba 9 Haziran'dır. Bu, gerçek başlangıç değil, kalan işin başlangıcıdır. Bunu, *İlerleme ve tamamlanan iş* grubundaki *Devam eden görev: erken başlangıç = kalan işin başlangıcı* kuralı sağlar. Bitiş ve bolluk bunun yüzünden değişmez. Teslim Pazartesi 21 Haziran'dır.

### Microsoft Project

Burada tarihler farklıdır. *Microsoft Project gibi ilerleme* grubundaki iki kural bunun nedenidir.

*Başlamamış görevleri durum tarihine taşıma*: *Order window frames* Pazartesi 7'den Çarşamba 9 Haziran'a kadar kalır. Bu, kısmen durum tarihinden öncesine denk gelse de böyle kalır. Toplam bolluk 7 iş günüdür.

*Kalan iş geçen süreden sonra devam eder*: kalan iş ne durum tarihinden önce ne de gerçek başlangıç artı zaten geçen süreden önce başlamaz. 5 iş gününün %60'ı 3 iş günüdür ve tamamlanmıştır. Pazartesi 7 Haziran artı 3 iş günü Perşembe 10 Haziran'dır. Bu durum tarihinden sonradır, bu yüzden kalan iş Perşembe 10 ve Cuma 11 Haziran'da sürer. *Lay walls* Pazartesi 14'ten Cuma 18 Haziran'a kadar sürer. *Fit roof* Pazartesi 21 ve Salı 22 Haziran'da sürer. Teslim Salı 22 Haziran'dır: diğer iki profilden bir iş günü sonra.

### Ya olursa?

**Temel, %60 yerine %20 seviyesindedir.** Kalan iş o zaman 4 iş günüdür. Üç profilin hepsinde temel Pazartesi 14 Haziran'da biter ve teslim Çarşamba 23 Haziran'dır. Kalan iş için Microsoft Project kuralı burada bir fark yaratmaz: Pazartesi 7 Haziran artı 1 geçen iş günü Salı 8 Haziran'dır ve bu durum tarihinden öncedir. Böyle bir kural bir alt sınırdır. Kalan işi yalnızca daha sonraya kaydırabilir. *Order window frames* ile Primavera P6 altındaki erken başlangıç, yukarıda olduğu gibi yine farklıdır. Microsoft Project altında *Order window frames* o zaman 8 iş günü toplam bolluğa sahiptir.

**Yalnızca bir durum tarihi ayarlarsınız ve ilerleme girmezsiniz.** Open Planner Studio ve Primavera P6 altında tüm ağ Çarşamba 9 Haziran'a taşınır. Temel o zaman Çarşamba 9'dan Salı 15 Haziran'a kadar sürer ve teslim Perşembe 24 Haziran olur. Bu, durum tarihi olmadan olduğundan iki iş günü sonradır. Microsoft Project altında her şey olduğu yerde kalır ve teslim Salı 22 Haziran'dır.

**Bir profili kendiniz oluşturursunuz.** Open Planner Studio altında *Yeni profil* ile özel bir profil oluşturun, *Open Planner Studio kopyası*. Bunda yalnızca *Başlamamış görevleri durum tarihine taşıma* kuralını açın. %60 ilerlemeyle temel o zaman Open Planner Studio tarihlerini korur (bitiş Perşembe 10 Haziran, teslim Pazartesi 21 Haziran). *Order window frames* Pazartesi 7'den Çarşamba 9 Haziran'a kadar kalır, 6 iş günü toplam bolluk ile. Yani bir profil ayrı anahtarlardan oluşan bir pakettir ve bunları tek tek değiştirebilirsiniz.

**Bir kural yerine bir hesaplama seçeneği.** Open Planner Studio altında *Kritik tanımı* (*Toplam bolluk ≤ eşik*) ayarında *Eşik (iş günü)* değerini 4 olarak ayarlarsanız, *Order window frames* kritik olur, çünkü toplam bolluğu tam olarak 4'tür. Hiçbir tarih değişmez. Bir hesaplama seçeneği projeniz için yaptığınız bir seçimdir ve profilden bağımsızdır.

**Kaçırılan bir son tarih.** *Fit roof* görevine Cuma 18 Haziran için bir son tarih verin. Open Planner Studio altında *Fit roof* görevinin toplam bolluğu o zaman −1 iş günü, serbest bolluğu da −1'dir. Primavera P6 altında toplam bolluk −1 kalır, ama serbest bolluk 0 olur. Bunu, *Bolluk ve geç tarihler* grubundaki *Serbest bolluk asla negatif değil* kuralı yapar. Microsoft Project altında ikisi de −2'dir, çünkü teslim orada bir gün sonra düşer. Bir son tarihin nasıl çalıştığı [Kısıtlamalar ve son tarihler](docs://uitleg-constraints) makalesinde yer alır.

## Sonuçlar ve yanlış anlamalar

**“Profil uygulamanın bir ayarıdır.”** Hayır. Profil ve hesaplama seçenekleri projeye aittir ve dosyayla birlikte taşınır. Yalnızca sakladığınız şablonlar uygulamaya aittir. Bir proje ise her zaman kendi kopyasını saklar.

**“Dışa aktarırsam profilim de onunla gider.”** Yalnızca kendi proje biçiminizde (.ifc) gider. *MS Project XML*, *Primavera P6 XML* veya *CSV (noktalı virgülle ayrılmış)* olarak dışa aktarırsanız profil dosyada yer almaz. Hesaplama seçeneklerinden MS Project XML dışa aktarımı en fazla kritik eşiği yazar. Uygulama bunu yalnızca .xer dosyasından gelen bir proje için uyarır. Kendiniz oluşturduğunuz bir proje için hiçbir ileti almazsınız. Dosya bunun ardından Open Planner Studio olarak açılır, profil iletisi olmadan. Bir örneğe bakın: Microsoft Project profili ve %60 ilerleme. Bunu *MS Project XML* olarak dışa aktarıp yeniden açarsanız uygulama önce dosyadaki tarihleri gösterir; teslim Salı 22 Haziran'dır. Uygulamanın kendisini yeniden hesaplamasına izin verirseniz bu Pazartesi 21 Haziran olur. Dışa aktarmanın başka neyi kaybettiği, [Dosyalar ve biçimler](docs://uitleg-bestanden) sayfasında yer alır.

**“Primavera P6 profili, P6 ile aynı sonucu verir.”** Uygulama bunu garanti edemez. Profil, uygulamanın P6'dan bildiği kuralları açar; bunlar P6'nın tüm ayarları değildir. Retained Logic ve Progress Override'a ek olarak P6'da üçüncü bir ilerleme modu vardır: Gerçek Tarihler. Uygulama bunu bilmez: böyle bir .xer dosyası Retained Logic olarak hesaplanır ve açılış iletisi bunu bildirir; örneğin *1 P6 planlama ayarı güvenli geri dönüş kullandı.* Primavera P6 profilinin bazı kuralları da yalnızca .xer dosyasından gelen görevlerde çalışır; örneğin *Başlamamış LOE hedef pencereyi alır* ve *Gerçek tarihleri aynen al*. Bazıları için açıklama bunu belirtir: “yalnızca P6 kökenli görevler”. Kendiniz oluşturduğunuz görevlerde bu kurallar hiçbir şey yapmaz.

**“İlerleme modu profilin bir parçasıdır.”** Hayır. Retained Logic veya Progress Override, proje başına ayrı bir seçimdir. Bunu profilden ayrı ayarlarsınız, bkz. [İlerleme modunu seçme](docs://howto-voortgangsmodus-kiezen). Bir Primavera P6 kuralı, *Progress Override başlamış bir ardılı geriye doğru da yok sayar*, yalnızca Progress Override modunda bir şey yapar.

**“Profili değiştirip ne olduğuna bakarım.”** Bunu yapabilirsiniz, çünkü *Uygula* tek bir adımdır ve *Geri al* ile geri alınabilir: profil ve tarihler birlikte geri döner. Tarihler yine de gerçekten kayabilir. Örnekte, Open Planner Studio'dan Microsoft Project'e geçmek 4 görevin tümünü kaydırır. İleti bu görevleri sizin için sayar. Bunu yaptıktan sonra, devam etmeden önce planlamaya bakın. Bir .xer veya .mpp dosyasını açtıktan sonra uygulama hâlâ dosyadaki tarihleri gösteriyorsa, profil değişikliği bu görünümü kapatır ve uygulama kendisi hesaplar. Bunun nasıl çalıştığı [Kaydedildiği gibi tarihler](docs://uitleg-datums-zoals-opgeslagen) sayfasında yer alır.

**Örnekte dört kural var, uygulamadaki liste ise daha uzun.** Bloktaki her satırın kendi açıklaması vardır. Önce onu okuyun. Ayrıca *Yalnızca özel profiller için* grubuna bakın: bu kurallar her yerleşik profilde, Primavera P6 dahil, kapalıdır. Bunları yalnızca özel bir profil açabilir: *Yeni profil* ile bir tane oluşturun.

## Ayrıca bakın

- [Hesaplama profili seçme veya oluşturma](docs://howto-rekenprofiel-kiezen): bir profil seçin, değiştirin veya oluşturun.
- [İlerleme, durum tarihi ve temel plan](docs://uitleg-voortgang): durum tarihinin ve kalan işin ne yaptığı, profil başına farklarla.
- [İlerleme modunu seçme](docs://howto-voortgangsmodus-kiezen): Retained Logic veya Progress Override seçmek.
- [Kritik yol ve bolluk](docs://uitleg-kritiek-pad): kritik ve bolluk için hesaplama seçenekleri.
- [İlişkiler ve gecikme](docs://uitleg-relaties): hesaplama seçeneği *Gecikme takvimi*.
- [Dosyalar ve biçimler](docs://uitleg-bestanden): bir dışa aktarımın neyi taşıdığı ve neyi taşımadığı.
- [Dışa aktarma](docs://howto-exporteren): bir projeyi dışa aktarma.
- [İlerlemeyi güncelleme](docs://howto-voortgang-bijwerken): yüzdeyi, gerçek başlangıcı ve durum tarihini girme.
- [Kaydedildiği gibi tarihler](docs://uitleg-datums-zoals-opgeslagen): içe aktarılan tarihlerin uygulamanın kendi hesapladığından neden farklı olabileceği.
- [Hesaplama seçenekleri ve kurallar](docs://ref-rekenopties-en-conventies): tüm kuralların ve hesaplama seçeneklerinin tek listesi.
