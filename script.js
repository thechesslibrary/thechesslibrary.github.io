// Note: every use of the word "scan" in this document refers to the ChessScan notation method, as outlined in the root directory.

const canvas = document.getElementById('chessboard');
const ctx = canvas.getContext('2d');
const CANVAS_SIZE = 800;
let LIGHT_SQUARE_COLOR = '#C1C8C9';
let DARK_SQUARE_COLOR = '#A4A29B';
const PIECES_PATH = 'https://raw.githubusercontent.com/thechesslibrary/thechesslibrary.github.io/main/resources/pieces/With%20Shadow/256px/';
const PIECES_SUFFIX = '?raw=true'
// const PIECES_PATH = 'resources/pieces/With Shadow/256px/';
const DESELECTED_GRAY = '#808080';
let board_flipped = false;
let globalScale = 1;
let globalTranslate = 0;
let animating = false;
var arrowsEnabled = true;
var legalsEnabled = true;

// Web mouse events
canvas.onmousemove = (event) => {
    const rect = canvas.getBoundingClientRect();
    mousePos[0] = (event.clientX - rect.left) / globalScale;
    mousePos[1] = (event.clientY - rect.top) / globalScale;
};
canvas.addEventListener("touchmove", function (e) {
    e.preventDefault();
    if (mouseDown) {
        mousePos[0] = (e.changedTouches[0].clientX - canvas.offsetLeft) / globalScale;
        mousePos[1] = (e.changedTouches[0].clientY - canvas.offsetTop) / globalScale;}
  }, false);
canvas.onmouseup = () => {mouseDown = false;}
canvas.onmousedown = (e) => {e.preventDefault(); mouseDown = true;}
canvas.onmouseenter = () => {animating = true; animate();}
canvas.onmouseleave = () => {animating = false;}

$(".legals").click(() => {
    if (legalsEnabled)
        $(".legals").attr("src", "resources\\icons\\legals-disabled.png");
    else {
        $(".legals").attr("src", "resources\\icons\\legals-enabled.png");
    }
    legalsEnabled = !legalsEnabled;
});

$(".arrows").click(() => {
    if (arrowsEnabled) {
        $(".arrows").attr("src", "resources\\icons\\arrows-disabled.png");
        arrowQueue = [];
    }
    else {
        $(".arrows").attr("src", "resources\\icons\\arrows-enabled.png");
    }
    arrowsEnabled = !arrowsEnabled;
});

document.addEventListener('keydown', event => {
    if (event.key == 'f') {
      board_flipped = !board_flipped;
      arrowQueue = mainGame.regenerateArrowQueue();
 } else if (event.key == 'ArrowLeft') {
    mainGame.back(1);
 }
});

document.addEventListener('keydown', event => {
    if (event.key == 'ArrowRight') {
        mainGame.forward(1);
    }});

document.addEventListener('switchToMove', event => {
    mainGame.setMove(event.detail);
})

// Mobile touch events
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); 
    mouseDown = true; 
    mousePos[0] = (e.changedTouches[0].clientX - canvas.offsetLeft) / globalScale;
    mousePos[1] = (e.changedTouches[0].clientY - canvas.offsetTop) / globalScale;})
canvas.addEventListener('touchend', (e) => {
    e.preventDefault(); 
    mouseDown = false;})


const hexToRGB = (hex) => {
    return [parseInt(hex.substring(1, 3), 16), parseInt(hex.substring(3, 5), 16), parseInt(hex.substring(5, 7), 16)];
}

