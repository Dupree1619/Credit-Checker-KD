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
}; ============================
// PDF.js Worker Setup
// ============================
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

// DOM REFERENCES
const fileInput = document.getElementById('fileInput');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const generateLettersBtn = document.getElementById('generateLettersBtn');
const downloadLettersBtn = document.getElementById('downloadLettersBtn');

const issuesList = document.getElementById('issuesList');
const inquiriesList = document.getElementById('inquiriesList');
const reportSection = document.getElementById('reportSection');
const lettersSection = document.getElementById('lettersSection');

// GLOBAL STATE
let reportText = "";
let issues = [];
let inquiriesToChallenge = [];
let accounts = [];
let personalInfoIssues = [];

// ============================
// EVENT LISTENERS
// ============================
analyzeBtn.addEventListener('click', analyzeReport);
generateLettersBtn.addEventListener('click', generateLetters);
downloadLettersBtn.addEventListener('click', downloadAllLetters);

// (The PDF download button is not implemented yet but ready)
downloadAllBtn.addEventListener('click', () => {
    alert("PDF download feature will be added next!");
});

// ============================
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

// ============================
// PDF → TEXT EXTRACTION (FIXED)
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

// ============================
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

// ============================
// ISSUE DETECTION
// ============================
function detectInaccuracies() {
    if (reportText.includes("000-00-0000")) {
        issues.push("Invalid SSN detected.");
    }
    if (reportText.includes("??") || reportText.length < 150) {
        issues.push("Unreadable or incomplete report detected.");
    }
    if (reportText.includes("30 Days Late") && reportText.includes("Status: Current")) {
        issues.push("Conflicting status: 'Late' but also 'Current'.");
    }
}

// ============================
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
        if (date < fourMonthsAgo) {
            inquiriesToChallenge.push(match[1]);
        }
    }
}

// ============================
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

// ============================
// PERSONAL INFO ISSUES
// ============================
function detectPersonalInfoIssues() {
    const names = new Set();
    const addresses = new Set();

    [...reportText.matchAll(/Name[: ]*(.*?)\n/g)].forEach(m => names.add(m[1].trim()));
    [...reportText.matchAll(/Address[: ]*(.*?)\n/g)].forEach(m => addresses.add(m[1].trim()));

    if (names.size > 1) {
        personalInfoIssues.push({ type: "Multiple Names", data: [...names] });
    }

    if (addresses.size > 1) {
        personalInfoIssues.push({ type: "Multiple Addresses", data: [...addresses] });
    }

    // Any account without verified status
    accounts.forEach(acc => {
        if (!acc.status || acc.status.toLowerCase().includes("unverified")) {
            personalInfoIssues.push({
                type: "Account Without Verification",
                account: acc.name
            });
        }
    });
}

// ============================
// DISPLAY RESULTS IN UI
// ============================
function displayResults() {
    reportSection.style.display = "block";

    issuesList.innerHTML = issues.map(i => `<li>${i}</li>`).join("");
    inquiriesList.innerHTML = inquiriesToChallenge.map(i => `<li>${i}</li>`).join("");
}

// ============================
// GENERATE LETTERS
// ============================
function generateLetters() {
    lettersSection.innerHTML = "";
    let letters = [];

    // --- Inquiries ---
    inquiriesToChallenge.forEach(date => {
        letters.push(letterBox(`
📄 Dispute Letter – Unauthorized Inquiry (${date})

To Whom It May Concern,
I dispute the hard inquiry recorded on ${date}.
Provide a signed authorization form or remove it immediately.
        `));
    });

    // --- Personal Info ---
    personalInfoIssues.forEach(issue => {
        if (issue.type === "Multiple Names") {
            letters.push(letterBox(`
📄 Dispute Letter – Multiple Names

Names found on my report:
${issue.data.join(", ")}

Please remove any names not belonging to me.
            `));
        }

        if (issue.type === "Multiple Addresses") {
            letters.push(letterBox(`
📄 Dispute Letter – Multiple Addresses

Addresses found on my report:
${issue.data.join(", ")}

Remove any addresses that cannot be verified as mine.
            `));
        }

        if (issue.type === "Account Without Verification") {
            letters.push(letterBox(`
📄 Verification Request – Account: ${issue.account}

Provide full verification of this account, including signed contract and ID.
If unavailable, remove the account immediately.
            `));
        }
    });

    // --- Late Payments & Charge-Offs ---
    accounts.forEach(acc => {
        if (acc.latePayments.length > 0) {
            letters.push(letterBox(`
📄 Dispute Letter – Late Payments (${acc.name})

Reported late payments:
${acc.latePayments.join(", ")}

Provide verification or remove them.
            `));
        }

        if (acc.chargeOff) {
            letters.push(letterBox(`
📄 Dispute Letter – Charge-Off (${acc.name})

Provide full validation including contract, ID, and accounting.
If not available, remove this charge-off.
            `));
        }
    });

    lettersSection.innerHTML =
        letters.length ? letters.join("") : `<p>No disputable issues found.</p>`;
}

// ============================
// DOWNLOAD ALL LETTERS (TXT)
// ============================
function downloadAllLetters() {
    const text = lettersSection.innerText.trim();
    if (!text) return alert("No letters to download.");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "DisputeLetters.txt";
    a.click();

    URL.revokeObjectURL(url);
}

// ============================
// LETTER BOX HTML
// ============================
function letterBox(text) {
    return `
        <div style="
            background:#f8f9fa;
            padding:15px;
            margin:10px 0;
            border:2px solid #007bff;
            border-radius:8px;
            white-space:pre-wrap;
            font-family:monospace;">
            ${text.trim()}
        </div>
    `;
}
