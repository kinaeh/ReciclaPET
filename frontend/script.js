let token = localStorage.getItem('token') || null;
let intervalId = null;

if (token) {
    showDashboard();
}

async function register() {
    const nombre = document.getElementById('auth-name').value;
    const claveDispositivo = document.getElementById('auth-key').value;
    const msg = document.getElementById('auth-msg');

    if (!nombre || !claveDispositivo) {
        msg.textContent = "Complete todos los campos para proceder.";
        return;
    }

    const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, claveDispositivo })
    });
    const data = await res.json();
    msg.textContent = data.mensaje || data.error;
}

async function login() {
    const nombre = document.getElementById('auth-name').value;
    const claveDispositivo = document.getElementById('auth-key').value;
    const msg = document.getElementById('auth-msg');

    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, claveDispositivo })
    });
    const data = await res.json();

    if (res.ok) {
        token = data.token;
        localStorage.setItem('token', token);
        localStorage.setItem('username', data.nombre);
        showDashboard();
    } else {
        msg.textContent = data.error;
    }
}

function showDashboard() {
    document.getElementById('landing-container').classList.add('hidden');
    document.getElementById('dashboard-container').classList.remove('hidden');
    document.getElementById('user-display').textContent = localStorage.getItem('username');
    
    loadDashboardData();
    intervalId = setInterval(loadDashboardData, 2000);
    loadSponsorRanking();
}

// MANEJO EXCLUSIVO DE DESPLAZAMIENTO DE SECCIONES (SPA)
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Cambiar clase activa en los botones de navegación de la barra lateral
    document.querySelectorAll('.menu-item').forEach(btn => btn.classList.remove('active'));
    
    const targetBtnId = sectionId.replace('sec-', 'btn-nav-');
    const activeBtn = document.getElementById(targetBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

async function loadDashboardData() {
    try {
        const res = await fetch('/api/device/telemetry', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if(res.status === 401 || res.status === 403) return logout();

        const data = await res.json();
        const statusBanner = document.getElementById('status-text');
        statusBanner.textContent = data.estado;

        if (data.estado.includes("fuera de línea") || data.estado.includes("Desconectado")) {
            statusBanner.style.background = "#2d1a1a";
            statusBanner.style.color = "#f87171";
            document.getElementById('val-temp').textContent = "0";
            document.getElementById('val-vel').textContent = "0";
            document.getElementById('val-time').textContent = "0";
            document.getElementById('val-pet').textContent = "0";
            updateControlButtons(false); 
        } else {
            statusBanner.style.background = "#142d1a";
            statusBanner.style.color = "#4ade80";
            document.getElementById('val-temp').textContent = data.temperatura;
            document.getElementById('val-vel').textContent = data.velocidadMotores;
            document.getElementById('val-time').textContent = data.tiempoOperacion;
            document.getElementById('val-pet').textContent = data.petReciclado;
            updateControlButtons(true);
        }
    } catch (err) {
        document.getElementById('status-text').textContent = "Dispositivo fuera de línea / Desconectado";
    }

    loadHistory();
    loadRanking();
}

function updateControlButtons(isDeviceRunning) {
    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');

    if (isDeviceRunning) {
        btnStart.className = "btn-disabled";
        btnStart.disabled = true;
        btnStop.className = "btn-danger";
        btnStop.disabled = false;
    } else {
        btnStart.className = "btn-success";
        btnStart.disabled = false;
        btnStop.className = "btn-disabled";
        btnStop.disabled = true;
    }
}

async function controlDevice(action) {
    await fetch(`/api/device/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    loadDashboardData();
}

async function loadHistory() {
    const res = await fetch('/api/device/history', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const reportes = await res.json();
    const section = document.getElementById('history-section');

    if (reportes.length === 0) {
        section.innerHTML = `<p class="msg-alert" style="color: #fbbf24; padding: 20px;">No se encontraron registros de producción disponibles.</p>`;
        return;
    }

    let html = `<table><tr><th>Fecha</th><th>Tiempo (s)</th><th>Filamento (g)</th></tr>`;
    reportes.forEach(r => {
        html += `<tr><td>${new Date(r.fecha).toLocaleString()}</td><td>${r.tiempo_operacion}</td><td>${r.produccion_estimada}</td></tr>`;
    });
    html += `</table>`;
    section.innerHTML = html;
}

async function loadRanking() {
    const res = await fetch('/api/device/ranking', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const ranking = await res.json();
    const section = document.getElementById('ranking-section');

    section.innerHTML = ranking.map(u => `<li>${u.nombre} - <strong>${u.total_pet_reciclado} g</strong> reciclados</li>`).join('');
}

function logout() {
    clearInterval(intervalId);
    localStorage.clear();
    token = null;
    document.getElementById('landing-container').classList.remove('hidden');
    document.getElementById('dashboard-container').classList.add('hidden');
}

async function loadSponsorRanking() {
    try {
        const res = await fetch('/api/device/sponsor-ranking', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const ranking = await res.json();
        const section = document.getElementById('sponsor-ranking-section');

        if (ranking.length === 0) {
            section.innerHTML = `<p style="color: #9ca3af; padding: 10px;">¡Sé el primer patrocinador simulado del proyecto!</p>`;
            return;
        }

        // Mapea los donadores simulados al contenedor en tu interfaz oscura
        section.innerHTML = ranking.map((donador, index) => `
            <li>
                <span>${index + 1}. ${donador.nombre}</span> 
                - <strong style="color: #2563eb;">$${donador.total_donado} MXN</strong>
            </li>
        `).join('');
    } catch (err) {
        console.error("Error cargando el ranking de patrocinadores:", err);
    }
}