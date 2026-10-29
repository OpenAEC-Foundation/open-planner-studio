# İlerleme, durum tarihi ve temel plan

Bir planlama bir tahmindir. İş başladığında, neyin bittiğini, neyin hâlâ yapılacağını ve bunun teslimi nasıl etkilediğini bilmek istersiniz. Bu makale uygulamanın ilerlemeyi nasıl işlediğini açıklar: durum tarihinin ne yaptığını, uygulamanın kalan işi nasıl hesapladığını, neden zaten başlamış bir görevin bazen hâlâ öncülünü beklediğini ve mevcut durumu ilk anlaşmayla nasıl karşılaştırdığınızı. Uygulamalı bir örnek sayıları gösterir.

## Kavram

**İlerleme**, gerçekte olan şeydir. Uygulama her görev için üç şey kaydeder: bir yüzde, bir **gerçek başlangıç** ve bir **gerçek bitiş**. Planlamanın tahmin ettiği değerler de yanında kalır. Gerçek olan, gerçekten olan şeydir.

**Durum tarihi**, durumu değerlendirdiğiniz gündür. Bu günden önce olan her şey bir olgudur. Hâlâ olması gereken her şeyi uygulama o günün başlangıcından planlar. Bir gerçek tarih durum tarihine denk gelebilir, ama asla bu tarihten sonra olamaz.

**Kalan iş**, bir görevde yapılacak olan iştir. %25 tamamlanmış, 4 iş günlük bir görevin 3 iş günü kalan işi vardır.

Bir **temel plan**, planlamanın belirli bir andaki anlık görüntüsüdür; genellikle anlaşmanın onaylandığı andır. Daha sonra gerçek planlamayı onun yanına koyarsınız ve işin gerçekte ne kadar saptığını görürsünüz.

## Uygulama nasıl hesaplar

Aşağıdaki örnek, yeni bir projenin hesaplandığı *Open Planner Studio* hesaplama profilini kullanır. Daha ilerde, Primavera P6 ve Microsoft Project profillerinde neyin farklı olduğunu okuyabilirsiniz.

Uygulama kendiliğinden yeniden hesaplamaz. İlerlemede veya durum tarihinde her değişiklikten sonra durum çubuğu *Güncel değil — yeniden hesaplayın (F5)* gösterir. **Hesapla** (F5) öğesine basın. Örneğin *Planlama › Zamanlama › Hesapla* yolunu izleyin. *Otomatik hesapla* açıksa (*Ayarlar › Proje › Uygulama ayarları* altında, *Planlama* sekmesinde, *Hesaplama* başlığında), uygulama bunu kendisi yapar.

### Durum tarihi

Durum tarihi üç şey yapar.

Birincisi, uygulama durum tarihinden sonraki bir gerçek tarihi kabul etmez. Durum tarihinin kendisindeki bir tarih uygundur.

İkincisi, henüz başlamamış iş geçmişte olamaz. Böyle bir görev durum tarihinden önce planlanmışsa, uygulama onu durum tarihine taşır. Bu, ardından gelen görevler için de geçerlidir; bunlar ilişkileri üzerinden birlikte kayar. Etkisini aşağıdaki örnekte görebilirsiniz. Microsoft Project profilinde uygulama bunu yapmaz.

Üçüncüsü, zaten devam eden bir görevin kalan işi durum tarihinin kendisinde başlar. Uygulama durum tarihini o günün başlangıcı olarak ele alır. Cuma günü çalışma saatleri bittikten sonra değerlendirme yaparsanız, durum tarihini Pazartesi olarak ayarlayın. Bunu Cuma olarak ayarlarsanız, uygulama kalan işi yine o Cuma planlar.

Henüz bir durum tarihiniz yoksa ve ilerleme girerseniz, uygulama durum tarihini bugüne ayarlar ve bunu size bildirir. Başka bir tarihi *Planlama › Temel plan ve ilerleme › Durum tarihi* altında ayarlarsınız. Durum tarihi olmadan uygulama devam eden bir görevi ileriye doğru kalan süresiyle, geriye doğru ise tüm süresiyle hesaplar. Bolluk o zaman negatif çıkar ve görev sebepsiz yere kritik görünür.

### Yüzde, gerçek tarihler ve kalan süre

Alanlar birbirine bağlıdır. Birini doldurursanız, uygulama diğerlerini doldurur.

