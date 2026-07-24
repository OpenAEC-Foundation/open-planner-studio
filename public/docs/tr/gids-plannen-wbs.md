# Planlama & WBS

Bir plan bir görev yapısıyla başlar: hangi görevler var, bunlar fazlara nasıl ayrılıyor ve hangi anlar bir kilometre taşını hak edecek kadar önemli? Bu kılavuz, bu temeli [Hızlı başlangıç](docs://quick-start) kılavuzundan daha derinlemesine ele alır — burada yalnızca *nasıl* girintileneceğini değil, bir özet görevin gerçekte ne yaptığını, üç kilometre taşı türünün nasıl farklılaştığını, görevlere kendi kodlarını ve alanlarını nasıl vereceğinizi ve görev başına notları nasıl tutacağınızı da öğreneceksiniz.

## Burada neler öğreneceksiniz

- Girintileme ve özet görevler kullanarak bir görev yapısı (WBS) oluşturma.
- Görevleri aynı düzey içinde, yeniden girintilemeden taşıma.
- Üç kilometre taşı türü ve sözleşmesel anlar için ayrı zorunlu bayrağı.
- **Kodlar ve alanlar** penceresi üzerinden aktivite kodlarını ve kullanıcı alanlarını yönetme ve bunlara göre gruplama.
- Açık maddeleri takip etmek için notları (görev başına bir kontrol listesi) kullanma.

Tam bir örneği takip etmeyi mi tercih edersiniz? **Dosya → Örnekler** üzerinden [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc)'i açın — "1. Voorbereiding" (Hazırlık) / "2. Fundering & ruwbouw" (Temel & kaba inşaat) / "3. Afbouw" (İnce işler) / "4. Oplevering" (Teslim) fazlaması ve alt görevleriyle, tam olarak aşağıda açıklanan yapıdır.

## Görev yapısı oluşturma

Düz bir görev listesi, görevlerin nasıl ilişkili olduğu hakkında bir şey söylemez. Bir görevi başka bir görevin altına girintileyerek bir ağaç yapısı (WBS — Work Breakdown Structure) oluşturursunuz: üst görev o zaman otomatik olarak bir **özet göreve** dönüşür.

1. Yapının daha derinine yerleştirmek istediğiniz görevi seçin.
2. Girintilemek için **Alt+→** tuşlarına basın. Aynı eylem için ikinci bir kısayol vardır: **Alt+Shift+→** — klavye düzeninizde Alt+→ zaten başka bir şey için kullanılıyorsa kullanışlıdır. İkisi de tam olarak aynı şeyi yapar.
3. Fareyle çalışmayı mı tercih edersiniz? Göreve sağ tıklayın ve bağlam menüsünden **Girinti**'yi seçin.
4. Bir düzey mi fazla gittiniz? **Alt+←** (veya sağ tık → **Girintiyi kaldır**) görevi bir düzey geri taşır.
5. Yepyeni bir alt görev için daha hızlı bir yol vardır: üst göreve sağ tıklayın ve **Alt görev ekle**'yi seçin. Bu, önce bir görev ekleyip sonra ayrıca girintilemek yerine, tek adımda zaten girintilenmiş yeni bir görev oluşturur.

Bir görevin en az bir alt görevi olduğu anda, otomatik olarak bir özet göreve dönüşür: Gantt şemasındaki çubuğu o zaman altındaki tüm alt görevlerin en erken başlangıcından en geç bitişine kadar tüm süreyi kapsar ve kendi süresi ile tarihleri artık bağımsız olarak ayarlanamaz. Bu nedenle bir özet görev her zaman türetilmiş bir değerdir, asla doğrudan girdiğiniz bir plan değildir — alt görevleri silin veya kaydırın, özet görevin çubuğu kendini otomatik olarak ayarlar.

### Yeniden girintilemeden görev taşıma

Bir görevin düzeyini değiştirmenin (girinti/girintiyi kaldır) yanı sıra, yapının kendisini değiştirmeden bir görevin aynı düzey içindeki konumunu da değiştirebilirsiniz:

- **Alt+↑** seçili görevi yukarı taşır, şu anda üstünde olan görevin üzerine.
- **Alt+↓** görevi aşağı taşır.

Bu, ağacın herhangi bir düzeyinde çalışır: bir faz görevini taşıyın, tüm alt görevleri otomatik olarak onunla birlikte taşınır.

## Kilometre taşı türleri

Bir kilometre taşı, bir anı işaretleyen süresi olmayan bir görevdir — bir başlangıç, bir teslim, bir denetim. Open Planner Studio'da, hepsi **Görevler** şerit grubu üzerinden, **Kilometre taşı** düğmesinin yanındaki oku kullanarak, bir kilometre taşı eklemenin üç yolu vardır:

- **Başlangıç kilometre taşı** — bir fazın veya projenin başlangıcını işaretler.
- **Bitiş kilometre taşı** — bir tamamlanmayı işaretler, örneğin bir teslim.
- **Denetim noktası (zorunlu)** — pratikte **Zorunlu (sözleşmesel)** bayrağı zaten işaretlenmiş ve Türü doğrudan **Denetim**'e ayarlanmış bir bitiş kilometre taşıdır, böylece bir denetim anı baştan itibaren hem sözleşmesel olarak zorunlu hem de bir denetim olarak tanınabilir.

**Ctrl+M** kısayolunu mu tercih edersiniz? Bu size, sonra kendiniz yeniden adlandırıp türünü belirleyeceğiniz genel bir kilometre taşı ("Yeni kilometre taşı") verir.

Bir kilometre taşını **Kilometre taşı** onay kutusu açık şekilde seçtiğinizde bu aynı ayrımı özellikler panelinde de göreceksiniz: **Kilometre taşı türü** alanı **Otomatik**, **Başlangıç kilometre taşı** veya **Bitiş kilometre taşı** seçeneklerini sunar. "Otomatik", planlama motorunun kilometre taşının ilişkilerine dayanarak nasıl davranacağına karar vermesini sağlar — kilometre taşının belirgin bir başlangıç veya bitiş karakteri yoksa bunu seçin. Ayrıca, **Zorunlu (sözleşmesel)** onay kutusu vardır: bu, bir kilometre taşının başlangıç ya da bitiş kilometre taşı olmasından bağımsız olarak, onu sözleşmesel olarak bağlayıcı olarak işaretler. Böylece örneğin bir başlangıç kilometre taşını da zorunlu yapabilirsiniz, ya da — **Denetim noktası**'nda olduğu gibi — tek tıklamayla zorunlu bir bitiş kilometre taşı kurabilirsiniz.

## Kodlar ve alanlar: aktivite kodları ve kullanıcı alanları

Daha büyük planlar hızla WBS'ye sığmayan ek boyutlara ihtiyaç duyar: hangi birim, hangi disiplin, hangi yüklenici. **Aktivite kodları** ve **kullanıcı alanları** bunun içindir, ikisi de **Kodlar ve alanlar** penceresi üzerinden yönetilir (**Planlama** sekmesindeki **Yapı** şerit grubu, **Kodlar ve alanlar** etiketli düğme).

- **Aktivite kodları**, bir değer listesine sahip serbestçe tanımlanabilir boyutlardır (örneğin "Lokasyon" veya "Disiplin") — her değerin bir **Kod**u, bir **Açıklama**sı ve bir **Renk**i vardır. Bir görevin, kod türü başına en fazla bir değeri olabilir. Yeni bir boyut başlatmak için **Kod türü ekle**'yi, olası değerleri oluşturmak için **Değer ekle**'yi kullanın.
- **Kullanıcı alanları**, görev tablosunda bir sütun olarak görünen ve görev başına doldurulabilen, kendi **Metin**, **Sayı**, **Tam sayı**, **Maliyet**, **Tarih** veya **Evet/hayır** türündeki alanlarınızdır. "Yüklenici" (metin) veya "Ruhsat alındı" (evet/hayır) gibi bir alan düşünün.

Oluşturulduktan sonra, bir aktivite kodunu görev tablosundaki sütunlar (gerekirse önce **Görünüm → Sütunlar…** üzerinden görünür yapın) veya görevin özellikler paneli üzerinden atarsınız veya bir kullanıcı alanını doldurursunuz.

### Kodlara ve alanlara göre gruplama

Aktivite kodları ve kullanıcı alanları, onlara göre gruplandığınızda gerçekten karşılığını verir: **Görünüm** şerit sekmesine gidin, **Grupla**'yı açın ve **Alan** altında hangi aktivite koduna veya kullanıcı alanına göre kümeleneceğini seçin. Görev tablosu daha sonra WBS ağacı yerine grup başlıkları gösterir — örneğin tüm görevleri birim başına veya disiplin başına, fazlama boyunca bir arada görmek için kullanışlıdır. Aynı anda en fazla iki gruplama düzeyi ayarlayabilirsiniz (örneğin önce birime, ardından disipline göre).

## Notlar: görev başına bir kontrol listesi

Her görevin özellikler panelinde bir **Notlar** bölümü vardır — esasen göreve bağlı kalan küçük bir kontrol listesi. Bu, bir plan tarihine sığmayan gevşek eylem maddeleri içindir: "yükleniciyle henüz kontrol edilmeli", "malzeme henüz sipariş edilmeli", "v2 çizim bekleniyor".

1. **+ Not ekle**'ye tıklayın. Metin alanında odak bulunan yeni, boş bir satır görünür.
2. Notun metnini yazın.
3. Madde ele alındığında onay kutusunu işaretleyin — metin daha sonra üstü çizili hale gelir, ancak not görünür kalır (silinmek yerine tamamlandı olarak işaretlenir) böylece bir görevin geçmişi okunabilir kalır.
4. Bir notu kalıcı olarak kaldırmak için çöp kutusu simgesini kullanın.

Notlar tamamen bilgilendiricidir: planı veya hesaplamayı etkilemezler, bu yüzden bir tarih veya süre olarak ifade edilemeyen açıklamalar için doğru araçtırlar. Pratikte açık ve tamamlanmış notların bir karışımını orta boy örnek "Nieuwbouw 6 Rijwoningen De Akkers"te görün (**Dosya → Örnekler**'de *aantekeningen*/notlar etiketi).

## Okumaya devam edin

- Bu yapıyı — fazlama, özet görevler, kilometre taşları — pratikte [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc)'de görün.
- Yapı artık kurulduğuna göre, sonraki adım görevleri birbirine bağlamaktır: [İlişkiler & kısıtlamalar](docs://gids-relaties-constraints) kılavuzunu okuyun.
- Open Planner Studio'ya hâlâ yeni misiniz? Boş bir projeden hesaplanmış bir plana kadar sürekli bir alıştırma için [Hızlı başlangıç](docs://quick-start) kılavuzuyla başlayın.
