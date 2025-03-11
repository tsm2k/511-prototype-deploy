import React from 'react';

interface MultiSelectProps {
  options: { label: string; value: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  selectAllLabel: string;
  className?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ options, selected, onChange, selectAllLabel, className }) => {
  const toggleSelectAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(option => option.value));
    }
  };

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(item => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className={`multiselect ${className}`}>
      <div className="select-all" onClick={toggleSelectAll}>
        {selectAllLabel}
      </div>
      {options.map(option => (
        <div key={option.value} className="option" onClick={() => toggleOption(option.value)}>
          <input type="checkbox" checked={selected.includes(option.value)} readOnly />
          <span>{option.label}</span>
        </div>
      ))}
    </div>
  );
};
