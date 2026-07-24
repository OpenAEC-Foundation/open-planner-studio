# Nivelleme seçenekleri

**Kaynakları dengele** penceresi, görevleri kaydırarak aşırı atamayı çözer. İki adımda çalışır: **Hesapla** bir öneri oluşturur (henüz hiçbir şey değişmez), **Uygula** onu gerçekleştirir.

## Açma

**Kaynaklar** → **Nivelleme** şerit grubu → **Dengele…**. **Esc**, kapatma çarpısı veya pencerenin dışına bir tıklama, uygulamadan kapatır.

## Seçenekler

- **Yalnızca bolluk içinde dengele (yumuşatma) — proje bitiş tarihi sabit kalır** — işaretlendiğinde, nivelleme görevleri yalnızca toplam bolluğu içinde kaydırır: bitiş tarihi hareket edemez, ama o zaman her çakışma çözülemez. İşaretsizken (varsayılan), proje bitiş tarihi tüm çakışmaları çözmek için uzayabilir.
- **Kaynaklar** — kaynak başına bir onay kutusu: hangi kaynakların katıldığı. Malzeme kaynakları burada yoktur (malzeme nivellenmez). Varsayılan olarak tüm kaynaklar açıktır.

## Hesapla

Güncel bir hesaplama gerektirir; aksi takdirde pencere "Nivellemeden önce planı hesaplayın (F5)" gösterir. Düğme ayrıca hiçbir kaynak işaretli değilken devre dışıdır. Herhangi bir seçenek değişikliği önceki bir öneriyi geçersiz kılar — tekrar hesaplayın.

## Öneri (önizleme)

- **Proje bitiş tarihi satırı** — "değişmedi (tarih)" veya proje uzarsa "eski tarih → yeni tarih" (kırmızı).
- **Tablo** — kaydırılan görev başına: **Görev**, **Eski başlangıç**, **Yeni başlangıç** ve **Kaydırılan gün**. Mantık aracılığıyla birlikte kayan kaynaksız ardıllar da dahildir.
- Yapılacak bir şey yoksa, pencere "Hiçbir görevin taşınması gerekmiyor — plan zaten çakışmasız." bildirir.

## Kalan çakışmalar

Kurallara sığmayan görevler, görev başına çakışma günü sayısı ve bir nedenle:

- "… zirvede … birim/gün istiyor, kapasite … — kaydırarak çözülemez." — bir atama zirvede kaynak kapasitesinden daha fazlasını talep ediyor; birim/gün'ü düşürün veya Maks. birim'i artırın.
- "Kaynak bu görevin ihtiyaç duyduğu tüm günlerde çalışmıyor — kaydırma bunu çözmez." — görev ve kaynak arasında takvim uyuşmazlığı.
- "Bu çakışmayı çözmek için bolluk içinde yeterli boş kapasite yok." — çoğunlukla yumuşatmayla: mevcut bolluk içinde boş bir pencere yok.

## Uygula ve geri al

**Uygula** öneriyi gerçekleştirir ve pencereyi kapatır; **İptal** değişiklik yapmadan kapatır. Uygulanmış bir nivellemeyi **Dengelemeyi temizle** (aynı şerit grubu) veya Ctrl+Z ile geri alın.

## Daha fazla okuma

- [Kaynaklar, histogram & nivelleme](docs://gids-resources-histogram) — histogramda aşırı atamayı tespit etme ve tam nivelleme iş akışı.
