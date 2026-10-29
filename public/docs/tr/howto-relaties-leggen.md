# İlişkiler eklemek

Amaç: görevler arasında ilişki oluşturmak, böylece bir görev ancak önündeki iş bittiğinde başlar. Gerektiğinde aralarına bir bekleme süresi (gecikme) ekleyin.

## Ne zaman ihtiyacınız olur

İlişkiler olmadan uygulama, duvarcının ancak temel dökülünce başlayabileceğini bilmez. Her görev o zaman proje başlangıcında başlar ve bitiş tarihinin bir anlamı kalmaz. Bir **ilişki** bu sıralamayı kaydeder. İlk görev **öncül**, ikinci görev ise **ardıl**dır.

İlişkileri bir planlama oluştururken, bir görev eklendiğinde veya iki görevin sonradan birbirine bağlı çıktığı anlaşıldığında eklersiniz. Bir **gecikme**, iki görev arasındaki bekleme süresidir. Örneğin beton kürlenmeli veya zemin şapı kurumalıdır.

Varsayılan ilişki **FS**'dir (Bitiş-Başlangıç): ardıl görev ancak öncül görev bittikten sonra başlayabilir. Uygulama ayrıca SS, FF ve SF'yi de tanır. Bunlar bir başlangıcı veya bitişi başka bir başlangıca ya da bitişe bağlar. Örneğin SS (Başlangıç-Başlangıç) ile sıva, ancak tesisat başladıktan sonra başlayabilir.

Hangi türe ihtiyacınız olduğundan emin değil misiniz? Tür seçiminin altında, gerçek görev adlarıyla yazılmış bir cümle bunu açıklar. Örneğin *Metselwerk görevi, ancak Fundering görevi bittikten sonra başlar.* Başka bir tür seçin; cümle de buna göre değişir. Bunu *İlişki türü* penceresinde, *İlişkiler* bloğunda ve *Öncüller* veya *Ardıllar* sütununda görürsünüz.

## Adımlar

Bir ilişki eklemenin dört yolu vardır. Hepsi aynı ilişkiyi oluşturur; durumunuza en uygun yolu seçin.

### Seçili iki görevi bağlamak

Bu yol, görev tablosunda çalışırken kullanışlıdır.

