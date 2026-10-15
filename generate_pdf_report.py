import os
import sys
import base64
import subprocess
import shutil

def get_base64_image(image_path):
    if not os.path.exists(image_path):
        print(f"Warning: {image_path} does not exist.")
        return ""
    with open(image_path, "rb") as f:
        data = f.read()
    ext = os.path.splitext(image_path)[1].lower()
    mime = "image/png" if ext == ".png" else "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(data).decode('utf-8')}"

def main():
    workspace_dir = r"C:\Users\adria\Desktop\FYP_2026"
    artifact_dir = r"C:\Users\adria\.gemini\antigravity\brain\0c14942f-4bad-47bf-874a-33bdb3daeaf3"
    
    logo_path = os.path.join(workspace_dir, "hardware_docs", "sdas_unique_logo.png")
    master_diagram_path = os.path.join(workspace_dir, "hardware_docs", "sdas_master_circuit_diagram.jpg")
    xl4015_diagram_path = os.path.join(workspace_dir, "hardware_docs", "xl4015_power_routing_guide.jpg")
    
    print("Reading and encoding images...")
    logo_b64 = get_base64_image(logo_path)
    master_diag_b64 = get_base64_image(master_diagram_path)
    xl4015_diag_b64 = get_base64_image(xl4015_diagram_path)
    
    html_template_path = os.path.join(workspace_dir, "SDAS_Complete_Project_Documentation.html")
    with open(html_template_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    content = content.replace("__LOGO_B64__", logo_b64)
    content = content.replace("__MASTER_DIAG_B64__", master_diag_b64)
    content = content.replace("__XL4015_DIAG_B64__", xl4015_diag_b64)
    
    # Write back populated HTML
    with open(html_template_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    os.makedirs(artifact_dir, exist_ok=True)
    art_html_path = os.path.join(artifact_dir, "SDAS_Complete_Project_Documentation.html")
    with open(art_html_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    print("HTML documentation successfully prepared.")
    
    # Edge paths
    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    ]
    browser_exe = None
    for p in edge_paths:
        if os.path.exists(p):
            browser_exe = p
            break
            
    if not browser_exe:
        print("Error: No browser found.")
        sys.exit(1)
        
    pdf_path = os.path.join(workspace_dir, "SDAS_Complete_Project_Documentation.pdf")
    art_pdf_path = os.path.join(artifact_dir, "SDAS_Complete_Project_Documentation.pdf")
    
    print(f"Compiling PDF via {browser_exe}...")
    cmd = [
        browser_exe,
        "--headless",
        "--disable-gpu",
        "--run-all-compositor-stages-before-draw",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_path}",
        html_template_path
    ]
    
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0 and os.path.exists(pdf_path):
        size = os.path.getsize(pdf_path)
        print(f"SUCCESS: PDF generated at {pdf_path} (Size: {size:,} bytes)")
        shutil.copyfile(pdf_path, art_pdf_path)
        print(f"SUCCESS: PDF synced to artifact directory: {art_pdf_path}")
    else:
        print(f"Error compiling PDF: returncode={res.returncode}, stderr={res.stderr}")
        sys.exit(1)

if __name__ == "__main__":
    main()
