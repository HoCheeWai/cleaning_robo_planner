/**
 * PDF Export service — generates a client-side PDF report of calculation results.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CalculatorInputs, CalculationResult } from '../types';
import { FIELD_METADATA } from '../types/defaults';

/**
 * Convert an SVG element to a PNG data URL by serializing it,
 * drawing onto a canvas, and extracting the image data.
 */
export function svgToDataUrl(svgElement: SVGElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const clone = svgElement.cloneNode(true) as SVGElement;
    const bbox = svgElement.getBoundingClientRect();
    const width = bbox.width || 700;
    const height = bbox.height || 200;

    // Set explicit dimensions on the clone
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const svgDataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

    const scale = 2; // 2x for crisp rendering
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
    ctx.scale(scale, scale);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('SVG rendering failed'));
    img.src = svgDataUri;
  });
}

/**
 * Generate a PDF report of the calculation results.
 * Returns a Blob that can be downloaded.
 */
export function generatePDF(
  inputs: CalculatorInputs,
  result: CalculationResult,
  comments: string,
  chartImages?: { timelineChart?: string; efficiencyGraph?: string }
): Blob {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Cleaning Robot Fleet Calculator — Report', margin, y);
  y += 8;

  // Date and mode
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 16).replace('T', ' ');
  const modeLabel = result.mode === 'time-constraint' ? 'Time Constraint Mode' : 'Robot Count Mode';
  const workModeLabel = inputs.work_assignment_mode === 'collaborative' ? 'Collaborative' : 'Fixed Zones';
  const startModeLabel = inputs.startMode === 'staggered' ? 'Staggered Start' : 'Simultaneous Start';
  doc.text(`Generated: ${dateStr} | Mode: ${modeLabel} | ${workModeLabel} | ${startModeLabel}`, margin, y);
  y += 10;

  // Primary Result
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  if (result.infeasible) {
    doc.setTextColor(200, 0, 0);
    doc.text('INFEASIBLE', margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(result.infeasibilityReason || 'Cannot complete within the time constraint.', margin, y);
    doc.setTextColor(0, 0, 0);
  } else if (result.mode === 'time-constraint') {
    doc.text(`Result: ${result.num_of_robots} robots required`, margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total elapsed time: ${result.total_elapsed_time.toFixed(1)} min (${(result.total_elapsed_time / 60).toFixed(1)} hrs)`, margin, y);
  } else {
    doc.text(`Result: ${result.total_elapsed_time.toFixed(1)} min (${(result.total_elapsed_time / 60).toFixed(1)} hrs)`, margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fleet size: ${result.num_of_robots} robots`, margin, y);
  }
  y += 6;
  doc.text(`Dead time: ${result.deadTime.total_dead_time.toFixed(1)} min (${result.deadTime.dead_time_pct.toFixed(1)}%)`, margin, y);
  y += 10;

  // Input Variables Table
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Input Variables', margin, y);
  y += 4;

  const inputRows: string[][] = [];
  for (const [key, value] of Object.entries(inputs)) {
    if (['mode', 'startMode', 'work_assignment_mode', 'comments'].includes(key)) continue;
    const meta = FIELD_METADATA[key];
    const label = meta?.label || key;
    const unit = meta?.unit || '';
    inputRows.push([label, String(typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value), unit]);
  }

  autoTable(doc, {
    startY: y,
    head: [['Variable', 'Value', 'Unit']],
    body: inputRows,
    margin: { left: margin },
    styles: { fontSize: 8 },
    headStyles: { fillColor: [43, 108, 176] },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Check if we need a new page
  if (y > 250) { doc.addPage(); y = margin; }

  // Breakdown Table
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Time Breakdown', margin, y);
  y += 4;

  const breakdownRows: string[][] = [
    ['Active Cleaning', `${result.contributions.active_cleaning_pct.toFixed(1)}%`],
    ['Charging Overhead', `${result.contributions.charging_overhead_pct.toFixed(1)}%`],
    ['Refill Overhead', `${result.contributions.refill_overhead_pct.toFixed(1)}%`],
    ['Travel Overhead', `${result.contributions.travel_overhead_pct.toFixed(1)}%`],
    ['Waiting/Contention', `${result.contributions.waiting_contention_pct.toFixed(1)}%`],
    ['Floor Distribution', `${result.contributions.floor_distribution_pct.toFixed(1)}%`],
    ['Field Buffer', `${(result.contributions as any).field_buffer_pct?.toFixed(1) || '0.0'}%`],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Component', 'Contribution']],
    body: breakdownRows,
    margin: { left: margin },
    styles: { fontSize: 9 },
    headStyles: { fillColor: [43, 108, 176] },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Optimization Suggestions
  if (result.optimizations.length > 0) {
    if (y > 250) { doc.addPage(); y = margin; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Optimization Opportunities', margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    for (const opt of result.optimizations) {
      doc.text(`• ${opt.label}: ${opt.suggestion}`, margin, y);
      y += 5;
    }
    y += 5;
  }

  // Robot Work Distribution
  if (result.timeline.length > 0) {
    if (y > 250) { doc.addPage(); y = margin; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Robot Work Distribution', margin, y);
    y += 4;

    const totalDist = result.derived.total_cleaning_distance;
    const robotRows = result.timeline.map(tl => [
      `Robot ${tl.robotIndex + 1}`,
      `${tl.totalCleaned.toFixed(0)} m`,
      `${(tl.totalCleaned / totalDist * 100).toFixed(1)}%`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Robot', 'Distance Cleaned', '% of Total']],
      body: robotRows,
      margin: { left: margin },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [43, 108, 176] },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Timeline Chart Image
  if (chartImages?.timelineChart) {
    if (y > 180) { doc.addPage(); y = margin; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Timeline (Gantt Chart)', margin, y);
    y += 5;
    // Explanatory note about raw vs buffered time
    const rawTime = (result.total_elapsed_time / inputs.field_buffer_multiplier).toFixed(1);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text(`Charts show raw simulation time (${rawTime} min). The reported elapsed time (${result.total_elapsed_time.toFixed(1)} min) includes the \u00d7${inputs.field_buffer_multiplier} field buffer.`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = imgWidth * (200 / 700); // maintain aspect ratio
    doc.addImage(chartImages.timelineChart, 'PNG', margin, y, imgWidth, imgHeight);
    y += imgHeight + 3;
    // Gantt chart legend
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const ganttLegend = [
      { color: [34, 197, 94], label: 'Cleaning' },
      { color: [59, 130, 246], label: 'Traveling' },
      { color: [234, 179, 8], label: 'Charging' },
      { color: [249, 115, 22], label: 'Waiting (Charge)' },
      { color: [168, 85, 247], label: 'Refilling' },
      { color: [239, 68, 68], label: 'Waiting (Refill)' },
      { color: [107, 114, 128], label: 'Elevator' },
      { color: [226, 232, 240], label: 'Idle' },
    ];
    let lx = margin;
    for (const item of ganttLegend) {
      doc.setFillColor(item.color[0], item.color[1], item.color[2]);
      doc.rect(lx, y, 3, 2.5, 'F');
      doc.text(item.label, lx + 4, y + 2);
      lx += doc.getTextWidth(item.label) + 7;
      if (lx > pageWidth - margin - 20) { lx = margin; y += 4; }
    }
    y += 7;
  }

  // Efficiency Graph Image
  if (chartImages?.efficiencyGraph) {
    if (y > 180) { doc.addPage(); y = margin; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Fleet Efficiency', margin, y);
    y += 4;
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = imgWidth * (200 / 700); // maintain aspect ratio
    doc.addImage(chartImages.efficiencyGraph, 'PNG', margin, y, imgWidth, imgHeight);
    y += imgHeight + 3;
    // Efficiency graph legend
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setDrawColor(249, 115, 22);
    doc.setLineWidth(0.5);
    doc.line(margin, y + 1.2, margin + 6, y + 1.2);
    doc.setDrawColor(0, 0, 0);
    doc.text('Fleet Utilization %', margin + 8, y + 2);
    const effLx1 = margin + 8 + doc.getTextWidth('Fleet Utilization %') + 5;
    doc.setDrawColor(37, 99, 235);
    doc.setLineDashPattern([1, 0.5], 0);
    doc.line(effLx1, y + 1.2, effLx1 + 6, y + 1.2);
    doc.setLineDashPattern([], 0);
    doc.setDrawColor(0, 0, 0);
    doc.text('Cumulative Progress %', effLx1 + 8, y + 2);
    const effLx2 = effLx1 + 8 + doc.getTextWidth('Cumulative Progress %') + 5;
    doc.setFillColor(254, 243, 199);
    doc.rect(effLx2, y, 4, 2.5, 'F');
    doc.text('Dead Time Zones', effLx2 + 5, y + 2);
    y += 10;
  }

  // Comments
  if (comments.trim()) {
    if (y > 250) { doc.addPage(); y = margin; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Comments / Notes', margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(comments, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 10;
  }

  // Assumptions & Limitations
  if (y > 220) { doc.addPage(); y = margin; }
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Assumptions & Limitations', margin, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const assumptions = [
    'Multi-floor buildings are modelled as a single combined work pool. The simulation accounts for initial elevator distribution time and service hub floor travel, but does not model robots moving between floors mid-job.',
    'Charging docks and refill stations are assumed to be co-located in a single service hub.',
    'All robots are identical (same speed, battery, tank capacity).',
    'The field buffer multiplier accounts for real-world inefficiencies (obstacles, navigation errors, maintenance) not explicitly modelled in the simulation.',
    'In Collaborative mode, work redistribution is instantaneous — no communication overhead between robots.',
  ];
  for (const assumption of assumptions) {
    const wrapped = doc.splitTextToSize(`• ${assumption}`, pageWidth - margin * 2);
    if (y + wrapped.length * 3.5 > 280) { doc.addPage(); y = margin; }
    doc.text(wrapped, margin, y);
    y += wrapped.length * 3.5 + 2;
  }

  // Generate filename is handled by getPDFFilename() externally

  return doc.output('blob');
}

/**
 * Get the formatted filename for the PDF export.
 */
export function getPDFFilename(): string {
  const now = new Date();
  return `fleet_calculation_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.pdf`;
}
