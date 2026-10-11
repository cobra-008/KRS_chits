/**
 * Silver Fine Calculation Engine — K R S Silvers
 *
 * Core Rule:
 *   Raw Fine = Weight × (Tunch / 100)
 *   Rounding:
 *     fractional part ≤ 0.69  → round DOWN  (floor)
 *     fractional part ≥ 0.70  → round UP    (ceil)
 */

/**
 * Calculate fine silver with KRS rounding rule.
 * @param {number} weightG - gross weight in grams
 * @param {number} tunchPct - tunch/purity percentage (e.g. 91.5)
 * @returns {{ rawFine: number, pure: number }}
 */
export function calcFine(weightG, tunchPct) {
  if (!weightG || !tunchPct || isNaN(weightG) || isNaN(tunchPct)) {
    return { rawFine: 0, pure: 0 }
  }
  const raw = weightG * (tunchPct / 100)
  const integer = Math.floor(raw)
  const fraction = parseFloat((raw - integer).toFixed(10))
  const pure = fraction >= 0.70 ? integer + 1 : integer
  return { rawFine: raw, pure }
}

/**
 * Apply KRS rounding to any raw fine value.
 * @param {number} rawFine
 * @returns {number}
 */
export function krsRound(rawFine) {
  const integer = Math.floor(rawFine)
  const fraction = parseFloat((rawFine - integer).toFixed(10))
  return fraction >= 0.70 ? integer + 1 : integer
}

/**
 * Calculate chit draw settlement values.
 *
 * @param {object} params
 * @param {number} params.numMonths       - total months in scheme
 * @param {number} params.unitLimitG      - per-month unit limit in grams (1000 or 1500)
 * @param {number} params.numMembers      - enrolled member count
 * @param {number} params.discountG       - auction discount accepted by withdrawer (g)
 * @param {number} params.companyProfitPct - company profit % (default 4)
 * @param {number} params.oldDuesG        - previous balance to deduct (g)
 * @returns {object} full chit calculation breakdown
 */
export function calcChitDraw({
  numMonths,
  unitLimitG,
  numMembers,
  discountG = 0,
  companyProfitPct = 4,
  oldDuesG = 0,
}) {
  const totalCapacityG = numMonths * unitLimitG            // e.g. 20 × 1000 = 20000g
  const companyProfitG = (companyProfitPct / 100) * totalCapacityG  // 4% × 20000 = 800g
  const netDividendPoolG = Math.max(0, discountG - companyProfitG)  // discount - 800
  const dividendPerMemberG = numMembers > 0
    ? parseFloat((netDividendPoolG / numMembers).toFixed(3))
    : 0
  const monthlyPremiumG = parseFloat(
    (unitLimitG - dividendPerMemberG).toFixed(3)
  )
  const netSilverToIssueG = parseFloat(
    (totalCapacityG - discountG - monthlyPremiumG - oldDuesG).toFixed(3)
  )

  return {
    totalCapacityG,
    companyProfitG,
    netDividendPoolG,
    dividendPerMemberG,
    monthlyPremiumG,
    netSilverToIssueG,
    discountG,
    oldDuesG,
  }
}

/**
 * Sum all pure fine silver from a list of lots.
 * @param {Array} lots - array of { weight_g, tunch_pct }
 * @returns {{ totalWeight: number, totalPure: number }}
 */
export function sumLots(lots = []) {
  return lots.reduce(
    (acc, lot) => {
      const { pure } = calcFine(
        parseFloat(lot.weight_g) || 0,
        parseFloat(lot.tunch_pct) || 0
      )
      return {
        totalWeight: acc.totalWeight + (parseFloat(lot.weight_g) || 0),
        totalPure: acc.totalPure + pure,
      }
    },
    { totalWeight: 0, totalPure: 0 }
  )
}

/**
 * Format grams to a display string with kg conversion.
 * @param {number} grams
 * @returns {string}  e.g. "1,250 g (1.250 kg)"
 */
export function formatGrams(grams = 0) {
  const g = parseFloat(grams) || 0
  return `${g.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g`
}

export function gramsToKg(grams = 0) {
  return ((parseFloat(grams) || 0) / 1000).toFixed(3)
}

/**
 * Get total fine demanded for a group based on draw history.
 * Falls back to standard monthly_premium_g if a draw record exists,
 * else uses unitLimitG (no dividend for that month).
 *
 * @param {Array} draws - chit_draws for this group, sorted by month_no
 * @param {number} monthsHappened
 * @param {number} unitLimitG
 * @returns {number} total fine demanded so far in grams
 */
export function getTotalFineDemanded(draws = [], monthsHappened, unitLimitG) {
  let total = 0
  for (let m = 1; m <= monthsHappened; m++) {
    const draw = draws.find(d => d.month_no === m)
    if (draw) {
      total += parseFloat(draw.monthly_premium_g) || 0
    } else {
      total += parseFloat(unitLimitG) || 0
    }
  }
  return total
}
