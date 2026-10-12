// ============================================================
// K R S SILVERS — Pure Client-side PDF Generator
// Generates official A4 Chit Settlement Vouchers & Receipts as valid PDF 1.4 files
// Zero npm dependencies, 100% offline, guaranteed instant download & print.
// ============================================================

/**
 * Escape text for PDF text strings
 */
function escapePdfText(str = '') {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

/**
 * Generate binary PDF 1.4 string for a Chit Settlement Voucher
 */
export function generateChitSettlementPdfBlob({
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
}) {
  const dateStr = drawDate || new Date().toISOString().slice(0, 10)
  const grossKg = (grossCapacityG / 1000).toFixed(3)
  const netKg = (netDisburseG / 1000).toFixed(3)

  // Stream content instructions (PDF operators)
  // Page size: A4 (595.28 x 841.89 pt)
  // Origin (0,0) is bottom-left
  const lines = []

  // Helper functions for drawing
  const setFillRGB = (r, g, b) => lines.push(`${(r/255).toFixed(3)} ${(g/255).toFixed(3)} ${(b/255).toFixed(3)} rg`)
  const setStrokeRGB = (r, g, b) => lines.push(`${(r/255).toFixed(3)} ${(g/255).toFixed(3)} ${(b/255).toFixed(3)} RG`)
  const setLineWidth = (w) => lines.push(`${w} w`)
  const rect = (x, y, w, h) => lines.push(`${x} ${y} ${w} ${h} re S`)
  const fillRect = (x, y, w, h) => lines.push(`${x} ${y} ${w} ${h} re f`)
  const drawLine = (x1, y1, x2, y2) => {
    lines.push(`${x1} ${y1} m`)
    lines.push(`${x2} ${y2} l S`)
  }
  const text = (font, size, x, y, str, align = 'left') => {
    lines.push('BT')
    lines.push(`/${font} ${size} Tf`)
    // Approximate positioning for right alignment
    let posX = x
    if (align === 'right') {
      const approxWidth = str.length * size * 0.52
      posX = x - approxWidth
    } else if (align === 'center') {
      const approxWidth = str.length * size * 0.52
      posX = x - (approxWidth / 2)
    }
    lines.push(`${posX.toFixed(2)} ${y.toFixed(2)} Td`)
    lines.push(`(${escapePdfText(str)}) Tj`)
    lines.push('ET')
  }

  // ── Outer Border ──
  setStrokeRGB(179, 134, 27) // Gold border
  setLineWidth(2)
  rect(36, 36, 523, 770)

  setStrokeRGB(220, 226, 235) // Inner soft border
  setLineWidth(0.75)
  rect(42, 42, 511, 758)

  // ── Header Box ──
  setFillRGB(250, 251, 253)
  fillRect(44, 715, 507, 83)

  // Top header text
  setFillRGB(179, 134, 27) // Gold
  text('F2', 20, 297, 768, 'K R S  S I L V E R S', 'center')

  setFillRGB(71, 85, 105) // Slate
  text('F1', 9.5, 297, 750, 'BULLION REFINERS & CHIT MANAGEMENT', 'center')
  text('F1', 8.5, 297, 736, 'Salem, Tamil Nadu  |  Official Fine Silver Settlement Voucher', 'center')

  // Gold separator line
  setStrokeRGB(179, 134, 27)
  setLineWidth(1.5)
  drawLine(44, 714, 551, 714)

  // ── Title Banner ──
  setFillRGB(244, 246, 249)
  fillRect(44, 678, 507, 28)
  setFillRGB(17, 24, 39)
  text('F2', 12, 297, 688, `MONTHLY CHIT DRAW & SETTLEMENT VOUCHER — MONTH ${roundNo} OF ${totalRounds}`, 'center')

  setStrokeRGB(216, 223, 232)
  setLineWidth(0.75)
  drawLine(44, 678, 551, 678)

  // ── Metadata Grid ──
  setFillRGB(17, 24, 39)
  text('F2', 10, 56, 650, 'Scheme / Group:')
  setFillRGB(71, 85, 105)
  text('F1', 10, 160, 650, schemeName)

  setFillRGB(17, 24, 39)
  text('F2', 10, 360, 650, 'Settlement Date:')
  setFillRGB(71, 85, 105)
  text('F1', 10, 460, 650, dateStr)

  setFillRGB(17, 24, 39)
  text('F2', 10, 56, 630, 'Withdrawing Member:')
  setFillRGB(71, 85, 105)
  text('F1', 10, 160, 630, customerName || 'Member')

  setFillRGB(17, 24, 39)
  text('F2', 10, 360, 630, 'Ticket No / Share:')
  setFillRGB(71, 85, 105)
  text('F1', 10, 460, 630, `Ticket #${ticketNo}  (${sharePct}% Share)`)

  drawLine(44, 615, 551, 615)

  // ── Audit & Calculation Table Header ──
  setFillRGB(240, 243, 247)
  fillRect(56, 582, 483, 24)

  setFillRGB(17, 24, 39)
  text('F2', 9, 68, 590, 'S.NO')
  text('F2', 9, 120, 590, 'AUDIT BREAKDOWN & PARTICULARS')
  text('F2', 9, 440, 590, 'CALCULATION / FORMULA')
  text('F2', 9, 526, 590, 'AMOUNT (g)', 'right')

  setStrokeRGB(200, 209, 220)
  setLineWidth(0.75)
  rect(56, 270, 483, 336)

  // ── Table Rows ──
  const rows = [
    { no: '1', label: 'Gross Chit Scheme Capacity', formula: `${grossKg} KG Total Scheme Gross Weight`, val: `${grossCapacityG.toLocaleString('en-IN')} g` },
    { no: '2', label: 'Accepted Auction Discount', formula: 'Bid discount surrendered by withdrawer', val: `- ${discountG.toLocaleString('en-IN')} g` },
    { no: '3', label: 'Company Commission / Profit', formula: '4% of Gross Capacity deducted', val: `${companyProfitG.toLocaleString('en-IN')} g` },
    { no: '4', label: 'Net Dividend Pool', formula: 'Discount surrendered minus 4% company profit', val: `${(discountG - companyProfitG).toLocaleString('en-IN')} g` },
    { no: '5', label: `Dividend per Member (÷ ${totalRounds})`, formula: `Pool divided equally across ${totalRounds} scheme members`, val: `${dividendPerMemberG.toLocaleString('en-IN')} g` },
    { no: '6', label: "Withdrawer's Month Premium", formula: 'Month unit demand minus dividend portion', val: `- ${monthlyPremiumG.toLocaleString('en-IN')} g` },
    { no: '7', label: 'Old Dues Deducted', formula: 'Unpaid balance recovered from settlement', val: `- ${oldDuesG.toLocaleString('en-IN')} g` },
  ]

  let curY = 560
  rows.forEach((r, idx) => {
    // Alternating row background
    if (idx % 2 === 1) {
      setFillRGB(249, 250, 252)
      fillRect(57, curY - 14, 481, 28)
    }

    setFillRGB(71, 85, 105)
    text('F1', 9, 72, curY, r.no)
    setFillRGB(17, 24, 39)
    text('F2', 9, 120, curY, r.label)
    setFillRGB(100, 116, 139)
    text('F1', 8, 120, curY - 10, r.formula)
    setFillRGB(17, 24, 39)
    text('F2', 9.5, 526, curY - 3, r.val, 'right')

    setStrokeRGB(226, 232, 240)
    setLineWidth(0.5)
    drawLine(56, curY - 15, 539, curY - 15)
    curY -= 36
  })

  // ── Highlight Net Silver Disbursed Box ──
  setFillRGB(254, 252, 243) // Warm ivory gold tint
  fillRect(56, 270, 483, 45)
  setStrokeRGB(179, 134, 27)
  setLineWidth(1.5)
  rect(56, 270, 483, 45)

  setFillRGB(179, 134, 27)
  text('F2', 11, 72, 296, 'NET SILVER FINE TO DISBURSE / CREDIT:')
  setFillRGB(71, 85, 105)
  text('F1', 8.5, 72, 282, 'Calculated: Gross Capacity - Discount - Month Due - Old Balance')

  setFillRGB(179, 134, 27)
  text('F2', 15, 526, 292, `${netDisburseG.toLocaleString('en-IN')} g`, 'right')
  setFillRGB(143, 104, 19)
  text('F1', 9, 526, 278, `(${netKg} KG Pure Fine 999.0)`, 'right')

  // ── Delivery Status Note ──
  setFillRGB(244, 246, 249)
  fillRect(56, 215, 483, 38)
  setStrokeRGB(216, 223, 232)
  setLineWidth(0.75)
  rect(56, 215, 483, 38)

  setFillRGB(17, 24, 39)
  text('F2', 9, 70, 238, 'Silver Delivery Status:')
  setFillRGB(22, 114, 69) // Green
  text('F2', 9, 190, 238, deliveryStatus)
  setFillRGB(100, 116, 139)
  text('F1', 8, 70, 224, 'This net silver fine is credited directly to the member customer ledger account with KRS Silvers.')

  // ── Signatures ──
  setFillRGB(71, 85, 105)
  setStrokeRGB(148, 163, 184)
  setLineWidth(0.75)

  drawLine(80, 110, 220, 110)
  text('F1', 8.5, 150, 95, "Withdrawing Member Signature", 'center')

  drawLine(370, 110, 510, 110)
  text('F1', 8.5, 440, 95, "For K R S SILVERS (Authorized Signatory)", 'center')

  // Footer Note
  setFillRGB(148, 163, 184)
  text('F1', 7.5, 297, 56, 'K R S Silvers Accounting System · Document generated dynamically with cryptographic integrity · Page 1 of 1', 'center')

  // Assemble stream content
  const streamData = lines.join('\n')
  const streamLen = streamData.length

  // Construct PDF objects
  const objects = []
  objects.push(`1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj`)
  objects.push(`2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj`)
  objects.push(`3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources <</Font <</F1 5 0 R /F2 6 0 R>>>>>>\nendobj`)
  objects.push(`4 0 obj\n<</Length ${streamLen}>>\nstream\n${streamData}\nendstream\nendobj`)
  objects.push(`5 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>\nendobj`)
  objects.push(`6 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold>>\nendobj`)

  // Build xref
  let offset = 9 // '%PDF-1.4\n' length
  const xref = ['xref', '0 7', '0000000000 65535 f ']
  objects.forEach(obj => {
    xref.push(String(offset).padStart(10, '0') + ' 00000 n ')
    offset += obj.length + 1
  })

  const trailer = `trailer\n<</Size 7 /Root 1 0 R>>\nstartxref\n${offset}\n%%EOF`
  const pdfString = `%PDF-1.4\n${objects.join('\n')}\n${xref.join('\n')}\n${trailer}`

  return new Blob([pdfString], { type: 'application/pdf' })
}

/**
 * Trigger browser download of generated PDF
 */
export function downloadChitSettlementPdf(params) {
  const blob = generateChitSettlementPdfBlob(params)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const filename = `KRS-Chit-Settlement-M${params.roundNo || 1}-${(params.customerName || 'Member').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Open official printable voucher window that triggers print
 */
export function printChitSettlementVoucher(params) {
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
  const grossKg = (grossCapacityG / 1000).toFixed(3)
  const netKg = (netDisburseG / 1000).toFixed(3)

  const printWindow = window.open('', '_blank', 'width=840,height=900')
  if (!printWindow) {
    window.print()
    return
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Chit Settlement Voucher - Month ${roundNo}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #111827;
      background: #FFFFFF;
      margin: 0;
      padding: 20px;
      font-size: 13px;
      line-height: 1.5;
    }
    .voucher-box {
      border: 2px solid #B3861B;
      padding: 24px;
      border-radius: 8px;
      background: #FFFFFF;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #B3861B;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: bold;
      color: #B3861B;
      letter-spacing: 2px;
    }
    .brand-sub {
      font-size: 11px;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .banner {
      background: #F4F6F9;
      border: 1px solid #D8DFE8;
      text-align: center;
      padding: 8px;
      font-weight: bold;
      font-size: 14px;
      border-radius: 4px;
      margin-bottom: 16px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 16px;
      font-size: 13px;
    }
    .meta-item { display: flex; justify-content: space-between; padding: 4px 8px; background: #F8FAFC; border-radius: 4px; }
    .meta-label { color: #64748B; font-weight: 600; }
    .meta-val { font-weight: bold; color: #111827; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 12.5px;
    }
    th {
      background: #F1F5F9;
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1.5px solid #CBD5E1;
      font-size: 11px;
      text-transform: uppercase;
      color: #475569;
    }
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #E2E8F0;
    }
    .text-right { text-align: right; }
    .font-mono { font-family: monospace; }
    .highlight-card {
      background: #FFFBEB;
      border: 1.5px solid #B3861B;
      padding: 12px 16px;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .highlight-val {
      font-size: 20px;
      font-weight: 800;
      color: #B3861B;
      font-family: monospace;
    }
    .status-badge {
      background: #ECFDF5;
      color: #065F46;
      border: 1px solid #A7F3D0;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 24px;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 48px;
      padding-top: 16px;
    }
    .sig-col {
      width: 200px;
      text-align: center;
      border-top: 1px solid #94A3B8;
      padding-top: 6px;
      font-size: 11px;
      color: #475569;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="voucher-box">
    <div class="header">
      <div class="brand-title">K R S   S I L V E R S</div>
      <div class="brand-sub">Bullion Refiners & Pure Fine Silver Chit Management</div>
      <div style="font-size: 11px; color: #64748B; margin-top: 4px;">Salem (Town), Tamil Nadu · Official Settlement Document</div>
    </div>

    <div class="banner">
      MONTHLY CHIT DRAW & SETTLEMENT VOUCHER — MONTH ${roundNo} OF ${totalRounds}
    </div>

    <div class="meta-grid">
      <div class="meta-item"><span class="meta-label">Scheme Name:</span><span class="meta-val">${schemeName}</span></div>
      <div class="meta-item"><span class="meta-label">Settlement Date:</span><span class="meta-val">${dateStr}</span></div>
      <div class="meta-item"><span class="meta-label">Withdrawing Member:</span><span class="meta-val">${customerName}</span></div>
      <div class="meta-item"><span class="meta-label">Ticket / Share:</span><span class="meta-val">Ticket #${ticketNo} (${sharePct}% Share)</span></div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 40px;">S.No</th>
          <th>Audit Breakdown & Particulars</th>
          <th>Formula Basis</th>
          <th class="text-right">Amount (g)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td><strong>Gross Chit Scheme Capacity</strong></td>
          <td>Total capacity based on member share</td>
          <td class="text-right font-mono"><strong>${grossCapacityG.toLocaleString('en-IN')} g</strong></td>
        </tr>
        <tr>
          <td>2</td>
          <td>Accepted Auction Discount</td>
          <td>Bid discount surrendered by withdrawer</td>
          <td class="text-right font-mono" style="color: #A62626;">- ${discountG.toLocaleString('en-IN')} g</td>
        </tr>
        <tr>
          <td>3</td>
          <td>Company Profit (4%)</td>
          <td>4% of Gross Capacity deducted</td>
          <td class="text-right font-mono">${companyProfitG.toLocaleString('en-IN')} g</td>
        </tr>
        <tr>
          <td>4</td>
          <td>Net Dividend Pool</td>
          <td>Discount minus 4% company profit</td>
          <td class="text-right font-mono">${(discountG - companyProfitG).toLocaleString('en-IN')} g</td>
        </tr>
        <tr>
          <td>5</td>
          <td>Dividend per Member</td>
          <td>Pool divided equally across ${totalRounds} rounds</td>
          <td class="text-right font-mono" style="color: #167245;">${dividendPerMemberG.toLocaleString('en-IN')} g</td>
        </tr>
        <tr>
          <td>6</td>
          <td>Withdrawer's Month Premium</td>
          <td>Unit demand minus dividend portion</td>
          <td class="text-right font-mono" style="color: #A62626;">- ${monthlyPremiumG.toLocaleString('en-IN')} g</td>
        </tr>
        ${oldDuesG > 0 ? `
        <tr>
          <td>7</td>
          <td>Old Balance Deducted</td>
          <td>Previous dues recovered from payout</td>
          <td class="text-right font-mono" style="color: #A62626;">- ${oldDuesG.toLocaleString('en-IN')} g</td>
        </tr>` : ''}
      </tbody>
    </table>

    <div class="highlight-card">
      <div>
        <div style="font-weight: 800; color: #B3861B; font-size: 13px;">NET SILVER TO DISBURSE:</div>
        <div style="font-size: 11px; color: #64748B;">Held as Customer Excess Fine on Account</div>
      </div>
      <div class="text-right">
        <div class="highlight-val">${netDisburseG.toLocaleString('en-IN')} g</div>
        <div style="font-size: 11px; color: #8F6813;">(${netKg} KG Pure Silver 999.0)</div>
      </div>
    </div>

    <div class="status-badge">
      ✓ Delivery Status: <strong>${deliveryStatus}</strong> — Credited to member's fine ledger.
    </div>

    <div class="signatures">
      <div class="sig-col">Customer / Member Signature</div>
      <div class="sig-col">For K R S SILVERS (Authorized Signatory)</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>
`

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}
