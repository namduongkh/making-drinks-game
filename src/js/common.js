$(document).ready(function() {

    //init;
    $('body').css('visibility', 'visible');

    hidePreloader(0, 0, false);
    showPreloader(0, .5);

});

var globalVar_myCode = "";

function showPreloader(delay, dur) {
    var rota = (Math.random() - Math.random()) * 30;
    TweenMax.to($('#preloader'), dur, {
        delay: delay,
        y: 0,
        rotation: rota,
        ease: Back.easeOut,
        onComplete: function() {
            TweenMax.to($('#preloader'), 1, { y: 15, yoyo: true, repeat: -1, ease: Sine.easeInOut });
        }
    });
}

function hidePreloader(delay, dur, remove) {
    var rota = (Math.random() - Math.random()) * 45;
    TweenMax.to($('#preloader'), dur, {
        delay: delay,
        rotation: rota,
        y: sh,
        ease: Back.easeIn,
        onComplete: function() {
            if (remove) $('#preloader').remove();
        }
    });
}

function getCodeFromBackend() {
    /*
    $.ajax({ type: "GET",   
             url: "http://www.pepsi.com.vn/tropicana_app/loadcode.aspx?op=getCode",
             async: false,
             success : function(code){
               setCode(code);
             }
    }); */
}
/*
function connectToWifi(){
    trace("connectToWifi");
}*/