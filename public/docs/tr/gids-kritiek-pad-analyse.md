# Kritik yol & ileri düzey analiz

Her planın, birlikte projenin ne zaman biteceğini belirleyen en uzun görev zinciri vardır: kritik yol. Bunun dışındaki her şeyin bolluğu vardır — bitiş tarihine dokunmadan kayabilecek alan. Bu kılavuz, "hangi çubuklar kırmızı"nın ötesine geçer: toplam/serbest/müdahale bolluğu, kritiğe yakın iş, birden çok eşit derecede kritik yol, hammock'lar, sıkı sabitlemeler ve bunların yukarı akış etkisi, ve projeler arasındaki dış bağlantılar.

## Burada neler öğreneceksiniz

- Kritik yolu okuma, ve toplam, serbest ve müdahale bolluğu arasındaki fark.
- Kritiğe yakın iş: eşiği ayarlama ve amber işaretlemeyi tanıma.
- Aynı anda birden çok kritik yol — bu ne zaman olur ve nasıl görürsünüz.
- Sıkı sabitlemeler ve bunların bolluğa etkisi, yukarı akışta ortaya çıkan negatif bolluk dahil.
- Hammock'lar (Level of Effort): ne yaptıkları ve ne yapmadıkları.
- Projeler arasındaki dış bağlantılar: dondurulmuş bağlantı noktası, yenileme ve "kaynak eksik" durumu.
- Bağlam menüsü veya şerit üzerinden bir yolu izleme.
- Proje ayarlarındaki **Hesaplama** bölümü.

Bu kılavuzdaki neredeyse her konuyu gösteren üç paralel kuleli büyük, "her şeyi kapsayan" örnek proje [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc)'i takip edin: birden çok kritik yol, kritiğe yakın iş, bir hammock, bir sıkı sabitleme ve ayrı bir kaynak dosyasına dış bağlantı.

## Kritik yolu okuma

Planı çalıştırmak için **F5**'e (veya **Hesapla** düğmesine) basın. Durum çubuğu altta daha sonra örneğin "Kritik yol: N görev, M iş günü" gösterir — kritik yoldaki görev sayısı ve toplam süre. Gantt şemasında, kritik görevler kendi (kırmızı) çubuk rengini alır: bolluğu olmayan, her gecikme gününün doğrudan projenin bitiş tarihini geciktirdiği görevler.

Bir göreve çift tıklayın ve tam sayılar için **CPM Sonucu** bölümüne bakın: **Erken başlangıç**, **Erken bitiş**, **Geç başlangıç**, **Geç bitiş**, **Toplam bolluk**, **Serbest bolluk** ve (uygunsa) **Müdahale bolluğu**, artı görevin **Kritik yol** üzerinde olup olmadığı. Bu alanları görev tablosunda sütun olarak mı istiyorsunuz? **Görünüm → Sütunlar…** ve onları işaretleyin.

### Toplam, serbest ve müdahale bolluğu

- **Toplam bolluk** — bir görevin, projenin bitiş tarihine dokunmadan toplamda ne kadar kayabileceği. Sıfır kritik anlamına gelir.
- **Serbest bolluk** — bir görevin, bir sonraki ardılına dokunmadan ne kadar kayabileceği. Toplam bolluktan daha küçük olabilir: bir görevin biraz toplam bolluğu olabilir, ama tek bir gün kaydığında hemen ardılı da zaten hareket eder (o ardılın da bitişe dokunmayacak kadar kendi bolluğu vardır).
- **Müdahale bolluğu** — ikisi arasındaki fark (toplam bolluk − serbest bolluk): bolluğunuzun bitişe dokunmayan ama bir ardılın "yoluna çıkan" kısmı. Sıfır, serbest ve toplam bolluğun eşit olduğu anlamına gelir — bolluğunuz içinde kaymak o zaman kimseyi etkilemez.

## Kritiğe yakın iş

Küçük, sıfır olmayan bir toplam bolluğa sahip bir görev savunmasızdır: küçük bir aksama onu sonuçta kritik yapar. Bunu **Proje bilgisi → Hesaplama → Kritiğe yakın olarak işaretle** üzerinden, iş günü (veya süre gösteriminize bağlı olarak saat) cinsinden bir **Eşik** ile açın. Toplam bolluğu sıfırdan büyük ve bu eşikten küçük veya eşit olan her görev, Gantt'ta bir amber çubuk rengi alır — kritiğin kırmızısı ile bol bolluğun yeşili arasında.

