/*
El guardia de seguridad personalizado:

Su único trabajo es interceptar las peticiones antes de que lleguen a las pantallas de control.
Si el usuario intenta entrar a ver la telemetría sin haber iniciado sesión, 
este archivo lo detecta, bloquea la petición y le responde al frontend con un error de 
"No autorizado". Si todo está en regla, lo deja pasar. */

/*Explicar mas acerca de como hace esto usando JWT*/

const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // buscar el token en las cabeceras de la petición
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer TOKEN"

    if (!token) {
        return res.status(401).json({ error: "Acceso denegado. No se proporcionó un token válido." });
    }

    try {
        const verificado = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verificado; // adjuntar los datos descifrados del usuario a la petición
        next(); // permitir pasar al siguiente eslabón (Controlador)
    } catch (err) {
        res.status(403).json({ error: "Token inválido o expirado." });
    }
};