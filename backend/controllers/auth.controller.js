/*
la carpeta controllers/ son los obreros lógicos, aplican la Lógica de Negocio

Aquí ocurre toda la inteligencia del software. Reciben los datos crudos, aplican las reglas,
hablan con la base de datos y dan la respuesta final.

auth.controller.js (Gestor de Accesos):
Tiene la lógica para registrar usuarios nuevos validando claves preexistentes.
Tiene la lógica del Login: toma la clave que mandó el frontend, ejecuta la consulta preparada en db.js para evitar 
inyección SQL, verifica si coincide y le responde al frontend si le da acceso o no.
*/

const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.registrarUsuario = async (req, res) => {
    const { nombre, claveDispositivo } = req.body;

    if (!nombre || !claveDispositivo) {
        return res.status(400).json({ error: "Todos los campos son obligatorios." });
    }

    try {
        // 1. Verificar si la clave de producto de fábrica existe en la tabla dispositivos
        const [dispositivo] = await db.execute(
            'SELECT * FROM dispositivos WHERE claveUnica = ?', 
            [claveDispositivo]
        );

        if (dispositivo.length === 0) {
            return res.status(400).json({ error: "La clave de producto no es válida o no existe." });
        }

        // 2. Verificar si el dispositivo ya está vinculado a algún usuario
        if (dispositivo[0].usuario_id !== null) {
            return res.status(400).json({ error: "Esta clave de dispositivo ya se encuentra vinculada por otro usuario." });
        }

        // 3. Cifrar la clave única con bcrypt antes de guardarla en la cuenta (RNF1)
        const salt = await bcrypt.genSalt(10);
        const claveCifrada = await bcrypt.hash(claveDispositivo, salt);

        // 4. Inserción segura del nuevo usuario mediante consultas preparadas (RNF7)
        const [nuevoUsuario] = await db.execute(
            'INSERT INTO usuarios (nombre, clave_dispositivo) VALUES (?, ?)',
            [nombre, claveCifrada]
        );

        // Obtener el id autogenerado del usuario creado
        const usuarioIdGenerado = nuevoUsuario.insertId;

        // 5. Vincular el dispositivo libre asignándole el id del nuevo usuario
        await db.execute(
            'UPDATE dispositivos SET usuario_id = ? WHERE claveUnica = ?',
            [usuarioIdGenerado, claveDispositivo]
        );

        res.status(201).json({ mensaje: "Usuario registrado y dispositivo vinculado exitosamente." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error interno del servidor al registrar." });
    }
};

exports.iniciarSesion = async (req, res) => {
    const { nombre, claveDispositivo } = req.body;

    try {
        // Buscar al usuario por nombre
        const [usuarios] = await db.execute('SELECT * FROM usuarios WHERE nombre = ?', [nombre]);
        if (usuarios.length === 0) {
            return res.status(400).json({ error: "Credenciales inválidas." });
        }

        const usuario = usuarios[0];

        // Comparar clave cifrada
        const claveValida = await bcrypt.compare(claveDispositivo, usuario.clave_dispositivo);
        if (!claveValida) {
            return res.status(400).json({ error: "Credenciales inválidas." });
        }

        // Emitir Token de Sesión JWT (RNF2)
        const token = jwt.sign(
            { id_usuario: usuario.id_usuario, nombre: usuario.nombre },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        res.json({ mensaje: "Autenticación exitosa", token, nombre: usuario.nombre });
    } catch (err) {
        res.status(500).json({ error: "Error en el inicio de sesión." });
    }
};