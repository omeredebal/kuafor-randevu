import sqlite3
import os
from datetime import datetime, timedelta
from functools import wraps

from flask import Flask, request, jsonify, render_template, session, redirect, url_for

app = Flask(__name__)
app.secret_key = "kuafor-gizli-anahtar-2026"

DATABASE = os.path.join(os.path.dirname(__file__), "kuafor.db")

# ─── Çalışma saatleri ───
CALISMA_BASLANGIC = 9  # 09:00
CALISMA_BITIS = 19  # 19:00
RANDEVU_SURESI = 30  # dakika
GUNLUK_KAPASITE = 20  # günlük max randevu

# ─── Admin bilgileri ───
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

# ─── Hizmetler ve fiyatlar ───
HIZMETLER = [
    {"id": 1, "ad": "Saç Kesimi (Erkek)", "fiyat": 250, "sure": 30},
    {"id": 2, "ad": "Saç Kesimi (Kadın)", "fiyat": 400, "sure": 45},
    {"id": 3, "ad": "Saç Boyama", "fiyat": 800, "sure": 90},
    {"id": 4, "ad": "Fön", "fiyat": 200, "sure": 30},
    {"id": 5, "ad": "Keratin Bakım", "fiyat": 1500, "sure": 120},
    {"id": 6, "ad": "Sakal Tıraşı", "fiyat": 150, "sure": 20},
    {"id": 7, "ad": "Manikür", "fiyat": 300, "sure": 45},
    {"id": 8, "ad": "Pedikür", "fiyat": 350, "sure": 60},
    {"id": 9, "ad": "Ağda", "fiyat": 500, "sure": 60},
    {"id": 10, "ad": "Cilt Bakımı", "fiyat": 600, "sure": 60},
]


# ──────────────────────────────
# Veritabanı yardımcıları
# ──────────────────────────────
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = get_db()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            service TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'aktif',
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        )
    """
    )
    conn.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_date_time
        ON appointments(date, time)
        WHERE status = 'aktif'
    """
    )
    conn.commit()
    conn.close()


# ──────────────────────────────
# Admin giriş kontrolü
# ──────────────────────────────
def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("admin_logged_in"):
            return redirect(url_for("admin_login_page"))
        return f(*args, **kwargs)

    return decorated


# ──────────────────────────────
# Sayfa route'ları
# ──────────────────────────────
@app.route("/")
def index():
    return render_template("index.html", hizmetler=HIZMETLER)


@app.route("/randevu")
def randevu_page():
    return render_template("randevu.html", hizmetler=HIZMETLER)


@app.route("/admin")
def admin_login_page():
    if session.get("admin_logged_in"):
        return redirect(url_for("admin_panel_page"))
    return render_template("admin_login.html")


@app.route("/admin/panel")
@admin_required
def admin_panel_page():
    return render_template("admin_panel.html")


# ──────────────────────────────
# API Endpoint'leri
# ──────────────────────────────


# --- Hizmetleri getir ---
@app.route("/api/hizmetler", methods=["GET"])
def get_hizmetler():
    return jsonify(HIZMETLER)


# --- Müsait saatleri getir ---
@app.route("/api/musait-saatler", methods=["GET"])
def get_musait_saatler():
    tarih = request.args.get("date")
    if not tarih:
        return jsonify({"error": "Tarih gerekli"}), 400

    # Tüm çalışma saatlerini oluştur
    tum_saatler = []
    saat = CALISMA_BASLANGIC
    dakika = 0
    while saat < CALISMA_BITIS:
        tum_saatler.append(f"{saat:02d}:{dakika:02d}")
        dakika += RANDEVU_SURESI
        if dakika >= 60:
            saat += 1
            dakika = 0

    # Dolu saatleri bul
    conn = get_db()
    cursor = conn.execute(
        "SELECT time FROM appointments WHERE date = ? AND status = 'aktif'", (tarih,)
    )
    dolu_saatler = [row["time"] for row in cursor.fetchall()]
    conn.close()

    # Geçmiş saatleri kontrol et (bugünse)
    bugun = datetime.now().strftime("%Y-%m-%d")
    simdi = datetime.now().strftime("%H:%M")

    musait = []
    for s in tum_saatler:
        durum = "musait"
        if s in dolu_saatler:
            durum = "dolu"
        elif tarih == bugun and s <= simdi:
            durum = "gecmis"
        musait.append({"saat": s, "durum": durum})

    return jsonify(musait)


