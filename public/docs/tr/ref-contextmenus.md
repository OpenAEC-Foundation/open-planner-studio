# Sağ tık menüleri

Sağ fare düğmesinin Gantt’ta ve görev tablosunda hangi menüleri açtığını, her öğenin ne yaptığını ve hangi görevlere uygulandığını gösterir. Düğme veya kısayol olarak da bulunan öğeler şunlarda yer alır: [Şerit, sekme sekme](docs://ref-lint) ve [Klavye kısayolları](docs://ref-sneltoetsen).

## Hangi menü nerede

Dört menü vardır. Hangisinin açılacağı tıkladığınız yere bağlıdır:

- **Gantt’ta bir görev çubuğunda** — görev menüsü; en üstte *İlişkiyi buradan başlat* öğesi bulunur.
- **Görev tablosunda bir görevde** — aynı görev menüsü, ama en üstteki bu öğe olmadan. Bu, Gantt’ın solundaki görev tablosu ve *Tablo* sekmesi için geçerlidir.
- **Görev tablosunda bir grup başlığında** — grupları genişletmek ve daraltmak için küçük bir menü. Grup başlıkları yalnızca gruplama yaptığınızda görünür, örneğin *Kaynak diyagramı* düzeninde.
- **Boş alanda** — Gantt’ta çubukların yanında veya altında, ve görev tablosunda son görevin altında ya da gri *Yeni görev* satırında. Menüde *Yeni görev*, *Kilometre taşı ekle* ve *Yapıştır* bulunur; Gantt’ta ayrıca *Yakınlaştırmayı sıfırla* ve *Projeye sığdır* bulunur. Yeni bir görev veya kilometre taşı listenin en altına eklenir. Gantt’ta görev, tıkladığınız tarihte başlar. Görev tablosunda ad hücresi hemen açılır, böylece yazabilirsiniz.

Gantt’ta bir grup başlığının bandında sağ fare düğmesi boş alanın menüsünü açar. Grup başlığının kendi menüsü yalnızca görev tablosunda vardır. Zaman çizelgesi başlığına sağ tıklamak bir işe yaramaz. Görev tablosunun sütun başlıklarının kendi menüsü vardır; bu menü [Tablo sütunlarını ayarlama](docs://howto-tabelkolommen-aanpassen) konusunda açıklanır.

**Hangi görevlere bir öğe uygulanır?** Bir göreve tıklarsınız, ama seçim kapsamı belirler. Tıkladığınız görev seçimin bir parçaysa, öğe tüm seçime uygulanır. Değilse, öğe yalnızca o göreve uygulanır. Gantt’ta bir çubukta veya görev tablosunda bir satırda sağ tıklarsanız ve o görev seçimin bir parçası değilse, o görev seçimin yerini alır. Bir şeyi değiştiren her öğe, tüm seçim için bile, *Geri al* ile tek bir adımdır.

## Görev menüsü

Öğeler bu sırayla yer alır. Gruplar arasındaki çizgi menüde bir ayırıcıdır.

**İlişkiyi buradan başlat** — yalnızca Gantt’ta, bir çubukta. Bu görev seçiliyken ilişki modunu açar; ardından ardıla sürüklersiniz. Bkz. [İlişki ekleme](docs://howto-relaties-leggen).

**Kesintiyi kaldır** ve **Tüm kesintileri kaldır** — yalnızca Gantt’ta, kesintisi olan bir çubukta. *Kesintiyi kaldır* yalnızca bir duraklamaya veya onun arkasındaki parçaya tıklarsanız ve kesinti düzenlenebilirse görünür; bu, o tek duraklamayı kaldırır. *Tüm kesintileri kaldır* hepsini kaldırır; düzenleyemediğiniz, içe aktarılmış bir dosyadan gelen kesintiler de dahildir. Bkz. [Görevi bölme](docs://howto-taak-splitsen).

**Düzenle...** — bu görev için *Görevi düzenle* penceresini açar. Bkz. [Görev iletişim kutusu ve özellikler paneli](docs://ref-taak-eigenschappen).

**Yukarıya ekle** ve **Aşağıya ekle** — kapsamın en üstteki görevinin üstüne veya en alttaki görevinin altına, aynı düzeyde yeni bir görev ekler. Bu öğeler yalnızca saf ağaç görünümünde çalışır, filtre, gruplama veya sıralama olmadan; aksi halde uygulama bir mesajla reddeder. Bkz. [Görev ve kilometre taşı ekleme](docs://howto-taken-en-mijlpalen-toevoegen).

**Alt görev ekle** — tıkladığınız görevin alt görevi olarak yeni bir görev ekler; alt görevlerinin en altına. Yalnızca o bir görev için, tüm seçim için değil.

**Kilometre taşı ekle** — tıkladığınız görevin alt görevi olarak bir kilometre taşı ekler. Yalnızca o bir görev için.

**İlişki ekle** — *İlişkiyi buradan başlat* ile aynı işi yapar: bu görev seçiliyken ilişki modunu açar. Görev tablosunda bu öğe, Gantt görünür değilse devre dışıdır; ipucu şöyledir: *Yalnızca Gantt şeması görünürken kullanılabilir*.

**Girintile** ve **Girintiyi azalt** — kapsamdaki görevleri WBS’de bir düzey aşağı veya bir düzey yukarı taşır. Bu iki öğe yalnızca saf ağaç görünümündedir. Bkz. [Yapıyı ayarlama](docs://howto-structuur-aanpassen).

**Kilometre taşını değiştir** — görevi bir kilometre taşına çevirir, veya geri. Yeni durum, tıkladığınız göreve bağlıdır ve tüm kapsama uygulanır: o bir görevse, kapsamdaki tüm görevler kilometre taşı olur. Bir özet görev ve atamaları olan bir görev kilometre taşı olmaz; kapsamın geri kalanı olur ve her neden için bir mesaj alırsınız.

**Takvim ata ▸** — *Proje takvimi* içeren bir alt menü (görevin o zaman kendi takvimi olmaz) ve altında kullanılabilir takvimler. Geçerli seçimin yanında bir onay işareti bulunur. Zaten bu takvimde olan bir görev atlanır ve ek bir *Geri al* adımı oluşturmaz. Bkz. [Takvim oluşturma ve atama](docs://howto-kalender-maken-en-toewijzen).

**İlerleme ▸** — %0, %25, %50, %75 ve %100 içeren bir alt menü. Geçerli değerin yanında bir onay işareti bulunur. Bir özet görevin kendi ilerlemesi yoktur: kapsamda varsa, yaprak görevleri yüzdeyi alır. Durum tarihi yoksa uygulama onu bugüne ayarlar ve bir mesaj gösterir. Yalnızca durum tarihinden sonra başlaması planlanan ve henüz gerçek başlangıcı olmayan bir görev için önce gerçek başlangıç hakkında bir soru sorulur; iptal ederseniz hiçbir şey değişmez. Bkz. [İlerlemeyi güncelleme](docs://howto-voortgang-bijwerken).

**Öncelik ▸** — *Düşük* (100), *Normal* (500) ve *Yüksek* (900) içeren bir alt menü; görevin dengeleme önceliğidir. Geçerli değerin yanında bir onay işareti bulunur. Bkz. [Kaynak dengeleme](docs://uitleg-nivelleren).

**Yolu izle** — bu görevin öncüllerini ve ardıllarını gösterir. Yol izleme zaten açıksa öğe *Yol izlemeyi durdur* olarak adlandırılır. Bkz. [Bir yolu izleme](docs://howto-pad-traceren).

**Daralt**, **Genişlet** ve **Dalı şablon olarak kaydet** — yalnızca bir özet görev için. *Daralt* ve *Genişlet* her zaman ikisi de bulunur, görev zaten daraltılmış veya genişletilmiş olsa bile, ve tüm kapsama uygulanır. *Dalı şablon olarak kaydet* görevi, alt görevleri ve aralarındaki ilişkilerle birlikte bir WBS şablonu olarak kaydeder. Bkz. [WBS şablonlarını kaydetme ve ekleme](docs://howto-wbs-sjablonen).

**Sil** — kapsamdaki görevleri, alt görevleriyle birlikte siler. Onay sorulmaz; Ctrl+Z ile geri getirebilirsiniz; tüm kapsam için tek bir adımdır. Bkz. [Görevleri seçme, silme ve geri alma](docs://howto-taken-selecteren-verwijderen).

## Grup başlığının menüsü

Bu menü yalnızca görev tablosunda, bir grup başlığında bulunur:

**Grubu daralt** veya **Grubu genişlet** — yalnızca bu grubu daraltır veya genişletir. Öğe, ne yapabileceğinizi gösterir.

**Tümünü genişlet** ve **Tümünü daralt** — tüm grupları bir kerede genişletir veya daraltır.

Gruplamayı bir düzenle ayarlarsınız. Bkz. [Düzen oluşturma ve kullanma](docs://howto-layouts-gebruiken).

## Ayrıca bakın

- [Gantt’ta sürükleme, kaydırma ve yakınlaştırma](docs://howto-gantt-bedienen): sol ve orta fare düğmeleriyle sürüklemenin ne yaptığı.
- [Şerit, sekme sekme](docs://ref-lint): aynı işlemleri yapan düğmeler.
- [Klavye kısayolları](docs://ref-sneltoetsen): bunlara ait tuşlar.
