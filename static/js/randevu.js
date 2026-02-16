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
    const msg = document.getElementById('messageBox');

    // Saat seçilmiş mi?
    if (!selectedTime) {
        msg.className = 'message-box error';
        msg.textContent = '❌ Lütfen bir saat seçin!';
        return false;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Randevu oluşturuluyor...';

    const formData = {
        name: document.getElementById('name').value,
        phone: document.getElementById('phone').value,
        service: document.getElementById('service').value,
        date: document.getElementById('date').value,
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
            msg.className = 'message-box success';
            msg.textContent = data.message || '✅ Randevunuz oluşturuldu!';

            // Formu gizle, başarı mesajını göster
            document.getElementById('appointmentForm').style.display = 'none';
            document.getElementById('successActions').style.display = 'block';
        } else {
            msg.className = 'message-box error';
            msg.textContent = '❌ ' + (data.error || 'Bir hata oluştu');
            btn.disabled = false;
            btn.textContent = '✅ Randevuyu Onayla';

            // Saat doluysa, saatleri yeniden yükle
            if (res.status === 409) {
                loadAvailableSlots(document.getElementById('date').value);
            }
        }
    } catch (err) {
        msg.className = 'message-box error';
        msg.textContent = '❌ Sunucu hatası, lütfen tekrar deneyin.';
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
