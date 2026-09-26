---
title: Novacast
shortDescription: Mesajları anında cihazlara ulaştıran ve bu cihazları tek bir yerden yönetmeyi sağlayan bir platform. Go ile yazdım, hızlı olsun diye de MQTT adlı bir mesajlaşma protokolünün üzerine kurdum.
---

## Nedir?

Novacast’in hedefi basit: Bir kez gönderilen mesaj, ona ihtiyacı olan her cihaza hızla
ulaşsın; bütün cihazlar da tek bir yerden yönetilebilsin. Platformu yoğun mesaj trafiğini
kaldıracak şekilde tasarladım. Ayrıntılar [novacast.app](https://novacast.app) adresinde.

## Nasıl ortaya çıktı?

Çalıştığım bir bilgisayar firmasında kullanılan eski yazılım ihtiyaçlara yetmiyordu.
Novacast’i 2025’te onun yerine geçsin diye geliştirdim. İlk sürüm, Python ile yazdığım bir
prototipti. 2025’in sonlarında projeyi baştan tasarlayıp Go ile yeniden yazdım. Yeni sürüm
MQTT üzerine kurulu, hızlı çalışan, bağımsız bir servis (mikroservis). Bugün kullanılan da bu
sürüm.

## Mesajlar cihazlara nasıl ulaşıyor?

Novacast, yayıncı/abone (pub/sub) modeliyle çalışıyor. Gönderen, mesajı doğrudan alıcılara
yollamıyor; bir **konuya** bırakıyor. Arada duran bir aracı (broker), kimin hangi konuyu
dinlediğini takip ediyor ve mesajı o konuyu dinleyen herkese iletiyor. Radyo gibi: Yayın bir
kez yapılıyor, o kanalı açan herkes duyuyor.

Bu yüzden yeni bir cihaz eklemek için gönderenlere dokunmak gerekmiyor; cihazın doğru konuya
abone olması yetiyor. Tek bir komut birçok cihaza birden dağılıyor. Bir grup cihaza ulaşmak
için o grubun dinlediği konuya mesaj atmak yeterli.

**MQTT** de tam bu iş için tasarlanmış bir protokol, yani bir mesajlaşma kuralları dizisi.
Herkes aracıya bir kez bağlanıp bağlantıyı açık tutuyor. Her mesaj da yalnızca küçük bir ikili
(binary) başlık taşıyor. Yani her mesaj için yeni bir bağlantı açmak ya da mesajı uzun
başlıklarla sarmak gerekmiyor. Ayrıca her mesajın yerine ulaşacağından ne kadar emin olmak
istediğinizi ayrı ayrı seçebiliyorsunuz. Seçenekler “en fazla bir kez” ile “tam olarak bir
kez” arasında. Böylece hızlı gitmesi gereken mesajlar hızlı, mutlaka ulaşması gerekenler de
güvenle gidiyor.

## Neden Go?

Böyle bir sistem, zamanının çoğunu aynı anda birçok bağlantıyı bekleyerek geçiriyor. Go’da aynı
anda çalışan küçük görevler (goroutine’ler) çok hafif; her bağlantıya ve mesajın geçtiği her
aşamaya ayrı bir görev verilebiliyor. Görevler mesajları kanallar (channel) üzerinden elden ele
veriyor. Böylece ortak veriyi korumak için kodun her yerine kilit koymak gerekmiyor. Aynı anda
birçok iş yapan kod bile adım adım ilerleyen kod gibi rahat okunuyor. Go hepsini tek bir
çalıştırılabilir dosyaya derliyor, bu yüzden kurması da kolay.

Kaynak kodu kapalı.
