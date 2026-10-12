// ============================================================
// K R S SILVERS — Professional Voucher & PDF Generator Engine
// Produces formal publication-grade Receipts, Issues, Chit Settlements & Ledgers
// Supports direct .pdf file downloads and standalone A4 printable documents
// ============================================================

import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

/**
 * Sanitize strings for filenames
 */
function sanitizeFilename(str = '') {
  return String(str).trim().replace(/[^a-zA-Z0-9_-]/g, '_')
}

/**
 * Format numbers with Indian comma grouping
 */
function fmtGrams(val) {
  const num = parseFloat(val) || 0
  return num.toLocaleString('en-IN', { maximumFractionDigits: 3 })
}

function fmtKg(val) {
  const num = parseFloat(val) || 0
  return (num / 1000).toFixed(3)
}

/**
 * Common Corporate Header HTML
 */
function getHeaderHtml(docTitle, docSubtitle = '') {
  return `
    <div style="border-bottom: 2px solid #B3861B; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
      <div>
        <div style="font-size: 24px; font-weight: 900; letter-spacing: 2px; color: #B3861B; font-family: 'Playfair Display', Georgia, serif;">
          K R S &nbsp;S I L V E R S
        </div>
        <div style="font-size: 11px; font-weight: 700; color: #475569; letter-spacing: 1px; text-transform: uppercase; margin-top: 3px;">
          BULLION REFINERS &bull; FINE SILVER TRADERS &bull; CHIT SCHEMES
        </div>
        <div style="font-size: 10px; color: #64748B; margin-top: 2px;">
          Salem, Tamil Nadu, India &nbsp;|&nbsp; GST Registered Bullion House
        </div>
      </div>
      <div style="text-align: right;">
        <div style="display: inline-block; background: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 6px; padding: 6px 14px; text-align: right;">
          <div style="font-size: 12px; font-weight: 800; color: #0F172A; text-transform: uppercase; letter-spacing: 0.5px;">
            ${docTitle}
          </div>
          ${docSubtitle ? `<div style="font-size: 10px; color: #64748B; margin-top: 2px;">${docSubtitle}</div>` : ''}
        </div>
      </div>
    </div>
  `
}

/**
 * Common Signatures & Footer HTML
 */
function getSignaturesHtml(leftLabel = 'Customer / Member Signature', rightLabel = 'For K R S SILVERS (Authorized Signatory)') {
  return `
    <div style="margin-top: 32px; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 16px;">
      <div style="text-align: center; width: 220px;">
        <div style="border-bottom: 1px solid #94A3B8; height: 36px; margin-bottom: 6px;"></div>
        <div style="font-size: 10.5px; font-weight: 700; color: #334155;">${leftLabel}</div>
      </div>
      <div style="text-align: center; width: 240px;">
        <div style="border-bottom: 1px solid #94A3B8; height: 36px; margin-bottom: 6px;"></div>
        <div style="font-size: 10.5px; font-weight: 700; color: #334155;">${rightLabel}</div>
      </div>
    </div>
    <div style="margin-top: 22px; padding-top: 8px; border-top: 1px dashed #CBD5E1; font-size: 9px; color: #94A3B8; text-align: center;">
      Official Computer Generated Document &bull; K R S Silvers Accounting Ledger System &bull; Salem, Tamil Nadu
    </div>
  `
}

/**
 * Render container to canvas and download PDF via jsPDF
 */
async function exportHtmlToPdf(htmlContent, filename) {
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = '794px' // A4 width at 96 DPI
  container.style.padding = '32px 36px'
  container.style.background = '#FFFFFF'
  container.style.color = '#0F172A'
  container.style.boxSizing = 'border-box'
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  container.innerHTML = htmlContent
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#FFFFFF',
    })

    const imgData = canvas.toDataURL('image/jpeg', 0.98)
    const pdf = new jsPDF('p', 'mm', 'a4')
    const imgWidth = 210 // mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, 297))
    pdf.save(filename)
  } finally {
    document.body.removeChild(container)
  }
}

/**
 * Open print window for immediate official print
 */
