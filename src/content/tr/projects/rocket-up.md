---
title: Rocket-Up — Yüksek Güçlü Roket Simülasyonu
shortDescription: 2020’de dar kapsamlı bir Python prototipi olarak başlayan, şimdi modern C++ ile açık kaynak bir aerodinamik simülasyon motoru olarak baştan yazılan yüksek güçlü roket uçuş simülasyonu.
---

## Nedir?

Rocket-Up, yüksek güçlü roketler için geliştirdiğim uçuş simülasyonu. İki ayrı proje değil,
zaman içinde biçim değiştiren tek bir proje: 2020'de bir Python prototipi olarak başladı; şimdi
onu dinamik ve modern bir C++ aerodinamik simülasyon motoru olarak baştan yazıyorum. Yeni
simülasyon motoru açık kaynak ve MIT Lisansı ile yayımlanıyor.

## Prototipten simülasyon motoruna

2020'deki prototip dar kapsamlı ve tek bir amaca yönelikti: genel bir araç olarak değil, belirli
bir iş için yazılmıştı.

Yeniden yazımda yaklaşım bunun tam tersi: tek ve sabit bir model yerine simülasyon parçalardan
kuruluyor. Roket bileşenlerden oluşuyor, bir gezegenin ortamında uçuyor; uçuşun kendisi de koda
gömülmek yerine parametrelerle tanımlanıyor. C++, fizik döngüsünün ihtiyaç duyduğu performansı
sağlıyor; temiz bir mimari de fiziğin her parçasını kendi yerinde tutuyor. Böylece her parça,
geri kalanına dokunmadan sınanabiliyor, geliştirilebiliyor ya da değiştirilebiliyor.

## Depoda neler var?

Yeniden yazım henüz erken aşamada. Açık depoda şimdiden şunlar var:

- **Modüler roket bileşenleri**: roket, motoru ve paraşüt gibi kurtarma donanımı için ayrı
  sınıflar.
- **Motor modeli**: özgül itki, yakıt kütlesi, ayarlanabilir bir itki eğrisi, kısma
  (throttling) ve atmosfer basıncına göre düzeltilmiş itki.
- **Ortamlar ve gezegenler**: Dünya modeli, 1976 ABD Standart Atmosferi'nin katmanlarını
  kullanarak irtifaya göre sıcaklığı ve basıncı hesaplar; gezegen sınıfları da
  genişletilebilecek şekilde tasarlandı.
- **Ayarlanabilir uçuş parametreleri**, ayrıca küçük vektör ve matris hesaplama yardımcıları.

Proje CMake ile derleniyor.

## Yol haritası

- Daha fazla roket bileşeni: kanatçıklar, gövde tüpleri ve burun konileri.
- Daha isabetli simülasyonlar için fizik kütüphaneleriyle entegrasyon.
- Birden çok gezegen ortamı.
- GPU hızlandırma da dahil olmak üzere daha iyi performans.

## Arka plan

Bu simülasyon, roketçilik çalışmalarımla aynı yolun parçası. 2019–2022 yılları arasında
İstanbul Üniversitesi Roket Kulübünün başkan yardımcısıydım; ekibimizle üç roket tasarlayıp
ürettik: bir alçak irtifa roketi (5.000 ft) ve iki yüksek irtifa roketi (10.000 ft). Bu
roketlerin uçuş aviyoniği yazılımını (firmware) ve paraşüt açma kontrol sistemini tek başıma
yazdım. Aviyonikten bu simülasyona uzanan hikâyeyi [Hakkımda sayfasında](/about/#journey)
anlatıyorum.
