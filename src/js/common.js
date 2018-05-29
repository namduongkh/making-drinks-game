$(document).ready(function() {

    //init;
    $('body').css('visibility', 'visible');

    hidePreloader(0, 0, false);
    showPreloader(0, .5);
    CommonJS.addPopupToShowMessage();
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
        y: window.innerHeight,
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



var CommonJS = (function() {
    return {
        addPopupToShowMessage: function() {
            $('body').append(`
            <div id="message-pop">
                <div class="pop-wrapper">
                    <div class="pop-layer"></div>
                    <div class="pop-content">
                        <div class="pop-header">
                            
                        </div>
                        <div class="pop-body">
                            
                        </div>
                        <!--<div class="pop-footer">
            
                        </div>-->
                    </div>
                </div>
            <div>
            `);
            var popLayer = $('#message-pop .pop-layer');
            popLayer.on('click', function() {
                CommonJS.closeMessagePopup();
            });
            $(document).keyup(function(e) {
                if (e.keyCode === 27) CommonJS.closeMessagePopup(); // esc
            });
        },
        showMessagePopup: function(header, body, footer) {
            var popup = $('#message-pop');
            var popHeader = $('#message-pop .pop-header');
            var popBody = $('#message-pop .pop-body');
            var popFooter = $('#message-pop .pop-footer');
            popHeader.html(header);
            popBody.html(body);
            popFooter.html(footer);
            popup.fadeIn(200);
        },
        closeMessagePopup: function() {
            $('#message-pop').fadeOut(200);
        }
    };
})();