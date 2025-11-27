// ============================
// PDF.js Worker Setup
// ============================
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

document.getElementById('analyzeBtn').addEventListener('click', analyzeReport);
document.getElementById('generateLettersBtn').addEventListener('click', generateLetters);

let reportText = '';
let issues = [];
let inquiriesToChallenge = [];
let accounts = []; // Will hold account info including late payments, charge-offs
let personalInfoIssues = []; // Multiple names, addresses, or unverified accounts

// ============================
// Analyze Report
// ============================
function analyzeReport() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files[0]) {
        alert("Please select a file first.");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        if (file.name.endsWith('.txt')) {
            reportText = e.target.result;
            processReportText();
        } else if (file.name.endsWith('.pdf')) {
            extractPdfText(e.target.result);
        } else {
            alert("Unsupported file type. Please upload a PDF or TXT file.");
        }
    };

    if (file.name.endsWith('.txt')) {
        reader.readAsText(file);
    } else if (file.name.endsWith('.pdf')) {
        reader.readAsArrayBuffer(file);
    }
}

// ============================
// PDF → Text Extraction
// ============================
function extractPdfText(arrayBuffer) {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });

    loadingTask.promise.then(async function(pdf) {
        let fullText = "";

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(" ");
            fullText += pageText + "\n\n";
        }

        reportText = fullText;
        processReportText();
    }).catch(err => {
        console.error("PDF parsing error:", err);
        alert("Unable to read the PDF. Try converting it to TXT.");
    });
}

// ============================
// Process Report Text
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
// Detect Inaccuracies
// ============================
function detectInaccuracies() {
    if (reportText.includes("000-00-0000")) {
        issues.push("Invalid SSN detected.");
    }

    if (reportText.includes("??") || reportText.length < 100) {
        issues.push("Unreadable sections detected.");
    }

    if (reportText.includes("30 Days Late") && reportText.includes("Status: Current")) {
        issues.push("Status conflict detected.");
    }
}

// ============================
// Extract Inquiries
// ============================
function extractInquiries() {
    const inquiryRegex = /Inquiry.*?Date[: ]*(\d{1,2}\/\d{1,2}\/\d{2,4})/g;
    let match;
    const now = new Date();
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(now.getMonth() - 4);

    while ((match = inquiryRegex.exec(reportText)) !== null) {
        const date = new Date(match[1]);
        if (date < fourMonthsAgo) {
            inquiriesToChallenge.push(match[1]);
        }
    }
}

// ============================
// Extract Accounts, Late Payments & Charge-Offs
// ============================
function extractAccounts() {
    const accountRegex = /Account Name[: ]*(.*?)\n.*?(Status[: ]*(.*?))\n.*?(30|60|90|120)\s*Days Late.*?\n.*?(Charge[- ]Off[: ]*(Paid|Unpaid)?)/gi;
    let match;
    while ((match = accountRegex.exec(reportText)) !== null) {
        const name = match[1].trim();
        const status = match[3] ? match[3].trim() : '';
        const late = match[4] ? [match[4] + " Days Late"] : [];
        const chargeOff = match[6] ? true : false;

        accounts.push({
            name: name,
            status: status,
            latePayments: late,
            chargeOff: chargeOff
        });
    }
}

// ============================
// Detect Multiple Names / Addresses / Unverified Accounts
// ============================
function detectPersonalInfoIssues() {
    const nameRegex = /Name[: ]*(.*?)\n/g;
    const addressRegex = /Address[: ]*(.*?)\n/g;
    let names = new Set(), addresses = new Set();
    let match;

    while ((match = nameRegex.exec(reportText)) !== null) {
        names.add(match[1].trim());
    }
    while ((match = addressRegex.exec(reportText)) !== null) {
        addresses.add(match[1].trim());
    }

    if (names.size > 1) {
        personalInfoIssues.push({ type: 'Multiple Names', data: Array.from(names) });
    }
    if (addresses.size > 1) {
        personalInfoIssues.push({ type: 'Multiple Addresses', data: Array.from(addresses) });
    }

    // Detect unverified accounts
    accounts.forEach(acc => {
        if (!acc.status || acc.status.toLowerCase() === "unverified") {
            personalInfoIssues.push({ type: 'Account Without Verification', account: acc.name });
        }
    });
}

// ============================
// Display Results in UI
// ============================
function displayResults() {
    const reportSection = document.getElementById('reportSection');
    reportSection.style.display = 'block';
    reportSection.scrollIntoView({ behavior: "smooth" });

    // Detected Issues
    const issuesList = document.getElementById('issuesList');
    issuesList.innerHTML = '';
    if (issues.length === 0) {
        const li = document.createElement('li');
        li.textContent = "No issues detected in this report.";
        li.style.color = "green";
        li.style.fontWeight = "bold";
        issuesList.appendChild(li);
    } else {
        issues.forEach(i => {
            const li = document.createElement('li');
            li.textContent = i;
            li.style.fontFamily = "monospace";
            li.style.marginBottom = "5px";
            issuesList.appendChild(li);
        });
    }

    // Inquiries to Challenge
    const inquiriesList = document.getElementById('inquiriesList');
    inquiriesList.innerHTML = '';
    if (inquiriesToChallenge.length === 0) {
        const li = document.createElement('li');
        li.textContent = "No inquiries older than 4 months to challenge.";
        li.style.color = "gray";
        inquiriesList.appendChild(li);
    } else {
        inquiriesToChallenge.forEach(i => {
            const li = document.createElement('li');
            li.textContent = i;
            li.style.fontFamily = "monospace";
            inquiriesList.appendChild(li);
        });
    }
}

