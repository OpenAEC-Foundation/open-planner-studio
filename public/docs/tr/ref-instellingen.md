# Uygulama ayarları

Uygulamanın her ayarı: ne yaptığı, başlangıç değeri, neyin değiştiği ve onu nerede bulacağınız. Projenin hesaplama seçenekleri (hesaplama profili, kritik tanım) için bkz. [Hesaplama seçenekleri ve kurallar](docs://ref-rekenopties-en-conventies). Bunlar uygulamaya değil, proje dosyasına aittir.

## Nerede bulunurlar ve nasıl çalışırlar

Ayarlar paneli üç yerde bulunur ve her yerde aynı paneldir: pencerenin üstündeki dişli simge, *Ayarlar › Proje › Uygulama ayarları* ve *Dosya › Uygulama ayarları*. Panelde üç sekme vardır: *Görünüm*, *Planlama* ve *Gelişmiş*. Aşağıdaki her ayar yalnızca sekmesini adlandırır.

Bir değişiklik hemen geçerli olur. *Uygula* düğmesi yoktur ve *İptal* düğmesi yoktur.

**Uygulama genelinde, proje başına değil.** Bu makaledeki tüm ayarlar tüm projelerinizde geçerlidir ve bu cihaza aittir. Uygulama ayarları proje dosyasında değil, uygulamanın veya tarayıcınızın depolama alanında tutar. Dosyanızı açan başka biri kendi ayarlarını görür. Depolama alanını temizlediğiniz bir tarayıcı, başlangıç değerleriyle yeniden başlar.

## Görünüm sekmesi

**Tema** — arayüzün renk şeması. *Koyu*, *Açık* ve *Yüksek Kontrast* arasından seçin. Varsayılan: *Koyu*. Etki: Gantt ve histogram dahil arayüzün tüm renkleri. Yer: *Görünüm*.

**Sistem temasını izle** — işletim sisteminizin renk şemasının karar vermesine izin verir. Varsayılan: kapalı. Etki: uygulama sisteminize göre *Açık* veya *Koyu* olur; bu durumda üç tema kartı devre dışıdır. *Yüksek Kontrast* sistemi izlemez: bunu kendiniz seçersiniz. Bu ayarı kapatırsanız, o an ekranda olan tema kalır. Yer: *Görünüm*, altında *Tema*.

**Dil** — arayüzün dili. Varsayılan: tarayıcınızın veya sisteminizin dili, uygulama bu dili destekliyorsa; desteklemiyorsa İngilizce. Etki: uygulamadaki tüm metinler; diller kısa kodlarına göre sıralanır. Arapça ve Farsça arayüzü sağdan sola yansıtır. Yardım makalelerinin dilini ayrıca ayarlarsınız: *Dosya › Yardım* içinde, *Belge dili* altında. Yer: *Görünüm*.

**Yazı tipi** — arayüzün tüm yazı tipi. *Varsayılan*, *Sistem*, *Serif* ve *Monospace* arasından seçin. Varsayılan: *Varsayılan*. Etki: pencerenin başlıkları ve metinleri, ayrıca Gantt ve histogramdaki metin. Bir web uygulaması sistem yazı tipini kendiliğinden izlemez; bu yüzden burada seçersiniz. Yer: *Görünüm*.

**Metin boyutu** — arayüzün ölçeği. %90, %100, %110 ve %125 arasından seçin. Varsayılan: %100. Etki: şeridin, panellerin ve iletişim kutularının metni ve düzeni büyür veya küçülür; tablonun ve Gantt'ın satır yüksekliği de birlikte ölçeklenir. %125'in üzerinde seçenek yoktur, çünkü o zaman şeridin düğme etiketleri birkaç satıra bölünür. Yer: *Görünüm*.

**Tarih biçimi** — tarihlerin uygulamada nasıl görüneceği. *gg-aa-yyyy*, *aa-gg-yyyy* ve *yyyy-aa-gg* arasından seçin. Varsayılan: *gg-aa-yyyy*. Etki: tablodaki, iletişim kutularındaki, raporlardaki ve yazdırmadaki tarihler. Dosyalar ve hesaplamalar değişmez; yalnızca görüntü değişir. Yer: *Görünüm*.

**Saat biçimi** — saatlerin uygulamada nasıl görüneceği. *24 saat (13:00)* ve *12 saat (1:00 PM)* arasından seçin. Varsayılan: *24 saat (13:00)*. Etki: takvim penceresindeki saatler, saat cinsinden görevlerin tarih ve saati (tablo, bölmeler, mesajlar) ve Gantt'taki *Saat* zaman ölçeği. Bir saat alanına iki biçimin herhangi birinde yazabilirsiniz: *13:00*, *1300*, *13*, *1:00 PM* veya *1 pm*. Günün sonu olarak gece yarısı *24:00* veya *12:00 AM* olur. Dosyalar ve hesaplamalar değişmez: 24 saat biçiminde kalırlar. Yer: *Görünüm*.

**Süre gösterimi** — bir görevin süresinin hangi birimde gösterileceği. *Otomatik (göreve özgü birim)*, *Her zaman gün* ve *Her zaman saat* arasından seçin. Varsayılan: *Otomatik (göreve özgü birim)*. Etki: görev tablosunda, Gantt çubuklarının etiketlerinde, ipucunda, yazdırmada ve raporlarda. *Otomatik* seçiliyken gün görevi günleri, saat görevi saatleri gösterir. *Her zaman gün* veya *Her zaman saat* seçiliyken uygulama, görevin takviminin günlük saat sayısını kullanarak dönüştürür. Görevin birimi farklıysa, uygulama kendi birimini parantez içinde ekler, örneğin `2.25d(18h)`. Yalnızca gösterim değişir; görev kendi birimini korur. Yer: *Görünüm*.

**Belge geçiş stili** — açık projeler arasında nasıl geçiş yaptığınız. *Yatay sekmeler*, *Dikey sekmeler* ve *Hap* arasından seçin. Varsayılan: *Yatay sekmeler*. Etki: *Yatay sekmeler* şeridin altında bir sekme çubuğu gösterir; *Dikey sekmeler* solda bir proje çubuğu; *Hap* başlık çubuğunda küçük bir proje düğmesi. Yer: *Görünüm*.

### Gantt bölümü

**Yalnızca iş günlerini göster** — zaman eksenini sıkıştırır. Varsayılan: kapalı. Etki: proje takvimindeki hafta sonları ve tatiller atlanır. Böylece 5 iş günü süren bir görev tam olarak 5 gün genişliğinde olur. Bu durumda *Bugüne git* ve *Projeye sığdır* kısayolları da iş günlerini sayar. Raporun aynı adlı kendi onay kutusu vardır; bu ayardan bağımsızdır. Yer: *Görünüm*, altında *Gantt › Zaman ekseni*.

**Çok yakınlaştırıldığında çeyrek saatleri göster** — ek bir ince zaman ölçeği. Varsayılan: kapalı. Etki: daha fazla yakınlaştırabilirsiniz ve saat ölçeğine bir çeyrek saat satırı eklenir. Bir saat çubuğunu sürüklerken, tam saatler yerine çeyrek saatlere oturabilir. Bunu yalnızca *Saat planlamasını etkinleştir* açıkken görürsünüz. Yer: *Görünüm*, altında *Gantt › Çeyrek saat yakınlaştırma*.

**Kesinti olduğunda görev çubukları** — bir saat görevinin çubuğunun nasıl çizileceği. *Asla bölme*, *Seçildiğinde böl* ve *Her zaman böl* arasından seçin. Varsayılan: *Seçildiğinde böl*. Etki: bir saat görevinin çubuğu, tek bir kesintisiz çubuk yerine her çalışma bandı için ayrı çizilir. *Seçildiğinde böl* bunu yalnızca seçili görev için yapar. Bu ayar yalnızca saat görevlerini ilgilendirir. Gerçekten bölünmüş bir görev (*Görevi böl* ile), bu ayardan bağımsız olarak kesintiyi gösterir. Yer: *Görünüm*, altında *Gantt*.

**Kaydırma ve yakınlaştırma › Mod** — Gantt üzerinde kaydırma tekerleğinin ne yaptığı. *Konum*, *Tuşlar* ve *Yakınlaştır + sürükle* arasından seçin. Varsayılan: *Yakınlaştır + sürükle*. Etki: *Yakınlaştır + sürükle* seçiliyken tekerlek imlecin etrafında yakınlaştırır; Shift+tekerlek satırlar arasında kaydırır; zaman çizelgesini arka planı sürükleyerek kaydırırsınız; Ctrl+sürükleme (Mac'te Cmd+sürükleme) bir seçim kutusu çizer. *Konum* seçiliyken tekerleğin işlevi imlecin nerede olduğuna bağlıdır; Ctrl+tekerlek her zaman yakınlaştırır ve Shift+tekerlek her zaman yatay kaydırır. *Tuşlar* seçiliyken hangi tuşun ne yaptığını kendiniz seçersiniz. Bu seçim, bölünmüş görünümün ikinci zaman çizelgesi için de geçerlidir. Yer: *Görünüm*, altında *Gantt › Kaydırma ve yakınlaştırma*.

**Kaydırma ve yakınlaştırma › Ekran bölümü** — imlecin hangi işlev için nerede olduğu. Yalnızca *Konum* modunda görünür. *Sol/sağ*, *Üst/alt* ve *Sağ üst köşe* arasından seçin. Varsayılan: *Sol/sağ*. Etki: *Sol/sağ* seçiliyken tekerlek sol yarıda dikey, sağ yarıda yatay kaydırır. *Üst/alt* seçiliyken tekerlek üstteki %30'da (zaman ölçeğinin yakınında) yatay, altında dikey kaydırır. *Sağ üst köşe* seçiliyken tekerlek sağ üst çeyrekte yatay, kalan alanda dikey kaydırır. Yer: *Görünüm*, altında *Gantt › Kaydırma ve yakınlaştırma*.

**Kaydırma ve yakınlaştırma › Dikey, Yatay, Yakınlaştırma** — hangi tuşun hangi tekerlek işlevine ait olduğu. Yalnızca *Tuşlar* modunda görünür. Her işlev için *Kaydırma*, *Ctrl + kaydırma* veya *Shift + kaydırma* seçersiniz. Varsayılan: *Dikey* için *Kaydırma*, *Yakınlaştırma* için *Ctrl + kaydırma* ve *Yatay* için *Shift + kaydırma*. Etki: zaten kullanılan bir tuşu seçerseniz, bu tuş o işlevle yer değiştirir. Yer: *Görünüm*, altında *Gantt › Kaydırma ve yakınlaştırma*.

## Planlama sekmesi

**İnşaat modunu etkinleştir** — yeni projeler için inşaata yönelik başlangıç değerleri. Varsayılan: açık. Etki: açıkken yeni proje *Bouwkalender NL* takvimini alır; bu takvimde Hollanda resmi tatilleri vardır ve tatilleri oluştururken bir inşaat tatili seçebilirsiniz. Şablonlar *Konut inşaatı* ve *Ticari yapı / yenileme* sunulur ve yeni görevler *İnşaat* iş kategorisini alır. Kapalıyken takvim *Standaardkalender* olur (tatil yok), yalnızca *Boş* şablonu ve *Diğer* iş kategorisi kullanılır. İş kategorisine sahip bir üst görevin altındaki yeni görev, önce o iş kategorisini alır; *İnşaat* veya *Diğer* bundan sonra uygulanır. Mevcut görevler ve takvimler değişmez. Yer: *Planlama*.

**Saat planlamasını etkinleştir** — iş günlerinin yanında saat cinsinden planlama. Varsayılan: kapalı. Etki: *Görünüm › Zaman ölçeği* altında *Saat* zaman ölçeği görünür; *Takvimler* penceresinde sıradan bir takvim çalışma saati bantları alabilir (*Çalışma saatleri* bölümü; zaten bant içeren bir takvim bu bölümü her zaman gösterir); *Yeni proje* penceresinde *Vardiya* ve *Yeni görevler için varsayılan birim* seçenekleri çıkar. *Proje ayarları* de *Yeni görevler için varsayılan birim* seçeneğini alır. Kapalıyken uygulama gün bazında çalışır. Zaten saat cinsinden olan görevler yerinde kalır ve hesaplamaya dahil edilir; süresini yalnızca saat planlamasını açtıktan sonra düzenleyebilirsiniz. Yer: *Planlama*, altında *Saat planlaması*. Bkz. [Saat planlamasını açma](docs://howto-urenplanning-aanzetten).

**Gün ve saat karışık planlamasına izin ver** — görev başına birimi seçip seçmeyeceğiniz. Yalnızca *Saat planlamasını etkinleştir* açıkken görünür. Varsayılan: açık. Etki: açıkken her görevin süresinin yanında *Süre birimi* açılır listesi görünür. Kapalıyken bu liste gizlenir. Yer: *Planlama*, altında *Saat planlaması*. Bkz. [Günler ve saatler](docs://uitleg-dagen-en-uren).

**Hafta şu gün başlar** — haftanın ilk günü. *Pazartesi* ve *Pazar* arasından seçin. Varsayılan: *Pazartesi*. Etki: Gantt'taki ve raporlardaki zaman ölçeğinin hafta düzeni ve hafta numaraları (Gantt-diagramının yazdırılması) ile *Takvimler* penceresinde haftanın günlerinin sırası. Yer: *Planlama*.

**Otomatik hesapla** — planlama güncel olmadığı anda yeniden hesaplanır. Varsayılan: kapalı. Etki: kapalıyken *Hesapla* (F5) tuşuna kendiniz basarsınız. Açıkken, görevlerde, ilişkilerde veya takvimde bir değişiklikten sonra planlama saniyenin bir kesri içinde yeniden hesaplanır. Bir sürükleme hareketi sırasında veya bir alana yazarken uygulama bekler ve siz bittiğinizde bir kez hesaplar. Başarısız bir hesaplamadan sonra uygulama, yalnızca siz bir şey değiştirdiğinizde tekrar hesaplar. Yer: *Planlama*, altında *Hesaplama*.

**Görev türlerini kullanın** — görev türü ve iş alanları uygulamada. Varsayılan: kapalı. Etki: açıkken bir görevde *Görev türü* alanı ve atamalar için iş sütunu görünür; ayrıca *Görev türü* tablo sütunu olarak kullanılabilir olur. Kapalıyken bunları gizler; süre ve birimler kalır ve iş bunları izler. Görev türü veya iş verisi zaten içeren bir proje, örneğin `.mpp` veya `.xer` dosyasından, ayar kapalı olsa bile bunları her zaman gösterir. Yer: *Planlama*, altında *Hesaplama*. Bkz. [Görev türleri: süre, birimler ve iş](docs://uitleg-werkregels).

## Gelişmiş sekmesi

**Şunu açtıktan sonra açıklama göster** — her biçim için bir onay kutusu: *Primavera dosyası (.xer)*, *MS Project dosyası (.mpp)*, *MS Project XML*, *Primavera P6 XML* ve *CSV dosyası*. Varsayılan: hepsi açık. Etki: açıkken böyle bir dosyayı açtıktan sonra biçim hakkında kısa bir açıklama içeren bir pencere gösterilir: uygulamanın neyi aldığı, neyi almadığı ve kaydetmenin ve geri yazmanın nasıl çalıştığı. Bu pencerede *Bunu bir daha gösterme …* seçeneği buradaki onay kutusunu temizler; burada onu yeniden açarsınız. Bir IFC dosyası, bir örnek ve bir yapay zeka asistanının veya bir uzantının açtığı bir proje bu açıklamayı hiç almaz. Yer: *Gelişmiş*, altında *Şunu açtıktan sonra açıklama göster*. Bkz. [Dosya açma ve kaydetme](docs://howto-bestand-openen-en-opslaan).

**Yapay zeka modunu etkinleştir** — bir yapay zeka asistanı planlamanızla çalışabilir. Varsayılan: kapalı. Etki: açıkken MCP-köprüsünü içeren *Yapay Zeka* sekmesi görünür; böylece bir yapay zeka asistanı Model Context Protocol üzerinden planlamanızla çalışabilir. Kapalıyken sekme gizlenir ve köprü durur. Yer: *Gelişmiş*, altında *Yapay zeka modu*. Bkz. [Yapay zeka asistanını bağlama (MCP)](docs://howto-ai-assistent-koppelen).

**MCP-köprüsünü otomatik başlat** — uygulama başladığında MCP-köprüsünü başlatır. Yalnızca *Yapay zeka modunu etkinleştir* açıkken açılabilir. Varsayılan: kapalı. Etki: köprü hemen etkindir, böylece bir yapay zeka istemcisi siz önce *Yapay Zeka* sekmesini açmadan bağlanabilir. Bu yalnızca masaüstü uygulamasında çalışır ve her başlatmada bir kez. Köprüyü sonradan kendiniz kapatırsanız, yeniden başlamaz. Yer: *Gelişmiş*, altında *Yapay zeka modu*.

**Hata ayıklama terminalini etkinleştir** — sorun giderme için bir günlük paneli. Varsayılan: kapalı. Etki: açıkken durum çubuğunda bir terminal düğmesi çıkar; bu düğme günlük panelini gösterir veya gizler. Kapalıyken panel kapanır. Yer: *Gelişmiş*, altında *Hata ayıklama terminali*.

**Kıyaslama…** — planlama motorunun performansını ölçer. Etki: seçtiğiniz boyutta bir test planlaması oluşturup temel aşamaları ölçen bir pencere açılır. Açık projeniz değişmez. Bu bir düğmedir, bir ayar değil: hatırlanacak bir şey yoktur. Yer: *Gelişmiş*, altında *Kıyaslama*.

**İstatistikler…** — uygulamanın kaç kez indirildiği. Etki: *İndirme istatistikleri* penceresini açar; GitHub Releases'teki genel rakamlar gösterilir. Sizden hiçbir veri toplanmaz. Bu bir düğmedir, bir ayar değil. Yer: *Gelişmiş*, altında *İstatistikler*. Pencerede:

- *İşletim sistemine göre indirmeler* — her sistem için *İndirme*, *Yükleyiciler* (bir kişinin indirdiği) ve *Güncellemeler* (uygulamadaki güncelleyicinin getirdiği) sütunları, altında bir *Toplam*. Linux'ta ikisi ayrılamaz: güncelleyici, insanların elle de indirdiği aynı `.deb`, `.rpm` veya `.AppImage` dosyasını alır. Bu yüzden orada yalnızca snap dosyası yükleyici olarak sayılır. Altında *Uygulamadan güncelleme denetimleri*: kurulu bir uygulamanın güncelleyicisinin yeni bir sürüm aramak için GitHub'dan sürüm dosyasını kaç kez çektiği. Bunlar denetimdir, yükleme değil.
- *Sürüme göre* — aynı indirmeler sürüm başına, tarihiyle birlikte; önce en yeni altı sürüm, kalanı için *… sürümün tümünü göster*.
- *Kaynak* — rakamların tarihi (GitHub Releases, haftalık güncellenir) ve *Şimdi yenile*. Uygulama alınan rakamları yarım saat saklar. Alma başarısız olursa pencere bunu bildirir. Snap Store üzerinden yapılan yüklemeler GitHub'dan geçmez ve eksiktir.

**Turu başlat** — tanıtım turunu yeniden başlatır. Etki: *Uygulama ayarları* penceresini kapatır ve turu ilk adımdan başlatır. Yer: *Gelişmiş*, altında *Tur*.

**Sürüm** — uygulamanın sürüm numarası, iki düğmeyle. *Güncellemeleri denetle* güncelleme penceresini açar. *Yenilikler* geçerli sürümün haberlerini gösterir. Yer: *Gelişmiş*, altında *Sürüm*.

**Klasik görünüm düğmelerini göster** — artık yerine geçmiş bir özellik, *Eski özellikler* altında. Varsayılan: kapalı. Etki: açıkken *Görünüm* sekmesine bir *Görüntüleme* grubu geri gelir; bu grupta ayrı *Sütunlar…*, *Filtre…*, *Grupla…* ve *Sırala…* düğmeleri bulunur. Bunların yerini tablo başlığındaki artı işareti, düzen düğmeleri ve düzen penceresi aldı. Yer: *Gelişmiş*, altında *Eski özellikler*.

## Panel dışında hatırlanan görüntüleme seçimleri

Uygulama bu seçimleri ayrıca bu cihazda saklar, ancak bunları ayarlar panelinde değil, öğenin kendisinde belirlersiniz.

**Temel plan bindirmesi** — etkin temel planı, görev çubuğunun altında ince bir çubuk olarak gösterir. Varsayılan: açık. Yer: *Görünüm › Temel plan ve ilerleme › Temel plan bindirmesi*.

**İlerleme çizgisi** — durum tarihinde ilerlemenin zikzak çizgisi. Varsayılan: açık. Etki: çizgi yalnızca projenin bir durum tarihi olduğunda görünür; bu durumda ayrı *Durum tarihi çizgisi* yerine geçer. Yer: *Görünüm › Temel plan ve ilerleme › İlerleme çizgisi*.

**Durum tarihi çizgisi** — durum tarihinde noktalı bir çizgi. Varsayılan: açık. Etki: *İlerleme çizgisi* açıksa, bu çizgi işaretlemeyi kendisi çizer. Yer: *Görünüm › Temel plan ve ilerleme › Durum tarihi çizgisi*.

**Kaynak vurgusu** — görev çubuğunun altında, kaynağın renginde ince bir çizgi. Varsayılan: kapalı. Yer: *Görünüm › Temel plan ve ilerleme › Kaynak vurgusu*.

**Bolluk bandı** — kritik olmayan çubukların arkasında bir bant olarak gösterilen bolluk; tamamlanmış görevler için değil. Varsayılan: açık. Yer: *Görünüm › Temel plan ve ilerleme › Bolluk bandı*.

**Çubuk renkleri** — bir çubuğun renginin neye bağlı olduğu. Şunlardan birini seçin: *Kritik yol*, *Görev başına — otomatik* veya *Kategoriye göre*. Varsayılan: *Kritik yol*. Etki: renk hem Gantt'ta hem de raporda aynı anda uygulanır. Yer: *Görünüm › Temel plan ve ilerleme › Çubuk renkleri*.

**Histogram** — Gantt'ın altındaki histogram alanı. Varsayılan: kapalı. Yer: *Kaynaklar › Histogram › Histogram*, *Görünüm › Paneller › Histogram* veya Ctrl+Shift+H. Alanın yüksekliğini kenarını sürükleyerek belirlersiniz (varsayılan 160 piksel, 80 ile 480 arasında).

**Mini harita** — zaman çizelgesinin genel bir haritası. Varsayılan: kapalı. Yer: *Görünüm › Sunum › Mini harita*.

**Şeridin daraltılması** — kompakt bir şerit. Varsayılan: kapalı. Yer: şeridin sağ alt köşesindeki ok düğmesi.

**Görev tablosunun genişliği** — varsayılan 350 piksel, 150 ile 800 arasında. Bunu tablonun yanındaki ayırıcıyı sürükleyerek belirlersiniz. Ayırıcı odaktayken sol ok ve sağ ok tuşlarıyla da belirleyebilirsiniz.

**Sağ panelin genişliği** — varsayılan 280 piksel, 200 ile 900 arasında. Bunu panelin kenarını sürükleyerek belirlersiniz.

**Sağ paneldeki *Özellikler* ve *Uyarılar* yüksekliği** — varsayılan 240 ve 220 piksel, 120 ile 2000 arasında. *Özellikler* kaynak listesi açıkken de bu yüksekliği korur. Yüksekliği bölümler arasındaki tutamağı sürükleyerek belirlersiniz. Uygulama bölümlerin açık mı kapalı mı olduğunu hatırlamaz.

**Ayrıca hatırlanır, başka yerde anlatılır** — uygulama bu öğeleri ayrıca bu cihazda saklar, proje dosyasında değil: tablonun sütunları ([Tablo sütunlarını ayarlama](docs://howto-tabelkolommen-aanpassen)), düzenleriniz ([Düzen oluşturma ve kullanma](docs://howto-layouts-gebruiken)), rapor seçenekleri ([Rapor türleri](docs://ref-rapporttypes)), kendi hesaplama profili şablonlarınız ([Hesaplama seçenekleri ve kurallar](docs://ref-rekenopties-en-conventies)) ve *Yardım* içindeki *Belge dili* (*Dosya › Yardım*).

## Ayrıca bakın

- [Hesaplama seçenekleri ve kurallar](docs://ref-rekenopties-en-conventies): projeye ait seçenekler.
- [Saat planlamasını açma](docs://howto-urenplanning-aanzetten): *Saat planlamasını etkinleştir* anahtarının adımları.
- [Günler ve saatler](docs://uitleg-dagen-en-uren): uygulamanın gün ve saatleri nasıl saydığı.
- [Görev türleri: süre, birimler ve iş](docs://uitleg-werkregels): *Görev türlerini kullanın* ile neyin görünür olduğu.
- [Klavye kısayolları](docs://ref-sneltoetsen): uygulamanın tüm tuşları, yakınlaştırma ve kaydırma tuşları dahil.