Büyük örnek proje eşiği 3 iş gününe ayarlar. **Kule C**'nin nihai denetimi bu nedenle tam olarak 3 iş günü toplam bolluğa sahiptir — eşiğin tam içinde — ve **Kule A** ile **Kule B**'nin aynı nihai denetimleri sıfır bolluktadır ve gerçekten kritiktir. Kule C, biraz daha kısa bir ince işler görevi dışında görevleri ve süreleri açısından diğer ikisiyle aynıdır; bu küçük fark, onu kritikten kritiğe yakına taşımaya tam olarak yeter.

## Birden çok kritik yol

Normalde tam olarak bir en uzun zincir vardır, ama iki veya daha fazla zincirin tam olarak aynı uzunlukta olması olabilir — o zaman ikisi de (veya hepsi) eşit derecede kritiktir. Bunun hesaplanmasını sağlamak için **Birden çok bolluk yolu**'nu (**Proje bilgisi → Hesaplama**) açın: **Yöntem**i (**Serbest bolluk (peeling)** veya **Toplam bolluk (sıralama)**) ve bir **Maks. yol** seçin. Her görev daha sonra bir **Bolluk yolu** numarası alır (1 = en kritik); bolluk yolu olmayan bir görev, hesaplanan yollardan hiçbirinde değildir.

