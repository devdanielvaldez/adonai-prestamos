import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export const generateLoanDocumentation = async (loanId: string) => {
  try {
    // Fetch Loan
    const loanDoc = await getDoc(doc(db, 'loans', loanId));
    if (!loanDoc.exists()) throw new Error('Préstamo no encontrado');
    const loan = { id: loanDoc.id, ...loanDoc.data() } as any;

    // Fetch Client
    const clientDoc = await getDoc(doc(db, 'clients', loan.clientId));
    const client = clientDoc.exists() ? clientDoc.data() : null;

    // Fetch Loan Type
    const typeDoc = await getDoc(doc(db, 'loanTypes', loan.loanTypeId));
    const loanType = typeDoc.exists() ? typeDoc.data() : null;

    // Fetch Payments
    const paymentsQ = query(collection(db, 'payments'), where('loanId', '==', loanId));
    const paymentsSnap = await getDocs(paymentsQ);
    const payments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const docPDF = new jsPDF();
    
    // Header
    docPDF.setFontSize(20);
    docPDF.text('Documentación del Préstamo', 14, 22);
    
    docPDF.setFontSize(10);
    docPDF.setTextColor(100);
    docPDF.text(`ID del Préstamo: ${loan.id}`, 14, 30);
    docPDF.text(`Fecha de Solicitud: ${new Date(loan.createdAt).toLocaleDateString()}`, 14, 35);
    docPDF.text(`Estado: ${loan.status.toUpperCase()}`, 14, 40);

    // Client Details
    docPDF.setFontSize(14);
    docPDF.setTextColor(0);
    docPDF.text('Detalles del Cliente', 14, 55);
    
    autoTable(docPDF, {
      startY: 60,
      head: [['Campo', 'Valor']],
      body: [
        ['Nombre', loan.clientName || client?.name || 'N/A'],
        ['Documento', client?.documentId || 'N/A'],
        ['Teléfono', client?.phone || 'N/A'],
        ['Email', client?.email || 'N/A'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    // Loan Conditions
    const finalYClient = (docPDF as any).lastAutoTable.finalY || 60;
    docPDF.setFontSize(14);
    docPDF.text('Condiciones del Préstamo', 14, finalYClient + 15);

    autoTable(docPDF, {
      startY: finalYClient + 20,
      head: [['Campo', 'Valor']],
      body: [
        ['Tipo de Préstamo', loan.loanTypeName || 'N/A'],
        ['Frecuencia de Pago', loan.frequency || loanType?.frequency || 'Mensual'],
        ['Monto Solicitado', `$${loan.amount?.toLocaleString()}`],
        ['Tasa de Interés', `${loan.interestRate}%`],
        ['Tiempo (Cuotas)', loan.time],
        ['Días de Gracia', `${loan.graceDays} días`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    // Amortization Schedule (Basic calculation)
    const finalYConditions = (docPDF as any).lastAutoTable.finalY || finalYClient + 20;
    docPDF.setFontSize(14);
    docPDF.text('Tabla de Amortización (Estimada)', 14, finalYConditions + 15);

    const amount = Number(loan.amount);
    const rate = Number(loan.interestRate) / 100;
    const time = Number(loan.time);
    
    let amortizationBody = [];
    if (amount && rate && time) {
      // Simple calculation (can be adjusted based on actual formula used in the app)
      const payment = (amount * rate) / (1 - Math.pow(1 + rate, -time));
      let balance = amount;
      
      for (let i = 1; i <= time; i++) {
        const interest = balance * rate;
        const principal = payment - interest;
        balance -= principal;
        amortizationBody.push([
          i.toString(),
          `$${payment.toFixed(2)}`,
          `$${principal.toFixed(2)}`,
          `$${interest.toFixed(2)}`,
          `$${Math.max(0, balance).toFixed(2)}`
        ]);
      }
    }

    autoTable(docPDF, {
      startY: finalYConditions + 20,
      head: [['Cuota', 'Pago', 'Capital', 'Interés', 'Saldo']],
      body: amortizationBody.length > 0 ? amortizationBody : [['N/A', 'N/A', 'N/A', 'N/A', 'N/A']],
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }
    });

    // Payments
    const finalYAmortization = (docPDF as any).lastAutoTable.finalY || finalYConditions + 20;
    
    if (finalYAmortization > 250) {
      docPDF.addPage();
    }
    
    const currentY = finalYAmortization > 250 ? 20 : finalYAmortization + 15;
    
    docPDF.setFontSize(14);
    docPDF.text('Historial de Pagos', 14, currentY);

    const paymentsBody = payments.map((p: any) => [
      new Date(p.date).toLocaleDateString(),
      `$${p.amount.toLocaleString()}`,
      p.method || 'N/A',
      p.reference || 'N/A'
    ]);

    autoTable(docPDF, {
      startY: currentY + 5,
      head: [['Fecha', 'Monto', 'Método', 'Referencia']],
      body: paymentsBody.length > 0 ? paymentsBody : [['No hay pagos registrados', '', '', '']],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    // Contract details
    if (loan.contractSigned) {
      docPDF.addPage();
      docPDF.setFontSize(14);
      docPDF.text('Estado del Contrato', 14, 20);
      
      docPDF.setFontSize(10);
      docPDF.text(`Contrato firmado el: ${new Date(loan.contractSignedAt).toLocaleString()}`, 14, 30);
      
      let contractContent = '';
      if (loan.contractData?.templateId) {
        const templateDoc = await getDoc(doc(db, 'contracts', loan.contractData.templateId));
        if (templateDoc.exists()) {
          let content = templateDoc.data().content;
          const contractData = loan.contractData || {};
          
          // Replace system variables
          content = content.replace(/\{\{cliente_nombre\}\}/g, `${client?.firstName || ''} ${client?.lastName || ''}`);
          content = content.replace(/\{\{cliente_cedula\}\}/g, client?.documentId || '');
          content = content.replace(/\{\{prestamo_monto\}\}/g, `$${loan.amount?.toLocaleString()}`);
          content = content.replace(/\{\{fecha_actual\}\}/g, new Date(loan.contractSignedAt || loan.createdAt).toLocaleDateString());

          // Replace client fields
          const clientValues = contractData.clientValues || {};
          let clientIndex = 0;
          content = content.replace(/\[cliente:(.*?)\]/g, (match: string, fieldName: string) => {
            if (fieldName.endsWith('_Admin')) return match;
            const uniqueFieldId = `${fieldName}_${clientIndex++}`;
            return clientValues[uniqueFieldId] || '';
          });

          // Replace admin fields
          const adminValues = contractData.adminValues || {};
          let adminIndex = 0;
          content = content.replace(/\[admin:(.*?)\]|\[cliente:(.*?_Admin)\]/g, (match: string, g1: string, g2: string) => {
            const fieldName = g1 || g2;
            const uniqueFieldId = `${fieldName}_${adminIndex++}`;
            return adminValues[uniqueFieldId] || '';
          });

          // Remove signature placeholders for text extraction
          content = content.replace(/\[firma:(.*?)\]/g, '');
          
          contractContent = content;
        }
      }

      if (contractContent) {
        docPDF.text('Contenido del Contrato:', 14, 45);
        
        // Strip HTML tags from contract content for PDF
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = contractContent;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        
        const splitText = docPDF.splitTextToSize(textContent, 180);
        docPDF.text(splitText, 14, 55);
      }
    }

    docPDF.save(`Documentacion_Prestamo_${loan.id}.pdf`);
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error al generar la documentación en PDF');
    return false;
  }
};

export const generateAmortizationPDF = async (loanId: string, amortizationSchedule: any[]) => {
  try {
    const loanDoc = await getDoc(doc(db, 'loans', loanId));
    if (!loanDoc.exists()) throw new Error('Préstamo no encontrado');
    const loan = { id: loanDoc.id, ...loanDoc.data() } as any;

    const clientDoc = await getDoc(doc(db, 'clients', loan.clientId));
    const client = clientDoc.exists() ? clientDoc.data() : null;

    const docPDF = new jsPDF();
    
    // Header
    docPDF.setFontSize(20);
    docPDF.text('Tabla de Amortización', 14, 22);
    
    docPDF.setFontSize(10);
    docPDF.setTextColor(100);
    docPDF.text(`ID del Préstamo: ${loan.id}`, 14, 30);
    docPDF.text(`Cliente: ${loan.clientName || client?.name || 'N/A'}`, 14, 35);
    docPDF.text(`Monto: $${loan.amount?.toLocaleString()}`, 14, 40);

    const body = amortizationSchedule.map(row => [
      row.period.toString(),
      new Date(row.date).toLocaleDateString(),
      `$${row.payment.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
      `$${row.interest.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
      `$${row.principal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
      `$${row.balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
    ]);

    autoTable(docPDF, {
      startY: 50,
      head: [['Cuota', 'Fecha Estimada', 'Monto Cuota', 'Interés', 'Capital', 'Saldo Restante']],
      body: body,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }
    });

    docPDF.save(`Amortizacion_${loan.id}.pdf`);
    return true;
  } catch (error) {
    console.error('Error generating amortization PDF:', error);
    alert('Error al generar la tabla de amortización');
    return false;
  }
};

export const generatePaymentReceipt = async (paymentId: string) => {
  try {
    // Fetch Payment
    const paymentDoc = await getDoc(doc(db, 'payments', paymentId));
    if (!paymentDoc.exists()) throw new Error('Pago no encontrado');
    const payment = { id: paymentDoc.id, ...paymentDoc.data() } as any;

    // Fetch Loan
    const loanDoc = await getDoc(doc(db, 'loans', payment.loanId));
    const loan = loanDoc.exists() ? { id: loanDoc.id, ...loanDoc.data() } as any : null;

    // Fetch Client
    const clientDoc = await getDoc(doc(db, 'clients', payment.clientId));
    const client = clientDoc.exists() ? clientDoc.data() : null;

    const docPDF = new jsPDF();
    
    // Header
    docPDF.setFillColor(79, 70, 229); // Indigo 600
    docPDF.rect(0, 0, 210, 40, 'F');
    
    docPDF.setTextColor(255, 255, 255);
    docPDF.setFontSize(24);
    docPDF.setFont('helvetica', 'bold');
    docPDF.text('RECIBO DE PAGO', 14, 25);
    
    docPDF.setFontSize(12);
    docPDF.setFont('helvetica', 'normal');
    docPDF.text(`Nº ${payment.id.substring(0, 8).toUpperCase()}`, 150, 25);

    // Company Info (Placeholder)
    docPDF.setTextColor(0, 0, 0);
    docPDF.setFontSize(10);
    docPDF.setFont('helvetica', 'bold');
    docPDF.text('Tu Empresa de Préstamos', 14, 50);
    docPDF.setFont('helvetica', 'normal');
    docPDF.text('info@tuempresa.com', 14, 55);
    docPDF.text('Tel: +1 234 567 890', 14, 60);

    // Payment Details Box
    docPDF.setDrawColor(200, 200, 200);
    docPDF.setFillColor(248, 250, 252); // Slate 50
    docPDF.roundedRect(14, 70, 182, 35, 3, 3, 'FD');

    docPDF.setFontSize(11);
    docPDF.setFont('helvetica', 'bold');
    docPDF.text('Fecha de Pago:', 20, 80);
    docPDF.setFont('helvetica', 'normal');
    docPDF.text(new Date(payment.date).toLocaleString(), 60, 80);

    docPDF.setFont('helvetica', 'bold');
    docPDF.text('Método:', 20, 90);
    docPDF.setFont('helvetica', 'normal');
    docPDF.text(payment.method ? payment.method.toUpperCase() : 'N/A', 60, 90);

    docPDF.setFont('helvetica', 'bold');
    docPDF.text('Referencia:', 20, 100);
    docPDF.setFont('helvetica', 'normal');
    docPDF.text(payment.reference || 'N/A', 60, 100);

    // Amount Box
    docPDF.setFillColor(236, 253, 245); // Emerald 50
    docPDF.setDrawColor(16, 185, 129); // Emerald 500
    docPDF.roundedRect(120, 75, 70, 25, 3, 3, 'FD');
    
    docPDF.setTextColor(6, 78, 59); // Emerald 900
    docPDF.setFontSize(12);
    docPDF.setFont('helvetica', 'bold');
    docPDF.text('MONTO PAGADO', 125, 85);
    docPDF.setFontSize(18);
    docPDF.text(`$${Number(payment.amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 125, 95);

    // Client & Loan Details
    docPDF.setTextColor(0, 0, 0);
    docPDF.setFontSize(14);
    docPDF.setFont('helvetica', 'bold');
    docPDF.text('Detalles del Cliente y Préstamo', 14, 125);

    autoTable(docPDF, {
      startY: 130,
      head: [['Concepto', 'Detalle']],
      body: [
        ['Cliente', client ? `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.name : 'N/A'],
        ['Documento', client?.documentId || 'N/A'],
        ['ID Préstamo', loan?.id || payment.loanId || 'N/A'],
        ['Tipo de Préstamo', loan?.loanTypeName || 'N/A'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 11, cellPadding: 5 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { cellWidth: 122 }
      }
    });

    // Footer
    const finalY = (docPDF as any).lastAutoTable.finalY || 180;
    
    docPDF.setFontSize(10);
    docPDF.setTextColor(100, 100, 100);
    docPDF.setFont('helvetica', 'italic');
    docPDF.text('Este documento es un comprobante válido de pago.', 105, finalY + 30, { align: 'center' });
    docPDF.text('Gracias por su pago.', 105, finalY + 36, { align: 'center' });

    // Status Stamp
    if (payment.status === 'aprobado') {
      docPDF.setTextColor(16, 185, 129); // Emerald 500
      docPDF.setFontSize(24);
      docPDF.setFont('helvetica', 'bold');
      // Rotate text for a "stamp" effect
      docPDF.text('APROBADO', 105, finalY + 15, { align: 'center', angle: -15 });
    }

    docPDF.save(`Recibo_Pago_${payment.id.substring(0, 8)}.pdf`);
    return true;
  } catch (error) {
    console.error('Error generating payment receipt:', error);
    alert('Error al generar el recibo de pago');
    return false;
  }
};
