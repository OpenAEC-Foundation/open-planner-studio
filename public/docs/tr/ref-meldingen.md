# Bildirimler ve uyarılar

Uygulama dört yerde ne olduğunu gösterir: alttaki durum çubuğu, sağ sütundaki *Uyarılar* paneli, ekranın altında kısa süre görünen bildirimler ve şeridin altındaki bantlar. Bu makalede her yer için ne gördüğünüzü, ne zaman göründüğünü ve ne yapabileceğinizi okursunuz. Bir planlamanın neden kritik veya aşırı atanmış olduğunu [Kritik yol ve bolluk](docs://uitleg-kritiek-pad) makalesinde bulursunuz. Aşırı atamanın nasıl çözüleceğini [Aşırı atamayı çözme](docs://howto-overbezetting-oplossen) makalesinde bulursunuz. Bir ilişkinin nasıl oluşturulacağını [İlişki oluşturma](docs://howto-relaties-leggen) makalesinde öğrenirsiniz.

## Dört öğe arasındaki fark

- **Durum çubuğu** — sayaçları gösteren sabit bir satır. Bunlar son hesaplamadan gelir ve siz yeniden hesaplayana kadar kalır.
- **Uyarılar paneli** — bu sayaçların arkasındaki liste. Son hesaplamanın bulduğu her şey burada yer alır. Bir tıklama sizi göreve, ilişkiye veya kaynağa götürür. Liste son hesaplamadan türetilir; hiçbir şey kaydedilmez.
- **Bildirimler** — az önce yaptığınız bir işle ilgili kısa mesajlar (kaydetme başarısız, ilişki reddedildi, içe aktarma okundu). Bilgi mesajları kısa süre sonra kaybolur. Hata mesajları siz kapatana kadar kalır. Bunlar panelde yer almaz.
- **Şeridin altındaki bant** — renkli bir bant, bir açıklama ve bir düğme. Bir belgenin veya bir modun durumuna aittir ve bu durum geçerli olduğu sürece kalır. Bkz. *Şeridin altındaki bantlar*.

## Durum çubuğu

Alttaki durum çubuğu soldan sağa şunları gösterir:

- **Görevler:** — yaprak görevlerin sayısı. Özet görevler sayılmaz.
- **Kilometre taşları:** — kilometre taşlarının sayısı.
- **Kritik yol: N görev, N iş günü** — kritik görevlerin sayısı ve proje süresi. Yalnızca bir hesaplamadan sonra görünür.
- **Bitiş:** — hesaplamadan gelen proje bitişi. Yalnızca bir hesaplamadan sonra görünür. Boş bir projede bitiş yoktur.
- **N son tarih kaçırıldı**, **N kısıtlama ihlal edildi**, **N ilişkide sıra dışı ilerleme** ve **N kaynak aşırı atanmış** — her biri uyarı işaretli bir düğme. Bu düğmeler yalnızca sayaç 0'ın üzerindeyse ve bir hesaplama varsa görünür. Bir tıklama *Uyarılar* panelini açar (ipucu: *Uyarılar panelini aç (ayrıntılar ve gezinme)*). *IFC* veya *Rapor* sekmesindeyseniz uygulama aynı anda *Ana sayfa* sekmesine geçer, çünkü sağ sütun orada yoktur. *kaynak aşırı atanmış* sayacı, kaynaklarda ve atamalarda yapılan değişikliklerden sonra da yenilenir. Diğer sayaçlar yalnızca *Hesapla* komutundan sonra değişir. Dört sayaç bir seçimdir. Panelin ek olarak gösterdikleri (kesilmiş öne alma, yok sayılan ilişki, bitiş driver'ı olmayan hamak, sınırlanmış bitiş tarihi, planlama hatası) durum çubuğunda yer almaz.
- **Güncel değil — yeniden hesaplayın (F5)** — bir uyarı işaretiyle (ipucu: *Plan güncel değil — yeniden hesaplayın (F5)*). Bu görünür olur, planlamayı etkileyen bir şeyi değiştirdiğinizde ve yeniden hesaplamadığınızda. *Otomatik hesapla* açıksa bu görünmez. Hesaplama bir hata verdiğinde ise görünür kalır.
- **Seçim: N görev** — seçili görevlerin sayısı. Yalnızca bir seçim varsa görünür.
- **Ölçek:** ve **Yakınlaştırma: Npx/gün** — zaman çizelgesinin zaman ölçeği ve yakınlaştırma düzeyi. Ölçek yakınlaştırmaya göre belirlenir.
- **Kaydedilmedi** — belgede dosyada olmayan değişiklikler olduğu sürece görünür.
- **AI** — AI yazısı taşıyan renkli bir nokta. Bu yalnızca AI modu açıksa görünür. İpucu metni *AI köprüsü:* ifadesini ve ardından *Kapalı*, *N portunda aktif*, *N portu kullanımda* veya *Hata* ifadelerinden birini gösterir. Bir tıklama *Yapay Zeka* sekmesini açar.
- **Hata ayıklama terminali** — bir terminal düğmesi. Yalnızca hata ayıklama terminali açıksa görünür. Terminali gösterir veya gizler (*Hata ayıklama terminalini göster* / *Hata ayıklama terminalini gizle*).

