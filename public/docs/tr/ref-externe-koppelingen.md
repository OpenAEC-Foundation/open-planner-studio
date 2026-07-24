# Dış bağlantılar

**Dış (projeler arası) bağlantı** penceresi, bu projedeki bir görev ile farklı bir proje dosyasındaki bir görev arasındaki bir bağımlılığı kaydeder — örneğin sizin başlangıcınızdan önce bitmesi gereken bir saha işleri projesi.

## Açma

**İlişkiler** sekmesi → **Dış bağlantı…** düğmesi. Tam olarak bir görev seçili olmalıdır; aksi takdirde "Dış bağlantı eklemek için tek bir görev seçin." görünür.

## Dondurulmuş bağlantı noktası

Bir dış bağlantı, kaynak projeye karşı canlı olarak hesaplanmaz. Onu eklediğinizde, kaynak görevin ilgili tarihi (yön ve ilişki türüne bağlı olarak başlangıç veya bitiş), sabit bir **bağlantı noktası tarihi** olarak saklanır; hesaplama bu tarihi bir sınır olarak kullanır. Kaynak proje sonradan değişirse, siz bağlantıyı **yenile**yene kadar hiçbir şey birlikte kaymaz.

## İki yol

- **Kaynak dosya** — **Son kullanılan bir dosya seç** altından bir dosya seçin; salt okunur olarak okunur ("Kaynak dosya salt okunur olarak okunur — belge olarak açılmaz."). Ardından listeden **Kaynak görev**i seçin; bağlantı noktası tarihi o görevden otomatik olarak okunur ve altta gösterilir. Bu yol masaüstü uygulamasını ve en az bir son kullanılan dosyayı gerektirir.
- **Manuel (yedek)** — elinizde dosya yok (veya tarayıcı sürümü): dış görevin **Proje kimliği**'ni ve **Görev kimliği**'ni yapıştırın, isteğe bağlı olarak bir **Görev adı**, ve **Bağlantı noktası tarihi**'ni kendiniz girin. Bir yenileme gerçekten kaynağı bulana kadar manuel bir bağlantı "eski" olarak işaretlidir.

## Ortak alanlar

- **Yön** — **Öncül (dış → ben)**: dış görev benim görevimi belirler; veya **Ardıl (ben → dış)**: benim görevim dış olanı belirler.
- **İlişki türü** — FS, SS, FF veya SF.
- **Gecikme (iş günü)** — bağlantı noktasının üzerine bekleme süresi (veya negatif: örtüşme).

**Bağlantı ekle** bağlantıyı kaydeder (gerekli alanlar doldurulana kadar devre dışı); **İptal** eklemeden kapatır.

## Yönetim, yenileme ve eksik kaynaklar

Mevcut bağlantılar, İlişkiler panelinde **Dış bağlantılar** altında listelenir:

- Bağlantı başına: kaynak görev, tür, bağlantı noktası, ve kaynak (artık) yüklenemediğinde bir **eski** rozeti — "kaynak yüklenmedi — yenilemek için yeniden içe aktarın" açıklamasıyla.
- **Bu bağlantıyı yenile** — bu tek bağlantının kaynak dosyasını yeniden okur ve bağlantı noktasını günceller.
- **Dış bağlantı noktalarını yenile** — referans verilen her kaynak dosyayı yeniden okur ve tüm bağlantı noktalarını artı eski durumunu günceller. Sonrasında bir durum satırı kaç bağlantı noktasının yenilendiğini ve kaçının eski kaldığını bildirir.
- **Kaldır** — bağlantıyı siler.
- Yenileme dosya okur ve bu nedenle yalnızca masaüstü uygulamasında çalışır; tarayıcı sürümü "Kaynak dosyaları okumak yalnızca masaüstü uygulamasında mümkündür; manuel yedeği kullanın." bildirir.

## Daha fazla okuma

- [Kritik yol & ileri düzey analiz](docs://gids-kritiek-pad-analyse) — dış bağlantıların kritik yola nasıl beslendiği.
