/**
 * The console's longer copy: the boot banner, `whoami`, about.txt, skills/*.txt and the
 * captions of secret.txt, contact.txt and the project files. Read at build time only; the page
 * passes the current language's copy to buildConsoleData() (src/lib/console/data.ts), so each
 * page ships its own language as data.
 *
 * Lines are rich-text data (src/lib/console/rich.ts), not HTML. Links use locale-free page paths
 * ('/games/'); the builder localizes them. File names and commands stay English in both languages.
 * Every fact here comes from the CV: do not add roles, dates or numbers that are not there.
 * The owner is a software developer: nothing here calls him an engineer ("mühendis"); other
 * people keep their own titles (tests/console-data.test.ts enforces it).
 */
import type { Localized } from '../config.ts';
import { common } from '../messages/common.ts';
import { projectsMessages } from '../messages/projects.ts';
import type { ConsoleCopy } from '../../lib/console/data.ts';
import { blank, dim, heading, indented, link, pair, run, text } from '../../lib/console/rich.ts';

const en = {
  user: 'guest',
  banner: [
    heading('kbs-os 1.0 (tty1)'),
    text('Kaan Baha Sever — software developer. Mathematics, systems, C++ and Go.'),
    blank(),
    text("Type 'help' to begin, or try: ", run('whoami'), '  ', run('projects'), '  ', run('ls')),
  ],
  whoami: [
    heading('Kaan Baha Sever'),
    text(dim('Software Developer | Math-Driven Solutions & Algorithms · Istanbul')),
    blank(),
    text(
      'I write systems software with a pure-mathematics background. I study mathematics at Istanbul University and work day to day in modern C++ and Go: system tools, telemetry and messaging platforms, algorithm-driven applications. Around the code I build one-click pipelines that test it, package it and deploy multi-platform builds.',
    ),
    blank(),
    text(
      'Before that: software developer at crowd.inc (2021–2024), and Vice President of the Istanbul University Rocket Club (2019–2022), where our team built three rockets and I wrote the flight avionics firmware.',
    ),
    blank(),
    text(dim('Next: '), run('cat about.txt'), '  ', run('projects'), '  ', run('ls skills')),
  ],
  about: [
    heading('Kaan Baha Sever'),
    text(dim('Software Developer | Math-Driven Solutions & Algorithms')),
    text(dim('Istanbul, Turkey · born 2000')),
    blank(),
    heading('Mathematics'),
    indented(
      2,
      'BSc Mathematics, Faculty of Science, Istanbul University, since November 2019. Preparing to graduate, with a Master’s in Computer Science planned next.',
    ),
    indented(
      2,
      'A pure-maths grounding in real analysis, abstract algebra and topology: state the assumptions, then prove what follows from them.',
    ),
    blank(),
    heading('Work'),
    indented(2, 'crowd.inc — Software Developer, July 2021 – March 2024.'),
    indented(
      2,
      'Owned the software lifecycle end to end: PostgreSQL schema design, REST APIs in Python/Flask with jQuery on the client, Linux server provisioning and automated testing. Designed granular role-based access control (RBAC) with strict public and private boundaries, built scalable feed pagination and dynamic data loading, and kept it all reliable with unit and integration tests.',
    ),
    indented(
      2,
      'Today, next to the code: GitHub Actions pipelines with cross-compilation runners that test, package, produce multi-platform artifacts and deploy in one click, notably for the Asion ecosystem. More: ',
      run('cat ~/skills/devops.txt'),
    ),
    blank(),
    heading('Rockets'),
    indented(
      2,
      'Istanbul University Rocket Club — Vice President, 2019–2022. Our team designed and built three rockets: one low-altitude (5,000 ft) and two high-altitude (10,000 ft).',
    ),
    indented(
      2,
      'Wrote the flight avionics firmware and the parachute deployment control system on my own, using onboard sensor fusion of orientation, gyroscope and altimeter data. Designed the SD-card telemetry logging protocols, alongside the RF telemetry transmission modules, and built a desktop dashboard that parses flight data and plots the trajectory after each flight.',
    ),
    blank(),
    heading('Research'),
    indented(
      2,
      'An autonomous parachute steering algorithm: linear algebra and atmospheric descent dynamics guide the payload to a chosen landing coordinate. Source: ',
      link('github.com/KaanBahaSever/AutonomousParachute', 'https://github.com/KaanBahaSever/AutonomousParachute'),
    ),
    indented(
      2,
      'Rocket flight simulation, one project that keeps evolving: a narrow, purpose-built Python prototype from 2020, now being rewritten from scratch as Rocket-Up, an open-source aerodynamic simulation engine in modern C++ with a cleaner architecture and higher performance: ',
      link('rocket-up', '/projects/rocket-up/'),
      '.',
    ),
    blank(),
    heading('Where it started'),
    indented(
      2,
      'Space came first: before any code, a long-standing interest in space exploration, spacecraft architectures, lunar mission analysis and theoretical mission planning.',
    ),
    indented(
      2,
      '2016: programming fundamentals in C# at a vocational high school, then data structures and algorithmic problem-solving. 2019: database applications backed by MS SQL, and a TÜBİTAK high school research project on cryptography and visual programming logic, with an early prototype of a flowchart-based visual coding tool.',
    ),
    indented(
      2,
      'My high school graduation projects were desktop Tic-Tac-Toe (“XOX”) and Battleship (“Amiral Battı”); the Battleship opponent’s Hunt & Target algorithm came later. Both games now run in the browser: ',
      link('games', '/games/'),
      '.',
    ),
    blank(),
    heading('Also'),
    indented(
      2,
      'Google Developer Student Clubs core team, 2023: hosted workshops and live streams on Flask, HTML and Git/GitHub, and organised Cyber Security Week, including a live-streamed technical interview with a CCIE-certified network security engineer.',
    ),
    indented(
      2,
      'Mathematics Club, in my upper years: organised and facilitated academic events, seminars and logic and mathematics competitions.',
    ),
    indented(2, 'YetGen “21st Century Competencies” certificate, Mehmet Zorlu Foundation, 2020.'),
    indented(2, 'Erasmus+ Youth Exchange in Arrecife, Spain, 2017–2018.'),
    blank(),
    text(dim('More: '), run('ls skills'), '  ', run('cat contact.txt'), '  ', run('projects')),
  ],
  skills: {
    languages: [
      heading('Programming languages'),
      blank(),
      pair('C++', 'modern C++, day to day: system tools, NeoSMBIOS (C++23), i18n-cpp, the Rocket-Up simulation engine'),
      pair('Go', 'day to day: Karecik, Novacast and parts of Asion'),
      pair('C', 'the native layer of Asion'),
      pair('Objective-C', 'Asion on macOS'),
      pair('Python', 'Flask APIs at crowd.inc; the 2020 flight-simulation prototype; parachute guidance research; build scripts'),
      pair('C#', 'where it started, in 2016: data structures, algorithms, desktop Tic-Tac-Toe and Battleship'),
      pair('TypeScript, JavaScript', 'this site and its in-browser tools'),
      pair('SQL', 'PostgreSQL schemas; database applications on MS SQL (2019)'),
      pair('Bash, Batch', 'build, packaging and release scripts'),
    ],
    systems: [
      heading('Systems and protocols'),
      blank(),
      pair('gRPC, Protobuf', 'how Asion’s agent, runner, UI and native host talk to each other'),
      pair('MQTT', 'Novacast’s low-latency pub/sub pipelines'),
      pair('OS event hooks', 'activity tracking in Asion on macOS, Linux and Windows, behind a lightweight daemon'),
      pair('Linux servers', 'provisioning and automated testing at crowd.inc'),
      pair('Telemetry', 'rocket avionics: RF transmission, SD-card logging, a desktop dashboard for the data'),
    ],
    devops: [
      heading('DevOps and automation'),
      blank(),
      pair('GitHub Actions', 'multi-platform CI/CD workflows'),
      pair('Cross-compilation', 'runners that build for several platforms from one pipeline'),
      pair('Scripting', 'Bash, Batch and Python for building, packaging and releasing'),
      pair('One click', 'test, package, produce multi-platform artifacts and deploy, notably for the Asion ecosystem'),
    ],
    data: [
      heading('Databases'),
      blank(),
      pair('PostgreSQL', 'relational schema design at crowd.inc; Karecik'),
      pair('SQLite, SQLCipher', 'Asion’s local encrypted store'),
      pair('MySQL, MS SQL'),
    ],
    web: [
      heading('Web'),
      blank(),
      pair('Flask', 'REST APIs at crowd.inc'),
      pair('jQuery', 'dynamic data loading at crowd.inc'),
      pair('TypeScript', 'this site: static pages and tools that run entirely in the browser'),
      pair('Cloudflare', 'where Karecik runs'),
    ],
    math: [
      heading('Mathematics'),
      blank(),
      pair('Pure', 'real analysis, abstract algebra, topology'),
      pair(
        'Applied',
        'linear algebra and descent dynamics for parachute steering; aerodynamic simulation of rocket flight; probability densities and Hunt & Target search (Battleship); game trees and minimax (Tic-Tac-Toe)',
      ),
      pair('Writing', 'Açık Matematik: open Turkish textbooks for undergraduate mathematics'),
    ],
    tools: [
      heading('Tools'),
      blank(),
      pair('Git, GitHub', 'version control; public work at ', link('github.com/KaanBahaSever', 'https://github.com/KaanBahaSever')),
      pair('GitHub Actions', 'CI/CD; see ', run('cat ~/skills/devops.txt')),
      pair('MATLAB, Mathematica, R', 'numerical and symbolic computation'),
      pair('Quarto', 'publishing Açık Matematik'),
    ],
    spoken: [heading('Spoken languages'), blank(), text('Turkish (native)'), text('English')],
  },
  secret: {
    artLabel:
      'ASCII drawing of the unit circle in the complex plane: e to the i pi sits at −1, half a turn from 1. Below it, Euler’s identity: e to the i pi, plus 1, equals 0.',
    caption: [
      text(
        'Euler’s identity. Half a turn around the unit circle takes 1 to −1, so e^(iπ) + 1 = 0: five constants, e, i, π, 1 and 0, in one line.',
      ),
    ],
    gamesIntro: 'If you would rather play your mathematics than read it:',
  },
  contact: {
    heading: 'Contact',
    email: 'email',
    location: 'location',
    cv: 'cv',
    /** After the CV's path in contact.txt: the page's language (the CV linked is in it) and the format. */
    cvNote: '(English, PDF)',
  },
  project: {
    stack: 'stack',
    status: 'status',
    since: 'since',
    page: 'page',
    site: 'site',
    source: 'source',
    openSource: common.en.badges.openSource,
    private: common.en.badges.private,
    // The same stage names as the project cards and pages, so a status reads alike everywhere.
    stages: {
      production: projectsMessages.en.stage.production,
      'early-access': `${common.en.badges.inDevelopment} · ${common.en.badges.earlyAccess}`,
      'in-development': common.en.badges.inDevelopment,
    },
  },
  projects: {
    heading: 'Projects',
    footer: [
      text(dim('Details: cat projects/<name>.txt · a project’s page: open <name>')),
    ],
  },
} satisfies ConsoleCopy;

