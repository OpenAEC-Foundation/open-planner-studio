# Kaynak kitaplıklarını yönetme ve paylaşma

Hedef: kaynak kitaplıkları oluşturmak ve silmek, bunlara takvim koymak ve bir kaynak kitaplığını yedek olarak veya başka bir bilgisayarda kullanmak için dışa aktarmak ya da içe aktarmak.

## Ne zaman gerekir

Kaynak kitaplığı proje dosyalarınızda değil, uygulamadadır. Masaüstü uygulamasında bu bilgisayardaki bir dosyada tutulur. Tarayıcıda ise o tarayıcının depolama alanında tutulur. Eşitlenmez. Tarayıcıda site verilerini silerseniz kaynak kitaplığı kaybolur. Bu yüzden onu yedek olarak dışa aktarın. Bir meslektaşınızın aynı ekiplerle ve ücretlerle çalışmasını istiyorsanız, kaynak kitaplığını bir dosya olarak da ona verirsiniz. Organizasyonunuzda kendi ekipleri olan birkaç işletme şirketi varsa, her biri için ayrı bir kaynak kitaplığı oluşturursunuz. Yeni bir proje için hangi kaynak kitaplığını kullanacağını siz seçersiniz.

Kaynak kitaplığının ne olduğunu [Kaynak kitaplığı](docs://uitleg-resourcebibliotheek) sayfasında okuyabilirsiniz. Kaynakların kendisini burada değil, kaynak panelinde düzenlersiniz. Bkz. [Kaynak kitaplığını kullanma](docs://howto-resourcebibliotheek-gebruiken).

## Adımlar

### Yönetim ekranını açın

*Dosya › Kitaplık* öğesini seçin. Solda *Kaynak kitaplıkları* listesi yer alır. Sağda, tıkladığınız kaynak kitaplığının ayrıntıları yer alır: ad, düğmeler ve *Takvimler* listesi. En üstte, kaynakları *Kaynaklar* sekmesinde yönettiğiniz yazar.

### Kaynak kitaplığı oluşturun, adını değiştirin ve varsayılanı seçin

1. Listenin üstündeki artı işaretine tıklayın (*Kaynak kitaplığı ekle*). Yeni bir kaynak kitaplığı, *Yeni kaynak kitaplığı*, eklenir ve hemen seçilir.
2. Yeni adı, sağ tarafın en üstündeki ad alanına yazın ve Enter tuşuna basın. Alanın dışına da tıklayabilirsiniz. Uygulama boş bir adı kabul etmez.
3. *Varsayılan olarak ayarla* öğesine tıklayın. Bu kaynak kitaplığı, bundan sonra yeni projeler için önceden seçili olur. Varsayılan kaynak kitaplığının listede bir yıldızı vardır.

### Kaynak kitaplığına takvim ekleyin

1. *Takvimler* altında *Projeden* öğesine tıklayın. Etkin projenizin takvimlerini içeren bir liste açılır.
2. Devralmak istediğiniz takvimin yanındaki küçük oka tıklayın. Listenin üstünde *Eklendi.* yazar. Bu kaynak kitaplığına zaten bağlı olan bir takvimin adından sonra *zaten bağlı* yazar.
3. Takvim artık kaynak kitaplığının *Takvimler* listesinde yer alır. Kalem simgesiyle (*Düzenle*) adını değiştirirsiniz ve onay işaretiyle kaydedersiniz. Çöp kutusu takvimi hemen siler. Onay sormaz. Projelerdeki kopyalar kalır.

*Takvimler* listesinin altında, örneğin *v2* gibi bir sürüm numarası vardır. Bu numara, kaynak kitaplığındaki her değişiklikle artar. Bir kaynak kitaplığı takvimi, onu kullanan bir kaynağı atadığınızda projeye birlikte taşınır. Takvimi, *Kaynaklar* sekmesindeki *Kitaplık* görünümünde, *Takvim* sütununda bir kaynağa eklersiniz.

### Kaynak kitaplığını dışa aktarın

1. Listeden kaynak kitaplığını seçin.
2. *Dışa aktar* düğmesine tıklayın.
3. Masaüstü uygulamasında, Chrome'da ve Edge'de dosyanın nereye gideceğini siz seçersiniz. Diğer tarayıcılarda dosya doğrudan indirilenler klasörüne gider. Uygulama bunu size bildirir. Dosyanın adı `bibliotheek-` ile başlar, ardından kaynak kitaplığının adı gelir. Uzantısı `.ifc` olur.

Düğmelerin altında *Dışa aktarma aynı zamanda yedeğinizdir: dosyayı güvenli bir yerde saklayın.* yazar.

### Kaynak kitaplığını içe aktarın

1. *İçe aktar* düğmesine tıklayın. *Kitaplık içe aktar* penceresi açılır. Bu pencere, listede seçtiğiniz kaynak kitaplığı için açılır.
2. *Dosya seç…* düğmesine tıklayın ve bir dışa aktarılmış `.ifc` dosyasını seçin. Dosya bir kaynak kitaplığı içermiyorsa, *Bu IFC dosyası bir kaynak kitaplığı içermiyor.* yazar.
3. Uygulama içeriği gösterir, örneğin *2 takvim, 5 kaynak (sürüm 3).*
4. Ne yapmak istediğinizi seçin. Aşağıya bakın.
5. *Ekle* veya *Değiştir* düğmesine tıklayın. İşlemi durdurmak için *İptal* düğmesine tıklayın.

İki seçeneğiniz var:

- *Yeni kaynak kitaplığı olarak ekle*: dosya, mevcut kaynak kitaplıklarınızın yanında ayrı bir kaynak kitaplığı olur. Altında hangi adla ekleneceği yazar, örneğin *“Mijn resourcebibliotheek (2)” olarak eklenecek.* Hiçbir şey kaybolmaz. Etkin projeniz kendi kaynak kitaplığına bağlı kalır.
- *Mevcut bir kaynak kitaplığını değiştir*: seçilen kaynak kitaplığının tüm içeriği, dosyadaki içerikle değiştirilir. Uygulama bunu ayrıca belirtir: *İçe aktarma, seçilen kaynak kitaplığının TÜM havuzunun yerini alır.* İki veya daha fazla kaynak kitaplığınız varsa, *Kaynak kitaplığına içe aktar* altında hangisinin değiştirileceğini seçersiniz. Kaynak kitaplığınız dosyadakinden daha yeniyse, uygulama uyarır: *Yerel kitaplığınız daha yeni — içe aktarma değişikliklerinizin üzerine yazabilir.*

Uygulama kendisi bir seçenek önerir. Dosyada varsayılan kaynak kitaplığı varsa, *Yeni kaynak kitaplığı olarak ekle* önceden seçili olur. Dosyadaki kaynak kitaplığı bilgisayarınızda zaten varsa ve varsayılan kaynak kitaplığı değilse, *Mevcut bir kaynak kitaplığını değiştir* önceden seçili olur. Tam o kaynak kitaplığı seçilir. Emin değilseniz *Ekle* seçeneğini seçin. Bu, hiçbir şeyin üzerine yazmaz.

### Kaynak kitaplığını silin

1. Listeden kaynak kitaplığını seçin ve *Kaynak kitaplığını kaldır* düğmesine tıklayın. Son kaynak kitaplığında düğme gri görünür, çünkü her zaman bir kaynak kitaplığı kalır.
2. *Sil* ile onaylayın. Soru şudur: *Bu kaynak kitaplığı kaldırılsın mı?* Açık projeler buna bağlıysa, şunu yazar: *Bu kaynak kitaplığı 1 açık projeyle ilişkilendirilmiş. Kaldırmak bu projenin bağlantısını kesecek. Devam edilsin mi?* Daha fazla proje için aynısını sayıyla birlikte yazar, örneğin *2 açık projeyle ilişkilendirilmiş*.

Kaynak kitaplığı, içindeki tüm kaynaklar ve takvimlerle birlikte artık yoktur. Onu kullanan açık projelerin bağlantısı kesilir. Bu projelerdeki kaynaklar sıradan proje kaynağı olarak kalır. İçeriği saklamak istiyorsanız önce dışa aktarın.

### Projeyi kaynak kitaplığıyla birlikte aktarın

Bir proje dosyası, kaynakların kendi kopyalarını içerir. Tüm kaynak kitaplığını da vermek istiyorsanız, şunları yapın. Dışa aktarmanın kendisi de [Dışa aktarma](docs://howto-exporteren) sayfasında açıklanır.

1. Bir kaynak kitaplığına bağlı bir proje açın ve *Dosya › Dışa aktar* öğesini seçin.
2. *Kitaplık dosyasını da kaydet* onay kutusunu işaretleyin. Onay kutusu yalnızca bağlı bir proje için görünür.
3. *IFC* kartını seçin ve dosyayı kaydedin. Uygulama bunun ardından ayrıca bir ikinci dosya ister. Bu dosyanın adı projenin adı gibidir. Sonuna `-bibliotheek` eklenir. Dosya kaynak kitaplığını içerir.

Onay kutusu yalnızca IFC dışa aktarmada çalışır, diğer dışa aktarma biçimlerinde çalışmaz. Meslektaşınız ikinci dosyayı yukarıda açıklandığı gibi içe aktarır.

## Tuzaklar ve uygulamanın o zaman ne yaptığı

**İki planlamacı, iki kaynak kitaplığı.** Uygulama kaynak kitaplıklarını bilgisayarlar arasında eşitlemez. İçe aktarma penceresi bunun için her zaman bir uyarı gösterir: *Not: kaynak kitaplıkları makineler arasında eşitlenmez. İki planlamacı aynı kaynak kitaplığıyla çalışırsa, kaynak kitaplıkları birbirinden ayrılabilir. Organizasyonunuz ekipleri işletme şirketleri arasında paylaşıyorsa, bilinçli olarak tek bir ortak kaynak kitaplığı seçin.*

**Değiştirmek her şeyin üzerine yazar.** Seçtiğiniz kaynak kitaplığındaki her şey kaybolur. Kaynak kitaplığındaki değişiklik *Geri al* kapsamı dışında kalır. Emin değilseniz önce dışa aktarın. Projelerinizdeki kopyalar kalır. Uygulama, yeni dosyada hâlâ bulunan kopyaları günceller. Artık dosyada olmayan kopyalara *artık kitaplıkta değil* işareti eklenir ve bu kopyalar çalışmaya devam eder. Bir kopya farklıysa *Kaynak kitaplığını bağla* penceresi açılır (bkz. [Kaynak kitaplığını kullanma](docs://howto-resourcebibliotheek-gebruiken)).

**Listeden bir takvimi silmek hemen gerçekleşir.** Uygulama onay sormaz. Oysa bir kaynağı silerken sorar. Bu bir eksiklik gibi görünür. Kaynak kitaplığındaki değişiklikler *Geri al* kapsamı dışında kalır.

## Ayrıca bakın

- [Kaynak kitaplığı](docs://uitleg-resourcebibliotheek): kaynak kitaplığının ve projenin birbiriyle nasıl ilişkili olduğu.
- [Kaynak kitaplığını kullanma](docs://howto-resourcebibliotheek-gebruiken): kaynakları bağlama, atama ve sapmaları çözme.
- [Dışa aktarma](docs://howto-exporteren): dışa aktarma biçimleri, kaynak kitaplığı dosyalı IFC dahil.
