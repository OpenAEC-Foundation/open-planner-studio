# 10 dakikada ilk planınız

Bu kılavuz sizi yaklaşık 10 dakikada boş bir projeden tam olarak hesaplanmış bir inşaat planına götürür: görev ekleme, görev yapısı oluşturma, ilişki ekleme, hesaplama ve kaydetme. Önce teori yok — Open Planner Studio'da bulacağınız tam düğme ve menüleri kullanarak adım adım uygularsınız.

## Ne yapacaksınız

1. Yeni bir proje oluşturun.
2. Görev ekleyin — şerit, görev tablosu ve Gantt şeması üzerinden.
3. Görevleri girintileyerek bir yapıya (WBS) yerleştirin.
4. Görevler arasında ilişki ekleyin.
5. Planı hesaplayın.
6. Sonucu okuyun: kritik yol ve bolluk.
7. Kaydedin.

Önce nereye varacağınızı mı görmek istersiniz? **Dosya → Örnekler** üzerinden [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) örnek projesini açın. (Örnek adları, projeyle birlikte gelen haliyle Hollandaca gösterilir.) Aşağıdaki hemen hemen her adımı zaten gösteren küçük, kolay okunur bir plandır — bu makaleyle karşılaştırma için yanınızda açık tutmak faydalı olur.

Aşağıdaki her şey masaüstü uygulamasında ve tarayıcı sürümünde birebir aynı şekilde çalışır: aynı düğmeler, aynı menüler, aynı kısayollar.

## Adım 1 — Yeni bir proje oluşturun

1. **Dosya** şerit sekmesine tıklayın. Bu, dosya ekranını açar.
2. **Yeni**'ye tıklayın (veya zaten başka bir projede çalışıyorsanız **Ctrl+N** kısayolunu kullanın). **Yeni proje** iletişim penceresi görünür.
3. Bir **Proje adı** girin, örneğin "İlk planım" ve **Başlangıç tarihi**ni kontrol edin — varsayılan olarak bugüne ayarlıdır.
4. **Faz şablonu** için **Boş**'u seçin. **Konut inşaatı** ve **Ticari yapı / yenileme** şablonları sizin için bazı faz görevleri hazırlar, ancak bu alıştırma için her adımı tanıyabilmeniz adına her şeyi kendiniz kuracaksınız.
5. Takvim seçeneklerini varsayılan değerlerinde bırakın ve **Oluştur**'a tıklayın.

Artık boş bir projeniz var: solda boş bir görev tablosu, sağda boş bir Gantt şeması ve varsayılan ayarlardan zaten kurulmuş bir çalışma takvimi.

## Adım 2 — Görev ekleyin

**Ana sayfa** şerit sekmesinde olduğunuzdan emin olun. Bu sekme görev tablosunu (solda) ve Gantt şemasını (sağda) yan yana gösterir — aynı planın iki görünümü, böylece eklediğiniz bir görev her iki yerde birden görünür.

### Şerit üzerinden

1. **Görevler** şerit grubunda, **Görev** düğmesine tıklayın. Görev tablosunun ve Gantt şemasının en altında, 5 iş günü süreli "Yeni görev" adlı yeni bir görev görünür.
2. Projenizin her ana fazı için bir görev oluşana kadar bunu birkaç kez tekrarlayın. Örnek projeyi takip ediyorsanız, onunla aynı ana fazları kullanın: "1. Voorbereiding" (Hazırlık), "2. Fundering & ruwbouw" (Temel & kaba inşaat), "3. Afbouw" (İnce işler) ve "4. Oplevering" (Teslim).
3. Bir göreve — tabloda ya da Gantt şemasındaki çubuğunda — çift tıklayarak **Görevi düzenle** penceresini açın. **Ad**, **Tür** ve **Süre (iş günü)** alanlarını fazınıza uyacak şekilde ayarlayın.

### Görev tablosu ve Gantt şeması üzerinden

Sürekli şeride geri dönmeniz gerekmez. Görev tablosunda **boş bir satıra** ya da Gantt şemasında henüz görev olmayan boş bir noktaya sağ tıklayın ve bağlam menüsünden **Yeni görev**'i seçin.

Bunun yerine **mevcut** bir göreve sağ tıklarsanız, aralarında şunların da bulunduğu farklı bir bağlam menüsü alırsınız:

- **Üste ekle** / **Alta ekle** — sağ tıkladığınız görevden önce veya sonra bir görev ekler.
- **Alt görev ekle** — o görevin altına tek adımda yeni bir görev oluşturur (bunun ne anlama geldiği için 3. adıma bakın).

