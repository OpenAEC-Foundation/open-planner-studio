# Bir yapay zeka asistanı bağlama (MCP)

Open Planner Studio kendini bir yapay zeka asistanına açabilir. Yapay zeka modunu açtığınızda uygulama bir **MCP sunucusu**na dönüşür: Claude gibi bir asistan, o an açık olan pencereye bağlanır, planınızı okur ve üzerinde değişiklik yapabilir. Bunu canlı olarak izlersiniz — eklediği her görev Gantt'ta anında görünür — ve asistanın yaptığı her şeyi tek bir Ctrl+Z ile geri alırsınız.

Bu, bir dosyayı dışa aktarıp başka bir yerde düzenleyip geri içe aktarmaktan temelde farklı bir modeldir. Ortada bir kopya, bir ara biçim veya sizinle asistanın farklı şeylere baktığı bir an yoktur. Bu kılavuz, bunu nasıl açacağınızı, bir asistanı nasıl bağlayacağınızı, asistanın neyi yapıp neyi yapamayacağını ve işe yaramadığında ne deneyeceğinizi anlatır.

## Burada neler öğreneceksiniz

- Yapay zeka modunu açma ve Yapay Zeka sekmesini bulma.
- Köprüyü başlatma, ve onu uygulamayla birlikte otomatik olarak başlatma.
- Bir asistanı bağlama — hazır bir istemle veya bir yapılandırma parçasıyla.
- Bir asistanın planınızla ne yapabileceği.
- Güvenlik kontrolleri: duraklatma, salt okunur, otomatik yedekleme ve etkinlik günlüğü.
- Bağlantı kurulamadığında ne yapacağınız.

Köprü **yalnızca masaüstü uygulamasında** çalışır. Yapay Zeka sekmesi tarayıcı sürümünde de görünür, ama sunucunun kendisi masaüstü kabuğunda çalışır ve orada başlatılamaz.

## Açma

Yapay zeka modu varsayılan olarak kapalıdır. Bunu **Ayarlar → Uygulama → Yapay zeka modunu etkinleştir** üzerinden açarsınız — dişli simgesi (⚙), Ayarlar şerit sekmesi veya Dosya → Ayarlar üzerinden; üçü de aynı anahtarı gösterir.

Açık olduğunda, şeritte ekstra bir **Yapay Zeka** sekmesi belirir. Yapay zeka modunu tekrar kapatırsanız sekme kaybolur ve çalışan bir köprü anında durdurulur — böylece sekme orada olmadan bir sunucu hiçbir zaman dinlemeye devam etmez.

Altında **Köprüyü otomatik başlat** anahtarı bulunur. Bu açıkken, uygulamayı açar açmaz sunucu devreye girer; böylece bir asistan, siz önce Yapay Zeka sekmesine gitmeden bağlanabilir. Varsayılan olarak kapalıdır: kendi bilgisayarınızda dinleyen bir port açmak, bilinçli bir seçim olmalıdır.

## Yapay Zeka sekmesi

Sekme dört gruptan oluşur.

**Sunucu** — yanında durumu gösteren **Köprüyü başlat** (veya **Köprüyü durdur**) düğmesi: *Kapalı*, *3877 portunda aktif*, *Port … kullanımda* veya *Hata*. Aynı durum, durum çubuğunun sağ altında renkli bir nokta olarak da görünür; böylece başka herhangi bir sekmedeyken bile köprünün canlı olup olmadığını görebilirsiniz.

**Bağlantı** — port numarası (yalnızca sunucu durdurulmuşken düzenlenebilir; çalışan bir sunucu portunu elinde tutar), token ve **Bağlan** düğmesi. Token varsayılan olarak gizlidir; göz düğmesi onu gösterir, kopyala düğmesi onu alır, ve **Yeni token** taze bir token oluşturur. Dikkat: sonuncusu *tüm* mevcut bağlantıları keser, çünkü hepsi eski tokeni taşır — uygulama bu yüzden önce onay ister.

