/**
 * Màn hình chơi game
 */
var Scene1JS = (function() {

    /**
     * Thay đổi hình ảnh của các phần tử trái cây
     * @param {*} fruits 
     * @param {*} breaks 
     * @param {*} material_input 
     */
    function changeCircleSprite(fruits) {
        // Thay đổi texture cho các phần tử trái cây trong vòng tròn
        for (var i = 0; i < fruits.itemArr.length; i++) {
            var material_input = getMaterialInput();
            var target = fruits.updateObject({ id: "item" + i, texture: TEXTURES[material_input.url], name: material_input.id });
            backFn(target);
        }
    }

    /**
     * Tự động sinh ra mảng các vòng tròn
     * @param {*} frutHolder 
     * @param {*} itemArr 
     * @param {*} breakArr 
     */
    function generateCircleMaterial(frutHolder, itemArr, breakArr) {
        GAME.max_appear_circle = CONFIG.appear_circle + (CONFIG.total_seconds / CONFIG.circle_scale_seconds * CONFIG.appear_circle); // Tính số lượng vòng sẽ xuất hiện
        GAME.max_appear_items = GAME.max_appear_circle * CONFIG.total_item_on_circle; // Tính số lượng item sẽ xuất hiện trong toàn game

        // Chuyển các nguyên liệu đầu vào thành 1 mảng
        var inputs = [];
        for (var i in MATERIAL_INPUT) {
            inputs.push(MATERIAL_INPUT[i]);
            breakArr[MATERIAL_INPUT[i].id] = frutHolder.addObject({ id: MATERIAL_INPUT[i].broken_id, texture: TEXTURES[MATERIAL_INPUT[i].broken_url], visible: false });
        }

        // Ngẫu nhiên chọn 1 loại nguyên liệu để giới hạn số lượng
        var chooseRandomInput = Math.floor((Math.random() * inputs.length) + 0);
        inputs[chooseRandomInput].is_limit = true;
        // Số lượng nguyên liệu loại này theo độ khó của game    
        var difficultOffset = CONFIG.max_difficult_level - CONFIG.difficult_level;
        difficultOffset = difficultOffset < 0 ? 0 : difficultOffset;
        inputs[chooseRandomInput].limit_quantity = inputs[chooseRandomInput].quantity + Math.floor(difficultOffset * inputs[chooseRandomInput].quantity * (CONFIG.multiplier_with_difficult || 1));

        var limit_input = inputs.splice(chooseRandomInput, 1)[0];

        // Sinh ra 1 mảng tất cả các loại nguyên liệu sẽ xuất hiện trong game
        GAME.all_items_will_appear = {
            currentIndex: 0,
            array: []
        };

        for (var i = 1; i <= GAME.max_appear_items; i++) {
            var randomInputIndex = Math.floor((Math.random() * inputs.length) + 0);
            var inputItem = inputs[randomInputIndex];
            GAME.all_items_will_appear.array.push(inputItem.id);
            // if (inputItem.is_limit) {
            //     inputItem.limit_quantity--;
            //     if (inputItem.limit_quantity <= 0) {
            //         inputs.splice(randomInputIndex, 1);
            //     }
            // }
        }

        var beforeIndex = -1;
        // Chèn ngẫu nhiên các phần tử giới hạn vào mảng tất cả nguyên liệu
        for (var i = 1; i <= limit_input.limit_quantity; i++) {
            var randomIndex = -1;
            while (randomIndex == beforeIndex) {
                randomIndex = Math.floor((Math.random() * (GAME.all_items_will_appear.array.length - CONFIG.total_item_on_circle - 1)) + (CONFIG.total_item_on_circle - 1));
            }
            GAME.all_items_will_appear.array[randomIndex] = limit_input.id;
        }

        var ratio = CONFIG.sh / 568;
        if (CONFIG.sh < CONFIG.sw) ratio = CONFIG.sw / 568;

        var r = 90 + (ratio - 1) * 50;
        var sc = .3;

        for (var i = 1; i <= CONFIG.appear_circle; i++) {
            var item = creatFrut(frutHolder.core, "circle_" + i, r, sc);
            itemArr.push(item);
        }
    }

    /**
     * Sinh ra các phần tử trái cây trên vòng tròn
     * @param {*} target 
     * @param {*} id 
     * @param {*} name 
     * @param {*} url 
     * @param {*} total 
     * @param {*} r 
     * @param {*} sc 
     * @param {*} frutID 
     */
    function creatFrut(target, id, r, sc, frutID) {
        var total = CONFIG.total_item_on_circle;

        var item = target.addContainer({ id: id });
        item.frutID = frutID;
        item.r = r;
        with(item) {

            var rota = 2 * Math.PI / total;
            var itemArr = [];

            for (var i = 0; i < total; i++) {
                // Lấy các dữ liệu của phần tử từ trong mảng nguyên liệu đã có sẵn
                var material_input = getMaterialInput();

                var name = material_input.id,
                    url = material_input.url;

                var randomR = 0;

                var dx = Math.cos(i * rota) * (r + randomR);
                var dy = Math.sin(i * rota) * (r + randomR);

                var angle = Math.atan2(dy, dx) * 180 / Math.PI - 90;
                var radians = convertToRadian(angle);

                var circleFrut = addObject({ id: "item" + i, regPerX: .5, regPerY: .5, url: url, rotation: radians, locationX: dx, locationY: dy, scaleX: sc, scaleY: sc, name: name });
                itemArr.push(circleFrut);

                // Thiết đặt số lượng ban đầu của loại nguyên liệu này là 0
                GAME.material_collected[MATERIAL_INPUT[name].id] = 0;

                itemAutoScale(circleFrut, total, i);
            }

            item.itemArr = itemArr;
        }

        return item;
    }

    /**
     * Lấy nguyên liệu từ mảng nguyên liệu đã sinh ra
     */
    function getMaterialInput() {
        var material_input = MATERIAL_INPUT[GAME.all_items_will_appear.array[GAME.all_items_will_appear.currentIndex]];
        GAME.all_items_will_appear.currentIndex++;
        if (GAME.all_items_will_appear.currentIndex >= GAME.all_items_will_appear.array.length) {
            GAME.all_items_will_appear.currentIndex = 0;
        }
        return material_input;
    }

    /**
     * Tạo hiệu ứng phóng to/thu nhỏ cho nguyên liệu
     * @param {*} item 
     * @param {*} total 
     * @param {*} i 
     */
    function itemAutoScale(item, total, i) {
        // Cho mỗi nguyên liệu tự scale to nhỏ
        item.scale.x = item.scale.y = CONFIG.material_min_scale || 0.3;
        item.autoScale = TweenMax.from(item.scale, 1, {
            x: 1,
            y: 1,
            ease: Linear.easeNone,
            repeat: -1,
            yoyo: true,
        });

        var percent = (1 / (total / 4)) * i;
        item.autoScale.progress(percent);
    }

    /**
     * Đưa nguyên liệu về vị trí ban đầu
     * @param {*} target 
     */
    function backFn(target) {
        target.visible = true;
        target.holder.addChild(target);
        target.scale.x = target.scale.y = 0;
        target.rotation = target.initRota;
        TweenMax.to(target, 0, { x: target.initX, y: target.initY, ease: Sine.easeOut });
        target.autoScale.resume();
    }

    /**
     * Định nghĩa sự kiện kéo thả nguyên liệu sẽ làm gì
     * @param {*} target 
     */
    function startDrag(target) {

        target.interactive = true;
        target.buttonMode = true;

        target.mousedown = target.touchstart = function(data) {

            trace("touch start");

            data.originalEvent.preventDefault();

            var frutID = target.parent.frutID;

            ////////////////
            var checkHitHolder = GAME.Scene1.checkHitHolder;
            var sc = target.holder.scale.x;
            var rota = target.holder.rotation;

            var r = 150;

            checkHitHolder.addChild(target);

            target.rotation = target.rotation - convertToRadian(-radianToDegree(rota));
            target.position.x = -(CONFIG.sw / 2 - GAME.mousePosition.x);
            target.position.y = -(CONFIG.sh / 2 - GAME.mousePosition.y);
            target.scale.x = target.scale.y = sc;

            target.data = data;

            var mousePos = target.data.getLocalPosition(target.parent);
            target.anchorX = mousePos.x;
            target.anchorY = mousePos.y;

            target.startX = target.position.x;
            target.startY = target.position.y;

            target.dragging = true;

            target.mousemove = target.touchmove = function(data) {

                trace("touch move");

                if (target.dragging) {
                    if (!target.dragScale) {
                        target.autoScale.pause();
                        tweenFn(target, 0, 0, (target.scale.x < 1.5 ? 1.5 : target.scale.x));
                        target.dragScale = true;
                    }
                    var mousePos = target.data.getLocalPosition(target.parent);
                    var dx = target.startX + (mousePos.x - target.anchorX);
                    var dy = target.startY + (mousePos.y - target.anchorY);

                    target.position.x = dx;
                    target.position.y = dy;

                    checkHitBubble(target, false, frutID);
                }
            }

            target.mouseup = target.mouseupoutside = target.touchend = target.touchendoutside = function(data) {

                trace("touch end outside");

                var hit = checkHitBubble(target, true, frutID);
                if (!hit) backFn(target);
                else target.visible = false;

                target.dragging = false;
                target.data = null;
                target.mousemove = target.touchmove = null;
                target.mouseup = target.mouseupoutside = target.touchend = target.touchendoutside = null;

                target.dragScale = undefined;
            };

        }; //end mousedown 
    }

    /**
     * Kiểm tra nguyên liệu đã được kéo vào đúng vùng chế biến chưa
     * @param {*} target 
     * @param {*} flag 
     * @param {*} frutID 
     */
    function checkHitBubble(target, flag, frutID) {
        var bubbleArr = GAME.Scene1.bubbleHolder.bubbleArr;
        var len = bubbleArr.length;
        var curItem = null;
        var curDis = 100000;
        for (var i = 0; i < len; i++) {
            var item = bubbleArr[i];
            var dis = distanceTwoPoints(item.position.x, target.position.x, item.position.y, target.position.y);

            if (item.active) {
                if (dis < item.width / 2) {
                    if (curDis > dis) {
                        curDis = dis;
                        curItem = item;
                    }
                }
            }
        }

        if (curItem != null) {
            if (flag) {
                curItem.active = false;
                addFrutToBubble(target, curItem, frutID);
            }
            return true;
        }

        return false;
    }

    /**
     * Xử lý khi nguyên liệu đã được đưa vào đúng vùng chế biến
     * @param {*} frut 
     * @param {*} bubble 
     * @param {*} frutID 
     */
    function addFrutToBubble(frut, bubble, frutID) {
        trace("add frut to bubble");
        var spr = new PIXI.Sprite(frut.generateTexture());

        spr.scale.x = spr.scale.y = (bubble.width / spr.width) * .6;
        spr.position.x = -spr.width / 2;
        spr.position.y = -spr.height / 2;

        GAME.Scene1.small_bubble_group.visible = true;
        var smallBubble = new PIXI.Sprite(GAME.Scene1.small_bubble_group.generateTexture());
        smallBubble.visible = false;

        smallBubble.anchor.set(0.5, 0.5);

        GAME.Scene1.small_bubble_group.visible = false;

        // Timf
        var breakArr = GAME.Scene1.frutHolder.breakArr;
        var item = breakArr[MATERIAL_INPUT[frut.name].id];

        bubble.addChild(item);
        item.anchor = new PIXI.Point(0.5, 0.5);;


        item.initSC = spr.scale.x / 2;
        item.scale.x = item.scale.y = item.initSC;

        item.position.x = -item.width / 2;
        item.position.y = -item.height / 2;

        item.visible = false;

        bubble.addChild(spr);
        bubble.addChild(smallBubble);
        bubble.curFrut = spr;

        setTimeout(function() {
            item.visible = true;
            spr.visible = false;
            bubble.bitmap.visible = false;

            var delay = .1;
            var dur = .3;

            smallBubble.visible = true;
            smallBubble.scale.x = smallBubble.scale.y = .5;
            TweenMax.to(smallBubble.scale, dur, {
                delay: 0,
                x: 1,
                y: 1,
                ease: Sine.easeIn,
                onComplete: function() {
                    smallBubble.parent.removeChild(smallBubble);
                }
            })

            tweenFn(item, delay, dur, item.initSC * 1);

            TweenMax.to(bubble, dur, {
                delay: delay + .2,
                alpha: 0,
                ease: Sine.easeIn,
                onComplete: function() {
                    bubble.removeChild(item);
                    bubble.bitmap.visible = true;
                    bubble.alpha = 1;
                    randomFn(bubble, false);
                }
            })

            // backFn(frut);

        }, 300);

        checkFullMaterial(frut);
    }

    /**
     * Cập nhật số lượng nguyên liệu thu thập và kiểm tra đã đủ số lượng chế biến chưa
     * @param {*} fruit 
     */
    function checkFullMaterial(fruit) {
        GAME.material_collected[MATERIAL_INPUT[fruit.name].id]++;
        GAME.Scene1.collectHolder.collectObject[MATERIAL_INPUT[fruit.name].id].setText(GAME.material_collected[MATERIAL_INPUT[fruit.name].id]);

        var full_array = [];
        for (var i in MATERIAL_INPUT) {
            var material_input = MATERIAL_INPUT[i];
            if (GAME.material_collected[i] >= material_input.quantity) {
                full_array.push(true);
            } else {
                full_array.push(false);
            }
        }
        if (full_array.includes(false)) {
            // Chưa đủ
            trace("Chưa đủ nguyên liệu", GAME.material_collected);
        } else {
            GAME.finish_cup_number++;
            var per = (GAME.finish_cup_number / CONFIG.request_cup_number);

            setProgressBar(per);

            // Reset lại số lượng nguyên liệu thu thập
            for (var i in GAME.material_collected) {
                GAME.material_collected[i] = 0;
            }

            if (per >= 1) {
                stopGame();
            }
        }
    }

    function setProgressBar(per, dur) {
        // var progress_bar = GAME.Scene1.progressHoder.progress_bar;

        // if (per < 0) per = 0;
        // if (per > 1) per = 1;

        // if (dur == undefined) dur = .3;
        // TweenMax.to(progress_bar.scale, dur, { x: per, ease: Sine.easeOut });
    }

    /**
     * Dừng game
     */
    function stopGame() {
        trace("stop game");
        GAME.stop_countdown = true;
        GAME.is_stop = true;

        gotoScene(Scene2JS);
    }

    /**
     * Bắt đầu chạy game
     */
    function startGame() {
        var dur = .3;
        var itemArr = GAME.Scene1.frutHolder.itemArr;

        GAME.Scene1.interactive = false;
        GAME.Scene1.removeChild(GAME.Scene1.hit);

        for (var i = 0; i < itemArr.length; i++) {
            var item = itemArr[i];
            starDragItem(item);
        }

        with(GAME.Scene1) {
            // TweenMax.to(intro.scale, dur, {
            //     x: 0,
            //     y: 0,
            //     ease: Back.easeIn,
            //     onComplete: function() {
            //         intro.parent.removeChild(intro);
            //     }
            // });

            TweenMax.to(countDown, dur, {
                alpha: 1,
                ease: Sine.easeOut,
                onComplete: function() {
                    startCountDown();
                }
            });

            TweenMax.to(progressHoder, dur, { alpha: 1, ease: Sine.easeOut });
        }
    }

    /**
     * Tạo sự kiện kéo thả lên nguyên liệu
     * @param {*} holder 
     */
    function starDragItem(holder) {
        var itemArr = holder.itemArr;
        var len = itemArr.length;

        for (var i = 0; i < len; i++) {
            var item = itemArr[i];
            item.holder = holder;
            startDrag(item);
        }
    }

    /**
     * Bắt đầu đồng hồ đếm ngược
     */
    function startCountDown() {
        GAME.stop_countdown = false;
        GAME.start_time = Date.now();
        requestAnimFrame(countDown);
    }

    function countDown() {
        if (GAME.is_stop) return;
        if (GAME.stop_countdown) return;

        GAME.count_time = Date.now() - GAME.start_time;
        requestAnimFrame(countDown, 100);
        setTime(GAME.count_time);
    }

    function setTime(count) {

        var ms = Math.floor((count % 1000) / 10);
        var ss = Math.floor(count / 1000) % 60;
        var mm = Math.floor(Math.floor(count / 1000) / 60) % 60;
        var hh = Math.floor((Math.floor(count / 1000) / 60) / 60) % 60;

        if (ms < 10) ms = "0" + ms;
        if (ss < 10) ss = "0" + ss;
        if (mm < 10) mm = "0" + mm;
        if (hh < 10) hh = "0" + hh;

        var curTime = CONFIG.total_seconds - ss;
        if (curTime <= 0) {
            curTime = 0;
            stopGame();
        }

        if (curTime < 10) curTime = "0" + curTime;
        GAME.Scene1.countDown.txt.setText(curTime);
        GAME.Scene1.countDown.s.x = GAME.Scene1.countDown.txt.position.x + GAME.Scene1.countDown.txt.width;
    }

    function sence1_enterFrame() {
        if (GAME.is_stop) return;
        var itemArr = GAME.Scene1.frutHolder.itemArr;
        var len = itemArr.length;
        var rota_sp = 0.005; // Tốc độ quay của vòng tròn nguyên liệu

        for (var i = 0; i < len; i++) {
            var item = itemArr[i];
            if (i % 2 == 0) item.rotation += item.rotate_speed || rota_sp;
            else item.rotation -= item.rotate_speed || rota_sp;
        }
        requestAnimFrame(sence1_enterFrame, 100);
    }

    function tweenFn(item, delay, dur, sc) {
        TweenMax.to(item.scale, dur, { delay: delay, x: sc, y: sc, ease: Sine.easeOut })
    }

    function randomFn(item, flag) {
        trace("random Bubble")

        item.active = true;
        // item.sp_x = (Math.random() - Math.random()) * 2;
        // item.sp_y = Math.random() * 3 + 1;

        // item.scale.x = item.scale.y = Math.random() * .5 + .5;
        // item.initSC = item.scale.x;

        // item.position.x = (Math.random() - Math.random()) * CONFIG.sw / 2;

        // if (flag) item.position.y = CONFIG.sh / 2 + Math.random() * CONFIG.sh;
        // else item.position.y = CONFIG.sh / 2 + item.height;
    }

    return {
        id: "s1",
        create: function() {
            trace("create 1")
            with(GAME.Container) {

                GAME.Scene1 = addContainer({ id: Scene1JS.id, locationX: CONFIG.sw / 2, locationY: CONFIG.sh / 2, alpha: 0 });

                with(GAME.Scene1) {
                    addRect("hit", CONFIG.sw, CONFIG.sh, "0xff0", 0, 0, 0);
                    addContainer({ id: "frutHolder" })
                    addContainer({ id: "bubbleHolder" })
                    addContainer({ id: "checkHitHolder" });
                    addContainer({ id: "countDown", alpha: 0 });
                    addContainer({ id: "progressHoder", locationX: -35, alpha: 0 });
                    // addContainer({ id: "intro" });
                    addContainer({ id: "collectHolder" });

                    addObject({ id: "small_bubble_group", texture: TEXTURES["images/bubble_group.png"], visible: false });

                    // with(intro) {
                    //     addObject({ id: "copy", texture: TEXTURES["images/intro_copy.png"], scaleX: .5, scaleY: .5, locationX: -155, locationY: -20 })
                    // }

                    with(countDown) {
                        addObject({ id: "bg", texture: TEXTURES["images/countDown.png"], scaleX: .5, scaleY: .5 });
                        addText({ id: "txt", text: CONFIG.total_seconds, font: "bold 20px Arial", color: "#008d41", locationX: 130, locationY: 15 });
                        addText({ id: "s", text: "s", font: "bold 15px Arial", color: "#008d41", locationX: 129, locationY: 19 });
                    }

                    with(progressHoder) {
                        // addObject({ id: "progress_bg", texture: TEXTURES["images/progress_bg.png"], scaleX: .5, scaleY: .5 });
                        // addObject({ id: "progress_bar", texture: TEXTURES["images/progress_bar.png"], scaleX: .5, scaleY: .5, locationX: 3, locationY: 3 });
                        // addObject({ id: "num", texture: TEXTURES["images/numOfFrut.png"], scaleX: .5, scaleY: .5, locationX: 7, locationY: 7 });
                        // addObject({ id: "bottle", texture: TEXTURES["images/bottle_double.png"], scaleX: .5, scaleY: .5, locationX: 80, locationY: -37 });
                    }


                    frutHolder.addContainer({ id: "core" });
                    with(frutHolder) {
                        var itemArr = [];
                        var breakArr = {};

                        generateCircleMaterial(frutHolder, itemArr, breakArr);

                        frutHolder.breakArr = breakArr;

                        var sc = 1 / itemArr.length;
                        for (var i = 0; i < itemArr.length; i++) {
                            var item = itemArr[i];
                            item.frutID = i;
                            item.rotation = convertToRadian(45);
                            item.scale.x = item.scale.y = 3;
                            // setRotateSpeed(item);
                        }
                        frutHolder.itemArr = itemArr;
                    }

                    with(bubbleHolder) {
                        var bubbleArr = [];

                        // Thêm ly tocotoco vào giữa màn hình chơi game
                        var bubbleItem = addObject({ id: "tocotocoCup", regPerX: .5, regPerY: .5, texture: TEXTURES["images/bubble.png"], scaleX: .5, scaleY: .5 });
                        bubbleArr.push(bubbleItem);
                        randomFn(bubbleItem, true);

                        bubbleHolder.bubbleArr = bubbleArr;
                    }

                    with(collectHolder) {
                        var collectObject = {};
                        var index = 0;
                        for (var i in GAME.material_collected) {
                            var rootX = (60 * (index - 1) - 30);
                            var rootY = 3;
                            collectObject[i] = addText({ id: "count", text: GAME.material_collected[i], font: "18px Arial", color: "#008d41", locationX: rootX + 25, locationY: rootY, anchorX: .5, anchorY: .5 });
                            addText({ id: "quantity", text: "/" + MATERIAL_INPUT[i].quantity, font: "18px Arial", color: "#008d41", locationX: rootX + 38, locationY: rootY, anchorX: .5, anchorY: .5 });
                            addObject({ id: "image", texture: TEXTURES[MATERIAL_INPUT[i].url], width: 25, height: 25, locationX: rootX, regPerX: .5, regPerY: .5 });
                            index++;
                        }

                        collectHolder.collectObject = collectObject;
                    }
                }
            }
        },
        resize: function(sw, sh) {
            if (GAME.Scene1) {
                with(GAME.Scene1) {
                    hit.width = sw;
                    hit.height = sh;
                    hit.position.x = -hit.width / 2;
                    hit.position.y = -hit.height / 2;

                    position.x = sw / 2;
                    position.y = sh / 2;

                    countDown.position.x = -80;
                    countDown.position.y = -sh / 2 + 5;

                    progressHoder.position.y = sh / 2 - 60;

                    collectHolder.position.x = 0;
                    collectHolder.position.y = sh / 2 - 50;
                }
            }
        },
        start: function() {
            // trace("isAllowWin = " + isAllowWin);
            // haveAPrize = isAllowWin;
            GAME.is_stop = false;

            TweenMax.to(GAME.Scene1, .5, { alpha: 1, ease: Sine.easeOut })
            setProgressBar(0, 0);

            var timeout;
            var itemArr = GAME.Scene1.frutHolder.itemArr;
            var breakArr = GAME.Scene1.frutHolder.breakArr;
            var sc = 1 / itemArr.length;
            for (var i = 0; i < itemArr.length; i++) {
                (function(item, i) {
                    item.frutID = i;
                    item.rotation = convertToRadian(45);

                    item.scale.x = item.scale.y = 0;
                    var tweenConfig = {
                        x: 5,
                        y: 5,
                        ease: Linear.easeNone,
                        repeat: -1,
                        // onStart: function() {
                        // },
                        onRepeat: function() {
                            changeCircleSprite(item);
                        }
                    };

                    item.tween = TweenMax.from(item.scale, CONFIG.circle_scale_seconds, tweenConfig);

                    var percent = (1 / itemArr.length) * i;
                    item.tween.progress(percent);
                })(itemArr[i], i);
            }

            requestAnimFrame(sence1_enterFrame);

            GAME.Scene1.interactive = true;

            startGame();
        }
    };
})();