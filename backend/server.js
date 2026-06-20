/*
El Director General / Punto de Entrada:

Es el archivo principal que arranca todo el backend:
-Levanta el servidor Express en un puerto específico (es practica estandar usar el port 3000)
-Configura los middlewares globales básicos (como permitir que reciba datos en formato JSON).
Importa y conecta todas las rutas del sistema para que el servidor sepa a dónde dirigir cada petición HTTP que le llegue.
*/

const express = require('express');
const dotenv = require('dotenv');
const path = require('path'); // 1. IMPORTAR EL MÓDULO NATIVO PATH
const authRoutes = require('./routes/auth.routes');
const deviceRoutes = require('./routes/device.routes');

dotenv.config();

const app = express();

// Middlewares globales incorporados de Express
app.use(express.json());

// 2. CORRECCIÓN CON RUTA ABSOLUTA SEGURA:
// __dirname es la ubicación física de este archivo server.js (dentro de backend/).
// path.join concatena de forma correcta subiendo un nivel y entrando a frontend/
app.use(express.static(path.join(__dirname, '../frontend')));

// Mapeo de prefijos para endpoints de enrutadores
app.use('/api/auth', authRoutes);
app.use('/api/device', deviceRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor Express escuchando peticiones en el puerto ${PORT}`);
});