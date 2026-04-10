'use strict'

/**
 * playwright-support.js — Headless browser fetching for blocked marketplaces
 *
 * Falls back to regular fetch if Playwright is not installed.
 * Usage: const { fetchWithBrowser } = require('./playwright-support')
 */

let chromium = null
try {
  chromium = require('playwright').chromium
} catch (_) {
  // Playwright not installed — fetchWithBrowser will throw
}

let browserInstance = null

async function getBrowser() {
  if (!chromium) {
    throw new Error('Playwright not installed. Run: npm install playwright && npx playwright install chromium')
  }
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  }
  return browserInstance
}

async function fetchWithBrowser(url, options = {}) {
  const browser = await getBrowser()
  const context = await browser.newContext({
    userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
  })

  const page = await context.newPage()
  const timeoutMs = Number(options.timeoutMs || 30000)

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs })

    // Wait for content to render (eBay uses dynamic loading)
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: 10000 }).catch(() => {})
    } else {
      await page.waitForTimeout(2000)
    }

    const html = await page.content()
    const text = await page.evaluate(() => document.body?.innerText || '')

    return {
      ok: true,
      status: 200,
      url: page.url(),
      html,
      text,
    }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      url,
      html: '',
      text: '',
      error: err.message,
    }
  } finally {
    await context.close()
  }
}

async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close()
    browserInstance = null
  }
}

module.exports = {
  fetchWithBrowser,
  closeBrowser,
  isAvailable: () => !!chromium,
}