Büyük örnek projede, Kule A ve Kule B görevler ve süreler açısından tamamen simetriktir — tam olarak aynı anda bitiyorlar. **Birden çok bolluk yolu**nu açar açmaz, sonuçlarda birden fazla yol görürsünüz (hesaplamada `criticalPaths.length` 1'den büyük): tek bir en uzun zincir değil, projeden geçen birkaç eşit derecede kritik zincir. Bu, "yanında biraz kritiğe yakın işi olan tek bir kritik yol"dan farklı bir sinyaldir — bu yollardan *herhangi birindeki* bir gecikme bitiş tarihini eşit şekilde etkiler, bu yüzden dikkatinizi tek bir zincire odaklayamazsınız.

## Sıkı sabitlemeler ve bolluğa etkileri

Bir **sıkı sabitleme** (bir MSO veya MFO kısıtlaması üzerindeki **Zorunlu (sabitleme mantığı)** onay kutusu), öncülleri mantıksal olarak buna aykırı olsa bile bir görevi bir tarihe sabitler. Büyük örnek proje bunu "Wegafzetting gemeente (vergunde stremmingsperiode)" (belediye yol kapatması, izin verilen kapatma dönemi) üzerinde kullanır: belediye kapatmaya yalnızca tam olarak o izin verilen tarihte izin verir, nokta — ağ mantığı onun etrafında bükülür.

Yukarı akış etkisi anlaşılması zor olan kısımdır: sabitlenmiş bir görevin öncülleri, sabitleme tarihine kadar mevcut olandan daha fazla zamana ihtiyaç duyarsa, bu öncüllerde **negatif bolluk** ortaya çıkar. Negatif bolluk bu nedenle bir hesaplama hatası değildir: motorun "bu önceki zincir artık sabitlemenin izin verdiği süreye sığmıyor" demesinin yoludur. Bir sıkı sabitlemenin yukarı akışında negatif bolluk görüyorsanız, soru "burada ne bozuk" değil, "bu iki şeyden hangisinin taviz vermesi gerekiyor: sabitleme tarihi mi, yoksa öncesindeki zincirin süresi mi" olmalıdır.

Not: büyük örnek projede, "Wegafzetting gemeente" etrafındaki tüm zincir — sabitlenmiş görevin kendisi dahil — uzun süredir tamamen tamamlanmıştır (gerçek başlangıç ve bitiş, durum tarihinden çok önce). Bu nedenle, sabitleme görevinin kendisi dahil, orada tüm 1. faz zinciri boyunca küçük bir kalıntı negatif bolluk görürsünüz: bu, yukarıda açıklanan "öncüller sığmıyor" senaryosu değil, bir durum tarihiyle birleşmiş zaten tamamlanmış görevlerin bir özelliğidir. Bu senaryoyu saf haliyle görmek için: durum tarihini geçici olarak temizleyin (**Baseline ve ilerleme** şerit grubu, **Durum tarihini temizle** düğmesi) ve yeniden hesaplayın — sabitleme görevi kendisi o zaman sıfır toplam bolluğa geri döner, ve negatif bolluk yalnızca önceki zinciri kasıtlı olarak sabitleme tarihinden önceki mevcut alandan daha uzun yaptığınızda görünür.

## Hammock'lar (Level of Effort)

Bir **hammock** (özellikler panelindeki **Hammock (türetilmiş süre)** onay kutusu), kendine ait bir süre girdisi olmayan bir görevdir: başlangıcı ve bitişi kendi ilişkilerinden otomatik olarak takip eder. Gelen **FS**/**SS** ilişkileri **başlangıç driver**'ını (en erken başlangıç) sağlar, gelen **FF**/**SF** ilişkileri **bitiş driver**'ını (en geç bitiş) sağlar — hammock kutusunu işaretler işaretlemez panel her ikisini de salt okunur olarak gösterir, böylece hangi görevlerin aralığı belirlediğini tam olarak görebilirsiniz. Bir bitiş driver'ı olmadan, aralık panelde bir uyarıyla sıfır uzunluğa döner.

Bir hammock'un yaptığı: bir süreyi kendiniz koruma zorunda kalmadan, bir iş parçasının tam aralığını bir tür kapsayıcı çubuk olarak gösterir — örneğin altta yatan işle tam olarak aynı süre boyunca literal olarak süren "denetim" veya "genel şantiye ek yükü" için kullanışlıdır. Bir hammock'un yapmadığı: CPM hesaplamasını etkileyen kendine ait kaynak veya mantık taşımaz — türetilmiş bir görünümdür, belirleyici bir görev değildir. Büyük örnek proje bunu "Ruwbouw toren A (LOE)" (kaba inşaat, A Kulesi) için kullanır: A Kulesinin ilk gerçek kaba-inşaat görevi başlar başlamaz başlayan ve sonuncusu biter bitmez biten, kendisi arada hiçbir yerde oturmayan bir hammock.

## Projeler arasındaki dış bağlantılar

Büyük projeler bazen birkaç ayrı yönetilen alt plandan oluşur — örneğin kendi ana planınız ve başka bir yüklenicinin yönettiği bir saha işleri paketi. Bir **dış bağlantı** (**İlişkiler** sekmesindeki düğme üzerinden açılan **Dış (projeler arası) bağlantı** penceresi), o dosyayı bir belge olarak açmak zorunda kalmadan, böyle başka bir dosyadaki bir göreve bir ilişki kaydeder.

Son kullanılan dosyalarınızdan bir **Kaynak dosya** seçersiniz (bu salt okunur olarak okunur, asla bir belge olarak açılmaz) veya elinizde kaynak dosya yoksa bir proje kimliği, görev kimliği ve bağlantı noktası tarihiyle **Manuel**'i doldurursunuz. Ardından **Yön**ü (öncül veya ardıl), **İlişki türü**nü (FS/SS/FF/SF) ve bir **Gecikme** seçersiniz. **Bağlantı noktası tarihi** — bağladığınız andaki kaynak görevin tarihi — kendi dosyanızda dondurulur; kaynak proje değişirse bu tarih otomatik olarak takip etmez.

Kaynak dosyanın o zamandan bu yana güncellenip güncellenmediğini bilmek mi istiyorsunuz? **İlişkiler** sekmesine, **Dış bağlantılar** bölümüne gidin ve kaynak dosyayı yeniden okumak ve bağlantı noktasını güncellemek için **Bu bağlantıyı yenile**'ye (bağlantı başına) veya **Dış bağlantı noktalarını yenile**'ye (hepsini birden) tıklayın. Kaynak dosya kullanılamıyorsa — taşınmış, yeniden adlandırılmış veya hiç gönderilmemişse — bağlantı "kaynak yüklenmedi — yenilemek için yeniden içe aktarın" araç ipucuyla **eski** etiketini gösterir: uygulama o zaman dondurulmuş bağlantı noktasının hâlâ geçerli olup olmadığını kendisi doğrulayamaz.

Büyük örnek proje kasıtlı olarak tam olarak bu son yolu gösterir: "Bestrating parkeerterrein" (otopark döşemesi) görevi, örnekle kasıtlı olarak *gönderilmeyen* bir saha-işleri taşeronunun kaynak dosyasına bağlıdır. Görevi açın ve bağlantının "eski" durumuyla listelendiğini göreceksiniz — her zaman kusursuzca yenilenen bir bağlantı yerine, bir dış kaynak dosyası artık kullanılamadığında ne olduğunun dürüst bir gösterimi.

## Bir yolu izleme

Belirli bir görevi yukarı ve aşağı akışta hangi görevlerin etkilediğini tam olarak görmek mi istiyorsunuz? Göreve sağ tıklayın ve **Yolu izle**'yi (veya tekrar kapatmak için **Yol izlemeyi durdur**) seçin — bu, öncüllerin ve ardılların tüm zincirini tek seferde vurgular. Daha hedefli çalışma için, şerit (**Planlama** veya **İlişkiler** sekmesi, **Yol izleme** şerit grubu) ayrı bir çift düğmeye sahiptir **Öncüller**/**Ardıllar**: ikisi de kapalıyken hiçbir şey gösterilmez, biri açıkken o yönü gösterir, ikisi de açıkken bağlam-menüsü komutuyla aynıdır. İzleme ayrıca mantıksal olarak bağlı tüm görevler ile tarihi gerçekten **belirleyen** görevler arasında da ayrım yapar (ilişkiler tablosunda gösterilen aynı "Belirleyici" ilişki) — böylece yalnızca neyin bağlı olduğunu değil, neyin gerçekten yönlendirdiğini de görürsünüz.

## Hesaplama ayarları

**Proje bilgisi**'ndeki (Backstage → Proje bilgisi, veya **Proje bilgisi** penceresi) **Hesaplama** bölümü, bu belirli projeye ait hesaplama seçeneklerini toplar — bunlar uygulamaya değil dosyaya aittir, bu yüzden aynı dosyayı açan bir meslektaş aynı sonucu alır:

- **Kritik tanımı** — **Toplam bolluk ≤ eşik** (varsayılan eşik 0) veya **En uzun yol**, bu görevleri bolluk sayılarından bağımsız olarak ağdaki en uzun zincire göre kritik olarak işaretler.
- **Bolluk hesaplaması** — hem bir başlangıç hem de bir bitiş tarafı olan bir görev için toplam bolluğun nasıl belirlendiği: **En küçük (başlangıç/bitiş)** (varsayılan), **Başlangıç bolluğu** veya **Bitiş bolluğu**.
- **Açık uçlu görevler kritik** — ardılı olmayan görevleri otomatik olarak kritik sayar.
- **Kritiğe yakın olarak işaretle**, **Eşik** ile (yukarıya bakın).
- **Birden çok bolluk yolu**, **Yöntem** ve **Maks. yol** ile (yukarıya bakın).
- **Gecikme takvimi** — iş günü cinsinden bir gecikmenin hangi takvimi kullandığı: **Öncül**ün, **Ardıl**ın, her zaman **24 saat**, veya **Proje takvimi**.

## Okumaya devam edin

- Birden çok kritik yolu, kritiğe yakın işi, bir hammock'u, bir sıkı sabitlemeyi ve bir dış bağlantıyı tek bir planda birden görün: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- İlişkiler, gecikme/öne alma ve kısıtlamalar (sıkı sabitleme dahil) [İlişkiler & kısıtlamalar](docs://gids-relaties-constraints) kılavuzunda daha derinlemesine açıklanmıştır.
- Nivelleme kritik-yol yapısını değiştirebilir — [Kaynaklar, histogram & nivelleme](docs://gids-resources-histogram) kılavuzunu okuyun.
- İlerleme ve bir durum tarihi, zaten sabitlenmiş bir görevde negatif bolluk üretebilir — [Baseline'lar & ilerleme](docs://gids-baselines-voortgang) kılavuzunu okuyun.
