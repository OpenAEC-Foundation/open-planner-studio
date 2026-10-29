# Büyük ekranda sunmak

Hedef: Gantt'ı tam ekranda, şerit ve paneller olmadan göstermek. Örneğin şantiye toplantısında bir projektörde veya televizyonda.

## Ne zaman gerekir

Şantiye kulübesinde on kişi tek bir ekrana bakıyor. Bu durumda şerit, durum çubuğu ve özellikler paneli planlamanın ihtiyaç duyduğu alanı kaplar ve dikkati dağıtır. **Sunum modunda** uygulama tüm ekranda yalnızca görev tablosunu ve Gantt'ı tutar.

## Adımlar

### Görünümü hazırlayın

Sunum modunda şerit kaybolur. Bu yüzden göstermek istediğinizi önceden ayarlayın.

1. Tarihlerin doğru görünmesi için **Hesapla** (F5) tuşuna basın.
2. Göstermek istediğiniz görünümü ayarlayın; örneğin yalnızca kritik görevleri gösteren bir düzen (bkz. [Düzen oluşturma ve kullanma](docs://howto-layouts-gebruiken)).
3. Görev adlarının uzaktan okunabildiği bir zaman ölçeği ve yakınlaştırma düzeyi seçin; fazları *Görünüm* sekmesinin *Anahat* grubundaki *Daralt* ve *Genişlet* ile daraltın veya genişletin.
4. Kullanmak istiyorsanız *Bölünmüş görünüm* ve *Mini harita* seçeneklerini açın (bkz. [Bölünmüş görünümü ve mini haritayı kullanma](docs://howto-split-view-en-mini-map)).

### Sunumu başlatın

*Görünüm › Sunum › Sunum* öğesini seçin. Masaüstü uygulamasında F11 tuşuna da basabilirsiniz. Tarayıcıda F11 tarayıcıya aittir: tarayıcı penceresini tam ekrana alır ve uygulama olduğu gibi kalır. Şerit, sekmeler, durum çubuğu ve sağdaki panel kaybolur. Görev tablosunu ve Gantt'ı görürsünüz. Açtıysanız histogramı ve mini haritayı da görürsünüz. Altta birkaç saniye boyunca şu metin görünür: *Tam ekrandan çıkmak için Esc veya F11'e basın*.

Masaüstü uygulamasında sunumu her sekmeden F11 ile başlatabilirsiniz, *Tablo* veya *Rapor* sekmesinden de. Tarayıcıda sunumu yalnızca *Görünüm › Sunum › Sunum* ile başlatabilirsiniz. Her zaman açık projenin Gantt'ını görürsünüz. Durdurduğunuzda başladığınız sekmeye geri dönersiniz. Tarayıcıda bu *Görünüm* sekmesidir.

### Sunumu durdurun

Esc veya F11 tuşuna basın. Şerit ve paneller, başladığınız sekmede yeniden görünür.

## Dikkat edilmesi gerekenler ve uygulamanın yaptıkları

**Sunum modunda hâlâ düzenleyebilirsiniz.** Tıklama, sürükleme, hücre düzenleme ve Delete hâlâ çalışır. Bir çubuğu yanlışlıkla sürüklerseniz çubuk taşınır ve planlama güncel olmaz. Yanlışlıkla sildiğiniz bir görevi sunum modunda da Ctrl+Z ile geri getirebilirsiniz. Bu yüzden bir grupla çalışırken dikkatli tıklayın.

**Bildirimler görünür kalır.** Uygulamanın bir mesajı, örneğin bir kaydetme hatası, sunum modunda da görünür. Sunum modunda şerit ve durum çubuğu yoktur. Bu nedenle böyle bir mesaj, bir şeyin yanlış olduğunu gösteren tek işarettir.

**Bölünmüş görünümü, mini haritayı ve düzenleri önceden ayarlayın.** Bunlar için şerit gerekir, ama bu modda şerit yoktur. Yakınlaştırma çalışır: fare tekerleğiyle veya Ctrl+= ve Ctrl+- ile. + ve - de çalışır, ama yalnızca odak Gantt'taysa. Sunumu başlattıktan sonra odak çoğu zaman görev tablosunda olur. Bu yüzden önce Gantt'a tıklayın.

**Tam ekran çalışmaz.** Uygulama şeridi gizlemenin yanı sıra gerçekten tam ekran da ister. Tarayıcınız veya pencereniz bunu reddederse yalnızca şerit ve paneller kaybolur. Sunum yine çalışır. Tam ekrandan Esc veya F11 dışında bir yolla çıkarsanız, örneğin işletim sisteminizin bir tuşuyla, sunum modu da durur.

**Sunum modu hatırlanmaz.** Uygulamayı kapatıp yeniden açtıktan sonra sunum modu kapalıdır.

## Ayrıca bakın

- [Bölünmüş görünümü ve mini haritayı kullanma](docs://howto-split-view-en-mini-map): sunum sırasında iki zaman penceresi veya bir genel bakış bandı.
- [Düzen oluşturma ve kullanma](docs://howto-layouts-gebruiken): göstermek istediğiniz görünümü tek tıkla ayarlama.
- [Klavye kısayolları](docs://ref-sneltoetsen): F11 ve diğer tuşlar.
