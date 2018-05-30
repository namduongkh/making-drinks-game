/**
 * Màn hình kết quả
 */
var Scene2JS = (function() {
    return {
        id: "s2",
        create: function() {
            trace("create 2")

            with(GAME.Container) {

                GAME.Scene2 = addContainer({ id: Scene2JS.id });
                GAME.Scene2.interactive = true;
                GAME.Scene2.buttonMode = true;

                with(GAME.Scene2) {
                    addRect("hit", CONFIG.sw, CONFIG.sh, "0xff0", 0, 0, 0);
                    addContainer({ id: "winContent", visible: false });
                    addContainer({ id: "loseContent", visible: false });
                    addObject({ id: "logo", texture: TEXTURES["images/logo.png"], scaleX: .5, scaleY: .5 });
                    addObject({ id: "cup", texture: TEXTURES["images/tocotococup.png"], scaleX: .8, scaleY: .8 });

                    with(winContent) {
                        // addObject({ id: "copy1", texture: TEXTURES["images/congratulation.png"], scaleX: .5, scaleY: .5, visible: false });
                        // addObject({ id: "copy2", texture: TEXTURES["images/win.png"], scaleX: .5, scaleY: .5, visible: false });

                        // TODO: Sau này nên thay những dòng text bằng hình hết để responsive
                        addText({ id: "win", text: "Bạn đã chiến thắng!", font: "bold 30px Arial", color: "#008d41" });
                    };
                    with(loseContent) {
                        // TODO: Sau này nên thay những dòng text bằng hình hết để responsive
                        addText({ id: "lose", text: "Bạn đã không giành được chiến thắng!", anchorX: 0, anchorY: 0, font: "bold 30px Arial", color: "#008d41" });
                    }
                }
            }
        },
        start: function() {
            var timeout;

            if (GAME.is_win) {
                GAME.Scene2.winContent.visible = true;
                with(GAME.Scene2.winContent) {
                    var numOfBottle = GAME.finish_cup_number;

                    if (numOfBottle < 10 && numOfBottle != 0) numOfBottle = "0" + numOfBottle;
                    win.setText("Bạn đã pha chế thành công " + numOfBottle + " ly Sakura Ngân Nhĩ!");
                    if (numOfBottle > 0) win.position.x = win.initX - win.width / 2;

                    // copy1.visible = true;
                    // copy2.visible = false;
                }
            } else {
                GAME.Scene2.loseContent.visible = true;
                // with(GAME.Scene2.loseContent) {
                //     addText({ id: "lose", text: "Bạn đã không giành được chiến thắng!", locationX: 0, locationY: 0, font: "bold 30px Arial", color: "#008d41" });
                // }
            }

            timeout = setTimeout(function() {
                gotoScene(Scene3JS);
            }, 5000);
        },
        resize: function(sw, sh) {
            if (GAME.Scene2) {
                TweenMax.to(GAME.Scene2, 0, { alpha: 0.05, ease: Sine.easeOut });
                with(GAME.Scene2) {
                    hit.width = sw;
                    hit.height = sh;

                    // hit.position.x = -hit.width / 2;
                    // hit.position.y = -hit.height / 2;

                    // position.x = sw / 2;
                    // position.y = sh / 2;

                    logo.scale.x = logo.scale.y = CONFIG.my_ratio;
                    logo.position.x = (sw - logo.width) / 2;
                    logo.position.y = 10;

                    cup.position.x = (sw - cup.width) / 2;
                    cup.position.y = (sh - cup.height) / 2;

                    with(winContent) {
                        //     copy1.scale.x = copy1.scale.y = CONFIG.my_ratio;
                        //     copy1.position.x = (sw - copy1.width) / 2;
                        //     copy1.position.y = (sh - copy1.height + logo.height) / 2;

                        //     copy2.scale.x = copy2.scale.y = CONFIG.my_ratio;
                        //     copy2.position.x = (sw - copy2.width) / 2;
                        //     copy2.position.y = (sh - copy2.height + logo.height) / 2;
                        win.position.x = (sw - win.width) / 2;
                        win.position.y = (sh - win.height + cup.height) / 2;
                    }

                    with(loseContent) {
                        lose.position.x = (sw - lose.width) / 2;
                        lose.position.y = (sh - lose.height + cup.height) / 2;
                    }
                }
                if (!Scene2JS.hasResized) {
                    Scene2JS.hasResized = true;
                    setTimeout(function() {
                        Scene2JS.resize(sw, sh);
                    }, 50);
                } else {
                    Scene2JS.hasResized = false;
                    TweenMax.to(GAME.Scene2, .3, { alpha: 1, ease: Sine.easeOut });
                }
            }
        }
    };
})();