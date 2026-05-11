# Bugfix Requirements Document

## Introduction

The PDF export feature (`generatePDF` in `src/services/pdfExport.ts`) omits the Gantt timeline chart and the efficiency graph from the exported report. The original application requirements (Req 11.12 and Req 11.17) explicitly mandate that both charts be included in the PDF export. Currently, the PDF contains only text-based tables (input variables, time breakdown, optimization opportunities, robot work distribution) with no visual chart representations.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the user exports a PDF report and the calculation result contains timeline data (Gantt chart is rendered on screen) THEN the system generates a PDF that does not include any visual representation of the Gantt timeline chart

1.2 WHEN the user exports a PDF report and the calculation result contains efficiency data (efficiency graph is rendered on screen) THEN the system generates a PDF that does not include any visual representation of the efficiency graph

1.3 WHEN the user exports a PDF report with both charts visible on screen THEN the system produces a PDF containing only text tables with no chart images

### Expected Behavior (Correct)

2.1 WHEN the user exports a PDF report and the calculation result contains timeline data THEN the system SHALL include a visual image of the Gantt timeline chart in the exported PDF, with a color-coded legend identifying each activity type (Cleaning, Traveling, Charging, Waiting, Refilling, Elevator, Idle)

2.2 WHEN the user exports a PDF report and the calculation result contains efficiency data THEN the system SHALL include a visual image of the efficiency graph in the exported PDF, with a legend identifying Fleet Utilization %, Cumulative Progress %, and Dead Time Zones

2.3 WHEN the user exports a PDF report with both charts visible on screen THEN the system SHALL produce a PDF containing both chart images with legends, in addition to the existing text tables

2.4 WHEN the user exports a PDF report THEN the PDF section ordering SHALL match the web display: Primary Result → Input Variables → Time Breakdown → Optimizations → Robot Work Distribution → Gantt Chart (with explanatory note about raw vs buffered time) → Efficiency Graph → Comments → Assumptions & Limitations

2.5 WHEN the user exports a PDF report THEN the system SHALL include the explanatory note "Charts show raw simulation time (X min). The reported elapsed time (Y min) includes the ×Z field buffer." above the Gantt chart image

2.6 WHEN the user exports a PDF report THEN the system SHALL include the "Assumptions & Limitations" section with all assumptions shown on the web

2.7 WHEN the user exports a PDF report THEN the Time Breakdown table SHALL include all components shown on the web, including the "Field Buffer" row

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user exports a PDF report THEN the system SHALL CONTINUE TO include the input variables table in the PDF

3.2 WHEN the user exports a PDF report THEN the system SHALL CONTINUE TO include the time breakdown table in the PDF

3.3 WHEN the user exports a PDF report THEN the system SHALL CONTINUE TO include the optimization opportunities section in the PDF

3.4 WHEN the user exports a PDF report THEN the system SHALL CONTINUE TO include the robot work distribution table in the PDF

3.5 WHEN the user exports a PDF report THEN the system SHALL CONTINUE TO include the comments/notes section in the PDF

3.6 WHEN the calculation result has no timeline data (no Gantt chart rendered) THEN the system SHALL CONTINUE TO generate a valid PDF without chart images

3.7 WHEN the calculation result has no efficiency data (no efficiency graph rendered) THEN the system SHALL CONTINUE TO generate a valid PDF without the efficiency graph image

---

## Bug Condition (Formal)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type PDFExportInput
  OUTPUT: boolean
  
  // The bug triggers whenever there is chart data to display
  RETURN X.result.timeline.length > 0 OR X.result.efficiencyData.length > 0
END FUNCTION
```

```pascal
// Property: Fix Checking - Charts included in PDF
FOR ALL X WHERE isBugCondition(X) DO
  pdf ← generatePDF'(X)
  IF X.result.timeline.length > 0 THEN
    ASSERT pdf contains Gantt timeline chart image
  END IF
  IF X.result.efficiencyData.length > 0 THEN
    ASSERT pdf contains efficiency graph image
  END IF
END FOR
```

```pascal
// Property: Preservation Checking - Existing content unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT generatePDF(X) = generatePDF'(X)
END FOR

// Additionally, for all inputs (buggy or not):
FOR ALL X DO
  pdf ← generatePDF'(X)
  ASSERT pdf contains input variables table
  ASSERT pdf contains time breakdown table
  ASSERT pdf contains optimization opportunities (if any)
  ASSERT pdf contains robot work distribution (if timeline exists)
  ASSERT pdf contains comments (if provided)
END FOR
```