**Güvenlik** — **Duraklat**, **Salt okunur**, **Otomatik yedekleme** anahtarı, ve **Şimdi yedekle** ile **Yedekleme klasörünü aç** düğmeleri. Bunların ne yaptığı aşağıda *Güvenlik kontrolleri* başlığı altında açıklanıyor.

**Etkinlik** — **Etkinlik paneli** düğmesi, asistanın yaptığı her çağrının listesini açar: zaman damgası, araç adı, ne kadar sürdüğü ve başarılı olup olmadığı. Bağımsız değişkenler ve yanıt için herhangi bir satırı genişletin. Bu sizin günlüğünüz: asistanın ne yaptığına dair sözüne güvenmek zorunda değilsiniz.

## Bir asistan bağlama

**Bağlan**'a tıklayın. Açılan pencerede tek tek kopyalayabileceğiniz dört blok bulunur:

1. **Uç nokta** — köprünün dinlediği adres, varsayılan olarak `http://localhost:3877/mcp`. Aktarım, akışlı HTTP'dir.
2. **Kimlik doğrulama** — her istekte gönderilmesi gereken HTTP başlığı, `Authorization: Bearer …` biçiminde.
3. **Yapılandırma parçası** — istemcinizin MCP yapılandırmasına yapıştıracağınız, hazır bir JSON bloğu.
4. **Bağlantı istemi** — doğrudan asistanınıza yapıştırdığınız bir metin parçası; kendini bağlar ve ardından kendi araç listesini doğrular.

Sonuncusu en kısa yoldur ve MCP sunucusu ekleyebilen her asistanla çalışır. İstem bilinçli olarak sağlayıcıdan bağımsızdır: yalnızca adresi, tokeni ve asistanın sonrasında neyi kontrol etmesi gerektiğini belirtir; böylece bir sağlayıcıda da diğerinde de aynı şekilde çalışır.

Bağlantı, asistan araç listesini görebildiği anda tamamlanmış olur. Hepsi `planner_` ile başlayan, kırka yakın araç görmesi gerekir. Hiç görmüyorsa, köprü çalışmıyordur veya token yanlıştır.

Token, o an açık olan plana erişim sağlar. Onu bir parola gibi değerlendirin: paylaşılan bir belgede değil, başkalarıyla bir sohbette değil.

## Bir asistanın yapabilecekleri

Araçlar, uygulamada kendinizin yaptığı hemen hemen her şeyi kapsar:

