// Email IPC boundary: account storage and protocol checks do not belong in the app bootstrap.
function registerEmailIpc({ ipcMain, app, diagnostic }) {
  if (!ipcMain || !app || typeof diagnostic !== "function") {
    throw new TypeError("registerEmailIpc requires ipcMain, app, and diagnostic");
  }

  ipcMain.handle("email:credential:store", async (_event, provider, account, username, password) => {
    const normalizedProvider = String(provider || "").trim().toLowerCase();
    const normalizedAccount = String(account || "").trim();
    const normalizedUsername = String(username || "").trim();
    const secret = String(password || "");

    if (!["gmail", "yahoo", "hotmail", "custom"].includes(normalizedProvider)) {
      throw new Error("Unsupported email provider");
    }
    if (!normalizedAccount || normalizedAccount.length > 254 || /[\r\n\0]/.test(normalizedAccount)) {
      throw new Error("Invalid email account key");
    }
    if (!normalizedUsername || normalizedUsername.length > 254 || /[\r\n\0]/.test(normalizedUsername)) {
      throw new Error("Invalid email username");
    }
    if (!secret || secret.length > 4096) throw new Error("Password/app password is required");

    const stored = await require("../../addons/credentials").set(
      normalizedProvider, normalizedAccount, normalizedUsername, secret
    );
    diagnostic("INFO", "EMAIL CREDENTIAL", "Email credential saved to Windows Credential Manager", {
      provider: normalizedProvider
    });
    return {
      ok: Boolean(stored?.stored),
      provider: normalizedProvider,
      account: normalizedAccount,
      stored: Boolean(stored?.stored)
    };
  });

  ipcMain.handle("email:account:save", async (_event, record = {}) => {
    const store = require("../../addons/email-account-store");
    const saved = store.save(app.getPath("userData"), record);
    diagnostic("INFO", "EMAIL SERVER SETTINGS", "Email server settings saved", {
      provider: saved.provider,
      account: saved.account,
      protocol: record.protocol
    });
    return { ok: true, account: saved };
  });

  ipcMain.handle("email:account:get", (_event, provider, account) => ({
    ok: true,
    account: require("../../addons/email-account-store").get(app.getPath("userData"), provider, account)
  }));

  ipcMain.handle("email:connection:test", async (_event, record = {}) => {
    const store = require("../../addons/email-account-store");
    const email = require("../../addons/email");
    const credentials = require("../../addons/credentials");
    const client = require("../../addons/email-client");
    const provider = String(record.provider || "").trim().toLowerCase();
    const protocol = String(record.protocol || "").trim().toLowerCase();
    const account = String(record.account || "").trim();
    if (!account) throw new Error("Enter the email account key before testing the server");

    const profile = store.get(app.getPath("userData"), provider, account);
    const savedServer = profile?.servers?.[protocol] || {};
    const defaults = email.provider(provider)[protocol] || {};
    const validated = store.validateRecord({
      provider,
      account,
      protocol,
      host: record.host || savedServer.host || defaults.host,
      port: record.port || savedServer.port || defaults.port,
      tls: record.tls === undefined
        ? (savedServer.tls === undefined ? defaults.tls : savedServer.tls)
        : record.tls,
      startTls: record.startTls === undefined
        ? (savedServer.startTls === undefined ? defaults.startTls : savedServer.startTls)
        : record.startTls
    });
    const saved = await credentials.get(provider, account);
    if (
      !saved ||
      !String(saved.username || "").trim() ||
      (!String(saved.password || "") && !String(saved.accessToken || ""))
    ) {
      throw new Error("Save the account credentials before testing protocol authentication");
    }

    const config = {
      ...defaults, ...savedServer, ...validated,
      username: saved.username,
      password: saved.password,
      accessToken: saved.accessToken
    };
    if (protocol === "imap") await client.imapLogin(config);
    else if (protocol === "pop3") await client.pop3ListMessages(config);
    else await client.smtpVerify(config);

    const transport = validated.startTls
      ? "SMTP STARTTLS authenticated"
      : validated.tls
        ? "TLS and protocol authentication succeeded"
        : "Protocol authentication succeeded";
    diagnostic("INFO", "EMAIL CONNECTION TEST", "Email protocol authentication succeeded", {
      provider, protocol, host: validated.host, port: validated.port,
      authenticated: true, transport
    });
    return {
      ok: true, connected: true, authenticated: true,
      provider, protocol, host: validated.host, port: validated.port, transport
    };
  });
}

module.exports = { registerEmailIpc };
