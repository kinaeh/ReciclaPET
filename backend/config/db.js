/*En la carpeta config tu pones tus conexiones exteriores

El puente a la Base de Datos:

Aquí importas el paquete mysql2. Configura el Pool de conexiones usando las
variables del archivo .env y exporta el objeto db listo para usar db.execute(). 
Cada vez que un controlador necesite consultar algo, le pedirá permiso a este archivo.
*/

const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

// pool de conexiones a reutilizar
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// exportar el pool usando la interfaz de Promesas (para usar async/await)
module.exports = pool.promise();