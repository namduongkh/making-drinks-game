/**
 * Màn hình giới thiệu
 */
var Scene0JS = (function() {
    return {
        id: "s0",
        create: function() {
            trace("create 0")

            with(GAME.Container) {
                GAME.Scene0 = addContainer({ id: Scene0JS.id });
                GAME.Scene0.interactive = true;
                GAME.Scene0.buttonMode = true;

                with(GAME.Scene0) {
                    addRect("hit", CONFIG.sw, CONFIG.sh, "0xff0", 0, 0, 0);
                    addObject({ id: "logo", texture: TEXTURES["images/logo.png"], scaleX: .5, scaleY: .5 });
                    // addObject({ id: "copy1", texture: TEXTURES["images/copy1.png"], scaleX: .5, scaleY: .5 })
                    addObject({ id: "copy1", texture: TEXTURES["images/intro_copy.png"], scaleX: .5, scaleY: .5 });
                }
            }
        },
        resize: function(sw, sh) {
            if (GAME.Scene0) {
                with(GAME.Scene0) {
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
        },
        start: function() {
            var timeout;

            GAME.Scene0.mousedown = GAME.Scene0.touchstart = function(data) {
                clearTimeout(timeout);
                gotoScene(Scene1JS);
            }

            timeout = setTimeout(function() {
                gotoScene(Scene1JS);
            }, 3000)
        }
    };
})();