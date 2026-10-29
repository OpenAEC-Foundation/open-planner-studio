# İyi planlama

Bir planlamayı iyi yapan nedir? Düzenli görünmesi değil, çalışmalar başladıktan sonra önemli soruya yanıt vermesidir: bu gecikirse teslim tarihine ne olur? Bu makale güvenilir bir planlamanın ardındaki ilkeleri açıklar. Ayrıca bu ilkelerin Open Planner Studio'da neden bu kadar ağır bastığını anlatır: uygulama yalnızca girdiğiniz verilerle hesaplar, başka hiçbir şeyle hesaplamaz.

Örnekler inşaattan gelir: taşıyıcı yapı işleri, ince işler, tedarik süreleri, hava koşullarından kaynaklanan gecikme, taşeronlar ve sözleşmeye bağlı bir teslim tarihi. Ancak bu ilkelerin kendisi inşaata özgü değildir.

## Kavram

İyi bir planlama, umduğunuz şeyin bir resmi değil, bir **hesaplama modelidir**: süreli görevler, ilişkilerle bağlanmış, bir takvimde. Uygulama tarihleri bu modelden hesaplar. Bir şey değiştiğinde model yeniden hesaplanır ve bunun geri kalan için ne anlama geldiğini hemen görürsünüz.

Bir planlamacı sabit bir sırayla çalışır:

1. Hedef: kilometre taşları ve teslim tarihi.
2. Ayrıştırma: aşamalar, iş paketleri, görevler.
3. Her görevin süresi.
4. İlişkiler.
5. Kısıtlamalar ve sabit tarihler.
6. Takvimler.
7. Kaynaklar.
8. Kritik yol ve bolluk.
9. Temel plan ve ilerleme.
10. Gözden geçirme.

Bu sıra bir görgü kuralı değildir. Bir adımı atlarsanız sürpriz olarak geri döner: ilişkisi olmayan görevler birlikte kaymaz, takvimi olmayan süreler yanlış olur ve yalnızca sonradan alınan bir temel plan anlaşmayı değil, gecikmeyi dondurur.

## Uygulama bununla nasıl hesaplar

Aşağıdaki her ilke, uygulamanın yaptığı bir şeyle bağlantılıdır. Bu yüzden bu bölüm aynı sırayı izler.

### Hedeften başlayın, görevlerden değil

Önce sabit anları yazın. Yalnızca sonra bu anlar arasına sığması gereken işi yazın. Örnekler: şantiye hazırlığının başlangıcı, iznin kesinleşmesi, binanın su geçirmez hale gelmesi, bitirme işlerinin başlangıcı, teslim. Bunlar **kilometre taşlarıdır**: süresi olmayan noktalar. Bunları gerçekten *Ana sayfa › Görevler › Kilometre taşı ▾* yolu ile kilometre taşı olarak girersiniz. Adı bir kilometre taşına benzeyen, süresi sıfır gün olan bir görev olarak girmezsiniz.

Bu sıranın nedeni şudur: bir görev listesinden başlayan bir planlama bir toplama dönüşür. Bir toplam ise nadiren sözleşmedeki tarihe denk gelir. Kilometre taşlarından başlayın. Doğru soru o zaman hemen ortaya çıkar. Soru şu değildir: “bütün bunlar birlikte ne kadar sürer?” Soru şudur: “iş bu iki an arasına sığar mı? Sığmazsa neyin değişmesi gerekir?” Gerekli teslim tarihinden geriye doğru çalışın: binanın en geç ne zaman su geçirmez olması gerektiğine kadar. Oradan başlangıca kadar da geriye gidin.

Sözleşmeyle sabitlenen bir teslim, *Zorunlu (sözleşmesel)* onay kutusunu alır. Böylece dosyayı açan herkes görür: bu an ne pazarlığa açıktır ne de taşınabilir. Onay kutusu Gantt ve raporlar için bir işarettir. Bir tarihi korumaz. Bunu bir son tarih veya bir kısıtlama ile yaparsınız (aşağıya bakın).

### Ayrıştırma: aşamalar, iş paketleri, görevler

