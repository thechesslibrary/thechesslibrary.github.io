// Note: every use of the word "scan" in this document refers to the ChessScan notation method, as outlined in the root directory.

const canvas = document.getElementById('chessboard');
const ctx = canvas.getContext('2d');
const CANVAS_SIZE = 800;
let LIGHT_SQUARE_COLOR = '#C1C8C9';
let DARK_SQUARE_COLOR = '#A4A29B';
const PIECES_PATH = 'resources/pieces/With Shadow/256px/';
const DESELECTED_GRAY = '#808080';
let board_flipped = false;
let globalScale = 1;
let globalTranslate = 0;

canvas.onmousemove = (event) => {
    const rect = canvas.getBoundingClientRect();
    mousePos[0] = (event.clientX - rect.left) / globalScale;
    mousePos[1] = (event.clientY - rect.top) / globalScale;
};

canvas.addEventListener("touchmove", function (e) {
    // mousePos = getMousePos(canvas, e);
    e.preventDefault();
    if (mouseDown) {
        mousePos[0] = (e.changedTouches[0].clientX - canvas.offsetLeft) / globalScale;
        mousePos[1] = (e.changedTouches[0].clientY - canvas.offsetTop) / globalScale;}
  }, false);

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

let animating = false;
canvas.onmousedown = (e) => {e.preventDefault(); mouseDown = true;}
canvas.addEventListener('touchstart', (e) => {e.preventDefault(); mouseDown = true; mousePos[0] = (e.changedTouches[0].clientX - canvas.offsetLeft) / globalScale;
mousePos[1] = (e.changedTouches[0].clientY - canvas.offsetTop) / globalScale;})
canvas.addEventListener('touchend', (e) => {e.preventDefault(); mouseDown = false; console.log('cancel')})
canvas.onmouseup = () => {mouseDown = false;}
canvas.onmouseenter = () => {animating = true; animate();}
canvas.onmouseleave = () => {animating = false;}
var arrowsEnabled = true;
var legalsEnabled = true;

function hexToRGB(hex) {
    return [parseInt(hex.substring(1, 3), 16), parseInt(hex.substring(3, 5), 16), parseInt(hex.substring(5, 7), 16)];
}

