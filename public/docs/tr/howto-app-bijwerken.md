# Uygulamayı güncelleme

Hedef: en son sürüme sahip olup olmadığınızı öğrenin, uygulamayı güncelleyin ve bir sürümde neyin yeni olduğunu okuyun.

## Ne zaman gerekir

Open Planner Studio için düzenli olarak yeni bir sürüm çıkar. Bu sürüme zaten sahip olup olmadığınızı öğrenmek istersiniz. Örneğin bir hata bildirmeden önce veya bir uzantı daha yeni bir sürüm istediğinde. Ya da az önce güncellediniz ve neyin değiştiğini görmek istiyorsunuz.

Güncelleme yalnızca masaüstü uygulamasında çalışır. Tarayıcı sürümünde güncelleyici yoktur.

## Adımlar

### Uygulama yeni bir sürüm olduğunu bildirdiğinde güncelleyin

1. Masaüstü uygulamasını başlatın. Başlangıçta uygulama arka planda yeni bir sürüm olup olmadığını denetler. Yeni sürüm yoksa veya denetim başarısız olursa, örneğin internet yoksa, bir şey fark etmezsiniz.
2. Yeni bir sürüm varsa *Yazılım güncellemesi* penceresi açılır. Pencerede *Mevcut sürüm* ve *Yeni sürüm* görünür. Ayrıca *Yeni bir sürüm mevcut* mesajı ve *Yenilikler* altında güncellemeyle ilgili metin yer alır.
3. Açık projelerinizi kaydedin.
4. *İndir ve kur* düğmesini tıklayın. Bir ilerleme çubuğunda *İndiriliyor…* yazısı görünür. Ardından kurulum başlar. İndirme sırasında pencereyi kapatamazsınız.
5. Uygulama kendini yeniden başlatana kadar bekleyin. Bu, yeni sürümdür.

Güncelleme kurulmadan hemen önce uygulama, açık çalışmanızın bir kurtarma anlık görüntüsünü de alır (çökme kurtarma için). Bkz. [Bir çökmeden sonra kurtarma](docs://howto-herstellen-na-een-crash).

### Yeni sürümü kendiniz denetleyin

1. *Ayarlar › Proje › Uygulama ayarları* öğesini seçin. Ayrıca *Dosya › Uygulama ayarları* öğesini seçebilirsiniz veya üstteki dişli simgesini seçebilirsiniz.
2. *Gelişmiş* sekmesini seçin. *Sürüm* altında mevcut sürümünüzün numarası bulunur.
3. *Güncellemeleri denetle* düğmesini tıklayın. *Yazılım güncellemesi* penceresi açılır ve *Denetleniyor…* yazar. Daha sonra *En son sürümü kullanıyorsunuz* yazar. Ya da yeni bir sürümün olduğunu bildiren bir mesaj çıkar. Aynı *İndir ve kur* düğmesi de görünür.

Tarayıcıda bu düğmenin özel bir işlevi yoktur. Pencere hemen *En son sürümü kullanıyorsunuz* yazar. Uygulama hiçbir denetim yapmaz.

### Yeniliklerin ne olduğunu okuyun

1. Masaüstü uygulamasını önceki sürümden farklı bir sürümde ilk kez başlatırsanız pencere kendiliğinden açılır. Pencerenin adı *Güncelsiniz!* olur. Yeni kurulumdan sonra pencere açılmaz, çünkü ilk başlatma bir güncelleme değildir. Yine de görmek isterseniz *Yenilikler* düğmesini kullanın (aşağıya bakın).
2. Üstte önceki sürümden yeni sürüme geçiş yer alır. *Yenilikler* düğmesiyle yalnızca yeni sürüm gösterilir.
3. Bu sürüm için yerleşik bir özet varsa, bir ana madde ve dört küçük madde görürsünüz. Ana maddede *Kılavuzu oku* düğmesi bulunabilir. Yoksa yalnızca sürüm geçişini ve altındakileri görürsünüz.
4. *Tüm sürüm notlarını gör* ile değişiklik günlüğünü GitHub'da açarsınız. Bu çalışmazsa *Sürüm notları açılamadı* yazar.
5. *Bu güncelleme sayılarla* altında şunlar yer alır: önceki sürümden bu yana geçen gün sayısı, commit sayısı ve eklenen kod satırı sayısı. Uygulama kurulum paketinin boyut farkını bulabiliyorsa, bu da gösterilir. Her rakam yalnızca varsa gösterilir.
6. Pencereyi kapatmak için *Anladım* düğmesini tıklayın.

Bu pencereyi daha sonra tekrar görmek istiyorsanız *Ayarlar › Proje › Uygulama ayarları* öğesini seçin, *Gelişmiş* sekmesini açın ve *Sürüm* altındaki *Yenilikler* düğmesini tıklayın. Pencere mevcut sürümünüz için açılır. Önceki sürüm gösterilmez.

## Sorunlar ve uygulamanın o durumda yaptıkları

**Güncelleme başarısız olur.** Pencerede *Güncelleme sırasında bir sorun oluştu* yazar. Altında teknik neden ve *Tekrar dene* düğmesi bulunur.

**Uygulamayı .deb paketi olarak kurdunuz ve kurulum başarısız olur.** Pencere şunu açıklar: *Bir terminalde bu komutu çalıştırarak elle güncelleyin veya en son paketi indirin*. *Kurulum komutu* altında komut bulunur. Yanında *Komutu kopyala* düğmesi vardır. Düğmeye tıklayınca *Kopyalandı* yazar. *İndirme sayfasını aç* ile en son sürümün indirme sayfasına gidersiniz.

**Uygulamayı Snap Store üzerinden kullanıyorsunuz.** Uygulama o zaman kendini güncellemez ve başlangıçta da denetlemez. Bunu Snap Store yapar. Pencerede şu yazar: *Bu sürüm Snap Store üzerinden otomatik olarak güncellenir — hiçbir şey yapmanıza gerek yok*.

**Başlangıçta hiçbir şey görünmez.** Bu normaldir, en son sürüme zaten sahipseniz. Başlangıçtaki denetim hataları bildirmez. Emin olmak istiyorsanız yukarıda anlatıldığı gibi kendiniz denetleyin.

## Ayrıca bakın

- [Geri bildirim verme](docs://howto-feedback-geven): en son sürümdeki bir hatayı bildirin.
