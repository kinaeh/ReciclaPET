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
        const [reportes] = await db.execute(
            'SELECT fecha, tiempo_operacion, produccion_estimada FROM reportes_produccion WHERE id_usuario = ? ORDER BY fecha DESC',
            [req.user.id_usuario]
        );
        
        // RNF8: Si el historial viene vacío se maneja para desplegar alerta personalizada
        res.json(reportes);
    } catch (err) {
        res.status(500).json({ error: "Error al consultar historial." });
    }
};

exports.obtenerRanking = async (req, res) => {
    try {
        // Consulta ordenada descendentemente para armar el podio (RF10)
        const [ranking] = await db.execute(
            'SELECT nombre, total_pet_reciclado FROM usuarios ORDER BY total_pet_reciclado DESC LIMIT 10'
        );
        res.json(ranking);
    } catch (err) {
        res.status(500).json({ error: "Error al consultar el ranking." });
    }
};