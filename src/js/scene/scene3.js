/**
 * Màn hình chức năng
 */
var Scene3JS = (function() {
    return {
        id: "s3",
        create: function() {
            trace("create 3");

            with(GAME.Container) {

                GAME.Scene3 = addContainer({ id: Scene3JS.id, visible: false });

                with(GAME.Scene3) {
                    addObject({ id: "bg", texture: TEXTURES["images/lastScence_bg.png"], scaleX: .5, scaleY: .5 })

                    addContainer({ id: "frutHolder" });
                    addObject({ id: "lastScence", texture: TEXTURES["images/lastScence.png"], scaleX: .5, scaleY: .5 })

                    with(frutHolder) {
                        addObject({ id: "big_bottle", texture: TEXTURES["images/big_bottle.png"], scaleX: .5, scaleY: .5, locationX: 32, locationY: 135 });
                        big_bottle.rotation = convertToRadian(20);

                        addObject({ id: "f1", texture: TEXTURES["images/f1.png"], scaleX: .5, scaleY: .5, locationX: 80, locationY: 274 });
                        addObject({ id: "f2", texture: TEXTURES["images/f2.png"], scaleX: .5, scaleY: .5, locationX: -83, locationY: 345 });
                        addObject({ id: "f3", texture: TEXTURES["images/f3.png"], scaleX: .5, scaleY: .5, locationX: -115, locationY: 225, x: -10, y: -35 });
                    }

                    addObject({ id: "logo", texture: TEXTURES["images/logo.png"], scaleX: .5, scaleY: .5 })
                    addObject({ id: "goNowBtn", texture: TEXTURES["images/goNowBtn.png"], scaleX: .5, scaleY: .5 })
                    addObject({ id: "connectWifiBtn", texture: TEXTURES["images/connectWifiBtn.png"], scaleX: .5, scaleY: .5 })

                    addObject({ id: "myCodeHolder", texture: TEXTURES["images/codeBG.png"], scaleX: .6, scaleY: .6, visible: false })
                    myCodeHolder.addText({ id: "code", text: "ABC", font: "bold 17px Arial", color: "#008d41", locationX: 65, locationY: 12 });
                }
            }
        },
        start: function() {
            var timeout;
            GAME.Scene3.visible = true;
            GAME.Scene3.interactive = true;

            with(GAME.Scene3) {
                goNowBtn.interactive = true;
                goNowBtn.buttonMode = true;
                goNowBtn.mousedown = goNowBtn.touchstart = function(data) {
                    trace("trai nghiem ngay");
                    this.alpha = .5;
                }

                goNowBtn.mouseup = goNowBtn.mouseupoutside = goNowBtn.touchend = goNowBtn.touchendoutside = function(data) {
                    this.alpha = 1;
                    // connectToWifi();
                    location.reload();
                }

                connectWifiBtn.interactive = true;
                connectWifiBtn.buttonMode = true;
                connectWifiBtn.mousedown = connectWifiBtn.touchstart = function(data) {
                    trace("ket noi wifi");
                    // connectToWifi();
                    this.alpha = .5;
                }

                connectWifiBtn.mouseup = connectWifiBtn.mouseupoutside = connectWifiBtn.touchend = connectWifiBtn.touchendoutside = function(data) {
                    this.alpha = 1;
                    gotoScene(Scene0JS);
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


                if (GAME.is_win) {
                    myCodeHolder.visible = true;
                    myCodeHolder.code.setText(CONFIG.my_code);
                }
            }
        },
        resize: function(sw, sh) {
            if (GAME.Scene3) {
                with(GAME.Scene3) {

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
        }
    };
})();