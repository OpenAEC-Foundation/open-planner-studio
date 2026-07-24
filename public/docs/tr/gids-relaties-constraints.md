# İlişkiler & kısıtlamalar

Kendi başına duran görevler, plan değiştiğinde kaymaz. İlişkiler bu bağımlılığı kaydeder; kısıtlamalar bir tarih üzerindeki katı veya esnek bir gerekliliği kaydeder. Bu kılavuz her ikisini de [Hızlı başlangıç](docs://quick-start)'tan daha derinlemesine ele alır: hangi ilişki türünü ne zaman seçersiniz, bir gecikme/öne alma tam olarak ne yapar, sıkı sabitleme ne anlama gelir ve özellikle *ne zaman* kullanılmamalıdır, ve bir son tarih bir kısıtlamayla nasıl ilişkilidir?

## Burada neler öğreneceksiniz

- Dört ilişki türü (FS/SS/FF/SF) ve her birinin ne zaman kullanılacağı.
- Gecikme ve öne alma, yüzde gecikme ve geçen-süre gecikmesi dahil (örneğin beton kürleme için).
- İlişki eklemenin üç yolu: sürükleme, seçim ve ilişkiler tablosu.
- Sekiz kısıtlama türünün tamamı, artı sıkı sabitleme (P6 Mandatory) ve ikincil kısıtlama.
- Son tarih ile kısıtlama arasındaki fark.

Giriş seviyesindeki [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) örneğini (SNET ruhsat, SS örtüşmesi, FF bağlantısı) ve son tarih çakışması için [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc)'i takip edin.

## Dört ilişki türü

Her ilişkinin bir **Öncül**ü ve bir **Ardıl**ı vardır, ve dört türden biridir:

- **FS — Finish-Start**: ardıl ancak öncül bittiğinde başlar. İnşaatta açık ara en yaygın ilişki: önce temel, sonra kaba inşaat. Bir görev diğeri bitmeden fiziksel olarak başlayamıyorsa FS kullanın.
- **SS — Start-Start**: her iki görev de (kabaca) aynı anda başlar. Bunu, birincisi başladıktan sonra iki görevin birlikte yürüyebildiği durumlarda kullanın — örneğin kaba inşaat başladıktan sonra duvar işi ve çatı konstrüksiyonunun, biri diğerinin bitmesini beklemeden örtüşerek başlaması.
- **FF — Finish-Finish**: her iki görev de (kabaca) aynı anda biter. İki görev bağımsız olarak yürüyebilir ama birlikte tamamlanması gerektiğinde kullanışlıdır — örneğin bir odanın tek seferde teslim edilebilmesi için fayans işinden kısa süre sonra bitmesi gereken boya işi.
- **SF — Start-Finish**: öncülün, ardılın bitmesine izin verilmeden önce başlaması gerekir. İnşaat pratiğinde açık ara en az görülen tür — bir bitirme görevinin ancak başka bir görev başladıktan sonra durabildiği uç durumlar için saklayın (örneğin bir vardiya devri).

Bu ilk üç türü gerçek bir örnekte tanımak mı istiyorsunuz? "Verbouwing & Aanbouw Eengezinswoning" örneği, ana fazlar arasında bir FS zinciri, duvar ve çatı işleri arasında bir SS örtüşmesi ve fayans ile boya işleri arasında bir FF bağlantısı içerir.

## Gecikme ve öne alma

Bir ilişkinin sıfır olması gerekmez: bir **gecikme** (pozitif) öncül ile ardıl arasına bekleme süresi ekler, bir **öne alma** (negatif, negatif bir sayı olarak girilir) ardılın daha erken başlamasına izin verir — kasıtlı bir örtüşme. Gecikme alanı (özellikler panelinde ve ilişkiler tablosunda **Gecikme**) kısa bir gösterimi kabul eder:

- `2d` — 2 iş günü gecikme (varsayılan birim: proje takvimindeki gün).
- `3ed` — 3 **geçen** gün: hafta sonları veya tatiller boyunca da devam eden takvim günleri. Bu, örneğin **beton kürleme** için istediğiniz birimdir: beton cumartesi ve pazar günleri de kürlenmeye devam eder, bu yüzden aralarında bir hafta sonu varsa "3 iş günü" gecikmesi kürleme süresini olduğundan az tahmin eder. Bu durumda, gecikmeyi geçen-süre birimine ayarlayın.
- `50%` — bir yüzde gecikme: öncülün süresinin %50'si, öncülün süresi değiştikçe her CPM çalıştırmasında yeniden hesaplanır (MS Project ile aynı mantık). Bekleme süresi doğal olarak önceki görevin büyüklüğüyle ölçeklendiğinde kullanışlıdır.
- `-25e%` — negatif, yüzde geçen-süre gecikmesi: geçen günler cinsinden öncülün süresinin %25'i kadar bir öne alma.

Negatif bir sayı (öne alma), ardılın öncül hâlâ sürerken başladığı anlamına gelir — örneğin aynı odada sıva işinin son günlerinde zaten başlayan fayans işi.

## İlişki ekleme

Zaten çalıştığınız yere bağlı olarak bir ilişki oluşturmanın üç yolu vardır:

1. **Gantt şemasında sürükleme**: **Shift** tuşunu basılı tutun ve öncülün çubuğundan ardılın çubuğuna sürükleyin. Bırakır bırakmaz, gecikmesi 0 olan bir FS ilişkisi hemen oluşturulur ve **İlişki türü** penceresi hemen görünür — burada özellikler panelini açmak zorunda kalmadan türü (FS/SS/FF/SF) ve gecikmeyi ayarlayabilirsiniz.
2. **Seçim + düğme**: önce öncülü seçin, ardından Ctrl/Cmd tuşunu basılı tutarak ardılı seçin (bu sırayla) ve **Seçimden yeni ilişki**'ye tıklayın (**Planlama** sekmesindeki **İlişkiler** şerit grubu, veya **İlişkiler** sekmesinin kendisi). Bu düğme yalnızca tam olarak iki görev seçildiğinde çalışır.
3. **Doğrudan ilişkiler tablosunda**: **İlişkiler** sekmesini açın (İlişkiler şerit grubundaki **Yönet** üzerinden). Tablo, ilişki başına, **Öncül**, **Tür**, **Gecikme**, **Ardıl**, **Belirleyici** ve **Serbest bolluk** sütunlarını gösterir — tür ve gecikme doğrudan burada düzenlenebilir, daha önce sürükleyerek veya seçerek oluşturduğunuz ilişkiler dahil.

**Belirleyici** sütunu, bir hesaplamadan sonra, hangi ilişkinin ardılın başlangıç veya bitiş tarihini gerçekte belirlediğini gösterir — birden fazla öncülü olan bir görev için bu, mutlaka en son oluşturduğunuz ilişki değildir, en geç (belirleyici) tarihe sahip olandır.

## Kısıtlama türleri

Bir kısıtlama, ilişkilerinden bağımsız olarak bir göreve bir tarih sınırı dayatır. Open Planner Studio'nun, özellikler panelindeki **Kısıtlama** alanı üzerinden ayarlanan sekiz türü vardır:

- **Mümkün olduğunca erken (ASAP)** — tarih sınırı yok, varsayılan.
- **Mümkün olduğunca geç (ALAP)** — görev, bolluğu içinde mümkün olduğunca ileri kayar.
- **Şu tarihten önce başlamaz (SNET)** — başlangıç tarihi üzerinde alt sınır (örneğin: ruhsat verilmeden başlamayın).
- **Şu tarihten sonra başlamaz (SNLT)** — başlangıç tarihi üzerinde üst sınır.
- **Şu tarihten önce bitmez (FNET)** — bitiş tarihi üzerinde alt sınır.
- **Şu tarihten sonra bitmez (FNLT)** — bitiş tarihi üzerinde üst sınır.
- **Şu tarihte başlamalı (MSO)** — sabit bir başlangıç tarihi.
- **Şu tarihte bitmeli (MFO)** — sabit bir bitiş tarihi.

SNET/SNLT/FNET/FNLT'nin tümü **esnek sınırlardır**: CPM hesaplaması bunları dikkate alır, ancak bir ihlal "sadece" negatif bolluğa yol açar, bir çökme veya engellemeye değil. "Verbouwing & Aanbouw Eengezinswoning" örneği, örneğin bir görevin ruhsat verilmeden başlamasını önlemek için bir SNET kısıtlaması kullanır.

### Sıkı sabitleme (P6 Mandatory)

MSO ve MFO, yalnızca bu iki tür için görünen **Zorunlu (sabitleme mantığı)** onay kutusu aracılığıyla ek olarak **sıkı** hale getirilebilir. Bu, Primavera P6'dan gelen "P6 Mandatory" kısıtlamasıdır: çubuk, öncülleri mantıksal olarak buna aykırı olsa bile tarihe sabitlenir. Sıkı sabitlemeyi açtığınızda, Open Planner Studio tek seferlik bir uyarı gösterir: **sıkı sabitleme ilişkileri geçersiz kılar — çubuk, öncüllerinden önce bile olsa tarihe sabitlenir. Bir ihlal, yukarı akışta negatif bolluğa dönüşür.**

Bu yüzden bir sıkı sabitlemeyi yalnızca bir tarih gerçekten pazarlığa açık olmadığında ve planın mantığından ayrı durduğunda kullanın — örneğin ilerlemeden bağımsız olarak sabit olan, yasal olarak belirlenmiş bir teslim tarihi. Bunu "bu görevin o tarihte olmasını istiyorum" için bir genel kural olarak kullan**mayın**: bu durumda esnek bir kısıtlama (SNET/FNLT/vb.) ya da basitçe iyi planlanmış bir ilişki zinciri neredeyse her zaman daha iyi bir seçimdir. Sıkı bir sabitleme, tüm ağı yukarı akışta sıkıştırabilir: önceki görevler sabitleme noktasının içinden geçmek isterse, negatif bolluk ortaya çıkar ve sabitlenmiş görevden önceki tüm zincir boyunca yayılır — bu, planın çeliştiğinin bir işaretidir, sabitlemenin sorunu çözdüğünün değil.

### İkincil kısıtlama

Sıkı olmayan bir kısıtlama için (yani ASAP/ALAP değil ve sıkı bir MSO/MFO değil), aynı dört esnek türden (SNET/FNET/SNLT/FNLT) ikinci bir sınır olan bir **ikincil kısıtlama** ekleyebilirsiniz; bu, birincil kısıtlamayla aynı tarafı sınırlayamaz. Bu, örneğin başlangıç tarihinde aynı anda hem bir alt hem de bir üst sınır ayarlamanızı sağlar. Open Planner Studio kombinasyonu canlı olarak doğrular ve kombinasyon geçersiz olur olmaz bir hata gösterir — örneğin izin verilmeyen bir sıkı sabitlemenin yanında bir ikincil kısıtlama.

## Son tarihler ve kısıtlamalar karşılaştırması

Bir **son tarih** (ayrı bir alan, özellikler panelinde) bir kısıtlamaya benziyor ama kasıtlı olarak farklı: bitiş tarihi üzerinde esnek, bilgilendirici bir üst sınırdır, Gantt şemasında aşağı ok işaretçisi olarak gösterilir — görev hâlâ zamanında olduğu sürece yeşil, erken bitişi bunu geçtiğinde kırmızı. Bir son tarih planı zorlamaz (aktif olarak hesaplamaya katılan bir MFO/FNLT kısıtlamasının aksine), ancak bolluk hesaplanırken bir üst sınır olarak sayılır: plan doğal olarak son tarihi karşılamıyorsa, bu herhangi bir kısıtlama söz konusu olmadan **negatif bolluk** üretir.

Tam olarak bu, [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) örneğinde olur: planın doğal süresinin karşılamadığı, kasıtlı olarak sıkı bir sözleşme son tarihi içerir, bu da görünür negatif bolluk ile sonuçlanır — bir son tarih çakışmasının pratikte nasıl göründüğünü, hiçbir şeyin "bozulmadan" görmek istiyorsanız incelenecek iyi bir örnek: plan basitçe hesaplanmaya devam eder ve nerede zorlandığını gösterir.

Genel kural: planın mantığını zorlamadan izlemek istediğiniz bir hedef tarih için bir **son tarih** kullanın, ve bir tarih gerçekten hesaplamanın uyması gereken bir sınır olduğunda bir **kısıtlama** (esnek veya, istisnai olarak, sıkı) kullanın.

## Okumaya devam edin

- SNET, SS örtüşmesini ve FF bağlantısını pratikte görün: [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc).
- Son tarih çakışmasını pratikte görün: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Yapı henüz kurulmadı mı? Önce [Planlama & WBS](docs://gids-plannen-wbs)'i okuyun.
- Görev süresini etkileyen takvimler ve çalışma saatleri için: [Takvimler & saat planlaması](docs://gids-kalenders-uren) kılavuzu.
