
/** Class to represent the current state of a chessboard.
 * Is-an array of string representations of pieces. (K, Q, R, B, N, P, k, q, r, b, n, p)
 * @extends Array
 * @param {Array} array: array of piece representations
 * @param {Object} castling: e.g. {"W": 0, "B": 0} (0 = no castling, 1 = K, 2 = Q, 3 = KQ)
 * @param {number} halfMoves: number of plys since game start; mostly used for determing turn
 */
class Board extends Array{
    constructor(array, castling, halfMoves) {
        super(...array); 
        this.castling = castling;
        this.halfMoves = halfMoves;
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

    /** Determines if the king of the given color is in check.
     * 
     * @param {number} sq: square the king is on
     * @param {string} kingColor: color of the king in question
     * @returns: boolean - true if king is in check
     */
    kingSafeOn(sq = -1, kingColor = '') {
        if (kingColor == '') kingColor = this.halfMoves % 2 == 0 ? 'W': 'B';
        let kingSq = this.findIndex((piece) => piece.toUpperCase() == 'K' && color(piece) == kingColor);
        if (sq != -1) swap(this, sq, kingSq);
        let restoreHalfMoves = false;
        if (kingColor == this.halfMoves % 2 == 0 ? 'W': 'B') {this.halfMoves++; restoreHalfMoves = true;}
        let kingSafe = true;
        for (let i = 0; i < 64 && kingSafe; i++) 
            if (this[i] != '') kingSafe = findProspects(i, this, true);
        if (restoreHalfMoves) this.halfMoves--;
        if (sq != -1) swap(this, sq, kingSq);
        return kingSafe;
    }

    /** Returns the color of the player whose move it currently is. */
    color() {
        return this.halfMoves % 2 == 0 ? 'W': 'B';
    }

    /** Returns an array of all possible moves as Prospects.
     * @returns: Prospects[] - array of Prospects
    */
    getAllProspects() {
        const validSquares = [...Array(64).keys()].filter((sq) => this[sq] != '' && color(this[sq]) == this.color())
        let validMoves = [];
        for (let sq in validSquares) {
            validMoves = validMoves.concat(findProspects(validSquares[sq], this));
        }
        return validMoves.flat();
    }
}

/** Class to represent a chess game as a series of Board objects.
 * 
 * @param {Board[]} boards: array of Board objects
 */
class Game {
    constructor(boards, promotionCallback = () => {}) {
        this.boards = boards;
        this.validProspects = [];
        this.promotionTuple = [null, null];
        this.currentBoard = 0;
        this.queuedBoards = null;
        this.presentBoards = null;
        this.dispatchDelayTime = 10;
        this.promotionCallback = promotionCallback;
    }

    reset() {
        this.boards = [DEFAULT_BOARD];
    }

    /** Getter for the current Board. */
    board() {
        return this.boards.at(this.currentBoard);
    }

    /** Returns true if the current Board is the newest one. */
    currentBoardIsLast() {
        return this.currentBoard == this.boards.length - 1;
    }

    /** Sets the current Board backwards by n steps.
     * @param {number} n: number of steps to go back
     */
    back(n) {
        this.currentBoard -= n;
        this.currentBoard = this.currentBoard < 0 ? 0 : this.currentBoard;
        promotionMode = false;
        dynamicQueue = [];
        overlayQueue = [];
        this.validProspects = [];
        if (this.dispatchDelayTime != -1) setTimeout(() => this.dispatchBoards(), this.dispatchDelayTime);
    }

    /** Sets the current Board forwards by n steps.
     * @param {number} n: number of steps to go forward
     */
    forward(n) {
        this.currentBoard += n;
        this.currentBoard = this.currentBoard > this.boards.length - 1 ? this.boards.length - 1 : this.currentBoard;
        this.validProspects = [];
        promotionMode = false;
        dynamicQueue = [];
        overlayQueue = [];
        if (this.dispatchDelayTime != -1) setTimeout(() => this.dispatchBoards(), this.dispatchDelayTime);
    }

    /** Sets the current Board to the nth Board.
     * @param {number} n: index of the Board to set to
     */
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

