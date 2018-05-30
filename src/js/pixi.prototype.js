function convertToRadian(n) {
    return n * Math.PI / 180;
}

function radianToDegree(n) {
    return n * 180 / Math.PI;
}

/**
 * Tính khoảng cách giữa 2 điểm
 * @param {*} x1 
 * @param {*} x2 
 * @param {*} y1 
 * @param {*} y2 
 */
function distanceTwoPoints(x1, x2, y1, y2) {
    var dx = x1 - x2;
    var dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
}

/////////////////////////////
PIXI.Sprite.prototype.setLocation =
    PIXI.MovieClip.prototype.setLocation =
    PIXI.DisplayObjectContainer.prototype.setLocation = function(x, y) {
        this.position.x = x;
        this.position.y = y;
    }

PIXI.Sprite.prototype.addSprite =
    PIXI.MovieClip.prototype.addSprite =
    PIXI.DisplayObjectContainer.prototype.addSprite = function(id, url, startDrag) {


        var texture = new PIXI.Texture.fromImage(url);
        var target = new PIXI.Sprite(texture);

        addToQueue(url);

        this.addChild(target);
        this[id] = target;

        if (startDrag == true) target.startDrag(true);

        target.id = id;
        return target;

    }

PIXI.Sprite.prototype.addTexture =
    PIXI.MovieClip.prototype.addTexture =
    PIXI.DisplayObjectContainer.prototype.addTexture = function(id, texture, startDrag) {


        // var texture = new PIXI.Texture.fromImage(url);
        var target = new PIXI.Sprite(texture);

        // addToQueue(url);

        this.addChild(target);
        this[id] = target;

        if (startDrag == true) target.startDrag(true);

        target.id = id;
        return target;

    }

PIXI.Sprite.prototype.updateSprite =
    PIXI.MovieClip.prototype.updateSprite =
    PIXI.DisplayObjectContainer.prototype.updateSprite = function(id, url) {

        var texture = new PIXI.Texture.fromImage(url);
        this.sprite.setTexture(texture);
        // var target = new PIXI.Sprite(appleTexture);
        // this.addChild(target);
        // console.log('sprite', this);
        this.id = id;
        return this;
    }

PIXI.Sprite.prototype.updateTexture =
    PIXI.MovieClip.prototype.updateTexture =
    PIXI.DisplayObjectContainer.prototype.updateTexture = function(id, texture) {
        // var texture = new PIXI.Texture.fromImage(url);
        this.sprite.setTexture(texture);
        // var target = new PIXI.Sprite(appleTexture);
        // this.addChild(target);
        // console.log('sprite', this);
        this.id = id;
        return this;
    }

PIXI.Sprite.prototype.addContainer =
    PIXI.MovieClip.prototype.addContainer =
    PIXI.DisplayObjectContainer.prototype.addContainer = function(obj) {

        this[obj.id] = new PIXI.DisplayObjectContainer();
        var target = this[obj.id];
        this.addChild(target);

        target.id = obj.id;

        target.setProperties(obj);

        return target;
    }

PIXI.MovieClip.prototype.addObject =
    PIXI.Sprite.prototype.addObject =
    PIXI.DisplayObjectContainer.prototype.addObject = function(obj) {
        this[obj.id] = new PIXI.DisplayObjectContainer();
        var target = this[obj.id];

        target.id = obj.id;
        this.addChild(target)

        if (typeof obj.url != 'undefined') {
            target.sprite = target.addSprite('bitmap', obj.url);
        }

        if (typeof obj.texture != 'undefined') {
            target.sprite = target.addTexture('bitmap', obj.texture);
        }

        target.setProperties(obj);

        return target;
    }

PIXI.MovieClip.prototype.updateObject =
    PIXI.Sprite.prototype.updateObject =
    PIXI.DisplayObjectContainer.prototype.updateObject = function(obj) {

        var target = this[obj.id];

        // target.id = obj.id;
        // this.addChild(target)
        if (typeof obj.url != 'undefined') {
            target.updateSprite(obj.id, obj.url);
        }

        if (typeof obj.texture != 'undefined') {
            target.updateTexture(obj.id, obj.texture);
        }

        target.setProperties(obj);

        return target;
    }

PIXI.MovieClip.prototype.setProperties =
    PIXI.Sprite.prototype.setProperties =
    PIXI.DisplayObjectContainer.prototype.setProperties = function(obj) {
        var target = this;


        if (obj.alpha != undefined) {
            target.alpha = obj.alpha;
        }

        if (obj.visible != undefined) {
            target.visible = obj.visible;
        }

        if (obj.x != undefined) {
            target.bitmap.position.x = obj.x;
        }

        if (obj.y != undefined) {
            target.bitmap.position.y = obj.y;
        }
        if (obj.scaleX != undefined) {
            target.bitmap.scale.x = obj.scaleX;
        }
        if (obj.scaleY != undefined) {
            target.bitmap.scale.y = obj.scaleY;
        }

        if (obj.locationX != undefined) {
            target.position.x = obj.locationX;
            target.initX = target.position.x;
        }

        if (obj.locationY != undefined) {
            target.position.y = obj.locationY;
            target.initY = target.position.y;
        }

        if (obj.startDrag == true) {
            target.startDrag(true);
        }

        if (obj.butotnMode != undefined) {
            target.buttonMode = obj.buttonMode;
        }

        if (obj.regPerX != undefined) {
            target.bitmap.anchor.x = obj.regPerX;
        }

        if (obj.regPerX != undefined) {
            target.bitmap.anchor.y = obj.regPerY;
        }

        if (obj.rotation != undefined) {
            target.rotation = obj.rotation;
            target.initRota = target.rotation
        }

        if (obj.name != undefined) {
            target.name = obj.name;
        }

        if (obj.width != undefined) {
            target.width = obj.width;
        }

        if (obj.height != undefined) {
            target.height = obj.height;
        }

        if (obj.anchorX != undefined) {
            target.anchor.x = obj.anchorX;
        }

        if (obj.anchorY != undefined) {
            target.anchor.y = obj.anchorY;
        }
    }

