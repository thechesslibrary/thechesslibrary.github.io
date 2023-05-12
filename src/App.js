import React from 'react';
import Navbar from './Navbar';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import TCLLogo from './thechesslibrary.svg';
import './App.css';
import SelectComponent from './SelectComponent';
import SearchResult from './SearchResult/SearchResult.js';

function App() {
  return (
    <div>
    <Navbar/>
    <div className="row col-md-10 py-4" style={{margin: '0 auto'}}>
        <div className="col order-md-1 order-2">
            <div className="container p-2 rounded" style={{backgroundColor: '#f0f0f0'}}> 
                <SelectComponent label="Event: " options={[
                    { value: 'world_championships', label: 'World Championship' },
                    { value: 'candidates', label: 'Candidates' },
                    { value: 'interzonals', label: 'Interzonal' },
                    { value: 'women', label: 'Women\'s WCC' },
                    { value: 'wijk', label: 'Wijk aan Zee' },
                    { value: 'olympiads', label: 'Chess Olympiad' },
                    { value: 'world_cup', label: 'World Cup' },
                    { value: 'sinquefield', label: 'Sinquefield' },
                    { value: 'tcec', label: 'TCEC' },
                    { value: 'lichess_broadcasts', label: 'Lichess Broadcast (2017—)' },
                    { value: 'titled_arena', label: 'Lichess Titled Arena' },
                    { value: 'titled_tuesday', label: 'Titled Tuesday (2020—)' },
                ]}/>
                <br/>
                    <SelectComponent label="Sort: " options={[
                        { value: 'WhiteEloAsc', label: 'White Elo ▲' },
                        { value: 'BlackEloAsc', label: 'Black Elo ▲' },
                        { value: 'WhiteEloDsc', label: 'White Elo ▼' },
                        { value: 'BlackEloDsc', label: 'Black Elo ▼'},
                        { value: 'EloDsc', label: 'Average Elo ▼' },
                        { value: 'EloDsc', label: 'Average Elo ▼'},
                        { value: 'DateAsc', label: 'Date ▲' },
                        { value: 'DateDsc', label: 'Date ▼' },
                ]}/>
            </div>
            <SearchResult 
                eventName="World Championship 2016"
                date="2016.11.30"
                white="Magnus Carlsen"
                black="Sergey Karjakin"
                whiteTitle="GM"
                blackTitle="GM"
                whiteElo="2853"
                blackElo="2772"
                result="1-0"
            />
            <SearchResult 
                eventName="Titled Arena July '22"
                date="2022.07.23"
                white="RebeccaHarris"
                black="dabbang1111"
                whiteTitle="GM"
                blackTitle="IM"
                whiteElo="3271"
                blackElo="2553"
                result="0-1"
                moves=""
            />
            <SearchResult 
                eventName="Fide Championship 2004 Knockouts Rd. 1.1"
                date="2004.06.19"
                white="Nakamura,H"
                black="Volkov, S1"
                whiteTitle="GM"
                blackTitle="GM"
                whiteElo="2580"
                blackElo="2629"
                result="1/2-1/2"
                moves=""
            />
        </div>
        <div className="col order-md-2 order-1">
            <div className="container bg-secondary">
                <canvas id="chessboard"></canvas>
            </div>
        </div>
        <div className="col order-md-3 order-3">
            <div className="container bg-success">
                box3
            </div>
        </div>
    </div>
    </div>
  );
}

export default App;