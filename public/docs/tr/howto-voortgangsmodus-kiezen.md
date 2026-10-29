# İlerleme modunu seçme

Amaç: Uygulamanın, öncülü hâlâ çalışırken zaten başlamış bir görevin kalan işini nasıl planlayacağına karar vermek. Bu, ilişkiye göre (Retained Logic) ya da gerçekte ne olduğuna göre (Progress Override) olabilir.

## Ne zaman gerekir

Sahada iş çoğu zaman mantıktan önde gider. Boyacı, sıvacı hâlâ başka yerde meşgulken sıvanmış odalarda şimdiden başlar. Planlamada bu, örneğin ardılın öncülü bitmeden başladığı bir bitiş-başlangıç ilişkisidir. Uygulama buna **sıra dışı ilerleme** adını verir. Durum çubuğunda *N sıra dışı ilerleme* yazıyorsa böyle bir durum vardır. İlerleme modu, uygulamanın ardılın kalan işini nasıl planlayacağına karar verir. İki modun ne yaptığı, çözümlü bir örnekle birlikte, [İlerleme, durum tarihi ve temel plan](docs://uitleg-voortgang) bölümündedir.

## Adımlar

1. İlerlemeyi güncelleyin ve durum tarihini ayarlayın, [İlerlemeyi güncelleme](docs://howto-voortgang-bijwerken) bölümünde açıklandığı gibi.
2. *Planlama › Temel plan ve ilerleme › İlerleme modu* bölümüne gidin ve listeyi açın.
3. *Retained Logic* veya *Progress Override* seçin.
4. Örneğin *Planlama › Zamanlama › Hesapla* yolunu kullanarak **Hesapla** (F5) tuşuna basın. Bu seçim planlamayı güncel olmaktan çıkarır: durum çubuğu *Güncel değil — yeniden hesaplayın (F5)* yazar. *Otomatik hesapla* açıksa uygulama bunu kendisi yapar.

Nasıl seçersiniz?

- **Retained Logic** varsayılandır. İlişki geçerli kalır: ardılın kalan işi, ancak öncül bittikten sonra başlar. Sıra gerçekten sabitse ya da temkinli planlamak istiyorsanız bunu seçin.
- **Progress Override** gerçeğe öncelik verir. Ardılın kalan işi, öncülü beklemeden durum tarihinde başlar. Ardıl gerçekten çalışmayı sürdürüyorsa ve bitiş tarihi hâlâ çalışan bir öncüle bağlı olmamalıysa bunu seçin.

## Sonucu denetleme

- Durum çubuğundaki *N sıra dışı ilerleme* iletisine tıklayın. *Uyarılar* paneli açılır. Bu panele *Planlama › Zamanlama › Uyarılar* yolundan da ulaşabilirsiniz. Her ilişki panelde şu metinle yer alır: *Sıra dışı: ardılın ilerlemesi ilişkiyle çelişiyor*, örneğin *4.2 Plastering → 4.5 Painting (FS)*.
- Ardılın çubuğuna bakın. Retained Logic altında çubuk, öncülün bitişinden sonraya kadar sürer. Progress Override altında ise daha erken biter. Açıklamanın örneğinde bu, Retained Logic’te salı 27 Temmuz, Progress Override’da perşembe 22 Temmuz’dur.

## Tuzaklar ve uygulamanın yaptıkları

**Fark yok.** Mod yalnızca öncülü henüz bitmemiş olan ve zaten başlamış görevlerde etki eder. Böyle bir görev yoksa hiçbir şey değişmez.

**İletisi kalır.** Progress Override sıra dışı ilerleme iletisini çözmez. Mod, uygulamanın nasıl hesapladığına karar verir; ilişki ile ilerleme arasındaki çelişki kalır. İlişki artık doğru değilse, onu değiştirin ([İlişki ekleme](docs://howto-relaties-leggen)).

**Bu projeye aittir.** Seçim proje dosyasıyla birlikte kaydedilir, tüm proje için geçerlidir ve Ctrl+Z ile geri alınabilir. Yeni bir proje Retained Logic modundadır.

**Bir P6 dosyası.** Bir Primavera P6 dosyası (.xer) açarsanız uygulama modu dosyadan alır. P6’da Retained Logic ve Progress Override’ın yanında Actual Dates da vardır. Uygulama bu üçüncü modu tanımaz; böyle bir dosya Retained Logic olarak hesaplanır. İçe aktarma iletisi bunu *1 P6 planlama ayarı güvenli geri dönüş kullandı.* olarak sayar.

**Hesaplama profili.** Primavera P6 profilinde Progress Override ayrıca geriye doğru çalışır: öncülün geç tarihlerinde ve serbest bolluğunda (kural *Progress Override başlamış bir ardılı geriye doğru da yok sayar*). Open Planner Studio ve Microsoft Project profillerinde durum böyle değildir. Kuralları *Ayarlar › Proje › Proje ayarları* altında, *Hesaplama profili ve seçenekleri* bloğunda bulursunuz. Açıklamanın örneğinde bu geriye doğru etki görülemez.

## Ayrıca bakın

- [İlerleme, durum tarihi ve temel plan](docs://uitleg-voortgang): iki modun farkı, sayılarla.
- [İlerlemeyi güncelleme](docs://howto-voortgang-bijwerken): modun üzerinde çalıştığı ilerlemeyi girmek.
- [İlişki ekleme](docs://howto-relaties-leggen): artık doğru olmayan bir ilişkiyi değiştirmek.
