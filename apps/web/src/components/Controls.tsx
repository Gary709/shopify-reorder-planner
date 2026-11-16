import { useState } from 'react';
import { DEFAULT_SETTINGS, parseSettings, type PlannerSettings } from '@tinyfab/core';

interface Fields {
  leadTimeDays: string;
  reviewPeriodDays: string;
  serviceLevel: string;
  budgetCap: string;
  movingAverageWindow: string;
  lookbackDays: string;
  horizonDays: string;
  defaultMoq: string;
  defaultCartonSize: string;
  overridePackaging: boolean;
}

function fromSettings(settings: PlannerSettings): Fields {
  return {
    leadTimeDays: String(settings.leadTimeDays),
    reviewPeriodDays: String(settings.reviewPeriodDays),
    serviceLevel: String(settings.serviceLevel),
    budgetCap: settings.budgetCap === null ? '' : String(settings.budgetCap),
    movingAverageWindow: String(settings.movingAverageWindow),
    lookbackDays: String(settings.lookbackDays),
    horizonDays: String(settings.horizonDays),
    defaultMoq: String(settings.defaultMoq),
    defaultCartonSize: String(settings.defaultCartonSize),
    overridePackaging: settings.moqOverride !== null || settings.cartonSizeOverride !== null,
  };
}

export function Controls({
  settings,
  currency,
  onChange,
}: {
  settings: PlannerSettings;
  currency: string;
  onChange: (settings: PlannerSettings) => void;
}) {
  const [fields, setFields] = useState(() => fromSettings(settings));
  const [message, setMessage] = useState<string | null>(null);

  function commit(next: Fields) {
    setFields(next);
    const budget = next.budgetCap.trim();
    try {
      const parsed = parseSettings({
        leadTimeDays: next.leadTimeDays.trim(),
        reviewPeriodDays: next.reviewPeriodDays.trim(),
        serviceLevel: next.serviceLevel,
        budgetCap: budget === '' ? null : budget,
        movingAverageWindow: next.movingAverageWindow.trim(),
        lookbackDays: next.lookbackDays.trim(),
        horizonDays: next.horizonDays.trim(),
        defaultMoq: next.defaultMoq.trim(),
        defaultCartonSize: next.defaultCartonSize.trim(),
        moqOverride: next.overridePackaging ? next.defaultMoq.trim() : null,
        cartonSizeOverride: next.overridePackaging ? next.defaultCartonSize.trim() : null,
      });
      setMessage(null);
      onChange(parsed);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Check the settings.');
    }
  }

  return (
    <form
      className="controls"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <div className="control-grid">
        <Field
          label="Lead time"
          hint="days on the boat from China"
          value={fields.leadTimeDays}
          onChange={(value) => commit({ ...fields, leadTimeDays: value })}
        />
        <Field
          label="Review period"
          hint="days until I order again"
          value={fields.reviewPeriodDays}
          onChange={(value) => commit({ ...fields, reviewPeriodDays: value })}
        />
        <label className="field">
          <span>Service level</span>
          <select
            value={fields.serviceLevel}
            onChange={(event) => commit({ ...fields, serviceLevel: event.target.value })}
          >
            <option value="0.9">90%</option>
            <option value="0.95">95%</option>
            <option value="0.975">97.5%</option>
            <option value="0.99">99%</option>
          </select>
          <small>how sure I want to be</small>
        </label>
        <Field
          label="Budget cap"
          hint={`${currency}, blank if no limit`}
          value={fields.budgetCap}
          onChange={(value) => commit({ ...fields, budgetCap: value })}
          placeholder="No cap"
        />
      </div>
      <details className="advanced">
        <summary>More settings</summary>
        <div className="control-grid">
          <Field
            label="Lookback"
            hint="days of orders to use"
            value={fields.lookbackDays}
            onChange={(value) => commit({ ...fields, lookbackDays: value })}
          />
          <Field
            label="Moving average"
            hint="days in the average"
            value={fields.movingAverageWindow}
            onChange={(value) => commit({ ...fields, movingAverageWindow: value })}
          />
          <Field
            label="Chart horizon"
            hint="days on the chart"
            value={fields.horizonDays}
            onChange={(value) => commit({ ...fields, horizonDays: value })}
          />
          <Field
            label="Default minimum"
            hint="if a colour has no rule"
            value={fields.defaultMoq}
            onChange={(value) => commit({ ...fields, defaultMoq: value })}
          />
          <Field
            label="Default box"
            hint="spools per box, if unset"
            value={fields.defaultCartonSize}
            onChange={(value) => commit({ ...fields, defaultCartonSize: value })}
          />
          <label className="field check">
            <span>Same box for every colour</span>
            <input
              type="checkbox"
              checked={fields.overridePackaging}
              onChange={(event) => commit({ ...fields, overridePackaging: event.target.checked })}
            />
            <small>Ignore each colour's own minimum and box size</small>
          </label>
        </div>
      </details>
      <div className="control-footer">
        <button
          type="button"
          className="text-button"
          onClick={() => {
            const defaults = fromSettings(DEFAULT_SETTINGS);
            setFields(defaults);
            setMessage(null);
            onChange(DEFAULT_SETTINGS);
          }}
        >
          Reset
        </button>
        {message ? <p className="form-error">{message}</p> : null}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <small>{hint}</small>
    </label>
  );
}