# --- Günlük kapasite kontrolü ---
@app.route("/api/gunluk-kapasite", methods=["GET"])
def get_gunluk_kapasite():
    tarih = request.args.get("date")
    if not tarih:
        return jsonify({"error": "Tarih gerekli"}), 400

    conn = get_db()
    cursor = conn.execute(
        "SELECT COUNT(*) as sayi FROM appointments WHERE date = ? AND status = 'aktif'",
        (tarih,),
    )
    sayi = cursor.fetchone()["sayi"]
    conn.close()

    return jsonify(
        {
            "tarih": tarih,
            "mevcut": sayi,
            "kapasite": GUNLUK_KAPASITE,
            "dolu_mu": sayi >= GUNLUK_KAPASITE,
        }
    )


# --- Randevu oluştur ---
@app.route("/api/appointments", methods=["POST"])
def create_appointment():
    data = request.get_json()

    # Validasyon
    required = ["name", "phone", "service", "date", "time"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"{field} alanı zorunludur"}), 400

    name = data["name"].strip()
    phone = data["phone"].strip()
    service = data["service"].strip()
    date = data["date"].strip()
    time_ = data["time"].strip()

    # Telefon kontrolü
    if len(phone) < 10:
        return jsonify({"error": "Geçerli bir telefon numarası girin"}), 400

    # Tarih kontrolü - geçmiş tarih
    try:
        randevu_tarihi = datetime.strptime(date, "%Y-%m-%d").date()
        bugun = datetime.now().date()
        if randevu_tarihi < bugun:
            return jsonify({"error": "Geçmiş tarihe randevu alınamaz"}), 400
    except ValueError:
        return jsonify({"error": "Geçersiz tarih formatı"}), 400

    # Saat kontrolü - çalışma saatleri
    try:
        saat_int = int(time_.split(":")[0])
        if saat_int < CALISMA_BASLANGIC or saat_int >= CALISMA_BITIS:
            return (
                jsonify(
                    {
                        "error": f"Çalışma saatleri {CALISMA_BASLANGIC:02d}:00 - {CALISMA_BITIS:02d}:00 arasıdır"
                    }
                ),
                400,
            )
    except (ValueError, IndexError):
        return jsonify({"error": "Geçersiz saat formatı"}), 400

    # Günlük kapasite kontrolü
    conn = get_db()
    cursor = conn.execute(
        "SELECT COUNT(*) as sayi FROM appointments WHERE date = ? AND status = 'aktif'",
        (date,),
    )
    if cursor.fetchone()["sayi"] >= GUNLUK_KAPASITE:
        conn.close()
        return jsonify({"error": "Bu gün için kapasite dolmuştur"}), 400

    # *** ÖNEMLİ: Aynı tarih + saat çakışma kontrolü ***
    cursor = conn.execute(
        "SELECT id FROM appointments WHERE date = ? AND time = ? AND status = 'aktif'",
        (date, time_),
    )
    if cursor.fetchone():
        conn.close()
        return (
            jsonify(
                {"error": "Bu tarih ve saat zaten dolu! Lütfen başka bir saat seçin."}
            ),
            409,
        )

    # Kaydet
    try:
        conn.execute(
            "INSERT INTO appointments (name, phone, service, date, time, status) VALUES (?, ?, ?, ?, ?, 'aktif')",
            (name, phone, service, date, time_),
        )
        conn.commit()
        return (
            jsonify(
                {"message": "Randevunuz başarıyla oluşturuldu! ✅", "success": True}
            ),
            201,
        )
    except sqlite3.IntegrityError:
        return jsonify({"error": "Bu tarih ve saat zaten dolu!"}), 409
    finally:
        conn.close()


