# Sütun seçimi

**Sütunlar** penceresi, Tablo sekmesinin hangi sütunları, hangi sırada ve ne genişlikte gösterdiğini kontrol eder. (Gantt'ın solundaki görev tablosunun sabit sütunları vardır: WBS, Görev adı ve Süre.)

## Açma

**Görünüm** → **Görüntüleme** şerit grubu → **Sütunlar…**. Her değişiklik hemen uygulanır — ayrı bir Tamam adımı yoktur; **Kapat**, **Esc**, kapatma çarpısı veya pencerenin dışına bir tıklama kapatır.

## Seçilen sütunlar

Sütun başına bir satır, şunlarla:

- **Sürükleme tutamacı** — sütun sırasını değiştirmek için satırı sürükleyin.
- **Görünür** — işareti kaldırmak, sütunu listeden kaldırmadan gizler.
- **Ad** — tablonun gösterdiği şekilde alan etiketi.
- **Genişlik** — piksel cinsinden (minimum 40).

## Kullanılabilir alanlar

Seçilen sütunların altında **Kullanılabilir alanlar** listesi bulunur: henüz bir sütun olmayan her alan. Birine tıklamak onu bir sütun olarak ekler. Standart alanların yanı sıra, **Kilometre taşı**, **Serbest bolluk**, **Müdahale bolluğu**, **Kritiğe yakın** ve **Bolluk yolu** analiz alanlarını, artı **Kaynaklar**'ı ve projenin aktivite kodlarını ve kullanıcı alanlarını bulacaksınız. Üç bolluk alanı ve Bolluk yolu, yalnızca eşleşen planlama seçenekleriyle bir hesaplamadan sonra değer alır — bkz. [Kritik yol & ileri düzey analiz](docs://gids-kritiek-pad-analyse).

## Varsayılana sıfırla

**Varsayılana sıfırla** düğmesi sütun seçicinin en altındadır (tablo başlığının sağındaki artı veya **Tablo** sekmesi → **Sütunlar…**). Tek tıklama o tablonun sütunlarını varsayılan düzene geri döndürür: hangi sütunların gösterildiği, sıraları ve genişlikleri ile sabitlenmiş sütunlar. Sonradan eklenen alanlar tablodan kalkar ve listede seçilebilir kalır. Bir güncellemeden sonra yeni varsayılan düzeni de böyle alırsınız, örneğin **Planlanan başlangıç** ve **Planlanan bitiş** yerine **Başlangıç** ve **Bitiş**: daha önce kaydedilmiş kendi düzeniniz kendiliğinden değişmez. Bu tek bir işlemdir, bu yüzden **Ctrl+Z** kendi düzeninizi geri getirir. Tablo zaten varsayılan düzendeyse düğme devre dışıdır.

Sütun seti kaydedilmiş bir layout'un parçasıdır — bkz. [Layout kaydetme & yükleme](docs://ref-layouts).

## Daha fazla okuma

- [Filtreler](docs://ref-filters) — tablonun ve Gantt'ın hangi görevleri gösterdiği.
