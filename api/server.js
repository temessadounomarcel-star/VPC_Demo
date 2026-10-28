const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
const port = 3000;

app.get("/", async (req, res) => {
  try {
    const db = await mysql.createConnection({
      host: "mysql-container",
      user: "root",
      password: "demo-root",
      database: "Demo_db"
    });

    const [rows] = await db.query("SELECT NOW() AS heure");
    await db.end();

    res.json({
      message: "API Node.js opérationnelle",
      mysql: "Connexion réussie",
      resultat: rows[0]
    });
  } catch (error) {
    res.status(500).json({
      message: "Erreur de connexion à MySQL",
      erreur: error.message
    });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`API démarrée sur le port ${port}`);
});