function rgbToHex(rgb) {
    return '#' + rgb.map(x => {
        const hex = Math.floor(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

function color(piece) {
    return piece.toUpperCase() == piece ? 'W' : 'B';
}

function oppositeColor(color) {
    return color == 'W' ? 'B' : 'W';
}

function getVal(dict, key, defaultValue) {
    return key in dict ? dict[key] : defaultValue;
}

class Sprite {
    constructor(img, x, y, width, height) {
        this.img = new Image();
        this.img.src = img;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    draw(ctx) {
        ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
    }
};

class Shape{
    constructor(drawFunction, color, transparency, rotation, scale, pre = (_)=>{}) {
        this.drawFunction = drawFunction;
        this.color = color;
        this.transparency = transparency;
        this.rotation = rotation;
        this.scale = scale;
        this.static = false;
        this.pre = pre;
    }

    draw(ctx, params, x, y, w, h) {
        ctx.save();
        this.pre(ctx);
        ctx.globalAlpha = this.transparency;
        ctx.fillStyle = `rgb(${this.color[0]}, ${this.color[1]}, ${this.color[2]})`;
        ctx.translate(x + w/2, y + h/2);
        ctx.rotate(this.rotation * (1 / 180) * Math.PI);
        ctx.scale(this.scale, this.scale);
        this.drawFunction(ctx, params);
        ctx.restore();
    }

}

class DynamicShape extends Shape{
    constructor(drawFunction, currentFrame, totalFrames, startColor, startTransparency, startRotation, startScale,
                endColor=null, endTransparency=null, endRotation=null, endScale=null, pre = (_)=>{}) {
        super(drawFunction, null, null, null, null);
        if (endColor == null) endColor = startColor;
        if (endTransparency == null) endTransparency = startTransparency;
        if (endRotation == null) endRotation = startRotation;
        if (endScale == null) endScale = startScale;
        this.details = {
            "red": {
                "start": startColor[0], "end": endColor[0], "frame": currentFrame, "totalFrames": totalFrames},
            "green": {
                "start": startColor[1], "end": endColor[1], "frame": currentFrame, "totalFrames": totalFrames},
            "blue": {
                "start": startColor[2], "end": endColor[2], "frame": currentFrame, "totalFrames": totalFrames},
            "transparency": {
                "start": startTransparency, "end": endTransparency, "frame": currentFrame, "totalFrames": totalFrames},
            "rotation": {
                "start": startRotation, "end": endRotation, "frame": currentFrame, "totalFrames": totalFrames},
            "scale": {
                "start": startScale, "end": endScale, "frame": currentFrame, "totalFrames": totalFrames}
        }
        this.alive = true;
        this.color = [];
        this.transparency = 0;
        this.rotation = 0;
        this.scale = 0;
        this.static = false;
        this.updateQueue = [];
        this.pre = pre;
    }

    update(updates) {
        for (let u in updates) {
            let param = updates[u][0];
            let value = updates[u][1];
            if (param in this.details) {
                this.details[param] = {...this.details[param], ...value};
            }
        }
    }

    addToUpdateQueue(update) {
        this.updateQueue.push(update);
    }

    detail(detail1, detail2) {
        return this.details[detail1][detail2];
    }
    
    stabilize_details(details) {
        for (let detail in details) {
            this.details[detail]["frame"] = 0;
            this.details[detail]["totalFrames"] = 0;
        }
    }

    incrementDetail(detail, incrementFrame=false) {
        if (this.detail(detail, "frame") >= this.detail(detail, "totalFrames"))
            return this.detail(detail, "end");
        else
            if (incrementFrame) this.details[detail]["frame"]++;
            return (this.detail(detail, "end") - this.detail(detail, "start")) * (this.detail(detail, "frame") / this.detail(detail, "totalFrames")) + this.detail(detail, "start");
    }

    draw(ctx, params, x, y, w, h) {
        this.color = [
            this.incrementDetail("red", true),
            this.incrementDetail("green", true),
            this.incrementDetail("blue", true)
        ]
        this.transparency = this.incrementDetail("transparency", true);
        this.rotation = this.incrementDetail("rotation", true);
        this.scale = this.incrementDetail("scale", true);
        if (Object.values(this.details).findIndex((detail) => detail.frame != detail.totalFrames) == -1)
            this.static = true;
        if (this.static) this.update(this.updateQueue.pop());
        super.draw(ctx, params, x, y, w, h);
        
    }
}

class DynamicRectangle extends DynamicShape{
    constructor(currentFrame, totalFrames, startX, startY, startWidth, startHeight, startColor, startTransparency, startRotation, startScale,
                endX=null, endY=null, endWidth=null, endHeight=null, endColor=null, endTransparency=null, endRotation=null, endScale=null, pre = (_)=>{}) {
        if (endX == null) endX = startX;
        if (endY == null) endY = startY;
        if (endWidth == null) endWidth = startWidth;
        if (endHeight == null) endHeight = startHeight;
        super((ctx, params) => ctx.fillRect(...params), currentFrame, totalFrames, startColor, startTransparency, startRotation, startScale, 
            endColor, endTransparency, endRotation, endScale);
        let details = {
            "x": {
                "start": startX, "end": endX, "frame": currentFrame, "totalFrames": totalFrames},
            "y": {
                "start": startY, "end": endY, "frame": currentFrame, "totalFrames": totalFrames},
            "width": {
                "start": startWidth, "end": endWidth, "frame": currentFrame, "totalFrames": totalFrames},
            "height": {
                "start": startHeight, "end": endHeight, "frame": currentFrame, "totalFrames": totalFrames}
            }
            this.details = {...this.details, ...details};
            this.x = 0;
            this.y = 0;
            this.width = 0;
            this.height = 0;
            this.pre = pre;
    }
    
    static construct(dict) {
        return new DynamicRectangle(getVal(dict, "currentFrame", 0), getVal(dict, "totalFrames", 0), getVal(dict, "startX", 0), getVal(dict, "startY", 0), getVal(dict, "startWidth", 0), getVal(dict, "startHeight", 0), getVal(dict, "startColor", [0, 0, 0]), getVal(dict, "startTransparency", 1), 
                                    getVal(dict, "startRotation", 0), getVal(dict, "startScale", 1), getVal(dict, "endX", null), getVal(dict, "endY", null), getVal(dict, "endWidth", null), getVal(dict, "endHeight", null), getVal(dict, "endColor", null), getVal(dict, "endTransparency", null), 
                                    getVal(dict, "endRotation", null), getVal(dict, "endScale", null));
    }

    draw(ctx, otherParams = []) {
        this.x = this.incrementDetail("x", true);
        this.y = this.incrementDetail("y", true);
        this.width = this.incrementDetail("width", true);
        this.height = this.incrementDetail("height", true);
        super.draw(ctx, [ -this.width/2, -this.height/2, this.width, this.height, ...otherParams], this.x, this.y, this.width, this.height);
    }

    kill() {
        // abstract function
    }
}

class DynamicImage extends DynamicRectangle {
    constructor(img, currentFrame, totalFrames, startX, startY, startWidth, startHeight, startTransparency, startRotation, startScale, 
                endX=null, endY=null, endWidth=null, endHeight=null, endTransparency=null, endRotation=null, endScale=null, pre = (_)=>{}) {
        super(currentFrame, totalFrames, startX, startY, startWidth, startHeight, [0, 0, 0], startTransparency, startRotation, startScale,
            endX, endY, endWidth, endHeight, [0, 0, 0], endTransparency, endRotation, endScale, pre);
        this.image = new Image();
        this.image.src = img;
        this.drawFunction = (ctx, params) => {
            ctx.drawImage(this.image, ...params);
        }
    }

    static construct(dict) {
        return new DynamicImage(...this.evaluate(dict));
    }

    static evaluate(dict) {
        return [getVal(dict, "img", 0), getVal(dict, "currentFrame", 0), getVal(dict, "totalFrames", 0), getVal(dict, "startX", 0), getVal(dict, "startY", 0), getVal(dict, "startWidth", 0), getVal(dict, "startHeight", 0), getVal(dict, "startTransparency", 1), getVal(dict, "startRotation", 0), getVal(dict, "startScale", 1), 
        getVal(dict, "endX", null), getVal(dict, "endY", null), getVal(dict, "endWidth", null), getVal(dict, "endHeight", null), getVal(dict, "endTransparency", null), getVal(dict, "endRotation", null), getVal(dict, "endScale", null), getVal(dict, "pre", (_)=>{})];
    }

    draw(ctx, otherParams = []) {
        super.draw(ctx, [...otherParams]);
    }
}

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
        this.pre = (_)=>{};
        this.hovered = false;
    }
}

class Line extends Shape {
    constructor(x1, y1, x2, y2, lineWidth, lineCap, color, transparency, rotation, scale, pre = (_)=>{}) {
        let lineLambda = (ctx, params) => {
            ctx.lineWidth = params[4];
            ctx.lineCap = params[5];
            ctx.strokeStyle = `rgba(${params[6][0]}, ${params[6][1]}, ${params[6][2]}, ${params[7]})`
            ctx.beginPath();
            ctx.moveTo(...params.slice(0, 2));
            ctx.lineTo(-params[0], -params[1]);
            ctx.stroke();
            ctx.closePath();
        };
        super(lineLambda, null, transparency, rotation, scale);
        this.x1 = x1;
        this.x2 = x2;
        this.y1 = y1;
        this.y2 = y2;
        this.lineWidth = lineWidth;
        this.lineCap = lineCap;
        this.color = color;
        this.pre = pre;
    }

    draw(ctx) {
        // console.log('drawing!');
        this.width = Math.abs(this.x2 - this.x1);
        this.height = Math.abs(this.y2 - this.y1);
        super.draw(ctx, [-this.width/2, -this.height/2, this.width, this.height, this.lineWidth, this.lineCap, this.color, this.x1, this.x2, this.y1, this.y2], this.x1, this.y1, this.width, this.height);
    }
}

class BoardArrow extends Line{
    constructor(sq1, sq2, lineWidth, lineCap, color, transparency, headLength) {
        if (board_flipped) {sq1 = 63 - sq1; sq2 = 63 - sq2}
        super(0, 0, 0, 0, lineWidth, lineCap, color, transparency, 0, 1, (ctx) => {ctx.shadowColor="#00000044"; ctx.shadowBlur=10; ctx.shadowOffsetX=3; ctx.shadowOffsetY=3;});
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
        // ctx.moveTo(0 - this.headLength, this.l / 2 - this.headLength);
        ctx.moveTo(-this.headLength, this.l / 2 - this.headLength);
        ctx.lineTo(0, this.l / 2);
        ctx.lineTo(this.headLength, this.l / 2 - this.headLength)
        ctx.stroke();
        ctx.closePath();
        ctx.restore();
    }
}

class Piece extends Sprite {
    static get PREFIX() {
        return PIECES_PATH;
    }
    static get PIECE_SIZE() {
        return 100;
    }
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
            //console.log(fen[letter].toLowerCase() in ['k', 'q', 'r', 'b', 'n', 'p']);
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
            //console.log(sq, fen[letter]);
        }
    }
    constructor(piece, sq) {
        let piece_png = Piece.PREFIX.concat(color(piece), piece, '.png')
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
    drop(mousePos, queue) {
        this.movable = false;
        let destination = Math.floor(mousePos[0] / 100) + Math.floor(mousePos[1] / 100) * 8;
        if (board_flipped) {destination = 63 - destination;}
        return mainGame.attempt(this.sq, destination);
    }
}

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
        //console.log(this.killClock)
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
                ["x", {"start": x + s/2 - size/2, "end": x + s/2, "frame": 0, "totalFrames": 20}],
                ["y", {"start": y + s/2 - size/2, "end": y + s/2, "frame": 0, "totalFrames": 20}],
                ["width", {"start": size, "end": 0, "frame": 0, "totalFrames": 20}],
                ["height", {"start": size, "end": 0, "frame": 0, "totalFrames": 20}],
                ["rotation", {"start": 45, "end": 0, "frame": 0, "totalFrames": 20}],
                ["transparency", {"start": 1, "end": 0, "frame": 0, "totalFrames": 20}]
            ]
        )
        this.killSpeed = 1;
    }
}

