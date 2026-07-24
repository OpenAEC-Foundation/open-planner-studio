# Takvim iletişim penceresi

**Takvimler** penceresi, projenin takvim kütüphanesini yönetir: solda tüm takvimlerin listesi, sağda seçili takvimin düzenleme formu.

## Açma

- **Planlama** → **Takvim** şerit grubu → **Takvim** veya **Tatiller** düğmesi.
- **Ayarlar** (şerit sekmesi) → **Takvim** şerit grubu → **Takvim**.
- Proje sihirbazından: takvim olarak **Özel…**'i seçmek, oluşturmadan hemen sonra bu pencereyi açar.

## Uygulama ve iptal etme

Tüm düzenlemeler — yeni/çoğalt/sil dahil — bir çalışma kopyasında gerçekleşir. **Uygula** (veya **Enter**) her şeyi tek seferde yazar ve planı yeniden hesaplar; **İptal**, **Esc**, kapatma çarpısı veya pencerenin dışına bir tıklama tüm değişiklikleri atar.

## Kütüphane (sol sütun)

- **Liste** — tüm takvimler; yıldız **Proje takvimi**ni işaretler (kendi takvimi olmayan görevler için varsayılan).
- **+** — **Yeni takvim**.
- **Çoğalt** — seçili takvimin bir kopyası.
- **Sil** — son takvim için mümkün değildir; proje varsayılanını silmek başka bir takvimi varsayılan yapar.
- **Proje varsayılanı olarak ayarla** — seçili takvimi proje takvimi yapar (formun üzerindeki düğme).

## Form (sağ sütun)

- **Ad** — serbest ad.
- **Çalışma günleri** — **Pzt** ile **Paz** arası düğmeler; açık = çalışma günü. Ön ayarlar: **Pzt–Cum** (standart hafta, 07-16 saat, 8 saat/gün) ve **Sürekli (24/7)**.
- **Başlangıç (saat)** / **Bitiş (saat)** / **Günlük saat** — gün genelindeki çalışma süresi. Takvimin çalışma-saati bantları olduğunda ve saat planlaması açıkken gizlenir; bantlar o zaman zamanları yönlendirir.

## Çalışma saatleri (yalnızca saat planlaması etkinken)

- **Türetilmiş saat/gün** — kontrol rakamı, bantlardan türetilir.
- Ön ayarlar: **Gündüz vardiyası**, **2 vardiya**, **3 vardiya**, **Gece vardiyası**, **24/7** — her biri çalışma-saati bantlarını tek seferde ayarlar.
- **Ön ayar olarak kaydet…** — geçerli çalışma saatlerini kendi ön ayarınız olarak kaydedin (bu cihazda); kendi ön ayarlarınız, silme çarpılı düğmeler olarak görünür.
- **Haftanın gününe göre ayarla…** / **Çalışma saatlerini göster/gizle** — bant düzenleyicisini açar veya daraltır.
- **Bant düzenleyicisi** — haftanın günü başına bir zaman bantları listesi (başlangıç-bitiş), her biri bir **sonraki gün** onay kutusuyla (gece yarısını geçen gece vardiyası), **Bant ekle** (iki bant arasındaki bir boşluk bir moladır), **Tüm iş günlerine kopyala**, gün başına saat toplamı ve altta türetilmiş saat/gün. Bkz. [Takvimler & saat planlaması](docs://gids-kalenders-uren).

## Tatilleri oluştur…

Tatil listesini proje dönemi boyunca kural bazlı olarak oluşturur:

- **Ülke** — Hollanda, Almanya, Belçika, Fransa, Birleşik Krallık, Avusturya, İsviçre veya **Tatil yok**.
- **Bölge** — yalnızca bölgesel setleri olan ülkeler için; varsayılan **Ulusal**.
- **İnşaat tatili** — yalnızca Hollanda: **Yok**, **Kuzey**, **Orta** veya **Güney**; bunların tavsiye niteliğinde tarihler olduğuna dair bir ipucuyla.
- **Önizleme** — özet satır ("n tatil, yıl-yıl"), tam listeye genişletilebilir.
- **Oluştur** tatil listesinin yerini alır; **İptal** bloğu kapatır.
- Proje şimdi oluşturulan yılların ötesine geçiyorsa, üstte bir **Yeniden oluştur** düğmesiyle bir ipucu görünür.

## Tatiller

Listenin kendisi: satır başına **Açıklama**, **Başlangıç**, **Bitiş** ve bir kaldırma düğmesi; **Tatil ekle** yeni bir satır oluşturur. Çok günlük dönemler (inşaat tatili, don gecikmesi) basitçe daha uzun bir Başlangıç-Bitiş aralığına sahip bir satırdır.
