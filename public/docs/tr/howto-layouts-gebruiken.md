# Bir düzen oluşturma ve kullanma

Hedef: planlamanızın görünümleri arasında tek tıkla geçiş yapmak. Örneğin yalnızca kritik görevleri, ekip başına görevleri veya başka bir sıralama sırasını göstermek.

## Ne zaman gerekir

Saha toplantısında müşteri yalnızca kritik görevleri görmek ister. Sonra şantiye şefi, ekip başına kimin ne zaman gerektiğine bakmak ister. Daha sonra tüm planlamayı yeniden görmek istersiniz. Filtreleri, gruplamaları ve sıralamaları tekrar tekrar ayarlamak zahmetlidir. Bir **düzen** bu tür bir görünümü, şeritte bir düğme olarak saklar.

Bir düzen altı şeyi saklayabilir: filtre, gruplama, sıralama, Gantt'ın yanındaki görev tablosunun sütunları, zaman ölçeği ve ilişki çizgileri ile kaplamalar (temel plan, ilerleme çizgisi, durum tarihi çizgisi, kaynak vurgusu, bolluk alanı ve çubuk renkleri). Düğmeye tıkladığınızda yalnızca işaretlediğiniz şeyler değişir. Görünümünüzün geri kalanı olduğu gibi kalır.

Filtreleme, gruplama ve sıralamayı bir düzenle yaparsınız. Ayrı *Filtre…*, *Grupla…* ve *Sırala…* düğmeleri artık yalnızca gizli bir ayarın arkasında bulunur (bkz. Tuzaklar ve uygulamanın yaptıkları).

## Adımlar

### Mevcut bir düzeni kullanma

1. *Görünüm* sekmesini seçin. *Düzen* grubunda her düzen için bir düğme vardır. Varsayılan olarak bu, *Kaynak diyagramı* düzenidir.
2. Düğmeye tıklayın. *Kaynak diyagramı* görevleri kaynağa göre gruplar, her grup içinde başlangıca göre sıralar ve ilişki çizgilerini kapatır. İki kaynağı olan bir görev her iki kaynağın altında görünür.
3. Düzeni kapatmak için yeniden tıklayın. Görünüm, tıklamanızdan önceki haline döner.

Her tıklama, açma ve kapatma için *Geri al* (Ctrl+Z) ile geri alınabilen bir adımdır.

### Kendi düzeninizi oluşturma

1. *Düzen* grubunda *Yeni düzen* düğmesine tıklayın. *Yeni düzen* penceresi açılır.
2. Bir *Ad* yazın ve bir *Simge* seçin.
3. *Bu düzen neyi kaydeder?* altında, her biri bir onay kutusu olan altı bölüm bulunur. Yeni pencere, başta tüm bölümleri işaretli açılır ve bunları şu an ekranınızda olanla doldurur. Düzenin değiştirmemesi gereken her şeyin işaretini kaldırın. Yalnızca bir filtre istiyorsanız yalnızca *Filtre* açık kalsın. *Geçerli görünümü al* tüm bölümleri yeniden ekranınızdakiyle doldurur.
4. Bölümleri ayarlayın.
5. *Kaydet* düğmesine tıklayın.

Düzen artık şeritte bir düğmedir, ama henüz uygulanmadı. Açmak için düğmeye tıklayın.

### Filtreyi ayarlama

Bir filtreyi *Filtre* altında kurallarla oluşturursunuz. *+ kural* düğmesine tıklayın, bir *Alan*, bir *Operatör* ve bir değer seçin. Yalnızca kritik görevleri istiyorsanız: alan *Kritik*, operatör *eşittir*, değer *Evet*. Alanlar arasında *Görev adı*, *Başlangıç*, *Bitiş*, *Toplam bolluk*, *İlerleme* ve *Kilometre taşı* vardır, ayrıca kendi etkinlik kodlarınız ve alanlarınız ile *Kaynaklar*. Operatörler alanın türüne bağlıdır: metin için *içerir* seçebilirsiniz, sayı ve tarih için *arasında*.

Kullanabileceğiniz operatörler alanın türüne bağlıdır:

