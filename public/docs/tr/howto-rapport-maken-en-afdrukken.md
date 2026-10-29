# Rapor oluşturma ve yazdırma

Amaç: planlamanızdan bir rapor seçmek, bunu önizlemede kontrol etmek ve PDF olarak kaydetmek. Böylece raporu dağıtabilir veya kendiniz yazdırabilirsiniz.

## Bunu ne zaman kullanırsınız

Cuma günü şantiye toplantısı var. Müşteri planlamayı kağıt üzerinde görmek ister, şantiye yöneticisi önümüzdeki haftalarda neyin başlayacağını bilmek ister ve ustabaşı yalnızca kendi görevlerini gösteren bir sayfa ister. Bu tür özetleri *Rapor* sekmesinde hazırlarsınız. Uygulama bunları planlamanızdan hesaplar ve önce önizleme olarak gösterir. Sonra bunları PDF olarak dışa aktarırsınız.

Uygulama raporu kendisi yazıcıya göndermez. Son çıktı her zaman bir PDF'dir. Bunu PDF okuyucunuzla yazdırırsınız veya e-posta ile gönderirsiniz.

## Adımlar

### 1. Rapor sekmesini açın

Şerit üzerinde *Rapor* sekmesini seçin veya Ctrl+P tuşuna basın. Ctrl+P sizi bu sekmeye götürür. Bir alana yazıyorsanız, bir iletişim kutusu açıksa veya sunum modu açıksa Ctrl+P çalışmaz. Tarayıcıda ise tarayıcının yazdırma iletişim kutusu açılır ve bu, raporu değil ekranı yazdırır.

Solda *Rapor* bölümü bulunur. Bu bölümde *Rapor türü* listesi, bir özet ve ayarlar yer alır. Sağda önizleme bulunur.

### 2. Rapor türünü seçin

*Rapor türü* listesinde on bir rapor vardır. Sorunuza uyan raporu seçin.

- *Gantt şeması*: planlama çubuk grafik olarak, olağan dağıtım planı için.
- *Kaynak diyagramı*: aynı çubuklar, ama her kaynak için ayrı bir satırda. “X ekibi ne yapıyor?” sorusu için, isterseniz ekip başına bir sayfa ile.
- *Kilometre taşı özeti*: tüm kilometre taşları, tarih ve durumla birlikte.
- *Variance*: güncel planlamayı, etkin temel plan ile yan yana gösterir. “Ne kadar geriledik?” sorusu için.
- *İleriye bakış (look-ahead)*: önümüzdeki dönemde çalışan veya başlayan görevler. Haftalık toplantı için liste.
- *Kritik ve kritiğe yakın*: bolluğu olmayan veya neredeyse hiç olmayan görevler.
- *İlerleme raporu*: projenin durum tarihindeki durumu. Durum tarihi, ilerlemeyi ölçtüğünüz gündür.
- *Program sağlığı*: planlamanın kendisinin hata ve olağandışı değerler açısından kontrolü.
- *Kaynak yükü*: kaynak başına hafta veya ay bazında, gereken ile mevcut olanın karşılaştırması.
- *Kaynak atamaları*: kaynak başına, kaynağın atandığı görevler.
- *WBS özeti*: planlamanın WBS seviyesi başına toplanmış hali, yönetim için.

### 3. Planlamanın güncel olduğundan emin olun

Uygulama kendiliğinden hesaplamaz. Son hesaplamadan sonra görevleri, ilişkileri veya takvimleri değiştirdiyseniz **Hesapla** (F5) tuşuna basın. Tablo raporları, raporun üstünde kendileri sizi uyarır: *Program son hesaplamadan beri değişti — güncel değerler için Hesapla (F5) tuşuna basın.* Ya da hiç hesaplanmadıysa: *Henüz hesaplanmadı — tarihler ve bolluklar için Hesapla (F5) tuşuna basın.*

*Rapor* sekmesinde Hesapla düğmesi yok, ama F5 burada da çalışır. Planlama güncel değilse *PDF dışa aktar* işlemi de önce kendiliğinden hesaplar. Böylece PDF hiçbir zaman planlamanızın gerisinde kalmaz.

### 4. Raporu ayarlayın

