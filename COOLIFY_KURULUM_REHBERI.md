# VakaLab · Coolify Dağıtım ve Kurulum Rehberi

Bu rehber, **VakaLab** projesini Docker kullanarak **Coolify** üzerinde MySQL ile birlikte en kolay ve otomatik şekilde nasıl yayına alacağınızı adım adım anlatır.

---

## 📌 Genel Mantık (Arka Planda Ne Oluyor?)

Sizin elle phpMyAdmin'den SQL yüklemenize veya terminalden komut çalıştırmanıza gerek kalmaması için sistem tam otomatik hale getirildi:
1. Coolify'a ortam değişkenleri (`DB_HOST`, `DB_PASSWORD` vb.) girilir.
2. Konteyner ayağa kalktığında `entrypoint.sh` devreye girer.
3. Otomatik olarak `config/local.php` ayar dosyasını üretir.
4. Coolify'daki MySQL'e bağlanır, gerekirse veritabanını açar.
5. `php bin/console.php migrate` komutunu otomatik çalıştırarak **tüm tabloları MySQL'e kurar**.
6. Eğer admin şifresi tanımladıysanız araştırmacı/yönetici hesabını oluşturur.
7. Web sunucusunu (`public/` güvenli köküyle) yayına alır.

---

## 🚀 Adım Adım Kurulum

### 1. Adım: Hazırlanan Dosyaları GitHub'a Gönderin (Push)

Bilgisayarınızda proje dizinindeyken terminalden şu 3 komutu çalıştırarak Docker yapılandırmasını kendi GitHub reponuza gönderin:

```bash
git add .
git commit -m "Coolify ve Docker otomatik kurulum dosyalari eklendi"
git push origin main
```

*(Not: `git remote -v` ayarınız zaten `ilyasakkus/VakaLab` reposuna baktığı için bu işlem doğrudan sizin GitHub hesabınıza gidecektir.)*

---

### 2. Adım: Coolify'daki MySQL Bilgilerini Not Edin

Coolify panelinizde önceden kurduğunuz MySQL servisine tıklayın ve şu bilgileri kontrol edin:

