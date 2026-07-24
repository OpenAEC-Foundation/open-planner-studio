# Filtreler

**Filtre** penceresi, hangi görevlerin görünür olduğunu kontrol eder — Gantt'ta ve Tablo sekmesinde. Bir filtre, isteğe bağlı olarak gruplara paketlenmiş kurallardan (alan + operatör + değer) oluşur.

## Açma

**Görünüm** → **Görüntüleme** şerit grubu → **Filtre…**. Bir filtre etkinken düğme vurgulanmış kalır. **Esc**, kapatma çarpısı veya pencerenin dışına bir tıklama, uygulamadan kapatır.

## Gruplar: hepsi veya herhangi biri

Her grubun üstünde, kurallarının nasıl birleştiğini seçersiniz:

- **Aşağıdakilerin tümü (AND)** — bir görev her kuralla eşleşmelidir.
- **Aşağıdakilerden herhangi biri (OR)** — bir kuralla eşleşmek yeterlidir.

**+ kural** bir kural ekler; **+ grup** (yalnızca üst düzey) iç içe bir grup ekler, böylece AND ve OR'u birleştirebilirsiniz — örneğin "Kritik evet VE (Tür İnşaat VEYA Tür Kurulum)". Kural olmadan pencere şunu gösterir: "Henüz kural yok — bu filtre her şeyle eşleşir."

## Bir kural: alan, operatör, değer

- **Alan** — tüm görev alanları: WBS, Görev adı, Süre, Başlangıç, Bitiş, Tür, Kritik, Toplam bolluk, İlerleme, Kilometre taşı, Serbest bolluk, Müdahale bolluğu, Kritiğe yakın, Bolluk yolu ve Kaynaklar, artı projenin aktivite kodları ve kullanıcı alanları.
- **Operatör** — alan türüne göre uyarlanır:
- metin: **eşittir**, **eşit değildir**, **içerir**, **ile başlar**, **boş**;
- sayı ve tarih: ayrıca **küçüktür**, **küçük veya eşittir**, **büyüktür**, **büyük veya eşittir** ve **arasında** (**Başlangıç**/**Bitiş** ile);
- evet/hayır alanları (Kritik ve Kilometre taşı gibi): bir **Evet**/**Hayır** seçimi;
- seçim alanları (Tür veya bir aktivite kodu gibi): **şunlardan biri**, işaretlenebilir değerlerle.
- **Değer** — giriş alan türünü takip eder (metin kutusu, sayı, tarih veya seçici); **boş**'un bir değer girişi yoktur.

Bir kuralın arkasındaki çöp kutusu simgesi o kuralı kaldırır; iç içe bir grubun sağ üstündeki çarpı tüm grubu kaldırır.

## Uygula, iptal et ve temizle

- **Uygula** filtreyi etkinleştirir ve pencereyi kapatır. Kuralı olmayan bir filtre "filtre yok" sayılır.
- **İptal** değişiklikleri uygulamadan kapatır.
- **Temizle** etkin filtreyi hemen kapatır ve düzenleyiciyi boşaltır.

Etkin bir filtre kaydedilmiş bir layout'un parçasıdır — bkz. [Layout kaydetme & yükleme](docs://ref-layouts).

## Daha fazla okuma

- [Sütun seçimi](docs://ref-kolommen) — tablonun hangi sütunları gösterdiği.
