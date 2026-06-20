/*
la carpeta routes/ solo contiene la lista de tus endpoints. Son el mapa de entrada a tu backend.
y tienes 2 routes.js pq unos enpoints se usan para auth y otros para device

Las ventanillas:

Ambos archivos de routes solo se encargan de recibir la dirección URL que mandó el frontend y 
pasarle el paquete al empleado correcto (el controlador). 
No tienen lógica, solo son un mapa de direcciones.

auth.routes.js:
Escucha las rutas de usuarios. 
Ejemplos:Si llega un POST /api/register -> Lo manda al controlador de registro.
Si llega un POST /api/login -> Lo manda al controlador de login.

 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Endpoints públicos de accesos
router.post('/register', authController.registrarUsuario);
router.post('/login', authController.iniciarSesion);

module.exports = router;    