## Uyarılar paneli

- **Açma** — *Planlama › Zamanlama › Uyarılar*, *Görünüm › Paneller › Uyarılar* veya durum çubuğundaki bir sayaç. Panel sağ sütundadır, *Özellikler* ve kaynak paneli altındadır. Daralmış bir sütunu genişletir. Varsayılan olarak kapalıdır ve oturumlar arasında hatırlanmaz. Başka panellerin altındaysa yüksekliğini kenarından sürükleyerek ayarlayın. Bu yükseklik hatırlanır. Sağ üstteki çarpı paneli kapatır (*Uyarıları kapat*).
- **Başlık satırı** — *N hata, N uyarı*. Henüz hesaplama yapılmadıysa *Henüz hesaplanmadı — kontrolleri çalıştırmak için Hesapla (F5) tuşuna basın*.
- **Hesapla** — başlık satırındaki bir düğme. Planlama güncel değilse veya henüz hesaplanmadıysa görünür. Şeritteki *Hesapla* ile aynı işi yapar.
- **Başlık satırında uyarı işareti** — planlama güncel değilse görünür, ipucu *Program güncel değil — bu liste son hesaplamadan geliyor. Yeniden hesaplayın (F5)*. Liste gizlenmez. Yalnızca güncel değil olarak işaretlenir.
- **Boş liste** — *Uyarı yok. Program tüm kontrolleri geçiyor*.
- **Bir satır** — en üstte yer (görev, ilişki, kaynak veya proje), altında açıklama. Bir hata kendi sekizgen işaretine sahiptir. Bir uyarı üçgen işaretine sahiptir. Bir görev `WBS adı` olarak görünür. Bir ilişki `öncül → ardıl (FS+2d)` olarak görünür, tür ve gecikme ile birlikte. Bir tıklama yere götürür (ipucu *Git: …*), aşağıya bakın. Aktif göreviniz (ilişki için: ardılı) veya histogramda seçilen kaynak için olan satır vurgulanır.
- **Sıra** — önce hatalar. Sonra her tür için aşağıdaki listedeki sıraya göre. Bir türün içinde belgedeki sıraya göre (ilişki için ardılın, kaynak için kaynak listesinin sırası). Son hesaplamadan sonra silinen bir görev, ilişki veya kaynak listeden çıkar.

### Uyarı türleri

