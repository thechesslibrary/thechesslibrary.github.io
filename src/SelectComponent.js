import React from 'react';

const SelectComponent = ({ label, options }) => {
  return (
    <>
      <h5 className="label-primary px-2" style={{ display: 'inline-block' }}>
        {label}&nbsp;
      </h5>
      <span>
      <div className="form-row align-items-center" style={{ display: 'inline-block' }}>
        <div className="col-auto my-1">
          <select className="custom-select mr-sm-2">
            <option selected>Choose...</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
        </span>
    </>
  );
};

export default SelectComponent;
