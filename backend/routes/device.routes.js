/*
Escucha las rutas que controlan la máquina.
Ejemplos:Si llega un POST /api/device/stop -> Lo manda al controlador que detiene el motor.
Si llega un GET /api/device/telemetry -> Lo manda al controlador que lee el ESP32.
*/

const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/device.controller');
const verificarAuth = require('../middleware/auth.middleware');

// Endpoints protegidos por el middleware de seguridad
router.get('/telemetry', verificarAuth, deviceController.obtenerTelemetria);
router.post('/start', verificarAuth, deviceController.iniciarDispositivo);
router.post('/stop', verificarAuth, deviceController.apagarDispositivo);
router.get('/history', verificarAuth, deviceController.obtenerHistorial);
router.get('/ranking', verificarAuth, deviceController.obtenerRanking);

//donación simulada
router.get('/sponsor-ranking', verificarAuth, deviceController.obtenerSponsorRanking);
router.post('/donate', verificarAuth, deviceController.simularDonacion);

module.exports = router;