*Ayarlar* altında Gantt şeması ve Kaynak diyagramı için seçenekler bulunur. İleriye bakış (look-ahead), Kritik ve kritiğe yakın, İlerleme raporu, Program sağlığı, Kaynak yükü, Kaynak atamaları ve WBS özeti raporlarında yalnızca *Kağıt:* ve *Yön:* bulunur. Ayrıca bu raporların seçeneklerini içeren bir *Rapor seçenekleri* bloğu vardır. Kilometre taşı özeti ve Variance kendi seçeneklerine sahip değildir. Bir raporun dönemi için bkz. [Rapor dönemini seçme](docs://howto-rapportageperiode-kiezen).

- *Kağıt:* ve *Yön:* sayfayı belirler. Varsayılan olarak bu A3 yatay yöndür. Bu, bir inşaat planlaması için kullanışlıdır, ama her yazıcı A3 yazdırmaz. A4 yazıcınız varsa şimdi A4 seçin: uygulama sayfaları A4 için düzenler, böylece bunları sonradan küçültmeniz gerekmez.
- Kaynak diyagramında *Her kaynak yeni bir sayfada* onay kutusu, ekip başına bir sayfa verir.
- *Yazı boyutu:* (%90 ile %125 arası) metni ve tabloyu daha büyük veya daha küçük yapar. Daha büyük yazı, zaman çizelgesi için daha az yer bırakır.
- *Görünüme uy (filtre, gruplama, sıralama)* yalnızca Gantt şeması için görünür. Varsayılan olarak tüm görev ağacı kağıda çıkar. Bu onay kutusuyla rapor, ekranda gördüğünüz satırları tam olarak çizer, daraltılmış aşamalar dahil. Örneğin bir düzen yalnızca kritik görevleri gösteriyorsa, rapor yalnızca bunları çizer. Böyle bir görünümün nasıl yapılacağı [Düzen oluşturma ve kullanma](docs://howto-layouts-gebruiken) bölümünde yer alır.
- *Temel çizgi katmanını göster* etkin temel planı güncel çubukların yanında gösterir. *Durum çizgisi:* seçeneğinde *Durum tarihi çizgisi* veya *İlerleme çizgisi* seçersiniz.
- *Kağıda otomatik sığdır* varsayılan olarak açıktır: zaman çizelgesi sayfa genişliğine ölçeklenir ve sayfa sayısı yüksekliğe göre belirlenir. Bunu kapatırsanız rapor sabit bir yakınlaştırma kullanır ve ayrıca sayfaları genişlik boyunca yan yana dizer. Bu hızla çok sayfa üretir. *Zaman çizelgesi:* ile otomatik sığdırma açıkken zaman çizelgesini genişlikte 2 ile 8 sayfaya yayarsınız. Bunu, okunabilir boyutta yazdırmak istediğiniz uzun bir planlama için kullanın.

### 5. Önizlemeyi kontrol edin

Gantt şeması ve Kaynak diyagramında kağıdı, sayfa üstbilgisi, tablo, zaman çizelgesi ve açıklamayla birlikte görürsünüz. Sayfalara bakmak için kaydırın. *Önizleme kalitesi* yalnızca önizlemenin ekranınızda ne kadar keskin olduğunu ayarlar; PDF bununla değişmez. Sayfaların altında *… ve 1 sayfa daha — tam belge için dışa aktarın* yazıyorsa (daha fazla sayfa varsa *… ve 2 sayfa daha — tam belge için dışa aktarın*), önizlemede tüm sayfalar hazır değildir. PDF hepsini içerir.

Diğer raporlar ekranda tablo olarak gösterilir. Gördüğünüz, PDF'e de girer.

### 6. PDF olarak dışa aktarın

Sol bölümün altında **PDF dışa aktar** öğesine tıklayın. Önerilen dosya adı, proje adından ve ardından rapor türünden oluşur; Gantt şeması için örneğin *Extension house-planning.pdf* gibi.

- Masaüstü uygulamasında ve dosyalar için kaydetme iletişim kutusu olan bir tarayıcıda, PDF'in nereye gideceğini siz seçersiniz. Bu iletişim kutusunu kaydetmeden kapatırsanız hiçbir şey olmaz.
- Böyle bir iletişim kutusu olmayan bir tarayıcıda, tarayıcı PDF'i indirilenler klasörünüze koyar.

### 7. PDF'i yazdırın

PDF'i PDF okuyucunuzda açın ve orada yazdırın. A3 PDF'i A4 yazıcıda yazdırırsanız, yazdırma iletişim kutusu sayfaları küçültmek zorunda kalır. Bu yüzden önce 4. adımda kağıt boyutunu ayarlayın.

## Tuzaklar ve uygulamanın davranışı

**Yazdır düğmesi ve Ctrl+P yazdırmaz.** *Rapor* grubundaki *Yazdır* düğmesi Rapor sekmesinin kendisinde bulunur ve ek bir işlem yapmaz. Ctrl+P sizi bu sekmeye götürür. Uygulamada ayrı bir yazdırma komutu yoktur; kağıda giden yol PDF üzerinden geçer. Ctrl+P çalışmazsa (bkz. 1. adım), tarayıcının yazdırma iletişim kutusu açılır ve bu, raporu değil ekranı yazdırır.

**Şirket: üzerine yazma saklanmaz.** Gantt şemasının *Şirket:* alanı, proje ayarlarındaki şirketle başlar. Üzerine yazdığınız değer saklanmaz. Burada *Yazar:* alanına yazamazsınız. İkisini de *Ayarlar › Proje › Proje ayarları* yolundan değiştirirsiniz: *Müşteri/kurum* ve *Yazar* alanlarında, sonra *Uygula* ile onaylayın.

**Çubuk renkleri: ekranınızda da geçerli.** Raporda *Çubuk renkleri:* seçimi, Görünüm sekmesindeki *Çubuk renkleri* ile aynı seçimdir. Raporda değiştirirseniz, ekrandaki Gantt şeması da onunla birlikte değişir.

**Temel plan olmadan Variance.** Temel plan, planlamanızın kaydedilmiş bir kopyasıdır; daha sonra karşılaştırmak için kullanılır. Nasıl kaydedileceği [Temel planı kaydetme ve yönetme](docs://howto-baseline-opslaan-en-beheren) bölümünde yer alır. Etkin bir temel planınız yoksa karşılaştırma yerine şunu görürsünüz: *Etkin temel plan yok — bir temel plan kaydedin veya birini etkin olarak ayarlayın.*

**Durum tarihi olmadan durum çizgisi.** Proje durum tarihi yokken *Durum çizgisi:* seçerseniz, rapor *Önce bir durum tarihi belirleyin* uyarısını verir ve hiçbir şey çizmez. Durum tarihini *Planlama › Temel plan ve ilerleme › Durum tarihi* yolunda belirlersiniz.

**Planlamada bir döngü var.** Planlamada bir döngü varsa *PDF dışa aktar* dosya oluşturmaz ve hatayı gösterir.

**Kağıt şu anda tüm raporlar için geçerlidir.** *Kağıt:* ve *Yön:* için tek bir seçim vardır; tüm raporlar bunu paylaşır. Kilometre taşı özeti ve Variance kendi kağıt seçimine sahip değildir. Onlar başka bir raporda ayarladığınız değeri kullanır: varsayılan olarak A3 yatay. Bu yüzden kağıdı önce, bunu sunan bir raporda seçin, örneğin Gantt şemasında, ve sonra geri dönün.

**Seçenekler tüm projeler için geçerlidir.** Uygulama bu cihazda kağıdı, yazı boyutunu, dönemi ve diğer seçenekleri tüm projeleriniz için hatırlar. Bunlar proje dosyasına ait değildir.

## Ayrıca bakın

- [Rapor dönemini seçme](docs://howto-rapportageperiode-kiezen): belirli bir zaman aralığı için ileriye bakış veya ilerleme raporu.
- [Düzen oluşturma ve kullanma](docs://howto-layouts-gebruiken): önce filtreleyin veya gruplayın, sonra *Görünüme uy (filtre, gruplama, sıralama)* ile yazdırın.
- [Temel planı kaydetme ve yönetme](docs://howto-baseline-opslaan-en-beheren): Variance'ın karşılaştırdığı kayıtlı kopya.
- [Aşırı atanmışlığı çözme](docs://howto-overbezetting-oplossen): Kaynak yükü aşırı atanmış haftaları gösterdiğinde ne yapmanız gerektiği.
- [Kritik yol ve bolluk](docs://uitleg-kritiek-pad): bir görevin neden kritik veya kritiğe yakın olduğu.
- [Rapor türleri](docs://ref-rapporttypes): tüm rapor türleri ve bunların seçenekleri.