- %0'dan büyükse görev başlamıştır. Bir gerçek başlangıç girmezseniz, uygulama planlanan başlangıcı alır. Görev durum tarihinden sonra başlamak üzere planlanmışsa, uygulama önce gerçekte ne zaman başladığını sorar.
- %100, tamamlandı anlamına gelir. Bir gerçek bitiş girmezseniz, bu durum tarihi olur; iş aslında daha önce bitmiş olsa bile.
- Bir gerçek bitiş, görevi %100 yapar. Tamamlanmış bir görevi yeniden %100'ün altına alırsanız, gerçek bitiş kaldırılır. Gerçek bitişi silerseniz, yüzde yeniden %0 olur ve gerçek başlangıcı da silene kadar görev *Devam ediyor* durumunda kalır.
- **Kalan süre**, süre çarpı hâlâ yapılması gereken orandır; tam iş günlerine yuvarlanır. 2 iş günlük bir görev için %0 ve %25 ikisi de 2 iş günü kalan iş verir; %50 ve %75 ikisi de 1 verir. %90'da uygulama 0'a yuvarlar: kalan iş o zaman durum tarihinde biter. Saat cinsindeki bir görev tam dakikalarla sayılır: %40'ta 5 saatlik bir görevin 3 saat kalan işi vardır.
- Bir kilometre taşında yalnızca bir gerçek tarih vardır.
- Bir faz (özet görev) kendi ilerlemesine sahip değildir. Hesaplamadan sonra yüzdesi, altındaki görevlerden gelir: onların yüzdelerinin ağırlıklı ortalaması; ağırlık, iş günü cinsinden süredir. Bir kilometre taşının ağırlığı 0'dır.

Zaten devam eden bir görevin süresini değiştirirseniz, yapılmış iş yapılmış olarak kalır. Yüzde kendiliğinden ayarlanır: %60 ile 5 iş günlük bir görevi 10 iş günü olarak ayarlarsanız, yüzde %30'a düşer. Uygulama, yapılmış işten kısa bir süreyi kabul etmez.

### Tamamlanmış ve devam eden görevler

Tamamlanmış bir görev gerçek tarihlerine sabitlenir. Artık kaymaz; durum tarihi varken hiçbir zaman kritik değildir. Durum tarihi olmadan tamamlanmış bir görev hâlâ kritik olabilir.

Devam eden bir görev gerçek başlangıcını korur. Yalnızca kalan iş kayar. Kalan işin nerede başladığı, ilerleme moduna bağlıdır.

### Retained Logic ve Progress Override

Bir görev zaten başlamışken öncülü hâlâ devam ediyorsa uygulama ne yapar? Bu tür bir ilişkiye **sıra dışı ilerleme** denir: ilerleme sıraya aykırıdır. Şunu düşünün: sıvacı başka bir yerde hâlâ meşgulken, boyacı sıvası yapılmış bir odada şimdiden çalışmaya başlar.

İki ilerleme modu, uygulamanın bunu nasıl hesapladığını belirler:

- **Retained Logic** (varsayılan): ilişki geçerliliğini korur. Ardılın kalan işi ilişkiyi izler: bitiş-başlangıç ilişkisinde yalnızca öncül bittikten sonra başlar ve asla durum tarihinden önce başlamaz.
- **Progress Override**: gerçeklik öne geçer. Ardılın kalan işi durum tarihinde başlar; öncülü beklemez.

Bu profilde fark yalnızca, öncülü henüz bitmemiş ama zaten başlamış görevlerin kalan işindedir. Diğer görevler iki modda da aynı şekilde hesaplanır. Uygulama böyle bir ilişkiyi iki modda da bildirir: durum çubuğunda *1 sıra dışı ilerleme* olarak ve *Uyarılar* bölmesinde.

### Temel planlar ve sapma

Kaydettiğinizde uygulama, alt görevi olmayan her görev için erken başlangıcı, erken bitişi, süreyi ve kilometre taşı türünü kaydeder. Fazlar bunun içinde yer almaz. Sonradan yaptığınız değişiklikler temel planı etkilemez. Birden fazla temel plan tutabilirsiniz; tam olarak biri **etkin** olur. Gantt, variance raporu ve İlerleme raporu, etkin temel planı kullanır.

