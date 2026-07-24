# Raporlar & yazdırma

Bir plan, paylaşabilene kadar tamamlanmış sayılmaz — bir şantiye toplantısı için kağıt üzerinde, bir sunumda bir resim olarak, veya nelerin geldiğinin ve nelerin zaten kaydığının bir genel bakışı olarak. **Rapor** sekmesi bunun için vardır, üç rapor türü ve bir baskı önizlemesiyle.

## Burada neler öğreneceksiniz

- **Rapor** sekmesindeki üç rapor türü: Gantt yazdırma, kilometre taşı özeti, variance.
- Baskı önizlemesinin nasıl çalıştığı: kağıt boyutu, yön ve hangi öğeleri açıp kapattığınız.
- Bir raporun nasıl gerçekten yazdırılacağı veya bir dosya olarak nasıl kaydedileceği.
- Bu uygulamada **Ctrl+P**'nin ne yaptığı.

## Rapor ekranına ulaşma

Aynı ekrana giden üç yol vardır: **Rapor** şerit sekmesine tıklayın, rapor ekranını doğrudan açan **Backstage → Yazdır**'a gidin, veya **Ctrl+P**'ye basın. Üçü de aynı yere varır — ayrı bir "yazdır" iletişim penceresi yoktur; rapor ekranı *baskı önizlemesinin kendisidir*.

Ekran iki sütuna bölünmüştür: solda üstte **Rapor türü** seçicisiyle bir ayarlar paneli, sağda soldaki ayarları değiştirdikçe anında güncellenen canlı bir önizleme.

## Üç rapor türü

### Gantt yazdırma

Gantt çubuklarının tam, biçimlendirilmiş bir çıktısı — bu, bir ayarlar bloğu olan tek rapor türüdür:

- **Kağıt**: A4, A3 veya A1.
- **Yön**: yatay veya dikey.
- **Kağıda otomatik sığdır** (açık = plan seçilen boyuta otomatik olarak ölçeklenir) veya otomatik sığdırmayı kapatırsanız manuel bir **yakınlaştırma** kaydırıcısı.
- **Çubuklarda görev adları**, **tamamlanmayı göster**, **kritik yol**, **bolluğu göster**, **bağımlılıklar**, **hafta sonları** ve **gösterge** için açma/kapamalar.
- Bir **şirket** alanı (proje ayarından otomatik doldurulur, ama burada ayrıca düzenlenebilir) ve **yazar** (proje bilgisinden, salt okunur).

Üstteki özet bloğu, projedeki görevlerin, yaprak görevlerin, kritik görevlerin ve ilişkilerin canlı sayısını gösterir.

### Kilometre taşı özeti

Projedeki her kilometre taşının bir tablosu: WBS, ad, tür (otomatik/başlangıç/bitiş), tarih, temeldeki kısıtlama veya son tarih, bolluk, kilometre taşının zorunlu olup olmadığı ve durum (planında / kritik / gecikmiş). Özet bloğu, toplam kilometre taşı sayısını, kaçının zorunlu ve kaçının gecikmiş olduğunu gösterir. Bu raporun kağıt boyutu/yön ayarları yoktur — tabloyu gösterildiği gibi tam olarak yazdırır.

### Variance

