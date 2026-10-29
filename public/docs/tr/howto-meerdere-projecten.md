# Birden fazla projeyle birlikte çalışma

Hedef: birden fazla planlamayı aynı anda açmak, aralarında geçiş yapmak ve her birini ayrı ayrı kapatmak.

## Bunu ne zaman kullanırsınız

Mahalledeki konut geliştirme projesi üzerinde çalışıyorsunuz, ama saha toplantısı kulüp binasının yenilenmesi hakkında da. Ya da bir varyantı orijinalin yanında tutmak istiyorsunuz. Her proje kendi sekmesinde yer alır; kendi görevleri, hesaplaması ve zaman aralığıyla birlikte. Geçiş tek tıklamayla yapılır ve hiçbir şey kaybetmezsiniz.

## Adımlar

### İkinci bir projeyi açma

1. Sekmelerin sağındaki artı işaretine tıklayın (*Proje başlat*). *Proje başlat* penceresi açılır.
2. Boş bir planlama için *Yeni proje* öğesini seçin, ya da bir dosya seçmek için *Mevcut projeyi aç* öğesini seçin. *İptal* pencereyi kapatır.
3. *Yeni proje* seçeneğiyle *Yeni proje* penceresini doldurun ve *Oluştur* düğmesine tıklayın.

Proje kendi sekmesinde görünür ve hemen etkin olur. Şeritteki *Yeni* ve *Aç*, Ctrl+O ve *Dosya › Örnekler* altındaki örnekler de projeyi yeni bir sekmede açar. Yalnızca henüz dokunmadığınız, boş ve yeni bir planlama yeniden kullanılır; yeni bir sekme eklenmez.

### Projeler arasında geçiş yapma

- Projenin sekmesine tıklayın.
- Satırdaki o konumdaki proje için Ctrl+1 ile Ctrl+9 tuşlarına basın (macOS'te Ctrl yerine ⌘). Konumlar soldan sağa sayılır.
- Sekmelerin solundaki menü simgesine tıklayın (*Tüm projeler*). *Açık projeler* genel bakışında her proje için bir kart görünür: adı, dosya adı (proje bir dosyaya sahipse), planlamanın küçük bir resmi, görev sayısı, kritik görev sayısı ve bitiş tarihi. Gitmek için bir karta tıklayın. Esc genel bakışı kapatır.

Her sekmede projeye ait renkli bir nokta bulunur. Arkasında küçük bir nokta olan sekmede kaydedilmemiş değişiklikler vardır.

Sekmeler genişliğe sığmazsa, sekmelerle artı işareti arasında iki ok görünür (*Sekmeleri başa kaydırın* ve *Sekmeleri sona kaydırın*). Her tıklamada sekmeler iki sekme kadar kayar. Bir ok, zaten başta ya da sonda olduğunuzda gri görünür. Sekmelerin üzerinde fare tekerleğiyle de kaydırabilirsiniz. Seçtiğiniz sekme her zaman kendiliğinden görünür alana kayar.

### Bir projeyi kapatma

Sekmedeki adın yanındaki çarpıya (*Kapat*) tıklayın ya da genel bakıştaki bir kartın üzerindeki çarpıya tıklayın. Değişikliği olmayan bir proje hemen kapanır. Kaydedilmemiş değişiklikleri varsa uygulama *Kaydedilmemiş değişiklikler* penceresini açar ve üç seçenek sunar:

- *Kaydet* projeyi kaydeder ve sonra kapatır.
- *Kaydetme* projeyi kapatır ve değişiklikleri atar.
- *İptal* projeyi açık bırakır.

Kaydetmeyi iptal ederseniz, örneğin kayıt penceresini kapatarak, proje açık kalır.

Son projeyi kapatırsanız, adı *Yeni planlama* olan boş bir planlama kalır.

### Geçiş stilini seçme

Sekmeler bir tercihtir. Başlık alanındaki dişli simgesiyle *Uygulama ayarları* penceresini açın, *Görünüm* sekmesine gidin ve *Belge değiştirme stili* altında seçin:

- *Yatay sekmeler*: varsayılan. Şeridin altında bir sekme satırı.
- *Dikey sekmeler*: solda dar bir kenar çubuğu, her proje için bir düğme (adın ilk harfleri) ve bir artı işareti. Düğmenin üzerinde durduğunuzda ad, dosya adı, görev sayısı, kritik görev sayısı ve bitiş tarihini görürsünüz. En üstteki düğme genel bakışı açar.
- *Hap*: başlık alanında, etkin projenin adını ve *2 açık* gibi bir sayacı gösteren tek bir hap. Genel bakışı açmak ve orada geçiş yapmak için tıklayın.

Üç stil de aynı genel bakışı açar ve Ctrl+1 ile Ctrl+9 her stilde çalışır.

## Sorunlar ve uygulamanın davranışı

**Projeye ait olan ve paylaşılan şeyler.** Her projenin kendi görünümü vardır: yakınlaştırma ve konum, filtre, gruplama veya sıralama içeren etkin bir düzen, bölünmüş görünüm, ilişki çizgileri ve daraltılmış aşamalar. Başka bir projeye geçerseniz, orada o projenin kendi görünümünü görürsünüz. Tüm projelerde ortak olanlar: şeritte seçili sekme, mini harita, katmanlar (temel plan katmanı, ilerleme çizgisi ve diğerleri), sütun seçiminiz, düzenleriniz ve rapor seçimleriniz.

**Pencere açıkken geçiş yapamazsınız.** Bir pencere açık olduğu sürece, örneğin *Uygulama ayarları* penceresi ya da bir görev penceresi, Ctrl+1 ile Ctrl+9 uygulamada hiçbir şey yapmaz. Tarayıcıda ise tarayıcı sekmeleri değişir. Önce pencereyi kapatın. Backstage'deki *Proje ayarları* içinde uygulanmamış bir değişiklik de geçişi engeller.

**Ctrl+1 ile Ctrl+9 sıraya göre sayar.** Kısayol, satırdaki o konumdaki projeye gider. Bir projeyi kapatırsanız, diğer projelerin konumu bir üst sıraya kayar. Dokuzdan fazla proje açıksa, kalanlara yalnızca sekmeler veya genel bakış üzerinden ulaşırsınız.

**Hesapla ve raporlar etkin projede çalışır.** Hesapla (F5), *PDF dışa aktar* ve raporlar şu anda etkin olan projeyle ilgilidir.

## Ayrıca bakın

- [Düzen oluşturma ve kullanma](docs://howto-layouts-gebruiken): her proje için bir görünüm ayarlama.
- [Rapor oluşturma ve yazdırma](docs://howto-rapport-maken-en-afdrukken): etkin projenin raporu.
