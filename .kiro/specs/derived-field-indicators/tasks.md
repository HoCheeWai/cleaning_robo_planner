# Tasks

## Task 1: Create the derivedFieldStatus utility

- [x] 1.1 Create `src/components/InputForm/derivedFieldStatus.ts` with the `DerivedFieldStatus` type, `DERIVED_FIELD_DEPENDENCIES` constant, and `getDerivedFieldStatus` function
- [x] 1.2 Implement the status computation logic: check override for distance_to_service_hub, then check parent dependencies against defaults with dynamic default awareness
- [x] 1.3 Write property-based tests for the utility in `src/components/InputForm/__tests__/derivedFieldStatus.test.ts`

## Task 2: Update DerivedField component with indicator styling

- [x] 2.1 Add `indicatorStatus` prop to `DerivedField` component interface
- [x] 2.2 Add CSS classes for non-default-parents indicator (blue left border) and accessibility text badge in `DerivedField.module.css`
- [x] 2.3 Render the indicator styling and accessibility label conditionally based on `indicatorStatus` prop

## Task 3: Update InputField component with override indicator

- [x] 3.1 Add `indicatorStatus` prop to `InputField` component interface
- [x] 3.2 Add CSS class for overridden indicator (amber left border) and accessibility text badge in `InputField.module.css`
- [x] 3.3 Render the override indicator styling and accessibility label conditionally based on `indicatorStatus` prop

## Task 4: Integrate indicator status computation in InputForm

- [x] 4.1 Import `getDerivedFieldStatus` and compute indicator status for each derived field in `InputForm`
- [x] 4.2 Pass `indicatorStatus` prop to each `DerivedField` instance
- [x] 4.3 Compute and pass override indicator status to the `distance_to_service_hub` `InputField`

## Task 5: Verify build and tests pass

- [x] 5.1 Run TypeScript type checking to ensure no type errors
- [x] 5.2 Run the test suite to verify all property-based and unit tests pass
