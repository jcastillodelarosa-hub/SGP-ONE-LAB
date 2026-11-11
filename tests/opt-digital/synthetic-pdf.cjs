// Synthetic only; includes inert-by-contract PDF JavaScript and URL annotations.
function pdf(){const objects=[
 '<< /Type /Catalog /Pages 2 0 R /OpenAction 7 0 R >>',
 '<< /Type /Pages /Kids [3 0 R 8 0 R] /Count 2 >>',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R /Annots [6 0 R] >>',
 '<< /Length 45 >>\nstream\nBT /F1 14 Tf 20 100 Td (Synthetic PDF) Tj ET\nendstream',
 '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
 '<< /Type /Annot /Subtype /Link /Rect [0 0 300 200] /A << /S /URI /URI (https://invalid.example/never) >> >>',
 '<< /S /JavaScript /JS (parent.__optFrameExecuted=true) >>',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>'];
 let body='%PDF-1.7\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(body));body+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
 const start=Buffer.byteLength(body);body+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;return Buffer.from(body);}
module.exports=pdf;
