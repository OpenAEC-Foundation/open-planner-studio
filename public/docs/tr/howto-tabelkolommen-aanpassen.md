# Tablo sütunlarını ayarlama

Amaç: görev tablosunda hangi sütunları göreceğinizi seçmek, bu sütunların sırasını ve genişliğini belirlemek.

## Bunu ne zaman kullanırsınız

Toplantıda her görevin yanında son tarihi ve toplam bolluğu görmek istersiniz. Şantiye yöneticisi yalnızca adın yanında başlangıcı ve bitişi görmek ister. Ya da bir sütun o kadar dar olur ki başlığı kesilir. Görev tablosu, kendiniz seçtiğiniz sütunlardan oluşur: onlarca sütun vardır. Örneğin *Görev adı* ve *Süre* sütunlarından *Son tarih*, *Serbest bolluk* ve *Atanan kaynaklar* sütunlarına kadar.

İki görev tablosu vardır. Her birinin kendi sütunları vardır:

- **Gantt’ın yanındaki görev tablosu** zaman çizelgesinin solundadır. Bu tablo diğerlerinin yanında *Ana sayfa*, *Planlama* ve *Görünüm* sekmelerinde görünür. Varsayılan olarak *WBS*, *Görev adı* ve *Süre* sütunları vardır; böylece zaman çizelgesi için yer kalır.
- **Tablo sekmesindeki tablo** çalışma alanının tamamını kaplar. Varsayılan olarak *WBS*, *Görev adı*, *Süre*, *Başlangıç*, *Bitiş*, *İş kategorisi*, *Kritik*, *Toplam bolluk* ve *İlerleme* sütunları vardır. Buna ek olarak projenin her etkinlik kodu ve özel alan için bir sütun eklenir.

Bir tablodaki değişiklik diğer tabloyu değiştirmez.

## Adımlar

### Sütun ekleme

1. Tablo başlığının sağındaki artıya (**+**) tıklayın. *Tablo* sekmesinde *Tablo › Sütunlar › Sütunlar…* yolunu da kullanabilirsiniz. *Sütun seç* penceresi açılır.
2. Sütunu bulun. Daha önce sütun seçtiyseniz en üstte *Son kullanılanlar* yer alır. *Ara* alanına adın bir parçasını yazın. Örneğin *Son tarih* için *tarih* yazın. Ya da bir kategori açın: *Görev*, *Planlama*, *Kısıtlamalar*, *İlişkiler*, *Kaynaklar*, *İlerleme*, *Hesaplanan*, *Temel plan*, *Özel* veya *Teknik*.
3. Sütuna tıklayın. Sütun tablonun sonuna eklenir ve pencere kapanır.

Tabloda zaten bulunan bir sütun gri görünür ve seçilemez.

### Sütun kaldırma

Sütun başlığındaki eksi işaretine (*Kaldır: Son tarih*) tıklayın. Ya da başlığa sağ tıklayıp *Kaldır: Son tarih* öğesini seçin. Ctrl+Z ile sütunu geri alırsınız. Ya da artıyla sütunu yeniden seçersiniz.

### Genişliği ayarlama

Sütun başlığının sağındaki kenarı sola veya sağa sürükleyin. Bu kenara çift tıklayın ya da başlığın menüsünde (sağ fare düğmesi) *Otomatik sığdır* öğesini seçin. Sütun, içeriği için yeterince geniş olur; en fazla 480 piksel olur. Kenar odaktaysa ok tuşlarıyla genişliği adım adım genişletirsiniz veya daraltırsınız.

### Sütunları sabitleme

Başlığa sağ tıklayın ve *Sabitle* öğesini seçin. Sabitlenmiş sütunlar öne geçer ve yatay kaydırdığınızda solda kalır. Bu işe yarar; sabitlenmiş sütunlar birlikte pencereden geniş olmadığı sürece. *Sabitlemeyi kaldır* öğesi sütunları yeniden sıraya koyar.

### Sırayı değiştirme

Bir sütun başlığını başka bir yere sürükleyin. Sabitlenmiş bir sütunu sabitlenmiş sütunlar arasında taşırsınız. Normal bir sütunu normal sütunlar arasında taşırsınız.

### Varsayılana dönme

*Sütun seç* penceresini açın ve alttaki *Varsayılana sıfırla* düğmesine tıklayın. Sütunlar zaten varsayılan durumdaysa düğme gri görünür. *Tablo* sekmesindeki tabloda, projenin her etkinlik kodu ve özel alanı için de bir sütun eklenir. Bunu daha önce kaldırmış olsanız bile eklenir. Bu sütunlar, kodun veya alanın bulunduğu projeye aittir. Bu kodlar ve alanlar hakkında [Kodlar ve özel alanlar](docs://howto-codes-en-velden) bölümünde okuyabilirsiniz.

## Tuzaklar ve uygulamanın yaptıkları

**Başlık kesilir.** Dar bir sütun adını keser. Örneğin *Toplam bolluk* yerine *Topl…* görünür. Sütunu sığdırmak için başlığın kenarına çift tıklayın.

**Yanlış tabloyu ayarlarsınız.** Gantt’ın yanındaki görev tablosunun sütunları ile *Tablo* sekmesindekiler ayrıdır. *Görünüm* veya *Ana sayfa* sekmesindeyseniz Gantt’ın yanındaki tabloyu ayarlarsınız. *Tablo* sekmesindeki artı işareti büyük tabloyu ayarlar.

**Bir düzen sütunları geri getirir.** Bir düzende *Sütunlar* bölümü işaretliyse, düzen düğmesine tıklamak Gantt’ın yanındaki görev tablosunun sütunlarını kayıtlı duruma geri getirir. *Tablo* sekmesindeki tablo değişmez. Bkz. [Düzen oluşturma ve kullanma](docs://howto-layouts-gebruiken).

**Sütunlar cihazınızda saklanır, projede değil.** Uygulama sütun seçiminizi bu cihazdaki tüm projeleriniz için saklar. Proje dosyasında saklamaz. Ayrıca projeyi “değiştirilmiş” olarak işaretlemez. Her sütun değişikliğini *Geri al* (Ctrl+Z) ile geri alabilirsiniz. Adımların adı örneğin *Son tarih sütununu ekle* ve *Görev adı sütununu yeniden boyutlandır* olur.

## Ayrıca bakın

- [Düzen oluşturma ve kullanma](docs://howto-layouts-gebruiken): sütunları bir filtre veya sıralama ile birlikte bir düğmeye koymak.
- [Kodlar ve özel alanlar](docs://howto-codes-en-velden): burada seçebileceğiniz kendi sütunlarınızı oluşturmak.
- [Tablo sütunları](docs://ref-tabelkolommen): tüm sütunlar ve bunların gösterdiği bilgi.
