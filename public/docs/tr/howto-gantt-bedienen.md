# Gantt'te sürükleme, kaydırma ve yakınlaştırma

Amaç: Zaman çizelgesini fareyle kullanmak. Bir çubuğu taşımak veya süresini değiştirmek, zaman çizelgesini kaydırmak, kutuyla görev seçmek ve yakınlaştırıp uzaklaştırmak.

## Bunu ne zaman kullanırsınız

Gantt'te tuğla işinin iki gün sonra başlaması gerektiğini veya dökümün bir gün daha uzun sürdüğünü görürsünüz. Bunu doğrudan çubuk üzerinde yapmak istersiniz. Ya da aylar süren bir projeniz vardır ve inşaatçıların tatiline hızlıca gitmek istersiniz. Fare bunun için birkaç hareket sunar. Hangi hareketin ne yaptığı, sürüklemeye nereden başladığınıza ve kaydırma ayarınıza bağlıdır.

## Adımlar

### Bir çubuğu taşımak

1. Bir görev çubuğunun ortasına basın ve yatay olarak sürükleyin. Başlangıç ve bitiş birlikte taşınır, tam günler halinde. Süre aynı kalır.
2. Bırakın. Çubuk yeni yerinde kalır. Planlama artık güncel değildir. *Hesapla* (F5) öğesine basın. Ya da *Otomatik hesapla* açıksa uygulama bunu kendisi yapar.

