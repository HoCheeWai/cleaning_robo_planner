# Requirements Document

## Introduction

This feature adds visual colour indicators to derived (computed) fields in the Cleaning Robot Fleet Calculator. The indicators communicate two distinct states to the user: (1) when a derived value is computed from non-default parent inputs (blue indicator), and (2) when a user has manually overridden a field that normally auto-calculates (amber indicator). This gives users immediate visual feedback about which computed values are influenced by their customisations and which values they have explicitly overridden.

## Glossary

- **Derived_Field**: A read-only computed field rendered by the `DerivedField` component whose value is calculated from one or more parent inputs (e.g., `travel_time_to_service_hub`, `charging_contention_time`, `refill_contention_time`, `num_of_recharge_cycles`, `num_of_refill_cycles`).
- **Parent_Input**: An editable input field whose value feeds into the calculation of a Derived_Field.
- **Default_Value**: The initial value of a Parent_Input as defined in `DEFAULT_INPUTS`.
- **Dynamic_Default**: A default value that is itself computed from other inputs (e.g., `distance_to_service_hub` defaults to `√(actual_area_per_floor / π)`).
- **Non_Default_Indicator**: A light blue visual border or background applied to a Derived_Field to signal that at least one of its Parent_Inputs has been changed from its Default_Value.
- **Override_Indicator**: An amber visual border or background applied to a field that normally auto-calculates but has been manually overwritten by the user.
- **Indicator_System**: The subsystem responsible for determining and rendering the appropriate colour indicator on Derived_Fields.
- **HasCustomizedFields_Set**: The existing `Set<string>` in the CalculatorContext state that tracks which fields the user has changed from their defaults.

## Requirements

### Requirement 1: Non-Default Parent Input Indicator on Derived Fields

**User Story:** As a calculator user, I want to see a blue visual indicator on derived fields when any of their parent inputs have been changed from defaults, so that I can quickly identify which computed values are influenced by my customisations.

#### Acceptance Criteria

1. WHEN at least one Parent_Input of a Derived_Field has a value different from its Default_Value, THE Indicator_System SHALL display the Non_Default_Indicator (light blue border or background) on that Derived_Field.
2. WHEN all Parent_Inputs of a Derived_Field have values equal to their Default_Values, THE Indicator_System SHALL NOT display the Non_Default_Indicator on that Derived_Field.
3. WHEN a user changes a Parent_Input back to its Default_Value and no other Parent_Inputs of the Derived_Field remain non-default, THE Indicator_System SHALL remove the Non_Default_Indicator from that Derived_Field.
4. THE Indicator_System SHALL evaluate the following dependency mappings to determine Parent_Inputs for each Derived_Field:
   - `travel_time_to_service_hub` depends on: `distance_to_service_hub`, `effective_speed`
   - `charging_contention_time` depends on: `num_of_robots`, `num_of_charging_points`, `effective_charge_time`
   - `refill_contention_time` depends on: `num_of_robots`, `num_of_refill_stations`, `refill_duration`
   - `num_of_recharge_cycles` depends on: `total_battery_life`, `battery_reserve_threshold`, `actual_area_per_floor`, `num_of_floors`, `num_of_passes`, `effective_cleaning_width`, `overlap_percentage`, `effective_speed`, `num_of_robots`
   - `num_of_refill_cycles` depends on: `tank_capacity_time`, `actual_area_per_floor`, `num_of_floors`, `num_of_passes`, `effective_cleaning_width`, `overlap_percentage`, `effective_speed`, `num_of_robots`

### Requirement 2: Override Indicator on Manually Overwritten Fields

**User Story:** As a calculator user, I want to see an amber visual indicator on the `distance_to_service_hub` field when I have manually overwritten its auto-calculated value, so that I can distinguish between a value I typed and one that was dynamically computed.

#### Acceptance Criteria

1. WHEN the user manually enters a value for `distance_to_service_hub`, THE Indicator_System SHALL display the Override_Indicator (amber border or background) on the `distance_to_service_hub` field.
2. WHEN the user has not manually entered a value for `distance_to_service_hub` and the field is using its Dynamic_Default, THE Indicator_System SHALL NOT display the Override_Indicator on the `distance_to_service_hub` field.
3. WHEN the user resets the form or explicitly restores `distance_to_service_hub` to its Dynamic_Default, THE Indicator_System SHALL remove the Override_Indicator from the `distance_to_service_hub` field.

### Requirement 3: Indicator Visual Distinction

**User Story:** As a calculator user, I want the blue and amber indicators to be visually distinct from each other and from the default field appearance, so that I can immediately tell the difference between a derived value affected by non-default inputs and a manually overridden value.

#### Acceptance Criteria

1. THE Non_Default_Indicator SHALL use a light blue colour (border or background) that is visually distinct from the default Derived_Field styling.
2. THE Override_Indicator SHALL use an amber colour (border or background) that is visually distinct from both the default Derived_Field styling and the Non_Default_Indicator.
3. THE Indicator_System SHALL ensure that both indicators meet WCAG 2.1 AA contrast requirements against the field background.
4. THE Indicator_System SHALL ensure that colour is not the sole means of conveying the indicator state (e.g., a supplementary text label, icon, or pattern is provided for colour-blind users).

### Requirement 4: Indicator Reactivity

**User Story:** As a calculator user, I want the colour indicators to update immediately when I change input values, so that I always see an accurate representation of the current state.

#### Acceptance Criteria

1. WHEN a user changes a Parent_Input value, THE Indicator_System SHALL update the indicator state of all affected Derived_Fields within the same render cycle.
2. WHEN a user changes `actual_area_per_floor` and `distance_to_service_hub` has not been manually overridden, THE Indicator_System SHALL re-evaluate the Non_Default_Indicator for `travel_time_to_service_hub` based on the recalculated Dynamic_Default of `distance_to_service_hub`.
3. WHEN the user triggers a form reset, THE Indicator_System SHALL remove all Non_Default_Indicators and Override_Indicators.

### Requirement 5: Indicator State Persistence

**User Story:** As a calculator user, I want the indicator states to be correctly restored when I reload the page, so that I can see which values are non-default or overridden without re-entering data.

#### Acceptance Criteria

1. WHEN inputs are loaded from localStorage on page load, THE Indicator_System SHALL evaluate and display the correct indicators based on the loaded values compared to their Default_Values.
2. WHEN inputs are loaded from a spreadsheet import, THE Indicator_System SHALL evaluate and display the correct indicators based on the imported values compared to their Default_Values.

### Requirement 6: Dynamic Default Awareness for distance_to_service_hub

**User Story:** As a calculator user, I want the indicator system to correctly handle the `distance_to_service_hub` field's dynamic default behaviour, so that changing the area shows the blue indicator on `travel_time_to_service_hub` when the area differs from the original default.

#### Acceptance Criteria

1. WHILE `distance_to_service_hub` is using its Dynamic_Default and `actual_area_per_floor` differs from its Default_Value, THE Indicator_System SHALL display the Non_Default_Indicator on `travel_time_to_service_hub`.
2. WHILE `distance_to_service_hub` is using its Dynamic_Default and `actual_area_per_floor` equals its Default_Value, THE Indicator_System SHALL NOT display the Non_Default_Indicator on `travel_time_to_service_hub` solely due to `distance_to_service_hub`.
3. WHEN the user manually overrides `distance_to_service_hub`, THE Indicator_System SHALL display the Override_Indicator on `distance_to_service_hub` AND evaluate the Non_Default_Indicator on `travel_time_to_service_hub` by comparing the overridden value against the static Default_Value of `distance_to_service_hub`.
