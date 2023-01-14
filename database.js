const prefix = 'https://media.githubusercontent.com/media/thechesslibrary/thechesslibrary.github.io/databases/';
// const prefix = 'resources/databases/'

$(document).ready(() => {
    document.chessboardEnabled = false;
    // $(".games-container").empty();
    loadDatabase($("#collection").val());
    $.get(prefix + 'lichess_broadcasts/transpositions.json', (t) => {
        database.transpositions = JSON.parse(t);
    });
    
});
document.directory = {};
var activeDatabase = "";
var database = {};

function loadDatabase(db) {
    if (activeDatabase != db) {
        document.chessboardEnabled = false;
        document.directory.updating = true;
        document.directory.indexes = [];
        document.directory.discoverRanges = [];
        document.directory.transpositions = [];
        $(".games-container").empty();
        displayGame(['','','','Loading Games...','This may take a second.','','','','','','','','',''], null)
        activeDatabase = db;
        $.get(prefix + db + '/data.csv', (d) => {
            database.data = $.csv.toArrays(d);
            database.columns = database.data.shift();
            $.get(prefix + db + '/indexes.json', (i) => {
                database.indexes = JSON.parse(i);
            }).done();
            // $.get(prefix + db + '/transpositions.json', (t) => {
            //     database.transpositions = t;});
            $.get(prefix + db + '/ranges.json', (r) => {
                r = JSON.parse(r);
                database.rangeLookup = new Map();
                for (let moveLength of Object.keys(r)) {
                    if (moveLength == "maxLength") {
                        database.rangeLookup.set("maxLength", parseInt(r[moveLength]));
                    } else {
                        let lookup = new Map();
                        for (const [move, range] of Object.entries(r[moveLength])) {
                            lookup.set(move, [parseInt(range[0]), parseInt(range[1])]);
                        }
                        database.rangeLookup.set(parseInt(moveLength), lookup);
                    }
                }
            }).done(() => {mainGame.broadcastBoards(); document.directory.updating = false; document.chessboardEnabled = true; updateDatabase(mainGame.boards);}); //console.log(database);
            
            // document.directory.updating = false;
        }).done();
        
    }
    
}

$('#collection').on('keydown', function(e){
    if(event.key == 'ArrowLeft' || event.key == 'ArrowRight') { //up or down
        e.preventDefault();
        return false;
    }
})
document.directory.updating = false;

const intToB64Scan = (num) => {
    if (num <= 25)
        return String.fromCharCode(65 + num);
    else if (num <= 51)
        return String.fromCharCode(num + 71);
    else if (num <= 61)
        return String.fromCharCode(num - 4);
    else if (num == 62)
        return '+';
    else return '/';
};

const b64ScanToInt = (chr) => {
    if (chr >= 'A' && chr <= 'Z') {
        return chr.charCodeAt(0) - 65;
    } else if (chr >= 'a' && chr <= 'z') {
        return chr.charCodeAt(0) - 71;
    } else if (chr >= '0' && chr <= '9') {
        return chr.charCodeAt(0) + 4;
    } else if (chr === '+') {
        return 62;
    } else if (chr === '/') {
        return 63;
    }
};

const intToB64FourChr = (num) => {
    return intToB64Scan(num >> 18) + intToB64Scan((num >> 12) & 63) + intToB64Scan((num >> 6) & 63) + intToB64Scan(num & 63);
};

const b64FourChrToInt = (str) => {
    return (b64ScanToInt(str[0]) << 18) + (b64ScanToInt(str[1]) << 12) + (b64ScanToInt(str[2]) << 6) + b64ScanToInt(str[3]);
};

$(document).on("boards-update", (event, boards) => {
    if (mainGame.currentBoard != 0)
        $(".banner-extra").css("visibility", "hidden");
    checkForBoardUpdates(event.detail.boards);
});

$("#collection").on("change", () => {
    loadDatabase($("#collection").val());
});

$("#Sort").on("change", () => {
    mainGame.broadcastBoards();
});

document.directory.nextBoards = [];

