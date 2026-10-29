# Tablo sütunları

Görev tablosunda 86 sabit sütun vardır. Buna ek olarak projenin her etkinlik kodu ve özel alanı için bir sütun, her temel plan için ise sekiz sütun vardır. Bu makalede her sütun için ne gösterdiği, düzenlenip düzenlenemeyeceği ve değerin hangi biçimde yazıldığı açıklanır. Sütunları nasıl seçeceğiniz ve düzenleyeceğiniz [Tablo sütunlarını özelleştirme](docs://howto-tabelkolommen-aanpassen) bölümünde anlatılır.

## Sütunları nerede seçersiniz

Gantt'ın yanındaki görev tablosunun ve *Tablo* sekmesindeki tablonun her birinin kendi sütun seçimi vardır. Başlığın sağındaki artı işareti sütun seçiciyi açar (pencere başlığı *Sütun seç*). *Tablo* sekmesinde *Tablo › Sütunlar › Sütunlar…* öğesini de kullanabilirsiniz. Seçici sütunları kategoriye göre listeler: *Görev*, *Planlama*, *Kısıtlamalar*, *İlişkiler*, *Kaynaklar*, *İlerleme*, *Hesaplanan*, *Temel plan*, *Özel* ve *Teknik*. Adına göre arama yapabilirsiniz; *Son kullanılanlar* en üstte yer alır. *Varsayılana sıfırla* varsayılan sütunları geri yükler.

Varsayılan olarak Gantt'ın yanındaki tablo *WBS*, *Görev adı* ve *Süre* gösterir. *Tablo* sekmesindeki tablo ise *WBS*, *Görev adı*, *Süre*, *Başlangıç*, *Bitiş*, *İş kategorisi*, *Kritik*, *Toplam bolluk* ve *İlerleme* gösterir; ayrıca projenin her etkinlik kodu ve özel alanı için bir sütun gelir.

## Değerler nasıl okunur ve düzenlenir

- **Hesaplanan sütunlar** — *Hesaplanan* kategorisindeki sütunlar ve diğer bazı sütunlar salt okunurdur: değerleri hesaplamadan gelir. Salt okunur bir hücreyi düzenlemeye çalışırsanız uygulama *Bu hesaplanan sütun düzenlenemez.* der. Bu metin, hesaplanmamış bir sütun olsa bile her salt okunur hücre için genel iletidir. Bir şeyi değiştirdiğiniz için bunlar eskiyse, *Hesapla* düğmesine basılana kadar yanlarında *eski* görünür.
- **Tarihler** — tarihler, *Uygulama ayarları* bölümünde, *Görünüm* sekmesinde ve *Tarih biçimi* başlığı altında seçtiğiniz biçimde görünür.
- **Süreler ve bolluk** — bir süre, görevin biriminde (`5d`, `12h`) veya aynı sekmedeki *Süre gösterimi* ayarına göre görünür (*Otomatik (göreve özgü birim)*, *Her zaman gün* veya *Her zaman saat*). Bolluk iş günü cinsinden, iki ondalık basamakla ve dilinizin ondalık ayracıyla görünür.
- **Evet/Hayır** — bir evet/hayır değeri *Evet* veya *Hayır* olarak görünür; boş bir değer ise tire (—) olarak görünür.
- **Düzenleme** — bir değer yazın veya seçin. Geçersiz bir değer, hücrenin altında bir nedenle birlikte reddedilir, örneğin *5d veya 8h gibi geçerli bir süre girin.* veya *0 ile 100 arasında bir yüzde girin.* Bir hücre bloğunu yapıştırmak hücre hücre çalışır; salt okunur hücreler atlanır ve uygulama kaç hücreyi atladığını bildirir.

## Görev

- **Görev adı** — görevin adı. Düzenlenebilir; zorunludur. Bir özet görev, ad hücresinde hafif bir arka plan tonuyla ve kalın yazıyla gösterilir. Bir kilometre taşı kalın yazıyla ve kilometre taşı renginde gösterilir (Gantt'taki kilometre taşıyla aynı renk ailesi). Normal bir görev olduğu gibi kalır. Bu yalnızca biçimlendirmedir: seçme, sürükleme ve düzenleme aynı şekilde çalışır.
- **Açıklama** — görevin açıklaması. Düzenlenebilir; serbest metindir.
- **WBS** — WBS kodu. Düzenlenebilir ve zorunludur, ama *WBS auto* açıkken salt okunurdur.
- **İş kategorisi** — iş kategorisi (*İnşaat*, *Kurulum*, *Yıkım*, *Lojistik*, *Denetim*, *Taşıma*, *Yenileme*, *Bakım* veya *Diğer*). Bir listeyle düzenlenebilir.
- **Özel iş kategorisi** — projedeki özel iş kategorisi veya bir tire (—). Projenin özel iş kategorilerinin listesiyle düzenlenebilir.
- **Renk** — görevin kayıtlı rengi, `#1a73e8` gibi bir renk kodu olarak. Bir renk seçiciyle düzenlenebilir. Renk IFC dosyasında saklanır, ama hiçbir çubuk veya rapor onu kullanmaz; çubuk renklerini *Görünüm › Temel plan ve ilerleme › Çubuk renkleri* altında ayarlarsınız.
- **Notlar** — notlar `✓ text; ○ text` biçiminde. En fazla bir not olduğu sürece düzenlenebilir; o zaman notun metnini düzenlersiniz. Daha fazla not varsa salt okunurdur.

## Planlama

- **Kilometre taşı** — görevin bir kilometre taşı olup olmadığı. Düzenlenebilir. Bunu açmak süreyi 0 yapar. Uygulama bunu bir özet görev ve atamaları olan bir görev için reddeder.
- **Kilometre taşı türü** — *Başlangıç kilometre taşı* veya *Bitiş kilometre taşı*, ya da otomatik için bir tire (—). Yalnızca bir kilometre taşında düzenlenebilir.
- **Zorunlu kilometre taşı** — *Zorunlu (sözleşmesel)* işareti. Yalnızca bir kilometre taşında düzenlenebilir.
- **Dengeleme önceliği** — 0 ile 1000 arasında bir tam sayı, varsayılan 500. Düzenlenebilir. 1000 değeri görevi dengeleme için sabitler.
- **Bölme boşlukları** — kesinti sayısı, `Split gaps: 2` biçiminde, ya da bir tire (—). Salt okunur; bunları *Özellikler* panelinde düzenlersiniz.
- **Görev türü** — görevin görev türü; boşsa projenin varsayılanı geçerlidir. Bir listeyle düzenlenebilir, ama bir kilometre taşında, özet görevde veya hamakta boştur ve salt okunurdur. Yalnızca görev türleri görünür olduğunda seçicide görünür (*Görev türlerini kullanın*, ya da dosya görev türleri içeriyorsa).
- **Hamak (türetilmiş süre)** — görevin bir hamak olup olmadığı. Düzenlenebilir; bir kilometre taşı veya özet görev hariç.
- **Takvim** — görevin kendi takviminin kimliği; boşsa (—) projenin takvimi geçerlidir. Kimliği önerilerden yazarak veya seçerek girersiniz; bilinmeyen bir kimlik reddedilir. Not: Hücre şu anda adın yerine iç kimliği gösterir; takvimi bunun yerine *Özellikler* panelinden seçmeniz daha iyidir.
- **Süre türü** — *Çalışma süresi* (süre, takvimin iş günleri veya çalışma saatleri olarak sayılır) veya *Geçen süre* (süre, takvim olmadan, kesintisiz saat zamanı olarak sayılır). Düzenlenebilir.
- **Süre birimi** — *Gün* veya *Saat*. Bir özet görev, hamak veya kilometre taşı hariç düzenlenebilir; birimi değiştirmek yalnızca dönüşüm tam ise ve *Saat planlamasını etkinleştir* açıksa çalışır.
- **Süre** — görevin süresi, görevin biriminde veya *Süre gösterimi* ayarına göre. Düzenlenebilir: `5d`, `12h` veya `1h 30m` yazın; görevin biriminde bir sayı da girebilirsiniz. Özet görevde, hamakta ve süresi 0 olan bir kilometre taşında salt okunurdur.
- **Başlangıç** — gösterilen başlangıç; Gantt çubuğundaki tarihle aynı tarihtir. Başlamış bir görevde bu gerçek başlangıçtır. Düzenlenebilir. Öncülü olan bir göreve yeni bir başlangıç verirseniz, görev o tarihte *Şu tarihten önce başlamaz (SNET)* kısıtlamasını alır. Özet görevde veya hamakta, elle planlanmadıkça ve başlamış bir görevde salt okunurdur (*Bu görev başladı; başlangıcı gerçek başlangıçtır. Bunu ilerleme üzerinden değiştirin.*).
- **Bitiş** — gösterilen bitiş. Tamamlanmış bir görevde bu gerçek bitiştir. Düzenlenebilir: yeni bir bitiş yeni bir süre olur. Uygulama bunu bir kilometre taşı, geçen süreli bir görev ve kesintisi olan bir görev için reddeder; ayrıca başlangıçtan önceki bir bitişi de reddeder (*Bitiş, başlangıçtan önce.*). Özet görevde veya hamakta, elle planlanmadıkça ve tamamlanmış bir görevde salt okunurdur (*Bu görev tamamlandı; bitişi gerçek bitiştir. Bunu ilerleme üzerinden değiştirin.*).
- **Planlanan başlangıç** — hesaplamanın başladığı planlama çıpası (gösterilen başlangıçla mutlaka aynı olmak zorunda değildir). Düzenlenebilir; *Başlangıç* alanına yazmakla aynı etkiye sahiptir.
- **Planlanan bitiş** — girilen bitiş. Yalnızca elle planlanan bir görevde düzenlenebilir; aksi halde uygulama *Planlanan bitiş yalnızca elle planlanan bir görev için geçerlidir. Bitişi Bitiş sütunundan veya süreden değiştirin.* der.

## Kısıtlamalar

- **Kısıtlama türü** — kısıtlamanın türü, *Mümkün olduğunca erken (ASAP)* ile *Şu tarihte bitmeli (MFO)* arasından. Düzenlenebilir; kısıtlaması olmayan bir görev *ASAP* gösterir.
- **Kısıtlama tarihi** — kısıtlamanın tarihi. Düzenlenebilir.
- **Kesin kısıtlama** — *Zorunlu (sabitleme mantığı)* işareti. Yalnızca *MSO* ve *MFO* üzerinde düzenlenebilir.
- **İkincil kısıtlama türü** — ikinci sınırın türü, ya da bir tire (—). Düzenlenebilir. Liste tüm türleri sunar, ama izin verilmeyen bir birleşim reddedilir: tür *SNET*, *FNET*, *SNLT* veya *FNLT* olmalıdır; birincil kısıtlama bir sınır olmalıdır (*ASAP*, *ALAP*, *MSO*, *MFO* veya bir kesin kısıtlama değil); ve iki sınır karşıt tarafları sınırlamalıdır (alt sınır *SNET*/*FNET* ile üst sınır *SNLT*/*FNLT*, ya da tersi).
- **İkincil kısıtlama tarihi** — ikinci sınırın tarihi. Düzenlenebilir.
- **Son tarih** — bitiş için hedef tarih. Düzenlenebilir.

## İlişkiler

- **Öncüller** — öncüller, `WBS type±lag` biçiminde ve `; ` ile ayrılmış olarak, örneğin `1.2 FS+2d`. Aynı biçimi yazarak düzenlenebilir. Dış ilişkiyi burada eklemezsiniz; bunu *Planlama › İlişkiler › Bağla › Dış ilişki ekle…* ile yaparsınız.
- **Ardıllar** — ardıllar, aynı biçimde. Düzenlenebilir.
- **Belirleyici ilişki** — bu görevin tarihini belirleyen ilişkiler, `← 1.2` (öncül) veya `→ 1.4` (ardıl) biçiminde. Salt okunur; *Hesapla* düğmesine basılana kadar *eski* olur.
- **Serbest bolluk** (*İlişkiler* kategorisinde) — ilişki başına serbest bolluk, `← 1.2: 3d` biçiminde. Bu, *Hesaplanan* altındaki *Serbest bolluk* sütunuyla aynı değildir; o sütun görevin kendi bolluğunu gösterir. Salt okunur.
- **Uyarılar** — ilişki başına uyarılar, örneğin *Sıra dışı* veya *Hesaplamaya dahil edilmedi*. Salt okunur. Bkz. [Bildirimler ve uyarılar](docs://ref-meldingen).

## Kaynaklar

- **Atanan kaynaklar** — atanan kaynakların adları, virgülle ayrılmış. Düzenlenebilir: bir ad eklemek kaynağı günde 1 birimle atar; bir adı kaldırmak atamayı siler. Bir kilometre taşında veya özet görevde salt okunurdur.
- **Günlük atama birimleri** — kaynak başına birimler, `Name: 1; Name: 0.5` biçiminde, en fazla iki ondalık basamakla. Kayıtlı değer tam olarak kalır. Atamaları olan bir görevde düzenlenebilir.
- **Planlanan günlük birimler** — kaynak başına planlanan oran, `Name: 1.11` biçiminde, en fazla iki ondalık basamakla, *Günlük atama birimleri* gibi. Yalnızca farklı bir kalan oranı olan bir Primavera P6 atamasında; *Günlük atama birimleri* o zaman kalan oranı gösterir. Salt okunur.
- **Atama eğrisi** — kaynak başına eğri, `Name: Uniform` biçiminde. Atamaları olan bir görevde düzenlenebilir.
- **İş penceresi başlangıcı** ve **İş penceresi bitişi** — içe aktarılmış bir dosyadan gelen, kaynak başına iş penceresi, `Name: date` biçiminde. Salt okunur.
- **Planlanan iş (saat)** ve **Gerçek iş (saat)** — içe aktarılmış bir dosyadan gelen, kaynak başına saat cinsinden planlanan ve gerçek iş, `Name: 617.14` biçiminde, en fazla iki ondalık basamakla. Salt okunur.
- **Kalan iş (saat)** — kaynak başına saat cinsinden kalan iş, `Name: 6` veya `Name: 26.67` biçiminde: kayıtlı iş; yoksa kalan süre × birim. Üzerinde bir görev türünün geçerli olduğu, atamaları olan bir görevde düzenlenebilir; ondalık ayırıcı olarak virgül veya nokta kullanılabilir. Yalnızca görev türleri görünür olduğunda seçicide görünür. Hücredeki sarı ⚠ işareti, kayıtlı işin birim × kalan süreden farklı olduğu anlamına gelir; bu, görev panelindeki *İş (kalan)* yanındaki ⚠ ile aynıdır.

## İlerleme

- **Durum** — *Başlamadı*, *Devam ediyor* veya *Tamamlandı*. Düzenlenebilir; özet görev hariç.
- **İlerleme** — tamamlanma yüzdesi, `40%` biçiminde. 0 ile 100 arasında bir sayı girerek düzenlenebilir; özet görev hariç.
- **Gerçek başlangıç** — görevin başladığı tarih. Düzenlenebilir; özet görev hariç.
- **Gerçek bitiş** — görevin tamamlandığı tarih. Düzenlenebilir; özet görev hariç.
- **Gerçek süre** — gerçek süre, sayı olarak. Düzenlenebilir; özet görev hariç.
- **Kalan** — kalan süre, görevin biriminde. Düzenlenebilir; özet görev hariç.
- **Devam tarihi** ve **Durdurma tarihi** — MS Project veya Primavera dosyasından gelen, çalışan bir görevin devam ve durdurma tarihi. Salt okunur.

İlerleme sütunları uygulamanın ilerleme kurallarını izler: durum tarihinden sonraki bir gerçek tarih reddedilir. Bir özet görevde uygulama şunu bildirir: *Özet görevin ilerlemesi alt görevlerinden türetilir ve burada değiştirilemez.*

## Hesaplanan

Bu kategorideki tüm sütunlar salt okunurdur.

- **Dengeleme gecikmesi** — dengelemenin görevi kaç iş günü geciktirdiği; dengeleme uygulanmadıysa tire (—).
- **Erken başlangıç** ve **Erken bitiş** — hesaplamadan gelen en erken tarihler. Başlamış bir görevde bunlar *Başlangıç* ve *Bitiş* değerlerinden farklı olabilir: hesaplama profili *Primavera P6*, devam eden veya tamamlanmış bir görevin erken başlangıcını durum tarihine koyar.
- **Geç başlangıç** ve **Geç bitiş** — görevin projeyi geciktirmeden hâlâ başlayabileceği veya bitebileceği en geç tarihler.
- **Serbest bolluk** — bir ardılı geciktirmeden görevin kayabileceği iş günleri.
- **Toplam bolluk** — projenin bitişini geciktirmeden görevin kayabileceği iş günleri. Bir kısıtlama veya son tarih karşılanamıyorsa negatiftir.
- **Kritik** — *Evet*, görev kritik yoldaysa.
- **Müdahale bolluğu** — toplam bolluk eksi serbest bolluk.
- **Kritiğe yakın** — kritiğe yakın bir görev için *Evet*. Yalnızca *Kritiğe yakın olarak işaretle* açıksa (*Proje ayarları*, blok *Hesaplama profili ve seçenekleri*) doldurulur; aksi halde tire (—).
- **Bolluk yolu** — bolluk yolunun numarası; en kritik olan için 1. Yalnızca *Birden çok bolluk yolu* açıksa doldurulur; aksi halde tire (—).
- **Kayıtlı tarihlerin kaynağı** — uygulama tarihleri dosyadan gösterdiği sürece, dosyanın her şeyi içermediği bir görevde *Kısmen kaydedilmedi* görünür. Yalnızca bu görünümde seçicide görünür. Kayıtsız bir eksende *Kaydedilmedi*, geç tarih ve bolluk sütunlarında görünür.

Bkz. [Kritik yol ve bolluk](docs://uitleg-kritiek-pad).

## Temel plan

Projenin her temel planı için, sütun adının önüne temel planın adı eklenerek sütunlar eklenir (`<baseline> — Scheduled start`). Bunlar salt okunurdur. Temel planda olmayan bir görev, *Bu temel planda bulunmuyor* ipucuyla bir tire (—) gösterir.

- **Planlanan başlangıç**, **Planlanan bitiş** ve **Süre** — başlangıç, bitiş ve süre; temel planın kaydettiği biçimde.
- **Başlangıç sapması** ve **Bitiş sapması** — temel plan ile gösterilen başlangıç veya bitiş arasındaki iş günü sayısı, projenin takvimine göre; görev daha sonraysa değer pozitiftir.
- **Süre sapması** — mevcut süre eksi temel plandaki süre, iş günü cinsinden.

## Özel

- **Etkinlik kodu** — her etkinlik kodu için, kodun adıyla bir sütun. Seçilen değerin kodunu gösterir. Düzenlenebilir: kodu yazabilir veya önerilerden seçebilirsiniz; bilinmeyen bir kod reddedilir. Bir kod birden fazla kez geçiyorsa uygulama sizden onu listeden seçmenizi ister.
- **Özel alan** — her özel alan için, adıyla bir sütun. Giriş türe uyar: metin, sayı, tam sayı, maliyet, tarih veya evet/hayır. Düzenlenebilir.

Bu sütunlar, kodun veya alanın ait olduğu projeye aittir. Bkz. [Kodlar ve özel alanlar](docs://howto-codes-en-velden).

## Teknik

Bu kategorideki tüm sütunlar salt okunurdur. Bunlar, uygulamanın sakladığı ama normal bir sütunda göstermediği verileri gösterir; örneğin bir içe aktarmayı kontrol etmek için.

- **Görev kimliği** — görevin iç kimliği (id).
- **Üst görev kimliği** ve **Alt görev kimlikleri** — üst ve alt görevlerin kimlikleri.
- **Kaynak kimlikleri** — görevdeki kaynakların kimlikleri.
- **Atama kimliği**, **Atama görev kimliği** ve **Atama kaynak kimliği** — bu görevin atamalarının, görevlerinin ve kaynaklarının kimlikleri.
- **Süre (dakika)** ve **Kalan (dakika)** — süre ve kalan süre dakika cinsinden; yalnızca saat biriminde olan bir görevde doldurulur.
- **Dengeleme gecikmesi (dakika)** ve **Geçen dengeleme gecikmesi** — MS Project'ten gelen dengeleme gecikmesi dakika cinsinden ve bunun saat zamanında sayılıp sayılmadığı.
- **Elle planlanan** — görevin elle planlanıp planlanmadığı.
- **MS Project görev türü (içe aktarma)** ve **Efor odaklı** — MS Project'in bu görev için tuttuğu görev türü ve efor odaklı işareti.
- **Primavera P6 kökeni** — Primavera dosyasından gelen köken alanları, `key: value` biçiminde.
- **Açık özet görev** — görevin alt görevsiz açık bir özet olup olmadığı (bir Primavera dosyasından).
- **Zamana yayılmış bitiş tabanı**, **Zamana yayılmış başlangıç çıpası**, **Zamana yayılmış süre segmentleri** ve **Zamana yayılmış konturlar** — MS Project dosyasından gelen saat dağılımı, tarih ve sayılar olarak.
- **Etkinlik kodu verisi**, **Özel alan verisi** ve **Not verisi** — etkinlik kodu atamalarının, özel alanların ve notların sayısı.
- **İç ilişki verisi** ve **Dış ilişki verisi** — iç ve dış ilişkilerin sayısı.
- Her temel plan için burada ayrıca **Kilometre taşı** ve **Kilometre taşı türü** de yer alır; temel planın kaydettiği biçimde.
