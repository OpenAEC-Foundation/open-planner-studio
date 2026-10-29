# Uzantı izinleri

Bir uzantının manifestinde listeleyebileceği her izin: neye izin verdiği, izin eksik olduğunda ne olduğu ve bir uzantıyı kurduğunuzda onu nasıl gördüğünüz. Uzantıları nasıl kurup yönettiğiniz [Bir uzantıyı kurma ve yönetme](docs://howto-extensie-installeren) sayfasında açıklanır.

## İzin nedir, ne değildir

Bir izin **yazarın beyanıdır**: uzantının uygulama arayüzünün hangi bölümlerini kullanmak istediğini gösterir. Bu bir engel değildir. Bir uzantının kodu, uygulamanın kendisiyle aynı ortamda çalışır. Bu yüzden izinlerinin söylediğinden fazlasını yapabilir: bir izole ortam (sandbox) yoktur. Uygulama bunu kurulum penceresinde de söyler. Uzantıları yalnızca güvendiğiniz yazarlardan kurun.

Uygulama bir izni üç yoldan biriyle uygular. Bu farklar önemlidir:

**Sıkı uygulanır.** İzin eksikse ilgili yöntem, hiçbir şey olmadan önce bir hata verir (Hollandaca, örneğin *Extensie “…” mist permissie: ribbon*).

**Uyarı.** İzin eksikse yöntem yine çalışır, ancak uygulama günlüğe bir uyarı yazar. Gelecek bir sürümde bu bir ret olur.

**Yalnızca bilgi.** İzin, arayüzün hiçbir bölümüne bağlı değildir. Uygulama bunu kurulum sırasında gösterir ve başka bir şey yapmaz.

İzin gerektirmeyen şeyler, uzantı arayüzünün temelidir: projeyi, takvimi, görevleri, ilişkileri, kaynakları ve atamaları okumak; görev ve ilişki eklemek ve görevleri değiştirmek; bir projeyi yüklemek, yeniden hesaplamak ve birkaç değişikliği bir araya getirmek; kendi ayarlarını saklamak, uzantıyla birlikte gelen kendi dosyalarını okumak ve bir bildirim göstermek.

**Manifest.** İzinler manifestte bir liste olarak yazılır. Şimdi kurduğunuz ve bu uygulama sürümünün tanımadığı bir izin içeren bir uzantı reddedilir. Daha önce kaydedilmiş eski bir uzantı için uygulama tanımadığı izinleri çıkarır ve bunu günlüğe yazar.

## Uygulama nasıl sorar

Kurarken, kataloğdan (*Dosya › Uzantılar › Gözat › Yükle*) veya bir dosyadan (*ZIP* veya *JS*) uygulama *Uzantı kurulsun mu?* penceresini gösterir. Soru bir kez gelir, kurulum sırasında: uzantıyı her açtığınızda değil.

Pencere adı, sürümü, açıklamayı, yazarı ve varsa deposu gösterir. Altında *Kaynak* uzantının nereden geldiğini gösterir (*Çevrimiçi uzantı kataloğundan*, *Bu bilgisayardaki bir ZIP dosyasından* veya *Bu bilgisayardaki bir JavaScript dosyasından*) ve indirmenin doğrulanıp doğrulanmadığını: katalogdaki sağlama toplamıyla, katalog sağlama toplamı vermediği için doğrulanmamış ya da kendiniz seçtiğiniz bir dosya. Altında *Neye evet diyorsunuz* uzantının bir program kodu olduğunu ve uygulamayla aynı haklarla çalıştığını yazar. Ayrıca bunun pratikte ne anlama geldiğini yazar. Masaüstü uygulamada bu, diğer şeylerin yanında, kullanıcı klasörünüzün her yerindeki dosyaları okuyup yazmak ve projelerinize, ayarlarınıza ve panonuza erişmek demektir. Tarayıcıda ise kayıtlı projelerinize ve ayarlarınıza, erişim verdiğiniz dosyalara ve ağa erişim demektir.

Altında *Bu uzantının kullandığını belirttikleri* manifestteki izinler yer alır: kısa etiketler olarak, aşağıdaki adlarıyla. Ayrıca şunu söyler: *Bu, yazarın beyanıdır, bir kısıtlama değil — kod yine de fazlasını yapabilir.* Uzantının izni yoksa *Hiçbir şey belirtilmemiş.* yazar. İki izin bir açıklama alır: *importSource* ve *help*. Diğer altı izin yalnızca etiketini alır.

*Kur* ile kabul edersiniz. *Kurma*, Esc veya pencerenin dışına tıklamak kurulumu reddeder.

## İzinler

**ribbon** — şeritte bir düğme yerleştirmek. Etki: uzantı, bir şerit sekmesindeki bir gruba düğme ekleyebilir. Bu izni olmayan bir uzantı, bunu denediğinde bir hata alır. Düğmeler, seçilen şerit sekmesinin sonunda, uzantıya ait bir grup etiketinin altında görünür; uzantıyı kapattığınızda veya kaldırdığınızda kaybolurlar. Varsayılan: verilmez; yalnızca manifestte yazılanlar. Uygulama: sıkı. Nerede: uzantının seçtiği sekmede.

**events** — uygulamanın olaylarını izlemek ve kendi olaylarını göndermek. Etki: uzantı olaylara abone olabilir, aboneliğinden çıkabilir ve kendi olaylarını gönderebilir. Uygulamanın kendisi dört olay gönderir: bir proje yüklendiğinde (içe aktarma, açma veya bir uzantı tarafından yükleme sonrasında), boş bir proje oluşturulduğunda, planlama (yeniden) hesaplandığında ve kullanıcı bir eğitim istediğinde. Bu son olay yalnızca eğitim uzantısına gider. Varsayılan: verilmez; yalnızca manifestte yazılanlar. Uygulama: sıkı. Nerede: hiçbir yerde; uzantı olaya tepki verir.

**backstage** — bir içe aktarma biçimi sunmak. Etki: uzantı bir içe aktarıcı kaydedebilir. Bu, *Dosya › İçe aktar* altında görünür: orada bir biçime tıklar ve bir dosya seçersiniz. Yerleşik biçimler bundan ayrıdır (bkz. [İçe ve dışa aktarma biçimleri](docs://ref-import-exportformaten)). Varsayılan: verilmez; yalnızca manifestte yazılanlar. Uygulama: uyarı. İzin eksikse kaydetme yine çalışır; günlükte bir uyarı çıkar. Bu geçici bir düzenlemedir, çünkü mevcut uzantılar izni her zaman listelemez. Nerede: *Dosya › İçe aktar*.

**pdf-fonts** — PDF-dışa aktarma için bir yazı tipi sağlamak. Etki: uzantı bir yazı tipi sağlayıcısı kaydedebilir. PDF-dışa aktarma onu, yerleşik yazı tiplerinin kapsamadığı karakterler için kullanır, örneğin Çince, Japonca ve Korece karakterler. Varsayılan: verilmez; yalnızca manifestte yazılanlar. Uygulama: sıkı. Nerede: bir raporun PDF'inde; kurulum penceresinde yalnızca etiket vardır.

**importSource** — içe aktarılan bir dosyanın özgün baytlarını okumak. Etki: uzantı, içe aktarılan bir projenin kaynak dosyasının eksiksiz içeriğini isteyebilir (şu an için: bir Primavera dosyası). Buna, uygulamanın bilerek projenize almadığı alanlar da girer, örneğin denetim ve köken alanları, maliyetler, inceleme ve konum alanları. Bu, arayüzün geri kalanından çok daha geniştir; bu yüzden ayrı bir izindir. İzin olmadan uygulama kaynak dosyanın tek bir baytını bile okumaz: her yöntem, hiçbir şey alınmadan önce bir hata verir. Varsayılan: verilmez; yalnızca manifestte yazılanlar. Uygulama: sıkı, varsayılan olarak reddedilir. Nerede: kurulum penceresinde bu izinle birlikte şu açıklama gösterilir: *importSource — içe aktarılan her dosyanın eksiksiz özgün kaynak baytları (örneğin ham bir Primavera dosyası), projeye hiç ulaşmayan alanlar dahil.*

**help** — Yardım makaleleri ve rehberler eklemek. Etki: uzantı Yardım makalelerini (eğitimler) kaydedebilir ve geri çekebilir, birlikte gelen bir `.ifc` dosyasını yeni bir belge olarak açabilir ve uygulamanın bölümlerini gösteren bir rehberi başlatıp durdurabilir. Birlikte gelen bir proje, üzerinde çalıştığınız belgenin üzerine asla yazmaz: yeni bir belge olarak açılır veya yalnızca boş ve değiştirilmemiş bir sekmeyi devralır. Sözleşme sürümü 1.4.0'dan beri. Varsayılan: verilmez; yalnızca manifestte yazılanlar. Uygulama: sıkı. Nerede: *Yardım* penceresinde (makaleler), yeni bir sekme olarak (proje) ve düğmelere işaret eden bir rehber olarak. Kurulum penceresinde bu izinle birlikte şu açıklama gösterilir: *help — Yardım makaleleri ekleyebilir, birlikte gelen projeleri yeni belge olarak açabilir ve uygulamanın bölümlerini gösteren bir rehber görüntüleyebilir.*

**filesystem** — uzantı dosya kullandığını belirtir. Etki: yok; arayüzün hiçbir bölümü buna bağlı değildir ve uygulama bunu uygulayamaz. Varsayılan: verilmez; yalnızca manifestte yazılanlar. Uygulama: yalnızca bilgi. Nerede: kurulum penceresinde bir etiket olarak.

**network** — uzantı ağı kullandığını belirtir. Etki: yok; *filesystem* gibi. Varsayılan: verilmez; yalnızca manifestte yazılanlar. Uygulama: yalnızca bilgi. Nerede: kurulum penceresinde bir etiket olarak.

## Ayrıca bakın

- [İçe ve dışa aktarma biçimleri](docs://ref-import-exportformaten): uygulamanın kendi tanıdığı biçimler, *Dosya › İçe aktar* altında uzantıların eklediklerinin yanında.
- [Bir uzantıyı kurma ve yönetme](docs://howto-extensie-installeren): bir uzantıyı kurmak, devre dışı bırakmak ve kaldırmak.
