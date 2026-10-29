# Kaynak kitaplığını kullanma

Amaç: projenizde kaynak kitaplığındaki kaynakları kullanmak ve bir projede oluşturduğunuz bir kaynağı kitaplığa eklemek. Böylece her proje aynı verileri kullanır.

## Ne zaman gerekir

Sabit bir duvarcı ekibiniz, bir vinciniz ve bir sıvacınız var. Bunlar birkaç projede yer alır. Kitaplık olmadan bunları her projede yeniden yazarsınız. Bu durumda adlar ve ücretler farklı olabilir. Ayrıca hiçbir proje, bir başka projenin aynı ekibi de istediğini görmez. Kitaplıkta bunları bir kez kaydedersiniz.

Kitaplığın ne olduğunu ve bir projenin ondan neyi devraldığını [Kaynak kitaplığı](docs://uitleg-resourcebibliotheek) sayfasında okuyursunuz. Bu sayfa işlemleri anlatır. Kaynak kitaplıklarını oluşturma, dışa aktarma ve silme [Kaynak kitaplıklarını yönetme ve paylaşma](docs://howto-bibliotheken-beheren) sayfasında anlatılır.

## Adımlar

### 1. Projeyi bir kitaplığa bağlayın

Kitaplıkla yalnızca proje ona bağlıysa çalışırsınız. Bağlantı yoksa kaynak paneli *Kitaplık*, *Proje* ve *Doluluk* geçişini göstermez.

Yeni bir proje için:

1. *Dosya › Yeni* öğesini seçin. *Yeni proje* penceresi açılır.
2. *Kaynak kitaplığı* alanına bakın. Alan varsayılan kitaplığa ayarlıdır. Başka bir kitaplık, *yok (bağımsız proje)* veya *+ Yeni kaynak kitaplığı…* seçebilirsiniz.
3. *Oluştur* düğmesine tıklayın.

Mevcut bir proje için:

1. *Dosya › Proje ayarları* öğesini seçin.
2. *Kaynak kitaplığı* altında kitaplığı seçin.
3. *Uygula* düğmesine tıklayın. Uygulanana kadar alt kısımda *Değişiklikler uygulanmadı — korumak için Uygula'ya tıklayın.* yazar.

Projede, bir kitaplık öğesiyle aynı adı taşıyan kaynaklar varsa, *Kaynak kitaplığını bağla* penceresi açılır. Pencerede *Tanı* bölümü görünür. Eşleşmesi olan her kaynakta *Öneri: Bricklayer* yazar. Yalnızca o kaynağı bağlamak için *Bağla* düğmesine tıklayın. Birden fazla öneri varsa *Tüm önerileri bağla* düğmesine tıklayın. Uygulama adları büyük ve küçük harf farkına ya da çift boşluğa bakmadan karşılaştırır. Bağlandığında kaynak, adını, türünü, ücretini, birimini ve açıklamasını kitaplık öğesinden devralır. *Maks. birim* projede önceden olan değerde kalır. Pencere ayrıca, bir kitaplık takvimiyle aynı adı taşıyan proje takvimlerini gösterir. *Daha sonra karar ver* ile pencereyi bağlamadan kapatırsınız.

### 2. Kaynağı kitaplığa ekleyin

1. *Kaynaklar › Yönet › Kaynaklar* öğesini seçin. Kaynak paneli çalışma alanının tamamını kaplar. Bağlı bir proje için de her zaman *Proje* ile açılır.
2. Sağ üstte *Kitaplık* öğesini seçin. Tablonun üstünde *Bu, kitaplığı düzenler ve tüm projeler için geçerlidir — geri almanın dışında* yazar.
3. *Kitaplıkta yeni kaynak* düğmesine tıklayın. Tablonun altında boş bir satır görünür.
4. Adı yazın, örneğin *Bricklayer*, ve Enter tuşuna basın. Kaynak artık kitaplıktadır ve sonraki kaynak için hemen boş bir satır açılır. İşiniz bittiğinde Esc tuşuna basın. Ad yazmazsanız uygulama hiçbir şey oluşturmaz.
5. Satırın kalanını doldurun. *Tür* varsayılan olarak *İşçilik* seçilidir. *Maks. birim* altında bu kaynaktan toplam kaç tane olduğunu girersiniz. Örneğin üç duvarcı için 3 yazın. Doluluk görünümü bu sayıyı kapasite olarak kullanır. *Ücret/saat* isteğe bağlıdır. *Birim* alanını yalnızca *Malzeme* türü için doldurabilirsiniz. *Takvim* altında kitaplıktan bir takvim seçersiniz. Ya da bir takvim oluşturmak için *+ Kaynak takvimi* seçersiniz. Bkz. [Kaynak takvimi ayarlama](docs://howto-resourcekalender-instellen). Uygulama, adı, ücreti ve birimi alandan çıktığınızda kaydeder. Diğer alanları hemen kaydeder.

Kitaplıktaki her değişiklik, açık projelerinizdeki düzenlenmemiş kopyalara hemen yansır.

### 3. Projenize bir kaynak atayın

1. *Kitaplık* görünümünde kaynağın yanında *Projeye ata* öğesini seçin. Tablonun üstünde *Eklendi.* yazar. Tekrar tıklarsanız *Zaten projede mevcut.* yazar ve ikinci bir kopya görünmez.
2. *Proje* öğesini seçin. Kopya tabloda yer alır. Adının yanında *Kitaplıktan* adlı küçük bir kitaplık simgesi bulunur. Ad, tür, ücret ve birim salt okunur. Bunların üzerine fareyi getirirseniz *Kitaplık değeri — Kitaplık görünümünde düzenleyin veya bu kaynağı kitaplıktan ayırın.* görürsünüz.
3. Bu proje için *Maks. birim* değerini ayarlayın. Alan kitaplıktaki değerle başlar ve projede düzenlenebilir kalır.
4. Kaynağı şimdi diğer kaynaklar gibi görevlere atayın. Bkz. [Kaynakları eğriyle atama](docs://howto-resource-toewijzen). *Kaynaklar › Atama › Ata* yalnızca projede zaten bulunan kaynakları gösterir. Bu yüzden önce bir kitaplık kaynağını bu şekilde projeye atayın.

*Projeye ata* yalnızca, bu kitaplığa bağlı bir projenin *Kitaplık* görünümünde bulunur.

### 4. Projenizdeki bir kaynağı kitaplığa getirin

Bunu, projede oluşturduğunuz ve daha sık kullandığınız bir kaynak için yaparsınız. Örneğin kiraladığınız bir vinç.

1. *Proje* görünümünde kaynağın yanında *Kitaplığa* öğesini seçin. Bu düğme yalnızca, bağlı bir projede, adı olan ve henüz kitaplıktan gelmeyen kaynakta görünür.
2. Tablonun üstündeki iletiyi okuyun.

İleti üç şey söyleyebilir:

- *Eklendi.* Kitaplıkta bu adla bir öğe yoktu. Yeni bir öğe oluşturuldu ve kaynağınız buna bağlandı.
- *Kitaplıkta zaten vardı — şimdi bağlandı.* Aynı ada ve aynı verilere sahip bir öğe vardı. Kaynağınız buna bağlandı.
- *Kitaplıktaki mevcut öğeyle bağlandı — değerler farklı, işarete bakın.* Aynı ada sahip, ama farklı verilere sahip bir öğe vardı. Kaynağınız bağlanır ve hemen *farklı — karar ver* ile işaretlenir. 6. adıma devam edin.

### 5. Bir kopyanın bağlantısını kaldırın

Bir projede kitaplıktan sapmak istiyorsanız, örneğin farklı bir ücretle, kopyanın bağlantısını kaldırırsınız.

1. *Proje* görünümünde satırın sonundaki *Kitaplıktan ayır* simgesine tıklayın.
2. Kaynak artık normal bir proje kaynağıdır. Tüm alanlar düzenlenebilir ve kaynak artık kitaplığı izlemez. Kaynakla birlikte gelen takvimin bağlantısı da kaldırılır, ancak bu projedeki başka bir kaynak hâlâ bu takvimi izliyorsa bağlantı kaldırılmaz.

Bağlantıyı kaldırmayı *Geri al* (Ctrl+Z) ile geri alırsınız.

### 6. Bir sapmayı çözün

Bir kopyada *farklı — karar ver* yazıyorsa, bu kopya kitaplık öğesinden farklıdır. Uygulama hangisinin doğru olduğunu seçmez.

1. Kaynaktaki *farklı — karar ver* işaretine tıklayın. *Kaynak kitaplığını bağla* penceresi açılır. Bu tür bir kopya içeren bir dosyayı açtığınızda pencere kendiliğinden de açılır.
2. *Sapmalar* bölümünde öğe için istediğinizi seçin. Aşağıda açıklanmıştır.
3. Henüz seçmek istemiyorsanız *Daha sonra karar ver* düğmesine tıklayın. Pencere kapanır ve işaret kalır.

Bir sapma için iki seçeneğiniz vardır:

- *Kitaplık değerlerini kullan*: kopya verilerini kitaplıktan alır.
- *Dosya değerlerini kitaplığa aktar*: kitaplık verilerini kopyanızdan alır. Altında *Dikkat: bu, kitaplığı değiştirir ve tüm projeleriniz için geçerlidir.* yazar. Diğer açık projelerdeki kopyalar bunu izler.

## Tuzaklar ve uygulamanın o zaman ne yaptığı

**Örnek projelerin kendi bir kitaplığı vardır.** Üç vitrin örneğinden birini açarsanız (*Dosya › Örnekler* veya Yardım'daki bir bağlantı üzerinden), uygulama bir kez *Demo resource library* adlı kitaplığı oluşturur ve projeyi buna bağlar. Projedeki, bir kitaplık öğesiyle aynı adı taşıyan kaynaklar hemen bağlanır; takvimler bağlanmaz. Kendi kitaplıklarınız değişmeden kalır. İki vitrin örneğini yan yana açarsanız, birlikte [Doluluk görünümünü kullanma](docs://howto-bezettingsoverzicht-gebruiken) sayfasında çakışmaları gösterirler, örneğin duvarcı ekibinde (*Masonry crew*) *Refurbishment & Extension of a Family Home* ile *6 New Terraced Houses, De Akkers* arasında.

**Geçişi görmüyorsunuz.** Proje bir kitaplığa bağlı değildir. Adım 1'i uygulayın.

**Kitaplığı yanlışlıkla düzenlersiniz.** Bunu önlemek için panel her zaman *Proje* ile açılır. *Kitaplık* görünümündeki değişiklikler tüm projeler için geçerlidir ve *Geri al* işleminin dışında kalır.

**Bir kaynağı kitaplıktan silersiniz.** Uygulama önce şunu sorar: *'Bricklayer' kitaplıktan kaldırılsın mı? Bu, tüm projeler için geçerlidir ve geri alınamaz.* Projelerinizdeki kopyalar kalır ve çalışmaya devam eder. Bunlara *artık kitaplıkta değil* işareti verilir ve tamamen düzenlenebilirler. *Projeden kaldır* ile kopyayı projeden çıkarırsınız.

**Kaynak kitaplığı altında başka bir kitaplık veya *yok (bağımsız proje)* seçerseniz.** Önceki kitaplıktan gelen işaretler kaybolur. Kaynaklar normal proje kaynakları olarak projede kalır. Başka bir kitaplıkla uygulama aynı adlı kaynakları yeniden arar.

**Bir kaynağın *Tanı* bölümünde önerisi yok.** Bu kaynağın yanında *Öneri yok — elle seçin* yazar, ama bu pencerede bunun için bir düğme yoktur. Bu, bir eksiklik gibi görünüyor. Böyle bir kaynağı, *Kitaplığa* öğesiyle (adım 4), kitaplığa ekleyin.

## Ayrıca bakın

- [Kaynak kitaplığı](docs://uitleg-resourcebibliotheek): kitaplığın neye karar verdiğini, projenin neye karar verdiğini ve kopyaların nasıl izlediğini.
- [Kaynak kitaplıklarını yönetme ve paylaşma](docs://howto-bibliotheken-beheren): kitaplık oluşturma, dışa aktarma ve içe aktarma.
- [Doluluk görünümünü kullanma](docs://howto-bezettingsoverzicht-gebruiken): iki projenin aynı anda aynı kaynağı isteyip istemediğini görmek.
- [Kaynakları yönetme](docs://howto-resources-beheren): tek bir projenin kaynakları.
