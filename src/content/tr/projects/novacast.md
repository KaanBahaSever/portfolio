---
title: Novacast
shortDescription: Mesajları anında cihazlara ulaştıran ve bu cihazları tek bir yerden yönetmeye yarayan bir platform. Go ile yazdım, hızlı olsun diye de MQTT adlı bir mesajlaşma protokolünün üzerine kurdum.
---

## Nedir?

Novacast’in hedefi basit: Bir kez gönderilen mesaj, ona ihtiyacı olan her cihaza hızla ulaşsın;
bütün cihazlar da tek bir yerden yönetilebilsin. Platformu yoğun mesaj trafiğini kaldıracak
şekilde tasarladım. Ayrıntılar [novacast.app](https://novacast.app) adresinde.

## Nasıl ortaya çıktı?

Çalıştığım bir bilgisayar firmasındaki eski yazılım ihtiyaçlara yetmiyordu. Novacast’i 2025’te
onun yerine geçsin diye geliştirdim. İlk sürüm, Python ile yazdığım bir prototipti. 2025’in
sonlarında projeyi baştan tasarlayıp Go ile yeniden yazdım. Yeni sürüm, MQTT üzerine kurulu,
hızlı ve bağımsız çalışan bir servis (mikroservis). Bugün kullanılan da bu sürüm.

## Mesajlar cihazlara nasıl ulaşıyor?

Novacast, yayıncı/abone (pub/sub) modeliyle çalışıyor. Gönderen, mesajı doğrudan alıcılara
yollamıyor; bir **konuya** bırakıyor. Arada duran bir aracı (broker), hangi konuyu kimlerin
dinlediğini takip ediyor ve mesajı onlara iletiyor. Tıpkı radyo gibi: Yayın bir kez yapılıyor, o
istasyonu açan herkes duyuyor.

Bu yüzden yeni bir cihaz eklerken gönderen tarafta hiçbir şey değişmiyor; cihaz doğru konuya
abone oluyor, o kadar. Tek bir komut birçok cihaza birden gidiyor. Bir grup cihaza ulaşmak için
de o grubun dinlediği konuya mesaj atmak yeterli.

**MQTT** de tam bu iş için tasarlanmış bir protokol, yani cihazların ortak mesajlaşma dili.
Herkes aracıya bir kez bağlanıp bağlantıyı açık tutuyor. Her mesajın başında da yalnızca küçük
bir ikili (binary) başlık var. Yani her mesaj için yeni bir bağlantı açmak ya da mesajı uzun
başlıklarla sarmak gerekmiyor. Ayrıca her mesaj için, yerine ulaşacağından ne kadar emin olmak
istediğinizi seçebiliyorsunuz. Seçenekler “en fazla bir kez” ile “tam olarak bir kez” arasında
değişiyor. Böylece hızlı gitmesi gereken mesajlar hızlı, mutlaka ulaşması gerekenler de güvenle
gidiyor.

## Neden Go?

Böyle bir sistem, zamanının çoğunu birçok bağlantıyı birden bekleyerek geçiriyor. Go’da aynı
anda çalışan küçük görevler (goroutine’ler) o kadar hafif ki her bağlantı ve mesajın geçtiği her
aşama için ayrı bir görev açılabiliyor. Görevler mesajları kanallar (channel) üzerinden elden
ele veriyor. Böylece ortak veriyi korumak için kodun her yerine kilit koymak gerekmiyor. Birçok
işi birden yapan kod bile adım adım ilerleyen kod gibi rahat okunuyor. Go bu kodu tek bir
çalıştırılabilir dosyaya derliyor, bu yüzden kurması da kolay.

Kaynak kodu kapalı.