let pieceQueue = Piece.loadFromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
// var arrowQueue = [new Line(259, 400, 541, 400, 10, "round", [255, 255, 255], 1, 45, 1)];
var arrowQueue = [];
let dynamicQueue = [];
let overlayQueue = [];
let promotionMode = false;

class Board extends Array{
    constructor(array, castling, halfMoves, moves, todo) {
        super(...array); 
        this.castling = castling; // 0 if no castling, 1 if kingside, 2 if queenside, 3 if both
        this.halfMoves = halfMoves;
        this.moves = moves;
        this.todo = todo;
        this.scan = null;
    }
    removeCastling(color, side) {
        if (side == 'K')
            this.castling[color] = this.castling[color] > 1 ? this.castling[color] - 1 : 0;
        else if (side == 'Q')
            this.castling[color] = this.castling[color] > 1 ? this.castling[color] - 2 : this.castling[color];
        else
            this.castling[color] = 0;
        this.castling[color] = this.castling[color] < 0 ? 0 : this.castling[color];
    }
    at(x, y) {
        return this[x + y * 8];
    }
    kingSafeOn(sq = -1, kingColor = '') {
        if (kingColor == '') kingColor = this.halfMoves % 2 == 0 ? 'W': 'B';
        let kingSq = this.findIndex((piece) => piece.toUpperCase() == 'K' && color(piece) == kingColor);
        if (sq != -1) swap(this, sq, kingSq);
        let restoreHalfMoves = false;
        if (kingColor == this.halfMoves % 2 == 0 ? 'W': 'B') {this.halfMoves++; restoreHalfMoves = true;}
        let kingSafe = true;
        for (let i = 0; i < 64 && kingSafe; i++) 
            if (this[i] != '') kingSafe = getValidMoves(i, this, true);
        if (restoreHalfMoves) this.halfMoves--;
        if (sq != -1) swap(this, sq, kingSq);
        return kingSafe;
    }
    color() {
        return this.halfMoves % 2 == 0 ? 'W': 'B';
    }
    getAllValidMoves() {
        const validSquares = [...Array(64).keys()].filter((sq) => this[sq] != '' && color(this[sq]) == this.color())
        let validMoves = [];
        for (let sq in validSquares) {
            const moves = getValidMoves(validSquares[sq], this);
            validMoves.push(moves.map((move) => {return {"origin": validSquares[sq], "destination": move.square, "board": move.board}}))
        }
        return validMoves.flat();
    }
}

class Game {
    constructor(boards) {
        this.boards = boards;
        this.lastCapture = 0;
        this.allValidMoves = [];
        this.promotionTuple = [null, null];
        this.currentBoard = 0;
    }

    reset() {
        this.boards = [DEFAULT_BOARD];
    }

    board() {
        return this.boards.at(this.currentBoard);
    }

