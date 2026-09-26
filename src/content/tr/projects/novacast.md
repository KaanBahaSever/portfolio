---
title: Novacast
shortDescription: Mesajları gerçek zamanlı olarak yayınlayan ve bu mesajları alan cihazları tek yerden yöneten bir platform. Go ile yazıldı ve düşük gecikmeli MQTT publish/subscribe hatları üzerine kuruldu.
---

## Nedir?

Novacast, mesajları gerçek zamanlı olarak yayınlayan ve bu mesajları alan cihazları yöneten,
yüksek hacimli bir platform. Temelinde düşük gecikmeli publish/subscribe hatları var. Hedef
şu: Bir kez gönderilen mesaj, ona ihtiyacı olan her cihaza hızla ulaşmalı. Bir cihaz filosu
da tek bir yerden yönetilebilmeli. Ayrıntılar [novacast.app](https://novacast.app) adresinde.

## Nasıl ortaya çıktı?

Çalıştığım bir bilgisayar firmasında eski bir yazılım kullanılıyordu ve bu yazılım ihtiyaçları
karşılamıyordu. Novacast’i 2025’te onun yerini alsın diye geliştirdim. İlk sürüm Python ile
yazılmış bir prototipti. 2025’in sonlarında projeyi baştan tasarladım: Go ile yazılmış, MQTT
üzerine kurulu, yüksek performanslı bir mikroservis. Bugün canlıda çalışan sürüm bu.

## Neden publish/subscribe, neden MQTT?

Publish/subscribe düzeninde gönderen, mesajı doğrudan alıcılara yollamaz. Yayıncı mesajını bir
**konuya** (topic) gönderir. Arada duran broker, hangi konuya kimin abone olduğunu takip eder ve
mesajı her birine iletir. Bu yüzden yeni bir cihaz eklerken gönderenlere dokunmak gerekmez;
yeni bir abonelik eklemek işi çözer. Mesaj yayını ve cihaz yönetimi de tam olarak bu
bağımsızlığa ihtiyaç duyar. Tek bir komut birçok alıcıya dağılır. Bir cihaz grubuna ulaşmak
için de o grubun dinlediği konuya mesaj göndermek yeter.

**MQTT**, tam da bu iş için tasarlanmış bir publish/subscribe protokolü. İstemciler broker’la
bağlantılarını uzun süre açık tutar ve her mesaj yalnızca küçük bir ikili (binary) başlık
taşır. Böylece her gönderimde ne yeni bir bağlantı açmak gerekir ne de mesajı hantal bir zarfa
sarmak. Protokol ayrıca teslim garantisini her mesaj için ayrı seçmeye izin verir. Seçenekler
“en fazla bir kez” ile “tam olarak bir kez” arasında değişir. Bu sayede hız gereken mesajlar hızlı,
güvence gereken mesajlar güvenli gider.

## Neden Go?

Broker merkezli bir sistem, zamanının çoğunu aynı anda birçok bağlantıyı bekleyerek geçirir.
Go’da goroutine’ler o kadar ucuz ki her bağlantıya ve hattın her aşamasına ayrı bir akış
verilebilir. Channel’lar da mesajları bir aşamadan ötekine aktarır. Bunun için kodun dört bir
yanına kilit koymak gerekmez. Eşzamanlı kod bile sıralı kod gibi rahat okunur. Go bu kodu,
dağıtması kolay, tek bir çalıştırılabilir dosyaya derler.

Kaynak kodu kapalı.