Kilometre taşlarının altında yapıyı kurarsınız: aşamalar, bunların altında iş paketleri, bunların altında görevler. Bunu girintileyerek yaparsınız. Alt görevleri olan bir görev otomatik olarak bir **özet görev** olur. Uygulama çubuğunu ve süreyi altındaki görevlerden hesaplar. Bu yüzden bir özet görev için hiçbir zaman kendiniz süre girmeyin.

Ayrıntı düzeyi için bir pratik kural: **bir görev yaklaşık bir gün ile iki hafta arasında sürer**. Bir günden kısa bir görev, projeyi değil şantiyenin günlük işlerini planladığınız anlamına gelir. Bu, şantiye şefinin haftalık planına aittir. Aylarca geçerli kalması gereken bir planlamaya değil. İki haftadan uzun bir görev ise doğru tahmin edemeyeceğiniz ve yürütme sırasında izleyemeyeceğiniz bir görevdir: “finishing ground floor, 40 days, 45% complete” kimseye işlerin iyi gidip gitmediğini söylemez. Bu yüzden planlama incelemeleri sık sık yaklaşık iki aydan uzun süren görevleri sayar. Birkaç yüzdenin üzerinde olduğunda bu, yetersiz ayrıntı sayılır.

Çok ince olmak, çok kaba olmak kadar zarar verir. Her görev bakım ister: çizilecek ilişkiler, kaydedilecek ilerleme, her değişiklikten sonra yeni bir değerlendirme. Altı aylık bir proje için iki bin görevlik bir planlama daha doğru olmaz, bakımsız olur. Ve kimsenin güncellemediği bir planlama üç hafta içinde kurguya dönüşür. Her hafta dürüstçe ilerleme raporlayabileceğiniz düzeyi seçin.

Pratikte: “3. Finishing” bir aşamadır, “Finishing house 4” bir iş paketidir, “Plastering house 4 ground floor” beş günlük bir görevdir. Teslim süreleri ve gözetim için üst sınırı bilerek aşabilirsiniz. On haftalık bir pencere çerçevesi teslimi gerçekten bölünmez bir bekleme bloğudur. Sürekli gözetim ise yapay parçalardan oluşan bir dizi yerine bir hamakta yer almalıdır.

### Süreyi tahmin etmek

Bir süre, işin ne kadar süreceğinin bir tahminidir. Ne kadar hızlı gidebileceğinin tahmini değildir. Gerçekten alacağınız ekiple, normal bir gün için tahmin edin. En iyi ekiple, en iyi gün için tahmin etmeyin. İyimserlik zincir boyunca birikir. Her görevin en iyi günü varsaydığı bir planlama, teslim tarihine neredeyse hiç ulaşmaz.