- **Okuma** — proje genel bakışı, görev listesi, tek bir görevin ayrıntıları, kritik yol, kaynaklar ve histogramları, takvimler, baseline'lar, ve bir baseline'a karşı karşılaştırma.
- **Planlama** — görev oluşturma (fazlar ve alt görevlerle birlikte tam bir WBS'yi tek seferde), düzenleme, taşıma ve silme; ilişki ekleme, değiştirme ve kaldırma; ilerleme kaydetme.
- **Kurulum** — kaynak oluşturma ve atama, takvimleri ve çalışılmayan günleri yönetme, baseline kaydetme ve etkinleştirme, nivelleme.
- **Yönetim** — belge oluşturma, çoğaltma ve değiştirme, planlama dosyaları içe aktarma, ve IFC'ye dışa aktarma.

Bunlardan iki şey, listenin kendisinden daha önemlidir.

**Bir asistan tek bir senaryo halinde çalışabilir.** Araçları teker teker çağırmak yerine, bir dizi adımı tek bir bütün olarak gönderebilir. Bu yalnızca daha hızlı olması değildir: tüm senaryo, geçmişinizde tek bir adım haline gelir. Kırk görevlik bir planı tüm ilişkileriyle birlikte tek seferde oluşturursa, tek bir Ctrl+Z ile hepsini yeniden kaldırırsınız. Yarı yolda yapısal bir şey ters giderse, size yarım kalmış bir planla baş başa bırakmak yerine tüm senaryo geri alınır.

**Her değişiklikten sonra plan yeniden hesaplanır.** Asistanın bunu ayrıca istemesi gerekmez, bu yüzden yanlışlıkla güncelliğini yitirmiş tarihler üzerinde çalışmaya devam edemez.

## Bir asistanın yapamayacakları

Köprü, bilinçli olarak uygulamadan daha dar tutulmuştur. Siz isteseniz bile bir asistanın yapamayacağı birkaç şey vardır — bunun yerine, gerçekten işe yarayan yolu açıklayan bir ret yanıtı alır. Bu bir ebeveyn kilidi değildir: her durum, o an baktığınız projenin ötesine uzanan bir şeyle ilgilidir.

**Kaynak kitaplığının kendisi.** Bir asistan bir kitaplık kaynağı veya kitaplık takvimi oluşturamaz, değiştiremez veya silemez. Bir kitaplık, tüm projelerinizin paylaştığı uygulama genelindeki bir veridir ve buradaki düzenlemeler olağan geri alma geçmişinin dışında kalır. Tek bir tarife değişikliği, geri almanın hiçbir yolu olmadan, açık bile olmayan projelere sıçrardı. Bunu siz kendiniz, Dosya → Kitaplık altında yaparsınız.

**Kalıtsal bir kaynağın sabit alanları.** Bir kaynak bir kitaplıktan geliyorsa, o kaynağın *ne olduğunu* kitaplık belirler: ad, tür, açıklama, saatlik ücret ve birim. Bu alanlar Kaynaklar sekmesinde boşuna düz metin olarak görünmez — siz de onları orada düzenleyemezsiniz — ve asistan da sizden fazlasını yapamaz. *Projenin* belirlediği şeyler ise ona açık kalır: maks. birim, zamana bağlı kapasite, takvim ve ekip üyeliği. Yine de farklı bir saatlik ücret isterseniz, ret yanıtı iki gerçek yolu adlandırır: bunu kitaplıkta değiştirmek (o zaman her projeye uygulanır), veya önce kaynağı kitaplıktan ayırmak — bundan sonra kaynak projeye özel ve tamamen düzenlenebilir hale gelir, ayırma işleminin kendisi de Ctrl+Z ile geri alınır.

**Hangi takvimin proje takvimi olduğu.** O takvimin içeriğini düzenleyebilir, ama projenin hangi takvimi kullandığını değiştirmek, takvim kütüphanesinde kendinizin yapacağı bir şeydir. Aynı şey, Birden çok bolluk yolu gibi planlama seçenekleri için de geçerlidir.

**Uygulamanın kendisi.** Ayarlar, tema, dil, uzantılar veya güncelleyici için hiçbir araç yoktur. Bir asistan, programınızın nasıl yapılandırıldığına dair hiçbir şeyi değiştirmez.

**Dosyalar — evet, ama sınırlar içinde.** İçe aktarma, diskinizden bir planlama dosyası okuyabileceği anlamına gelir; dışa aktarma ise bir IFC yazabileceği anlamına gelir. Yazma yalnızca kişisel klasörünüzle sınırlıdır ve açıkça istenmedikçe mevcut bir dosyanın üzerine asla yazılmaz. Bir dışa aktarma ayrıca bir "kaydetme" de değildir: belgeniz uygulamada kaydedilmemiş olarak işaretli kalır, bu yüzden proje dosyanızı sizin haberiniz olmadan değiştiremez.

Kaynak listesini istediğinde, bir asistan hangi kaynakların bir kitaplıktan geldiğini, hangi kaynak kitaplığına ait olduklarını ve hangi alanların sabit olduğunu hemen görür. Bunu öğrenmek için önce duvara toslamasına gerek yoktur.

## Güvenlik kontrolleri

**Duraklat**, köprüyü aktif tutar ama değişiklikleri geçici olarak reddeder; okuma çalışmaya devam eder. Bağlantıyı koparmadan kendiniz bir şey yapmak istediğinizde kullanışlıdır.

**Salt okunur** aynı şeyi yapar, ama bir duraklama yerine bir tutum olarak: bir asistanın hiçbir şeyi değiştiremeden planınızı analiz etmesine, hakkında rapor vermesine veya karşılaştırmasına izin verir.

**Otomatik yedekleme**, bir belgedeki ilk değişiklikten önce otomatik olarak bir IFC kopyası yazar. Bu, oturum başına belge başına bir kez gerçekleşir, böylece her çağrıda bir yığın dosya biriktirmezsiniz. **Şimdi yedekle** bunu hemen yapar — bir asistana köklü bir şey yaptırmadan hemen önce kullanışlıdır. **Yedekleme klasörünü aç** sizi dosyaların bulunduğu yere götürür; uygulama belge başına son on tanesini saklar.

Bunun üstüne, bir asistanın sizinle paylaştığı olağan geri alma geçmişi de gelir. Yaptığı her şeyi siz geri alabilirsiniz — asistan da bunu yapabilir, çünkü geri al ve yinele onun araç kutusunda da vardır.

## İşe yaramadığında

**"Port … kullanımda."** O portta zaten bir şey dinliyordur. Genellikle bu, uygulamanın ikinci bir penceresidir: köprü aynı anda yalnızca birine hizmet verebilir. Diğer pencereyi kapatın, veya sunucu durdurulmuşken farklı bir port numarası seçin.

**Asistan yanıt almıyor, veya takılı kalıyor.** Bu, sunucunun arkasındaki pencere kapandığında veya yeniden yüklendiğinde olur. Köprüyü durdurun ve yeniden başlatın; bu yardımcı olmazsa uygulamayı yeniden başlatın. Hâlâ canlı olup olmadığından emin değilseniz, durum çubuğundaki durum noktasına bakın.

**Asistan hiç araç görmüyor, veya bir erişim hatası bildiriyor.** O zaman token yanlıştır. Bu genellikle, bağlantı zaten kurulmuşken **Yeni token**'a tıkladıktan sonra olur: asistan hâlâ eskisini taşımaktadır. Yenisini **Bağlan** penceresinden kopyalayın ve istemcinizin yapılandırmasını güncelleyin.

**Asistan başarılı olduğunu söylediği halde hiçbir şey olmuyor.** Etkinlik panelinden asistanın gerçekte neyi çağırdığını ve geriye ne döndüğünü kontrol edin. Bir ret yanıtı varsa, bu hemen hemen her zaman hangi alanın yanlış olduğunu ve alternatifi belirtir.

## Yapay zekâ asistanınıza iyi plan yaptırma

Araçları bilen bir asistan bile hiçbir planlamacının işine yaramayacak bir program kurabilir: ilişkisi olmayan görevler, her göreve konmuş sabit bir tarih ya da sürdürülemeyecek kadar ince bir kırılım. Bunu önleyen ilkeler [İyi planlama: gereksinimlerden güvenilir bir programa](docs://gids-goed-plannen) kılavuzunda yer alır — asistanınıza işe başlamadan önce okutun veya görevinizde ona atıf yapın. Ayrıca Open Planner Studio'nun kaynak kodunda `.claude/skills/goed-plannen/` altında kısa bir ajan becerisi bulunur; içerik için aynı kılavuza yönlendirir ve yalnızca ajana özgü olanı ekler: `planner_` araçlarının hangi sırayla kullanılacağı ve kullanıcıya ne rapor edileceği.

## Daha fazla okuma

- [Baseline'lar & ilerleme](docs://gids-baselines-voortgang) — durum tarihinin planınıza ne yaptığı. Bir asistana bunu ayarlatmadan önce bilmekte fayda var: yalnızca bir raporlama tarihi değildir, henüz başlamamış işi de ileri iter.
- [İçe/dışa aktarma](docs://gids-import-export) — IFC, CSV, MS Project ve P6'nın birbiriyle nasıl ilişkili olduğu.
- [Ayarlar](docs://ref-instellingen) — tüm ayarlar tek bir yerde, iki yapay zeka anahtarı dahil.
