import * as React from 'react';
import * as _ from 'lodash-es';
import * as classNames from 'classnames';
import { useDocumentListener } from '@console/shared';
import { KeyEventModes } from '@console/shared/src/hooks';
import { fuzzyCaseInsensitive } from '../factory/table-filters';

export const LabelInput: React.FC<LabelInputProps> = (props) => {
  const { visible, setVisible, ref } = useDocumentListener<HTMLDivElement>({ Escape: KeyEventModes.HIDE });
  const {
    value,
    onChange,
    placeholder,
    maxSuggestions,
    disabled,
    omitLabels,
  } = props;

  const labels = _.difference([
    'app',
    'kubernetes.io/metadata.name',
    'app.kubernetes.io/name',
    'app.kubernetes.io/instance',
    'app.kubernetes.io/version',
    'app.kubernetes.io/component',
    'app.kubernetes.io/part-of',
    'app.kubernetes.io/managed-by',
    'app.kubernetes.io/created-by',
    'app.openshift.io/runtime',
    'app.openshift.io/runtime-version',
  ], omitLabels);

  const onSelect = (value: string) => {
    onChange(value);
    if (visible) {
      setVisible(false);
    }
  };

  const activate = () => {
    if (value.trim()) {
      setVisible(true);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setVisible(!!input);
    onChange(input);
  };

  const suggestions = (value && visible)
    ? labels.filter(s => fuzzyCaseInsensitive(value.trim(), s))
      .slice(0, maxSuggestions || 5)
    : [];

  return (
    <div className="co-label-input" ref={ref}>
      <input
        type="text"
        className="pf-c-form-control"
        placeholder={placeholder}
        value={value}
        onChange={handleInput}
        disabled={disabled}
        onFocus={activate}
      />
      <div
        className={classNames('co-label-input__suggestions', {
          'co-label-input__suggestions--shadowed': suggestions.length > 0,
        })}
      >
        {suggestions.map((suggestion) => (
          <button key={suggestion} className="co-label-input__suggestions-line" onClick={() => onSelect(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
};

type LabelInputProps = {
  value: string;
  onChange: (selected: string) => void;
  placeholder?: string;
  maxSuggestions?: number;
  disabled?: boolean;
  omitLabels: string[];
};
