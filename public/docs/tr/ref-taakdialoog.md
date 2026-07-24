# Görev iletişim penceresi

**Görevi düzenle** penceresi, bir görevin tüm özelliklerini gösterir — sağdaki özellikler panelindeki aynı alanlar ve bölümler, ama açık bir kaydetme adımına sahip bir pencerede.

## Açma

- Gantt'ta bir göreve **çift tıklayın**.
- Bir görev seçiliyken **F2**.
- **Sağ tıklayın** bir göreve → **Düzenle...**

## Kaydetme ve iptal etme

- **Kaydet**, tüm alan değişikliklerini tek seferde uygular; ad boşken düğme devre dışıdır. **Enter**, Kaydet ile aynı şeyi yapar (çok satırlı bir metin kutusu içi hariç).
- **İptal**, **Esc**, kapatma çarpısı veya pencerenin dışına bir tıklama, alan değişikliklerini uygulamadan kapatır.
- İstisna: **Bağımlılıklar**, **Atamalar** ve **Kodlar ve alanlar** bölümleri doğrudan plan üzerinde çalışır (panelle aynı) — buradaki değişiklikler, sonra iptal etseniz bile hemen etkili olur.

## Alanlar

- **Ad \*** — zorunlu; iletişim penceresi açıldığında otomatik olarak odak alır.
- **WBS Kodu** — serbest giriş. WBS otomatik numaralandırma açıkken (Planlama → Yapı) alan kilitlidir: uygulama kodları yönetir.
- **Açıklama** — serbest metin.
- **Tür** — görev türü (örneğin İnşaat); çubuk renk kodlamasını belirler.
- **Takvim** — **Proje takvimi** veya kütüphaneden belirli bir takvim; bu görevin çalışma günlerini belirler.
- **Üst görev** — görevi farklı bir üst göreve taşıyın, veya **- Yok (kök) -**. Bu alan yalnızca iletişim penceresinde vardır; panelde, yeniden yapılandırma sürükleyerek veya girinti/girintiyi kaldırarak yapılır.

## Notlar

Görev başına bir kontrol listesi: her satırın bir **tamamlandı onay kutusu**, bir metin kutusu ve bir kaldırma düğmesi vardır; **Not ekle** yeni bir satır oluşturur. Tamamlanmış satırlar üstü çizilidir. Bkz. [Planlama & WBS](docs://gids-plannen-wbs).

## Kilometre taşı

- **Kilometre taşı** — işaretlemek süreyi 0'a ayarlar ve bir çubuk yerine elmas gösterir.
- **Kilometre taşı türü** — **Otomatik**, **Başlangıç kilometre taşı** veya **Bitiş kilometre taşı**.
- **Zorunlu (sözleşmesel)** — kilometre taşını sözleşmesel olarak işaretler.

## Zaman

- **Başlangıç tarihi** — hesaplanan erken başlangıcı gösterir; manuel bir değişiklik yeni tarihi planlanan başlangıç olarak sabitler.
- **Süre (iş günü)** — tam iş günü; bir kilometre taşı için devre dışıdır.
- **Saat planlaması etkinken** ve görevde bir saat takvimi varken, üç senkronize kutu görünür: **Gün**, **Saat** ve **Toplam saat** (yalnızca tam sayılar). Bir saat takvimi olmadan bir ipucu gösterilir: "Saat girişi bir saat takvimi (çalışma saatleri) gerektirir." Bkz. [Takvimler & saat planlaması](docs://gids-kalenders-uren).

## Hammock (türetilmiş süre)

Yalnızca alt görevi olmayan ve kilometre taşı olmayan bir görevde. İşaretlemek süreyi türetilmiş yapar: **Başlangıç driver**'ı (gelen FS/SS ilişkisi) ile **Bitiş driver**'ı (gelen FF/SF ilişkisi) arasındaki aralık, her ikisi de salt okunur gösterilir. Bir bitiş driver'ı eksikse, iletişim penceresi aralığın sıfır uzunluğa döndüğünü bildirir. Bkz. [Kritik yol & ileri düzey analiz](docs://gids-kritiek-pad-analyse).

## Kısıtlama ve son tarih

- **Kısıtlama** — Mümkün olduğunca erken (ASAP), Mümkün olduğunca geç (ALAP), Şu tarihten önce başlamaz (SNET), Şu tarihten sonra başlamaz (SNLT), Şu tarihten önce bitmez (FNET), Şu tarihten sonra bitmez (FNLT), Şu tarihte başlamalı (MSO) veya Şu tarihte bitmeli (MFO); uygunsa bir **Kısıtlama tarihi** ile.
- **Zorunlu (sabitleme mantığı)** — yalnızca MSO/MFO: tarihi sıkı biçimde sabitler ve ilişki mantığını geçersiz kılar; bir ihlal, yukarı akışta negatif bolluğa dönüşür.
- **İkincil kısıtlama** — bir **İkincil tarih**e sahip ikinci bir sınır (SNET/FNET/SNLT/FNLT); sıkı bir sabitlemeyle mümkün değildir. İzin verilmeyen kombinasyonlar bir nedenle kırmızıya döner.
- **Son tarih** — hesaplamanın dışında bir hedef tarih; kaçırmak bir kayma değil, bir uyarı verir. Bkz. [İlişkiler & kısıtlamalar](docs://gids-relaties-constraints).

## İlerleme

- **İlerleme (%)** — 0-100% kaydırıcı.
- **Gerçek başlangıç** / **Gerçek bitiş** — kaydedilen gerçekler; bir kilometre taşı için tek bir **Gerçek tarih** alanı. Durum tarihinden sonraki tarihler reddedilir.
- **Kalan (iş günü)** — salt okunur, süre × (1 − ilerleme)'den türetilir. Bkz. [Baseline'lar & ilerleme](docs://gids-baselines-voortgang).

## CPM Sonucu (salt okunur)

**Erken başlangıç/bitiş**, **Geç başlangıç/bitiş**, **Toplam bolluk**, **Serbest bolluk**, **Müdahale bolluğu** (hesaplandığında) ve **Kritik yol** (evet/hayır). Bir hesaplamadan (F5) sonra doldurulur.

## Bağımlılıklar

Bu görevin tüm ilişkileri: yön (→ ardıl, ← öncül), diğer görev, **belirleyici ilişki** üzerinde bir şimşek simgesi, ilişki türü (FS/SS/FF/SF), **gecikme** (örn. 2d, 3ed, %50) ve bir kaldırma düğmesi. Değişiklikler hemen etkili olur.

## Atamalar

Atanan her kaynak için: ad, **Birim/gün**, **Eğri**, **Taşı…** (atamayı başka bir göreve taşı) ve kaldır; altta **Kaynak ata**. Kilometre taşlarında veya özet görevlerde mümkün değildir. Hemen etkili olur. Bkz. [Kaynaklar, histogram & nivelleme](docs://gids-resources-histogram).

## Kodlar ve alanlar

Yalnızca projenin aktivite kodu türleri veya kullanıcı alanları olduğunda görünür: kod türü başına bir değer seçici, kullanıcı alanı başına türlenmiş bir giriş. Hemen etkili olur. Tanımlar yapı iletişim penceresinde yönetilir — bkz. [Kodlar & alanlar](docs://ref-codes-velden).
