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
    const data = await res.json(); // Ahora 'data' contiene { nombre, totalAcumulado, reportes }
    const section = document.getElementById('history-section');

    // validar si el arreglo interno de reportes viene vacío
    if (!data.reportes || data.reportes.length === 0) {
        section.innerHTML = `
            <h3 style="color: #a8a8a8; margin-bottom: 20px;">Total de PET reciclado (PET convertido a filamento) por ${data.nombre || localStorage.getItem('username')} = 0.00 g</h3>
            <p class="msg-alert" style="color: #fbbf24; padding: 20px;">No se encontraron registros de producción disponibles.</p>
        `;
        return;
    }

    // insertar la métrica dinámica solicitada y abrimos la tabla
    let html = `
    <h3 id="metrica-historial" style="color: #a8a8a8; margin-bottom: 20px;">Total de PET reciclado (PET convertido a filamento) por ${data.nombre} = ${parseFloat(data.totalAcumulado).toFixed(2)} g</h3>
    <table>
        <tr><th>Fecha</th><th>Tiempo (s)</th><th>Filamento (g)</th></tr>
    `;

    // iterar sobre el arreglo interno 'data.reportes' aplicando .toFixed(2) al filamento
    data.reportes.forEach(r => {
        html += `<tr><td>${new Date(r.fecha).toLocaleString()}</td><td>${r.tiempo_operacion}</td><td>${parseFloat(r.produccion_estimada).toFixed(2)} g</td></tr>`;
    });
    html += `</table>`;
    section.innerHTML = html;
}

async function loadRanking() {
    const res = await fetch('/api/device/ranking', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json(); // Ahora 'data' contiene { ranking, totalGlobal }
    const section = document.getElementById('ranking-section');

    const metricaGlobalHTML = `<h3 id="metrica-global" style="color: #a8a8a8; margin-bottom: 20px;">Total de PET reciclado (PET convertido a filamento) = ${parseFloat(data.totalGlobal).toFixed(2)} g</h3>`;

    // mapear el arreglo interno 'data.ranking' controlando los decimales individuales
    const listaHTML = data.ranking.map(u => `<li>${u.nombre} - <strong>${parseFloat(u.total_pet_reciclado).toFixed(2)} g</strong> reciclados</li>`).join('');

    section.innerHTML = metricaGlobalHTML + `<ul>${listaHTML}</ul>`;
}

function logout() {
    clearInterval(intervalId);
    localStorage.clear();
    token = null;
    document.getElementById('landing-container').classList.remove('hidden');
    document.getElementById('dashboard-container').classList.add('hidden');
}

async function enviarDonacionSimulada() {
    const statusTxt = document.getElementById('donacion-status');
    statusTxt.textContent = "Procesando pago seguro simulado...";

    try {
        const res = await fetch('/api/device/donate', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok) {
            statusTxt.style.color = "#4ade80";
            statusTxt.innerText = `${data.mensaje}\nTu saldo total aportado al proyecto es de: $${parseFloat(data.totalAcumulado).toFixed(2)} MXN.`;
            
            // Recargamos inmediatamente el ranking de patrocinadores para ver el movimiento en vivo
            loadSponsorRanking();
        } else {
            statusTxt.style.color = "#f87171";
            statusTxt.textContent = data.error || "No se pudo completar la transacción.";
        }
    } catch (err) {
        statusTxt.style.color = "#f87171";
        statusTxt.textContent = "Error de conexión con el servidor de pagos.";
    }
}

async function loadSponsorRanking() {
    try {
        const res = await fetch('/api/device/sponsor-ranking', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const section = document.getElementById('sponsor-ranking-section');
        if (!section) return; // Si no existe en esta página, detenemos la función

        if (!res.ok) {
            section.innerHTML = `<li style="color: #f87171; list-style: none;">Error al conectar con el servidor.</li>`;
            return;
        }

        const ranking = await res.json();

        if (ranking.error) {
            section.innerHTML = `<li style="color: #f87171; list-style: none;">${ranking.error}</li>`;
            return;
        }
        if (!Array.isArray(ranking) || ranking.length === 0) {
            section.innerHTML = `<li style="color: #9ca3af; list-style: none; padding: 10px;">¡Sé el primer patrocinador del proyecto!</li>`;
            return;
        }

        section.innerHTML = ranking.map((donador, index) => `
            <li>
                <span class="rank-number">#${index + 1}</span> 
                <span class="sponsor-name">${donador.nombre}</span> 
                <span class="sponsor-amount" style="color: #4ade80; font-weight: bold; margin-left: 10px;">
                    $${parseFloat(donador.total_donado).toFixed(2)} MXN
                </span>
            </li>
        `).join('');

    } catch (err) {
        console.error("Error cargando el ranking de patrocinadores:", err);
        const section = document.getElementById('sponsor-ranking-section');
        if (section) {
            section.innerHTML = `<li style="color: #f87171; list-style: none;">Error de red o servidor.</li>`;
        }
    }
}