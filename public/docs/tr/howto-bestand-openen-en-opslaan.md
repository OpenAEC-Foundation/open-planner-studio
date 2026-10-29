# Dosya açma ve kaydetme

Amaç: bir projeyi bir dosyadan açmak ve değişikliklerinizi saklamak.

## Ne zaman gerekir

Güne dünkü projenizle başlarsınız, bir meslektaşınızdan veya başka bir paketten bir dosya alırsınız ya da büyük bir şeyi değiştirmeden önce ara bir durumu kaydetmek istersiniz. Uygulamanın bir dosyada neyi sakladığı ve neden yalnızca IFC'nin tüm projenizi sakladığı, [Dosyalar ve biçimler](docs://uitleg-bestanden) bölümünde açıklanır.

## Adımlar

### Dosya açma

1. *Ana sayfa › Dosya › Aç* ya da *Dosya › Aç* seçin, ya da Ctrl+O tuşlarına basın (Mac'te ⌘+O). *Dosya* grubu da *Tablo* sekmesinde bulunur.
2. Dosyayı seçin. Aynı anda yalnızca bir dosya açarsınız. Masaüstü uygulamasında ve Chrome ve Edge gibi dosya erişimi olan tarayıcılarda pencere bir dosya türleri listesi gösterir: *Desteklenen tüm türler*, *IFC dosyaları*, *CSV dosyaları*, *XML dosyaları*, *MS Project dosyaları* ve *Primavera XER dosyaları*.
3. Proje yeni bir sekmede açılır. Geçerli sekme hâlâ boşsa ve değişmemişse, proje o sekmede açılır.
4. Dosya IFC değilse, biçimin kısa açıklamasını gösteren bir pencere açılır. Yeşil bir kutu uygulamanın neyi devraldığını gösterir. Turuncu bir kutu neyin dahil edilmediğini veya yalnızca kısmen dahil edildiğini gösterir. Mavi bir kutu ise kaydetmenin ve geri yazmanın nasıl çalıştığını gösterir. *Devamını oku* o biçimin kılavuzunu açar. Pencereyi kapatmak için *Anladım* öğesine tıklayın. Bu biçim için açıklamayı artık görmek istemiyorsanız, önce *… için bir daha gösterme* kutusunu işaretleyin. Bunu [Uygulama ayarları](docs://ref-instellingen) içinde, *Gelişmiş* sekmesinde yeniden açabilirsiniz.

IFC dosyası sekmeye kendi dosya adını verir. Başka bir biçimden gelen proje, proje adını alır.

Uygulama `.ifc`, `.csv`, `.xml` (MS Project XML veya Primavera P6 XML), `.mpp` ve `.xer` dosyalarını açar. Son iki tür için ayrı adımlar var: [Bir MS Project dosyasını (.mpp) açma](docs://howto-mpp-openen) ve [Bir Primavera P6 dosyasını (.xer) açma](docs://howto-xer-openen).

### Son açılan projeyi açma

*Ana sayfa › Dosya › Son açılanlar* seçin ve listedeki bir dosyaya tıklayın, ya da *Dosya › Son açılanlar* seçin. Liste açtığınız, kaydettiğiniz veya dışa aktardığınız son on dosyayı tutar. IFC olmayan bir dosya için de biçimin açıklaması görünür. Masaüstü uygulaması her dosya için yolu gösterir, tarayıcı yalnızca adı gösterir.

Uygulama listedeki bir dosyayı artık okuyamazsa, örneğin dosyayı taşıdığınız için, dosya mesaj göstermeden listeden kaybolur. Firefox gibi dosya erişimi olmayan tarayıcılarda *Son açılanlar* boş kalır.

### Örnek açma

*Dosya › Örnekler* seçin ve bir örnek projeye tıklayın. Proje bir sekmede açılır, dosyası olmadan. Bu nedenle *Kaydet* nereye kaydetmek istediğinizi sorar.

### Kaydetme

*Ana sayfa › Dosya › Kaydet* ya da *Dosya › Kaydet* seçin, ya da Ctrl+S tuşlarına basın. Bundan sonra ne olduğu projenize bağlıdır:

1. Projenin zaten bir dosyası varsa, çünkü bir IFC dosyası açtınız ya da daha önce kaydettiniz, uygulama o dosyaya yazar. Pencere açılmaz. Yalnızca IFC 4.3 ADD2 dışında bir IFC şemasıyla kaydedilen bir dosyayı ilk kez kaydettiğinizde pencere açılır. Uygulama önce *Hangi IFC şemasında kaydedilsin?* diye sorar. Bkz. [IFC şemasını seçme](docs://howto-ifc-schema-kiezen).
2. Projenin henüz bir dosyası yoksa, uygulama nereye kaydedileceğini sorar. Proje adını `.ifc` ile önerir. Bundan sonra o dosya projenin dosyası olur.
3. Tarayıcınız yalnızca indirme yoluyla kaydediyorsa (Firefox gibi), dosya indirilenler klasörünüze düşer ve her kaydetme yeni bir indirme oluşturur. Bir oturumda ilk kez şu mesajı görürsünüz: *İndirme olarak kaydedildi: “name.ifc” indirilenler klasörünüzde. Bu tarayıcı uygulamanın kendine ait bir yere yazmasına izin vermez, bu yüzden her kaydetme yeni bir indirme oluşturur. Chrome, Edge veya masaüstü uygulamasında Kaydet yalnızca aynı dosyayı günceller.*
4. Tarayıcı projenin dosyasına geri yazamıyorsa, uygulama her kaydetmede dosyanın nereye konacağını yeniden sorar. Bu *Farklı kaydet* gibi görünür, ama tarayıcının bir sınırıdır. Bir oturumda ilk kez şu mesaj bunu açıklar: *Bu tarayıcı uygulamanın “name.ifc” dosyasına geri yazmasına izin vermez.* Mesajda [Dosyalar](docs://uitleg-bestanden) sayfasına bir bağlantı bulunur.

Kaydettikten sonra *Kaydedilmedi* işareti kaybolur: sekmedeki nokta, en üstte proje adının önündeki yıldız işareti ve durum çubuğunun sağ altındaki *Kaydedilmedi* yazısı.

### Başka bir adla kaydetme

*Ana sayfa › Dosya › Farklı kaydet* ya da *Dosya › Farklı kaydet* seçin, ya da Ctrl+Shift+S tuşlarına basın. Bir ad ve bir yer seçin (Firefox'ta uygulama bunun yerine yeni bir dosyayı indirir). Bundan sonra proje bu yeni dosya ile çalışır: bir sonraki *Kaydet* oraya yazar. Eski dosya, son kaydettiğiniz hâlinde kalır.

### Projeyi kapatma

Sekmedeki çarpıya tıklayın, ya da *Dosya › Projeyi kapat* seçin. Kaydetmediğiniz değişiklikleri olan bir proje varsa, uygulama şunu sorar: *Kaydedilmemiş değişiklikler: “name” henüz kaydedilmemiş değişikliklere sahip.* Şunlardan birini seçersiniz: *İptal* (proje açık kalır), *Kaydetme* (proje kapanır ve değişiklikleriniz kaybolur) veya *Kaydet* (önce kaydedin, sonra kapatın). Masaüstünde tüm uygulamayı kapatırsanız (kapatma düğmesi, Alt+F4 veya işletim sisteminizin menüsü ile), uygulama bunu değişiklikleri olan her proje için sorar. *İptal* veya başarısız bir kaydetme, kapatmayı durdurur. Böyle normal bir kapatmadan sonra uygulama o oturumun kurtarma kopyalarını temizler. Bu nedenle kurtarma penceresi yalnızca gerçek bir çökmeden sonra görünür. Bir projenin değişiklikleri varsa ve tarayıcı sekmesini veya penceresini kapatırsanız, tarayıcı onay ister.

## Sorunlar ve uygulamanın o durumda yaptıkları

**Açtığınız bir IFC dosyası hemen projenizin dosyası olur.** *Kaydet* o dosyanın üzerine yazar, başka bir programdan gelmiş olsa bile. Orijinali saklamak istiyorsanız önce *Farklı kaydet* seçin.

**Diğer biçimlerin üzerine hiçbir zaman yazılmaz.** Açıldıktan sonra bir `.csv`, `.xml`, `.mpp` veya `.xer` dosyası projenin dosyası olarak bağlı kalmaz. *Kaydet* yeni bir IFC dosyası yazar ve orijinale dokunmaz.

**Firefox'ta her kaydetme yeni bir dosya oluşturur.** Uygulama orada dosyanıza yazamaz. Her seferinde yeni bir dosya indirir. Dosya adı proje adıdır, açtığınız dosyanın adı değil.

**Chrome ve Edge izin ister.** Açtığınız bir dosyayı ilk kez *Kaydet* ile kaydettiğinizde, tarayıcı uygulamanın ona yazıp yazamayacağını sorar. Reddederseniz, uygulama yeni bir dosya seçtiğiniz bir pencere açar. Chrome ve Edge'de, mevcut dosyaya yazma başarısız olursa, örneğin dosya kaybolduğu veya kilitlendiği için, bu pencereyi siz de alırsınız.

**Yinelenen kimlikler ve hesaplamaya dahil edilemeyen ilişkilerle ilgili bir mesaj.** Dosyayı açtıktan sonra bir mesaj ekranda kalabilir. Mesaj *Bu dosyada yinelenen kimliğe sahip nesneler* diyorsa, her yinelenen nesne kendi kimliğini aldı ve başvurular ilk örneğe işaret eder. O zaman ilişkileri ve atamaları kontrol edin. Mesaj *ilişki(ler) hesaplamaya dahil edilemedi* diyorsa, ilişki bir özet görevde tanımlıydı ve etkisi yoktur; örneğin kendi özet görevine bağlı bir görev. Dosyanın kendisi değişmez. Bir özet görevdeki ilişkinin ne yaptığı için bkz. [İlişkiler](docs://uitleg-relaties).

**Kaydetme başarısız olabilir.** Kaydetme kendisi bir hata verirse, uygulama nedenini de yazarak *Kaydetme başarısız* mesajını gösterir. Projeniz açık kalır ve hâlâ *Kaydedilmedi* olarak işaretlidir.

## Ayrıca bakın

- [Dosyalar ve biçimler](docs://uitleg-bestanden): bir IFC dosyasında ne bulunduğu ve uygulamanın biçimleri nasıl ele aldığı.
- [Otomatik kaydetmeyi açma](docs://howto-automatisch-opslaan): uygulamanın dosyanızı kendisinin güncellemesine izin vermek.
- [IFC şemasını seçme](docs://howto-ifc-schema-kiezen): *Hangi IFC şemasında kaydedilsin?* sorusunun ne anlama geldiği.
- [Dışa aktarma](docs://howto-exporteren): başka bir biçimde bir kopya yapmak.
- [Bir çökmeden sonra kurtarma](docs://howto-herstellen-na-een-crash): uygulama düzgün kapanmadıysa ne yapacağınız.
- [İçe ve dışa aktarma biçimleri](docs://ref-import-exportformaten): her biçim için neyin aktarılıp neyin aktarılmadığı.
