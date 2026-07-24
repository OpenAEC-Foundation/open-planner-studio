# Takvimler & saat planlaması

"5 gün" süreli bir görev, ancak bir takvimle birleştiğinde bir anlam ifade eder: hangi günler çalışma günü, hangi saatlerde çalışılıyor ve bir tatil ya da geçici kapanma nedeniyle hangi günler düşüyor? Bu kılavuz, proje takvimini, kaynak takvimlerini ve saate kadar planlama yapmak isteyenler için isteğe bağlı saat planlamasını kapsar.

## Burada neler öğreneceksiniz

- Proje takvimini kurma: çalışma günleri, çalışma saatleri, tatiller.
- İnşaat tatili dahil, tatilleri yıl başına otomatik olarak oluşturma.
- Tek seferlik, ad hoc bir kapanma ekleme (örneğin bir don molası).
- Bir kaynağa, örneğin 4 günlük bir çalışma haftası için kendi takvimini verme.
- **Saat planlaması** ana anahtarını açma ve çalışma-saati bantları/vardiyaları kurma.
- Gün bazlı ve saat bazlı görevlerin aynı planda nasıl bir arada var olduğu.

Her ikisi de **Dosya → Örnekler** üzerinden de erişilebilen [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (don molası, 4 günlük kaynak takvimi) ve [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc)'i (donatı ve döküm işi için saat planlaması) takip edin.

## Proje takvimi

Takvimler, **Planlama** sekmesindeki **Takvim** şerit grubu üzerinden açılan **Takvimler** penceresinde yönetilir (**Takvim** ve **Tatiller** düğmelerinin ikisi de aynı pencereyi açar). Bu pencere solda projedeki her takvimin bir kütüphanesini gösterir — yalnızca proje takvimi değil, aynı zamanda kaynak takvimleri de (aşağıya bakın) — hangi takvimin şu anda **Proje takvimi** olduğunu bir yıldız işaretler. Soldan bir takvim seçin ve sağda düzenleyin; listeden farklı bir takvimi yeni proje takvimi yapmak için **Proje varsayılanı olarak ayarla**'yı kullanın. Seçili takvim için şunları ayarlarsınız:

- **Çalışma günleri** — yedi haftalık günden (Pzt–Paz) hangilerinin çalışma günü sayıldığı. Varsayılan olarak Pazartesi'den Cuma'ya.
- **Çalışma saatleri** — **Başlangıç (saat)**, **Bitiş (saat)** ve ortaya çıkan **Günlük saat**.
- **Tatiller** — her biri bir **Açıklama** ve bir **Başlangıç**/**Bitiş** tarihine sahip izin günleri listesi.

Proje takvimindeki değişiklikler hesaplamada hemen etkili olur: aksi takdirde artık çalışılmayan bir güne düşecek görevler bir sonraki çalışma gününe kayar.

### Tatilleri otomatik oluşturma

Tatilleri tek tek yazmak yerine, takvim penceresinde **Tatilleri oluştur…** üzerinden bunları otomatik olarak oluşturabilirsiniz. Bir **Ülke** (Hollanda, Almanya, Belçika, Fransa, Birleşik Krallık, Avusturya, İsviçre) ve isteğe bağlı olarak bir **Bölge** seçin. Hollanda için özel bir inşaat seçeneği de vardır: **İnşaat tatili**, **Kuzey**, **Orta** veya **Güney** (veya **Yok**) seçimiyle. Oluşturulan inşaat-tatili tarihleri tavsiye niteliğindedir — uygulama bunu kendisi belirtir: geçerli yıl için tam tarihleri Bouwend Nederland ile doğrulayın. Ülke/bölge seçtikten sonra, pencere bir önizleme gösterir — örneğin "12 tatil, 1-1-2026–31-12-2026" — **Oluştur**'a tıklamadan önce.

Bir yıl sınırını aşan veya daha sonra uzatılan bir proje için tatiller oluşturursanız, Open Planner Studio zaten oluşturulmuş tatillerin artık tüm proje dönemini kapsamadığını fark eder ve pencere, daha önce manuel olarak eklediğiniz herhangi bir tatili kaybetmeden eksik yılları eklemek için **Yeniden oluştur**'u sunar.

### Ad hoc kapanmalar (örneğin bir don molası)

Her çalışma kesintisi yıllık tekrar eden bir tatil değildir. Tek seferlik, projeye özgü kapanmalar için — bir haftalık don molası, yerel bir etkinlik kapanması — aynı listede **Tatil ekle** üzerinden manuel olarak ekstra bir satır eklersiniz: bir **Açıklama** (örneğin "Don molası") ve bir **Başlangıç**/**Bitiş** dönemi verin. Böyle bir ad hoc kapanma, teknik olarak oluşturulmuş bir tatille aynı şekilde çalışır — CPM hesaplaması bunu tıpkı öyle dikkate alır — ancak otomatik yıllık oluşturmadan ayrıdır, bu yüzden sonraki bir **Yeniden oluştur** bunun üzerine yazmaz.

[Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) örneğinde pratikte bir don-molası dönemini görün: altı evin ortak temeli, otomatik olarak oluşturulan Hollanda tatillerinden ayrı olarak, takvimde ayrı bir tatil benzeri girdi olarak eklenmiş bir don-molası dönemi içerir.

## Kaynak takvimleri

Tek bir proje takviminin yanı sıra, her kaynak kendi takvimini alabilir — örneğin haftada yalnızca dört gün uygun olan bir taşeron için, projenin geri kalanı beş gün sürerken. Kaynak takvimleri, kaynak üzerindeki **Takvim** alanı (yanındaki **Düzenle…** düğmesiyle) veya **Kaynak takvimi** penceresi başlığı üzerinden yönetilir; varsayılan olarak bir kaynak **Proje takvimi**ne ayarlıdır.

Bir kaynak takvimi proje takvimiyle aynı formu kullanır (**Çalışma günleri**, **Çalışma saatleri**, **Tatiller**), ama kaynak için tamamen bilgilendiricidir: görevin kendi CPM tarihlerinde hiçbir şeyi değiştirmez. Etkilediği şey **yük** (histogram) ve **nivellemedir**: bir kaynak 4 günlük bir haftaya ayarlanmışken atandığı görev 5 iş günü sürüyorsa, kaynak yükü beşinci günde bir açık gösterir ve nivelleme penceresi (**Kaynakları dengele**) kaynağın görevin ihtiyaç duyduğu tüm günlerde çalışmadığı konusunda uyarır — bolluk içinde kaydırmak bu takvim uyuşmazlığını otomatik olarak çözmez.

Pratikte 4 günlük bir kaynak takvimini görün: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc)'teki montajcılar, kısaltılmış bir çalışma haftasıyla kendi takvimlerinde çalışırken, projenin geri kalanı normal proje takviminde çalışmaya devam eder.

