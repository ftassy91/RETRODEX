'use strict'

const mercariUs = require('../src/services/market/connectors/mercari-us')
const catawiki = require('../src/services/market/connectors/catawiki')
const yahooAuctionsJp = require('../src/services/market/connectors/yahoo-auctions-jp')

describe('market connector parsers', () => {
  // ─────────────────────────────────────────────────────────────────
  // Mercari US
  // ─────────────────────────────────────────────────────────────────
  test('parseMercariItemPage: parses sold item markdown', () => {
    const markdown = `
Title: Super Mario 64 Nintendo | Mercari

URL Source: http://www.mercari.com/us/item/m69121941965/

Markdown Content:
SOLD OUT

Item sold

### Super Mario 64

Used - Good | Nintendo

$30.00

**4** Likes

Posted

02/03/26

### Description

This video game provides the gamers with hours of fun. US VERSION.

### Delivery
`

    const parsed = mercariUs._internals.parseMercariItemPage(markdown)
    expect(parsed).not.toBeNull()
    expect(parsed.priceOriginal).toBe(30)
    expect(parsed.postedAt).toBe('2026-02-03T12:00:00.000Z')
    expect(parsed.title).toBe('Super Mario 64')
  })

  test('parseMercariItemPage: returns null for open (unsold) listing', () => {
    const markdown = `
# Super Mario 64

$45.00

Like New | Nintendo

Buy
`
    const parsed = mercariUs._internals.parseMercariItemPage(markdown)
    expect(parsed).toBeNull()
  })

  // ─────────────────────────────────────────────────────────────────
  // Catawiki
  // ─────────────────────────────────────────────────────────────────
  test('parseCatawikiLotPage: parses sold lot markdown', () => {
    const markdown = `
Title: Nintendo - N64 - Nintendo 64 avec Super Mario 64 - Video game console + games - auction online Catawiki

URL Source: http://www.catawiki.com/en/l/102714205

Markdown Content:
No.102714205

Sold

Final bid

 € 90

10 h ago

# Nintendo - N64 - Nintendo 64 avec Super Mario 64 - Video game console + games - auction online Catawiki

Selected by Toby Wickwire

Tested and works. The controller's joystick is good. Mario game included.

Show all info
`

    const parsed = catawiki._internals.parseCatawikiLotPage(markdown)
    expect(parsed).not.toBeNull()
    expect(parsed.title).toContain('Nintendo - N64')
    expect(parsed.priceOriginal).toBe(90)
    expect(parsed.soldAt).toBeTruthy()
  })

  test('parseCatawikiLotPage: returns null for open lot', () => {
    const markdown = `
# Nintendo 64 - Super Mario 64 - auction online Catawiki

Current bid

€ 55

8 days left
`
    const parsed = catawiki._internals.parseCatawikiLotPage(markdown)
    expect(parsed).toBeNull()
  })

  test('parseSearchPage: extracts lot IDs from Catawiki search markdown', () => {
    // Jina renders Catawiki search as image-links:
    // [![Image N](img_url) TITLE STATUS](https://www.catawiki.com/en/l/LOTID-slug?...)
    const markdown = `
[![Image 1](https://assets.catawiki.com/img/a.jpg) Nintendo 64 Super Mario 64 Sold](https://www.catawiki.com/en/l/102329858-nintendo-n64-super-mario-64?po=search&poq=super+mario+64)

[![Image 2](https://assets.catawiki.com/img/b.jpg) Nintendo N64 Super Mario 64 Current bid €55 8 days left](https://www.catawiki.com/en/l/102652630-nintendo-n64-super-mario-64?po=search)
`

    const results = catawiki._internals.parseSearchPage(markdown)
    // Lot 2 should be filtered (has "8 days left")
    expect(results.length).toBe(1)
    expect(results[0].lotId).toBe('102329858')
    expect(results[0].url).toBe('https://www.catawiki.com/en/l/102329858')
  })

  // ─────────────────────────────────────────────────────────────────
  // Yahoo Auctions JP
  // ─────────────────────────────────────────────────────────────────
  test('parseYahooClosedSearchPage: extracts lots from Jina image-link markdown', () => {
    // Jina renders Yahoo listing as: [![Image N: TITLE](img)](url) score% region
    const markdown = `
Title: Super Mario 64の落札相場・落札価格 - Yahoo!オークション

Markdown Content:
905 件

* [![Image 1: N64「スーパーマリオ64 振動パック対応バージョン」ソフトのみ](https://img.jpg)](https://auctions.yahoo.co.jp/jp/auction/u1220447400) 100% 北海道 から発送

* [![Image 2: 【箱付き】スーパーマリオ64 N64 ニンテンドー64](https://img2.jpg)](https://auctions.yahoo.co.jp/jp/auction/w1225087990) 99.3% ストア 石川県 から発送

* [![Image 3: paypayfleamarket item — skip](https://img3.jpg)](https://paypayfleamarket.yahoo.co.jp/item/z577520914) 99.4%
`

    const rows = yahooAuctionsJp._internals.parseYahooClosedSearchPage(markdown)
    // paypayfleamarket URL should NOT match (not an auction URL)
    expect(rows.length).toBe(2)
    expect(rows[0].auctionId).toBe('u1220447400')
    expect(rows[0].url).toBe('https://auctions.yahoo.co.jp/jp/auction/u1220447400')
    expect(rows[0].title).toBe('N64「スーパーマリオ64 振動パック対応バージョン」ソフトのみ')
    expect(rows[0].priceOriginal).toBeNull() // price comes from detail page
    expect(rows[1].auctionId).toBe('w1225087990')
  })

  test('parseYahooAuctionPage: parses ended lot with 即決 price', () => {
    // Observed real structure from Jina proxy on lot u1220447400
    const markdown = `
Title: N64「スーパーマリオ64 振動パック対応バージョン」- Yahoo!オークション

Markdown Content:
このオークションは終了しています

N64「スーパーマリオ64 振動パック対応バージョン」ソフトのみ

このオークションの落札者、出品者はログインしてください。

即決 444 円（税0円）

全国一律 185円（税込）

* 4月8日（水）23時25分 終了

| 開始時の価格 | 444 円（税0円） |
| 開始日時 | 2026年4月4日（土）23時8分 |
| 終了日時 | 2026年4月8日（水）23時25分 |
| 早期終了 | あり |

残り時間 終了
`

    const parsed = yahooAuctionsJp._internals.parseYahooAuctionPage(markdown)
    expect(parsed.title).toContain('スーパーマリオ64')
    expect(parsed.priceOriginal).toBe(444)
    expect(parsed.soldAt).toBe('2026-04-08T23:25:00.000Z')
  })

  test('parseYahooAuctionPage: returns null fields for non-ended lot', () => {
    const markdown = `
Title: N64 スーパーマリオ64 - Yahoo!オークション

Markdown Content:
N64 スーパーマリオ64

残り時間 2日

現在の価格 1,000 円
`

    const parsed = yahooAuctionsJp._internals.parseYahooAuctionPage(markdown)
    expect(parsed.soldAt).toBeNull()
    expect(parsed.priceOriginal).toBeNull()
  })
})
