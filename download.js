const DownloadFile = require('download-file');

const href = "http://demo.s-wifi.vn/campaign/tropica/"

function getOptions(type) {
    return {
        directory: "./src/" + type,
    };
}
const files = [
    'css/plugin.css',
    'css/reset.css',
    'css/style.css',
    'css/jquery-ui.css',

    'js/jquery.1.11.0.min.js',
    'js/jquery-ui.js',
    'js/pixi.dev.js',
    'js/TweenMax.js',
    'js/trace.js',
    'js/pixi.prototype.js',
    'js/common.js',
    'js/main.js',

    'images/tini_bubble.png',
    'images/logo.png',
    'images/copy1.png',
    'images/bubble_group.png',
    'images/intro_copy.png',
    'images/countDown.png',
    'images/progress_bg.png',
    'images/progress_bar.png',
    'images/numOfFrut.png',
    'images/bottle_double.png',
    'images/lemon.png',
    'images/apple.png',
    'images/mangcau.png',
    'images/apple.png',
    'images/lemon_broken.png',
    'images/apple_broken.png',
    'images/mangcau_broken.png',
    'images/apple_broken.png',
    'images/bubble.png',
    'images/logo.png',
    'images/congratulation.png',
    'images/win.png',
    'images/lastScence_bg.png',
    'images/lastScence.png',
    'images/big_bottle.png',
    'images/f1.png',
    'images/f2.png',
    'images/f3.png',
    'images/logo.png',
    'images/goNowBtn.png',
    'images/connectWifiBtn.png',
    'images/codeBG.png',
    'images/bottle.png',
    'images/bottle_grey.png',
    'images/bg.png',
];

files.forEach(function(file) {
    let url = href + file;
    let options = getOptions(file.split("/")[0]);
    DownloadFile(url, getOptions(file.split("/")[0]), function(err) {
        if (err) throw err
        console.log("Downloaded ", url);
    });
});