## Saat planlaması: ana anahtar

Varsayılan olarak, Open Planner Studio tamamen **gün ayrıntı düzeyinde** çalışır — her görevin tam (iş) gün cinsinden bir süresi vardır. Saat cinsinden planlamayı tercih ettiğiniz görevler için (7:00'de başlayan ve hava dönmeden çok önce 14:00'e kadar bitmesi gereken bir döküm düşünün), isteğe bağlı **Saat planlaması** vardır.

Ana anahtarı **Ayarlar → Zaman çizelgesi / Yakınlaştırma → Saat planlamasını etkinleştir** üzerinden açın. Bu, bir saat zaman ölçeği, çalışma-saati bantlarına sahip vardiyalar ve saat hassasiyetinde görev çubukları ekler; anahtar kapalıyken, uygulama tamamen önceki gibi, gün ayrıntı düzeyinde çalışır. Aynı projede hem gün bazlı hem de saat bazlı görevleri birleştirmek istiyorsanız açacağınız bir **Karma gün/saat planlamasına izin ver** seçeneği de vardır (aşağıya bakın).

## Çalışma-saati bantları ve vardiyalar

Saat planlaması açıkken, takvim ekstra bir katman kazanır: sadece "çalışma günü evet/hayır" yerine, gün başına **çalışma-saati bantları** (takvim penceresindeki **Çalışma saatleri** bölümü) ayarlarsınız — çalışmanın gerçekleştiği tam zaman aralıkları. İki bant arasındaki bir boşluk otomatik olarak bir mola olur; bir mola planlamak için, bir boşluk görünene kadar sadece bitişik bantların zamanlarını ayarlayın.

