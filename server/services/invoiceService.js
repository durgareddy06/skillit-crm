import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

/**
 * Converts a number to Indian Rupees words format.
 */
export function numberToWords(num) {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const numToWordsLessThanThousand = (n) => {
    if (n < 20) return a[n];
    const digit = n % 10;
    if (digit === 0) return b[Math.floor(n / 10)];
    return b[Math.floor(n / 10)] + " " + a[digit];
  };

  const convert = (n) => {
    if (n === 0) return "Zero";
    let words = "";

    // Crore (1,00,00,000)
    if (Math.floor(n / 10000000) > 0) {
      words += convert(Math.floor(n / 10000000)) + " Crore ";
      n %= 10000000;
    }

    // Lakh (1,00,000)
    if (Math.floor(n / 100000) > 0) {
      words += numToWordsLessThanThousand(Math.floor(n / 100000)) + " Lakh ";
      n %= 100000;
    }

    // Thousand (1,000)
    if (Math.floor(n / 1000) > 0) {
      words += numToWordsLessThanThousand(Math.floor(n / 1000)) + " Thousand ";
      n %= 1000;
    }

    // Hundred (100)
    if (Math.floor(n / 100) > 0) {
      words += numToWordsLessThanThousand(Math.floor(n / 100)) + " Hundred ";
      n %= 100;
    }

    // Tens and Units
    if (n > 0) {
      if (words !== "") words += "and ";
      words += numToWordsLessThanThousand(n);
    }

    return words.trim();
  };

  const integerPart = Math.floor(num);
  let result = convert(integerPart) + " Rupees";

  const decimalPart = Math.round((num - integerPart) * 100);
  if (decimalPart > 0) {
    result += " and " + numToWordsLessThanThousand(decimalPart) + " Paise";
  }

  return result + " Only";
}

function formatDateLong(dateStr) {
  if (!dateStr) return "N/A";
  
  const parts = String(dateStr).split("-");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 1000) {
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      }
    }
  }

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }

  return dateStr;
}

/**
 * Generates a professional A4 invoice PDF buffer matching the modified layout requirements.
 */
