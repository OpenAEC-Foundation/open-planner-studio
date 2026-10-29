# Dosyalar ve biçimler

Kaydettiğiniz dosyada gerçekte ne var? Ve planlamanıza ne olur, onu başka bir pakete dışa aktardığınızda? Bu makalede uygulamanın dosyaları nasıl işlediğini okursunuz: kendi biçimi olarak IFC, uyarlayıcı olarak diğer biçimler, bir dışa aktarmanın neyi bıraktığı ve kaydetme, otomatik kaydetme ile çökme kurtarmanın nasıl farklı olduğu. Sondaki örnek, bir dışa aktarmanın ne yaptığını rakamlarla gösterir.

## Kavram

Open Planner Studio kendi dosya biçimine sahiptir: **IFC**, buildingSMART'ın inşaat bilgisi için açık bir değişim biçimi. Uygulama projenin IFC şemasını yazar; varsayılan olarak IFC 4.3 ADD2 kullanır (bkz. [IFC şemasını seçme](docs://howto-ifc-schema-kiezen)). Dışa aktarma listesinde bu *IFC* olarak geçer. İkinci bir, tescilli proje dosyası yoktur. *Kaydet* projenizin tamamını bir IFC dosyası (`.ifc`) olarak yazar ve *Aç* böyle bir dosyayı geri okur. Dosyaya neyin girdiğini görmek ister misiniz? *IFC* sekmesi projenizin IFC metnini gösteren bir düzenleyicidir; *IFC Oluştur* bu metni yeniler ve *Kopyala* metni panoya koyar. Metni değiştirirseniz, *Uygula* onu projeniz olarak yükler. Bu, o sekmedeki projeyi tamamen değiştirir.

Diğer tüm biçimler **uyarlayıcılardır**: başka bir programın modeli ile uygulamanın modeli arasındaki çevirmenlerdir. Uygulama CSV, MS Project XML, Primavera P6 XML, MS Project dosyalarını (`.mpp`) ve Primavera dosyalarını (`.xer`) okur. CSV, MS Project XML, Primavera P6 XML ve iki ilerleme sayfası yazar. `.mpp` veya `.xer` dosyasına dışa aktaramazsınız.

Bu ayrım neden önemli? Bir uyarlayıcı yalnızca iki tarafın da bildiğini aktarabilir. Uygulamanın IFC dosyası, projenize ait her şeyi tutar. Diğer her biçimde bir kısım eksiktir ve o kısım geride kalır.

## Uygulama dosyaları nasıl işler

### Açmanın ne yaptığı

Uygulama okuyucuyu dosya uzantısına göre seçer: `.ifc`, `.csv`, `.xml`, `.mpp` veya `.xer`. Bir `.xml` dosyasının içine bakar; MS Project XML mi yoksa Primavera P6 XML mi olduğunu anlamak için. Bilinmeyen bir dosya uzantısı IFC sayılır. Dosya IFC değilse uygulama *Dosya açılamadı* bildirir ve nedenini ekler.

Her dosya kendi sekmesinde açılır. Bunun bir istisnası var: boş ve değiştirilmemiş bir sekme dosyayı devralır. Tek bir Primavera dosyası birden fazla sekme üretebilir; görevleri olan her proje için bir sekme.