- **Planlama hatası** — *Planlama hesaplanamadı: …* ifadesi ve ardından nedeni. Aşağıya bakın. Bir tıklama: bir döngüde uygulama döngüdeki tüm görevleri seçer ve ilkine gider. Diğer hatalarda gidilecek bir yer yoktur. Satır bu durumda bir düğme değildir.
- **Son tarih kaçırıldı** — *Son tarih {date} kaçırıldı — erken bitiş {date}*. Görevin bir son tarihi vardır ve hesaplama bunu karşılamaz. Bir tıklama sizi göreve götürür. Düzeltmek için ilişkileri veya süreyi ayarlayın ya da son tarihi taşıyın.
- **İhlal edilen kısıt** — *{type and date} kısıtlaması mantık tarafından aşılıyor (negatif bolluk)*. Bu ihlal edilen kısıt, ilişkileri bozmadan karşılanamaz. Bolluk negatiftir. Bir tıklama sizi göreve götürür. Bkz. [Kısıtlamalar](docs://uitleg-constraints).
- **Sıra dışı** — *Sıra dışı: ardılın ilerlemesi ilişkiyle çelişiyor*. Ardılın ilerlemesi ilişki türüne uymaz. Bu, örneğin, bir bitiş-başlangıç ilişkisinde öncül henüz bitmemişken ardılın zaten devam ettiği durumdur. Bir tıklama iki görevi de seçer; ardıl aktif olur. Gerçek tarihleri veya ilişkiyi kontrol edin.
- **Öne alma kesildi** — *Öncelik proje başlangıcıyla kesildi — ilişki tam olarak uygulanmıyor*. İlişkideki öne alma (negatif gecikme) proje başlangıcından önceye uzanır. Bir tıklama iki görevi de seçer.
- **İlişki yok sayıldı** — *İlişki yok sayıldı: öncül veya ardıl eksik ya da yaprak görev değil*. Hesaplama bu ilişkiyi kullanmaz. Bir tıklama hâlâ var olan görevleri seçer. Bkz. [İlişkiler](docs://uitleg-relaties).
- **Bitiş driver'ı olmayan hamak** — *Bitiş driver'ı olmayan hamak (FF/SF öncülü yok): süresi sıfıra düşüyor*. Bir tıklama sizi göreve götürür. Bkz. [Hamak görevleri](docs://howto-hammock).
- **Bitiş tarihi sınırlandı** — *Bitiş tarihi sınırlandı: takvim bu görev için çalışılabilir bir pencere bırakmıyor*. Hesaplama, aradığı gün sayısının sınırına ulaştı. Bu, takvimde çok uzun kesintisiz tatil günleri olduğunda gerçekleşebilir. Bir tıklama sizi göreve götürür. Bkz. [Takvimler ve iş günleri](docs://uitleg-kalenders).
- **Aşırı atama** — *N gün aşırı atanmış (ilk – son)*. Tüm günler tatilse *kaynak bu günlerde takvimine göre çalışmaz* eklenir. Günler karışıksa *bunların N gününde kaynak takvimine göre çalışmaz* eklenir. Bir tıklama, o kaynağa atanmış görevleri seçer, histogramı açar ve histogramda o kaynağı seçer. *Tablo*, *IFC* veya *Rapor* sekmesinden uygulama *Kaynaklar* sekmesine geçer. Bkz. [Kaynak paneli](docs://ref-resourcepaneel).

### Planlama hatasının nedenleri

- *Görevler arasında döngüsel ilişki: {path}* — ilişkiler bir döngü oluşturur. Görevler yolda yer alır. Bir ilişkiyi tersine çevirin veya kaldırın.
- *Takvimde tanımlı iş günü yok* — takvime en az bir iş günü verin. Bkz. [Takvim pencereleri](docs://ref-kalenders).
- *'{task}' görevi için geçersiz gün cinsinden süre* ve *'{task}' görevi için geçersiz saat cinsinden süre* — görevin süresi geçerli bir sayı değil.
- *'{task}' saat görevinin takviminde geçerli çalışma saatleri yok* — saat cinsinden planlanan bir görev, çalışma saati olmayan bir takvimde.
- *'{task}' görevi için geçersiz başlangıç tarihi* — görevin başlangıç tarihi geçerli değil.

## Şeridin altındaki bantlar

Bir bant doğrudan şeridin altında, çalışma alanının üstünde durur. Bir metin ve bir düğme içerir. Bir modun bandında çarpı yoktur. Diğer bantları çarpıyla kapatırsınız. Bunlar beş bant:

- **Bağlantı modu** — *Bağlantı modu: Gantt'ta bir çubuktan diğerine sürükleyerek ilişki oluşturun. Durdurmak için Esc*. Bu bant, bağlantı modu açık olduğu sürece kalır. Düğme: *Durdur*. Bkz. [İlişki oluşturma](docs://howto-relaties-leggen).
- **Bölme modu** — *Kesintinin başladığı günde çubuğa tıklayın ve uzunluğu için sağa sürükleyin. Durdurmak için Esc*. Bu bant, *Görevi böl* açık olduğu sürece kalır. Düğme: *Durdur*.
- **Dosyadaki saat planlaması** — *Bu dosya saat bazlı planlama içeriyor*. Bu bant görünür, açılan bir dosya saat planlaması içerdiğinde ve *Saat planlamasını etkinleştir* kapalıyken. Düğme: *Saat planlamasını etkinleştir*. Bkz. [Saat planlamasını açma](docs://howto-urenplanning-aanzetten).
- **Yapı kilitli** — *Filtreleme/gruplama/sıralama sırasında kullanılamaz*. Bu bant, görevi girintileme veya girintiyi azaltma reddedildiğinde görünür. Görev tablosu filtrelenmiş, gruplanmış veya sıralanmış olduğu içindir. Düğme: *Temizle*. Bu düğme filtreyi, gruplamayı ve sıralamayı kaldırır.
- **Kayıtlı tarihler** — Bu bant, yeniden hesaplamanın tarihleri taşıdığı bir dosyayı açtıktan sonra görünür: *Yeniden hesaplama M görevden N tanesini dosyadaki tarihlerden uzaklaştırdı.* Düğme: *Kayıtlı tarihleri göster*. Bu görünüm açıkken: *Dosyada kaydedildiği gibi tarihleri görüntülüyorsunuz …* Düğme: *Yeniden hesapla*. Bkz. [Kayıtlı tarihler](docs://uitleg-datums-zoals-opgeslagen).

## Bildirimler

Bildirimler ekranın alt kısmında görünür; tabloda, Backstage'de ve sunum modunda da. Bir bildirim *hata* veya *bilgi* olur. Bir hata kırmızıdır ve çarpıya tıklayana kadar kalır. Bir bilgi 5 saniye sonra kaybolur (çok açıklama içeren bir bildirim daha uzun kalır). Bu süreler, bildirim yığını değiştiğinde yeniden başlar. Her bildirimin sağ üst köşesinde bir çarpı vardır (ipucu: *Bildirimi kapat*). Bu çarpı bildirimi hemen kapatır. Bildirimin metnine tıklamanın bir etkisi yoktur. Bir ret her zaman hatadır: uygulamanın, sizin yaptığınız bir işlemi gerçekleştirmediğini bildiren bir bildirimdir; örneğin reddedilen bir ilişki, süre, başlangıç veya kilometre taşı. Kısa bir süre başka yere baksanız da bunu kaçırmazsınız. Bir ret, Ctrl+Z veya Ctrl+Y'den sonra ve başka bir belgeye geçtiğinizde kaybolur, çünkü artık doğru değildir. Diğer bir hata, örneğin *Kaydetme başarısız*, kalır. Bu, aynı işlemin geri kalanı başarılı olsa bile geçerlidir; örneğin birden çok hücreye yapıştırırken. Birden çok görev söz konusuysa, altta bir satır hangi görevlerin değiştirilmediğini söyler; örneğin *Değiştirilmedi: Foundation, Masonry*. Beşten fazla görev varsa satır *ve N görev daha* ile biter. Bir ret tekrarlandığında tek satırda bir sayaçla toplanır. Aynı anda en fazla üç bildirim gösterilir. Dördüncü bildirim gelirse, önce en eski bilgi gider. Bilgi yoksa, önce en eski ret gider; ardından en eski kalıcı açılış bildirimi; en son da en eski hata. Bu yüzden bir bilgi veya ret, *Kaydetme başarısız* gibi bir hatayı asla itmez. Bildirim yığını, açık bir iletişim kutusunun düğmelerinden ve kalıcı işlem çubuklarından uzağa kayar. Bir dosyayı açarken uygulama veri doldurduysa, değiştirdiyse, onardıysa veya dışarıda bıraktıysa, o bildirim de çarpıya tıklayana kadar kalır. Bu, ayrıştırıcı veya takvim bulguları, sayı biçimi sorunları, enum geri dönüşleri, güvenli bir geri dönüş kullanan P6 planlama ayarları, koruyucu bir temel plan geri dönüşü, yok sayılan temel plan başvuruları, başlangıç verilen ama planlanmış başlangıcı olmayan görevler, projeler arasındaki veya proje atanmamış görevlerdeki ilişkiler (P6 XML) ya da içe aktarılmayan bir MS Project dosyasındaki bir şey (MS Project XML ve `.mpp`) veya kullanılamayan bir XER kaynak arşivi için geçerlidir. Ayrıca hesaplanmayan yinelenen kimlik ve ilişki bildirimleri de böyledir. Yalnızca bilgi içeriyorsa ve bir değişiklik yoksa (proje, belge sayısı veya metin kodlaması gibi), bildirim 5 saniye sonra kaybolur.

- **Sayaç ×N** — sabit bir anahtarı olan bir bildirim, tekrarları tek satırda bir sayaçla toplar. Bu, örneğin sürekli geri gelen bir kaydetme hatası veya tekrar ettiğiniz reddedilen bir ilişki için geçerlidir. Her bildirim bunu yapmaz.
- **Daha fazla bilgi** — bazı bildirimlerde bir *Daha fazla bilgi* bağlantısı veya kendi konusu vardır (örneğin *Görev türleri açıklaması*). Bu bağlantı, Backstage › Yardım içindeki rehbere gider.
- **Eylem düğmesi** — hesaplama profiliyle ilgili bildirimde, Proje ayarlarına giden bir *Hesaplama profilini aç* düğmesi bulunur.

Aşağıdaki liste bir seçimdir ve konuya göre gruplanmıştır. Aksi belirtilmedikçe bu bir bilgi bildirimidir.

### Kaydetme, açma ve kurtarma

- **Kaydetme başarısız** (hata) — *Kaydetme başarısız* ile birlikte altta neden yazar. Kaydederken, farklı kaydederken ve bir rapor dışa aktarırken.
- **İndirme olarak kaydedildi** (bilgi) — *İndirme olarak kaydedildi: '{name}' artık indirilenler klasörünüzde. …* *Farklı kaydet* ve dışa aktarmalarla görünür; uygulama seçtiğiniz konuma doğrudan yazamadığında. Hemen art arda gelen iki indirme tek satırda birleşir.
- **İndirme olarak kaydedildi (açıklama)** (bilgi, 15 saniye) — *İndirme olarak kaydedildi: '{name}' indirilenler klasörünüzde. Bu tarayıcı, uygulamanın kendi bir yere yazmasına izin vermez, …* *Kaydet* ile, yalnızca indirme yoluyla kaydeden bir tarayıcıda görünür. Oturum başına bir kez, dosyalar hakkındaki açıklamaya bir bağlantıyla birlikte.
- **Tarayıcı geri yazmıyor** (bilgi, 15 saniye) — *Bu tarayıcı, uygulamanın '{name}' dosyasına geri yazmasına izin vermez. …* Bir dosyası olan bir projeyi *Kaydet* ile kaydederken, tarayıcının yeniden bir yer sorması gerektiğinde. Oturum başına bir kez, dosyalar hakkındaki açıklamaya bir bağlantıyla birlikte.
- **Otomatik kaydetme başarısız** (hata) — *Otomatik kaydetme başarısız* ile birlikte neden. Dosyaya otomatik kaydetme ve çökme kurtarma için geçerlidir.
- **Kitaplık kaydedilemedi** (hata) — *Kitaplık kaydedilemedi*, kaynak kitaplığını kaydederken.
- **Dosya açılamadı** (hata) — *Dosya açılamadı* ile birlikte neden. Örneğin son kullanılan bir dosya veya içe aktarılan bir dosya için.
- **Eski veya korumalı .mpp** (hata) — *Bu .mpp dosyası eski bir biçim kullanıyor (Project 2007 veya daha eski)…* ya da *Bu .mpp dosyası parola korumalı…*. İkisinde de MS Project'te XML olarak dışa aktarıp o dosyayı açma önerisi bulunur.
- **Geçersiz XER dosyası** (hata) — *XER…* ile başlayan metinlerden biri, örneğin *Bu, geçerli veya desteklenen bir XER dosyası değil* veya *XER dosyasında yinelenen bir tablo var*. Nedeni de eklenir.
- **IFC okunamadı** (hata) — *IFC okunamadı* ile birlikte neden, IFC görünümünde.
- **Kurtarma** (hata) — *Kurtarılan dosya okunamadı*, *Geri yükleme başarısız* ve *N kurtarma dosyası yüklenemedi ve atlandı*. Beklenmedik bir kapanmadan sonra kurtarırken.
- **Dal şablon olarak kaydedildi** (bilgi) — *Dal, '{name}' şablonu olarak kaydedildi*.
- **Uzantıdan ileti** (bilgi; uzantı bir hata bildiriyorsa hata) — *{name} uzantısı: {message}*. Bir uzantı, yığını doldurmamak için 10 saniyede en fazla üç yeni ileti gösterebilir. Bir uzantının rehber adımı başarısız olursa *{name} uzantısının bir adımı başarısız oldu. Rehber devam ediyor.* yazar. Bir uzantının proje dosyası açılamazsa *{name} uzantısının {file} proje dosyası açılamadı.* yazar. İkisi de hatadır.
- **Araya giren değişiklik** (hata) — *Yapay zeka asistanı veya bir uzantı tarafından araya bir değişiklik girdi. …* Görev iletişim kutusunu iptal ettiğinizde, bu arada yapay zeka asistanı veya bir uzantı bir şey değiştirdiyse: o değişiklikten önceki görev düzenlemeleri geri alınmaz ve *Geri al* altında normal adımlar olarak kalır.

### Hesaplama

- **Planlama hesaplanamadı** (hata) — *Planlama hesaplanamadı* ile birlikte altta neden (bkz. *Planlama hatasının nedenleri*). *Hesapla* ile, belge değiştirirken ve bir dosya açarken.
- **Durum tarihi bugüne ayarlandı** (bilgi) — *Durum tarihi bugüne ayarlandı ({date})*. İlerleme girerken, durum tarihi olmayan bir projede. Uygulama ilerlemeyi durum tarihine kadar ölçer; durum tarihi olmadan ilerlemeyi işleyemez. Başka bir tarihi *Planlama › Temel plan ve ilerleme › Durum tarihi* altında ayarlarsınız. *Daha fazla bilgi* bağlantısıyla birlikte, [İlerleme, durum tarihi ve temel plan](docs://uitleg-voortgang).
- **Yapılan işten kısa süre** (hata) — *'{name}' zaten %N tamamlandı: yapılmış işten kısa bir süre olamaz. Süre değiştirilmedi*.

### İlişkiler ve hiyerarşi

- **İlişki reddedildi** (hata) — *Bu ilişki zaten var*, *Bir görev ile kendi üst özet görevi arasında ilişki kurulmasına izin verilmez* veya *Bu ilişki programda bir döngü oluşturur ({cycle}); ilişki oluşturulmadı*. Döngü, görevleri adlandırır; böylece önce hangi ilişkiyi kaldıracağınızı veya tersine çevireceğinizi bilirsiniz.
- **Taşıma reddedildi** (hata) — *Bu taşıma programda bir döngü oluşturur ({cycle}): bir özet görevin ilişkileri alt görevleri için de geçerlidir. Hiçbir şey taşınmadı*.
- **Taşımadan sonra ilişkiler düşer** (bilgi) — *Taşımadan sonra N ilişki bir görevi kendi üst özet görevine bağlıyor; artık hesaplamaya dahil edilmiyor*.
- **Eklemede ilişkiler atlanır** (hata) — *N ilişki oluşturulmadı: geçersiz bağlantı…*, bir dal yapıştırırken veya eklerken. Altta hangi ilişkilerin olduğunu söyleyen bir satır, örneğin *Oluşturulmadı: Foundation → Masonry*.
- **İlişkiler içe aktarımdan sonra sayılmaz** (bilgi) — *N ilişki hesaplamaya dahil edilemedi. Öncüller ve Ardıllar sütunlarını kontrol edin*.
- **İçe aktarımdan sonra yinelenen kimlikler** (bilgi) — *Bu dosyada yinelenen kimliğe sahip nesneler: N. Bunlara kendi kimlikleri verildi…*

### Görevleri düzenleme

- **Başlangıç kısıtlama olarak kaydedilir** (bilgi) — *'{name}' {date} tarihinden önce başlamaz (SNET)*. Öncülü olan bir görevin başlangıcını değiştirdiğinizde. Öncül başlangıcı belirler; bu yüzden uygulama tarihinizi bir kısıtlama olarak kaydeder: *şu tarihten önce başlamaz (SNET)*. Yeniden hesaplamadan (F5) sonra görev bu tarihten önce başlamaz. Görevin zaten böyle bir kısıtlaması varsa, *'{name}' artık {date} tarihinden önce başlamaz (SNET)* yazar. Birden çok görev için aynı anda bir sayı gösterir. *Daha fazla bilgi* bağlantısıyla birlikte, [Kısıtlamalar ve son tarihler](docs://uitleg-constraints).
- **Başlangıç uygulanmadı** (hata) — *'{name}' için yeni başlangıç uygulanmadı: görevin bir öncülü ve {type} {date} kısıtlaması var; başlangıcını bunlar belirler. Başlangıcı taşımak için bu kısıtlamayı değiştirin*.
- **Kilometre taşı reddedildi** (hata) — *'{task}' kaynak atamalarına sahip ve kilometre taşı olamaz. Önce atamaları kaldırın* veya *'{task}' alt görevleri olan bir özet görevdir ve kilometre taşı olamaz*. Görev iletişim kutusunda, özellikler panelinde, bağlam menüsünde ve tabloda dönüştürürken.
- **Atamalar alt göreve taşındı** (bilgi) — *Atama '{child}' alt görevine taşındı* veya *N atama '{child}' alt görevine taşındı*. Bir uzantı, atamaları olan bir göreve alt görevler verdiğinde. Bu görev bir özet göreve dönüşür; bir özet görev kendi başına atama taşımaz. Bu yüzden atamalar ilk yeni alt göreve taşınır. Uygulamanın kendisinde bunu *Görev özet göreve dönüşür* penceresinde seçersiniz; orada bu bildirim görünmez. Bir [Yapıyı ayarlama](docs://howto-structuur-aanpassen) bağlantısıyla.
- **Kilometre taşı işareti kaldırıldı** (bilgi) — *'{phase}' artık kilometre taşı değil*. Bir kilometre taşına alt görevler eklendiğinde. Kilometre taşı alt görevsiz bir andır; alt görevlerle birlikte bir özet göreve dönüşür. Bir [Yapıyı ayarlama](docs://howto-structuur-aanpassen) bağlantısıyla.
- **Soru güncel değil** (hata) — *Görevler veya atamalar, soru açıkken değişti. Hiçbir şey değiştirilmedi; lütfen yeniden deneyin*. *Görev özet göreve dönüşür* penceresinde bir seçim yaptığınızda, ama soru artık uymadığında.
- **Özet görev reddedildi** (hata) — *'{phase}' özet görev olamaz: …*, nedeni ile birlikte, ve *Hiçbir şey değiştirilmedi.* Bir uzantı, atamaları olan bir göreve alt görevler verdiğinde ve atamalar ilk yeni alt göreve taşınamadığında. Uygulamanın kendisinde bu ileti görünmez: orada *Görev özet göreve dönüşür* penceresi ne yapılacağını sorar ve *Taşı* o durumda devre dışıdır.
- **Yapıştırmada hücreler atlandı** (hata) — *N hücre atlandı: salt okunur (örneğin otomatik numaralandırılmış bir WBS kodu veya hesaplanan bir sütun)*.
- **Yapıştırmada başvurular temizlendi** (bilgi) — *N başvuru bu belgede yoktu ve temizlendi (kaynak belgeden görev takvimleri, özel iş kategorileri, etkinlik kodları veya özel alanlar)*.
- **Yapı kilitli** (hata, şeridin altında kırmızı bir çubuk) — *Filtreleme/gruplama/sıralama sırasında kullanılamaz*, *Temizle* düğmesiyle. Liste filtrelenmiş, gruplanmış veya sıralanmışken: girintilemek, girintiyi azaltmak ve sürüklemekte; *Üste ekle* ve *Alta ekle* ile (sağ tık menüsü veya kısayol). Çubuk, çarpıya tıklayana, Ctrl+Z veya Ctrl+Y kullanana ya da başka bir belgeye geçene kadar kalır. Bkz. [Yapıyı ayarlama](docs://howto-structuur-aanpassen).
- **Görev sona eklendi** (hata) — *Yeni görev en sona eklendi. Filtreleme, gruplama veya sıralama sırasında uygulama onu seçiminizin altına yerleştiremez*. *Temizle* düğmesiyle. *Görev* ve *Kilometre taşı ▾* ile, bir görev seçiliyken ve liste filtrelenmiş, gruplanmış veya sıralanmışken. Görev yine eklenir, ama en altta. *Temizle*, filtreyi, gruplamayı ve sıralamayı kaldırır ve bildirimi kapatır. Bkz. [Görev ve kilometre taşı ekleme](docs://howto-taken-en-mijlpalen-toevoegen).
- **Görev türü süreleri ayarladı** (bilgi) — *Takvim değişikliğinden sonra görev türü N görev için süreyi ayarladı (iş aynı kaldı, günlük saatler değişti)*. Bir *Görev türleri açıklaması* bağlantısıyla.

### Primavera P6 XML

- **P6 XML dosyası açıldı** (bilgi) — *P6 XML dosyası açıldı: N proje belgesi*. P6 XML dosyası açıldıktan sonra.
- **İçe aktarılmadı** (kalır) — *Projeler arasındaki N ilişki, planda ilişki olarak aktarılmadı* ve *Projesi olmayan N görev okunmadı*. Planlamanızın eksiksiz olup olmadığını kontrol edin.
- **Boş veya kullanılamaz** (hata) — hiçbir şey açılmaz. Üç neden var: *Bu dosyada uygulamanın okuyabileceği görev yok.*, *Görevlerin ObjectId'si yok. …* ve *Dosya XER sütun adlarını kullanıyor … Doğrudan .xer dosyasını açın.*

### Primavera (XER)

- **XER dosyası açıldı** (bilgi) — *XER dosyası açıldı: N proje belgesi*. Dosya birden çok proje açsa bile dosya başına bir bildirim; altında bir *Daha fazla bilgi* bağlantısı ve ayrıntı satırları. Her zaman: *N proje bulundu*. Yalnızca sayı 0'dan büyükse: *N boş proje atlandı*, *N temel proje dışarıda bırakıldı*, *N temel plan oluşturuldu*, *N boşta kalan temel plan başvurusu yok sayıldı*, *Koruyucu temel plan geri dönüşü kullanıldı* ve *N dış ilişki korundu*. Yalnızca UTF-8 dışında bir kodlama için: *Metin kodlaması seçildi: {encoding}*. Ayrıca sayı 0'dan büyükse: *N ayrıştırıcı bulgusu*, *N takvim bulgusu*, *N sayı biçimi sorunu*, *N enum geri dönüşü* ve *N P6 planlama ayarı güvenli geri dönüş kullandı*.
- **Primavera'nın kaydettiği tarihler** (ayrıntı satırı, aynı bildirimde) — *N görev, Primavera'nın kaydettiği tarihleri gösteriyor (yeniden hesaplanmadı)*. N, dosyanın tarih kaydettiği her görevi sayar; farklı olmayanlar da dahil. Ya da mod açılmadıysa: *N görev, dosyadaki tarihlerden farklı; bunları gösterebilirsiniz*.
- **XER kaynak arşivi kullanılamaz** (bilgi) — *Bu dosyadaki XER kaynak arşivi kullanılamaz durumda ve dışarıda bırakıldı; projenin kendisi eksiksiz açıldı*, nedeni (örneğin *Neden: sağlama toplamı kaynak baytlarıyla eşleşmiyor — arşiv hasarlı*) ve sonucu (*Planlama, hesaplama profili ve IFC'deki tüm proje verileri eksiksizdir. …*) ile birlikte. Önceden kaydedilmiş bir XER kaynak arşivinin kullanılamadığı bir IFC dosyasını açtığınızda. Ayrıca beklenmedik bir kapanmadan sonra geri yüklerken, kurtarma deposu artık kaynak arşivi içermiyorsa.
- **XER bilgisi dışa aktarmada kaybolur** (bilgi) — *{format} biçimine dışa aktarma XER kaynak bilgilerini kaybeder*. Bir XER dosyasında yalnızca var olan verileri içeren bir projeyi IFC dışındaki bir biçime başarıyla dışa aktardıktan sonra. *Daha fazla bilgi* bağlantısıyla.

### İçe aktarma, dışa aktarma ve hesaplama profili

- **Dosyadaki tarihler** (bilgi) — *N görev, dosyada kayıtlı tarihleri gösteriyor (yeniden hesaplanmadı)* (N, kayıtlı tarihi olan her görevi sayar) veya *N görev, dosyadaki tarihlerden farklı; bunları gösterebilirsiniz*. Kayıtlı tarihleri olan bir dosyayı açtığınızda.
- **İş ve görev türleri görünür** (bilgi) — *Bu dosya kayıtlı iş veya görev türü içeriyor; görev türü ve kalan iş bu proje için görünür*.
- **MS Project planlaması okundu** (bilgi) — *Bu MS Project dosyası, bölünmüş, dengelenmiş veya kaynak odaklı planlanmış N görev içeriyor. Böyle içe aktarılır ve gösterilir*.
- **Molalar dışa aktarılmadı** (bilgi) — *Kesintili N görev kesintileri olmadan dışa aktarıldı: MS Project/P6 bunları yalnızca iş dağılımı olarak tanır*. MS Project veya Primavera'ya dışa aktarırken.
- **Proje başlangıcı kaydırıldı** (bilgi) — *N görev proje başlangıcıyla birlikte kaydırıldı*. Proje başlangıcını daha sonraya aldığınızda. Yalnızca öncülü olmayan ve yeni başlangıç tarihinden önce kalacak bir kısıtlaması bulunmayan görevler o tarihe kayar. *Daha fazla bilgi* bağlantısıyla birlikte, [Yeni proje ve Proje Bilgileri](docs://ref-projectinfo).
- **Tarih penceresi artık yönlendirmiyor** (bilgi) — *MS Project'in tarih penceresi bu düzenlemeden sonra N görevi artık yönlendirmiyor; …* Belge başına bir kez.
- **Dengeleme gecikmesi yuvarlandı** (bilgi) — *Kaynak dengeleme, MS Project'ten gelen dakika hassasiyetindeki dengeleme gecikmesini N görev için tam iş gününe yuvarlar*. Belge başına bir kez.
- **Hesaplama profili uygulandı** (bilgi) — *Bu proje {profile} olarak hesaplanıyor. Değiştirmek için “Dosya” → “Proje Bilgileri” → “Hesaplama profili ve seçenekleri” yolunu izleyin*. Bir *Hesaplama profilini aç* düğmesiyle. Bir profil uygulandıktan sonra, gerekirse *Uygulamadan sonra N görev kaydı* ardından gelir.