// ============================
// Generate Dispute Letters
// ============================
function generateLetters() {
    const lettersDiv = document.getElementById('lettersSection');
    lettersDiv.innerHTML = '';

    let actionableItems = false;

    // Inquiries older than 4 months
    inquiriesToChallenge.forEach(date => {
        actionableItems = true;
        const div = document.createElement('div');
        div.style.background = "#e9ecef";
        div.style.padding = "15px";
        div.style.margin = "10px 0";
        div.style.border = "2px solid #007bff";
        div.style.borderRadius = "8px";
        div.style.whiteSpace = "pre-wrap";
        div.textContent = `📄 Dispute Letter for inquiry on ${date}:

To Whom It May Concern,

I am writing to dispute a hard inquiry reported on ${date}. Under the Fair Credit Reporting Act (FCRA), I must give written permission for any hard inquiry on my credit file. I do not recognize or authorize this inquiry.

Please investigate this matter and remove the unauthorized inquiry immediately.

Sincerely,
[Your Name]`;
        lettersDiv.appendChild(div);
    });

    // Accounts without verification / multiple names / addresses
    personalInfoIssues.forEach(issue => {
        actionableItems = true;
        const div = document.createElement('div');
        div.style.background = "#fce4e4";
        div.style.padding = "15px";
        div.style.margin = "10px 0";
        div.style.border = "2px solid #ff0000";
        div.style.borderRadius = "8px";
        div.style.whiteSpace = "pre-wrap";

        if(issue.type === 'Account Without Verification') {
            div.textContent = `📄 Verification Request for account "${issue.account}":

To Whom It May Concern,

I am writing regarding the account "${issue.account}". I do not recall authorizing this account. Under the FCRA, you are required to provide documentation proving my authorization to open this account.

Please provide verification immediately or remove this account from my credit file.

Sincerely,
[Your Name]`;
        } else if(issue.type === 'Multiple Names') {
            div.textContent = `📄 Multiple Names Detected:

To Whom It May Concern,

Multiple names were detected on my credit report: ${issue.data.join(', ')}. Please verify and ensure all names are accurate and authorized.

Sincerely,
[Your Name]`;
        } else if(issue.type === 'Multiple Addresses') {
            div.textContent = `📄 Multiple Addresses Detected:

To Whom It May Concern,

Multiple addresses were detected on my credit report: ${issue.data.join(', ')}. Please verify and ensure all addresses are accurate.

Sincerely,
[Your Name]`;
        }

        lettersDiv.appendChild(div);
    });

    // Late Payments & Charge-Offs
    accounts.forEach(acc => {
        if (acc.latePayments.length > 0) {
            actionableItems = true;
            const div = document.createElement('div');
            div.style.background = "#fff8e1";
            div.style.padding = "15px";
            div.style.margin = "10px 0";
            div.style.border = "2px solid #ffb300";
            div.style.borderRadius = "8px";
            div.style.whiteSpace = "pre-wrap";
            div.textContent = `📄 Dispute Letter for late payments on account "${acc.name}":

To Whom It May Concern,

I am writing to dispute the following reported late payments on my account "${acc.name}": ${acc.latePayments.join(', ')}. Please provide documentation to verify the accuracy of these reported delinquencies. Under the FCRA, I have the right to dispute inaccurate or unverified information.

If you cannot provide verification, please correct or remove these late payments from my credit file immediately.

Sincerely,
[Your Name]`;
            lettersDiv.appendChild(div);
        }

        if (acc.chargeOff) {
            actionableItems = true;
            const div = document.createElement('div');
            div.style.background = "#ffecec";
            div.style.padding = "15px";
            div.style.margin = "10px 0";
            div.style.border = "2px solid #ff0000";
            div.style.borderRadius = "8px";
            div.style.whiteSpace = "pre-wrap";
            div.textContent = `📄 Dispute Letter for charge-off on account "${acc.name}":

To Whom It May Concern,

I am disputing the reported charge-off for the account "${acc.name}". Please provide all documentation proving the validity and balance of this debt. If you cannot verify, this information must be corrected or removed from my credit report as required by the Fair Credit Reporting Act (FCRA).

Sincerely,
[Your Name]`;
            lettersDiv.appendChild(div);
        }
    });

    if (!actionableItems) {
        lettersDiv.innerHTML = "<p style='color:red; font-weight:bold;'>No actionable items found. No letters generated.</p>";
    }

    lettersDiv.style.display = 'block';
    lettersDiv.scrollIntoView({ behavior: "smooth" });
}