PIXI.Sprite.prototype.addCircle =
    PIXI.MovieClip.prototype.addCircle =
    PIXI.DisplayObjectContainer.prototype.addCircle = function(id, radius, color, dx, dy, alpha) {

        var target = new PIXI.Graphics();
        target.beginFill(color);
        target.drawCircle(0, 0, radius);
        target.endFill();

        this[id] = target;
        this.addChild(target);

        if (dx != undefined) {
            target.position.x = dx;
        }

        if (dy != undefined) {
            target.position.y = dy;
        }

        if (alpha != undefined) {
            target.alpha = alpha;
        }

        return target;
    }

PIXI.Sprite.prototype.addRect =
    PIXI.MovieClip.prototype.addRect =
    PIXI.DisplayObjectContainer.prototype.addRect = function(id, w, h, color, dx, dy, alpha) {

        var target = new PIXI.Graphics();
        target.beginFill(color);
        target.drawRect(0, 0, w, h);
        target.endFill();

        this[id] = target;
        this.addChild(target);

        if (dx != undefined) {
            target.position.x = dx;
        }

        if (dy != undefined) {
            target.position.y = dy;
        }

        if (alpha != undefined) {
            target.alpha = alpha;
        }

        return target;

    }

PIXI.Sprite.prototype.addText =
    PIXI.MovieClip.prototype.addText =
    PIXI.DisplayObjectContainer.prototype.addText = function(obj) {


        if (obj.strkeColor == undefined) {
            obj.strokeColor = 0;
        }
        if (obj.strokeThickness == undefined) {
            obj.strokeThickness = 0;
        }
        if (obj.align == undefined) {
            obj.align = 'left';
        }
        if (obj.color == undefined) {
            obj.color = '#000';
        }

        var target = new PIXI.Text(obj.text, { font: obj.font, fill: obj.color, align: obj.align, stroke: obj.strokeColor, strokeThickness: obj.strokeThickness });


        target.setProperties(obj);

        this[obj.id] = target;
        this.addChild(target)

        return target;

    }


PIXI.Sprite.prototype.setIndex =
    PIXI.MovieClip.prototype.setIndex =
    PIXI.DisplayObjectContainer.prototype.setIndex = function(index) {
        var parent = this.parent;
        parent.setChildIndex(this, parent.children.length - 1 - index);
    }

PIXI.Sprite.prototype.startDrag =
    PIXI.MovieClip.prototype.startDrag =
    PIXI.DisplayObjectContainer.prototype.startDrag = function(test) {
        var target = this;

        if (test) {
            target.addCircle("centerPoint", 2, "#ff0", -1, -1);
        }

        target.interactive = true;
        target.buttonMode = true;


        target.mousedown = target.touchstart = function(data) {

            trace("touch start");

            data.originalEvent.preventDefault();
            target.data = data;
            if (test) {
                target.alpha = 0.5;
            }

            var mousePos = this.data.getLocalPosition(this.parent);
            target.anchorX = mousePos.x;
            target.anchorY = mousePos.y;

            target.startX = target.position.x;
            target.startY = target.position.y;

            target.dragging = true;


            target.mousemove = target.touchmove = function(data) {

                trace("touch move");

                if (target.dragging) {

                    var mousePos = this.data.getLocalPosition(this.parent);
                    var dx = target.startX + (mousePos.x - target.anchorX);
                    var dy = target.startY + (mousePos.y - target.anchorY);

                    target.position.x = dx;
                    target.position.y = dy;
                }
            }

            target.mouseup = target.mouseupoutside = target.touchend = target.touchendoutside = function(data) {

                trace("touch end outside");

                if (test) {
                    target.alpha = 1;
                }
                target.dragging = false;
                target.data = null;
                target.mousemove = target.touchmove = null;
                target.mouseup = target.mouseupoutside = target.touchend = target.touchendoutside = null;
                trace(target.id + ': locationX:' + Math.round(target.position.x) + " ,locationY:" + Math.round(target.position.y))
            };


        }; //end mousedown	

    }


PIXI.Sprite.prototype.stopDrag =
    PIXI.MovieClip.prototype.stopDrag =
    PIXI.DisplayObjectContainer.prototype.stopDrag = function() {
        var target = this;

        target.interactive = false;
        target.buttonMode = false;
        target.mousedown = target.touchstart = null;
        target.mousemove = target.touchmove = null;
        target.mouseup = target.mouseupoutside = target.touchend = target.touchendoutside = null;
    }