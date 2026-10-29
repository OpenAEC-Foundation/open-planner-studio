# Rapor türleri

*Rapor* sekmesindeki her rapor ve ona ait seçenekler: ne yaptıkları, varsayılan değer, raporda neyin değiştiği ve bunları nerede bulacağınız. Bir raporu nasıl oluşturup PDF olarak kaydedeceğiniz [Rapor oluşturma ve yazdırma](docs://howto-rapport-maken-en-afdrukken) bölümünde anlatılır.

## Rapor penceresi nasıl çalışır

*Rapor* sekmesini açın (veya Ctrl+P tuşuna basın). Solda *Rapor* sütunu vardır; bu sütunda *Rapor türü* açılır listesi, sayılarıyla *Özet* bloğu, *Ayarlar* veya *Rapor seçenekleri* bloğu ve en altta *PDF dışa aktar* düğmesi bulunur. Sağda önizleme vardır. Önizlemede gördüğünüz her şey PDF'e girer.

**Rapor türü** — hangi raporu gördüğünüz. On bir rapor arasından seçin. Varsayılan: *Gantt şeması*. Nerede: *Rapor* sütununun üstünde.

**PDF dışa aktar** — PDF dosyasını oluşturur. Etkisi: sonuç yalnızca bir PDF'dir; uygulama hiçbir şeyi yazıcıya göndermez. Planlama güncel değilse uygulama önce hesaplar. Hesaplama bir hata verirse, örneğin ilişkilerdeki bir döngü yüzünden, düğme dosya oluşturmaz ve hatayı gösterir. Nerede: *Rapor* sütununun altında.

**Hatırlanır.** Uygulama tüm rapor seçeneklerini bu cihazda, tüm projeleriniz için saklar. Bunlar proje dosyasına ait değildir. Yalnızca Gantt şemasındaki *Şirket:* alanı saklanmaz.

**Güncel planlama.** Raporlar son hesaplamayı kullanır. Planlama o zamandan beri değiştiyse tablo raporlarının üstünde şu metin görünür: *Program son hesaplamadan beri değişti — güncel değerler için Hesapla (F5) tuşuna basın.* Hiç hesaplama yapılmadıysa şu metin görünür: *Henüz hesaplanmadı — tarihler ve bolluklar için Hesapla (F5) tuşuna basın.* Proje *Kaydedilen tarihler* görünümündeyse raporlar tarihleri kaynak dosyadan gösterir ve bir şerit bunu belirtir.

**Kısaltmalar.** *ig* iş günüdür. *TF* toplam bolluktur, *FF* serbest bolluktur.

## Kağıt ve sayfa yönü

**Kağıt:** — PDF'nin kağıt boyutu. A4, A3, A2 ve A1 arasından seçin. Varsayılan: A3. Etkisi: sayfalar bu boyuta göre düzenlenir. Tüm raporlar için tek bir seçim vardır: bir rapor için seçtiğiniz ayar diğerleri için de geçerlidir. A4 dikeyken geniş bir tablo küçülür, çünkü tablo sayfa genişliğine göre ölçeklenir. Nerede: *Ayarlar* (Gantt şeması ve Kaynak diyagramı) veya *Rapor seçenekleri* (yedi tablo raporu). Kilometre taşı genel görünümü ve Sapma hiçbir seçenek göstermez.

**Yön:** — yatay veya dikey. *Yatay* veya *Dikey* arasından seçin. Varsayılan: *Yatay*. Etkisi: *Kağıt:* ile aynıdır. Nerede: *Kağıt:* ile aynı yerde.

## Gantt şeması

Planlama bir çubuk grafiği olarak gösterilir: solda bir tablo, sağda bir zaman çizelgesi ve gerekirse birden çok sayfa. Önizleme; sayfa üstbilgisi, tablo, zaman çizelgesi ve açıklamayla birlikte kağıdı gösterir. *Özet* bloğu *Görevler:*, *Yaprak görevler:*, *Kritik:* ve *İlişkiler:* sayılarını gösterir. Tüm seçenekler *Ayarlar* altındadır.

**Şirket:** — sayfa üstbilgisindeki şirket. Varsayılan: proje ayarlarındaki şirket. Etkisi: yalnızca raporun üstbilgisi; burada yazdığınız şey saklanmaz. Şirketi *Ayarlar › Proje › Proje ayarları* içinde değiştirin: *Müşteri/kurum* alanına yazın ve *Uygula* ile onaylayın.

**Yazar:** — sayfa üstbilgisindeki yazar. Salt okunur: uygulama bunu proje ayarlarından alır.

**Yazı boyutu:** — raporda metnin ve tablonun boyutu. %90, %100, %110 ve %125 arasından seçin. Varsayılan: %100. Etkisi: yazı büyüdükçe metin, satırlar ve tablo büyür; zaman çizelgesi daralır. Ayarlardaki *Metin boyutu* ile bağımsızdır.

**Çubuk renkleri:** — çubuğun rengi neye bağlıdır. *Kritik yol*, *Görev başına — otomatik* ve *Kategoriye göre* arasından seçin; *Kategoriye göre* seçiliyse açılır liste *Kategori alanı* için kullanılır. Varsayılan: *Kritik yol*. Etkisi: bu, *Görünüm* sekmesindeki *Çubuk renkleri* ile aynı seçimdir: burada değiştirirseniz ekrandaki Gantt şeması da değişir. Seçilen alan bu projede yoksa şu metin görünür: *Bu alan bu projede yok. Geçici olarak iş kategorisi kullanılıyor.*

**Durum çizgisi:** — durum tarihinde bir çizgi. *Yok*, *Durum tarihi çizgisi* ve *İlerleme çizgisi* arasından seçin. Varsayılan: *Yok*. Etkisi: *Durum tarihi çizgisi* durum tarihinde bir çizgi çizer; *İlerleme çizgisi* her görevin ilerlemesine göre uzanan zikzak çizgiyi çizer. Projede durum tarihi yoksa şu metin görünür: *Önce bir durum tarihi belirleyin* ve rapor hiçbir şey çizmez.

**Görünüme uy (filtre, gruplama, sıralama)** — yalnızca Gantt şeması için. Varsayılan: kapalı. Etkisi: kapalıyken tüm görev ağacı kağıda konur. Açıkken tam olarak ekrandaki satırlar çizilir: filtreniz, gruplamanız, sıralamanız ve daraltılmış aşamalarınızla birlikte.

**Kağıda otomatik sığdır** — zaman çizelgesini sayfa genişliğine ölçekler. Varsayılan: açık. Etkisi: açıkken zaman çizelgesi sayfa genişliğine göre ölçeklenir; sayfa sayısı yüksekliğe bağlıdır. Kapalıyken sabit bir ölçek kullanılır (*Yakınlaştırma:*) ve sayfalar genişlik boyunca da yan yana dizilir; bu hızla çok sayfa oluşturur.

**Yakınlaştırma:** — zaman çizelgesinin sabit ölçeği. Yalnızca *Kağıda otomatik sığdır* kapalıyken görünür. Kaydırıcı 1 ile 40 arasında. Varsayılan: 22. Etkisi: daha büyük bir değer zaman çizelgesini genişletir; yan yana daha çok sayfa olur.

**Zaman çizelgesi yayılımı:** — zaman çizelgesini daha çok sayfa genişliğine yayar. Seçim 1 ile 8 sayfa arasında. Varsayılan: 1 sayfa. Etkisi: yalnızca *Kağıda otomatik sığdır* açıkken; aksi halde seçim devre dışıdır ve şunu yazar: *Yalnızca otomatik sığdırmada*. Okunabilir boyutta yazdırmak istediğiniz uzun bir planlama için kullanışlıdır.

**Üstbilgiyi her sayfada tekrarla** — Varsayılan: açık. Etkisi: açıkken üstbilgi her sayfaya konur; kapalıyken yalnızca ilk sayfada.

**Altbilgiyi her sayfada tekrarla** — Varsayılan: açık. Etkisi: açıkken altbilgi (proje adı, yazdırma tarihi ve açıklama) her sayfaya konur; kapalıyken yalnızca son sayfada. Açıklama olmadan bir dağıtım kağıdı okunmaz; bu yüzden varsayılan açıktır.

**Görev adları çubuklarda** — Varsayılan: açık. Etkisi: görevin adı, yer varsa çubukta yazılır.

**Tamamlanmayı göster** — Varsayılan: açık. Etkisi: çubuğun tamamlanan kısmı Gantt şemasındaki gibi gri olur ve tabloda *Tamam* sütunu görünür. Tamamlanmış bir görevde bolluk şeridi çizilmez.

**Görev adlarını kısalt** — Varsayılan: açık. Etkisi: açıkken tablodaki adlar *Ad sütunu:* genişliğinde kesilir. Kapalıyken sütun en uzun ada göre büyür; bu durumda şu metin görünür: *Ad sütunu en uzun görev adına göre ayarlanır.*

**Ad sütunu:** — ad sütununun genişliği. Yalnızca *Görev adlarını kısalt* açıkken görünür. Kaydırıcı 60 ile 400 arasında. Varsayılan: 130.

**Temel plan katmanını göster** — etkin temel planı çubukların yanında gösterir. Varsayılan: kapalı. Etkisi: görev çubuğunun altında, yalnızca temel planda olan görevler için temel plan renginde ince bir çubuk çizilir.

**Kritik yol** — Varsayılan: açık. Etkisi: yalnızca iki kritik görev arasındaki kırmızı ilişki çizgilerini ve açıklama çizgisini denetler. Çubuklar kendileri bu onay kutusuna bakmadan *Çubuk renkleri:* ayarını izler.

**Bolluğu göster** — Varsayılan: açık. Etkisi: kritik olmayan çubukların arkasında bolluk şeridi.

**İlişkiler** — ilişki çizgileri. Varsayılan: açık. Etkisi: çubuklar arasında oklar çizer.

**Yalnızca iş günlerini göster** — bu raporda zaman çizelgesi eksenini sıkıştırır. Varsayılan: kapalı. Etkisi: hafta sonları ve tatiller atlanır; hafta sonu gölgelendirmesi yerine hafta şeritleri gelir. Ekrandaki Gantt şeması için aynı ayardan bağımsızdır.

**Hafta sonları** — Varsayılan: açık. Etkisi: ölçek günleri ayırt edilebilir yaptığı sürece zaman çizelgesinde hafta sonlarını ve tatilleri gölgelendirir. Sıkıştırılmış eksende (*Yalnızca iş günlerini göster*) bu onay kutusunun etkisi yoktur.

**Açıklama** — Varsayılan: açık. Etkisi: altbilgideki açıklama.

**Önizleme kalitesi** — önizlemenin ne kadar keskin olduğu. *Standart*, *Yüksek* ve *Maksimum* arasından seçin. Varsayılan: *Yüksek*. Etkisi: yalnızca ekrandaki önizlemenin keskinliği; PDF değişmez. Nerede: *Rapor*, önizlemenin üstünde.

## Kaynak diyagramı

Gantt şemasındakiyle aynı çubuklar, kaynak başına gruplanmış: kim ne zaman neyi yapar. *Özet* bloğu *Kaynaklar:*, *Atamalar:* ve *Kaynaksız:* sayılarını gösterir; bir dönem seçiliyse ayrıca *Dönem dışında:*. Diyagram, Gantt şemasının seçeneklerinin çoğunu paylaşır; yalnızca *Görünüme uy (filtre, gruplama, sıralama)*, *Kritik yol* ve *İlişkiler* hariç. Satırlar ekrandan gelmez, bir görev birden çok kaynağın altında görünebilir ve ilişkiler burada çizilmez. *Kritik yol* onay kutusu gizlidir ve açıktır. Bu seçenekler *Ayarlar* altında Gantt şemasıyla birlikte gelir; ayrıca şu dört onay kutusu ve dönem vardır:

**Her kaynak yeni sayfada** — Varsayılan: kapalı. Etkisi: her kaynak yeni bir sayfada başlar; böylece her ekip veya çalışan için ayrı bir sayfa verebilirsiniz. Kapalıyken tek ve kesintisiz bir belge çıkar.

**Kaynaksız görevleri dahil et** — Varsayılan: kapalı. Etkisi: kaynağı olmayan görevler diyagramda son grup olarak gelir; henüz kimseye atanmamış işleri görmek için.

**Kaynak türüne göre grupla** — Varsayılan: kapalı. Etkisi: üstte bir katman: önce kaynak türü başına bir grup (işçilik, ekip, taşeron, ekipman, malzeme), bunun içinde kaynak başına.

**Birim/gün ve eğriyi göster** — Varsayılan: açık. Etkisi: görev adından sonra iki sütun: kaynağın günlük birimleri ve o grubun dağılım eğrisi. Zaman çizelgesi için yer azsa rapor bu sütunları dışarıda bırakır ve şunu yazar: *Birim/gün ve Eğri sütunları bırakıldı: …*; daha fazla yer, daha büyük bir kağıt boyutu veya yatay yönle, daha küçük bir yazı boyutuyla ya da daha dar bir tabloyla sağlanır.

**Rapor dönemi:** — yalnızca döneme dokunan görevler. Varsayılan: *Tüm proje*. Etkisi: zaman ekseni tam olarak dönem boyunca çalışır. Dönemde hiçbir şey yoksa şu metin görünür: *Rapor döneminde görev yok — başka bir dönem veya Tüm proje seçin.* Aşağıdaki *Rapor dönemi* bölümüne bakın.

## Kilometre taşı genel görünümü

Projenin bütün kilometre taşları tek bir tabloda. Kendine ait seçeneği yok. *Özet* bloğu *Kilometre taşları*, *Zorunlu* ve *Gecikmiş* sayılarını gösterir. Sütunlar: *WBS*, *Ad*, *Tür* (*Otomatik*, *Başlangıç* veya *Bitiş*), *Tarih*, *Kısıtlama/son tarih*, *Bolluk*, *Zorunlu* ve *Durum*. Durum *Gecikmiş* olur; kısıtlama ihlal edilmişse, son tarih kaçırılmışsa veya toplam bolluk negatifse. Değilse ve kilometre taşı projenin kritik tanımına göre kritikse durum *Kritik* olur. Değilse durum *Planında* olur. Kilometre taşı yoksa şu metin görünür: *Bu projede kilometre taşı yok.* PDF, başka bir rapor için en son seçtiğiniz kağıt ve yönü kullanır.

## Sapma

Etkin temel planın yanında mevcut planlama, yaprak görevler için. Kendine ait seçeneği yok. *Özet* bloğu *Görevler*, *Daha geç* ve *Daha erken* sayılarını gösterir ve *Proje bitişi: +3 iş günü* yazar; bu, temel plan bitişi ile mevcut bitiş arasındaki farktır (iş günü olarak). Sütunlar: *WBS*, *Ad*, *Temel plan başlangıcı*, *Temel plan bitişi*, *Mevcut başlangıç*, *Mevcut bitiş*, *Δ başlangıç (ig)*, *Δ bitiş (ig)* ve *Durum*. Durum bitişi izler: bitiş temel plandakinden sonraysa *Daha geç*, öncesindeyse *Daha erken*, değilse *Planında*. *Yeni*, temel planda olmayan bir görevdir; *Kaldırıldı*, temel planda olup artık planlamada olmayan bir görevdir. Etkin temel plan yoksa şu metin görünür: *Etkin temel plan yok — bir temel plan kaydedin veya birini etkin olarak ayarlayın.* PDF, başka bir rapor için en son seçtiğiniz kağıt ve yönü kullanır.

## İleriye bakış

Dönemde devam eden veya başlayan işler: haftalık toplantı için liste. Seçenekler *Rapor seçenekleri* altındadır.

**Rapor dönemi:** — raporun zaman penceresi. Varsayılan: *Gelecek ay*. Etkisi: rapor, döneme dokunan tamamlanmamış aktiviteleri içerir, dönemin tamamını kaplasalar bile. Ayrıca referans gününden önceki gecikmiş aktiviteleri içerir; dönemin sonu referans gününden önce olmadığı sürece.

**Kritiğe yakın ≤ (ig):** — *Kritiğe yakın* için eşik. Sayı 0 ile 60 arasında. Varsayılan: 5. Etkisi: toplam bolluğu 0'dan büyük ve en fazla bu kadar iş günü olan bir görev kritiğe yakın sayılır. 0 iken yalnızca projenin hesaplama seçeneği *Kritiğe yakın olarak işaretle* ile işaretlenenler sayılır.

*Özet* bloğu *Aktiviteler*, *Gecikmiş*, *Devam ediyor*, *Başlamış olmalıydı*, *Başlıyor*, *Kritik* ve *Kritiğe yakın* sayılarını gösterir. Her satırdaki durum her zaman referans gününe göre belirlenir: *Gecikmiş* (tamamlanmamış ve bitişi referans gününden önce), *Başlamış olmalıydı* (başlamamış, ama başlangıcı referans gününden önceydi), *Devam ediyor*, *Başlıyor* (henüz başlamamış, pencere içinde başlar). Sütunlar: *WBS*, *Ad*, *Başlangıç*, *Bitiş*, *Kalan (ig)*, *Tamam.*, *TB (ig)* (TF), *Kritik*, *Kaynaklar* ve *Durum*.

## Kritik ve kritiğe yakın

Projenin bitişini belirleyen aktiviteler ve buna çok yakın olanlar. Seçenek *Rapor seçenekleri* altındadır.

**Kritiğe yakın ≤ (ig):** — Varsayılan: 5. Sayı 0 ile 60 arasında. Etkisi ve anlamı İleriye bakış ile aynıdır. Alt başlık seçilen eşiği belirtir.

Rapor, kritik (çözücüye ve projenin kritik tanımına göre) veya kritiğe yakın olan tamamlanmamış görevleri içerir; sıralama bolluk yoluna, sonra toplam bolluğa, sonra başlangıca göre. *Özet* bloğu *Kritik*, *Kritiğe yakın*, *Kritik zincirler* ve *Yaprak görevler* sayılarını gösterir. Sütunlar: *WBS*, *Ad*, *Başlangıç*, *Bitiş*, *Kalan (ig)*, *TB (ig)* (TF), *SB (ig)* (FF), *Yol* ve *Durum*. *Yol* sütunu, hesaplama seçeneği *Birden çok bolluk yolu* açıksa bolluk yolunu gösterir; değilse bir kısa çizgi.

## İlerleme raporu

Projenin durum tarihindeki durumu. Seçenekler *Rapor seçenekleri* altındadır.

**Rapor dönemi:** — Varsayılan: *Geçen ay*. Etkisi: *Geçen dönemde tamamlananlar* dönem içinde sayılır. *Gelecek dönemde başlayanlar* durum tarihinden ileriye bakar, *İleriye bakış bitişi* tarihine kadar; *Geçen* dönem seçiliyse ileriye bakış, dönemin geriye baktığı kadardır.

**Kritiğe yakın ≤ (ig):** — Varsayılan: 5. İleriye bakış ile aynıdır.

*Özet* bloğu *Durum tarihi*, *Dönem*, *İleriye bakış bitişi*, *Temel plan bitişi*, *Tahmini bitiş*, *Δ bitiş (ig)*, *Planlanan* (*(temel plan)* veya *(mevcut program)*), *Gerçekleşen* ve sayıları *Tamamlandı*, *Devam ediyor*, *Başlamadı*, *Gecikmiş* ve *Kritik* gösterir. *Planlanan* ve *Gerçekleşen* değerler, görevlerin süresine göre ağırlıklandırılır. *Planlanan*, etkin bir temel plan varsa temel plana göre, yoksa mevcut planlamaya göre ölçülür. Bölümler: *Geçen dönemde tamamlananlar*, *Devam ediyor*, *Gelecek dönemde başlayanlar*, *Gecikmiş* ve *Açık kritik aktiviteler*; bir görev birden çok bölümde olabilir. Her bölümde aynı sütunlar vardır: *WBS*, *Ad*, *Temel plan bitişi*, *Tahmini bitiş*, *Tamam*, *Kalan (ig)*, *TB (ig)* (TF), *Kritik* ve *Durum*. Her satırın durumu şunlardan biridir: *Tamamlandı*, *Devam ediyor*, *Başlamadı*, *Başlamış olmalıydı* veya *Bitmiş olmalıydı*.

## Planlama sağlığı

Planlamanın kendisinde hata ve alışılmadık değerlerin kontrolü. Üstte DCMA 14 nokta değerlendirmesi. Seçenekler *Rapor seçenekleri* altındadır.

**Yüksek bolluk > (ig):** — 1 ile 365 arasında bir sayı. Varsayılan: 44. Etkisi: tamamlanmamış bir görev, toplam bolluğu bu değerden büyükse *Yüksek bolluk* altında yer alır.

**Uzun süre > (ig):** — 1 ile 365 arasında bir sayı. Varsayılan: 44. Etkisi: kilometre taşı olmayan, tamamlanmamış ve süresi daha uzun bir görev *Uzun süre* altında yer alır.

**Gecikme > (ig):** — 0 ile 365 arasında bir sayı. Varsayılan: 10. Etkisi: daha fazla gecikmesi olan bir ilişki *Uzun gecikme* altında yer alır. Negatif bir gecikme (öne alma) her zaman raporlanır.

**Kritiğe yakın ≤ (ig):** — 0 ile 60 arasında bir sayı. Varsayılan: 5. Etkisi: *Kritiğe yakın* kontrolünü belirler.

Bölüm *DCMA 14 nokta değerlendirmesi* en başta yer alır. Bu bölüm, ABD Defense Contract Management Agency kurumunun on dört kontrolünü izler; formüller ve eşikler kurumun *EVMS Program Analysis Pamphlet* (DCMA-EA PAM 200.1, Ekim 2012) belgesinden alınmıştır. Her madde için şunları görürsünüz: *Sayı*, *Toplam* (sayılan toplam), *Değer*, *Eşik*, *Sonuç* ve *Ayrıntı*. Sonuç *Uygun*, *İşaret* veya *yok* değerini alır; *yok* olduğunda neden ayrıntıda yer alır. Bir işaret bir hata değildir: belge bunu daha yakından bakmak için bir neden olarak tanımlar. *Rapor seçenekleri* altındaki eşikler bu bölüm için geçerli değildir; bölüm her zaman belgedeki eşikleri kullanır.

Bölüm tamamlanmamış yaprak görevlerini sayar; kilometre taşlarını ve hamakları hariç tutar. Bu görevlere giden ilişkileri de sayar. Raporun üst kısmındaki not iki sayıyı da verir. On dört madde:

- *Mantık*: öncülü veya ardılı olmayan görevler. Eşik: en fazla %5.
- *Öne almalar*: negatif gecikmesi olan ilişkiler. Eşik: yok.
- *Gecikmeler*: pozitif gecikmesi olan ilişkiler, ne kadar kısa olursa olsun. Eşik: en fazla %5.
- *İlişki türleri*: FS ilişkilerinin payı. Eşik: en az %90.
- *Kesin kısıtlamalar*: zorunlu bir kısıtlaması veya MSO, MFO, SNLT ya da FNLT kısıtlaması olan görevler. Eşik: en fazla %5.
- *Yüksek bolluk*: toplam bolluğu 44 iş gününden fazla olan görevler. Eşik: en fazla %5. Bir hesaplama gerekir.
- *Negatif bolluk*: toplam bolluğu 0'ın altında olan görevler. Eşik: yok. Bir hesaplama gerekir.
- *Yüksek süre*: 44 iş gününden uzun görevler. Görev etkin temel plandaysa temel plandaki süreyi, değilse geçerli süreyi sayar. Eşik: en fazla %5.
- *Geçersiz tarihler*: durum tarihinden sonra gelen bir gerçek başlangıç veya gerçek bitiş, ya da durum tarihinden önce gelen bir tahmini başlangıç veya tahmini bitiş. Eşik: yok. Bir durum tarihi gerekir.
- *Kaynaklar*: kaynağı olmayan görevler. Eşik: yok. Yalnız proje kaynak kullanıyorsa; aksi halde yok.
- *Kaçırılan görevler*: temel plana göre durum tarihinde veya daha önce bitmesi gereken görevlerden, daha geç biten ya da tahmini bitişi daha geç olanların payı. Eşik: en fazla %5. Bir durum tarihi ve etkin bir temel plan gerekir.
- *Kritik yol testi*: uygulama bir kritik görevi 100 iş günü uzatır ve bir kopyada yeniden hesaplar; proje değişmez. Projenin son görevi bu durumda o görevden önce bitmiyorsa test geçer. Test, en erken başlangıcı olan kritik ve tamamlanmamış görevi sınar; ayrıntıda görevin adı ve bitişin kaç iş günü kaydığı yazılır. *Kaydedilen tarihler* görünümünde bu test yok (*hesaplanmadı*): test hesaplama yapar ve rapor o zaman kaynak dosyadaki tarihleri gösterir. Hesapla (F5) komutuna basın; test yeniden çalışır.
- *CPLI*: (kritik yol uzunluğu + bolluk) / kritik yol uzunluğu. Uzunluk, durum tarihinden son görevin bitişine kadar olan iş günlerini sayar; bolluk, o görevin temel plan bitişiyle arasındaki farktır, ya da görev temel planda değilse hesaplanan bolluktur. Eşik: en az 0,95. Bir durum tarihi gerekir.
- *BEI* (temel plan uygulama endeksi): durum tarihinde tamamlanmış görevlerin sayısı, bölü temel plana göre o tarihe kadar tamamlanması gereken görevlerin sayısı artı temel planı olmayan görevler. Eşik: en az 0,95. Bir durum tarihi ve etkin bir temel plan gerekir.

Uygulamada bu kavram olmadığı için iki madde belgeden farklıdır: *Yüksek süre* her tamamlanmamış görevi sayar, oysa belge bunu ayrıntılı planlama dönemiyle (rolling wave) sınırlar; *Kaynaklar* yalnız atanmış kaynaklara bakar, maliyetlere bakmaz. Belge kritik yol testi için bir sayı vermez; 100 iş günü uygulamanın seçimidir.

Kontroller bu sırayla ve ciddiyetleriyle verilir. Hata: *Negatif bolluk*, *Kaçırılan son tarih*, *İhlal edilen kısıt* ve *Tutarsız ilerleme* (gerçek başlangıç veya gerçek bitiş durum tarihinden sonra; tahmini başlangıç veya tahmini bitiş durum tarihinden önce; gerçek bitiş olmadan %100; gerçek bitiş var ama %100 değil; gerçek başlangıç olmadan ilerleme). Uyarı: *Öncülü yok (açık başlangıç)* ve *Ardılı yok (açık bitiş)* (kilometre taşları hariç), *Uzun süre*, *Öne alma (negatif gecikme)*, *Kesin kısıtlama* (zorunlu bir kısıtlama veya MSO, MFO, SNLT ya da FNLT), *Sıra dışı ilerleme* ve *Kaçırılan görev (temel plana göre)*. Bilgi: *Kritiğe yakın*, *Yüksek bolluk*, *Uzun gecikme*, *FS dışı ilişki* ve *Kaynaksız* (yalnız proje kaynak kullanıyorsa). Rapor yalnız kilometre taşı olmayan ve hamak olmayan yaprak görevlere bakar. Blok *Özet*, *DCMA işaretleri*, *Hatalar*, *Uyarılar*, *Bilgi*, *Yaprak görevler* ve *İlişkiler* sayar. DCMA bölümünün altında bir *Genel bakış* bölümü (her kontrol için ciddiyet ve sayı) ve bir *Bulgular* bölümü (her görev veya ilişki) bulunur. Hesaplama yoksa bolluk gerektiren kontroller eksik kalır.

## Kaynak yükü

Her kaynak için hafta veya ay bazında gereken ve mevcut miktar. Seçenekler *Rapor seçenekleri* altındadır.

**Rapor dönemi:** — Varsayılan: *Tüm proje*. Etkisi: dönemle kesişen her hafta veya ay tam olarak dahil edilir. Böylece bir satır, histogramdaki sayının aynısını gösterir.

**Toplama:** — *Haftalık* ve *Aylık* arasından seçin. Varsayılan: *Haftalık*. Etkisi: takvim haftası başına bir satır (*Hafta* sütunu, pazartesi tarihiyle) veya takvim ayı başına bir satır (*Ay* sütunu).

**Yalnız aşırı yüklü dönemler** — Varsayılan: kapalı. Etkisi: açık olduğunda yalnız en az bir aşırı yüklü günü olan haftaları veya ayları gösterir.

Sütunlar şunlardır: *Kaynak*, *Tür*, *Hafta* veya *Ay*, *Gereken*, *Mevcut*, *Fark* (mevcut eksi gereken; negatif değer bir eksikliktir), *Tepe/gün* ve *Aşırı yüklü*. *Gereken* birim-günlerin toplamıdır. Yalnız talebi olan haftalar veya aylar yer alır. Blok *Özet*, *Kaynaklar*, *Haftalar* veya *Aylar*, *Aşırı yüklü haftalar* veya *Aşırı yüklü aylar* ve *Aşırı yüklü kaynaklar* sayar.

## Kaynak atamaları

Kaynak başına, kaynağın bağlı olduğu görevler: bu ekip veya vinç ne yapıyor? Seçenekler *Rapor seçenekleri* altındadır.

**Rapor dönemi:** — Varsayılan: *Tüm proje*. Etkisi: bir dönem seçildiğinde yalnız dönemle kesişen görevlerin atamaları dahil edilir; buna referans gününden önceki gecikmiş iş de eklenir. *Tüm proje* tarihe göre filtrelemez.

**Tamamlanan görevleri dahil et** — Varsayılan: kapalı. Etkisi: açık olduğunda tamamlanmış görevlerin atamalarını da dahil eder.

Satırlar kaynak başına gruplanır; bir kaynağın içinde başlangıca göre sıralanır. Blok *Özet*, *Kaynaklar*, *Atamalar* ve *Kaynaksız görevler* sayar. Sütunlar şunlardır: *Kaynak*, *Tür*, *WBS*, *Ad*, *Başlangıç*, *Bitiş*, *Kalan (ig)*, *Birim/gün*, *Tamam.*, *Kritik* ve *Durum*. *Kaynak* ve *Tür* yalnız bir kaynağın ilk satırında yer alır. Satırdaki durum, *İlerleme raporu* ile aynıdır: *Tamamlandı*, *Devam ediyor*, *Başlamadı*, *Başlamış olmalıydı* veya *Bitmiş olmalıydı*.

## WBS özeti

Planlama, WBS öğesi başına özetlenir: yönetim genel bakışı. Seçenekler *Rapor seçenekleri* altındadır.

**Seviye:** — WBS'nin hangi seviyeye kadar gösterileceği. *Tam WBS* ile seviye 1 ila 8 arasından seçin. Varsayılan: seviye 2. Etkisi: alt başlık *2. seviyeye kadar* yazar.

**Görevleri göster** — Varsayılan: kapalı. Etkisi: açık olduğunda her öğenin altında yaprak görevlerin kendilerini de gösterir.

Sütunlar arasında *WBS*, *Ad*, *Başlangıç*, *Bitiş*, *Temel başlangıç*, *Temel bitiş*, *Süre (ig)*, *Tamam.*, *Δ bitiş (ig)*, *Min. TB*, *Akt.* (görev sayısı), *Krit.*, *Devam* ve *Tamamlandı* bulunur. Bir özet görevin başlangıcı ve bitişi son hesaplamadan gelir. İlerleme, yaprak görevler üzerinden süreye göre ağırlıklandırılır. *Min. TB* (TF) ve sayılar alttaki yaprak görevlerle ilgilidir. Blok *Özet*, *WBS öğeleri* ve *Aktiviteler* sayar.

## Rapor dönemi

Dört tablo raporu ve *Kaynak diyagramı*, bir *Rapor dönemi* ile çalışır: *İleriye bakış (look-ahead)*, *İlerleme raporu*, *Kaynak yükü*, *Kaynak atamaları* ve *Kaynak diyagramı*. Her rapor kendi dönemini hatırlar. Açılır listenin altında *Başlangıç* ve *Bitiş* bulunur; bunlar seçimin ürettiği tarihleri gösterir.

**Referans günü.** *Sonraki* veya *Geçen* ile bir dönem, projenin durum tarihinden sayılır; durum tarihi yoksa bugünden sayılır. Bu durumda tablo raporları *Durum tarihi ayarlanmadı — rapor bugünü kullanıyor (…).* yazar. Durum tarihini değiştirirseniz pencere onunla birlikte kayar. İki gün de sayılır.

**Gelecek hafta, Gelecek 2 hafta, Gelecek 4 hafta, Gelecek 6 hafta, Gelecek 8 hafta, Gelecek 12 hafta** — referans gününden başlar; her hafta 7 gün uzunluğundadır. Durum tarihi 20 Mayıs Perşembe olduğunda *Gelecek hafta* 20 ile 26 Mayıs arasında sürer, *Gelecek 4 hafta* ise 20 Mayıs ile 16 Haziran arasında.

**Son hafta, Son 2 hafta, Son 4 hafta, Son 6 hafta, Son 8 hafta, Son 12 hafta** — aynı altı seçenek, ama geriye doğru sayılır: her hafta 7 gün uzunluğundadır ve referans gününde biter. Referans günü 20 Mayıs olduğunda *Son 2 hafta* 7 ile 20 Mayıs arasında sürer.

**Gelecek ay, Geçen ay** — takvim ayı ileri veya geriye doğru, aynı tarihin diğer aydaki bir gün öncesine kadar. Referans günü 20 Mayıs olduğunda *Gelecek ay* 19 Haziran'a kadar sürer; *Geçen ay* 21 Nisan ile 20 Mayıs arasında sürer.

**Tüm proje** — planlamanın ilk başlangıcından son bitişine kadar.

**Özel** — kendi döneminiz. Etkisi: *Başlangıç* ve *Bitiş* iki tarih alanı olur. Bu alanlar, az önce seçtiğiniz seçimin tarihleriyle başlar. Bitiş tarihi, başlangıç tarihinden önce olamaz (*Bitiş tarihi başlangıç tarihinden önce.*) ve iki alan da doldurulmalıdır (*Her iki tarihi de girin.*). Giriş doğru değilse rapor son geçerli dönemde kalır.

## Ayrıca bakın

- [Rapor oluşturma ve yazdırma](docs://howto-rapport-maken-en-afdrukken): rapor türünden PDF'e kadar tüm yol.
- [Rapor dönemini seçme](docs://howto-rapportageperiode-kiezen): adımlar ve örnekler.
- [Kritik yol ve bolluk](docs://uitleg-kritiek-pad): kritik ve kritiğe yakın ne anlama gelir.
- [İlerleme, durum tarihi ve temel plan](docs://uitleg-voortgang): durum tarihi ve raporların kullandığı temel plan.
- [Aşırı atanmışlığı çözme](docs://howto-overbezetting-oplossen): Kaynak yükü bölümündeki aşırı yüklü haftalarla ne yapılacağı.
- [İçe ve dışa aktarma biçimleri](docs://ref-import-exportformaten): PDF, diğer biçimlerin yanında.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): ilerleme ve bir durum tarihi olan iki temel plan; variance raporuna bakmak için.
