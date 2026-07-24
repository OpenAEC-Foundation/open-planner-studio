# Bir çökmeden sonra kurtarma

Masaüstü uygulaması, çalışmanızın kurtarma anlık görüntülerini otomatik olarak tutar. Uygulama beklenmedik şekilde kapanırsa (çökme, elektrik kesintisi), bir sonraki başlatmada o çalışmayı geri getirmeyi teklif eder.

## Otomatik kaydetmenin nasıl çalıştığı

- Her değişiklikten kısa bir süre sonra (bir saniyeden az), uygulama açık her belge için kendi veri klasörüne bir anlık görüntü yazar — hiç kaydedilmemiş belgeler dahil, tüm açık sekmeler için.
- Bu, kaydetmenin yerini almaz: proje dosyanızın kendisi değişmez. Bu yüzden çalışmanızı Ctrl+S ile kendiniz kaydetmeye devam edin.
- Kurtarma penceresinde bir seçim yaptığınız anda (**Geri yükle** veya **Geri yükleme**) anlık görüntüler temizlenir.
- **Yalnızca masaüstü uygulaması.** Tarayıcı sürümünde otomatik kaydetme ve kurtarma yoktur — orada düzenli olarak kendiniz kaydedin.

## "Kaydedilmemiş çalışmayı geri yükle" penceresi

Anlık görüntüler bulunduğunda başlangıçta görünür: "Open Planner Studio normal şekilde kapanmadı. Aşağıdaki belgelerde geri yüklenebilecek kaydedilmemiş değişiklikler vardı:" Her belge için şunları gösterir:

- **ad** (dosya adı veya proje adı; adsız: "Adsız proje");
- belge hiç kaydedildiyse **dosya yolu**;
- anlık görüntüdeki **görev sayısı**;
- **Kaydedildi** — en son anlık görüntünün zamanı.

## Seçimler

- **Geri yükle** (veya **Enter**) — listelenen tüm belgeler açık sekmeler olarak geri gelir. O zaman kaydedilmemiş sayılırlar: kendiniz kaydedin.
- **Geri yükleme** — anlık görüntüler atılır; boş bir projeyle başlarsınız.
- **Kapatma çarpısı**, **Esc** veya pencerenin dışına bir tıklama — güvenli bir şekilde erteleyin: hiçbir şey atılmaz ve hiçbir şey geri yüklenmez; soru bir sonraki başlatmada tekrar görünür.

## Daha fazla okuma

- [Hızlı başlangıç](docs://quick-start) — projeleri kaydetme ve açma.
