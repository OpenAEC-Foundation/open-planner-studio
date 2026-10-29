# WBS şablonlarını kaydetme ve ekleme

Amaç: bir fazı, alt görevleri ve aralarındaki ilişkilerle birlikte şablon olarak kaydetmek ve bunu daha sonra aynı projede veya başka bir projede yeniden eklemek.

## Bunu ne zaman kullanırsınız

Aynı türdeki işin planlamasını yapmaya devam edersiniz: her evin bir temeli, zemin hazırlığı, donatısı, beton dökme ve kürleme işleri vardır. Bu görevleri tekrar tekrar oluşturup aralarında ilişki oluşturmak yerine, fazı bir kez **şablon** olarak kaydedersiniz. Şablon, WBS'nizin bir dalıdır: altında asılı olan her şeyle birlikte tek bir görev.

## Adımlar

### Bir dalı şablon olarak kaydetme

1. Dalı, yeniden kullanmak istediğiniz şekilde oluşturun: alt görevleri ve aralarındaki ilişkilerle birlikte bir özet görev.
2. Bu özet göreve sağ tıklayın ve *Dalı şablon olarak kaydet* öğesini seçin. Bu menü öğesi yalnızca alt görevleri olan görevlerde görünür.

Uygulama *Dal, 'Foundation' şablonu olarak kaydedildi* mesajını gösterir. Uygulama sizden bir ad istemez: şablon, dalın en üstteki görevinin adını alır.

### Bir şablonu ekleme

1. Şablonun altına gelmesini istediğiniz görevi seçin veya hiçbir şey seçmeyin.
2. *Planlama › Yapı › Şablonlar* öğesini seçin. Liste her şablonun adını ve örneğin *4 görev, 2 ilişki* bilgisini gösterir.
3. Şablona tıklayın.

Bir görev seçiliyse şablon, o görevin altına son alt görev olarak eklenir. Bunun sonucunda o görev bir özet göreve dönüşür. Birden fazla görev seçiliyse ilk tıkladığınız görev geçerlidir. Hiçbir şey seçili değilse dal, listenin en altına, en üst düzeye eklenir. Eklenen dal daha sonra seçili olur.

Eklenen tüm görevler proje başlangıcında başlar ve planlamanız güncel değildir. **Hesapla** (F5) tuşuna basın, örneğin *Ana sayfa › Zamanlama › Hesapla* üzerinden. Tarihler o zaman ilişkilere göre belirlenir. Ekleme tek adımdır ve *Geri al* ile geri alınır. Şablon kaydetme veya silme bu adımın parçası değildir.

### Bir şablonu silme

*Planlama › Yapı › Şablonlar* yolunu açın ve şablonun sağındaki küçük çöp kutusuna tıklayın (*Şablonu sil*). Uygulama onay istemez.

### Bir şablonda neler bulunur

Her görev için şablon; adı, açıklamayı, iş kategorisini, bunun bir kilometre taşı olup olmadığını ve süreyi gün cinsinden saklar. İlişkilerden yalnızca dal içindeki iki görev arasındakiler kalır, tür ve gecikmeyle birlikte. Saat cinsinden bir gecikme (`4h`) korunmaz ve 0 olur. İş günü, takvim günü veya yüzde cinsinden bir gecikme korunur.

Diğer her şey şablonun dışında kalır: tarihler, ilerleme ve gerçek tarihler, kaynak atamaları, kodlar ve özel alanlar (bkz. [Kodlar ve özel alanlar](docs://howto-codes-en-velden)), takvim, kısıtlamalar ve son tarihler, öncelik, özel bir iş kategorisi, bir kilometre taşı için tür ve *Zorunlu (sözleşmesel)* onay kutusu, ayrıca dal dışındaki görevlerle olan ilişkiler. Ekledikten sonra bunları yeniden doldurursunuz: atamalar, kodlar, takvim ve kısıtlamalar boştur ve tüm görevler proje başlangıcında başlar.

Saat cinsinden olan bir görev, gün görevi olarak geri gelir; süresi bir iş gününün kesrine çevrilir. İş günü 8 saat olduğunda 5 saatlik bir görev 0,625 güne dönüşür.

## Dikkat edilecekler ve uygulamanın yaptığı

**Şablonlar projeye ait değildir.** Uygulama şablonları proje dosyasında değil, bu cihazdaki kendi depolama alanında tutar. Dosyanızı açan bir meslektaş şablonlarınızı görmez. Tarayıcıdaki sürümde bir şablon o tarayıcıya aittir. Şablonlarınız önemliyse, bunları başka bir yerde de saklayın: bunları dosya olarak kaydettiğiniz bir projeye koyun.

**Aynı ad birden fazla kez görünebilir.** Dalı iki kez kaydederseniz, listede aynı adla iki şablon olur. Uygulama hiçbir şeyin üzerine yazmaz.

**En üstteki görevin süresi sayılmaz.** Bir özet görev, Hesapla'yı kullandığınız anda süresini alt görevlerinden alır.

**Hedef olarak kaynak atamaları olan bir görev.** Atamaları olan, henüz alt görevi olmayan bir görevi seçip altına bir şablon eklerseniz, uygulama reddeder. Görev bir özet göreve dönüşürdü ve özet görev atama taşımaz. Şablonun en üstteki görevinin kendi alt görevleri vardır; atamaların gidecek bir yeri olmaz. Uygulama bunu size bildirir ve hiçbir şeyi değiştirmez. Bu durumda başka bir görev veya hiçbir görev seçin. Şablon alan bir kilometre taşı, bir mesajla birlikte kilometre taşı işaretini kaybeder.

**Şablondaki geçersiz bir ilişki.** Şablondaki bir ilişkiye izin verilmiyorsa, örneğin bir görevin kendi fazına bağlanması, ya da ilişki zaten varsa, uygulama onu atlar ve kaç ilişkinin atlandığını size bildirir.

## Ayrıca bakın

- [Yapıyı ayarlama](docs://howto-structuur-aanpassen): eklenen dalı taşıyın veya girintileyin.
- [İlişki ekleme](docs://howto-relaties-leggen): kaydetmeden önce dalın içinde kendiniz ilişki oluşturun.
- [Kritik yol ve bolluk](docs://uitleg-kritiek-pad): Hesapla'dan sonra eklenen dala ne olur.
