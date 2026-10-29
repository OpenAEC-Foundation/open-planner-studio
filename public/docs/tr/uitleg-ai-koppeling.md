# Yapay zeka bağlantısı nasıl çalışır

Gerçekte ne olur, bir yapay zeka asistanı planlamanızda çalıştığında? Bu makalede bağlantının ne olduğunu okursunuz. Ayrıca bunun bir dosya alışverişinden neden farklı olduğunu, uygulamanın kendini hangi sınırlarla koruduğunu ve bir asistanın bir planlamanın nasıl kurulması gerektiğini nereden öğrendiğini okursunuz. Sondaki örnek, rakamlarla, bir asistanın tek seferde ne yapabildiğini ve sizin bundan ne geri aldığınızı gösterir.

## Kavram

Bir yapay zeka asistanı, örneğin bir sohbet programı veya bir programlama asistanı, başka bir programı **Model Context Protocol** (MCP) üzerinden çalıştırabilir. Bu alışverişte Open Planner Studio sunucu rolünü oynar. Masaüstü uygulaması kendi bilgisayarınızda küçük bir sunucu çalıştırır: **köprü**. Asistan bu köprüye bağlanır ve **araçlar** listesi alır. Bunlar `planner_` ile başlayan adlı araçlardır, örneğin görevleri okumak, bir ilişki eklemek veya bir temel planı kaydetmek. Hangi araçların olduğunu [Yapay zeka araçları](docs://ref-ai-tools) sayfasında görürsünüz.

Önemli olan şudur: asistan, o anda açık olan projede çalışır, bir kopyada değil. Hiçbir şey dışa aktarmazsınız, hiçbir şey içe aktarmazsınız. Siz ve asistan asla iki farklı sürüme bakmazsınız. Asistanın eklediği bir görev Gantt'ta hemen görünür. Uygulama bu konuda saf değildir: asistan sizinle aynı hesaplamayı, aynı geri alma geçmişini ve aynı kuralları kullanır.

Bu bağlantının nasıl açılacağı [Yapay zeka asistanını bağlamak (MCP)](docs://howto-ai-assistent-koppelen) sayfasında yazılıdır. Aşağıda nasıl çalıştığını okursunuz.

## Uygulama bunu nasıl ele alır

### Sadece kendi bilgisayarınızın duyduğu bir sunucu

Köprü yalnızca kendi bilgisayarınızda (`127.0.0.1`) dinler, tek bir bağlantı noktasında; standart olarak 3877. Yalnızca `/mcp` adresine gelen ve üstbilgisinde `Authorization: Bearer` alanında doğru **belirtecinizi** taşıyan istekleri kabul eder. Doğru belirteç olmayan bir isteği reddeder. `Origin` üstbilgisiyle gelen ve tanıdığı bir tarayıcıdan gelen isteği de reddeder. Bu sayede açık olan bir web sayfası planlamanızla konuşamaz. İstekleri kesinlikle birer birer işler.

Bağlantı kendi bilgisayarınızda düz HTTP'dir; uygulamanın kendisi hiçbir şeyi dışarı göndermez. Asistanın okuduğu planlamayla ne yaptığı, örneğin sağlayıcısının onunla ne yaptığı, asistana bağlıdır ve uygulamanın dışında kalır.

### Asistan tek bir belgeyle çalışır

Asistan ilk değişikliğini yaptığında köprü bağlantıyı o an etkin olan belgeye bağlar. Siz daha sonra kendiniz başka bir sekmeye geçerseniz, uygulama asistanın bir sonraki değişikliğini reddeder (kod `DOC_DRIFT`). Asistan, hangi belgede çalışmak istediğini `planner_switch_document` ile onaylayana kadar bu böyle sürer. Bu sayede hiçbir şey yanlış projeye düşmez. Kendi başına bir belge açan veya çoğaltan bir asistan, bundan sonra o yeni belgede çalışır.

### Her değişiklik yeniden hesaplar

Uygulamada elle planlarsınız: bir şeyi değiştirirsiniz ve sonra *Hesapla* (F5) tuşuna basarsınız; *Otomatik hesapla* açık değilse. Bu, asistanın değişiklikleri için geçerli değildir. Asistanın her yazma işlemi tek bir işlemden geçer. Bu işlemde proje verileri değişirse, uygulama sonunda kendiliğinden yeniden hesaplar; bir betik için bir kez. Bir okuma aracı her zaman güncel tarihleri verir. Planlama eskimişse, örneğin siz kendiniz bir şeyi değiştirip henüz *Hesapla* düğmesine basmadıysanız, okuma aracı önce yeniden hesaplar. Tek bir istisna vardır: proje *Kaydedildiği gibi tarihler* görünümündeyse (bir içe aktarmadan sonra), bir okuma aracı sessizce yeniden hesaplamaz. Çünkü bu, o tarihlerin yerini alırdı. Asistan o zaman kaydedilmiş tarihleri alır; bu tarihlerin yeniden hesaplanmadığına dair bir uyarıyla birlikte. Asistanın kendi yaptığı bir değişiklik her zaman yeniden hesaplar, bu durumda bile. Asistanın yaptığı bir değişiklikten sonra *Hesapla* düğmesine basmanız gerekmez. Asistan sonucu, örneğin projenin bitiş tarihini ve kritik yolu, okuma araçlarıyla geri okur. Ayrıca bkz. [Kaydedildiği gibi tarihler](docs://uitleg-datums-zoals-opgeslagen).

### Bir betik tek bir adımdır

Bir asistan, `planner_batch` ile bir dizi adımı tek bir bütün olarak gönderebilir. Bu, en fazla 100 adım içeren bir betiktir. Bu size tek bir geri alma adımı, tek bir yeniden hesaplama ve tek bir yedek verir. Bir adım yapısal olarak başarısız olursa, örneğin bilinmeyen bir araç veya döngüsel bir başvuru, uygulama tüm betiği geri alır. Yarım kalmış bir planlamayı asla elinizde tutmazsınız. Toplu bir adımdaki tek bir öğenin reddi daha hafiftir; örneğin yirmi ilerleme satırından biri geçersizse. O öğe dışarıda kalır ve kalanı uygulanır. Reddetmeler yanıtın en üstünde yer alır.

### Sizin sınırlarınız

Dört şeyi kendiniz ayarlarsınız, *Yapay Zeka* sekmesinde:

- *Duraklat* ve *Salt okunur* asistanı bağlı tutar, ama her değişikliği reddeder. Okumaya izin verilir, eskimiş bir planlamayı okurken yeniden hesaplamak dahil. Bunlar hesaplanan alanlardır, proje verisi değildir. Bu yüzden geri alma adımı eklenmez ve proje değişmiş sayılmaz. Siz kendiniz bir düzenleme ortasındaysanız, örneğin bir çubuğu sürüklüyor veya bir alana yazıyorsanız, bir okuma aracı yeniden hesaplamaz: asistan o zaman düzenlemenizden önceki tarihleri alır, bunların eski olduğuna dair bir uyarıyla birlikte.
- Açık bir iletişim kutusu her şeyi engeller. Örneğin görev iletişim kutusu, ayarlar, sunum modu veya karşılama penceresi açıksa, uygulama okumayı da reddeder, çünkü siz elle bir işlemin ortasındasınızdır. Asistan `DIALOG_OPEN` hata kodunu alır. İleti, açık olan şeyin iç adını verir; örneğin görev iletişim kutusu için `showTaskDialog`.
- *Otomatik yedekleme*, her belge için ilk değişiklikten önce bir IFC kopyası yazar. Bu yedekleme başarısız olursa, uygulama değişikliği uygulamaz.
- *Etkinlik paneli* her çağrıyı gösterir, argümanları ve yanıtıyla birlikte.

Bunun üstüne normal *Geri al* (Ctrl+Z) gelir. Asistan bu geçmişi sizinle paylaşır ve kendi `planner_undo` ve `planner_redo` araçlarına sahiptir.

### Asistanın yapamadıkları

Köprü, uygulamaya göre bilerek daha dardır. Asistanın yapamadığı şeylerin genellikle üç nedeni vardır.

**Proje dışına da uzanır.** Asistan kaynak kitaplığını değiştiremez. Bir kaynak kitaplığı tüm projelerinizle paylaşılır ve geri alma geçmişinin dışında kalır; tek bir ücret değişikliği, açık bile olmayan projelerde de geçerli olurdu. Kaynak kitaplığından gelen bir kaynak için ad, tür, açıklama, saatlik ücret ve birim sabittir, tıpkı kaynak panelindeki gibi. Projeyi ilgilendiren şeyler asistanda kalır: maks. birim, zaman içindeki kullanılabilirlik, takvim ve ekip. Asistan ayrıca proje takvimini seçemez. Hesaplama profilini ve hesaplama seçeneklerini okuyabilir ama değiştiremez; yalnızca ilerleme modunu ve görev türü için proje varsayılanını ayarlayabilir. Ayarlar, tema, dil, uzantılar veya güncellemeler için hiçbir araç yoktur.

**Güvenilir doğrulamaya elverişli değildir.** Asistan bir hamak ayarlayamaz, bir görevi elle planlayamaz, ikinci bir kısıtlama koyamaz, notlar, renkler, etkinlik kodları, özel alanlar veya dış ilişkiler dolduramaz ve dengeleme gecikmesini elle ayarlayamaz. WBS kodunu da seçmez; uygulama bunu kendisi türetir.

**Sizin kendiniz karar vermeniz gereken bir şeye dokunur.** Asistan ilerlemeyi yalnızca bir durum tarihi varsa kaydeder. Durum tarihini kendi seçmez: bu sizin referans tarihinizdir. Henüz başlamamış bir görevin planlanmış başlangıcı durum tarihinden sonraysa, asistan gerçek başlangıcı vermelidir. Dosyaları yalnızca kullanıcı klasörünüzün içinde okur ve yazar; mevcut bir dosyanın üzerine yalnızca açıkça isterse yazar. Bir dışa aktarma *Kaydet* değildir: proje uygulamada kaydedilmemiş kalır.

### Asistan planlamayı nereden bilir

Araçları bilen bir asistan bile hiçbir planlamacının işine yaramayacak bir planlama kurabilir: ilişkisiz görevler, her görevde sabit bir tarih veya çok ince bir kırılım. Bu yüzden uygulama asistana üç şey verir.

**Temel kurallar el sıkışmada.** Bağlantı kurulurken köprü, MCP el sıkışmasının `instructions` alanında kısa bir metin gönderir. Birçok istemci bu metni sistem istemine koyar; sizin istemcinizde bunun olup olmadığı istemciye bağlıdır. Kurallar şunlardır: kilometre taşları ve teslim tarihiyle başlayın; görevleri yaklaşık bir günden iki haftaya kadar kurun; planlamayı sabit tarihler yerine ilişkilerle yönlendirin; kısıtlamaları yalnızca sert dış tarihler için kullanın; önce başarısız bir hesaplamayı düzeltin; tutarlı bir dizi için `planner_batch` kullanın; ilerlemeyi yalnızca sizin durum tarihinizle ve verdiğiniz gerçek tarihlerle kaydedin; ve sonunda neyi varsaydığınızı ve bilerek neyi yapmadığınızı söyleyin.

**Asistanlar için kılavuz.** `planner_get_planning_guide` aracı, asistanlar için özel yazılmış bir kılavuz döndürür. Bu kılavuz, [İyi planlama](docs://gids-goed-plannen) ile aynı ilkeleri izler; ama bir asistan sizden farklı çalışır. Asistan F5'e basmaz, şeritte tıklamaz; araçları çağırır ve uygulama onun için yeniden hesaplar. Kılavuz bu yüzden her ilke için asistanın hangi araçları kullandığını adlandırır ve asistanın *Kaydedildiği gibi tarihler* ile veya başarısız bir hesaplama ile ne yaptığını açıklar. Kılavuz, asistanın bağlantı üzerinden okuduğu her şey gibi İngilizcedir. Araç, eski asistanlar için yine de bir dil seçimi kabul eder, ama bu metni değiştirmez. Bu metni kendiniz şu adreste okuyabilirsiniz: `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. *Bağlantı bilgileri* penceresindeki bağlantı istemi, asistanın önce kılavuzu okumasını ister. Araç, bir iletişim kutusu açıkken, duraklatılmışken ve salt okunur modda da çalışır, çünkü planlamanızı okumaz.

**İki beceri.** Beceri, bir asistanın her oturumda birlikte okuduğu küçük bir talimat dosyasıdır. Bunlar iki türlü işe yöneliktir. Bir planlamayı kurmak mantıkla ilgilidir. İlerlemeyi güncellemek ise yalnızca sizin bildiğiniz gerçeklerle ilgilidir. *goed-plannen* becerisi planlamayı kurmak veya yeniden yapılandırmak içindir: araçların kullanım sırası, yeniden hesaplama kuralı, `planner_batch` ve varsayımları bildirme görevi. *progress-update* becerisi haftalık ilerleme güncellemesi içindir: önce durum tarihiniz, sonra gerçek başlangıç ve bitiş tarihleri ile tamamlanma yüzdesi, ve ardından temel plana göre sapmanın, kritik yolun ve yeni bitiş tarihinin bir raporu. Planlama ilkelerinin kendisi kılavuzdadır. İkisi de İngilizcedir. Araç, her ikisini de ait oldukları yerle birlikte döndürür. Bunları nasıl kuracağınız [Yapay zeka asistanını bağlamak (MCP)](docs://howto-ai-assistent-koppelen) sayfasında yazılıdır.

## Bir örnek

Bir asistandan şunu istersiniz: bir ek yapı yapın; sırayla temel, tuğla duvar ve çatı. Projeniz 2 Mart 2026 Pazartesi günü başlar. Asistan önce kılavuzu okur ve sonra tek bir betik gönderir:

1. proje başlangıcı 2 Mart 2026;
2. üç görev: 5 iş günlük Foundation, 10 iş günlük Brickwork ve 4 iş günlük Roof;
3. iki bitiş-başlangıç ilişkisi: Foundation'dan Brickwork'e ve Brickwork'ten Roof'a.

Uygulama üç adımı uygular ve yeniden hesaplar. Asistan sonra geri okursa şunu görür: proje bitişi Perşembe 26 Mart 2026, proje süresi 19 iş günü ve üç görevin hepsi kritik. Bu toplamla uyuşur: 5 + 10 + 4 toplamı 19 iş günüdür ve Pazartesi 2 Mart'tan 19 iş günü sonra Perşembe 26 Mart'ta biter. Tüm betik geçmişinizde tek bir adımdır. Tek bir *Geri al* üç görevi, iki ilişkiyi ve yeni proje başlangıcını kaldırır.

Şimdi bir senaryo analizi. Asistandan daha sonra ilerlemeyi güncellemesini istersiniz; bunun için durum tarihini Pazartesi 16 Mart'a koyar. Durum tarihi bir etiket değildir: henüz başlamamış iş bu tarihten önce olamaz ve o tarihe kayar. Tek bir ilerleme satırı olmadan tüm planlama bu yüzden birlikte kayar: Foundation 16 ile 20 Mart arasında çalışır, Brickwork 23 Mart ile 7 Nisan arasında ve Roof 8 ile 13 Nisan arasında. Proje bitişi 26 Mart'tan 13 Nisan'a sıçrar. Planlama iki iş haftası ileri kayar. Bu örnekteki takvim, *Bouwkalender NL*, Büyük Cuma'yı (3 Nisan) ve Paskalya'yı (5 ve 6 Nisan) içerir. Bu iki çalışılmayan hafta içi günü bitişi iki gün daha ileri iter. Bu yüzden asistan durum tarihini yalnızca sizin isteğinizle ve yalnızca kaydedilecek gerçek bir ilerleme olduğunda ayarlar.

## Planlamanız için sonuçlar ve yaygın yanılgılar

**Asistanın kendi kopyası yoktur.** Neyi değiştirirse, projenizi değiştirir. *Otomatik yedekleme* açıksa, ilk değişiklikten önce bir IFC yedeğiniz olur. *Salt okunur* modundayken asistan, hiçbir şeyi değiştirmeden analiz edebilir.

**Yeni bir belirteç tüm bağlantıları kırar.** Belirteç köprünün parolasıdır. Yeni bir belirteç eskisini geçersiz kılar; çalışan bir köprüde bile. Asistana yenisinin verilmesi gerekir.

**Asistanın işe yaradığını söylemesi kanıt değildir.** *Etkinlik paneli*, asistanın gerçekte hangi aracı çağırdığını ve ne geri geldiğini gösterir. Bir reddetme neredeyse her zaman hatalı olan alanı ve işe yarayan yolu adlandırır.

**Asistan, geri alma ile bir senaryo analizi yapamaz.** Geri almayı sizinle paylaşır; bu yüzden varyantlar için belgeyi `planner_duplicate_document` ile çoğaltır. Kopya bağlantısızdır, bir dosya yolu yoktur ve kaydedilmemiş görünür. Asistan varyantları kapatmaz; bunu siz karar verirsiniz.

**Asistanın yaptığı bir dışa aktarma kaydetme değildir.** Asistan, kendi seçtiği bir yola, kullanıcı klasörünüzün içinde bir IFC dosyası yazar ve mevcut bir dosyanın üzerine yalnızca açıkça isterse yazar. Projeniz uygulamada kaydedilmemiş kalır ve kendi kayıt hedefini korur. Asistan bir dosya içe aktarırsa, bu yeni bir sekmede veya boş, değişmemiş bir sekmede açılır.

## Ayrıca bakınız

- [Yapay zeka asistanını bağlamak (MCP)](docs://howto-ai-assistent-koppelen): köprüyü başlatma, bir asistanı bağlama ve beceriyi kurma adımları.
- [Yapay zeka araçları](docs://ref-ai-tools): tüm araçlar gruplara göre, neyi reddettikleri ve yedeklerin ne kadar süre saklandığı.
- [İyi planlama](docs://gids-goed-plannen): planlama ilkeleri; asistan bunları, araçlar eklenmiş İngilizce bir sürümde alır.
- [İlerleme, durum tarihi ve temel plan](docs://uitleg-voortgang): durum tarihinin planlamanızda ne yaptığı.