    /** Mutates the chess game the Game object is representing.
     * @param {str} game: chess game to switch to, in B64 SCAN format.
     * @post this.boards is mutated to be an array of Board objects representing the game.
     */
    switchToGame(game) {
        const currRemembered = this.currentBoard;
        this.boards = [DEFAULT_BOARD];
        this.validProspects = [];
        this.promotionTuple = [null, null];
        this.currentBoard = 0;
        let move = 0;
        let promotion;
        let num;
        const promotionArr = ['', '', '', '', 'N', 'B', 'R', 'Q']
        for (let chr in game) {
            num = b64ScanToInt(game[chr]);
            move = (move << 6) + num;
            switch (chr % 4) {
                case 0:
                    promotion = promotionArr[num & 0b111];
                    if ((chr / 4) % 2 == 1) promotion = promotion.toLowerCase();
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

    /** Dispatches a CustomEvent, alerting that the currentBoard or Boards have changed.
     * 
     * @param {boolean} queued: sends a "ply-update" event if true and queues a "boards-update" event
     *                         sends a "boards-update" event if false and clears the queue
     */
    dispatchBoards(queued=true) {
        if (queued) {
            document.dispatchEvent(new CustomEvent("ply-update", {detail: {boards: this.boards.slice(0, this.currentBoard + 1), currentBoard: this.currentBoard, allBoards: this.boards}}));
            this.presentBoards = {boards: this.boards.slice(0, this.currentBoard + 1), currentBoard: this.currentBoard, allBoards: this.boards};
            this.queuedBoards = null;
        } else {
            document.dispatchEvent(new CustomEvent("boards-update", {detail: {boards: this.boards.slice(0, this.currentBoard + 1), currentBoard: this.currentBoard, allBoards: this.boards}}));
            this.presentBoards = null;
            this.queuedBoards = null;
        }
    }

    /** Returns Prospect object if the move is valid, null otherwise.
     * @param {number} origin: origin square
     * @param {number} destination: destination square 
     * @returns {Prospect} prospect
     */
    getProspect(origin, destination) {
        return this.getAllProspects().filter((prospect) => prospect.origin == origin && prospect.destination == destination);
    }

    /** Returns all Prospect objects from a given square.
     * @param {number} sq: origin square 
     * @returns {Prospect[]} prospects
     */
    getProspectsFrom(sq) {
        return this.getAllProspects().filter((prospect) => prospect.origin == sq);
    }

    /** Returns all Prospect objects that are currently valid.
     * @returns {Prospect[]} prospects
     */
    getAllProspects() {
        if (this.validProspects.length == 0) {
            let validMoves = [];
            for (let sq = 0; sq < 64; sq++) {
                if (this.board()[sq] != "") {
                    validMoves = validMoves.concat(findProspects(sq, this.board()));
                }
            }
            this.validProspects = validMoves;
        }
        return this.validProspects;
    }

    fen() {
        const board = [...this.board()].map(p => p && p.toUpperCase() != 'X' ? p: '#')
        let fen = [0, 1, 2, 3, 4, 5, 6, 7].reduce((acc, curr) => {
            return acc + board.slice(curr * 8, (curr + 1) * 8).join('').replace(/#{1,8}/g, (match) => match.length) + '/'
        }, "").slice(0, -1);
        fen += ` ${this.currentBoard % 2 == 0 ? 'w' : 'b'} `;
        fen += this.board().castling.W % 2 == 1 ? 'K' : '';
        fen += this.board().castling.W > 1 ? 'Q' : '';
        fen += this.board().castling.B % 2 == 1 ? 'k' : '';
        fen += this.board().castling.B > 1 ? 'q' : '';
        fen += this.board().castling.W == 0 && this.board().castling.B == 0 ? '-' : '';
        fen += ` ${renderSqToAlgebraicStr(board.findIndex(sq => sq.toUpperCase() == 'X'))}`;
        if (fen.slice(-1) != " ") 
            fen += " " 
        else fen += "- ";
        const fiftyMove = this.boards.slice(0, this.currentBoard).reduce((acc, board, idx) => 
            [1, 3, 5].includes((board.scan & 0b0_00_000_111_000_000000_000000) >> 15) ||
            (board.scan & 0b0_00_000_000_111_000000_000000) >> 12 == 1 ? idx : acc, 0);
        fen += this.currentBoard - fiftyMove;
        fen += ` ${Math.round(this.currentBoard / 2)}`;
        return fen;
    }
    /** Directly updates the current board with a move.
     * @param {number} origin: origin square
     * @param {number} destination: destination square
     * @param {boolean} force: if true, skips validity checks, prospect generation, SCAN generation, and dispatching events
     * @param {string} promotion: if a pawn is being promoted, the piece to promote to
     * @param {number} forceScan: if force is true, the SCAN to use for the move
     * @returns {boolean} true if the move was valid
     */
    update(origin, destination, force=false, promotion='', forceScan = 0) {
        const moveObj = new Move(origin, destination, this.board());
        let board;
        if (!force) {
            const validity = this.getProspect(origin, destination);
            board = validity.at(0).board;
            if (!validity) return false;
        } else {
            board = findProspects(origin, this.board()).filter((prospect) => prospect.destination == destination).at(0).board;
        }
        board.halfMoves = this.board().halfMoves + 1;
        if (promotion) {
            board.scan = moveObj.getScan([ChessScan.disambiguation, ChessScan.piece]);
            if (promotion.toLowerCase() == 'n') board.scan = board.scan | (1 << 20);
            else if (promotion.toLowerCase() == 'b') board.scan = board.scan | (5 << 18);
            else if (promotion.toLowerCase() == 'r') board.scan = board.scan | (6 << 18);
            else if (promotion.toLowerCase() == 'q') board.scan = board.scan | (7 << 18);
            board[destination] = promotion;
            if (!moveObj.isCapture() && !board.kingSafeOn() && (board.getAllProspects().length != 0))
                board.scan = board.scan | (7 << 15);
            else {
                board.scan += (moveObj.isCapture() << 15);
                board.scan += ((board.getAllProspects().length == 0) << 17);
                if (!(board.scan & (1 << 17)))
                    board.scan += (!board.kingSafeOn() << 16);
            }
        } else {
            board.scan = moveObj.getScan([...ChessScan.all]);
            board.scan = board.scan | (3 << 18); // no promotion
        }
        this.validProspects = [];
        if (forceScan) board.scan = forceScan;
        if (this.currentBoardIsLast()) {
            this.boards.push(board);
            this.currentBoard++;
        } else {
            if (board.scan == this.boards[this.currentBoard + 1].scan) {
                this.currentBoard++;
            } else {
                this.boards = this.boards.slice(0, this.currentBoard + 1);
                this.boards.push(board);
                this.currentBoard++;
            }
        }
        if (!force && this.dispatchDelayTime != -1) this.dispatchBoards();
        return true;
    }

    /** Attempts to make a move, and returns the resulting board.
     * @param {number} origin: origin square
     * @param {number} destination: destination square
     * @returns {Board} resulting board; null if the move was invalid
     */
    attempt(origin, destination) {
        const prospect = this.getProspect(origin, destination).at(0);
        if (!prospect) return null;
        const board = prospect.board;
        this.promotionBoard = board;
        let promotedPawn = -1;
        for (let pawn in [...Array(64).keys()]) {
            if (board[pawn].toLowerCase() == 'p' && [0, 7].includes(Math.floor(pawn / 8))) {
                promotedPawn = parseInt(pawn);
            }
        }
        if (promotedPawn != -1) {
            this.promotionCallback(this, origin, destination);
            return board;
        }
        this.update(origin, destination);
        return board;
    }
    
    promote(piece) {
        this.update(...this.promotionTuple, false, piece);
        return this.board();
    }
}

/** A simple wrapper for an array of MoveTypes. */
class MoveSet extends Array{
    constructor(movelist) {
        super(...movelist);
    }
}

/** A class representing the direction and condition of the form of a move executed by a piece.
 * For example, the king has 5 MoveTypes: horizontal, vertical, diagonal, castling kingside, and castling queenside.
 * @param {number} dx: the change in x position of the piece after the move.
 * @param {number} dy: the change in y position of the piece after the move.
 * @param {boolean} invIfBlack: whether dx, dy should change sign if the piece is black.
 * @param {boolean[]} invConditions: [invX, invY, invAsPair] - if inverting dx or dy is also a valid move type; if dx, dy should not be inverted independently
 * @param {number} maxReps: the maximum number of times the move type can be repeated in a single move. (e.g. all queen MoveTypes have maxReps = 7)
 * @param {boolean} forceCapture: whether the move must be a capture.
 * @param {function} reqs: a function that takes in a Move object with a Board param; should return true if the move is valid
 * @param {function} post: a function that takes in a Move object with a Board param; should return the state of the Board after the move is executed
 */
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

/** SCAN stands for Smart Chess Algebraic Notation
 * It's an integer representation of a chess move developed for fast parsing and compact storage.
 * When a square is represented via "render coords", a8 is 0, b8 is 1, ..., h1 is 63.
 * When a square is represented via "SCAN coords", the coordinate is (8 * x) + y where the x=0 for the a-file and y=0 for the 1st rank.
 */
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

/** A class representing a move in a chess game.
 * @param {number} origin: the square the piece is moving from.
 * @param {number} destination: the square the piece is moving to.
 * @param {Board} board: the board the move is being executed on, BEFORE the move is executed.
 * @param {boolean} allowKingEndanger: whether the move is allowed to endanger the king, mainly used for checking move validity.
 */
class Move {
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
        let test = findProspects(this.origin, this.board, false).filter(prospect => prospect.destination == this.destination);
        const out = [!test.at(0).board.kingSafeOn(-1, oppositeColor(this.originColor())), test.at(0).board.getAllProspects().length == 0];
        return out;
    }

    /** Calculates the SCAN representation of the Move.
     * @param {str[]} informationRequests: an array of SCAN enums to request. If null, returns the current scan.
     * @returns {number}
     */
    getScan(informationRequests=null) {
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
            this.scanKnownInformation.push(ChessScan.modifiers);
        }
        if (discovers.includes(ChessScan.disambiguation) || discovers.includes(ChessScan.all)) {
            const otherValidMoves = this.board.getAllProspects().filter(m => m.origin != this.origin && m.destination == this.destination && this.board[m.origin] == this.originPiece());
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

function swap(arr, i, j) {
    [arr[i], arr[j]] = [arr[j], arr[i]];
}

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
}
const pieceMoves = {
    'P': new MoveSet([
        new MoveType(0, -1, true, [0, 0, 0], 1, 2, [], [movePiece]), // NORMAL MOVE
        new MoveType(0, -2, true, [0, 0, 0], 1, 2, [ // DOUBLE MOVE
            (move) => move.at(move.originX(), move.originY() + Math.sign(move.delta()[1])) == '', // square in front is empty
            (move) => move.originColor() == 'W' ? (move.originY() == 6) :( move.originY() == 1) // on starting rank
        ],
            [(move) => {move.board[move.origin + 8*(move.originColor() == 'W' ? -1 : 1)] = // set en passant square
                move.originColor() == 'W' ? 'X' : 'x';}, movePiece]), 
        new MoveType(1, -1, true, [1, 0, 0], 1, true, [], [ // CAPTURE
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

/** Extension of Map that has a maximum size and keeps track of hits and removals.
 * @param {number} max: the maximum size of the map
 */
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

/** Class to hold the outcome Board of a Move.
 * @param {number} origin: the origin square of the Move
 * @param {number} destination: the destination square of the Move
 * @param {Board} board: the outcome Board of the Move
 */
class Prospect {
    constructor(origin, destination, board=null) {
        this.origin = origin;
        this.destination = destination;
        this.board = board;
    }
    setBoard(board) {
        this.board = board;
    }
}

/** Finds all possible moves for a piece on a given square.
 * 
 * @param {number} startingSquare: the square the piece is on
 * @param {Board} board: the Board the piece is on
 * @param {boolean} kingCapturable: whether findProspects should be used to check move validity
 * @returns {Prospect[]; boolean} an array of Prospects if !kingCapturable, otherwise true if kingCapturable && the current king is safe, false otherwise
 */
function findProspects(startingSquare, board, kingCapturable=false) {
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
                    let newBoard = new Board(JSON.parse(JSON.stringify(board)), {}, board.halfMoves);
                    Object.assign(newBoard.castling, board.castling);
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
                        if (playable && kingCapturable && move.board[move.destination].toUpperCase() == 'K') {
                            cache.set(boardString, false);
                            return false;
                        }
                        if (playable) {
                            playable = ['','x'].includes(move.destinationPiece().toLowerCase()); // breaks loop if destination square is occupied
                            validMoves.push(new Prospect(startingSquare, move.destination));
                            for (let k = 0; k < moveType.post.length; k++) { // apply each post-move function
                                moveType.post[k](move);
                            }
                            validMoves.at(-1).setBoard(move.board);
                            if (!kingCapturable) {
                                let legal = true;
                                let testBoard = validMoves.at(-1).board;
                                for (let i = 0; i < 64 && legal; i++) {
                                    if (testBoard[i] != '') {
                                        legal = findProspects(i, testBoard, true);
                                    }
                                }
                                if (!legal) {
                                    validMoves.pop();
                                }
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
    return validMoves;
}