    currentBoardIsLast() {
        return this.currentBoard == this.boards.length - 1;
    }

    regenerateArrowQueue() {
        if (!arrowsEnabled) return;
        const [dest, origin] = [ChessScan.scan_sq_to_render_sq(mainGame.board().scan & 63), ChessScan.scan_sq_to_render_sq((mainGame.board().scan & 0b111111000000) >> 6)];
        if (this.currentBoard == 0) return [];
        if (origin == dest) return [];
        if (board_flipped) {
           return [new BoardArrow(origin, dest, 12.5, "round", [75, 75, 255], 1, 20)];
        } else {
            return [new BoardArrow(origin, dest, 12.5, "round", [75, 75, 255], 1, 20)];
        }
    }

    back(n) {
        this.currentBoard -= n;
        this.currentBoard = this.currentBoard < 0 ? 0 : this.currentBoard;
        arrowQueue = this.regenerateArrowQueue();
        pieceQueue = this.currentBoard > 0 ? generateSpritesFromBoard(this.board()) : Piece.loadFromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
        promotionMode = false;
        dynamicQueue = [];
        overlayQueue = [];
        this.allValidMoves = [];
        setTimeout(() => this.broadcastBoards(), 10);
    }

    forward(n) {
        this.currentBoard += n;
        this.currentBoard = this.currentBoard > this.boards.length - 1 ? this.boards.length - 1 : this.currentBoard;
        arrowQueue = this.regenerateArrowQueue();
        pieceQueue = this.currentBoard > 0 ? generateSpritesFromBoard(this.board()) : Piece.loadFromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
        this.allValidMoves = [];
        promotionMode = false;
        dynamicQueue = [];
        overlayQueue = [];
        setTimeout(() => this.broadcastBoards(), 10);
    }

    setMove(n) {
        if (this.currentBoard == 1 && n == 1) {
            this.back(1);
            return;
        }
        if (n < this.currentBoard) {
            this.back(this.currentBoard - n);
        } else if (n > this.currentBoard) {
            this.forward(n - this.currentBoard)
        }
    }

    switchToGame(str) {
        const currRemembered = this.currentBoard;
        this.boards = [DEFAULT_BOARD];
        this.allValidMoves = [];
        this.promotionTuple = [null, null];
        this.currentBoard = 0;
        let move = 0;
        let promotion;
        let num;
        const promotionArr = ['', '', '', '', 'N', 'B', 'R', 'Q']
        for (let chr in str) {
            num = b64ScanToInt(str[chr]);
            move = (move << 6) + num;
            switch (chr % 4) {
                case 0:
                    promotion = promotionArr[num & 0b111];
                    if ((chr / 4) % 2 == 1) promotion = promotion.toLowerCase();
                    break;
                
                case 2:
                    break;

                case 3:
                    this.update(ChessScan.scan_sq_to_render_sq((move & 4032) >> 6), ChessScan.scan_sq_to_render_sq(move & 63), true, promotion, move);
                    move = 0;
                    break;
                
                default:
                    break;
            }
        }
        this.currentBoard = currRemembered;
    }

    broadcastBoards() {
        document.dispatchEvent(new CustomEvent("boards-update", {detail: {boards: this.boards.slice(0, this.currentBoard + 1), currentBoard: this.currentBoard, allBoards: this.boards}}));
    }

    getMoveObjectIfValid(origin, destination) {
        return this.getAllValidMoves().filter((move) => move.origin == origin && move.destination == destination);
    }

    getValidMovesFrom(sq) {
        return this.getAllValidMoves().filter((move) => move.origin == sq);
    }

    getAllValidMoves() {
        if (this.allValidMoves.length == 0) {
            let validMoves = [];
            for (let sq = 0; sq < 64; sq++) {
                if (this.board()[sq] != "") {
                    const temp = getValidMoves(sq, this.board());
                    for (let move in temp)
                        validMoves = validMoves.concat({"origin": sq, "destination": temp[move]["square"], "board": temp[move]["board"]});
                }
            }
            this.allValidMoves = validMoves;
        }
        return this.allValidMoves;
    }

    update(origin, destination, force=false, promotion='', forceScan = 0) {
        const moveObj = new Move(origin, destination, this.board());
        let board;
        // console.log("Promotion", promotion)
        if (!force) {
            const validity = this.getMoveObjectIfValid(origin, destination);
            board = validity.at(0).board;
            if (!validity) return false;
        } else {
            // console.log(this.board(), origin, destination, this.board().halfMoves)
            board = getValidMoves(origin, this.board()).filter((move) => move.square == destination).at(0).board;
        }
        // if (!force) board.scan = moveObj.get_scan([...ChessScan.all]);
        // console.log(moveObj)
        if (promotion) {
            board.scan = moveObj.get_scan([ChessScan.disambiguation, ChessScan.piece]);
            if (promotion.toLowerCase() == 'n') board.scan = board.scan | (1 << 20);
            else if (promotion.toLowerCase() == 'b') board.scan = board.scan | (5 << 18);
            else if (promotion.toLowerCase() == 'r') board.scan = board.scan | (6 << 18);
            else if (promotion.toLowerCase() == 'q') board.scan = board.scan | (7 << 18);
            board[destination] = promotion;
            // console.log(moveObj.isCapture(), board.kingSafeOn(), board.getAllValidMoves().length != 0);
            if (!moveObj.isCapture() && !board.kingSafeOn() && (board.getAllValidMoves().length != 0))
                board.scan = board.scan | (7 << 15);
            else {
                // console.log(board.scan)
                board.scan += (moveObj.isCapture() << 15);
                board.scan += ((board.getAllValidMoves().length == 0) << 17);
                if (!(board.scan & (1 << 17)))
                    board.scan += (!board.kingSafeOn() << 16);
            }
        } else {
            board.scan = moveObj.get_scan([...ChessScan.all]);
            board.scan = board.scan | (3 << 18);
        }
        this.allValidMoves = [];
        if (forceScan) board.scan = forceScan;
        if (this.currentBoardIsLast()) {
            this.boards.push(board);
            this.currentBoard++;
        } else {
            // console.log("BOARDS", this.boards.at(1).scan, board.scan, this.currentBoard)
            if (board.scan == this.boards[this.currentBoard + 1].scan) {
                this.currentBoard++;
            } else {
                setSelectedGame(-1);
                this.boards = this.boards.slice(0, this.currentBoard + 1);
                this.boards.push(board);
                this.currentBoard++;
            }
        }
        if (!force) this.broadcastBoards();
        return true;
    }

