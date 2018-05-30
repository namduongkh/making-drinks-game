var MATERIAL_INPUT = {
    "apple": {
        id: "apple",
        name: "Táo",
        quantity: 1,
        url: "images/apple.png",
        broken_id: "apple_broken",
        broken_url: "images/apple_broken.png",
    },
    // "peanapple": {
    //     id: "peanapple",
    //     name: "Ngân nhĩ",
    //     quantity: 2,
    //     url: "images/mangcau.png",
    //     broken_id: "peanapple_broken",
    //     broken_url: "images/mangcau_broken.png",
    // },
    "sakura": {
        id: "sakura",
        name: "Anh đào",
        quantity: 1,
        url: "images/sakura.png",
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

var CONFIG = {
    difficult_level: 1,
    max_difficult_level: 5,
    appear_circle: 6,
    circle_scale_seconds: 10,
    total_seconds: 30,
    my_ratio: 1,
    total_item_on_circle: 12,
    multiplier_with_difficult: 1.5,
    request_cup_number: 1,
    material_min_scale: 0.4,
    sw: window.innerWidth,
    sh: window.innerHeight,
    count_sc_eff_bg: 0,
    count_sc_eff: 0,
    initH: 568,
    initW: 320,
    my_code: "-1",
};

var GAME = {
    material_collected: {
        "lemon": 0,
        "apple": 0,
        "sakura": 0
    },
    is_win: false,
    finish_cup_number: 0,
    is_stop: false,
    stop_countdown: false,
    mousePosition: {},

    max_appear_items: 0,
    all_items_will_appear: {},

    Loader: null,
    AssetsLoader: null,
    CountAssetsLoaded: null,
    LoaderPercent: null,
    TotalAssets: null,
    Stage: null,
    Renderer: null,
    TotalAssets: null,
    Container: null,

    Scene0: null,
    Scene1: null,
    Scene2: null,
    Scene3: null,
    BubbleBG: null,
};