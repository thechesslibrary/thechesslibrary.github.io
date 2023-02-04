const prefix = 'https://media.githubusercontent.com/media/thechesslibrary/thechesslibrary.github.io/databases/';
// const prefix = 'resources/databases/'

$(document).ready(() => {
    document.chessboardEnabled = false;
    // $(".games-container").empty();
    loadDatabase($("#collection").val());
    $.get(prefix + 'transpositions.json', (t) => {
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
        displayGame(['','','','Loading Games...','This may take a second.','','','','','','','','',''], null);
        activeDatabase = db;
        $.get(prefix + db + '/lookups/lookups.json', (r) => {
                database.lookup = new Map();
                r = JSON.parse(r);
                for (let moveLength of Object.keys(r)) {
                    let section = new Map();
                    for (const [move, data] of Object.entries(r[moveLength])) {
                        section.set(move, [parseInt(data[0]), parseInt(data[1]), parseInt(data[2]), parseInt(data[3]), [parseInt(data[4][0]), parseInt(data[4][1])]]);
                    }
                    database.lookup.set(parseInt(moveLength), section);
                }
            }).done(() => {mainGame.dispatchBoards(); document.directory.updating = false; document.chessboardEnabled = true; prepareDirectory(mainGame.boards);}); //console.log(database);
            
        
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
        $(".banner-extra").css("visibility", "collapse");
    const task = new ScheduledTask(prepareDirectory, [event.detail.boards]).setLock(1).setNewSession(1).setSleep(10);
    scheduler.force(task); // force will add the current token to the task, which will be carried down the task chain
});

$("#collection").on("change", () => {
    loadDatabase($("#collection").val());
    scheduler.force(new ScheduledTask().setNewSession(1));
});

$("#Sort").on("change", () => {
    mainGame.dispatchBoards();
    scheduler.force(new ScheduledTask().setNewSession(1));
});

$(document).on("stop-directory", () => {
    scheduler.force(new ScheduledTask().setNewSession(1));
});

document.directory.nextBoards = [];

function prepareDirectory(boards) {
    $("#games-container").empty();
    displayGame(['','','','Loading Games...','This may take a second.','','','','','','','','',''], null);
    if (boards.length > 60) {
        document.directory.upToDate = false;
        localDirectory.transpositions = [];
        return;
    }
    document.directory.updating = true;
    loadDatabase($("#collection").val());
    document.directory.nextBoards = null;
    $("#number-of-games").text(0);
    document.directory.upToDate = !document.directory.upToDate;
    boards = boards.slice(1);
    const moves = boards.reduce((acc, curr) => acc += intToB64FourChr(curr.scan), '')
    let aliases = [moves];
    let transpositions = new Set();
    transpositions.add(moves);
    let currMoveLength = moves.length + 4;
    let visited = new Set();
    return new ScheduledTask(getTranspositions, [aliases, transpositions, visited, currMoveLength, moves]).setSleep(5);
}
const maxSize = {"world_championships": 2, "titled_tuesday": 32, "titled_arena": 16, "candidates": 2, "interzonals": 2, "lichess_broadcasts": 8};
function getTranspositions(aliases, transpositions, visited, currMoveLength, moves) {
    let remLength = aliases.length
    for (let a = 0; a < remLength; a++) {
        let alias = aliases[a];
        const alias_full = [...transpositions].filter(x => x.startsWith(alias)).at(0);
        if (alias.length == moves.length && !transpositions.has(alias)) transpositions.add(alias);
        while (aliases[a].length > currMoveLength && alias.length > 8) {
            if (!visited.has(aliases[a])) {
                let temp = database.transpositions[aliases[a].length].reduce((acc, curr) => { if (curr.includes(aliases[a])) acc.push(...curr.filter(x => !aliases.includes(x))); return acc; }, []);
                temp = temp.filter(x => !!database.lookup.get(Math.min(x.length, Math.max(Object.keys(database.lookup)))).get(x.slice(0, Object.keys(database.lookup))));
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
        return new ScheduledTask(getTranspositions, [aliases, transpositions, visited, currMoveLength, moves]);
    } else {
        localDirectory.transpositions = [...transpositions];
        return new ScheduledTask(getSearchRanges, [transpositions]).setSleep(10);
    }
}

let scheduleStage = 0;

let scheduler = new Scheduler();
let localDirectory = {};
let searchForGamesRange = [null, null];
document.directory.indexStep = 0;
document.directory.indexes = [];
document.directory.search = {};
document.directory.search.temp = [];
document.directory.search.games = [];
document.directory.search.cache = new MaxSizeMap(30);

function getSearchRanges(transpositions) {
    const collection = $("#collection").val();
    let ranges = [];
    let chunks = [];
    document.directory.search.games = [];
    for (let t of transpositions) {
        const stub = t.slice(0, 40);
        if (database.lookup.has(stub.length)) {
            const info = database.lookup.get(stub.length).get(stub);
            if (info) {
                let range = [Math.floor(info[4][0] / 5000), Math.floor(info[4][1] / 5000), []];
                range = ranges.find(r => r[0] === range[0] && r[1] === range[1]) ? null : range;
                if (range) {
                    if (range[0] == range[1]) {
                        if (!chunks.includes(range[0])) {
                            chunks.push(range[0]);
                        }
                    } else {
                        let range = [Math.floor(info[4][0] / 20000), Math.floor(info[4][1] / 20000), []];
                        const rightExtend = ranges.findIndex(x => range[0] >= x[0] - 1 && range[1] <= x[1] + 1 && range[1] >= x[1]);
                        const leftExtend = ranges.findIndex(x => range[0] >= x[0] - 1 && range[1] <= x[1] + 1 && range[0] <= x[0]);
                        const center = ranges.findIndex(x => range[0] >= x[0] && range[1] <= x[1]);
                        if (rightExtend != -1) {
                            ranges[rightExtend][1] = range[1];
                            ranges[rightExtend][2].push(info[4]);
                        }
                        if (leftExtend != -1) {
                            ranges[leftExtend][0] = range[0];
                            ranges[leftExtend][2].push(info[4]);
                        }
                        if (rightExtend == -1 && leftExtend == -1 && center == -1) {
                            range[2].push(info[4]);
                            ranges.push(range);
                        }
                    }
                }
            }
        }
    }
    let branches = {};
    transpositions = Array.from(transpositions);
    if (transpositions && transpositions.at(0).length <= 36) {
        let moveLength = transpositions.at(0).length;
        branches = [...database.lookup.get(moveLength + 4).entries()].reduce((acc, curr) => {
            [curr, data] = curr
            if (transpositions.includes(curr.slice(0, moveLength))) {
                const move = curr.slice(moveLength, moveLength + 4);
                if (move in acc) {
                    acc[move][0] += data[0];
                    acc[move][1] += data[1];
                    acc[move][2] += data[2];
                    acc[move][3] += data[3];
                } else {
                    acc[move] = data.slice(0, 4);
                }
            }
            return acc;
        }, {})
    }
    let requests = new Set();
    chunks.forEach(c => requests.add([5000, c]));
    document.directory.transpositions = transpositions;
    for (let r in ranges) {
        if (ranges[r][0] == ranges[r][1]) {
            requests.add([20000, ranges[r][0],]);
        } else if (ranges[r][2][0][1] - ranges[r][2][0][0] < 5000) {
            requests.add([5000, Math.floor(ranges[r][2][0][0] / 5000)]);
            requests.add([5000, Math.floor(ranges[r][2][0][1] / 5000)]);
        } else {
            const dist = ranges[r][1] - ranges[r][0];
            let step = Math.min(2**dist.toString(2).length, maxSize[collection] / 2);
            requests.add([step * 20000, Math.floor(ranges[r][0] / step)]);
            if ((step * Math.floor(ranges[r][0] / step)) + step < ranges[r][1])
                requests.add([step * 20000, (Math.floor(ranges[r][0] / step) + 1)]);
        }
    }
    document.branches.branches = branches;
    const timeout = [...requests].some(x => !document.directory.search.cache.has(x)) && !window.matchMedia("@media (min-width:480px)") ? 500 : 0;
    setTimeout((r) => pullGames(Array.from(r), $("#collection").val()), timeout, requests);
    return new ScheduledTask(gamesObserver, [requests.size]).setSleep(5);
}
var test = 0;

function gamesObserver(count) {
    if (document.directory.search.temp.length != count) {
        return new ScheduledTask(gamesObserver, [count]).setSleep(5);
    } else {
        return new ScheduledTask(sortGames, []);
    }
}

function pullGames(requests, database) {
    const criteria = [$("#Sort").val().slice(0, -3), $("#Sort").val().slice(-3)];
    const collection = $("#collection").val();
    document.directory.search.temp = [];
    $.each(requests, (i, r) => {
        let location;
        if (r[0] == 5000)
            location = `${prefix}${database}/chunks/${zfill(r[1])}.csv`;
        else
            location = `${prefix}${database}/sorted/${criteria[0]}/${criteria[1]}/${r[0]}/${zfill(r[1])}.csv`;
        games = document.directory.search.cache[r.toString() + criteria.toString() + ',' + collection];
        if (games) {
            document.directory.search.temp.push(games);
            console.log(`cache hit ${r.toString() + criteria.toString() + ',' + collection}`)
            return;
        } else {
        $.when($.get(location)).done(games => {
                console.log(`cache miss ${r.toString() + criteria.toString() + ',' + collection}`)
                const arr = $.csv.toArrays(games).slice(1, -1);
                document.directory.search.cache[r.toString() + criteria.toString() + ',' + collection] = arr;
                document.directory.search.temp.push(arr);
            });
        }
    });
}

function sortGames() {
    document.directory.search.games = document.directory.search.temp.flat();
    document.directory.search.temp = [];
    if (document.directory.transpositions.length == 0) return;
    const moveLength = document.directory.transpositions.at(0).length;
    document.directory.search.games = [...new Set(document.directory.search.games)].filter(g => document.directory.transpositions.includes(g[10].slice(0, moveLength)));
    const columns = ["index","StudyID","Event","Date","White","Black","WhiteElo","BlackElo","WhiteTitle","BlackTitle","Moves","Result","Site","Termination","TimeControl"];
    const criteria = [$("#Sort").val().slice(0, -3), $("#Sort").val().slice(-3)];
    document.directory.search.games.sort((a, b) => {
        const aVal = a.at(columns.indexOf($("#Sort").val().slice(0, -3)));
        const bVal = b.at(columns.indexOf($("#Sort").val().slice(0, -3)));
        if (["WhiteElo", "BlackElo"].includes(criteria[0]))
            return criteria[1] == "Dsc" ? bVal - aVal : aVal - bVal;
        else
            return criteria[1] == "Dsc" ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);});
    $("#games-container").empty();
    displayGame(['','','','Loading Games...','This may take a second.','','','','','','','','',''], null);
    return new ScheduledTask(addToDirectory, [0]);
}

function addToDirectory(idx) {
    if (idx == 0) {
        $("#games-container").empty();
        updateBranches();
        if (!Object.keys(document.branches.branches).length) {
            let moveLength = document.directory.transpositions.at(0).length;
            document.branches.branches = document.directory.search.games.reduce((acc, curr) => {
                [curr, result] = [curr[10], curr[11]];
                const move = curr.slice(moveLength, moveLength + 4);
                const resultArr = ["", "1-0", "0-1", "1/2-1/2"]
                if (move in acc) {
                    acc[move][0]++;
                    acc[move][resultArr.indexOf(result)]++;
                } else {
                    acc[move] = [1, 0, 0, 0]
                    acc[move][resultArr.indexOf(result)]++;
                }
                
                return acc;
        }, {})}
        updateBranches();

        let gameCount = document.directory.transpositions.reduce((acc, curr) => {
                return acc + (database.lookup.has(curr.length) ? parseInt(database.lookup.get(curr.length).get(curr)) : 0);
            }, 0)
        gameCount = gameCount > 0 ? gameCount :  Object.entries(document.branches.branches).reduce((acc, curr) => acc + curr[1][1] + curr[1][2] + curr[1][3], 0);
        $("#number-of-games").text(gameCount.toLocaleString());
    }
    displayGame(document.directory.search.games.at(idx), idx);
    // updateBranches(document.directory.search.games.at(idx));
    return new ScheduledTask(addToDirectory, [idx + 1]).setSleep(50);
}

function zfill(num, size=6) {
    return num.toString().padStart(size, 0)
}

function displayGame(arr, idx=-1) {
    if (!arr) return;
    const num = idx;
    const color = arr[11] == "1-0" ? "white-border" : arr[11] == "0-1" ? "black-border" : "";
    let $gameContainer = $(`<div class="game-container ${color}"></div>`);
    const round = ['world_championships','candidates','interzonals'].includes($("#collection").val()) ? ` Rd. ${arr[1]}` : ''
    let $event = $('<p class="event-date-result"></p>').text(arr[2] + round);
    let $dateAndResult = $('<p class="event-date-result date-result"></p>').text(arr[3] + " \xa0 •\xa0  " + arr[11]);
    let $whiteTitle = $('<p class="title"></p>').text(arr[8]);
    let $whitePlayer = $('<p class="player"></p>').text(arr[4]);
    let $whiteRating = arr[6] != 0 ? $('<p class="rating"></p>').text('(' + arr[6] + ')') : $('<p class="rating"></p>')
    let $linebreak = $('<br>');
    let $blackTitle = $('<p class="title black"></p>').text(arr[9]);
    let $blackPlayer = $('<p class="player black"></p>').text(arr[5]);
    let $blackRating = arr[7] != 0 ? $('<p class="rating black"></p>').text('(' + arr[7] + ')') : $('<p class="rating black"></p>')
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
    $gameContainer.mouseenter(() => { document.dispatchEvent(new CustomEvent("gameHover", { detail: num})) })
        .mouseleave(() => { document.dispatchEvent(new CustomEvent("gameUnhover")) })
        .click(() => { document.switchToGame = num; setSelectedGame(num); });}
    $(".games-container").append($gameContainer);
    
}

function setSelectedGame(idx) {
    if (idx == -1) {
        $(".selected-game-container").css({ "visibility": "collapse", "height": "0" })
    } else {
        if (idx > document.directory.search.games.length - 1) return;
        let game =  document.directory.search.games[idx];
        $(".selected-game-text.players").text(`${game[4]} - ${game[5]} `);
        let year = game[3].slice(0, 4);
        $(".selected-game-text.year").text(`(${year})`);
        const event = game[2].length > 1 ? game[1].endsWith('.') ? `${game[1]} ` : `${game[1]}.` : ''
        $(".selected-game-text.event").text(`${event} `);
        const site = game[12].length > 1 ? `${game[12]}. ` : '';
        $(".selected-game-text.result").text(`${site}${game[11]}.`);
        $(".selected-game-container").css({ "visibility": "visible", "height": "auto" });
        let month = game[3].slice(5, 7);
        let day = game[3].slice(8, 10);
        let month2 = month == 12 ? 1 : parseInt(month) + 1;
        let year2 = month2 == 1 ? parseInt(year) + 1 : year;
        $(".youtube-icon").unbind("click");
        $(".export-icon.normal").unbind("click");
        $(".export-icon.blue-filter").unbind("click");
        $(".youtube-icon").click(() => { document.dispatchEvent(new CustomEvent(`icon-click`, {detail: {'icon': 'youtube', 'database': $("#collection").val(), 'game': game}})) });
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
                    window.open(`https://www.youtube.com/results?search_query=${game[2]}+game+${game[1]}`);
                    break;
                case "candidates":
                    window.open(`https://www.youtube.com/results?search_query=${game[2]}+game+${game[1]}+${game[4]}+${game[5]}`);
                    break;
                case "interzonals":
                    window.open(`https://www.youtube.com/results?search_query=${game[2]}+${game[3].splice(0, 4)}+game+${game[1]}+${game[4]}+${game[5]}`);
                    break;
                case "tcec":
                    window.open(`https://www.youtube.com/results?search_query=${game[2]}+${game[4]}+${game[5]}`);
                    break;
                case "lichess_broadcasts":
                    window.open(`https://www.youtube.com/results?search_query=${game[2]}+${game[4]}+${game[5]}`);
            }
            break;
        case "pgn":
            let pgn = "";
            pgn += `[Event "${game[2]}"]\n`;
            if (["candidates", "world_championships", "interzonals"].includes($("#collection").val()))
                pgn += `[Round "${game[1]}"]\n`;
            pgn += `[Date "${game[3]}"]\n`;
            pgn += `[Site "${game[12]}"]\n`;
            pgn += `[White "${game[4]}"]\n`;
            pgn += `[Black "${game[5]}"]\n`;
            pgn += `[Result "${game[11]}"]\n`;
            pgn += `[WhiteElo "${game[6]}"]\n`;
            pgn += `[BlackElo "${game[7]}"]\n`;
            pgn += `[WhiteTitle "${game[8]}"]\n`;
            pgn += `[BlackTitle "${game[9]}"]\n\n`;
            for (let i = 0; i * 4 < game[10].length; i++)
                if (i % 2 == 0)
                    pgn += `${i / 2 + 1}. ${scanToAlgebraic(b64FourChrToInt(game[10].slice(i * 4, i * 4 + 4)))} `;
                else
                    pgn += `${scanToAlgebraic(b64FourChrToInt(game[10].slice(i * 4, i * 4 + 4)))} `;
            pgn += game[11];
            let $modal = $("<div>", {id: "modal"});
            let $modalContent = $("<div>", {id: "modal-content"});
            let $modalText = $("<p>").html(pgn.split("\n").join("<br>"));
            if (window.matchMedia("(orientation: portrait)").matches && pgn.length > 700)
                $modalText = $("<p>").html(pgn.split("\n").join("<br>").slice(0, 700) + "...");
            const $closeBtn = $("<button>", {
                text: "Close",
                click: function() {
                    $modal.fadeOut();
                }
            });
            const $copyBtn = $("<button>", {
                text: "Copy",
                class: "copy-btn",
                click: () => {
                    navigator.clipboard.writeText(pgn);
                }
            });
            $modalContent.append($modalText).append($copyBtn).append($closeBtn);
            $modal.append($modalContent);
            $("body").append($modal);
            break;
        case "display-game":
            switch (event.detail.database) {
                case "world_championships":
                    window.open(`https://www.google.com/search?q=${game[2]}+game+${game[1]}+site%3Achessgames.com`);
                    break;
                case "candidates":
                case "interzonals":
                    window.open(`https://www.google.com/search?q=${game[2]}+${game[5]}+site%3Achessgames.com`);
                    break;
                case "tcec":
                    window.open('https://tcec-chess.com/#x=archive');
                    break;
                case "lichess_broadcasts":
                    window.open(`https://lichess.org/study/${game[1]}`);
                    break;
                case "titled_arena":
                    window.open(game.at(1) + `#${mainGame.currentBoard}`);
                    break;
                case "titled_tuesday":
                    const month = game[3].slice(5, 7);
                    const day = game[3].slice(8, 10);
                    const year = game[3].slice(0, 4);
                    window.open(`https://www.chess.com`);
                    break;
                
        }
    }

    }
);