    attempt(sq, destination) {
        const move = this.getMoveObjectIfValid(sq, destination).at(0);
        if (!move) {
            // console.timeEnd("Game Move")
            return pieceQueue;
        }
        arrowQueue = arrowsEnabled ? [new BoardArrow(sq, destination, 12.5, "round", [75, 75, 255], 1, 20)] : [];
        const board = move['board'];
        this.promotionBoard = board;
        if (board.todo.includes("promotion")) {
            let promotedPawn = -1;
            for (let pawn in [...Array(64).keys()]) {
                if (board[pawn].toLowerCase() == 'p' && [0, 7].includes(Math.floor(pawn / 8))) {
                    promotedPawn = parseInt(pawn);
                }
            }
            if (promotedPawn != -1) {
                promotionMode = true;
                mainGame.board().halfMoves++;
                this.promotionTuple = [sq, destination];
                if (board_flipped) {
                    mainGame.board().halfMoves++;
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
                if (board_flipped) mainGame.board().halfMoves--;    
                dynamicQueue.push(PromotionPiece.construct({...pieceDict, "startX": dynamicQueue.at(-1).details["x"]["end"] + 10, "img": PIECES_PATH + oppositeColor(mainGame.board().color()) + "N.png"}))
                dynamicQueue.push(PromotionPiece.construct({...pieceDict, "startX": dynamicQueue.at(-1).details["x"]["end"] + 85, "img": PIECES_PATH + oppositeColor(mainGame.board().color()) + "B.png"}))
                dynamicQueue.push(PromotionPiece.construct({...pieceDict, "startX": dynamicQueue.at(-1).details["x"]["end"] + 85, "img": PIECES_PATH + oppositeColor(mainGame.board().color()) + "R.png"}))
                dynamicQueue.push(PromotionPiece.construct({...pieceDict, "startX": dynamicQueue.at(-1).details["x"]["end"] + 85, "img": PIECES_PATH + oppositeColor(mainGame.board().color()) + "Q.png"}))
                // console.timeEnd("Game Move")
                mainGame.board().halfMoves--;
                return generateSpritesFromBoard(board);
            }
        }
        mainGame.board().todo.shift('promotion');
        this.update(sq, destination);
        // console.timeEnd("Game Move");
        return generateSpritesFromBoard(board);
         // todo
    }
    
    promote(piece) {
        this.update(...this.promotionTuple, false, piece);
        return generateSpritesFromBoard(this.board());
    }
}

class MoveSet extends Array{
    constructor(movelist) {
        super(...movelist);
    }
}

class MoveType{
    constructor(dx, dy, invIfBlack, invConditions, maxReps, forceCapture, reqs, post) {
        this.dx = dx;
        this.dy = dy;
        this.invIfBlack = invIfBlack;
        this.invX = invConditions[0];
        this.invY = invConditions[1];
        this.invAsPair = invConditions[2];
        this.inversions = [[1, 1]];
        if (this.invX && !this.invAsPair) this.inversions.push([-1, 1]);
        if (this.invY && !this.invAsPair) this.inversions.push([1, -1]);
        if (this.invX && this.invY) this.inversions.push([-1, -1]);
        if (this.invX && !this.invY && this.invAsPair) this.inversions.push([-1, 1]);
        if (this.invY && !this.invX && this.invAsPair) this.inversions.push([1, -1]);
        this.maxReps = maxReps;
        this.forceCapture = forceCapture; // 0 (doesn't matter), 1 (is capture), or 2 (is not capture)
        this.reqs = reqs;
        this.post = post;
    }
}

class ChessScan { 
    static get castling() {return "castling";} // enums
    static get piece() {return "piece";}
    static get promotion() {return "promotion";}
    static get modifiers() {return "modifiers";}
    static get disambiguation() {return "disambiguation";}
    static get all() {return [ChessScan.castling, ChessScan.piece, ChessScan.promotion, ChessScan.modifiers, ChessScan.disambiguation];}
    static render_coords_to_scan_sq(x, y) {return 8*x + (7-y);}
    static render_sq_to_scan_sq(sq) {return ChessScan.render_coords_to_scan_sq(sq % 8, Math.floor(sq / 8));}
    static scan_sq_to_render_sq(sq) {return Math.floor(sq / 8) + (7 - (sq % 8)) * 8;}
    static get pieceMap() {return {"p": 1, "n": 2, "b": 3, "r": 4, "q": 5, "k": 6};}
}

class Move{
    constructor(origin, destination, board, allowKingEndanger = false) {
        if (!(board instanceof Board)) throw new Error('board must be a Board object');
        this.origin = origin;
        if (Array.isArray(destination))
            this.destination = origin + destination[0] + (destination[1] * 8);
        else 
            this.destination = destination;
        this.board = board;
        this.post = board;
        this.allowKingEndanger = allowKingEndanger;
        this.scan = null;
        if (this.originPiece().toLowerCase() == 'k') {
            if (this.origin == 60 && this.destination == 62)
                this.scan = 0b1_00_000_000_110_100000_110000;
            else if (this.origin == 60 && this.destination == 58)
                this.scan = 0b1_00_000_000_110_100000_010000;
            else if (this.origin == 4 && this.destination == 6)
                this.scan = 0b1_00_000_000_110_100111_110111;
            else if (this.origin == 4 && this.destination == 2)
                this.scan = 0b1_00_000_000_110_100111_010111;
            else
                if (this.scan) 
                    this.scanKnownInformation = [ChessScan.piece, ChessScan.disambiguation, ChessScan.castling];
				else
                	this.scanKnownInformation = [ChessScan.castling];
        } else {
            this.scanKnownInformation = [ChessScan.castling];
        }
        this.scan = this.scan | ChessScan.render_sq_to_scan_sq(this.destination) | (ChessScan.render_sq_to_scan_sq(this.origin) << 6);
		this.scanKnownInformation = [ChessScan.castling];
    }
    destinationIsEmpty() {return this.board[this.destination] == '';}
    destinationX() {return this.destination % 8;}
    destinationY() {return Math.floor(this.destination / 8);}
    originX() {return this.origin % 8;}
    originY() {return Math.floor(this.origin / 8);}
    originColor() {return this.board[this.origin].length > 0 ? color(this.board[this.origin]) : '';}
    destinationColor() {return this.board[this.destination].length > 0 ? color(this.board[this.destination]) : '';}
    at(x, y) {return this.board[x + y * 8];}
    delta() {return [this.destinationX() - this.originX, this.destinationY() - this.originY()];}
    sign() {return [Math.sign(this.delta()[0]), Math.sign(this.delta()[1])];}
    originPiece(pieceMap) {return this.board[this.origin];}
    destinationPiece() {return this.board[this.destination];}
    originIs(x, y) {return this.originX() == x && this.originY() == y;}
    isCapture() {return this.destinationColor() != this.originColor() && this.destinationPiece() != '' && !(this.destinationPiece().toLowerCase() == 'x' && this.originPiece().toLowerCase() != 'p');}
    isCheckorMate() {
        let test = getValidMoves(this.origin, this.board, false).filter(obj => obj.square == this.destination);
        const out = [!test.at(0).board.kingSafeOn(-1, oppositeColor(this.originColor())), test.at(0).board.getAllValidMoves().length == 0];
        return out;
    }
    get_scan(informationRequests=null, post_board=null) {
        if (informationRequests == null) return this.scan;
        const discovers = informationRequests.filter(x => !this.scanKnownInformation.includes(x));
        if (discovers.includes(ChessScan.piece) || discovers.includes(ChessScan.all)) {
            this.scan = this.scan | (ChessScan.pieceMap[this.originPiece().toLowerCase()] << 12);
            this.scanKnownInformation.push(ChessScan.piece);
        }
        if (discovers.includes(ChessScan.modifiers) || discovers.includes(ChessScan.all)) {
            this.scan = this.scan | (this.isCapture() << 15);
            const [isCheck, isMate] = this.isCheckorMate();
            if (isMate)
                this.scan = this.scan | (isMate << 17);
            else
                if (isCheck) this.scan = this.scan | (isCheck << 16);
            this.scan = this.scan | (((!isCheck && !isMate && !this.isCapture()) * 7) << 15);
            // console.log(isCheck, isMate, this.isCapture(), this);
            this.scanKnownInformation.push(ChessScan.modifiers);
        }
        if (discovers.includes(ChessScan.disambiguation) || discovers.includes(ChessScan.all)) {
            const otherValidMoves = this.board.getAllValidMoves().filter(m => m.origin != this.origin && m.destination == this.destination && this.board[m.origin] == this.originPiece());
            const otherValidMovesSameX = otherValidMoves.filter(m => (m.origin % 8) == this.originX());
            const otherValidMovesSameY = otherValidMoves.filter(m => Math.floor(m.origin / 8) == this.originY());
            if (otherValidMoves.length >= 1 && this.originPiece().toLowerCase() != 'p') {
                if (otherValidMovesSameX.length == 0)
                    this.scan = this.scan | (1 << 21);
                else if (otherValidMovesSameY.length == 0)
                    this.scan = this.scan | (1 << 22);
                else
                    this.scan = this.scan | (3 << 21);
            }
            this.scanKnownInformation.push(ChessScan.disambiguation);
        }
        return this.scan;
    }
}

function generateBoardFromSprites(queue, castling, halfMoves, moves, todo) {
    let pieceArray = Array.from(Array(64), x => "");
    for (let i = 0; i < queue.length; i++) {
        pieceArray[queue[i].sq] = queue[i].piece;
    }
    //console.log(pieceArray);
    return new Board(pieceArray, castling, halfMoves, moves, todo);
}

function generateSpritesFromBoard(pieceArray) {
    let queue = [];
    for (let i = 0; i < pieceArray.length; i++) {
        if (pieceArray[i] != "") {
            queue.push(new Piece(pieceArray[i], i));
        }
    }
    return queue;
}

function swap(arr, i, j) {
    [arr[i], arr[j]] = [arr[j], arr[i]];
}

const promotion = (move) => {move.board.todo.push("promotion")};
const removeCastlingRook = (move) => {
    if (move.origin == 0 && move.originColor() == 'B') move.board.removeCastling('B', 'Q');
    else if (move.origin == 7 && move.originColor() == 'B') move.board.removeCastling('B', 'K');
    else if (move.origin == 56 && move.originColor() == 'W') move.board.removeCastling('W', 'Q');
    else if (move.origin == 63 && move.originColor() == 'W') move.board.removeCastling('W', 'K');
};
const movePiece = (move) => {
    for (let sq = 0; sq < 64; sq++) {
        if (move.board[sq].toLowerCase() == 'x' && color(move.board[sq]) != move.originColor()) {
            move.board[sq] = '';
        }
    }
    move.board[move.destination] = move.originPiece();
    move.board[move.origin] = '';
    move.board.halfMoves++;
    if (move.originColor() == 'W') move.board.moves++;
}
const pieceMoves = {
    'P': new MoveSet([
        new MoveType(0, -1, true, [0, 0, 0], 1, 2, [], [promotion, movePiece]), // NORMAL MOVE
        new MoveType(0, -2, true, [0, 0, 0], 1, 2, [ // DOUBLE MOVE
            (move) => move.at(move.originX(), move.originY() + Math.sign(move.delta()[1])) == '', // square in front is empty
            (move) => move.originColor() == 'W' ? (move.originY() == 6) :( move.originY() == 1) // on starting rank
        ],
            [(move) => {move.board[move.origin + 8*(move.originColor() == 'W' ? -1 : 1)] = // set en passant square
                move.originColor() == 'W' ? 'X' : 'x';}, promotion, movePiece]), 
        new MoveType(1, -1, true, [1, 0, 0], 1, true, [], [promotion, // CAPTURE
                (move) => {if (move.destinationPiece().toLowerCase() == 'x') { // en passant case
                    move.board[move.destination - 8*(move.originColor() == 'W' ? -1 : 1)] = ''; // remove en passanted piece
                }}, movePiece]),
    ]),

    'R': new MoveSet([
        new MoveType(1, 0, true, [1, 1, 1], 7, false, [], [removeCastlingRook, movePiece]), // HOTIZONTAL
        new MoveType(0, 1, true, [1, 1, 1], 7, false, [], [removeCastlingRook, movePiece]) // VERTICAL
    ]),

    'N': new MoveSet([
        new MoveType(1, 2, false, [1, 1, 0], 1, false, [], [movePiece]), // L SHAPE
        new MoveType(2, 1, false, [1, 1, 0], 1, false, [], [movePiece]) // ROTATED L SHAPE
    ]),

    'B': new MoveSet([
        new MoveType(1, 1, false, [1, 1, 0], 7, false, [], [movePiece]) // DIAGONAL
    ]),

    'Q': new MoveSet([
        new MoveType(1, 0, true, [1, 1, 1], 7, false, [], [movePiece]), // HORITZONTAL
        new MoveType(0, 1, true, [1, 1, 1], 7, false, [], [movePiece]), // VERTICAL
        new MoveType(1, 1, false, [1, 1, 0], 7, false, [], [movePiece]) // DIAGONAL
    ]),

    'K': new MoveSet([
        new MoveType(1, 0, true, [1, 1, 1], 1, false, [], [(move) => move.board.removeCastling(move.originColor(), ''), movePiece]), // HORITZONTAL
        new MoveType(0, 1, true, [1, 1, 1], 1, false, [], [(move) => move.board.removeCastling(move.originColor(), ''), movePiece]), // VERTICAL
        new MoveType(1, 1, false, [1, 1, 0], 1, false, [], [(move) => move.board.removeCastling(move.originColor(), ''), movePiece]), // DIAGONAL
        // CASTLING QUEENSIDE
        new MoveType(-2, 0, false, [0, 0, 0], 1, 2, reqs=[
            (move) => move.originX() == 4, // king is on starting file
            (move) => (move.originY() == 0 && move.originColor() == 'B') || (move.originY() == 7 && move.originColor() == 'W'), // king is on starting rank
            (move) => move.board.castling[move.originColor()] >= 2, // king can castle queenside
            (move) => move.board.at(3, move.originY()) == '' && move.board.at(1, move.originY()) == '', // squares between king and rook are empty
            (move) => move.allowKingEndanger ? true : move.board.kingSafeOn(3 + move.originY()*8, move.originColor()) && move.board.kingSafeOn(4 + move.originY() * 8, move.originColor())], // king is safe on squares between king and rook
            post=
            [(move) => move.board.removeCastling(move.originColor(), ''), // remove castling rights
            movePiece, // move king
            (move) => move.board[move.originX() - 1 + move.originY() * 8] = move.board[move.originY() * 8], // move rook
            (move) => move.board[move.originX() - 4 + move.originY() * 8] = '']), // remove rook from original square
        // CASTLING KINGSIDE
        new MoveType(2, 0, false, [0, 0, 0], 1, 2, reqs=[ 
            (move) => move.originX() == 4, // king is on starting file
            (move) => ((move.originY() == 0 && move.originColor() == 'B') || (move.originY() == 7 && move.originColor() == 'W')), // king is on starting rank
            (move) => move.board.castling[move.originColor()] % 2 == 1, // king can castle kingside
            (move) => move.board.at(5, move.originY()) == '',// square between king and rook is empty
            (move) => move.allowKingEndanger ? true : move.board.kingSafeOn(5 + move.originY() * 8, move.originColor()) && move.board.kingSafeOn(4 + move.originY() * 8, move.originColor()) // king is not in check or moving through check
        ], post=
            [(move) => move.board.removeCastling(move.originColor(), ''), // remove castling rights
            movePiece, // move king
            (move) => move.board[move.originX() + 1 + move.originY() * 8] = move.board[move.originX() + 3 + move.originY() * 8], // move rook
            (move) => move.board[move.originX() + 3 + move.originY() * 8] = '']) // remove rook from original square
    ])            
}

class MaxSizeMap extends Map{
    constructor(max) {
        super();
        this.max = max;
        this.removals = 0;
        this.hits = 0;
    }

