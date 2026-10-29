# Bir projeyi taşımak

Amaç: tüm planlamayı yeni bir başlangıç tarihine kaydırmak ve bunun bitişi nasıl etkilediğini önceden görmek.

## Ne zaman gerekir

İşin başlangıcı değişir: izin daha geç gelir ya da önceki bir evin planlamasını bir sonraki ev için yeniden kullanırsınız. Her görevi tek tek taşımak çok zaman alır. **Projeyi taşı** ile tek bir yeni başlangıç tarihi girersiniz ve uygulama her şeyi birlikte kaydırır.

Proje bitişi her zaman başlangıçla aynı miktarda kaymaz. **Takvim** birlikte kaymaz: tatiller, inşaat tatili ve kış durdurması sabit tarihlerde kalır. Bir örnek: *Ana sayfa › Dosya › Yeni* ile bir proje oluşturun, *Başlangıç tarihi* alanına 29-09-2026 yazın, *Ülke* alanında *Hollanda* seçin ve *İnşaat tatili* alanında *Yok* seçin. Projeye 30 iş günlük bir planlama koyun. Bu planlama 9 Kasım 2026'da biter. Projeyi 14 Aralık 2026'ya, 76 takvim günü sonraya taşırsanız, proje 26 Ocak 2027'de biter. Bu, 78 gün sonra demektir, çünkü 25 Aralık ve 1 Ocak artık planlamanızda tatil günleridir. Süre 30 iş günü olarak kalır. Penceredeki önizleme bunu, bir şeyi değiştirmeden önce gösterir.

## Adımlar

1. *Planlama › Zamanlama › Projeyi taşı…* seçin. Proje başlangıcı olmadığı sürece düğme devre dışıdır.
2. *Mevcut proje başlangıcı* altında projenin şu anda nerede başladığını görün ve *Yeni proje başlangıcı* altında yeni tarihi seçin.
3. Projenin temel planları varsa *Referans planları da kaydır* kutusu görünür. Kaymayı sapma olarak görmeye devam etmek istiyorsanız kutuyu kapalı bırakın (bkz. tuzaklar).
4. *Önizlemeyi hesapla* düğmesine tıklayın. Uygulama kaydırılmış planlamayı tamamen hesaplar, projenizde hiçbir şeyi değiştirmeden.
5. Önizlemeye bakın (aşağıda). Her şey doğruysa *Taşı* düğmesine tıklayın.

Önizlemede şunları görürsünüz:

- takvim günü cinsinden kaydırma (*Kaydırma: 76 takvim günü ileri*);
- *Proje başlangıcı* ve *Proje bitişi*, öncesinden sonrasına;
- takvim sorun çıkarırsa kırmızı bir uyarı ya da proje süresinin aynı kaldığını gösteren bir mesaj;
- kaydırılan görev sayısı ve birlikte kaydırılan diğer öğeler;
- okumanız gereken uyarılar (bkz. tuzaklar).

Uygulama yeni planlamayı hemen hesaplar ve görünümü tüm projeye sığdırır. Bu nedenle **Hesapla** (F5) kullanmanız gerekmez. Tüm işlem *Geri al* (Ctrl+Z) için tek bir adımdır.

*Taşı* düğmesi yalnızca hatasız bir önizlemeden sonra ve yeni tarih mevcut tarihten farklıysa çalışır. Tarihi veya kutuyu değiştirirseniz önizleme kaybolur ve yeniden hesaplarsınız.

### Birlikte kaydırılanlar ve kaydırılmayanlar

Kaydırılanlar: her görevin başlangıcı ve bitişi, gerçek başlangıç ve gerçek bitiş, kısıtlamaların tarihleri (ayrıca sert bir Mandatory sabitlemesi de, bkz. [Kısıtlamalar ve son tarihler](docs://uitleg-constraints)), son tarihler, durum tarihi, dış ilişkilerin çapaları ve kaynakların kullanılabilirlik adımları. Proje başlangıcı ve, doldurduysanız, proje bitişi de kaydırılır.

Kaydırılmayanlar:

- takvimler, dolayısıyla tatiller, inşaat tatili ve kış durdurması;
- temel planlar, *Referans planları da kaydır* seçeneğini açmadığınız sürece;
- *Tarih* türünde, doldurulmuş bir özel alan.

## Tuzaklar ve uygulamanın yaptıkları

**Bitiş, başlangıçtan farklı sayıda gün kayar.** Önizleme, bitişin başlangıçtan daha fazla veya daha az takvim günü kaydığını ya da iş günü cinsinden proje süresinin değiştiğini görürse, sayılarla birlikte kırmızı bir uyarı gösterir. Bundan sonra yine de iptal edebilirsiniz.

**Temel planlar yerinde kalır.** Bir temel plan sapmayı ölçmek için vardır. Kutu kapalıyken projeyi taşırsanız, kaymayı temel plandan sapma olarak görürsünüz. Kutuyu açarsanız temel planlar planlamayla birlikte kayar. Yalnızca tarihleri kayar; temel planın kaydedildiği tarih değişmez.

**Devam eden bir proje.** Gerçek tarihler birlikte kayar. Projede zaten ilerleme girdiyseniz, bu her zaman istediğiniz şey değildir. Uygulama uyarır: *Devam eden bir proje için bunun doğru olup olmadığını kontrol edin.*

**Dış ilişkiler.** Kendi projenizdeki çapa birlikte kayar, diğer proje kaymaz. Taşıdıktan sonra dış ilişkileri yenileyin: *Ana sayfa › Görevler › Bağlantı ▾ › Tüm dış ilişkileri yenile*. Bkz. [Başka bir projeye dış ilişkiler](docs://howto-externe-relaties).

**Yeterince ileriye uzanmayan tatiller.** Oluşturulan tatilleri olan bir takvim birkaç yılı kapsar. Taşınan planlama bunun ötesine uzanırsa, uygulama o yılı tatil olmadan hesaplar. Önizleme bunu uyarır, örneğin: *“Bouwkalender NL” takviminin oluşturulan tatilleri 2025–2029 aralığını kapsıyor; kaydırılan plan 2030 yılına kadar sürüyor. Tatilleri yeniden oluşturun.* Önce projeyi taşıyın. Sonra *Planlama › Takvim › Takvim* bölümünü açın: tatillerin yanında artık *Yeniden oluştur* yazar. *Uygula* ile onaylayın, uygulama yeniden hesaplar. Yeni tatillerin aralığı proje tarihlerini izler; bu yüzden taşımadan önce yeniden oluşturmak işe yaramaz.

**Tarih geçmişte.** Bu izinlidir, ama önizleme bunu belirtir: *Yeni başlangıç tarihi geçmişte.*

**Proje ayarlarında proje başlangıcını değiştirmek başka bir şeydir.** *Ayarlar › Proje › Proje ayarları* bölümünde başlangıç tarihini değiştirip *Uygula* seçerseniz planlama taşınmaz. Yalnızca öncülü veya kısıtlaması olmayan ve yeni başlangıçtan önce kalacak görevler o tarihe kayar. Uygulama kaç görevin kaydığını size söyler. Her şeyi kaydırmak istiyorsanız *Projeyi taşı…* kullanın.

## Ayrıca bakın

- [Kritik yol ve bolluk](docs://uitleg-kritiek-pad): planlamanın nasıl hesaplandığı ve bitişin neden kaydığı.
- [İlişki oluşturmak](docs://howto-relaties-leggen): ilişkiler taşıdığınızda basitçe yerinde kalır.
- [Yeni proje ve Proje ayarları](docs://ref-projectinfo): Proje ayarlarındaki başlangıç tarihinin ne yaptığı.
