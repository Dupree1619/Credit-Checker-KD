//// ============================
// USER & BUREAU INFO
// ============================
const userName = "Kenneth DuPree Sr.";
const userAddress = `4429 Benner St.
Philadelphia, PA 19135`;

const creditBureaus = {
    Equifax: `Equifax Information Services LLC
P.O. Box 740241
Atlanta, GA 30374-0241`,
    Experian: `Experian
P.O. Box 4500
Allen, TX 75013`,
    TransUnion: `TransUnion LLC
P.O. Box 2000
Chester, PA 19016`
};

//// ============================
// PDF.js Worker Setup
// ============================
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

//// ============================
// DOM REFERENCES
// ============================
const fileInput = document.getElementById('fileInput');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const generateLettersBtn = document.getElementById('generateLettersBtn');
const downloadLettersBtn = document.getElementById('downloadLettersBtn');

const issuesList = document.getElementById('issuesList');
const inquiriesList = document.getElementById('inquiriesList');
const reportSection = document.getElementById('reportSection');
const lettersSection = document.getElementById('lettersSection');

//// ============================
// GLOBAL STATE
// ============================
let reportText = "";
let issues = [];
let inquiriesToChallenge = [];
let accounts = [];
let personalInfoIssues = [];
let generatedLetters = [];

//// ============================
// EVENT LISTENERS
// ============================
analyzeBtn.addEventListener('click', analyzeReport);
generateLettersBtn.addEventListener('click', generateLetters);
downloadLettersBtn.addEventListener('click', downloadAllLetters);
downloadAllBtn.addEventListener('click', downloadAllPDFLetters);

//// ============================
// ANALYZE REPORT
// ============================
function analyzeReport() {
    if (!fileInput.files[0]) {
        alert("Please select a file.");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
        if (file.name.endsWith(".txt")) {
            reportText = e.target.result;
            processReportText();
        } else if (file.name.endsWith(".pdf")) {
            extractPdfText(e.target.result);
        } else {
            alert("Unsupported file. Please upload PDF or TXT.");
        }
    };

    file.name.endsWith(".txt")
        ? reader.readAsText(file)
        : reader.readAsArrayBuffer(file);
}

//// ============================
// PDF → TEXT EXTRACTION
// ============================
async function extractPdfText(arrayBuffer) {
    try {
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let finalText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const text = await page.getTextContent();
            finalText += text.items.map(t => t.str).join(" ") + "\n\n";
        }

        reportText = finalText;
        processReportText();
    } catch (err) {
        console.error("PDF READ ERROR:", err);
        alert("Unable to read PDF. Try converting it to TXT.");
    }
}

//// ============================
// MASTER PROCESSING FUNCTION
// ============================
function processReportText() {
    issues = [];
    inquiriesToChallenge = [];
    accounts = [];
    personalInfoIssues = [];

    detectInaccuracies();
    extractInquiries();
    extractAccounts();
    detectPersonalInfoIssues();
    displayResults();
}

//// ============================
// ISSUE DETECTION
// ============================
function detectInaccuracies() {
    if (reportText.includes("000-00-0000")) issues.push("Invalid SSN detected.");
    if (reportText.includes("??") || reportText.length < 150) issues.push("Unreadable or incomplete report detected.");
    if (reportText.includes("30 Days Late") && reportText.includes("Status: Current")) issues.push("Conflicting status: 'Late' but also 'Current'.");
}

//// ============================
// INQUIRY EXTRACTION
// ============================
function extractInquiries() {
    const inquiryRegex = /Inquiry.*?Date[: ]*(\d{1,2}\/\d{1,2}\/\d{2,4})/gi;
    let match;

    const now = new Date();
    const fourMonthsAgo = new Date(now);
    fourMonthsAgo.setMonth(now.getMonth() - 4);

    while ((match = inquiryRegex.exec(reportText)) !== null) {
        const date = new Date(match[1]);
        if (date < fourMonthsAgo) inquiriesToChallenge.push(match[1]);
    }
}

//// ============================
// ACCOUNT EXTRACTION
// ============================
function extractAccounts() {
    const regex = /Account Name[: ]*(.*?)\n([\s\S]*?)(?=Account Name|$)/gi;
    let match;

    while ((match = regex.exec(reportText)) !== null) {
        const name = match[1].trim();
        const block = match[2];

        accounts.push({
            name,
            status: (block.match(/Status[: ]*(.*)/i) || ["", ""])[1].trim(),
            latePayments: (block.match(/\d{2,3} Days Late/gi) || []).map(x => x.trim()),
            chargeOff: /Charge[- ]?Off/i.test(block)
        });
    }
}

