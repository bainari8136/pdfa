import { PDFDocument, degrees } from 'pdf-lib';

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
