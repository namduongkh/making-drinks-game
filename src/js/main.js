var count;
var sw = window.innerWidth;
var sh = window.innerHeight;
var sence0, sence1, sence2, sence3, bubbleBG;
var count_sc_eff = 0;

var initW = 320;
var initH = 568;

var count_sc_eff_bg = 0;
var myCode = "-1";

const MATERIAL_INPUT = {
    "apple": {
        id: "apple",
        name: "Anh đào",
        quantity: 2,
        url: "images/apple.png",
        broken_id: "apple_broken",
        broken_url: "images/apple_broken.png",
    },
    "peanapple": {
        id: "peanapple",
        name: "Ngân nhĩ",
        quantity: 2,
        url: "images/mangcau.png",
        broken_id: "peanapple_broken",
        broken_url: "images/mangcau_broken.png",
    },
    "lemon": {
        id: "lemon",
        name: "Chanh",
        quantity: 1,
        url: "images/lemon.png",
        broken_id: "lemon_broken",
        broken_url: "images/lemon_broken.png",
    },
};

const CONFIG = {
    difficult_level: 1,
    max_difficult_level: 5,
    appear_circle: 6,
    circle_scale_seconds: 10,
    total_seconds: 30,
    my_ratio: 1,
    total_item_on_circle: 12,
    multiplier_with_difficult: 1.5,
    request_cup_number: 1,
};

const GAME = {
    material_collected: {
        "lemon": 0,
        "apple": 0,
        "peanapple": 0
    },
    is_win: false,
    finish_cup_number: 0,
    is_stop: false,
    stop_countdown: false,
    mousePosition: {},

    Loader: null,
    AssetsLoader: null,
    CountAssetsLoaded: null,
    LoaderPercent: null,
    TotalAssets: null,
    Stage: null,
    Renderer: null,
    TotalAssets: null,
    Container: null,

    max_appear_items: 0,
    all_items_will_appear: {},
};

////////////////////////////////////
function init() {

    trace("init");

    GAME.AssetsLoader = [];

    GAME.Stage = new PIXI.Stage();
    GAME.Renderer = PIXI.autoDetectRenderer(sw, sh, { transparent: true });
    document.getElementById('canvasHolder').appendChild(GAME.Renderer.view);

    createBubbleBG(); // Add tini bubble
    GAME.Container = GAME.Stage.addContainer({ id: "container", alpha: 0 });

    createSence_0();
    createSence_1();
    createSence_2();
    createSence_3();


    $(window).resize(onResize);
    onResize();

    startLoadAssets();

    GAME.Stage.mousedown = GAME.Stage.touchstart = function(data) {
        var mousePos = data.getLocalPosition(this);
        GAME.mousePosition.x = mousePos.x;
        GAME.mousePosition.y = mousePos.y;

        // trace(GAME.mousePosition.x+" - " +GAME.mousePosition.y);
    }
}

function onResize() {
    sw = window.innerWidth;
    sh = window.innerHeight;

    CONFIG.my_ratio = sh / initH;

    if (CONFIG.my_ratio > 2) CONFIG.my_ratio = 2;

    $('#canvasHolder canvas').width = sw;
    $('#canvasHolder canvas').height = sh;

    createSence_0_resize(sw, sh);
    createSence_1_resize(sw, sh);
    createSence_2_resize(sw, sh);
    createSence_3_resize(sw, sh);

    GAME.Renderer.resize(sw, sh);
}


/////////////////////////////////////////////////////////////////////////////////////////
function animationIn() {
    trace("animationIn");

    onResize();

    var dur = .5;
    var delay = 1;

    TweenMax.to(GAME.Container, dur, { delay: delay, alpha: 1, ease: Sine.easeOut });
    TweenMax.to(bubbleBG, dur, { delay: delay, alpha: 1, ease: Sine.easeOut });

    sence0_start();
}

function stopGame() {
    trace("stop game");
    GAME.stop_countdown = true;
    GAME.is_stop = true;

    if (!haveAPrize) gotoSence(sence1, sence2);
    else {
        haveAPrize = false;
        gotoSence(sence1, sence2);
    }
}

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
    sence1.countDown.txt.setText(curTime);
    sence1.countDown.s.x = sence1.countDown.txt.position.x + sence1.countDown.txt.width;
}

