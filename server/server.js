// server/server.js
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Helpers pour __dirname avec ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sécurité et parsing
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

// ✅ Servir les fichiers statiques (HTML, CSS, JS, images)
app.use(express.static(path.join(__dirname, "../web")));

// CORS: autorise le front en dev
app.use(
  cors({
    origin: process.env.ALLOW_ORIGIN ? process.env.ALLOW_ORIGIN.split(",") : true,
    methods: ["POST", "OPTIONS"],
  })
);

// Anti-abus simple
const limiter = rateLimit({ windowMs: 60_000, max: 30 });
app.use("/api/", limiter);

// Transport SMTP (Gmail/App password, Mailtrap, etc.)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true", // true si 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Helpers
const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Number(n)) + " CFA";

function buildItemsTable(items = []) {
  if (!items.length) return "<p><em>Aucun article</em></p>";
  const rows = items
    .map(
      (it) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${it.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${it.qty}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${fmt(it.unitPrice)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${fmt(it.lineTotal)}</td>
    </tr>`
    )
    .join("");
  return `
  <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:14px">
    <thead>
      <tr style="background:#f6f6f6">
        <th style="padding:10px 12px;text-align:left">Article</th>
        <th style="padding:10px 12px;text-align:center">Qté</th>
        <th style="padding:10px 12px;text-align:right">PU</th>
        <th style="padding:10px 12px;text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function htmlEmailCEO(payload) {
  const { customer, items, total, note } = payload;
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#222">
    <h2 style="margin:0 0 12px 0">🛒 Nouvelle commande</h2>
    <p><strong>Client:</strong> ${customer.name}<br/>
       <strong>Email:</strong> ${customer.email}<br/>
       <strong>Téléphone:</strong> ${customer.phone || "-"}<br/>
       <strong>Adresse:</strong> ${customer.address}</p>
    ${note ? `<p><strong>Note:</strong> ${note}</p>` : ""}
    <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
    ${buildItemsTable(items)}
    <p style="text-align:right;font-size:16px;margin-top:12px"><strong>Total:</strong> ${fmt(total)}</p>
  </div>`;
}

function htmlEmailClient(payload) {
  const { customer, items, total } = payload;
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#222">
    <h2 style="margin:0 0 12px 0">Merci ${customer.name} !</h2>
    <p>Votre commande a bien été envoyée. Notre équipe vous contactera pour la livraison.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
    ${buildItemsTable(items)}
    <p style="text-align:right;font-size:16px;margin-top:12px"><strong>Total:</strong> ${fmt(total)}</p>
    <p style="font-size:12px;color:#555">Youm's Interior · Service Clients</p>
  </div>`;
}

// Validation simple
function validatePayload(body) {
  const errors = [];
  if (!body || typeof body !== "object") errors.push("Payload invalide");
  const { customer, items, total } = body || {};
  if (!customer || !customer.name || !customer.email || !customer.address) {
    errors.push("Champs client requis: name, email, address");
  }
  if (!Array.isArray(items) || !items.length) errors.push("Items manquants");
  if (typeof total !== "number" || total <= 0) errors.push("Total invalide");
  return errors;
}

// Endpoint principal
app.post("/api/checkout", async (req, res) => {
  try {
    const errors = validatePayload(req.body);
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const payload = req.body;

    // Envoi au CEO
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: process.env.CEO_EMAIL,
      subject: `Nouvelle commande — ${payload.customer.name}`,
      html: htmlEmailCEO(payload),
    });

    // Confirmation au client
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: payload.customer.email,
      subject: "Confirmation de votre commande",
      html: htmlEmailClient(payload),
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("/api/checkout error:", err);
    res.status(500).json({ ok: false, error: "Erreur d'envoi email" });
  }
});

// Health check
app.get("/health", (req, res) => res.json({ ok: true }));

// formulaire de contact
app.post("/api/contact", async (req, res) => {
  try {
    const { customer, note } = req.body;

    // Validation des champs
    if (!customer || !customer.name || !customer.email || !customer.phone || !note) {
      return res.status(400).json({ ok: false, error: "Tous les champs doivent être remplis" });
    }

    // Créer l'email pour le CEO
    const emailPayload = {
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: process.env.CEO_EMAIL,
      subject: `Nouveau message de ${customer.name}`,
      html: `
        <div>
          <h3>Message reçu via le formulaire de contact</h3>
          <p><strong>Nom :</strong> ${customer.name}</p>
          <p><strong>Email :</strong> ${customer.email}</p>
          <p><strong>Téléphone :</strong> ${customer.phone}</p>
          <p><strong>Message :</strong><br/>${note}</p>
        </div>
      `,
    };

    // Envoi de l'email au CEO
    await transporter.sendMail(emailPayload);

    // Répondre au client
    res.json({ ok: true });
  } catch (err) {
    console.error("Erreur lors de l'envoi de l'email", err);
    res.status(500).json({ ok: false, error: "Erreur d'envoi email" });
  }
});

// Servir le dossier data pour le JSON
app.use("/data", express.static(path.join(__dirname, "data")));


// Démarrage du serveur
app.listen(PORT, () => console.log(`Checkout server running on http://localhost:${PORT}`));