function updateDatabase(boards) {
    if (boards.length > 60) {
        document.directory.upToDate = false;
        localDirectory.transpositions = [];
        return;
    }
    document.directory.updating = true;

    loadDatabase($("#collection").val());
    document.directory.nextBoards = null;
    $(".games-container").empty();
    $("#number-of-games").text(0);
    document.branches.upToDate = false;
    document.directory.upToDate = !document.directory.upToDate;
    boards = boards.slice(1);
    const moves = boards.reduce((acc, curr) => acc += intToB64FourChr(curr.scan), '')
    let aliases = [moves];
    let transpositions = new Set();
    transpositions.add(moves);
    let moveCount = 0;
    let currMoveLength = moves.length + 4;
    let visited = new Set();
    if (moves == '') {
        localDirectory.transpositions = [null];
        document.directory.upToDate = false;
        setTimeout(() => {//console.log('no longer document.directory.updating!'); 
            document.directory.updating = false; checkForBoardUpdates()
        }, 100);
    }
    getTranspositions(aliases, transpositions, visited, currMoveLength, moves);
}
function getTranspositions(aliases, transpositions, visited, currMoveLength, moves) {
    // console.time("getTranspositions");
    let remLength = aliases.length
    for (let a = 0; a < remLength; a++) {
        let alias = aliases[a];
        const alias_full = [...transpositions].filter(x => x.startsWith(alias)).at(0);
        if (alias.length == moves.length && !transpositions.has(alias)) transpositions.add(alias);
        while (aliases[a].length > currMoveLength && alias.length > 8) {
            if (!visited.has(aliases[a])) {
                let temp = database.transpositions[aliases[a].length].reduce((acc, curr) => { if (curr.includes(aliases[a])) acc.push(...curr.filter(x => !aliases.includes(x))); return acc; }, []);
                temp = temp.filter(x => !!database.rangeLookup.get(Math.min(x.length, database.rangeLookup.get('maxLength'))).get(x.slice(0, database.rangeLookup.get('maxLength'))));
                temp = temp.map(x => x + alias_full.slice(x.length))
                temp = temp.filter(x => !transpositions.has(x))
                visited.add(aliases[a]);
                aliases = aliases.concat(...temp.filter(x => !aliases.includes(x)));
                temp.forEach(x => transpositions.add(x));
            }
            aliases[a] = aliases[a].slice(0, aliases[a].length - 4)
        }
    }
    if (aliases.filter(x => x.length > currMoveLength).length == 0) {
        currMoveLength -= 4;
    }
    if (aliases.reduce((acc, curr) => acc.length > curr.length ? acc : curr, aliases[0]).length > 8) {
        setTimeout(getTranspositions, 3, aliases, transpositions, visited, currMoveLength, moves);
        return;
    } else {
        // console.log(transpositions)
        let ranges = [];

        localDirectory.transpositions = [...transpositions];
        localDirectory.searchRange = [0, 100];
        let timeout;
        if (document.directory.indexStep > 0) {
            timeout = 4000;
        }
        else {
            timeout = 1000;
        }
        document.directory.upToDate = false;
        setTimeout(() => {//console.log('no longer document.directory.updating!'); 
            document.directory.updating = false; checkForBoardUpdates()
        }, timeout);
        return;
    }
}

function checkForBoardUpdates(boards) {
    if (!document.directory.updating) {
        if (boards) {
            setTimeout(updateDatabase, 500, boards);
        } else if (document.directory.nextBoards) {
            if (document.directory.nextBoards.length == mainGame.boards.length)
                setTimeout(updateDatabase, 500, document.directory.nextBoards);
            else {
                setTimeout(checkForBoardUpdates, 1000, mainGame.boards);
            }
        }
    } else {
        if (boards)
            document.directory.nextBoards = boards;
    }
}

