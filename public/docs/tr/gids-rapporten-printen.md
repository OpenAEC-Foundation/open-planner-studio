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
- **Yazı boyutu** — %90, 100, 110 veya 125; yukarıdaki yakınlaştırma seviyesinden bağımsız olarak rapor metnini, satır yüksekliğini ve üstbilgi/altbilgiyi ölçeklendirir.
- **Üstbilgiyi her sayfada yinele** — varsayılan olarak açık; rapor üstbilgisini yalnızca ilk sayfada değil, yazdırılan her sayfada görünür tutar.
- **Zaman çizelgesi şu kadar sayfaya yayılsın** — Gantt zaman çizelgesini yan yana 1 ile 8 sayfa arasında yayar; yalnızca otomatik sığdırma açıkken kullanılabilir.
- **Çubuklarda görev adları**, **tamamlanmayı göster**, **kritik yol**, **bolluğu göster**, **bağımlılıklar**, **hafta sonları** ve **gösterge** için açma/kapamalar.
- Bir **şirket** alanı (proje ayarından otomatik doldurulur, ama burada ayrıca düzenlenebilir) ve **yazar** (proje bilgisinden, salt okunur).

Rapordaki ilişki çizgileri, Gantt görünümüyle aynı görsel dili kullanır: **düz** bir çizgi belirleyici (driving) bir ilişkidir, **kesikli** bir çizgi belirleyici olmayan bir ilişkidir ve iki kritik görev arasındaki belirleyici bir ilişki **kırmızıdır**. *Kritik yol*'u kapatırsanız bu çizgiler de nötr hale gelir. Alttaki gösterge bu farkı özetler. İlk hesaplamadan önce her çizgi nötr ve düz çizilir — önce *Hesapla*'ya (F5) basın.

Üstteki özet bloğu, projedeki görevlerin, yaprak görevlerin, kritik görevlerin ve ilişkilerin canlı sayısını gösterir. Ayarlar paneli seçimlerinizi oturumlar arasında hatırlar — Rapor sekmesini daha sonra tekrar açtığınızda kağıt boyutu, açma/kapamalar, yazı boyutu ve gerisi tam olarak bıraktığınız gibi geri gelir. Yalnızca şirket alanı sıfırlanır: her zaman projenin kendi ayarından başlar, böylece bir rapor asla başka bir projenin şirket adını devralmaz.

### Kilometre taşı özeti

Projedeki her kilometre taşının bir tablosu: WBS, ad, tür (otomatik/başlangıç/bitiş), tarih, temeldeki kısıtlama veya son tarih, bolluk, kilometre taşının zorunlu olup olmadığı ve durum (planında / kritik / gecikmiş). Özet bloğu, toplam kilometre taşı sayısını, kaçının zorunlu ve kaçının gecikmiş olduğunu gösterir. Bu raporun kağıt boyutu/yön ayarları yoktur — tabloyu gösterildiği gibi tam olarak yazdırır.

### Variance

