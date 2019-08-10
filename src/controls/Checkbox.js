import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Checkbox } from 'primereact/checkbox';

var _globalUniqueId = 0;

class InputCheckbox extends PureComponent {
    constructor(props) {
        super(props);
        this.inputId = props.inputId || (props.label ? "chk_" + (++_globalUniqueId) : null);
    }

    onChange = (e) => {
        this.props.onChange(e.checked);
    }

    render() {
        var { inputId, onChange, props: { className, checked = false, label } } = this;

        return (
            <span className={className}>
                <Checkbox inputId={inputId} onChange={onChange} checked={checked}></Checkbox>
                {label && <label htmlFor={inputId}>{label}</label>}
            </span>
        );
    }
}

InputCheckbox.propTypes = {
    checked: PropTypes.bool.isRequired,
    onChange: PropTypes.func.isRequired,
    label: PropTypes.string
};

export default InputCheckbox;