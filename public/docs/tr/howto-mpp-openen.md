# Bir Microsoft Project dosyasını (.mpp) açma

Amaç: bir MS Project planlamasını, önce dışa aktarmadan, doğrudan uygulamada açmak.

## Bunu ne zaman kullanırsınız

Bir yüklenici, danışman veya müşteri planlamasını size `.mpp` dosyası olarak gönderir. Bunu görüntülemek, hesaplamak veya daha ileri geliştirmek istersiniz. Uygulama, MS Project 2010'dan 2021'e kadar (2021 dahil) sürümlerin `.mpp` dosyalarını okur. Uygulama yalnızca okur: `.mpp` yazmaz ve dosyanızı hiçbir zaman değiştirmez. Dosyadan planlamanın kendisini alır: yapısı, süresi ve kısıtlamaları olan görevler, gecikmeli ilişkiler, takvimler, kaynaklar, atamalar ve ilerleme. Ayrıca MS Project'in kendi hesapladığı tarihleri ve bolluğu okur, ama bunları yalnızca *Dosyada kayıtlı tarihler* görünümü için kullanır, hiçbir zaman girdi olarak kullanmaz.

## Adımlar

1. *Ana sayfa › Dosya › Aç* öğesini seçin veya Ctrl+O tuşlarına basın. `.mpp` dosyasını seçin.
2. Proje yeni bir sekmede açılır. Geçerli sekme hâlâ boş ve değiştirilmemişse proje bu sekmede açılır. Projenin dosyası yoktur. *Kaydet* daha sonra yeni bir IFC dosyası yazar. Ardından kısa bir pencere, uygulamanın dosyadan neyi devraldığını ve kaydetmenin nasıl çalıştığını açıklar; bkz. [Dosya açma ve kaydetme](docs://howto-bestand-openen-en-opslaan).
3. Alttaki mesajı okuyun: *Bu proje Microsoft Project olarak hesaplanıyor. Değiştirmek için “Dosya” → “Proje Bilgileri” → “Hesaplama profili ve seçenekleri” yolunu izleyin.* Uygulama bu projeyi MS Project'in hesaplama kurallarıyla hesaplar: hesaplama profili *Microsoft Project*. *Hesaplama profilini aç* ile ayara gidersiniz. *Daha fazla bilgi* hesaplama profilleri hakkındaki Yardım'ı açar.
4. Şeridin altında bir bilgi satırı olup olmadığını kontrol edin: *Tarihleri dosyada kaydedildiği şekilde görüntülüyorsunuz; yeniden hesaplama 4 görevi kaydırır.* Bu görevlerde uygulamanın sonucu, MS Project'in kaydettiği tarihlerden farklıdır. Adım 3'teki mesajın altında ayrıca şu satır görünür: *4 görev, dosyada kayıtlı tarihleri gösteriyor (yeniden hesaplanmadı).* Bunun ne anlama geldiğini ve uygulamanın kendi hesaplamasına nasıl geçeceğinizi [Dosyada kayıtlı tarihler](docs://uitleg-datums-zoals-opgeslagen) sayfasında bulursunuz.
5. Uygulama *Bu dosya saat bazlı planlama içeriyor.* mesajını ve *Saat planlamasını etkinleştir* düğmesini gösteriyorsa, dosya saat cinsinden veriler içerir. Bkz. [Saat planlamasını açma](docs://howto-urenplanning-aanzetten).

Dosyada bölünmüş, dengelenmiş veya kaynak odaklı planlanmış görevler varsa, örneğin şu başka bir mesaj eklenir: *Bu MS Project dosyası, bölünmüş, dengelenmiş veya kaynak odaklı planlanmış 3 görev içeriyor. Böyle içe aktarılır ve gösterilir.* Tek bir görev için mesaj tekil biçimdedir.

## Olası sorunlar ve uygulamanın o durumda yaptıkları

**Her şey aktarılmaz.** Açtıktan sonra uygulama, devralmadığı şeyleri tek bir mesajda size bildirir: *Bu MS Project dosyasındaki bazı veriler aktarılmadı.* Bunun altında her öğe için sayısıyla birlikte bir satır vardır, örneğin *2 temel plan aktarılmadı.* Bir `.mpp` dosyası için 3. adımdaki hesaplama profiliyle ilgili cümle bu mesajın ilk satırıdır. Mesaj, kapatma düğmesine (×) tıklayana kadar görünür kalır. Hiçbir şey kaybolmazsa bu mesajı görmezsiniz. Bir satır şunlarla ilgili olabilir:

- eklenen projeler (alt projeler): uygulama bunları normal bir görev olarak okur, diğer dosyaya bağlantısı olmadan;
- başka bir projeden gelen dış görevler: uygulama bunları normal bir görev olarak okur;
- temel planlar: bir `.mpp` dosyasından uygulama hiçbir temel plan devralmaz; MS Project XML'den yalnızca görevlerin 0 numaralı temel planı devralınır ve bunun da yalnızca tarihleri ile süresi (saat bazlı bir görev için ayrıca saati; işi ve maliyeti değil, kaynak ve atamaların temel planlarını da değil);
- MS Project XML ile: temel planındaki tarihleri görevin tarihlerinden farklı olan bir atama. Uygulama yalnızca görevin temel planını tutar; tarihler aynıysa hiçbir şey kaybolmaz ve uygulama bir şey bildirmez. Aynı günde farklı bir saat de bir farktır;
- değerleri olan özel alanlar, örneğin özel alanlar, bir arama tablosundan gelen değerler ve ana hat kodları (uygulama bir `.mpp` dosyasındaki evet/hayır alanlarını saymaz);
- kaynaklardaki ve atamalardaki notlar (yalnızca bir resim içeren not da dahil), bir `.mpp` dosyasında ayrıca görevlerdeki notlar (MS Project XML'de bir görevin notu açıklama olarak aktarılır);
- köprü bağlantıları;
- görevlerin sabit maliyetleri;
- kaynakların ücretleri: bir `.mpp` dosyasından hiç ücret alınmaz, MS Project XML'den yalnızca standart ücret;
- yalnızca MS Project XML ile: elle planlanan görevler (uygulama bunları otomatik planlar), etkin olmayan görevler (hesaplamaya dahil edilir) ve dengeleme gecikmesi;
- yalnızca bir `.mpp` ile: MS Project'teki kritik eşik; uygulama eşik 0 kullanır.

MS Project'te kendiniz doldurduğunuz bir WBS kodu devralınır; aksi hâlde uygulama görevleri yapıya göre numaralandırır.

**MS Project 2007 veya daha eski bir dosya.** Uygulama dosyayı reddeder ve şunu bildirir: *Bu .mpp dosyası eski bir biçim kullanıyor (Project 2007 veya daha eski). MS Project'te XML olarak dışa aktarın (Dosya → Farklı Kaydet → XML) ve o dosyayı açın.* Mesajın altında uygulama İngilizce bir teknik neden ekler.

**Parolalı bir dosya.** Uygulama şunu bildirir: *Bu .mpp dosyası parola ile korunuyor. MS Project'te XML olarak dışa aktarın (Dosya → Farklı Kaydet → XML) ve o dosyayı açın.* Bu mesajla birlikte de İngilizce bir teknik neden gösterilir.

**Dosyanın `.mpp` olmadığı ortaya çıkarsa.** *Dosya açılamadı* mesajını görürsünüz; yanında bir teknik neden gösterilir.

**XML yolu farklı hesaplanır.** `.mpp` yerine MS Project XML-dışa aktarımını açarsanız, uygulama *Open Planner Studio* hesaplama profiliyle hesaplar ve *Microsoft Project* ile ilgili mesajı görmezsiniz. Tarihler o zaman `.mpp` dosyasıyla farklı çıkabilir. XML-dışa aktarımıyla da uygulama neyi devralmadığını size bildirir; bkz. *Her şey aktarılmaz*.

**Bir düzenleme MS Project'in yönlendirmesini sonlandırır.** MS Project'in tarih penceresiyle yönlendirilen bir görevi düzenlerseniz, uygulama her proje için bir kez şunu bildirir: *MS Project'ten gelen saat dağılımı bu düzenlemeden sonra 2 görevi artık yönlendirmiyor; özgün dağılım dosyada saklı kalıyor.* Tek bir görev için mesaj tekil biçimdedir.

**Kaydetme, `.mpp` dosyanızın üzerine hiçbir zaman yazmaz.** Projenin dosyası yoktur. *Kaydet* yeni IFC dosyasının nereye kaydedileceğini sorar.

## Ayrıca bakın

- [Dosyalar ve biçimler](docs://uitleg-bestanden): neden bir `.mpp` yalnızca okunur ve kaydetmek ne yazar.
- [Dosyada kayıtlı tarihler](docs://uitleg-datums-zoals-opgeslagen): MS Project'in kendi tarihlerinin görünümü.
- [Saat planlamasını açma](docs://howto-urenplanning-aanzetten): dosya saat cinsinden veri içeriyorsa.
- [Bir Primavera P6 dosyasını (.xer) açma](docs://howto-xer-openen): Primavera için aynısı.
- [İçe ve dışa aktarma biçimleri](docs://ref-import-exportformaten): her biçim için neyin aktarıldığı ve neyin aktarılmadığı.
- [Hesaplama profilleri ve kurallar](docs://uitleg-rekenprofielen): neden bir MS Project dosyası kendi hesaplama profiliyle açılır.
