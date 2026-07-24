# İçe/dışa aktarma

Open Planner Studio bir projeyi varsayılan olarak IFC olarak saklar — yanında ayrı bir proje dosyası olmadan. Ama bazen bir plan uygulamanın dışında da yaşamalıdır: Primavera P6'da, Microsoft Project'te, veya bir hesap tablosu için düz bir tablo olarak. Bu kılavuz, yerel IFC biçiminin tam olarak ne anlama geldiğini, her dışa aktarma biçiminin neyi taşıyıp neyi taşımadığını ve uygulamada içe/dışa aktarmanın nerede yaşadığını açıklar.

## Burada neler öğreneceksiniz

- "IFC yerel biçimdir" ifadesinin açma ve kaydetme için tam olarak ne anlama geldiği.
- MS Project'e (MSPDI) ve Primavera P6 XML'e dışa aktarırken neyin gelip neyin gelmediği.
- CSV dışa aktarımının neyi içerdiği — ve neyin kasıtlı olarak dışarıda bırakıldığı.
- Nerede içe ve dışa aktarma yapılır: **Backstage → Dışa aktar** ve **Backstage → İçe aktar**.
- Uzantıların ekstra içe aktarma biçimleri nasıl ekleyebileceği.

## IFC: yerel biçim

Bir Open Planner Studio projesi bir IFC 4x3 dosyasıdır (buildingSMART standardı). Yanında ayrı bir JSON veya proje dosyası yoktur: **Kaydet** ve **Aç** (Backstage, veya **Ctrl+S**/**Ctrl+O**) doğrudan IFC okur ve yazar. Bu, uygulamada yaptığınız her şeyin — görevler, WBS, kısıtlamalı ilişkiler, kaynaklar ve atamalar, takvimler (hem proje takvimi hem de kaynak takvimleri), baseline'lar, ilerleme, notlar, aktivite kodları ve kullanıcı alanları, projeler arasındaki dış bağlantılar — aynı dosyada sona erdiği ve bir sonraki **Aç**tığınızda tam olarak geri geldiği anlamına gelir. Uygulamada yeni bir tür proje verisiyle karşılaşırsanız, bunun IFC üzerinden gidip geldiğini varsayabilirsiniz; bir şey gidip *gelmezse*, bu aşağıda açıkça belirtilir.

IFC ayrıca bu uygulamanın OpenAEC araç setinin geri kalanına nasıl bağlandığıdır: aynı dosya, 4D bağlantısı için BIM yazılımı tarafından okunabilir (bina modeliyle birlikte plan).

## Diğer biçimlere dışa aktarma

Dört biçim için **Backstage → Dışa aktar**'ı açın:

- **CSV (noktalı virgülle ayrılmış)** — evrensel tablo dışa aktarımı. Tarihler ve sürelerle birlikte tüm görevler.
- **MS Project XML** — Microsoft Project'te açılır. Tam WBS yapısı.
- **Primavera P6 XML** — Oracle Primavera P6 için.
- **IFC 4x3** — buildingSMART standardı, yerel biçimle aynı (açık dosyalarınızın geri kalanına dokunmadan ayrı bir dosyaya "farklı kaydet" olarak veya bir kopyayı paylaşmak için kullanışlı).

Her biçimin kendi sınırlamaları vardır: hedef biçim ne kadar zenginse, o kadar çok şey gelir, ama üç dış biçimden hiçbiri IFC'nin tam bir aynası değildir.

### CSV

CSV dışa aktarımı **yalnızca görev tablosunu** içerir: WBS kodu, ad, süre (gün), başlangıç, bitiş, öncüller (bir metin kodu olarak, örn. `2.1FS+3d`), görev türü, durum, tamamlanma (%), gerçek başlangıç/bitiş, kritik (evet/hayır), toplam bolluk ve açıklama. **Kaynaklar, atamalar, takvimler ve baseline'lar kasıtlı olarak dışarıda bırakılmıştır** — CSV, planı bir hesap tablosunda görüntülemek veya düzenlemek isteyen herkes için tamamen bir görev tablosudur, tam sadakatli bir proje alışverişi değil. Bir CSV dosyasını geri **içe aktardığınızda**, baseline'lar bu nedenle boş kalır (bunları okuyacak hiçbir şey yoktu).

### MS Project XML (MSPDI)

MSPDI, CSV'den önemli ölçüde daha zengindir: kaynaklar, atamalar (yükleme eğrileri dahil), takvimler ve baseline'lar gelir. Yine de her şey MSPDI'de ifade edilebilir değildir. Dışa aktarımda uygulama, bir şey kaybolduğunda etkilenen öğelerin tam sayısıyla geliştirici konsolunda (`console.warn`) uyarır:

- Projeler arasındaki **dış bağlantılar** düşürülür (diğer görevin "hayalet" referansı yalnızca uygulama içinde kalır).
- **Esnek Şu tarihte başlamalı/bitmeli kısıtlamaları** (esnek `MSO`/`MFO`) SNET/FNET'e düşürülür — MSPDI kodları 2/3 *sıkı*dır (Must), bu yüzden esnek varyantın üst sınırı kaybolur. Sıkı `MSO`/`MFO` tam olarak dışa aktarılır.
- **İkincil kısıtlamalar** kaybolur — MSPDI'nin görev başına yalnızca bir kısıtlama alanı vardır.
- **Hammock görevleri** (türetilmiş süre) hesaplanan tarihlerle düz bir görev olarak dışa aktarılır — MSPDI'nin yerel bir hammock/LOE türü yoktur.
- **Görev notları** kasıtlı olarak dışa aktarıl**maz**, MSPDI'nin bir `<Notes>` alanı olmasına rağmen: bizim notlarımız, düz metne temiz bir şekilde çevrilmeyen, onay-kutulu bir kontrol listesi biçimindedir.
- **Kritik-yol tanımı** (kritiğe-yakın modu/eşik) ve diğer planlama seçenekleri MSPDI'de yerel olarak ifade edilemez ve bu yüzden kaybolur — bunlar yalnızca IFC üzerinden korunur.

### Primavera P6 XML

MSPDI ile aynı türden bir denge, birkaç P6'ya özgü tuhaflıkla:

- **Dış bağlantılar** ve **hammock görevleri**, MSPDI ile aynı şekilde, her biri bir uyarıyla düşürülür/basitleştirilir.
- **Görev notları** burada da dışarıda bırakılır — P6 XML'in bunlar için uygun bir alanı yoktur.
- Bir ilişkideki **yüzde gecikme** (örn. öncülün süresinin %40'ı), P6'nın yüzde-gecikme kavramı olmadığı için sabit bir gün sayısına "gömülür".
- **Takvim-günü gecikmesi** (çalışma günleri yerine geçen gün cinsinden gecikme), düz saat bazlı bir gecikme olarak dışa aktarılır — P6'nın ilişki başına ayrı bir gecikme birimi yoktur.
- **LATE_PEAK** yükleme eğrisinin P6 karşılığı yoktur ve en yakın yaklaşım olarak ("Early Peak") dışa aktarılır.
- Planlama seçenekleri (MSPDI'de olduğu gibi) dışa aktarılmaz.

Bu uyarılar özensizlik değildir — kasıtlı, açık bir seçimdir: düşürülen öğe başına görünür bir uyarı, sessiz veri kaybından iyidir. Örneğin [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) örneğini (görev notları ve yüzde gecikmeli bir ilişki içerir) açın ve P6'ya veya MS Project XML'e dışa aktarın: geliştirici konsolu daha sonra tam olarak hangi öğelerin düşürüldüğünü veya basitleştirildiğini ve kaçının olduğunu gösterir.

## İçe aktarma

**Dosya → Aç** (veya **Backstage → Aç**), `.ifc`, `.csv` ve `.xml` dosyalarını kabul eder. Bir `.xml` dosyası için, uygulama içeriğe dayanarak bunun bir Primavera P6 mı yoksa bir MS Project dosyası mı olduğunu kendisi tespit eder. Yukarıda açıklandığı gibi: bir CSV veya P6 içe aktarımı **baseline'sız** bir proje üretir (kaynakta hiç yoktu), IFC ve MSPDI ise baseline'ları birlikte getirir.

## Uzantı içe aktarıcıları

Yukarıdaki sabit biçimlerin ötesinde, yüklü uzantılar kendi içe aktarıcılarını ekleyebilir — örneğin varsayılan olarak desteklenmeyen bir biçim için. Bunlar **Backstage → İçe aktar** altında, her biri kendi adı, açıklaması ve eşleşen dosya uzantılarıyla görünür; hiçbir içe aktarma uzantısı yüklü değilken bu bölüm boştur. Nelerin mevcut olduğunu görmek için **Backstage → Uzantılar**'ı kontrol edin.

## Daha fazla okuma

- Baseline'lar yalnızca IFC ve MS Project XML üzerinden gelir, CSV veya P6 üzerinden değil — bir baseline'ın nasıl kaydedileceği için [Baseline'lar & ilerleme](docs://gids-baselines-voortgang) kılavuzunu okuyun.
- Kaynaklar, atamalar ve yükleme eğrileri — bunların dışa aktarmadan önce nasıl kurulduğu için [Kaynaklar, histogram & nivelleme](docs://gids-resources-histogram) kılavuzunu okuyun.
