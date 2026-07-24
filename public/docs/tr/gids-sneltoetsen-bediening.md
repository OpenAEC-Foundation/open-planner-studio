# Klavye kısayolları & kontroller

Bu kılavuz klavye kısayollarını listelemez — o liste zaten tek bir yerde yaşar, ve burada bir kopyası hemen güncelliğini yitirirdi. Bunun yerine, bu, **geçerli listeyi her zaman nasıl açacağınızı** açıklar, ve kendi başlarına anlaşılmaya değer olan kontrol kavramlarını (bağlam menüleri, sürükleme, kutu-seçim ile kaydırma, yakınlaştırma) ele alır.

## Burada neler öğreneceksiniz

- Her zaman güncel kısayollar genel bakışını nasıl açacağınız.
- Gantt görünümündeki dört bağlam menüsünün her birinin ne içerdiği.
- Sürüklemenin nasıl çalıştığı: bir çubuğu taşımak ile bir ilişki çizmek arasındaki fark.
- Boş tuvalde bir sürüklemenin ne zaman kaydırdığı, ne zaman kutu-seçim yaptığı.
- Yakınlaştırma, belge sekmeleri ve sunum modu.
- Turun nasıl yeniden başlatılacağı.

## Her zaman güncel genel bakış

Kısayollar genel bakışını açmak için **Ctrl+/** (macOS'te **Cmd+/**) tuşlarına basın — aynı pencere **Görünüm** şerit sekmesindeki **Kısayollar** düğmesi üzerinden de erişilebilir. Bu pencere salt okunurdur ve doğrudan uygulamanın kaynak kodundan oluşturulur: yeni bir kısayol burada otomatik olarak görünür, senkronize tutması gereken ayrı bir liste yoktur. Bu kılavuzun listeyi tekrarlamamasının tam olarak nedeni budur — ikinci, elle tutulan bir liste er ya da geç uygulamanın gerçekte yaptığından sapardı. Pencere kısayolları kategoriye göre gruplar: Dosya, Düzenle, Yapı, Görünüm ve Gezinme.

## Bağlam menüleri: fare nereye sağ tıklandığına bağlı olarak dört tür

Gantt görünümünde sağ tıklamak, farenin nerede olduğuna bağlı olarak farklı bir menü verir:

- **Bir görev çubuğu üzerinde** — tam görev menüsü (düzenle, ekle, alt görev/kilometre taşı/ilişki ekle, takvim ata, ilerleme, öncelik, yolu izle, sil…), artı üstte bir ekstra çubuğa-özgü öğe: **İlişkiyi buradan başlat**.
- **Bir çubuk isabeti olmayan bir görev satırında** (örneğin şu anda hiçbir çubuğu görünür olmayan bir satır) — aynı görev menüsü, ama çubuğa-özgü öğe olmadan.
- **Bir grup başlığı satırında** (gruplanmış bir görev kümesini özetleyen satır) — o tek grubu daralt/genişlet için küçük bir menü, artı tüm ağaç için **Tümünü genişlet**/**Tümünü daralt**.
- **Boş tuvalde** (görev yok, grup başlığı yok) — **Yeni görev**, **Kilometre taşı ekle**, **Yapıştır** (panoda bir şey varsa), **Yakınlaştırmayı sıfırla** ve **Projeye sığdır**.

Bu son menü canlı olarak doğrulanmıştır: Gantt tuvalinde boş bir noktaya sağ tıklamak, tam olarak bu sırayla, tam olarak bu beş öğeyi üretir.

## Bir görev çubuğunda sürükleme

Bir görev çubuğunu kavrayıp sürüklemek görevi taşır (veya kenarını kavradığınızda, süresini değiştirir). Bir çubuktan sürüklerken **Shift**'i basılı tutun, ve bunun yerine bıraktığınız göreve doğru bir **ilişki** çizmeye başlarsınız — çubuğun bağlam menüsündeki **İlişkiyi buradan başlat** ile aynı şey, ama tek bir fare hareketinde.

## Kaydırma ile kutu-seçim karşılaştırması

Boş alanda başlayan bir sürükleme, nerede başlattığınıza ve kaydırma modunuza (**Ayarlar → Kaydırma ve yakınlaştırma**) bağlı olarak iki şeyden birini yapar:

- **Görev tablosunda** (WBS/ad/süre içeren sol sütun), boş alandaki bir sürükleme **her zaman** bir kutu-seçimdir — orada kaydırma asla gerçekleşmez.
- **Gantt tuvalinin kendisinde**: kaydırma modunuz **Sürükle**'ye (harita tarzı kaydırma) ayarlıysa, kaydırma kazanır — tam olarak bir harita uygulamasından beklediğiniz gibi. Diğer iki kaydırma modundan birinde (**Konum** veya **Tuşlar**), boş tuvaldeki aynı sürükleme bir kutu-seçimdir, etraflarına bir dikdörtgen sürükleyerek aynı anda birden çok görev seçmenizi sağlar.

Kısaca: görev tablosu her zaman seçer; tuval yalnızca sürükleme kaydırma modunda kaydırır, aksi takdirde seçer.

## Yakınlaştırma

Şerit üzerindeki yakınlaştırma düğmelerinin yanı sıra, **+**/**=** (veya **Ctrl+=**) yakınlaştırır ve **-** (veya **Ctrl+-**) uzaklaştırır. Salt bir **0** yakınlaştırmayı varsayılana sıfırlar; **Ctrl+0** tüm projenin ekrana sığması için yakınlaştırmayı ayarlar ("projeye sığdır") — yukarıdaki boş-tuval bağlam menüsündeki aynı adlı düğmeyle aynıdır.

## Belge sekmeleri

Aynı anda birkaç proje açıksa (her biri kendi belge sekmesinde), **Ctrl+1**'den **Ctrl+9**'a kadar doğrudan birinci ile dokuzuncu belge sekmesine atlar.

## Sunum modu

**F11**, düzenleme çerçevesi olmadan planı gösterme amaçlı, şerit ve yan paneller olmadan tam ekran bir görünüm olan sunum modunu açar/kapatır. **Esc** sunum modundan tekrar çıkar (ve, sonraki bir basışta, olağan "seçimi kaldır"ı gerçekleştirir).

## Turu yeniden başlatma

Giriş turunu tekrar çalıştırmak mı istiyorsunuz (örneğin uygulamayı başka birine göstermek için)? Bunu yapacağınız iki yer vardır: **Görünüm** şerit sekmesindeki **Tur** düğmesi, veya Backstage gezintisindeki (Ayarlar'ın hemen üstündeki satır) **Turu başlat**. İkisi de önce hoş geldiniz iletişim penceresini göstermeden turu hemen başlatır.

## Daha fazla okuma

- Kısayollar genel bakışını **Ctrl+/** ile kendiniz açın — bu bağlayıcı kaynaktır, bu kılavuz değil.
- Kaydırma ve yakınlaştırma davranışı **Ayarlar → Kaydırma ve yakınlaştırma** altında yapılandırılır, uygulamanın üç sabit ayarlar konumunun (dişli simgesi, Ayarlar şerit sekmesi ve Backstage → Ayarlar) hepsinde mevcuttur.