    set(key, value) {
        if (this.size >= this.max) {
            this.delete(this.keys().next().value);
            this.removals++;
        }
        super.set(key, value);
    }

    has(key) {
        if (super.has(key)) {
            this.hits++;
            return true;
        }
        return false;
    }
}

let cache = new MaxSizeMap(1000000);
let validMoveChecks = [0, 0];
function getValidMoves(startingSquare, board, kingCapturable=false) {
    const boardString = board.toString() + board.castling.W + board.castling.B + (board.halfMoves % 2) + kingCapturable + startingSquare;
    if (cache.has(boardString)) {
        return cache.get(boardString);
    }
    if (!board[startingSquare]) return []; // empty square (shouldn't happen)
    let pieceType = board[startingSquare].toUpperCase(); // piece on starting square
    let validMoves = [];
    let playable = true;
    let moveType = null;
    let move = null;
    let delta = null;
    let inversion = null;
    let startingX = startingSquare % 8;
    let startingY = Math.floor(startingSquare / 8);
    // if (!kingCapturable) console.count('getValidMoves')
    if (pieceType == 'X' || (board.halfMoves % 2 == 0) != (color(board[startingSquare]) == 'W')) { // empty square
        return [];
    }
    for (i in pieceMoves[pieceType]) { // for each move type
        moveType = pieceMoves[pieceType][i];
        
        for (j in moveType.inversions) { // for each inversion
            inversion = moveType.inversions[j];
            let repetitions = 1;
            playable = true;
            while (repetitions <= moveType.maxReps && playable) { // for each extension of core move
                
                delta = [moveType.dx * repetitions, moveType.dy * repetitions];
                delta[0] = delta[0] * inversion[0];
                delta[1] = delta[1] * inversion[1];
                if (moveType.invIfBlack && color(board[startingSquare]) == 'B') {
                    delta[0] = -delta[0];
                    delta[1] = -delta[1];
                }
                if ((startingX + delta[0] < 0) || (startingX + delta[0] > 7) || (startingY + delta[1] < 0) || (startingY + delta[1] > 7)) playable = false; // out of bounds
                if (playable) {
                    let newBoard = new Board(JSON.parse(JSON.stringify(board)), {}, board.halfMoves, board.moves, []);
                    Object.assign(newBoard.castling, board.castling);
                    Object.assign(newBoard.todo, board.todo);
                    move = new Move(startingSquare, delta, newBoard, kingCapturable);
                    if (move.invIfBlack && move.originColor() == 'B') {
                        delta[0] = -delta[0];
                        delta[1] = -delta[1];
                    }
                    if ((moveType.forceCapture == 1 && !move.isCapture()) || (move.originColor() == move.destinationColor())
                        || (moveType.forceCapture == 2 && move.isCapture()))
                    {playable = false;}
                    
                    else {
                        playable = true;
                        for (let k = 0; k < moveType.reqs.length; k++) {
                            if (!moveType.reqs[k](move)) { // if any of the requirements are not met
                                playable = false;
                            }
                        }
                        // return false;
                        if (playable && kingCapturable && move.board[move.destination].toUpperCase() == 'K') {
                            cache.set(boardString, false);
                            return false;
                        }
                        if (playable) {
                            playable = ['','x'].includes(move.destinationPiece().toLowerCase()); // breaks loop if destination square is occupied
                            validMoves.push({"square": move.destination});
                            for (let k = 0; k < moveType.post.length; k++) { // apply each post-move function
                                moveType.post[k](move);
                            }
                            validMoves.at(-1)["board"] = move.board;
                            // console.log("validmoves = ", validMoves)
                            if (!kingCapturable) {
                                let legal = true;
                                let testBoard = validMoves.at(-1)["board"];
                                for (let i = 0; i < 64 && legal; i++) {
                                    if (testBoard[i] != '') {
                                        legal = getValidMoves(i, testBoard, true);
                                    }
                                }
                                if (!legal) {
                                    validMoves.pop();
                                }
                                // console.log("after pop = ", validMoves)
                            }
                        } 
                        repetitions++;
                    }
                }
            }
        }

    }
    if (kingCapturable) {
        cache.set(boardString, true);
        return true;
    }
    cache.set(boardString, validMoves);
    return validMoves; // returns an array of {square: int, board: Board} objects
}

let frame = 0;

let mouseDownFrames = 0;
let mouseDown = false;
let mousePos = [0, 0];

const DEFAULT_BOARD = generateBoardFromSprites(pieceQueue, {'W': 3, 'B': 3}, 0, 0, []);
let currFrame = 0;
let debugSpeed = 100;

let remove = null;
var mainGame = new Game([DEFAULT_BOARD])
document.switchToGame = -1;

function animate() {
    // frame++;
    if (frame % debugSpeed == 0) {
        globalScale = canvas.offsetWidth / 800;
        globalTranslate = (400 - (canvas.offsetWidth / 2))*(1/globalScale);
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
                    let validMoves = mainGame.getValidMovesFrom(pieceQueue.at(-1).sq);
                    for (let v in validMoves) {
                        if (legalsEnabled) {
                            sq = board_flipped ? 63 - validMoves[v]["destination"] : validMoves[v]["destination"];
                            dynamicQueue.push(new LegalIndicator(sq, mainGame.board()[validMoves[v].destination] != '' && mainGame.board()[validMoves[v].destination].toUpperCase() != 'X' , !validMoves[v]["board"].kingSafeOn(-1, pieceQueue.at(-1).color)));
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
        mainGame.switchToGame(database.data[document.switchToGame][9]);
        document.switchToGame = -1;
    }
    
    // console.log(mouseDownFrames);
    dynamicQueue = dynamicQueue.filter(element => element.alive); 
    for (let piece in pieceQueue) pieceQueue[piece].draw(ctx);
    for (let arrow in arrowQueue) arrowQueue[arrow].draw(ctx);
    for (let sprite in dynamicQueue) dynamicQueue[sprite].draw(ctx);
    for (let overlay in overlayQueue) overlayQueue[overlay].draw(ctx);
    if (animating || (!animating && dynamicQueue.length > 0 || true)) {
        requestAnimationFrame(animate);
    }
}
animate();