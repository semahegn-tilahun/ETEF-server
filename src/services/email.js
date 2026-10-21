import net from "node:net";
import tls from "node:tls";
import env from "../config/env.js";

function smtpConfig() {
  return {
    host: env.smtpHost,
    port: env.smtpPort,
    user: env.smtpUser,
    pass: env.smtpPass,
    from: env.mailFrom || env.smtpUser,
  };
}

function smtpCommand(socket, command, expected = /^2|^3/) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] || "";
      if (/^\d{3} /.test(last)) {
        socket.off("data", onData);
        const code = Number(last.slice(0, 3));
        if (!expected.test(String(code))) return reject(new Error(`SMTP ${code}: ${last}`));
        resolve(last);
      }
    };
    socket.on("data", onData);
    socket.once("error", reject);
    if (command !== null) socket.write(`${command}\r\n`);
  });
}

export async function sendPasswordResetEmail({ to, resetUrl }) {
  if (env.resendApiKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.mailFrom,
        to: [to],
        subject: "ETEF administrator password reset",
        text: `A password reset was requested for your ETEF administrator account.\n\nUse this link within 30 minutes:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      }),
    });
    if (!response.ok) throw new Error(`Email provider returned ${response.status}.`);
    return;
  }

  const { host, port, user, pass, from } = smtpConfig();
  if (!host || !user || !pass || port !== 465) {
    throw new Error("Password-reset email delivery is not configured. Configure RESEND_API_KEY or SMTP port 465.");
  }

  const socket = tls.connect({ host, port, servername: host });
  await new Promise((resolve, reject) => { socket.once("secureConnect", resolve); socket.once("error", reject); });
  await smtpCommand(socket, null, /^2/);
  await smtpCommand(socket, `EHLO etef.et`, /^2/);
  await smtpCommand(socket, `AUTH LOGIN`, /^3/);
  await smtpCommand(socket, Buffer.from(user).toString("base64"), /^3/);
  await smtpCommand(socket, Buffer.from(pass).toString("base64"), /^2/);
  await smtpCommand(socket, `MAIL FROM:<${from}>`, /^2/);
  await smtpCommand(socket, `RCPT TO:<${to}>`, /^2/);
  await smtpCommand(socket, "DATA", /^3/);
  const body = [
    `From: ${from}`,
    `To: ${to}`,
    "Subject: ETEF administrator password reset",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    "A password reset was requested for your ETEF administrator account.",
    "",
    "Use this link within 30 minutes:",
    resetUrl,
    "",
    "If you did not request this, you can ignore this email.",
    "",
    ".",
  ].join("\r\n");
  await smtpCommand(socket, body, /^2/);
  await smtpCommand(socket, "QUIT", /^2/).catch(() => {});
  socket.end();
}
