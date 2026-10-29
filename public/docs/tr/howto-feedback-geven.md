# Geri bildirim vermek

Amaç: doğrudan uygulamadan bir hatayı bildirmek veya bir fikri iletmek. İsterseniz bir ekran görüntüsü ekleyin.

## Bunu ne zaman kullanırsınız

Planlama, anlamadığınız bir şey hesaplar. Bir düğme olması gerektiği gibi çalışmaz. Ya da uygulamada bir şeyin eksik olduğunu düşünürsünüz. İyi bir bildirim, geliştiricilerin sorunu bulmasına yardımcı olur. Bu yüzden uygulama, bildiriminize sürümü, işletim sistemini ve dili kendisi ekler. Ne yaptığınızı, ne beklediğinizi ve ne olduğunu siz anlatırsınız. Bu bilgi, geliştiricilerin bununla bir şey yapıp yapamayacağını belirler.

## Adımlar

1. Pencerenin üstündeki *Geri bildirim ver* düğmesine tıklayın. Bu düğme her zaman başlık çubuğunda bulunur. Metin her on dakikada bir değişir: *Geri bildirim ver*, *Hata bildir* veya *Yeni bir özellik ekle*. Bu her zaman aynı düğmedir. *Geri bildirim gönder* penceresi açılır.
2. Rapor türünü seçin. *Bir şey çalışmıyor* bir hata içindir: bir şey olması gerektiği gibi çalışmaz. *Fikir* ise eksik bulduğunuz veya farklı olmasını istediğiniz şey içindir. *Soru veya yorum* kalan her şey içindir. *Bir şey çalışmıyor* varsayılan olarak seçilidir.
3. *Başlık* alanını, ardından *Açıklama* alanını doldurun. Boş alanlarda bir örnek görünür: başlık için *Örn. Kaydettikten sonra kritik yol kayıyor* gibi bir örnek, açıklama için ise *Ne yaptınız, ne bekliyordunuz ve ne oldu?* sorusu. *Gönderin* düğmesi gri olduğu sürece, yanındaki gri bir satır nedenini gösterir: örneğin *Bir başlık girin.* ya da başlık ve açıklamada birlikte en az 10 karakter yazmanız gerektiğini.
4. Yanıt almak istiyorsanız *E-posta adresi* alanını doldurun. Bu alan isteğe bağlıdır. Uygulama adresi, başarılı bir rapordan sonra hatırlar. Bu yüzden bir dahaki sefere adres zaten dolu olur.
5. Bir şey göstermek istiyorsanız *Ekran görüntüsü ekle* seçeneğini açın. Uygulama, bu pencere olmadan uygulamanın bir resmini çeker. Kısa bir süre sonra, yanında üç düğme bulunan küçük bir önizleme görürsünüz: *Not ekle*, *Yeniden al* ve *Kaldır*.
6. *Not ekle* bir düzenleyici açar. Burada resmin üstüne oklar, dikdörtgenler, serbest çizgiler ve metin koyarsınız. *Kapla* ile, bir ad veya bir tutar gibi gönderilmemesi gereken bir şeyin üstüne siyah bir alan çizersiniz. Bu bölüm, uygulamanın gönderdiği resimden gerçekten kaldırılır. Rengi siz seçersiniz. Son işleminizi *Geri al* ile geri alırsınız veya *Tümünü temizle* ile baştan başlarsınız. Değişikliklerinizi tutmak için *Bitti* düğmesine, vazgeçmek için *İptal* (veya Esc) düğmesine tıklayın.
7. *Yeniden al* yeni bir ekran görüntüsü çeker ve notlarınızı temizler. *Kaldır* ekran görüntüsünü kaldırır ve onay kutusunu kapatır.
8. Formun altındaki gri satıra, *Birlikte gönderildi*, bakın. Uygulamanın kendiliğinden gönderdiklerini gösterir: sürümü, işletim sistemini ve dili. Örneğin *Birlikte gönderildi: v2026.10.1 · Windows · English*.
9. *Gönderin* düğmesine tıklayın. Gönderilirken düğme *Gönderiliyor…* yazar.
10. *Teşekkürler, geri bildiriminiz gönderildi.* görürsünüz. Raporunuz için GitHub'da bir issue oluşturulduysa, ayrıca *GitHub’da görüntüleyin* düğmesi görünür. *Kapat* düğmesine tıklayın.

## Raporunuz nereye gider

Uygulama raporunuzu OpenAEC'nin Open Feedback Studio'suna gönderir. Bunun için bir hesap gerekmez, GitHub için de gerekmez. Geliştiriciler raporunuzu kendi genel görünümlerinde görür. Uygulama oradaki GitHub'a bağlıysa, Open Feedback Studio raporu GitHub'da herkese açık bir issue'ya da dönüştürür. *Bir şey çalışmıyor* ile issue *bug* etiketini, *Fikir* ile *enhancement* etiketini alır. Açıklamanızın altında, Open Planner Studio sürümünü, işletim sisteminizi ve uygulamanın dilini gösteren bir satır bulunur.

## Sorunlar ve uygulamanın o durumda ne yaptığı

