# Sütun seçimi

**Tablo** (**Tablo** sekmesi) ve Gantt'ın yanındaki görev listesinin her birinin kendi sütunları vardır. Bunları tablonun kendisinde değiştirirsiniz: tablo başlığındaki artı sütun seçiciyi açar, sütun başlığında ise bir sütunu taşır, genişletir, sabitler veya kaldırırsınız. Her değişiklik hemen uygulanır; Tamam adımı yoktur.

Varsayılan olarak Gantt'ın yanındaki görev listesi **İş kırılım yapısı (WBS)**, **Görev adı** ve **Süre** sütunlarını gösterir. Tablo bunlara ek olarak **Başlangıç**, **Bitiş**, **Görev türü**, **Kritik**, **Toplam bolluk** ve **İlerleme** sütunlarını, ayrıca projenin aktivite kodlarını ve kullanıcı alanlarını gösterir.

## Sütun seçiciyi açma

- Tablo başlığının sağındaki artı. Tablo ve Gantt'ın yanındaki görev listesinin her birinin, yalnızca kendi tablosunu değiştiren kendi artısı vardır.
- **Tablo** sekmesi → **Sütunlar…**, Tablo'nun sütun seçicisini açar.
- Klasik görünüm düğmeleri açıksa (**Ayarlar** → **Gelişmiş** sekmesi → **Eski özellikler** → **Klasik görünüm düğmelerini göster**), **Görünüm** → **Görüntüleme** şerit grubu → **Sütunlar…** aynı şeyi yapar: düğme Tablo sekmesine geçer ve sütun seçiciyi orada açar.

**Esc**, seçicinin dışına bir tıklama veya artıya yeniden tıklama seçiciyi kapatır.

## Sütun ekleme

**Sütun seç** seçicisi yukarıdan aşağıya şunları içerir:

- **Son kullanılanlar** — seçiciyle yakın zamanda eklediğiniz alanlar. Bu blok, bir sütun ekler eklemez görünür.
- **Ara** alanı — bir alan adının bir kısmını yazın; **Arama sonuçları** tüm gruplardan gelir.
- Gruplara göre alanlar: **Görev**, **Planlama**, **Kısıtlamalar**, **İlişkiler**, **Kaynaklar**, **İlerleme**, **Hesaplanan**, **Temel plan**, **Özel** ve **Teknik**. Bir gruba tıklamak onu açar; yanındaki sayı o gruptaki alan sayısıdır.
- En altta **Varsayılana sıfırla** düğmesi (aşağıya bakın).

Bir alanı son sütun olarak eklemek için üzerine tıklayın; seçici bunun ardından kapanır. Zaten sütun olan bir alan işaretlidir ve yeniden seçilemez. Projenin aktivite kodları ve kullanıcı alanları **Özel** altında, temel planlarınızın alanları **Temel plan** altında bulunur.

**Hesaplanan** altında diğerlerinin yanı sıra **Serbest bolluk**, **Engelleyici bolluk**, **Kritiğe yakın** ve **Bolluk yolu** analiz alanları bulunur. Bunlar yalnızca bir hesaplamadan (**F5**) sonra değer alır; **Kritiğe yakın** ve **Bolluk yolu** ise yalnızca ilgili planlama seçeneği açıksa — bkz. [Kritik yol & ileri düzey analiz](docs://gids-kritiek-pad-analyse).

## Sütun başlığında sütunları düzenleme

- **Taşıma** — bir sütun başlığını başka bir yere sürükleyin. Sabitlenmiş sütunlar başta bir arada kalır; sabitlenmemiş bir sütunu yalnızca sabitlenmemiş sütunlar arasında taşırsınız.
- **Genişlik** — bir sütun başlığının sağ kenarını sürükleyin (40 ile 480 piksel arası). Bu kenara çift tıklamak sütunu başlığa ve en uzun değere sığdırır. Klavyeyle: odağı kenara getirin ve sol ve sağ ok tuşlarını kullanın; daha büyük adımlar için **Shift** ile.
- **Kaldırma** — işaretçiyle sütun başlığının üzerine geldiğinizde başlıkta beliren eksi işareti. Alan, sütun seçicide seçilebilir kalır.
- Bir sütun başlığına **sağ tıklama** **Sabitle** (veya **Sabitlemeyi kaldır**), **Otomatik sığdır** ve **Kaldır** seçeneklerini sunar. Sabitlenmiş bir sütun başa, diğer sabitlenmiş sütunların yanına geçer ve tabloyu yatay kaydırdığınızda görünür kalır (sabitlenmiş sütunlar birlikte tabloya sığdığı sürece).

## Başlangıç, Bitiş ve planlanan tarihler

**Başlangıç** ve **Bitiş** (Tablo'nun varsayılan düzeninde) Gantt'taki çubukla aynı tarihleri gösterir: hesaplanan planı, ilk hesaplamadan önce ise girilen tarihleri. Başlangıç'a başka bir tarih yazarsanız, bu planlanan başlangıç olur. Farklı bir Bitiş, otomatik planlanan bir görevin süresini değiştirir; elle planlanan bir görevde planlanan bitiş olur. Ardından yeniden hesaplamak için **F5**'e basın. Aynı tarihi tekrar yazarsanız hiçbir şey değişmez.

**Planlanan başlangıç** ve **Planlanan bitiş** alanları, hesaplama görevi kaydırsa bile girilen tarihlerin kendisini gösterir. Planlanan bitiş yalnızca elle planlanan bir görevde düzenlenebilir: diğer görevlerde bitişi başlangıç ve süre belirler. Otomatik planlanan bir özet görevin Başlangıç ve Bitiş değerleri alt görevlerinden gelir ve düzenlenemez.

## Varsayılana sıfırla

**Varsayılana sıfırla** düğmesi sütun seçicinin en altındadır. Tek tıklama o tablonun sütunlarını varsayılan düzene geri döndürür: hangi sütunların gösterildiği, sıraları ve genişlikleri ile sabitlenmiş sütunlar. Sonradan eklenen alanlar tablodan kalkar ve seçicide seçilebilir kalır. Bir güncellemeden sonra yeni varsayılan düzeni de böyle alırsınız, örneğin **Planlanan başlangıç** ve **Planlanan bitiş** yerine **Başlangıç** ve **Bitiş**: daha önce kaydedilmiş kendi düzeniniz kendiliğinden değişmez. Tablo zaten varsayılan düzendeyse düğme devre dışıdır.

## Kaydetme, geri alma ve layout'lar

Sütun düzeni bu cihazdaki kişisel bir tercihtir: tüm projeleriniz için geçerlidir ve proje dosyasına kaydedilmez. Her sütun işlemi — ekleme, kaldırma, taşıma, genişletme, sabitleme veya **Varsayılana sıfırla** — **Ctrl+Z** ile geri alınan tek bir adımdır.

Bir layout sütunları da kaydedebilir. Layout'u oluştururken gördüğünüz tablonun düzenini alır ve layout düğmesine tıklandığında bunu o anda görünen tabloya uygular: Tablo sekmesinde Tablo'ya, diğer sekmelerde Gantt'ın yanındaki görev listesine. Bkz. [Layout kaydetme & yükleme](docs://ref-layouts).

## Daha fazla okuma

- [Filtreler](docs://ref-filters) — tablonun ve Gantt'ın hangi görevleri gösterdiği.