**Sapma**, temel plan ile geçerli planlama arasındaki iş günü farkıdır. Artı işaret daha geç, eksi işaret daha erken anlamına gelir. Uygulama proje takvimine göre sayar. Variance raporu, görev başına başlangıç ve bitiş sapmasını verir. Durum yalnızca bitişe bağlıdır: artı için *Daha geç*, eksi için *Daha erken*, aksi halde *Planında*. Temel plandan sonra eklenen bir görev *Yeni* olarak adlandırılır; artık var olmayan bir görev *Kaldırıldı* olur.

İki açıklama var. Süre sapması görev tablosundadır (sütun *Süre sapması*), variance raporunda değil. Bu, görevin şu anki planlanmış süresini temel plandaki süreyle karşılaştırır. İlerleme bu planlanmış süreyi değiştirmez: iki gün olarak planlanmış ama üç gün süren bir görevin bitiş sapması +1, süre sapması ise 0'dır. Ayrıca, ilerleme girildikten sonra bir temel plan kaydederseniz, o durumu bu gerçek tarihlerle kaydeder; sapma o zaman sıfırdır.

İlerleme raporu, planlanmış ilerlemeyi gerçek ilerlemenin yanına koyar. İkisi de iş günü ile ağırlıklandırılır. Planlanmış ilerleme, temel plana göre durum tarihinde bitmiş olması gereken her görevin payıdır; gerçek ilerleme ise girilen yüzdedir.

### Nerede görürsünüz

Gantt'ta kesikli bir çizgi durum tarihini işaretler; tarih başlıkta yer alır. Devam eden her görevde çizgi, yüzdenin gösterdiği noktaya kadar çubukta dışa doğru kabarır. Bu **ilerleme çizgisidir**. İlerleme çizgisini kapatır ve durum tarihi çizgisini açık bırakırsanız, düz bir çizgi kalır; ikisi de kapalıysa çizgi ve etiket kaybolur. Düğmeler *Temel plan bindirmesi*, *İlerleme çizgisi* ve *Durum tarihi çizgisi*, *Görünüm › Temel plan ve ilerleme* altındadır ve hesaplamada hiçbir şeyi değiştirmez. Temel plan, her görev çubuğunun altında ince bir çubuk olarak görünür. Görev tablosunda ilerleme için sütunlar vardır; temel plan başına da sapma için sütunlar vardır. *Rapor* sekmesinde *Variance* ve *İlerleme raporu* rapor türlerini bulursunuz.

## Uygulamalı örnek: üç hafta sonra ek bina

Bu örnek, eğitimlerdeki alıştırma projesi *House extension* projesidir; tüm ilişkiler eklendikten sonraki durumdadır: inşaat tatili, kaynaklar ve saatler olmadan. 6. eğitimde bunu alıştırma projesinde kendiniz yaparsınız. O proje o zamana kadar daha fazla şey içerir, bu yüzden oradaki sayılar farklıdır. Burada sayıların neden öyle olduğunu okursunuz.

Ek bina Pazartesi 7 Haziran 2027'de başlar. Hesaplanmış planlamada uygulama, *Temel plan* adında bir temel plan kaydeder: Handover Cuma 6 Ağustos 2027, 45 iş günü.

### Pazartesi 28 Haziran'daki durum

Durum tarihi Pazartesi 28 Haziran 2027'dir. Olanlar şunlardır:

- *Start of construction*, *Set up site*, *Clear garden and paving* ve *Set out the extension* planlandığı gibi tamamlanmıştır; 7 ile 10 Haziran arasında.
- *Excavate foundation trench* 2 iş günü olarak planlanmıştı (Cuma 11 ve Pazartesi 14 Haziran), ama 3 iş günü sürdü: 11 ile 15 Haziran arasında.
- *Foundation formwork and reinforcement* 16 ile 18 Haziran arasında sürer. *Reinforcement inspection* 18 Haziran'dadır, *Pour foundation* Pazartesi 21 Haziran'dadır.
- *Foundation brickwork* (2 iş günü) Cuma 25 Haziran'da başladı ve %50'dedir.

**Hesapla** öğesinden sonra uygulama şöyle hesaplar:

- Foundation brickwork kalan işi 2 × (1 − 0,5) = 1 iş günüdür. Bu iş durum tarihinde başlar, dolayısıyla Pazartesi 28 Haziran'da biter.
- *Lay hollow-core floor* Salı 29 Haziran'da başlar. Sonuç olarak *Build inner cavity leaf* Salı 29 Haziran yerine Çarşamba 30 Haziran'da başlar. Handover Pazartesi 9 Ağustos'a gelir: temel planın bir iş günü sonrası. Kazıdaki bir fazla gün bu yüzden tüm projenin bir gün geç bitmesi demektir, çünkü o görev kritik yoldaydı.
- Durum çubuğu *Kritik yol: 13 görev, 46 iş günü* bildirir; ilerlemeden önce ise 21 görev ve 45 iş günüydü. Kritik yoldaki sekiz tamamlanmış görev artık sayılmaz.
- Faz *Foundations* %77,8'dedir. İçindeki görevlerin ağırlığı 2 + 3 + 1 + 2 + 1 = 9 iş günüdür. Bitenler 2 + 3 + 1 iş günü, artı 2'nin yarısı: toplam 7. Yani 9'un 7'si %77,8'dir. Kilometre taşı *Reinforcement inspection* görevinin ağırlığı 0'dır.

Variance raporu bunu temel planın yanına koyar:

- *Excavate foundation trench*: başlangıç 0, bitiş +1 (temel plan bitişi 14 Haziran, şimdi 15 Haziran).
- *Foundation brickwork*: başlangıç +1 (24 Haziran, 25 Haziran oldu), bitiş +1.
- *Build outer cavity leaf*: +1, +1. Bu görev hâlâ kritik değildir: 2 iş günü bolluğu vardı ve onu korur.
- *Handover*: +1. Proje bitişi 1 iş günü sapar.
- Toplamda 19 görev *Daha geç* durumunda, 4 görev *Planında* durumunda; hiçbir görev *Daha erken* durumunda değildir.

İlerleme raporu *Planlanan* %28,3 ve *Gerçekleşen* %23,9 gösterir. Görevlerin ağırlığı birlikte 46 iş günüdür. Temel plana göre 13 iş günü bitmiş olmalıydı: hazırlıkta 4 iş günü, kazı için 2, donatı için 3, dökme için 1, foundation brickwork için 2 ve hollow-core floor için 1. Gerçekte 11 bitmiştir: 4 + 2 + 3 + 1, artı foundation brickwork'ün yarısı, yani 1 iş günü.

### Durum tarihini değiştirirseniz ne olur?

Aynı ilerleme, farklı bir durum tarihi. Foundation brickwork kalan işi her zaman durum tarihinde başlar; bu yüzden Handover onunla birlikte kayar:

- Durum tarihi Cuma 25 Haziran: kalan iş Cuma 25 Haziran'a denk gelir, Handover Cuma 6 Ağustos'ta kalır.
- Pazartesi 28 Haziran: Handover Pazartesi 9 Ağustos.
- Salı 29 Haziran: Handover Salı 10 Ağustos, temel plandan 2 iş günü sonra.

### Yüzdeyi değiştirirseniz ne olur?

Foundation brickwork 2 iş günü sürer. %0 veya %25 ile kalan iş 2 iş günüdür: Salı 29 Haziran biter ve Handover Salı 10 Ağustos olur. %50 veya %75 ile 1 iş günüdür: Pazartesi 28 Haziran, Handover Pazartesi 9 Ağustos. %90 ile kalan iş 0'dır ve görev durum tarihinde biter.

### Durum tarihini ilerleme girmeden ayarlarsanız ne olur?

Durum tarihini yalnızca Pazartesi 28 Haziran olarak ayarlar ve hiçbir şey girmezseniz, planlamaya göre henüz hiçbir şey olmamıştır. Henüz başlamamış iş geçmişte olamaz. Uygulama bu yüzden her şeyi 28 Haziran'a taşır: *Start of construction* o zaman o gündedir ve Handover Cuma 27 Ağustos'a gelir; temel plandan 15 iş günü sonra. Bu yüzden önce mevcut ilerlemeyi girin.

## Uygulamalı örnek: sıvacı ve boyacı

Şimdi ilerleme modu için bir örnek. Aynı ek bina, ama farklı bir durum: bugün Çarşamba, 21 Temmuz 2027. *Install building services* dahil her şey plana göre bitti. *Plastering* (4 iş günü) Salı, 20 Temmuz'da başladı ve %25 seviyesinde. *Painting* (3 iş günü) sıvanın ardından gelir, ama boyacı bugün zaten başladı ve %33 seviyesinde.