- Metin (*Görev adı*, *WBS*): *eşittir*, *eşit değildir*, *içerir*, *ile başlar* ve *boş*.
- Sayı ve tarih (*Toplam bolluk*, *Başlangıç*, *İlerleme*): *eşittir*, *eşit değildir*, *küçüktür*, *küçük veya eşittir*, *büyüktür*, *büyük veya eşittir*, *arasında* ve *boş*. *arasında* seçtiğinizde iki alan görünür. Sayıda bunlar *Başlangıç* ve *Bitiş* ipuçlarıdır; tarihte ipucu yoktur. İlk tarih başlangıç, ikinci tarih bitiştir.
- Evet/hayır (*Kritik*, *Kilometre taşı*, *Kritiğe yakın*): *eşittir* ve *eşit değildir*, değer *Evet* veya *Hayır*.
- Seçim (*İş kategorisi*, bir etkinlik kodu): *eşittir*, *eşit değildir*, *şunlardan biri* (onay kutusu değerleriyle) ve *boş*.
- *Kaynaklar*: *şunlardan biri* ve *boş*.
- *Devam ediyor*: yalnızca *arasında*, iki tarihle (başlangıçtan bitişe).

Alan *Devam ediyor*, operatör *arasında* ve iki tarihle, o dönemde herhangi bir anda çalışan tüm görevleri alırsınız. Örneğin Haziran'da etkin olan her şeyi.

Birden çok kuralı en üstteki listeyle birleştirirsiniz. *Aşağıdakilerin tümü (AND)* tüm kuralları karşılayan görevleri gösterir. *Aşağıdakilerden herhangi biri (OR)* en az bir kuralı karşılayan görevleri gösterir. *+ grup* ile kendi kurallarına sahip bir alt grup eklersiniz.

Filtre doğrudan görevlere bakar. Bir görevin altında yer aldığı özet görevler (fazlar) gri olarak görünür kalır. Böylece görevin nereye ait olduğunu görürsünüz. Gruplama da yaparsanız, bu gri fazlar kaybolur.

### Gruplama ve sıralama

*Grupla* bölümünde *+ düzey* ile bir alan eklersiniz. En fazla iki gruplama düzeyi vardır. Gruplama yoksa WBS ağacını görürsünüz. *Sırala* bölümünde *+ düzey* ile bir alan eklersiniz ve *Artan* veya *Azalan* seçersiniz. İki düzey varsa, ikinci düzey birinci düzeydeki değerler eşit olduğunda karar verir.

### Düğme olmadan hızlıca denemek

Pencerede *Kaydetmeden uygula* düğmesine tıklayın. İşaretli bölümler ekrana gelir, ama hiçbir düğme eklenmez. Bu, yalnızca bir kez gereken bir filtre için kullanışlıdır. Ctrl+Z bunu geri alır.

### Düzeni değiştirme, kopyalama veya kaldırma

Düzen düğmesine sağ tıklayın. *Düzenle…*, *Çoğalt* veya *Sil* seçersiniz. *Sil* önce onay ister. Kopyanın adı *ad (kopya)* olur. Yerleşik düzenleri, örneğin *Kaynak diyagramı* düzenini, düzenleyemez veya silemezsiniz. Bunun yerine çoğaltıp kendi sürümünüzü oluşturursunuz.

### Aynı anda birden fazla düzen

Aynı bölümleri saklamayan düzenler birlikte açık olabilir. Yalnızca şu filtreyi saklayan bir düzeniniz varsa: *Kritik*, *eşittir*, *Evet* (adını örneğin *Yalnızca kritik* koyun). Bunu *Kaynak diyagramı* ile (gruplama, sıralama, ilişki çizgileri) birlikte açarsanız, kritik görevleri kaynak başına görürsünüz. Aynı bölümü, örneğin ikisi de bir filtreyi, saklarsa ikinci düzen devralır ve birinci kapanır. İkinci düzeni yeniden kapatırsanız, ilk tıklamanızdan önceki görünüme dönersiniz, ilk düzene değil.

## Tuzaklar ve uygulamanın yaptıkları

