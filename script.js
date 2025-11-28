// ============================
// PDF.js Worker Setup
// ============================
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

// DOM References
const fileInput = document.getElementById('fileInput');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const generateLettersBtn = document.getElementById('generateLettersBtn');
const downloadLettersBtn = document.getElementById('downloadLettersBtn');

const issuesList = document.getElementById('issuesList');
const inquiriesList = document.getElementById('inquiriesList');
const reportSection