let localDirectory = {};
let searchForGamesRange = [null, null];
document.directory.searchRange = [];
document.directory.discoverRanges = [];
document.directory.upToDate = false;
document.directory.indexStep = 0;
document.directory.indexes = [];
function searchForGames(searchRange, calculationStep, upToDate) {
    // console.log("searchForGames", searchRange, calculationStep, upToDate)
    if (upToDate && !document.directory.upToDate)
        return [[0, 0], 0, 0];
    if (calculationStep == 0) {
        document.branches.upToDate = false;
        document.directory.indexStep = 0;
        document.directory.searchRange = [];
        if (localDirectory.transpositions && localDirectory.searchRange) {
            document.directory.searchRange = localDirectory.searchRange;
            document.directory.transpositions = localDirectory.transpositions;
            document.directory.discoverRanges = [];
            document.directory.upToDate = true;
            return [localDirectory.searchRange, 1, upToDate];
        } else {
            return [[0, 0], 0, false];
        }
    }
    if (calculationStep == 1) { // calculate search ranges
        document.directory.indexes = [];
        let ranges = [];
        const transpositions = document.directory.transpositions;
        if (!transpositions[0] && mainGame.currentBoard == 0) {
            document.directory.discoverRanges.push([0, database.data.length - 1]);
            return [[0, 2000], 2, upToDate];
        }
        let [searchStart, searchEnd] = [searchRange[0], Math.min(searchRange[1], transpositions.length)];
        if (searchStart < transpositions.length) {
            transpositions.slice(searchStart, searchEnd).map(t => {
                if (database.rangeLookup.get(t.length)) {
                    const range = database.rangeLookup.get(t.length).get(t);
                    if (range) ranges.push(range);
                    // console.log(database.rangeLookup.get(t.length).get(t));
                } else {
                    const maxLength = database.rangeLookup.get('maxLength');
                    let range = database.rangeLookup.get(maxLength).get(t.slice(0, maxLength));
                    if (range) {
                        range[1]++;
                        const idx1 = database.data.slice(...range).findIndex(x => x[9].startsWith(t));
                        const idx2 = database.data.slice(...range).findLastIndex(x => x[9].startsWith(t));
                        if (idx1 != -1 && idx2 != -1)
                            ranges.push([idx1 + range[0], idx2 + range[0]])
                    }
                }
            });
            searchStart = searchEnd;
            searchEnd += 100;
            if (transpositions.length < 90) {
                [searchStart, searchEnd] = [0, 2000];
                calculationStep++;
            }
        } else {
            searchStart = 0;
            searchEnd = 2000;
            calculationStep++;
        }
        if (upToDate) {
            document.directory.discoverRanges.push(...ranges);
            if (document.directory.discoverRanges.length == 0) {
                $(".games-container").empty();
                $("#number-of-games").text(0);
                document.branches.upToDate = false;
                return [[0, 0], 0, 0];
            }
            return [[searchStart, searchEnd], calculationStep, upToDate];
        } else {
            // clear directory
            return [[0, 100], 0, 0];
        }
    } else if (calculationStep == 2) { // search for games
        let indexes = [];
        const criteria = [$("#Sort").val().slice(0, -3), $("#Sort").val().slice(-3)];
        // console.log("checkRange", searchRange)
        if (criteria[0]) {
            let [discoverStart, discoverEnd] = [searchRange[0], Math.min(searchRange[1], database.data.length)];
            const valueRanges = document.directory.discoverRanges;
            if (valueRanges.reduce((a, b) => a + b[1] - b[0], 0) < 150) {
                discoverEnd = database.data.length - 1;
                calculationStep++;
            }
            if (discoverStart < database.data.length) {
                if (criteria[1] == 'Asc') {
                    [discoverStart, discoverEnd] = [database.data.length - discoverEnd, database.data.length - discoverStart];
                }
                indexes = database.indexes[criteria[0]].slice(discoverStart, discoverEnd).filter((x) => valueRanges.filter(r => r[0] <= x && x <= r[1]).length > 0);
                if (criteria[1] == 'Asc') indexes = indexes.reverse();
                if (document.directory.updating) {
                    searchRange[1] += 500;
                    if (searchRange[1] - searchRange[0] > 1000) {
                        searchRange[0] += 2000;
                    } else {
                        searchRange[0] += 500;
                    }
                } else {
                    searchRange[1] += 2000;
                    if (searchRange[1] - searchRange[0] > 1000) {
                        searchRange[0] += 2000;
                    } else {
                        searchRange[0] += 500;
                    }
                }
            } else {
                calculationStep++;
            }
        }
        if (upToDate) {
            // if (document.directory.indexes.reduce ...)
            document.directory.indexes.push(...indexes);
            document.branches.upToDate = true;
            if (document.directory.indexStep < 150 && document.directory.indexes.length > document.directory.indexStep) {
                if (document.directory.indexStep == 0) $(".games-container").empty();
                for (let i = 0; i < 25; i++) {
                    if (document.directory.indexStep < document.directory.indexes.length) {
                        displayGame(database.data[document.directory.indexes[document.directory.indexStep]], document.directory.indexes[document.directory.indexStep]);
                        document.directory.indexStep++;
                    }
                }
            }
            return [searchRange, calculationStep, upToDate];
        } else {
            // console.log("Not up to date!");
            return [[0, 2000], 0, 0];
        }
    } else if (calculationStep == 3) { // done searching; rest
        if (!upToDate)
            return [[0, 0], 0, 0];
        return [searchRange, calculationStep, 0];
    }
}