**Bölümlerin işaretini kaldırmayı unutursunuz.** Sütunları, zaman ölçeğini ve kaplamaları da saklayan bir düzen, her tıklamada bunları kayıtlı duruma geri getirir. Yakınlaştırmanız o zaman sıçrar, oysa yalnızca bir filtre istemiştiniz. Pencerede yalnızca amaçladığınız bölümlerin işaretli olduğunu kontrol edin.

**Eksik bir kural hiçbir şey göstermez.** Evet/hayır alanı için bir değer seçmezseniz (alan hâlâ *—* yazar) veya *Devam ediyor* tarihlerini boş bırakırsanız, hiçbir görev eşleşmez ve liste boş kalır. Kuralı tamamlayın.

**Bir değişikliği elle yaparsanız düzen kapanır.** Düzenin sakladığı bir bölümü kendiniz değiştirirseniz, örneğin *Kaynak diyagramı* açıkken *İlişki çizgileri*, o düzen çıkar ve diğer bölümler düzenden önceki görünüme döner. Yakınlaştırma, zaman ölçeğini saklayan bir düzeni kapatır. Bir sütunu genişletmek de sütunları saklayan bir düzeni kapatır. Görünümün geri kalanı olduğu gibi kalır. Kaynak diyagramı zaman ölçeğini saklamaz, bu yüzden yakınlaştırma onu etkilemez.

**Sütunlar, Gantt'ın yanındaki görev tablosu için geçerlidir.** *Sütunlar* bölümü, zaman çizgisinin solundaki tablonun sütunlarını saklar. *Tablo* sekmesindeki tablo kendi sütunlarını tutar. Sütunları nasıl seçeceğiniz, [Tablo sütunlarını ayarlama](docs://howto-tabelkolommen-aanpassen) sayfasında anlatılır.

**Girinti ve girintiyi azalt kapalıdır.** Bir filtre, gruplama veya sıralama açık olduğu sürece, gösterilen sıra planlamanın sırası değildir. *Girinti* ve *Girintiyi azalt* o zaman devre dışıdır; ipucu olarak *Filtreleme/gruplama/sıralama sırasında kullanılamaz* yazar. Yapıyı yeniden ayarlamak için düzeni kapatın. Bu konu [Yapıyı ayarlama](docs://howto-structuur-aanpassen) sayfasında anlatılır.

**Durum çubuğu takip etmez.** Durum çubuğundaki *Görevler:* tüm projenin görev sayısını gösterir. Bir filtre bunların yalnızca bir kısmını gösterse bile.

**Düzenler cihazınızdadır, projede değil.** Uygulama düzenlerinizi ve sütunlarınızı, bu cihazdaki tüm projeleriniz için saklar. Bir düzenin kaplamaları (temel plan, ilerleme çizgisi ve diğerleri) tüm projelerinizde geçerlidir. Filtre, gruplama ve sıralama, o an açık olan projeye aittir, ama proje dosyasına girmez. Kaydedip yeniden açtığınızda görünüm yine temiz olur. Bunlar projeyi ayrıca değiştirilmiş olarak da işaretlemez.

**Ayrı düğmeler gizlidir.** *Görünüm* sekmesindeki ayrı *Sütunlar…*, *Filtre…*, *Grupla…* ve *Sırala…* düğmeleri eski bir görünümdür. Bunları *Uygulama ayarları* penceresinde (başlık çubuğundaki ⚙), *Gelişmiş* sekmesinde, *Eski özellikler* altındaki *Klasik görünüm düğmelerini göster* ile geri getirirsiniz. Düzenleri tercih edin.

## Ayrıca bkz.

- [Tablo sütunlarını ayarlama](docs://howto-tabelkolommen-aanpassen): sütunların kendisini seçme, taşıma ve sabitleme.
- [Rapor oluşturma ve yazdırma](docs://howto-rapport-maken-en-afdrukken): görünümü *Görünümü izle* ile kağıda aktarma.
- [Yapıyı ayarlama](docs://howto-structuur-aanpassen): filtreleme sırasında neden girinti yapamadığınız.
