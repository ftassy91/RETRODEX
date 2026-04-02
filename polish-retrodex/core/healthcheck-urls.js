"use strict";

const { fetchText } = require("./shared");

async function healthcheckUrl(url) {
  try {
    const result = await fetchText(url, { timeoutMs: 15000, method: "GET" });
    if (result.ok) {
      return {
        healthcheck_status: result.url !== url ? "redirected" : "ok",
        final_url: result.url,
        status_code: result.status,
      };
    }

    return {
      healthcheck_status: "broken",
      final_url: result.url || url,
      status_code: result.status,
    };
  } catch (error) {
    return {
      healthcheck_status: error.name === "AbortError" ? "timeout" : "broken",
      final_url: url,
      status_code: null,
      error: error.message,
    };
  }
}

module.exports = {
  healthcheckUrl,
};