Açtıktan sonra uygulama her zaman yeniden hesaplar. Dosya başka bir paketten geliyorsa tarihler, dosyanın dediklerinden farklı olabilir. Bu, [Kaydedildiği gibi tarihler](docs://uitleg-datums-zoals-opgeslagen) bölümünde açıklanır.

Yalnızca bir IFC dosyası **kayıt hedefi** olur: *Kaydet* düğmesinin geri yazdığı dosya. Bir CSV, XML, `.mpp` veya `.xer` dosyası olmaz. Böyle bir proje açtıktan sonra dosyası yoktur; *Kaydet* o zaman yeni IFC dosyasının nereye gideceğini sorar. Bu sayede Ctrl+S hiçbir zaman özgün dosyanızın üzerine IFC metni yazmaz.

### Kaydetmenin ne yazdığı

*Kaydet* her zaman projenin tamamını yazar. Şunlar içeri girer:

- yapısı, süresi, tarihleri ve ilerlemesi olan görevler;
- gecikmeli, kısıtlamalı ve son tarihli ilişkiler;
- takvimler, kaynaklar ve atamalar, eğrileriyle birlikte;
- temel planlar, etkinlik kodları, özel alanlar ve notlar;
- diğer projelere dış ilişkiler;
- proje ayarları, örneğin durum tarihi, hesaplama profili ve hesaplama seçenekleri;
- bir kaynak kitaplığına bağlantı.

Ekranda ayarladığınız şeyler projeye ait değildir ve dosyaya girmez: yakınlaştırma, kaydırma konumu, seçili görev ve daraltılmış fazlar. Uygulama ayarlarınız, örneğin dil ve tema, dosyada da yer almaz. Uygulama bunları kendisi tutar, uygulamada veya tarayıcınızda.

Bir dışa aktarma projenize dokunmaz. Dışa aktarmadan sonra projenin kayıt hedefi aynı kalır ve önceden *Kaydedilmedi* ise hâlâ öyle işaretlenir.

### Dışa aktarmanın kaybettikleri

Her uyarlayıcı, kendi biçiminin bildiklerini taşır.

**MS Project XML** görevleri, ilişkileri, takvimleri, kaynakları, atamaları, kısıtlamaları, son tarihleri ve durum tarihini taşır. Temel planlarınızdan yalnızca etkin olanı gider. Etkinlik kodları, özel alanlar, notlar ve dış ilişkiler gitmez. Bir görevdeki ikinci kısıtlama gitmez. Seçeneği *Zorunlu (sabitleme mantığı)* olmayan bir *Şu tarihte başlamalı (MSO)* veya *Şu tarihte bitmeli (MFO)* kısıtlaması, geri gelirken *Şu tarihten önce başlamaz (SNET)* veya *Şu tarihten önce bitmez (FNET)* olur. *Elle planlandı* ve bir görevin *Dengeleme gecikmesi* geri gelmez. Hamak, hesaplanmış tarihleri olan normal bir görev olur.

**Primavera P6 XML** görevleri, ilişkileri, takvimleri, kaynakları, atamaları, kısıtlamaları ve durum tarihini taşır. Temel planlar ve son tarihler gitmez; etkinlik kodları, özel alanlar, notlar ve dış ilişkiler de gitmez. Hamak burada da normal bir görev olur. P6 yüzdelik gecikme tanımaz: uygulama böyle bir gecikmeyi sabit bir gün sayısına çevirir. Takvim günü cinsinden bir gecikme, iş günü cinsinden bir gecikme olur.

**CSV** bir görev listesidir. Dosyada her görev için şu sütunlar vardır: görev kimliği, WBS, düzey, ad, süre, başlangıç, bitiş, öncüller, iş kategorisi, özel iş kategorisinin kimliği (`OPS Custom Task Type ID`), durum, tamamlanma, gerçek başlangıç ve bitiş, kritik, toplam bolluk ve açıklama. Kaynaklar, atamalar, takvimler, kısıtlamalar, son tarihler, temel planlar ve durum tarihi yer almaz. Sütun başlıkları her zaman İngilizcedir.

**Yalnızca IFC hesaplama profilini ve hesaplama seçeneklerini taşır.** CSV, MS Project XML veya Primavera P6 XML'e dışa aktarırsanız profil dosyada olmaz. Hesaplama seçeneklerinden MS Project XML en fazla kritik eşiği yazar. Böyle bir dosya *Open Planner Studio* olarak yeniden açılır. Projeniz *Primavera P6* veya *Microsoft Project* ile hesaplandıysa, örneğin bir `.xer` veya `.mpp` dosyasından geldiği için, tarihler bu yüzden kayabilir. Hesaplama profilinin ne olduğu, [Hesaplama profilleri ve kurallar](docs://uitleg-rekenprofielen) bölümünde açıklanır.

Projeniz bir Primavera dosyasından (`.xer`) geliyorsa, IFC olarak kaydetmiş olsanız bile, uygulama CSV, MS Project XML veya P6 XML'e dışa aktardıktan sonra şunu bildirir: *CSV biçimine dışa aktarma XER kaynak bilgilerini kaybeder.* MS Project XML için mesaj *CSV* yerine *MSPDI* yazar; P6 XML için de *P6* yazar. IFC için bu mesajı görmezsiniz: IFC dosyası kaynak Primavera dosyasını da taşır. Bkz. [Bir Primavera P6 dosyası açma (.xer)](docs://howto-xer-openen).

Dışa aktarmada uygulamanın yaptığı iki şey daha var. Planlama güncel değilse uygulama önce yeniden hesaplar, sonra dışa aktarır. Ayrıca döngüsel bir ilişkisi olan bir planlamayı dışa aktarmaz: döngüyü içeren bir ileti alırsınız, örneğin *Görevler arasında döngüsel ilişki: Set up site → Demolish existing extension → Set up site*.

### Kaydetme, otomatik kaydetme ve çökme kurtarma

Bunlar üç ayrı şeydir. Birbirine benzerler, ama farklı bir yere yazarlar.

**Kaydetmek** sizin yaptığınız bir iştir. Uygulama projenizi dosyanıza yazar ve *Kaydedilmedi* işaretini kaldırır.

**Otomatik kaydetme** varsayılan olarak kapalıdır; her proje için kendiniz açarsınız. Açıkken uygulama, bir pencere göstermeden, değişiklik olduğunda aynı dosyaya yazar; en fazla on saniyede bir. Bu yalnızca projenin zaten bir dosyası varsa çalışır. Bkz. [Otomatik kaydetmeyi açma](docs://howto-automatisch-opslaan).

**Çökme kurtarma** her zaman açıktır. Bir değişiklik olur olmaz uygulama, en fazla on saniyede bir, açık olan tüm projelerin bir kurtarma kopyasını tutar; siz kendiniz değiştirmediğiniz projeler dahil. Bu kopya proje dosyanızda değildir: masaüstü uygulamasında uygulamanın veri klasöründe, tarayıcıda ise tarayıcının depolamasındadır. Bir sonraki başlangıçta uygulama bu kopyayı önerir. Bunu [Çökmeden sonra kurtarma](docs://howto-herstellen-na-een-crash) bölümünde okursunuz. Çökme kurtarma hiçbir zaman proje dosyanıza yazmaz.

Kurtarma kopyası en fazla on saniyede bir tutulduğu için, bir çökmede son birkaç saniyelik çalışmanızı kaybedebilirsiniz.

### Masaüstü ve tarayıcı

Masaüstü uygulaması ve tarayıcı sürümü projenizle aynı şeyleri yapar, ama dosyaları farklı yazarlar.

Masaüstünde uygulama gerçek yollarla çalışır. *Kaydet* doğrudan dosyanıza yazar. Genellikle uygulama önce yanındaki geçici bir dosyaya (`.ops-save.tmp`) yazar ve sonra dosyanızın yerini alır. Yazarken bir çökme olursa eski dosyanız bozulmaz. Değişikliklerle uygulamayı kapatırsanız, her proje için kaydetmek isteyip istemediğinizi sorar. Temiz bir kapanışta kurtarma kopyalarını siler.

Dosyaları istediğiniz yere tutabilen bir tarayıcıda (Chrome ve Edge gibi) normal bir açma ve kaydetme penceresi alırsınız. Bundan sonra *Kaydet* doğrudan dosyaya yazar. Açtığınız bir dosya için tarayıcı izni bir kez sorar. *Son açılanlar* listesi çalışır, yalnızca dosya adlarıyla.

Böyle bir yeteneği olmayan bir tarayıcıda (Firefox gibi) uygulama bir dosyayı dosya seçici ile açar ve bir indirme ile kaydeder. Bu tarayıcıda *Kaydet* ile mesaj *İndirme olarak kaydedildi: 'name.ifc' indirmeler klasörünüzde. …* her oturumda bir kez açıklanır. *Farklı kaydet* ve dışa aktarmalarda şunu görürsünüz: *İndirme olarak kaydedildi: 'name.ifc' artık indirmeler klasörünüzde. Bu ortam uygulamanın seçtiğiniz konuma doğrudan yazmasına izin vermiyor.* Tarayıcı bir kaydetme penceresi gösterebilir ama projenin dosyasına geri yazamazsa, *Kaydet* her seferinde yeniden bir yer ister. Bunu da bir mesaj her oturumda bir kez açıklar. *Dosya › Son açılanlar* vardır, ama boş bir sayfa açar, ve otomatik kaydetme kullanılamaz. Uygulamanın seçtiğiniz yere yazamadığı her ortamda aynı mesajı görürsünüz.

## Örnek: örnek projeyi dışa aktarma

Örnek projeyi alın: *Dosya › Örnekler* içindeki *Refurbishment & Extension of a Family Home*. Bu projede 20 görev vardır; bunların 4'ü faz ve 2'si kilometre taşıdır. Ayrıca 16 ilişki vardır. 6 kaynak ve 8 atama, 1 temel plan ve *Demo resource library* ile bir bağlantı vardır. *Demolish existing extension* görevi, 14 Mayıs 2027 tarihinde *Şu tarihten önce başlamaz (SNET)* kısıtlamasına sahiptir. *Handover inspection* görevinin 29 Temmuz 2027 tarihinde bir son tarihi vardır. Planlama 7 Temmuz 2027'de biter.

Bu, projenin her biçimden nasıl geri geldiğidir. Dışa aktarma dosyası yeniden açıldıktan sonra ölçülmüştür:

- IFC dosyası her şeyi geri verir: 20 görev, 16 ilişki, 6 kaynak, 8 atama, temel plan, kısıtlama, son tarih ve kitaplık bağlantısı. Planlama yine 7 Temmuz 2027'de biter.
- MS Project XML dosyası da kitaplık bağlantısı dışında her şeyi geri verir. Planlama 7 Temmuz 2027'de biter.
- P6 XML dosyası görevleri, ilişkileri, kaynakları, atamaları ve kısıtlamayı geri verir. Temel plan ve son tarih yoktur. Planlama yine 7 Temmuz 2027'de biter, çünkü kısıtlama hâlâ içindedir.
- CSV dosyası 20 görevi ve 16 ilişkiyi geri verir. Kaynaklar, atamalar, temel plan, kısıtlama ve son tarih yoktur ve proje *CSV Import* adını alır. Kısıtlama olmadan iş ileri kayar: planlama 2 Temmuz 2027'de biter, beş takvim günü erken.

Bu kısıtlama olmadan örnek de 2 Temmuz 2027'de biter. Yani fark, CSV dosyasının taşımadığı kısıtlamadan gelir.

## Sonuçlar ve yanlış anlamalar

**Bir dışa aktarma yedek değildir.** Yalnızca IFC her şeyi tutar. Projenizi saklamak istiyorsanız IFC olarak kaydedin. Dışa aktarın yalnızca başka bir biçime ihtiyacı olan birine.

**Bir dışa aktarmayı yeniden açmak her zaman aynı planlamayı vermez.** Uygulama açarken her zaman yeniden hesaplar, biçime ait hesaplama profiliyle. Mantık eksikse, örneğin CSV örneğindeki kısıtlama gibi, ya da profil farklı hesaplıyorsa, sonuç değişir.

**Bir dışa aktarma da *Son açılanlar* listesinde yer alır.** Masaüstünde ve dosya erişimi olan tarayıcılarda bir dışa aktarma, kaydedilmiş bir proje gibi bu listeye düşer (ilerleme sayfaları hariç). Oradan açarsanız, o biçimin içe aktarması olarak açılır.

**Kaydetmek ile çökme kurtarma aynı şey değildir.** Çökme kurtarma bir çökmeden sonra yardımcı olur, ama kaydetmenin yerini tutmaz. Bu yüzden bir sekmeyi veya uygulamayı kapatmadan önce kaydedin.

## Ayrıca bakınız

- [Dosya açma ve kaydetme](docs://howto-bestand-openen-en-opslaan): açma, kaydetme ve farklı kaydetme adımları.
- [Dışa aktarma](docs://howto-exporteren): bir biçim seçmek ve ne alacağınız.
- [Kaydedildiği gibi tarihler](docs://uitleg-datums-zoals-opgeslagen): içe aktarılan bir planlamanın neden başka tarihler gösterebileceği.
- [Kısıtlamalar ve son tarihler](docs://uitleg-constraints): bir kısıtlamanın ne yaptığı ve eksikse neyin kaybolduğu.
- [İlişkiler ve gecikme](docs://uitleg-relaties): gecikmenin ne olduğu ve uygulamanın onu nasıl hesapladığı.
- [Hamak oluşturma](docs://howto-hammock): hamağın ne olduğu; bir dışa aktarma onu normal bir görev olarak yazar.
- [Kodlar ve özel alanlar](docs://howto-codes-en-velden): etkinlik kodları ve özel alanlar; bunları yalnızca IFC tutar.
- [Başka bir projeye dış ilişkiler](docs://howto-externe-relaties): MS Project XML ve P6 XML'in taşımadığı bağlantılar.
- [Temel plan kaydetme ve yönetme](docs://howto-baseline-opslaan-en-beheren): temel planlar; MS Project XML bunlardan yalnızca etkin olanı taşır.
- [İçe ve dışa aktarma biçimleri](docs://ref-import-exportformaten): her biçimde neyin aktarıldığı ve neyin aktarılmadığı.
