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
            // TXT FILE → Just read the contents
            reportText = e.target.result;
            processReportText();
        } 
        else if (file.name.endsWith('.pdf')) {
            // PDF FILE → Extract text using PDF.js
            extractPdfText(e.target.result);
        } 
        else {
            alert("Unsupported file type. Please upload a PDF or TXT file.");
        }
    };

    // Read file based on type
    if (file.name.endsWith('.txt')) {
        reader.readAsText(file);
    } else if (file.name.endsWith('.pdf')) {
        reader.readAsArrayBuffer(file); // Required for PDF
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
// Run Detection + Display Results
// ============================
function processReportText() {
    issues = [];
    inquiriesToChallenge = [];

    detectInaccuracies();
    extractInquiries();
    displayResults();
}

// ============================
// Inaccuracy Detection
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
// Inquiry Extraction
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
// Display Results in UI
// ============================
function displayResults() {
    document.getElementById('reportSection').style.display = 'block';

    const issuesList = document.getElementById('issuesList');
    issuesList.innerHTML = '';
    issues.forEach(i => {
        const li = document.createElement('li');
        li.textContent = i;
        issuesList.appendChild(li);
    });

    const inquiriesList = document.getElementById('inquiriesList');
    inquiriesList.innerHTML = '';
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

    inquiriesToChallenge.forEach(date => {
        const div = document.createElement('div');
        div.style.background = "#e9ecef";
        div.style.padding = "10px";
        div.style.margin = "5px 0";
        div.style.borderRadius = "5px";

        div.textContent = `Dispute Letter for inquiry on ${date}:

To Whom It May Concern,

I am writing to dispute a hard inquiry reported on ${date}. Under the Fair Credit Reporting Act (FCRA), I must give written permission for any hard inquiry on my credit file. I do not recognize or authorize this inquiry.

Please investigate this matter and remove the unauthorized inquiry immediately.

Sincerely,
[Your Name]`;

        lettersDiv.appendChild(div);
    });
}
