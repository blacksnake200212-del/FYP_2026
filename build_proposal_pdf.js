const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const workspaceDir = path.resolve(__dirname);
const artifactDir = 'C:\\Users\\adria\\.gemini\\antigravity\\brain\\0c14942f-4bad-47bf-874a-33bdb3daeaf3';
const proposalDir = path.join(workspaceDir, 'proposal_report');

function getBase64Image(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`File does not exist: ${filePath}`);
        return '';
    }
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${data.toString('base64')}`;
}

const logoB64 = getBase64Image(path.join(workspaceDir, 'hardware_docs', 'sdas_unique_logo.png'));
const masterDiagB64 = getBase64Image(path.join(workspaceDir, 'hardware_docs', 'sdas_master_circuit_diagram.jpg'));
const xl4015DiagB64 = getBase64Image(path.join(workspaceDir, 'hardware_docs', 'xl4015_power_routing_guide.jpg'));
const fritzingDiagB64 = getBase64Image(path.join(workspaceDir, 'hardware_docs', 'sdas_fritzing_circuit_diagram.jpg'));

const htmlTemplatePath = path.join(workspaceDir, 'SDAS_Project_Proposal_Report.html');
let htmlContent = fs.readFileSync(htmlTemplatePath, 'utf-8');

htmlContent = htmlContent.replace('__LOGO_B64__', logoB64);
htmlContent = htmlContent.replace('__MASTER_DIAG_B64__', masterDiagB64);
htmlContent = htmlContent.replace('__XL4015_DIAG_B64__', xl4015DiagB64);
htmlContent = htmlContent.replace('__FRITZING_DIAG_B64__', fritzingDiagB64);

// Write populated HTML to all target locations
const propHtmlOutputPath = path.join(proposalDir, 'SDAS_Project_Proposal_Report.html');
const artHtmlOutputPath = path.join(artifactDir, 'SDAS_Project_Proposal_Report.html');

fs.writeFileSync(htmlTemplatePath, htmlContent, 'utf-8');
fs.writeFileSync(propHtmlOutputPath, htmlContent, 'utf-8');
if (fs.existsSync(artifactDir)) {
    fs.writeFileSync(artHtmlOutputPath, htmlContent, 'utf-8');
}
console.log('HTML files successfully populated with embedded diagrams.');

// Edge browser path
const edgeExe = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
if (!fs.existsSync(edgeExe)) {
    console.error('Edge executable not found at: ' + edgeExe);
    process.exit(1);
}

const pdfOutputPath = path.join(workspaceDir, 'SDAS_Project_Proposal_Report.pdf');
const propPdfOutputPath = path.join(proposalDir, 'SDAS_Project_Proposal_Report.pdf');
const artPdfOutputPath = path.join(artifactDir, 'SDAS_Project_Proposal_Report.pdf');

console.log('Compiling PDF via Microsoft Edge...');
const args = [
    '--headless=new',
    '--disable-gpu',
    '--run-all-compositor-stages-before-draw',
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfOutputPath}`,
    htmlTemplatePath
];

const res = cp.spawnSync(edgeExe, args, { timeout: 45000 });
console.log('Edge process finished with exit code:', res.status);

if (fs.existsSync(pdfOutputPath)) {
    const stats = fs.statSync(pdfOutputPath);
    console.log(`PDF successfully generated! File size: ${stats.size.toLocaleString()} bytes`);
    
    // Copy to proposal_report and artifact directories
    fs.copyFileSync(pdfOutputPath, propPdfOutputPath);
    console.log(`Copied PDF to: ${propPdfOutputPath}`);
    
    if (fs.existsSync(artifactDir)) {
        fs.copyFileSync(pdfOutputPath, artPdfOutputPath);
        console.log(`Copied PDF to: ${artPdfOutputPath}`);
    }
} else {
    console.error('PDF generation failed: File was not created.');
    process.exit(1);
}