function createBubbleBG() {

    bubbleBG = GAME.Stage.addContainer({ id: "bg", alpha: 0 });

    var itemArr = [];
    with(bubbleBG) {
        for (var i = 0; i < 20; i++) {
            var item = addObject({ id: "item" + i, url: "images/tini_bubble.png" })
            addChild(item);
            itemArr.push(item);
            randomBubbleBG(item, true);
        }

        bubbleBG.itemArr = itemArr;
    }

    requestAnimFrame(enterBubbleBG, 100);
}

function enterBubbleBG() {
    var itemArr = bubbleBG.itemArr;
    var len = itemArr.length;

    for (var i = 0; i < len; i++) {
        var item = itemArr[i];
        item.x += item.sp_x;
        item.y -= item.sp_y;

        item.scale.x = item.initSC + Math.sin(count_sc_eff_bg) * 0.08;
        item.scale.y = item.initSC + Math.cos(count_sc_eff_bg) * 0.08;

        if (item.position.x < -item.width ||
            item.position.x > (sw + item.width) ||
            item.position.y < -item.height) {

            if (item.curFrut) {
                item.removeChild(item.curFrut);
            }

            randomBubbleBG(item, false);
        }
    }

    count_sc_eff_bg += 0.1;
    requestAnimFrame(enterBubbleBG, 100);
}