* **Internal Hostname / Service Name:** Genelde servis adıdır (örneğin `mysql` veya Coolify'ın atadığı benzersiz konteyner adı). Uygulamanız ve MySQL aynı Coolify projesinde olduğu için bu isimle konuşurlar.
* **Database Name (Veritabanı Adı):** Örneğin `vakalab_test` veya `vakalab`.
* **User (Kullanıcı Adı):** `root` veya oluşturduğunuz özel kullanıcı.
* **Password (Şifre):** MySQL şifreniz.
* **Port:** Standart `3306`.

---

### 3. Adım: Coolify'a VakaLab Uygulamasını Ekleyin

1. Coolify panelinde projenize gidin.
2. **+ New** butonuna tıklayın -> **Application** seçin.
3. **Public/Private GitHub Repository** seçeneğine tıklayın.
4. Kendi reponuzu seçin: **`ilyasakkus/VakaLab`**
5. Branch olarak **`main`** seçin.
6. **Build Pack:** Otomatik olarak `Dockerfile` seçilecektir (seçilmezse `Dockerfile` olarak belirleyin).
7. **Exposed Port:** `80` olarak ayarlayın.

---

### 4. Adım: Ortam Değişkenlerini (Environment Variables) Tanımlayın

Coolify'da oluşturduğunuz VakaLab uygulamasının **Environment Variables** (Ortam Değişkenleri) sekmesine gidin ve aşağıdaki değişkenleri ekleyin:

| Değişken Adı | Örnek Değer | Açıklama |
|---|---|---|
| `DB_HOST` | `mysql` | Coolify MySQL servisinizin dahili adı |
| `DB_PORT` | `3306` | MySQL portu |
| `DB_NAME` | `vakalab_test` | Veritabanı adı (Seed test verisi için adında `_test` geçmelidir) |
| `DB_USER` | `root` | MySQL kullanıcı adı |
| `DB_PASSWORD` | *(MySQL şifreniz)* | Coolify MySQL şifreniz |
| `APP_ENV` | `test` | `test` (test hesapları için) veya `production` |
| `APP_HTTPS` | `true` | Coolify HTTPS/SSL kullandığı için `true` kalmalı |
| `VAKALAB_ADMIN_PASSWORD` | `ArastirmaciSifrem2026!` | İlk araştırmacı için şifre (**en az 14 karakter**) |
| `VAKALAB_ADMIN_LOGIN` | `arastirmaci` | Araştırmacı kullanıcı adı (varsayılan: arastirmaci) |

#### *(İsteğe Bağlı)* Hazır Test Verilerini Yüklemek İsterseniz:
Eğer vakalar, rubrikler ve test öğrencileri (`TEST-OGR-01`, `TEST-OGR-02` vb.) otomatik yüklensin isterseniz şu değişkeni de ekleyin:

| Değişken Adı | Örnek Değer | Açıklama |
|---|---|---|
| `VAKALAB_SEED_PASSWORD` | `TestSifrem1234!` | Test öğrencileri için ortak şifre (**en az 12 karakter**) |

*(Not: Seed verisinin yüklenebilmesi için `APP_ENV=test` ve `DB_NAME` içinde `_test` geçmesi gerekmektedir.)*

---

### 5. Adım: Deploy Edin ve Logları İzleyin

1. Coolify arayüzünün sağ üst köşesindeki **Deploy** butonuna tıklayın.
2. **Deployments** sekmesine geçerek logları izleyin.
3. Loglarda sırasıyla şunları göreceksiniz:
   ```text
   >> config/local.php ortam değişkenlerinden üretiliyor...
   >> MySQL bağlantısı başarılı ve "vakalab_test" veritabanı hazır.
   >> Tablo migration işlemleri yürütülüyor...
   >> Migration 001/002/003 hazır; mevcut kayıtlar korunur.
   >> Araştırmacı hesabı kontrol ediliyor (arastirmaci)...
   >> Araştırmacı oluşturuldu.
   >> VakaLab Hazır! Web Sunucusu Başlatılıyor.
   ```
4. Derleme tamamlandığında Coolify'ın atadığı alan adına (domain/URL) tıklayarak siteyi açın.

---

### 6. Adım: Sisteme Giriş Yapma

Siteniz açıldığında sağ üstten veya giriş ekranından giriş yapabilirsiniz:

* **Araştırmacı (Yönetici) Girişi:**
  * **Kullanıcı Adı:** `arastirmaci` (veya seed yüklediyseniz `TEST-ARASTIRMACI`)
  * **Şifre:** `VAKALAB_ADMIN_PASSWORD` alanına girdiğiniz şifre
* **Öğrenci Girişi (Eğer Seed Yüklediyseniz):**
  * **Kullanıcı Adı:** `TEST-OGR-01`, `TEST-OGR-02` ...
  * **Şifre:** `VAKALAB_SEED_PASSWORD` alanına girdiğiniz şifre

---

## 🛠️ Olası Sorunlar ve Çözümleri

### 1. "MySQL veritabanına bağlanılamadı" hatası:
* **Neden:** `DB_HOST` adı yanlış girilmiş olabilir veya MySQL ile VakaLab aynı Coolify projesinde/ağında değildir.
* **Çözüm:** Coolify'da MySQL servisinizin detaylarına bakın. Internal URL kısmında yazan hostname'i (örneğin `mysql` veya `project-mysql-1`) `DB_HOST` olarak ayarlayın.

### 2. "Şifre en az 14 karakter olmalıdır" hatası:
* **Neden:** `VAKALAB_ADMIN_PASSWORD` güvenlik kuralı gereği en az 14 karakter olmalıdır.
* **Çözüm:** Şifrenizi `GucluSifre2026!+` gibi 14 karakterden uzun yapın.

### 3. Yapay Zekâ (AI) API Ayarları:
Canlıda OpenAI veya OpenRouter kullanmak isterseniz Coolify Environment Variables alanına şunları ekleyebilirsiniz:
* `AI_PROVIDER`: `compatible`
* `AI_ENDPOINT`: `https://openrouter.ai/api/v1/chat/completions` (veya OpenAI endpoint'i)
* `AI_KEY`: `sk-or-v1-...`
* `AI_MODEL`: `openai/gpt-4o-mini` (veya istediğiniz model)
* `AI_TIMEOUT`: `90`
