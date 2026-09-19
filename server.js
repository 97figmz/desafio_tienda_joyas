const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Middleware para registrar las consultas realizadas
const reporteConsulta = (req, res, next) => {
    console.log(`Consulta realizada a la ruta: ${req.method} ${req.url}`);
    next();
};

app.use(reporteConsulta);

// Conexión a PostgreSQL
const pool = new Pool({
    host: "localhost",
    user: "postgres",
    database: "joyas",
    port: 5432
});

pool.query("SELECT NOW()")
    .then(() => console.log("Conexión a PostgreSQL exitosa"))
    .catch((error) =>
        console.error("Error de conexión:", error.message)
    );

// Función para preparar la estructura HATEOAS
const prepararHATEOAS = (joyas) => {
    const results = joyas.map((joya) => {
        return {
            name: joya.nombre,
            href: `/joyas/${joya.id}`
        };
    });

    const totalJoyas = joyas.length;

    const stockTotal = joyas.reduce(
        (total, joya) => total + joya.stock,
        0
    );

    return {
        totalJoyas,
        stockTotal,
        results
    };
};

// GET /joyas
// Permite límite, paginación, ordenamiento y HATEOAS
app.get("/joyas", async (req, res) => {
    try {
        const {
            limits = 3,
            page = 1,
            order_by = "id_ASC"
        } = req.query;

        const [campo, direccion] = order_by.split("_");

        const offset = (page - 1) * limits;

        const consulta = `
            SELECT * FROM inventario
            ORDER BY ${campo} ${direccion}
            LIMIT $1 OFFSET $2
        `;

        const { rows } = await pool.query(
            consulta,
            [limits, offset]
        );

        const HATEOAS = prepararHATEOAS(rows);

        res.json(HATEOAS);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: "Error al obtener las joyas"
        });
    }
});

// GET /joyas/filtros
// Permite filtrar por precio, categoría y metal
app.get("/joyas/filtros", async (req, res) => {
    try {
        const {
            precio_max,
            precio_min,
            categoria,
            metal
        } = req.query;

        let filtros = [];
        let valores = [];

        if (precio_max) {
            valores.push(precio_max);
            filtros.push(
                `precio <= $${valores.length}`
            );
        }

        if (precio_min) {
            valores.push(precio_min);
            filtros.push(
                `precio >= $${valores.length}`
            );
        }

        if (categoria) {
            valores.push(categoria);
            filtros.push(
                `categoria = $${valores.length}`
            );
        }

        if (metal) {
            valores.push(metal);
            filtros.push(
                `metal = $${valores.length}`
            );
        }

        let consulta = "SELECT * FROM inventario";

        if (filtros.length > 0) {
            consulta +=
                " WHERE " + filtros.join(" AND ");
        }

        const { rows } = await pool.query(
            consulta,
            valores
        );

        res.json(rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: "Error al filtrar las joyas"
        });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(
        `Servidor corriendo en http://localhost:${PORT}`
    );
});