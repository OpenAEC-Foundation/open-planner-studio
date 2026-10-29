# Hesaplama profili seçme veya oluşturma

Amaç: bir projenin hangi hesaplama kurallarını kullanacağına karar vermek. Yerleşik bir profili seçersiniz ya da kendi kurallarınızla özel bir profil oluşturursunuz.

## Ne zaman gerekir

Primavera P6 veya Microsoft Project olarak hesaplanması gereken bir projeyi açarsınız ya da profilin yaptığından farklı olarak bir kuralı ayarlamak istersiniz. Bir profilin ne olduğu ve tarihlerin neden kayabileceği [Hesaplama profilleri ve kuralları](docs://uitleg-rekenprofielen) sayfasında açıklanır.

## Adımlar

### Yeni bir proje için profil seçme

1. *Ana sayfa › Dosya › Yeni* öğesini seçin. *Yeni proje* penceresi açılır.
2. *Hesaplama profili* açılır listesinde profili seçin: *Open Planner Studio*, *Primavera P6* veya *Microsoft Project*.
3. Projeyi oluşturun. Uygulama, daha önce doldurduğunuz hesaplama seçeneklerini profilin varsayılan değerleriyle değiştirir.

### Mevcut bir projenin profilini değiştirme

1. *Ayarlar › Proje › Proje ayarları* öğesini seçin. *Dosya › Proje ayarları* öğesini de seçebilirsiniz.
2. *Hesaplama profili ve seçenekleri* bölümünde, *Hesaplama profili* açılır listesini açın ve başka bir profil seçin.
3. **Uygula** düğmesine tıklayın. *Otomatik hesapla* kapalı olsa bile uygulama planlamayı hemen yeniden hesaplar. Görevler taşınırsa uygulama kaç görevin taşındığını gösterir.

*Uygula* düğmesine tıklamadan önce değişiklik yalnızca formda bulunur. Tüm geçiş *Geri al* ile tek adımda geri alınabilir. Geçiş yalnızca kuralları değiştirir; hesaplama seçenekleriniz olduğu gibi kalır.

### Özel bir profil oluşturma

1. *Hesaplama profili ve seçenekleri* bölümünde, açılır listenin yanındaki *Yeni profil* düğmesine tıklayın.
2. Bir ad girin. Uygulama, seçilen profilin önüne *Kopyası:* ekleyerek bir ad önerir; örneğin *Kopyası: Open Planner Studio*.
3. *Oluştur* düğmesine tıklayın. *Bu profilin kuralları* bölümü genişler.
4. Kuralları onay kutularıyla açın veya kapatın. Bir satırın sonundaki i simgesi, o kuralın açıklamasını gösterir. Temel profilden farklı bir kural *temele dön* etiketini alır.
5. **Uygula** düğmesine tıklayın. Ancak o zaman proje yeni profille hesaplanır.

Üç yerleşik profil değiştirilemez. Bu profillerin kuralları yalnızca bilgi için gösterilir.

### Özel profili şablon olarak saklama

1. Gerekirse *Bu özel profilin adı* alanında özel profile başka bir ad verin.
2. *Şablon olarak kaydet* düğmesine tıklayın. Uygulama, şablonun kaydedildiğini veya bunun neden başarısız olduğunu bildirir.
3. Uygulamadaki başka bir projede şablon, *Hesaplama profili* açılır listesinde yer alır.

Profil daha sonra şablondan farklı olursa sarı bir bölüm bunu belirtir. Bu durumda *Şablonu bu projeden güncelle* veya *Şablondan güncelle* öğesini seçin.

Bir şablonu *Şablonu sil* ile silersiniz. Uygulama önce onay ister.

## Sonucu kontrol etme

- *Hesaplama profili ve seçenekleri* bölümünde seçilen profil görünür.
- *Uygula* düğmesinden sonra uygulama taşınan görevleri bildirir; örneğin *Uygulamadan sonra 4 görev kaydı.*
- Hesaplama seçeneklerinin üstündeki turuncu bir bölüm, hesaplama seçeneklerinizin profilin varsayılanından farklı olduğunu belirtir. Bu çoğu zaman bilerek yapılır. Yine de varsayılanı istiyorsanız *… varsayılan ayarlarını kullan* düğmesine tıklayın.

## Sorunlar ve uygulamanın ne yaptığı

**Tarihler kayar.** Başka bir profil gerçek tarihleri değiştirebilir. Sonucu kontrol edin. Beğenmezseniz *Geri al* seçeneğini seçin: profil ve tarihler birlikte geri döner.

**Geri al sonrasında sarı bir bölüm.** *Proje ayarları* açıkken *Geri al* veya *Yinele* düğmesine basarsanız bölüm projenin durumunu izler. Bölümde kendiniz bir şey değiştirdiyseniz seçiminiz kalır. Bu durumda sarı bir bölüm, *Uygula* düğmesinin bu seçimi geri koyacağını belirtir.

**En fazla 100 şablon olabilir.** Zaten 100 şablon varsa uygulama şablonu kaydetmez ve bunu bildirir. Önce bir şablonu silin. Uygulamanın depolama alanı dolu veya kullanılamıyorsa da bir ileti gösterilir.

**Şablonlar uygulamaya, profil projeye aittir.** Proje her zaman profilin kendi kopyasını taşır. Şablonu daha sonra değiştirirseniz proje onunla birlikte değişmez.

**Kaynak dosyadaki ayarlar.** Başka bir dosyadan gelen bir proje için *Primavera P6* veya *Microsoft Project* seçerseniz kaynak dosyadaki ayarlar kalır. Bu ayarları burada değiştiremezsiniz.

## Ayrıca bakın

- [Hesaplama profilleri ve kuralları](docs://uitleg-rekenprofielen): profilin ne olduğu ve tarihleri nasıl etkilediği.
- [Hesaplama seçenekleri ve kuralları](docs://ref-rekenopties-en-conventies): tüm kurallar ve hesaplama seçenekleri bir bakışta.
- [İlerleme modunu seçme](docs://howto-voortgangsmodus-kiezen): Retained Logic veya Progress Override, profilden ayrı.
