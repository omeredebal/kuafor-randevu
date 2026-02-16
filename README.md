# Kuaför Randevu Sistemi

Kuaför salonları ve berberler için tasarlanmış, modern ve profesyonel bir web tabanlı randevu yönetim sistemi. Bu uygulama, müşterilerin online randevu almasını sağlarken, işletme sahiplerine rezervasyonları yönetme, istatistikleri görüntüleme ve günlük operasyonları takip etme imkanı sunan kapsamlı bir admin paneli sağlar.

## Özellikler

-   **Online Randevu:** Müşteriler hizmet, tarih ve saat seçerek kolayca randevu oluşturabilir.
-   **Hizmet Yönetimi:** Hizmetleri, fiyatları ve sürelerini listeleyin.
-   **Akıllı Planlama:** Çift rezervasyonları ve çalışma saatleri dışındaki randevuları otomatik engeller.
-   **Admin Paneli:** Randevuları görüntülemek, yönetmek ve iptal etmek için güvenli yönetim paneli.
-   **İstatistikler:** Günlük rezervasyonlar, gelir ve popüler hizmetler hakkında gerçek zamanlı içgörüler.
-   **Responsive Tasarım:** Mobil ve masaüstü cihazlarla tam uyumlu.

## Teknolojiler

-   **Backend:** Python (Flask)
-   **Veritabanı:** SQLite
-   **Frontend:** HTML5, CSS3, JavaScript
-   **Stil:** Modern ve responsive CSS

## Kurulum

1.  **Depoyu klonlayın:**
    ```bash
    git clone https://github.com/omeredebal/kuafor-randevu.git
    cd kuafor-randevu
    ```

2.  **Sanal ortam oluşturun (opsiyonel ama önerilir):**
    ```bash
    python3 -m venv .venv
    source .venv/bin/activate
    ```

3.  **Gereksinimleri yükleyin:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Uygulamayı başlatın:**
    ```bash
    python app.py
    ```

5.  **Uygulamaya erişin:**
    Tarayıcınızda `http://localhost:5001` adresine gidin.

## Kullanım

-   **Müşteriler:** Ana sayfadan hizmetleri inceleyebilir ve randevu alabilirler.
-   **Admin:** `/admin` adresine giderek aşağıdaki bilgilerle giriş yapabilir.

### Varsayılan Admin Bilgileri
-   **Kullanıcı Adı:** `admin`
-   **Şifre:** `admin123`

## Lisans

Bu proje açık kaynaklıdır ve [MIT Lisansı](LICENSE) altında sunulmaktadır.