Yanlış bir şey mi yazdınız, ya da görevi yanlış yere mi eklediniz? **Ctrl+Z** son eylemi geri alır, **Ctrl+Y** (veya **Ctrl+Shift+Z**) yineler — ikisi de sadece metin alanlarında değil, planın tamamında çalışır.

### Kilometre taşı ekleyin

Her plan en az bir kilometre taşına ihtiyaç duyar, örneğin teslim için. **Görevler** şerit grubunda, **Kilometre taşı**'nın yanındaki oka tıklayın ve **Bitiş kilometre taşı**, **Başlangıç kilometre taşı** veya **Denetim noktası (zorunlu)**'nı seçin — ya da sonradan yeniden adlandıracağınız hızlı, genel bir kilometre taşı ("Yeni kilometre taşı") için **Ctrl+M** kısayolunu kullanın.

## Adım 3 — Görev yapısı (WBS) oluşturun

Düz bir görev listesi hızla karmaşıklaşır. Görevleri girintileyerek bir görev yapısı (WBS) oluşturursunuz: üstteki görev otomatik olarak alt görevlerinin tüm süresini kapsayan bir **özet göreve** dönüşür.

1. Başka bir görevin altına yerleştirilmesi gereken bir görev seçin — örneğin "2. Fundering & ruwbouw" (Temel & kaba inşaat) faz görevinin altına "Fundering aanbouw" (Ek yapı temeli).
2. Girintilemek için **Alt+→** tuşlarına basın, ya da sağ tıklayıp bağlam menüsünden **Girinti**'yi seçin. Üstteki görev hemen özet görev olarak görünür hale gelir.
3. Çok mu ileri gittiniz, ya da bir görevi üst düzeye mi geri taşımak istiyorsunuz? **Alt+←** tuşlarını kullanın, ya da sağ tıklayıp **Girintiyi kaldır**'ı seçin.
4. Yepyeni bir alt görev için daha hızlı bir yol: üst göreve sağ tıklayın ve **Alt görev ekle**'yi seçin — bu, ayrı ekleme ve ardından girintileme adımlarını atlar.

Birkaç düzey derinliğe ulaşana kadar bunu tekrarlayın. Örnek projede, "2. Fundering & ruwbouw" fazı örneğin şu alt görevlere ayrılır: "Grondwerk aanbouw" (Ek yapı hafriyatı), "Fundering aanbouw" (Ek yapı temeli), "Begane grondvloer storten" (Zemin kat döşeme dökümü), "Wanden opmetselen" (Duvar örme) ve "Dakconstructie plaatsen" (Çatı konstrüksiyonu kurulumu).

