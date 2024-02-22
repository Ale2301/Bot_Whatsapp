const { google } = require("googleapis");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
require("dotenv").config();
const credentialsPath = "keys.json";
process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;

//Express server
const express = require("express");
const app = express();
const port = 3080;
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile("public/index.html");
});
app.listen(port, () => {
  console.log(`Servidor listo en http://localhost:${port}`);
});

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

if (!SPREADSHEET_ID) {
  console.error("No existe la variable SPREADSHEET_ID");
  throw new Error("No existe la variable SPREADSHEET_ID");
}

const client = new Client({
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
  authStrategy: new LocalAuth(),
});

async function goToSheet() {
  try {
    const rawData = await accessGoogleSheet();
    const formattedData = await formatData(rawData);
    formattedData.forEach((data) => {
      sendWhatsappMessage(
        data.Number,
        data.Link,
        data.Username,
        data.Referencia,
        data.Verificado
      );
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

const pendingMessages = [];
async function sendWhatsappMessage(
  number,
  link,
  nombre,
  referente,
  estaVerificado
) {
  loopMessage: try {
    const chat = await client.getChatById(`${number}@c.us`);
    if (estaVerificado === "NO") {
      console.log("pusheando el numero " + number + "@c.us");
      pendingMessages.push([number + "@c.us", link, nombre, referente]);
      await chat.sendMessage(
        "Tu número no esta verificado, envía un mensaje para recibir tu documento (Soy un bot de prueba de " +
          referente +
          " no me reportes :3)"
      );
      break loopMessage;
    }
    const message = `Hola ${nombre} soy un bot de prueba de ${referente}, 
    por favor no me reportes, toma un link para comprobar que funciono :3    ${link}`;
    await chat.sendMessage(message);
    console.log(`Mensaje enviado a ${nombre} exitosamente`);
  } catch (error) {
    console.error(`Error al enviar mensaje a ${nombre}:`, error);
  }
}

client.on("message", async (msg) => {
  const number = msg.from;
  console.log(number);
  let index = pendingMessages.findIndex((item) => item[0] === number);
  if (index >= 0) {
    let [number, link, nombre, referente] = pendingMessages[index];
    const message = `Hola ${nombre} soy un bot de prueba de ${referente}, 
    por favor no me reportes, toma un link para comprobar que funciono :3   ${link}`;
    try {
      const chat = await client.getChatById(number);
      await chat.sendMessage(message);
      console.log(`Mensaje enviado a ${nombre} exitosamente`);
      pendingMessages.splice(index, 1);
      //Acá iría la lógica de escribir el número como verificado, dejar de hacerle check a ese número, etc
    } catch (e) {
      console.error("error al enviar el mensaje:", e);
    }
  }
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Cliente de WhatsApp listo");
  goToSheet();
});

client.initialize();
