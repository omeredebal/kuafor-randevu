// ══════════════════════════════════════
// ADMİN PANELİ - JavaScript
// ══════════════════════════════════════

let currentWeekOffset = 0;
let pendingAction = null;

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    loadData();
});

// Tüm veriyi yükle
function loadData() {
    loadStats();
    loadAppointments();
    renderCalendar();
}

// ─── İSTATİSTİKLER ───
async function loadStats() {
    try {
        const res = await fetch('/api/istatistikler');
        const data = await res.json();

        document.getElementById('statBugun').textContent = data.bugun;
        document.getElementById('statAktif').textContent = data.aktif;
        document.getElementById('statToplam').textContent = data.toplam;
        document.getElementById('statIptal').textContent = data.iptal;
        document.getElementById('statPopuler').textContent = data.populer_hizmet;
    } catch (err) {
        console.error('İstatistikler yüklenemedi:', err);
    }
}

// ─── RANDEVU LİSTESİ ───
async function loadAppointments() {
    const tbody = document.getElementById('appointmentsBody');
    tbody.innerHTML = '<tr><td colspan="8"><div class="loading"><div class="spinner"></div> Yükleniyor...</div></td></tr>';

    const filterDate = document.getElementById('filterDate').value;
    const filterStatus = document.getElementById('filterStatus').value;

    let url = '/api/appointments?';
    if (filterDate) url += `date=${filterDate}&`;
    if (filterStatus) url += `status=${filterStatus}&`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8">
                        <div class="empty-state">
                            <div class="icon">📭</div>
                            <p>Randevu bulunamadı</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        data.forEach(apt => {
            const tr = document.createElement('tr');
            const badgeClass = apt.status === 'aktif' ? 'badge-aktif' :
                apt.status === 'iptal' ? 'badge-iptal' : 'badge-tamamlandi';
            const statusText = apt.status === 'tamamlandı' ? 'Tamamlandı' :
                apt.status === 'aktif' ? 'Aktif' : 'İptal';

            tr.innerHTML = `
                <td><strong>#${apt.id}</strong></td>
                <td>${escapeHtml(apt.name)}</td>
                <td>${escapeHtml(apt.phone)}</td>
                <td>${escapeHtml(apt.service)}</td>
                <td>${formatDate(apt.date)}</td>
                <td><strong>${apt.time}</strong></td>
                <td><span class="badge ${badgeClass}">${statusText}</span></td>
                <td>
                    <div class="action-buttons">
                        ${apt.status === 'aktif' ? `
                            <button class="btn-icon success" title="Tamamlandı" onclick="updateStatus(${apt.id}, 'tamamlandı')">✓</button>
                            <button class="btn-icon danger" title="İptal Et" onclick="cancelAppointment(${apt.id}, '${escapeHtml(apt.name)}')">✕</button>
                        ` : `
                            <button class="btn-icon danger" title="Kalıcı Olarak Sil" onclick="deletePermanently(${apt.id})">🗑️</button>
                        `}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="icon">⚠️</div><p>Veriler yüklenirken hata oluştu</p></div></td></tr>';
        console.error(err);
    }
}

// ─── RANDEVU İPTAL ───
function cancelAppointment(id, name) {
    pendingAction = { type: 'cancel', id };
    document.getElementById('modalTitle').textContent = 'Randevu İptal';
    document.getElementById('modalMessage').textContent = `${name} adlı kişinin randevusunu iptal etmek istediğinize emin misiniz?`;
    document.getElementById('modalConfirmBtn').textContent = 'İptal Et';
    document.getElementById('modalConfirmBtn').className = 'btn btn-sm btn-danger';
    openModal();
}

// ─── KALICI SİLME ───
function deletePermanently(id) {
    pendingAction = { type: 'delete', id };
    document.getElementById('modalTitle').textContent = '⚠️ Kalıcı Silme';
    document.getElementById('modalMessage').textContent = 'Bu kayıt veritabanından tamamen silinecek. Bu işlem geri alınamaz!';
    document.getElementById('modalConfirmBtn').textContent = 'Kalıcı Olarak Sil';
    document.getElementById('modalConfirmBtn').className = 'btn btn-sm btn-danger';
    openModal();
}

// ─── DURUM GÜNCELLE ───
async function updateStatus(id, status) {
    try {
        const res = await fetch(`/api/appointments/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        if (res.ok) {
            loadData();
        }
    } catch (err) {
        console.error(err);
    }
}

// ─── MODAL ───
function openModal() {
    document.getElementById('confirmModal').classList.add('active');
}

function closeModal() {
    document.getElementById('confirmModal').classList.remove('active');
    pendingAction = null;
}

async function confirmAction() {
    if (!pendingAction) return;

    let url = `/api/appointments/${pendingAction.id}`;

    if (pendingAction.type === 'delete') {
        url += '?force=true';
    }

    try {
        const res = await fetch(url, {
            method: 'DELETE'
        });

        if (res.ok) {
            loadData();
        }
    } catch (err) {
        console.error(err);
    }

    closeModal();
}

// ─── TAKVİM ───
function switchTab(tab, btn) {
    // Tab butonları
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Tab içerikleri
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    if (tab === 'takvim') {
        renderCalendar();
    }
}

function changeWeek(offset) {
    currentWeekOffset += offset;
    renderCalendar();
}

async function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const title = document.getElementById('calendarTitle');

    // Haftanın günlerini hesapla
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1 + (currentWeekOffset * 7)); // Pazartesi

    const days = [];
    const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        days.push(d);
    }

    // Başlık
    const startStr = formatDate(days[0].toISOString().split('T')[0]);
    const endStr = formatDate(days[6].toISOString().split('T')[0]);
    title.textContent = `${startStr} - ${endStr}`;

    // Saatler (09:00 - 19:00)
    const hours = [];
    for (let h = 9; h < 19; h++) {
        hours.push(`${String(h).padStart(2, '0')}:00`);
        hours.push(`${String(h).padStart(2, '0')}:30`);
    }

    // Bu haftanın randevularını getir
    const dateStrings = days.map(d => d.toISOString().split('T')[0]);
    let allAppointments = [];

    try {
        const res = await fetch('/api/appointments?status=aktif');
        const data = await res.json();
        allAppointments = data.filter(a => dateStrings.includes(a.date));
    } catch (err) {
        console.error(err);
    }

    // Grid oluştur
    let html = '<div class="calendar-cell header">Saat</div>';
    days.forEach((d, i) => {
        const dateStr = d.toISOString().split('T')[0];
        const isToday = dateStr === today.toISOString().split('T')[0];
        html += `<div class="calendar-cell header" style="${isToday ? 'background: rgba(233, 69, 96, 0.15); color: var(--accent);' : ''}">${dayNames[i]}<br>${d.getDate()}/${d.getMonth() + 1}</div>`;
    });

    hours.forEach(hour => {
        html += `<div class="calendar-cell time-label">${hour}</div>`;
        days.forEach(d => {
            const dateStr = d.toISOString().split('T')[0];
            const events = allAppointments.filter(a => a.date === dateStr && a.time === hour);
            let eventsHtml = '';
            events.forEach(e => {
                eventsHtml += `<div class="event" title="${e.name} - ${e.service}">${e.name.split(' ')[0]}</div>`;
            });
            html += `<div class="calendar-cell">${eventsHtml}</div>`;
        });
    });

    grid.innerHTML = html;
}

// ─── FİLTRE ───
function clearFilters() {
    document.getElementById('filterDate').value = '';
    document.getElementById('filterStatus').value = '';
    loadAppointments();
}

// ─── ÇIKIŞ ───
async function handleLogout() {
    try {
        await fetch('/api/admin/logout', { method: 'POST' });
    } catch (err) {
        // ignore
    }
    window.location.href = '/admin';
}

// ─── YARDIMCI ───
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
}