const rgbToHex = (rgb) => {
    return '#' + rgb.map(x => {
        const hex = Math.floor(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

const color = (piece) => {return piece.toUpperCase() == piece ? 'W' : 'B';}

const oppositeColor = (color) => {return color == 'W' ? 'B' : 'W';}

/** Class for the pieces that show up when a promotion is available.
 * @extends DynamicImage
 */
class PromotionPiece extends DynamicImage {
    constructor(...params) {
        super(...params);
        this.holdable = false;
        this.details["x"]["save"] = this.details["x"]["end"];
        this.details["y"]["save"] = this.details["y"]["end"];
        this.hovered = false;
    }

    static construct(dict) {
        return new PromotionPiece(...DynamicImage.evaluate(dict));
    }

    draw(ctx, otherParams = []) {
        if (this.holdable) {
            this.details["x"]["end"] = mousePos[0];
            this.details["y"]["end"] = mousePos[1];
        } else {
            if (this.details["x"]["frame"] == this.details["x"]["totalFrames"]) {
                this.details["x"]["end"] = this.details["x"]["save"];
                this.details["y"]["end"] = this.details["y"]["save"];
            }
        }
        super.draw(ctx, ...otherParams)
    }

    hover() {
        this.pre = (ctx) => {
            ctx.shadowBlur = 5;
            ctx.shadowColor = "black";
            this.hovered = true;
        };
    }
    unhover () {
        this.pre = ()=>{};
        this.hovered = false;
    }
}

/** Class to represent arrows drawn onto the board.
 * @extends Line
 */
class BoardArrow extends Line{
    constructor(sq1, sq2, lineWidth, lineCap, color, transparency, headLength) {
        if (board_flipped) {sq1 = 63 - sq1; sq2 = 63 - sq2}
        super(0, 0, 0, 0, lineWidth, lineCap, color, transparency, 0, 1, (ctx) => {ctx.shadowColor="#00000044"; 
            ctx.shadowBlur=10; 
            ctx.shadowOffsetX=3; 
            ctx.shadowOffsetY=3;});
        this.sq1 = sq1;
        this.sq2 = sq2;
        this.headLength = headLength;
        this.x1 = ((this.sq1 % 8) + 0.5) * Piece.PIECE_SIZE;
        this.y1 = (Math.floor(this.sq1 / 8) + 0.5) * Piece.PIECE_SIZE;
        this.x2 = ((this.sq2 % 8) + 0.5) * Piece.PIECE_SIZE
        this.y2 = (Math.floor(this.sq2 / 8) + 0.5) * Piece.PIECE_SIZE;
        this.l = Math.sqrt((this.y2 - this.y1) ** 2 + (this.x2 - this.x1) ** 2) * 0.875;
        this.midpoint = [(this.x1 + this.x2) / 2, (this.y1 + this.y2) / 2];
        this.rotation = -Math.atan2(this.x2 - this.midpoint[0], this.y2 - this.midpoint[1]) * 180 / Math.PI;
        [this.x1, this.y1] = [this.midpoint[0], this.midpoint[1] - (this.l) / 2];
        [this.x2, this.y2] = [this.midpoint[0], this.midpoint[1] + (this.l) / 2];
        this.flipped_details = null;
    }
    draw(ctx) {
        let saved_details;
        super.draw(ctx);
        ctx.save();
        ctx.translate(this.midpoint[0], this.midpoint[1]);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.lineWidth = this.lineWidth;
        ctx.lineCap = this.lineCap;
        ctx.strokeStyle = `rgba(${this.color[0]}, ${this.color[1]}, ${this.color[2]}, ${this.transparency})`;
        ctx.beginPath();
        ctx.moveTo(-this.headLength, this.l / 2 - this.headLength);
        ctx.lineTo(0, this.l / 2);
        ctx.lineTo(this.headLength, this.l / 2 - this.headLength)
        ctx.stroke();
        ctx.closePath();
        ctx.restore();
    }
}

/**Visual representation of a chess piece 
 * @param {string} piece: piece type (K, Q, R, B, N, P) and lowercase for black
 * @param {number} sq: square number (0-63)
*/
class Piece extends Sprite {
    static get PREFIX() {return PIECES_PATH;}
    static get SUFFIX() {return PIECES_SUFFIX;}
    static get PIECE_SIZE() {return 100;}

    /** Generates Piece[] array from FEN string
     * @param {fen} string: FEN string
     * @returns array of pieces
     */
    static loadFromFen(fen) {
        let sq = 0;
        let arr = [];
        let enPassantSq = fen.split(' ')[3];
        if (enPassantSq != '-') {
            let enPassantFile = enPassantSq.charCodeAt(0) - 97;
            let enPassantRank = parseInt(enPassantSq[1]) - 1;
            enPassantSq = enPassantRank * 8 + enPassantFile;
            if (fen.split(' ')[1] == 'w')
                arr.push(new Piece('x', enPassantSq));
            else
                arr.push(new Piece('X', enPassantSq));
        }
        for (let letter = 0; letter < fen.length; letter++) {
            if (['k', 'q', 'r', 'b', 'n', 'p'].includes(fen[letter].toLowerCase())) {
                arr.push(new Piece(fen[letter], sq));
            } else if (['1', '2', '3', '4', '5', '6', '7', '8'].includes(fen[letter])) {
                sq += parseInt(fen[letter]) - 1;
            } else if (fen[letter] == ' ') {
                return arr;
            } else if (fen[letter] == '/') {
                sq--;
            }
            sq++;
        }
    }

    constructor(piece, sq) {
        let piece_png = Piece.PREFIX.concat(color(piece), piece.toUpperCase(), '.png', Piece.SUFFIX)
        super(piece_png, 0, 0, Piece.PIECE_SIZE, Piece.PIECE_SIZE);
        this.piece = piece;
        this.color = color(piece);
        this.sq = sq;
        this.x = 0;
        this.y = 0;
        this.movable = false;
        this.exists = true;
    }
    draw(ctx) {
        if (!this.exists)
            return;
        if (!this.movable) {
            if (board_flipped) this.sq = 63 - this.sq;
            this.x = Math.floor(this.sq % 8) * 100;
            this.y = Math.floor(this.sq / 8) * 100;
            if (board_flipped) this.sq = 63 - this.sq;
        } else {
            this.x = mousePos[0] - 50;
            this.y = mousePos[1] - 50;
        }
        super.draw(ctx);
    }
    held() {
        this.movable = true;
    }

    /** Attempts to move piece to destination square. */
    drop(mousePos) {
        this.movable = false;
        let destination = Math.floor(mousePos[0] / 100) + Math.floor(mousePos[1] / 100) * 8;
        if (board_flipped) {destination = 63 - destination;}
        return mainGame.attempt(this.sq, destination);
    }
}

/** Class to draw rotating squares to indicate legal moves. White by default.
 * @extends DynamicRectangle
 * @param {number} sq: square number (0-63)
 * @param {boolean} isCapture: true if move is a capture (makes LegalIndicator red)
 * @param {boolean} isCheck: true if move is a check (makes LegalIndicator purple; dark purple if also capture)
 */
class LegalIndicator extends DynamicRectangle {
    constructor(sq, isCapture, isCheck=false) {
        let x = Math.floor(sq % 8) * 100;
        let y = Math.floor(sq / 8) * 100;
        let s = Piece.PIECE_SIZE;
        let size = 33;
        let color = [0, 0, 0];
        if (isCapture) {
            if (isCheck) color = [125, 0, 125];
            else color = [255, 0, 0];
        } else {
            if (isCheck) color = [255, 0, 255];
            else color = [255, 255, 255];
        }
        super(0, 20, x + s/2, y + s/2, 0, 0, color, 0, 0, 0,
            x + s/2 - size/2, y + s/2 - size/2, size, size, color, 0.75, 45, 1, (ctx) => {ctx.shadowBlur = 10; ctx.shadowColor = rgbToHex(color);});
        this.sq = sq;
        this.realSq = sq;
        this.killClock = 200;
        this.killSpeed = 0;
    }

    draw(ctx) {
        this.killClock -= this.killSpeed;
        if (this.killClock <= 0) {
            this.alive = false;
        }
        super.draw(ctx);
    }

    kill() {
        if (this.killSpeed != 0) return;
        let x = Math.floor(this.sq % 8) * 100;
        let y = Math.floor(this.sq / 8) * 100;
        let s = Piece.PIECE_SIZE;
        let size = 33;
        this.addToUpdateQueue(
            [
                new DynamicStage(x + s/2 - size/2, x + s/2, 0, 20).attr('x'),
                new DynamicStage(y + s/2 - size/2, y + s/2, 0, 20).attr('y'),
                new DynamicStage(size, 0, 0, 20).attr('width'),
                new DynamicStage(size, 0, 0, 20).attr('height'),
                new DynamicStage(45, 0, 0, 20).attr('rotation'),
                new DynamicStage(1, 0, 0, 20).attr('transparency')
            ]
        )
        this.killSpeed = 1;
    }
}

let pieceQueue = Piece.loadFromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
var arrowQueue = [];
let dynamicQueue = [];
let overlayQueue = [];
let promotionMode = false;

function generateBoardFromSprites(queue, castling, halfMoves) {
    let pieceArray = Array.from(Array(64), x => "");
    for (let i = 0; i < queue.length; i++) {
        pieceArray[queue[i].sq] = queue[i].piece;
    }
    //console.log(pieceArray);
    return new Board(pieceArray, castling, halfMoves);
}

class RenderGame extends Game {
    constructor(boards) {
        super(boards);
    }

    regenerateArrowQueue() {
        if (!arrowsEnabled) return;
        const [dest, origin] = [ChessScan.scan_sq_to_render_sq(this.board().scan & 63), ChessScan.scan_sq_to_render_sq((this.board().scan & 0b111111000000) >> 6)];
        if (this.currentBoard == 0) return [];
        if (origin == dest) return [];
        if (board_flipped) {
           return [new BoardArrow(origin, dest, 12.5, "round", [75, 75, 255], 1, 20)];
        } else {
            return [new BoardArrow(origin, dest, 12.5, "round", [75, 75, 255], 1, 20)];
        }
    }

    back(n) {
        pieceQueue = this.currentBoard > 0 ? generateSpritesFromBoard(this.board()) : Piece.loadFromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
        arrowQueue = this.regenerateArrowQueue();
        super.back(n);
    }

    forward(n) {
        pieceQueue = this.currentBoard > 0 ? generateSpritesFromBoard(this.board()) : Piece.loadFromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
        arrowQueue = this.regenerateArrowQueue();
        super.back(n);
    }

    attempt(origin, destination) {
        const board = super.attempt(origin, destination);
        if (board) arrowQueue = arrowsEnabled ? [new BoardArrow(origin, destination, 12.5, "round", [75, 75, 255], 1, 20)] : [];
        return board ? generateSpritesFromBoard(board) : pieceQueue;
    }

    promote(piece) {
        const board = super.promote(piece);
        return board ? generateSpritesFromBoard(board) : pieceQueue;
    }
}

let cache = new MaxSizeMap(1000000);
let validMoveChecks = [0, 0];

let broadcastTimer = 0;
let broadcastSpeed = window.matchMedia("@media (min-width:480px)") ? 250 : 500;

let mouseDownFrames = 0;
let mouseDown = false;
let mousePos = [0, 0];

const DEFAULT_BOARD = generateBoardFromSprites(pieceQueue, {'W': 3, 'B': 3}, 0, 0, []);

function generateSpritesFromBoard(pieceArray) {
    let queue = [];
    for (let i = 0; i < pieceArray.length; i++) {
        if (pieceArray[i] != "") {
            queue.push(new Piece(pieceArray[i], i));
        }
    }
    return queue;
}

let remove = null;
var mainGame = new RenderGame([DEFAULT_BOARD])
mainGame.promotionCallback = (game, origin, destination) => {
    promotionMode = true;
    game.board().halfMoves++;
    game.promotionTuple = [origin, destination];
    if (board_flipped) {
        game.board().halfMoves++;
        destination = 63 - destination;
    }
    dynamicQueue.push(DynamicRectangle.construct({"currentFrame": 0, "totalFrames": 20, "startX": 0, "startY": 0, "startWidth": 800, "startHeight": 800,
                                                "startTransparency": 0, "endTransparency":0.8}));
    let promotionBarX = Math.max(20, destination % 8 * 100 + 50 - 190);
    promotionBarX = Math.min(promotionBarX, 800 - 365 - 10);
    let secondary_color = [];
    let primary_color = mainGame.board().color() == 'B' ? LIGHT_SQUARE_COLOR : DARK_SQUARE_COLOR;
    hexToRGB(primary_color).forEach((value, idx) => (secondary_color.push(Math.max(value - 40, 0))));
    const startY = mainGame.board().color() == "B" ? -50 : 850;
    const endY = mainGame.board().color() == "B" ? 20 : 680;
    dynamicQueue.push(DynamicRectangle.construct({"currentFrame": 0, "totalFrames": 10, "startX": promotionBarX, "startY": startY, "startWidth": 365, "startHeight": 100,
                                                "startColor": secondary_color, "startTransparency": 1, "endY": endY}));
    dynamicQueue.push(DynamicRectangle.construct({"currentFrame": 0, "totalFrames": 10, "startX": promotionBarX + 10, "startY": startY, "startWidth": 365-20, "startHeight": 100-20,
                                                "startColor": hexToRGB(primary_color), "startTransparency": 1, "endY": endY + 10}));
    dynamicQueue.at(-1).pre = (ctx) => {
        ctx.shadowBlur = 10;
        ctx.lineJoin = "bevel";
        ctx.lineWidth = 10;
        ctx.strokeStyle = primary_color;
        ctx.shadowColor = primary_color;
    };
    dynamicQueue.at(-1).drawFunction = (ctx, params) => {ctx.strokeRect(...params); ctx.fillRect(...params);};
    dynamicQueue.at(-2).pre = (ctx) => {
        ctx.lineJoin = "bevel";
        ctx.lineWidth = 10;
        ctx.strokeStyle = rgbToHex(secondary_color);
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
    };
    dynamicQueue.at(-2).drawFunction = (ctx, params) => {ctx.strokeRect(...params); ctx.fillRect(...params);};
    let pieceDict = {"currentFrame": 0, "totalFrames": 10, "startY": startY, "startWidth": 70, "startHeight": 70,
    "startTransparency": 1, "endY": dynamicQueue.at(-1).details["y"]["end"] + 5, "startTransparency": 1}
    if (board_flipped) game.board().halfMoves--;    
    dynamicQueue.push(PromotionPiece.construct({...pieceDict, "startX": dynamicQueue.at(-1).details["x"]["end"] + 10, "img": PIECES_PATH + oppositeColor(mainGame.board().color()) + "N.png" + PIECES_SUFFIX}))
    dynamicQueue.push(PromotionPiece.construct({...pieceDict, "startX": dynamicQueue.at(-1).details["x"]["end"] + 85, "img": PIECES_PATH + oppositeColor(mainGame.board().color()) + "B.png" + PIECES_SUFFIX}))
    dynamicQueue.push(PromotionPiece.construct({...pieceDict, "startX": dynamicQueue.at(-1).details["x"]["end"] + 85, "img": PIECES_PATH + oppositeColor(mainGame.board().color()) + "R.png" + PIECES_SUFFIX}))
    dynamicQueue.push(PromotionPiece.construct({...pieceDict, "startX": dynamicQueue.at(-1).details["x"]["end"] + 85, "img": PIECES_PATH + oppositeColor(mainGame.board().color()) + "Q.png" + PIECES_SUFFIX}))
    game.board().halfMoves--;
}
document.switchToGame = -1;

function animate() {
    if (mainGame.presentBoards) {
        if (!mainGame.queuedBoards) {
            mainGame.queuedBoards = mainGame.presentBoards;
            if ($("#games-container")[0].childElementCount != 0)
                document.dispatchEvent(new CustomEvent("stop-directory"));
            broadcastTimer = 0;
        } else {
            if (broadcastTimer >= broadcastSpeed) {
                mainGame.dispatchBoards(queued=false);
            }
        }
        broadcastTimer++;
    }
    const SQ_COLORS = [LIGHT_SQUARE_COLOR, DARK_SQUARE_COLOR];
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let sq = r + c;
            ctx.fillStyle = SQ_COLORS[sq % 2];
            ctx.fillRect(c * Piece.PIECE_SIZE, r * Piece.PIECE_SIZE, Piece.PIECE_SIZE, Piece.PIECE_SIZE);
        }
    }
    if (!document.chessboardEnabled) {
        requestAnimationFrame(animate);
        return;
    }
    
    for (let promotion_piece in dynamicQueue) {
        if (dynamicQueue[promotion_piece] instanceof PromotionPiece) {
            const x = dynamicQueue[promotion_piece].details["x"]["save"];
            const y = dynamicQueue[promotion_piece].details["y"]["save"];
            const w = dynamicQueue[promotion_piece].details["width"]["end"];
            const h = dynamicQueue[promotion_piece].details["height"]["end"];
            if (mousePos[0] >= x && mousePos[0] <= x + w && mousePos[1] >= y && mousePos[1] <= y + h) {
                dynamicQueue[promotion_piece].hover();
            } else {
                dynamicQueue[promotion_piece].unhover();
            }
        }
    }
    if (mouseDown) {
        mouseDownFrames++;
        if (mouseDownFrames == 5) {
            globalScale = canvas.offsetWidth / 800;
            globalTranslate = (400 - (canvas.offsetWidth / 2))*(1/globalScale);
        }
        if (!promotionMode) {
            if ((mouseDownFrames > 0 || mouseDownFrames < 7) && pieceQueue.filter(p => p.movable).length == 0) {
                let sq = Math.floor(mousePos[0] / 100) + Math.floor(mousePos[1] / 100) * 8;
                sq = board_flipped ? 63 - sq : sq;
                let chosenPiece = -1;
                for (let i = 0; i < pieceQueue.length; i++) {
                    if (pieceQueue[i].sq == sq) {
                        chosenPiece = i;
                    }
                }
                if (chosenPiece >= 0 && !pieceQueue[chosenPiece].movable) {
                    pieceQueue.push(pieceQueue.splice(chosenPiece, 1)[0]);
                    pieceQueue.at(-1).held();
                    let validMoves = mainGame.getProspectsFrom(pieceQueue.at(-1).sq);
                    for (let v in validMoves) {
                        if (legalsEnabled) {
                            sq = board_flipped ? 63 - validMoves[v]["destination"] : validMoves[v]["destination"];
                            dynamicQueue.push(new LegalIndicator(sq, mainGame.board()[validMoves[v].destination] != '' && mainGame.board()[validMoves[v].destination].toUpperCase() != 'X' , !validMoves[v].board.kingSafeOn(-1, pieceQueue.at(-1).color)));
                        }
                    }
                }
            }
        }
        else {
            for (let promotion in dynamicQueue) {
                const promotionPiece = dynamicQueue[promotion];
                if (promotionPiece instanceof PromotionPiece && promotionPiece.hovered) {
                    const img = promotionPiece.image.src;
                    let promotion = img.substr(img.lastIndexOf(".png") - 1, 1);
                    if (mainGame.board().halfMoves % 2 == 1) {promotion = promotion.toLowerCase();}
                    promotionMode = false;
                    dynamicQueue = [];
                    pieceQueue = mainGame.promote(promotion);
                }
            }
        }
    } else {
        mouseDownFrames = 0;
        let movablePiece = pieceQueue.find(element => element.movable);
        if (movablePiece) {
            pieceQueue = movablePiece.drop(mousePos, pieceQueue);
            for (let j = 0; j < dynamicQueue.length; j++) {
                dynamicQueue[j].kill();
                }
            }
        }
    
    if (document.switchToGame != -1) {
        mainGame.switchToGame(document.directory.search.games[document.switchToGame][10]);
        document.dispatchEvent(new CustomEvent("ply-update", {detail: {boards: mainGame.boards.slice(0, mainGame.currentBoard + 1), currentBoard: mainGame.currentBoard, allBoards: mainGame.boards}}));
        document.switchToGame = -1;
    }
    
    dynamicQueue = dynamicQueue.filter(element => element.alive); 
    for (let piece in pieceQueue) pieceQueue[piece].draw(ctx);
    for (let arrow in arrowQueue) arrowQueue[arrow].draw(ctx);
    for (let sprite in dynamicQueue) dynamicQueue[sprite].draw(ctx);
    for (let overlay in overlayQueue) overlayQueue[overlay].draw(ctx);
    if (animating || (!animating && dynamicQueue.length > 0) || true) {
        requestAnimationFrame(animate);
    }
}
animate();