let loopRange = [0, 0];
let loopStep = 0;
let loopNull;
setInterval(() => {
    [loopRange, loopStep, loopNull] = searchForGames(loopRange, loopStep, document.directory.upToDate);
}, 450);

setInterval(() => {
    if (mainGame.currentBoard == 0) {
        $("#number-of-games").text(database.data.length.toLocaleString());
        return;
    }
    if (document.directory.indexes.length > 0) {
        const idxl = document.directory.indexes.length;
        const nog = parseInt($("#number-of-games").text().replace(',', ''));
        if (idxl - nog > 10)
            $("#number-of-games").text(Math.round(nog + ((idxl - nog) / 5)).toLocaleString());
        else
            $("#number-of-games").text(idxl.toLocaleString());}
}, 75);
// document.hoverGame = -1;
function displayGame(arr, idx=-1) {
    const num = idx;
    const color = arr[10] == "1-0" ? "white-border" : arr[10] == "0-1" ? "black-border" : "";
    let $gameContainer = $(`<div class="game-container ${color}"></div>`);
    const round = ['world_championships','candidates','interzonals'].includes($("#collection").val()) ? ` Rd. ${arr[0]}` : ''
    let $event = $('<p class="event-date-result"></p>').text(arr[1] + round);
    let $dateAndResult = $('<p class="event-date-result date-result"></p>').text(arr[2] + " \xa0 •\xa0  " + arr[10]);
    let $whiteTitle = $('<p class="title"></p>').text(arr[7]);
    let $whitePlayer = $('<p class="player"></p>').text(arr[3]);
    let $whiteRating = arr[5] ? $('<p class="rating"></p>').text('(' + arr[5] + ')') : $('<p class="rating"></p>')
    let $linebreak = $('<br>');
    let $blackTitle = $('<p class="title black"></p>').text(arr[8]);
    let $blackPlayer = $('<p class="player black"></p>').text(arr[4]);
    let $blackRating = arr[6] ? $('<p class="rating black"></p>').text('(' + arr[6] + ')') : $('<p class="rating black"></p>')
    $gameContainer.append($event)
        .append($dateAndResult)
        .append($whiteTitle)
        .append($whitePlayer)
        .append($whiteRating)
        .append($linebreak)
        .append($blackTitle)
        .append($blackPlayer)
        .append($blackRating)
    if (idx != null) {
    $gameContainer.mouseenter(() => { document.dispatchEvent(new CustomEvent("gameHover", { detail: num })) })
        .mouseleave(() => { document.dispatchEvent(new CustomEvent("gameUnhover")) })
        .click(() => { document.switchToGame = num; setSelectedGame(num); });}
    $(".games-container").append($gameContainer);
    
}

function setSelectedGame(idx) {
    if (idx == -1) {
        $(".selected-game-container").css({ "visibility": "collapse", "height": "0" })
    } else {
        let game = database.data[idx];
        $(".selected-game-text.players").text(`${game[3]} - ${game[4]} `);
        let year = game[2].slice(0, 4);
        $(".selected-game-text.year").text(`(${year})`);
        const event = game[1].length > 1 ? game[1].endsWith('.') ? `${game[1]} ` : `${game[1]}.` : ''
        $(".selected-game-text.event").text(`${event} `);
        const site = game[11].length > 1 ? `${game[11]}. ` : '';
        $(".selected-game-text.result").text(`${site}${game[10]}.`);
        $(".selected-game-container").css({ "visibility": "visible", "height": "auto" });
        let month = game[2].slice(5, 7);
        let day = game[2].slice(8, 10);
        let month2 = month == 12 ? 1 : parseInt(month) + 1;
        let year2 = month2 == 1 ? parseInt(year) + 1 : year;
        $(".youtube-icon").unbind("click");
        $(".export-icon.normal").unbind("click");
        $(".export-icon.blue-filter").unbind("click");
        $(".youtube-icon").click(() => { document.dispatchEvent(new CustomEvent(`icon-click`, {detail: {'icon': 'youtube', 'database': $("#collection").val(), 'game': game}})) });
        // if (['titled_arena','titled_tuesday'].includes($("#collection").val()))
        //     $(".youtube-icon").css({ "visibility": "hidden"});
        // else
        //     $(".youtube-icon").css({ "visibility": "visible"});
        $(".export-icon.normal").click(() => { document.dispatchEvent(new CustomEvent(`icon-click`, {detail: {'icon': 'pgn', 'database': $("#collection").val(), 'game': game}})) });
        $(".export-icon.blue-filter").click(() => { document.dispatchEvent(new CustomEvent(`icon-click`, {detail: {'icon': 'display-game', 'database': $("#collection").val(), 'game': game}})) });
    }
}

