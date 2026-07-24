# Baseline'lar & ilerleme

Hiç güncellemediğiniz bir plan bir tahmindir. İş başladıktan sonra, aynı anda iki şeyi görmek istersiniz: aslında ne üzerinde anlaşıldığı ve şu anda gerçekte ne olduğu. Bir **baseline** birincisini dondurur; **ilerleme** ve **durum tarihi** ikincisini takip eder. Bu kılavuz, bir baseline'ın nasıl kaydedileceğini ve yönetileceğini, sapmanın nasıl görünür kılınacağını, ilerlemenin nasıl girileceğini ve durum tarihinin planınıza tam olarak ne yaptığını gösterir.

## Burada neler öğreneceksiniz

- Bir baseline kaydetme ve yönetme, ve hangi baseline'ın etkin olduğu.
- Sapmayı görme: Gantt'taki baseline bindirmesi ve variance raporu.
- İlerleme girme — yüzde, gerçekleşen tarihler — panel, görev iletişim penceresi ve bağlam menüsü üzerinden.
- Durum tarihi: henüz başlamamış görevlere ve işaretlenmemiş kilometre taşlarına ne yaptığı.
- Sıra dışı uyarılar: ne anlama geldikleri ve nasıl çözüleceği.
- İlerleme çizgisini okuma.

[Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc)'i (başlangıçtan önce bir baseline, artı projenin ortasında ilerleme ve bir durum tarihi) ve [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc)'i (iki baseline — bir sözleşme baseline'ı ve bir değişiklik emrinden sonra yeniden temellendirme — kendi ilerleme ve durum tarihleriyle) takip edin.

## Bir baseline kaydetme ve yönetme

**Baselines** penceresini **Planlama** sekmesindeki **Baseline ve ilerleme** şerit grubu üzerinden açın: **Baseline kaydet…** önerilen bir adla ("Baseline 1 — [tarih]") hemen yeni bir baseline kaydeder, **Baseline'ları yönet…** aynı pencereyi incelemek, yeniden adlandırmak veya silmek için açar.

Pencere, her kaydedilmiş baseline'ı gösteren bir tablo görüntüler: bir **Etkin** radyo düğmesi, **Ad** (doğrudan düzenlenebilir), **Oluşturulma** tarihi ve bir silme düğmesi. Aynı anda tam olarak bir baseline etkin olabilir — Gantt bindirmesinin ve variance raporunun karşılaştırdığı baseline budur. Etkin baseline'ı silmek onay ister (siz başka birini seçene veya yeni bir tane kaydedene kadar sonrasında hiçbir baseline etkin kalmaz). Plan son hesaplamadan bu yana güncel değilse, pencere "Yeni baseline kaydet"in yanında önce yeniden hesaplama ipucu gösterir — güncel olmayan bir plana karşı kaydedilen bir baseline, yanlış tarihleri dondurur.

Bir baseline bir anlık görüntüdür: kaydettiğiniz andaki her görevin başlangıcı, bitişi ve (kilometre taşları için) tarihi. Planı sonrasında daha fazla değiştirin, siz kendiniz yeni bir tane kaydedene kadar baseline değişmeden kalır.

## Sapmayı görme

### Gantt'ta: baseline bindirmesi

Bindirmeyi **Görünüm → Baseline ve ilerleme şerit grubu → Baseline bindirmesi** üzerinden açın. Her görev çubuğunun altında, baseline renginde, orijinal baseline tarihlerinde ince bir alt çubuk (veya bir kilometre taşı için bir elmas) görünür. Ana çubuk alt çubuğunu geçerse, ayrı bir rapor açmadan, bir görevin baseline'a göre ne kadar kaydığını bir bakışta görebilirsiniz.

### Bir rapor olarak: variance raporu

**Rapor** sekmesine gidin, **Rapor türü** için **Variance**'ı seçin. Rapor, görev başına şunları gösterir: **Baseline başlangıcı**, **Baseline bitişi**, **Mevcut başlangıç**, **Mevcut bitiş**, **Δ başlangıç (ig)**, **Δ bitiş (ig)** ve bir **Durum** (**Planında**, **Daha geç**, **Daha erken**, baseline'dan bu yana eklenen görevler için **Yeni**, veya bu yana kaldırılan görevler için **Kaldırıldı**). Üstte, rapor görev sayısını, kaçının daha geç ve kaçının daha erken olduğunu toplar, ve — proje bitiş tarihi kaymışsa — baseline'a göre iş günü farkının sayısıyla bir satır. Etkin bir baseline yoksa, rapor boş bir tablo göstermek yerine bunu açıkça belirtir.

## İlerleme girme

İlerlemeyi, hepsi aynı etkiye sahip üç yerde ayarlarsınız:

1. **Özellikler paneli** — seçili bir görev altındaki **İlerleme** bölümü: **ilerleme (%)** için bir kaydırıcı, ve (normal bir görev için) **Gerçek başlangıç**/**Gerçek bitiş** alanları, veya (bir kilometre taşı için) tek bir **Gerçek tarih** alanı. Yüzdeyi bir gerçek başlangıç tarihi olmadan %0'ın üzerine itin, ve otomatik olarak planlanan erken başlangıçla doldurulur; %100'ün altına geri çekin ve girmiş olduğunuz herhangi bir gerçek bitiş yeniden temizlenir.
2. **Görev iletişim penceresi** — **Görevi düzenle** penceresindeki aynı **İlerleme** bölümü.
3. **Bağlam menüsü** — bir göreve sağ tıklayın, **İlerleme** alt menüsü, sabit adımlarla **%0**, **%25**, **%50**, **%75** ve **%100**. Bir panel açmadan hızlı bir güncelleme için kullanışlıdır; ara bir yüzde veya belirli bir gerçek tarih için paneli veya görev iletişim penceresini kullanın.

Gerçek tarihler asla durum tarihinden daha geç olamaz — daha geç bir tarih girmeyi deneyin ve uygulama bunu bir hatayla reddeder. Bu kasıtlı bir sınırdır: bir "gerçek" (gerçekten olan bir şey), tanım gereği, ilerlemeyi kaydettiğiniz ana göre gelecekte yer alamaz.

## Durum tarihi

**Durum tarihi** (Planlama sekmesindeki **Baseline ve ilerleme** şerit grubu, **Durum tarihi** alanı), plan içinde "bugün"ü işaretler — ilerlemeyi kaydettiğiniz an. Ayarlandıktan sonra, aynı anda iki şey yapar:

- Henüz başlamamış herhangi bir görev veya kilometre taşı (%0 tamamlanmış, gerçek başlangıç yok), mantık (öncüller, ilişkiler) aksi takdirde daha erken bir başlangıca izin verse bile, durum tarihinden daha erken başlayamaz. Hesaplanan erken başlangıcı durum tarihine "taban alınır".
- Zaten başlamış veya bitmiş görevler gerçek tarihlerini korur — bunlar asla durum tarihi tarafından üzerine yazılmaz.

Bunu orta boy örnek projede tam olarak görebilirsiniz: durum tarihi 20 Mayıs 2027'ye ayarlıyken, farklı evlerde çalıştıkları ve durum-tarihi tabanı olmadan çeşitli, daha erken tarihlerde başlamış olacakları halde, henüz başlamamış birkaç görevin (örneğin farklı evlerdeki duvarcılık ve tesisat işi) erken başlangıcı tam olarak o tarihe sabitlenmiştir.

### İşaretlenmemiş bir kilometre taşı neden "sağa kayar"

Hesaplamada bir kilometre taşı sıfır süreli bir görevden başka bir şey değildir, bu yüzden aynı kural geçerlidir: henüz tamamlandı olarak işaretlenmediyse (%100 yok, gerçek tarih yok), hesaplanan tarihi durum tarihinden önce olamaz. Kilometre taşını tamamlandı olarak işaretlemeden durum tarihini ileri itmeye devam edin, ve Gantt'taki görüntülenen tarihi, temeldeki görevler hakkında hiçbir şey değişmemiş olsa bile, onunla birlikte sağa kaymaya devam eder — plan etkin bir şekilde "henüz işaretlemediyseniz bu an geçmişte olamaz" diyordur. Kilometre taşını bir gerçek tarihle tamamlandı olarak işaretlediğiniz anda, o sabit tarihe geri döner ve kaymayı durdurur.

## Sıra dışı uyarılar

Bir durum tarihi olduğunda, hesaplama ayrıca kaydedilen gerçeklerin (gerçek başlangıç/bitiş tarihleri) ilişkilerin mantığıyla çelişmediğini de kontrol eder — örneğin öncülü, plana göre henüz bitmemiş olması gerekirken zaten başlamış bir ardıl. Bu tür durumlar **sıra dışı (out-of-sequence)** olarak adlandırılır ve ekranın altındaki durum çubuğunda bir uyarı olarak görünür ("N sıra dışı ilişki"), sayı için bir araç ipucuyla. Bu bir uyarıdır, engelleyici bir hata değildir — hesaplama yine de devam eder.

Bir sıra dışı uyarısını, gerçek durumu doğru bir şekilde kaydederek çözün: eksik veya yanlış gerçek başlangıç/bitiş tarihini ilgili görevlerde doldurun (yukarıdaki gibi panel, görev iletişim penceresi veya bağlam menüsü üzerinden), böylece kaydedilen gerçekler mantıksal olarak önce gelmesi gerekenlerle tekrar hizalanır. Çoğu zaman bu basitçe şu anlama gelir: aslında zaten bitmiş bir görev, planda henüz öyle işaretlenmemişti.

## İlerleme çizgisi

İlerleme çizgisini **Görünüm → Baseline ve ilerleme şerit grubu → İlerleme çizgisi** üzerinden açın. Bu, her görev için, tamamlanma yüzdesine karşılık gelen konumda bir nokta çizen ve bunu durum tarihine bağlayan turuncu kesikli bir çizgi çizer (4/4 kesik, durum-tarihi çizgisiyle aynı stil) — klasik zikzak deseni. Durum tarihinin solunda bir kırılma, bir görevin geçen süreye göre beklenenin gerisinde olduğu anlamına gelir; sağında bir kırılma önde olduğu anlamına gelir. İlerleme çizgisi, zikzağın omurgası olarak durum-tarihi dikeyini zaten kendi başına çizer, bu yüzden ayrı **Durum tarihi çizgisi** açma/kapama (aynı şerit grubu) ilerleme çizgisi açıkken geri çekilir — yalnızca ilerleme çizgisini kapattığınızda ve durum tarihinin düz bir dikey çizgi olarak gösterilmesini hâlâ istediğinizde tekrar görünür hale gelir.

## Okumaya devam edin

- Pratikte başlangıçtan önce bir baseline ve ortada ilerlemeyi görün: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Pratikte iki baseline'ı görün (Sözleşme → değişiklik emrinden sonra yeniden temellendirme): [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Kaynaklar ve yükleri de her F5'te yeniden hesaplanır — aşırı atama ve nivelleme için [Kaynaklar, histogram & nivelleme](docs://gids-resources-histogram) kılavuzunu okuyun.
- İlerleme ve bir durum tarihi, zaten sabitlenmiş bir görevde negatif bolluk üretebilir — bunu nasıl okuyacağınız için [Kritik yol & ileri düzey analiz](docs://gids-kritiek-pad-analyse) kılavuzunu okuyun.
