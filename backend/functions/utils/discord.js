"use strict";

const https = require("https");

/**
 * Sends a Discord embed notification via webhook.
 * @param {string} webhookUrl - Discord webhook URL
 * @param {object} embed - Discord embed object
 * @returns {Promise<void>}
 */
function sendDiscordNotification(webhookUrl, embed) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ embeds: [embed] });
    const url = new URL(webhookUrl);

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      res.resume();
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve();
      } else {
        reject(new Error(`Discord webhook returned status ${res.statusCode}`));
      }
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

module.exports = { sendDiscordNotification };
