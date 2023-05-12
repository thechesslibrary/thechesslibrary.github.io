import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import TCLLogo from './thechesslibrary.svg';

const Navbar = () => 
<>
<div className="shadow-sm">
    <div className="container-fluid row">
       <nav className="navbar navbar-expand-md bg-light">
        <div className="container-fluid col-md-10">
            <a className="navbar-brand" href="/">
                <img src={TCLLogo} alt="The Chess Library" width="40" height="40" className="d-inline-block align-text-bottom pad1x" />
                </a>
            <a className="navbar-brand" href="/">The Chess Library</a>
            <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarCollapse">
                <span className="navbar-toggler-icon"></span>
            </button>
            <div className="collapse navbar-collapse" id="navbarCollapse">
                <ul className="navbar-nav me-auto mb-2 mb-md-0">
                    <li className="nav-item">
                        <a className="nav-link" href="/">About</a>
                    </li>
                    <li className="nav-item">
                        <a className="nav-link" href="/">Source Code</a>
                    </li>
                    <li className="nav-item">
                        <a className="nav-link" href="/">Donate</a>
                    </li>
                </ul>
            </div>
        </div>
       </nav>
    </div>
    </div>
    </>

export default Navbar;