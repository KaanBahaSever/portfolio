/**
 * The console's longer copy: the boot banner, `whoami`, about.txt, skills/*.txt and the
 * captions of secret.txt, contact.txt and the project files. Read at build time only; the page
 * passes the current language's copy to buildConsoleData() (src/lib/console/data.ts), so each
 * page ships its own language as data.
 *
 * Lines are rich-text data (src/lib/console/rich.ts), not HTML. Links use locale-free page paths
 * ('/games/'); the builder localizes them. File names and commands stay English in both languages.
 * Every fact here comes from the CV: do not add roles, dates or numbers that are not there.
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
      'I write systems software with a pure-mathematics background. I study mathematics at Istanbul University and work day to day in modern C++ and Go: system tools, telemetry and messaging platforms, algorithm-driven applications.',
    ),
    blank(),
    text(
      'Before that: full-stack software engineer at crowd.inc (2021–2024), and Vice President of the Istanbul University Rocket Club, where I wrote the flight avionics firmware (2019–2022).',
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
    indented(2, 'crowd.inc — Full-Stack Software Engineer / Systems Contributor, July 2021 – March 2024.'),
    indented(
      2,
      'Owned the software lifecycle end to end: PostgreSQL schema design, REST APIs in Python/Flask with jQuery on the client, Linux server provisioning and automated testing. Designed granular role-based access control (RBAC) with strict public and private boundaries, built scalable feed pagination and dynamic data loading, and kept it all reliable with unit and integration tests.',
    ),
    blank(),
    heading('Rockets'),
    indented(
      2,
      'Istanbul University Rocket Club — Vice President, 2019–2022. Helped design three high-power rockets, all launched successfully.',
    ),
    indented(
      2,
      'Wrote the flight avionics firmware and the parachute deployment control system on my own, using onboard sensor fusion of orientation, gyroscope and altimeter data. Designed the SD-card telemetry logging protocols, alongside the RF telemetry transmission modules, and built a desktop dashboard that parses flight data and plots the trajectory after each flight.',
    ),
    blank(),
    heading('Research'),
    indented(
      2,
      'An autonomous parachute steering algorithm: linear algebra and atmospheric descent dynamics guide the payload to a chosen landing coordinate.',
    ),
    indented(
      2,
      'A 3D numerical rocket trajectory simulation, first written in Python and now being re-architected in modern C++23 for high-frequency physics modelling.',
    ),
    blank(),
    heading('Where it started'),
    indented(
      2,
      'First programs in C# and SQL: mathematical calculation engines, a Battleship game (“Amiral Battı”) that aims with probability densities, and Tic-Tac-Toe (“XOX”) played by recursive minimax. Both games now run in the browser: ',
      link('games', '/games/'),
      '.',
    ),
    blank(),
    heading('Also'),
    indented(2, 'Google Developer Student Clubs core team, 2022–2023: led two YouTube live broadcasts.'),
    indented(2, 'YetGen “21st Century Competencies” certificate, Mehmet Zorlu Foundation, 2020.'),
    indented(2, 'Erasmus+ Youth Exchange in Arrecife, Spain, 2017–2018.'),
    blank(),
    text(dim('More: '), run('ls skills'), '  ', run('cat contact.txt'), '  ', run('projects')),
  ],
  skills: {
    languages: [
      heading('Programming languages'),
      blank(),
      pair('C++', 'C++23, day to day: system tools, NeoSMBIOS, the trajectory simulation'),
      pair('Go', 'day to day: Karecik, Novacast and parts of Asion'),
      pair('C', 'the native layer of Asion'),
      pair('Objective-C', 'Asion on macOS'),
      pair('Python', 'Flask APIs at crowd.inc; the first trajectory simulation'),
      pair('C#', 'first programs: calculation engines, Battleship, Tic-Tac-Toe'),
      pair('TypeScript, JavaScript', 'this site and its in-browser tools'),
      pair('SQL', 'PostgreSQL schemas; the early C# projects'),
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
        'linear algebra and descent dynamics for parachute steering; numerical simulation of rocket trajectories; probability densities (Battleship); game trees and minimax (Tic-Tac-Toe)',
      ),
      pair('Writing', 'Açık Matematik: open Turkish textbooks for undergraduate mathematics'),
    ],
    tools: [
      heading('Tools'),
      blank(),
      pair('Git, GitHub', 'version control; public work at ', link('github.com/KaanBahaSever', 'https://github.com/KaanBahaSever')),
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
      'early-access': common.en.badges.earlyAccess,
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
      'Sistem yazılımına saf matematik altyapısıyla yaklaşıyorum. İstanbul Üniversitesinde matematik okuyorum; günlük işimde modern C++ ve Go ile sistem araçları, telemetri ve mesajlaşma platformları ve algoritma odaklı uygulamalar geliştiriyorum.',
    ),
    blank(),
    text(
      'Daha önce crowd.inc şirketinde full-stack yazılım mühendisi olarak çalıştım (2021–2024). İstanbul Üniversitesi Roket Kulübünde başkan yardımcısıyken uçuş aviyonik yazılımını geliştirdim (2019–2022).',
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
    indented(2, 'crowd.inc — Full-Stack Software Engineer / Systems Contributor, Temmuz 2021 – Mart 2024.'),
    indented(
      2,
      'Yazılım geliştirme yaşam döngüsünün tamamını üstlendim: PostgreSQL şema tasarımı, Python/Flask ile REST API’ler ve istemci tarafında jQuery, Linux sunucu kurulumu ve otomatik testler. Herkese açık ve özel içerik arasında katı sınırlar çizen ayrıntılı bir rol tabanlı erişim denetimi (RBAC) tasarladım, ölçeklenebilir akış sayfalama ve dinamik veri yükleme geliştirdim, sistemin güvenilirliğini birim ve entegrasyon testleriyle sağladım.',
    ),
    blank(),
    heading('Roketler'),
    indented(
      2,
      'İstanbul Üniversitesi Roket Kulübü — Başkan Yardımcısı, 2019–2022. Üç yüksek güçlü roketin tasarımına katkıda bulundum; üçü de başarıyla fırlatıldı.',
    ),
    indented(
      2,
      'Uçuş aviyonik yazılımını (firmware) ve paraşüt açma kontrol sistemini tek başıma geliştirdim; sistem, yönelim, jiroskop ve altimetre verilerini birleştiren bir sensör füzyonuna dayanıyordu. RF telemetri iletim modüllerinin yanında SD kart telemetri kayıt protokollerini tasarladım; uçuş verilerini ayrıştırıp her uçuştan sonra yörünge grafiklerini çizen bir masaüstü arayüz geliştirdim.',
    ),
    blank(),
    heading('Araştırma'),
    indented(
      2,
      'Otonom paraşüt yönlendirme algoritması: lineer cebir ve atmosferik iniş dinamiği, faydalı yükü belirlenen bir iniş koordinatına yönlendiriyor.',
    ),
    indented(
      2,
      'Üç boyutlu sayısal roket yörüngesi simülasyonu: önce Python ile yazdım, şimdi yüksek frekanslı fizik modellemesi için modern C++23 ile yeniden tasarlıyorum.',
    ),
    blank(),
    heading('Başlangıç'),
    indented(
      2,
      'İlk programlarımı C# ve SQL ile yazdım: matematiksel hesaplama motorları, hedefini olasılık yoğunluklarıyla seçen bir Amiral Battı oyunu ve özyinelemeli minimax ile oynayan bir XOX. İki oyun da artık tarayıcıda çalışıyor: ',
      link('oyunlar', '/games/'),
      '.',
    ),
    blank(),
    heading('Diğer'),
    indented(2, 'Google Developer Student Clubs çekirdek ekibi, 2022–2023: iki YouTube canlı yayınını yönettim.'),
    indented(2, 'YetGen “21. Yüzyıl Yetkinlikleri” sertifikası, Mehmet Zorlu Vakfı, 2020.'),
    indented(2, 'Erasmus+ Gençlik Değişimi, Arrecife, İspanya, 2017–2018.'),
    blank(),
    text(dim('Devamı: '), run('ls skills'), '  ', run('cat contact.txt'), '  ', run('projects')),
  ],
  skills: {
    languages: [
      heading('Programlama dilleri'),
      blank(),
      pair('C++', 'C++23; günlük işim: sistem araçları, NeoSMBIOS, yörünge simülasyonu'),
      pair('Go', 'günlük işim: Karecik, Novacast ve Asion’un bazı bileşenleri'),
      pair('C', 'Asion’un native katmanı'),
      pair('Objective-C', 'Asion’un macOS tarafı'),
      pair('Python', 'crowd.inc şirketinde Flask API’leri; yörünge simülasyonunun ilk sürümü'),
      pair('C#', 'ilk programlarım: hesaplama motorları, Amiral Battı, XOX'),
      pair('TypeScript, JavaScript', 'bu site ve tarayıcıda çalışan araçları'),
      pair('SQL', 'PostgreSQL şemaları; ilk C# projelerim'),
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
        'paraşüt yönlendirmede lineer cebir ve iniş dinamiği; roket yörüngelerinin sayısal simülasyonu; olasılık yoğunlukları (Amiral Battı); oyun ağaçları ve minimax (XOX)',
      ),
      pair('Yayın', 'Açık Matematik: lisans matematiği için açık kaynaklı Türkçe ders kitapları'),
    ],
    tools: [
      heading('Araçlar'),
      blank(),
      pair('Git, GitHub', 'sürüm kontrolü; herkese açık çalışmalarım: ', link('github.com/KaanBahaSever', 'https://github.com/KaanBahaSever')),
      pair('MATLAB, Mathematica, R', 'sayısal ve sembolik hesaplama'),
      pair('Quarto', 'Açık Matematik’in yayın altyapısı'),
    ],
    spoken: [heading('Konuştuğum diller'), blank(), text('Türkçe (ana dil)'), text('İngilizce')],
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
    cvNote: '(İngilizce, PDF)',
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
      'early-access': common.tr.badges.earlyAccess,
      'in-development': common.tr.badges.inDevelopment,
    },
  },
  projects: {
    heading: 'Projeler',
    footer: [text(dim('Ayrıntılar: cat projects/<ad>.txt · projenin sayfası: open <ad>'))],
  },
};

export const consoleContent = { en, tr } as const satisfies Localized<ConsoleContent>;
