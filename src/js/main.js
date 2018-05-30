////////////////////////////////////
function init() {

    trace("init");

    GAME.AssetsLoader = [];

    GAME.Stage = new PIXI.Stage();
    GAME.Renderer = PIXI.autoDetectRenderer(CONFIG.sw, CONFIG.sh, { transparent: true });
    document.getElementById('canvasHolder').appendChild(GAME.Renderer.view);

    loadTextures();

    createBubbleBG(); // Add tini bubble
    GAME.Container = GAME.Stage.addContainer({ id: "container", alpha: 0 });

    // Scene0JS.create();
    // Scene1JS.create();
    // Scene2JS.create();
    // Scene3JS.create();

    $(window).resize(onResize);
    // onResize();

    startLoadAssets();

    GAME.Stage.mousedown = GAME.Stage.touchstart = function(data) {
        var mousePos = data.getLocalPosition(this);
        GAME.mousePosition.x = mousePos.x;
        GAME.mousePosition.y = mousePos.y;
    }
}

function onResize() {
    CONFIG.sw = window.innerWidth;
    CONFIG.sh = window.innerHeight;

    CONFIG.my_ratio = CONFIG.sh / CONFIG.initH;

    if (CONFIG.my_ratio > 2) CONFIG.my_ratio = 2;

    $('#canvasHolder canvas').width = CONFIG.sw;
    $('#canvasHolder canvas').height = CONFIG.sh;

    Scene0JS.resize(CONFIG.sw, CONFIG.sh);
    Scene1JS.resize(CONFIG.sw, CONFIG.sh);
    Scene2JS.resize(CONFIG.sw, CONFIG.sh);
    Scene3JS.resize(CONFIG.sw, CONFIG.sh);

    GAME.Renderer.resize(CONFIG.sw, CONFIG.sh);
}


/////////////////////////////////////////////////////////////////////////////////////////
function animationIn() {
    trace("animationIn");

    onResize();

    var dur = .5;
    var delay = 1;

    TweenMax.to(GAME.Container, dur, { delay: delay, alpha: 1, ease: Sine.easeOut });
    TweenMax.to(GAME.BubbleBG, dur, { delay: delay, alpha: 1, ease: Sine.easeOut });

    gotoScene(Scene3JS);
    // Scene3JS.start();
    // Scene0JS.start();
}

function createBubbleBG() {

    GAME.BubbleBG = GAME.Stage.addContainer({ id: "bg", alpha: 0 });

    var itemArr = [];
    with(GAME.BubbleBG) {
        for (var i = 0; i < 20; i++) {
            var item = addObject({ id: "item" + i, texture: TEXTURES["images/tini_bubble.png"] })
            addChild(item);
            itemArr.push(item);
            randomBubbleBG(item, true);
        }

        GAME.BubbleBG.itemArr = itemArr;
    }

    requestAnimFrame(enterBubbleBG, 100);
}

function enterBubbleBG() {
    var itemArr = GAME.BubbleBG.itemArr;
    var len = itemArr.length;

    for (var i = 0; i < len; i++) {
        var item = itemArr[i];
        item.x += item.sp_x;
        item.y -= item.sp_y;

        item.scale.x = item.initSC + Math.sin(CONFIG.count_sc_eff_bg) * 0.08;
        item.scale.y = item.initSC + Math.cos(CONFIG.count_sc_eff_bg) * 0.08;

        if (item.position.x < -item.width ||
            item.position.x > (CONFIG.sw + item.width) ||
            item.position.y < -item.height) {

            if (item.curFrut) {
                item.removeChild(item.curFrut);
            }

            randomBubbleBG(item, false);
        }
    }

    CONFIG.count_sc_eff_bg += 0.1;
    requestAnimFrame(enterBubbleBG, 100);
}

function randomBubbleBG(item, flag) {
    item.position.x = (Math.random() - Math.random()) * CONFIG.sw;
    if (flag) item.position.y = Math.random() * CONFIG.sh;
    else item.position.y = CONFIG.sh;

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
function gotoScene(sceneJS) {
    if (!sceneJS) return;
    TweenMax.to(GAME.Container, .3, {
        alpha: 0,
        ease: Sine.easeOut,
        onComplete: function() {
            if (GAME.currentScene) {
                var currentScene;
                switch (GAME.currentScene) {
                    case "s0":
                        currentScene = GAME.Scene0;
                        break;
                    case "s1":
                        currentScene = GAME.Scene1;
                        break;
                    case "s2":
                        currentScene = GAME.Scene2;
                        break;
                    case "s3":
                        currentScene = GAME.Scene3;
                        break;
                }
                GAME.Container.removeChild(currentScene);
            }
            TweenMax.to(GAME.Container, .3, { alpha: 1, ease: Sine.easeOut });

            // switch (target.id) {
            //     case "s0":
            //         sceneJS = Scene0JS;
            //         break;
            //     case "s1":
            //         sceneJS = Scene1JS;
            //         break;
            //     case "s2":
            //         sceneJS = Scene2JS;
            //         break;
            //     case "s3":
            //         sceneJS = Scene3JS;
            //         break;
            // }
            sceneJS.create();
            sceneJS.start();
            onResize();
            GAME.currentScene = sceneJS.id;
        }
    });
}

/////////////////////////////////////////////////////////////////////////////////////////////////////
function addToQueue(url) {
    // trace(url);
    GAME.AssetsLoader.push(url);
}

/**
 * Load tất cả các image file để chuyển thành texture
 */
function loadTextures() {
    for (var i in TEXTURES) {
        addToQueue(TEXTURES[i]);
        TEXTURES[i] = new PIXI.Texture.fromImage(TEXTURES[i]);
    }
}

function startLoadAssets() {
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