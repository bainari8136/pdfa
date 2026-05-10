import { PDFDocument, degrees } from 'pdf-lib';
import mammoth from 'mammoth';
import { marked } from 'marked';
import { jsPDF } from 'jspdf';
import DOMPurify from 'dompurify';
import html2canvas from 'html2canvas';

export async function mergePDFs(pdfBuffers: ArrayBuffer[]): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();
  for (const buffer of pdfBuffers) {
    const pdf = await PDFDocument.load(buffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  return await mergedPdf.save();
}

export async function splitPDF(pdfBuffer: ArrayBuffer): Promise<Uint8Array[]> {
  const pdf = await PDFDocument.load(pdfBuffer);
  const pageCount = pdf.getPageCount();
  const splitPdfs: Uint8Array[] = [];

  for (let i = 0; i < pageCount; i++) {
    const newPdf = await PDFDocument.create();
    const [page] = await newPdf.copyPages(pdf, [i]);
    newPdf.addPage(page);
    splitPdfs.push(await newPdf.save());
  }
  return splitPdfs;
}

export async function rotatePDF(pdfBuffer: ArrayBuffer, rotation: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBuffer);
  const pages = pdf.getPages();
  pages.forEach((page) => {
    const currentRotation = page.getRotation().angle;
    page.setRotation(degrees(currentRotation + rotation));
  });
  return await pdf.save();
}

export async function imagesToPDF(imageBuffers: { data: ArrayBuffer, type: string }[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  for (const img of imageBuffers) {
    let embeddedImage;
    if (img.type === 'image/jpeg' || img.type === 'image/jpg') {
      embeddedImage = await pdfDoc.embedJpg(img.data);
    } else if (img.type === 'image/png') {
      embeddedImage = await pdfDoc.embedPng(img.data);
    } else {
      continue;
    }

    const { width, height } = embeddedImage.scale(1);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }
  return await pdfDoc.save();
}

export async function docxToPDF(buffer: ArrayBuffer): Promise<Uint8Array> {
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  const html = result.value;
  return await htmlToPDF(html);
}

export async function mdToPDF(markdown: string): Promise<Uint8Array> {
  const html = await marked.parse(markdown);
  const cleanHtml = DOMPurify.sanitize(html);
  return await htmlToPDF(cleanHtml);
}

async function htmlToPDF(html: string): Promise<Uint8Array> {
  // Create a hidden container for rendering
  const container = document.createElement('div');
  container.className = 'markdown-body';
  container.style.width = '800px';
  container.style.padding = '40px';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.fontSize = '12pt';
  container.style.lineHeight = '1.6';
  container.style.fontFamily = 'Inter, sans-serif';
  container.style.color = '#333';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'pt',
      format: 'a4',
    });

    await doc.html(container, {
      margin: [40, 40, 40, 40],
      autoPaging: 'text',
      x: 0,
      y: 0,
      html2canvas: {
        scale: 1,
        useCORS: true,
        logging: false,
      },
    });

    const pdfOutput = doc.output('arraybuffer');
    return new Uint8Array(pdfOutput);
  } finally {
    document.body.removeChild(container);
  }
}