function randomBubbleBG(item, flag) {
    item.position.x = (Math.random() - Math.random()) * sw;
    if (flag) item.position.y = Math.random() * sh;
    else item.position.y = sh;

    item.scale.x = item.scale.y = Math.random() * .5 + .1;
    item.initSC = item.scale.x;
    item.alpha = item.scale.x;
    item.rotation = (Math.random() - Math.random()) * 360;

    item.sp_x = (Math.random() - Math.random()) * 2;
    item.sp_y = Math.random() * 2 + 1;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Chuyển từ scene này sang scene khác
 * @param {*} curSence 
 * @param {*} target 
 */
function gotoSence(curSence, target) {
    TweenMax.to(GAME.Container, .3, {
        alpha: 0,
        ease: Sine.easeOut,
        onComplete: function() {
            GAME.Container.removeChild(curSence);
            TweenMax.to(GAME.Container, .3, { alpha: 1, ease: Sine.easeOut });

            switch (target.id) {
                case "s1":
                    sence1_start();
                    break;
                case "s2":
                    sence2_start();
                    break;
                case "s3":
                    sence3_start();
                    break;
            }
        }
    })
}

///////////////////////////////////////////////////
function createSence_3() {
    trace("createSence_3");

    with(GAME.Container) {

            sence3 = addContainer({ id: "s3", visible: false });

            with(sence3) {
                addObject({ id: "bg", url: "images/lastScence_bg.png", scaleX: .5, scaleY: .5 })

                addContainer({ id: "frutHolder" });
                addObject({ id: "lastScence", url: "images/lastScence.png", scaleX: .5, scaleY: .5 })

                with(frutHolder) {
                    addObject({ id: "big_bottle", url: "images/big_bottle.png", scaleX: .5, scaleY: .5, locationX: 32, locationY: 135 });
                    big_bottle.rotation = convertToRadian(20);

                    addObject({ id: "f1", url: "images/f1.png", scaleX: .5, scaleY: .5, locationX: 80, locationY: 274 });
                    addObject({ id: "f2", url: "images/f2.png", scaleX: .5, scaleY: .5, locationX: -83, locationY: 345 });
                    addObject({ id: "f3", url: "images/f3.png", scaleX: .5, scaleY: .5, locationX: -115, locationY: 225, x: -10, y: -35 });
                }

                addObject({ id: "logo", url: "images/logo.png", scaleX: .5, scaleY: .5 })
                addObject({ id: "goNowBtn", url: "images/goNowBtn.png", scaleX: .5, scaleY: .5 })
                addObject({ id: "connectWifiBtn", url: "images/connectWifiBtn.png", scaleX: .5, scaleY: .5 })

                addObject({ id: "myCodeHolder", url: "images/codeBG.png", scaleX: .6, scaleY: .6, visible: false })
                myCodeHolder.addText({ id: "code", text: "ABC", font: "bold 17px Arial", color: "#008d41", locationX: 65, locationY: 12 });
            }
        } //end with
}

function sence3_start() {
    var timeout;
    sence3.visible = true;
    sence3.interactive = true;

    with(sence3) {
        goNowBtn.interactive = true;
        goNowBtn.buttonMode = true;
        goNowBtn.mousedown = goNowBtn.touchstart = function(data) {
            trace("trai nghiem ngay");
            this.alpha = .5;
        }

        goNowBtn.mouseup = goNowBtn.mouseupoutside = goNowBtn.touchend = goNowBtn.touchendoutside = function(data) {
            this.alpha = 1;
            connectToWifi();
        }

        connectWifiBtn.interactive = true;
        connectWifiBtn.buttonMode = true;
        connectWifiBtn.mousedown = connectWifiBtn.touchstart = function(data) {
            trace("ket noi wifi");
            connectToWifi();
            this.alpha = .5;
        }

        connectWifiBtn.mouseup = connectWifiBtn.mouseupoutside = connectWifiBtn.touchend = connectWifiBtn.touchendoutside = function(data) {
            this.alpha = 1;
        }

        TweenMax.to(lastScence, 1.5, {
            delay: Math.random(),
            y: 5,
            yoyo: true,
            repeat: -1,
            ease: Sine.easeInOut,
            onUpdate: function() {
                bg.y = lastScence.y;
            }
        });

        with(frutHolder) {
            var rota = convertToRadian((Math.random() - Math.random()) * 20);
            TweenMax.to(big_bottle, 1.5, { delay: Math.random(), y: big_bottle.initY - 15, yoyo: true, repeat: -1, ease: Sine.easeInOut });
            TweenMax.to(f1, 1.5, { delay: Math.random(), y: f1.initY + 15, yoyo: true, repeat: -1, ease: Sine.easeInOut });
            TweenMax.to(f2, 1.5, { delay: Math.random(), y: f2.initY + 15, yoyo: true, repeat: -1, ease: Sine.easeInOut });
            TweenMax.to(f3, 1.5, { delay: Math.random(), rotation: rota, y: f3.initY + 8, yoyo: true, repeat: -1, ease: Sine.easeInOut });
        }


        if (haveAPrize) {
            if (GAME.is_win) {
                myCodeHolder.visible = true;
                myCodeHolder.code.setText(myCode);
            }
        }
    }
}

function createSence_3_resize(sw, sh) {
    with(sence3) {

        logo.scale.x = logo.scale.y = CONFIG.my_ratio;
        logo.position.x = (sw - logo.width) / 2;
        logo.position.y = 10;

        bg.scale.y = CONFIG.my_ratio;
        bg.width = sw;

        lastScence.scale.y = lastScence.scale.x = CONFIG.my_ratio;
        lastScence.position.x = (sw - lastScence.width) / 2;

        frutHolder.scale.y = frutHolder.scale.x = CONFIG.my_ratio;
        frutHolder.position.x = sw / 2;

        goNowBtn.scale.y = goNowBtn.scale.x = CONFIG.my_ratio;
        goNowBtn.position.x = (sw - goNowBtn.width) / 2;
        goNowBtn.position.y = sh - 95 * CONFIG.my_ratio;

        connectWifiBtn.scale.y = connectWifiBtn.scale.x = CONFIG.my_ratio;
        connectWifiBtn.position.x = (sw - connectWifiBtn.width) / 2;
        connectWifiBtn.position.y = sh - 47 * CONFIG.my_ratio;

        myCodeHolder.scale.y = myCodeHolder.scale.x = CONFIG.my_ratio;
        myCodeHolder.position.x = (sw - 160 * CONFIG.my_ratio) / 2;
        myCodeHolder.position.y = sh - 160 * CONFIG.my_ratio;
    }
}



///////////////////////////////////////////////////
function createSence_2() {
    trace("createSence_2")

    with(GAME.Container) {

            sence2 = addContainer({ id: "s2", visible: false });
            sence2.interactive = true;
            sence2.buttonMode = true;

            with(sence2) {
                addRect("hit", sw, sh, "0xff0", 0, 0, 0);
                addObject({ id: "logo", url: "images/logo.png", scaleX: .5, scaleY: .5 })
                addObject({ id: "copy1", url: "images/congratulation.png", scaleX: .5, scaleY: .5, visible: false });
                addObject({ id: "copy2", url: "images/win.png", scaleX: .5, scaleY: .5, visible: false })
            }
        } //end with
}

function sence2_start() {
    var timeout;
    sence2.visible = true;

    if (!haveAPrize) {
        var txt = sence2.copy1.addText({ id: "txt", text: "0", font: "bold 30px Arial", color: "#008d41", locationX: 75, locationY: 93 });
        var numOfBottle = GAME.finish_cup_number;

        if (numOfBottle < 10 && numOfBottle != 0) numOfBottle = "0" + numOfBottle;
        txt.setText(numOfBottle);
        if (numOfBottle > 0) txt.position.x = txt.initX - txt.width / 2;

        sence2.copy1.visible = true;
        sence2.copy2.visible = false;

        timeout = setTimeout(function() {
            gotoSence(sence2, sence3);
        }, 3000);

    } else {

        sence2.copy1.visible = false;
        sence2.copy2.visible = true;

        timeout = setTimeout(function() {
            gotoSence(sence2, sence3);
        }, 8000);
    }

    /*  sence2.mousedown = sence2.touchstart = function(data){
          clearTimeout(timeout);
          gotoSence(sence2,sence3);
      }*/
}

function setCode(code) {
    myCode = code;
    GAME.is_win = true;

    if (myCode == "") {
        haveAPrize = false;
    }

    //
    var txt = sence2.copy2.addText({ id: "code", text: code, font: "bold 25px Arial", color: "#008d41", locationX: 90, locationY: 310 });
    txt.position.x = 90 + (130 - txt.width) / 2;

    gotoSence(sence1, sence2);
}


function createSence_2_resize(sw, sh) {
    with(sence2) {

        hit.width = sw;
        hit.height = sh;

        logo.scale.x = logo.scale.y = CONFIG.my_ratio;
        logo.position.x = (sw - logo.width) / 2;
        logo.position.y = 10;

        copy1.scale.x = copy1.scale.y = CONFIG.my_ratio;
        copy1.position.x = (sw - copy1.width) / 2;
        copy1.position.y = (sh - copy1.height + logo.height) / 2;

        copy2.scale.x = copy2.scale.y = CONFIG.my_ratio;
        copy2.position.x = (sw - copy2.width) / 2;
        copy2.position.y = (sh - copy2.height + logo.height) / 2;
    }
}

///////////////////////////////////////////////////
function createSence_1() {
    trace("createSence_1")
    with(GAME.Container) {

            sence1 = addContainer({ id: "s1", locationX: sw / 2, locationY: sh / 2, alpha: 0 });

            with(sence1) {
                    addRect("hit", sw, sh, "0xff0", 0, 0, 0);
                    addContainer({ id: "frutHolder" })
                    addContainer({ id: "bubbleHolder" })
                    addContainer({ id: "checkHitHolder" });
                    addContainer({ id: "countDown", alpha: 0 });
                    addContainer({ id: "progressHoder", locationX: -35, alpha: 0 });
                    // addContainer({ id: "intro" });
                    addContainer({ id: "collectHolder" });

                    addObject({ id: "small_bubble_group", url: "images/bubble_group.png", visible: false });

                    // with(intro) {
                    //     addObject({ id: "copy", url: "images/intro_copy.png", scaleX: .5, scaleY: .5, locationX: -155, locationY: -20 })
                    // }

                    with(countDown) {
                        addObject({ id: "bg", url: "images/countDown.png", scaleX: .5, scaleY: .5 });
                        addText({ id: "txt", text: CONFIG.total_seconds, font: "bold 20px Arial", color: "#008d41", locationX: 130, locationY: 15 });
                        addText({ id: "s", text: "s", font: "bold 15px Arial", color: "#008d41", locationX: 129, locationY: 19 });
                    }

                    with(progressHoder) {
                        addObject({ id: "progress_bg", url: "images/progress_bg.png", scaleX: .5, scaleY: .5 });
                        addObject({ id: "progress_bar", url: "images/progress_bar.png", scaleX: .5, scaleY: .5, locationX: 3, locationY: 3 });
                        addObject({ id: "num", url: "images/numOfFrut.png", scaleX: .5, scaleY: .5, locationX: 7, locationY: 7 });
                        addObject({ id: "bottle", url: "images/bottle_double.png", scaleX: .5, scaleY: .5, locationX: 80, locationY: -37 });
                    }


                    frutHolder.addContainer({ id: "core" });
                    with(frutHolder) {
                            // console.log("frutHolder", frutHolder);
                            var itemArr = [];
                            var breakArr = {};
                            // var ratio = sh / 568;
                            // if (sh < sw) ratio = sw / 568;

                            // var r = 90 + (ratio - 1) * 50;
                            // var sc = .3;

                            generateCircleMaterial(frutHolder, itemArr, breakArr);
                            // itemArr.push(creatFrut(core, MATERIAL_INPUT["chanh"].id, MATERIAL_INPUT["chanh"].id, MATERIAL_INPUT["chanh"].url, 12, r, sc));
                            // itemArr.push(creatFrut(core, MATERIAL_INPUT["apple"].id, MATERIAL_INPUT["apple"].id, MATERIAL_INPUT["apple"].url, 12, r, sc));
                            // itemArr.push(creatFrut(core, MATERIAL_INPUT["ngan_nhi"].id, MATERIAL_INPUT["ngan_nhi"].id, MATERIAL_INPUT["ngan_nhi"].url, 12, r, sc));

                            // breakArr.push(addObject({ id: MATERIAL_INPUT["chanh"].broken_id, url: MATERIAL_INPUT["chanh"].broken_url, visible: false }));
                            // breakArr.push(addObject({ id: MATERIAL_INPUT["apple"].broken_id, url: MATERIAL_INPUT["apple"].broken_url, visible: false }));
                            // breakArr.push(addObject({ id: MATERIAL_INPUT["ngan_nhi"].broken_id, url: MATERIAL_INPUT["ngan_nhi"].broken_url, visible: false }));

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

                        } //end with


                    with(bubbleHolder) {
                            var bubbleArr = [];
                            // for (var i = 0; i < 5; i++) {
                            //     var bubbleItem = addObject({ id: "bubble" + i, regPerX: .5, regPerY: .5, url: "images/bubble.png", scaleX: .5, scaleY: .5 });
                            //     bubbleArr.push(bubbleItem);
                            //     randomFn(bubbleItem, true);
                            // }

                            // Thêm ly tocotoco vào giữa màn hình chơi game
                            var bubbleItem = addObject({ id: "tocotocoCup", regPerX: .5, regPerY: .5, url: "images/bubble.png", scaleX: .5, scaleY: .5 });
                            bubbleArr.push(bubbleItem);
                            randomFn(bubbleItem, true);

                            bubbleHolder.bubbleArr = bubbleArr;

                        } //end with

                    with(collectHolder) {
                            var collectObject = {};
                            var index = 0;
                            for (var i in GAME.material_collected) {
                                var rootX = (60 * index);
                                var rootY = 6;
                                collectObject[i] = addText({ id: "count", text: GAME.material_collected[i], font: "bold 18px Arial", color: "#008d41", locationX: rootX + 27, locationY: rootY });
                                addText({ id: "quantity", text: "/" + MATERIAL_INPUT[i].quantity, font: "bold 18px Arial", color: "#008d41", locationX: rootX + 40, locationY: rootY });
                                addObject({ id: "image", url: MATERIAL_INPUT[i].url, scaleX: .2, scaleY: .2, locationX: rootX });
                                index++;
                            }

                            collectHolder.collectObject = collectObject;
                        } //end with
                } //end with
        } //end with
}

function createSence_1_resize(sw, sh) {
    with(sence1) {
        hit.width = sw;
        hit.height = sh;
        hit.position.x = -hit.width / 2;
        hit.position.y = -hit.height / 2;

        position.x = sw / 2;
        position.y = sh / 2;

        countDown.position.x = -80;
        countDown.position.y = -sh / 2 + 5;

        progressHoder.position.y = sh / 2 - 60;

        collectHolder.position.x = -sw / 2 + 20;
        collectHolder.position.y = sh / 2 - 50;
    }
}


function sence1_start() {
    //////////
    trace("isAllowWin = " + isAllowWin);
    haveAPrize = isAllowWin;

    //
    TweenMax.to(sence1, .5, { alpha: 1, ease: Sine.easeOut })
    setProgressBar(0, 0);

    //
    var timeout;
    var itemArr = sence1.frutHolder.itemArr;
    var breakArr = sence1.frutHolder.breakArr;
    var sc = 1 / itemArr.length;
    for (var i = 0; i < itemArr.length; i++) {
        (function(item, i) {
            // var item = itemArr[i];
            item.frutID = i;
            item.rotation = convertToRadian(45);
            // item.scale.x = item.scale.y = 3;

            item.scale.x = item.scale.y = 0;
            var tweenConfig = {
                x: 5,
                y: 5,
                ease: Linear.easeNone,
                repeat: -1,
                onStart: function() {
                    // console.log("start")
                },
                onRepeat: function() {
                    // console.log("count");
                    changeCircleSprite(item);
                }
            };

            item.tween = TweenMax.from(item.scale, CONFIG.circle_scale_seconds, tweenConfig);

            var percent = (1 / itemArr.length) * i;
            item.tween.progress(percent);
        })(itemArr[i], i);
    }

    requestAnimFrame(sence1_enterFrame);

    //
    sence1.interactive = true;
    // sence1.mousedown = sence1.touchstart = function(data) {
    //     clearTimeout(timeout);
    //     startGame();
    // }

    // timeout = setTimeout(function() {
    //     startGame();
    // }, 1000)
    startGame();
}

function startGame() {
    var dur = .3;
    var itemArr = sence1.frutHolder.itemArr;

    sence1.interactive = false;
    sence1.removeChild(sence1.hit);

    for (var i = 0; i < itemArr.length; i++) {
        var item = itemArr[i];
        starDragItem(item);
    }

    with(sence1) {
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

        if (haveAPrize) TweenMax.to(progressHoder, dur, { alpha: 1, ease: Sine.easeOut });
    }
}

function sence1_enterFrame() {

    if (GAME.is_stop) return;
    //
    var itemArr = sence1.frutHolder.itemArr;
    var len = itemArr.length;
    var rota_sp = 0.005;
    // var sc_sp = 0.002;

    for (var i = 0; i < len; i++) {
        var item = itemArr[i];
        if (i % 2 == 0) item.rotation += item.rotate_speed || rota_sp;
        else item.rotation -= item.rotate_speed || rota_sp;
    }

    bubbleHolder_enterFrame();
    requestAnimFrame(sence1_enterFrame, 100);
}



////////////////////////////////////////////
function createSence_0() {
    trace("createSence_0")

    with(GAME.Container) {

            sence0 = addContainer({ id: "s0" });
            sence0.interactive = true;
            sence0.buttonMode = true;

            with(sence0) {
                addRect("hit", sw, sh, "0xff0", 0, 0, 0)
                addObject({ id: "logo", url: "images/logo.png", scaleX: .5, scaleY: .5 })
                    // addObject({ id: "copy1", url: "images/copy1.png", scaleX: .5, scaleY: .5 })
                addObject({ id: "copy1", url: "images/intro_copy.png", scaleX: .5, scaleY: .5 })
            }
        } //end with
}

function sence0_start() {
    var timeout;

    sence0.mousedown = sence0.touchstart = function(data) {
        clearTimeout(timeout);
        gotoSence(sence0, sence1);
    }

    timeout = setTimeout(function() {
        gotoSence(sence0, sence1);
    }, 3000)
}


function createSence_0_resize(sw, sh) {
    with(sence0) {

        hit.width = sw;
        hit.height = sh;

        if (sw < sh) {
            logo.scale.x = logo.scale.y = CONFIG.my_ratio;
            copy1.scale.x = copy1.scale.y = CONFIG.my_ratio;
        }

        logo.position.x = (sw - logo.width) / 2;
        logo.position.y = 10;

        copy1.position.x = (sw - copy1.width) / 2;
        copy1.position.y = (sh - copy1.height + logo.height) / 2;
    }
}



///////////////////////////////////////////////////////////
function randomFn(item, flag) {
    trace("random Bubble")

    item.active = true;
    // item.sp_x = (Math.random() - Math.random()) * 2;
    // item.sp_y = Math.random() * 3 + 1;

    // item.scale.x = item.scale.y = Math.random() * .5 + .5;
    // item.initSC = item.scale.x;

    // item.position.x = (Math.random() - Math.random()) * sw / 2;

    // if (flag) item.position.y = sh / 2 + Math.random() * sh;
    // else item.position.y = sh / 2 + item.height;
}

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
        var target = fruits.updateObject({ id: "item" + i, url: material_input.url, name: material_input.id });
        backFn(target);
    }
}