export function generateInvoicePDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const {
        invoiceNumber,
        invoiceDate,
        refInvoiceId,
        transactionId,
        studentName,
        programName,
        parentName,
        paymentDateTime,
        paymentMethod,
        paymentStatus,
        amountPaid,
        discount,
        email,
        contactNumber,
        generatedBy,
      } = data;

      // ==========================================
      // 1. TOP HEADER SECTION
      // ==========================================
      // Left side: SkillIT logo (specify height only to preserve aspect ratio)
      let logoBuffer = null;
      try {
        const svgPath = path.join(process.cwd(), "../frontend/public/skillitacc_logo.svg");
        if (fs.existsSync(svgPath)) {
          const svgContent = fs.readFileSync(svgPath, "utf8");
          const match = svgContent.match(/xlink:href="data:image\/png;base64,([^"]+)"/);
          if (match && match[1]) {
            logoBuffer = Buffer.from(match[1].trim(), "base64");
          }
        }
      } catch (err) {
        console.error("Error loading SVG logo:", err);
      }

      if (logoBuffer) {
        doc.image(logoBuffer, 40, 40, { height: 80 });
      } else {
        doc.font("Helvetica-Bold").fillColor("#1C5494").fontSize(13).text("SKILLIT ACADEMY", 40, 45);
      }

      // Right side: Company Details (Name is "ALGOREK SKILLIT ACADEMY")
      const companyY = 40;
      doc.font("Helvetica-Bold").fillColor("#1C5494").fontSize(10).text("ALGOREK SKILLIT ACADEMY", 280, companyY, { align: "right" });
      doc.font("Helvetica").fillColor("#475569").fontSize(7);
      doc.text("CIN : U85491AP2025PTC118525   |   GST : 36ABCCA5076A1Z1", 280, companyY + 13, { align: "right" });
      doc.text("5th Floor, Pranava Business Park, Beside Harsha Toyota Showroom", 280, companyY + 22, { align: "right" });
      doc.text("Land Mark Residency, Kothaguda, Hyderabad, Telangana - 500084.", 280, companyY + 31, { align: "right" });
      doc.text("Email: services@skillit.academy   |   Tel: +91 8639191169", 280, companyY + 40, { align: "right" });
      doc.text("www.skillit.academy", 280, companyY + 49, { align: "right" });

      // ==========================================
      // 2. CLIENT DETAILS & FEE RECEIPT DETAILS GRID
      // ==========================================
      // Client Details (Left Column)
      const clientY = 155;
      doc.font("Helvetica-Bold").fillColor("#1C5494").fontSize(11).text("Client Details", 40, clientY);
      doc.font("Helvetica").fillColor("#475569").fontSize(8.5).text("This fee receipt is sent to:", 40, clientY + 15);
      doc.font("Helvetica").fillColor("#0F172A").fontSize(8.5);
      doc.text(`Name: ${studentName || "N/A"}`, 40, clientY + 27);
      doc.text(`Course: ${programName || "N/A"}`, 40, clientY + 38);
      
      const emailVal = email && email !== "N/A" ? email : "";
      const phoneVal = contactNumber && contactNumber !== "N/A" ? contactNumber : "";
      const addressVal = [phoneVal, emailVal].filter(Boolean).join(" / ") || "N/A";
      doc.text(`Address: ${addressVal}`, 40, clientY + 49);

      // Fee Receipt Details Block (Grid box with vertical line down the middle)
      const gridY = 235;
      const gridHeight = 80;
      doc.rect(40, gridY, 515, gridHeight).stroke("#D0D7DE");
      doc.moveTo(297, gridY).lineTo(297, gridY + gridHeight).stroke("#D0D7DE");
      
      const drawGridField = (label, val, labelX, valX, y) => {
        doc.font("Helvetica-Bold").fillColor("#475569").fontSize(8).text(label, labelX, y);
        doc.font("Helvetica").fillColor("#0F172A").fontSize(8).text(val || "N/A", valX, y);
      };

      // Left Column
      drawGridField("Receipt Number:", invoiceNumber, 50, 155, gridY + 10);
      drawGridField("Payment Date & Time:", paymentDateTime, 50, 155, gridY + 26);
      drawGridField("Reference ID:", refInvoiceId, 50, 155, gridY + 42);
      drawGridField("Transaction/Payment ID:", transactionId, 50, 155, gridY + 58);

      // Right Column
      drawGridField("Payment Method:", paymentMethod, 307, 425, gridY + 10);
      drawGridField("Payment Status:", paymentStatus, 307, 425, gridY + 26);
      drawGridField("Parent/Sponsor Name:", parentName, 307, 425, gridY + 42);
      drawGridField("Receipt Generated By:", generatedBy, 307, 425, gridY + 58);

      // Narrative Assessment Description
      const descY = 330;
      doc.font("Helvetica").fillColor("#475569").fontSize(7.5);
      doc.text(
        "The pieces of information herein are duly assessed by the school's accounting officers for the payment of the amount in this receipt.",
        40,
        descY,
        { width: 515, lineGap: 2 }
      );

      // ==========================================
      // 3. PARTICULARS TABLE
      // ==========================================
      const tableY = 355;
      // Header Fill
      doc.rect(40, tableY, 515, 22).fill("#1C5494");
      
      // Header Text
      doc.font("Helvetica-Bold").fillColor("#FFFFFF").fontSize(8.5);
      doc.text("Item#", 40, tableY + 7, { width: 40, align: "center" });
      doc.text("Item Description", 85, tableY + 7, { width: 235, align: "left" });
      doc.text("Quantity", 325, tableY + 7, { width: 55, align: "center" });
      doc.text("Unit Price", 385, tableY + 7, { width: 65, align: "right" });
      doc.text("Total Amount", 465, tableY + 7, { width: 78, align: "right" });

      // Calculate table math
      const discountVal = Number(discount || 0);
      const subtotalVal = Number(amountPaid || 0) + discountVal;

      // Row content
      const rowY = tableY + 22;
      doc.font("Helvetica").fillColor("#0F172A").fontSize(8.5);
      doc.text("1", 40, rowY + 16, { width: 40, align: "center" });
      doc.text(`Course Tuition Fee for ${programName || "SkillIT Program"}`, 85, rowY + 16, { width: 235, align: "left" });
      doc.text("1", 325, rowY + 16, { width: 55, align: "center" });
      doc.text(`₹${subtotalVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 385, rowY + 16, { width: 65, align: "right" });
      doc.text(`₹${subtotalVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 465, rowY + 16, { width: 78, align: "right" });

      // Draw grid lines
      doc.lineWidth(0.5);
      // Horizontal borders
      doc.moveTo(40, tableY).lineTo(555, tableY).stroke("#D0D7DE");
      doc.moveTo(40, tableY + 22).lineTo(555, tableY + 22).stroke("#D0D7DE");
      doc.moveTo(40, tableY + 62).lineTo(555, tableY + 62).stroke("#D0D7DE");
      
      // Vertical borders
      doc.moveTo(40, tableY).lineTo(40, tableY + 62).stroke("#D0D7DE");
      doc.moveTo(80, tableY).lineTo(80, tableY + 62).stroke("#D0D7DE");
      doc.moveTo(320, tableY).lineTo(320, tableY + 62).stroke("#D0D7DE");
      doc.moveTo(380, tableY).lineTo(380, tableY + 62).stroke("#D0D7DE");
      doc.moveTo(460, tableY).lineTo(460, tableY + 62).stroke("#D0D7DE");
      doc.moveTo(555, tableY).lineTo(555, tableY + 62).stroke("#D0D7DE");

      // ==========================================
      // 4. TOTALS BLOCK
      // ==========================================
      const totalsStartY = tableY + 78;
      const rowHeight = 18;
      
      // Horizontal borders for totals block
      doc.moveTo(320, totalsStartY).lineTo(555, totalsStartY).stroke("#D0D7DE");
      doc.moveTo(320, totalsStartY + rowHeight).lineTo(555, totalsStartY + rowHeight).stroke("#D0D7DE");
      doc.moveTo(320, totalsStartY + rowHeight * 2).lineTo(555, totalsStartY + rowHeight * 2).stroke("#D0D7DE");
      doc.moveTo(320, totalsStartY + rowHeight * 3).lineTo(555, totalsStartY + rowHeight * 3).stroke("#D0D7DE");
      doc.moveTo(320, totalsStartY + rowHeight * 4).lineTo(555, totalsStartY + rowHeight * 4).stroke("#D0D7DE");
      doc.moveTo(320, totalsStartY + rowHeight * 5 + 4).lineTo(555, totalsStartY + rowHeight * 5 + 4).stroke("#D0D7DE");

      // Vertical borders for totals block
      doc.moveTo(320, totalsStartY).lineTo(320, totalsStartY + rowHeight * 5 + 4).stroke("#D0D7DE");
      doc.moveTo(460, totalsStartY).lineTo(460, totalsStartY + rowHeight * 5 + 4).stroke("#D0D7DE");
      doc.moveTo(555, totalsStartY).lineTo(555, totalsStartY + rowHeight * 5 + 4).stroke("#D0D7DE");

      // Values
      doc.font("Helvetica").fillColor("#0F172A").fontSize(8.5);
      
      // Subtotal
      doc.text("Subtotal", 325, totalsStartY + 5, { width: 130 });
      doc.text(`₹${subtotalVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 465, totalsStartY + 5, { width: 78, align: "right" });

      // Less: Discount
      doc.text("Less: Discount", 325, totalsStartY + rowHeight + 5, { width: 130 });
      doc.text(`₹${discountVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 465, totalsStartY + rowHeight + 5, { width: 78, align: "right" });

      // Plus: Tax (0.0%)
      doc.text("Plus: Tax (0%)", 325, totalsStartY + rowHeight * 2 + 5, { width: 130 });
      doc.text("₹0.00", 465, totalsStartY + rowHeight * 2 + 5, { width: 78, align: "right" });

      // Other charges
      doc.text("Other charges", 325, totalsStartY + rowHeight * 3 + 5, { width: 130 });
      doc.text("₹0.00", 465, totalsStartY + rowHeight * 3 + 5, { width: 78, align: "right" });

      // Total Payment Due (Blue fill with white text)
      doc.rect(320.5, totalsStartY + rowHeight * 4 + 0.5, 234, rowHeight + 3).fill("#1C5494");
      doc.font("Helvetica-Bold").fillColor("#FFFFFF").fontSize(9);
      doc.text("Total Payment Due", 325, totalsStartY + rowHeight * 4 + 6, { width: 130 });
      doc.text(`₹${Number(amountPaid).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 465, totalsStartY + rowHeight * 4 + 6, { width: 78, align: "right" });

      // ==========================================
      // 5. COMPUTER VERIFICATION NOTE
      // ==========================================
      // Bottom-left note
      const certificateY = totalsStartY + rowHeight * 5 + 25;
      doc.font("Helvetica-Oblique").fillColor("#475569").fontSize(8.5);
      doc.text("I hereby certify that the amount herein are true and correct based on my assessment.", 40, certificateY, { width: 270 });

      // Computer Verified Box
      const verifyY = certificateY + 30;
      doc.rect(40, verifyY, 515, 32).fill("#F0FDF4");
      doc.rect(40, verifyY, 515, 32).stroke("#DCFCE7");
      
      doc.font("Helvetica-Bold").fillColor("#15803D").fontSize(8.5);
      doc.text("COMPUTER VERIFIED DOCUMENT", 50, verifyY + 11, { continued: true });
      doc.font("Helvetica").fillColor("#166534").fontSize(8.5).text(" - This is a system-generated receipt. No physical signature is required.");

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
