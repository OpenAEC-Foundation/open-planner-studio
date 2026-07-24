# Kaynaklar, histogram & nivelleme

Bir görev, bir şeyin ne zaman olması gerektiğini söyler; bir kaynak, bunu kimin ya da neyin yapacağını — ve belirli bir günde bundan ne kadarının mevcut olduğunu söyler. Görevlere kaynak atadığınız anda, bir gün var olan kapasiteden daha fazlasını talep edebilir: bir aşırı atama. Bu kılavuz, kaynakların nasıl yönetileceğini ve atanacağını, histogramda yükün nasıl okunacağını ve nivellemenin bir aşırı atamayı nasıl (ve ne zaman *çözmediğini*) gösterir.

## Burada neler öğreneceksiniz

- Beş kaynak türü ve her birinin ne zaman kullanılacağı.
- Kaynakları görevlere atama — özellikler paneli, görev iletişim penceresi veya şerit üzerinden.
- Birim/gün ve altı dağılım eğrisi: hangisini ne zaman seçmeli.
- Bir atamayı farklı bir göreve taşıma.
- Kaynak takvimleri ve zamana bağlı kapasite (örneğin daha sonra eklenen ikinci bir vinç).
- Histogramı okuma: kaynak seçici, kaynak başına derinlemesine inceleme, aşırı atamayı tespit etme.
- Gantt'ın yanındaki sabitlenmiş kaynak paneli.
- Nivelleme: **Kaynakları dengele** penceresindeki seçenekler, bolluk içinde kalma ile bitiş tarihinin kaymasına izin verme arasındaki fark, ve öncelikler (1000 önceliği = "dengelenmesin" dahil).
- Dürüst ders: nivelleme bir aşırı atamayı *çözmediğinde*.

[Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (orta boy, sıvacılarda kasıtlı ve nivelleme ile çözülebilir bir aşırı atama) ve [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc)'i (büyük, üç kule aynı ekipleri ve kule vincini aynı anda ihtiyaç duyduğu için neredeyse her kaynağın aşırı yüklendiği — nivellemenin sınırlarına dayandığı örnek proje) takip edin.

## Beş kaynak türü

Her kaynağın bir **Tür**ü vardır (kaynak panelinde bir sütun):

- **İşçilik (LABOR)** — meslek erbabı: duvarcılar, sıvacılar, montajcılar.
- **Ekipman (EQUIPMENT)** — makineler ve donanım: bir kule vinci, bir inşaat asansörü.
- **Malzeme (MATERIAL)** — bir **Birim**e sahip (örneğin m³ beton) sarf malzemeleri. Malzeme asla nivellenmez ve histogramda asla sayılmaz — taşabilecek günlük bir kapasite değil, bir stoktur.
- **Taşeron (SUBCONTRACTOR)** — kendi kapasite tavanı olan dış bir şirket, örneğin aynı anda yalnızca iki ekip çıkarabilen bir cephe yüklenicisi.
- **Ekip (CREW)** — bir şemsiye grup. Diğer kaynaklar, gruplama/genel bakış için panelde **Ekip** sütunu üzerinden bir ekibe katılabilir; bu tamamen bilgilendiricidir — ekibe otomatik bir kapasite toplama yoktur.

## Kaynakları yönetme

Kaynak panelini **Kaynaklar** sekmesindeki **Yönet** şerit grubu üzerinden açın: **Kaynaklar** düğmesi tam paneli açar (Tablo veya İlişkiler gibi ayrı bir tam-panel görünümü), **Yeni kaynak** doğrudan bir satır ekler. Panelde, kaynak başına şunları düzenlersiniz: **Ad**, **Tür**, **Maks. birim** (iş günü başına kapasite — 1 = tam zamanlı bir kişi/öğe, 2 = aynı anda iki birim), **Takvim**, **Ücret/saat**, **Birim** (yalnızca malzeme) ve **Ekip** (bu kaynağın hangi ekibe ait olduğu). Altta, **Toplam** sütunu her kaynağın maliyetini toplar (yüklenen birimler × saat/gün × ücret), her F5'te yeniden hesaplanır.

### Zamana bağlı kapasite

**Maks. birim**'in yanında, bir **Zamana bağlı kapasite** alt satırını genişleten bir ok vardır: burada, projenin seyri boyunca değişen kapasite için adımlar (bir **Başlangıç** tarihi + **Maks. birim**) eklersiniz. Büyük örnek proje bunu kule vinci için kullanır: **Maks. birim 1**'de durur, kapasiteyi **130. günden** itibaren **2**'ye çıkaran bir adımla — ikinci vincin eklendiği an. Bu tarihten önce, üç kulenin tamamı tek bir vinci paylaşmak zorundadır; sonrasında, iki kule aynı anda vinç kullanabilir.

## Kaynak atama

Bir atamayı yönettiğiniz üç yer vardır — hepsi aynı temel veri üzerinde çalışır, bu yüzden birinde yaptığınız her şey hemen diğerlerinde görünür:

1. **Özellikler paneli** — seçili bir görev altındaki **Atamalar** bölümü: henüz atanmamış kaynaklarla **Kaynak ata** açılır menüsü, ve mevcut her atama için **birim/gün**, **eğri** ve onu kaldırmak için bir düğme.
2. **Görev iletişim penceresi** — **Görevi düzenle** penceresindeki aynı **Atamalar** bölümü.
3. **Şerit** — **Kaynaklar** sekmesi, **Atama** şerit grubu, **Ata ▾** düğmesi. Bu düğme yalnızca tam olarak bir kilometre-taşı-olmayan, özet-olmayan görev seçildiğinde etkindir; açılır menü önce **birim/gün** ve **eğri** ayarlamanıza izin verir, ardından altında henüz atanmamış kaynakları listeler — bir adı tıklayarak atamayı tek seferde tamamlarsınız.

Kilometre taşları ve özet görevler kaynak taşıyamaz (kendi yükleyecekleri bir süreleri yoktur) — her iki yer de atama formu yerine bir açıklama gösterir.

### Bir atamayı taşıma

Yanlışlıkla bir kaynağı yanlış göreve mi atadınız, ya da işi bir görevden diğerine mi taşıyorsunuz? Özellikler panelinin (veya görev iletişim penceresinin) **Atamalar** bölümünde, her atamanın aday görevleri (bu kaynağa sahip olmayan yaprak görevler, mevcut görev hariç) listeleyen bir **Taşı…** açılır menüsü vardır. Birini seçmek, birimleri ve eğrisi dahil, atamayı tek adımda taşır — kaldırıp yeniden oluşturmaya gerek yok.

## Birimler ve dağılım eğrileri

Her atamanın bir **birim/gün**i (1 = tam zamanlı bir kişi/öğe, 0,5 = yarım gün) ve o yükün görevin süresi boyunca nasıl dağıtıldığını belirleyen bir **eğri**si vardır:

- **Tekdüze** — düz, her gün aynı miktar. Varsayılan, ve çoğu görev için doğru başlangıç noktası.
- **Başta yüklü (FRONT_LOADED)** — işin çoğu görevin erken kısmında, sona doğru azalarak.
- **Sonda yüklü (BACK_LOADED)** — ayna görüntüsü: sona doğru artan, örneğin ivme kazanması gereken bir görev.
- **Çan eğrisi (BELL)** — başta ve sonda düşük, ortada zirve yapan — hızlanan, tam kapasitede çalışan ve tekrar yavaşlayan bir görev.
- **Erken zirve (EARLY_PEAK)** — zirve görevin erken kısmında, ardından yük azalır.
- **Geç zirve (LATE_PEAK)** — zirve görevin geç kısmında.

Eğri değişimi en açık şekilde histogramda görünür: aynı birim/gün'e sahip aynı görev, çan eğrisiyle tekdüzeye göre çok farklı bir çubuk şekli üretir. Orta boy örnek proje, karşılaştırma yapabilmeniz için ev başına ince işler görevlerinde kasıtlı olarak tekdüze/başta yüklü/sonda yüklüyü karıştırır.

## Kaynak takvimleri

Bir kaynak **Proje takvimi**nde (varsayılan) veya kendi takviminde olabilir — örneğin haftada yalnızca dört gün uygun olan bir taşeron için. Bunu kaynak panelindeki **Takvim** sütunu, veya kaynağın kendisindeki **Takvim** alanı üzerinden ayarlayın. Bir kaynak takvimi bir görevin CPM tarihlerine asla dokunmaz (bunlar görev/proje takviminde çalışmaya devam eder) — yalnızca **yükü** ve **nivellemeyi** etkiler: bir kaynak görevin ihtiyaç duyduğu bir günde çalışmıyorsa, bu histogramda bir açık olarak sayılır, ve nivelleyici kaydırmanın bu takvim uyuşmazlığını çözmeyeceği konusunda uyarır. Takvimlerin tam açıklaması için kaynak takvimleri ve saat planlaması hakkında [Takvimler & saat planlaması](docs://gids-kalenders-uren) kılavuzuna bakın.

## Histogramı okuma

Histogramı **Kaynaklar** sekmesindeki **Histogram** şerit grubu üzerinden açın (**Histogram** düğmesi). Aynı zaman eksenindeki Gantt'ın altında bir şerit görünür: gün başına çubuklar, kapasite çizgisinin üzerindeki kısım kırmızı gösterilir.

Çubukların solunda, görev-tablosu sütununun üzerinde, **kaynak seçici** bulunur: üstte "Tüm kaynaklar" ve altında her kaynak, aşırı atanmışsa kırmızı bir noktayla. Bir isme tıklayarak o tek kaynağa yakınlaşırsınız — histogram yalnızca onun yükü ve kapasitesine göre yeniden ölçeklenir. Tüm kaynakların toplamını tekrar görmek için "Tüm kaynaklar"a geri tıklayın. Tıklamanın yanı sıra, seçicinin kendisine dokunmadan **Histogram** şerit grubundaki **Önceki**/**Sonraki** düğmeleriyle kaynaklar arasında da adım adım gezinebilirsiniz.

Aşırı yüklü bir çubuğa tıklayın, bir araç ipucu o gün kaç görevin yüke katkıda bulunduğunu, ilk birkaç görev adıyla gösterir — her atamayı elle kontrol etmeden aşırı atamaya neden olan görev kombinasyonunu hızla görmek için kullanışlıdır.

Çubuklar yerine "Yükü göstermek için yeniden hesaplayın (F5)" görüyorsanız, plan son değişiklikten bu yana (yeniden) hesaplanmamıştır — histogram, kritik yol gibi, kendiniz yenilediğiniz bir anlık görüntüdür.

## Sabitlenmiş kaynak paneli

Tam kaynak panelinin (şerit düğmesi **Kaynaklar**) yanı sıra, sağa sabitleyebileceğiniz kompakt bir varyant vardır: **Yönet** şerit grubundaki **Sabitle** düğmesi. Bu sabitlenmiş panel yalnızca adı, **Maks. birim**i (doğrudan düzenlenebilir) ve aşırı atama için kırmızı/yeşil bir nokta gösterir — tam paneli açmadan Gantt'ınızın yanında hızlı bir genel bakış. Sabitlenmiş kaynak paneli ve bir görevin özellikler paneli birbirini dışlar — sağ rayda aynı anda yalnızca ikisinden birini görürsünüz.

## Aşırı atamayı tespit etme

Bir kaynak, o günkü tüm atamalarının toplam birimleri **Maks. birim**ini aştığı anda o günde aşırı yüklenmiş olur. Bunu üç yerde göreceksiniz: histogramdaki çubuğun kırmızı kısmı, kaynak seçicideki ve sabitlenmiş paneldeki kırmızı nokta, ve Kaynaklar sekmesindeki şerit grubunda **Aşırı atama** sayacı (bir uyarı simgesiyle "N kaynak", veya "Yok").

Orta boy örnek proje bunu kasıtlı olarak görünür kılar: haziran başında **Stukadoors** (sıvacılar, maks. birim 2) aynı anda üç evde 2 birimlik bir atama alır (1, 2 ve 3 numaralı evlerin sıvası orada birkaç gün örtüşür) — zirvede birleşik 6 birim, 2'lik kapasitenin çok üzerinde.

## Nivelleme

**Kaynaklar** sekmesindeki **Nivelleme** şerit grubunda **Dengele…** düğmesi üzerinden **Kaynakları dengele** penceresini açın. Pencere geçerli, güncel bir hesaplama gerektirir (plan güncel değilse önce F5 ile yeniden hesaplayın) ve iki adımda çalışır: önce bir öneri için **Hesapla**, sonra **Uygula** — öneriyi görene kadar planınızda hiçbir şey değişmez.

Pencerede şunları seçersiniz:

- **Kaynaklar** — hangi kaynakların nivelleme çalışmasına katıldığı (varsayılan olarak hepsi; malzeme her zaman hariçtir — asla nivellenmez).
- **Yalnızca bolluk içinde dengele (yumuşatma)** — net bir alt başlığa sahip bir onay kutusu: "proje bitiş tarihi sabit kalır". Kapalıyken (**nivelleme**), nivelleyici görevleri gerektiği kadar, hatta kendi bolluklarının ötesine bile kaydırabilir, bu da proje bitiş tarihini geciktirebilir. Açıkken (**yumuşatma**), bitiş tarihi kutsaldır — nivelleyici yalnızca her görevin mevcut bolluğu içinde kaydırır, ve buna sığmayan bir çakışma kalan bir çakışma olarak işaretli kalır.

**Hesapla**'dan sonra, pencere başlangıcı değişen her görevi gösteren bir tablo (eski başlangıç → yeni başlangıç → kaydırılan gün), proje bitiş tarihinin değişip değişmediğini bildiren bir satır, ve — çakışmalar kalırsa — görev başına nedeni içeren bir **Kalan çakışmalar** bölümü gösterir: bir takvim uyuşmazlığı (kaynak, görevin ihtiyaç duyduğu günlerde çalışmıyor), bolluk içinde yetersiz serbest kapasite, veya içsel bir aşım (tek bir atama zaten zirvede kaynağın hiçbir zaman sağlayamayacağı kadar fazlasını talep ediyor — hiçbir kaydırma bunu düzeltmez). Yalnızca öneriden memnun olduğunuzda **Uygula**'ya tıklarsınız.

Bunu orta boy örnek projedeki sıvacı aşırı atamasında kendiniz deneyin: **Nieuwbouw 6 Rijwoningen De Akkers**'i açın, **Kaynaklar** sekmesine gidin ve **Kaynakları dengele**'yi açın. Tüm kaynakları işaretli bırakın, yumuşatmayı kapalı bırakın ve **Hesapla**'ya tıklayın: çakışmalar tamamen kaybolur (0 kalan çakışma), ama proje bitiş tarihi yaklaşık bir hafta daha geç olur. Sonra **Yalnızca bolluk içinde dengele**'yi işaretleyin ve tekrar hesaplayın: bitiş tarihi şimdi değişmeden kalır, ama bir görev (evlerden birindeki sıva) işaretli bir çakışma olarak kalır — mevcut plan içinde tamamen sığdırmak için yeterli bolluk yoktur. Bu onay kutusunun görünür kıldığı takas tam olarak budur: bitiş tarihinin gitmesine izin vererek mi sorunu çözersiniz, yoksa bitiş tarihini sabit tutup işaretli bir kalan çakışmayı mı kabul edersiniz?

### Öncelikler

Her görevin 0 ile 1000 arasında bir **nivelleme önceliği** vardır (varsayılan 500). Bir göreve sağ tıklayın ve üç ön ayar için **Öncelik**'i seçin: **Düşük** (100), **Normal** (500) ve **Yüksek** (900) — iki görev arasındaki bir kapasite çakışmasında, daha yüksek önceliğe sahip olan kıt kapasite üzerinde önce hak sahibi olur. **1000** değeri özel bir durumdur: "dengelenmesin" (MS Project buna "Do Not Level" der). Böyle bir görev yine de nivelleme döngüsünden geçer ve kendi, muhtemelen kaymış, öncüllerini takip eder, ama kapasite açmak için kendisi asla kaydırılmaz. Büyük örnek proje bunu "Nutsaansluitingen aanleggen" (altyapı bağlantılarının döşenmesi) üzerinde kullanır: nivelleme çalışması aksini önerse bile hareket ettirilmemesi gereken, kamu hizmetleri şirketi tarafından belirlenmiş sabit bir bağlantı tarihi.

**Dengelemeyi temizle** (**Nivelleme** şerit grubunda) daha önce uygulanan her kaydırmayı tek seferde kaldırır — her görevi elle sıfırlamadan orijinal, nivellenmemiş plana dönmek için kullanışlıdır.

## Dürüst ders: nivelleme yardımcı olmadığında

Nivelleme, işi zaman içinde yeniden düzenleyerek — bolluk içinde, veya gerekirse daha geç bir bitiş tarihiyle — bir aşırı atamayı çözer. Bu, fazla talebi yeniden dağıtmak için planda bir yerde yeterli alan (bolluk veya zaman) olduğu sürece iyi çalışır. Talep, ne kadar kaydırırsanız kaydırın, hiçbir zaman mevcut olmayacak kadar yapısal olarak büyük olduğunda temelden *çalışmaz*.

Büyük örnek proje bunu birden fazla kaynak üzerinde birden gösterir: üç kule büyük ölçüde paralel çalıştığı ve aynı ekipleri (duvarcılar, montajcılar, sıvacılar, fayans döşeyiciler, kule vinci) paylaştığı için, neredeyse her işçilik kaynağı bir noktada aşırı yüklenir. Tüm kaynaklar seçili ve bitiş tarihi serbestken nivelleyin, çoğu çakışma kaybolur — ama proje bitiş tarihi aylarca kayar, ve kule başına bir avuç ince işler görevi (fayans, mutfaklar, sıhhi tesisat, boya) içsel bir aşım olarak kalır: tek bir atamanın zirve yükü zaten orada kapasiteyi aşıyor, bu yüzden hiçbir kaydırma yardımcı olmuyor. Bitiş tarihini korumak için yumuşatmayı açın, ve çakışmaların çok daha büyük bir kısmı basitçe çözümsüz kalır.

Ders "nivelleme çalışmıyor" değildir — algoritma kendisinden istenen şeyi tam olarak yapıyor. Ders, nivellemenin bir **kapasite** aracı değil, bir **zamanlama** aracı olduğudur: mevcut işi mevcut zaman içinde yeniden düzenler, ama fazladan meslek erbabı, ekipman veya takvim günü yaratmaz. Yapısal bir kıtlık — üç kule için aynı anda çok az sıvacı, üç şantiyeye hizmet veren bir kule vinci — farklı bir çözüm gerektirir: daha fazla kapasite kiralamak, fazlamayı ayarlamak (paralel yerine kule kule ardışık, 130. günden itibaren ikinci-vinç adımının kısmen zaten yaptığı gibi), veya işi farklı bölmek. Nivelleme, size nerede acı olduğunu gösteren araçtır; sizin için altta yatan kapasite sorununu çözmez.

## Okumaya devam edin

- Sıvacı-aşırı-atama nivellemesini [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc)'te kendiniz tekrarlayın.
- Nivellemenin sınırlarını pratikte görün — artı tüm beş kaynak türü, tüm altı eğri ve zamana bağlı kule-vinci kapasitesi — [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc)'te.
- Kaynaklar takvimlerde çalışır — kaynak takvimleri ve saat planlaması için [Takvimler & saat planlaması](docs://gids-kalenders-uren) kılavuzunu okuyun.
- Nivellemeye başlamadan önce bir taban çizgi ayarlamak, böylece farkı görebilmek mi istiyorsunuz? [Baseline'lar & ilerleme](docs://gids-baselines-voortgang) kılavuzunu okuyun.
- Nivelleme hangi görevlerin kritik olduğunu değiştirebilir — bunu nasıl tespit edeceğiniz için [Kritik yol & ileri düzey analiz](docs://gids-kritiek-pad-analyse) kılavuzunu okuyun.
