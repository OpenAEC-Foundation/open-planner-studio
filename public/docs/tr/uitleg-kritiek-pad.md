# Kritik yol ve bolluk

Projenizin bitiş tarihi neden bu tarih? Ve hangi görev bir gün geç kalabilir, teslimi değiştirmeden? Kritik yol ile ilgili sorular bunlardır. Bu makale, uygulamanın tam olarak neyi hesapladığını bir uygulamalı örnekle açıklar.

## Kavram

Bir planlama, **ilişkiler** ile birbirine bağlı görevlerin bir ağıdır. İlişkiler anlaşmalardır, örneğin: “pencere çerçeveleri ancak çatı kapandıktan sonra takılır”. Bu ilişkiler görevleri birbirine bağlar. Bazı görev zincirleri diğerlerinden daha uzundur. En uzun zincir, tüm projenin ne kadar sürdüğünü belirler.

Bu en uzun zincire **kritik yol** denir. Bu yoldaki bir görev bir gün gecikirse, teslim de bir gün kayar. Bu zincirde boşluk yoktur.

Kritik yolun dışındaki görevlerin boşluğu vardır. Bu boşluğa **bolluk** denir. Dış tabakayı örmeye başlayan duvarcı, kimse fark etmeden iki gün geç başlayabilir. Bu iki gün, o görevin bolluğudur.

Yani kritik, bir görevin ne kadar önemli olduğunu söylemez. Yalnızca boşluk olmadığını söyler.

Hesaplama yöntemine **CPM** (Critical Path Method) denir. Bu yüzden *Özellikler* bölmesindeki sonuç bloğuna *CPM Sonucu* denir.

## Uygulama nasıl hesaplar

Uygulama planlamayı kendiliğinden yeniden hesaplamaz. Hesaplama **Hesapla** (F5) ile başlar, örneğin *Ana sayfa › Zamanlama › Hesapla* yolunu izleyerek. Son hesaplamadan sonra bir şey değiştiyse, durum çubuğu *Güncel değil — yeniden hesaplayın (F5)* gösterir. *Otomatik hesapla* açıksa (*Ayarlar › Proje › Uygulama ayarları* altında, *Planlama* sekmesinde, *Hesaplama* başlığında), uygulama bunu kendisi yapar.

Bir hesaplama, ağ üzerinden iki geçiş yapar.

### İleri geçiş

Uygulama proje başlangıcında başlar ve ilişkileri öncülden ardıla doğru izler. Her görev için uygulama, o görevin başlayabileceği en erken günü bulur. Bir görevin birden çok öncülü varsa, görev sonuncusunun bitmesini bekler. Bu, her göreve **erken başlangıç** ve **erken bitiş** verir. Tüm görevlerin en geç erken bitişi, proje bitişidir.

### Geri geçiş

Daha sonra uygulama, bu bitiş tarihinden başlangıca doğru geriye gider. Şimdi uygulama her görev için, bitiş tarihini kaydırmadan görevin bitmesi gereken son günü bulur. Bir görevin birden çok ardılı varsa, ilk başlaması gereken olan sayılır. Bu, **geç başlangıç** ve **geç bitiş** verir.

### Toplam ve serbest bolluk

Bir görevin geç ve erken tarihleri arasındaki fark, görevin **toplam bolluk**tur: proje bitişi kaymadan önce görevin kaç iş günü geç kalabileceği veya geç başlayabileceği. Uygulama, görevin takvimindeki iş günlerini sayar. Hafta sonu veya resmi tatil sayılmaz.

**Serbest bolluk** daha katıdır. Bu, bir ardılının daha geç başlamak zorunda kalmadan önce görevin sahip olduğu boşluktur. Bu boşluğu, başka hiçbir görev fark etmeden kullanabilirsiniz.

Toplam bolluk paylaşılabilir. İki kritik olmayan görev birbirini izlerse, aynı payı paylaşırlar. Birinci görev bu payı tüketirse, ikincisinde hiç kalmaz. Birinci görevin o zaman toplam bolluğu vardır, ama serbest bolluğu yoktur. Toplam bollukta serbest olmayan kısma **etkileşen bolluk** denir: bunu kullanırsanız, ondan sonraki görevler de kayar. Aşağıdaki örnek bunu sayılarla gösterir.