**Raporunuz herkese açık olabilir.** Paylaşmak istemediğiniz hiçbir şey yazmayın. Bu, ekran görüntüsü için de geçerlidir: resim, o anda uygulamada görünen her şeyi gösterir, örneğin projenizin görev adlarını ve kaynaklarını. Uygulama ekran görüntüsünü, *Ekran görüntüsü ekle* seçeneğini açtığınız anda çeker. Ekran henüz doğru değilse pencereyi kapatın, ekranı düzeltin, pencereyi yeniden açın ve *Yeniden al* düğmesine tıklayın. Göstermek istemediklerinizi gizlemek için *Kapla* kullanın.

**Ekran görüntüsü çok büyük.** Uygulama, göndermeden önce ekran görüntüsünü küçültür. Bundan sonra hâlâ çok büyükse, raporunuz resimsiz gider. Teşekkür ekranında o zaman *Ekran görüntüsü çok büyüktü ve gönderilmedi.* yazar.

**Gönderme çalışmıyor.** Pencerede bir mesaj görünür ve metniniz kalır. Dört durum vardır:

- *Rapor kabul edilmedi*. Metni ve e-posta adresini kontrol edin. Ağırlıklı olarak bağlantılardan oluşan bir rapor reddedilir.
- *Kısa sürede çok rapor gönderdiniz*. Bir saat sonra yeniden deneyin.
- *Gönderme başarısız oldu*. Bağlantı yok veya sunucu yanıt vermiyor. Yeniden deneyin ya da *GitHub’da açın* düğmesine tıklayın. Bu düğme, önceki bir deneme belirsizse yoktur (aşağıya bakın).
- *Geri bildiriminizin ulaşıp ulaşmadığını bilmiyoruz. Bir dakika bekleyip yeniden gönderin; zaten varsa bunu otomatik olarak göreceğiz*. Uygulama raporunuzu gönderdikten sonra bağlantı kesildi. Metniniz kalır. *GitHub’da açın* düğmesi yoktur, çünkü raporunuz hâlâ ulaşabilir. Bu durum, raporunuz gönderilene veya zaten alınana kadar böyledir; pencereyi arada kapatıp yeniden açsanız bile.

**Raporunuz zaten alındı.** Zaten ulaşmış bir raporu gönderirseniz, form üstünde şunu gösterir: *Bu geri bildirim bize zaten ulaşmış. Bir şey eklemek ister misiniz? O zaman metni değiştirin ve yeniden gönderin*. Metniniz ve e-posta adresiniz hatırlanır. Eklemek istemiyorsanız *Kapat* düğmesine tıklayın; bir dahaki sefere form boş olur. Daha fazla bir şey yazarsanız mesaj kaybolur ve yeniden gönderebilirsiniz. Düğme yeniden *Kaydet ve kapat* adını alır ve metniniz korunur.

**GitHub’da açın.** Bu, Open Feedback Studio olmadan izlenen yoldur. Bunun için bir GitHub hesabına ihtiyacınız vardır. Ekran görüntüsü olmadan, yeni bir issue oluşturduğunuz GitHub sayfası, başlık ve açıklaması zaten doldurulmuş olarak hemen tarayıcınızda açılır. Ekran görüntüsüyle önce *Neredeyse bitti — ekran görüntünüz panoya kopyalandı.* ve dört adım görürsünüz. *Tamam, GitHub'a git* düğmesine tıklayın, issue sayfasındaki büyük metin alanına tıklayın ve Ctrl+V (Mac’te Cmd+V) tuşlarına basın. Sonra sayfanın altındaki *Submit new issue* düğmesine tıklayın. Ancak o zaman raporunuz gönderilir.

**Yapıştırma çalışmıyor.** GitHub yolunda ekran görüntüsü ayrıca bilgisayarınızda bir dosya olarak kaydedilir. Masaüstü uygulamasında pencere, yolu şöyle belirtir: *Yapıştıramıyor musunuz? Ekran görüntüsünü ayrıca şu konuma kaydettik:* bu yol *— dosyayı metin alanına sürükleyin.* Tarayıcıda uygulama resmi, `feedback-` ön ekli, bir numara ve `.png` uzantısı taşıyan bir dosya olarak indirir. Bunu indirilenler klasörünüzde bulursunuz ve metin alanına sürüklersiniz.

**Ekran görüntüsü alınamadı.** Uygulama şunu gösterir: *Ekran görüntüsü alınamadı. Ekran görüntüsü olmadan da geri bildirim gönderebilirsiniz*. Onay kutusu kapanır ve raporunuzu resimsiz gönderebilirsiniz.

**Göndermeden önce pencereyi kapatırsınız.** Formda bir şey varsa alttaki düğme *Kaydet ve kapat* adını taşır; form boşsa *Kapat*. *Kaydet ve kapat*, çarpı ve Esc pencereyi kapatır. Raporunuz, siz gönderene veya *Temizle* düğmesine tıklayana kadar taslak olarak saklanır. Pencereyi yeniden açtığınızda rapor türü, metniniz, e-posta adresiniz ve notlarıyla birlikte ekran görüntüsü hâlâ oradadır. Taslak, uygulama açık olduğu sürece saklanır; uygulamadan çıktıktan sonra kaybolur. Başarılı bir rapordan sonra form yeniden boş olur. Baştan başlamak isterseniz sol altta *Temizle* düğmesine tıklayın. Pencerenin yanına tıklamak onu kapatmaz. Gönderirken Esc pencereyi kapatmaz.

## Ayrıca bakınız

- [Uygulamayı güncelleme](docs://howto-app-bijwerken): bildirmeden önce en son sürümü kullanıp kullanmadığınızı kontrol edin.
