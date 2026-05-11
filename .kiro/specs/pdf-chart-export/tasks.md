# Tasks

## 1. Create SVG-to-PNG capture utility
- [x] 1.1 Create a `svgToDataUrl` function in `src/services/pdfExport.ts` that accepts an SVGElement, serializes it to XML, draws it onto a canvas via an Image element, and returns a Promise<string> with the PNG data URL
- [x] 1.2 Handle edge cases: set explicit width/height on the cloned SVG, use encodeURIComponent for the SVG data URI to avoid encoding issues, and set a 2x scale factor for crisp rendering

## 2. Extend generatePDF to accept and embed chart images
- [x] 2.1 Add an optional `chartImages?: { timelineChart?: string; efficiencyGraph?: string }` parameter to the `generatePDF` function signature
- [x] 2.2 After the time breakdown table section, add logic to embed the timeline chart image using `doc.addImage()` with a "Timeline (Gantt Chart)" section header, checking for page breaks
- [x] 2.3 After the timeline chart (or after time breakdown if no timeline), add logic to embed the efficiency graph image using `doc.addImage()` with a "Fleet Efficiency" section header, checking for page breaks
- [x] 2.4 Ensure that when chartImages is undefined or individual properties are undefined, the function skips embedding gracefully (preserving original behavior)

## 3. Update ResultDisplay to capture charts and pass to generatePDF
- [x] 3.1 Add `useRef` hooks for the timeline chart wrapper div and the efficiency graph wrapper div in `ResultDisplay.tsx`
- [x] 3.2 Attach the refs to the corresponding chart container elements in the JSX
- [x] 3.3 Make `handleExportPDF` async: before calling `generatePDF`, find the SVG elements within the ref containers and call `svgToDataUrl` on each
- [x] 3.4 Pass the captured data URLs as the `chartImages` parameter to `generatePDF`

## 4. Write unit tests for the fix
- [x] 4.1 Write a test that verifies `generatePDF` with chart image data URLs produces a larger PDF blob than without (indicating images were embedded)
- [x] 4.2 Write a test that verifies `generatePDF` without chart images produces the same output as the original function (preservation)
- [x] 4.3 Write a test that verifies `generatePDF` handles partial chart images (only timeline or only efficiency graph)

## 5. PDF content parity with web display
- [x] 5.1 Reorder PDF sections to match web sequence: Primary Result → Input Variables → Time Breakdown → Optimizations → Robot Work Distribution → Gantt Chart → Efficiency Graph → Comments → Assumptions
- [x] 5.2 Add explanatory note about raw vs buffered time above the Gantt chart image in the PDF
- [x] 5.3 Add color-coded legend below the Gantt chart image (Cleaning, Traveling, Charging, Waiting, Refilling, Elevator, Idle)
- [x] 5.4 Add legend below the efficiency graph image (Fleet Utilization %, Cumulative Progress %, Dead Time Zones)
- [x] 5.5 Add "Field Buffer" row to the Time Breakdown table in the PDF
- [x] 5.6 Add "Assumptions & Limitations" section at the end of the PDF