# --- Tüm randevuları getir (Admin) ---
@app.route("/api/appointments", methods=["GET"])
def get_appointments():
    tarih = request.args.get("date")
    durum = request.args.get("status")

    conn = get_db()
    query = "SELECT * FROM appointments WHERE 1=1"
    params = []

    if tarih:
        query += " AND date = ?"
        params.append(tarih)
    if durum:
        query += " AND status = ?"
        params.append(durum)

    query += " ORDER BY date ASC, time ASC"

    cursor = conn.execute(query, params)
    appointments = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify(appointments)


# --- Randevu iptal et ---
@app.route("/api/appointments/<int:appointment_id>", methods=["DELETE"])
def delete_appointment(appointment_id):
    conn = get_db()
    cursor = conn.execute(
        "UPDATE appointments SET status = 'iptal' WHERE id = ? AND status = 'aktif'",
        (appointment_id,),
    )
    conn.commit()

    if cursor.rowcount == 0:
        conn.close()
        return jsonify({"error": "Randevu bulunamadı veya zaten iptal edilmiş"}), 404

    conn.close()
    return jsonify({"message": "Randevu iptal edildi", "success": True})


# --- Randevu durumunu güncelle ---
@app.route("/api/appointments/<int:appointment_id>/status", methods=["PATCH"])
def update_appointment_status(appointment_id):
    data = request.get_json()
    new_status = data.get("status")

    if new_status not in ["aktif", "iptal", "tamamlandı"]:
        return jsonify({"error": "Geçersiz durum"}), 400

    conn = get_db()
    cursor = conn.execute(
        "UPDATE appointments SET status = ? WHERE id = ?", (new_status, appointment_id)
    )
    conn.commit()

    if cursor.rowcount == 0:
        conn.close()
        return jsonify({"error": "Randevu bulunamadı"}), 404

    conn.close()
    return jsonify({"message": "Durum güncellendi", "success": True})


# --- İstatistikler (Admin) ---
@app.route("/api/istatistikler", methods=["GET"])
def get_istatistikler():
    conn = get_db()

    bugun = datetime.now().strftime("%Y-%m-%d")

    # Bugünkü randevular
    cursor = conn.execute(
        "SELECT COUNT(*) as sayi FROM appointments WHERE date = ? AND status = 'aktif'",
        (bugun,),
    )
    bugun_sayi = cursor.fetchone()["sayi"]

    # Toplam randevu
    cursor = conn.execute("SELECT COUNT(*) as sayi FROM appointments")
    toplam = cursor.fetchone()["sayi"]

    # Aktif randevular
    cursor = conn.execute(
        "SELECT COUNT(*) as sayi FROM appointments WHERE status = 'aktif'"
    )
    aktif = cursor.fetchone()["sayi"]

    # İptal edilen
    cursor = conn.execute(
        "SELECT COUNT(*) as sayi FROM appointments WHERE status = 'iptal'"
    )
    iptal = cursor.fetchone()["sayi"]

    # En popüler hizmet
    cursor = conn.execute(
        """
        SELECT service, COUNT(*) as sayi FROM appointments
        GROUP BY service ORDER BY sayi DESC LIMIT 1
    """
    )
    row = cursor.fetchone()
    populer = row["service"] if row else "-"

    conn.close()

    return jsonify(
        {
            "bugun": bugun_sayi,
            "toplam": toplam,
            "aktif": aktif,
            "iptal": iptal,
            "populer_hizmet": populer,
        }
    )


# --- Admin giriş ---
@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json()
    username = data.get("username", "")
    password = data.get("password", "")

    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        session["admin_logged_in"] = True
        return jsonify({"message": "Giriş başarılı", "success": True})
    else:
        return jsonify({"error": "Kullanıcı adı veya şifre hatalı"}), 401


# --- Admin çıkış ---
@app.route("/api/admin/logout", methods=["POST"])
def admin_logout():
    session.pop("admin_logged_in", None)
    return jsonify({"message": "Çıkış yapıldı", "success": True})


# ──────────────────────────────
# Uygulama başlatma
# ──────────────────────────────
if __name__ == "__main__":
    init_db()
    print("🏪 Kuaför Randevu Sistemi başlatılıyor...")
    print("📍 http://localhost:5001")
    app.run(debug=True, port=5001)
