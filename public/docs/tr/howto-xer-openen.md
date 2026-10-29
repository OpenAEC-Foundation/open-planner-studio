# Primavera P6 dosyasını açma (.xer)

Amaç: bir planlamayı Primavera P6'dan önce XML'e aktarmadan, doğrudan uygulamada açmak.

## Ne zaman gerekir

Bir müşteri veya ana yüklenici Primavera'da çalışır ve planlamasını bir `.xer` dosyası olarak teslim eder. Bunu görüntülemek, hesaplamak veya üzerine eklemek istersiniz. Uygulama yalnızca `.xer` dosyalarını okur: `.xer` dosyası yazmaz ve dosyanızı asla değiştirmez. Dosyadan WBS yapısını, süresi, tarihleri, kısıtlamaları ve ilerlemesi olan görevleri, gecikmeleriyle birlikte ilişkileri, takvimleri ve atamalarıyla birlikte kaynakları alır. Ayrıca etkinlik kodlarını, özel alanları (UDF), notları ve P6'nın planlama ayarlarını alır. Türü *Çaba düzeyi* olan bir görev hamağa dönüşür.

## Adımlar

1. *Ana sayfa › Dosya › Aç* öğesini seçin veya Ctrl+O tuşlarına basın. `.xer` dosyasını seçin.
2. Uygulama, görevi olan her proje için bir sekme açar. En çok göreve sahip proje etkin sekmedir. P6 proje kimliği addan farklıysa sekme *Proje adı (Proje kimliği)* olarak adlandırılır. *Proje ayarları* yalnızca adı gösterir. Projeyi yeniden adlandırırsanız proje kimliği adın arkasında kalır. Bir pencere ardından uygulamanın dosyadan neyi devraldığını ve kaydetmenin nasıl çalıştığını kısaca açıklar. Bkz. [Bir dosyayı açma ve kaydetme](docs://howto-bestand-openen-en-opslaan).
3. Alttaki mesajı okuyun. Üç proje içeren bir dosyada bu şöyle görünebilir: *XER dosyası açıldı: 3 proje belgesi.* Altında uygulamanın ne yaptığını açıklayan satırlar yer alır. Aşağıdaki başlığa bakın.
4. Şeridin altında bir bilgi alanı olup olmadığını kontrol edin: *Planı Primavera'nın kaydettiği şekilde görüntülüyorsunuz; yeniden hesaplama 1 görevi kaydırır.* Primavera kendi hesapladığı tarihleri dosyaya kaydeder. Uygulamanın hesabı bunlardan farklıysa, siz bir şey değiştirmediğiniz sürece uygulama Primavera'nın tarihlerini gösterir. Başlamış veya tamamlanmış bir görev, Primavera'da olduğu gibi her zaman gerçek tarihlerinde yer alır. Bunun ne anlama geldiği ve uygulamanın kendi hesabına nasıl geçeceğiniz için bkz. [Kaydedilen tarihler](docs://uitleg-datums-zoals-opgeslagen). Ayrıca *Bu dosya saat bazlı planlama içeriyor.* mesajı görünebilir; bu durumda *Saat planlamasını etkinleştir* düğmesi çıkar. Bkz. [Saat planlamasını açma](docs://howto-urenplanning-aanzetten).
5. Projenizi Ctrl+S ile kaydedin. Bir `.xer` dosyasının üzerine asla yazılmadığı için uygulama yeni IFC dosyasının nereye kaydedileceğini sorar. Dosya adı olarak *Proje adı (Proje kimliği)* önerir.

### Mesajın altındaki satırlar

Mesajın ilk satırı açılan sekme sayısını verir. Altında yalnızca geçerli olan satırlar yer alır. Bunlara dikkat edin:

- *Bu proje Primavera P6 olarak hesaplanıyor. Değiştirmek için “Dosya” → “Proje Bilgileri” → “Hesaplama profili ve seçenekleri” yolunu izleyin.* Uygulama bu projeyi Primavera'nın hesaplama kurallarıyla hesaplar. *Hesaplama profilini aç* ile ayara gidersiniz.
- *1 temel proje dışarıda bırakıldı.* ve *1 temel plan oluşturuldu.* Bir P6 projesi başka bir projeyi kendi temel planı olarak belirlerse, bu diğer proje kendi sekmesi olarak açılmaz. Bu diğer proje, ona başvuran projenin etkin temel planı olur.
- *Koruyucu temel plan geri dönüşü kullanıldı.* Temel planları belirlemek hiçbir projenin açılmamasına yol açacaksa, bir proje kendisine başvuruyorsa veya projeler birbirine döngü içinde başvuruyorsa, uygulama yalnızca tüm projeleri açar ve temel plan oluşturmaz.
- *1 dış ilişki korundu.* Bu, iki proje arasındaki bir dış ilişkidir. Uygulama bunu kaynak verisi olarak saklar, ancak planlamanızda bir ilişkiye dönüştürmez.
- *12 görev, Primavera'nın kaydettiği tarihleri gösteriyor (yeniden hesaplanmadı).* Bu, *Kaydedilen tarihler* görünümünde Primavera'nın tarihlerini gösteren görev sayısıdır: dosyanın tarih kaydettiği her görev, yalnızca farklı olanlar değil.

Diğer satırlar, okumanın kendisine ilişkin tanılamalardır. Bunlar sizden bir şey istemez:

- bulunan proje sayısı;
- atlanan boş bir proje;
- yok sayılan bozuk bir temel plan başvurusu;
- düz UTF-8 dışında bir metin kodlaması (bildirimde hangisi olduğu yazar: Arapça, Kiril veya Yunanca metin için uygulama eşleşen Windows kod sayfasını seçer, aksi halde Windows-1252);
- planlanmış başlangıcı olmayan görevler (dosyadaki durum tarihinde veya proje başlangıcında başlarlar);
- tablolardaki, takvimlerdeki ve sayılardaki bulgular, bilinmeyen alan değerleri ve uygulamanın güvenli bir seçenekle değiştirdiği P6 planlama ayarları için sayaçlar.

*Daha fazla bilgi* ile Primavera dosyalarını açma hakkındaki Yardım açılır.

## Sorunlar ve uygulamanın o durumda yaptığı

**Her şey sekmeye veya ilişkiye dönüşmez.** Görevi olmayan bir proje açılmaz. Bir temel proje kendi sekmesi olarak açılmaz. İki proje arasındaki bir dış ilişki planlamanızda ilişkiye dönüşmez. Uygulama bunu mesajın altındaki satırlarda bildirir.

**Her sekme kendi başına bir projedir.** Birini kaydederseniz IFC dosyası tam orijinal `.xer` dosyasını da saklar. Bu IFC dosyasını daha sonra yeniden açarsanız uygulama Primavera'nın tarihlerini yine bilir. Bu kaynak arşiv bozuksa veya başka bir IFC programı dosyayı yeniden yazdıysa, uygulama şunu bildirir: *Bu dosyadaki XER kaynak arşivi kullanılamaz durumda ve dışarıda bırakıldı; projenin kendisi eksiksiz açıldı.* Planlama, hesaplama profili ve tüm proje verileri eksiksizdir. Eksik olanlar şunlardır: Primavera'nın sakladığı tarihler ve yapay zekâ ve uzantılar için kaynak kökeni. Arşivi geri almak için orijinal `.xer` dosyasını yeniden açın.

**IFC dosyası büyür.** IFC dosyası bütün orijinal `.xer` dosyasını taşıdığı için, arşivi olmayan bir IFC dosyasından daha büyüktür. Büyük bir `.xer` dosyasında bunu dosya boyutunda ve kaydetmenin ne kadar sürdüğünde fark edersiniz. Bir `.xer` dosyası birden çok proje açarsa, kaydettiğiniz her sekme yalnızca kendi projesini değil, bütün `.xer` dosyasını taşır.

**CSV, MS Project XML veya P6 XML'e dışa aktarmak veri kaybına yol açar.** Uygulama uyarır: *CSV biçimine dışa aktarma XER kaynak bilgilerini kaybeder.* IFC hiçbir şey kaybetmez.

**Dosyada bulunmayan boş bir cumartesi veya pazar.** Uygulama böyle bir hafta sonu gününü kendisi boş yapabilir. Gün takvimde *Takvim istisnası (hafta sonu yeniden oluşturma)* olarak adlandırılır. Kalıp [İçe ve dışa aktarma biçimleri](docs://ref-import-exportformaten) sayfasında yer alır.

**Bolluk proje bitişine kadar, bitiş tarihi olmadan.** Dosyada bitiş tarihi yoksa uygulama *Bolluğu proje bitiş tarihine kadar hesapla* seçeneğini kapatır. Bu, *N P6 planlama ayarı güvenli geri dönüş kullandı.* satırında sayılır. Ayrıntılar [İçe ve dışa aktarma biçimleri](docs://ref-import-exportformaten) sayfasında yer alır.

**Durum tarihindeki tamamlanmış görevler.** Tamamlanmış bir görev, *Kaydedilen tarihler* görünümünde durum tarihinde dar bir çubuk olarak görünebilir. Bu, dosyanızda bir hata değildir. Açıklama ve ilgili kural [İçe ve dışa aktarma biçimleri](docs://ref-import-exportformaten) sayfasında yer alır.

**Ondalık ayırıcı olarak virgül kullanan sayılar.** Uygulama ondalık ayırıcıyı güvenilir biçimde belirleyemezse dosyayı açmaz. Böylece yanlış okunmuş sayılar içeren bir planlama hiç açılmaz. Gönderenden yeni bir dışa aktarma isteyin.

**Uygulamanın okuyamadığı bir dosya.** Nedeni gösteren bir hata mesajı alırsınız. Birkaç örnek:

- *Bu, geçerli veya desteklenen bir XER dosyası değil.*
- *Bir XER tablosunda gerekli sütunlar eksik.*
- *Bu XER dosyasındaki P6 projesinde etkinlik yok.*
- *Bu XER dosyasındaki ondalık gösterim güvenilir biçimde belirlenemiyor.*

Bu durumda hiçbir şey açılmaz. Dosyayı P6'da kontrol edin veya gönderenden yeni bir dışa aktarma isteyin.

## Ayrıca bakın

- [Dosyalar ve biçimler](docs://uitleg-bestanden): neden bir `.xer` yalnızca okunur ve dışa aktarma neyi kaybettirir.
- [Kaydedilen tarihler](docs://uitleg-datums-zoals-opgeslagen): Primavera'nın kendi tarihlerinin görünümü.
- [MS Project dosyasını açma (.mpp)](docs://howto-mpp-openen): aynısı MS Project için geçerlidir.
- [Saat planlamasını açma](docs://howto-urenplanning-aanzetten): dosya saat bazlı veri içeriyorsa.
- [İçe ve dışa aktarma biçimleri](docs://ref-import-exportformaten): her biçim için neyin aktarıldığı ve neyin aktarılmadığı.
- [Hesaplama profilleri ve kurallar](docs://uitleg-rekenprofielen): neden bir P6 dosyasının kendi hesaplama profiliyle açıldığı.