İlerleme girilmeden önce sıva Salı, 20 Temmuz ile Cuma, 23 Temmuz arasında planlanmıştı. Boyama ise Pazartesi, 26 Temmuz ile Çarşamba, 28 Temmuz arasında planlanmıştı. Durum çubuğu şimdi *1 sıra dışı ilerleme* gösterir: boyama başladı, ama sıva henüz bitmedi. *Uyarılar* bölmesinde şu yazar: *Sıra dışı: ardılın ilerlemesi ilişkiyle çelişiyor*.

Sıvanın 4 × (1 − 0,25) = 3 iş günü kalan işi var: 21, 22 ve 23 Temmuz. Boyamanın 3 × (1 − 0,33) = 2 iş günü kalan işi var.

- Bir **Retained Logic** ile bu kalan iş yalnızca sıva bittikten sonra başlayabilir. Bu, Cuma, 23 Temmuz'dur. Bu yüzden boyama Pazartesi, 26 Temmuz'da başlar ve Salı, 27 Temmuz'da biter. Çubuk, 21 Temmuz'daki gerçek başlangıçtan 27 Temmuz'a kadar uzanır. Toplam bolluk 7 iş günüdür.
- Bir **Progress Override** ile kalan iş durum tarihinde başlar. Boyama Perşembe, 22 Temmuz'da biter; bu, sıva henüz bitmeden olur. Toplam bolluk 10 iş günüdür.

Teslim her iki durumda da Cuma, 6 Ağustos'ta kalır: boyamanın zaten bolluğu vardı.

### Diğer hesaplama profilleri

Primavera P6 ve Microsoft Project hesaplama profillerinde bu örnekteki boyama aynı tarihlerde biter (27 ve 22 Temmuz). Ancak şu noktalarda farklılık gösterirler. Bunlar profilin kurallarıdır. Bunları *Ayarlar › Proje › Proje ayarları* altında, *Hesaplama profili ve seçenekleri* bloğunda bulursunuz.

- Microsoft Project hesaplama profilinde, başlamamış görevler durum tarihine taşınmaz (kural *Başlamamış görevleri durum tarihine taşıma*). Yukarıdaki örnekte yalnızca bir durum tarihi ayarlar ve hiçbir şey girmezseniz, bu profildeki teslim Cuma, 6 Ağustos'ta kalır.
- Microsoft Project hesaplama profilinde kalan iş, gerçek başlangıç ile zaten geçen süreden önce de başlamaz (kural *Kalan iş geçen süreden sonra devam eder*). Bu, durum tarihinin yanında ek bir alt sınırdır: ikisinden sonra olan geçerlidir. Örnek olarak *Build inner cavity leaf* görevine bakın (5 iş günü). Görev Salı, 29 Haziran'da başladı. Durum tarihi Çarşamba, 30 Haziran'da %40 seviyesinde. (İki ekip aynı anda duvar örüyor, bu yüzden %40 bir günde zaten yapılmış.) Bundan önceki her şey plana göre bitti. Open Planner Studio ve Primavera P6 görevin Cuma, 2 Temmuz'da bitmesine izin verir. Microsoft Project ise Pazartesi, 5 Temmuz'da biter. Çünkü Salı, 29 Haziran artı geçen 2 iş günü Perşembe, 1 Temmuz eder ve bu tarih durum tarihinden sonradır.
- Primavera P6, devam eden bir görevin erken başlangıcı olarak, gerçek başlangıç yerine kalan işin başlangıcını gösterir (bu örnekte Çarşamba, 30 Haziran). *Başlangıç* sütunu ve çubuk ise her profilde gerçek başlangıcı gösterir.
- Primavera P6 hesaplama profilinde, Progress Override altında, zaten başlamış bir ardıla olan ilişki öncül için de sayılmaz. Bu ilişki öncülün geç tarihlerini ve serbest bolluğunu artık sınırlamaz (kural *Progress Override başlamış bir ardılı geriye doğru da yok sayar*). Sıvacı ve boyacı örneğinde bunu görmezsiniz. Çünkü sıva, döşeme şapı üzerinden zaten kritiktir. Geç tarihler ve serbest bolluk, Retained Logic ve Progress Override altında aynıdır.
- Bir .xer dosyası açtığınızda uygulama ilerleme modunu dosyadan alır. Uygulama, üçüncü P6 modu olan Actual Dates'i bilmez; böyle bir dosya Retained Logic ile hesaplanır.