//// ============================
// PERSONAL INFO ISSUES
// ============================
function detectPersonalInfoIssues() {
    const names = new Set();
    const addresses = new Set();

    [...reportText.matchAll(/Name[: ]*(.*?)\n/g)].forEach(m => names.add(m[1].trim()));
    [...reportText.matchAll(/Address[: ]*(.*?)\n/g)].forEach(m => addresses.add(m[1].trim()));

    if (names.size > 1) personalInfoIssues.push({ type: "Multiple Names", data: [...names] });
    if (addresses.size > 1) personalInfoIssues.push({ type: "Multiple Addresses", data: [...addresses] });

    accounts.forEach(acc => {
        if (!acc.status || acc.status.toLowerCase().includes("unverified")) {
            personalInfoIssues.push({ type: "Account Without Verification", account: acc.name });
        }
    });
}

//// ============================
// DISPLAY RESULTS IN UI
// ============================
function displayResults() {
    reportSection.style.display = "block";
    issuesList.innerHTML = issues.map(i => `<li>${i}</li>`).join("");
    inquiriesList.innerHTML = inquiriesToChallenge.map(i => `<li>${i}</li>`).join("");
}

//// ============================
// GENERATE LETTERS
// ============================
function generateLetters() {
    lettersSection.innerHTML = "";
    generatedLetters = [];
    const bureaus = Object.keys(creditBureaus);

    // --- Inquiries ---
    inquiriesToChallenge.forEach(date => {
        bureaus.forEach(bureau => {
            const letter = `
${userName}
${userAddress}

${creditBureaus[bureau]}

Date: ${new Date().toLocaleDateString()}

📄 Dispute Letter – Unauthorized Inquiry (${date})

To Whom It May Concern,

I dispute the hard inquiry recorded on ${date}.
Please provide a signed authorization form or remove it immediately.

Sincerely,
${userName}`;
            generatedLetters.push({ bureau, content: letter });
        });
    });

    // --- Personal Info ---
    personalInfoIssues.forEach(issue => {
        bureaus.forEach(bureau => {
            let body = "";
            if (issue.type === "Multiple Names") body = `📄 Dispute Letter – Multiple Names\nNames found on my report:\n${issue.data.join(", ")}\nPlease remove any names not belonging to me.`;
            if (issue.type === "Multiple Addresses") body = `📄 Dispute Letter – Multiple Addresses\nAddresses found on my report:\n${issue.data.join(", ")}\nRemove any addresses that cannot be verified as mine.`;
            if (issue.type === "Account Without Verification") body = `📄 Verification Request – Account: ${issue.account}\nProvide full verification of this account, including signed contract and ID. If unavailable, remove the account immediately.`;

            const letter = `
${userName}
${userAddress}

${creditBureaus[bureau]}

Date: ${new Date().toLocaleDateString()}

${body}

Sincerely,
${userName}`;
            generatedLetters.push({ bureau, content: letter });
        });
    });

    // --- Late Payments & Charge-Offs ---
    accounts.forEach(acc => {
        bureaus.forEach(bureau => {
            let body = "";
            if (acc.latePayments.length > 0) body += `📄 Dispute Letter – Late Payments (${acc.name})\nReported late payments:\n${acc.latePayments.join(", ")}\nProvide verification or remove them.`;
            if (acc.chargeOff) body += `📄 Dispute Letter – Charge-Off (${acc.name})\nProvide full validation including contract, ID, and accounting. If not available, remove this charge-off.`;
            if (!body) return;

            const letter = `
${userName}
${userAddress}

${creditBureaus[bureau]}

Date: ${new Date().toLocaleDateString()}

${body}

Sincerely,
${userName}`;
            generatedLetters.push({ bureau, content: letter });
        });
    });

    lettersSection.innerHTML = generatedLetters.map(l => letterBox(l.content)).join("");
}

//// ============================
// DOWNLOAD ALL LETTERS AS TXT
// ============================
function downloadAllLetters() {
    if (!generatedLetters.length) return alert("No letters to download.");
    const text = generatedLetters.map(l => l.content).join("\n\n---------------------\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "DisputeLetters.txt";
    a.click();

    URL.revokeObjectURL(url);
}

//// ============================
// DOWNLOAD ALL LETTERS AS PDF
// ============================
function downloadAllPDFLetters() {
    if (!generatedLetters.length) return alert("No letters to generate PDF.");

    const doc = new jsPDF();
    generatedLetters.forEach((letter, index) => {
        const lines = doc.splitTextToSize(letter.content, 180);
        doc.setFont("times", "normal");
        doc.setFontSize(12);
        doc.text(lines, 15, 20);
        if (index < generatedLetters.length - 1) doc.addPage();
    });

    doc.save("DisputeLetters.pdf");
}

//// ============================
// LETTER BOX HTML
// ============================
function letterBox(text) {
    return `<div style="background:#f8f9fa; padding:15px; margin:10px 0; border:2px solid #007bff; border-radius:8px; white-space:pre-wrap; font-family:monospace;">${text.trim()}</div>`;
}