Her seferinde elle bant çizmek zorunda kalmayasınız diye, hazır **vardiya ön ayarları** vardır:

- **Gündüz vardiyası** — normal ofis saatleri, gün başına bir bant.
- **2 vardiya** — iki ardışık vardiya.
- **3 vardiya** — neredeyse tüm günü kapsayan üç ardışık vardiya.
- **Gece vardiyası** — gece yarısını geçen bir vardiya.
- **24/7** — kesintisiz çalışma, kesinti yok.

Bu ön ayarların yanı sıra, örneğin Cuma günü haftanın geri kalanından daha kısaysa, bantları tamamen elle **Haftanın gününe göre ayarla…** de yapabilirsiniz. Daha sık yeniden kullanmak istediğiniz kendi kombinasyonunuzu mu oluşturdunuz? **Ön ayar olarak kaydet…** ile kaydedin — ön ayar bu cihazda yerel olarak saklanır ve daha sonra herhangi bir projede tekrar seçilebilir. Bölüm ayrıca **Türetilmiş saat/gün**'ü de gösterir: yapılandırılmış bantlardan çıkan etkin çalışma saati sayısı.

## Saat bazlı görevler

Saat planlaması açıkken ve bir görev bir **saat takviminde** (sadece tam günler yerine çalışma-saati bantlarına sahip bir takvim) iken, görev düzenleme penceresi ekstra alanlar gösterir: **Süre (gün)**'ün yanında **Süre (saat)**, ve **Toplam saat**'te bir toplam. Saat girişi için bir saat takvimi gereklidir — saatleri normal bir gün takviminde girmeyi deneyin, ipucu bunu belirtir.

Pratikte döküm görevleri tam olarak böyle planlanır: 6 saat gibi bir süreye sahip, o gün sabah vardiyası olan bir vardiya takvimine bağlı bir "Vloer storten toren A" (A kulesi zemin dökümü) görevi. Donatı ve döküm işi için saat planlaması kullanan büyük örnek [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc)'te bu deseni görün.

## Gün bazlı ve saat bazlı görevleri karıştırma

Saat planlamasından yararlanmak için bir projenin tamamen saat üzerinde çalışması gerekmez: **Karma gün/saat planlamasına izin ver** işaretliyken, gün bazlı görevler (normal proje takviminde) ve saat bazlı görevler (bir saat takviminde) aynı planda bir arada var olabilir ve birbiriyle ilişkilendirilebilir. Bu durumda görev tablosu her görevin süresini kendi biriminde gösterir — bir gün görevini gün cinsinden, bir saat görevini saat cinsinden — ve farklı saat/gün oranına sahip görevler yan yana çalıştığında tablonun altında uyarır, böylece hangi karşılaştırmaların elma-elma ve hangilerinin öyle olmadığı net kalır.

## Okumaya devam edin

- Pratikte bir don molası ve 4 günlük bir kaynak takvimi görün: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Donatı ve döküm işi için pratikte saat planlamasını görün: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- İlişkiler ve gecikme/öne alma aynı takvim birimlerinde çalışır — iş günü ve geçen-süre gecikmesi arasındaki fark için [İlişkiler & kısıtlamalar](docs://gids-relaties-constraints)'i okuyun.
