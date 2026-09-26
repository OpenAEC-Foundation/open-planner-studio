# Kaynak kitaplıkları

Aynı ekiplerle, aynı taşeronlarla ve aynı takvimlerle birden fazla proje üzerinde çalışıyorsanız, bunların ücretini, takvimini ve türünü her projede ayrı ayrı tutmak istemezsiniz — her seferinde yeniden yazmak ve bir şey değiştiğinde her kopyanın peşinden koşmak. Kaynak kitaplığı tam olarak bunun için vardır: organizasyonunuza ait, tek tek projelerin dışında yaşayan ve birden çok projenin kullanabileceği, paylaşılan bir kaynak ve takvim kaynağı. Bu kılavuz, kitaplığın bir projeyle nasıl ilişkili olduğunu, tam olarak neyin projeye taşındığını ve neyin proje başına kaldığını, ve ikisi arasında nasıl geçiş yapacağınızı açıklar.

## Burada neler öğreneceksiniz

- Kitaplık (paylaşılan, organizasyon genelinde) ile proje (bu projenin gerçekte kullandığı) arasındaki fark.
- Bir projeyi bir kitaplığa bağlama, veya bilinçli olarak bağımsız bırakma.
- Kaynaklar sekmesindeki iki görünüm: **Kitaplık** ve **Proje**.
- Proje görünümünde karşılaşacağınız üç tür satır: kitaplıktan, projeye özel, ve yetim.
- Bir kitaplık kaynağının projeye tam olarak neyi getirdiği, ve neyi proje başına serbestçe ayarladığınız.
- Kitaplığı ve projeyi birbirine bağlayan üç eylem.
- Uygulamanın kopyaları nasıl güncellediği, ve bir kopya kitaplıktan saptığında neye karar vermeniz gerektiği.
- Paylaşım, yedekleme, ve bunların sınırları.

[Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) ve [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) ile birlikte takip edin: bu örneklerden herhangi birini açmak, onu otomatik olarak paylaşılan bir demo kaynak kitaplığına bağlar, ve **Timmerlieden**, **Installateurs**, **Stukadoors** ve **Schilders** ekipleri her ikisinde de tam olarak aynı adla tekrar karşınıza çıkar — tek bir kitaplığın birden çok projeyi beslediğinin doğrudan kanıtı.

## Kitaplık ve proje: iki dünya

**Kaynak kitaplığı**, paylaşılan kaynaktır: organizasyonunuza aittir, tek bir projeye değil, ve her bir projeden daha uzun ömürlüdür. **Proje** ise, bu belirli projenin ondan gerçekte neyi kullanıma soktuğunu belirler — kendi kapasitesi, kullanılabilirliği ve takvim seçimiyle. Bir proje tam olarak bir kitaplığa bağlanır, veya tamamen kendi başına durur: bu durumda her şey her zamanki gibi çalışır, sadece kullanabileceğiniz veya geri yazabileceğiniz paylaşılan bir kaynak olmadan.

## Bir projeyi bir kitaplığa bağlama

Kitaplığı iki yerde seçersiniz, ikisi de aynı paneli gösterir:

- **Yeni proje sihirbazı** ("Yeni proje"), bir kitaplık seçiciyle.
- Mevcut bir proje için **Proje bilgisi** — hem iletişim penceresi hem de **Dosya → Proje bilgisi**.

Aynı seçicide ayrıca, önce Dosya → Kitaplık'a gitmeden yerinde bir tane oluşturmanızı sağlayan **+ Yeni kaynak kitaplığı…** de bulunur. **Yok (bağımsız proje)**, aynı listede açık bir seçenektir — projenizin bağlantısını kesmek asla kazara bir yan etki değildir, her zaman bilinçli olarak seçtiğiniz bir şeydir.

## Kaynaklar sekmesi: iki görünüm

Bir proje bir kitaplığa bağlandığında, Kaynaklar sekmesi sağ üstte iki görünümlü bir geçiş anahtarı kazanır:

- **Kitaplık** — kaynağın kendisini yönetin. Buradaki her şey doğrudan düzenlenebilir, bir değişiklik bu kitaplıktan yararlanan **her** projeye anında uygulanır, ve geri almanın (Ctrl+Z) dışında kalır — bu bir proje düzenlemesi değildir.
- **Proje** — bu projenin gerçekte kullandığı şey: kökeni ve olası sapmaları satır başına işaretlerle gösteren olağan proje tablosu.

