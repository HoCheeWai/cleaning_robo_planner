import React, { useRef } from 'react';
import { useCalculator } from '../../state';
import { CalculatorInputs, StartMode, WorkAssignmentMode } from '../../types';
import { DEFAULT_INPUTS, FIELD_METADATA } from '../../types/defaults';
import { generateTemplate } from '../../services/spreadsheet';
import { parseSpreadsheet } from '../../services/spreadsheet';
import { InputField } from '../InputField/InputField';
import { DerivedField } from '../DerivedField/DerivedField';
import { ModeSelector } from '../ModeSelector/ModeSelector';
import { ValidationSummary } from '../ValidationSummary/ValidationSummary';
import styles from './InputForm.module.css';

export function InputForm() {
  const { state, dispatch } = useCalculator();
  const { inputs, derived, validationErrors, hasCustomizedFields } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getError = (field: string) => validationErrors.find(e => e.field === field)?.message;
  const isCustomized = (field: string) => hasCustomizedFields.has(field);

  const handleChange = (field: keyof CalculatorInputs) => (value: number | boolean) => {
    dispatch({ type: 'UPDATE_INPUT', field, value });
  };

  const handleCalculate = () => {
    dispatch({ type: 'CALCULATE' });
  };

  const handleReset = () => {
    dispatch({ type: 'RESET' });
  };

  const handleUseDefaults = () => {
    dispatch({ type: 'LOAD_FROM_STORAGE', inputs: DEFAULT_INPUTS });
  };

  const handleDownloadTemplate = () => {
    const blob = generateTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fleet_calculator_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await parseSpreadsheet(file);
      dispatch({ type: 'LOAD_FROM_SPREADSHEET', inputs: result.inputs });
      if (result.warnings.length > 0) {
        alert('Import warnings:\n' + result.warnings.join('\n'));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to parse file');
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const meta = FIELD_METADATA;

  return (
    <div className={styles.form}>
      <ValidationSummary errors={validationErrors} />

      {/* Mode Selector */}
      <ModeSelector
        mode={inputs.mode}
        onChange={(mode) => dispatch({ type: 'SET_MODE', mode })}
      />

      {/* Start Mode Toggle */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Simulation Settings</div>
        <span className={styles.toggleLabel}>Start Mode</span>
        <div className={styles.toggleGroup} role="radiogroup" aria-label="Start mode">
          <button
            type="button"
            className={`${styles.toggleOption} ${inputs.startMode === 'simultaneous' ? styles.active : ''}`}
            onClick={() => dispatch({ type: 'SET_START_MODE', startMode: 'simultaneous' as StartMode })}
            role="radio"
            aria-checked={inputs.startMode === 'simultaneous'}
          >
            Simultaneous
          </button>
          <button
            type="button"
            className={`${styles.toggleOption} ${inputs.startMode === 'staggered' ? styles.active : ''}`}
            onClick={() => dispatch({ type: 'SET_START_MODE', startMode: 'staggered' as StartMode })}
            role="radio"
            aria-checked={inputs.startMode === 'staggered'}
          >
            Staggered
          </button>
        </div>

        <span className={styles.toggleLabel}>Work Assignment Mode</span>
        <div className={styles.toggleGroup} role="radiogroup" aria-label="Work assignment mode">
          <button
            type="button"
            className={`${styles.toggleOption} ${inputs.work_assignment_mode === 'fixed-zones' ? styles.active : ''}`}
            onClick={() => dispatch({ type: 'SET_WORK_ASSIGNMENT_MODE', workAssignmentMode: 'fixed-zones' as WorkAssignmentMode })}
            role="radio"
            aria-checked={inputs.work_assignment_mode === 'fixed-zones'}
          >
            Fixed Zones
          </button>
          <button
            type="button"
            className={`${styles.toggleOption} ${inputs.work_assignment_mode === 'collaborative' ? styles.active : ''}`}
            onClick={() => dispatch({ type: 'SET_WORK_ASSIGNMENT_MODE', workAssignmentMode: 'collaborative' as WorkAssignmentMode })}
            role="radio"
            aria-checked={inputs.work_assignment_mode === 'collaborative'}
          >
            Collaborative
          </button>
        </div>
      </div>

      {/* Workload Section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Workload</div>
        <InputField
          label={meta.actual_area_per_floor.label}
          name="actual_area_per_floor"
          value={inputs.actual_area_per_floor}
          unit={meta.actual_area_per_floor.unit}
          tooltip={meta.actual_area_per_floor.tooltip}
          defaultValue={DEFAULT_INPUTS.actual_area_per_floor}
          isCustomized={isCustomized('actual_area_per_floor')}
          error={getError('actual_area_per_floor')}
          onChange={handleChange('actual_area_per_floor')}
        />
        <InputField
          label={meta.num_of_passes.label}
          name="num_of_passes"
          value={inputs.num_of_passes}
          unit={meta.num_of_passes.unit}
          tooltip={meta.num_of_passes.tooltip}
          defaultValue={DEFAULT_INPUTS.num_of_passes}
          isCustomized={isCustomized('num_of_passes')}
          error={getError('num_of_passes')}
          onChange={handleChange('num_of_passes')}
          step={1}
        />
        <InputField
          label={meta.overlap_percentage.label}
          name="overlap_percentage"
          value={inputs.overlap_percentage}
          unit={meta.overlap_percentage.unit}
          tooltip={meta.overlap_percentage.tooltip}
          defaultValue={DEFAULT_INPUTS.overlap_percentage}
          isCustomized={isCustomized('overlap_percentage')}
          error={getError('overlap_percentage')}
          onChange={handleChange('overlap_percentage')}
          step={0.01}
        />
        <InputField
          label={meta.effective_cleaning_width.label}
          name="effective_cleaning_width"
          value={inputs.effective_cleaning_width}
          unit={meta.effective_cleaning_width.unit}
          tooltip={meta.effective_cleaning_width.tooltip}
          defaultValue={DEFAULT_INPUTS.effective_cleaning_width}
          isCustomized={isCustomized('effective_cleaning_width')}
          error={getError('effective_cleaning_width')}
          onChange={handleChange('effective_cleaning_width')}
          step={0.01}
        />
      </div>

      {/* Fleet Section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Fleet</div>
        {inputs.mode === 'robot-count' && (
          <InputField
            label={meta.num_of_robots.label}
            name="num_of_robots"
            value={inputs.num_of_robots}
            unit={meta.num_of_robots.unit}
            tooltip={meta.num_of_robots.tooltip}
            defaultValue={DEFAULT_INPUTS.num_of_robots}
            isCustomized={isCustomized('num_of_robots')}
            error={getError('num_of_robots')}
            onChange={handleChange('num_of_robots')}
            step={1}
          />
        )}
        {inputs.mode === 'time-constraint' && (
          <InputField
            label={meta.time_constraint.label}
            name="time_constraint"
            value={inputs.time_constraint}
            unit={meta.time_constraint.unit}
            tooltip={meta.time_constraint.tooltip}
            defaultValue={DEFAULT_INPUTS.time_constraint}
            isCustomized={isCustomized('time_constraint')}
            error={getError('time_constraint')}
            onChange={handleChange('time_constraint')}
          />
        )}
        <InputField
          label={meta.num_of_charging_points.label}
          name="num_of_charging_points"
          value={inputs.num_of_charging_points}
          unit={meta.num_of_charging_points.unit}
          tooltip={meta.num_of_charging_points.tooltip}
          defaultValue={DEFAULT_INPUTS.num_of_charging_points}
          isCustomized={isCustomized('num_of_charging_points')}
          error={getError('num_of_charging_points')}
          onChange={handleChange('num_of_charging_points')}
          step={1}
        />
        <InputField
          label={meta.num_of_refill_stations.label}
          name="num_of_refill_stations"
          value={inputs.num_of_refill_stations}
          unit={meta.num_of_refill_stations.unit}
          tooltip={meta.num_of_refill_stations.tooltip}
          defaultValue={DEFAULT_INPUTS.num_of_refill_stations}
          isCustomized={isCustomized('num_of_refill_stations')}
          error={getError('num_of_refill_stations')}
          onChange={handleChange('num_of_refill_stations')}
          step={1}
        />
        {inputs.num_of_robots <= inputs.num_of_charging_points && (
          <p className={styles.note}>No charging contention — robots ≤ docks</p>
        )}
        {inputs.num_of_robots <= inputs.num_of_refill_stations && (
          <p className={styles.note}>No refill contention — robots ≤ stations</p>
        )}
        <InputField
          label={meta.num_of_floors.label}
          name="num_of_floors"
          value={inputs.num_of_floors}
          unit={meta.num_of_floors.unit}
          tooltip={meta.num_of_floors.tooltip}
          defaultValue={DEFAULT_INPUTS.num_of_floors}
          isCustomized={isCustomized('num_of_floors')}
          error={getError('num_of_floors')}
          onChange={handleChange('num_of_floors')}
          step={1}
        />
        <InputField
          label={meta.num_of_robots_per_elevator_trip.label}
          name="num_of_robots_per_elevator_trip"
          value={inputs.num_of_robots_per_elevator_trip}
          unit={meta.num_of_robots_per_elevator_trip.unit}
          tooltip={meta.num_of_robots_per_elevator_trip.tooltip}
          defaultValue={DEFAULT_INPUTS.num_of_robots_per_elevator_trip}
          isCustomized={isCustomized('num_of_robots_per_elevator_trip')}
          error={getError('num_of_robots_per_elevator_trip')}
          onChange={handleChange('num_of_robots_per_elevator_trip')}
          step={1}
          disabled={inputs.num_of_floors === 1}
          disabledReason="Only applicable when there are multiple floors"
        />
        <InputField
          label={meta.num_of_elevators.label}
          name="num_of_elevators"
          value={inputs.num_of_elevators}
          unit={meta.num_of_elevators.unit}
          tooltip={meta.num_of_elevators.tooltip}
          defaultValue={DEFAULT_INPUTS.num_of_elevators}
          isCustomized={isCustomized('num_of_elevators')}
          error={getError('num_of_elevators')}
          onChange={handleChange('num_of_elevators')}
          step={1}
          disabled={inputs.num_of_floors === 1}
          disabledReason="Only applicable when there are multiple floors"
        />
        <InputField
          label={meta.service_hub_on_different_floor.label}
          name="service_hub_on_different_floor"
          value={inputs.service_hub_on_different_floor}
          unit={meta.service_hub_on_different_floor.unit}
          tooltip={meta.service_hub_on_different_floor.tooltip}
          defaultValue={DEFAULT_INPUTS.service_hub_on_different_floor}
          isCustomized={isCustomized('service_hub_on_different_floor')}
          error={getError('service_hub_on_different_floor')}
          onChange={handleChange('service_hub_on_different_floor')}
          type="toggle"
          disabled={inputs.num_of_floors === 1}
          disabledReason="Only applicable when there are multiple floors"
        />
      </div>

      {/* Performance Section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Performance</div>
        <InputField
          label={meta.effective_speed.label}
          name="effective_speed"
          value={inputs.effective_speed}
          unit={meta.effective_speed.unit}
          tooltip={meta.effective_speed.tooltip}
          defaultValue={DEFAULT_INPUTS.effective_speed}
          isCustomized={isCustomized('effective_speed')}
          error={getError('effective_speed')}
          onChange={handleChange('effective_speed')}
        />
        <InputField
          label={meta.total_battery_life.label}
          name="total_battery_life"
          value={inputs.total_battery_life}
          unit={meta.total_battery_life.unit}
          tooltip={meta.total_battery_life.tooltip}
          defaultValue={DEFAULT_INPUTS.total_battery_life}
          isCustomized={isCustomized('total_battery_life')}
          error={getError('total_battery_life')}
          onChange={handleChange('total_battery_life')}
        />
        <InputField
          label={meta.battery_reserve_threshold.label}
          name="battery_reserve_threshold"
          value={inputs.battery_reserve_threshold}
          unit={meta.battery_reserve_threshold.unit}
          tooltip={meta.battery_reserve_threshold.tooltip}
          defaultValue={DEFAULT_INPUTS.battery_reserve_threshold}
          isCustomized={isCustomized('battery_reserve_threshold')}
          error={getError('battery_reserve_threshold')}
          onChange={handleChange('battery_reserve_threshold')}
          step={0.01}
        />
        <InputField
          label={meta.tank_capacity_time.label}
          name="tank_capacity_time"
          value={inputs.tank_capacity_time}
          unit={meta.tank_capacity_time.unit}
          tooltip={meta.tank_capacity_time.tooltip}
          defaultValue={DEFAULT_INPUTS.tank_capacity_time}
          isCustomized={isCustomized('tank_capacity_time')}
          error={getError('tank_capacity_time')}
          onChange={handleChange('tank_capacity_time')}
        />
      </div>

      {/* Time & Transitions Section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Time &amp; Transitions</div>
        <InputField
          label={meta.distance_to_service_hub.label}
          name="distance_to_service_hub"
          value={inputs.distance_to_service_hub}
          unit={meta.distance_to_service_hub.unit}
          tooltip={meta.distance_to_service_hub.tooltip}
          defaultValue={DEFAULT_INPUTS.distance_to_service_hub}
          isCustomized={isCustomized('distance_to_service_hub')}
          error={getError('distance_to_service_hub')}
          onChange={handleChange('distance_to_service_hub')}
          step={0.1}
        />
        <InputField
          label={meta.vertical_travel_time.label}
          name="vertical_travel_time"
          value={inputs.vertical_travel_time}
          unit={meta.vertical_travel_time.unit}
          tooltip={meta.vertical_travel_time.tooltip}
          defaultValue={DEFAULT_INPUTS.vertical_travel_time}
          isCustomized={isCustomized('vertical_travel_time')}
          error={getError('vertical_travel_time')}
          onChange={handleChange('vertical_travel_time')}
          disabled={inputs.num_of_floors === 1}
          disabledReason="Only applicable when there are multiple floors"
        />
        <InputField
          label={meta.effective_charge_time.label}
          name="effective_charge_time"
          value={inputs.effective_charge_time}
          unit={meta.effective_charge_time.unit}
          tooltip={meta.effective_charge_time.tooltip}
          defaultValue={DEFAULT_INPUTS.effective_charge_time}
          isCustomized={isCustomized('effective_charge_time')}
          error={getError('effective_charge_time')}
          onChange={handleChange('effective_charge_time')}
        />
        <InputField
          label={meta.refill_duration.label}
          name="refill_duration"
          value={inputs.refill_duration}
          unit={meta.refill_duration.unit}
          tooltip={meta.refill_duration.tooltip}
          defaultValue={DEFAULT_INPUTS.refill_duration}
          isCustomized={isCustomized('refill_duration')}
          error={getError('refill_duration')}
          onChange={handleChange('refill_duration')}
        />

        {/* Derived Fields */}
        <DerivedField
          label="Total Cleaning Distance"
          value={derived?.total_cleaning_distance ?? null}
          unit="m"
          tooltip="Total linear distance the fleet must travel to clean the entire area. Computed as: (area × floors × passes) / (cleaning width × (1 - overlap)). This converts square metres into linear metres by accounting for the robot's cleaning strip width."
          decimals={0}
        />
        <DerivedField
          label="Travel Time to Service Hub"
          value={derived?.travel_time_to_service_hub ?? null}
          unit="min"
          tooltip="Round-trip travel time from cleaning zone to service hub. Computed: (2 × distance) / speed"
        />
        <DerivedField
          label="Charging Contention Time"
          value={derived?.charging_contention_time ?? null}
          unit="min"
          tooltip="Extra wait time per charge cycle due to shared docks"
        />
        <DerivedField
          label="Refill Contention Time"
          value={derived?.refill_contention_time ?? null}
          unit="min"
          tooltip="Extra wait time per refill cycle due to shared stations"
        />
        <DerivedField
          label="Recharge Cycles"
          value={derived?.num_of_recharge_cycles ?? null}
          unit="cycles"
          tooltip="Number of times each robot must recharge during the job"
          decimals={0}
        />
        <DerivedField
          label="Refill Cycles"
          value={derived?.num_of_refill_cycles ?? null}
          unit="cycles"
          tooltip="Number of times each robot must refill during the job"
          decimals={0}
        />
      </div>

      {/* Logistical Section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Logistical</div>
        <InputField
          label={meta.field_buffer_multiplier.label}
          name="field_buffer_multiplier"
          value={inputs.field_buffer_multiplier}
          unit={meta.field_buffer_multiplier.unit}
          tooltip={meta.field_buffer_multiplier.tooltip}
          defaultValue={DEFAULT_INPUTS.field_buffer_multiplier}
          isCustomized={isCustomized('field_buffer_multiplier')}
          error={getError('field_buffer_multiplier')}
          onChange={handleChange('field_buffer_multiplier')}
          step={0.01}
        />
      </div>

      {/* Comments */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Comments</div>
        <textarea
          className={styles.commentsField}
          value={inputs.comments}
          onChange={(e) => dispatch({ type: 'UPDATE_INPUT', field: 'comments', value: e.target.value })}
          placeholder="Add notes about this calculation..."
          maxLength={1000}
          aria-label="Comments"
        />
        <div className={styles.charCount}>{inputs.comments.length} / 1000</div>
      </div>

      {/* Spreadsheet Upload */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Import / Export</div>
        <div className={styles.uploadWrapper}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload Spreadsheet
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className={styles.fileInput}
            onChange={handleFileUpload}
            aria-label="Upload spreadsheet file"
          />
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={handleDownloadTemplate}
          >
            Download Template
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className={styles.actions}>
        <button type="button" className={styles.btnPrimary} onClick={handleCalculate}>
          Calculate
        </button>
        <button type="button" className={styles.btnSecondary} onClick={handleReset}>
          Reset
        </button>
        <button type="button" className={styles.btnSecondary} onClick={handleUseDefaults}>
          Use All Defaults
        </button>
      </div>
    </div>
  );
}
