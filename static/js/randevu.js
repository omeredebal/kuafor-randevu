// ══════════════════════════════════════
// RANDEVU FORMU - JavaScript
// ══════════════════════════════════════

let selectedTime = null;

// Sayfa yüklendiğinde tarih input'unu ayarla
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('date');
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    // Min tarih: bugün
    dateInput.min = todayStr;

    // Max tarih: 30 gün sonrası
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 30);
    const maxYyyy = maxDate.getFullYear();
    const maxMm = String(maxDate.getMonth() + 1).padStart(2, '0');
    const maxDd = String(maxDate.getDate()).padStart(2, '0');
    dateInput.max = `${maxYyyy}-${maxMm}-${maxDd}`;

    // Tarih değiştiğinde saatleri yükle
    dateInput.addEventListener('change', () => {
        loadAvailableSlots(dateInput.value);
    });
});

// Müsait saatleri yükle
async function loadAvailableSlots(date) {
    if (!date) return;

    const timeGroup = document.getElementById('timeGroup');
    const timeSlotsDiv = document.getElementById('timeSlots');
    const kapasiteInfo = document.getElementById('kapasiteInfo');

    // Loading göster
    timeGroup.style.display = 'block';
    timeSlotsDiv.innerHTML = '<div class="loading"><div class="spinner"></div> Saatler yükleniyor...</div>';
    selectedTime = null;
    document.getElementById('time').value = '';

    try {
        // Kapasite kontrolü
        const kapRes = await fetch(`/api/gunluk-kapasite?date=${date}`);
        const kapData = await kapRes.json();

        kapasiteInfo.style.display = 'flex';
        if (kapData.dolu_mu) {
            kapasiteInfo.className = 'kapasite-info dolu';
            document.getElementById('kapasiteText').textContent =
                `❌ Bu gün için kapasite dolmuştur (${kapData.mevcut}/${kapData.kapasite})`;
            timeSlotsDiv.innerHTML = '<div class="empty-state"><div class="icon">😞</div><p>Bu güne ait tüm randevular dolu. Lütfen başka bir gün seçin.</p></div>';
            return;
        } else {
            kapasiteInfo.className = 'kapasite-info';
            document.getElementById('kapasiteText').textContent =
                `📊 Günlük kapasite: ${kapData.mevcut}/${kapData.kapasite} randevu`;
        }

        // Müsait saatleri getir
        const res = await fetch(`/api/musait-saatler?date=${date}`);
        const saatler = await res.json();

        if (saatler.length === 0) {
            timeSlotsDiv.innerHTML = '<div class="empty-state"><p>Bu gün için uygun saat bulunamadı.</p></div>';
            return;
        }

        timeSlotsDiv.innerHTML = '';
        saatler.forEach(slot => {
            const div = document.createElement('div');
            div.className = `time-slot ${slot.durum}`;
            div.textContent = slot.saat;

            if (slot.durum === 'musait') {
                div.addEventListener('click', () => selectTimeSlot(div, slot.saat));
            } else if (slot.durum === 'dolu') {
                div.title = 'Bu saat dolu';
            } else {
                div.title = 'Bu saat geçmiş';
            }

            timeSlotsDiv.appendChild(div);
        });

    } catch (err) {
        timeSlotsDiv.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>Saatler yüklenirken bir hata oluştu.</p></div>';
        console.error(err);
    }
}

// Saat seçimi
function selectTimeSlot(element, time) {
    // Önceki seçimi kaldır
    document.querySelectorAll('.time-slot.selected').forEach(el => {
        el.classList.remove('selected');
    });

    // Yeni seçim
    element.classList.add('selected');
    selectedTime = time;
    document.getElementById('time').value = time;
}

// Formu gönder
async function submitForm(e) {
    e.preventDefault();

    const btn = document.getElementById('submitBtn');

    // Validasyon alanları
    const nameInput = document.getElementById('name');
    const phoneInput = document.getElementById('phone');
    const serviceInput = document.getElementById('service');
    const dateInput = document.getElementById('date');

    // 1. İsim Kontrolü
    if (!nameInput.value.trim() || nameInput.validity.patternMismatch) {
        Swal.fire({
            icon: 'warning',
            title: 'Dikkat!',
            text: 'Lütfen geçerli bir Ad Soyad giriniz (Sadece harf).',
            confirmButtonColor: '#e94560'
        });
        return false;
    }

    // 2. Telefon Kontrolü
    if (!phoneInput.value.trim() || phoneInput.value.length < 10 || phoneInput.validity.patternMismatch) {
        Swal.fire({
            icon: 'warning',
            title: 'Dikkat!',
            text: 'Lütfen geçerli bir telefon numarası giriniz (En az 10 rakam).',
            confirmButtonColor: '#e94560'
        });
        return false;
    }

    // 3. Hizmet Kontrolü
    if (!serviceInput.value) {
        Swal.fire({
            icon: 'warning',
            title: 'Dikkat!',
            text: 'Lütfen almak istediğiniz hizmeti seçiniz.',
            confirmButtonColor: '#e94560'
        });
        return false;
    }

    // 4. Tarih Kontrolü
    if (!dateInput.value) {
        Swal.fire({
            icon: 'warning',
            title: 'Dikkat!',
            text: 'Lütfen bir tarih seçiniz.',
            confirmButtonColor: '#e94560'
        });
        return false;
    }

    // 5. Saat Kontrolü
    if (!selectedTime) {
        Swal.fire({
            icon: 'warning',
            title: 'Saat Seçmediniz!',
            text: 'Lütfen randevu için uygun bir saat seçiniz.',
            confirmButtonColor: '#e94560'
        });
        return false;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Randevu oluşturuluyor...';

    const formData = {
        name: nameInput.value,
        phone: phoneInput.value,
        service: serviceInput.value,
        date: dateInput.value,
        time: selectedTime
    };

    try {
        const res = await fetch('/api/appointments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await res.json();

        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Harika!',
                text: data.message || 'Randevunuz başarıyla oluşturuldu!',
                confirmButtonColor: '#1a1a2e',
                background: '#fff url(/images/trees.png)'
            }).then(() => {
                // Formu gizle, başarı mesajını göster
                document.getElementById('appointmentForm').style.display = 'none';
                document.getElementById('successActions').style.display = 'block';
            });

        } else {
            Swal.fire({
                icon: 'error',
                title: 'Hata!',
                text: data.error || 'Bir hata oluştu.',
                confirmButtonColor: '#dc3545'
            });

            btn.disabled = false;
            btn.textContent = '✅ Randevuyu Onayla';

            // Saat doluysa, saatleri yeniden yükle
            if (res.status === 409) {
                loadAvailableSlots(document.getElementById('date').value);
            }
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Sunucu Hatası',
            text: 'Bir sorun oluştu, lütfen daha sonra tekrar deneyin.',
            confirmButtonColor: '#dc3545'
        });
        btn.disabled = false;
        btn.textContent = '✅ Randevuyu Onayla';
        console.error(err);
    }

    return false;
}

// Formu sıfırla
function resetForm() {
    document.getElementById('appointmentForm').style.display = 'block';
    document.getElementById('appointmentForm').reset();
    document.getElementById('successActions').style.display = 'none';
    document.getElementById('messageBox').className = 'message-box';
    document.getElementById('messageBox').textContent = '';
    document.getElementById('timeGroup').style.display = 'none';
    document.getElementById('kapasiteInfo').style.display = 'none';
    document.getElementById('submitBtn').disabled = false;
    document.getElementById('submitBtn').textContent = '✅ Randevuyu Onayla';
    selectedTime = null;
}