### Negatif bolluk

Bolluk negatif de olabilir. Bu, bir görevin son tarihi veya en geç bir tarih koyan bir kısıtlaması varsa ve bu tarih, uygulamanın o görev için hesapladığı tarihten önce kalıyorsa olur. Plana göre görev zaten geç kalmıştır; görev ve ondan önceki zincir kritik olur.

### Bir görev ne zaman kritiktir?

Varsayılan olarak bir görev, toplam bolluğu 0 veya daha az olduğunda kritiktir. Bu, *Ayarlar › Proje › Proje ayarları* altında, *Hesaplama profili ve seçenekleri* bloğunda, *Bu projenin hesaplama seçenekleri* bölümünde değiştirilebilir. *Uygula* tıkladığınızda uygulama planlamayı hemen yeniden hesaplar. Seçenekler uygulamaya değil, proje dosyasına aittir.

- **Kritik tanımı** ile *Toplam bolluk ≤ eşik* ve *Eşik (iş günü)* alanı. Eşik varsayılan olarak 0'dır. Bir tampon korumak için bunu 2 yapın. Örneğin: 2 iş günü veya daha az bolluğu olan her görev kritik sayılır ve kırmızıya döner. *En uzun yol* seçerseniz, bir görev son bitişe giden en uzun zincirin üzerinde olduğunda kritik olur. Bolluğu o zaman önemli değildir.
- **Birden çok bolluk yolu** zincirleri *Bolluk yolu* sütununda bolluklarına göre numaralandırır. Yol 1 kritik yoldur. Bkz. [Hesaplama seçenekleri ve kurallar](docs://ref-rekenopties-en-conventies).
- **Kritiğe yakın olarak işaretle** ile kendi *Eşik* değeri, varsayılan 2 iş günü. 0'dan büyük ama en fazla bu kadar bolluğu olan bir görev turuncu çubuk alır. Bu, hangi görevlerin neredeyse pay bırakmadığını gösterir, onlara kritik demeden.
- **Açık uçlu görevler kritik**: ardılı olmayan ve henüz bitmemiş bir görev kritik sayılır. Unutulmuş ilişkilere karşı bir güvenlik ağı olarak kullanışlıdır (aşağıdaki yanlış anlamalara bakın).
- **Bolluk hesabı**, toplam bolluğun görevin başında mı, sonunda mı yoksa ikisinin küçüğü olarak mı ölçüleceğini belirler. Yeni projeler *Otomatik (varsayılan)* olarak ayarlanır. Primavera P6 profilini kullanıyorsanız ve bu seçim *Bitiş bolluğu* değilse, Proje ayarları içinde turuncu bir blok bunu belirtir. Bloğun düğmesi seçimi *Bitiş bolluğu* olarak ayarlar. MS Project için aynı düğme seçimi *Otomatik (varsayılan)* olarak geri ayarlar: bir durum tarihiyle MS Project kendisi o şekilde hesaplar.

### Nerede görürsünüz

Kritik görevlerin Gantt'ta kırmızı bir çubuğu vardır. Kritik olmayan bir çubuğun arkasında, görevin geç bitişine kadar yeşil bir şerit vardır: bu bolluktur. Şerit, *Görünüm › Temel plan ve ilerleme › Bolluk bandı* ile açılır veya kapatılır.

Seçili bir görev için *Özellikler* bölmesi *CPM Sonucu* altında her şeyi listeler: erken ve geç başlangıç ve bitiş, toplam, serbest ve etkileşen bolluk ve görevin kritik yolda olup olmadığı. Tüm görevlerin bolluğu yan yana, *Hesaplanan* altındaki sütunlardadır (tablo başlığının sağındaki **+**). Örneğin *Toplam bolluk*, *Serbest bolluk*, *Kritik* ve *Kritiğe yakın*.

Alttaki durum çubuğu kritik görevleri sayar, örneğin *Kritik yol: 21 görev, 45 iş günü*.

## Uygulamalı örnek: House extension

Bu örnek, tüm ilişkiler tanımlı olduğunda aldığı haliyle, eğitimlerdeki uygulama projesi *House extension*'dur. 2 numaralı eğitimde (“İlişkiler ve kritik yol”) bunu kendiniz kurup sayıları kontrol edersiniz. Burada sayıların neden o olduğunu okursunuz.

Ek, 7 Haziran 2027 Pazartesi günü başlar. Hesaplamadan sonra teslim 6 Ağustos 2027 Cuma günüdür ve durum çubuğu *Kritik yol: 21 görev, 45 iş günü* yazar. İki görev kritik değildir: *Build outer cavity leaf* ve *Painting*.

### Buluşan iki zincir

Taşıyıcı döşeme (*Lay hollow-core floor*, 28 Haziran Pazartesi günü tamamlanır) bittikten sonra iş iki zincire ayrılır. İkisi de *Install window frames* ile biter:

- İç taraf: *Build inner cavity leaf* (5 iş günü), sonra *Place roof elements* (1), sonra *Apply roofing* (2). Pencere çerçeveleri ancak çatı kapandıktan sonra takılabilir.
- Dış taraf: *Build outer cavity leaf* (6 iş günü). Çerçeveler cephede yer alır, bu yüzden o da tamamlanmalıdır.

**İleri.** Her iki duvar tabakası da 29 Haziran Salı günü başlayabilir. İç tabaka 5 Temmuz Pazartesi günü biter. Çatı elemanları 6 Temmuz Salı günü yerleştirilir ve çatı kaplaması 7 ve 8 Temmuz Çarşamba ve Perşembe günlerinde takip eder. Dış tabaka 6 Temmuz Salı günü biter. *Install window frames*, iki zincirden sonuncusunu, yani çatı kaplamasını bekler ve bu yüzden 9 Temmuz Cuma günü başlar.

**Geri.** Çerçeveler en geç 9 Temmuz Cuma günü başlamalıdır, yoksa teslim kayar. Dolayısıyla dış tabaka en geç 8 Temmuz Perşembe günü bitmelidir. Altı iş günü geriye gidildiğinde, bu 1 Temmuz Perşembe günü bir geç başlangıçtır.

**Bolluk.** Dış tabaka en erken 29 Haziran günü başlayabilir ve en geç 1 Temmuz günü başlamalıdır. Aradaki 2 iş günü: 30 Haziran Çarşamba ve 1 Temmuz Perşembe. Bu, onun toplam bolluğudur; panel *Toplam bolluk: 2 gün* ve *Kritik yol: Hayır* gösterir. Serbest bolluk da 2 gündür, çünkü tek ardılı *Install window frames* kritik yolda yer alır.

İç zincirin bolluğu yoktur. Orada her bir gün geç kalma, çerçeveleri ve ondan sonraki her şeyi kaydırır.

### Painting

*Painting* (3 iş günü) sıva bittikten sonra, 26 Temmuz Pazartesi günü başlar ve 28 Temmuz Çarşamba günü biter. Sonraki görev, *Snagging and cleaning*, fayans döşemeyi de bekler. Fayans döşeme ancak 5 Ağustos Perşembe günü biter, çünkü şapın önce beş iş günü kurumalıdır. Bu yüzden *Painting* görevi 5 Ağustos Perşembe gününe kadar sürebilir. Bu, 6 iş günü bolluk verir: 29 ve 30 Temmuz ile 2 ila 5 Ağustos. Burada da serbest bolluk, toplam bollukla eşittir, çünkü ardıl kritiktir.

### Dış tabaka geç kaldığında

Dış tabaka 6 yerine 8 iş günü sürerse, 8 Temmuz Perşembe günü biter: tam olarak geç bitişi. Bolluk tükenir ve görev kırmızıya döner. İki zincir de o zaman kritiktir ve durum çubuğu 22 kritik görevi sayar. Teslim 6 Ağustos Cuma günü kalır.

9 iş günü sürerse, dış tabaka ancak 9 Temmuz Cuma günü biter. Çerçeveler 12 Temmuz Pazartesi'ye, teslim 9 Ağustos Pazartesi'ye kayar: bir iş günü sonra. Dış zincir artık kritik yoldur; durum çubuğu *Kritik yol: 19 görev, 46 iş günü* yazar.

İç zincirin o zaman 1 iş günü toplam bolluğu vardır, ama bu gün paylaşılır:

- *Build inner cavity leaf*: toplam bolluk 1, serbest bolluk 0, etkileşen bolluk 1. İç tabaka bir gün geç kalırsa, çatı elemanları onunla birlikte kayar.
- *Place roof elements*: toplam bolluk 1, serbest bolluk 0, etkileşen bolluk 1.
- *Apply roofing*: toplam bolluk 1, serbest bolluk 1. Yalnızca burada bir günlük geç kalma kimseye bir şey kaybettirmez.

Bu, tüm zincirin paylaştığı aynı tek gündür. İç tabaka onu kullanırsa, çatı elemanları ve çatı kaplaması için artık kalmaz.

### Kritiğe yakın ve negatif bolluk

*Kritiğe yakın olarak işaretle* açıkken, varsayılan eşik 2 iş günü ile, tam 2 gün bolluğu olan dış tabaka turuncu çubuk alır. *Painting* görevi, 6 gün bolluğuyla, mavi kalır.

Teslim 4 Ağustos Çarşamba günü için bir son tarih alırsa, bu, hesaplanan tesliminden iki iş günü önce olur ve bolluk negatif olur. Kritik yoldaki 21 görevin hepsi −2 iş günü toplam bolluk alır. Dış tabakanın bolluğu kalmaz ve o da kritik olur; *Painting* görevi 4 iş günü bolluk korur.

## Sonuçlar ve yanlış anlamalar

**“Kritik, önemli demektir.”** Hayır. Bir denetim çok önemli olabilir ve yine de bolluğu olabilir. Tersi de geçerlidir: basit bir iş kritik olabilir. Örnekte *Snagging and cleaning* kritik yoldadır. Kritik yalnızca zamanla ilgilidir: pay kalmamıştır.

**“Bu görevin bolluğu var, o yüzden bekleyebilir.”** Önce serbest bolluğa bakın. Bir görevin toplam bolluğu var ama serbest bolluğu yoksa, geç kalınan her gün ondan sonraki görevlerden pay alır; 9 iş günü örneğindeki iç tabaka gibi.

**Unutulmuş bir ilişki sahte bolluk verir.** Ardılı olmayan bir görev, proje sonuna kadar bolluk alır. Örnekte dış tabakadan çerçevelere olan ilişki eksik olsaydı, dış tabaka birden 23 iş günü bolluğa sahip olurdu, 6 Ağustos'taki teslime kadar. Kağıt üzerinde dış tabaka o zaman, çerçeveler beklemeden haftalarca geç kalabilirdi. *Açık uçlu görevler kritik* açıkken, dış tabaka bu durumda kritik olur ve bu boşluk görünür olur.

**Kritik yol sabit değildir.** Kritik olmayan bir görev bolluğundan daha geç kalırsa, başka bir zincir en uzun olur. Bunu yukarıda 9 gün duvar örgüsüyle gördünüz. Bu yüzden planlama her değişiklikten sonra yeniden hesaplanmalıdır. Durum çubuğu *Güncel değil* yazdığı sürece, kırmızı çubuklar hâlâ önceki hesaplamaya aittir.

**Bolluk iş günlerinde sayılır.** *Painting* görevinin 6 iş günü bolluğu, 29 Temmuz Perşembe'den 5 Ağustos Perşembe'ye kadar sürer: ajandada sekiz gün, çünkü hafta sonu sayılmaz. Takvimdeki resmi tatil veya inşaat tatili de sayılmaz.

## Ayrıca bakın

- [İlişki ekleme](docs://howto-relaties-leggen): görevler arasında ilişki oluşturmak ve bir gecikme ayarlamak için adımlar.
- [İlişkiler ve gecikme](docs://uitleg-relaties): ilişkilerin ve gecikmenin erken tarihleri nasıl belirlediği.
- [Kısıtlamalar ve son tarihler](docs://uitleg-constraints): bir kısıtlamanın veya son tarihin negatif bolluk nasıl ürettiği.
- [Bir yolu izleme](docs://howto-pad-traceren): bir görevin arkasındaki zinciri takip etmek.
- [Hesaplama seçenekleri ve kurallar](docs://ref-rekenopties-en-conventies): kritik tanımı, kritiğe yakın ve bolluk hesabı, seçenek seçenek.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): büyük bir proje: birden çok bolluk yolu, kritiğe yakın iş (eşik 3 iş günü), bir hamak, sabit bir tarih ve bir dış ilişki.
