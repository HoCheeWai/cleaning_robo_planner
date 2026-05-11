# PDF Chart Export Bugfix Design

## Overview

The `generatePDF` function in `src/services/pdfExport.ts` produces a PDF report containing only text-based tables (input variables, time breakdown, optimizations, robot work distribution). It does not capture or embed the Gantt timeline chart or the efficiency graph, both of which are rendered as inline SVG elements in the browser. The fix will serialize the SVG elements to PNG data URLs (via a temporary canvas) and pass them into `generatePDF`, which will embed them using `doc.addImage()`.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — when chart data exists (timeline or efficiency data) but the PDF omits the corresponding chart images
- **Property (P)**: The desired behavior — when chart data exists, the PDF SHALL contain embedded images of those charts
- **Preservation**: Existing PDF content (tables, text, layout) must remain unchanged by the fix
- **generatePDF**: The function in `src/services/pdfExport.ts` that builds the jsPDF document and returns a Blob
- **TimelineChart**: SVG-based Gantt chart component in `src/components/TimelineChart/TimelineChart.tsx`
- **EfficiencyGraph**: SVG-based line chart component in `src/components/EfficiencyGraph/EfficiencyGraph.tsx`
- **SVG serialization**: Converting an SVG DOM element to a data URI string for rendering onto a canvas

## Bug Details

### Bug Condition

The bug manifests when the user clicks "Export as PDF" while chart data is present in the calculation result. The `generatePDF` function has no logic to accept or embed chart images — it only renders text and tables via jsPDF and jspdf-autotable.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { result: CalculationResult, inputs: CalculatorInputs }
  OUTPUT: boolean
  
  RETURN input.result.timeline.length > 0
         OR input.result.efficiencyData.length > 0
END FUNCTION
```

### Examples

- **Timeline only**: User runs a time-constraint calculation with 3 robots → timeline has 3 entries, efficiencyData has entries → PDF shows tables but no Gantt chart image and no efficiency graph image
- **Both charts**: User runs any successful calculation → both charts render on screen → PDF export omits both visual charts
- **No charts (edge case)**: User has an infeasible result with no timeline → PDF correctly shows infeasibility text (no bug triggered, no charts expected)
- **Efficiency data only**: If timeline is empty but efficiencyData exists → PDF omits efficiency graph (unlikely scenario given current solver, but possible)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- The input variables table must continue to appear in the PDF with correct values
- The time breakdown table must continue to appear with correct percentages
- The optimization opportunities section must continue to appear when optimizations exist
- The robot work distribution table must continue to appear when timeline data exists
- The comments/notes section must continue to appear when comments are provided
- The PDF title, date, mode labels, and primary result must remain unchanged
- The PDF must remain client-side only (no server calls)

**Scope:**
All inputs that do NOT involve chart image embedding should be completely unaffected by this fix. This includes:
- Text content generation (titles, labels, values)
- Table rendering (autoTable calls)
- Page break logic for text sections
- Filename generation
- Cases where no chart data exists (infeasible results)

## Hypothesized Root Cause

Based on the bug description, the root cause is straightforward:

1. **Missing implementation**: The `generatePDF` function was never implemented with chart embedding logic. It only uses jsPDF text/table APIs and has no `doc.addImage()` calls.

2. **No image data passed in**: The function signature `generatePDF(inputs, result, comments)` does not accept any image data. Even if it had embedding logic, there is no mechanism to pass captured chart images from the UI layer.

3. **No SVG capture in ResultDisplay**: The `handleExportPDF` function in `ResultDisplay.tsx` calls `generatePDF` directly without first capturing the chart DOM elements as images.

4. **SVG cannot be directly embedded in jsPDF**: jsPDF's `addImage` requires raster formats (PNG, JPEG). The SVG elements must first be rasterized to a canvas and converted to data URLs before they can be embedded.

## Correctness Properties

Property 1: Bug Condition - Charts Embedded in PDF

_For any_ input where the bug condition holds (timeline data or efficiency data exists), the fixed `generatePDF` function SHALL embed the corresponding chart image(s) in the PDF document using `doc.addImage()`, placing them after the time breakdown section and before the optimization opportunities section.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Existing PDF Content Unchanged

_For any_ input (whether or not chart data exists), the fixed `generatePDF` function SHALL produce a PDF that contains all the same text tables and sections as the original function: input variables table, time breakdown table, optimization opportunities, robot work distribution, and comments.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/services/pdfExport.ts`

