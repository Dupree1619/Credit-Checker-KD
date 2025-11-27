// ============================
// PDF.js Worker Setup
// ============================
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
document.getElementById('downloadAllBtn').addEventListener('click', () => {
    console.log('Download button clicked — PDF logic not implemented yet');
});
document.getElementById('analyzeBtn').addEventListener('click', analyzeReport);
document.getElementById('generateLettersBtn').addEventListener('click', generateLetters);

let reportText = '';
let issues = [];
let inquiriesToChallenge = [];
let accounts = [];
let personalInfoIssues = [];

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
// Process Full Report Text
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
// Detect General Errors
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
// Extract Accounts (Late, Charge-off, Unverified)
// ============================
function extractAccounts() {
    const accountRegex = /Account Name[: ]*(.*?)\n([\s\S]*?)(?=Account Name|$)/gi;
    let match;

    while ((match = accountRegex.exec(reportText)) !== null) {
        const block = match[2];
        const name = match[1].trim();

        const lateMatch = block.match(/(\d{2,3}) Days Late/gi) || [];
        const chargeOffMatch = block.match(/Charge[- ]?Off/gi);
        const statusMatch = block.match(/Status[: ]*(.*)/i);

        accounts.push({
            name: name,
            status: statusMatch ? statusMatch[1].trim() : "",
            latePayments: lateMatch.map(x => x.trim()),
            chargeOff: chargeOffMatch ? true : false
        });
    }
}

// ============================
// Detect Multiple Names & Addresses & Unverified Accounts
// ============================
function detectPersonalInfoIssues() {
    const nameRegex = /Name[: ]*(.*?)\n/g;
    const addressRegex = /Address[: ]*(.*?)\n/g;

    let names = new Set();
    let addresses = new Set();
    let match;

    while ((match = nameRegex.exec(reportText)) !== null) {
        names.add(match[1].trim());
    }
    while ((match = addressRegex.exec(reportText)) !== null) {
        addresses.add(match[1].trim());
    }

    if (names.size > 1) {
        personalInfoIssues.push({ type: "Multiple Names", data: Array.from(names) });
    }
    if (addresses.size > 1) {
        personalInfoIssues.push({ type: "Multiple Addresses", data: Array.from(addresses) });
    }

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
// Display Results
// ============================
function displayResults() {
    document.getElementById('reportSection').style.display = 'block';

    const issuesList = document.getElementById('issuesList');
    issuesList.innerHTML = "";
    issues.forEach(i => {
        const li = document.createElement('li');
        li.textContent = i;
        issuesList.appendChild(li);
    });

    const inquiriesList = document.getElementById('inquiriesList');
    inquiriesList.innerHTML = "";
    inquiriesToChallenge.forEach(i => {
        const li = document.createElement('li');
        li.textContent = i;
        inquiriesList.appendChild(li);
    });
}

// ============================
// Generate Dispute Letters
// ============================
function generateLetters() {
    const lettersDiv = document.getElementById('lettersSection');
    lettersDiv.innerHTML = '';

    let actionableItems = false;

    // ---- HARD INQUIRIES ----
    inquiriesToChallenge.forEach(date => {
        actionableItems = true;

        const div = createLetterBox(`
📄 **Dispute Letter – Unauthorized Inquiry (${date})**

To Whom It May Concern,

I am disputing the hard inquiry reported on ${date}. I did not authorize or give written consent for this inquiry.  
Under the FCRA, you must furnish **a hard-copy record of my signature and identification** used to obtain my credit file.

If you cannot provide this documentation, remove this inquiry immediately.

Sincerely,  
[Your Name]
        `);

        lettersDiv.appendChild(div);
    });

    // ---- PERSONAL INFO ISSUES ----
    personalInfoIssues.forEach(issue => {
        actionableItems = true;

        let content = "";

        if (issue.type === "Multiple Names") {
            content = `
📄 **Dispute Letter – Multiple Names Reported**

To Whom It May Concern,

The following names are appearing on my credit report:  
${issue.data.join(", ")}  

I request verification of each name, including **any application, signature, or ID** connected to them.  
Remove any names that cannot be verified with supporting documents.

Sincerely,  
[Your Name]
            `;
        }

        if (issue.type === "Multiple Addresses") {
            content = `
📄 **Dispute Letter – Multiple Addresses Reported**

To Whom It May Concern,

Multiple addresses were found on my credit file:  
${issue.data.join(", ")}  

Please provide documentation linking me to these addresses or remove any unverifiable addresses immediately.

Sincerely,  
[Your Name]
            `;
        }

        if (issue.type === "Account Without Verification") {
            content = `
📄 **Verification Request – Unverified Account ("${issue.account}")**

To Whom It May Concern,

I am requesting verification for the account "${issue.account}".  
Under the FCRA, you are required to maintain proof of authorization.

Provide:
• A hard-copy of the original application  
• My handwritten signature  
• Identification used at the time of opening  
• Any documents proving contractual relationship  

If you cannot produce these documents, remove this account from my credit file immediately.

Sincerely,  
[Your Name]
            `;
        }

        lettersDiv.appendChild(createLetterBox(content));
    });

    // ---- LATE PAYMENTS & CHARGE-OFFS ----
    accounts.forEach(acc => {
        // Late Payments
        if (acc.latePayments.length > 0) {
            actionableItems = true;

            lettersDiv.appendChild(createLetterBox(`
📄 **Dispute Letter – Late Payments ("${acc.name}")**

To Whom It May Concern,

I dispute the following late payments reported for "${acc.name}":  
${acc.latePayments.join(", ")}

Provide full verification, including:
• A hard-copy of the original signed agreement  
• Payment history records  
• Identification used to open the account  
• Proof that I was actually late  

If you cannot verify this information, remove these late payments immediately.

Sincerely,  
[Your Name]
            `));
        }

        // Charge-Offs
        if (acc.chargeOff) {
            actionableItems = true;

            lettersDiv.appendChild(createLetterBox(`
📄 **Dispute Letter – Charge-Off ("${acc.name}")**

To Whom It May Concern,

I dispute the reported charge-off for the account "${acc.name}".  
Provide full validation including:

• Hard-copy of my signed contract  
• Identification used to open the account  
• Proof of ownership of the debt  
• Complete accounting and itemization  
• Charge-off calculation records  

If you cannot verify this charge-off with legally required documents, remove it immediately.

Sincerely,  
[Your Name]
            `));
        }
    });

    if (!actionableItems) {
        lettersDiv.innerHTML =
            "<p style='color:red; font-weight:bold;'>No actionable items found. No letters generated.</p>";
    }
}

// ============================
// Helper – Letter Box Styling
// ============================
function createLetterBox(text) {
    const div = document.createElement('div');
    div.style.background = "#f8f9fa";
    div.style.padding = "15px";
    div.style.margin = "10px 0";
    div.style.border = "2px solid #007bff";
    div.style.borderRadius = "8px";
    div.style.whiteSpace = "pre-wrap";
    div.style.fontFamily = "monospace";
    div.textContent = text.trim();
    return div;
}
