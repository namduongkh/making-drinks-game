/**
 * Màn hình kết quả
 */
var Scene2JS = (function() {
    return {
        create: function() {
            trace("create 2")

            with(GAME.Container) {

                GAME.Scene2 = addContainer({ id: "s2", visible: false });
                GAME.Scene2.interactive = true;
                GAME.Scene2.buttonMode = true;

                with(GAME.Scene2) {
                    addRect("hit", CONFIG.sw, CONFIG.sh, "0xff0", 0, 0, 0);
                    addObject({ id: "logo", url: "images/logo.png", scaleX: .5, scaleY: .5 })
                    addObject({ id: "copy1", url: "images/congratulation.png", scaleX: .5, scaleY: .5, visible: false });
                    addObject({ id: "copy2", url: "images/win.png", scaleX: .5, scaleY: .5, visible: false })
                }
            }
        },
        start: function() {
            var timeout;
            GAME.Scene2.visible = true;

            var txt = GAME.Scene2.copy1.addText({ id: "txt", text: "0", font: "bold 30px Arial", color: "#008d41", locationX: 75, locationY: 93 });
            var numOfBottle = GAME.finish_cup_number;

            if (numOfBottle < 10 && numOfBottle != 0) numOfBottle = "0" + numOfBottle;
            txt.setText(numOfBottle);
            if (numOfBottle > 0) txt.position.x = txt.initX - txt.width / 2;

            GAME.Scene2.copy1.visible = true;
            GAME.Scene2.copy2.visible = false;

            timeout = setTimeout(function() {
                gotoSence(GAME.Scene2, GAME.Scene3);
            }, 3000);
        },
        resize: function(sw, sh) {
            with(GAME.Scene2) {
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
    };
})();