**Function**: `generatePDF`

**Specific Changes**:
1. **Extend function signature**: Add an optional `chartImages` parameter of type `{ timelineChart?: string; efficiencyGraph?: string }` where values are base64 PNG data URLs
2. **Add chart embedding logic**: After the time breakdown table section and before the optimization opportunities section, check if chart images are provided and embed them using `doc.addImage()`
3. **Handle page breaks**: Charts are wide images — check remaining page space and add a new page if needed before embedding each chart
4. **Add section headers**: Add "Timeline (Gantt Chart)" and "Fleet Efficiency" headers before each chart image
5. **Graceful fallback**: If chart images are undefined/null, skip embedding (preserves behavior for cases with no chart data)

**File**: `src/components/ResultDisplay/ResultDisplay.tsx`

**Function**: `handleExportPDF`

**Specific Changes**:
1. **Add refs to chart containers**: Use `useRef` to get references to the chart wrapper divs
2. **Implement SVG-to-PNG capture**: Before calling `generatePDF`, serialize each SVG element to a data URI, draw onto a temporary canvas, and extract as PNG data URL
3. **Make handler async**: The canvas drawing requires waiting for the Image `onload` event, so `handleExportPDF` becomes async
4. **Pass chart images to generatePDF**: Pass the captured data URLs in the new `chartImages` parameter

**New utility** (in `src/services/pdfExport.ts` or a helper):

**Function**: `svgToDataUrl(svgElement: SVGElement): Promise<string>`

**Purpose**: Serialize an SVG element to a PNG data URL by:
1. Cloning the SVG and setting explicit width/height attributes
2. Serializing to XML string via `XMLSerializer`
3. Creating a data URI (`data:image/svg+xml;charset=utf-8,...`)
4. Drawing onto a canvas via `new Image()` with the SVG data URI as src
5. Returning `canvas.toDataURL('image/png')`

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that call `generatePDF` with valid timeline and efficiency data, then inspect the resulting PDF blob for image content. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Timeline Chart Missing**: Call `generatePDF` with timeline data present → assert PDF contains an image (will fail on unfixed code because no image logic exists)
2. **Efficiency Graph Missing**: Call `generatePDF` with efficiency data present → assert PDF contains an image (will fail on unfixed code)
3. **Both Charts Missing**: Call `generatePDF` with both data types → assert PDF contains two images (will fail on unfixed code)
4. **No Chart Data**: Call `generatePDF` with empty timeline and efficiency data → assert PDF is valid without images (should pass on unfixed code)

**Expected Counterexamples**:
- PDF blob does not contain any image data when chart data is provided
- Possible causes: no `addImage` call exists, no image data parameter accepted

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  chartImages := captureCharts(input)
  pdf := generatePDF_fixed(input.inputs, input.result, input.comments, chartImages)
  IF input.result.timeline.length > 0 THEN
    ASSERT pdf contains timeline chart image
  END IF
  IF input.result.efficiencyData.length > 0 THEN
    ASSERT pdf contains efficiency graph image
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT generatePDF_original(input) = generatePDF_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for inputs without chart data, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Input Variables Table Preservation**: Verify the input variables table appears correctly in the PDF for various input combinations
2. **Time Breakdown Preservation**: Verify the time breakdown percentages appear correctly
3. **Optimization Section Preservation**: Verify optimization suggestions appear when present
4. **Comments Preservation**: Verify comments section appears when comments are provided

### Unit Tests

- Test `svgToDataUrl` utility with a simple SVG element returns a valid PNG data URL
- Test `generatePDF` with chart images provided embeds them in the output
- Test `generatePDF` with no chart images provided produces the same output as before
- Test `generatePDF` with only timeline chart image (no efficiency graph)
- Test `generatePDF` with only efficiency graph image (no timeline chart)

### Property-Based Tests

- Generate random `CalculatorInputs` and `CalculationResult` objects with chart data and verify the PDF blob size increases when chart images are provided (indicating images were embedded)
- Generate random inputs without chart data and verify the PDF output is identical to the original function
- Generate random SVG dimensions and verify `svgToDataUrl` produces valid data URLs

### Integration Tests

- Test full export flow: render ResultDisplay with chart data, click export, verify downloaded PDF contains images
- Test export flow with no chart data: render ResultDisplay without timeline, click export, verify PDF is valid
- Test that chart images are positioned correctly (after time breakdown, before optimizations)