Hepsi aynı kitaplıktan yararlanan birden fazla açık projeyle çalışıyorsanız, bir de üçüncü görünüm vardır: **Doluluk**. Her kitaplık kaynağı için, *tüm* açık belgeler boyunca nerede ayrıldığını gösterir ve bu ayırmaların toplamının şirket kapasitesini aştığı günleri işaretler — hiçbir projenin tek başına göremeyeceği, projeler arası çifte rezervasyon. [Doluluk özeti](docs://gids-bezettingsoverzicht) kılavuzunu okuyun.

## Proje görünümündeki üç tür satır

Proje görünümünde üç tür satırla karşılaşırsınız:

1. **Kitaplıktan** — **Kitaplıktan** rozetiyle işaretlenir. Ad, tür, ücret/saat ve birim kitaplıktan miras alınır ve burada düz metin olarak gösterilir: bunları burada değil, **Kitaplık** görünümünde düzenlersiniz. Maks. birim, zamana bağlı kapasite ve takvim seçimi ise serbestçe düzenlenebilir — bunlar tam olarak bu projenin kendi taahhüdüdür.
2. **Projeye özel** — rozetsiz, tamamen düzenlenebilir. Bağlı bir projede bile bu tür satırlar bulunabilir: paylaşılan kitaplığa ait olmayan tek seferlik öğeler için kullanışlıdır, örneğin kiralık bir vinç veya yalnızca bu iş için tutulan bir taşeron.
3. **Yetim** — kitaplıktaki orijinal kaybolmuştur; satır **artık kitaplıkta değil** olarak işaretlenir. Kopyanın kendisi sorunsuz çalışmaya devam eder — onu kitaplıktan ayırabilir veya silebilirsiniz.

## Kitaplığı neler takip eder — neler etmez

Akılda tutulması gereken kısım burası: bazı alanlar şirket genelinde bir anlaşmadır ve kitaplığı takip eder, diğerleri ise bu projenin kendi taahhüdüdür ve bunları hiçbir zaman bir sapma sayılmadan serbestçe ayarlarsınız.

**Kitaplığı takip eder:**
- Ad
- Tür
- Açıklama
- Ücret/saat
- Birim
- Bir kaynakla birlikte gelen takvimin **içeriği** (çalışma günleri, saatler, tatiller)

**Proje başına siz karar verirsiniz, bu bir sapma sayılmaz:**
- Maks. birim
- Zamana bağlı kapasite
- Kaynağa hangi takvimin bağlı olduğu **seçimi**

Bir kitaplık kaynağını atarsanız, takvimi kendisi de kitaplığı takip etmeye devam eden bağlı bir kopya olarak birlikte gelir — bu yüzden o takvimin *içeriği* yukarıda **Kitaplığı takip eder** başlığı altında yer alır. Ama bir kaynağa hangi takvimin bağlı olduğu *seçimi* **Proje başına siz karar verirsiniz** başlığı altında yer alır: aynı ekip, acil bir iş için normalde çalıştığından farklı bir takvimde çalışabilir, bu da kitaplıktan bir sapma sayılmaz. Bu ayrım incedir ama önemlidir: bir kitaplık kaynağının ücretini veya adını değiştirirseniz, kopya kitaplıktan sapar; takvim seçimini veya maks. birimini değiştirirseniz, tam olarak o alanın orada olma amacını yapıyorsunuzdur.

## İki dünyayı birbirine bağlayan üç eylem

- **Projeye ata** — kitaplıktan projeye: köken bilgisiyle birlikte düzenlenebilir bir kopya oluşturur.
- **Kitaplığa** — projeye özel bir satırdan paylaşılan kitaplığa: anında bağlar. Kitaplıkta aynı ada sahip bir öğe zaten varsa, uygulama onu çoğaltmak yerine o öğeye bağlar.
- **Kitaplıktan ayır** — köken bilgisi kaybolur, her şey yeniden tamamen düzenlenebilir hale gelir. Birlikte gelen bir takvim de onunla birlikte ayrılır, meğer ki hâlâ bağlı başka bir kaynak aynı takvimi kullanıyor olsun.

## Güncelleme ve sapmalar

Uygulama, kopyalarınızın hâlâ kitaplıkla eşleşip eşleşmediğini dört sabit anda kontrol eder: bir dosya **açarken**, belgeler arasında **geçiş yaparken**, **kitaplıkta bir düzenleme** yapıldıktan sonra, ve **çökme kurtarmasından** sonra.

- Bir kopya yalnızca geride kalmışsa (siz kendiniz değiştirmediniz, ama kitaplık o zamandan beri ilerlemiş), **sessizce güncellenir** — yalnızca kısa bir bildirim görürsünüz, bir soru değil.
- Bir kopya yerel olarak (veya başka biri tarafından) değiştirilmişse, **farklı — karar ver** işareti görünür ve uygulama öğe başına ne yapılması gerektiğini sorar: **Kitaplık değerlerini kullan**, **Dosya değerlerini kitaplığa aktar**, veya **Daha sonra karar ver**.

Bu seçimler Ctrl+Z ile geri alınamaz — ikinci seçenek kitaplığın kendisini değiştirir, ve bu tamamen projenin geri alma geçmişinin dışında kalır.

## Paylaşım ve yedekleme

Bir proje dosyası her zaman kendi başına eksiksizdir: kitaplığınız olmadan birine verin, her şey yine de çalışır, sadece paylaşılan bir kaynak olmadan. Bir kitaplığı **Dosya → Kitaplık** üzerinden dışa ve içe aktarırsınız — bu aynı zamanda yedeğinizdir.

İçe aktarırken, iki seçenek arasından seçim yaparsınız:

- **Yeni kaynak kitaplığı olarak ekle** — dosyadaki kitaplık, mevcut kitaplıklarınızın yanına ekstra bir kitaplık olarak eklenir ve sizin hiçbir şeyinizin üzerine asla yazmaz. Gönderen zaten kendi ikinci bir kitaplığını ayırmışsa (örneğin ayrı bir taşeron için), o kitaplık kendi kimliğini de beraberinde getirir: onunla birlikte gönderilen bir proje, zaten kullanmakta olduğu ekipleri ve takvimleri, sizin hiçbir şeyi sıralamanıza gerek kalmadan, hemen tekrar kitaplık öğeleri olarak tanır. Gönderende hiç ayrılmamış, tek bir kitaplık varsa — çoğu insan için günlük durum budur — bu otomatik tanıma devreye girmez: gönderilen projeyi yeni kitaplığa yalnızca bir kez, siz kendiniz bağlarsınız; bundan sonra ada göre eşleştirme işi devralır. O kitaplığın aynısına zaten sahipseniz, bunun yanına ayrı bir kopya olarak eklenir.
- **Mevcut bir kaynak kitaplığını değiştir** — seçtiğiniz kitaplığın tüm içeriği, dosyadakiyle üzerine yazılır. Kendi versiyonunuz içe aktardığınızdan daha yeniyse, uygulama sizi önceden bu konuda uyarır.

Hangi seçeneğin önceden seçili olduğu dosyaya bağlıdır: uygulama kitaplığı henüz tanımıyorsa "Yeni kaynak kitaplığı olarak ekle" seçilidir; tanıyorsa (aynı kitaplık, farklı bir versiyon), o kitaplık zaten seçilmiş halde "Mevcut bir kaynak kitaplığını değiştir" seçilidir.

Kitaplıklar cihazlar arasında kendiliğinden senkronize olmaz: iki planlamacı farklı bilgisayarlarda aynı kitaplıkla çalışırsa, kitaplıklar birbirinden farklılaşabilir.

## Örneklerdeki demo kaynak kitaplığı

Showcase örneklerinden birini açın (**Dosya → Örnekler**, veya bu Yardım panelinden), ve uygulama bir defaya mahsus bir **demo kaynak kitaplığı** oluşturup açılan örneği ona bağlar. [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) ve [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc), o kitaplıktan aynı ekipleri paylaşır; böylece bir kitaplığın birden çok projeyi nasıl beslediğini hemen görürsünüz. Kendi mevcut kaynak kitaplıklarınıza kesinlikle dokunulmaz.

## Okumaya devam edin

- Kaynak atamak, histogramı okumak ve nivellemek — bunların hepsi kaynakların proje tarafıyla ilgilidir: [Kaynaklar, histogram & nivelleme](docs://gids-resources-histogram) kılavuzunu okuyun.
- Bir kaynağın bağlı takvimi, diğer her takvimle aynı yapı taşlarını kullanır: [Takvimler & saat planlaması](docs://gids-kalenders-uren) kılavuzunu okuyun.
- Projeler arasında paylaşılan ekipleri [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) ve [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc)'te kendiniz görün.