## Sonuçlar ve yanlış anlamalar

**"Durum tarihini sadece ileri alacağım."** Bunu ileri alırsanız, devam eden görevlerin kalan işi yeni tarihte başlar. Henüz başlamamış iş bu tarihten önce asla olamaz. Bu yüzden durum tarihini yalnızca ilerleme güncellemesiyle birlikte ileri alın.

**"%100 girmek gerçek bitişi kaydeder."** Bu yalnızca gerçek bitişi de girerseniz doğrudur. Gerçek bitiş olmadan bir görevi %100 yaparsanız, bitiş durum tarihi olur. Görev aslında daha önce bittiyse, gerçek bitişi doldurun.

**"%0 başlamadı demektir."** Bir görevin gerçek başlangıcı varsa, %0 olsa bile başlamış sayılır. Kalan iş o zaman tam süredir ve durum tarihinde başlar. Görevi yeniden başlamamış saymak için gerçek başlangıcı silin.

**"Progress Override uyarıyı çözer."** Sıra dışı uyarısı kalır. Mod yalnızca uygulamanın nasıl hesapladığını belirler. İlişki artık doğru değilse, ilişkiyi değiştirin.

**"Görevi böl ile ayrılan görevdeki ara düşer."** Hayır: hâlâ yapılacak kısımdaki ara, kalan işte kalır. Bir görev düşünün: 5 iş günü, 2 iş günü çalıştıktan sonra 1 günlük bir ara. Görev Salı, 29 Haziran'da başladı ve durum tarihi Çarşamba, 30 Haziran iken %40'tır. Kalan 3 iş günü durum tarihinde başlar ve ara boyunca devam eder: bitiş Pazartesi, 5 Temmuz'dur. Ara olmasaydı, bitiş Cuma, 2 Temmuz olurdu.

**Saatler ve durum tarihi.** Şerit üzerinden bir saat giremezsiniz: durum tarihini bir tarih olarak doldurursunuz. Çalışma saatlerinden sonra değerlendirme yapıyorsanız, durum tarihini bir sonraki iş gününe ayarlayın. Saat cinsinden bir görev, kalan işi durum tarihinin başlangıcından hesaplar. Alıştırma projesinde, eğitim 4'ten sonra, her şey ondan önce bittiğinde *Lay hollow-core floor* görevine bakın: 5 saat, Pazartesi, 28 Haziran; iş günü 07:00'de başlar. Durum tarihi Pazartesi, 28 Haziran ve görev %40 ise, 3 saat kalan iş vardır. Bu, 07:00 ile 10:00 arasında sürer; o sabah zaten iş yapılmış olsa bile. Uygulama saatleri nasıl saydığını [Günler ve saatler](docs://uitleg-dagen-en-uren) bölümünde açıklar.

**Temel planı güncellemek.** Bu mümkün değildir. Yeni bir temel plan kaydedersiniz ve eskisini silersiniz. Projeyi taşırsanız, gerçek tarihler ve durum tarihi birlikte taşınır. Temel planlar ise varsayılan olarak taşınmaz; böylece kayma, sapma olarak görünür kalır. Bkz. [Projeyi taşıma](docs://howto-project-verplaatsen).

## Ayrıca bakın

- [İlerlemeyi güncelleme](docs://howto-voortgang-bijwerken): durum tarihini ayarlama ve ilerleme girme.
- [İlerlemeyi elektronik tablodan içe aktarma](docs://howto-voortgang-importeren): saha ekibinden ilerlemeyi tek seferde okuma.
- [İlerleme modunu seçme](docs://howto-voortgangsmodus-kiezen): Retained Logic veya Progress Override ayarlama.
- [Temel plan kaydetme ve yönetme](docs://howto-baseline-opslaan-en-beheren): bir temel plan kaydetme ve kullanma.
- [Projeyi taşıma](docs://howto-project-verplaatsen): gerçek tarihlere, durum tarihine ve temel planlara ne olduğu.
- [Kritik yol ve bolluk](docs://uitleg-kritiek-pad): bir görevin neden kritik olduğu ve bolluğun ne anlama geldiği.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): projenin ortasında ilerleme ve bir durum tarihi (20 Mayıs 2027).