Mevcut planı etkin baseline ile karşılaştırır: baseline başlangıç/bitiş ile mevcut başlangıç/bitişi, başlangıç ve bitiş için iş günü farkını ve görev başına bir durumu (planında / geç / erken / yeni / kaldırıldı). Etkin bir baseline yoksa, ekran bunu boş bir rapor göstermek yerine açıkça belirtir. Özet bloğu ayrıca, varsa, projenin bitiş tarihindeki kaymayı iş günü cinsinden gösterir. Bu rapor size yararlı bir şey söyleyebilmesi için önce bir baseline'ın nasıl kaydedileceği için [Baseline'lar & ilerleme](docs://gids-baselines-voortgang) kılavuzuna bakın.

## Yazdırma ve dışa aktarma

Ayarlar panelinin altında her zaman bir **Yazdır...** düğmesi vardır — raporu içeren ayrı bir yazdırma penceresi açar ve hemen tarayıcı/işletim sistemi yazdırma iletişim penceresini tetikler. Gantt raporu için, o pencere seçilen kağıt boyutunu ve yönü kullanır; kilometre taşı ve variance raporları tabloyu gösterildiği gibi yazdırır.

Yalnızca Gantt raporunun bir de **PDF dışa aktar** düğmesi vardır. Bu, geçerli önizlemeyi gerçek bir PDF dosyası olarak kaydeder (dosya adı `-planning.pdf` ile biter) — seçilen kağıt boyutu ve yönün fiziksel boyutlarına ölçeklenmiş tek bir sayfa. PDF dosyası **vektör tabanlıdır**: çubuklar, çizgiler ve metin, tek bir gömülü resim yerine PDF çizim talimatları olarak saklanır, bu yüzden herhangi bir yakınlaştırma seviyesinde net kalır ve metin herhangi bir PDF görüntüleyicisinde seçilebilir ve aranabilir. Bu, Latin, Kiril ve Yunan metni için geçerlidir; proje Çince, Japonca, Korece, Arapça veya Farsça metin içeriyorsa, dışa aktarma o metin için otomatik olarak bir raster resme geri döner — hâlâ doğru şekilde görüntülenir, ama seçilebilir veya aranabilir değildir. Sistem yazdırma iletişim penceresinden geçmeden e-posta veya arşivleme için kullanışlıdır. Bunun yerine doğrudan yazdırmayı (veya yukarıda yapılandırılandan farklı bir kağıt boyutu seçmek için örneğin sistem iletişim penceresi üzerinden PDF'ye kaydetmeyi) tercih ediyorsanız, **Yazdır...**'ı kullanın.

## Pratikte raporlar

Her rapor türü farklı bir konuşmaya hizmet eder:

- **Gantt raporu**, klasik şantiye-toplantısı belgesidir: kritik yol vurgulanmış, kritik olmayan çubuklarda bolluk görünür, ve gösterge her rengin ne anlama geldiğini açıklar. Dinleyici planı henüz bilmiyorsa **çubuklarda görev adları** ve **tamamlanmayı göster**'i açın; ayrı bir görev listesi yanında verildiyse A1 üzerinde temiz bir genel bakış için bunları kapatın.
- **Kilometre taşı özeti**, düzinelerce görev satırında gezinmeden yalnızca önemli tarihleri isteyen herkes içindir — örneğin öncelikle zorunlu teslim tarihlerinin karşılanıp karşılanmadığını bilmek isteyen bir müşteri. Tablodaki bir kilometre taşı adından önceki ◆ sembolü **zorunlu** bir kilometre taşını işaretler.
- **Variance raporu**, rota düzeltme konuşmasıdır: hangi görevlerin baseline'a göre kaydığı ve kaç iş günü. Bu raporu pratikte, kendi ilerleme ve durum tarihiyle iki baseline'a (bir sözleşme baseline'ı ve bir değişiklik emrinden sonra yeniden temellendirme) sahip [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) örneğinde görün — baseline ile mevcut plan arasında gerçek bir fark olduğunda Δ sütunlarının nasıl doldurulduğunun iyi bir örneği.

Sağdaki canlı önizleme, soldaki ayarlardaki her değişiklikte yenilenir — ayrı bir "yenile" düğmesi yoktur ve hiçbir şey yalnızca yazdırma anında hesaplanmaz.

## Daha fazla okuma

- Bir variance raporunun karşılaştıracak bir şeyi olması için önce bir baseline kaydedilmiş olmalıdır — [Baseline'lar & ilerleme](docs://gids-baselines-voortgang) kılavuzunu okuyun.
- Gantt raporunda gösterilen kritik yol ve bolluk, Gantt görünümünün kendisiyle aynı hesaplamadan gelir — bunu nasıl okuyacağınız için [Kritik yol & ileri düzey analiz](docs://gids-kritiek-pad-analyse) kılavuzunu okuyun.