Bu makale, başlamanız için WBS oluşturmayı yalnızca pratik düzeyde ele alır. Kilometre taşı türlerinin, özet görevlerin ve aktivite kodlarının ayrıntılı olarak nasıl birlikte çalıştığını öğrenmek için [Planlama & WBS](docs://gids-plannen-wbs) kılavuzunu okuyun.

## Adım 4 — İlişki ekleyin

İlişkisi olmayan görevler birbirinden bağımsızdır ve daha önceki bir görevi değiştirdiğinizde kaymazlar. Bir ilişki (bağımlılık) iki görevi birbirine bağlar.

1. Bağlamak istediğiniz iki görevin çubuklarının Gantt şemasında görünür olduğundan emin olun.
2. **Shift** tuşunu basılı tutun ve öncülün çubuğundan ardılın çubuğuna sürükleyin. Bırakır bırakmaz, 0 iş günü gecikmeli bir **Finish-Start (FS)** ilişkisi hemen oluşturulur — en yaygın ilişki: ardıl ancak öncül bittiğinde başlar.
3. Bıraktıktan hemen sonra, **İlişki türü** penceresi görünür. Burada ilişki türünü (**FS**, **SS**, **FF** veya **SF**) değiştirebilir ve bir **gecikme** girebilirsiniz, örneğin görevler arasında iki iş günü bekleme süresi için `2d`. Kısaca: **FS** (Finish-Start) ile ardıl, öncül bittikten sonra başlar; **SS** (Start-Start) ile her iki görev de (kabaca) aynı anda başlar; **FF** (Finish-Finish) ile (kabaca) aynı anda biterler; **SF** (Start-Finish) ile öncülün, ardılın bitmesine izin verilmeden önce başlaması gerekir — sonuncusu inşaat pratiğinde en az görülenidir.
4. İki görevi sürüklemeden bağlamayı mı tercih edersiniz? **İlişkiler** şerit sekmesine gidin (veya Planlama sekmesindeki **İlişkiler** şerit grubunda **Yönet**'e tıklayın), önce öncülü, ardından (Ctrl/Cmd basılı tutarak) ardılı seçin ve **Seçimden yeni ilişki** düğmesini kullanın — bu düğme yalnızca tam olarak iki görev seçildiğinde çalışır.

Alıştırma için en az iki ilişki ekleyin: örneğin "1. Voorbereiding" → "2. Fundering & ruwbouw" ve "2. Fundering & ruwbouw" → "3. Afbouw".

## Adım 5 — Hesaplayın

Artık görevleriniz ve ilişkileriniz olduğuna göre, planı hesaplatabilirsiniz (CPM — Critical Path Method / Kritik Yol Yöntemi).

1. **F5**'e basın, veya **Zamanlama** şerit grubundaki **Hesapla** düğmesine tıklayın.
2. Open Planner Studio şimdi her görev için en erken ve en geç başlangıç ve bitiş tarihlerini, bolluğu ve hangi görevlerin kritik yol üzerinde olduğunu hesaplar.
3. Artık F5'i düşünmek istemiyor musunuz? **Ayarlar**'da **Otomatik hesapla**'yı açın. Plan böylece güncelliğini yitirdiği anda, F5'e manuel basmayı beklemeden kendini yeniden hesaplar.

## Adım 6 — Sonucu okuyun

- Ekranın altında, durum çubuğu plan hesaplandıktan sonra örneğin "Kritik yol: 4 görev, 62 iş günü" gösterir. Son hesaplamadan bu yana bir şey değiştirdiyseniz, bunun yerine "Güncel değil — yeniden hesaplayın (F5)" gösterir.
- Gantt şemasında, kritik görevler — bolluğu olmayan, dolayısıyla doğrudan projenin bitiş tarihini belirleyen görevler — hâlâ alanı (bolluk) olan görevlerden farklı bir çubuk rengi alır. Kritik bir görev geç kalırsa, projenin tüm bitiş tarihi onunla birlikte kayar; bolluğu olan bir görev, bolluk tükenmediği sürece sonuç doğurmadan geç kalabilir.
- **Görevi düzenle** penceresini yeniden açmak için bir göreve çift tıklayın. **CPM Sonucu** bölümünde, görev başına şunları bulacaksınız: **Erken başlangıç**, **Erken bitiş**, **Geç başlangıç**, **Geç bitiş**, **Toplam bolluk**, **Serbest bolluk** ve görevin **Kritik yol** üzerinde olup olmadığı.
- Her görevi açmak zorunda kalmadan bu verileri görev tablosunda sütun olarak da mı görmek istiyorsunuz? **Görünüm** şerit sekmesine gidin, **Görüntüleme** grubunda **Sütunlar…**'a tıklayın ve **Kritik** ile **Toplam bolluk**'u işaretleyin.

## Adım 7 — Kaydedin

1. **Ctrl+S**'e basın, veya **Dosya** sekmesinde **Kaydet**'e tıklayın. İlk seferde, Open Planner Studio bir dosya adı ve konum ister; proje yerel bir IFC dosyası olarak kaydedilir.
2. Bunun yerine farklı bir ad altında bir kopya mı tutmak istiyorsunuz, örneğin iki varyantı yan yana tutmak için? **Dosya → Farklı kaydet**'i kullanın (kısayol **Ctrl+Shift+S**).

## Alıştırmaya devam edin

- Yukarıdaki adımları tam bir örnekle tekrarlayın: **Dosya → Örnekler** üzerinden [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc)'i açın ve fazlar arasındaki FS zincirini, duvar ve çatı işleri arasındaki SS örtüşmesini, fayans ve boya işleri arasındaki FF bağlantısını ve başlangıçtan önceki ruhsat kısıtlamasını (SNET) tanıyın.
- Görev yapısı, özet görevler, kilometre taşı türleri ve aktivite kodları hakkında daha fazla bilgi mi istiyorsunuz? [Planlama & WBS](docs://gids-plannen-wbs) kılavuzunu okuyun.
- Ekranın ana bölümlerinde görsel bir tur mu tercih edersiniz? Turu **Görünüm** sekmesi → **Tur** düğmesi üzerinden, veya **Dosya** → **Turu başlat** üzerinden yeniden başlatın.
