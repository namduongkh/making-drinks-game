const ghpages = require('gh-pages');

ghpages.publish('src', function(err) {
    console.log('err', err);
});