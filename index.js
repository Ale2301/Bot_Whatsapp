const { google } = require("googleapis");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
require ("dotenv").config()
const credentialsPath = "keys.json";
process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;

// Importar la librería express
const express = require('express');

// Crear una instancia de la aplicación express
const app = express();

// Definir el puerto donde escuchará el servidor
const port = 3080;

// Usar el método express.static para servir los archivos estáticos de la carpeta "public"
app.use(express.static('public'));

// Definir una función que maneje las peticiones a la ruta raíz
app.get('/', (req, res) => {
  // Enviar una respuesta con el texto "Hola mundo"
  res.sendFile('public/index.html');
});



// Iniciar el servidor en el puerto especificado
app.listen(port, () => {
  // Mostrar un mensaje en la consola indicando que el servidor está listo
  console.log(`Servidor listo en http://localhost:${port}`);
});

// comentario de separacion

const client = new Client({
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
  authStrategy: new LocalAuth()
});

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

if (!SPREADSHEET_ID) {
  console.error("No existe la variable SPREADSHEET_ID");
  throw new Error("No existe la variable SPREADSHEET_ID");
}

async function goToSheet() {
  try {
    const rawData = await accessGoogleSheet();
    const formattedData = await formatData(rawData);
    formattedData.forEach((data) => {
      sendWhatsappMessage(data.Number, data.Link);
    });
  } catch (error) {
    console.error("Error al obtener y formatear los datos:", error);
  }
}

async function accessGoogleSheet() {
  const sheets = google.sheets("v4");

  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const spreadsheetId = SPREADSHEET_ID;
  const range = "Numbers";

  const response = await sheets.spreadsheets.values.get({
    auth,
    spreadsheetId,
    range,
  });
  return response.data.values;
}

async function formatData(rawData) {
  await accessGoogleSheet();

  const header = rawData[0];
  const formattedData = rawData.slice(1).map((responseData) => {
    return Object.fromEntries(
      header.map((key, index) => [key, responseData[index]])
    );
  });
  return formattedData;
}

async function sendWhatsappMessage(number, link) {
  try {
    const chat = await client.getChatById(`${number}@c.us`);
    await chat.sendMessage(link);
    console.log(`Mensaje enviado a ${number}: ${link}`);
  } catch (error) {
    console.error(`Error al enviar mensaje a ${number}:`, error);
  }
}

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Cliente de WhatsApp listo");
  //goToSheet();
});

client.initialize();