$(document).on("icon-click", (event) => {
    const game = event.detail.game;
    switch (event.detail.icon) {
        case "youtube":
            switch (event.detail.database) {
                case "world_championships":
                    window.open(`https://www.youtube.com/results?search_query=${game[1]}+game+${game[0]}`);
                    // window.open(`https://www.google.com/search?q=${game[3]}+${game[4]}+${event}+round+${game[0]}+&tbs=cdr:1,cd_min:${month}/${day}/${year},cd_max:${month2}/${day}/${year2}&tbm=vid`) })
                    break;
                case "candidates":
                    window.open(`https://www.youtube.com/results?search_query=${game[1]}+game+${game[0]}+${game[3]}+${game[4]}`);
                    break;
                case "interzonals":
                    window.open(`https://www.youtube.com/results?search_query=${game[1]}+${game[2].splice(0, 4)}+game+${game[0]}+${game[3]}+${game[4]}`);
                    break;
                case "tcec":
                    window.open(`https://www.youtube.com/results?search_query=${game[1]}+${game[3]}+${game[4]}`);
                    break;
                case "lichess_broadcasts":
                    window.open(`https://www.youtube.com/results?search_query=${game[1]}+${game[3]}+${game[4]}`);
            }
            break;
        case "pgn":
            let pgn = "";
            pgn += `[Event "${game[1]}"]\n`;
            if (["candidates", "world_championships", "interzonals"].includes($("#collection").val()))
                pgn += `[Round "${game[0]}"]\n`;
            pgn += `[Date "${game[2]}"]\n`;
            pgn += `[Site "${game[11]}"]\n`;
            pgn += `[White "${game[3]}"]\n`;
            pgn += `[Black "${game[4]}"]\n`;
            pgn += `[Result "${game[10]}"]\n`;
            pgn += `[WhiteElo "${game[5]}"]\n`;
            pgn += `[BlackElo "${game[6]}"]\n`;
            pgn += `[WhiteTitle "${game[7]}"]\n`;
            pgn += `[BlackTitle "${game[8]}"]\n\n`;
            for (let i = 0; i * 4 < game[9].length; i++)
                if (i % 2 == 0)
                    pgn += `${i / 2 + 1}. ${scanToAlgebraic(b64FourChrToInt(game[9].slice(i * 4, i * 4 + 4)))} `;
                else
                    pgn += `${scanToAlgebraic(b64FourChrToInt(game[9].slice(i * 4, i * 4 + 4)))} `;
            pgn += game[10];
            alert(pgn);
            break;
        case "display-game":
            switch (event.detail.database) {
                case "world_championships":
                    window.open(`https://www.google.com/search?q=${game[1]}+game+${game[0]}+site%3Achessgames.com`);
                    break;
                case "candidates":
                case "interzonals":
                    window.open(`https://www.google.com/search?q=${game[1]}+${game[4]}+site%3Achessgames.com`);
                    break;
                case "tcec":
                    window.open('https://tcec-chess.com/#x=archive');
                    break;
                case "lichess_broadcasts":
                    window.open(`https://lichess.org/study/${game[0]}`);
                    break;
                case "titled_arena":
                    window.open(game.at(0) + `#${mainGame.currentBoard}`);
                    break;
                case "titled_tuesday":
                    const month = game[2].slice(5, 7);
                    const day = game[2].slice(8, 10);
                    const year = game[2].slice(0, 4);
                    window.open(`https://www.chess.com`);
                    break;
                
        }
    }

    }
);