/*
device.controller.js (Gestor de la Extrusora):

Telemetría: Recibe las lecturas de velocidad y temperatura que el ESP32 está transmitiendo y las procesa para enviárselas 
al frontend.

Apagado y Reporte: Cuando se solicita el apagado, este controlador le manda la señal HTTP/WebSocket al ESP32 para 
detener los motores. En cuanto el hardware confirma el apagado, este archivo hace las matemáticas: calcula el tiempo 
que estuvo prendido, calcula la producción estimada de filamento PET y hace el INSERT INTO en MySQL para guardar 
el reporte de forma automática.
*/

const db = require('../config/db');

// Estado interno simulado del dispositivo en memoria para interactuar con la app
let estadoDispositivo = {
    encendido: false,
    tiempoInicio: null,
    velocidadMotores: 0,
    temperatura: 0
};

exports.obtenerTelemetria = async (req, res) => {
    // Si está apagado, devolvemos valores en cero o estado desconectado (RNF10)
    if (!estadoDispositivo.encendido) {
        return res.json({ 
            estado: "Dispositivo fuera de línea / Desconectado",
            velocidadMotores: 0,
            temperatura: 0,
            tiempoOperacion: 0,
            petReciclado: 0
        });
    }

    // Si está prendido, simulamos dinámicamente variaciones normales del hardware
    const tiempoOperacion = Math.floor((Date.now() - estadoDispositivo.tiempoInicio) / 1000);
    estadoDispositivo.temperatura = (180 + Math.random() * 5).toFixed(1); // Temperatura promedio extrusión plástico
    estadoDispositivo.velocidadMotores = (60 + Math.random() * 2).toFixed(1);

    // Regla de Negocio interna: 0.05 gramos de PET por segundo operando
    const petReciclado = (tiempoOperacion * 0.05).toFixed(2);

    res.json({
        estado: "En línea",
        velocidadMotores: parseFloat(estadoDispositivo.velocidadMotores),
        temperatura: parseFloat(estadoDispositivo.temperatura),
        tiempoOperacion,
        petReciclado: parseFloat(petReciclado)
    });
};

exports.iniciarDispositivo = async (req, res) => {
    estadoDispositivo.encendido = true;
    estadoDispositivo.tiempoInicio = Date.now();
    res.json({ mensaje: "Orden enviada: Inicializando dispositivo 3Demption." });
};

exports.apagarDispositivo = async (req, res) => {
    if (!estadoDispositivo.encendido) {
        return res.status(400).json({ error: "El dispositivo ya se encuentra apagado." });
    }

    const tiempoOperacion = Math.floor((Date.now() - estadoDispositivo.tiempoInicio) / 1000);
    const produccionEstimada = parseFloat((tiempoOperacion * 0.05).toFixed(2)); // RF8

    try {
        // 1. Guardar reporte automático en base de datos (RF7)
        await db.execute(
            'INSERT INTO reportes_produccion (id_usuario, tiempo_operacion, produccion_estimada) VALUES (?, ?, ?)',
            [req.user.id_usuario, tiempoOperacion, produccionEstimada]
        );

        // 2. Acumular el plástico reciclado total al usuario
        await db.execute(
            'UPDATE usuarios SET total_pet_reciclado = total_pet_reciclado + ? WHERE id_usuario = ?',
            [produccionEstimada, req.user.id_usuario]
        );

        // Apagar variables físicas simuladas
        estadoDispositivo.encendido = false;
        estadoDispositivo.tiempoInicio = null;

        res.json({ mensaje: "Dispositivo apagado. Reporte de producción generado con éxito." });
    } catch (err) {
        res.status(500).json({ error: "Error al guardar el reporte de apagado." });
    }
};

exports.obtenerHistorial = async (req, res) => {
    try {
        // 1. Obtener los reportes del usuario
        const [reportes] = await db.execute(
            'SELECT fecha, tiempo_operacion, produccion_estimada FROM reportes_produccion WHERE id_usuario = ? ORDER BY fecha DESC',
            [req.user.id_usuario]
        );

        // 2. Obtener el nombre y el total acumulado directo de la tabla usuarios
        const [usuario] = await db.execute(
            'SELECT nombre, total_pet_reciclado FROM usuarios WHERE id_usuario = ?',
            [req.user.id_usuario]
        );
        
        // Devolvemos un objeto estructurado con toda la información
        res.json({
            nombre: usuario[0].nombre,
            totalAcumulado: usuario[0].total_pet_reciclado,
            reportes: reportes
        });
    } catch (err) {
        res.status(500).json({ error: "Error al consultar historial." });
    }
};

exports.obtenerRanking = async (req, res) => {
    try {
        // 1. Consulta ordenada descendentemente para armar el podio de usuarios
        const [ranking] = await db.execute(
            'SELECT nombre, total_pet_reciclado FROM usuarios ORDER BY total_pet_reciclado DESC LIMIT 10'
        );

        // 2. Consulta agregada para sumar los totales de TODOS los usuarios registrados
        const [sumaGlobal] = await db.execute(
            'SELECT SUM(total_pet_reciclado) AS gran_total FROM usuarios'
        );

        res.json({
            ranking: ranking,
            totalGlobal: sumaGlobal[0].gran_total || 0
        });
    } catch (err) {
        res.status(500).json({ error: "Error al consultar el ranking." });
    }
};

exports.obtenerSponsorRanking = async (req, res) => {
    try {
        // AGREGAMOS u.nombre al GROUP BY para evitar el error de MySQL
        const [ranking] = await db.execute(`
            SELECT u.nombre, CAST(SUM(d.monto) AS DECIMAL(10,2)) AS total_donado 
            FROM usuarios u
            INNER JOIN donaciones d ON u.id_usuario = d.id_usuario
            GROUP BY u.id_usuario, u.nombre
            ORDER BY total_donado DESC 
            LIMIT 10
        `);

        res.json(ranking);
    } catch (err) {
        console.error("Error en SQL de Patrocinadores:", err); // Esto te dirá el error exacto en tu consola de Node
        res.status(500).json({ error: "Error al obtener el ranking de patrocinadores." });
    }
};

// SIMULACIÓN DE DONACIÓN ALEATORIA (Acomula si el usuario dona varias veces)
exports.simularDonacion = async (req, res) => {
    // Genera un monto aleatorio entre $50 y $500 MXN, redondeado a dos decimales
    const montoRandom = parseFloat((50 + Math.random() * 450).toFixed(2));
    const idUsuario = req.user.id_usuario;

    try {
        // 1. Insertamos el ticket individual de la donación
        await db.execute(
            'INSERT INTO donaciones (id_usuario, monto) VALUES (?, ?)',
            [idUsuario, montoRandom]
        );

        // 2. Consultamos la sumatoria total acumulada de este usuario para devolvérsela al frontend
        const [suma] = await db.execute(
            'SELECT SUM(monto) AS total_acumulado FROM donaciones WHERE id_usuario = ?',
            [idUsuario]
        );

        res.json({
            mensaje: `¡Donación simulada con éxito! Has aportado $${montoRandom} MXN.`,
            montoDonado: montoRandom,
            totalAcumulado: suma[0].total_acumulado
        });
    } catch (err) {
        res.status(500).json({ error: "Error al procesar la donación simulada." });
    }
};