function openPrintWindow(htmlContent, title) {
  const win = window.open('', '_blank', 'width=860,height=960')
  if (!win) {
    window.print()
    return
  }

  win.document.open()
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 24px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background: #FFFFFF;
          color: #0F172A;
          font-size: 12px;
          line-height: 1.45;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        table { border-collapse: collapse; width: 100%; }
      </style>
    </head>
    <body>
      ${htmlContent}
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 250);
        };
      <\/script>
    </body>
    </html>
  `)
  win.document.close()
}

// ============================================================
// 1. CHIT DRAW & SETTLEMENT VOUCHER
// Filename: Chit-[SchemeName]-M[MonthNo]-[Date].pdf
// ============================================================
export function buildChitSettlementHtml(params) {
  const {
    schemeName = 'KRS Silver Scheme',
    roundNo = 1,
    totalRounds = 20,
    drawDate = '',
    customerName = '',
    ticketNo = 1,
    sharePct = 100,
    grossCapacityG = 20000,
    discountG = 0,
    companyProfitG = 800,
    dividendPerMemberG = 410,
    monthlyPremiumG = 590,
    oldDuesG = 0,
    netDisburseG = 10410,
    deliveryStatus = 'Held as Customer Excess Fine',
  } = params

  const dateStr = drawDate || new Date().toISOString().slice(0, 10)
  const netPoolG = Math.max(0, discountG - companyProfitG)

  return `
    <div style="border: 2px solid #B3861B; border-radius: 8px; padding: 24px; background: #FFFFFF;">
      ${getHeaderHtml('Chit Settlement Voucher', `Month ${roundNo} of ${totalRounds}`)}

      <!-- Scheme & Withdrawer Info -->
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px 16px; margin-bottom: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11.5px;">
        <div>
          <span style="color: #64748B; font-weight: 600;">Scheme Name:</span>
          <span style="font-weight: 800; color: #0F172A; margin-left: 6px;">${schemeName}</span>
        </div>
        <div>
          <span style="color: #64748B; font-weight: 600;">Settlement Date:</span>
          <span style="font-weight: 700; color: #0F172A; margin-left: 6px;">${dateStr}</span>
        </div>
        <div>
          <span style="color: #64748B; font-weight: 600;">Withdrawing Member:</span>
          <span style="font-weight: 800; color: #B3861B; margin-left: 6px;">${customerName || 'Member'}</span>
        </div>
        <div>
          <span style="color: #64748B; font-weight: 600;">Ticket & Share:</span>
          <span style="font-weight: 700; color: #0F172A; margin-left: 6px;">Ticket #${ticketNo} &bull; ${sharePct}% Share (${(sharePct/100).toFixed(1)}x)</span>
        </div>
      </div>

      <!-- Audit Breakdown Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11.5px;">
        <thead>
          <tr style="background: #F1F5F9; border-top: 1.5px solid #CBD5E1; border-bottom: 1.5px solid #CBD5E1;">
            <th style="padding: 8px 10px; text-align: center; width: 38px; color: #475569; font-weight: 700;">#</th>
            <th style="padding: 8px 10px; text-align: left; color: #475569; font-weight: 700;">Audit Breakdown Particulars</th>
            <th style="padding: 8px 10px; text-align: left; color: #475569; font-weight: 700;">Calculation Basis</th>
            <th style="padding: 8px 12px; text-align: right; color: #475569; font-weight: 700; width: 130px;">Amount (g)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 8px 10px; text-align: center; color: #64748B;">1</td>
            <td style="padding: 8px 10px; font-weight: 700; color: #0F172A;">Gross Chit Scheme Capacity</td>
            <td style="padding: 8px 10px; color: #64748B;">Total capacity based on member share</td>
            <td style="padding: 8px 12px; text-align: right; font-weight: 800; font-family: monospace;">${fmtGrams(grossCapacityG)} g</td>
          </tr>
          <tr style="border-bottom: 1px solid #E2E8F0; background: #FFFBFB;">
            <td style="padding: 8px 10px; text-align: center; color: #64748B;">2</td>
            <td style="padding: 8px 10px; font-weight: 600; color: #991B1B;">Accepted Auction Discount</td>
            <td style="padding: 8px 10px; color: #64748B;">Bid discount surrendered by withdrawer</td>
            <td style="padding: 8px 12px; text-align: right; font-weight: 800; color: #DC2626; font-family: monospace;">- ${fmtGrams(discountG)} g</td>
          </tr>
          <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 8px 10px; text-align: center; color: #64748B;">3</td>
            <td style="padding: 8px 10px; font-weight: 600; color: #0F172A;">Company Profit (4%)</td>
            <td style="padding: 8px 10px; color: #64748B;">4% of gross capacity deducted</td>
            <td style="padding: 8px 12px; text-align: right; font-weight: 700; color: #B3861B; font-family: monospace;">${fmtGrams(companyProfitG)} g</td>
          </tr>
          <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 8px 10px; text-align: center; color: #64748B;">4</td>
            <td style="padding: 8px 10px; font-weight: 600; color: #0F172A;">Net Dividend Pool</td>
            <td style="padding: 8px 10px; color: #64748B;">Discount minus 4% company profit</td>
            <td style="padding: 8px 12px; text-align: right; font-weight: 700; font-family: monospace;">${fmtGrams(netPoolG)} g</td>
          </tr>
          <tr style="border-bottom: 1px solid #E2E8F0; background: #F0FDF4;">
            <td style="padding: 8px 10px; text-align: center; color: #64748B;">5</td>
            <td style="padding: 8px 10px; font-weight: 700; color: #166534;">Dividend per Member</td>
            <td style="padding: 8px 10px; color: #64748B;">Pool divided equally across ${totalRounds} rounds</td>
            <td style="padding: 8px 12px; text-align: right; font-weight: 800; color: #15803D; font-family: monospace;">${fmtGrams(dividendPerMemberG)} g</td>
          </tr>
          <tr style="border-bottom: 1px solid #E2E8F0; background: #FFFBFB;">
            <td style="padding: 8px 10px; text-align: center; color: #64748B;">6</td>
            <td style="padding: 8px 10px; font-weight: 600; color: #991B1B;">Withdrawer's Month Premium</td>
            <td style="padding: 8px 10px; color: #64748B;">Month installment minus member dividend</td>
            <td style="padding: 8px 12px; text-align: right; font-weight: 800; color: #DC2626; font-family: monospace;">- ${fmtGrams(monthlyPremiumG)} g</td>
          </tr>
          ${parseFloat(oldDuesG) > 0 ? `
            <tr style="border-bottom: 1px solid #E2E8F0; background: #FFFBFB;">
              <td style="padding: 8px 10px; text-align: center; color: #64748B;">7</td>
              <td style="padding: 8px 10px; font-weight: 600; color: #991B1B;">Old Dues Deducted</td>
              <td style="padding: 8px 10px; color: #64748B;">Previous outstanding recovered from payout</td>
              <td style="padding: 8px 12px; text-align: right; font-weight: 800; color: #DC2626; font-family: monospace;">- ${fmtGrams(oldDuesG)} g</td>
            </tr>
          ` : ''}
        </tbody>
      </table>

      <!-- Prominent Disbursed Card -->
      <div style="background: #FEF9C3; border: 2px solid #CA8A04; border-radius: 8px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <div>
          <div style="font-size: 11px; font-weight: 800; color: #854D0E; text-transform: uppercase; letter-spacing: 0.5px;">
            NET SILVER FINE TO DISBURSE / CREDIT:
          </div>
          <div style="font-size: 10px; color: #713F12; margin-top: 2px;">
            Formula: Gross Capacity &minus; Discount &minus; Month Premium &minus; Old Dues
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 24px; font-weight: 900; color: #854D0E; font-family: monospace; line-height: 1;">
            ${fmtGrams(netDisburseG)} g
          </div>
          <div style="font-size: 11px; font-weight: 700; color: #A16207; margin-top: 3px;">
            (${fmtKg(netDisburseG)} KG Pure Silver 999.0)
          </div>
        </div>
      </div>

      <!-- Account Credit Confirmation Notice -->
      <div style="background: #F0FDF4; border: 1px solid #86EFAC; border-radius: 6px; padding: 10px 14px; font-size: 11px; color: #166534; display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
        <span style="font-weight: 900; font-size: 14px;">&check;</span>
        <div>
          <strong>Account Credit Notice:</strong> This net silver fine has been credited directly to the member's account ledger as <strong>Customer Excess Fine</strong>. When physical silver is later handed over, an Issue Voucher will record the disbursement.
        </div>
      </div>

      ${getSignaturesHtml('Withdrawing Member Signature', 'For K R S SILVERS (Authorized Signatory)')}
    </div>
  `
}

export function downloadChitSettlementPdf(params) {
  const scheme = sanitizeFilename(params.schemeName || 'Scheme')
  const round = params.roundNo || 1
  const date = sanitizeFilename(params.drawDate || new Date().toISOString().slice(0, 10))
  const filename = `Chit-${scheme}-M${round}-${date}.pdf`
  const html = buildChitSettlementHtml(params)
  return exportHtmlToPdf(html, filename)
}

export function printChitSettlementVoucher(params) {
  const title = `Chit Settlement - ${params.schemeName} - Month ${params.roundNo}`
  const html = buildChitSettlementHtml(params)
  openPrintWindow(html, title)
}

// ============================================================
// 2. FINE SILVER RECEIPT VOUCHER (RV)
// Filename: RV-[VoucherNo]-[CustomerName]-[Date].pdf
// ============================================================
export function buildReceiptVoucherHtml(params) {
  const {
    voucherNo = 1,
    voucherDate = '',
    customer = {},
    lots = [],
    totalGrossG = 0,
    totalPureG = 0,
  } = params

  const dateStr = voucherDate || new Date().toISOString().slice(0, 10)
  const vNoStr = `RV-${String(voucherNo).padStart(4, '0')}`

  return `
    <div style="border: 2px solid #167245; border-radius: 8px; padding: 24px; background: #FFFFFF;">
      ${getHeaderHtml('Silver Receipt Voucher', vNoStr)}

      <!-- Voucher Metadata -->
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px 16px; margin-bottom: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11.5px;">
        <div>
          <span style="color: #64748B; font-weight: 600;">Voucher No:</span>
          <span style="font-weight: 800; color: #167245; margin-left: 6px; font-family: monospace;">${vNoStr}</span>
        </div>
        <div>
          <span style="color: #64748B; font-weight: 600;">Date of Receipt:</span>
          <span style="font-weight: 700; color: #0F172A; margin-left: 6px;">${dateStr}</span>
        </div>
        <div>
          <span style="color: #64748B; font-weight: 600;">Customer / Depositor:</span>
          <span style="font-weight: 800; color: #0F172A; margin-left: 6px;">${customer.name || 'Customer'}</span>
        </div>
        <div>
          <span style="color: #64748B; font-weight: 600;">Contact & City:</span>
          <span style="font-weight: 600; color: #475569; margin-left: 6px;">${customer.phone || '—'} &bull; ${customer.city || 'Salem'}</span>
        </div>
      </div>

      <!-- Lots Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11.5px;">
        <thead>
          <tr style="background: #F1F5F9; border-top: 1.5px solid #CBD5E1; border-bottom: 1.5px solid #CBD5E1;">
            <th style="padding: 8px 10px; text-align: center; width: 38px; color: #475569; font-weight: 700;">#</th>
            <th style="padding: 8px 10px; text-align: left; color: #475569; font-weight: 700;">Silver Type</th>
            <th style="padding: 8px 10px; text-align: left; color: #475569; font-weight: 700;">Bar / Patla No.</th>
            <th style="padding: 8px 12px; text-align: right; color: #475569; font-weight: 700;">Gross Wt (g)</th>
            <th style="padding: 8px 12px; text-align: right; color: #475569; font-weight: 700;">Tunch (%)</th>
            <th style="padding: 8px 12px; text-align: right; color: #475569; font-weight: 700; width: 130px;">Pure Silver (g)</th>
          </tr>
        </thead>
        <tbody>
          ${lots.map((lot, idx) => {
            const typeLabel = lot.silver_type === 'B' ? 'Bar (B)' : lot.silver_type === 'P' ? 'Patla (P)' : 'Kacha (K)'
            return `
              <tr style="border-bottom: 1px solid #E2E8F0; ${idx % 2 === 1 ? 'background: #F8FAFC;' : ''}">
                <td style="padding: 8px 10px; text-align: center; color: #64748B;">${idx + 1}</td>
                <td style="padding: 8px 10px; font-weight: 700; color: #0F172A;">${typeLabel}</td>
                <td style="padding: 8px 10px; font-family: monospace; font-weight: 700; color: #B3861B;">${lot.patla_no || '—'}</td>
                <td style="padding: 8px 12px; text-align: right; font-family: monospace; color: #0F172A;">${fmtGrams(lot.weight_g)} g</td>
                <td style="padding: 8px 12px; text-align: right; font-family: monospace; color: #0284C7; font-weight: 700;">${parseFloat(lot.tunch_pct).toFixed(2)}%</td>
                <td style="padding: 8px 12px; text-align: right; font-family: monospace; font-weight: 800; color: #167245;">${fmtGrams(lot.pure_g)} g</td>
              </tr>
            `
          }).join('')}
        </tbody>
      </table>

      <!-- Totals Summary Card -->
      <div style="background: #F0FDF4; border: 2px solid #16A34A; border-radius: 8px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <div>
          <div style="font-size: 11px; font-weight: 800; color: #166534; text-transform: uppercase;">
            TOTAL RECEIVED FINE SILVER (999.0):
          </div>
          <div style="font-size: 10px; color: #15803D; margin-top: 2px;">
            Total Gross Silver Received: ${fmtGrams(totalGrossG)} g (${fmtKg(totalGrossG)} KG)
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 24px; font-weight: 900; color: #15803D; font-family: monospace; line-height: 1;">
            + ${fmtGrams(totalPureG)} g
          </div>
          <div style="font-size: 11px; font-weight: 700; color: #166534; margin-top: 3px;">
            (${fmtKg(totalPureG)} KG Pure Silver)
          </div>
        </div>
      </div>

      <!-- Account Posting Note -->
      <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px 14px; font-size: 10.5px; color: #475569; margin-bottom: 12px;">
        &bull; <strong>Account Credit:</strong> Fine silver has been credited to the customer account ledger and added to vault stock.
      </div>

      ${getSignaturesHtml('Depositor Signature', 'For K R S SILVERS (Authorized Signatory)')}
    </div>
  `
}

export function downloadReceiptVoucherPdf(params) {
  const vNo = sanitizeFilename(`RV-${String(params.voucherNo || 1).padStart(4, '0')}`)
  const cust = sanitizeFilename(params.customer?.name || 'Customer')
  const date = sanitizeFilename(params.voucherDate || new Date().toISOString().slice(0, 10))
  const filename = `${vNo}-${cust}-${date}.pdf`
  const html = buildReceiptVoucherHtml(params)
  return exportHtmlToPdf(html, filename)
}

export function printReceiptVoucher(params) {
  const title = `Receipt Voucher RV-${String(params.voucherNo || 1).padStart(4, '0')}`
  const html = buildReceiptVoucherHtml(params)
  openPrintWindow(html, title)
}

// ============================================================
// 3. FINE SILVER ISSUE VOUCHER (IV)
// Filename: IV-[VoucherNo]-[CustomerName]-[Date].pdf
// ============================================================
export function buildIssueVoucherHtml(params) {
  const {
    voucherNo = 1,
    voucherDate = '',
    customer = {},
    lots = [],
    totalGrossG = 0,
    totalPureG = 0,
  } = params

  const dateStr = voucherDate || new Date().toISOString().slice(0, 10)
  const vNoStr = `IV-${String(voucherNo).padStart(4, '0')}`

  return `
    <div style="border: 2px solid #8B1A1A; border-radius: 8px; padding: 24px; background: #FFFFFF;">
      ${getHeaderHtml('Silver Issue Voucher', vNoStr)}

      <!-- Voucher Metadata -->
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px 16px; margin-bottom: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11.5px;">
        <div>
          <span style="color: #64748B; font-weight: 600;">Voucher No:</span>
          <span style="font-weight: 800; color: #8B1A1A; margin-left: 6px; font-family: monospace;">${vNoStr}</span>
        </div>
        <div>
          <span style="color: #64748B; font-weight: 600;">Date of Issue:</span>
          <span style="font-weight: 700; color: #0F172A; margin-left: 6px;">${dateStr}</span>
        </div>
        <div>
          <span style="color: #64748B; font-weight: 600;">Recipient Customer:</span>
          <span style="font-weight: 800; color: #0F172A; margin-left: 6px;">${customer.name || 'Customer'}</span>
        </div>
        <div>
          <span style="color: #64748B; font-weight: 600;">Contact & City:</span>
          <span style="font-weight: 600; color: #475569; margin-left: 6px;">${customer.phone || '—'} &bull; ${customer.city || 'Salem'}</span>
        </div>
      </div>

      <!-- Disbursed Lots Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11.5px;">
        <thead>
          <tr style="background: #F1F5F9; border-top: 1.5px solid #CBD5E1; border-bottom: 1.5px solid #CBD5E1;">
            <th style="padding: 8px 10px; text-align: center; width: 38px; color: #475569; font-weight: 700;">#</th>
            <th style="padding: 8px 10px; text-align: left; color: #475569; font-weight: 700;">Silver Type</th>
            <th style="padding: 8px 10px; text-align: left; color: #475569; font-weight: 700;">Bar / Patla No.</th>
            <th style="padding: 8px 12px; text-align: right; color: #475569; font-weight: 700;">Gross Wt (g)</th>
            <th style="padding: 8px 12px; text-align: right; color: #475569; font-weight: 700;">Tunch (%)</th>
            <th style="padding: 8px 12px; text-align: right; color: #475569; font-weight: 700; width: 130px;">Pure Silver (g)</th>
          </tr>
        </thead>
        <tbody>
          ${lots.map((lot, idx) => {
            const typeLabel = lot.silver_type === 'B' ? 'Bar (B)' : lot.silver_type === 'P' ? 'Patla (P)' : 'Kacha (K)'
            return `
              <tr style="border-bottom: 1px solid #E2E8F0; ${idx % 2 === 1 ? 'background: #F8FAFC;' : ''}">
                <td style="padding: 8px 10px; text-align: center; color: #64748B;">${idx + 1}</td>
                <td style="padding: 8px 10px; font-weight: 700; color: #0F172A;">${typeLabel}</td>
                <td style="padding: 8px 10px; font-family: monospace; font-weight: 700; color: #B3861B;">${lot.patla_no || '—'}</td>
                <td style="padding: 8px 12px; text-align: right; font-family: monospace; color: #0F172A;">${fmtGrams(lot.weight_g)} g</td>
                <td style="padding: 8px 12px; text-align: right; font-family: monospace; color: #0284C7; font-weight: 700;">${parseFloat(lot.tunch_pct).toFixed(2)}%</td>
                <td style="padding: 8px 12px; text-align: right; font-family: monospace; font-weight: 800; color: #991B1B;">${fmtGrams(lot.pure_g)} g</td>
              </tr>
            `
          }).join('')}
        </tbody>
      </table>

      <!-- Totals Summary Card -->
      <div style="background: #FEF2F2; border: 2px solid #DC2626; border-radius: 8px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <div>
          <div style="font-size: 11px; font-weight: 800; color: #991B1B; text-transform: uppercase;">
            TOTAL FINE SILVER DISBURSED:
          </div>
          <div style="font-size: 10px; color: #B91C1C; margin-top: 2px;">
            Total Gross Silver Disbursed: ${fmtGrams(totalGrossG)} g (${fmtKg(totalGrossG)} KG)
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 24px; font-weight: 900; color: #991B1B; font-family: monospace; line-height: 1;">
            - ${fmtGrams(totalPureG)} g
          </div>
          <div style="font-size: 11px; font-weight: 700; color: #B91C1C; margin-top: 3px;">
            (${fmtKg(totalPureG)} KG Pure Silver)
          </div>
        </div>
      </div>

      <!-- Account Debit Note -->
      <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px 14px; font-size: 10.5px; color: #475569; margin-bottom: 12px;">
        &bull; <strong>Account Debit:</strong> Fine silver has been physically delivered from vault inventory and debited against the customer account ledger.
      </div>

      ${getSignaturesHtml('Receiver Signature', 'For K R S SILVERS (Authorized Signatory)')}
    </div>
  `
}

export function downloadIssueVoucherPdf(params) {
  const vNo = sanitizeFilename(`IV-${String(params.voucherNo || 1).padStart(4, '0')}`)
  const cust = sanitizeFilename(params.customer?.name || 'Customer')
  const date = sanitizeFilename(params.voucherDate || new Date().toISOString().slice(0, 10))
  const filename = `${vNo}-${cust}-${date}.pdf`
  const html = buildIssueVoucherHtml(params)
  return exportHtmlToPdf(html, filename)
}

export function printIssueVoucher(params) {
  const title = `Issue Voucher IV-${String(params.voucherNo || 1).padStart(4, '0')}`
  const html = buildIssueVoucherHtml(params)
  openPrintWindow(html, title)
}

// ============================================================
// 4. CUSTOMER ACCOUNT STATEMENT & LEDGER
// Filename: Ledger-[CustomerName]-[Date].pdf
// ============================================================
export function buildCustomerLedgerHtml(params) {
  const {
    customer = {},
    memberships = [],
    ledgerRows = [],
    totalDebits = 0,
    totalCredits = 0,
    finalBalance = 0,
  } = params

  const dateStr = new Date().toISOString().slice(0, 10)
  const isDue = finalBalance > 0
  const isExcess = finalBalance < 0

  return `
    <div style="border: 2px solid #CBD5E1; border-radius: 8px; padding: 24px; background: #FFFFFF;">
      ${getHeaderHtml('Customer Account Statement', 'Silver Fine Ledger')}

      <!-- Customer Summary -->
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px 16px; margin-bottom: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11.5px;">
        <div>
          <span style="color: #64748B; font-weight: 600;">Customer Name:</span>
          <span style="font-weight: 800; color: #0F172A; margin-left: 6px;">${customer.name || 'Customer'}</span>
        </div>
        <div>
          <span style="color: #64748B; font-weight: 600;">Statement Date:</span>
          <span style="font-weight: 700; color: #0F172A; margin-left: 6px;">${dateStr}</span>
        </div>
        <div>
          <span style="color: #64748B; font-weight: 600;">Phone & City:</span>
          <span style="font-weight: 600; color: #475569; margin-left: 6px;">${customer.phone || '—'} &bull; ${customer.city || 'Salem'}</span>
        </div>
        <div>
          <span style="color: #64748B; font-weight: 600;">Enrolled Schemes:</span>
          <span style="font-weight: 600; color: #B3861B; margin-left: 6px;">${memberships.map(m => `${m.groups?.name || 'Scheme'} (#${m.ticket_no})`).join(', ') || 'None'}</span>
        </div>
      </div>

      <!-- Balance Status Banner -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px;">
        <div style="background: #FFFBFB; border: 1.5px solid #FCA5A5; border-radius: 6px; padding: 10px 14px;">
          <div style="font-size: 10px; font-weight: 700; color: #991B1B; text-transform: uppercase;">Total Demanded / Issues (Due)</div>
          <div style="font-size: 16px; font-weight: 900; color: #DC2626; font-family: monospace; margin-top: 2px;">
            ${fmtGrams(totalDebits)} g
          </div>
        </div>

        <div style="background: #F0FDF4; border: 1.5px solid #86EFAC; border-radius: 6px; padding: 10px 14px;">
          <div style="font-size: 10px; font-weight: 700; color: #166534; text-transform: uppercase;">Total Credited / Advance (Excess)</div>
          <div style="font-size: 16px; font-weight: 900; color: #16A34A; font-family: monospace; margin-top: 2px;">
            ${fmtGrams(totalCredits)} g
          </div>
        </div>

        <div style="background: ${isDue ? '#FEF2F2' : isExcess ? '#F0FDF4' : '#F8FAFC'}; border: 2px solid ${isDue ? '#DC2626' : isExcess ? '#16A34A' : '#CBD5E1'}; border-radius: 6px; padding: 10px 14px;">
          <div style="font-size: 10px; font-weight: 800; color: ${isDue ? '#991B1B' : isExcess ? '#166534' : '#475569'}; text-transform: uppercase;">Net Closing Balance</div>
          <div style="font-size: 18px; font-weight: 900; color: ${isDue ? '#DC2626' : isExcess ? '#15803D' : '#0F172A'}; font-family: monospace; margin-top: 2px;">
            ${isDue ? `${fmtGrams(Math.abs(finalBalance))} g Due` : isExcess ? `+${fmtGrams(Math.abs(finalBalance))} g Excess` : 'Settled (0 g)'}
          </div>
        </div>
      </div>

      <!-- Ledger Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10.5px;">
        <thead>
          <tr style="background: #F1F5F9; border-top: 1.5px solid #CBD5E1; border-bottom: 1.5px solid #CBD5E1;">
            <th style="padding: 7px 8px; text-align: left; width: 75px;">Date</th>
            <th style="padding: 7px 8px; text-align: left; width: 90px;">Ref / Vchr</th>
            <th style="padding: 7px 8px; text-align: left;">Particulars</th>
            <th style="padding: 7px 8px; text-align: right; width: 85px;">Demanded / Out (g)</th>
            <th style="padding: 7px 8px; text-align: right; width: 85px;">Received / In (g)</th>
            <th style="padding: 7px 8px; text-align: right; width: 95px;">Balance (g)</th>
          </tr>
        </thead>
        <tbody>
          ${ledgerRows.map((row, idx) => {
            const isRowDue = row.closingBalance > 0
            const isRowExcess = row.closingBalance < 0
            const absBal = Math.abs(row.closingBalance)
            return `
              <tr style="border-bottom: 1px solid #E2E8F0; ${idx % 2 === 1 ? 'background: #F8FAFC;' : ''}">
                <td style="padding: 7px 8px; color: #64748B;">${row.date || '—'}</td>
                <td style="padding: 7px 8px; font-family: monospace; font-weight: 700; color: #0F172A;">${row.ref || '—'}</td>
                <td style="padding: 7px 8px; color: #334155;">${row.particulars || '—'}</td>
                <td style="padding: 7px 8px; text-align: right; font-family: monospace; color: #DC2626;">
                  ${row.debitG > 0 ? `${fmtGrams(row.debitG)} g` : '—'}
                </td>
                <td style="padding: 7px 8px; text-align: right; font-family: monospace; color: #16A34A;">
                  ${row.creditG > 0 ? `+${fmtGrams(row.creditG)} g` : '—'}
                </td>
                <td style="padding: 7px 8px; text-align: right; font-family: monospace; font-weight: 800; color: ${isRowDue ? '#DC2626' : isRowExcess ? '#15803D' : '#64748B'};">
                  ${isRowDue ? `${fmtGrams(absBal)} g Due` : isRowExcess ? `+${fmtGrams(absBal)} g Excess` : '0 g'}
                </td>
              </tr>
            `
          }).join('')}
        </tbody>
      </table>

      ${getSignaturesHtml('Customer Signature', 'For K R S SILVERS (Authorized Signatory)')}
    </div>
  `
}

export function downloadCustomerLedgerPdf(params) {
  const cust = sanitizeFilename(params.customer?.name || 'Customer')
  const date = sanitizeFilename(new Date().toISOString().slice(0, 10))
  const filename = `Ledger-${cust}-${date}.pdf`
  const html = buildCustomerLedgerHtml(params)
  return exportHtmlToPdf(html, filename)
}

export function printCustomerLedger(params) {
  const title = `Account Ledger - ${params.customer?.name || 'Customer'}`
  const html = buildCustomerLedgerHtml(params)
  openPrintWindow(html, title)
}