Gün mü saat mü, bu biçim meselesi değil, gerçek bir seçimdir. Şantiyede temposu belirleyen işler için **gün** seçin: duvar örme, sıvama, fayans. Beş gün sürer; bir gün sekiz saat de olsa dokuz saat de olsa fark etmez. Saatlerin kendisi birim olduğunda ve günün kalanı önemli olduğunda **saat** seçin: üç saatlik bir inceleme, iki güne yayılan on dört saatlik bir beton dökümü, vardiyalı çalışma. Uygulama bu seçimi görev başına saklar. Bu seçeneği yalnızca önce *Saat planlamasını etkinleştir* ayarını açtığınızda görürsünüz; bkz. [Gün ve saatler](docs://uitleg-dagen-en-uren).

Riski tek tek sürelerin içine gizlemeyin. Her yere bir gün eklemek payı gömer. Artık kimse onu göremez veya yönlendiremez. Ve pay gerçekten gerekli olduğunda, çok küçük çıkar. Payı görünür yapın: teslim tarihinden önce açık bir tampon görevi ya da ayrı bir hava payı. Çifte saymaya dikkat edin. Hollanda inşaatının hesapladığı yaklaşık 180 çalışılabilir iş günü, sözleşmeye dayalı bir yıllık rakamdır (UAV). Bu rakamdan resmi tatiller, inşaat tatili *ve* kayıp günler zaten düşülmüştür. Tatiller ve inşaat tatili projenizin takviminde zaten varsa, ayrı bir kalem olarak yalnızca hava kaynaklı aksama kalır. Don ve fırtına kaynaklı aksama, Onwerkbaar weer Bouw & Infra toplu iş sözleşmesindeki kendi kurallarına tabidir. Bu beklenen kayıp günleri takvime veya ayrı bir kaleme koyun. Duvar işinin süresinin içine gizlemeyin.

### İlişkiler: ağ olmadan bu bir planlama değildir

Uygulama tarihleri **ilişkiler** boyunca hesaplar. Bir görev yalnızca öncülleri izin verdiğinde başlar. İlişkisi olmayan bir görev hiçbir şeye bağlı değildir. Kaba yapı işleri iki hafta kayarsa, bağlantısız bir bitirme görevi bunu izlemez. Planlama ise hiçbir şey kırmızıya dönmeden yanlış bilgi verir.

Bu yüzden her görevin en az bir öncülü ve en az bir ardılı olmalıdır. Yalnızca projenin ilk görevi ve son kilometre taşı bu kuraldan muaftır. Bir planlama incelemesinde bu ilk kontroldür. Mantığı eksik olan görevler birkaç yüzdeyi geçmemelidir.

**Bitiş-başlangıç varsayılandır**. Öyle de kalmalıdır: temel tamamlanır, sonra kaba yapı işleri başlar. Sağlıklı bir inşaat planlamasında ilişkilerin yaklaşık dokuzu bitiş-başlangıçtır. Bu bir okunabilirlik gereksinimidir. Bitiş-başlangıç, şantiyedeki herkesin açıklama olmadan anladığı tek türdür. Yürütme sırasında da öngörülebilir davranır.

**Gecikmeli başlangıç-başlangıç** bekleyen değil, gerçekten yan yana ilerleyen iş içindir. Klasik örnek bir sıra ev veya katları olan bir kuledir: montajcı duvar örmenin üç gün arkasından gelir. Bu, üç günlük gecikmeli bir başlangıç-başlangıç ilişkisidir. Yapay olarak parçalanmış bir görev için bitiş-başlangıç değildir. Yanına bir bitiş-bitiş ilişkisi koyun. Yoksa ardıl, teoride öncülünden önce bitebilir. İnşaatta başlangıç-bitiş neredeyse hiç kullanılmaz.

Başlangıç-başlangıç ilişkisini tercihen aşamalar arasında değil, görevler arasında çizin. Bir başlangıç-başlangıç veya başlangıç-bitiş ilişkisinin öncülü bir aşamaysa, uygulama ardılı o aşamadaki **en son** başlayan görevi bekletir, ilk başlayanı değil. Böylece asla çok erken planlamaz. Ama bazen istediğinizden daha geç planlar. Öncülü bir aşama olan bitiş-başlangıç ve bitiş-bitiş ilişkisi, o aşamadaki son görev bitene kadar bekler. Bu genellikle tam olarak istediğiniz şeydir.

Gecikmeleri az kullanın, özellikle negatif olanları. Bir gecikme, görünür bir nedeni olmayan bekleme süresidir. Sonradan kimse, neden aralarında yedi gün olduğunu söyleyemez. Beton kürlemesi ise bunu takvim günü cinsinden bir gecikme yapın (beton hafta sonu da kürlenir). Ya da daha iyisi, herkesin görebileceği ve izleyebileceği gerçek bir “curing” görevi yapın. Negatif bir gecikme, yani öne alma veya bir örtüşme, gerçekten hiç olmamalıdır. Bir planlama incelemesinde norm sıfırdır. Örtüşme istiyorsanız, öncülü bölün veya bir başlangıç-başlangıç kullanın.

### Kısıtlamalar ve sabit tarihler: mümkün olduğunca az

Her görev “mümkün olduğunca erken” başlar. Çoğu durumda da böyle kalmalıdır. Bir **kısıtlama**, ilişkilerin yanındaki bir tarih sınırıdır. Ne kadar çok eklerseniz, planlamanız o kadar az hesaplanır ve o kadar çok bir çizime dönüşür. Sabit tarihlerle dolu bir plan istikrarlı görünür. Tam da bu nedenle riski gizler: artık kaymaz, bu yüzden artık uyarı vermez.

Bir kısıtlamayı yalnızca planlamanın kendisinin etkisi olmayan, sert bir dış tarih için kullanın. Örneğin: 1 Mart'tan önce kesinleşmeyecek izin (*Şu tarihten önce başlamaz (SNET)*), belediyenin verdiği kapanma penceresi veya altyapı şirketinin bağlantı tarihi. “Bu görevi mayısta istiyorum” dış bir gerçek değildir. Bunu mantık veya farklı bir süreyle çözersiniz. Pratik bir kural: kalan görevlerin en fazla birkaç yüzdesinde sert bir tarih sınırı olur.

Bir görevi yerine oturtmak için hiçbir zaman başlangıç tarihi yazmayın. Öncülü olan bir görevde uygulama, yazılan (veya sürüklenen) bir başlangıcı *Şu tarihten önce başlamaz (SNET)* kısıtlamasına çevirir. Görev o zaman istediğiniz yerdedir. Önündeki bütün zincir gecikse bile orada kalır.

Bir tarihi hesaplamayı yönlendirmeden izlemek istiyorsanız, bir **son tarih** kullanın. Hiçbir şeyi taşımaz. Ama görev ona artık uymadığı anda negatif bolluk ve bir uyarı verir. Tam da görmek istediğiniz sinyal budur. Aşırı durumlar için sert bir sabitleme (*Zorunlu (sabitleme mantığı)*) kullanın. Bunun önündeki zincirde negatif bolluk vereceğini bilin. Bu, planlamanın bir şeyin uymadığını söylemesidir. Bir şeyin bozuk olduğu anlamına gelmez.

### Takvimler: önce proje, sonra istisnalar

Tüm süreler, bir takvimin iş günlerinde veya çalışma saatlerinde sayılır. Bu yüzden süreleri girmeden önce proje takvimini düzgünce kurun: iş günleri, çalışma saatleri, resmi tatiller ve inşaat tatili. Yarısında düzelttiğiniz bir takvim bütün planlamanızı kaydırır. Öngörülebilen kapanmaları hemen ekleyin: beton dökmediğiniz don dönemini, Noel ile Yılbaşı arasındaki firma kapanmasını.

Bir kaynağa kendi takvimini yalnızca gerçekten farklıysa verin. Örneğin haftada dört gün gelen cephe ustası veya yaz tatilini farklı alan bir ekip. Bir kaynak takvimi bir görevin tek bir tarihini bile değiştirmez. Tarihler görevin veya proje takviminde hesaplanmaya devam eder. Kaynak takvimi yalnızca kaynağın görevin bir iş gününde çalışmadığını gösterir. Histogramda aşırı atanmışlık olarak görünür. Kendiniz oluşturduğunuzu bilmiyorsanız bu farkı görmek zordur.

### Kaynaklar: kim yapar, ve bu mümkün mü

Kaynaksız bir planlama sorunun yalnızca yarısını yanıtlar. Ekipleri ve ekipmanı atadığınız anda histogram, yalnız bir zaman çizelgesinin gösteremediğini gösterir: 14 Haziran'da üç sıvama ekibine ihtiyaç duyduğunuzu, oysa iki ekibiniz olduğunu.

Önce sıkıntı yaratan kaynaklarla başlayın. Her vidayı dahil etmeniz gerekmez; kule vinç, kendi ekipleriniz, kapasite tavanı olan taşeronlar ve uzun teslim süreleri dahil edilir. Her kaynağa dürüst bir kapasite verin. İki sıvacı, iki anlamına gelir. “İki, ama acil durumda üç” anlamına gelmez.

Histogramı bir hata olarak değil, bir soru olarak okuyun. Çizginin üzerindeki kırmızı, planlamanın o gün elinizde olandan fazlasını istediği anlamına gelir. Bazen yanıt şudur: kaydırın. Çoğu zaman yanıt şudur: bu işe yaramaz, ve bunu öğrenmek istediğim de buydu. **Dengeleme**, talep kapasitenin içine sığana kadar görevleri kaydırır. Bitiş tarihinin esneyebiliyorsa buna izin verin. Teslim tarihi sabitse yalnızca bolluk içinde dengeleyin (onay kutusu *Yalnızca bolluk içinde dengele (yumuşatma) — proje bitiş tarihi sabit kalır*). Bitiş tarihi o zaman yerinde kalır ve uygulama kalan çakışmayı bildirir. Bu, yalnızca çözülmüş gibi görünen bir planlamadan daha dürüst bir sonuçtur.

Talep yapısal olarak kapasiteden büyükse *dengelemeyin*. Dengeleme, mevcut işi zaman içinde yeniden düzenler. Ekstra sıvacı işe almaz veya ikinci bir vinç kurmaz. Aynı anda aynı ekibe ihtiyaç duyan üç kule, dengelemeden sonra da aynı ekibe ihtiyaç duyan üç kuledir. Tek değişen şey, teslimin ileri kaymasıdır. O zaman işe yarayan şey aşamalandırma, ek kapasite veya farklı iş yapmaktır. Mantığınız ve süreleriniz yerine oturmadan da dengelemeyin. Yarın farklı olacak bir planlamayı dengelemiş olursunuz.

### Kritik yol ve bolluk: planlamanın kırılgan olduğu yer

Uygulama her değişiklikte yeniden hesaplamaz. **Hesapla** (F5) komutuyla hesaplayın ve ancak sonra okuyun. Durum çubuğu *Güncel değil — yeniden hesaplayın (F5)* gösteriyorsa, önceki hesaplamaya bakıyorsunuz, bu hesaplamaya değil. *Otomatik hesapla* ayarıyla uygulama bunu kendisi yapar.

**Kritik yol**, bolluğu olmayan zincirdir. Orada kaybedilen her gün, teslimin bir gün geç olması demektir. Gözetiminiz ve en iyi çalışanlarınız oraya gider. Yalnızca kırmızıya bakmayın. **Toplam bolluk**, bir görevin teslimi etkilemeden ne kadar geç kalabileceğini söyler. **Serbest bolluk** ise ardılını kaydırmadan ne kadar geç kalabileceğini söyler. Fark, kimsenin bitiş tarihini etkilemez. Ama birinin işini zorlaştırır. Bu, iki kez yeniden planlayamayacağınız taşeronlarla çalıştığınızda işe yarar.

Üç işarete dikkat edin. Birkaç günlük bolluğu olan bir görev güvenli bir görev değil, kritiğe yakın bir görevdir. *Kritiğe yakın olarak işaretle* ile bu tür görevler kendi rengini alır. Aşırı bir bolluk miktarı olan bir görev (planlama incelemelerinde 44 iş gününden, yaklaşık iki aydan fazla) neredeyse her zaman bir ardıl eksik demektir. Bu sizi doğrudan ağınızdaki boşluklara yönlendirir. Negatif bolluk ise asla bir hesaplama hatası değildir. Bu, bir son tarihin veya sabit bir tarihin uymadığını söyleyen planlamadır.

### Başlamadan önce temel plan, sonra güncel tutun

Planlama onaylanır onaylanmaz ve kürek toprağa girmeden önce bir **temel plan** kaydedin (*Planlama › Temel plan ve ilerleme › Temel planları yönet…*). Önce hesaplayın: temel plan son hesaplamanın tarihlerini saklar. Bu referans olmadan daha sonra yalnızca işlerin *farklı gittiğini* söyleyebilirsiniz. Ne kadar farklı olduğunu veya ne zamandan beri farklı olduğunu söyleyemezsiniz. Tam da bunu şantiye toplantısında, ek işlerde ve aksama tartışılırken istersiniz.

Bir temel plan tarihleri saklar, ama arkasındaki varsayımları saklamaz. Aksama tartışılmaya başlar başlamaz tam da bunlar sorulur. Bu yüzden kaydederken, bu planlamanın neye dayandığını kısaca yazın (planlama pratiğinde: *planlama dayanağı*). Hangi verimlilik rakamlarını kullandığınızı, hangi takvimi ve neden o şekilde kurduğunuzu yazın. Planlamanın dışında bilerek neyi bıraktığınızı, varsaydığınız teslim sürelerini kimin verdiğini ve planlamayı kimin onayladığını yazın. Yarım sayfa yeterlidir.

Bundan sonra güncel tutmak bir proje değil, bir ritimdir. Her hafta aynı sırayla güncelleyin: **durum tarihini** rapor tarihine ayarlayın. Başlayanlar ve bitenler için gerçek başlangıç ve bitiş tarihlerini girin. Devam eden işlerin kalan süresini düzeltin ve hesaplayın. Tek başına bir yüzde yetmez. Gerçek tarihler, daha sonra bakılacak olan olgusal kayıttır.

Durum tarihinin ne yaptığını bilin. Henüz başlamamış işi uygulama durum tarihine taşır. Ondan sonraki görevler de onunla birlikte kayar (hesaplama profili Microsoft Project hariç). Yani bitmiş bir görevi veya kilometre taşını onaylamayı unutursanız, o kendiliğinden sağa kayar. Bu bir hata değildir. Planlama modelinin, geçmişte bir şeyin hâlâ olabileceğini ileri sürmeyi reddetmesidir. *Sıra dışı* uyarısı alırsanız, iş mantığın öngördüğünden farklı bir sırayla yapılmıştır. Bu genellikle sırayı gözden geçirmek için bir nedendir, uyarıyı tıklayıp geçmek için değil. Yeni bir temel planı yalnızca kapsamda gerçek bir değişiklik için yapın. Ve o zaman da ilkinin üzerine değil, yanına yapın.

Sonuç olarak: bir planlama yalnızca işi yapan insanlar ona inanırsa güvenilirdir. Şantiye şefinin ve taşeronların haftalık planı bu planlamayla karşılaştırmasını sağlayın. Hafta hafta, kararlaştırılanın yalnızca yarısını başarıyorsanız, sorun çoğu zaman yürütmede değil, planlamadadır.

## Örnek: planlamayı sessizce yanıltan üç seçim

Bu sayılar Yardım'da başka yerlerde işlenen iki örnekten gelir: eğitimlerdeki alıştırma projesi *House extension* ve bir ek bina için küçük bir ağ. Burada asıl konu, her seçimin planlamanızı nasıl etkilediğidir. Bunu eğitim 2'de (ilişkiler ve kritik yol) ve eğitim 3'te (bir kısıtlama ve bir son tarih) kendiniz deneyin.

### Unutulan bir ilişki

*House extension* projesinde inşaat 7 Haziran 2027 Pazartesi günü başlar ve teslim 6 Ağustos Cuma günüdür. *Build outer cavity leaf* (6 iş günü) görevinin ardılı *Install window frames* görevidir, çünkü pencere çerçeveleri cephededir. Bu ilişkiyle *outer leaf* görevinin 2 iş günü bolluğu vardır.

Bu ilişkiyi unutursanız, *outer leaf* görevinin bolluğu birden 23 iş günü olur; teslime kadar. Kâğıt üzerinde, kimse beklemeden haftalarca gecikebilir. Hiçbir şey kırmızıya dönmez ve uyarı da çıkmaz. Yalnızca hesaplama seçeneği *Açık uçlu görevler kritik* ile, ardılı olmayan böyle bir görev kritik olur ve boşluk göze çarpar.

### İlişki yerine yazılan bir tarih

Küçük ağ: *Groundwork* (3 iş günü), *Pour foundation* (2), *Brickwork* (5) ve *Roofing* (3), 7 Haziran 2027 Pazartesi gününden başlayarak art arda. Proje 23 Haziran Çarşamba günü tamamlanır.

*Brickwork* için 21 Haziran Pazartesi başlangıcı yazarsanız, çünkü tuğlalar ancak o zaman gelir, bu bir *şu tarihten önce başlamaz (SNET)* kısıtlamasına dönüşür. *Brickwork* görevi bir hafta kayar ve proje 30 Haziran Çarşamba günü tamamlanır. *Groundwork* ve *Pour foundation* 5 iş günü bolluk kazanır ve artık kritik değildir. Tuğlalar sonunda daha erken gelirse, *Brickwork* görevi 21 Haziran'da kalır: şu an tarih yönlendirir, ilişkiler değil.

Bunun yerine, temel bitmeden önce 9 Haziran Çarşamba yazarsanız, hiçbir şey olmaz: ilişkiler *Brickwork* görevinin yine de yalnızca 14 Haziran Pazartesi günü başlamasına izin verir.

### Kısıtlama yerine bir son tarih

*Roofing* işinin 18 Haziran Cuma günü bitmesini istiyorsanız, orada bir son tarih tanımlayın. Hiçbir şey kaymaz: *Roofing* görevi Pazartesi 21 ile Çarşamba 23 Haziran arasında kalır. Ama zincirin bolluğu −3 iş günü olur ve uygulama *Son tarih 18-06-2027 kaçırıldı — erken bitiş 23-06-2027* uyarısını verir. Böylece anlaşmanın tutmadığını hemen görürsünüz; arkasındaki zincirin karşılamadığı hâlde yerinde duran bir çubuk görmezsiniz.

## Sonuçlar ve yanlış anlamalar

- **Öncülü veya ardılı olmayan görevler.** En yaygın olanı ve en zararlısı: bu görevler birlikte kaymaz ve sahte bolluk alır.
- **Tarih yazmak veya çubukları sürüklemek, ilişkileri kurmak yerine.** Bu, sessizce bir kısıtlama belirler.
- **Çok fazla kısıtlama ve yer imi olarak kullanılan sert bir sabitleme.** Planlama artık hesaplamaz, çizer.
- **Üç aylık görevler veya yarım günlük görevler.** Kullanışlı aralık yaklaşık bir gün ile iki hafta arasıdır.
- **İyimser süreler ve her görevin içine gizlenmiş pay** tampon olarak görünür olmak yerine.
- **Hava kaynaklı aksama ve inşaat tatili takvimde yok.** Bunlar ocakta yine de takvime girer.
- **Görev yerine gecikme kullanmak.** Adı verilmemiş yedi günlük bekleme süresi üç ay sonra açıklanamaz.
- **İlişkiler tanımlanmadan dengeleme yapmak**, ya da yapısal bir kapasite eksikliğine karşı dengelemeye devam etmek.
- **Hesaplamayı unutmak.** Durum çubuğunda *Güncel değil* yazıyorsa, bir önceki hesaplamaya bakıyorsunuz demektir.
- **Temel plan yok, ya da temel planın yalnızca başlangıçtan sonra alınması.**
- **İlerlemenin yalnızca yüzde olarak kaydedilmesi**, gerçek tarihler ve durum tarihi olmadan.
- **Okumadan *Uyarılar* panelini kapatmak.** Kaçırılan son tarihler, ihlal edilen kısıtlar, mantık sırasına aykırı ilişkiler ve aşırı atanmış kaynaklar burada bir araya gelir (*Planlama › Planlama › Uyarılar*).

## Ayrıca bakın

- [Kritik yol ve bolluk](docs://uitleg-kritiek-pad): uygulamanın erken ve geç tarihleri ile bolluğu nasıl hesapladığı.
- [İlişkiler ve gecikme](docs://uitleg-relaties): dört tür ilişki, gecikme ve bir aşamadaki ilişkiler.
- [Kısıtlamalar ve son tarihler](docs://uitleg-constraints): her kısıtlamanın ve bir son tarihin hesaplamada ne yaptığı.
- [Takvimler ve iş günleri](docs://uitleg-kalenders): uygulamanın iş günlerini nasıl saydığı ve hangi takvimin öncelikli olduğu.
- [Günler ve saatler](docs://uitleg-dagen-en-uren): günlerle, saatlerle veya karışık planlama.
- [Kaynak dengeleme](docs://uitleg-nivelleren): dengelemenin neyi değiştirdiği ve neyi değiştirmediği.
- [İlerleme, durum tarihi ve temel plan](docs://uitleg-voortgang): durum tarihinin ne yaptığı ve sapmanın nasıl okunacağı.
- [Görev ve kilometre taşı eklemek](docs://howto-taken-en-mijlpalen-toevoegen): kilometre taşlarını ve görevleri girmek.
- [İlişki oluşturmak](docs://howto-relaties-leggen): görevleri birbirine bağlamak.
- [Bir yapay zeka asistanını bağlamak (MCP)](docs://howto-ai-assistent-koppelen): bu ilkelere göre planlayan bir asistan.
- [Bildirimler ve uyarılar](docs://ref-meldingen): tüm uyarılar tek bir yerde.