Mevcut planı etkin baseline ile karşılaştırır: baseline başlangıç/bitiş ile mevcut başlangıç/bitişi, başlangıç ve bitiş için iş günü farkını ve görev başına bir durumu (planında / geç / erken / yeni / kaldırıldı). Etkin bir baseline yoksa, ekran bunu boş bir rapor göstermek yerine açıkça belirtir. Özet bloğu ayrıca, varsa, projenin bitiş tarihindeki kaymayı iş günü cinsinden gösterir. Bu rapor size yararlı bir şey söyleyebilmesi için önce bir baseline'ın nasıl kaydedileceği için [Baseline'lar & ilerleme](docs://gids-baselines-voortgang) kılavuzuna bakın.

## Yedi tablo raporu

Diğer rapor türleri doğrudan son hesaplamadan alınan tablolardır. Birkaç ortak kural vardır: yalnızca
**yaprak görevler** aktivite sayılır (özet görevler yalnızca İKY özetinde görünür; hamak görevler hiç
görünmez); **referans günü** projenin durum tarihidir — durum tarihi yoksa rapor bugünü kullanır ve
bunu belirtir; tarihler ve bolluklar son **hesaplamadan** (F5) gelir, o zamandan beri değişen bir
program bir notla belirtilir ve PDF dışa aktarımı her zaman önce yeniden hesaplar; her raporun
oturumlar arasında hatırlanan küçük bir **Rapor seçenekleri** bloğu vardır. İş günleri *ig* olarak
kısaltılır.

### İleriye bakış (look-ahead)

Haftalık şantiye toplantısının listesi: önümüzdeki *N* haftanın (varsayılan dört) tüm aktiviteleri —
ne başlıyor, ne sürüyor, ne bitiyor — artı çoktan olmuş olması gerekenler. Satır başına: İKY, ad,
başlangıç ve bitiş, kalan süre, tamamlanma, toplam bolluk, kritik veya kritiğe yakın, atanan
kaynaklar ve bir durum: **Başlıyor**, **Devam ediyor**, **Başlamış olmalıydı** veya **Gecikmiş**.
Tüm pencereyi kapsayan bir aktivite de listelenir.

### Kritik ve kritiğe yakın

Hangi aktiviteler proje bitişini belirliyor ve hangileri buna yaklaşıyor. Kritiklik hesaplamadan
gelir; *kritiğe yakın*, seçeneklerdeki eşiğe kadar (varsayılan 5 iş günü) 0'dan başlayan toplam
bolluk ya da programlama seçeneklerindeki işaretlemedir. Tamamlanan görevler hariç tutulur. Bolluk
yolu, sonra bolluk, sonra başlangıca göre sıralanır; serbest bolluk ve yol numarasıyla.

### İlerleme raporu

Durum tarihinde periyodik "neredeyiz" özeti. Özet, temel ve tahmini bitişi iş günü farkıyla,
**planlanan** ile **gerçekleşen** ilerlemeyi (her ikisi de yaprak görevlerin süresine göre
ağırlıklı; planlanan etkin temel planın tarihlerinde, yoksa mevcut programda) ve duruma göre
sayımları verir. Altında beş bölüm: geçen dönemde tamamlananlar, devam edenler, gelecek dönemde
başlayanlar, gecikmişler ve açık kritik aktiviteler. Dönem (varsayılan iki hafta) geriye baktığı
kadar ileriye de bakar.

### Program sağlığı

DCMA 14 maddelik değerlendirme ruhunda otomatik bir program incelemesi. Her kontrol bir önem ve
sayı alır; altında görev veya ilişki başına bulgular: **hatalar** (negatif bolluk, kaçırılan son
tarih, ihlal edilen kısıt, tutarsız ilerleme), **uyarılar** (açık başlangıç veya bitiş, uzun süre,
öne almalar, sert kısıtlar, sıra dışı ilerleme) ve **bilgi** (kritiğe yakın, yüksek bolluk, uzun
gecikmeler). Eşikler seçeneklerdedir; varsayılan DCMA'ya göre: yüksek bolluk ve uzun süre için 44
iş günü, gecikmeler için 10. Temiz bir programda sıfır hata vardır.

### Haftalık kaynak yükü

Kaynak ve hafta başına, mevcut kapasiteye (birim-gün) karşı gereksinim, fark, günlük tepe ve haftanın
aşırı yüklü olup olmadığı — **Kaynaklar** sekmesindeki histogramla aynı hesaplama, tablo halinde.
Yalnızca gereksinimi olan haftalar listelenir; *Yalnızca aşırı yüklü haftalar* ile sadece darboğazlar
kalır.

### Kaynak atamaları

Kaynak başına atanan aktiviteler: İKY, ad, başlangıç ve bitiş, kalan süre, günlük birim,
tamamlanma, kritik ve durum. Tamamlanan görevler varsayılan olarak hariçtir. Hafta cinsinden bir
pencereyle *kaynak ileriye bakışı* olur. Özet, kaynaksız görevleri de sayar.

### İKY özeti

Program, seçilebilir bir seviyeye kadar İKY öğesi başına toplanır — yönetim görünümü. Öğe başına:
başlangıç ve bitiş, temel başlangıç ve bitiş, süre, süreye göre ağırlıklı ilerleme, temel plana göre
bitiş farkı, en küçük toplam bolluk ve aktivite sayısı; bunların kritik, devam eden ve tamamlanan
kısmı. Bir seviye (varsayılan 2) veya tam İKY seçin, isterseniz aktivitelerin kendisiyle.

## Yazdırma ve dışa aktarma

Ayarlar panelinin altında her zaman bir **Yazdır...** düğmesi vardır — raporu içeren ayrı bir yazdırma penceresi açar ve hemen tarayıcı/işletim sistemi yazdırma iletişim penceresini tetikler. Gantt raporu için, o pencere seçilen kağıt boyutunu ve yönü kullanır; kilometre taşı ve variance raporları tabloyu gösterildiği gibi yazdırır.

Yalnızca Gantt raporunun bir de **PDF dışa aktar** düğmesi vardır. Bu, geçerli önizlemeyi gerçek bir PDF dosyası olarak kaydeder (dosya adı `-planning.pdf` ile biter) — seçilen kağıt boyutu ve yönün fiziksel boyutlarına ölçeklenmiş tek bir sayfa. PDF dosyası **vektör tabanlıdır**: çubuklar, çizgiler ve metin, tek bir gömülü resim yerine PDF çizim talimatları olarak saklanır, bu yüzden herhangi bir yakınlaştırma seviyesinde net kalır ve metin herhangi bir PDF görüntüleyicisinde seçilebilir ve aranabilir. Bu, Latin, Kiril, Yunan, Arapça ve Farsça metin için geçerlidir — Arapça ve Farsça da şekillendirilip vektör metin olarak gömülür. Çince, Japonca ve Korece metin isteğe bağlıdır: bu glifleri sağlayan bir yazı tipi uzantısı yükleyin, o zaman bu metin de vektör olarak gömülür (seçilebilir ve aranabilir); böyle bir uzantı yoksa bu metin bir raster resim olarak dışa aktarılır — hâlâ doğru şekilde görüntülenir, ama seçilebilir veya aranabilir değildir. Sistem yazdırma iletişim penceresinden geçmeden e-posta veya arşivleme için kullanışlıdır. Bunun yerine doğrudan yazdırmayı (veya yukarıda yapılandırılandan farklı bir kağıt boyutu seçmek için örneğin sistem iletişim penceresi üzerinden PDF'ye kaydetmeyi) tercih ediyorsanız, **Yazdır...**'ı kullanın.

## Pratikte raporlar

Her rapor türü farklı bir konuşmaya hizmet eder:

- **Gantt raporu**, klasik şantiye-toplantısı belgesidir: kritik yol vurgulanmış, kritik olmayan çubuklarda bolluk görünür, ve gösterge her rengin ne anlama geldiğini açıklar. Dinleyici planı henüz bilmiyorsa **çubuklarda görev adları** ve **tamamlanmayı göster**'i açın; ayrı bir görev listesi yanında verildiyse A1 üzerinde temiz bir genel bakış için bunları kapatın.
- **Kilometre taşı özeti**, düzinelerce görev satırında gezinmeden yalnızca önemli tarihleri isteyen herkes içindir — örneğin öncelikle zorunlu teslim tarihlerinin karşılanıp karşılanmadığını bilmek isteyen bir müşteri. Tablodaki bir kilometre taşı adından önceki ◆ sembolü **zorunlu** bir kilometre taşını işaretler.
- **Variance raporu**, rota düzeltme konuşmasıdır: hangi görevlerin baseline'a göre kaydığı ve kaç iş günü. Bu raporu pratikte, kendi ilerleme ve durum tarihiyle iki baseline'a (bir sözleşme baseline'ı ve bir değişiklik emrinden sonra yeniden temellendirme) sahip [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) örneğinde görün — baseline ile mevcut plan arasında gerçek bir fark olduğunda Δ sütunlarının nasıl doldurulduğunun iyi bir örneği.

Sağdaki canlı önizleme, soldaki ayarlardaki her değişiklikte yenilenir — ayrı bir "yenile" düğmesi yoktur ve hiçbir şey yalnızca yazdırma anında hesaplanmaz.

## Daha fazla okuma

- Bir variance raporunun karşılaştıracak bir şeyi olması için önce bir baseline kaydedilmiş olmalıdır — [Baseline'lar & ilerleme](docs://gids-baselines-voortgang) kılavuzunu okuyun.
- Gantt raporunda gösterilen kritik yol ve bolluk, Gantt görünümünün kendisiyle aynı hesaplamadan gelir — bunu nasıl okuyacağınız için [Kritik yol & ileri düzey analiz](docs://gids-kritiek-pad-analyse) kılavuzunu okuyun.