1. Görev tablosunda, önce gelen görevi tıklayın: öncül görevi.
2. Ctrl tuşunu basılı tutun (Mac'te ⌘) ve sonra gelen görevi tıklayın: ardıl görevi.
3. *Ana sayfa › Görevler › Bağlantı ▾ › Seçili görevleri bağla* öğesini seçin. Aynı düğme *Planlama › İlişkiler* üzerinde de bulunur.

Uygulama gecikmesiz bir bitiş-başlangıç ilişkisi oluşturur. Bunu Gantt'ta bir ok olarak ve *Öncüller* sütununda görürsünüz; bildirim yalnızca uygulama ilişkiyi reddederse görünür. Bu düğme yalnızca tam olarak iki seçili görevle çalışır.

### Gantt'ta ilişki çizmek

Bu yol, arka arkaya birçok ilişki eklediğinizde kullanışlıdır.

1. *Ana sayfa › Görevler › Bağlantı ▾ › İlişki çiz* öğesini seçin. Gantt'ın üstünde şu bildirim görünür: *Bağlantı modu: Gantt'ta bir çubuktan diğerine sürükleyerek ilişki oluşturun. Durdurmak için Esc.*
2. Öncül görevin çubuğuna basılı tutun ve ardıl görevin çubuğuna sürükleyin. Kesikli, uçlu bir çizgi sizi takip eder.
3. Bırakın. Küçük bir *İlişki türü* penceresi açılır. Pencerede tür (varsayılan olarak FS) ve gecikme için bir kutu görünür.
4. Gerekirse türü veya gecikmeyi değiştirin ve Enter tuşuna basın ya da pencerenin dışına tıklayın. İlişki oluşturulur.
5. Hemen bir sonrakini ekleyin: mod açık kalır. Durdurmak için Esc tuşuna basın, bildirimdeki *Durdur* düğmesini kullanın veya yeniden *İlişki çiz* öğesini seçin.

*İlişki türü* penceresinde Esc tuşuna basarsanız hiçbir şey kaydedilmez. Tek bir ilişki için modu açmanız gerekmez: çubuktan çubuğa sürüklerken Shift tuşunu basılı tutun. Bir çubuğun sağ tık menüsündeki *İlişkiyi buradan başlat* bağlantı modunu açar; sürüklemeyi yine kendiniz yaparsınız. *Tablo* sekmesinde, Gantt olmadan, *İlişki çiz* devre dışıdır.

### Özellikler panelinde ilişki eklemek

Bu yol, tek bir göreve bakarken öncüllerini veya ardıllarını eklemek istediğinizde kullanışlıdır.

1. Görevi seçin. *Özellikler* paneli sağda yer alır; görmüyorsanız *Görünüm › Paneller › Özellikler* öğesiyle açın.
2. *İlişkiler* bloğunda *İlişki ekle* öğesine tıklayın.
3. Diğer görev önce geliyorsa yönü *Öncül* olarak bırakın veya *Ardıl* seçin.
4. Diğer görevin adının bir kısmını yazın. Doğru görevi ok tuşlarıyla ve Enter ile seçin ya da tıklayın.
5. Türü seçin (varsayılan FS) ve gerekirse bir gecikme girin.
6. Enter tuşuna basın veya onay işaretine (*İlişkiyi oluştur*) tıklayın.

Görevin ilişkileri daha sonra *İlişkiler* bloğunda listelenir. Her birinde diğer görevin WBS numarası, tür ve gecikme gösterilir.

### Öncüller sütununa yazarak ilişki eklemek

Bu yol, klavyeyle hızlı çalışıyorsanız ve WBS numaralarını biliyorsanız kullanışlıdır.

1. Görev tablosu başlığının sağındaki **+** işaretine tıklayın (*Sütun ekle*) ve *İlişkiler* altında *Öncüller* sütununu seçin. *Ardıllar* sütunu da aynı şekilde çalışır.
2. *Öncüller* sütununda ardıl görevin hücresine tıklayın.
3. Öncül görevin WBS numarasını, bir boşluk ve türü yazın, örneğin `2.6 FS`. Hemen ardına bir gecikme yazın: `2.6 FS+1d`. Birkaç öncülü noktalı virgülle veya virgülle ayırın: `3.1 FS; 3.2 SS+2d`.
4. Enter tuşuna basın.

Yazdığınız metin hücrenin tamamının yerine geçer. Hücrede zaten öncüller varsa, onları da yazın (bkz. Tuzaklar ve uygulamanın yaptıkları). Yazmak yerine hücrede Enter veya F2 tuşuna basarsanız, mevcut ilişkileri koruyan bir giriş alanı açılır. WBS numarasına veya adına göre bir görev aratırsınız ve her ilişki için tür ile gecikmeyi seçersiniz.

### Gecikme ayarlamak veya değiştirmek

Yukarıdaki yolların her birinde, türün yanındaki kutuya bir gecikme yazarsınız. Mevcut bir gecikmeyi *İlişkiler* bloğunda değiştirirsiniz: gecikme kutusuna tıklayın, yeni değeri yazın ve Enter tuşuna basın.

- `3` veya `3d`: 3 iş günü. Hafta sonu sayılmaz. Uygulama `+3d` gösterir.
- `3ed`: 3 takvim günü. Hafta sonu da sayılır; örneğin cumartesi ve pazar da kürlenen beton gibi.
- `-1`: negatif bir gecikme (öne alma). Ardıl görev bir gün önce başlayabilir, böylece görevler örtüşür.
- `4h`: 4 çalışma saati; uygulama bunu `+4h` olarak gösterir. Öncül görev, kendi çalışma saati bantları olmayan bir takvimde gün görevi ise (örneğin standart takvim), uygulama bunu tam iş günlerine çevirir ve en yakın tam güne yuvarlar. Dolayısıyla `4h` 1 gün, `2h` 0 gün gibi işler. Kendi çalışma saati bantları olan bir takvimde veya bir saat görevinden sonra gecikme tam olarak saat sayılır.
- `50%`: öncül görevin süresinin yarısı.

Örnek: temel betonunun, duvarcı üzerinde çalışmadan önce kürlenmesi gerekir. Bu yüzden *Pour foundation → Foundation brickwork* arasına gecikme `3` ile bir FS ilişkisi eklenir. Döküm 18 Haziran 2027 Cuma günü yapılırsa, duvar işi 24 Haziran Perşembe günü **Hesapla** komutundan sonra başlar: Pazartesi ile Çarşamba arası bekleme süresidir. `3ed` ile hafta sonu da sayılır ve duvar işi 22 Haziran Salı günü başlar.

### Son olarak: yeniden hesaplamak

Yeni bir ilişki henüz hiçbir çubuğu taşımaz. Durum çubuğu şunu gösterir: *Güncel değil — yeniden hesaplayın (F5)*. **Hesapla** (F5) tuşuna basın, örneğin *Ana sayfa › Zamanlama › Hesapla* üzerinden. Ardıl görevler ancak o zaman yeni tarihlerini alır. Uygulamanın bunu sizin yerinize yapmasını istiyorsanız, *Ayarlar › Proje › Uygulama ayarları* altında, *Planlama* sekmesinde *Otomatik hesapla* seçeneğini açın.

## Tuzaklar ve uygulamanın yaptıkları

**Ters sıra.** *Seçili görevleri bağla* ile tıkladığınız sıra sayılır, listedeki sıra değil. Sonraki görevi önce tıklarsanız, ilişki ters yönde olur. Bunu *İlişkiler* bloğunda çöp kutusu simgesiyle silin ve yeniden ekleyin.

**Sütuna yazmak, mevcut olanı siler.** Hücrede `3.4 FS; 3.2 FS` varsa ve yalnızca `3.2 FS` yazarsanız, 3.4 ile olan ilişki bir mesaj olmadan kaybolur. Tüm öncülleri yazın, eklemek için Enter veya F2 kullanın ya da Ctrl+Z ile geri alın.

**Bir döngü.** Görevlerin zinciri içinde daha önce gelen bir göreve geri dönen bir ilişki eklerseniz, planlama asla başlayamaz. Uygulama böyle bir ilişkiyi reddeder: *Bu ilişki programda bir döngü oluşturur (…); ilişki oluşturulmadı*. Döngüdeki görevler parantez içinde gösterilir. Önce döngüyü kapatan ilişkiyi silin.

**Bir görevi kendi özet görevine bağlamak.** Bir görev ile altında bulunduğu özet görev arasında ilişki mümkün değildir. Uygulama şunu bildirir: *Bir görev ile kendi üst özet görevi arasında ilişki kurulmasına izin verilmez.*

**Yineleme.** İlişki zaten varsa uygulama *Bu ilişki zaten var* der ve hiçbir şey değişmez.

**Sütundaki kısa mesajlar.** *Öncüller* sütunu aynı reddetmeleri gösterir, hücrenin altında daha kısa bir metinle: *Bu değişiklik programda bir döngü oluşturur.*, *Bu ilişki zaten var.* veya *Bir görev kendi özet göreviyle ilişki kuramaz.* Yalnızca `3.1` gibi bir WBS numarası yazarsanız, tür eksik olur ve hücre *Örneğin 1.2 FS+2d kullanın.* yazar. Hücre açık kalır; girişi düzeltin veya iptal etmek için Esc tuşuna basın.

**Yarım gün gecikme yok.** Gün cinsinden bir gecikme her zaman tam sayıdır: `1.5` `+2d` olur. Kendi çalışma saati bantları olmayan bir takvimde gün görevinden sonra bir saatlik gecikme, tam iş gününe yuvarlanır. Okunamayan giriş, örneğin bir kelime, kaydedilmez: kutu önceki değere geri döner.

## Ayrıca bakın

- [Kritik yol ve bolluk](docs://uitleg-kritiek-pad): uygulamanın ilişkilerinizden neyi hesapladığı ve bir görevin neden kritik olduğu.
- [İlişkiler ve gecikme](docs://uitleg-relaties): dört ilişki türünün ve bir gecikmenin tarihleri nasıl etkilediği.
- [Bir yolu izlemek](docs://howto-pad-traceren): öncüller ve ardıllar zincirini görünür hale getirmek.
- [Görev penceresi ve özellikler paneli](docs://ref-taak-eigenschappen): panelde ve pencerede ilişkiler ve gecikme için alanlar.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): bitiş-başlangıç ilişkilerinden oluşan bir zincir, bir başlangıç-başlangıç ilişkisi (duvarlar ve çatı, gecikme 2 gün) ve bir bitiş-bitiş ilişkisi (kaplama ve boyama, gecikme 1 gün).
