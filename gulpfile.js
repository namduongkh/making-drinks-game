const gulp = require('gulp');
const concat = require('gulp-concat');
const babel = require('gulp-babel');
const uglify = require('gulp-uglify');
const pump = require('pump');
const sass = require('gulp-sass');
const autoprefixer = require('gulp-autoprefixer');
const cleanCSS = require('gulp-clean-css');

gulp.task('style', function() {
    gulp.src(['./src/css/*.css'])
        .pipe(concat('vendor.css'))
        .pipe(autoprefixer())
        .pipe(cleanCSS({ compatibility: 'ie8' }))
        .pipe(gulp.dest('./src/build'));
});

gulp.task('sass', function() {
    gulp.src(['./src/scss/*.scss'])
        .pipe(sass().on('error', sass.logError))
        .pipe(concat('styles.css'))
        .pipe(autoprefixer())
        .pipe(cleanCSS({ compatibility: 'ie8' }))
        .pipe(gulp.dest('./src/build'));
});

var jsEntries = [
    './src/js/*.js',
    './src/js/scene/*.js',
];

gulp.task('watch', function() {
    gulp.watch(jsEntries, ['js'])
    gulp.watch('./src/scss/*.scss', ['style'])
});


gulp.task('js', function(cb) {
    // console.log(arguments);
    var task = [gulp.src(jsEntries), concat('app.js')];
    if (process.argv.includes("--min")) {
        console.log('min');
        task.push(uglify());
    }
    task.push(gulp.dest('./src/build'));
    pump(task, cb);
});

gulp.task('default', ['sass', 'style', 'js', 'watch']);
gulp.task('build', ['sass', 'style', 'js', 'watch']);