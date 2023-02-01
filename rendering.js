const getVal = (dict, key, defaultValue) => {return key in dict ? dict[key] : defaultValue;}

/** Simple class for rendering sprites. */
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

/** Abstract class for renderable creating shapes.
 * @param drawFunction: function to draw the shape that takes a ctx as a parameter.
 * @param pre: function to run before drawing the shape that takes a ctx as a parameter.
 * Supports transparency, rotation, and scaling. */
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

/** Class for rendering lines. 
 * @param pre: function to run before drawing the shape that takes a ctx as a parameter.
*/
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
        this.width = Math.abs(this.x2 - this.x1);
        this.height = Math.abs(this.y2 - this.y1);
        super.draw(ctx, [-this.width/2, -this.height/2, this.width, this.height, this.lineWidth, this.lineCap, this.color, this.x1, this.x2, this.y1, this.y2], this.x1, this.y1, this.width, this.height);
    }
}

/** Small wrapper class for representing a stage of an animation. */
class DynamicStage {
    constructor(start, end, frame, totalFrames) {
        this.start = start;
        this.end = end;
        this.frame = frame;
        this.totalFrames = totalFrames;
    }

    /** Returns an array that can be passed to addToUpdateQueue()
     * @param attribute: name of attribute 
     * @returns [attribute, this]
     */
    attr(attribute) {
        return [attribute, this]
    }
}

/** Class for rendering shapes with animated attributes. 
 * @param drawFunction: function to draw the shape that takes a ctx as a parameter.
 * @param currentFrame: the frame stage all attribute animations will start at
 * @param totalFrames: the frame stage at which all attribute animations will complete
 * @param startColor: the starting color of the animation
 * @param startTransparency: the starting transparency of the animation
 * @param startRotation: the starting rotation of the animation
 * @param startScale: the starting scale of the animation
 * @param endColor: the ending color of the animation
 * @param endTransparency: the ending transparency of the animation
 * @param endRotation: the ending rotation of the animation
 * @param endScale: the ending scale of the animation
 * Supports transparency, rotation, and scaling.
*/
class DynamicShape extends Shape {
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

    /** Directly updates an attribute of the shape.
     * @param updates: a list of updates to be made to the shape. Each update is a list of the form [param, value]
     */
    update(updates) {
        for (let u in updates) {
            let param = updates[u][0];
            let value = updates[u][1];
            if (param in this.details) {
                this.details[param] = {...this.details[param], ...value};
            }
        }
    }

    /** Queues an update to be made to the shape.
     * @param updates: a list of updates to be made to the shape. Each update is a list of the form [param, {"start": }]
    */
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