Görevin bir öncülü varsa, uygulama yeni başlangıcı *Şu tarihten önce başlamaz (SNET)* kısıtlaması olarak kaydeder. Bırakmanızdan sonra uygulama bunu bildirir. Bunun nedeni ve başka bir kısıtlamayla ne olduğu, [Kısıtlamalar ve son tarihler](docs://uitleg-constraints) sayfasında yer alır. Özgün başlangıca geri sürüklerseniz, özgün kısıtlama da geri gelir.

Yanlara değil de çoğunlukla yukarı veya aşağı sürüklerseniz, görevi başka bir satıra taşırsınız. Tarihler aynı kalır. İlk birkaç pikselde seçtiğiniz yön, tüm sürükleme için geçerlidir. Böylece tek bir hareket hiçbir zaman hem tarihleri hem yapıyı aynı anda değiştirmez. Bkz. [Yapıyı değiştirme](docs://howto-structuur-aanpassen).

### Süreyi değiştirmek

1. Fareyi çubuğun sağ kenarına getirin. İmleç sola ve sağa işaret eden bir ok olur.
2. Kenarı sürükleyin. Sürüklerken, temanın vurgu renginde (varsayılan olarak turuncu) küçük bir etiket görünür. Etiket, görevin şimdi alacağı süreyi gösterir, örneğin *4d*. Etiket sürüklemeyi anında izler. Bırakmadan önce yeni süreyi görürsünüz. Sağ kenarda etiket çubuğun içinde kalır; sol kenarda ise hemen solunda durur. Etiket süreyi, süre sütununun gösterdiği biçimde gösterir.
3. Bırakın. Süre, etiketin gösterdiği süredir.

Sol kenar başlangıcı taşır ve bitişi yerinde bırakır. Görev böylece önden kısalır veya uzar. Taşımadaki SNET kuralı burada da geçerlidir. Çubuğun ortasını sürüklediğinizde etiket görünmez: süre değişmez.

Süre, görevin takviminin iş günlerini sayar. Hafta sonları ve tatil günleri sayılmaz. Gün cinsindeki bir görev, bir iş gününden kısa olamaz. Saat cinsindeki bir görevde uygulama, farenizin altındaki zaman çizelgesinin adımına yuvarlar: en az bir saat. Ya da yeterince yakınlaştırırsanız ve *Çok yakınlaştırıldığında çeyrek saatleri göster* açıksa, çeyrek saat.

Tek bir sürükleme, ne kadar uzun sürerse sürsün, *Geri al* içinde tek bir adımdır. Bölünmüş bir çubukta kenarlar farklı çalışır. Bkz. [Bir görevi bölme](docs://howto-taak-splitsen).

### Zaman çizelgesini kaydırmak

Boş arka plandaki bir sürüklemenin ne yaptığı, kaydırma modunuza bağlıdır. Bunu *Uygulama ayarları* içinde, *Görünüm* sekmesinde seçersiniz. *Gantt › Kaydırma ve yakınlaştırma* altındaki *Mod* ayarında:

- **Yakınlaştır + sürükle** (varsayılan): Sol fare tuşuyla boş arka planda sürüklerseniz, zaman çizelgesi fareyle birlikte hareket eder, bir harita gibi. İmleç bir el olur. Bir çubuğun üzerinde sürükleme yalnızca bir çubuk hareketi başlatır.
- **Konum** ve **Tuşlar**: Aynı sürükleme bir seçim kutusu yapar. Zaman çizelgesini tekerlekle (bkz. [Uygulama ayarları](docs://ref-instellingen)) veya orta fare tuşuyla kaydırırsınız.

**Orta fare tuşu** (tekerleğe basılı) zaman çizelgesini her modda kaydırır. Bir çubuğun üzerinden başlasanız bile çalışır. Başka bir hareket sürerken çalışmaz, örneğin bir çubuğu sürüklerken.

### Görevleri kutuyla seçmek

Kutu, dokunduğu satırlardaki tüm görevleri seçer. Yalnızca kutunun yüksekliği sayılır, zaman ekseni sayılmaz.

1. Boş bir alanda başlayın. *Yakınlaştır + sürükle* modunda bunu yaparken Ctrl tuşunu (Mac'te ⌘) basılı tutun. *Konum* ve *Tuşlar* modunda buna gerek yoktur.
2. Seçmek istediğiniz satırların üzerinde sürükleyin. Seçim bir çerçeve alır.
3. Bırakın. Sürüklerken Esc tuşuna basarsanız kutuyu iptal edersiniz. Seçim olduğu gibi kalır.

Seçme hakkında daha fazlası [Görevleri seçmek, silmek ve geri almak](docs://howto-taken-selecteren-verwijderen) sayfasında. Görev tablosunun kendisindeki boş alanda sürüklemek bir şey yapmaz.

### Yakınlaştırma ve uzaklaştırma

1. *Yakınlaştır +* ve *Uzaklaştır -* öğelerini kullanın (*Başlangıç › Yakınlaştırma*). Ya da + ve - tuşlarına basın. Tekerlek de yakınlaştırır. Bunun ne zaman geçerli olduğu kaydırma modunuza bağlıdır (bkz. [Uygulama ayarları](docs://ref-instellingen)).
2. Tüm projeyi görmek istiyorsanız *Görünüm › Zaman ölçeği › Projeye sığdır* seçin veya Ctrl+0 tuşuna basın. *Sıfırla* (*Görünüm* sekmesinde) ya da 0 tuşu, yakınlaştırmayı varsayılan değere geri ayarlar.
3. Durum çubuğunun sağ altında, gün başına piksel cinsinden yakınlaştırma yer alır. Örneğin *Yakınlaştırma: 15px/gün*.

Ne kadar uzaklaştırırsanız, o kadar az ızgara çizgisi olur. Gün başına 8 piksel veya daha fazlasında her gün için bir çizgi vardır; hafta sınırında ise daha kalın bir çizgi. Gün başına 2 ile 8 piksel arasında yalnızca hafta sınırı kalır. Gün başına 2 pikselin altında, yıl düzeyinde yalnızca ay sınırları kalır. Aksi halde tuval, çubukların kaybolduğu düzenli bir çizgi desenine dönüşür. Gri hafta sonları ve tatil günleri ile dönüşümlü renklendirilmiş hafta şeritleri her düzeyde kalır. Çizgiler kaybolduğunda hafta yapısını onlar taşır. Zaman çizelgesi başlığında hafta numaraları ve gün numaraları yalnızca yer olduğunda görünür. Gün başına 40 pikselden itibaren ise haftanın günü, gün numarasından önce de gösterilir.

Görevin adı çubuğun içine tam sığarsa orada gösterilir. Sığmazsa, örneğin uzaklaştırdığınızda, tam ad çubuğun sağında gösterilir.

### Bir görevin ayrıntılarına bakmak

Farenizi bir çubuğun üzerinde hareketsiz tutun. Küçük bir kart görünür. Kartta görevin adı, *WBS*, *Süre*, *Başlangıç*, *Bitiş*, *Durum*, *Kritik* ve *Toplam bolluk* yer alır. Sürükleme, kaydırma, bir seçim kutusu veya sağ tık menüsü sırasında kart kaybolur.

## Sorunlar ve uygulamanın o durumda yaptıkları

**Başlangıç taşınmaz.** Görevin bir öncülü varsa ve SNET dışında bir kısıtlaması varsa, örneğin *Mümkün olduğunca geç (ALAP)*, uygulama sürüklenen başlangıcı uygulamaz. Bıraktıktan sonra uygulama, başlangıcı hangi kısıtlamanın geri tuttuğunu bildirir. Başlangıcı taşımak için o kısıtlamayı değiştirin. Sağ kenar çalışır, çünkü yalnızca süreyi değiştirir.

**Hareket başka bir şey yapar.** İlişki modunda ve görevi böl modunda çubuk hareketleri farklı bir şey yapar. Esc bu modları kapatır. Bir çubuktan sürüklerken Shift tuşunu basılı tutarsanız, çubuğu taşımak yerine bir ilişki oluşturursunuz. Bkz. [İlişki ekleme](docs://howto-relaties-leggen).

**Konum veya Tuşlar modunda sol fare tuşu kaydırmaz.** Bu durumda el yerine normal bir imleç görürsünüz. Tekerleği veya orta fare tuşunu kullanın. Ya da modu *Yakınlaştır + sürükle* olarak ayarlayın.

**Bölünmüş bir çubuğun boşluğuna tıklamak** görevi seçer. Sürükleme veya kutu başlatmaz.

## Ayrıca bakın

- [Sağ tık menüleri](docs://ref-contextmenus): çubuk, satır ve grup başlığındaki menüler.
- [Klavye kısayolları](docs://ref-sneltoetsen): yakınlaştırma ve bir hareketi iptal etme tuşları.
- [Uygulama ayarları](docs://ref-instellingen): kaydırma modu ve zaman ekseni.
- [Kısıtlamalar ve son tarihler](docs://uitleg-constraints): neden taşınan bir başlangıç bir kısıtlama olur.
