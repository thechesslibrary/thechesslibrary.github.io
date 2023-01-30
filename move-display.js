

$(document).ready(() => {
    $("#move-branches").empty();
    for (let i = 0; i < 20; i++)
        createBranch(i, null, null, null, null, null);
    document.branches = {};
    document.branches.upToDate = true;
    document.branches.branches = {};
    document.branches.totalGames = 0;
    document.branches.step = 0;
});
var hover = null;

function updateBranches() {
    const sortedBranches = Object.entries(document.branches.branches).sort((a, b) => b[1][0]- a[1][0]);
    const gameCount = Object.entries(document.branches.branches).reduce((acc, curr) => acc + curr[1][1] + curr[1][2] + curr[1][3], 0);
    for (let i = 0; i < 20; i++) {
        const branch = sortedBranches[i];
        if (branch) {
            const total = branch[1][1] + branch[1][2] + branch[1][3];
            const white = branch[1][1] / total * 100;
            const black = branch[1][2] / total * 100;
            const draw = branch[1][3] / total * 100;
            updateBranch(i, scanToAlgebraic(b64FourChrToInt(branch[0])), white, draw, black, total / gameCount * 100, 'visible');
        } else {
            updateBranch(i, null);
        }
    }
}

function createBranch(id, move, white, draw, black, percentage, visibility='visible') {
    const $move = $('<p class="branch text no-left-padding"></p>').text(move);
    let $percentages = $('<div class="branch percentage"></div>');
    const $white = $('<div class="white-percentage"></div>');
    const $draw = $('<div class="draw-percentage"></div>');
    const $black = $('<div class="black-percentage"></div>');
    const $percent = $('<p class="branch text no-right-padding"></p>').text(`${percentage}%`);
    $percentages.append($white).append($draw).append($black);
    let $branch = $(`<div class="move-branch branch${id}"></div>`).append($move).append($percentages).append($percent);
    $branch.css('visibility', visibility);
    return $('#move-branches').append($branch);
}

function updateBranch(id, move, white=0, draw=100, black=0, percentage=0, visibility='hidden') {
    let $branch = $(`.branch${id}`);
    if (!move) {
        $branch.css('visibility', 'collapse').css('display', 'none').css('height', '0px').css('min-height', '0px').css('padding-bottom', '0px');
        return;
    }
    $branch.find('.branch.text').text(move);
    $branch.find('.white-percentage').css('width', `${white}%`);
    $branch.find('.draw-percentage').css('width', `${draw}%`);
    $branch.find('.black-percentage').css('width', `${black}%`);
    percentage = Math.round(percentage)
    $branch.find('.branch.text.no-right-padding').text(`${Math.round(percentage)}%`);
    const display = visibility == 'hidden' ? 'none' : 'grid';
    $branch.css('visibility', visibility).css('display', display).css('height', '10%').css('min-height', '10%').css('padding-bottom', '1.5%');
}

$(document).on("boards-update", (event, hoverGame = null) => {
    updateMoves(event.detail.allBoards, event.detail.currentBoard);
});

$(document).on("ply-update", (event, hoverGame = null) => {
    updateMoves(event.detail.allBoards, event.detail.currentBoard);
});

$(document).on("gameHover", (event) => {
    hover = event.detail;
    updateMoves(mainGame.boards.slice(0, mainGame.currentBoard + 1), mainGame.currentBoard);
});

$(document).on("gameUnhover", (event) => {
    hover = null;
    updateMoves(mainGame.boards, mainGame.currentBoard);
});

function scanToAlgebraic(num) {
    let scan = '';
    if (num & 0b1_00_000_000_000_000000_000000) {
        if (num & 0b100000) return "O-O";
        return "O-O-O";
    }
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const pieces = ["", "", "N", "B", "R", "Q", "K"];
    scan += pieces[(num & 0b0_00_000_000_111_000000_000000) >> 12];
    const disambig = (num & 0b0_11_000_000_000_000000_000000) >> 21;
    let modifiers = (num & 0b0_00_000_111_000_000000_000000) >> 15;
    modifiers = (modifiers == 0b111) ? 0 : modifiers;
    const origin = (num & 0b0_00_000_000_000_111111_000000) >> 6;
    const dest = (num & 0b0_00_000_000_000_000000_111111);
    if (scan) {
        if (disambig & 0b01) scan += files[Math.floor(origin / 8)];
        if (disambig & 0b10) scan += (origin % 8) + 1;
    } else if (!scan && (modifiers & 0b001)) {
        scan += files[Math.floor(origin / 8)];
    }
    scan += modifiers & 0b001 ? "x" : "";
    scan += files[Math.floor(dest / 8)] + ((dest % 8) + 1).toString();
    const promotion = (num & 0b0_00_111_000_000_000000_000000) >> 18;
    if (![0b011, 0b000].includes(promotion)) {
        const promotions = ['', '', '', '', 'N', 'B', 'R', 'Q',]
        scan += '=';
        scan += promotions[promotion];
    }
    
    scan += (modifiers & 0b010) ? "+" : "";
    scan += (modifiers & 0b100) ? "#" : "";
    return scan;
}

function updateMoves(boards, currentBoard) {
    // console.log(boards, currentBoard, document.directory.search.games[hover][10])
    $(".moves-block").empty();
    let moveClass = "";
    let newHoverBoards = [];
    if (!Object.is(hover, null) && hover < document.directory.search.games.length && hover >= 0) {
        let hoverBoards = document.directory.search.games[hover][10];
        hoverBoards = hoverBoards.slice(currentBoard * 4, hoverBoards.length);
        let move = 0;
        let halfMoves = currentBoard + 1;
        for (let chr in hoverBoards) {
            move = (move << 6) + b64ScanToInt(hoverBoards[chr]);
            if (chr % 4 == 3) {
                newHoverBoards.push({scan: move, halfMoves: halfMoves++});
                // console.log(intToB64FourChr(move), move, hoverBoards[chr])
                move = 0;
            }
        }
        // conso
    }
    for (let [idx, board] of boards.slice(1, boards.length).concat(newHoverBoards).entries()) {
        let $moveContainer = $(`<div class="move-container"></div>`)
                            .click(() => {document.dispatchEvent(new CustomEvent("switchToMove", {detail: board.halfMoves}))});
        if (idx + 1 == currentBoard) moveClass = " move-current";
        if (idx + 1 > currentBoard) moveClass = " move-after";
        if (board.halfMoves % 2 == 1)
            $moveContainer.append(`<p class="move-text${moveClass}">${Math.floor((board.halfMoves + 1) / 2)}.</p>`);
        $moveContainer.append(`<p class="move-text ${moveClass}">${scanToAlgebraic(board.scan)}</p>`);
        $(".moves-block").append($moveContainer);
    }
    return;
}