function resetFrutCircle(item) {
    var itemArr = item.itemArr;
    var len = itemArr.length;

    trace("resetFrutCircle")

    item.isDrag = false;

    for (var i = 0; i < len; i++) {
        var item = itemArr[i];
        item.visible = true;

        if (!item.dragging) backFn(item)
    }
}

function bubbleHolder_enterFrame() {
    // var bubbleArr = sence1.bubbleHolder.bubbleArr;
    // var len = bubbleArr.length;

    // for (var i = 0; i < len; i++) {
    //     var item = bubbleArr[i];
    //     item.position.x += item.sp_x;
    //     item.position.y -= item.sp_y;

    //     item.scale.x = item.initSC + Math.sin(count_sc_eff) * 0.04;
    //     item.scale.y = item.initSC + Math.cos(count_sc_eff) * 0.04;

    //     if (item.position.x < -(sw / 2 + item.width / 2) ||
    //         item.position.x > (sw / 2 + item.width / 2) ||
    //         item.position.y < -(sh / 2 + item.height)) {

    //         if (item.curFrut) {
    //             item.removeChild(item.curFrut);
    //         }

    //         randomFn(item, false);
    //     }
    // }

    // count_sc_eff += 0.1;
}

/**
 * Kiểm tra nguyên liệu đã được kéo vào đúng vùng chế biến chưa
 * @param {*} target 
 * @param {*} flag 
 * @param {*} frutID 
 */