export type ConsoleContent = typeof en;

const tr: ConsoleContent = {
  user: 'misafir',
  banner: [
    heading('kbs-os 1.0 (tty1)'),
    text('Kaan Baha Sever — yazılım geliştirici. Matematik, sistem yazılımı, C++ ve Go.'),
    blank(),
    text("Başlamak için 'help' yazın ya da şunları deneyin: ", run('whoami'), '  ', run('projects'), '  ', run('ls')),
  ],
  whoami: [
    heading('Kaan Baha Sever'),
    text(dim('Yazılım Geliştirici | Matematik Odaklı Çözümler ve Algoritmalar · İstanbul')),
    blank(),
    text(
      'Sistem yazılımına saf matematik altyapısıyla yaklaşıyorum. İstanbul Üniversitesinde matematik okuyorum; günlük işimde modern C++ ve Go ile sistem araçları, telemetri ve mesajlaşma platformları ve algoritma odaklı uygulamalar geliştiriyorum. Bunun yanında kodu tek tıkla test eden, paketleyen ve çok platformlu derlemeleri dağıtan pipeline’lar kuruyorum.',
    ),
    blank(),
    text(
      'Daha önce crowd.inc şirketinde yazılım geliştirici olarak çalıştım (2021–2024). İstanbul Üniversitesi Roket Kulübünde başkan yardımcısıyken (2019–2022) ekibimiz üç roket tasarlayıp üretti; uçuş aviyonik yazılımını ben geliştirdim.',
    ),
    blank(),
    text(dim('Sırada: '), run('cat about.txt'), '  ', run('projects'), '  ', run('ls skills')),
  ],
  about: [
    heading('Kaan Baha Sever'),
    text(dim('Yazılım Geliştirici | Matematik Odaklı Çözümler ve Algoritmalar')),
    text(dim('İstanbul, Türkiye · 2000 doğumlu')),
    blank(),
    heading('Matematik'),
    indented(
      2,
      'İstanbul Üniversitesi Fen Fakültesi, Matematik lisans programı; Kasım 2019’da başladım. Mezuniyete hazırlanıyorum; ardından bilgisayar bilimlerinde yüksek lisans yapmayı planlıyorum.',
    ),
    indented(
      2,
      'Reel analiz, soyut cebir ve topoloji üzerine kurulu bir saf matematik altyapısı: önce varsayımları açıkça yazmak, sonra onlardan ne çıktığını kanıtlamak.',
    ),
    blank(),
    heading('İş deneyimi'),
    indented(2, 'crowd.inc — Yazılım Geliştirici, Temmuz 2021 – Mart 2024.'),
    indented(
      2,
      'Yazılım geliştirme yaşam döngüsünün tamamını üstlendim: PostgreSQL şema tasarımı, Python/Flask ile REST API’ler ve istemci tarafında jQuery, Linux sunucu kurulumu ve otomatik testler. Herkese açık ve özel içerik arasında katı sınırlar çizen ayrıntılı bir rol tabanlı erişim denetimi (RBAC) tasarladım, ölçeklenebilir akış sayfalama ve dinamik veri yükleme geliştirdim, sistemin güvenilirliğini birim ve entegrasyon testleriyle sağladım.',
    ),
    indented(
      2,
      'Bugün ayrıca, özellikle Asion ekosistemi için, GitHub Actions ile çapraz derleme runner’larıyla çalışan; tek tıkla test eden, paketleyen, çok platformlu artifact’ler üreten ve dağıtım yapan pipeline’lar kuruyorum. Devamı: ',
      run('cat ~/skills/devops.txt'),
    ),
    blank(),
    heading('Roketler'),
    indented(
      2,
      'İstanbul Üniversitesi Roket Kulübü — Başkan Yardımcısı, 2019–2022. Ekibimizle üç roket tasarlayıp ürettik: bir alçak irtifa (5.000 ft) ve iki yüksek irtifa (10.000 ft) roketi.',
    ),
    indented(
      2,
      'Uçuş aviyonik yazılımını (firmware) ve paraşüt açma kontrol sistemini tek başıma geliştirdim; sistem, yönelim, jiroskop ve altimetre verilerini birleştiren bir sensör füzyonuna dayanıyordu. RF telemetri iletim modüllerinin yanında SD kart telemetri kayıt protokollerini tasarladım; uçuş verilerini ayrıştırıp her uçuştan sonra yörünge grafiklerini çizen bir masaüstü arayüz geliştirdim.',
    ),
    blank(),
    heading('Araştırma'),
    indented(
      2,
      'Otonom paraşüt yönlendirme algoritması: lineer cebir ve atmosferik iniş dinamiği, faydalı yükü belirlenen bir iniş koordinatına yönlendiriyor. Kaynak kodu: ',
      link('github.com/KaanBahaSever/AutonomousParachute', 'https://github.com/KaanBahaSever/AutonomousParachute'),
    ),
    indented(
      2,
      'Roket uçuş simülasyonu, gelişmeye devam eden tek bir proje: 2020’de belirli bir amaç için yazdığım dar kapsamlı bir Python prototipi. Şimdi onu Rocket-Up adıyla, daha temiz bir mimariye ve daha yüksek performansa sahip, modern C++ ile açık kaynaklı bir aerodinamik simülasyon motoru olarak baştan yazıyorum: ',
      link('rocket-up', '/projects/rocket-up/'),
      '.',
    ),
    blank(),
    heading('Başlangıç'),
    indented(
      2,
      'Önce uzay vardı: daha kod yazmadan önce de uzay keşfine, uzay aracı mimarilerine, Ay görevlerinin analizine ve kuramsal görev planlamasına uzun süredir ilgi duyuyordum.',
    ),
    indented(
      2,
      '2016: meslek lisesinde C# ile programlamanın temelleri, ardından veri yapıları ve algoritmik problem çözme. 2019: MS SQL tabanlı veritabanı uygulamaları ve kriptografi ile görsel programlama mantığı üzerine bir TÜBİTAK lise araştırma projesi; projede akış şemasıyla kod yazmayı sağlayan görsel bir aracın erken bir prototipi de vardı.',
    ),
    indented(
      2,
      'Lise bitirme projelerim masaüstü XOX ve Amiral Battı oyunlarıydı; Amiral Battı rakibinin av ve hedef (hunt & target) algoritmasını sonradan geliştirdim. İki oyun da artık tarayıcıda çalışıyor: ',
      link('oyunlar', '/games/'),
      '.',
    ),
    blank(),
    heading('Diğer'),
    indented(
      2,
      'Google Developer Student Clubs çekirdek ekibi, 2023: Flask, HTML ve Git/GitHub üzerine atölyeler ve canlı yayınlar düzenledim; CCIE sertifikalı bir ağ güvenliği mühendisiyle canlı yayında teknik bir söyleşinin de yer aldığı Siber Güvenlik Haftası etkinliğini organize ettim.',
    ),
    indented(
      2,
      'Matematik Kulübü, son sınıflarımda: seminerler, mantık ve matematik yarışmaları gibi akademik etkinlikler düzenleyip yürüttüm.',
    ),
    indented(2, 'YetGen “21. Yüzyıl Yetkinlikleri” sertifikası, Mehmet Zorlu Vakfı, 2020.'),
    indented(2, 'Erasmus+ Gençlik Değişimi, Arrecife, İspanya, 2017–2018.'),
    blank(),
    text(dim('Devamı: '), run('ls skills'), '  ', run('cat contact.txt'), '  ', run('projects')),
  ],
  skills: {
    languages: [
      heading('Programlama dilleri'),
      blank(),
      pair('C++', 'modern C++, günlük işim: sistem araçları, NeoSMBIOS (C++23), i18n-cpp, Rocket-Up simülasyon motoru'),
      pair('Go', 'günlük işim: Karecik, Novacast ve Asion’un bazı bileşenleri'),
      pair('C', 'Asion’un native katmanı'),
      pair('Objective-C', 'Asion’un macOS tarafı'),
      pair('Python', 'crowd.inc şirketinde Flask API’leri; 2020’deki uçuş simülasyonu prototipi; paraşüt güdümü araştırması; derleme betikleri'),
      pair('C#', 'her şeyin başladığı dil, 2016: veri yapıları, algoritmalar, masaüstü XOX ve Amiral Battı'),
      pair('TypeScript, JavaScript', 'bu site ve tarayıcıda çalışan araçları'),
      pair('SQL', 'PostgreSQL şemaları; MS SQL tabanlı veritabanı uygulamaları (2019)'),
      pair('Bash, Batch', 'derleme, paketleme ve sürüm betikleri'),
    ],
    systems: [
      heading('Sistemler ve protokoller'),
      blank(),
      pair('gRPC, Protobuf', 'Asion’un agent, runner, arayüz ve native host bileşenleri birbiriyle böyle konuşur'),
      pair('MQTT', 'Novacast’ın düşük gecikmeli pub/sub hatları'),
      pair('OS event hooks', 'Asion’da macOS, Linux ve Windows üzerinde etkinlik takibi, hafif bir daemon ile'),
      pair('Linux sunucular', 'crowd.inc şirketinde sunucu kurulumu ve otomatik testler'),
      pair('Telemetri', 'roket aviyoniği: RF iletimi, SD kart kaydı ve veriler için masaüstü arayüz'),
    ],
    devops: [
      heading('DevOps ve otomasyon'),
      blank(),
      pair('GitHub Actions', 'çok platformlu CI/CD iş akışları'),
      pair('Çapraz derleme', 'tek bir pipeline’dan birden çok platform için derleyen runner’lar'),
      pair('Betikler', 'derleme, paketleme ve sürüm için Bash, Batch ve Python'),
      pair('Tek tık', 'test, paketleme, çok platformlu artifact üretimi ve dağıtım; özellikle Asion ekosistemi için'),
    ],
    data: [
      heading('Veritabanları'),
      blank(),
      pair('PostgreSQL', 'crowd.inc şirketinde ilişkisel şema tasarımı; Karecik'),
      pair('SQLite, SQLCipher', 'Asion’un yerel ve şifreli veri deposu'),
      pair('MySQL, MS SQL'),
    ],
    web: [
      heading('Web'),
      blank(),
      pair('Flask', 'crowd.inc şirketinde REST API’ler'),
      pair('jQuery', 'crowd.inc şirketinde dinamik veri yükleme'),
      pair('TypeScript', 'bu site: statik sayfalar ve tamamen tarayıcıda çalışan araçlar'),
      pair('Cloudflare', 'Karecik’in çalıştığı altyapı'),
    ],
    math: [
      heading('Matematik'),
      blank(),
      pair('Saf', 'reel analiz, soyut cebir, topoloji'),
      pair(
        'Uygulamalı',
        'paraşüt yönlendirmede lineer cebir ve iniş dinamiği; roket uçuşunun aerodinamik simülasyonu; olasılık yoğunlukları ile av ve hedef araması (Amiral Battı); oyun ağaçları ve minimax (XOX)',
      ),
      pair('Yayın', 'Açık Matematik: lisans matematiği için açık kaynaklı Türkçe ders kitapları'),
    ],
    tools: [
      heading('Araçlar'),
      blank(),
      pair('Git, GitHub', 'sürüm kontrolü; herkese açık çalışmalarım: ', link('github.com/KaanBahaSever', 'https://github.com/KaanBahaSever')),
      pair('GitHub Actions', 'CI/CD; ayrıntılar: ', run('cat ~/skills/devops.txt')),
      pair('MATLAB, Mathematica, R', 'sayısal ve sembolik hesaplama'),
      pair('Quarto', 'Açık Matematik’in yayın altyapısı'),
    ],
    spoken: [heading('Konuştuğum diller'), blank(), text('Türkçe (ana dili)'), text('İngilizce')],
  },
  secret: {
    artLabel:
      'Karmaşık düzlemde birim çemberin ASCII çizimi: e üzeri i pi, 1’den yarım tur ötede, −1 noktasında. Altında Euler özdeşliği: e üzeri i pi artı 1 eşittir 0.',
    caption: [
      text(
        'Euler özdeşliği. Birim çember üzerinde yarım tur, 1’i −1’e götürür; bu yüzden e^(iπ) + 1 = 0. Beş temel sabit (e, i, π, 1 ve 0) tek bir satırda buluşuyor.',
      ),
    ],
    gamesIntro: 'Matematiği okumak yerine oynamak isterseniz:',
  },
  contact: {
    heading: 'İletişim',
    email: 'e-posta',
    location: 'konum',
    cv: 'özgeçmiş',
    cvNote: '(Türkçe, PDF)',
  },
  project: {
    stack: 'teknolojiler',
    status: 'durum',
    since: 'başlangıç',
    page: 'sayfa',
    site: 'site',
    source: 'kaynak kodu',
    openSource: common.tr.badges.openSource,
    private: common.tr.badges.private,
    stages: {
      production: projectsMessages.tr.stage.production,
      'early-access': `${common.tr.badges.inDevelopment} · ${common.tr.badges.earlyAccess}`,
      'in-development': common.tr.badges.inDevelopment,
    },
  },
  projects: {
    heading: 'Projeler',
    footer: [text(dim('Ayrıntılar: cat projects/<ad>.txt · projenin sayfası: open <ad>'))],
  },
};

export const consoleContent = { en, tr } as const satisfies Localized<ConsoleContent>;
