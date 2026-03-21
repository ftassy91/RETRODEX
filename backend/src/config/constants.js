'use strict'
module.exports = {
  TRUST: {
    T1_MIN: 80,
    T2_MIN: 60,
    T3_MIN: 25,
    T4_MIN: 10
  },
  RARITY_ORDER: ['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON'],
  RARITY_RANGES: {
    LEGENDARY: { loose: [400, 900],  cib: [800, 2000],  mint: [1200, 3500] },
    EPIC:      { loose: [80,  300],  cib: [150,  600],  mint: [300,  1200] },
    RARE:      { loose: [25,   80],  cib: [45,   150],  mint: [80,    300] },
    UNCOMMON:  { loose: [8,    25],  cib: [15,    50],  mint: [25,    100] },
    COMMON:    { loose: [3,    12],  cib: [6,     20],  mint: [12,     40] }
  },
  PIPELINE: {
    BATCH_SIZE: 50,
    SUSPICIOUS_YEAR_MIN: 1970,
    SUSPICIOUS_YEAR_MAX: 2010,
    DEDUP_THRESHOLD: 0.85
  }
}