function checkHitBubble(target, flag, frutID) {
    var bubbleArr = sence1.bubbleHolder.bubbleArr;
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

function tweenFn(item, delay, dur, sc) {
    TweenMax.to(item.scale, dur, { delay: delay, x: sc, y: sc, ease: Sine.easeOut })
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

    sence1.small_bubble_group.visible = true;
    var smallBubble = new PIXI.Sprite(sence1.small_bubble_group.generateTexture());
    smallBubble.visible = false;

    smallBubble.anchor.set(0.5, 0.5);

    sence1.small_bubble_group.visible = false;

    // Timf
    var breakArr = sence1.frutHolder.breakArr;
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

        // tweenFn(item, delay, dur, item.initSC * 1.5);
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

function setProgressBar(per, dur) {
    var progress_bar = sence1.progressHoder.progress_bar;

    if (per < 0) per = 0;
    if (per > 1) per = 1;

    if (dur == undefined) dur = .3;
    TweenMax.to(progress_bar.scale, dur, { x: per, ease: Sine.easeOut });
}

/**
 * Cập nhật số lượng nguyên liệu thu thập và kiểm tra đã đủ số lượng chế biến chưa
 * @param {*} fruit 
 */
function checkFullMaterial(fruit) {
    GAME.material_collected[MATERIAL_INPUT[fruit.name].id]++;
    sence1.collectHolder.collectObject[MATERIAL_INPUT[fruit.name].id].setText(GAME.material_collected[MATERIAL_INPUT[fruit.name].id]);

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

function starDragItem(holder) {
    var itemArr = holder.itemArr;
    var len = itemArr.length;

    for (var i = 0; i < len; i++) {
        var item = itemArr[i];
        item.holder = holder;
        startDrag(item);
    }
}


function startDrag(target) {

    target.interactive = true;
    target.buttonMode = true;

    target.mousedown = target.touchstart = function(data) {

        trace("touch start");

        data.originalEvent.preventDefault();

        var frutID = target.parent.frutID;

        ////////////////
        var checkHitHolder = sence1.checkHitHolder;
        var sc = target.holder.scale.x;
        var rota = target.holder.rotation;

        var r = 150;

        checkHitHolder.addChild(target);

        target.rotation = target.rotation - convertToRadian(-radianToDegree(rota));
        target.position.x = -(sw / 2 - GAME.mousePosition.x);
        target.position.y = -(sh / 2 - GAME.mousePosition.y);
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



function backFn(target) {
    // console.log('backFn', target.tween);
    target.visible = true;
    target.holder.addChild(target);
    target.scale.x = target.scale.y = 0;
    target.rotation = target.initRota;
    TweenMax.to(target, 0, { x: target.initX, y: target.initY, ease: Sine.easeOut });
    target.autoScale.resume();
    // tweenFn(target, 0, .3, 1);
}


function stopDrag(target) {
    target.interactive = false;
    target.buttonMode = false;
    target.mousedown = target.touchstart = null;
    target.mousemove = target.touchmove = null;
    target.mouseup = target.mouseupoutside = target.touchend = target.touchendoutside = null;
}



/////////////////////////////////////////////////////////////////////////////////////////////////////
function addToQueue(url) {
    trace(url);
    GAME.AssetsLoader.push(url);
}

function startLoadAssets() {
    count = 0;
    GAME.CountAssetsLoaded = 0;
    GAME.LoaderPercent = 0;
    GAME.TotalAssets = GAME.AssetsLoader.length;

    GAME.Loader = new PIXI.AssetLoader(GAME.AssetsLoader);
    GAME.Loader.onProgress = onProgress;
    GAME.Loader.load();
    checkLoadingAssets();
}

function checkLoadingAssets() {
    var per = GAME.CountAssetsLoaded / GAME.TotalAssets;
    GAME.LoaderPercent += (per - GAME.LoaderPercent) / 5;
    // trace("GAME.LoaderPercent =" + GAME.LoaderPercent)

    var h = $('#preloader .pr-bottle').height();
    $('#preloader .pr-bottle-grey').css('height', h - GAME.LoaderPercent * h);
    $('#preloader .pr-txt').css({ 'top': 40 - GAME.LoaderPercent * (h - 30), 'font-size': (36 - GAME.LoaderPercent * 20) });
    $('#preloader .pr-txt').text(Math.ceil(GAME.LoaderPercent * 100) + "%");

    setTimeout(function() {
        if (GAME.LoaderPercent >= .99) loadComplete();
        else checkLoadingAssets();
    }, 100);
}

function onProgress() {
    GAME.CountAssetsLoaded++;
}

function loadComplete() {
    trace("onAssetsLoadComplete");
    hidePreloader(0, 1, true);
    animationIn();
    requestAnimFrame(enterFrameFn);
}

function enterFrameFn() {
    requestAnimFrame(enterFrameFn, 1000);
    GAME.Renderer.render(GAME.Stage);
}

function fontLoaded(font, callback) {
    var check = new PIXI.Text("giItT1WQy@!-/#", { font: "50px " + font });
    var width = check.width;
    var interval = setInterval(function() {
        check.setStyle({ font: "50px " + font });
        check.updateText();

        if (check.width != width) {
            clearInterval(interval);
            check.destroy(true);
            callback();
        }
    }, 50);
}

/**
 * Tạo tốc độ quay quanh trục của vòng nguyên liệu
 * @param {*} item 
 */
function setRotateSpeed(item) {
    var speed = Math.random() / 50;
    // console.log('speed', speed);
    item.rotate_speed = speed;
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
        breakArr[MATERIAL_INPUT[i].id] = frutHolder.addObject({ id: MATERIAL_INPUT[i].broken_id, url: MATERIAL_INPUT[i].broken_url, visible: false });
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

    // Chèn ngẫu nhiên các phần tử giới hạn vào mảng tất cả nguyên liệu
    for (var i = 1; i <= limit_input.limit_quantity; i++) {
        var randomIndex = Math.floor((Math.random() * GAME.all_items_will_appear.array.length) + 0);
        GAME.all_items_will_appear.array[randomIndex] = limit_input.id;
    }

    var ratio = sh / 568;
    if (sh < sw) ratio = sw / 568;

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

function getMaterialInput() {
    var material_input = MATERIAL_INPUT[GAME.all_items_will_appear.array[GAME.all_items_will_appear.currentIndex]];
    GAME.all_items_will_appear.currentIndex++;
    if (GAME.all_items_will_appear.currentIndex >= GAME.all_items_will_appear.array.length) {
        GAME.all_items_will_appear.currentIndex = 0;
    }
    return material_input;
}

function itemAutoScale(item, total, i) {
    // Cho mỗi nguyên liệu tự scale to nhỏ
    item.scale.x = item.scale.y = 0.3;
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