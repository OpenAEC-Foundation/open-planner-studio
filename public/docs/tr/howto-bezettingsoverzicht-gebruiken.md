# Doluluk genel bakışını kullanma

Amaç: iki veya daha fazla açık projenin birlikte, bir kaynaktan kaynak kitaplığında olandan fazlasını istediği günleri görmek.

## Bunu ne zaman kullanırsınız

Duvarcı ekibiniz bir projede cephelerde, başka bir projede garajlarda çalışır. Her proje ekibin düzgün planlanmış olduğunu görür, çünkü bir projenin histogramı ve aşırı atanmışlığı yalnızca o projeye bakar. Projeleri yan yana koyduğunuzda ancak ortaya çıkar ki aynı günlerde birlikte, sahip olduğunuz duvarcıdan fazlasını istiyorlar. Doluluk genel bakışı bu yan yana koymayı sizin yerinize yapar.

Genel bakış yalnızca aynı kitaplığa bağlı projelerdeki, kaynak kitaplığından gelen kaynakları sayar. Bunun nasıl hesaplandığını [Kaynak kitaplığı](docs://uitleg-resourcebibliotheek) bölümünde okuyursunuz.

## Adımlar

### 1. Projeleri hazırlayın

1. Karşılaştırmak istediğiniz projeleri açın, her biri kendi sekmesinde; bkz. [Birden fazla projeyle birlikte çalışma](docs://howto-meerdere-projecten). Genel bakış yalnızca bu uygulamada açık olan projeleri görür.
2. Her projeyi aynı kitaplığa bağlayın ve her projede kitaplıktaki kaynağı kullanın. Kaynak kitaplığı bağlantısı yoksa kaynak paneli genel bakışı göstermez. Bkz. [Kaynak kitaplığını kullanma](docs://howto-resourcebibliotheek-gebruiken).
3. Projeleri *Hesapla* (F5) ile hesaplayın veya *Otomatik hesapla* seçeneğini açın. Genel bakışın güncel olmayan projelerle ne yaptığı aşağıdaki dikkat noktalarında anlatılır.

### 2. Genel bakışı açın

1. Projelerden birine geçin ve *Kaynaklar › Yönet › Kaynaklar* yolunu seçin.
2. Sağ üstte *Doluluk* öğesini seçin. Genel bakış, içinde bulunduğunuz projenin kaynak kitaplığına aittir. Bu panelde hiçbir şeyi değiştiremezsiniz: bu salt okunur bir penceredir.

### 3. Tabloyu okuyun

Kaynak kitaplığındaki her kaynak, en az bir açık projede atanmışsa bir satır alır. Atanmamış kaynaklar listelenmez. En çok aşırı atanmış günü olan satırlar en üstte yer alır; sonra alfabetik sıraya göre.

- *Belgeler* kaynağın kaç projede atandığını gösterir, örneğin *2 belge*.
- *Dönem*, yük olan ilk günden son güne kadar gider; yyyy-mm-dd biçiminde yazılır, örneğin *2027-06-07 – 2027-06-14*.
- *Tepe / Kapasite* tüm projelerin birlikte en yüksek günlük yükünü, kaynak kitaplığındaki kaynağın kapasitesiyle karşılaştırır; örneğin *4.0 / 3.0*. En az bir aşırı atanmış gün varsa, bu değer kırmızıyla gösterilir.
- Satırın sonundaki kırmızı işaret, örneğin *3 gün aşırı atanmış*, toplamın kapasiteden büyük olduğu günleri sayar. Fareyi üzerine getirirseniz tarihleri görürsünüz.

### 4. Projeye göre bakın

1. Bir kaynağın adının önündeki küçük oka tıklayın. Satır açılır.
2. En üstte aşırı atanmış tarihler yer alır: ilk beş tanesi, en fazlası varsa *… ve 3 tane daha*. Bunun altında her proje için, proje adı, dönem ve o tek projenin tepe değeri gösterilir, örneğin *Houses North 2027-06-07 – 2027-06-11 Tepe: 2.0*.
3. Satırın kendisine tıklayın; altta bir histogram verilir. Her projenin kendi rengi vardır. Çubuklar üst üste yığılır. Kesikli çizgi, kaynak kitaplığının kapasitesidir. Kapasite zamanla değişirse basamaklar görürsünüz. Aşırı atanmış günlerin çubukların arkasında kırmızı bir bandı olur. Histogramı yeniden kapatmak için satıra bir kez daha tıklayın. Seçili bir satır yoksa *Histogramı görmek için bir kaynak seçin.* yazar.

### 5. Sorunu çözün

Genel bakış sorunu gösterir, ama çözmez. İki seçeneğiniz var:

- Projelerden birinde bir görevi taşıyın veya o göreve günde daha az birim verin. Sonra o projeyi F5 ile yeniden hesaplayın.
- Biri gerçekten katılıyorsa, kaynak kitaplığındaki kaynağın *Maks. birim* değerini artırın. Bunu *Kaynaklar › Yönet › Kaynaklar* içinde, *Kitaplık* görünümünde yaparsınız.

Şeritteki *Dengele…* burada işe yaramaz: bu, içinde bulunduğunuz tek projenin kaynaklarına bakar. Bkz. [Kaynak dengeleme](docs://uitleg-nivelleren).

## Dikkat edilecekler ve uygulamanın o durumda ne yaptığı

**Genel bakış boştur.** Şunu yazar: *Açık belgelerde kitaplıktan ayrılmış kaynak yok.* Bu durumda açık hiçbir projenin bir görevinde kaynak kitaplığından gelen bir kaynak yoktur.

**_Doluluk_ düğmesini görmezsiniz.** İçinde bulunduğunuz proje bir kaynak kitaplığına bağlı değildir.

**Bir proje sayılmaz.** Proje bu uygulamada açık değildir, başka bir kaynak kitaplığına bağlıdır veya içindeki kaynak o projenin kendi kaynağıdır. Genel bakışın altında her zaman *Bu genel bakış yalnızca bu uygulamada açılan belgeleri görür* yazar. Bir kaynağın kopyası, kaynak kitaplığından sonradan kaldırılmışsa, o da sayılmaz.

**Bir kopya veya varyant tam olarak sayılır.** Kaynak kitaplığına bağlı her açık proje sayılır, ayrıca başka bir açık projenin kopyası veya varyantı olsa bile; örneğin bir yapay zeka asistanının `planner_duplicate_document` ile yaptığı bir varyant. Asıl proje ve varyant birlikte, gerçekte yalnızca bir kez var olan bir aşırı atanmışlığı gösterebilir. Genel bakış bunu sessizce filtrelemez: varyantı bir süreliğine kapatın veya bunu hesaba katarak okuyun.

**Bir proje güncel değildir.** Planlamada bir şeyi yeniden hesaplamadan değiştirdiyseniz proje güncel değildir. Genel bakış o projeyi o zaman şöyle işler:

- Etkin sekme olmayan bir proje için genel bakış, projeyi değiştirmeden kendisi önceden hesaplar. Tablonun üstünde o zaman şunu yazar: *Değiştirilen belgeler bu genel bakış için önceden hesaplandı; belgede F5'e basın veya bunu kalıcı yapmak için “Otomatik hesapla” seçeneğini açın.* Projenin altında şunu yazar: *Bu genel bakış için önceden hesaplandı — belge kendisi orada F5'e basana veya “Otomatik hesapla” seçeneğini açana kadar hâlâ eski tarihleri gösterir.* *Otomatik hesapla* açıksa (*Ayarlar › Proje › Uygulama ayarları*, *Planlama* sekmesi), uygulama genel bakışa baktığınız anda bu projeleri gerçekten yeniden hesaplar ve mesaj kaybolur. Etkin proje de güncel değilse, bunun yerine sonraki maddedeki mesaj tablonun üstünde gösterilir.
- Genel bakış, içinde bulunduğunuz projeyi kendisi hesaplamaz. Bu proje güncel değilse, şunu yazar: *Değiştirilen bir belge henüz yeniden hesaplanmadı; burada son hesaplanan değerleriyle sayılıyor. O belgede F5'e basın veya “Otomatik hesapla” seçeneğini açın.* Projenin altında da: *Güncel değil: bunlar son hesaplanan değerlerdir — bu belgede F5'e basın.* Dikkat: *son hesaplanan değerler* tam doğru değildir. Genel bakış eski başlangıç tarihlerini alır, ama değiştirilmiş süre veya atamayı zaten kullanır. Bu yüzden değerler hem eski hem yeni planlamadan, hem de Gantt'taki çubuklardan farklı olabilir. Bunlara yalnızca F5'ten sonra güvenin.
- Genel bakış bir projeyi hesaplayamazsa, örneğin ilişkilerinde bir döngü olduğu için, o proje sayılmaz. Yine de listelenir, şu mesajla: *Sayılmaz: plan hesaplanmadı — bu belgeyi etkinleştirin ve F5'e basın.* Tablonun üstünde ise: *En az bir belge hesaplanmadı ve dolulukta sayılmıyor.*

**Genel bakış beklediğinizle uyuşmaz.** Kapasite kaynak kitaplığından gelir (kaynak kitaplığı öğesinin *Maks. birim* değeri veya o güne ait *Zamana bağlı kapasite*), projedeki kopyanın *Maks. birim* değerinden değil. Kapasiteye eşit bir toplam bir çakışma değildir.

## Ayrıca bakın

- [Kaynak kitaplığı](docs://uitleg-resourcebibliotheek): dolulukun nasıl sayıldığı, bir uygulamalı örnekle.
- [Kaynak kitaplığını kullanma](docs://howto-resourcebibliotheek-gebruiken): projeleri bağlamak ve kaynak atamak.
- [Aşırı atanmışlığı çözme](docs://howto-overbezetting-oplossen): tek bir projedeki aşırı atanmışlık.
