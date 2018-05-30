/*!
 * VERSION: beta 1.10.3
 * DATE: 2013-09-02
 * UPDATES AND DOCS AT: http://www.greensock.com
 * 
 * Includes all of the following: TweenLite, TweenMax, TimelineLite, TimelineMax, EasePack, CSSPlugin, RoundPropsPlugin, BezierPlugin, AttrPlugin, DirectionalRotationPlugin
 *
 * @license Copyright (c) 2008-2013, GreenSock. All rights reserved.
 * This work is subject to the terms at http://www.greensock.com/terms_of_use.html or for
 * Club GreenSock members, the software agreement that was issued with your membership.
 * 
 * @author: Jack Doyle, jack@greensock.com
 **/

(window._gsQueue || (window._gsQueue = [])).push( function() {

	"use strict";

	window._gsDefine("TweenMax", ["core.Animation","core.SimpleTimeline","TweenLite"], function(Animation, SimpleTimeline, TweenLite) {
		
		var _slice = [].slice,
			TweenMax = function(target, duration, vars) {
				TweenLite.call(this, target, duration, vars);
				this._cycle = 0;
				this._yoyo = (this.vars.yoyo === true);
				this._repeat = this.vars.repeat || 0;
				this._repeatDelay = this.vars.repeatDelay || 0;
				this._dirty = true; //ensures that if there is any repeat, the totalDuration will get recalculated to accurately report it.
				this.render = TweenMax.prototype.render; //speed optimization (avoid prototype lookup on this "hot" method)
			},
			_isSelector = function(v) {
				return (v.jquery || (v.length && v !== window && v[0] && (v[0] === window || (v[0].nodeType && v[0].style && !v.nodeType)))); //note: we cannot check "nodeType" on window from inside an iframe (some browsers throw a security error)
			},
			p = TweenMax.prototype = TweenLite.to({}, 0.1, {}),
			_blankArray = [];

		TweenMax.version = "1.10.3";
		p.constructor = TweenMax;
		p.kill()._gc = false;
		TweenMax.killTweensOf = TweenMax.killDelayedCallsTo = TweenLite.killTweensOf;
		TweenMax.getTweensOf = TweenLite.getTweensOf;
		TweenMax.ticker = TweenLite.ticker;
	
		p.invalidate = function() {
			this._yoyo = (this.vars.yoyo === true);
			this._repeat = this.vars.repeat || 0;
			this._repeatDelay = this.vars.repeatDelay || 0;
			this._uncache(true);
			return TweenLite.prototype.invalidate.call(this);
		};
		
		p.updateTo = function(vars, resetDuration) {
			var curRatio = this.ratio, p;
			if (resetDuration && this.timeline && this._startTime < this._timeline._time) {
				this._startTime = this._timeline._time;
				this._uncache(false);
				if (this._gc) {
					this._enabled(true, false);
				} else {
					this._timeline.insert(this, this._startTime - this._delay); //ensures that any necessary re-sequencing of Animations in the timeline occurs to make sure the rendering order is correct.
				}
			}
			for (p in vars) {
				this.vars[p] = vars[p];
			}
			if (this._initted) {
				if (resetDuration) {
					this._initted = false;
				} else {
					if (this._notifyPluginsOfEnabled && this._firstPT) {
						TweenLite._onPluginEvent("_onDisable", this); //in case a plugin like MotionBlur must perform some cleanup tasks
					}
					if (this._time / this._duration > 0.998) { //if the tween has finished (or come extremely close to finishing), we just need to rewind it to 0 and then render it again at the end which forces it to re-initialize (parsing the new vars). We allow tweens that are close to finishing (but haven't quite finished) to work this way too because otherwise, the values are so small when determining where to project the starting values that binary math issues creep in and can make the tween appear to render incorrectly when run backwards. 
						var prevTime = this._time;
						this.render(0, true, false);
						this._initted = false;
						this.render(prevTime, true, false);
					} else if (this._time > 0) {
						this._initted = false;
						this._init();
						var inv = 1 / (1 - curRatio),
							pt = this._firstPT, endValue;
						while (pt) {
							endValue = pt.s + pt.c; 
							pt.c *= inv;
							pt.s = endValue - pt.c;
							pt = pt._next;
						}
					}
				}
			}
			return this;
		};
				
		p.render = function(time, suppressEvents, force) {
			var totalDur = (!this._dirty) ? this._totalDuration : this.totalDuration(),
				prevTime = this._time,
				prevTotalTime = this._totalTime, 
				prevCycle = this._cycle, 
				isComplete, callback, pt, cycleDuration, r, type, pow;
			if (time >= totalDur) {
				this._totalTime = totalDur;
				this._cycle = this._repeat;
				if (this._yoyo && (this._cycle & 1) !== 0) {
					this._time = 0;
					this.ratio = this._ease._calcEnd ? this._ease.getRatio(0) : 0;
				} else {
					this._time = this._duration;
					this.ratio = this._ease._calcEnd ? this._ease.getRatio(1) : 1;
				}
				if (!this._reversed) {
					isComplete = true;
					callback = "onComplete";
				}
				if (this._duration === 0) { //zero-duration tweens are tricky because we must discern the momentum/direction of time in order to determine whether the starting values should be rendered or the ending values. If the "playhead" of its timeline goes past the zero-duration tween in the forward direction or lands directly on it, the end values should be rendered, but if the timeline's "playhead" moves past it in the backward direction (from a postitive time to a negative time), the starting values must be rendered.
					if (time === 0 || this._rawPrevTime < 0) if (this._rawPrevTime !== time) {
						force = true;
						if (this._rawPrevTime > 0) {
							callback = "onReverseComplete";
							if (suppressEvents) {
								time = -1; //when a callback is placed at the VERY beginning of a timeline and it repeats (or if timeline.seek(0) is called), events are normally suppressed during those behaviors (repeat or seek()) and without adjusting the _rawPrevTime back slightly, the onComplete wouldn't get called on the next render. This only applies to zero-duration tweens/callbacks of course.
							}
						}
					}
					this._rawPrevTime = time;
				}
				
			} else if (time < 0.0000001) { //to work around occasional floating point math artifacts, round super small values to 0.
				this._totalTime = this._time = this._cycle = 0;
				this.ratio = this._ease._calcEnd ? this._ease.getRatio(0) : 0;
				if (prevTotalTime !== 0 || (this._duration === 0 && this._rawPrevTime > 0)) {
					callback = "onReverseComplete";
					isComplete = this._reversed;
				}
				if (time < 0) {
					this._active = false;
					if (this._duration === 0) { //zero-duration tweens are tricky because we must discern the momentum/direction of time in order to determine whether the starting values should be rendered or the ending values. If the "playhead" of its timeline goes past the zero-duration tween in the forward direction or lands directly on it, the end values should be rendered, but if the timeline's "playhead" moves past it in the backward direction (from a postitive time to a negative time), the starting values must be rendered.
						if (this._rawPrevTime >= 0) {
							force = true;
						}
						this._rawPrevTime = time;
					}
				} else if (!this._initted) { //if we render the very beginning (time == 0) of a fromTo(), we must force the render (normal tweens wouldn't need to render at a time of 0 when the prevTime was also 0). This is also mandatory to make sure overwriting kicks in immediately.
					force = true;
				}
			} else {
				this._totalTime = this._time = time;
				
				if (this._repeat !== 0) {
					cycleDuration = this._duration + this._repeatDelay;
					this._cycle = (this._totalTime / cycleDuration) >> 0; //originally _totalTime % cycleDuration but floating point errors caused problems, so I normalized it. (4 % 0.8 should be 0 but Flash reports it as 0.79999999!)
					if (this._cycle !== 0) if (this._cycle === this._totalTime / cycleDuration) {
						this._cycle--; //otherwise when rendered exactly at the end time, it will act as though it is repeating (at the beginning)
					}
					this._time = this._totalTime - (this._cycle * cycleDuration);
					if (this._yoyo) if ((this._cycle & 1) !== 0) {
						this._time = this._duration - this._time;
					}
					if (this._time > this._duration) {
						this._time = this._duration;
					} else if (this._time < 0) {
						this._time = 0;
					}
				}
				
				if (this._easeType) {
					r = this._time / this._duration;
					type = this._easeType;
					pow = this._easePower;
					if (type === 1 || (type === 3 && r >= 0.5)) {
						r = 1 - r;
					}
					if (type === 3) {
						r *= 2;
					}
					if (pow === 1) {
						r *= r;
					} else if (pow === 2) {
						r *= r * r;
					} else if (pow === 3) {
						r *= r * r * r;
					} else if (pow === 4) {
						r *= r * r * r * r;
					}
					
					if (type === 1) {
						this.ratio = 1 - r;
					} else if (type === 2) {
						this.ratio = r;
					} else if (this._time / this._duration < 0.5) {
						this.ratio = r / 2;
					} else {
						this.ratio = 1 - (r / 2);
					}
					
				} else {
					this.ratio = this._ease.getRatio(this._time / this._duration);
				}
				
			}
				
			if (prevTime === this._time && !force) {
				if (prevTotalTime !== this._totalTime) if (this._onUpdate) if (!suppressEvents) { //so that onUpdate fires even during the repeatDelay - as long as the totalTime changed, we should trigger onUpdate.
					this._onUpdate.apply(this.vars.onUpdateScope || this, this.vars.onUpdateParams || _blankArray);
				}
				return;
			} else if (!this._initted) {
				this._init();
				if (!this._initted) { //immediateRender tweens typically won't initialize until the playhead advances (_time is greater than 0) in order to ensure that overwriting occurs properly.
					return;
				}
				//_ease is initially set to defaultEase, so now that init() has run, _ease is set properly and we need to recalculate the ratio. Overall this is faster than using conditional logic earlier in the method to avoid having to set ratio twice because we only init() once but renderTime() gets called VERY frequently.
				if (this._time && !isComplete) {
					this.ratio = this._ease.getRatio(this._time / this._duration);
				} else if (isComplete && this._ease._calcEnd) {
					this.ratio = this._ease.getRatio((this._time === 0) ? 0 : 1);
				}
			}
			
			if (!this._active) if (!this._paused && this._time !== prevTime && time >= 0) {
				this._active = true; //so that if the user renders a tween (as opposed to the timeline rendering it), the timeline is forced to re-render and align it with the proper time/frame on the next rendering cycle. Maybe the tween already finished but the user manually re-renders it as halfway done.
			}
			if (prevTotalTime === 0) {
				if (this._startAt) {
					if (time >= 0) {
						this._startAt.render(time, suppressEvents, force);
					} else if (!callback) {
						callback = "_dummyGS"; //if no callback is defined, use a dummy value just so that the condition at the end evaluates as true because _startAt should render AFTER the normal render loop when the time is negative. We could handle this in a more intuitive way, of course, but the render loop is the MOST important thing to optimize, so this technique allows us to avoid adding extra conditional logic in a high-frequency area.
					}
				}
				if (this.vars.onStart) if (this._totalTime !== 0 || this._duration === 0) if (!suppressEvents) {
					this.vars.onStart.apply(this.vars.onStartScope || this, this.vars.onStartParams || _blankArray);
				}
			}
			
			pt = this._firstPT;
			while (pt) {
				if (pt.f) {
					pt.t[pt.p](pt.c * this.ratio + pt.s);
				} else {
					pt.t[pt.p] = pt.c * this.ratio + pt.s;
				}
				pt = pt._next;
			}
			
			if (this._onUpdate) {
				if (time < 0) if (this._startAt) {
					this._startAt.render(time, suppressEvents, force); //note: for performance reasons, we tuck this conditional logic inside less traveled areas (most tweens don't have an onUpdate). We'd just have it at the end before the onComplete, but the values should be updated before any onUpdate is called, so we ALSO put it here and then if it's not called, we do so later near the onComplete.
				}
				if (!suppressEvents) {
					this._onUpdate.apply(this.vars.onUpdateScope || this, this.vars.onUpdateParams || _blankArray);
				}
			}
			if (this._cycle !== prevCycle) if (!suppressEvents) if (!this._gc) if (this.vars.onRepeat) {
				this.vars.onRepeat.apply(this.vars.onRepeatScope || this, this.vars.onRepeatParams || _blankArray);
			}
			if (callback) if (!this._gc) { //check gc because there's a chance that kill() could be called in an onUpdate
				if (time < 0 && this._startAt && !this._onUpdate) {
					this._startAt.render(time, suppressEvents, force);
				}
				if (isComplete) {
					if (this._timeline.autoRemoveChildren) {
						this._enabled(false, false);
					}
					this._active = false;
				}
				if (!suppressEvents && this.vars[callback]) {
					this.vars[callback].apply(this.vars[callback + "Scope"] || this, this.vars[callback + "Params"] || _blankArray);
				}
			}
		};
		
//---- STATIC FUNCTIONS -----------------------------------------------------------------------------------------------------------
		
		TweenMax.to = function(target, duration, vars) {
			return new TweenMax(target, duration, vars);
		};
		
		TweenMax.from = function(target, duration, vars) {
			vars.runBackwards = true;
			vars.immediateRender = (vars.immediateRender != false);
			return new TweenMax(target, duration, vars);
		};
		
		TweenMax.fromTo = function(target, duration, fromVars, toVars) {
			toVars.startAt = fromVars;
			toVars.immediateRender = (toVars.immediateRender != false && fromVars.immediateRender != false);
			return new TweenMax(target, duration, toVars);
		};
		
		TweenMax.staggerTo = TweenMax.allTo = function(targets, duration, vars, stagger, onCompleteAll, onCompleteAllParams, onCompleteAllScope) {
			stagger = stagger || 0;
			var delay = vars.delay || 0,
				a = [],
				finalComplete = function() {
					if (vars.onComplete) {
						vars.onComplete.apply(vars.onCompleteScope || this, arguments);
					}
					onCompleteAll.apply(onCompleteAllScope || this, onCompleteAllParams || _blankArray);
				},
				l, copy, i, p;
			if (!(targets instanceof Array)) {
				if (typeof(targets) === "string") {
					targets = TweenLite.selector(targets) || targets;
				}
				if (_isSelector(targets)) {
					targets = _slice.call(targets, 0);
				}
			}
			l = targets.length;
			for (i = 0; i < l; i++) {
				copy = {};
				for (p in vars) {
					copy[p] = vars[p];
				}
				copy.delay = delay;
				if (i === l - 1 && onCompleteAll) {
					copy.onComplete = finalComplete;
				}
				a[i] = new TweenMax(targets[i], duration, copy);
				delay += stagger;
			}
			return a;
		};
		
		TweenMax.staggerFrom = TweenMax.allFrom = function(targets, duration, vars, stagger, onCompleteAll, onCompleteAllParams, onCompleteAllScope) {
			vars.runBackwards = true;
			vars.immediateRender = (vars.immediateRender != false);
			return TweenMax.staggerTo(targets, duration, vars, stagger, onCompleteAll, onCompleteAllParams, onCompleteAllScope);
		};
		
		TweenMax.staggerFromTo = TweenMax.allFromTo = function(targets, duration, fromVars, toVars, stagger, onCompleteAll, onCompleteAllParams, onCompleteAllScope) {
			toVars.startAt = fromVars;
			toVars.immediateRender = (toVars.immediateRender != false && fromVars.immediateRender != false);
			return TweenMax.staggerTo(targets, duration, toVars, stagger, onCompleteAll, onCompleteAllParams, onCompleteAllScope);
		};
				
		TweenMax.delayedCall = function(delay, callback, params, scope, useFrames) {
			return new TweenMax(callback, 0, {delay:delay, onComplete:callback, onCompleteParams:params, onCompleteScope:scope, onReverseComplete:callback, onReverseCompleteParams:params, onReverseCompleteScope:scope, immediateRender:false, useFrames:useFrames, overwrite:0});
		};
		
		TweenMax.set = function(target, vars) {
			return new TweenMax(target, 0, vars);
		};
		
		TweenMax.isTweening = function(target) {
			var a = TweenLite.getTweensOf(target),
				i = a.length,
				tween;
			while (--i > -1) {
				tween = a[i];
				if (tween._active || (tween._startTime === tween._timeline._time && tween._timeline._active)) {
					return true;
				}
			}
			return false;
		};
		
		var _getChildrenOf = function(timeline, includeTimelines) {
				var a = [],
					cnt = 0,
					tween = timeline._first;
				while (tween) {
					if (tween instanceof TweenLite) {
						a[cnt++] = tween;
					} else {
						if (includeTimelines) {
							a[cnt++] = tween;
						}
						a = a.concat(_getChildrenOf(tween, includeTimelines));
						cnt = a.length;
					}
					tween = tween._next;
				}
				return a;
			}, 
			getAllTweens = TweenMax.getAllTweens = function(includeTimelines) {
				return _getChildrenOf(Animation._rootTimeline, includeTimelines).concat( _getChildrenOf(Animation._rootFramesTimeline, includeTimelines) );
			};
		
		TweenMax.killAll = function(complete, tweens, delayedCalls, timelines) {
			if (tweens == null) {
				tweens = true;
			}
			if (delayedCalls == null) {
				delayedCalls = true;
			}
			var a = getAllTweens((timelines != false)),
				l = a.length,
				allTrue = (tweens && delayedCalls && timelines),
				isDC, tween, i;
			for (i = 0; i < l; i++) {
				tween = a[i];
				if (allTrue || (tween instanceof SimpleTimeline) || ((isDC = (tween.target === tween.vars.onComplete)) && delayedCalls) || (tweens && !isDC)) {
					if (complete) {
						tween.totalTime(tween.totalDuration());
					} else {
						tween._enabled(false, false);
					}
				}
			}
		};
		
		TweenMax.killChildTweensOf = function(parent, complete) {
			if (parent == null) {
				return;
			}
			var tl = TweenLite._tweenLookup,
				a, curParent, p, i, l;
			if (typeof(parent) === "string") {
				parent = TweenLite.selector(parent) || parent;
			}
			if (_isSelector(parent)) {
				parent = _slice(parent, 0);
			}
			if (parent instanceof Array) {
				i = parent.length;
				while (--i > -1) {
					TweenMax.killChildTweensOf(parent[i], complete);
				}
				return;
			}
			a = [];
			for (p in tl) {
				curParent = tl[p].target.parentNode;
				while (curParent) {
					if (curParent === parent) {
						a = a.concat(tl[p].tweens);
					}
					curParent = curParent.parentNode;
				}
			}
			l = a.length;
			for (i = 0; i < l; i++) {
				if (complete) {
					a[i].totalTime(a[i].totalDuration());
				}
				a[i]._enabled(false, false);
			}
		};

		var _changePause = function(pause, tweens, delayedCalls, timelines) {
			tweens = (tweens !== false);
			delayedCalls = (delayedCalls !== false);
			timelines = (timelines !== false);
			var a = getAllTweens(timelines),
				allTrue = (tweens && delayedCalls && timelines),
				i = a.length,
				isDC, tween;
			while (--i > -1) {
				tween = a[i];
				if (allTrue || (tween instanceof SimpleTimeline) || ((isDC = (tween.target === tween.vars.onComplete)) && delayedCalls) || (tweens && !isDC)) {
					tween.paused(pause);
				}
			}
		};
		
		TweenMax.pauseAll = function(tweens, delayedCalls, timelines) {
			_changePause(true, tweens, delayedCalls, timelines);
		};
		
		TweenMax.resumeAll = function(tweens, delayedCalls, timelines) {
			_changePause(false, tweens, delayedCalls, timelines);
		};

		TweenMax.globalTimeScale = function(value) {
			var tl = Animation._rootTimeline,
				t = TweenLite.ticker.time;
			if (!arguments.length) {
				return tl._timeScale;
			}
			value = value || 0.000001; //can't allow zero because it'll throw the math off
			tl._startTime = t - ((t - tl._startTime) * tl._timeScale / value);
			tl = Animation._rootFramesTimeline;
			t = TweenLite.ticker.frame;
			tl._startTime = t - ((t - tl._startTime) * tl._timeScale / value);
			tl._timeScale = Animation._rootTimeline._timeScale = value;
			return value;
		};
		
	
//---- GETTERS / SETTERS ----------------------------------------------------------------------------------------------------------
		
		p.progress = function(value) {
			return (!arguments.length) ? this._time / this.duration() : this.totalTime( this.duration() * ((this._yoyo && (this._cycle & 1) !== 0) ? 1 - value : value) + (this._cycle * (this._duration + this._repeatDelay)), false);
		};
		
		p.totalProgress = function(value) {
			return (!arguments.length) ? this._totalTime / this.totalDuration() : this.totalTime( this.totalDuration() * value, false);
		};
		
		p.time = function(value, suppressEvents) {
			if (!arguments.length) {
				return this._time;
			}
			if (this._dirty) {
				this.totalDuration();
			}
			if (value > this._duration) {
				value = this._duration;
			}
			if (this._yoyo && (this._cycle & 1) !== 0) {
				value = (this._duration - value) + (this._cycle * (this._duration + this._repeatDelay));
			} else if (this._repeat !== 0) {
				value += this._cycle * (this._duration + this._repeatDelay);
			}
			return this.totalTime(value, suppressEvents);
		};

		p.duration = function(value) {
			if (!arguments.length) {
				return this._duration; //don't set _dirty = false because there could be repeats that haven't been factored into the _totalDuration yet. Otherwise, if you create a repeated TweenMax and then immediately check its duration(), it would cache the value and the totalDuration would not be correct, thus repeats wouldn't take effect.
			}
			return Animation.prototype.duration.call(this, value);
		};

		p.totalDuration = function(value) {
			if (!arguments.length) {
				if (this._dirty) {
					//instead of Infinity, we use 999999999999 so that we can accommodate reverses
					this._totalDuration = (this._repeat === -1) ? 999999999999 : this._duration * (this._repeat + 1) + (this._repeatDelay * this._repeat);
					this._dirty = false;
				}
				return this._totalDuration;
			}
			return (this._repeat === -1) ? this : this.duration( (value - (this._repeat * this._repeatDelay)) / (this._repeat + 1) );
		};
		
		p.repeat = function(value) {
			if (!arguments.length) {
				return this._repeat;
			}
			this._repeat = value;
			return this._uncache(true);
		};
		
		p.repeatDelay = function(value) {
			if (!arguments.length) {
				return this._repeatDelay;
			}
			this._repeatDelay = value;
			return this._uncache(true);
		};
		
		p.yoyo = function(value) {
			if (!arguments.length) {
				return this._yoyo;
			}
			this._yoyo = value;
			return this;
		};
		
		
		return TweenMax;
		
	}, true);








/*
 * ----------------------------------------------------------------
 * TimelineLite
 * ----------------------------------------------------------------
 */
	window._gsDefine("TimelineLite", ["core.Animation","core.SimpleTimeline","TweenLite"], function(Animation, SimpleTimeline, TweenLite) {

		var TimelineLite = function(vars) {
				SimpleTimeline.call(this, vars);
				this._labels = {};
				this.autoRemoveChildren = (this.vars.autoRemoveChildren === true);
				this.smoothChildTiming = (this.vars.smoothChildTiming === true);
				this._sortChildren = true;
				this._onUpdate = this.vars.onUpdate;
				var v = this.vars,
					val, p;
				for (p in v) {
					val = v[p];
					if (val instanceof Array) if (val.join("").indexOf("{self}") !== -1) {
						v[p] = this._swapSelfInParams(val);
					}
				}
				if (v.tweens instanceof Array) {
					this.add(v.tweens, 0, v.align, v.stagger);
				}
			},
			_blankArray = [],
			_copy = function(vars) {
				var copy = {}, p;
				for (p in vars) {
					copy[p] = vars[p];
				}
				return copy;
			},
			_pauseCallback = function(tween, callback, params, scope) {
				tween._timeline.pause(tween._startTime);
				if (callback) {
					callback.apply(scope || tween._timeline, params || _blankArray);
				}
			},
			_slice = _blankArray.slice,
			p = TimelineLite.prototype = new SimpleTimeline();

		TimelineLite.version = "1.10.3";
		p.constructor = TimelineLite;
		p.kill()._gc = false;

		p.to = function(target, duration, vars, position) {
			return duration ? this.add( new TweenLite(target, duration, vars), position) : this.set(target, vars, position);
		};

		p.from = function(target, duration, vars, position) {
			return this.add( TweenLite.from(target, duration, vars), position);
		};

		p.fromTo = function(target, duration, fromVars, toVars, position) {
			return duration ? this.add( TweenLite.fromTo(target, duration, fromVars, toVars), position) : this.set(target, toVars, position);
		};

		p.staggerTo = function(targets, duration, vars, stagger, position, onCompleteAll, onCompleteAllParams, onCompleteAllScope) {
			var tl = new TimelineLite({onComplete:onCompleteAll, onCompleteParams:onCompleteAllParams, onCompleteScope:onCompleteAllScope}),
				i;
			if (typeof(targets) === "string") {
				targets = TweenLite.selector(targets) || targets;
			}
			if (!(targets instanceof Array) && targets.length && targets !== window && targets[0] && (targets[0] === window || (targets[0].nodeType && targets[0].style && !targets.nodeType))) { //senses if the targets object is a selector. If it is, we should translate it into an array.
				targets = _slice.call(targets, 0);
			}
			stagger = stagger || 0;
			for (i = 0; i < targets.length; i++) {
				if (vars.startAt) {
					vars.startAt = _copy(vars.startAt);
				}
				tl.to(targets[i], duration, _copy(vars), i * stagger);
			}
			return this.add(tl, position);
		};

		p.staggerFrom = function(targets, duration, vars, stagger, position, onCompleteAll, onCompleteAllParams, onCompleteAllScope) {
			vars.immediateRender = (vars.immediateRender != false);
			vars.runBackwards = true;
			return this.staggerTo(targets, duration, vars, stagger, position, onCompleteAll, onCompleteAllParams, onCompleteAllScope);
		};

		p.staggerFromTo = function(targets, duration, fromVars, toVars, stagger, position, onCompleteAll, onCompleteAllParams, onCompleteAllScope) {
			toVars.startAt = fromVars;
			toVars.immediateRender = (toVars.immediateRender != false && fromVars.immediateRender != false);
			return this.staggerTo(targets, duration, toVars, stagger, position, onCompleteAll, onCompleteAllParams, onCompleteAllScope);
		};

		p.call = function(callback, params, scope, position) {
			return this.add( TweenLite.delayedCall(0, callback, params, scope), position);
		};

		p.set = function(target, vars, position) {
			position = this._parseTimeOrLabel(position, 0, true);
			if (vars.immediateRender == null) {
				vars.immediateRender = (position === this._time && !this._paused);
			}
			return this.add( new TweenLite(target, 0, vars), position);
		};

		TimelineLite.exportRoot = function(vars, ignoreDelayedCalls) {
			vars = vars || {};
			if (vars.smoothChildTiming == null) {
				vars.smoothChildTiming = true;
			}
			var tl = new TimelineLite(vars),
				root = tl._timeline,
				tween, next;
			if (ignoreDelayedCalls == null) {
				ignoreDelayedCalls = true;
			}
			root._remove(tl, true);
			tl._startTime = 0;
			tl._rawPrevTime = tl._time = tl._totalTime = root._time;
			tween = root._first;
			while (tween) {
				next = tween._next;
				if (!ignoreDelayedCalls || !(tween instanceof TweenLite && tween.target === tween.vars.onComplete)) {
					tl.add(tween, tween._startTime - tween._delay);
				}
				tween = next;
			}
			root.add(tl, 0);
			return tl;
		};

		p.add = function(value, position, align, stagger) {
			var curTime, l, i, child, tl, beforeRawTime;
			if (typeof(position) !== "number") {
				position = this._parseTimeOrLabel(position, 0, true, value);
			}
			if (!(value instanceof Animation)) {
				if (value instanceof Array) {
					align = align || "normal";
					stagger = stagger || 0;
					curTime = position;
					l = value.length;
					for (i = 0; i < l; i++) {
						if ((child = value[i]) instanceof Array) {
							child = new TimelineLite({tweens:child});
						}
						this.add(child, curTime);
						if (typeof(child) !== "string" && typeof(child) !== "function") {
							if (align === "sequence") {
								curTime = child._startTime + (child.totalDuration() / child._timeScale);
							} else if (align === "start") {
								child._startTime -= child.delay();
							}
						}
						curTime += stagger;
					}
					return this._uncache(true);
				} else if (typeof(value) === "string") {
					return this.addLabel(value, position);
				} else if (typeof(value) === "function") {
					value = TweenLite.delayedCall(0, value);
				} else {
					throw("Cannot add " + value + " into the timeline; it is not a tween, timeline, function, or string.");
				}
			}

			SimpleTimeline.prototype.add.call(this, value, position);

			//if the timeline has already ended but the inserted tween/timeline extends the duration, we should enable this timeline again so that it renders properly.
			if (this._gc) if (!this._paused) if (this._duration < this.duration()) {
				//in case any of the anscestors had completed but should now be enabled...
				tl = this;
				beforeRawTime = (tl.rawTime() > value._startTime); //if the tween is placed on the timeline so that it starts BEFORE the current rawTime, we should align the playhead (move the timeline). This is because sometimes users will create a timeline, let it finish, and much later append a tween and expect it to run instead of jumping to its end state. While technically one could argue that it should jump to its end state, that's not what users intuitively expect.
				while (tl._gc && tl._timeline) {
					if (tl._timeline.smoothChildTiming && beforeRawTime) {
						tl.totalTime(tl._totalTime, true); //moves the timeline (shifts its startTime) if necessary, and also enables it.
					} else {
						tl._enabled(true, false);
					}
					tl = tl._timeline;
				}
			}

			return this;
		};

		p.remove = function(value) {
			if (value instanceof Animation) {
				return this._remove(value, false);
			} else if (value instanceof Array) {
				var i = value.length;
				while (--i > -1) {
					this.remove(value[i]);
				}
				return this;
			} else if (typeof(value) === "string") {
				return this.removeLabel(value);
			}
			return this.kill(null, value);
		};

		p._remove = function(tween, skipDisable) {
			SimpleTimeline.prototype._remove.call(this, tween, skipDisable);
			if (!this._last) {
				this._time = this._totalTime = 0;
			} else if (this._time > this._last._startTime) {
				this._time = this.duration();
				this._totalTime = this._totalDuration;
			}
			return this;
		};

		p.append = function(value, offsetOrLabel) {
			return this.add(value, this._parseTimeOrLabel(null, offsetOrLabel, true, value));
		};

		p.insert = p.insertMultiple = function(value, position, align, stagger) {
			return this.add(value, position || 0, align, stagger);
		};

		p.appendMultiple = function(tweens, offsetOrLabel, align, stagger) {
			return this.add(tweens, this._parseTimeOrLabel(null, offsetOrLabel, true, tweens), align, stagger);
		};

		p.addLabel = function(label, position) {
			this._labels[label] = this._parseTimeOrLabel(position);
			return this;
		};

		p.addPause = function(position, callback, params, scope) {
			return this.call(_pauseCallback, ["{self}", callback, params, scope], this, position);
		};

		p.removeLabel = function(label) {
			delete this._labels[label];
			return this;
		};

		p.getLabelTime = function(label) {
			return (this._labels[label] != null) ? this._labels[label] : -1;
		};

		p._parseTimeOrLabel = function(timeOrLabel, offsetOrLabel, appendIfAbsent, ignore) {
			var i;
			//if we're about to add a tween/timeline (or an array of them) that's already a child of this timeline, we should remove it first so that it doesn't contaminate the duration().
			if (ignore instanceof Animation && ignore.timeline === this) {
				this.remove(ignore);
			} else if (ignore instanceof Array) {
				i = ignore.length;
				while (--i > -1) {
					if (ignore[i] instanceof Animation && ignore[i].timeline === this) {
						this.remove(ignore[i]);
					}
				}
			}
			if (typeof(offsetOrLabel) === "string") {
				return this._parseTimeOrLabel(offsetOrLabel, (appendIfAbsent && typeof(timeOrLabel) === "number" && this._labels[offsetOrLabel] == null) ? timeOrLabel - this.duration() : 0, appendIfAbsent);
			}
			offsetOrLabel = offsetOrLabel || 0;
			if (typeof(timeOrLabel) === "string" && (isNaN(timeOrLabel) || this._labels[timeOrLabel] != null)) { //if the string is a number like "1", check to see if there's a label with that name, otherwise interpret it as a number (absolute value).
				i = timeOrLabel.indexOf("=");
				if (i === -1) {
					if (this._labels[timeOrLabel] == null) {
						return appendIfAbsent ? (this._labels[timeOrLabel] = this.duration() + offsetOrLabel) : offsetOrLabel;
					}
					return this._labels[timeOrLabel] + offsetOrLabel;
				}
				offsetOrLabel = parseInt(timeOrLabel.charAt(i-1) + "1", 10) * Number(timeOrLabel.substr(i+1));
				timeOrLabel = (i > 1) ? this._parseTimeOrLabel(timeOrLabel.substr(0, i-1), 0, appendIfAbsent) : this.duration();
			} else if (timeOrLabel == null) {
				timeOrLabel = this.duration();
			}
			return Number(timeOrLabel) + offsetOrLabel;
		};

		p.seek = function(position, suppressEvents) {
			return this.totalTime((typeof(position) === "number") ? position : this._parseTimeOrLabel(position), (suppressEvents !== false));
		};

		p.stop = function() {
			return this.paused(true);
		};

		p.gotoAndPlay = function(position, suppressEvents) {
			return this.play(position, suppressEvents);
		};

		p.gotoAndStop = function(position, suppressEvents) {
			return this.pause(position, suppressEvents);
		};

		p.render = function(time, suppressEvents, force) {
			if (this._gc) {
				this._enabled(true, false);
			}
			var totalDur = (!this._dirty) ? this._totalDuration : this.totalDuration(),
				prevTime = this._time,
				prevStart = this._startTime,
				prevTimeScale = this._timeScale,
				prevPaused = this._paused,
				tween, isComplete, next, callback, internalForce;
			if (time >= totalDur) {
				this._totalTime = this._time = totalDur;
				if (!this._reversed) if (!this._hasPausedChild()) {
					isComplete = true;
					callback = "onComplete";
					if (this._duration === 0) if (time === 0 || this._rawPrevTime < 0) if (this._rawPrevTime !== time && this._first) { //In order to accommodate zero-duration timelines, we must discern the momentum/direction of time in order to render values properly when the "playhead" goes past 0 in the forward direction or lands directly on it, and also when it moves past it in the backward direction (from a postitive time to a negative time).
						internalForce = true;
						if (this._rawPrevTime > 0) {
							callback = "onReverseComplete";
						}
					}
				}
				this._rawPrevTime = time;
				time = totalDur + 0.000001; //to avoid occasional floating point rounding errors - sometimes child tweens/timelines were not being fully completed (their progress might be 0.999999999999998 instead of 1 because when _time - tween._startTime is performed, floating point errors would return a value that was SLIGHTLY off)

			} else if (time < 0.0000001) { //to work around occasional floating point math artifacts, round super small values to 0.
				this._totalTime = this._time = 0;
				if (prevTime !== 0 || (this._duration === 0 && this._rawPrevTime > 0)) {
					callback = "onReverseComplete";
					isComplete = this._reversed;
				}
				if (time < 0) {
					this._active = false;
					if (this._duration === 0) if (this._rawPrevTime >= 0 && this._first) { //zero-duration timelines are tricky because we must discern the momentum/direction of time in order to determine whether the starting values should be rendered or the ending values. If the "playhead" of its timeline goes past the zero-duration tween in the forward direction or lands directly on it, the end values should be rendered, but if the timeline's "playhead" moves past it in the backward direction (from a postitive time to a negative time), the starting values must be rendered.
						internalForce = true;
					}
					this._rawPrevTime = time;
				} else {
					this._rawPrevTime = time;
					time = 0; //to avoid occasional floating point rounding errors (could cause problems especially with zero-duration tweens at the very beginning of the timeline)
					if (!this._initted) {
						internalForce = true;
					}
				}

			} else {
				this._totalTime = this._time = this._rawPrevTime = time;
			}
			if ((this._time === prevTime || !this._first) && !force && !internalForce) {
				return;
			} else if (!this._initted) {
				this._initted = true;
			}

			if (!this._active) if (!this._paused && this._time !== prevTime && time > 0) {
				this._active = true;  //so that if the user renders the timeline (as opposed to the parent timeline rendering it), it is forced to re-render and align it with the proper time/frame on the next rendering cycle. Maybe the timeline already finished but the user manually re-renders it as halfway done, for example.
			}

			if (prevTime === 0) if (this.vars.onStart) if (this._time !== 0) if (!suppressEvents) {
				this.vars.onStart.apply(this.vars.onStartScope || this, this.vars.onStartParams || _blankArray);
			}

			if (this._time >= prevTime) {
				tween = this._first;
				while (tween) {
					next = tween._next; //record it here because the value could change after rendering...
					if (this._paused && !prevPaused) { //in case a tween pauses the timeline when rendering
						break;
					} else if (tween._active || (tween._startTime <= this._time && !tween._paused && !tween._gc)) {

						if (!tween._reversed) {
							tween.render((time - tween._startTime) * tween._timeScale, suppressEvents, force);
						} else {
							tween.render(((!tween._dirty) ? tween._totalDuration : tween.totalDuration()) - ((time - tween._startTime) * tween._timeScale), suppressEvents, force);
						}

					}
					tween = next;
				}
			} else {
				tween = this._last;
				while (tween) {
					next = tween._prev; //record it here because the value could change after rendering...
					if (this._paused && !prevPaused) { //in case a tween pauses the timeline when rendering
						break;
					} else if (tween._active || (tween._startTime <= prevTime && !tween._paused && !tween._gc)) {

						if (!tween._reversed) {
							tween.render((time - tween._startTime) * tween._timeScale, suppressEvents, force);
						} else {
							tween.render(((!tween._dirty) ? tween._totalDuration : tween.totalDuration()) - ((time - tween._startTime) * tween._timeScale), suppressEvents, force);
						}

					}
					tween = next;
				}
			}

			if (this._onUpdate) if (!suppressEvents) {
				this._onUpdate.apply(this.vars.onUpdateScope || this, this.vars.onUpdateParams || _blankArray);
			}

			if (callback) if (!this._gc) if (prevStart === this._startTime || prevTimeScale !== this._timeScale) if (this._time === 0 || totalDur >= this.totalDuration()) { //if one of the tweens that was rendered altered this timeline's startTime (like if an onComplete reversed the timeline), it probably isn't complete. If it is, don't worry, because whatever call altered the startTime would complete if it was necessary at the new time. The only exception is the timeScale property. Also check _gc because there's a chance that kill() could be called in an onUpdate
				if (isComplete) {
					if (this._timeline.autoRemoveChildren) {
						this._enabled(false, false);
					}
					this._active = false;
				}
				if (!suppressEvents && this.vars[callback]) {
					this.vars[callback].apply(this.vars[callback + "Scope"] || this, this.vars[callback + "Params"] || _blankArray);
				}
			}
		};

		p._hasPausedChild = function() {
			var tween = this._first;
			while (tween) {
				if (tween._paused || ((tween instanceof TimelineLite) && tween._hasPausedChild())) {
					return true;
				}
				tween = tween._next;
			}
			return false;
		};

		p.getChildren = function(nested, tweens, timelines, ignoreBeforeTime) {
			ignoreBeforeTime = ignoreBeforeTime || -9999999999;
			var a = [],
				tween = this._first,
				cnt = 0;
			while (tween) {
				if (tween._startTime < ignoreBeforeTime) {
					//do nothing
				} else if (tween instanceof TweenLite) {
					if (tweens !== false) {
						a[cnt++] = tween;
					}
				} else {
					if (timelines !== false) {
						a[cnt++] = tween;
					}
					if (nested !== false) {
						a = a.concat(tween.getChildren(true, tweens, timelines));
						cnt = a.length;
					}
				}
				tween = tween._next;
			}
			return a;
		};

		p.getTweensOf = function(target, nested) {
			var tweens = TweenLite.getTweensOf(target),
				i = tweens.length,
				a = [],
				cnt = 0;
			while (--i > -1) {
				if (tweens[i].timeline === this || (nested && this._contains(tweens[i]))) {
					a[cnt++] = tweens[i];
				}
			}
			return a;
		};

		p._contains = function(tween) {
			var tl = tween.timeline;
			while (tl) {
				if (tl === this) {
					return true;
				}
				tl = tl.timeline;
			}
			return false;
		};

		p.shiftChildren = function(amount, adjustLabels, ignoreBeforeTime) {
			ignoreBeforeTime = ignoreBeforeTime || 0;
			var tween = this._first,
				labels = this._labels,
				p;
			while (tween) {
				if (tween._startTime >= ignoreBeforeTime) {
					tween._startTime += amount;
				}
				tween = tween._next;
			}
			if (adjustLabels) {
				for (p in labels) {
					if (labels[p] >= ignoreBeforeTime) {
						labels[p] += amount;
					}
				}
			}
			return this._uncache(true);
		};

		p._kill = function(vars, target) {
			if (!vars && !target) {
				return this._enabled(false, false);
			}
			var tweens = (!target) ? this.getChildren(true, true, false) : this.getTweensOf(target),
				i = tweens.length,
				changed = false;
			while (--i > -1) {
				if (tweens[i]._kill(vars, target)) {
					changed = true;
				}
			}
			return changed;
		};

		p.clear = function(labels) {
			var tweens = this.getChildren(false, true, true),
				i = tweens.length;
			this._time = this._totalTime = 0;
			while (--i > -1) {
				tweens[i]._enabled(false, false);
			}
			if (labels !== false) {
				this._labels = {};
			}
			return this._uncache(true);
		};

		p.invalidate = function() {
			var tween = this._first;
			while (tween) {
				tween.invalidate();
				tween = tween._next;
			}
			return this;
		};

		p._enabled = function(enabled, ignoreTimeline) {
			if (enabled === this._gc) {
				var tween = this._first;
				while (tween) {
					tween._enabled(enabled, true);
					tween = tween._next;
				}
			}
			return SimpleTimeline.prototype._enabled.call(this, enabled, ignoreTimeline);
		};

		p.progress = function(value) {
			return (!arguments.length) ? this._time / this.duration() : this.totalTime(this.duration() * value, false);
		};

		p.duration = function(value) {
			if (!arguments.length) {
				if (this._dirty) {
					this.totalDuration(); //just triggers recalculation
				}
				return this._duration;
			}
			if (this.duration() !== 0 && value !== 0) {
				this.timeScale(this._duration / value);
			}
			return this;
		};

		p.totalDuration = function(value) {
			if (!arguments.length) {
				if (this._dirty) {
					var max = 0,
						tween = this._last,
						prevStart = 999999999999,
						prev, end;
					while (tween) {
						prev = tween._prev; //record it here in case the tween changes position in the sequence...
						if (tween._dirty) {
							tween.totalDuration(); //could change the tween._startTime, so make sure the tween's cache is clean before analyzing it.
						}
						if (tween._startTime > prevStart && this._sortChildren && !tween._paused) { //in case one of the tweens shifted out of order, it needs to be re-inserted into the correct position in the sequence
							this.add(tween, tween._startTime - tween._delay);
						} else {
							prevStart = tween._startTime;
						}
						if (tween._startTime < 0 && !tween._paused) { //children aren't allowed to have negative startTimes unless smoothChildTiming is true, so adjust here if one is found.
							max -= tween._startTime;
							if (this._timeline.smoothChildTiming) {
								this._startTime += tween._startTime / this._timeScale;
							}
							this.shiftChildren(-tween._startTime, false, -9999999999);
							prevStart = 0;
						}
						end = tween._startTime + (tween._totalDuration / tween._timeScale);
						if (end > max) {
							max = end;
						}
						tween = prev;
					}
					this._duration = this._totalDuration = max;
					this._dirty = false;
				}
				return this._totalDuration;
			}
			if (this.totalDuration() !== 0) if (value !== 0) {
				this.timeScale(this._totalDuration / value);
			}
			return this;
		};

		p.usesFrames = function() {
			var tl = this._timeline;
			while (tl._timeline) {
				tl = tl._timeline;
			}
			return (tl === Animation._rootFramesTimeline);
		};

		p.rawTime = function() {
			return this._paused ? this._totalTime : (this._timeline.rawTime() - this._startTime) * this._timeScale;
		};

		return TimelineLite;

	}, true);
	







	
	
	
	
	
/*
 * ----------------------------------------------------------------
 * TimelineMax
 * ----------------------------------------------------------------
 */
	window._gsDefine("TimelineMax", ["TimelineLite","TweenLite","easing.Ease"], function(TimelineLite, TweenLite, Ease) {

		var TimelineMax = function(vars) {
				TimelineLite.call(this, vars);
				this._repeat = this.vars.repeat || 0;
				this._repeatDelay = this.vars.repeatDelay || 0;
				this._cycle = 0;
				this._yoyo = (this.vars.yoyo === true);
				this._dirty = true;
			},
			_blankArray = [],
			_easeNone = new Ease(null, null, 1, 0),
			_getGlobalPaused = function(tween) {
				while (tween) {
					if (tween._paused) {
						return true;
					}
					tween = tween._timeline;
				}
				return false;
			},
			p = TimelineMax.prototype = new TimelineLite();

		p.constructor = TimelineMax;
		p.kill()._gc = false;
		TimelineMax.version = "1.10.3";

		p.invalidate = function() {
			this._yoyo = (this.vars.yoyo === true);
			this._repeat = this.vars.repeat || 0;
			this._repeatDelay = this.vars.repeatDelay || 0;
			this._uncache(true);
			return TimelineLite.prototype.invalidate.call(this);
		};

		p.addCallback = function(callback, position, params, scope) {
			return this.add( TweenLite.delayedCall(0, callback, params, scope), position);
		};

		p.removeCallback = function(callback, position) {
			if (callback) {
				if (position == null) {
					this._kill(null, callback);
				} else {
					var a = this.getTweensOf(callback, false),
						i = a.length,
						time = this._parseTimeOrLabel(position);
					while (--i > -1) {
						if (a[i]._startTime === time) {
							a[i]._enabled(false, false);
						}
					}
				}
			}
			return this;
		};

		p.tweenTo = function(position, vars) {
			vars = vars || {};
			var copy = {ease:_easeNone, overwrite:2, useFrames:this.usesFrames(), immediateRender:false}, p, t;
			for (p in vars) {
				copy[p] = vars[p];
			}
			copy.time = this._parseTimeOrLabel(position);
			t = new TweenLite(this, (Math.abs(Number(copy.time) - this._time) / this._timeScale) || 0.001, copy);
			copy.onStart = function() {
				t.target.paused(true);
				if (t.vars.time !== t.target.time()) { //don't make the duration zero - if it's supposed to be zero, don't worry because it's already initting the tween and will complete immediately, effectively making the duration zero anyway. If we make duration zero, the tween won't run at all.
					t.duration( Math.abs( t.vars.time - t.target.time()) / t.target._timeScale );
				}
				if (vars.onStart) { //in case the user had an onStart in the vars - we don't want to overwrite it.
					vars.onStart.apply(vars.onStartScope || t, vars.onStartParams || _blankArray);
				}
			};
			return t;
		};

		p.tweenFromTo = function(fromPosition, toPosition, vars) {
			vars = vars || {};
			fromPosition = this._parseTimeOrLabel(fromPosition);
			vars.startAt = {onComplete:this.seek, onCompleteParams:[fromPosition], onCompleteScope:this};
			vars.immediateRender = (vars.immediateRender !== false);
			var t = this.tweenTo(toPosition, vars);
			return t.duration((Math.abs( t.vars.time - fromPosition) / this._timeScale) || 0.001);
		};

		p.render = function(time, suppressEvents, force) {
			if (this._gc) {
				this._enabled(true, false);
			}
			var totalDur = (!this._dirty) ? this._totalDuration : this.totalDuration(),
				dur = this._duration,
				prevTime = this._time,
				prevTotalTime = this._totalTime,
				prevStart = this._startTime,
				prevTimeScale = this._timeScale,
				prevRawPrevTime = this._rawPrevTime,
				prevPaused = this._paused,
				prevCycle = this._cycle,
				tween, isComplete, next, callback, internalForce, cycleDuration;
			if (time >= totalDur) {
				if (!this._locked) {
					this._totalTime = totalDur;
					this._cycle = this._repeat;
				}
				if (!this._reversed) if (!this._hasPausedChild()) {
					isComplete = true;
					callback = "onComplete";
					if (dur === 0) if (time === 0 || this._rawPrevTime < 0) if (this._rawPrevTime !== time && this._first) { //In order to accommodate zero-duration timelines, we must discern the momentum/direction of time in order to render values properly when the "playhead" goes past 0 in the forward direction or lands directly on it, and also when it moves past it in the backward direction (from a postitive time to a negative time).
						internalForce = true;
						if (this._rawPrevTime > 0) {
							callback = "onReverseComplete";
						}
					}
				}
				this._rawPrevTime = time;
				if (this._yoyo && (this._cycle & 1) !== 0) {
					this._time = time = 0;
				} else {
					this._time = dur;
					time = dur + 0.000001; //to avoid occasional floating point rounding errors
				}

			} else if (time < 0.0000001) { //to work around occasional floating point math artifacts, round super small values to 0.
				if (!this._locked) {
					this._totalTime = this._cycle = 0;
				}
				this._time = 0;
				if (prevTime !== 0 || (dur === 0 && this._rawPrevTime > 0 && !this._locked)) {
					callback = "onReverseComplete";
					isComplete = this._reversed;
				}
				if (time < 0) {
					this._active = false;
					if (dur === 0) if (this._rawPrevTime >= 0 && this._first) { //zero-duration timelines are tricky because we must discern the momentum/direction of time in order to determine whether the starting values should be rendered or the ending values. If the "playhead" of its timeline goes past the zero-duration tween in the forward direction or lands directly on it, the end values should be rendered, but if the timeline's "playhead" moves past it in the backward direction (from a postitive time to a negative time), the starting values must be rendered.
						internalForce = true;
					}
					this._rawPrevTime = time;
				} else {
					this._rawPrevTime = time;
					time = 0; //to avoid occasional floating point rounding errors (could cause problems especially with zero-duration tweens at the very beginning of the timeline)
					if (!this._initted) {
						internalForce = true;
					}
				}

			} else {
				this._time = this._rawPrevTime = time;
				if (!this._locked) {
					this._totalTime = time;
					if (this._repeat !== 0) {
						cycleDuration = dur + this._repeatDelay;
						this._cycle = (this._totalTime / cycleDuration) >> 0; //originally _totalTime % cycleDuration but floating point errors caused problems, so I normalized it. (4 % 0.8 should be 0 but it gets reported as 0.79999999!)
						if (this._cycle !== 0) if (this._cycle === this._totalTime / cycleDuration) {
							this._cycle--; //otherwise when rendered exactly at the end time, it will act as though it is repeating (at the beginning)
						}
						this._time = this._totalTime - (this._cycle * cycleDuration);
						if (this._yoyo) if ((this._cycle & 1) !== 0) {
							this._time = dur - this._time;
						}
						if (this._time > dur) {
							this._time = dur;
							time = dur + 0.000001; //to avoid occasional floating point rounding error
						} else if (this._time < 0) {
							this._time = time = 0;
						} else {
							time = this._time;
						}
					}
				}
			}

			if (this._cycle !== prevCycle) if (!this._locked) {
				/*
				make sure children at the end/beginning of the timeline are rendered properly. If, for example,
				a 3-second long timeline rendered at 2.9 seconds previously, and now renders at 3.2 seconds (which
				would get transated to 2.8 seconds if the timeline yoyos or 0.2 seconds if it just repeats), there
				could be a callback or a short tween that's at 2.95 or 3 seconds in which wouldn't render. So
				we need to push the timeline to the end (and/or beginning depending on its yoyo value). Also we must
				ensure that zero-duration tweens at the very beginning or end of the TimelineMax work.
				*/
				var backwards = (this._yoyo && (prevCycle & 1) !== 0),
					wrap = (backwards === (this._yoyo && (this._cycle & 1) !== 0)),
					recTotalTime = this._totalTime,
					recCycle = this._cycle,
					recRawPrevTime = this._rawPrevTime,
					recTime = this._time;

				this._totalTime = prevCycle * dur;
				if (this._cycle < prevCycle) {
					backwards = !backwards;
				} else {
					this._totalTime += dur;
				}
				this._time = prevTime; //temporarily revert _time so that render() renders the children in the correct order. Without this, tweens won't rewind correctly. We could arhictect things in a "cleaner" way by splitting out the rendering queue into a separate method but for performance reasons, we kept it all inside this method.

				this._rawPrevTime = (dur === 0) ? prevRawPrevTime - 0.00001 : prevRawPrevTime;
				this._cycle = prevCycle;
				this._locked = true; //prevents changes to totalTime and skips repeat/yoyo behavior when we recursively call render()
				prevTime = (backwards) ? 0 : dur;
				this.render(prevTime, suppressEvents, (dur === 0));
				if (!suppressEvents) if (!this._gc) {
					if (this.vars.onRepeat) {
						this.vars.onRepeat.apply(this.vars.onRepeatScope || this, this.vars.onRepeatParams || _blankArray);
					}
				}
				if (wrap) {
					prevTime = (backwards) ? dur + 0.000001 : -0.000001;
					this.render(prevTime, true, false);
				}
				this._locked = false;
				if (this._paused && !prevPaused) { //if the render() triggered callback that paused this timeline, we should abort (very rare, but possible)
					return;
				}
				this._time = recTime;
				this._totalTime = recTotalTime;
				this._cycle = recCycle;
				this._rawPrevTime = recRawPrevTime;
			}

			if ((this._time === prevTime || !this._first) && !force && !internalForce) {
				if (prevTotalTime !== this._totalTime) if (this._onUpdate) if (!suppressEvents) { //so that onUpdate fires even during the repeatDelay - as long as the totalTime changed, we should trigger onUpdate.
					this._onUpdate.apply(this.vars.onUpdateScope || this, this.vars.onUpdateParams || _blankArray);
				}
				return;
			} else if (!this._initted) {
				this._initted = true;
			}

			if (!this._active) if (!this._paused && this._totalTime !== prevTotalTime && time > 0) {
				this._active = true;  //so that if the user renders the timeline (as opposed to the parent timeline rendering it), it is forced to re-render and align it with the proper time/frame on the next rendering cycle. Maybe the timeline already finished but the user manually re-renders it as halfway done, for example.
			}

			if (prevTotalTime === 0) if (this.vars.onStart) if (this._totalTime !== 0) if (!suppressEvents) {
				this.vars.onStart.apply(this.vars.onStartScope || this, this.vars.onStartParams || _blankArray);
			}

			if (this._time >= prevTime) {
				tween = this._first;
				while (tween) {
					next = tween._next; //record it here because the value could change after rendering...
					if (this._paused && !prevPaused) { //in case a tween pauses the timeline when rendering
						break;
					} else if (tween._active || (tween._startTime <= this._time && !tween._paused && !tween._gc)) {
						if (!tween._reversed) {
							tween.render((time - tween._startTime) * tween._timeScale, suppressEvents, force);
						} else {
							tween.render(((!tween._dirty) ? tween._totalDuration : tween.totalDuration()) - ((time - tween._startTime) * tween._timeScale), suppressEvents, force);
						}

					}
					tween = next;
				}
			} else {
				tween = this._last;
				while (tween) {
					next = tween._prev; //record it here because the value could change after rendering...
					if (this._paused && !prevPaused) { //in case a tween pauses the timeline when rendering
						break;
					} else if (tween._active || (tween._startTime <= prevTime && !tween._paused && !tween._gc)) {
						if (!tween._reversed) {
							tween.render((time - tween._startTime) * tween._timeScale, suppressEvents, force);
						} else {
							tween.render(((!tween._dirty) ? tween._totalDuration : tween.totalDuration()) - ((time - tween._startTime) * tween._timeScale), suppressEvents, force);
						}

					}
					tween = next;
				}
			}

			if (this._onUpdate) if (!suppressEvents) {
				this._onUpdate.apply(this.vars.onUpdateScope || this, this.vars.onUpdateParams || _blankArray);
			}
			if (callback) if (!this._locked) if (!this._gc) if (prevStart === this._startTime || prevTimeScale !== this._timeScale) if (this._time === 0 || totalDur >= this.totalDuration()) { //if one of the tweens that was rendered altered this timeline's startTime (like if an onComplete reversed the timeline), it probably isn't complete. If it is, don't worry, because whatever call altered the startTime would complete if it was necessary at the new time. The only exception is the timeScale property. Also check _gc because there's a chance that kill() could be called in an onUpdate
				if (isComplete) {
					if (this._timeline.autoRemoveChildren) {
						this._enabled(false, false);
					}
					this._active = false;
				}
				if (!suppressEvents && this.vars[callback]) {
					this.vars[callback].apply(this.vars[callback + "Scope"] || this, this.vars[callback + "Params"] || _blankArray);
				}
			}
		};

		p.getActive = function(nested, tweens, timelines) {
			if (nested == null) {
				nested = true;
			}
			if (tweens == null) {
				tweens = true;
			}
			if (timelines == null) {
				timelines = false;
			}
			var a = [],
				all = this.getChildren(nested, tweens, timelines),
				cnt = 0,
				l = all.length,
				i, tween;
			for (i = 0; i < l; i++) {
				tween = all[i];
				//note: we cannot just check tween.active because timelines that contain paused children will continue to have "active" set to true even after the playhead passes their end point (technically a timeline can only be considered complete after all of its children have completed too, but paused tweens are...well...just waiting and until they're unpaused we don't know where their end point will be).
				if (!tween._paused) if (tween._timeline._time >= tween._startTime) if (tween._timeline._time < tween._startTime + tween._totalDuration / tween._timeScale) if (!_getGlobalPaused(tween._timeline)) {
					a[cnt++] = tween;
				}
			}
			return a;
		};


		p.getLabelAfter = function(time) {
			if (!time) if (time !== 0) { //faster than isNan()
				time = this._time;
			}
			var labels = this.getLabelsArray(),
				l = labels.length,
				i;
			for (i = 0; i < l; i++) {
				if (labels[i].time > time) {
					return labels[i].name;
				}
			}
			return null;
		};

		p.getLabelBefore = function(time) {
			if (time == null) {
				time = this._time;
			}
			var labels = this.getLabelsArray(),
				i = labels.length;
			while (--i > -1) {
				if (labels[i].time < time) {
					return labels[i].name;
				}
			}
			return null;
		};

		p.getLabelsArray = function() {
			var a = [],
				cnt = 0,
				p;
			for (p in this._labels) {
				a[cnt++] = {time:this._labels[p], name:p};
			}
			a.sort(function(a,b) {
				return a.time - b.time;
			});
			return a;
		};


//---- GETTERS / SETTERS -------------------------------------------------------------------------------------------------------

		p.progress = function(value) {
			return (!arguments.length) ? this._time / this.duration() : this.totalTime( this.duration() * ((this._yoyo && (this._cycle & 1) !== 0) ? 1 - value : value) + (this._cycle * (this._duration + this._repeatDelay)), false);
		};

		p.totalProgress = function(value) {
			return (!arguments.length) ? this._totalTime / this.totalDuration() : this.totalTime( this.totalDuration() * value, false);
		};

		p.totalDuration = function(value) {
			if (!arguments.length) {
				if (this._dirty) {
					TimelineLite.prototype.totalDuration.call(this); //just forces refresh
					//Instead of Infinity, we use 999999999999 so that we can accommodate reverses.
					this._totalDuration = (this._repeat === -1) ? 999999999999 : this._duration * (this._repeat + 1) + (this._repeatDelay * this._repeat);
				}
				return this._totalDuration;
			}
			return (this._repeat === -1) ? this : this.duration( (value - (this._repeat * this._repeatDelay)) / (this._repeat + 1) );
		};

		p.time = function(value, suppressEvents) {
			if (!arguments.length) {
				return this._time;
			}
			if (this._dirty) {
				this.totalDuration();
			}
			if (value > this._duration) {
				value = this._duration;
			}
			if (this._yoyo && (this._cycle & 1) !== 0) {
				value = (this._duration - value) + (this._cycle * (this._duration + this._repeatDelay));
			} else if (this._repeat !== 0) {
				value += this._cycle * (this._duration + this._repeatDelay);
			}
			return this.totalTime(value, suppressEvents);
		};

		p.repeat = function(value) {
			if (!arguments.length) {
				return this._repeat;
			}
			this._repeat = value;
			return this._uncache(true);
		};

		p.repeatDelay = function(value) {
			if (!arguments.length) {
				return this._repeatDelay;
			}
			this._repeatDelay = value;
			return this._uncache(true);
		};

		p.yoyo = function(value) {
			if (!arguments.length) {
				return this._yoyo;
			}
			this._yoyo = value;
			return this;
		};

		p.currentLabel = function(value) {
			if (!arguments.length) {
				return this.getLabelBefore(this._time + 0.00000001);
			}
			return this.seek(value, true);
		};

		return TimelineMax;

	}, true);
	




	
	
	
	
	
	
	
/*
 * ----------------------------------------------------------------
 * BezierPlugin
 * ----------------------------------------------------------------
 */
	(function() {

		var _RAD2DEG = 180 / Math.PI,
			_DEG2RAD = Math.PI / 180,
			_r1 = [],
			_r2 = [],
			_r3 = [],
			_corProps = {},
			Segment = function(a, b, c, d) {
				this.a = a;
				this.b = b;
				this.c = c;
				this.d = d;
				this.da = d - a;
				this.ca = c - a;
				this.ba = b - a;
			},
			_correlate = ",x,y,z,left,top,right,bottom,marginTop,marginLeft,marginRight,marginBottom,paddingLeft,paddingTop,paddingRight,paddingBottom,backgroundPosition,backgroundPosition_y,",
			cubicToQuadratic = function(a, b, c, d) {
				var q1 = {a:a},
					q2 = {},
					q3 = {},
					q4 = {c:d},
					mab = (a + b) / 2,
					mbc = (b + c) / 2,
					mcd = (c + d) / 2,
					mabc = (mab + mbc) / 2,
					mbcd = (mbc + mcd) / 2,
					m8 = (mbcd - mabc) / 8;
				q1.b = mab + (a - mab) / 4;
				q2.b = mabc + m8;
				q1.c = q2.a = (q1.b + q2.b) / 2;
				q2.c = q3.a = (mabc + mbcd) / 2;
				q3.b = mbcd - m8;
				q4.b = mcd + (d - mcd) / 4;
				q3.c = q4.a = (q3.b + q4.b) / 2;
				return [q1, q2, q3, q4];
			},
			_calculateControlPoints = function(a, curviness, quad, basic, correlate) {
				var l = a.length - 1,
					ii = 0,
					cp1 = a[0].a,
					i, p1, p2, p3, seg, m1, m2, mm, cp2, qb, r1, r2, tl;
				for (i = 0; i < l; i++) {
					seg = a[ii];
					p1 = seg.a;
					p2 = seg.d;
					p3 = a[ii+1].d;

					if (correlate) {
						r1 = _r1[i];
						r2 = _r2[i];
						tl = ((r2 + r1) * curviness * 0.25) / (basic ? 0.5 : _r3[i] || 0.5);
						m1 = p2 - (p2 - p1) * (basic ? curviness * 0.5 : (r1 !== 0 ? tl / r1 : 0));
						m2 = p2 + (p3 - p2) * (basic ? curviness * 0.5 : (r2 !== 0 ? tl / r2 : 0));
						mm = p2 - (m1 + (((m2 - m1) * ((r1 * 3 / (r1 + r2)) + 0.5) / 4) || 0));
					} else {
						m1 = p2 - (p2 - p1) * curviness * 0.5;
						m2 = p2 + (p3 - p2) * curviness * 0.5;
						mm = p2 - (m1 + m2) / 2;
					}
					m1 += mm;
					m2 += mm;

					seg.c = cp2 = m1;
					if (i !== 0) {
						seg.b = cp1;
					} else {
						seg.b = cp1 = seg.a + (seg.c - seg.a) * 0.6; //instead of placing b on a exactly, we move it inline with c so that if the user specifies an ease like Back.easeIn or Elastic.easeIn which goes BEYOND the beginning, it will do so smoothly.
					}

					seg.da = p2 - p1;
					seg.ca = cp2 - p1;
					seg.ba = cp1 - p1;

					if (quad) {
						qb = cubicToQuadratic(p1, cp1, cp2, p2);
						a.splice(ii, 1, qb[0], qb[1], qb[2], qb[3]);
						ii += 4;
					} else {
						ii++;
					}

					cp1 = m2;
				}
				seg = a[ii];
				seg.b = cp1;
				seg.c = cp1 + (seg.d - cp1) * 0.4; //instead of placing c on d exactly, we move it inline with b so that if the user specifies an ease like Back.easeOut or Elastic.easeOut which goes BEYOND the end, it will do so smoothly.
				seg.da = seg.d - seg.a;
				seg.ca = seg.c - seg.a;
				seg.ba = cp1 - seg.a;
				if (quad) {
					qb = cubicToQuadratic(seg.a, cp1, seg.c, seg.d);
					a.splice(ii, 1, qb[0], qb[1], qb[2], qb[3]);
				}
			},
			_parseAnchors = function(values, p, correlate, prepend) {
				var a = [],
					l, i, p1, p2, p3, tmp;
				if (prepend) {
					values = [prepend].concat(values);
					i = values.length;
					while (--i > -1) {
						if (typeof( (tmp = values[i][p]) ) === "string") if (tmp.charAt(1) === "=") {
							values[i][p] = prepend[p] + Number(tmp.charAt(0) + tmp.substr(2)); //accommodate relative values. Do it inline instead of breaking it out into a function for speed reasons
						}
					}
				}
				l = values.length - 2;
				if (l < 0) {
					a[0] = new Segment(values[0][p], 0, 0, values[(l < -1) ? 0 : 1][p]);
					return a;
				}
				for (i = 0; i < l; i++) {
					p1 = values[i][p];
					p2 = values[i+1][p];
					a[i] = new Segment(p1, 0, 0, p2);
					if (correlate) {
						p3 = values[i+2][p];
						_r1[i] = (_r1[i] || 0) + (p2 - p1) * (p2 - p1);
						_r2[i] = (_r2[i] || 0) + (p3 - p2) * (p3 - p2);
					}
				}
				a[i] = new Segment(values[i][p], 0, 0, values[i+1][p]);
				return a;
			},
			bezierThrough = function(values, curviness, quadratic, basic, correlate, prepend) {
				var obj = {},
					props = [],
					first = prepend || values[0],
					i, p, a, j, r, l, seamless, last;
				correlate = (typeof(correlate) === "string") ? ","+correlate+"," : _correlate;
				if (curviness == null) {
					curviness = 1;
				}
				for (p in values[0]) {
					props.push(p);
				}
				//check to see if the last and first values are identical (well, within 0.05). If so, make seamless by appending the second element to the very end of the values array and the 2nd-to-last element to the very beginning (we'll remove those segments later)
				if (values.length > 1) {
					last = values[values.length - 1];
					seamless = true;
					i = props.length;
					while (--i > -1) {
						p = props[i];
						if (Math.abs(first[p] - last[p]) > 0.05) { //build in a tolerance of +/-0.05 to accommodate rounding errors. For example, if you set an object's position to 4.945, Flash will make it 4.9
							seamless = false;
							break;
						}
					}
					if (seamless) {
						values = values.concat(); //duplicate the array to avoid contaminating the original which the user may be reusing for other tweens
						if (prepend) {
							values.unshift(prepend);
						}
						values.push(values[1]);
						prepend = values[values.length - 3];
					}
				}
				_r1.length = _r2.length = _r3.length = 0;
				i = props.length;
				while (--i > -1) {
					p = props[i];
					_corProps[p] = (correlate.indexOf(","+p+",") !== -1);
					obj[p] = _parseAnchors(values, p, _corProps[p], prepend);
				}
				i = _r1.length;
				while (--i > -1) {
					_r1[i] = Math.sqrt(_r1[i]);
					_r2[i] = Math.sqrt(_r2[i]);
				}
				if (!basic) {
					i = props.length;
					while (--i > -1) {
						if (_corProps[p]) {
							a = obj[props[i]];
							l = a.length - 1;
							for (j = 0; j < l; j++) {
								r = a[j+1].da / _r2[j] + a[j].da / _r1[j];
								_r3[j] = (_r3[j] || 0) + r * r;
							}
						}
					}
					i = _r3.length;
					while (--i > -1) {
						_r3[i] = Math.sqrt(_r3[i]);
					}
				}
				i = props.length;
				j = quadratic ? 4 : 1;
				while (--i > -1) {
					p = props[i];
					a = obj[p];
					_calculateControlPoints(a, curviness, quadratic, basic, _corProps[p]); //this method requires that _parseAnchors() and _setSegmentRatios() ran first so that _r1, _r2, and _r3 values are populated for all properties
					if (seamless) {
						a.splice(0, j);
						a.splice(a.length - j, j);
					}
				}
				return obj;
			},
			_parseBezierData = function(values, type, prepend) {
				type = type || "soft";
				var obj = {},
					inc = (type === "cubic") ? 3 : 2,
					soft = (type === "soft"),
					props = [],
					a, b, c, d, cur, i, j, l, p, cnt, tmp;
				if (soft && prepend) {
					values = [prepend].concat(values);
				}
				if (values == null || values.length < inc + 1) { throw "invalid Bezier data"; }
				for (p in values[0]) {
					props.push(p);
				}
				i = props.length;
				while (--i > -1) {
					p = props[i];
					obj[p] = cur = [];
					cnt = 0;
					l = values.length;
					for (j = 0; j < l; j++) {
						a = (prepend == null) ? values[j][p] : (typeof( (tmp = values[j][p]) ) === "string" && tmp.charAt(1) === "=") ? prepend[p] + Number(tmp.charAt(0) + tmp.substr(2)) : Number(tmp);
						if (soft) if (j > 1) if (j < l - 1) {
							cur[cnt++] = (a + cur[cnt-2]) / 2;
						}
						cur[cnt++] = a;
					}
					l = cnt - inc + 1;
					cnt = 0;
					for (j = 0; j < l; j += inc) {
						a = cur[j];
						b = cur[j+1];
						c = cur[j+2];
						d = (inc === 2) ? 0 : cur[j+3];
						cur[cnt++] = tmp = (inc === 3) ? new Segment(a, b, c, d) : new Segment(a, (2 * b + a) / 3, (2 * b + c) / 3, c);
					}
					cur.length = cnt;
				}
				return obj;
			},
			_addCubicLengths = function(a, steps, resolution) {
				var inc = 1 / resolution,
					j = a.length,
					d, d1, s, da, ca, ba, p, i, inv, bez, index;
				while (--j > -1) {
					bez = a[j];
					s = bez.a;
					da = bez.d - s;
					ca = bez.c - s;
					ba = bez.b - s;
					d = d1 = 0;
					for (i = 1; i <= resolution; i++) {
						p = inc * i;
						inv = 1 - p;
						d = d1 - (d1 = (p * p * da + 3 * inv * (p * ca + inv * ba)) * p);
						index = j * resolution + i - 1;
						steps[index] = (steps[index] || 0) + d * d;
					}
				}
			},
			_parseLengthData = function(obj, resolution) {
				resolution = resolution >> 0 || 6;
				var a = [],
					lengths = [],
					d = 0,
					total = 0,
					threshold = resolution - 1,
					segments = [],
					curLS = [], //current length segments array
					p, i, l, index;
				for (p in obj) {
					_addCubicLengths(obj[p], a, resolution);
				}
				l = a.length;
				for (i = 0; i < l; i++) {
					d += Math.sqrt(a[i]);
					index = i % resolution;
					curLS[index] = d;
					if (index === threshold) {
						total += d;
						index = (i / resolution) >> 0;
						segments[index] = curLS;
						lengths[index] = total;
						d = 0;
						curLS = [];
					}
				}
				return {length:total, lengths:lengths, segments:segments};
			},



			BezierPlugin = window._gsDefine.plugin({
					propName: "bezier",
					priority: -1,
					API: 2,
					global:true,

					//gets called when the tween renders for the first time. This is where initial values should be recorded and any setup routines should run.
					init: function(target, vars, tween) {
						this._target = target;
						if (vars instanceof Array) {
							vars = {values:vars};
						}
						this._func = {};
						this._round = {};
						this._props = [];
						this._timeRes = (vars.timeResolution == null) ? 6 : parseInt(vars.timeResolution, 10);
						var values = vars.values || [],
							first = {},
							second = values[0],
							autoRotate = vars.autoRotate || tween.vars.orientToBezier,
							p, isFunc, i, j, prepend;

						this._autoRotate = autoRotate ? (autoRotate instanceof Array) ? autoRotate : [["x","y","rotation",((autoRotate === true) ? 0 : Number(autoRotate) || 0)]] : null;
						for (p in second) {
							this._props.push(p);
						}

						i = this._props.length;
						while (--i > -1) {
							p = this._props[i];

							this._overwriteProps.push(p);
							isFunc = this._func[p] = (typeof(target[p]) === "function");
							first[p] = (!isFunc) ? parseFloat(target[p]) : target[ ((p.indexOf("set") || typeof(target["get" + p.substr(3)]) !== "function") ? p : "get" + p.substr(3)) ]();
							if (!prepend) if (first[p] !== values[0][p]) {
								prepend = first;
							}
						}
						this._beziers = (vars.type !== "cubic" && vars.type !== "quadratic" && vars.type !== "soft") ? bezierThrough(values, isNaN(vars.curviness) ? 1 : vars.curviness, false, (vars.type === "thruBasic"), vars.correlate, prepend) : _parseBezierData(values, vars.type, first);
						this._segCount = this._beziers[p].length;

						if (this._timeRes) {
							var ld = _parseLengthData(this._beziers, this._timeRes);
							this._length = ld.length;
							this._lengths = ld.lengths;
							this._segments = ld.segments;
							this._l1 = this._li = this._s1 = this._si = 0;
							this._l2 = this._lengths[0];
							this._curSeg = this._segments[0];
							this._s2 = this._curSeg[0];
							this._prec = 1 / this._curSeg.length;
						}

						if ((autoRotate = this._autoRotate)) {
							if (!(autoRotate[0] instanceof Array)) {
								this._autoRotate = autoRotate = [autoRotate];
							}
							i = autoRotate.length;
							while (--i > -1) {
								for (j = 0; j < 3; j++) {
									p = autoRotate[i][j];
									this._func[p] = (typeof(target[p]) === "function") ? target[ ((p.indexOf("set") || typeof(target["get" + p.substr(3)]) !== "function") ? p : "get" + p.substr(3)) ] : false;
								}
							}
						}
						return true;
					},

					//called each time the values should be updated, and the ratio gets passed as the only parameter (typically it's a value between 0 and 1, but it can exceed those when using an ease like Elastic.easeOut or Back.easeOut, etc.)
					set: function(v) {
						var segments = this._segCount,
							func = this._func,
							target = this._target,
							curIndex, inv, i, p, b, t, val, l, lengths, curSeg;
						if (!this._timeRes) {
							curIndex = (v < 0) ? 0 : (v >= 1) ? segments - 1 : (segments * v) >> 0;
							t = (v - (curIndex * (1 / segments))) * segments;
						} else {
							lengths = this._lengths;
							curSeg = this._curSeg;
							v *= this._length;
							i = this._li;
							//find the appropriate segment (if the currently cached one isn't correct)
							if (v > this._l2 && i < segments - 1) {
								l = segments - 1;
								while (i < l && (this._l2 = lengths[++i]) <= v) {	}
								this._l1 = lengths[i-1];
								this._li = i;
								this._curSeg = curSeg = this._segments[i];
								this._s2 = curSeg[(this._s1 = this._si = 0)];
							} else if (v < this._l1 && i > 0) {
								while (i > 0 && (this._l1 = lengths[--i]) >= v) { }
								if (i === 0 && v < this._l1) {
									this._l1 = 0;
								} else {
									i++;
								}
								this._l2 = lengths[i];
								this._li = i;
								this._curSeg = curSeg = this._segments[i];
								this._s1 = curSeg[(this._si = curSeg.length - 1) - 1] || 0;
								this._s2 = curSeg[this._si];
							}
							curIndex = i;
							//now find the appropriate sub-segment (we split it into the number of pieces that was defined by "precision" and measured each one)
							v -= this._l1;
							i = this._si;
							if (v > this._s2 && i < curSeg.length - 1) {
								l = curSeg.length - 1;
								while (i < l && (this._s2 = curSeg[++i]) <= v) {	}
								this._s1 = curSeg[i-1];
								this._si = i;
							} else if (v < this._s1 && i > 0) {
								while (i > 0 && (this._s1 = curSeg[--i]) >= v) {	}
								if (i === 0 && v < this._s1) {
									this._s1 = 0;
								} else {
									i++;
								}
								this._s2 = curSeg[i];
								this._si = i;
							}
							t = (i + (v - this._s1) / (this._s2 - this._s1)) * this._prec;
						}
						inv = 1 - t;

						i = this._props.length;
						while (--i > -1) {
							p = this._props[i];
							b = this._beziers[p][curIndex];
							val = (t * t * b.da + 3 * inv * (t * b.ca + inv * b.ba)) * t + b.a;
							if (this._round[p]) {
								val = (val + ((val > 0) ? 0.5 : -0.5)) >> 0;
							}
							if (func[p]) {
								target[p](val);
							} else {
								target[p] = val;
							}
						}

						if (this._autoRotate) {
							var ar = this._autoRotate,
								b2, x1, y1, x2, y2, add, conv;
							i = ar.length;
							while (--i > -1) {
								p = ar[i][2];
								add = ar[i][3] || 0;
								conv = (ar[i][4] === true) ? 1 : _RAD2DEG;
								b = this._beziers[ar[i][0]];
								b2 = this._beziers[ar[i][1]];

								if (b && b2) { //in case one of the properties got overwritten.
									b = b[curIndex];
									b2 = b2[curIndex];

									x1 = b.a + (b.b - b.a) * t;
									x2 = b.b + (b.c - b.b) * t;
									x1 += (x2 - x1) * t;
									x2 += ((b.c + (b.d - b.c) * t) - x2) * t;

									y1 = b2.a + (b2.b - b2.a) * t;
									y2 = b2.b + (b2.c - b2.b) * t;
									y1 += (y2 - y1) * t;
									y2 += ((b2.c + (b2.d - b2.c) * t) - y2) * t;

									val = Math.atan2(y2 - y1, x2 - x1) * conv + add;

									if (func[p]) {
										target[p](val);
									} else {
										target[p] = val;
									}
								}
							}
						}
					}
			}),
			p = BezierPlugin.prototype;


		BezierPlugin.bezierThrough = bezierThrough;
		BezierPlugin.cubicToQuadratic = cubicToQuadratic;
		BezierPlugin._autoCSS = true; //indicates that this plugin can be inserted into the "css" object using the autoCSS feature of TweenLite
		BezierPlugin.quadraticToCubic = function(a, b, c) {
			return new Segment(a, (2 * b + a) / 3, (2 * b + c) / 3, c);
		};

		BezierPlugin._cssRegister = function() {
			var CSSPlugin = window._gsDefine.globals.CSSPlugin;
			if (!CSSPlugin) {
				return;
			}
			var _internals = CSSPlugin._internals,
				_parseToProxy = _internals._parseToProxy,
				_setPluginRatio = _internals._setPluginRatio,
				CSSPropTween = _internals.CSSPropTween;
			_internals._registerComplexSpecialProp("bezier", {parser:function(t, e, prop, cssp, pt, plugin) {
				if (e instanceof Array) {
					e = {values:e};
				}
				plugin = new BezierPlugin();
				var values = e.values,
					l = values.length - 1,
					pluginValues = [],
					v = {},
					i, p, data;
				if (l < 0) {
					return pt;
				}
				for (i = 0; i <= l; i++) {
					data = _parseToProxy(t, values[i], cssp, pt, plugin, (l !== i));
					pluginValues[i] = data.end;
				}
				for (p in e) {
					v[p] = e[p]; //duplicate the vars object because we need to alter some things which would cause problems if the user plans to reuse the same vars object for another tween.
				}
				v.values = pluginValues;
				pt = new CSSPropTween(t, "bezier", 0, 0, data.pt, 2);
				pt.data = data;
				pt.plugin = plugin;
				pt.setRatio = _setPluginRatio;
				if (v.autoRotate === 0) {
					v.autoRotate = true;
				}
				if (v.autoRotate && !(v.autoRotate instanceof Array)) {
					i = (v.autoRotate === true) ? 0 : Number(v.autoRotate) * _DEG2RAD;
					v.autoRotate = (data.end.left != null) ? [["left","top","rotation",i,true]] : (data.end.x != null) ? [["x","y","rotation",i,true]] : false;
				}
				if (v.autoRotate) {
					if (!cssp._transform) {
						cssp._enableTransforms(false);
					}
					data.autoRotate = cssp._target._gsTransform;
				}
				plugin._onInitTween(data.proxy, v, cssp._tween);
				return pt;
			}});
		};

		p._roundProps = function(lookup, value) {
			var op = this._overwriteProps,
				i = op.length;
			while (--i > -1) {
				if (lookup[op[i]] || lookup.bezier || lookup.bezierThrough) {
					this._round[op[i]] = value;
				}
			}
		};

		p._kill = function(lookup) {
			var a = this._props,
				p, i;
			for (p in this._beziers) {
				if (p in lookup) {
					delete this._beziers[p];
					delete this._func[p];
					i = a.length;
					while (--i > -1) {
						if (a[i] === p) {
							a.splice(i, 1);
						}
					}
				}
			}
			return this._super._kill.call(this, lookup);
		};

	}());






	
	
	
	
	
	
	
	
/*
 * ----------------------------------------------------------------
 * CSSPlugin
 * ----------------------------------------------------------------
 */
	window._gsDefine("plugins.CSSPlugin", ["plugins.TweenPlugin","TweenLite"], function(TweenPlugin, TweenLite) {

		/** @constructor **/
		var CSSPlugin = function() {
				TweenPlugin.call(this, "css");
				this._overwriteProps.length = 0;
				this.setRatio = CSSPlugin.prototype.setRatio; //speed optimization (avoid prototype lookup on this "hot" method)
			},
			_hasPriority, //turns true whenever a CSSPropTween instance is created that has a priority other than 0. This helps us discern whether or not we should spend the time organizing the linked list or not after a CSSPlugin's _onInitTween() method is called.
			_suffixMap, //we set this in _onInitTween() each time as a way to have a persistent variable we can use in other methods like _parse() without having to pass it around as a parameter and we keep _parse() decoupled from a particular CSSPlugin instance
			_cs, //computed style (we store this in a shared variable to conserve memory and make minification tighter
			_overwriteProps, //alias to the currently instantiating CSSPlugin's _overwriteProps array. We use this closure in order to avoid having to pass a reference around from method to method and aid in minification.
			_specialProps = {},
			p = CSSPlugin.prototype = new TweenPlugin("css");

		p.constructor = CSSPlugin;
		CSSPlugin.version = "1.10.3";
		CSSPlugin.API = 2;
		CSSPlugin.defaultTransformPerspective = 0;
		p = "px"; //we'll reuse the "p" variable to keep file size down
		CSSPlugin.suffixMap = {top:p, right:p, bottom:p, left:p, width:p, height:p, fontSize:p, padding:p, margin:p, perspective:p};


		var _numExp = /(?:\d|\-\d|\.\d|\-\.\d)+/g,
			_relNumExp = /(?:\d|\-\d|\.\d|\-\.\d|\+=\d|\-=\d|\+=.\d|\-=\.\d)+/g,
			_valuesExp = /(?:\+=|\-=|\-|\b)[\d\-\.]+[a-zA-Z0-9]*(?:%|\b)/gi, //finds all the values that begin with numbers or += or -= and then a number. Includes suffixes. We use this to split complex values apart like "1px 5px 20px rgb(255,102,51)"
			//_clrNumExp = /(?:\b(?:(?:rgb|rgba|hsl|hsla)\(.+?\))|\B#.+?\b)/, //only finds rgb(), rgba(), hsl(), hsla() and # (hexadecimal) values but NOT color names like red, blue, etc.
			//_tinyNumExp = /\b\d+?e\-\d+?\b/g, //finds super small numbers in a string like 1e-20. could be used in matrix3d() to fish out invalid numbers and replace them with 0. After performing speed tests, however, we discovered it was slightly faster to just cut the numbers at 5 decimal places with a particular algorithm.
			_NaNExp = /[^\d\-\.]/g,
			_suffixExp = /(?:\d|\-|\+|=|#|\.)*/g,
			_opacityExp = /opacity *= *([^)]*)/,
			_opacityValExp = /opacity:([^;]*)/,
			_alphaFilterExp = /alpha\(opacity *=.+?\)/i,
			_rgbhslExp = /^(rgb|hsl)/,
			_capsExp = /([A-Z])/g,
			_camelExp = /-([a-z])/gi,
			_urlExp = /(^(?:url\(\"|url\())|(?:(\"\))$|\)$)/gi, //for pulling out urls from url(...) or url("...") strings (some browsers wrap urls in quotes, some don't when reporting things like backgroundImage)
			_camelFunc = function(s, g) { return g.toUpperCase(); },
			_horizExp = /(?:Left|Right|Width)/i,
			_ieGetMatrixExp = /(M11|M12|M21|M22)=[\d\-\.e]+/gi,
			_ieSetMatrixExp = /progid\:DXImageTransform\.Microsoft\.Matrix\(.+?\)/i,
			_commasOutsideParenExp = /,(?=[^\)]*(?:\(|$))/gi, //finds any commas that are not within parenthesis
			_DEG2RAD = Math.PI / 180,
			_RAD2DEG = 180 / Math.PI,
			_forcePT = {},
			_doc = document,
			_tempDiv = _doc.createElement("div"),
			_tempImg = _doc.createElement("img"),
			_internals = CSSPlugin._internals = {_specialProps:_specialProps}, //provides a hook to a few internal methods that we need to access from inside other plugins
			_agent = navigator.userAgent,
			_autoRound,
			_reqSafariFix, //we won't apply the Safari transform fix until we actually come across a tween that affects a transform property (to maintain best performance).

			_isSafari,
			_isFirefox, //Firefox has a bug that causes 3D transformed elements to randomly disappear unless a repaint is forced after each update on each element.
			_isSafariLT6, //Safari (and Android 4 which uses a flavor of Safari) has a bug that prevents changes to "top" and "left" properties from rendering properly if changed on the same frame as a transform UNLESS we set the element's WebkitBackfaceVisibility to hidden (weird, I know). Doing this for Android 3 and earlier seems to actually cause other problems, though (fun!)
			_ieVers,
			_supportsOpacity = (function() { //we set _isSafari, _ieVers, _isFirefox, and _supportsOpacity all in one function here to reduce file size slightly, especially in the minified version.
				var i = _agent.indexOf("Android"),
					d = _doc.createElement("div"), a;

				_isSafari = (_agent.indexOf("Safari") !== -1 && _agent.indexOf("Chrome") === -1 && (i === -1 || Number(_agent.substr(i+8, 1)) > 3));
				_isSafariLT6 = (_isSafari && (Number(_agent.substr(_agent.indexOf("Version/")+8, 1)) < 6));
				_isFirefox = (_agent.indexOf("Firefox") !== -1);

				(/MSIE ([0-9]{1,}[\.0-9]{0,})/).exec(_agent);
				_ieVers = parseFloat( RegExp.$1 );

				d.innerHTML = "<a style='top:1px;opacity:.55;'>a</a>";
				a = d.getElementsByTagName("a")[0];
				return a ? /^0.55/.test(a.style.opacity) : false;
			}()),
			_getIEOpacity = function(v) {
				return (_opacityExp.test( ((typeof(v) === "string") ? v : (v.currentStyle ? v.currentStyle.filter : v.style.filter) || "") ) ? ( parseFloat( RegExp.$1 ) / 100 ) : 1);
			},
			_log = function(s) {//for logging messages, but in a way that won't throw errors in old versions of IE.
				if (window.console) {
					console.log(s);
				}
			},
			_prefixCSS = "", //the non-camelCase vendor prefix like "-o-", "-moz-", "-ms-", or "-webkit-"
			_prefix = "", //camelCase vendor prefix like "O", "ms", "Webkit", or "Moz".

			//@private feed in a camelCase property name like "transform" and it will check to see if it is valid as-is or if it needs a vendor prefix. It returns the corrected camelCase property name (i.e. "WebkitTransform" or "MozTransform" or "transform" or null if no such property is found, like if the browser is IE8 or before, "transform" won't be found at all)
			_checkPropPrefix = function(p, e) {
				e = e || _tempDiv;
				var s = e.style,
					a, i;
				if (s[p] !== undefined) {
					return p;
				}
				p = p.charAt(0).toUpperCase() + p.substr(1);
				a = ["O","Moz","ms","Ms","Webkit"];
				i = 5;
				while (--i > -1 && s[a[i]+p] === undefined) { }
				if (i >= 0) {
					_prefix = (i === 3) ? "ms" : a[i];
					_prefixCSS = "-" + _prefix.toLowerCase() + "-";
					return _prefix + p;
				}
				return null;
			},

			_getComputedStyle = _doc.defaultView ? _doc.defaultView.getComputedStyle : function() {},

			/**
			 * @private Returns the css style for a particular property of an element. For example, to get whatever the current "left" css value for an element with an ID of "myElement", you could do:
			 * var currentLeft = CSSPlugin.getStyle( document.getElementById("myElement"), "left");
			 *
			 * @param {!Object} t Target element whose style property you want to query
			 * @param {!string} p Property name (like "left" or "top" or "marginTop", etc.)
			 * @param {Object=} cs Computed style object. This just provides a way to speed processing if you're going to get several properties on the same element in quick succession - you can reuse the result of the getComputedStyle() call.
			 * @param {boolean=} calc If true, the value will not be read directly from the element's "style" property (if it exists there), but instead the getComputedStyle() result will be used. This can be useful when you want to ensure that the browser itself is interpreting the value.
			 * @param {string=} dflt Default value that should be returned in the place of null, "none", "auto" or "auto auto".
			 * @return {?string} The current property value
			 */
			_getStyle = CSSPlugin.getStyle = function(t, p, cs, calc, dflt) {
				var rv;
				if (!_supportsOpacity) if (p === "opacity") { //several versions of IE don't use the standard "opacity" property - they use things like filter:alpha(opacity=50), so we parse that here.
					return _getIEOpacity(t);
				}
				if (!calc && t.style[p]) {
					rv = t.style[p];
				} else if ((cs = cs || _getComputedStyle(t, null))) {
					t = cs.getPropertyValue(p.replace(_capsExp, "-$1").toLowerCase());
					rv = (t || cs.length) ? t : cs[p]; //Opera behaves VERY strangely - length is usually 0 and cs[p] is the only way to get accurate results EXCEPT when checking for -o-transform which only works with cs.getPropertyValue()!
				} else if (t.currentStyle) {
					rv = t.currentStyle[p];
				}
				return (dflt != null && (!rv || rv === "none" || rv === "auto" || rv === "auto auto")) ? dflt : rv;
			},

			/**
			 * @private Pass the target element, the property name, the numeric value, and the suffix (like "%", "em", "px", etc.) and it will spit back the equivalent pixel number.
			 * @param {!Object} t Target element
			 * @param {!string} p Property name (like "left", "top", "marginLeft", etc.)
			 * @param {!number} v Value
			 * @param {string=} sfx Suffix (like "px" or "%" or "em")
			 * @param {boolean=} recurse If true, the call is a recursive one. In some browsers (like IE7/8), occasionally the value isn't accurately reported initially, but if we run the function again it will take effect.
			 * @return {number} value in pixels
			 */
			_convertToPixels = function(t, p, v, sfx, recurse) {
				if (sfx === "px" || !sfx) { return v; }
				if (sfx === "auto" || !v) { return 0; }
				var horiz = _horizExp.test(p),
					node = t,
					style = _tempDiv.style,
					neg = (v < 0),
					pix;
				if (neg) {
					v = -v;
				}
				if (sfx === "%" && p.indexOf("border") !== -1) {
					pix = (v / 100) * (horiz ? t.clientWidth : t.clientHeight);
				} else {
					style.cssText = "border-style:solid;border-width:0;position:absolute;line-height:0;";
					if (sfx === "%" || !node.appendChild) {
						node = t.parentNode || _doc.body;
						style[(horiz ? "width" : "height")] = v + sfx;
					} else {
						style[(horiz ? "borderLeftWidth" : "borderTopWidth")] = v + sfx;
					}
					node.appendChild(_tempDiv);
					pix = parseFloat(_tempDiv[(horiz ? "offsetWidth" : "offsetHeight")]);
					node.removeChild(_tempDiv);
					if (pix === 0 && !recurse) {
						pix = _convertToPixels(t, p, v, sfx, true);
					}
				}
				return neg ? -pix : pix;
			},
			_calculateOffset = function(t, p, cs) { //for figuring out "top" or "left" in px when it's "auto". We need to factor in margin with the offsetLeft/offsetTop
				if (_getStyle(t, "position", cs) !== "absolute") { return 0; }
				var dim = ((p === "left") ? "Left" : "Top"),
					v = _getStyle(t, "margin" + dim, cs);
				return t["offset" + dim] - (_convertToPixels(t, p, parseFloat(v), v.replace(_suffixExp, "")) || 0);
			},

			//@private returns at object containing ALL of the style properties in camelCase and their associated values.
			_getAllStyles = function(t, cs) {
				var s = {},
					i, tr;
				if ((cs = cs || _getComputedStyle(t, null))) {
					if ((i = cs.length)) {
						while (--i > -1) {
							s[cs[i].replace(_camelExp, _camelFunc)] = cs.getPropertyValue(cs[i]);
						}
					} else { //Opera behaves differently - cs.length is always 0, so we must do a for...in loop.
						for (i in cs) {
							s[i] = cs[i];
						}
					}
				} else if ((cs = t.currentStyle || t.style)) {
					for (i in cs) {
						s[i.replace(_camelExp, _camelFunc)] = cs[i];
					}
				}
				if (!_supportsOpacity) {
					s.opacity = _getIEOpacity(t);
				}
				tr = _getTransform(t, cs, false);
				s.rotation = tr.rotation * _RAD2DEG;
				s.skewX = tr.skewX * _RAD2DEG;
				s.scaleX = tr.scaleX;
				s.scaleY = tr.scaleY;
				s.x = tr.x;
				s.y = tr.y;
				if (_supports3D) {
					s.z = tr.z;
					s.rotationX = tr.rotationX * _RAD2DEG;
					s.rotationY = tr.rotationY * _RAD2DEG;
					s.scaleZ = tr.scaleZ;
				}
				if (s.filters) {
					delete s.filters;
				}
				return s;
			},

			//@private analyzes two style objects (as returned by _getAllStyles()) and only looks for differences between them that contain tweenable values (like a number or color). It returns an object with a "difs" property which refers to an object containing only those isolated properties and values for tweening, and a "firstMPT" property which refers to the first MiniPropTween instance in a linked list that recorded all the starting values of the different properties so that we can revert to them at the end or beginning of the tween - we don't want the cascading to get messed up. The forceLookup parameter is an optional generic object with properties that should be forced into the results - this is necessary for className tweens that are overwriting others because imagine a scenario where a rollover/rollout adds/removes a class and the user swipes the mouse over the target SUPER fast, thus nothing actually changed yet and the subsequent comparison of the properties would indicate they match (especially when px rounding is taken into consideration), thus no tweening is necessary even though it SHOULD tween and remove those properties after the tween (otherwise the inline styles will contaminate things). See the className SpecialProp code for details.
			_cssDif = function(t, s1, s2, vars, forceLookup) {
				var difs = {},
					style = t.style,
					val, p, mpt;
				for (p in s2) {
					if (p !== "cssText") if (p !== "length") if (isNaN(p)) if (s1[p] !== (val = s2[p]) || (forceLookup && forceLookup[p])) if (p.indexOf("Origin") === -1) if (typeof(val) === "number" || typeof(val) === "string") {
						difs[p] = (val === "auto" && (p === "left" || p === "top")) ? _calculateOffset(t, p) : ((val === "" || val === "auto" || val === "none") && typeof(s1[p]) === "string" && s1[p].replace(_NaNExp, "") !== "") ? 0 : val; //if the ending value is defaulting ("" or "auto"), we check the starting value and if it can be parsed into a number (a string which could have a suffix too, like 700px), then we swap in 0 for "" or "auto" so that things actually tween.
						if (style[p] !== undefined) { //for className tweens, we must remember which properties already existed inline - the ones that didn't should be removed when the tween isn't in progress because they were only introduced to facilitate the transition between classes.
							mpt = new MiniPropTween(style, p, style[p], mpt);
						}
					}
				}
				if (vars) {
					for (p in vars) { //copy properties (except className)
						if (p !== "className") {
							difs[p] = vars[p];
						}
					}
				}
				return {difs:difs, firstMPT:mpt};
			},
			_dimensions = {width:["Left","Right"], height:["Top","Bottom"]},
			_margins = ["marginLeft","marginRight","marginTop","marginBottom"],

			/**
			 * @private Gets the width or height of an element
			 * @param {!Object} t Target element
			 * @param {!string} p Property name ("width" or "height")
			 * @param {Object=} cs Computed style object (if one exists). Just a speed optimization.
			 * @return {number} Dimension (in pixels)
			 */
			_getDimension = function(t, p, cs) {
				var v = parseFloat((p === "width") ? t.offsetWidth : t.offsetHeight),
					a = _dimensions[p],
					i = a.length;
				cs = cs || _getComputedStyle(t, null);
				while (--i > -1) {
					v -= parseFloat( _getStyle(t, "padding" + a[i], cs, true) ) || 0;
					v -= parseFloat( _getStyle(t, "border" + a[i] + "Width", cs, true) ) || 0;
				}
				return v;
			},

			//@private Parses position-related complex strings like "top left" or "50px 10px" or "70% 20%", etc. which are used for things like transformOrigin or backgroundPosition. Optionally decorates a supplied object (recObj) with the following properties: "ox" (offsetX), "oy" (offsetY), "oxp" (if true, "ox" is a percentage not a pixel value), and "oxy" (if true, "oy" is a percentage not a pixel value)
			_parsePosition = function(v, recObj) {
				if (v == null || v === "" || v === "auto" || v === "auto auto") { //note: Firefox uses "auto auto" as default whereas Chrome uses "auto".
					v = "0 0";
				}
				var a = v.split(" "),
					x = (v.indexOf("left") !== -1) ? "0%" : (v.indexOf("right") !== -1) ? "100%" : a[0],
					y = (v.indexOf("top") !== -1) ? "0%" : (v.indexOf("bottom") !== -1) ? "100%" : a[1];
				if (y == null) {
					y = "0";
				} else if (y === "center") {
					y = "50%";
				}
				if (x === "center" || (isNaN(parseFloat(x)) && (x + "").indexOf("=") === -1)) { //remember, the user could flip-flop the values and say "bottom center" or "center bottom", etc. "center" is ambiguous because it could be used to describe horizontal or vertical, hence the isNaN(). If there's an "=" sign in the value, it's relative.
					x = "50%";
				}
				if (recObj) {
					recObj.oxp = (x.indexOf("%") !== -1);
					recObj.oyp = (y.indexOf("%") !== -1);
					recObj.oxr = (x.charAt(1) === "=");
					recObj.oyr = (y.charAt(1) === "=");
					recObj.ox = parseFloat(x.replace(_NaNExp, ""));
					recObj.oy = parseFloat(y.replace(_NaNExp, ""));
				}
				return x + " " + y + ((a.length > 2) ? " " + a[2] : "");
			},

			/**
			 * @private Takes an ending value (typically a string, but can be a number) and a starting value and returns the change between the two, looking for relative value indicators like += and -= and it also ignores suffixes (but make sure the ending value starts with a number or +=/-= and that the starting value is a NUMBER!)
			 * @param {(number|string)} e End value which is typically a string, but could be a number
			 * @param {(number|string)} b Beginning value which is typically a string but could be a number
			 * @return {number} Amount of change between the beginning and ending values (relative values that have a "+=" or "-=" are recognized)
			 */
			_parseChange = function(e, b) {
				return (typeof(e) === "string" && e.charAt(1) === "=") ? parseInt(e.charAt(0) + "1", 10) * parseFloat(e.substr(2)) : parseFloat(e) - parseFloat(b);
			},

			/**
			 * @private Takes a value and a default number, checks if the value is relative, null, or numeric and spits back a normalized number accordingly. Primarily used in the _parseTransform() function.
			 * @param {Object} v Value to be parsed
			 * @param {!number} d Default value (which is also used for relative calculations if "+=" or "-=" is found in the first parameter)
			 * @return {number} Parsed value
			 */
			_parseVal = function(v, d) {
				return (v == null) ? d : (typeof(v) === "string" && v.charAt(1) === "=") ? parseInt(v.charAt(0) + "1", 10) * Number(v.substr(2)) + d : parseFloat(v);
			},

			/**
			 * @private Translates strings like "40deg" or "40" or 40rad" or "+=40deg" or "270_short" or "-90_cw" or "+=45_ccw" to a numeric radian angle. Of course a starting/default value must be fed in too so that relative values can be calculated properly.
			 * @param {Object} v Value to be parsed
			 * @param {!number} d Default value (which is also used for relative calculations if "+=" or "-=" is found in the first parameter)
			 * @param {string=} p property name for directionalEnd (optional - only used when the parsed value is directional ("_short", "_cw", or "_ccw" suffix). We need a way to store the uncompensated value so that at the end of the tween, we set it to exactly what was requested with no directional compensation). Property name would be "rotation", "rotationX", or "rotationY"
			 * @param {Object=} directionalEnd An object that will store the raw end values for directional angles ("_short", "_cw", or "_ccw" suffix). We need a way to store the uncompensated value so that at the end of the tween, we set it to exactly what was requested with no directional compensation.
			 * @return {number} parsed angle in radians
			 */
			_parseAngle = function(v, d, p, directionalEnd) {
				var min = 0.000001,
					cap, split, dif, result;
				if (v == null) {
					result = d;
				} else if (typeof(v) === "number") {
					result = v * _DEG2RAD;
				} else {
					cap = Math.PI * 2;
					split = v.split("_");
					dif = Number(split[0].replace(_NaNExp, "")) * ((v.indexOf("rad") === -1) ? _DEG2RAD : 1) - ((v.charAt(1) === "=") ? 0 : d);
					if (split.length) {
						if (directionalEnd) {
							directionalEnd[p] = d + dif;
						}
						if (v.indexOf("short") !== -1) {
							dif = dif % cap;
							if (dif !== dif % (cap / 2)) {
								dif = (dif < 0) ? dif + cap : dif - cap;
							}
						}
						if (v.indexOf("_cw") !== -1 && dif < 0) {
							dif = ((dif + cap * 9999999999) % cap) - ((dif / cap) | 0) * cap;
						} else if (v.indexOf("ccw") !== -1 && dif > 0) {
							dif = ((dif - cap * 9999999999) % cap) - ((dif / cap) | 0) * cap;
						}
					}
					result = d + dif;
				}
				if (result < min && result > -min) {
					result = 0;
				}
				return result;
			},

			_colorLookup = {aqua:[0,255,255],
				lime:[0,255,0],
				silver:[192,192,192],
				black:[0,0,0],
				maroon:[128,0,0],
				teal:[0,128,128],
				blue:[0,0,255],
				navy:[0,0,128],
				white:[255,255,255],
				fuchsia:[255,0,255],
				olive:[128,128,0],
				yellow:[255,255,0],
				orange:[255,165,0],
				gray:[128,128,128],
				purple:[128,0,128],
				green:[0,128,0],
				red:[255,0,0],
				pink:[255,192,203],
				cyan:[0,255,255],
				transparent:[255,255,255,0]},

			_hue = function(h, m1, m2) {
				h = (h < 0) ? h + 1 : (h > 1) ? h - 1 : h;
				return ((((h * 6 < 1) ? m1 + (m2 - m1) * h * 6 : (h < 0.5) ? m2 : (h * 3 < 2) ? m1 + (m2 - m1) * (2 / 3 - h) * 6 : m1) * 255) + 0.5) | 0;
			},

			/**
			 * @private Parses a color (like #9F0, #FF9900, or rgb(255,51,153)) into an array with 3 elements for red, green, and blue. Also handles rgba() values (splits into array of 4 elements of course)
			 * @param {(string|number)} v The value the should be parsed which could be a string like #9F0 or rgb(255,102,51) or rgba(255,0,0,0.5) or it could be a number like 0xFF00CC or even a named color like red, blue, purple, etc.
			 * @return {Array.<number>} An array containing red, green, and blue (and optionally alpha) in that order.
			 */
			_parseColor = function(v) {
				var c1, c2, c3, h, s, l;
				if (!v || v === "") {
					return _colorLookup.black;
				}
				if (typeof(v) === "number") {
					return [v >> 16, (v >> 8) & 255, v & 255];
				}
				if (v.charAt(v.length - 1) === ",") { //sometimes a trailing commma is included and we should chop it off (typically from a comma-delimited list of values like a textShadow:"2px 2px 2px blue, 5px 5px 5px rgb(255,0,0)" - in this example "blue," has a trailing comma. We could strip it out inside parseComplex() but we'd need to do it to the beginning and ending values plus it wouldn't provide protection from other potential scenarios like if the user passes in a similar value.
					v = v.substr(0, v.length - 1);
				}
				if (_colorLookup[v]) {
					return _colorLookup[v];
				}
				if (v.charAt(0) === "#") {
					if (v.length === 4) { //for shorthand like #9F0
						c1 = v.charAt(1),
						c2 = v.charAt(2),
						c3 = v.charAt(3);
						v = "#" + c1 + c1 + c2 + c2 + c3 + c3;
					}
					v = parseInt(v.substr(1), 16);
					return [v >> 16, (v >> 8) & 255, v & 255];
				}
				if (v.substr(0, 3) === "hsl") {
					v = v.match(_numExp);
					h = (Number(v[0]) % 360) / 360;
					s = Number(v[1]) / 100;
					l = Number(v[2]) / 100;
					c2 = (l <= 0.5) ? l * (s + 1) : l + s - l * s;
					c1 = l * 2 - c2;
					if (v.length > 3) {
						v[3] = Number(v[3]);
					}
					v[0] = _hue(h + 1 / 3, c1, c2);
					v[1] = _hue(h, c1, c2);
					v[2] = _hue(h - 1 / 3, c1, c2);
					return v;
				}
				v = v.match(_numExp) || _colorLookup.transparent;
				v[0] = Number(v[0]);
				v[1] = Number(v[1]);
				v[2] = Number(v[2]);
				if (v.length > 3) {
					v[3] = Number(v[3]);
				}
				return v;
			},
			_colorExp = "(?:\\b(?:(?:rgb|rgba|hsl|hsla)\\(.+?\\))|\\B#.+?\\b"; //we'll dynamically build this Regular Expression to conserve file size. After building it, it will be able to find rgb(), rgba(), # (hexadecimal), and named color values like red, blue, purple, etc.

		for (p in _colorLookup) {
			_colorExp += "|" + p + "\\b";
		}
		_colorExp = new RegExp(_colorExp+")", "gi");

		/**
		 * @private Returns a formatter function that handles taking a string (or number in some cases) and returning a consistently formatted one in terms of delimiters, quantity of values, etc. For example, we may get boxShadow values defined as "0px red" or "0px 0px 10px rgb(255,0,0)" or "0px 0px 20px 20px #F00" and we need to ensure that what we get back is described with 4 numbers and a color. This allows us to feed it into the _parseComplex() method and split the values up appropriately. The neat thing about this _getFormatter() function is that the dflt defines a pattern as well as a default, so for example, _getFormatter("0px 0px 0px 0px #777", true) not only sets the default as 0px for all distances and #777 for the color, but also sets the pattern such that 4 numbers and a color will always get returned.
		 * @param {!string} dflt The default value and pattern to follow. So "0px 0px 0px 0px #777" will ensure that 4 numbers and a color will always get returned.
		 * @param {boolean=} clr If true, the values should be searched for color-related data. For example, boxShadow values typically contain a color whereas borderRadius don't.
		 * @param {boolean=} collapsible If true, the value is a top/left/right/bottom style one that acts like margin or padding, where if only one value is received, it's used for all 4; if 2 are received, the first is duplicated for 3rd (bottom) and the 2nd is duplicated for the 4th spot (left), etc.
		 * @return {Function} formatter function
		 */
		var _getFormatter = function(dflt, clr, collapsible, multi) {
				if (dflt == null) {
					return function(v) {return v;};
				}
				var dColor = clr ? (dflt.match(_colorExp) || [""])[0] : "",
					dVals = dflt.split(dColor).join("").match(_valuesExp) || [],
					pfx = dflt.substr(0, dflt.indexOf(dVals[0])),
					sfx = (dflt.charAt(dflt.length - 1) === ")") ? ")" : "",
					delim = (dflt.indexOf(" ") !== -1) ? " " : ",",
					numVals = dVals.length,
					dSfx = (numVals > 0) ? dVals[0].replace(_numExp, "") : "",
					formatter;
				if (!numVals) {
					return function(v) {return v;};
				}
				if (clr) {
					formatter = function(v) {
						var color, vals, i, a;
						if (typeof(v) === "number") {
							v += dSfx;
						} else if (multi && _commasOutsideParenExp.test(v)) {
							a = v.replace(_commasOutsideParenExp, "|").split("|");
							for (i = 0; i < a.length; i++) {
								a[i] = formatter(a[i]);
							}
							return a.join(",");
						}
						color = (v.match(_colorExp) || [dColor])[0];
						vals = v.split(color).join("").match(_valuesExp) || [];
						i = vals.length;
						if (numVals > i--) {
							while (++i < numVals) {
								vals[i] = collapsible ? vals[(((i - 1) / 2) | 0)] : dVals[i];
							}
						}
						return pfx + vals.join(delim) + delim + color + sfx + (v.indexOf("inset") !== -1 ? " inset" : "");
					};
					return formatter;

				}
				formatter = function(v) {
					var vals, a, i;
					if (typeof(v) === "number") {
						v += dSfx;
					} else if (multi && _commasOutsideParenExp.test(v)) {
						a = v.replace(_commasOutsideParenExp, "|").split("|");
						for (i = 0; i < a.length; i++) {
							a[i] = formatter(a[i]);
						}
						return a.join(",");
					}
					vals = v.match(_valuesExp) || [];
					i = vals.length;
					if (numVals > i--) {
						while (++i < numVals) {
							vals[i] = collapsible ? vals[(((i - 1) / 2) | 0)] : dVals[i];
						}
					}
					return pfx + vals.join(delim) + sfx;
				};
				return formatter;
			},

			/**
			 * @private returns a formatter function that's used for edge-related values like marginTop, marginLeft, paddingBottom, paddingRight, etc. Just pass a comma-delimited list of property names related to the edges.
			 * @param {!string} props a comma-delimited list of property names in order from top to left, like "marginTop,marginRight,marginBottom,marginLeft"
			 * @return {Function} a formatter function
			 */
			_getEdgeParser = function(props) {
				props = props.split(",");
				return function(t, e, p, cssp, pt, plugin, vars) {
					var a = (e + "").split(" "),
						i;
					vars = {};
					for (i = 0; i < 4; i++) {
						vars[props[i]] = a[i] = a[i] || a[(((i - 1) / 2) >> 0)];
					}
					return cssp.parse(t, vars, pt, plugin);
				};
			},

			//@private used when other plugins must tween values first, like BezierPlugin or ThrowPropsPlugin, etc. That plugin's setRatio() gets called first so that the values are updated, and then we loop through the MiniPropTweens  which handle copying the values into their appropriate slots so that they can then be applied correctly in the main CSSPlugin setRatio() method. Remember, we typically create a proxy object that has a bunch of uniquely-named properties that we feed to the sub-plugin and it does its magic normally, and then we must interpret those values and apply them to the css because often numbers must get combined/concatenated, suffixes added, etc. to work with css, like boxShadow could have 4 values plus a color.
			_setPluginRatio = _internals._setPluginRatio = function(v) {
				this.plugin.setRatio(v);
				var d = this.data,
					proxy = d.proxy,
					mpt = d.firstMPT,
					min = 0.000001,
					val, pt, i, str;
				while (mpt) {
					val = proxy[mpt.v];
					if (mpt.r) {
						val = (val > 0) ? (val + 0.5) | 0 : (val - 0.5) | 0;
					} else if (val < min && val > -min) {
						val = 0;
					}
					mpt.t[mpt.p] = val;
					mpt = mpt._next;
				}
				if (d.autoRotate) {
					d.autoRotate.rotation = proxy.rotation;
				}
				//at the end, we must set the CSSPropTween's "e" (end) value dynamically here because that's what is used in the final setRatio() method.
				if (v === 1) {
					mpt = d.firstMPT;
					while (mpt) {
						pt = mpt.t;
						if (!pt.type) {
							pt.e = pt.s + pt.xs0;
						} else if (pt.type === 1) {
							str = pt.xs0 + pt.s + pt.xs1;
							for (i = 1; i < pt.l; i++) {
								str += pt["xn"+i] + pt["xs"+(i+1)];
							}
							pt.e = str;
						}
						mpt = mpt._next;
					}
				}
			},

			/**
			 * @private @constructor Used by a few SpecialProps to hold important values for proxies. For example, _parseToProxy() creates a MiniPropTween instance for each property that must get tweened on the proxy, and we record the original property name as well as the unique one we create for the proxy, plus whether or not the value needs to be rounded plus the original value.
			 * @param {!Object} t target object whose property we're tweening (often a CSSPropTween)
			 * @param {!string} p property name
			 * @param {(number|string|object)} v value
			 * @param {MiniPropTween=} next next MiniPropTween in the linked list
			 * @param {boolean=} r if true, the tweened value should be rounded to the nearest integer
			 */
			MiniPropTween = function(t, p, v, next, r) {
				this.t = t;
				this.p = p;
				this.v = v;
				this.r = r;
				if (next) {
					next._prev = this;
					this._next = next;
				}
			},

			/**
			 * @private Most other plugins (like BezierPlugin and ThrowPropsPlugin and others) can only tween numeric values, but CSSPlugin must accommodate special values that have a bunch of extra data (like a suffix or strings between numeric values, etc.). For example, boxShadow has values like "10px 10px 20px 30px rgb(255,0,0)" which would utterly confuse other plugins. This method allows us to split that data apart and grab only the numeric data and attach it to uniquely-named properties of a generic proxy object ({}) so that we can feed that to virtually any plugin to have the numbers tweened. However, we must also keep track of which properties from the proxy go with which CSSPropTween values and instances. So we create a linked list of MiniPropTweens. Each one records a target (the original CSSPropTween), property (like "s" or "xn1" or "xn2") that we're tweening and the unique property name that was used for the proxy (like "boxShadow_xn1" and "boxShadow_xn2") and whether or not they need to be rounded. That way, in the _setPluginRatio() method we can simply copy the values over from the proxy to the CSSPropTween instance(s). Then, when the main CSSPlugin setRatio() method runs and applies the CSSPropTween values accordingly, they're updated nicely. So the external plugin tweens the numbers, _setPluginRatio() copies them over, and setRatio() acts normally, applying css-specific values to the element.
			 * This method returns an object that has the following properties:
			 *  - proxy: a generic object containing the starting values for all the properties that will be tweened by the external plugin.  This is what we feed to the external _onInitTween() as the target
			 *  - end: a generic object containing the ending values for all the properties that will be tweened by the external plugin. This is what we feed to the external plugin's _onInitTween() as the destination values
			 *  - firstMPT: the first MiniPropTween in the linked list
			 *  - pt: the first CSSPropTween in the linked list that was created when parsing. If shallow is true, this linked list will NOT attach to the one passed into the _parseToProxy() as the "pt" (4th) parameter.
			 * @param {!Object} t target object to be tweened
			 * @param {!(Object|string)} vars the object containing the information about the tweening values (typically the end/destination values) that should be parsed
			 * @param {!CSSPlugin} cssp The CSSPlugin instance
			 * @param {CSSPropTween=} pt the next CSSPropTween in the linked list
			 * @param {TweenPlugin=} plugin the external TweenPlugin instance that will be handling tweening the numeric values
			 * @param {boolean=} shallow if true, the resulting linked list from the parse will NOT be attached to the CSSPropTween that was passed in as the "pt" (4th) parameter.
			 * @return An object containing the following properties: proxy, end, firstMPT, and pt (see above for descriptions)
			 */
			_parseToProxy = _internals._parseToProxy = function(t, vars, cssp, pt, plugin, shallow) {
				var bpt = pt,
					start = {},
					end = {},
					transform = cssp._transform,
					oldForce = _forcePT,
					i, p, xp, mpt, firstPT;
				cssp._transform = null;
				_forcePT = vars;
				pt = firstPT = cssp.parse(t, vars, pt, plugin);
				_forcePT = oldForce;
				//break off from the linked list so the new ones are isolated.
				if (shallow) {
					cssp._transform = transform;
					if (bpt) {
						bpt._prev = null;
						if (bpt._prev) {
							bpt._prev._next = null;
						}
					}
				}
				while (pt && pt !== bpt) {
					if (pt.type <= 1) {
						p = pt.p;
						end[p] = pt.s + pt.c;
						start[p] = pt.s;
						if (!shallow) {
							mpt = new MiniPropTween(pt, "s", p, mpt, pt.r);
							pt.c = 0;
						}
						if (pt.type === 1) {
							i = pt.l;
							while (--i > 0) {
								xp = "xn" + i;
								p = pt.p + "_" + xp;
								end[p] = pt.data[xp];
								start[p] = pt[xp];
								if (!shallow) {
									mpt = new MiniPropTween(pt, xp, p, mpt, pt.rxp[xp]);
								}
							}
						}
					}
					pt = pt._next;
				}
				return {proxy:start, end:end, firstMPT:mpt, pt:firstPT};
			},



			/**
			 * @constructor Each property that is tweened has at least one CSSPropTween associated with it. These instances store important information like the target, property, starting value, amount of change, etc. They can also optionally have a number of "extra" strings and numeric values named xs1, xn1, xs2, xn2, xs3, xn3, etc. where "s" indicates string and "n" indicates number. These can be pieced together in a complex-value tween (type:1) that has alternating types of data like a string, number, string, number, etc. For example, boxShadow could be "5px 5px 8px rgb(102, 102, 51)". In that value, there are 6 numbers that may need to tween and then pieced back together into a string again with spaces, suffixes, etc. xs0 is special in that it stores the suffix for standard (type:0) tweens, -OR- the first string (prefix) in a complex-value (type:1) CSSPropTween -OR- it can be the non-tweening value in a type:-1 CSSPropTween. We do this to conserve memory.
			 * CSSPropTweens have the following optional properties as well (not defined through the constructor):
			 *  - l: Length in terms of the number of extra properties that the CSSPropTween has (default: 0). For example, for a boxShadow we may need to tween 5 numbers in which case l would be 5; Keep in mind that the start/end values for the first number that's tweened are always stored in the s and c properties to conserve memory. All additional values thereafter are stored in xn1, xn2, etc.
			 *  - xfirst: The first instance of any sub-CSSPropTweens that are tweening properties of this instance. For example, we may split up a boxShadow tween so that there's a main CSSPropTween of type:1 that has various xs* and xn* values associated with the h-shadow, v-shadow, blur, color, etc. Then we spawn a CSSPropTween for each of those that has a higher priority and runs BEFORE the main CSSPropTween so that the values are all set by the time it needs to re-assemble them. The xfirst gives us an easy way to identify the first one in that chain which typically ends at the main one (because they're all prepende to the linked list)
			 *  - plugin: The TweenPlugin instance that will handle the tweening of any complex values. For example, sometimes we don't want to use normal subtweens (like xfirst refers to) to tween the values - we might want ThrowPropsPlugin or BezierPlugin some other plugin to do the actual tweening, so we create a plugin instance and store a reference here. We need this reference so that if we get a request to round values or disable a tween, we can pass along that request.
			 *  - data: Arbitrary data that needs to be stored with the CSSPropTween. Typically if we're going to have a plugin handle the tweening of a complex-value tween, we create a generic object that stores the END values that we're tweening to and the CSSPropTween's xs1, xs2, etc. have the starting values. We store that object as data. That way, we can simply pass that object to the plugin and use the CSSPropTween as the target.
			 *  - setRatio: Only used for type:2 tweens that require custom functionality. In this case, we call the CSSPropTween's setRatio() method and pass the ratio each time the tween updates. This isn't quite as efficient as doing things directly in the CSSPlugin's setRatio() method, but it's very convenient and flexible.
			 * @param {!Object} t Target object whose property will be tweened. Often a DOM element, but not always. It could be anything.
			 * @param {string} p Property to tween (name). For example, to tween element.width, p would be "width".
			 * @param {number} s Starting numeric value
			 * @param {number} c Change in numeric value over the course of the entire tween. For example, if element.width starts at 5 and should end at 100, c would be 95.
			 * @param {CSSPropTween=} next The next CSSPropTween in the linked list. If one is defined, we will define its _prev as the new instance, and the new instance's _next will be pointed at it.
			 * @param {number=} type The type of CSSPropTween where -1 = a non-tweening value, 0 = a standard simple tween, 1 = a complex value (like one that has multiple numbers in a comma- or space-delimited string like border:"1px solid red"), and 2 = one that uses a custom setRatio function that does all of the work of applying the values on each update.
			 * @param {string=} n Name of the property that should be used for overwriting purposes which is typically the same as p but not always. For example, we may need to create a subtween for the 2nd part of a "clip:rect(...)" tween in which case "p" might be xs1 but "n" is still "clip"
			 * @param {boolean=} r If true, the value(s) should be rounded
			 * @param {number=} pr Priority in the linked list order. Higher priority CSSPropTweens will be updated before lower priority ones. The default priority is 0.
			 * @param {string=} b Beginning value. We store this to ensure that it is EXACTLY what it was when the tween began without any risk of interpretation issues.
			 * @param {string=} e Ending value. We store this to ensure that it is EXACTLY what the user defined at the end of the tween without any risk of interpretation issues.
			 */
			CSSPropTween = _internals.CSSPropTween = function(t, p, s, c, next, type, n, r, pr, b, e) {
				this.t = t; //target
				this.p = p; //property
				this.s = s; //starting value
				this.c = c; //change value
				this.n = n || p; //name that this CSSPropTween should be associated to (usually the same as p, but not always - n is what overwriting looks at)
				if (!(t instanceof CSSPropTween)) {
					_overwriteProps.push(this.n);
				}
				this.r = r; //round (boolean)
				this.type = type || 0; //0 = normal tween, -1 = non-tweening (in which case xs0 will be applied to the target's property, like tp.t[tp.p] = tp.xs0), 1 = complex-value SpecialProp, 2 = custom setRatio() that does all the work
				if (pr) {
					this.pr = pr;
					_hasPriority = true;
				}
				this.b = (b === undefined) ? s : b;
				this.e = (e === undefined) ? s + c : e;
				if (next) {
					this._next = next;
					next._prev = this;
				}
			},

			/**
			 * Takes a target, the beginning value and ending value (as strings) and parses them into a CSSPropTween (possibly with child CSSPropTweens) that accommodates multiple numbers, colors, comma-delimited values, etc. For example:
			 * sp.parseComplex(element, "boxShadow", "5px 10px 20px rgb(255,102,51)", "0px 0px 0px red", true, "0px 0px 0px rgb(0,0,0,0)", pt);
			 * It will walk through the beginning and ending values (which should be in the same format with the same number and type of values) and figure out which parts are numbers, what strings separate the numeric/tweenable values, and then create the CSSPropTweens accordingly. If a plugin is defined, no child CSSPropTweens will be created. Instead, the ending values will be stored in the "data" property of the returned CSSPropTween like: {s:-5, xn1:-10, xn2:-20, xn3:255, xn4:0, xn5:0} so that it can be fed to any other plugin and it'll be plain numeric tweens but the recomposition of the complex value will be handled inside CSSPlugin's setRatio().
			 * If a setRatio is defined, the type of the CSSPropTween will be set to 2 and recomposition of the values will be the responsibility of that method.
			 *
			 * @param {!Object} t Target whose property will be tweened
			 * @param {!string} p Property that will be tweened (its name, like "left" or "backgroundColor" or "boxShadow")
			 * @param {string} b Beginning value
			 * @param {string} e Ending value
			 * @param {boolean} clrs If true, the value could contain a color value like "rgb(255,0,0)" or "#F00" or "red". The default is false, so no colors will be recognized (a performance optimization)
			 * @param {(string|number|Object)} dflt The default beginning value that should be used if no valid beginning value is defined or if the number of values inside the complex beginning and ending values don't match
			 * @param {?CSSPropTween} pt CSSPropTween instance that is the current head of the linked list (we'll prepend to this).
			 * @param {number=} pr Priority in the linked list order. Higher priority properties will be updated before lower priority ones. The default priority is 0.
			 * @param {TweenPlugin=} plugin If a plugin should handle the tweening of extra properties, pass the plugin instance here. If one is defined, then NO subtweens will be created for any extra properties (the properties will be created - just not additional CSSPropTween instances to tween them) because the plugin is expected to do so. However, the end values WILL be populated in the "data" property, like {s:100, xn1:50, xn2:300}
			 * @param {function(number)=} setRatio If values should be set in a custom function instead of being pieced together in a type:1 (complex-value) CSSPropTween, define that custom function here.
			 * @return {CSSPropTween} The first CSSPropTween in the linked list which includes the new one(s) added by the parseComplex() call.
			 */
			_parseComplex = CSSPlugin.parseComplex = function(t, p, b, e, clrs, dflt, pt, pr, plugin, setRatio) {
				//DEBUG: _log("parseComplex: "+p+", b: "+b+", e: "+e);
				b = b || dflt || "";
				pt = new CSSPropTween(t, p, 0, 0, pt, (setRatio ? 2 : 1), null, false, pr, b, e);
				e += ""; //ensures it's a string
				var ba = b.split(", ").join(",").split(" "), //beginning array
					ea = e.split(", ").join(",").split(" "), //ending array
					l = ba.length,
					autoRound = (_autoRound !== false),
					i, xi, ni, bv, ev, bnums, enums, bn, rgba, temp, cv, str;
				if (e.indexOf(",") !== -1 || b.indexOf(",") !== -1) {
					ba = ba.join(" ").replace(_commasOutsideParenExp, ", ").split(" ");
					ea = ea.join(" ").replace(_commasOutsideParenExp, ", ").split(" ");
					l = ba.length;
				}
				if (l !== ea.length) {
					//DEBUG: _log("mismatched formatting detected on " + p + " (" + b + " vs " + e + ")");
					ba = (dflt || "").split(" ");
					l = ba.length;
				}
				pt.plugin = plugin;
				pt.setRatio = setRatio;
				for (i = 0; i < l; i++) {
					bv = ba[i];
					ev = ea[i];
					bn = parseFloat(bv);

					//if the value begins with a number (most common). It's fine if it has a suffix like px
					if (bn || bn === 0) {
						pt.appendXtra("", bn, _parseChange(ev, bn), ev.replace(_relNumExp, ""), (autoRound && ev.indexOf("px") !== -1), true);

					//if the value is a color
					} else if (clrs && (bv.charAt(0) === "#" || _colorLookup[bv] || _rgbhslExp.test(bv))) {
						str = ev.charAt(ev.length - 1) === "," ? ")," : ")"; //if there's a comma at the end, retain it.
						bv = _parseColor(bv);
						ev = _parseColor(ev);
						rgba = (bv.length + ev.length > 6);
						if (rgba && !_supportsOpacity && ev[3] === 0) { //older versions of IE don't support rgba(), so if the destination alpha is 0, just use "transparent" for the end color
							pt["xs" + pt.l] += pt.l ? " transparent" : "transparent";
							pt.e = pt.e.split(ea[i]).join("transparent");
						} else {
							if (!_supportsOpacity) { //old versions of IE don't support rgba().
								rgba = false;
							}
							pt.appendXtra((rgba ? "rgba(" : "rgb("), bv[0], ev[0] - bv[0], ",", true, true)
								.appendXtra("", bv[1], ev[1] - bv[1], ",", true)
								.appendXtra("", bv[2], ev[2] - bv[2], (rgba ? "," : str), true);
							if (rgba) {
								bv = (bv.length < 4) ? 1 : bv[3];
								pt.appendXtra("", bv, ((ev.length < 4) ? 1 : ev[3]) - bv, str, false);
							}
						}

					} else {
						bnums = bv.match(_numExp); //gets each group of numbers in the beginning value string and drops them into an array

						//if no number is found, treat it as a non-tweening value and just append the string to the current xs.
						if (!bnums) {
							pt["xs" + pt.l] += pt.l ? " " + bv : bv;

						//loop through all the numbers that are found and construct the extra values on the pt.
						} else {
							enums = ev.match(_relNumExp); //get each group of numbers in the end value string and drop them into an array. We allow relative values too, like +=50 or -=.5
							if (!enums || enums.length !== bnums.length) {
								//DEBUG: _log("mismatched formatting detected on " + p + " (" + b + " vs " + e + ")");
								return pt;
							}
							ni = 0;
							for (xi = 0; xi < bnums.length; xi++) {
								cv = bnums[xi];
								temp = bv.indexOf(cv, ni);
								pt.appendXtra(bv.substr(ni, temp - ni), Number(cv), _parseChange(enums[xi], cv), "", (autoRound && bv.substr(temp + cv.length, 2) === "px"), (xi === 0));
								ni = temp + cv.length;
							}
							pt["xs" + pt.l] += bv.substr(ni);
						}
					}
				}
				//if there are relative values ("+=" or "-=" prefix), we need to adjust the ending value to eliminate the prefixes and combine the values properly.
				if (e.indexOf("=") !== -1) if (pt.data) {
					str = pt.xs0 + pt.data.s;
					for (i = 1; i < pt.l; i++) {
						str += pt["xs" + i] + pt.data["xn" + i];
					}
					pt.e = str + pt["xs" + i];
				}
				if (!pt.l) {
					pt.type = -1;
					pt.xs0 = pt.e;
				}
				return pt.xfirst || pt;
			},
			i = 9;


		p = CSSPropTween.prototype;
		p.l = p.pr = 0; //length (number of extra properties like xn1, xn2, xn3, etc.
		while (--i > 0) {
			p["xn" + i] = 0;
			p["xs" + i] = "";
		}
		p.xs0 = "";
		p._next = p._prev = p.xfirst = p.data = p.plugin = p.setRatio = p.rxp = null;


		/**
		 * Appends and extra tweening value to a CSSPropTween and automatically manages any prefix and suffix strings. The first extra value is stored in the s and c of the main CSSPropTween instance, but thereafter any extras are stored in the xn1, xn2, xn3, etc. The prefixes and suffixes are stored in the xs0, xs1, xs2, etc. properties. For example, if I walk through a clip value like "rect(10px, 5px, 0px, 20px)", the values would be stored like this:
		 * xs0:"rect(", s:10, xs1:"px, ", xn1:5, xs2:"px, ", xn2:0, xs3:"px, ", xn3:20, xn4:"px)"
		 * And they'd all get joined together when the CSSPlugin renders (in the setRatio() method).
		 * @param {string=} pfx Prefix (if any)
		 * @param {!number} s Starting value
		 * @param {!number} c Change in numeric value over the course of the entire tween. For example, if the start is 5 and the end is 100, the change would be 95.
		 * @param {string=} sfx Suffix (if any)
		 * @param {boolean=} r Round (if true).
		 * @param {boolean=} pad If true, this extra value should be separated by the previous one by a space. If there is no previous extra and pad is true, it will automatically drop the space.
		 * @return {CSSPropTween} returns itself so that multiple methods can be chained together.
		 */
		p.appendXtra = function(pfx, s, c, sfx, r, pad) {
			var pt = this,
				l = pt.l;
			pt["xs" + l] += (pad && l) ? " " + pfx : pfx || "";
			if (!c) if (l !== 0 && !pt.plugin) { //typically we'll combine non-changing values right into the xs to optimize performance, but we don't combine them when there's a plugin that will be tweening the values because it may depend on the values being split apart, like for a bezier, if a value doesn't change between the first and second iteration but then it does on the 3rd, we'll run into trouble because there's no xn slot for that value!
				pt["xs" + l] += s + (sfx || "");
				return pt;
			}
			pt.l++;
			pt.type = pt.setRatio ? 2 : 1;
			pt["xs" + pt.l] = sfx || "";
			if (l > 0) {
				pt.data["xn" + l] = s + c;
				pt.rxp["xn" + l] = r; //round extra property (we need to tap into this in the _parseToProxy() method)
				pt["xn" + l] = s;
				if (!pt.plugin) {
					pt.xfirst = new CSSPropTween(pt, "xn" + l, s, c, pt.xfirst || pt, 0, pt.n, r, pt.pr);
					pt.xfirst.xs0 = 0; //just to ensure that the property stays numeric which helps modern browsers speed up processing. Remember, in the setRatio() method, we do pt.t[pt.p] = val + pt.xs0 so if pt.xs0 is "" (the default), it'll cast the end value as a string. When a property is a number sometimes and a string sometimes, it prevents the compiler from locking in the data type, slowing things down slightly.
				}
				return pt;
			}
			pt.data = {s:s + c};
			pt.rxp = {};
			pt.s = s;
			pt.c = c;
			pt.r = r;
			return pt;
		};

		/**
		 * @constructor A SpecialProp is basically a css property that needs to be treated in a non-standard way, like if it may contain a complex value like boxShadow:"5px 10px 15px rgb(255, 102, 51)" or if it is associated with another plugin like ThrowPropsPlugin or BezierPlugin. Every SpecialProp is associated with a particular property name like "boxShadow" or "throwProps" or "bezier" and it will intercept those values in the vars object that's passed to the CSSPlugin and handle them accordingly.
		 * @param {!string} p Property name (like "boxShadow" or "throwProps")
		 * @param {Object=} options An object containing any of the following configuration options:
		 *                      - defaultValue: the default value
		 *                      - parser: A function that should be called when the associated property name is found in the vars. This function should return a CSSPropTween instance and it should ensure that it is properly inserted into the linked list. It will receive 4 paramters: 1) The target, 2) The value defined in the vars, 3) The CSSPlugin instance (whose _firstPT should be used for the linked list), and 4) A computed style object if one was calculated (this is a speed optimization that allows retrieval of starting values quicker)
		 *                      - formatter: a function that formats any value received for this special property (for example, boxShadow could take "5px 5px red" and format it to "5px 5px 0px 0px red" so that both the beginning and ending values have a common order and quantity of values.)
		 *                      - prefix: if true, we'll determine whether or not this property requires a vendor prefix (like Webkit or Moz or ms or O)
		 *                      - color: set this to true if the value for this SpecialProp may contain color-related values like rgb(), rgba(), etc.
		 *                      - priority: priority in the linked list order. Higher priority SpecialProps will be updated before lower priority ones. The default priority is 0.
		 *                      - multi: if true, the formatter should accommodate a comma-delimited list of values, like boxShadow could have multiple boxShadows listed out.
		 *                      - collapsible: if true, the formatter should treat the value like it's a top/right/bottom/left value that could be collapsed, like "5px" would apply to all, "5px, 10px" would use 5px for top/bottom and 10px for right/left, etc.
		 *                      - keyword: a special keyword that can [optionally] be found inside the value (like "inset" for boxShadow). This allows us to validate beginning/ending values to make sure they match (if the keyword is found in one, it'll be added to the other for consistency by default).
		 */
		var SpecialProp = function(p, options) {
				options = options || {};
				this.p = options.prefix ? _checkPropPrefix(p) || p : p;
				_specialProps[p] = _specialProps[this.p] = this;
				this.format = options.formatter || _getFormatter(options.defaultValue, options.color, options.collapsible, options.multi);
				if (options.parser) {
					this.parse = options.parser;
				}
				this.clrs = options.color;
				this.multi = options.multi;
				this.keyword = options.keyword;
				this.dflt = options.defaultValue;
				this.pr = options.priority || 0;
			},

			//shortcut for creating a new SpecialProp that can accept multiple properties as a comma-delimited list (helps minification). dflt can be an array for multiple values (we don't do a comma-delimited list because the default value may contain commas, like rect(0px,0px,0px,0px)). We attach this method to the SpecialProp class/object instead of using a private _createSpecialProp() method so that we can tap into it externally if necessary, like from another plugin.
			_registerComplexSpecialProp = _internals._registerComplexSpecialProp = function(p, options, defaults) {
				if (typeof(options) !== "object") {
					options = {parser:defaults}; //to make backwards compatible with older versions of BezierPlugin and ThrowPropsPlugin
				}
				var a = p.split(","),
					d = options.defaultValue,
					i, temp;
				defaults = defaults || [d];
				for (i = 0; i < a.length; i++) {
					options.prefix = (i === 0 && options.prefix);
					options.defaultValue = defaults[i] || d;
					temp = new SpecialProp(a[i], options);
				}
			},

			//creates a placeholder special prop for a plugin so that the property gets caught the first time a tween of it is attempted, and at that time it makes the plugin register itself, thus taking over for all future tweens of that property. This allows us to not mandate that things load in a particular order and it also allows us to log() an error that informs the user when they attempt to tween an external plugin-related property without loading its .js file.
			_registerPluginProp = function(p) {
				if (!_specialProps[p]) {
					var pluginName = p.charAt(0).toUpperCase() + p.substr(1) + "Plugin";
					_registerComplexSpecialProp(p, {parser:function(t, e, p, cssp, pt, plugin, vars) {
						var pluginClass = (window.GreenSockGlobals || window).com.greensock.plugins[pluginName];
						if (!pluginClass) {
							_log("Error: " + pluginName + " js file not loaded.");
							return pt;
						}
						pluginClass._cssRegister();
						return _specialProps[p].parse(t, e, p, cssp, pt, plugin, vars);
					}});
				}
			};


		p = SpecialProp.prototype;

		/**
		 * Alias for _parseComplex() that automatically plugs in certain values for this SpecialProp, like its property name, whether or not colors should be sensed, the default value, and priority. It also looks for any keyword that the SpecialProp defines (like "inset" for boxShadow) and ensures that the beginning and ending values have the same number of values for SpecialProps where multi is true (like boxShadow and textShadow can have a comma-delimited list)
		 * @param {!Object} t target element
		 * @param {(string|number|object)} b beginning value
		 * @param {(string|number|object)} e ending (destination) value
		 * @param {CSSPropTween=} pt next CSSPropTween in the linked list
		 * @param {TweenPlugin=} plugin If another plugin will be tweening the complex value, that TweenPlugin instance goes here.
		 * @param {function=} setRatio If a custom setRatio() method should be used to handle this complex value, that goes here.
		 * @return {CSSPropTween=} First CSSPropTween in the linked list
		 */
		p.parseComplex = function(t, b, e, pt, plugin, setRatio) {
			var kwd = this.keyword,
				i, ba, ea, l, bi, ei;
			//if this SpecialProp's value can contain a comma-delimited list of values (like boxShadow or textShadow), we must parse them in a special way, and look for a keyword (like "inset" for boxShadow) and ensure that the beginning and ending BOTH have it if the end defines it as such. We also must ensure that there are an equal number of values specified (we can't tween 1 boxShadow to 3 for example)
			if (this.multi) if (_commasOutsideParenExp.test(e) || _commasOutsideParenExp.test(b)) {
				ba = b.replace(_commasOutsideParenExp, "|").split("|");
				ea = e.replace(_commasOutsideParenExp, "|").split("|");
			} else if (kwd) {
				ba = [b];
				ea = [e];
			}
			if (ea) {
				l = (ea.length > ba.length) ? ea.length : ba.length;
				for (i = 0; i < l; i++) {
					b = ba[i] = ba[i] || this.dflt;
					e = ea[i] = ea[i] || this.dflt;
					if (kwd) {
						bi = b.indexOf(kwd);
						ei = e.indexOf(kwd);
						if (bi !== ei) {
							e = (ei === -1) ? ea : ba;
							e[i] += " " + kwd;
						}
					}
				}
				b = ba.join(", ");
				e = ea.join(", ");
			}
			return _parseComplex(t, this.p, b, e, this.clrs, this.dflt, pt, this.pr, plugin, setRatio);
		};

		/**
		 * Accepts a target and end value and spits back a CSSPropTween that has been inserted into the CSSPlugin's linked list and conforms with all the conventions we use internally, like type:-1, 0, 1, or 2, setting up any extra property tweens, priority, etc. For example, if we have a boxShadow SpecialProp and call:
		 * this._firstPT = sp.parse(element, "5px 10px 20px rgb(2550,102,51)", "boxShadow", this);
		 * It should figure out the starting value of the element's boxShadow, compare it to the provided end value and create all the necessary CSSPropTweens of the appropriate types to tween the boxShadow. The CSSPropTween that gets spit back should already be inserted into the linked list (the 4th parameter is the current head, so prepend to that).
		 * @param {!Object} t Target object whose property is being tweened
		 * @param {Object} e End value as provided in the vars object (typically a string, but not always - like a throwProps would be an object).
		 * @param {!string} p Property name
		 * @param {!CSSPlugin} cssp The CSSPlugin instance that should be associated with this tween.
		 * @param {?CSSPropTween} pt The CSSPropTween that is the current head of the linked list (we'll prepend to it)
		 * @param {TweenPlugin=} plugin If a plugin will be used to tween the parsed value, this is the plugin instance.
		 * @param {Object=} vars Original vars object that contains the data for parsing.
		 * @return {CSSPropTween} The first CSSPropTween in the linked list which includes the new one(s) added by the parse() call.
		 */
		p.parse = function(t, e, p, cssp, pt, plugin, vars) {
			return this.parseComplex(t.style, this.format(_getStyle(t, this.p, _cs, false, this.dflt)), this.format(e), pt, plugin);
		};

		/**
		 * Registers a special property that should be intercepted from any "css" objects defined in tweens. This allows you to handle them however you want without CSSPlugin doing it for you. The 2nd parameter should be a function that accepts 3 parameters:
		 *  1) Target object whose property should be tweened (typically a DOM element)
		 *  2) The end/destination value (could be a string, number, object, or whatever you want)
		 *  3) The tween instance (you probably don't need to worry about this, but it can be useful for looking up information like the duration)
		 *
		 * Then, your function should return a function which will be called each time the tween gets rendered, passing a numeric "ratio" parameter to your function that indicates the change factor (usually between 0 and 1). For example:
		 *
		 * CSSPlugin.registerSpecialProp("myCustomProp", function(target, value, tween) {
		 *      var start = target.style.width;
		 *      return function(ratio) {
		 *              target.style.width = (start + value * ratio) + "px";
		 *              console.log("set width to " + target.style.width);
		 *          }
		 * }, 0);
		 *
		 * Then, when I do this tween, it will trigger my special property:
		 *
		 * TweenLite.to(element, 1, {css:{myCustomProp:100}});
		 *
		 * In the example, of course, we're just changing the width, but you can do anything you want.
		 *
		 * @param {!string} name Property name (or comma-delimited list of property names) that should be intercepted and handled by your function. For example, if I define "myCustomProp", then it would handle that portion of the following tween: TweenLite.to(element, 1, {css:{myCustomProp:100}})
		 * @param {!function(Object, Object, Object, string):function(number)} onInitTween The function that will be called when a tween of this special property is performed. The function will receive 4 parameters: 1) Target object that should be tweened, 2) Value that was passed to the tween, 3) The tween instance itself (rarely used), and 4) The property name that's being tweened. Your function should return a function that should be called on every update of the tween. That function will receive a single parameter that is a "change factor" value (typically between 0 and 1) indicating the amount of change as a ratio. You can use this to determine how to set the values appropriately in your function.
		 * @param {number=} priority Priority that helps the engine determine the order in which to set the properties (default: 0). Higher priority properties will be updated before lower priority ones.
		 */
		CSSPlugin.registerSpecialProp = function(name, onInitTween, priority) {
			_registerComplexSpecialProp(name, {parser:function(t, e, p, cssp, pt, plugin, vars) {
				var rv = new CSSPropTween(t, p, 0, 0, pt, 2, p, false, priority);
				rv.plugin = plugin;
				rv.setRatio = onInitTween(t, e, cssp._tween, p);
				return rv;
			}, priority:priority});
		};








		//transform-related methods and properties
		var _transformProps = ("scaleX,scaleY,scaleZ,x,y,z,skewX,rotation,rotationX,rotationY,perspective").split(","),
			_transformProp = _checkPropPrefix("transform"), //the Javascript (camelCase) transform property, like msTransform, WebkitTransform, MozTransform, or OTransform.
			_transformPropCSS = _prefixCSS + "transform",
			_transformOriginProp = _checkPropPrefix("transformOrigin"),
			_supports3D = (_checkPropPrefix("perspective") !== null),

			/**
			 * Parses the transform values for an element, returning an object with x, y, z, scaleX, scaleY, scaleZ, rotation, rotationX, rotationY, skewX, and skewY properties. Note: by default (for performance reasons), all skewing is combined into skewX and rotation but skewY still has a place in the transform object so that we can record how much of the skew is attributed to skewX vs skewY. Remember, a skewY of 10 looks the same as a rotation of 10 and skewX of -10.
			 * @param {!Object} t target element
			 * @param {Object=} cs computed style object (optional)
			 * @param {boolean=} rec if true, the transform values will be recorded to the target element's _gsTransform object, like target._gsTransform = {x:0, y:0, z:0, scaleX:1...}
			 * @param {boolean=} parse if true, we'll ignore any _gsTransform values that already exist on the element, and force a reparsing of the css (calculated style)
			 * @return {object} object containing all of the transform properties/values like {x:0, y:0, z:0, scaleX:1...}
			 */
			_getTransform = function(t, cs, rec, parse) {
				if (t._gsTransform && rec && !parse) {
					return t._gsTransform; //if the element already has a _gsTransform, use that. Note: some browsers don't accurately return the calculated style for the transform (particularly for SVG), so it's almost always safest to just use the values we've already applied rather than re-parsing things.
				}
				var tm = rec ? t._gsTransform || {skewY:0} : {skewY:0},
					invX = (tm.scaleX < 0), //in order to interpret things properly, we need to know if the user applied a negative scaleX previously so that we can adjust the rotation and skewX accordingly. Otherwise, if we always interpret a flipped matrix as affecting scaleY and the user only wants to tween the scaleX on multiple sequential tweens, it would keep the negative scaleY without that being the user's intent.
					min = 0.00002,
					rnd = 100000,
					minPI = -Math.PI + 0.0001,
					maxPI = Math.PI - 0.0001,
					zOrigin = _supports3D ? parseFloat(_getStyle(t, _transformOriginProp, cs, false, "0 0 0").split(" ")[2]) || tm.zOrigin  || 0 : 0,
					s, m, i, n, dec, scaleX, scaleY, rotation, skewX, difX, difY, difR, difS;
				if (_transformProp) {
					s = _getStyle(t, _transformPropCSS, cs, true);
				} else if (t.currentStyle) {
					//for older versions of IE, we need to interpret the filter portion that is in the format: progid:DXImageTransform.Microsoft.Matrix(M11=6.123233995736766e-17, M12=-1, M21=1, M22=6.123233995736766e-17, sizingMethod='auto expand') Notice that we need to swap b and c compared to a normal matrix.
					s = t.currentStyle.filter.match(_ieGetMatrixExp);
					s = (s && s.length === 4) ? [s[0].substr(4), Number(s[2].substr(4)), Number(s[1].substr(4)), s[3].substr(4), (tm.x || 0), (tm.y || 0)].join(",") : "";
				}
				//split the matrix values out into an array (m for matrix)
				m = (s || "").match(/(?:\-|\b)[\d\-\.e]+\b/gi) || [];
				i = m.length;
				while (--i > -1) {
					n = Number(m[i]);
					m[i] = (dec = n - (n |= 0)) ? ((dec * rnd + (dec < 0 ? -0.5 : 0.5)) | 0) / rnd + n : n; //convert strings to Numbers and round to 5 decimal places to avoid issues with tiny numbers. Roughly 20x faster than Number.toFixed(). We also must make sure to round before dividing so that values like 0.9999999999 become 1 to avoid glitches in browser rendering and interpretation of flipped/rotated 3D matrices. And don't just multiply the number by rnd, floor it, and then divide by rnd because the bitwise operations max out at a 32-bit signed integer, thus it could get clipped at a relatively low value (like 22,000.00000 for example).
				}
				if (m.length === 16) {

					//we'll only look at these position-related 6 variables first because if x/y/z all match, it's relatively safe to assume we don't need to re-parse everything which risks losing important rotational information (like rotationX:180 plus rotationY:180 would look the same as rotation:180 - there's no way to know for sure which direction was taken based solely on the matrix3d() values)
					var a13 = m[8], a23 = m[9], a33 = m[10],
						a14 = m[12], a24 = m[13], a34 = m[14];

					//we manually compensate for non-zero z component of transformOrigin to work around bugs in Safari
					if (tm.zOrigin) {
						a34 = -tm.zOrigin;
						a14 = a13*a34-m[12];
						a24 = a23*a34-m[13];
						a34 = a33*a34+tm.zOrigin-m[14];
					}

					//only parse from the matrix if we MUST because not only is it usually unnecessary due to the fact that we store the values in the _gsTransform object, but also because it's impossible to accurately interpret rotationX, rotationY, rotationZ, scaleX, and scaleY if all are applied, so it's much better to rely on what we store. However, we must parse the first time that an object is tweened. We also assume that if the position has changed, the user must have done some styling changes outside of CSSPlugin, thus we force a parse in that scenario.
					if (!rec || parse || tm.rotationX == null) {
						var a11 = m[0], a21 = m[1], a31 = m[2], a41 = m[3],
							a12 = m[4], a22 = m[5], a32 = m[6], a42 = m[7],
							a43 = m[11],
							angle = tm.rotationX = Math.atan2(a32, a33),
							xFlip = (angle < minPI || angle > maxPI),
							t1, t2, t3, cos, sin, yFlip, zFlip;
						//rotationX
						if (angle) {
							cos = Math.cos(-angle);
							sin = Math.sin(-angle);
							t1 = a12*cos+a13*sin;
							t2 = a22*cos+a23*sin;
							t3 = a32*cos+a33*sin;
							a13 = a12*-sin+a13*cos;
							a23 = a22*-sin+a23*cos;
							a33 = a32*-sin+a33*cos;
							a43 = a42*-sin+a43*cos;
							a12 = t1;
							a22 = t2;
							a32 = t3;
						}
						//rotationY
						angle = tm.rotationY = Math.atan2(a13, a11);
						if (angle) {
							yFlip = (angle < minPI || angle > maxPI);
							cos = Math.cos(-angle);
							sin = Math.sin(-angle);
							t1 = a11*cos-a13*sin;
							t2 = a21*cos-a23*sin;
							t3 = a31*cos-a33*sin;
							a23 = a21*sin+a23*cos;
							a33 = a31*sin+a33*cos;
							a43 = a41*sin+a43*cos;
							a11 = t1;
							a21 = t2;
							a31 = t3;
						}
						//rotationZ
						angle = tm.rotation = Math.atan2(a21, a22);
						if (angle) {
							zFlip = (angle < minPI || angle > maxPI);
							cos = Math.cos(-angle);
							sin = Math.sin(-angle);
							a11 = a11*cos+a12*sin;
							t2 = a21*cos+a22*sin;
							a22 = a21*-sin+a22*cos;
							a32 = a31*-sin+a32*cos;
							a21 = t2;
						}

						if (zFlip && xFlip) {
							tm.rotation = tm.rotationX = 0;
						} else if (zFlip && yFlip) {
							tm.rotation = tm.rotationY = 0;
						} else if (yFlip && xFlip) {
							tm.rotationY = tm.rotationX = 0;
						}

						tm.scaleX = ((Math.sqrt(a11 * a11 + a21 * a21) * rnd + 0.5) | 0) / rnd;
						tm.scaleY = ((Math.sqrt(a22 * a22 + a23 * a23) * rnd + 0.5) | 0) / rnd;
						tm.scaleZ = ((Math.sqrt(a32 * a32 + a33 * a33) * rnd + 0.5) | 0) / rnd;
						tm.skewX = 0;
						tm.perspective = a43 ? 1 / ((a43 < 0) ? -a43 : a43) : 0;
						tm.x = a14;
						tm.y = a24;
						tm.z = a34;
					}

				} else if ((!_supports3D || parse || !m.length || tm.x !== m[4] || tm.y !== m[5] || (!tm.rotationX && !tm.rotationY)) && !(tm.x !== undefined && _getStyle(t, "display", cs) === "none")) { //sometimes a 6-element matrix is returned even when we performed 3D transforms, like if rotationX and rotationY are 180. In cases like this, we still need to honor the 3D transforms. If we just rely on the 2D info, it could affect how the data is interpreted, like scaleY might get set to -1 or rotation could get offset by 180 degrees. For example, do a TweenLite.to(element, 1, {css:{rotationX:180, rotationY:180}}) and then later, TweenLite.to(element, 1, {css:{rotationX:0}}) and without this conditional logic in place, it'd jump to a state of being unrotated when the 2nd tween starts. Then again, we need to honor the fact that the user COULD alter the transforms outside of CSSPlugin, like by manually applying new css, so we try to sense that by looking at x and y because if those changed, we know the changes were made outside CSSPlugin and we force a reinterpretation of the matrix values. Also, in Webkit browsers, if the element's "display" is "none", its calculated style value will always return empty, so if we've already recorded the values in the _gsTransform object, we'll just rely on those.
					var k = (m.length >= 6),
						a = k ? m[0] : 1,
						b = m[1] || 0,
						c = m[2] || 0,
						d = k ? m[3] : 1;
					tm.x = m[4] || 0;
					tm.y = m[5] || 0;
					scaleX = Math.sqrt(a * a + b * b);
					scaleY = Math.sqrt(d * d + c * c);
					rotation = (a || b) ? Math.atan2(b, a) : tm.rotation || 0; //note: if scaleX is 0, we cannot accurately measure rotation. Same for skewX with a scaleY of 0. Therefore, we default to the previously recorded value (or zero if that doesn't exist).
					skewX = (c || d) ? Math.atan2(c, d) + rotation : tm.skewX || 0;
					difX = scaleX - Math.abs(tm.scaleX || 0);
					difY = scaleY - Math.abs(tm.scaleY || 0);
					if (Math.abs(skewX) > Math.PI / 2 && Math.abs(skewX) < Math.PI * 1.5) {
						if (invX) {
							scaleX *= -1;
							skewX += (rotation <= 0) ? Math.PI : -Math.PI;
							rotation += (rotation <= 0) ? Math.PI : -Math.PI;
						} else {
							scaleY *= -1;
							skewX += (skewX <= 0) ? Math.PI : -Math.PI;
						}
					}
					difR = (rotation - tm.rotation) % Math.PI; //note: matching ranges would be very small (+/-0.0001) or very close to Math.PI (+/-3.1415).
					difS = (skewX - tm.skewX) % Math.PI;
					//if there's already a recorded _gsTransform in place for the target, we should leave those values in place unless we know things changed for sure (beyond a super small amount). This gets around ambiguous interpretations, like if scaleX and scaleY are both -1, the matrix would be the same as if the rotation was 180 with normal scaleX/scaleY. If the user tweened to particular values, those must be prioritized to ensure animation is consistent.
					if (tm.skewX === undefined || difX > min || difX < -min || difY > min || difY < -min || (difR > minPI && difR < maxPI && (difR * rnd) | 0 !== 0) || (difS > minPI && difS < maxPI && (difS * rnd) | 0 !== 0)) {
						tm.scaleX = scaleX;
						tm.scaleY = scaleY;
						tm.rotation = rotation;
						tm.skewX = skewX;
					}
					if (_supports3D) {
						tm.rotationX = tm.rotationY = tm.z = 0;
						tm.perspective = parseFloat(CSSPlugin.defaultTransformPerspective) || 0;
						tm.scaleZ = 1;
					}
				}
				tm.zOrigin = zOrigin;

				//some browsers have a hard time with very small values like 2.4492935982947064e-16 (notice the "e-" towards the end) and would render the object slightly off. So we round to 0 in these cases. The conditional logic here is faster than calling Math.abs(). Also, browsers tend to render a SLIGHTLY rotated object in a fuzzy way, so we need to snap to exactly 0 when appropriate.
				for (i in tm) {
					if (tm[i] < min) if (tm[i] > -min) {
						tm[i] = 0;
					}
				}
				//DEBUG: _log("parsed rotation: "+(tm.rotationX*_RAD2DEG)+", "+(tm.rotationY*_RAD2DEG)+", "+(tm.rotation*_RAD2DEG)+", scale: "+tm.scaleX+", "+tm.scaleY+", "+tm.scaleZ+", position: "+tm.x+", "+tm.y+", "+tm.z+", perspective: "+tm.perspective);
				if (rec) {
					t._gsTransform = tm; //record to the object's _gsTransform which we use so that tweens can control individual properties independently (we need all the properties to accurately recompose the matrix in the setRatio() method)
				}
				return tm;
			},
			//for setting 2D transforms in IE6, IE7, and IE8 (must use a "filter" to emulate the behavior of modern day browser transforms)
			_setIETransformRatio = function(v) {
				var t = this.data, //refers to the element's _gsTransform object
					ang = -t.rotation,
					skew = ang + t.skewX,
					rnd = 100000,
					a = ((Math.cos(ang) * t.scaleX * rnd) | 0) / rnd,
					b = ((Math.sin(ang) * t.scaleX * rnd) | 0) / rnd,
					c = ((Math.sin(skew) * -t.scaleY * rnd) | 0) / rnd,
					d = ((Math.cos(skew) * t.scaleY * rnd) | 0) / rnd,
					style = this.t.style,
					cs = this.t.currentStyle,
					filters, val;
				if (!cs) {
					return;
				}
				val = b; //just for swapping the variables an inverting them (reused "val" to avoid creating another variable in memory). IE's filter matrix uses a non-standard matrix configuration (angle goes the opposite way, and b and c are reversed and inverted)
				b = -c;
				c = -val;
				filters = cs.filter;
				style.filter = ""; //remove filters so that we can accurately measure offsetWidth/offsetHeight
				var w = this.t.offsetWidth,
					h = this.t.offsetHeight,
					clip = (cs.position !== "absolute"),
					m = "progid:DXImageTransform.Microsoft.Matrix(M11=" + a + ", M12=" + b + ", M21=" + c + ", M22=" + d,
					ox = t.x,
					oy = t.y,
					dx, dy;

				//if transformOrigin is being used, adjust the offset x and y
				if (t.ox != null) {
					dx = ((t.oxp) ? w * t.ox * 0.01 : t.ox) - w / 2;
					dy = ((t.oyp) ? h * t.oy * 0.01 : t.oy) - h / 2;
					ox += dx - (dx * a + dy * b);
					oy += dy - (dx * c + dy * d);
				}

				if (!clip) {
					m += ", sizingMethod='auto expand')";
				} else {
					dx = (w / 2);
					dy = (h / 2);
					//translate to ensure that transformations occur around the correct origin (default is center).
					m += ", Dx=" + (dx - (dx * a + dy * b) + ox) + ", Dy=" + (dy - (dx * c + dy * d) + oy) + ")";
				}
				if (filters.indexOf("DXImageTransform.Microsoft.Matrix(") !== -1) {
					style.filter = filters.replace(_ieSetMatrixExp, m);
				} else {
					style.filter = m + " " + filters; //we must always put the transform/matrix FIRST (before alpha(opacity=xx)) to avoid an IE bug that slices part of the object when rotation is applied with alpha.
				}

				//at the end or beginning of the tween, if the matrix is normal (1, 0, 0, 1) and opacity is 100 (or doesn't exist), remove the filter to improve browser performance.
				if (v === 0 || v === 1) if (a === 1) if (b === 0) if (c === 0) if (d === 1) if (!clip || m.indexOf("Dx=0, Dy=0") !== -1) if (!_opacityExp.test(filters) || parseFloat(RegExp.$1) === 100) if (filters.indexOf("gradient(" && filters.indexOf("Alpha")) === -1) {
					style.removeAttribute("filter");
				}

				//we must set the margins AFTER applying the filter in order to avoid some bugs in IE8 that could (in rare scenarios) cause them to be ignored intermittently (vibration).
				if (!clip) {
					var mult = (_ieVers < 8) ? 1 : -1, //in Internet Explorer 7 and before, the box model is broken, causing the browser to treat the width/height of the actual rotated filtered image as the width/height of the box itself, but Microsoft corrected that in IE8. We must use a negative offset in IE8 on the right/bottom
						marg, prop, dif;
					dx = t.ieOffsetX || 0;
					dy = t.ieOffsetY || 0;
					t.ieOffsetX = Math.round((w - ((a < 0 ? -a : a) * w + (b < 0 ? -b : b) * h)) / 2 + ox);
					t.ieOffsetY = Math.round((h - ((d < 0 ? -d : d) * h + (c < 0 ? -c : c) * w)) / 2 + oy);
					for (i = 0; i < 4; i++) {
						prop = _margins[i];
						marg = cs[prop];
						//we need to get the current margin in case it is being tweened separately (we want to respect that tween's changes)
						val = (marg.indexOf("px") !== -1) ? parseFloat(marg) : _convertToPixels(this.t, prop, parseFloat(marg), marg.replace(_suffixExp, "")) || 0;
						if (val !== t[prop]) {
							dif = (i < 2) ? -t.ieOffsetX : -t.ieOffsetY; //if another tween is controlling a margin, we cannot only apply the difference in the ieOffsets, so we essentially zero-out the dx and dy here in that case. We record the margin(s) later so that we can keep comparing them, making this code very flexible.
						} else {
							dif = (i < 2) ? dx - t.ieOffsetX : dy - t.ieOffsetY;
						}
						style[prop] = (t[prop] = Math.round( val - dif * ((i === 0 || i === 2) ? 1 : mult) )) + "px";
					}
				}
			},

			_set3DTransformRatio = function(v) {
				var t = this.data, //refers to the element's _gsTransform object
					style = this.t.style,
					angle = t.rotation,
					sx = t.scaleX,
					sy = t.scaleY,
					sz = t.scaleZ,
					perspective = t.perspective,
					a11, a12, a13, a14,	a21, a22, a23, a24, a31, a32, a33, a34,	a41, a42, a43,
					zOrigin, rnd, cos, sin, t1, t2, t3, t4, ffProp, n, sfx;
				if (_isFirefox) { //Firefox has a bug that causes 3D elements to randomly disappear during animation unless a repaint is forced. One way to do this is change "top" or "bottom" by 0.05 which is imperceptible, so we go back and forth. Another way is to change the display to "none", read the clientTop, and then revert the display but that is much slower.
					ffProp = style.top ? "top" : style.bottom ? "bottom" : parseFloat(_getStyle(this.t, "top", null, false)) ? "bottom" : "top";
					t1 = _getStyle(this.t, ffProp, null, false);
					n = parseFloat(t1) || 0;
					sfx = t1.substr((n + "").length) || "px";
					t._ffFix = !t._ffFix;
					style[ffProp] = (t._ffFix ? n + 0.05 : n - 0.05) + sfx;
				}
				if (angle || t.skewX) {
					cos = Math.cos(angle);
					sin = Math.sin(angle);
					a11 = cos;
					a21 = sin;
					if (t.skewX) {
						angle -= t.skewX;
						cos = Math.cos(angle);
						sin = Math.sin(angle);
					}
					a12 = -sin;
					a22 = cos;
				} else if (!t.rotationY && !t.rotationX && sz === 1 && !perspective) { //if we're only translating and/or 2D scaling, this is faster...
					style[_transformProp] = "translate3d(" + t.x + "px," + t.y + "px," + t.z +"px)" + ((sx !== 1 || sy !== 1) ? " scale(" + sx + "," + sy + ")" : "");
					return;
				} else {
					a11 = a22 = 1;
					a12 = a21 = 0;
				}
				a33 = 1;
				a13 = a14 = a23 = a24 = a31 = a32 = a34 = a41 = a42 = 0;
				a43 = (perspective) ? -1 / perspective : 0;
				zOrigin = t.zOrigin;
				rnd = 100000;
				angle = t.rotationY;
				if (angle) {
					cos = Math.cos(angle);
					sin = Math.sin(angle);
					a31 = a33*-sin;
					a41 = a43*-sin;
					a13 = a11*sin;
					a23 = a21*sin;
					a33 *= cos;
					a43 *= cos;
					a11 *= cos;
					a21 *= cos;
				}
				angle = t.rotationX;
				if (angle) {
					cos = Math.cos(angle);
					sin = Math.sin(angle);
					t1 = a12*cos+a13*sin;
					t2 = a22*cos+a23*sin;
					t3 = a32*cos+a33*sin;
					t4 = a42*cos+a43*sin;
					a13 = a12*-sin+a13*cos;
					a23 = a22*-sin+a23*cos;
					a33 = a32*-sin+a33*cos;
					a43 = a42*-sin+a43*cos;
					a12 = t1;
					a22 = t2;
					a32 = t3;
					a42 = t4;
				}
				if (sz !== 1) {
					a13*=sz;
					a23*=sz;
					a33*=sz;
					a43*=sz;
				}
				if (sy !== 1) {
					a12*=sy;
					a22*=sy;
					a32*=sy;
					a42*=sy;
				}
				if (sx !== 1) {
					a11*=sx;
					a21*=sx;
					a31*=sx;
					a41*=sx;
				}
				if (zOrigin) {
					a34 -= zOrigin;
					a14 = a13*a34;
					a24 = a23*a34;
					a34 = a33*a34+zOrigin;
				}
				//we round the x, y, and z slightly differently to allow even larger values.
				a14 = (t1 = (a14 += t.x) - (a14 |= 0)) ? ((t1 * rnd + (t1 < 0 ? -0.5 : 0.5)) | 0) / rnd + a14 : a14;
				a24 = (t1 = (a24 += t.y) - (a24 |= 0)) ? ((t1 * rnd + (t1 < 0 ? -0.5 : 0.5)) | 0) / rnd + a24 : a24;
				a34 = (t1 = (a34 += t.z) - (a34 |= 0)) ? ((t1 * rnd + (t1 < 0 ? -0.5 : 0.5)) | 0) / rnd + a34 : a34;
				style[_transformProp] = "matrix3d(" + [ (((a11 * rnd) | 0) / rnd), (((a21 * rnd) | 0) / rnd), (((a31 * rnd) | 0) / rnd), (((a41 * rnd) | 0) / rnd), (((a12 * rnd) | 0) / rnd), (((a22 * rnd) | 0) / rnd), (((a32 * rnd) | 0) / rnd), (((a42 * rnd) | 0) / rnd), (((a13 * rnd) | 0) / rnd), (((a23 * rnd) | 0) / rnd), (((a33 * rnd) | 0) / rnd), (((a43 * rnd) | 0) / rnd), a14, a24, a34, (perspective ? (1 + (-a34 / perspective)) : 1) ].join(",") + ")";
			},

			_set2DTransformRatio = function(v) {
				var t = this.data, //refers to the element's _gsTransform object
					targ = this.t,
					style = targ.style,
					ffProp, t1, n, sfx, ang, skew, rnd, sx, sy;
				if (_isFirefox) { //Firefox has a bug that causes elements to randomly disappear during animation unless a repaint is forced. One way to do this is change "top" or "bottom" by 0.05 which is imperceptible, so we go back and forth. Another way is to change the display to "none", read the clientTop, and then revert the display but that is much slower.
					ffProp = style.top ? "top" : style.bottom ? "bottom" : parseFloat(_getStyle(targ, "top", null, false)) ? "bottom" : "top";
					t1 = _getStyle(targ, ffProp, null, false);
					n = parseFloat(t1) || 0;
					sfx = t1.substr((n + "").length) || "px";
					t._ffFix = !t._ffFix;
					style[ffProp] = (t._ffFix ? n + 0.05 : n - 0.05) + sfx;
				}
				if (!t.rotation && !t.skewX) {
					style[_transformProp] = "matrix(" + t.scaleX + ",0,0," + t.scaleY + "," + t.x + "," + t.y + ")";
				} else {
					ang = t.rotation;
					skew = ang - t.skewX;
					rnd = 100000;
					sx = t.scaleX * rnd;
					sy = t.scaleY * rnd;
					//some browsers have a hard time with very small values like 2.4492935982947064e-16 (notice the "e-" towards the end) and would render the object slightly off. So we round to 5 decimal places.
					style[_transformProp] = "matrix(" + (((Math.cos(ang) * sx) | 0) / rnd) + "," + (((Math.sin(ang) * sx) | 0) / rnd) + "," + (((Math.sin(skew) * -sy) | 0) / rnd) + "," + (((Math.cos(skew) * sy) | 0) / rnd) + "," + t.x + "," + t.y + ")";
				}
			};

		_registerComplexSpecialProp("transform,scale,scaleX,scaleY,scaleZ,x,y,z,rotation,rotationX,rotationY,rotationZ,skewX,skewY,shortRotation,shortRotationX,shortRotationY,shortRotationZ,transformOrigin,transformPerspective,directionalRotation,parseTransform,force3D", {parser:function(t, e, p, cssp, pt, plugin, vars) {
			if (cssp._transform) { return pt; } //only need to parse the transform once, and only if the browser supports it.
			var m1 = cssp._transform = _getTransform(t, _cs, true, vars.parseTransform),
				style = t.style,
				min = 0.000001,
				i = _transformProps.length,
				v = vars,
				endRotations = {},
				m2, skewY, copy, orig, has3D, hasChange, dr;

			if (typeof(v.transform) === "string" && _transformProp) { //for values like transform:"rotate(60deg) scale(0.5, 0.8)"
				copy = style.cssText;
				style[_transformProp] = v.transform;
				style.display = "block"; //if display is "none", the browser often refuses to report the transform properties correctly.
				m2 = _getTransform(t, null, false);
				style.cssText = copy;
			} else if (typeof(v) === "object") { //for values like scaleX, scaleY, rotation, x, y, skewX, and skewY or transform:{...} (object)
				m2 = {scaleX:_parseVal((v.scaleX != null) ? v.scaleX : v.scale, m1.scaleX),
					scaleY:_parseVal((v.scaleY != null) ? v.scaleY : v.scale, m1.scaleY),
					scaleZ:_parseVal((v.scaleZ != null) ? v.scaleZ : v.scale, m1.scaleZ),
					x:_parseVal(v.x, m1.x),
					y:_parseVal(v.y, m1.y),
					z:_parseVal(v.z, m1.z),
					perspective:_parseVal(v.transformPerspective, m1.perspective)};
				dr = v.directionalRotation;
				if (dr != null) {
					if (typeof(dr) === "object") {
						for (copy in dr) {
							v[copy] = dr[copy];
						}
					} else {
						v.rotation = dr;
					}
				}
				m2.rotation = _parseAngle(("rotation" in v) ? v.rotation : ("shortRotation" in v) ? v.shortRotation + "_short" : ("rotationZ" in v) ? v.rotationZ : (m1.rotation * _RAD2DEG), m1.rotation, "rotation", endRotations);
				if (_supports3D) {
					m2.rotationX = _parseAngle(("rotationX" in v) ? v.rotationX : ("shortRotationX" in v) ? v.shortRotationX + "_short" : (m1.rotationX * _RAD2DEG) || 0, m1.rotationX, "rotationX", endRotations);
					m2.rotationY = _parseAngle(("rotationY" in v) ? v.rotationY : ("shortRotationY" in v) ? v.shortRotationY + "_short" : (m1.rotationY * _RAD2DEG) || 0, m1.rotationY, "rotationY", endRotations);
				}
				m2.skewX = (v.skewX == null) ? m1.skewX : _parseAngle(v.skewX, m1.skewX);

				//note: for performance reasons, we combine all skewing into the skewX and rotation values, ignoring skewY but we must still record it so that we can discern how much of the overall skew is attributed to skewX vs. skewY. Otherwise, if the skewY would always act relative (tween skewY to 10deg, for example, multiple times and if we always combine things into skewX, we can't remember that skewY was 10 from last time). Remember, a skewY of 10 degrees looks the same as a rotation of 10 degrees plus a skewX of -10 degrees.
				m2.skewY = (v.skewY == null) ? m1.skewY : _parseAngle(v.skewY, m1.skewY);
				if ((skewY = m2.skewY - m1.skewY)) {
					m2.skewX += skewY;
					m2.rotation += skewY;
				}
			}

			if (v.force3D != null) {
				m1.force3D = v.force3D;
				hasChange = true;
			}

			has3D = (m1.force3D || m1.z || m1.rotationX || m1.rotationY || m2.z || m2.rotationX || m2.rotationY || m2.perspective);
			if (!has3D && v.scale != null) {
				m2.scaleZ = 1; //no need to tween scaleZ.
			}

			while (--i > -1) {
				p = _transformProps[i];
				orig = m2[p] - m1[p];
				if (orig > min || orig < -min || _forcePT[p] != null) {
					hasChange = true;
					pt = new CSSPropTween(m1, p, m1[p], orig, pt);
					if (p in endRotations) {
						pt.e = endRotations[p]; //directional rotations typically have compensated values during the tween, but we need to make sure they end at exactly what the user requested
					}
					pt.xs0 = 0; //ensures the value stays numeric in setRatio()
					pt.plugin = plugin;
					cssp._overwriteProps.push(pt.n);
				}
			}

			orig = v.transformOrigin;
			if (orig || (_supports3D && has3D && m1.zOrigin)) { //if anything 3D is happening and there's a transformOrigin with a z component that's non-zero, we must ensure that the transformOrigin's z-component is set to 0 so that we can manually do those calculations to get around Safari bugs. Even if the user didn't specifically define a "transformOrigin" in this particular tween (maybe they did it via css directly).
				if (_transformProp) {
					hasChange = true;
					p = _transformOriginProp;
					orig = (orig || _getStyle(t, p, _cs, false, "50% 50%")) + ""; //cast as string to avoid errors
					pt = new CSSPropTween(style, p, 0, 0, pt, -1, "transformOrigin");
					pt.b = style[p];
					pt.plugin = plugin;
					if (_supports3D) {
						copy = m1.zOrigin;
						orig = orig.split(" ");
						m1.zOrigin = ((orig.length > 2 && !(copy !== 0 && orig[2] === "0px")) ? parseFloat(orig[2]) : copy) || 0; //Safari doesn't handle the z part of transformOrigin correctly, so we'll manually handle it in the _set3DTransformRatio() method.
						pt.xs0 = pt.e = style[p] = orig[0] + " " + (orig[1] || "50%") + " 0px"; //we must define a z value of 0px specifically otherwise iOS 5 Safari will stick with the old one (if one was defined)!
						pt = new CSSPropTween(m1, "zOrigin", 0, 0, pt, -1, pt.n); //we must create a CSSPropTween for the _gsTransform.zOrigin so that it gets reset properly at the beginning if the tween runs backward (as opposed to just setting m1.zOrigin here)
						pt.b = copy;
						pt.xs0 = pt.e = m1.zOrigin;
					} else {
						pt.xs0 = pt.e = style[p] = orig;
					}

				//for older versions of IE (6-8), we need to manually calculate things inside the setRatio() function. We record origin x and y (ox and oy) and whether or not the values are percentages (oxp and oyp).
				} else {
					_parsePosition(orig + "", m1);
				}
			}

			if (hasChange) {
				cssp._transformType = (has3D || this._transformType === 3) ? 3 : 2; //quicker than calling cssp._enableTransforms();
			}
			return pt;
		}, prefix:true});

		_registerComplexSpecialProp("boxShadow", {defaultValue:"0px 0px 0px 0px #999", prefix:true, color:true, multi:true, keyword:"inset"});

		_registerComplexSpecialProp("borderRadius", {defaultValue:"0px", parser:function(t, e, p, cssp, pt, plugin) {
			e = this.format(e);
			var props = ["borderTopLeftRadius","borderTopRightRadius","borderBottomRightRadius","borderBottomLeftRadius"],
				style = t.style,
				ea1, i, es2, bs2, bs, es, bn, en, w, h, esfx, bsfx, rel, hn, vn, em;
			w = parseFloat(t.offsetWidth);
			h = parseFloat(t.offsetHeight);
			ea1 = e.split(" ");
			for (i = 0; i < props.length; i++) { //if we're dealing with percentages, we must convert things separately for the horizontal and vertical axis!
				if (this.p.indexOf("border")) { //older browsers used a prefix
					props[i] = _checkPropPrefix(props[i]);
				}
				bs = bs2 = _getStyle(t, props[i], _cs, false, "0px");
				if (bs.indexOf(" ") !== -1) {
					bs2 = bs.split(" ");
					bs = bs2[0];
					bs2 = bs2[1];
				}
				es = es2 = ea1[i];
				bn = parseFloat(bs);
				bsfx = bs.substr((bn + "").length);
				rel = (es.charAt(1) === "=");
				if (rel) {
					en = parseInt(es.charAt(0)+"1", 10);
					es = es.substr(2);
					en *= parseFloat(es);
					esfx = es.substr((en + "").length - (en < 0 ? 1 : 0)) || "";
				} else {
					en = parseFloat(es);
					esfx = es.substr((en + "").length);
				}
				if (esfx === "") {
					esfx = _suffixMap[p] || bsfx;
				}
				if (esfx !== bsfx) {
					hn = _convertToPixels(t, "borderLeft", bn, bsfx); //horizontal number (we use a bogus "borderLeft" property just because the _convertToPixels() method searches for the keywords "Left", "Right", "Top", and "Bottom" to determine of it's a horizontal or vertical property, and we need "border" in the name so that it knows it should measure relative to the element itself, not its parent.
					vn = _convertToPixels(t, "borderTop", bn, bsfx); //vertical number
					if (esfx === "%") {
						bs = (hn / w * 100) + "%";
						bs2 = (vn / h * 100) + "%";
					} else if (esfx === "em") {
						em = _convertToPixels(t, "borderLeft", 1, "em");
						bs = (hn / em) + "em";
						bs2 = (vn / em) + "em";
					} else {
						bs = hn + "px";
						bs2 = vn + "px";
					}
					if (rel) {
						es = (parseFloat(bs) + en) + esfx;
						es2 = (parseFloat(bs2) + en) + esfx;
					}
				}
				pt = _parseComplex(style, props[i], bs + " " + bs2, es + " " + es2, false, "0px", pt);
			}
			return pt;
		}, prefix:true, formatter:_getFormatter("0px 0px 0px 0px", false, true)});
		_registerComplexSpecialProp("backgroundPosition", {defaultValue:"0 0", parser:function(t, e, p, cssp, pt, plugin) {
			var bp = "background-position",
				cs = (_cs || _getComputedStyle(t, null)),
				bs = this.format( ((cs) ? _ieVers ? cs.getPropertyValue(bp + "-x") + " " + cs.getPropertyValue(bp + "-y") : cs.getPropertyValue(bp) : t.currentStyle.backgroundPositionX + " " + t.currentStyle.backgroundPositionY) || "0 0"), //Internet Explorer doesn't report background-position correctly - we must query background-position-x and background-position-y and combine them (even in IE10). Before IE9, we must do the same with the currentStyle object and use camelCase
				es = this.format(e),
				ba, ea, i, pct, overlap, src;
			if ((bs.indexOf("%") !== -1) !== (es.indexOf("%") !== -1)) {
				src = _getStyle(t, "backgroundImage").replace(_urlExp, "");
				if (src && src !== "none") {
					ba = bs.split(" ");
					ea = es.split(" ");
					_tempImg.setAttribute("src", src); //set the temp <img>'s src to the background-image so that we can measure its width/height
					i = 2;
					while (--i > -1) {
						bs = ba[i];
						pct = (bs.indexOf("%") !== -1);
						if (pct !== (ea[i].indexOf("%") !== -1)) {
							overlap = (i === 0) ? t.offsetWidth - _tempImg.width : t.offsetHeight - _tempImg.height;
							ba[i] = pct ? (parseFloat(bs) / 100 * overlap) + "px" : (parseFloat(bs) / overlap * 100) + "%";
						}
					}
					bs = ba.join(" ");
				}
			}
			return this.parseComplex(t.style, bs, es, pt, plugin);
		}, formatter:_parsePosition});
		_registerComplexSpecialProp("backgroundSize", {defaultValue:"0 0", formatter:_parsePosition});
		_registerComplexSpecialProp("perspective", {defaultValue:"0px", prefix:true});
		_registerComplexSpecialProp("perspectiveOrigin", {defaultValue:"50% 50%", prefix:true});
		_registerComplexSpecialProp("transformStyle", {prefix:true});
		_registerComplexSpecialProp("backfaceVisibility", {prefix:true});
		_registerComplexSpecialProp("margin", {parser:_getEdgeParser("marginTop,marginRight,marginBottom,marginLeft")});
		_registerComplexSpecialProp("padding", {parser:_getEdgeParser("paddingTop,paddingRight,paddingBottom,paddingLeft")});
		_registerComplexSpecialProp("clip", {defaultValue:"rect(0px,0px,0px,0px)", parser:function(t, e, p, cssp, pt, plugin){
			var b, cs, delim;
			if (_ieVers < 9) { //IE8 and earlier don't report a "clip" value in the currentStyle - instead, the values are split apart into clipTop, clipRight, clipBottom, and clipLeft. Also, in IE7 and earlier, the values inside rect() are space-delimited, not comma-delimited.
				cs = t.currentStyle;
				delim = _ieVers < 8 ? " " : ",";
				b = "rect(" + cs.clipTop + delim + cs.clipRight + delim + cs.clipBottom + delim + cs.clipLeft + ")";
				e = this.format(e).split(",").join(delim);
			} else {
				b = this.format(_getStyle(t, this.p, _cs, false, this.dflt));
				e = this.format(e);
			}
			return this.parseComplex(t.style, b, e, pt, plugin);
		}});
		_registerComplexSpecialProp("textShadow", {defaultValue:"0px 0px 0px #999", color:true, multi:true});
		_registerComplexSpecialProp("autoRound,strictUnits", {parser:function(t, e, p, cssp, pt) {return pt;}}); //just so that we can ignore these properties (not tween them)
		_registerComplexSpecialProp("border", {defaultValue:"0px solid #000", parser:function(t, e, p, cssp, pt, plugin) {
				return this.parseComplex(t.style, this.format(_getStyle(t, "borderTopWidth", _cs, false, "0px") + " " + _getStyle(t, "borderTopStyle", _cs, false, "solid") + " " + _getStyle(t, "borderTopColor", _cs, false, "#000")), this.format(e), pt, plugin);
			}, color:true, formatter:function(v) {
				var a = v.split(" ");
				return a[0] + " " + (a[1] || "solid") + " " + (v.match(_colorExp) || ["#000"])[0];
			}});
		_registerComplexSpecialProp("float,cssFloat,styleFloat", {parser:function(t, e, p, cssp, pt, plugin) {
			var s = t.style,
				prop = ("cssFloat" in s) ? "cssFloat" : "styleFloat";
			return new CSSPropTween(s, prop, 0, 0, pt, -1, p, false, 0, s[prop], e);
		}});

		//opacity-related
		var _setIEOpacityRatio = function(v) {
				var t = this.t, //refers to the element's style property
					filters = t.filter || _getStyle(this.data, "filter"),
					val = (this.s + this.c * v) | 0,
					skip;
				if (val === 100) { //for older versions of IE that need to use a filter to apply opacity, we should remove the filter if opacity hits 1 in order to improve performance, but make sure there isn't a transform (matrix) or gradient in the filters.
					if (filters.indexOf("atrix(") === -1 && filters.indexOf("radient(") === -1 && filters.indexOf("oader(") === -1) {
						t.removeAttribute("filter");
						skip = (!_getStyle(this.data, "filter")); //if a class is applied that has an alpha filter, it will take effect (we don't want that), so re-apply our alpha filter in that case. We must first remove it and then check.
					} else {
						t.filter = filters.replace(_alphaFilterExp, "");
						skip = true;
					}
				}
				if (!skip) {
					if (this.xn1) {
						t.filter = filters = filters || ("alpha(opacity=" + val + ")"); //works around bug in IE7/8 that prevents changes to "visibility" from being applied properly if the filter is changed to a different alpha on the same frame.
					}
					if (filters.indexOf("opacity") === -1) { //only used if browser doesn't support the standard opacity style property (IE 7 and 8)
						if (val !== 0 || !this.xn1) { //bugs in IE7/8 won't render the filter properly if opacity is ADDED on the same frame/render as "visibility" changes (this.xn1 is 1 if this tween is an "autoAlpha" tween)
							t.filter = filters + " alpha(opacity=" + val + ")"; //we round the value because otherwise, bugs in IE7/8 can prevent "visibility" changes from being applied properly.
						}
					} else {
						t.filter = filters.replace(_opacityExp, "opacity=" + val);
					}
				}
			};
		_registerComplexSpecialProp("opacity,alpha,autoAlpha", {defaultValue:"1", parser:function(t, e, p, cssp, pt, plugin) {
			var b = parseFloat(_getStyle(t, "opacity", _cs, false, "1")),
				style = t.style,
				isAutoAlpha = (p === "autoAlpha");
			e = parseFloat(e);
			if (isAutoAlpha && b === 1 && _getStyle(t, "visibility", _cs) === "hidden" && e !== 0) { //if visibility is initially set to "hidden", we should interpret that as intent to make opacity 0 (a convenience)
				b = 0;
			}
			if (_supportsOpacity) {
				pt = new CSSPropTween(style, "opacity", b, e - b, pt);
			} else {
				pt = new CSSPropTween(style, "opacity", b * 100, (e - b) * 100, pt);
				pt.xn1 = isAutoAlpha ? 1 : 0; //we need to record whether or not this is an autoAlpha so that in the setRatio(), we know to duplicate the setting of the alpha in order to work around a bug in IE7 and IE8 that prevents changes to "visibility" from taking effect if the filter is changed to a different alpha(opacity) at the same time. Setting it to the SAME value first, then the new value works around the IE7/8 bug.
				style.zoom = 1; //helps correct an IE issue.
				pt.type = 2;
				pt.b = "alpha(opacity=" + pt.s + ")";
				pt.e = "alpha(opacity=" + (pt.s + pt.c) + ")";
				pt.data = t;
				pt.plugin = plugin;
				pt.setRatio = _setIEOpacityRatio;
			}
			if (isAutoAlpha) { //we have to create the "visibility" PropTween after the opacity one in the linked list so that they run in the order that works properly in IE8 and earlier
				pt = new CSSPropTween(style, "visibility", 0, 0, pt, -1, null, false, 0, ((b !== 0) ? "inherit" : "hidden"), ((e === 0) ? "hidden" : "inherit"));
				pt.xs0 = "inherit";
				cssp._overwriteProps.push(pt.n);
				cssp._overwriteProps.push(p);
			}
			return pt;
		}});


		var _removeProp = function(s, p) {
				if (p) {
					if (s.removeProperty) {
						s.removeProperty(p.replace(_capsExp, "-$1").toLowerCase());
					} else { //note: old versions of IE use "removeAttribute()" instead of "removeProperty()"
						s.removeAttribute(p);
					}
				}
			},
			_setClassNameRatio = function(v) {
				this.t._gsClassPT = this;
				if (v === 1 || v === 0) {
					this.t.className = (v === 0) ? this.b : this.e;
					var mpt = this.data, //first MiniPropTween
						s = this.t.style;
					while (mpt) {
						if (!mpt.v) {
							_removeProp(s, mpt.p);
						} else {
							s[mpt.p] = mpt.v;
						}
						mpt = mpt._next;
					}
					if (v === 1 && this.t._gsClassPT === this) {
						this.t._gsClassPT = null;
					}
				} else if (this.t.className !== this.e) {
					this.t.className = this.e;
				}
			};
		_registerComplexSpecialProp("className", {parser:function(t, e, p, cssp, pt, plugin, vars) {
			var b = t.className,
				cssText = t.style.cssText,
				difData, bs, cnpt, cnptLookup, mpt;
			pt = cssp._classNamePT = new CSSPropTween(t, p, 0, 0, pt, 2);
			pt.setRatio = _setClassNameRatio;
			pt.pr = -11;
			_hasPriority = true;
			pt.b = b;
			bs = _getAllStyles(t, _cs);
			//if there's a className tween already operating on the target, force it to its end so that the necessary inline styles are removed and the class name is applied before we determine the end state (we don't want inline styles interfering that were there just for class-specific values)
			cnpt = t._gsClassPT;
			if (cnpt) {
				cnptLookup = {};
				mpt = cnpt.data; //first MiniPropTween which stores the inline styles - we need to force these so that the inline styles don't contaminate things. Otherwise, there's a small chance that a tween could start and the inline values match the destination values and they never get cleaned.
				while (mpt) {
					cnptLookup[mpt.p] = 1;
					mpt = mpt._next;
				}
				cnpt.setRatio(1);
			}
			t._gsClassPT = pt;
			pt.e = (e.charAt(1) !== "=") ? e : b.replace(new RegExp("\\s*\\b" + e.substr(2) + "\\b"), "") + ((e.charAt(0) === "+") ? " " + e.substr(2) : "");
			if (cssp._tween._duration) { //if it's a zero-duration tween, there's no need to tween anything or parse the data. In fact, if we switch classes temporarily (which we must do for proper parsing) and the class has a transition applied, it could cause a quick flash to the end state and back again initially in some browsers.
				t.className = pt.e;
				difData = _cssDif(t, bs, _getAllStyles(t), vars, cnptLookup);
				t.className = b;
				pt.data = difData.firstMPT;
				t.style.cssText = cssText; //we recorded cssText before we swapped classes and ran _getAllStyles() because in cases when a className tween is overwritten, we remove all the related tweening properties from that class change (otherwise class-specific stuff can't override properties we've directly set on the target's style object due to specificity).
				pt = pt.xfirst = cssp.parse(t, difData.difs, pt, plugin); //we record the CSSPropTween as the xfirst so that we can handle overwriting propertly (if "className" gets overwritten, we must kill all the properties associated with the className part of the tween, so we can loop through from xfirst to the pt itself)
			}
			return pt;
		}});


		var _setClearPropsRatio = function(v) {
			if (v === 1 || v === 0) if (this.data._totalTime === this.data._totalDuration) { //this.data refers to the tween. Only clear at the END of the tween (remember, from() tweens make the ratio go from 1 to 0, so we can't just check that).
				var s = this.t.style,
					transformParse = _specialProps.transform.parse,
					a, p, i, clearTransform;
				if (this.e === "all") {
					s.cssText = "";
					clearTransform = true;
				} else {
					a = this.e.split(",");
					i = a.length;
					while (--i > -1) {
						p = a[i];
						if (_specialProps[p]) {
							if (_specialProps[p].parse === transformParse) {
								clearTransform = true;
							} else {
								p = (p === "transformOrigin") ? _transformOriginProp : _specialProps[p].p; //ensures that special properties use the proper browser-specific property name, like "scaleX" might be "-webkit-transform" or "boxShadow" might be "-moz-box-shadow"
							}
						}
						_removeProp(s, p);
					}
				}
				if (clearTransform) {
					_removeProp(s, _transformProp);
					if (this.t._gsTransform) {
						delete this.t._gsTransform;
					}
				}

			}
		};
		_registerComplexSpecialProp("clearProps", {parser:function(t, e, p, cssp, pt) {
			pt = new CSSPropTween(t, p, 0, 0, pt, 2);
			pt.setRatio = _setClearPropsRatio;
			pt.e = e;
			pt.pr = -10;
			pt.data = cssp._tween;
			_hasPriority = true;
			return pt;
		}});

		p = "bezier,throwProps,physicsProps,physics2D".split(",");
		i = p.length;
		while (i--) {
			_registerPluginProp(p[i]);
		}








		p = CSSPlugin.prototype;
		p._firstPT = null;

		//gets called when the tween renders for the first time. This kicks everything off, recording start/end values, etc.
		p._onInitTween = function(target, vars, tween) {
			if (!target.nodeType) { //css is only for dom elements
				return false;
			}
			this._target = target;
			this._tween = tween;
			this._vars = vars;
			_autoRound = vars.autoRound;
			_hasPriority = false;
			_suffixMap = vars.suffixMap || CSSPlugin.suffixMap;
			_cs = _getComputedStyle(target, "");
			_overwriteProps = this._overwriteProps;
			var style = target.style,
				v, pt, pt2, first, last, next, zIndex, tpt, threeD;
			if (_reqSafariFix) if (style.zIndex === "") {
				v = _getStyle(target, "zIndex", _cs);
				if (v === "auto" || v === "") {
					//corrects a bug in [non-Android] Safari that prevents it from repainting elements in their new positions if they don't have a zIndex set. We also can't just apply this inside _parseTransform() because anything that's moved in any way (like using "left" or "top" instead of transforms like "x" and "y") can be affected, so it is best to ensure that anything that's tweening has a z-index. Setting "WebkitPerspective" to a non-zero value worked too except that on iOS Safari things would flicker randomly. Plus zIndex is less memory-intensive.
					style.zIndex = 0;
				}
			}

			if (typeof(vars) === "string") {
				first = style.cssText;
				v = _getAllStyles(target, _cs);
				style.cssText = first + ";" + vars;
				v = _cssDif(target, v, _getAllStyles(target)).difs;
				if (!_supportsOpacity && _opacityValExp.test(vars)) {
					v.opacity = parseFloat( RegExp.$1 );
				}
				vars = v;
				style.cssText = first;
			}
			this._firstPT = pt = this.parse(target, vars, null);

			if (this._transformType) {
				threeD = (this._transformType === 3);
				if (!_transformProp) {
					style.zoom = 1; //helps correct an IE issue.
				} else if (_isSafari) {
					_reqSafariFix = true;
					//if zIndex isn't set, iOS Safari doesn't repaint things correctly sometimes (seemingly at random).
					if (style.zIndex === "") {
						zIndex = _getStyle(target, "zIndex", _cs);
						if (zIndex === "auto" || zIndex === "") {
							style.zIndex = 0;
						}
					}
					//Setting WebkitBackfaceVisibility corrects 3 bugs:
					// 1) [non-Android] Safari skips rendering changes to "top" and "left" that are made on the same frame/render as a transform update.
					// 2) iOS Safari sometimes neglects to repaint elements in their new positions. Setting "WebkitPerspective" to a non-zero value worked too except that on iOS Safari things would flicker randomly.
					// 3) Safari sometimes displayed odd artifacts when tweening the transform (or WebkitTransform) property, like ghosts of the edges of the element remained. Definitely a browser bug.
					//Note: we allow the user to override the auto-setting by defining WebkitBackfaceVisibility in the vars of the tween.
					if (_isSafariLT6) {
						style.WebkitBackfaceVisibility = this._vars.WebkitBackfaceVisibility || (threeD ? "visible" : "hidden");
					}
				}
				pt2 = pt;
				while (pt2 && pt2._next) {
					pt2 = pt2._next;
				}
				tpt = new CSSPropTween(target, "transform", 0, 0, null, 2);
				this._linkCSSP(tpt, null, pt2);
				tpt.setRatio = (threeD && _supports3D) ? _set3DTransformRatio : _transformProp ? _set2DTransformRatio : _setIETransformRatio;
				tpt.data = this._transform || _getTransform(target, _cs, true);
				_overwriteProps.pop(); //we don't want to force the overwrite of all "transform" tweens of the target - we only care about individual transform properties like scaleX, rotation, etc. The CSSPropTween constructor automatically adds the property to _overwriteProps which is why we need to pop() here.
			}

			if (_hasPriority) {
				//reorders the linked list in order of pr (priority)
				while (pt) {
					next = pt._next;
					pt2 = first;
					while (pt2 && pt2.pr > pt.pr) {
						pt2 = pt2._next;
					}
					if ((pt._prev = pt2 ? pt2._prev : last)) {
						pt._prev._next = pt;
					} else {
						first = pt;
					}
					if ((pt._next = pt2)) {
						pt2._prev = pt;
					} else {
						last = pt;
					}
					pt = next;
				}
				this._firstPT = first;
			}
			return true;
		};


		p.parse = function(target, vars, pt, plugin) {
			var style = target.style,
				p, sp, bn, en, bs, es, bsfx, esfx, isStr, rel;
			for (p in vars) {
				es = vars[p]; //ending value string
				sp = _specialProps[p]; //SpecialProp lookup.
				if (sp) {
					pt = sp.parse(target, es, p, this, pt, plugin, vars);

				} else {
					bs = _getStyle(target, p, _cs) + "";
					isStr = (typeof(es) === "string");
					if (p === "color" || p === "fill" || p === "stroke" || p.indexOf("Color") !== -1 || (isStr && _rgbhslExp.test(es))) { //Opera uses background: to define color sometimes in addition to backgroundColor:
						if (!isStr) {
							es = _parseColor(es);
							es = ((es.length > 3) ? "rgba(" : "rgb(") + es.join(",") + ")";
						}
						pt = _parseComplex(style, p, bs, es, true, "transparent", pt, 0, plugin);

					} else if (isStr && (es.indexOf(" ") !== -1 || es.indexOf(",") !== -1)) {
						pt = _parseComplex(style, p, bs, es, true, null, pt, 0, plugin);

					} else {
						bn = parseFloat(bs);
						bsfx = (bn || bn === 0) ? bs.substr((bn + "").length) : ""; //remember, bs could be non-numeric like "normal" for fontWeight, so we should default to a blank suffix in that case.

						if (bs === "" || bs === "auto") {
							if (p === "width" || p === "height") {
								bn = _getDimension(target, p, _cs);
								bsfx = "px";
							} else if (p === "left" || p === "top") {
								bn = _calculateOffset(target, p, _cs);
								bsfx = "px";
							} else {
								bn = (p !== "opacity") ? 0 : 1;
								bsfx = "";
							}
						}

						rel = (isStr && es.charAt(1) === "=");
						if (rel) {
							en = parseInt(es.charAt(0) + "1", 10);
							es = es.substr(2);
							en *= parseFloat(es);
							esfx = es.replace(_suffixExp, "");
						} else {
							en = parseFloat(es);
							esfx = isStr ? es.substr((en + "").length) || "" : "";
						}

						if (esfx === "") {
							esfx = _suffixMap[p] || bsfx; //populate the end suffix, prioritizing the map, then if none is found, use the beginning suffix.
						}

						es = (en || en === 0) ? (rel ? en + bn : en) + esfx : vars[p]; //ensures that any += or -= prefixes are taken care of. Record the end value before normalizing the suffix because we always want to end the tween on exactly what they intended even if it doesn't match the beginning value's suffix.

						//if the beginning/ending suffixes don't match, normalize them...
						if (bsfx !== esfx) if (esfx !== "") if (en || en === 0) if (bn || bn === 0) {
							bn = _convertToPixels(target, p, bn, bsfx);
							if (esfx === "%") {
								bn /= _convertToPixels(target, p, 100, "%") / 100;
								if (bn > 100) { //extremely rare
									bn = 100;
								}
								if (vars.strictUnits !== true) { //some browsers report only "px" values instead of allowing "%" with getComputedStyle(), so we assume that if we're tweening to a %, we should start there too unless strictUnits:true is defined. This approach is particularly useful for responsive designs that use from() tweens.
									bs = bn + "%";
								}

							} else if (esfx === "em") {
								bn /= _convertToPixels(target, p, 1, "em");

							//otherwise convert to pixels.
							} else {
								en = _convertToPixels(target, p, en, esfx);
								esfx = "px"; //we don't use bsfx after this, so we don't need to set it to px too.
							}
							if (rel) if (en || en === 0) {
								es = (en + bn) + esfx; //the changes we made affect relative calculations, so adjust the end value here.
							}
						}

						if (rel) {
							en += bn;
						}

						if ((bn || bn === 0) && (en || en === 0)) { //faster than isNaN(). Also, previously we required en !== bn but that doesn't really gain much performance and it prevents _parseToProxy() from working properly if beginning and ending values match but need to get tweened by an external plugin anyway. For example, a bezier tween where the target starts at left:0 and has these points: [{left:50},{left:0}] wouldn't work properly because when parsing the last point, it'd match the first (current) one and a non-tweening CSSPropTween would be recorded when we actually need a normal tween (type:0) so that things get updated during the tween properly.
							pt = new CSSPropTween(style, p, bn, en - bn, pt, 0, p, (_autoRound !== false && (esfx === "px" || p === "zIndex")), 0, bs, es);
							pt.xs0 = esfx;
							//DEBUG: _log("tween "+p+" from "+pt.b+" ("+bn+esfx+") to "+pt.e+" with suffix: "+pt.xs0);
						} else if (style[p] === undefined || !es && (es + "" === "NaN" || es == null)) {
							_log("invalid " + p + " tween value: " + vars[p]);
						} else {
							pt = new CSSPropTween(style, p, en || bn || 0, 0, pt, -1, p, false, 0, bs, es);
							pt.xs0 = (es === "none" && (p === "display" || p.indexOf("Style") !== -1)) ? bs : es; //intermediate value should typically be set immediately (end value) except for "display" or things like borderTopStyle, borderBottomStyle, etc. which should use the beginning value during the tween.
							//DEBUG: _log("non-tweening value "+p+": "+pt.xs0);
						}
					}
				}
				if (plugin) if (pt && !pt.plugin) {
					pt.plugin = plugin;
				}
			}
			return pt;
		};


		//gets called every time the tween updates, passing the new ratio (typically a value between 0 and 1, but not always (for example, if an Elastic.easeOut is used, the value can jump above 1 mid-tween). It will always start and 0 and end at 1.
		p.setRatio = function(v) {
			var pt = this._firstPT,
				min = 0.000001,
				val, str, i;

			//at the end of the tween, we set the values to exactly what we received in order to make sure non-tweening values (like "position" or "float" or whatever) are set and so that if the beginning/ending suffixes (units) didn't match and we normalized to px, the value that the user passed in is used here. We check to see if the tween is at its beginning in case it's a from() tween in which case the ratio will actually go from 1 to 0 over the course of the tween (backwards).
			if (v === 1 && (this._tween._time === this._tween._duration || this._tween._time === 0)) {
				while (pt) {
					if (pt.type !== 2) {
						pt.t[pt.p] = pt.e;
					} else {
						pt.setRatio(v);
					}
					pt = pt._next;
				}

			} else if (v || !(this._tween._time === this._tween._duration || this._tween._time === 0) || this._tween._rawPrevTime === -0.000001) {
				while (pt) {
					val = pt.c * v + pt.s;
					if (pt.r) {
						val = (val > 0) ? (val + 0.5) | 0 : (val - 0.5) | 0;
					} else if (val < min) if (val > -min) {
						val = 0;
					}
					if (!pt.type) {
						pt.t[pt.p] = val + pt.xs0;
					} else if (pt.type === 1) { //complex value (one that typically has multiple numbers inside a string, like "rect(5px,10px,20px,25px)"
						i = pt.l;
						if (i === 2) {
							pt.t[pt.p] = pt.xs0 + val + pt.xs1 + pt.xn1 + pt.xs2;
						} else if (i === 3) {
							pt.t[pt.p] = pt.xs0 + val + pt.xs1 + pt.xn1 + pt.xs2 + pt.xn2 + pt.xs3;
						} else if (i === 4) {
							pt.t[pt.p] = pt.xs0 + val + pt.xs1 + pt.xn1 + pt.xs2 + pt.xn2 + pt.xs3 + pt.xn3 + pt.xs4;
						} else if (i === 5) {
							pt.t[pt.p] = pt.xs0 + val + pt.xs1 + pt.xn1 + pt.xs2 + pt.xn2 + pt.xs3 + pt.xn3 + pt.xs4 + pt.xn4 + pt.xs5;
						} else {
							str = pt.xs0 + val + pt.xs1;
							for (i = 1; i < pt.l; i++) {
								str += pt["xn"+i] + pt["xs"+(i+1)];
							}
							pt.t[pt.p] = str;
						}

					} else if (pt.type === -1) { //non-tweening value
						pt.t[pt.p] = pt.xs0;

					} else if (pt.setRatio) { //custom setRatio() for things like SpecialProps, external plugins, etc.
						pt.setRatio(v);
					}
					pt = pt._next;
				}

			//if the tween is reversed all the way back to the beginning, we need to restore the original values which may have different units (like % instead of px or em or whatever).
			} else {
				while (pt) {
					if (pt.type !== 2) {
						pt.t[pt.p] = pt.b;
					} else {
						pt.setRatio(v);
					}
					pt = pt._next;
				}
			}
		};

		/**
		 * @private
		 * Forces rendering of the target's transforms (rotation, scale, etc.) whenever the CSSPlugin's setRatio() is called.
		 * Basically, this tells the CSSPlugin to create a CSSPropTween (type 2) after instantiation that runs last in the linked
		 * list and calls the appropriate (3D or 2D) rendering function. We separate this into its own method so that we can call
		 * it from other plugins like BezierPlugin if, for example, it needs to apply an autoRotation and this CSSPlugin
		 * doesn't have any transform-related properties of its own. You can call this method as many times as you
		 * want and it won't create duplicate CSSPropTweens.
		 *
		 * @param {boolean} threeD if true, it should apply 3D tweens (otherwise, just 2D ones are fine and typically faster)
		 */
		p._enableTransforms = function(threeD) {
			this._transformType = (threeD || this._transformType === 3) ? 3 : 2;
			this._transform = this._transform || _getTransform(this._target, _cs, true); //ensures that the element has a _gsTransform property with the appropriate values.
		};

		/** @private **/
		p._linkCSSP = function(pt, next, prev, remove) {
			if (pt) {
				if (next) {
					next._prev = pt;
				}
				if (pt._next) {
					pt._next._prev = pt._prev;
				}
				if (pt._prev) {
					pt._prev._next = pt._next;
				} else if (this._firstPT === pt) {
					this._firstPT = pt._next;
					remove = true; //just to prevent resetting this._firstPT 5 lines down in case pt._next is null. (optimized for speed)
				}
				if (prev) {
					prev._next = pt;
				} else if (!remove && this._firstPT === null) {
					this._firstPT = pt;
				}
				pt._next = next;
				pt._prev = prev;
			}
			return pt;
		};

		//we need to make sure that if alpha or autoAlpha is killed, opacity is too. And autoAlpha affects the "visibility" property.
		p._kill = function(lookup) {
			var copy = lookup,
				pt, p, xfirst;
			if (lookup.autoAlpha || lookup.alpha) {
				copy = {};
				for (p in lookup) { //copy the lookup so that we're not changing the original which may be passed elsewhere.
					copy[p] = lookup[p];
				}
				copy.opacity = 1;
				if (copy.autoAlpha) {
					copy.visibility = 1;
				}
			}
			if (lookup.className && (pt = this._classNamePT)) { //for className tweens, we need to kill any associated CSSPropTweens too; a linked list starts at the className's "xfirst".
				xfirst = pt.xfirst;
				if (xfirst && xfirst._prev) {
					this._linkCSSP(xfirst._prev, pt._next, xfirst._prev._prev); //break off the prev
				} else if (xfirst === this._firstPT) {
					this._firstPT = pt._next;
				}
				if (pt._next) {
					this._linkCSSP(pt._next, pt._next._next, xfirst._prev);
				}
				this._classNamePT = null;
			}
			return TweenPlugin.prototype._kill.call(this, copy);
		};



		//used by cascadeTo() for gathering all the style properties of each child element into an array for comparison.
		var _getChildStyles = function(e, props, targets) {
				var children, i, child, type;
				if (e.slice) {
					i = e.length;
					while (--i > -1) {
						_getChildStyles(e[i], props, targets);
					}
					return;
				}
				children = e.childNodes;
				i = children.length;
				while (--i > -1) {
					child = children[i];
					type = child.type;
					if (child.style) {
						props.push(_getAllStyles(child));
						if (targets) {
							targets.push(child);
						}
					}
					if ((type === 1 || type === 9 || type === 11) && child.childNodes.length) {
						_getChildStyles(child, props, targets);
					}
				}
			};

		/**
		 * Typically only useful for className tweens that may affect child elements, this method creates a TweenLite
		 * and then compares the style properties of all the target's child elements at the tween's start and end, and
		 * if any are different, it also creates tweens for those and returns an array containing ALL of the resulting
		 * tweens (so that you can easily add() them to a TimelineLite, for example). The reason this functionality is
		 * wrapped into a separate static method of CSSPlugin instead of being integrated into all regular className tweens
		 * is because it creates entirely new tweens that may have completely different targets than the original tween,
		 * so if they were all lumped into the original tween instance, it would be inconsistent with the rest of the API
		 * and it would create other problems. For example:
		 *  - If I create a tween of elementA, that tween instance may suddenly change its target to include 50 other elements (unintuitive if I specifically defined the target I wanted)
		 *  - We can't just create new independent tweens because otherwise, what happens if the original/parent tween is reversed or pause or dropped into a TimelineLite for tight control? You'd expect that tween's behavior to affect all the others.
		 *  - Analyzing every style property of every child before and after the tween is an expensive operation when there are many children, so this behavior shouldn't be imposed on all className tweens by default, especially since it's probably rare that this extra functionality is needed.
		 *
		 * @param {Object} target object to be tweened
		 * @param {number} Duration in seconds (or frames for frames-based tweens)
		 * @param {Object} Object containing the end values, like {className:"newClass", ease:Linear.easeNone}
		 * @return {Array} An array of TweenLite instances
		 */
		CSSPlugin.cascadeTo = function(target, duration, vars) {
			var tween = TweenLite.to(target, duration, vars),
				results = [tween],
				b = [],
				e = [],
				targets = [],
				_reservedProps = TweenLite._internals.reservedProps,
				i, difs, p;
			target = tween._targets || tween.target;
			_getChildStyles(target, b, targets);
			tween.render(duration, true);
			_getChildStyles(target, e);
			tween.render(0, true);
			tween._enabled(true);
			i = targets.length;
			while (--i > -1) {
				difs = _cssDif(targets[i], b[i], e[i]);
				if (difs.firstMPT) {
					difs = difs.difs;
					for (p in vars) {
						if (_reservedProps[p]) {
							difs[p] = vars[p];
						}
					}
					results.push( TweenLite.to(targets[i], duration, difs) );
				}
			}
			return results;
		};

		TweenPlugin.activate([CSSPlugin]);
		return CSSPlugin;

	}, true);

	
	
	
	
	
	
	
	
	
	
/*
 * ----------------------------------------------------------------
 * RoundPropsPlugin
 * ----------------------------------------------------------------
 */
	(function() {

		var RoundPropsPlugin = window._gsDefine.plugin({
				propName: "roundProps",
				priority: -1,
				API: 2,

				//called when the tween renders for the first time. This is where initial values should be recorded and any setup routines should run.
				init: function(target, value, tween) {
					this._tween = tween;
					return true;
				}

			}),
			p = RoundPropsPlugin.prototype;

		p._onInitAllProps = function() {
			var tween = this._tween,
				rp = (tween.vars.roundProps instanceof Array) ? tween.vars.roundProps : tween.vars.roundProps.split(","),
				i = rp.length,
				lookup = {},
				rpt = tween._propLookup.roundProps,
				prop, pt, next;
			while (--i > -1) {
				lookup[rp[i]] = 1;
			}
			i = rp.length;
			while (--i > -1) {
				prop = rp[i];
				pt = tween._firstPT;
				while (pt) {
					next = pt._next; //record here, because it may get removed
					if (pt.pg) {
						pt.t._roundProps(lookup, true);
					} else if (pt.n === prop) {
						this._add(pt.t, prop, pt.s, pt.c);
						//remove from linked list
						if (next) {
							next._prev = pt._prev;
						}
						if (pt._prev) {
							pt._prev._next = next;
						} else if (tween._firstPT === pt) {
							tween._firstPT = next;
						}
						pt._next = pt._prev = null;
						tween._propLookup[prop] = rpt;
					}
					pt = next;
				}
			}
			return false;
		};

		p._add = function(target, p, s, c) {
			this._addTween(target, p, s, s + c, p, true);
			this._overwriteProps.push(p);
		};

	}());










/*
 * ----------------------------------------------------------------
 * AttrPlugin
 * ----------------------------------------------------------------
 */
	window._gsDefine.plugin({
		propName: "attr",
		API: 2,

		//called when the tween renders for the first time. This is where initial values should be recorded and any setup routines should run.
		init: function(target, value, tween) {
			var p;
			if (typeof(target.setAttribute) !== "function") {
				return false;
			}
			this._target = target;
			this._proxy = {};
			for (p in value) {
				if ( this._addTween(this._proxy, p, parseFloat(target.getAttribute(p)), value[p], p) ) {
					this._overwriteProps.push(p);
				}
			}
			return true;
		},

		//called each time the values should be updated, and the ratio gets passed as the only parameter (typically it's a value between 0 and 1, but it can exceed those when using an ease like Elastic.easeOut or Back.easeOut, etc.)
		set: function(ratio) {
			this._super.setRatio.call(this, ratio);
			var props = this._overwriteProps,
				i = props.length,
				p;
			while (--i > -1) {
				p = props[i];
				this._target.setAttribute(p, this._proxy[p] + "");
			}
		}

	});










/*
 * ----------------------------------------------------------------
 * DirectionalRotationPlugin
 * ----------------------------------------------------------------
 */
	window._gsDefine.plugin({
		propName: "directionalRotation",
		API: 2,

		//called when the tween renders for the first time. This is where initial values should be recorded and any setup routines should run.
		init: function(target, value, tween) {
			if (typeof(value) !== "object") {
				value = {rotation:value};
			}
			this.finals = {};
			var cap = (value.useRadians === true) ? Math.PI * 2 : 360,
				min = 0.000001,
				p, v, start, end, dif, split;
			for (p in value) {
				if (p !== "useRadians") {
					split = (value[p] + "").split("_");
					v = split[0];
					start = parseFloat( (typeof(target[p]) !== "function") ? target[p] : target[ ((p.indexOf("set") || typeof(target["get" + p.substr(3)]) !== "function") ? p : "get" + p.substr(3)) ]() );
					end = this.finals[p] = (typeof(v) === "string" && v.charAt(1) === "=") ? start + parseInt(v.charAt(0) + "1", 10) * Number(v.substr(2)) : Number(v) || 0;
					dif = end - start;
					if (split.length) {
						v = split.join("_");
						if (v.indexOf("short") !== -1) {
							dif = dif % cap;
							if (dif !== dif % (cap / 2)) {
								dif = (dif < 0) ? dif + cap : dif - cap;
							}
						}
						if (v.indexOf("_cw") !== -1 && dif < 0) {
							dif = ((dif + cap * 9999999999) % cap) - ((dif / cap) | 0) * cap;
						} else if (v.indexOf("ccw") !== -1 && dif > 0) {
							dif = ((dif - cap * 9999999999) % cap) - ((dif / cap) | 0) * cap;
						}
					}
					if (dif > min || dif < -min) {
						this._addTween(target, p, start, start + dif, p);
						this._overwriteProps.push(p);
					}
				}
			}
			return true;
		},

		//called each time the values should be updated, and the ratio gets passed as the only parameter (typically it's a value between 0 and 1, but it can exceed those when using an ease like Elastic.easeOut or Back.easeOut, etc.)
		set: function(ratio) {
			var pt;
			if (ratio !== 1) {
				this._super.setRatio.call(this, ratio);
			} else {
				pt = this._firstPT;
				while (pt) {
					if (pt.f) {
						pt.t[pt.p](this.finals[pt.p]);
					} else {
						pt.t[pt.p] = this.finals[pt.p];
					}
					pt = pt._next;
				}
			}
		}

	})._autoCSS = true;







	
	
	
	
/*
 * ----------------------------------------------------------------
 * EasePack
 * ----------------------------------------------------------------
 */
	window._gsDefine("easing.Back", ["easing.Ease"], function(Ease) {
		
		var w = (window.GreenSockGlobals || window),
			gs = w.com.greensock,
			_2PI = Math.PI * 2,
			_HALF_PI = Math.PI / 2,
			_class = gs._class,
			_create = function(n, f) {
				var C = _class("easing." + n, function(){}, true),
					p = C.prototype = new Ease();
				p.constructor = C;
				p.getRatio = f;
				return C;
			},
			_easeReg = Ease.register || function(){}, //put an empty function in place just as a safety measure in case someone loads an OLD version of TweenLite.js where Ease.register doesn't exist.
			_wrap = function(name, EaseOut, EaseIn, EaseInOut, aliases) {
				var C = _class("easing."+name, {
					easeOut:new EaseOut(),
					easeIn:new EaseIn(),
					easeInOut:new EaseInOut()
				}, true);
				_easeReg(C, name);
				return C;
			},
			EasePoint = function(time, value, next) {
				this.t = time;
				this.v = value;
				if (next) {
					this.next = next;
					next.prev = this;
					this.c = next.v - value;
					this.gap = next.t - time;
				}
			},

			//Back
			_createBack = function(n, f) {
				var C = _class("easing." + n, function(overshoot) {
						this._p1 = (overshoot || overshoot === 0) ? overshoot : 1.70158;
						this._p2 = this._p1 * 1.525;
					}, true),
					p = C.prototype = new Ease();
				p.constructor = C;
				p.getRatio = f;
				p.config = function(overshoot) {
					return new C(overshoot);
				};
				return C;
			},

			Back = _wrap("Back",
				_createBack("BackOut", function(p) {
					return ((p = p - 1) * p * ((this._p1 + 1) * p + this._p1) + 1);
				}),
				_createBack("BackIn", function(p) {
					return p * p * ((this._p1 + 1) * p - this._p1);
				}),
				_createBack("BackInOut", function(p) {
					return ((p *= 2) < 1) ? 0.5 * p * p * ((this._p2 + 1) * p - this._p2) : 0.5 * ((p -= 2) * p * ((this._p2 + 1) * p + this._p2) + 2);
				})
			),


			//SlowMo
			SlowMo = _class("easing.SlowMo", function(linearRatio, power, yoyoMode) {
				power = (power || power === 0) ? power : 0.7;
				if (linearRatio == null) {
					linearRatio = 0.7;
				} else if (linearRatio > 1) {
					linearRatio = 1;
				}
				this._p = (linearRatio !== 1) ? power : 0;
				this._p1 = (1 - linearRatio) / 2;
				this._p2 = linearRatio;
				this._p3 = this._p1 + this._p2;
				this._calcEnd = (yoyoMode === true);
			}, true),
			p = SlowMo.prototype = new Ease(),
			SteppedEase, RoughEase, _createElastic;

		p.constructor = SlowMo;
		p.getRatio = function(p) {
			var r = p + (0.5 - p) * this._p;
			if (p < this._p1) {
				return this._calcEnd ? 1 - ((p = 1 - (p / this._p1)) * p) : r - ((p = 1 - (p / this._p1)) * p * p * p * r);
			} else if (p > this._p3) {
				return this._calcEnd ? 1 - (p = (p - this._p3) / this._p1) * p : r + ((p - r) * (p = (p - this._p3) / this._p1) * p * p * p);
			}
			return this._calcEnd ? 1 : r;
		};
		SlowMo.ease = new SlowMo(0.7, 0.7);

		p.config = SlowMo.config = function(linearRatio, power, yoyoMode) {
			return new SlowMo(linearRatio, power, yoyoMode);
		};


		//SteppedEase
		SteppedEase = _class("easing.SteppedEase", function(steps) {
				steps = steps || 1;
				this._p1 = 1 / steps;
				this._p2 = steps + 1;
			}, true);
		p = SteppedEase.prototype = new Ease();
		p.constructor = SteppedEase;
		p.getRatio = function(p) {
			if (p < 0) {
				p = 0;
			} else if (p >= 1) {
				p = 0.999999999;
			}
			return ((this._p2 * p) >> 0) * this._p1;
		};
		p.config = SteppedEase.config = function(steps) {
			return new SteppedEase(steps);
		};


		//RoughEase
		RoughEase = _class("easing.RoughEase", function(vars) {
			vars = vars || {};
			var taper = vars.taper || "none",
				a = [],
				cnt = 0,
				points = (vars.points || 20) | 0,
				i = points,
				randomize = (vars.randomize !== false),
				clamp = (vars.clamp === true),
				template = (vars.template instanceof Ease) ? vars.template : null,
				strength = (typeof(vars.strength) === "number") ? vars.strength * 0.4 : 0.4,
				x, y, bump, invX, obj, pnt;
			while (--i > -1) {
				x = randomize ? Math.random() : (1 / points) * i;
				y = template ? template.getRatio(x) : x;
				if (taper === "none") {
					bump = strength;
				} else if (taper === "out") {
					invX = 1 - x;
					bump = invX * invX * strength;
				} else if (taper === "in") {
					bump = x * x * strength;
				} else if (x < 0.5) {  //"both" (start)
					invX = x * 2;
					bump = invX * invX * 0.5 * strength;
				} else {				//"both" (end)
					invX = (1 - x) * 2;
					bump = invX * invX * 0.5 * strength;
				}
				if (randomize) {
					y += (Math.random() * bump) - (bump * 0.5);
				} else if (i % 2) {
					y += bump * 0.5;
				} else {
					y -= bump * 0.5;
				}
				if (clamp) {
					if (y > 1) {
						y = 1;
					} else if (y < 0) {
						y = 0;
					}
				}
				a[cnt++] = {x:x, y:y};
			}
			a.sort(function(a, b) {
				return a.x - b.x;
			});

			pnt = new EasePoint(1, 1, null);
			i = points;
			while (--i > -1) {
				obj = a[i];
				pnt = new EasePoint(obj.x, obj.y, pnt);
			}

			this._prev = new EasePoint(0, 0, (pnt.t !== 0) ? pnt : pnt.next);
		}, true);
		p = RoughEase.prototype = new Ease();
		p.constructor = RoughEase;
		p.getRatio = function(p) {
			var pnt = this._prev;
			if (p > pnt.t) {
				while (pnt.next && p >= pnt.t) {
					pnt = pnt.next;
				}
				pnt = pnt.prev;
			} else {
				while (pnt.prev && p <= pnt.t) {
					pnt = pnt.prev;
				}
			}
			this._prev = pnt;
			return (pnt.v + ((p - pnt.t) / pnt.gap) * pnt.c);
		};
		p.config = function(vars) {
			return new RoughEase(vars);
		};
		RoughEase.ease = new RoughEase();


		//Bounce
		_wrap("Bounce",
			_create("BounceOut", function(p) {
				if (p < 1 / 2.75) {
					return 7.5625 * p * p;
				} else if (p < 2 / 2.75) {
					return 7.5625 * (p -= 1.5 / 2.75) * p + 0.75;
				} else if (p < 2.5 / 2.75) {
					return 7.5625 * (p -= 2.25 / 2.75) * p + 0.9375;
				}
				return 7.5625 * (p -= 2.625 / 2.75) * p + 0.984375;
			}),
			_create("BounceIn", function(p) {
				if ((p = 1 - p) < 1 / 2.75) {
					return 1 - (7.5625 * p * p);
				} else if (p < 2 / 2.75) {
					return 1 - (7.5625 * (p -= 1.5 / 2.75) * p + 0.75);
				} else if (p < 2.5 / 2.75) {
					return 1 - (7.5625 * (p -= 2.25 / 2.75) * p + 0.9375);
				}
				return 1 - (7.5625 * (p -= 2.625 / 2.75) * p + 0.984375);
			}),
			_create("BounceInOut", function(p) {
				var invert = (p < 0.5);
				if (invert) {
					p = 1 - (p * 2);
				} else {
					p = (p * 2) - 1;
				}
				if (p < 1 / 2.75) {
					p = 7.5625 * p * p;
				} else if (p < 2 / 2.75) {
					p = 7.5625 * (p -= 1.5 / 2.75) * p + 0.75;
				} else if (p < 2.5 / 2.75) {
					p = 7.5625 * (p -= 2.25 / 2.75) * p + 0.9375;
				} else {
					p = 7.5625 * (p -= 2.625 / 2.75) * p + 0.984375;
				}
				return invert ? (1 - p) * 0.5 : p * 0.5 + 0.5;
			})
		);


		//CIRC
		_wrap("Circ",
			_create("CircOut", function(p) {
				return Math.sqrt(1 - (p = p - 1) * p);
			}),
			_create("CircIn", function(p) {
				return -(Math.sqrt(1 - (p * p)) - 1);
			}),
			_create("CircInOut", function(p) {
				return ((p*=2) < 1) ? -0.5 * (Math.sqrt(1 - p * p) - 1) : 0.5 * (Math.sqrt(1 - (p -= 2) * p) + 1);
			})
		);


		//Elastic
		_createElastic = function(n, f, def) {
			var C = _class("easing." + n, function(amplitude, period) {
					this._p1 = amplitude || 1;
					this._p2 = period || def;
					this._p3 = this._p2 / _2PI * (Math.asin(1 / this._p1) || 0);
				}, true),
				p = C.prototype = new Ease();
			p.constructor = C;
			p.getRatio = f;
			p.config = function(amplitude, period) {
				return new C(amplitude, period);
			};
			return C;
		};
		_wrap("Elastic",
			_createElastic("ElasticOut", function(p) {
				return this._p1 * Math.pow(2, -10 * p) * Math.sin( (p - this._p3) * _2PI / this._p2 ) + 1;
			}, 0.3),
			_createElastic("ElasticIn", function(p) {
				return -(this._p1 * Math.pow(2, 10 * (p -= 1)) * Math.sin( (p - this._p3) * _2PI / this._p2 ));
			}, 0.3),
			_createElastic("ElasticInOut", function(p) {
				return ((p *= 2) < 1) ? -0.5 * (this._p1 * Math.pow(2, 10 * (p -= 1)) * Math.sin( (p - this._p3) * _2PI / this._p2)) : this._p1 * Math.pow(2, -10 *(p -= 1)) * Math.sin( (p - this._p3) * _2PI / this._p2 ) *0.5 + 1;
			}, 0.45)
		);


		//Expo
		_wrap("Expo",
			_create("ExpoOut", function(p) {
				return 1 - Math.pow(2, -10 * p);
			}),
			_create("ExpoIn", function(p) {
				return Math.pow(2, 10 * (p - 1)) - 0.001;
			}),
			_create("ExpoInOut", function(p) {
				return ((p *= 2) < 1) ? 0.5 * Math.pow(2, 10 * (p - 1)) : 0.5 * (2 - Math.pow(2, -10 * (p - 1)));
			})
		);


		//Sine
		_wrap("Sine",
			_create("SineOut", function(p) {
				return Math.sin(p * _HALF_PI);
			}),
			_create("SineIn", function(p) {
				return -Math.cos(p * _HALF_PI) + 1;
			}),
			_create("SineInOut", function(p) {
				return -0.5 * (Math.cos(Math.PI * p) - 1);
			})
		);

		_class("easing.EaseLookup", {
				find:function(s) {
					return Ease.map[s];
				}
			}, true);

		//register the non-standard eases
		_easeReg(w.SlowMo, "SlowMo", "ease,");
		_easeReg(RoughEase, "RoughEase", "ease,");
		_easeReg(SteppedEase, "SteppedEase", "ease,");

		return Back;
		
	}, true);


}); 











/*
 * ----------------------------------------------------------------
 * Base classes like TweenLite, SimpleTimeline, Ease, Ticker, etc.
 * ----------------------------------------------------------------
 */
(function(window) {

		"use strict";
		var _globals = window.GreenSockGlobals || window,
			_namespace = function(ns) {
				var a = ns.split("."),
					p = _globals, i;
				for (i = 0; i < a.length; i++) {
					p[a[i]] = p = p[a[i]] || {};
				}
				return p;
			},
			gs = _namespace("com.greensock"),
			_slice = [].slice,
			_emptyFunc = function() {},
			a, i, p, _ticker, _tickerActive,
			_defLookup = {},

			/**
			 * @constructor
			 * Defines a GreenSock class, optionally with an array of dependencies that must be instantiated first and passed into the definition.
			 * This allows users to load GreenSock JS files in any order even if they have interdependencies (like CSSPlugin extends TweenPlugin which is
			 * inside TweenLite.js, but if CSSPlugin is loaded first, it should wait to run its code until TweenLite.js loads and instantiates TweenPlugin
			 * and then pass TweenPlugin to CSSPlugin's definition). This is all done automatically and internally.
			 *
			 * Every definition will be added to a "com.greensock" global object (typically window, but if a window.GreenSockGlobals object is found,
			 * it will go there as of v1.7). For example, TweenLite will be found at window.com.greensock.TweenLite and since it's a global class that should be available anywhere,
			 * it is ALSO referenced at window.TweenLite. However some classes aren't considered global, like the base com.greensock.core.Animation class, so
			 * those will only be at the package like window.com.greensock.core.Animation. Again, if you define a GreenSockGlobals object on the window, everything
			 * gets tucked neatly inside there instead of on the window directly. This allows you to do advanced things like load multiple versions of GreenSock
			 * files and put them into distinct objects (imagine a banner ad uses a newer version but the main site uses an older one). In that case, you could
			 * sandbox the banner one like:
			 *
			 * <script>
			 *     var gs = window.GreenSockGlobals = {}; //the newer version we're about to load could now be referenced in a "gs" object, like gs.TweenLite.to(...). Use whatever alias you want as long as it's unique, "gs" or "banner" or whatever.
			 * </script>
			 * <script src="js/greensock/v1.7/TweenMax.js"></script>
			 * <script>
			 *     window.GreenSockGlobals = null; //reset it back to null so that the next load of TweenMax affects the window and we can reference things directly like TweenLite.to(...)
			 * </script>
			 * <script src="js/greensock/v1.6/TweenMax.js"></script>
			 * <script>
			 *     gs.TweenLite.to(...); //would use v1.7
			 *     TweenLite.to(...); //would use v1.6
			 * </script>
			 *
			 * @param {!string} ns The namespace of the class definition, leaving off "com.greensock." as that's assumed. For example, "TweenLite" or "plugins.CSSPlugin" or "easing.Back".
			 * @param {!Array.<string>} dependencies An array of dependencies (described as their namespaces minus "com.greensock." prefix). For example ["TweenLite","plugins.TweenPlugin","core.Animation"]
			 * @param {!function():Object} func The function that should be called and passed the resolved dependencies which will return the actual class for this definition.
			 * @param {boolean=} global If true, the class will be added to the global scope (typically window unless you define a window.GreenSockGlobals object)
			 */
			Definition = function(ns, dependencies, func, global) {
				this.sc = (_defLookup[ns]) ? _defLookup[ns].sc : []; //subclasses
				_defLookup[ns] = this;
				this.gsClass = null;
				this.func = func;
				var _classes = [];
				this.check = function(init) {
					var i = dependencies.length,
						missing = i,
						cur, a, n, cl;
					while (--i > -1) {
						if ((cur = _defLookup[dependencies[i]] || new Definition(dependencies[i], [])).gsClass) {
							_classes[i] = cur.gsClass;
							missing--;
						} else if (init) {
							cur.sc.push(this);
						}
					}
					if (missing === 0 && func) {
						a = ("com.greensock." + ns).split(".");
						n = a.pop();
						cl = _namespace(a.join("."))[n] = this.gsClass = func.apply(func, _classes);

						//exports to multiple environments
						if (global) {
							_globals[n] = cl; //provides a way to avoid global namespace pollution. By default, the main classes like TweenLite, Power1, Strong, etc. are added to window unless a GreenSockGlobals is defined. So if you want to have things added to a custom object instead, just do something like window.GreenSockGlobals = {} before loading any GreenSock files. You can even set up an alias like window.GreenSockGlobals = windows.gs = {} so that you can access everything like gs.TweenLite. Also remember that ALL classes are added to the window.com.greensock object (in their respective packages, like com.greensock.easing.Power1, com.greensock.TweenLite, etc.)
							if (typeof(define) === "function" && define.amd){ //AMD
								define((window.GreenSockAMDPath ? window.GreenSockAMDPath + "/" : "") + ns.split(".").join("/"), [], function() { return cl; });
							} else if (typeof(module) !== "undefined" && module.exports){ //node
								module.exports = cl;
							}
						}
						for (i = 0; i < this.sc.length; i++) {
							this.sc[i].check();
						}
					}
				};
				this.check(true);
			},

			//used to create Definition instances (which basically registers a class that has dependencies).
			_gsDefine = window._gsDefine = function(ns, dependencies, func, global) {
				return new Definition(ns, dependencies, func, global);
			},

			//a quick way to create a class that doesn't have any dependencies. Returns the class, but first registers it in the GreenSock namespace so that other classes can grab it (other classes might be dependent on the class).
			_class = gs._class = function(ns, func, global) {
				func = func || function() {};
				_gsDefine(ns, [], function(){ return func; }, global);
				return func;
			};

		_gsDefine.globals = _globals;



/*
 * ----------------------------------------------------------------
 * Ease
 * ----------------------------------------------------------------
 */
		var _baseParams = [0, 0, 1, 1],
			_blankArray = [],
			Ease = _class("easing.Ease", function(func, extraParams, type, power) {
				this._func = func;
				this._type = type || 0;
				this._power = power || 0;
				this._params = extraParams ? _baseParams.concat(extraParams) : _baseParams;
			}, true),
			_easeMap = Ease.map = {},
			_easeReg = Ease.register = function(ease, names, types, create) {
				var na = names.split(","),
					i = na.length,
					ta = (types || "easeIn,easeOut,easeInOut").split(","),
					e, name, j, type;
				while (--i > -1) {
					name = na[i];
					e = create ? _class("easing."+name, null, true) : gs.easing[name] || {};
					j = ta.length;
					while (--j > -1) {
						type = ta[j];
						_easeMap[name + "." + type] = _easeMap[type + name] = e[type] = ease.getRatio ? ease : ease[type] || new ease();
					}
				}
			};

		p = Ease.prototype;
		p._calcEnd = false;
		p.getRatio = function(p) {
			if (this._func) {
				this._params[0] = p;
				return this._func.apply(null, this._params);
			}
			var t = this._type,
				pw = this._power,
				r = (t === 1) ? 1 - p : (t === 2) ? p : (p < 0.5) ? p * 2 : (1 - p) * 2;
			if (pw === 1) {
				r *= r;
			} else if (pw === 2) {
				r *= r * r;
			} else if (pw === 3) {
				r *= r * r * r;
			} else if (pw === 4) {
				r *= r * r * r * r;
			}
			return (t === 1) ? 1 - r : (t === 2) ? r : (p < 0.5) ? r / 2 : 1 - (r / 2);
		};

		//create all the standard eases like Linear, Quad, Cubic, Quart, Quint, Strong, Power0, Power1, Power2, Power3, and Power4 (each with easeIn, easeOut, and easeInOut)
		a = ["Linear","Quad","Cubic","Quart","Quint,Strong"];
		i = a.length;
		while (--i > -1) {
			p = a[i]+",Power"+i;
			_easeReg(new Ease(null,null,1,i), p, "easeOut", true);
			_easeReg(new Ease(null,null,2,i), p, "easeIn" + ((i === 0) ? ",easeNone" : ""));
			_easeReg(new Ease(null,null,3,i), p, "easeInOut");
		}
		_easeMap.linear = gs.easing.Linear.easeIn;
		_easeMap.swing = gs.easing.Quad.easeInOut; //for jQuery folks


/*
 * ----------------------------------------------------------------
 * EventDispatcher
 * ----------------------------------------------------------------
 */
		var EventDispatcher = _class("events.EventDispatcher", function(target) {
			this._listeners = {};
			this._eventTarget = target || this;
		});
		p = EventDispatcher.prototype;

		p.addEventListener = function(type, callback, scope, useParam, priority) {
			priority = priority || 0;
			var list = this._listeners[type],
				index = 0,
				listener, i;
			if (list == null) {
				this._listeners[type] = list = [];
			}
			i = list.length;
			while (--i > -1) {
				listener = list[i];
				if (listener.c === callback && listener.s === scope) {
					list.splice(i, 1);
				} else if (index === 0 && listener.pr < priority) {
					index = i + 1;
				}
			}
			list.splice(index, 0, {c:callback, s:scope, up:useParam, pr:priority});
			if (this === _ticker && !_tickerActive) {
				_ticker.wake();
			}
		};

		p.removeEventListener = function(type, callback) {
			var list = this._listeners[type], i;
			if (list) {
				i = list.length;
				while (--i > -1) {
					if (list[i].c === callback) {
						list.splice(i, 1);
						return;
					}
				}
			}
		};

		p.dispatchEvent = function(type) {
			var list = this._listeners[type],
				i, t, listener;
			if (list) {
				i = list.length;
				t = this._eventTarget;
				while (--i > -1) {
					listener = list[i];
					if (listener.up) {
						listener.c.call(listener.s || t, {type:type, target:t});
					} else {
						listener.c.call(listener.s || t);
					}
				}
			}
		};


/*
 * ----------------------------------------------------------------
 * Ticker
 * ----------------------------------------------------------------
 */
 		var _reqAnimFrame = window.requestAnimationFrame,
			_cancelAnimFrame = window.cancelAnimationFrame,
			_getTime = Date.now || function() {return new Date().getTime();},
			_lastUpdate = _getTime();

		//now try to determine the requestAnimationFrame and cancelAnimationFrame functions and if none are found, we'll use a setTimeout()/clearTimeout() polyfill.
		a = ["ms","moz","webkit","o"];
		i = a.length;
		while (--i > -1 && !_reqAnimFrame) {
			_reqAnimFrame = window[a[i] + "RequestAnimationFrame"];
			_cancelAnimFrame = window[a[i] + "CancelAnimationFrame"] || window[a[i] + "CancelRequestAnimationFrame"];
		}

		_class("Ticker", function(fps, useRAF) {
			var _self = this,
				_startTime = _getTime(),
				_useRAF = (useRAF !== false && _reqAnimFrame),
				_fps, _req, _id, _gap, _nextTime,
				_tick = function(manual) {
					_lastUpdate = _getTime();
					_self.time = (_lastUpdate - _startTime) / 1000;
					var overlap = _self.time - _nextTime,
						dispatch;
					if (!_fps || overlap > 0 || manual === true) {
						_self.frame++;
						_nextTime += overlap + (overlap >= _gap ? 0.004 : _gap - overlap);
						dispatch = true;
					}
					if (manual !== true) { //make sure the request is made before we dispatch the "tick" event so that timing is maintained. Otherwise, if processing the "tick" requires a bunch of time (like 15ms) and we're using a setTimeout() that's based on 16.7ms, it'd technically take 31.7ms between frames otherwise.
						_id = _req(_tick);
					}
					if (dispatch) {
						_self.dispatchEvent("tick");
					}
				};

			EventDispatcher.call(_self);
			_self.time = _self.frame = 0;
			_self.tick = function() {
				_tick(true);
			};

			_self.sleep = function() {
				if (_id == null) {
					return;
				}
				if (!_useRAF || !_cancelAnimFrame) {
					clearTimeout(_id);
				} else {
					_cancelAnimFrame(_id);
				}
				_req = _emptyFunc;
				_id = null;
				if (_self === _ticker) {
					_tickerActive = false;
				}
			};

			_self.wake = function() {
				if (_id !== null) {
					_self.sleep();
				}
				_req = (_fps === 0) ? _emptyFunc : (!_useRAF || !_reqAnimFrame) ? function(f) { return setTimeout(f, ((_nextTime - _self.time) * 1000 + 1) | 0); } : _reqAnimFrame;
				if (_self === _ticker) {
					_tickerActive = true;
				}
				_tick(2);
			};

			_self.fps = function(value) {
				if (!arguments.length) {
					return _fps;
				}
				_fps = value;
				_gap = 1 / (_fps || 60);
				_nextTime = this.time + _gap;
				_self.wake();
			};

			_self.useRAF = function(value) {
				if (!arguments.length) {
					return _useRAF;
				}
				_self.sleep();
				_useRAF = value;
				_self.fps(_fps);
			};
			_self.fps(fps);

			//a bug in iOS 6 Safari occasionally prevents the requestAnimationFrame from working initially, so we use a 1.5-second timeout that automatically falls back to setTimeout() if it senses this condition.
			setTimeout(function() {
				if (_useRAF && (!_id || _self.frame < 5)) {
					_self.useRAF(false);
				}
			}, 1500);
		});

		p = gs.Ticker.prototype = new gs.events.EventDispatcher();
		p.constructor = gs.Ticker;


/*
 * ----------------------------------------------------------------
 * Animation
 * ----------------------------------------------------------------
 */
		var Animation = _class("core.Animation", function(duration, vars) {
				this.vars = vars = vars || {};
				this._duration = this._totalDuration = duration || 0;
				this._delay = Number(vars.delay) || 0;
				this._timeScale = 1;
				this._active = (vars.immediateRender === true);
				this.data = vars.data;
				this._reversed = (vars.reversed === true);

				if (!_rootTimeline) {
					return;
				}
				if (!_tickerActive) { //some browsers (like iOS 6 Safari) shut down JavaScript execution when the tab is disabled and they [occasionally] neglect to start up requestAnimationFrame again when returning - this code ensures that the engine starts up again properly.
					_ticker.wake();
				}

				var tl = this.vars.useFrames ? _rootFramesTimeline : _rootTimeline;
				tl.add(this, tl._time);

				if (this.vars.paused) {
					this.paused(true);
				}
			});

		_ticker = Animation.ticker = new gs.Ticker();
		p = Animation.prototype;
		p._dirty = p._gc = p._initted = p._paused = false;
		p._totalTime = p._time = 0;
		p._rawPrevTime = -1;
		p._next = p._last = p._onUpdate = p._timeline = p.timeline = null;
		p._paused = false;


		//some browsers (like iOS) occasionally drop the requestAnimationFrame event when the user switches to a different tab and then comes back again, so we use a 2-second setTimeout() to sense if/when that condition occurs and then wake() the ticker.
		var _checkTimeout = function() {
				if (_getTime() - _lastUpdate > 2000) {
					_ticker.wake();
				}
				setTimeout(_checkTimeout, 2000);
			};
		_checkTimeout();


		p.play = function(from, suppressEvents) {
			if (arguments.length) {
				this.seek(from, suppressEvents);
			}
			return this.reversed(false).paused(false);
		};

		p.pause = function(atTime, suppressEvents) {
			if (arguments.length) {
				this.seek(atTime, suppressEvents);
			}
			return this.paused(true);
		};

		p.resume = function(from, suppressEvents) {
			if (arguments.length) {
				this.seek(from, suppressEvents);
			}
			return this.paused(false);
		};

		p.seek = function(time, suppressEvents) {
			return this.totalTime(Number(time), suppressEvents !== false);
		};

		p.restart = function(includeDelay, suppressEvents) {
			return this.reversed(false).paused(false).totalTime(includeDelay ? -this._delay : 0, (suppressEvents !== false), true);
		};

		p.reverse = function(from, suppressEvents) {
			if (arguments.length) {
				this.seek((from || this.totalDuration()), suppressEvents);
			}
			return this.reversed(true).paused(false);
		};

		p.render = function(time, suppressEvents, force) {
			//stub - we override this method in subclasses.
		};

		p.invalidate = function() {
			return this;
		};

		p._enabled = function (enabled, ignoreTimeline) {
			if (!_tickerActive) {
				_ticker.wake();
			}
			this._gc = !enabled;
			this._active = (enabled && !this._paused && this._totalTime > 0 && this._totalTime < this._totalDuration);
			if (ignoreTimeline !== true) {
				if (enabled && !this.timeline) {
					this._timeline.add(this, this._startTime - this._delay);
				} else if (!enabled && this.timeline) {
					this._timeline._remove(this, true);
				}
			}
			return false;
		};


		p._kill = function(vars, target) {
			return this._enabled(false, false);
		};

		p.kill = function(vars, target) {
			this._kill(vars, target);
			return this;
		};

		p._uncache = function(includeSelf) {
			var tween = includeSelf ? this : this.timeline;
			while (tween) {
				tween._dirty = true;
				tween = tween.timeline;
			}
			return this;
		};

		p._swapSelfInParams = function(params) {
			var i = params.length,
				copy = params.concat();
			while (--i > -1) {
				if (params[i] === "{self}") {
					copy[i] = this;
				}
			}
			return copy;
		};

//----Animation getters/setters --------------------------------------------------------

		p.eventCallback = function(type, callback, params, scope) {
			if ((type || "").substr(0,2) === "on") {
				var v = this.vars;
				if (arguments.length === 1) {
					return v[type];
				}
				if (callback == null) {
					delete v[type];
				} else {
					v[type] = callback;
					v[type + "Params"] = ((params instanceof Array) && params.join("").indexOf("{self}") !== -1) ? this._swapSelfInParams(params) : params;
					v[type + "Scope"] = scope;
				}
				if (type === "onUpdate") {
					this._onUpdate = callback;
				}
			}
			return this;
		};

		p.delay = function(value) {
			if (!arguments.length) {
				return this._delay;
			}
			if (this._timeline.smoothChildTiming) {
				this.startTime( this._startTime + value - this._delay );
			}
			this._delay = value;
			return this;
		};

		p.duration = function(value) {
			if (!arguments.length) {
				this._dirty = false;
				return this._duration;
			}
			this._duration = this._totalDuration = value;
			this._uncache(true); //true in case it's a TweenMax or TimelineMax that has a repeat - we'll need to refresh the totalDuration.
			if (this._timeline.smoothChildTiming) if (this._time > 0) if (this._time < this._duration) if (value !== 0) {
				this.totalTime(this._totalTime * (value / this._duration), true);
			}
			return this;
		};

		p.totalDuration = function(value) {
			this._dirty = false;
			return (!arguments.length) ? this._totalDuration : this.duration(value);
		};

		p.time = function(value, suppressEvents) {
			if (!arguments.length) {
				return this._time;
			}
			if (this._dirty) {
				this.totalDuration();
			}
			return this.totalTime((value > this._duration) ? this._duration : value, suppressEvents);
		};

		p.totalTime = function(time, suppressEvents, uncapped) {
			if (!_tickerActive) {
				_ticker.wake();
			}
			if (!arguments.length) {
				return this._totalTime;
			}
			if (this._timeline) {
				if (time < 0 && !uncapped) {
					time += this.totalDuration();
				}
				if (this._timeline.smoothChildTiming) {
					if (this._dirty) {
						this.totalDuration();
					}
					var totalDuration = this._totalDuration,
						tl = this._timeline;
					if (time > totalDuration && !uncapped) {
						time = totalDuration;
					}
					this._startTime = (this._paused ? this._pauseTime : tl._time) - ((!this._reversed ? time : totalDuration - time) / this._timeScale);
					if (!tl._dirty) { //for performance improvement. If the parent's cache is already dirty, it already took care of marking the ancestors as dirty too, so skip the function call here.
						this._uncache(false);
					}
					//in case any of the ancestor timelines had completed but should now be enabled, we should reset their totalTime() which will also ensure that they're lined up properly and enabled. Skip for animations that are on the root (wasteful). Example: a TimelineLite.exportRoot() is performed when there's a paused tween on the root, the export will not complete until that tween is unpaused, but imagine a child gets restarted later, after all [unpaused] tweens have completed. The startTime of that child would get pushed out, but one of the ancestors may have completed.
					if (tl._timeline) {
						while (tl._timeline) {
							if (tl._timeline._time !== (tl._startTime + tl._totalTime) / tl._timeScale) {
								tl.totalTime(tl._totalTime, true);
							}
							tl = tl._timeline;
						}
					}
				}
				if (this._gc) {
					this._enabled(true, false);
				}
				if (this._totalTime !== time) {
					this.render(time, suppressEvents, false);
				}
			}
			return this;
		};

		p.startTime = function(value) {
			if (!arguments.length) {
				return this._startTime;
			}
			if (value !== this._startTime) {
				this._startTime = value;
				if (this.timeline) if (this.timeline._sortChildren) {
					this.timeline.add(this, value - this._delay); //ensures that any necessary re-sequencing of Animations in the timeline occurs to make sure the rendering order is correct.
				}
			}
			return this;
		};

		p.timeScale = function(value) {
			if (!arguments.length) {
				return this._timeScale;
			}
			value = value || 0.000001; //can't allow zero because it'll throw the math off
			if (this._timeline && this._timeline.smoothChildTiming) {
				var pauseTime = this._pauseTime,
					t = (pauseTime || pauseTime === 0) ? pauseTime : this._timeline.totalTime();
				this._startTime = t - ((t - this._startTime) * this._timeScale / value);
			}
			this._timeScale = value;
			return this._uncache(false);
		};

		p.reversed = function(value) {
			if (!arguments.length) {
				return this._reversed;
			}
			if (value != this._reversed) {
				this._reversed = value;
				this.totalTime(this._totalTime, true);
			}
			return this;
		};

		p.paused = function(value) {
			if (!arguments.length) {
				return this._paused;
			}
			if (value != this._paused) if (this._timeline) {
				if (!_tickerActive && !value) {
					_ticker.wake();
				}
				var tl = this._timeline,
					raw = tl.rawTime(),
					elapsed = raw - this._pauseTime;
				if (!value && tl.smoothChildTiming) {
					this._startTime += elapsed;
					this._uncache(false);
				}
				this._pauseTime = value ? raw : null;
				this._paused = value;
				this._active = (!value && this._totalTime > 0 && this._totalTime < this._totalDuration);
				if (!value && elapsed !== 0 && this._duration !== 0) {
					this.render((tl.smoothChildTiming ? this._totalTime : (raw - this._startTime) / this._timeScale), true, true); //in case the target's properties changed via some other tween or manual update by the user, we should force a render.
				}
			}
			if (this._gc && !value) {
				this._enabled(true, false);
			}
			return this;
		};


/*
 * ----------------------------------------------------------------
 * SimpleTimeline
 * ----------------------------------------------------------------
 */
		var SimpleTimeline = _class("core.SimpleTimeline", function(vars) {
			Animation.call(this, 0, vars);
			this.autoRemoveChildren = this.smoothChildTiming = true;
		});

		p = SimpleTimeline.prototype = new Animation();
		p.constructor = SimpleTimeline;
		p.kill()._gc = false;
		p._first = p._last = null;
		p._sortChildren = false;

		p.add = p.insert = function(child, position, align, stagger) {
			var prevTween, st;
			child._startTime = Number(position || 0) + child._delay;
			if (child._paused) if (this !== child._timeline) { //we only adjust the _pauseTime if it wasn't in this timeline already. Remember, sometimes a tween will be inserted again into the same timeline when its startTime is changed so that the tweens in the TimelineLite/Max are re-ordered properly in the linked list (so everything renders in the proper order).
				child._pauseTime = child._startTime + ((this.rawTime() - child._startTime) / child._timeScale);
			}
			if (child.timeline) {
				child.timeline._remove(child, true); //removes from existing timeline so that it can be properly added to this one.
			}
			child.timeline = child._timeline = this;
			if (child._gc) {
				child._enabled(true, true);
			}
			prevTween = this._last;
			if (this._sortChildren) {
				st = child._startTime;
				while (prevTween && prevTween._startTime > st) {
					prevTween = prevTween._prev;
				}
			}
			if (prevTween) {
				child._next = prevTween._next;
				prevTween._next = child;
			} else {
				child._next = this._first;
				this._first = child;
			}
			if (child._next) {
				child._next._prev = child;
			} else {
				this._last = child;
			}
			child._prev = prevTween;
			if (this._timeline) {
				this._uncache(true);
			}
			return this;
		};

		p._remove = function(tween, skipDisable) {
			if (tween.timeline === this) {
				if (!skipDisable) {
					tween._enabled(false, true);
				}
				tween.timeline = null;

				if (tween._prev) {
					tween._prev._next = tween._next;
				} else if (this._first === tween) {
					this._first = tween._next;
				}
				if (tween._next) {
					tween._next._prev = tween._prev;
				} else if (this._last === tween) {
					this._last = tween._prev;
				}

				if (this._timeline) {
					this._uncache(true);
				}
			}
			return this;
		};

		p.render = function(time, suppressEvents, force) {
			var tween = this._first,
				next;
			this._totalTime = this._time = this._rawPrevTime = time;
			while (tween) {
				next = tween._next; //record it here because the value could change after rendering...
				if (tween._active || (time >= tween._startTime && !tween._paused)) {
					if (!tween._reversed) {
						tween.render((time - tween._startTime) * tween._timeScale, suppressEvents, force);
					} else {
						tween.render(((!tween._dirty) ? tween._totalDuration : tween.totalDuration()) - ((time - tween._startTime) * tween._timeScale), suppressEvents, force);
					}
				}
				tween = next;
			}
		};

		p.rawTime = function() {
			if (!_tickerActive) {
				_ticker.wake();
			}
			return this._totalTime;
		};


/*
 * ----------------------------------------------------------------
 * TweenLite
 * ----------------------------------------------------------------
 */
		var TweenLite = _class("TweenLite", function(target, duration, vars) {
				Animation.call(this, duration, vars);
				this.render = TweenLite.prototype.render; //speed optimization (avoid prototype lookup on this "hot" method)

				if (target == null) {
					throw "Cannot tween a null target.";
				}

				this.target = target = (typeof(target) !== "string") ? target : TweenLite.selector(target) || target;

				var isSelector = (target.jquery || (target.length && target !== window && target[0] && (target[0] === window || (target[0].nodeType && target[0].style && !target.nodeType)))),
					overwrite = this.vars.overwrite,
					i, targ, targets;

				this._overwrite = overwrite = (overwrite == null) ? _overwriteLookup[TweenLite.defaultOverwrite] : (typeof(overwrite) === "number") ? overwrite >> 0 : _overwriteLookup[overwrite];

				if ((isSelector || target instanceof Array) && typeof(target[0]) !== "number") {
					this._targets = targets = _slice.call(target, 0);
					this._propLookup = [];
					this._siblings = [];
					for (i = 0; i < targets.length; i++) {
						targ = targets[i];
						if (!targ) {
							targets.splice(i--, 1);
							continue;
						} else if (typeof(targ) === "string") {
							targ = targets[i--] = TweenLite.selector(targ); //in case it's an array of strings
							if (typeof(targ) === "string") {
								targets.splice(i+1, 1); //to avoid an endless loop (can't imagine why the selector would return a string, but just in case)
							}
							continue;
						} else if (targ.length && targ !== window && targ[0] && (targ[0] === window || (targ[0].nodeType && targ[0].style && !targ.nodeType))) { //in case the user is passing in an array of selector objects (like jQuery objects), we need to check one more level and pull things out if necessary. Also note that <select> elements pass all the criteria regarding length and the first child having style, so we must also check to ensure the target isn't an HTML node itself.
							targets.splice(i--, 1);
							this._targets = targets = targets.concat(_slice.call(targ, 0));
							continue;
						}
						this._siblings[i] = _register(targ, this, false);
						if (overwrite === 1) if (this._siblings[i].length > 1) {
							_applyOverwrite(targ, this, null, 1, this._siblings[i]);
						}
					}

				} else {
					this._propLookup = {};
					this._siblings = _register(target, this, false);
					if (overwrite === 1) if (this._siblings.length > 1) {
						_applyOverwrite(target, this, null, 1, this._siblings);
					}
				}
				if (this.vars.immediateRender || (duration === 0 && this._delay === 0 && this.vars.immediateRender !== false)) {
					this.render(-this._delay, false, true);
				}
			}, true),
			_isSelector = function(v) {
				return (v.length && v !== window && v[0] && (v[0] === window || (v[0].nodeType && v[0].style && !v.nodeType))); //we cannot check "nodeType" if the target is window from within an iframe, otherwise it will trigger a security error in some browsers like Firefox.
			},
			_autoCSS = function(vars, target) {
				var css = {},
					p;
				for (p in vars) {
					if (!_reservedProps[p] && (!(p in target) || p === "x" || p === "y" || p === "width" || p === "height" || p === "className" || p === "border") && (!_plugins[p] || (_plugins[p] && _plugins[p]._autoCSS))) { //note: <img> elements contain read-only "x" and "y" properties. We should also prioritize editing css width/height rather than the element's properties.
						css[p] = vars[p];
						delete vars[p];
					}
				}
				vars.css = css;
			};

		p = TweenLite.prototype = new Animation();
		p.constructor = TweenLite;
		p.kill()._gc = false;

//----TweenLite defaults, overwrite management, and root updates ----------------------------------------------------

		p.ratio = 0;
		p._firstPT = p._targets = p._overwrittenProps = p._startAt = null;
		p._notifyPluginsOfEnabled = false;

		TweenLite.version = "1.10.3";
		TweenLite.defaultEase = p._ease = new Ease(null, null, 1, 1);
		TweenLite.defaultOverwrite = "auto";
		TweenLite.ticker = _ticker;
		TweenLite.autoSleep = true;
		TweenLite.selector = window.$ || window.jQuery || function(e) { if (window.$) { TweenLite.selector = window.$; return window.$(e); } return window.document ? window.document.getElementById((e.charAt(0) === "#") ? e.substr(1) : e) : e; };

		var _internals = TweenLite._internals = {}, //gives us a way to expose certain private values to other GreenSock classes without contaminating tha main TweenLite object.
			_plugins = TweenLite._plugins = {},
			_tweenLookup = TweenLite._tweenLookup = {},
			_tweenLookupNum = 0,
			_reservedProps = _internals.reservedProps = {ease:1, delay:1, overwrite:1, onComplete:1, onCompleteParams:1, onCompleteScope:1, useFrames:1, runBackwards:1, startAt:1, onUpdate:1, onUpdateParams:1, onUpdateScope:1, onStart:1, onStartParams:1, onStartScope:1, onReverseComplete:1, onReverseCompleteParams:1, onReverseCompleteScope:1, onRepeat:1, onRepeatParams:1, onRepeatScope:1, easeParams:1, yoyo:1, immediateRender:1, repeat:1, repeatDelay:1, data:1, paused:1, reversed:1, autoCSS:1},
			_overwriteLookup = {none:0, all:1, auto:2, concurrent:3, allOnStart:4, preexisting:5, "true":1, "false":0},
			_rootFramesTimeline = Animation._rootFramesTimeline = new SimpleTimeline(),
			_rootTimeline = Animation._rootTimeline = new SimpleTimeline();

		_rootTimeline._startTime = _ticker.time;
		_rootFramesTimeline._startTime = _ticker.frame;
		_rootTimeline._active = _rootFramesTimeline._active = true;

		Animation._updateRoot = function() {
				_rootTimeline.render((_ticker.time - _rootTimeline._startTime) * _rootTimeline._timeScale, false, false);
				_rootFramesTimeline.render((_ticker.frame - _rootFramesTimeline._startTime) * _rootFramesTimeline._timeScale, false, false);
				if (!(_ticker.frame % 120)) { //dump garbage every 120 frames...
					var i, a, p;
					for (p in _tweenLookup) {
						a = _tweenLookup[p].tweens;
						i = a.length;
						while (--i > -1) {
							if (a[i]._gc) {
								a.splice(i, 1);
							}
						}
						if (a.length === 0) {
							delete _tweenLookup[p];
						}
					}
					//if there are no more tweens in the root timelines, or if they're all paused, make the _timer sleep to reduce load on the CPU slightly
					p = _rootTimeline._first;
					if (!p || p._paused) if (TweenLite.autoSleep && !_rootFramesTimeline._first && _ticker._listeners.tick.length === 1) {
						while (p && p._paused) {
							p = p._next;
						}
						if (!p) {
							_ticker.sleep();
						}
					}
				}
			};

		_ticker.addEventListener("tick", Animation._updateRoot);

		var _register = function(target, tween, scrub) {
				var id = target._gsTweenID, a, i;
				if (!_tweenLookup[id || (target._gsTweenID = id = "t" + (_tweenLookupNum++))]) {
					_tweenLookup[id] = {target:target, tweens:[]};
				}
				if (tween) {
					a = _tweenLookup[id].tweens;
					a[(i = a.length)] = tween;
					if (scrub) {
						while (--i > -1) {
							if (a[i] === tween) {
								a.splice(i, 1);
							}
						}
					}
				}
				return _tweenLookup[id].tweens;
			},

			_applyOverwrite = function(target, tween, props, mode, siblings) {
				var i, changed, curTween, l;
				if (mode === 1 || mode >= 4) {
					l = siblings.length;
					for (i = 0; i < l; i++) {
						if ((curTween = siblings[i]) !== tween) {
							if (!curTween._gc) if (curTween._enabled(false, false)) {
								changed = true;
							}
						} else if (mode === 5) {
							break;
						}
					}
					return changed;
				}
				//NOTE: Add 0.0000000001 to overcome floating point errors that can cause the startTime to be VERY slightly off (when a tween's time() is set for example)
				var startTime = tween._startTime + 0.0000000001,
					overlaps = [],
					oCount = 0,
					zeroDur = (tween._duration === 0),
					globalStart;
				i = siblings.length;
				while (--i > -1) {
					if ((curTween = siblings[i]) === tween || curTween._gc || curTween._paused) {
						//ignore
					} else if (curTween._timeline !== tween._timeline) {
						globalStart = globalStart || _checkOverlap(tween, 0, zeroDur);
						if (_checkOverlap(curTween, globalStart, zeroDur) === 0) {
							overlaps[oCount++] = curTween;
						}
					} else if (curTween._startTime <= startTime) if (curTween._startTime + curTween.totalDuration() / curTween._timeScale + 0.0000000001 > startTime) if (!((zeroDur || !curTween._initted) && startTime - curTween._startTime <= 0.0000000002)) {
						overlaps[oCount++] = curTween;
					}
				}

				i = oCount;
				while (--i > -1) {
					curTween = overlaps[i];
					if (mode === 2) if (curTween._kill(props, target)) {
						changed = true;
					}
					if (mode !== 2 || (!curTween._firstPT && curTween._initted)) {
						if (curTween._enabled(false, false)) { //if all property tweens have been overwritten, kill the tween.
							changed = true;
						}
					}
				}
				return changed;
			},

			_checkOverlap = function(tween, reference, zeroDur) {
				var tl = tween._timeline,
					ts = tl._timeScale,
					t = tween._startTime,
					min = 0.0000000001; //we use this to protect from rounding errors.
				while (tl._timeline) {
					t += tl._startTime;
					ts *= tl._timeScale;
					if (tl._paused) {
						return -100;
					}
					tl = tl._timeline;
				}
				t /= ts;
				return (t > reference) ? t - reference : ((zeroDur && t === reference) || (!tween._initted && t - reference < 2 * min)) ? min : ((t += tween.totalDuration() / tween._timeScale / ts) > reference + min) ? 0 : t - reference - min;
			};


//---- TweenLite instance methods -----------------------------------------------------------------------------

		p._init = function() {
			var v = this.vars,
				op = this._overwrittenProps,
				dur = this._duration,
				immediate = v.immediateRender,
				ease = v.ease,
				i, initPlugins, pt, p;
			if (v.startAt) {
				if (this._startAt) {
					this._startAt.render(-1, true); //if we've run a startAt previously (when the tween instantiated), we should revert it so that the values re-instantiate correctly particularly for relative tweens. Without this, a TweenLite.fromTo(obj, 1, {x:"+=100"}, {x:"-=100"}), for example, would actually jump to +=200 because the startAt would run twice, doubling the relative change.
				}
				v.startAt.overwrite = 0;
				v.startAt.immediateRender = true;
				this._startAt = TweenLite.to(this.target, 0, v.startAt);
				if (immediate) {
					if (this._time > 0) {
						this._startAt = null; //tweens that render immediately (like most from() and fromTo() tweens) shouldn't revert when their parent timeline's playhead goes backward past the startTime because the initial render could have happened anytime and it shouldn't be directly correlated to this tween's startTime. Imagine setting up a complex animation where the beginning states of various objects are rendered immediately but the tween doesn't happen for quite some time - if we revert to the starting values as soon as the playhead goes backward past the tween's startTime, it will throw things off visually. Reversion should only happen in TimelineLite/Max instances where immediateRender was false (which is the default in the convenience methods like from()).
					} else if (dur !== 0) {
						return; //we skip initialization here so that overwriting doesn't occur until the tween actually begins. Otherwise, if you create several immediateRender:true tweens of the same target/properties to drop into a TimelineLite or TimelineMax, the last one created would overwrite the first ones because they didn't get placed into the timeline yet before the first render occurs and kicks in overwriting.
					}
				}
			} else if (v.runBackwards && v.immediateRender && dur !== 0) {
				//from() tweens must be handled uniquely: their beginning values must be rendered but we don't want overwriting to occur yet (when time is still 0). Wait until the tween actually begins before doing all the routines like overwriting. At that time, we should render at the END of the tween to ensure that things initialize correctly (remember, from() tweens go backwards)
				if (this._startAt) {
					this._startAt.render(-1, true);
					this._startAt = null;
				} else if (this._time === 0) {
					pt = {};
					for (p in v) { //copy props into a new object and skip any reserved props, otherwise onComplete or onUpdate or onStart could fire. We should, however, permit autoCSS to go through.
						if (!_reservedProps[p] || p === "autoCSS") {
							pt[p] = v[p];
						}
					}
					pt.overwrite = 0;
					this._startAt = TweenLite.to(this.target, 0, pt);
					return;
				}
			}
			if (!ease) {
				this._ease = TweenLite.defaultEase;
			} else if (ease instanceof Ease) {
				this._ease = (v.easeParams instanceof Array) ? ease.config.apply(ease, v.easeParams) : ease;
			} else {
				this._ease = (typeof(ease) === "function") ? new Ease(ease, v.easeParams) : _easeMap[ease] || TweenLite.defaultEase;
			}
			this._easeType = this._ease._type;
			this._easePower = this._ease._power;
			this._firstPT = null;

			if (this._targets) {
				i = this._targets.length;
				while (--i > -1) {
					if ( this._initProps( this._targets[i], (this._propLookup[i] = {}), this._siblings[i], (op ? op[i] : null)) ) {
						initPlugins = true;
					}
				}
			} else {
				initPlugins = this._initProps(this.target, this._propLookup, this._siblings, op);
			}

			if (initPlugins) {
				TweenLite._onPluginEvent("_onInitAllProps", this); //reorders the array in order of priority. Uses a static TweenPlugin method in order to minimize file size in TweenLite
			}
			if (op) if (!this._firstPT) if (typeof(this.target) !== "function") { //if all tweening properties have been overwritten, kill the tween. If the target is a function, it's probably a delayedCall so let it live.
				this._enabled(false, false);
			}
			if (v.runBackwards) {
				pt = this._firstPT;
				while (pt) {
					pt.s += pt.c;
					pt.c = -pt.c;
					pt = pt._next;
				}
			}
			this._onUpdate = v.onUpdate;
			this._initted = true;
		};

		p._initProps = function(target, propLookup, siblings, overwrittenProps) {
			var p, i, initPlugins, plugin, a, pt, v;
			if (target == null) {
				return false;
			}
			if (!this.vars.css) if (target.style) if (target !== window && target.nodeType) if (_plugins.css) if (this.vars.autoCSS !== false) { //it's so common to use TweenLite/Max to animate the css of DOM elements, we assume that if the target is a DOM element, that's what is intended (a convenience so that users don't have to wrap things in css:{}, although we still recommend it for a slight performance boost and better specificity). Note: we cannot check "nodeType" on the window inside an iframe.
				_autoCSS(this.vars, target);
			}
			for (p in this.vars) {
				v = this.vars[p];
				if (_reservedProps[p]) {
					if (v instanceof Array) if (v.join("").indexOf("{self}") !== -1) {
						this.vars[p] = v = this._swapSelfInParams(v, this);
					}

				} else if (_plugins[p] && (plugin = new _plugins[p]())._onInitTween(target, this.vars[p], this)) {

					//t - target 		[object]
					//p - property 		[string]
					//s - start			[number]
					//c - change		[number]
					//f - isFunction	[boolean]
					//n - name			[string]
					//pg - isPlugin 	[boolean]
					//pr - priority		[number]
					this._firstPT = pt = {_next:this._firstPT, t:plugin, p:"setRatio", s:0, c:1, f:true, n:p, pg:true, pr:plugin._priority};
					i = plugin._overwriteProps.length;
					while (--i > -1) {
						propLookup[plugin._overwriteProps[i]] = this._firstPT;
					}
					if (plugin._priority || plugin._onInitAllProps) {
						initPlugins = true;
					}
					if (plugin._onDisable || plugin._onEnable) {
						this._notifyPluginsOfEnabled = true;
					}

				} else {
					this._firstPT = propLookup[p] = pt = {_next:this._firstPT, t:target, p:p, f:(typeof(target[p]) === "function"), n:p, pg:false, pr:0};
					pt.s = (!pt.f) ? parseFloat(target[p]) : target[ ((p.indexOf("set") || typeof(target["get" + p.substr(3)]) !== "function") ? p : "get" + p.substr(3)) ]();
					pt.c = (typeof(v) === "string" && v.charAt(1) === "=") ? parseInt(v.charAt(0) + "1", 10) * Number(v.substr(2)) : (Number(v) - pt.s) || 0;
				}
				if (pt) if (pt._next) {
					pt._next._prev = pt;
				}
			}

			if (overwrittenProps) if (this._kill(overwrittenProps, target)) { //another tween may have tried to overwrite properties of this tween before init() was called (like if two tweens start at the same time, the one created second will run first)
				return this._initProps(target, propLookup, siblings, overwrittenProps);
			}
			if (this._overwrite > 1) if (this._firstPT) if (siblings.length > 1) if (_applyOverwrite(target, this, propLookup, this._overwrite, siblings)) {
				this._kill(propLookup, target);
				return this._initProps(target, propLookup, siblings, overwrittenProps);
			}
			return initPlugins;
		};

		p.render = function(time, suppressEvents, force) {
			var prevTime = this._time,
				isComplete, callback, pt;
			if (time >= this._duration) {
				this._totalTime = this._time = this._duration;
				this.ratio = this._ease._calcEnd ? this._ease.getRatio(1) : 1;
				if (!this._reversed) {
					isComplete = true;
					callback = "onComplete";
				}
				if (this._duration === 0) { //zero-duration tweens are tricky because we must discern the momentum/direction of time in order to determine whether the starting values should be rendered or the ending values. If the "playhead" of its timeline goes past the zero-duration tween in the forward direction or lands directly on it, the end values should be rendered, but if the timeline's "playhead" moves past it in the backward direction (from a postitive time to a negative time), the starting values must be rendered.
					if (time === 0 || this._rawPrevTime < 0) if (this._rawPrevTime !== time) {
						force = true;
						if (this._rawPrevTime > 0) {
							callback = "onReverseComplete";
							if (suppressEvents) {
								time = -1; //when a callback is placed at the VERY beginning of a timeline and it repeats (or if timeline.seek(0) is called), events are normally suppressed during those behaviors (repeat or seek()) and without adjusting the _rawPrevTime back slightly, the onComplete wouldn't get called on the next render. This only applies to zero-duration tweens/callbacks of course.
							}
						}
					}
					this._rawPrevTime = time;
				}

			} else if (time < 0.0000001) { //to work around occasional floating point math artifacts, round super small values to 0.
				this._totalTime = this._time = 0;
				this.ratio = this._ease._calcEnd ? this._ease.getRatio(0) : 0;
				if (prevTime !== 0 || (this._duration === 0 && this._rawPrevTime > 0)) {
					callback = "onReverseComplete";
					isComplete = this._reversed;
				}
				if (time < 0) {
					this._active = false;
					if (this._duration === 0) { //zero-duration tweens are tricky because we must discern the momentum/direction of time in order to determine whether the starting values should be rendered or the ending values. If the "playhead" of its timeline goes past the zero-duration tween in the forward direction or lands directly on it, the end values should be rendered, but if the timeline's "playhead" moves past it in the backward direction (from a postitive time to a negative time), the starting values must be rendered.
						if (this._rawPrevTime >= 0) {
							force = true;
						}
						this._rawPrevTime = time;
					}
				} else if (!this._initted) { //if we render the very beginning (time == 0) of a fromTo(), we must force the render (normal tweens wouldn't need to render at a time of 0 when the prevTime was also 0). This is also mandatory to make sure overwriting kicks in immediately.
					force = true;
				}

			} else {
				this._totalTime = this._time = time;

				if (this._easeType) {
					var r = time / this._duration, type = this._easeType, pow = this._easePower;
					if (type === 1 || (type === 3 && r >= 0.5)) {
						r = 1 - r;
					}
					if (type === 3) {
						r *= 2;
					}
					if (pow === 1) {
						r *= r;
					} else if (pow === 2) {
						r *= r * r;
					} else if (pow === 3) {
						r *= r * r * r;
					} else if (pow === 4) {
						r *= r * r * r * r;
					}

					if (type === 1) {
						this.ratio = 1 - r;
					} else if (type === 2) {
						this.ratio = r;
					} else if (time / this._duration < 0.5) {
						this.ratio = r / 2;
					} else {
						this.ratio = 1 - (r / 2);
					}

				} else {
					this.ratio = this._ease.getRatio(time / this._duration);
				}

			}

			if (this._time === prevTime && !force) {
				return;
			} else if (!this._initted) {
				this._init();
				if (!this._initted) { //immediateRender tweens typically won't initialize until the playhead advances (_time is greater than 0) in order to ensure that overwriting occurs properly.
					return;
				}
				//_ease is initially set to defaultEase, so now that init() has run, _ease is set properly and we need to recalculate the ratio. Overall this is faster than using conditional logic earlier in the method to avoid having to set ratio twice because we only init() once but renderTime() gets called VERY frequently.
				if (this._time && !isComplete) {
					this.ratio = this._ease.getRatio(this._time / this._duration);
				} else if (isComplete && this._ease._calcEnd) {
					this.ratio = this._ease.getRatio((this._time === 0) ? 0 : 1);
				}
			}

			if (!this._active) if (!this._paused && this._time !== prevTime && time >= 0) {
				this._active = true;  //so that if the user renders a tween (as opposed to the timeline rendering it), the timeline is forced to re-render and align it with the proper time/frame on the next rendering cycle. Maybe the tween already finished but the user manually re-renders it as halfway done.
			}

			if (prevTime === 0) {
				if (this._startAt) {
					if (time >= 0) {
						this._startAt.render(time, suppressEvents, force);
					} else if (!callback) {
						callback = "_dummyGS"; //if no callback is defined, use a dummy value just so that the condition at the end evaluates as true because _startAt should render AFTER the normal render loop when the time is negative. We could handle this in a more intuitive way, of course, but the render loop is the MOST important thing to optimize, so this technique allows us to avoid adding extra conditional logic in a high-frequency area.
					}
				}
				if (this.vars.onStart) if (this._time !== 0 || this._duration === 0) if (!suppressEvents) {
					this.vars.onStart.apply(this.vars.onStartScope || this, this.vars.onStartParams || _blankArray);
				}
			}

			pt = this._firstPT;
			while (pt) {
				if (pt.f) {
					pt.t[pt.p](pt.c * this.ratio + pt.s);
				} else {
					pt.t[pt.p] = pt.c * this.ratio + pt.s;
				}
				pt = pt._next;
			}

			if (this._onUpdate) {
				if (time < 0) if (this._startAt) {
					this._startAt.render(time, suppressEvents, force); //note: for performance reasons, we tuck this conditional logic inside less traveled areas (most tweens don't have an onUpdate). We'd just have it at the end before the onComplete, but the values should be updated before any onUpdate is called, so we ALSO put it here and then if it's not called, we do so later near the onComplete.
				}
				if (!suppressEvents) {
					this._onUpdate.apply(this.vars.onUpdateScope || this, this.vars.onUpdateParams || _blankArray);
				}
			}

			if (callback) if (!this._gc) { //check _gc because there's a chance that kill() could be called in an onUpdate
				if (time < 0 && this._startAt && !this._onUpdate) {
					this._startAt.render(time, suppressEvents, force);
				}
				if (isComplete) {
					if (this._timeline.autoRemoveChildren) {
						this._enabled(false, false);
					}
					this._active = false;
				}
				if (!suppressEvents && this.vars[callback]) {
					this.vars[callback].apply(this.vars[callback + "Scope"] || this, this.vars[callback + "Params"] || _blankArray);
				}
			}

		};

		p._kill = function(vars, target) {
			if (vars === "all") {
				vars = null;
			}
			if (vars == null) if (target == null || target === this.target) {
				return this._enabled(false, false);
			}
			target = (typeof(target) !== "string") ? (target || this._targets || this.target) : TweenLite.selector(target) || target;
			var i, overwrittenProps, p, pt, propLookup, changed, killProps, record;
			if ((target instanceof Array || _isSelector(target)) && typeof(target[0]) !== "number") {
				i = target.length;
				while (--i > -1) {
					if (this._kill(vars, target[i])) {
						changed = true;
					}
				}
			} else {
				if (this._targets) {
					i = this._targets.length;
					while (--i > -1) {
						if (target === this._targets[i]) {
							propLookup = this._propLookup[i] || {};
							this._overwrittenProps = this._overwrittenProps || [];
							overwrittenProps = this._overwrittenProps[i] = vars ? this._overwrittenProps[i] || {} : "all";
							break;
						}
					}
				} else if (target !== this.target) {
					return false;
				} else {
					propLookup = this._propLookup;
					overwrittenProps = this._overwrittenProps = vars ? this._overwrittenProps || {} : "all";
				}

				if (propLookup) {
					killProps = vars || propLookup;
					record = (vars !== overwrittenProps && overwrittenProps !== "all" && vars !== propLookup && (vars == null || vars._tempKill !== true)); //_tempKill is a super-secret way to delete a particular tweening property but NOT have it remembered as an official overwritten property (like in BezierPlugin)
					for (p in killProps) {
						if ((pt = propLookup[p])) {
							if (pt.pg && pt.t._kill(killProps)) {
								changed = true; //some plugins need to be notified so they can perform cleanup tasks first
							}
							if (!pt.pg || pt.t._overwriteProps.length === 0) {
								if (pt._prev) {
									pt._prev._next = pt._next;
								} else if (pt === this._firstPT) {
									this._firstPT = pt._next;
								}
								if (pt._next) {
									pt._next._prev = pt._prev;
								}
								pt._next = pt._prev = null;
							}
							delete propLookup[p];
						}
						if (record) {
							overwrittenProps[p] = 1;
						}
					}
					if (!this._firstPT && this._initted) { //if all tweening properties are killed, kill the tween. Without this line, if there's a tween with multiple targets and then you killTweensOf() each target individually, the tween would technically still remain active and fire its onComplete even though there aren't any more properties tweening.
						this._enabled(false, false);
					}
				}
			}
			return changed;
		};

		p.invalidate = function() {
			if (this._notifyPluginsOfEnabled) {
				TweenLite._onPluginEvent("_onDisable", this);
			}
			this._firstPT = null;
			this._overwrittenProps = null;
			this._onUpdate = null;
			this._startAt = null;
			this._initted = this._active = this._notifyPluginsOfEnabled = false;
			this._propLookup = (this._targets) ? {} : [];
			return this;
		};

		p._enabled = function(enabled, ignoreTimeline) {
			if (!_tickerActive) {
				_ticker.wake();
			}
			if (enabled && this._gc) {
				var targets = this._targets,
					i;
				if (targets) {
					i = targets.length;
					while (--i > -1) {
						this._siblings[i] = _register(targets[i], this, true);
					}
				} else {
					this._siblings = _register(this.target, this, true);
				}
			}
			Animation.prototype._enabled.call(this, enabled, ignoreTimeline);
			if (this._notifyPluginsOfEnabled) if (this._firstPT) {
				return TweenLite._onPluginEvent((enabled ? "_onEnable" : "_onDisable"), this);
			}
			return false;
		};


//----TweenLite static methods -----------------------------------------------------

		TweenLite.to = function(target, duration, vars) {
			return new TweenLite(target, duration, vars);
		};

		TweenLite.from = function(target, duration, vars) {
			vars.runBackwards = true;
			vars.immediateRender = (vars.immediateRender != false);
			return new TweenLite(target, duration, vars);
		};

		TweenLite.fromTo = function(target, duration, fromVars, toVars) {
			toVars.startAt = fromVars;
			toVars.immediateRender = (toVars.immediateRender != false && fromVars.immediateRender != false);
			return new TweenLite(target, duration, toVars);
		};

		TweenLite.delayedCall = function(delay, callback, params, scope, useFrames) {
			return new TweenLite(callback, 0, {delay:delay, onComplete:callback, onCompleteParams:params, onCompleteScope:scope, onReverseComplete:callback, onReverseCompleteParams:params, onReverseCompleteScope:scope, immediateRender:false, useFrames:useFrames, overwrite:0});
		};

		TweenLite.set = function(target, vars) {
			return new TweenLite(target, 0, vars);
		};

		TweenLite.killTweensOf = TweenLite.killDelayedCallsTo = function(target, vars) {
			var a = TweenLite.getTweensOf(target),
				i = a.length;
			while (--i > -1) {
				a[i]._kill(vars, target);
			}
		};

		TweenLite.getTweensOf = function(target) {
			if (target == null) { return []; }
			target = (typeof(target) !== "string") ? target : TweenLite.selector(target) || target;
			var i, a, j, t;
			if ((target instanceof Array || _isSelector(target)) && typeof(target[0]) !== "number") {
				i = target.length;
				a = [];
				while (--i > -1) {
					a = a.concat(TweenLite.getTweensOf(target[i]));
				}
				i = a.length;
				//now get rid of any duplicates (tweens of arrays of objects could cause duplicates)
				while (--i > -1) {
					t = a[i];
					j = i;
					while (--j > -1) {
						if (t === a[j]) {
							a.splice(i, 1);
						}
					}
				}
			} else {
				a = _register(target).concat();
				i = a.length;
				while (--i > -1) {
					if (a[i]._gc) {
						a.splice(i, 1);
					}
				}
			}
			return a;
		};



/*
 * ----------------------------------------------------------------
 * TweenPlugin   (could easily be split out as a separate file/class, but included for ease of use (so that people don't need to include another <script> call before loading plugins which is easy to forget)
 * ----------------------------------------------------------------
 */
		var TweenPlugin = _class("plugins.TweenPlugin", function(props, priority) {
					this._overwriteProps = (props || "").split(",");
					this._propName = this._overwriteProps[0];
					this._priority = priority || 0;
					this._super = TweenPlugin.prototype;
				}, true);

		p = TweenPlugin.prototype;
		TweenPlugin.version = "1.10.1";
		TweenPlugin.API = 2;
		p._firstPT = null;

		p._addTween = function(target, prop, start, end, overwriteProp, round) {
			var c, pt;
			if (end != null && (c = (typeof(end) === "number" || end.charAt(1) !== "=") ? Number(end) - start : parseInt(end.charAt(0) + "1", 10) * Number(end.substr(2)))) {
				this._firstPT = pt = {_next:this._firstPT, t:target, p:prop, s:start, c:c, f:(typeof(target[prop]) === "function"), n:overwriteProp || prop, r:round};
				if (pt._next) {
					pt._next._prev = pt;
				}
				return pt;
			}
		};

		p.setRatio = function(v) {
			var pt = this._firstPT,
				min = 0.000001,
				val;
			while (pt) {
				val = pt.c * v + pt.s;
				if (pt.r) {
					val = (val + ((val > 0) ? 0.5 : -0.5)) | 0; //about 4x faster than Math.round()
				} else if (val < min) if (val > -min) { //prevents issues with converting very small numbers to strings in the browser
					val = 0;
				}
				if (pt.f) {
					pt.t[pt.p](val);
				} else {
					pt.t[pt.p] = val;
				}
				pt = pt._next;
			}
		};

		p._kill = function(lookup) {
			var a = this._overwriteProps,
				pt = this._firstPT,
				i;
			if (lookup[this._propName] != null) {
				this._overwriteProps = [];
			} else {
				i = a.length;
				while (--i > -1) {
					if (lookup[a[i]] != null) {
						a.splice(i, 1);
					}
				}
			}
			while (pt) {
				if (lookup[pt.n] != null) {
					if (pt._next) {
						pt._next._prev = pt._prev;
					}
					if (pt._prev) {
						pt._prev._next = pt._next;
						pt._prev = null;
					} else if (this._firstPT === pt) {
						this._firstPT = pt._next;
					}
				}
				pt = pt._next;
			}
			return false;
		};

		p._roundProps = function(lookup, value) {
			var pt = this._firstPT;
			while (pt) {
				if (lookup[this._propName] || (pt.n != null && lookup[ pt.n.split(this._propName + "_").join("") ])) { //some properties that are very plugin-specific add a prefix named after the _propName plus an underscore, so we need to ignore that extra stuff here.
					pt.r = value;
				}
				pt = pt._next;
			}
		};

		TweenLite._onPluginEvent = function(type, tween) {
			var pt = tween._firstPT,
				changed, pt2, first, last, next;
			if (type === "_onInitAllProps") {
				//sorts the PropTween linked list in order of priority because some plugins need to render earlier/later than others, like MotionBlurPlugin applies its effects after all x/y/alpha tweens have rendered on each frame.
				while (pt) {
					next = pt._next;
					pt2 = first;
					while (pt2 && pt2.pr > pt.pr) {
						pt2 = pt2._next;
					}
					if ((pt._prev = pt2 ? pt2._prev : last)) {
						pt._prev._next = pt;
					} else {
						first = pt;
					}
					if ((pt._next = pt2)) {
						pt2._prev = pt;
					} else {
						last = pt;
					}
					pt = next;
				}
				pt = tween._firstPT = first;
			}
			while (pt) {
				if (pt.pg) if (typeof(pt.t[type]) === "function") if (pt.t[type]()) {
					changed = true;
				}
				pt = pt._next;
			}
			return changed;
		};

		TweenPlugin.activate = function(plugins) {
			var i = plugins.length;
			while (--i > -1) {
				if (plugins[i].API === TweenPlugin.API) {
					_plugins[(new plugins[i]())._propName] = plugins[i];
				}
			}
			return true;
		};

		//provides a more concise way to define plugins that have no dependencies besides TweenPlugin and TweenLite, wrapping common boilerplate stuff into one function (added in 1.9.0). You don't NEED to use this to define a plugin - the old way still works and can be useful in certain (rare) situations.
		_gsDefine.plugin = function(config) {
			if (!config || !config.propName || !config.init || !config.API) { throw "illegal plugin definition."; }
			var propName = config.propName,
				priority = config.priority || 0,
				overwriteProps = config.overwriteProps,
				map = {init:"_onInitTween", set:"setRatio", kill:"_kill", round:"_roundProps", initAll:"_onInitAllProps"},
				Plugin = _class("plugins." + propName.charAt(0).toUpperCase() + propName.substr(1) + "Plugin",
					function() {
						TweenPlugin.call(this, propName, priority);
						this._overwriteProps = overwriteProps || [];
					}, (config.global === true)),
				p = Plugin.prototype = new TweenPlugin(propName),
				prop;
			p.constructor = Plugin;
			Plugin.API = config.API;
			for (prop in map) {
				if (typeof(config[prop]) === "function") {
					p[map[prop]] = config[prop];
				}
			}
			Plugin.version = config.version;
			TweenPlugin.activate([Plugin]);
			return Plugin;
		};


		//now run through all the dependencies discovered and if any are missing, log that to the console as a warning. This is why it's best to have TweenLite load last - it can check all the dependencies for you.
		a = window._gsQueue;
		if (a) {
			for (i = 0; i < a.length; i++) {
				a[i]();
			}
			for (p in _defLookup) {
				if (!_defLookup[p].func) {
					window.console.log("GSAP encountered missing dependency: com.greensock." + p);
				}
			}
		}

		_tickerActive = false; //ensures that the first official animation forces a ticker.tick() to update the time when it is instantiated

})(window);
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
////////////////////////////////////
function init() {

    trace("init");

    GAME.AssetsLoader = [];

    GAME.Stage = new PIXI.Stage();
    GAME.Renderer = PIXI.autoDetectRenderer(CONFIG.sw, CONFIG.sh, { transparent: true });
    document.getElementById('canvasHolder').appendChild(GAME.Renderer.view);

    loadTextures();

    createBubbleBG(); // Add tini bubble
    GAME.Container = GAME.Stage.addContainer({ id: "container", alpha: 0 });

    // Scene0JS.create();
    // Scene1JS.create();
    // Scene2JS.create();
    // Scene3JS.create();

    $(window).resize(onResize);
    // onResize();

    startLoadAssets();

    GAME.Stage.mousedown = GAME.Stage.touchstart = function(data) {
        var mousePos = data.getLocalPosition(this);
        GAME.mousePosition.x = mousePos.x;
        GAME.mousePosition.y = mousePos.y;
    }
}

function onResize() {
    CONFIG.sw = window.innerWidth;
    CONFIG.sh = window.innerHeight;

    CONFIG.my_ratio = CONFIG.sh / CONFIG.initH;

    if (CONFIG.my_ratio > 2) CONFIG.my_ratio = 2;

    $('#canvasHolder canvas').width = CONFIG.sw;
    $('#canvasHolder canvas').height = CONFIG.sh;

    Scene0JS.resize(CONFIG.sw, CONFIG.sh);
    Scene1JS.resize(CONFIG.sw, CONFIG.sh);
    Scene2JS.resize(CONFIG.sw, CONFIG.sh);
    Scene3JS.resize(CONFIG.sw, CONFIG.sh);

    GAME.Renderer.resize(CONFIG.sw, CONFIG.sh);
}


/////////////////////////////////////////////////////////////////////////////////////////
function animationIn() {
    trace("animationIn");

    onResize();

    var dur = .5;
    var delay = 1;

    TweenMax.to(GAME.Container, dur, { delay: delay, alpha: 1, ease: Sine.easeOut });
    TweenMax.to(GAME.BubbleBG, dur, { delay: delay, alpha: 1, ease: Sine.easeOut });

    gotoScene(Scene3JS);
    // Scene3JS.start();
    // Scene0JS.start();
}

function createBubbleBG() {

    GAME.BubbleBG = GAME.Stage.addContainer({ id: "bg", alpha: 0 });

    var itemArr = [];
    with(GAME.BubbleBG) {
        for (var i = 0; i < 20; i++) {
            var item = addObject({ id: "item" + i, texture: TEXTURES["images/tini_bubble.png"] })
            addChild(item);
            itemArr.push(item);
            randomBubbleBG(item, true);
        }

        GAME.BubbleBG.itemArr = itemArr;
    }

    requestAnimFrame(enterBubbleBG, 100);
}

function enterBubbleBG() {
    var itemArr = GAME.BubbleBG.itemArr;
    var len = itemArr.length;

    for (var i = 0; i < len; i++) {
        var item = itemArr[i];
        item.x += item.sp_x;
        item.y -= item.sp_y;

        item.scale.x = item.initSC + Math.sin(CONFIG.count_sc_eff_bg) * 0.08;
        item.scale.y = item.initSC + Math.cos(CONFIG.count_sc_eff_bg) * 0.08;

        if (item.position.x < -item.width ||
            item.position.x > (CONFIG.sw + item.width) ||
            item.position.y < -item.height) {

            if (item.curFrut) {
                item.removeChild(item.curFrut);
            }

            randomBubbleBG(item, false);
        }
    }

    CONFIG.count_sc_eff_bg += 0.1;
    requestAnimFrame(enterBubbleBG, 100);
}

function randomBubbleBG(item, flag) {
    item.position.x = (Math.random() - Math.random()) * CONFIG.sw;
    if (flag) item.position.y = Math.random() * CONFIG.sh;
    else item.position.y = CONFIG.sh;

    item.scale.x = item.scale.y = Math.random() * .5 + .1;
    item.initSC = item.scale.x;
    item.alpha = item.scale.x;
    item.rotation = (Math.random() - Math.random()) * 360;

    item.sp_x = (Math.random() - Math.random()) * 2;
    item.sp_y = Math.random() * 2 + 1;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Chuyển từ scene này sang scene khác
 * @param {*} curSence 
 * @param {*} target 
 */
function gotoScene(sceneJS) {
    if (!sceneJS) return;
    TweenMax.to(GAME.Container, .3, {
        alpha: 0,
        ease: Sine.easeOut,
        onComplete: function() {
            if (GAME.currentScene) {
                var currentScene;
                switch (GAME.currentScene) {
                    case "s0":
                        currentScene = GAME.Scene0;
                        break;
                    case "s1":
                        currentScene = GAME.Scene1;
                        break;
                    case "s2":
                        currentScene = GAME.Scene2;
                        break;
                    case "s3":
                        currentScene = GAME.Scene3;
                        break;
                }
                GAME.Container.removeChild(currentScene);
            }
            TweenMax.to(GAME.Container, .3, { alpha: 1, ease: Sine.easeOut });

            // switch (target.id) {
            //     case "s0":
            //         sceneJS = Scene0JS;
            //         break;
            //     case "s1":
            //         sceneJS = Scene1JS;
            //         break;
            //     case "s2":
            //         sceneJS = Scene2JS;
            //         break;
            //     case "s3":
            //         sceneJS = Scene3JS;
            //         break;
            // }
            sceneJS.create();
            sceneJS.start();
            onResize();
            GAME.currentScene = sceneJS.id;
        }
    });
}

/////////////////////////////////////////////////////////////////////////////////////////////////////
function addToQueue(url) {
    // trace(url);
    GAME.AssetsLoader.push(url);
}

/**
 * Load tất cả các image file để chuyển thành texture
 */
function loadTextures() {
    for (var i in TEXTURES) {
        addToQueue(TEXTURES[i]);
        TEXTURES[i] = new PIXI.Texture.fromImage(TEXTURES[i]);
    }
}

function startLoadAssets() {
    GAME.CountAssetsLoaded = 0;
    GAME.LoaderPercent = 0;
    GAME.TotalAssets = GAME.AssetsLoader.length;

    GAME.Loader = new PIXI.AssetLoader(GAME.AssetsLoader);
    GAME.Loader.onProgress = onProgress;
    GAME.Loader.load();
    checkLoadingAssets();
}

function checkLoadingAssets() {
    var per = GAME.CountAssetsLoaded / GAME.TotalAssets;
    GAME.LoaderPercent += (per - GAME.LoaderPercent) / 5;
    // trace("GAME.LoaderPercent =" + GAME.LoaderPercent)

    var h = $('#preloader .pr-bottle').height();
    $('#preloader .pr-bottle-grey').css('height', h - GAME.LoaderPercent * h);
    $('#preloader .pr-txt').css({ 'top': 40 - GAME.LoaderPercent * (h - 30), 'font-size': (36 - GAME.LoaderPercent * 20) });
    $('#preloader .pr-txt').text(Math.ceil(GAME.LoaderPercent * 100) + "%");

    setTimeout(function() {
        if (GAME.LoaderPercent >= .99) loadComplete();
        else checkLoadingAssets();
    }, 100);
}

function onProgress() {
    GAME.CountAssetsLoaded++;
}

function loadComplete() {
    trace("onAssetsLoadComplete");
    hidePreloader(0, 1, true);
    animationIn();
    requestAnimFrame(enterFrameFn);
}

function enterFrameFn() {
    requestAnimFrame(enterFrameFn, 1000);
    GAME.Renderer.render(GAME.Stage);
}

function fontLoaded(font, callback) {
    var check = new PIXI.Text("giItT1WQy@!-/#", { font: "50px " + font });
    var width = check.width;
    var interval = setInterval(function() {
        check.setStyle({ font: "50px " + font });
        check.updateText();

        if (check.width != width) {
            clearInterval(interval);
            check.destroy(true);
            callback();
        }
    }, 50);
}
/**
 * @license
 * pixi.js - v2.0.0
 * Copyright (c) 2012-2014, Mat Groves
 * http://goodboydigital.com/
 *
 * Compiled: 2014-10-23
 *
 * pixi.js is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license.php
 */
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */

(function() {

    var root = this;

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * @module PIXI
     */
    var PIXI = PIXI || {};

    /* 
     * 
     * This file contains a lot of pixi consts which are used across the rendering engine
     * @class Consts
     */
    PIXI.WEBGL_RENDERER = 0;
    PIXI.CANVAS_RENDERER = 1;

    // useful for testing against if your lib is using pixi.
    PIXI.VERSION = "v2.0.0";


    // the various blend modes supported by pixi
    PIXI.blendModes = {
        NORMAL: 0,
        ADD: 1,
        MULTIPLY: 2,
        SCREEN: 3,
        OVERLAY: 4,
        DARKEN: 5,
        LIGHTEN: 6,
        COLOR_DODGE: 7,
        COLOR_BURN: 8,
        HARD_LIGHT: 9,
        SOFT_LIGHT: 10,
        DIFFERENCE: 11,
        EXCLUSION: 12,
        HUE: 13,
        SATURATION: 14,
        COLOR: 15,
        LUMINOSITY: 16
    };

    // the scale modes
    PIXI.scaleModes = {
        DEFAULT: 0,
        LINEAR: 0,
        NEAREST: 1
    };

    // used to create uids for various pixi objects..
    PIXI._UID = 0;

    if (typeof(Float32Array) != 'undefined') {
        PIXI.Float32Array = Float32Array;
        PIXI.Uint16Array = Uint16Array;
    } else {
        PIXI.Float32Array = Array;
        PIXI.Uint16Array = Array;
    }

    // interaction frequency 
    PIXI.INTERACTION_FREQUENCY = 30;
    PIXI.AUTO_PREVENT_DEFAULT = true;

    PIXI.PI_2 = Math.PI * 2;
    PIXI.RAD_TO_DEG = 180 / Math.PI;
    PIXI.DEG_TO_RAD = Math.PI / 180;

    PIXI.RETINA_PREFIX = "@2x";
    //PIXI.SCALE_PREFIX "@x%%";

    PIXI.dontSayHello = false;


    PIXI.defaultRenderOptions = {
        view: null,
        transparent: false,
        antialias: false,
        preserveDrawingBuffer: false,
        resolution: 1,
        clearBeforeRender: true
    }

    PIXI.sayHello = function(type) {
        if (PIXI.dontSayHello) return;

        if (navigator.userAgent.toLowerCase().indexOf('chrome') > -1) {
            var args = [
                '%c %c %c Pixi.js ' + PIXI.VERSION + ' - ' + type + '  %c ' + ' %c ' + ' http://www.pixijs.com/  %c %c ♥%c♥%c♥ ',
                'background: #ff66a5',
                'background: #ff66a5',
                'color: #ff66a5; background: #030307;',
                'background: #ff66a5',
                'background: #ffc3dc',
                'background: #ff66a5',
                'color: #ff2424; background: #fff',
                'color: #ff2424; background: #fff',
                'color: #ff2424; background: #fff'
            ];



            console.log.apply(console, args);
        } else if (window['console']) {
            console.log('Pixi.js ' + PIXI.VERSION + ' - http://www.pixijs.com/');
        }

        PIXI.dontSayHello = true;
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * The Point object represents a location in a two-dimensional coordinate system, where x represents the horizontal axis and y represents the vertical axis.
     *
     * @class Point
     * @constructor
     * @param x {Number} position of the point on the x axis
     * @param y {Number} position of the point on the y axis
     */
    PIXI.Point = function(x, y) {
        /**
         * @property x
         * @type Number
         * @default 0
         */
        this.x = x || 0;

        /**
         * @property y
         * @type Number
         * @default 0
         */
        this.y = y || 0;
    };

    /**
     * Creates a clone of this point
     *
     * @method clone
     * @return {Point} a copy of the point
     */
    PIXI.Point.prototype.clone = function() {
        return new PIXI.Point(this.x, this.y);
    };

    /**
     * Sets the point to a new x and y position.
     * If y is omitted, both x and y will be set to x.
     * 
     * @method set
     * @param [x=0] {Number} position of the point on the x axis
     * @param [y=0] {Number} position of the point on the y axis
     */
    PIXI.Point.prototype.set = function(x, y) {
        this.x = x || 0;
        this.y = y || ((y !== 0) ? this.x : 0);
    };

    // constructor
    PIXI.Point.prototype.constructor = PIXI.Point;
    /**
     * @author Mat Groves http://matgroves.com/
     */

    /**
     * the Rectangle object is an area defined by its position, as indicated by its top-left corner point (x, y) and by its width and its height.
     *
     * @class Rectangle
     * @constructor
     * @param x {Number} The X coordinate of the upper-left corner of the rectangle
     * @param y {Number} The Y coordinate of the upper-left corner of the rectangle
     * @param width {Number} The overall width of this rectangle
     * @param height {Number} The overall height of this rectangle
     */
    PIXI.Rectangle = function(x, y, width, height) {
        /**
         * @property x
         * @type Number
         * @default 0
         */
        this.x = x || 0;

        /**
         * @property y
         * @type Number
         * @default 0
         */
        this.y = y || 0;

        /**
         * @property width
         * @type Number
         * @default 0
         */
        this.width = width || 0;

        /**
         * @property height
         * @type Number
         * @default 0
         */
        this.height = height || 0;
    };

    /**
     * Creates a clone of this Rectangle
     *
     * @method clone
     * @return {Rectangle} a copy of the rectangle
     */
    PIXI.Rectangle.prototype.clone = function() {
        return new PIXI.Rectangle(this.x, this.y, this.width, this.height);
    };

    /**
     * Checks whether the x and y coordinates given are contained within this Rectangle
     *
     * @method contains
     * @param x {Number} The X coordinate of the point to test
     * @param y {Number} The Y coordinate of the point to test
     * @return {Boolean} Whether the x/y coordinates are within this Rectangle
     */
    PIXI.Rectangle.prototype.contains = function(x, y) {
        if (this.width <= 0 || this.height <= 0)
            return false;

        var x1 = this.x;
        if (x >= x1 && x <= x1 + this.width) {
            var y1 = this.y;

            if (y >= y1 && y <= y1 + this.height) {
                return true;
            }
        }

        return false;
    };

    // constructor
    PIXI.Rectangle.prototype.constructor = PIXI.Rectangle;

    PIXI.EmptyRectangle = new PIXI.Rectangle(0, 0, 0, 0);
    /**
     * @author Adrien Brault <adrien.brault@gmail.com>
     */

    /**
     * @class Polygon
     * @constructor
     * @param points* {Array<Point>|Array<Number>|Point...|Number...} This can be an array of Points that form the polygon,
     *      a flat array of numbers that will be interpreted as [x,y, x,y, ...], or the arguments passed can be
     *      all the points of the polygon e.g. `new PIXI.Polygon(new PIXI.Point(), new PIXI.Point(), ...)`, or the
     *      arguments passed can be flat x,y values e.g. `new PIXI.Polygon(x,y, x,y, x,y, ...)` where `x` and `y` are
     *      Numbers.
     */
    PIXI.Polygon = function(points) {
        //if points isn't an array, use arguments as the array
        if (!(points instanceof Array)) points = Array.prototype.slice.call(arguments);

        //if this is a flat array of numbers, convert it to points
        if (points[0] instanceof PIXI.Point) {
            var p = [];
            for (var i = 0, il = points.length; i < il; i++) {
                p.push(points[i].x, points[i].y);
            }

            points = p;
        }

        this.closed = true;
        this.points = points;
    };

    /**
     * Creates a clone of this polygon
     *
     * @method clone
     * @return {Polygon} a copy of the polygon
     */
    PIXI.Polygon.prototype.clone = function() {
        var points = this.points.slice();
        return new PIXI.Polygon(points);
    };

    /**
     * Checks whether the x and y coordinates passed to this function are contained within this polygon
     *
     * @method contains
     * @param x {Number} The X coordinate of the point to test
     * @param y {Number} The Y coordinate of the point to test
     * @return {Boolean} Whether the x/y coordinates are within this polygon
     */
    PIXI.Polygon.prototype.contains = function(x, y) {
        var inside = false;

        // use some raycasting to test hits
        // https://github.com/substack/point-in-polygon/blob/master/index.js
        var length = this.points.length / 2;

        for (var i = 0, j = length - 1; i < length; j = i++) {
            var xi = this.points[i * 2],
                yi = this.points[i * 2 + 1],
                xj = this.points[j * 2],
                yj = this.points[j * 2 + 1],
                intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

            if (intersect) inside = !inside;
        }

        return inside;
    };

    // constructor
    PIXI.Polygon.prototype.constructor = PIXI.Polygon;

    /**
     * @author Chad Engler <chad@pantherdev.com>
     */

    /**
     * The Circle object can be used to specify a hit area for displayObjects
     *
     * @class Circle
     * @constructor
     * @param x {Number} The X coordinate of the center of this circle
     * @param y {Number} The Y coordinate of the center of this circle
     * @param radius {Number} The radius of the circle
     */
    PIXI.Circle = function(x, y, radius) {
        /**
         * @property x
         * @type Number
         * @default 0
         */
        this.x = x || 0;

        /**
         * @property y
         * @type Number
         * @default 0
         */
        this.y = y || 0;

        /**
         * @property radius
         * @type Number
         * @default 0
         */
        this.radius = radius || 0;
    };

    /**
     * Creates a clone of this Circle instance
     *
     * @method clone
     * @return {Circle} a copy of the Circle
     */
    PIXI.Circle.prototype.clone = function() {
        return new PIXI.Circle(this.x, this.y, this.radius);
    };

    /**
     * Checks whether the x and y coordinates given are contained within this circle
     *
     * @method contains
     * @param x {Number} The X coordinate of the point to test
     * @param y {Number} The Y coordinate of the point to test
     * @return {Boolean} Whether the x/y coordinates are within this Circle
     */
    PIXI.Circle.prototype.contains = function(x, y) {
        if (this.radius <= 0)
            return false;

        var dx = (this.x - x),
            dy = (this.y - y),
            r2 = this.radius * this.radius;

        dx *= dx;
        dy *= dy;

        return (dx + dy <= r2);
    };

    /**
     * Returns the framing rectangle of the circle as a PIXI.Rectangle object
     *
     * @method getBounds
     * @return {Rectangle} the framing rectangle
     */
    PIXI.Circle.prototype.getBounds = function() {
        return new PIXI.Rectangle(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
    };

    // constructor
    PIXI.Circle.prototype.constructor = PIXI.Circle;

    /**
     * @author Chad Engler <chad@pantherdev.com>
     */

    /**
     * The Ellipse object can be used to specify a hit area for displayObjects
     *
     * @class Ellipse
     * @constructor
     * @param x {Number} The X coordinate of the center of the ellipse
     * @param y {Number} The Y coordinate of the center of the ellipse
     * @param width {Number} The half width of this ellipse
     * @param height {Number} The half height of this ellipse
     */
    PIXI.Ellipse = function(x, y, width, height) {
        /**
         * @property x
         * @type Number
         * @default 0
         */
        this.x = x || 0;

        /**
         * @property y
         * @type Number
         * @default 0
         */
        this.y = y || 0;

        /**
         * @property width
         * @type Number
         * @default 0
         */
        this.width = width || 0;

        /**
         * @property height
         * @type Number
         * @default 0
         */
        this.height = height || 0;
    };

    /**
     * Creates a clone of this Ellipse instance
     *
     * @method clone
     * @return {Ellipse} a copy of the ellipse
     */
    PIXI.Ellipse.prototype.clone = function() {
        return new PIXI.Ellipse(this.x, this.y, this.width, this.height);
    };

    /**
     * Checks whether the x and y coordinates given are contained within this ellipse
     *
     * @method contains
     * @param x {Number} The X coordinate of the point to test
     * @param y {Number} The Y coordinate of the point to test
     * @return {Boolean} Whether the x/y coords are within this ellipse
     */
    PIXI.Ellipse.prototype.contains = function(x, y) {
        if (this.width <= 0 || this.height <= 0)
            return false;

        //normalize the coords to an ellipse with center 0,0
        var normx = ((x - this.x) / this.width),
            normy = ((y - this.y) / this.height);

        normx *= normx;
        normy *= normy;

        return (normx + normy <= 1);
    };

    /**
     * Returns the framing rectangle of the ellipse as a PIXI.Rectangle object
     *
     * @method getBounds
     * @return {Rectangle} the framing rectangle
     */
    PIXI.Ellipse.prototype.getBounds = function() {
        return new PIXI.Rectangle(this.x - this.width, this.y - this.height, this.width, this.height);
    };

    // constructor
    PIXI.Ellipse.prototype.constructor = PIXI.Ellipse;

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * The Matrix class is now an object, which makes it a lot faster, 
     * here is a representation of it : 
     * | a | b | tx|
     * | c | d | ty|
     * | 0 | 0 | 1 |
     *
     * @class Matrix
     * @constructor
     */
    PIXI.Matrix = function() {
        /**
         * @property a
         * @type Number
         * @default 1
         */
        this.a = 1;

        /**
         * @property b
         * @type Number
         * @default 0
         */
        this.b = 0;

        /**
         * @property c
         * @type Number
         * @default 0
         */
        this.c = 0;

        /**
         * @property d
         * @type Number
         * @default 1
         */
        this.d = 1;

        /**
         * @property tx
         * @type Number
         * @default 0
         */
        this.tx = 0;

        /**
         * @property ty
         * @type Number
         * @default 0
         */
        this.ty = 0;
    };

    /**
     * Creates a Matrix object based on the given array. The Element to Matrix mapping order is as follows:
     *
     * a = array[0]
     * b = array[1]
     * c = array[3]
     * d = array[4]
     * tx = array[2]
     * ty = array[5]
     *
     * @method fromArray
     * @param array {Array} The array that the matrix will be populated from.
     */
    PIXI.Matrix.prototype.fromArray = function(array) {
        this.a = array[0];
        this.b = array[1];
        this.c = array[3];
        this.d = array[4];
        this.tx = array[2];
        this.ty = array[5];
    };

    /**
     * Creates an array from the current Matrix object.
     *
     * @method toArray
     * @param transpose {Boolean} Whether we need to transpose the matrix or not
     * @return {Array} the newly created array which contains the matrix
     */
    PIXI.Matrix.prototype.toArray = function(transpose) {
        if (!this.array) this.array = new PIXI.Float32Array(9);
        var array = this.array;

        if (transpose) {
            array[0] = this.a;
            array[1] = this.b;
            array[2] = 0;
            array[3] = this.c;
            array[4] = this.d;
            array[5] = 0;
            array[6] = this.tx;
            array[7] = this.ty;
            array[8] = 1;
        } else {
            array[0] = this.a;
            array[1] = this.c;
            array[2] = this.tx;
            array[3] = this.b;
            array[4] = this.d;
            array[5] = this.ty;
            array[6] = 0;
            array[7] = 0;
            array[8] = 1;
        }

        return array;
    };

    /**
     * Get a new position with the current transformation applied.
     * Can be used to go from a child's coordinate space to the world coordinate space. (e.g. rendering)
     *
     * @method apply
     * @param pos {Point} The origin
     * @param [newPos] {Point} The point that the new position is assigned to (allowed to be same as input)
     * @return {Point} The new point, transformed through this matrix
     */
    PIXI.Matrix.prototype.apply = function(pos, newPos) {
        newPos = newPos || new PIXI.Point();

        newPos.x = this.a * pos.x + this.c * pos.y + this.tx;
        newPos.y = this.b * pos.x + this.d * pos.y + this.ty;

        return newPos;
    };

    /**
     * Get a new position with the inverse of the current transformation applied.
     * Can be used to go from the world coordinate space to a child's coordinate space. (e.g. input)
     *
     * @method applyInverse
     * @param pos {Point} The origin
     * @param [newPos] {Point} The point that the new position is assigned to (allowed to be same as input)
     * @return {Point} The new point, inverse-transformed through this matrix
     */
    PIXI.Matrix.prototype.applyInverse = function(pos, newPos) {
        newPos = newPos || new PIXI.Point();

        var id = 1 / (this.a * this.d + this.c * -this.b);

        newPos.x = this.d * id * pos.x + -this.c * id * pos.y + (this.ty * this.c - this.tx * this.d) * id;
        newPos.y = this.a * id * pos.y + -this.b * id * pos.x + (-this.ty * this.a + this.tx * this.b) * id;

        return newPos;
    };

    /**
     * Translates the matrix on the x and y.
     * 
     * @method translate
     * @param {Number} x
     * @param {Number} y
     * @return {Matrix} This matrix. Good for chaining method calls.
     **/
    PIXI.Matrix.prototype.translate = function(x, y) {
        this.tx += x;
        this.ty += y;

        return this;
    };

    /**
     * Applies a scale transformation to the matrix.
     * 
     * @method scale
     * @param {Number} x The amount to scale horizontally
     * @param {Number} y The amount to scale vertically
     * @return {Matrix} This matrix. Good for chaining method calls.
     **/
    PIXI.Matrix.prototype.scale = function(x, y) {
        this.a *= x;
        this.d *= y;
        this.c *= x;
        this.b *= y;
        this.tx *= x;
        this.ty *= y;

        return this;
    };


    /**
     * Applies a rotation transformation to the matrix.
     * @method rotate
     * @param {Number} angle The angle in radians.
     * @return {Matrix} This matrix. Good for chaining method calls.
     **/
    PIXI.Matrix.prototype.rotate = function(angle) {
        var cos = Math.cos(angle);
        var sin = Math.sin(angle);

        var a1 = this.a;
        var c1 = this.c;
        var tx1 = this.tx;

        this.a = a1 * cos - this.b * sin;
        this.b = a1 * sin + this.b * cos;
        this.c = c1 * cos - this.d * sin;
        this.d = c1 * sin + this.d * cos;
        this.tx = tx1 * cos - this.ty * sin;
        this.ty = tx1 * sin + this.ty * cos;

        return this;
    };

    /**
     * Appends the given Matrix to this Matrix.
     * 
     * @method append
     * @param {Matrix} matrix
     * @return {Matrix} This matrix. Good for chaining method calls.
     */
    PIXI.Matrix.prototype.append = function(matrix) {
        var a1 = this.a;
        var b1 = this.b;
        var c1 = this.c;
        var d1 = this.d;

        this.a = matrix.a * a1 + matrix.b * c1;
        this.b = matrix.a * b1 + matrix.b * d1;
        this.c = matrix.c * a1 + matrix.d * c1;
        this.d = matrix.c * b1 + matrix.d * d1;

        this.tx = matrix.tx * a1 + matrix.ty * c1 + this.tx;
        this.ty = matrix.tx * b1 + matrix.ty * d1 + this.ty;

        return this;
    };

    /**
     * Resets this Matix to an identity (default) matrix.
     * 
     * @method identity
     * @return {Matrix} This matrix. Good for chaining method calls.
     */
    PIXI.Matrix.prototype.identity = function() {
        this.a = 1;
        this.b = 0;
        this.c = 0;
        this.d = 1;
        this.tx = 0;
        this.ty = 0;

        return this;
    };

    PIXI.identityMatrix = new PIXI.Matrix();

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * The base class for all objects that are rendered on the screen.
     * This is an abstract class and should not be used on its own rather it should be extended.
     *
     * @class DisplayObject
     * @constructor
     */
    PIXI.DisplayObject = function() {
        /**
         * The coordinate of the object relative to the local coordinates of the parent.
         *
         * @property position
         * @type Point
         */
        this.position = new PIXI.Point();

        /**
         * The scale factor of the object.
         *
         * @property scale
         * @type Point
         */
        this.scale = new PIXI.Point(1, 1); //{x:1, y:1};

        /**
         * The pivot point of the displayObject that it rotates around
         *
         * @property pivot
         * @type Point
         */
        this.pivot = new PIXI.Point(0, 0);

        /**
         * The rotation of the object in radians.
         *
         * @property rotation
         * @type Number
         */
        this.rotation = 0;

        /**
         * The opacity of the object.
         *
         * @property alpha
         * @type Number
         */
        this.alpha = 1;

        /**
         * The visibility of the object.
         *
         * @property visible
         * @type Boolean
         */
        this.visible = true;

        /**
         * This is the defined area that will pick up mouse / touch events. It is null by default.
         * Setting it is a neat way of optimising the hitTest function that the interactionManager will use (as it will not need to hit test all the children)
         *
         * @property hitArea
         * @type Rectangle|Circle|Ellipse|Polygon
         */
        this.hitArea = null;

        /**
         * This is used to indicate if the displayObject should display a mouse hand cursor on rollover
         *
         * @property buttonMode
         * @type Boolean
         */
        this.buttonMode = false;

        /**
         * Can this object be rendered
         *
         * @property renderable
         * @type Boolean
         */
        this.renderable = false;

        /**
         * [read-only] The display object container that contains this display object.
         *
         * @property parent
         * @type DisplayObjectContainer
         * @readOnly
         */
        this.parent = null;

        /**
         * [read-only] The stage the display object is connected to, or undefined if it is not connected to the stage.
         *
         * @property stage
         * @type Stage
         * @readOnly
         */
        this.stage = null;

        /**
         * [read-only] The multiplied alpha of the displayObject
         *
         * @property worldAlpha
         * @type Number
         * @readOnly
         */
        this.worldAlpha = 1;

        /**
         * [read-only] Whether or not the object is interactive, do not toggle directly! use the `interactive` property
         *
         * @property _interactive
         * @type Boolean
         * @readOnly
         * @private
         */
        this._interactive = false;

        /**
         * This is the cursor that will be used when the mouse is over this object. To enable this the element must have interaction = true and buttonMode = true
         *
         * @property defaultCursor
         * @type String
         *
         */
        this.defaultCursor = 'pointer';

        /**
         * [read-only] Current transform of the object based on world (parent) factors
         *
         * @property worldTransform
         * @type Matrix
         * @readOnly
         * @private
         */
        this.worldTransform = new PIXI.Matrix();

        /**
         * cached sin rotation and cos rotation
         *
         * @property _sr
         * @type Number
         * @private
         */
        this._sr = 0;

        /**
         * cached sin rotation and cos rotation
         *
         * @property _cr
         * @type Number
         * @private
         */
        this._cr = 1;

        /**
         * The area the filter is applied to like the hitArea this is used as more of an optimisation
         * rather than figuring out the dimensions of the displayObject each frame you can set this rectangle
         *
         * @property filterArea
         * @type Rectangle
         */
        this.filterArea = null; //new PIXI.Rectangle(0,0,1,1);

        /**
         * The original, cached bounds of the object
         *
         * @property _bounds
         * @type Rectangle
         * @private
         */
        this._bounds = new PIXI.Rectangle(0, 0, 1, 1);

        /**
         * The most up-to-date bounds of the object
         *
         * @property _currentBounds
         * @type Rectangle
         * @private
         */
        this._currentBounds = null;

        /**
         * The original, cached mask of the object
         *
         * @property _currentBounds
         * @type Rectangle
         * @private
         */
        this._mask = null;

        /**
         * Cached internal flag.
         *
         * @property _cacheAsBitmap
         * @type Boolean
         * @private
         */
        this._cacheAsBitmap = false;

        /**
         * Cached internal flag.
         *
         * @property _cacheIsDirty
         * @type Boolean
         * @private
         */
        this._cacheIsDirty = false;


        /*
         * MOUSE Callbacks
         */

        /**
         * A callback that is used when the users mouse rolls over the displayObject
         * @method mouseover
         * @param interactionData {InteractionData}
         */

        /**
         * A callback that is used when the users mouse leaves the displayObject
         * @method mouseout
         * @param interactionData {InteractionData}
         */

        //Left button
        /**
         * A callback that is used when the users clicks on the displayObject with their mouse's left button
         * @method click
         * @param interactionData {InteractionData}
         */

        /**
         * A callback that is used when the user clicks the mouse's left button down over the sprite
         * @method mousedown
         * @param interactionData {InteractionData}
         */

        /**
         * A callback that is used when the user releases the mouse's left button that was over the displayObject
         * for this callback to be fired, the mouse's left button must have been pressed down over the displayObject
         * @method mouseup
         * @param interactionData {InteractionData}
         */

        /**
         * A callback that is used when the user releases the mouse's left button that was over the displayObject but is no longer over the displayObject
         * for this callback to be fired, the mouse's left button must have been pressed down over the displayObject
         * @method mouseupoutside
         * @param interactionData {InteractionData}
         */

        //Right button
        /**
         * A callback that is used when the users clicks on the displayObject with their mouse's right button
         * @method rightclick
         * @param interactionData {InteractionData}
         */

        /**
         * A callback that is used when the user clicks the mouse's right button down over the sprite
         * @method rightdown
         * @param interactionData {InteractionData}
         */

        /**
         * A callback that is used when the user releases the mouse's right button that was over the displayObject
         * for this callback to be fired the mouse's right button must have been pressed down over the displayObject
         * @method rightup
         * @param interactionData {InteractionData}
         */

        /**
         * A callback that is used when the user releases the mouse's right button that was over the displayObject but is no longer over the displayObject
         * for this callback to be fired, the mouse's right button must have been pressed down over the displayObject
         * @method rightupoutside
         * @param interactionData {InteractionData}
         */

        /*
         * TOUCH Callbacks
         */

        /**
         * A callback that is used when the users taps on the sprite with their finger
         * basically a touch version of click
         * @method tap
         * @param interactionData {InteractionData}
         */

        /**
         * A callback that is used when the user touches over the displayObject
         * @method touchstart
         * @param interactionData {InteractionData}
         */

        /**
         * A callback that is used when the user releases a touch over the displayObject
         * @method touchend
         * @param interactionData {InteractionData}
         */

        /**
         * A callback that is used when the user releases the touch that was over the displayObject
         * for this callback to be fired, The touch must have started over the sprite
         * @method touchendoutside
         * @param interactionData {InteractionData}
         */
    };

    // constructor
    PIXI.DisplayObject.prototype.constructor = PIXI.DisplayObject;

    /**
     * Indicates if the sprite will have touch and mouse interactivity. It is false by default
     *
     * @property interactive
     * @type Boolean
     * @default false
     */
    Object.defineProperty(PIXI.DisplayObject.prototype, 'interactive', {
        get: function() {
            return this._interactive;
        },
        set: function(value) {
            this._interactive = value;

            // TODO more to be done here..
            // need to sort out a re-crawl!
            if (this.stage) this.stage.dirty = true;
        }
    });

    /**
     * [read-only] Indicates if the sprite is globally visible.
     *
     * @property worldVisible
     * @type Boolean
     */
    Object.defineProperty(PIXI.DisplayObject.prototype, 'worldVisible', {
        get: function() {
            var item = this;

            do {
                if (!item.visible) return false;
                item = item.parent;
            }
            while (item);

            return true;
        }
    });

    /**
     * Sets a mask for the displayObject. A mask is an object that limits the visibility of an object to the shape of the mask applied to it.
     * In PIXI a regular mask must be a PIXI.Graphics object. This allows for much faster masking in canvas as it utilises shape clipping.
     * To remove a mask, set this property to null.
     *
     * @property mask
     * @type Graphics
     */
    Object.defineProperty(PIXI.DisplayObject.prototype, 'mask', {
        get: function() {
            return this._mask;
        },
        set: function(value) {

            if (this._mask) this._mask.isMask = false;
            this._mask = value;
            if (this._mask) this._mask.isMask = true;
        }
    });

    /**
     * Sets the filters for the displayObject.
     * * IMPORTANT: This is a webGL only feature and will be ignored by the canvas renderer.
     * To remove filters simply set this property to 'null'
     * @property filters
     * @type Array An array of filters
     */
    Object.defineProperty(PIXI.DisplayObject.prototype, 'filters', {

        get: function() {
            return this._filters;
        },

        set: function(value) {

            if (value) {
                // now put all the passes in one place..
                var passes = [];
                for (var i = 0; i < value.length; i++) {
                    var filterPasses = value[i].passes;
                    for (var j = 0; j < filterPasses.length; j++) {
                        passes.push(filterPasses[j]);
                    }
                }

                // TODO change this as it is legacy
                this._filterBlock = { target: this, filterPasses: passes };
            }

            this._filters = value;
        }
    });

    /**
     * Set if this display object is cached as a bitmap.
     * This basically takes a snap shot of the display object as it is at that moment. It can provide a performance benefit for complex static displayObjects.
     * To remove simply set this property to 'null'
     * @property cacheAsBitmap
     * @type Boolean
     */
    Object.defineProperty(PIXI.DisplayObject.prototype, 'cacheAsBitmap', {

        get: function() {
            return this._cacheAsBitmap;
        },

        set: function(value) {

            if (this._cacheAsBitmap === value) return;

            if (value) {
                this._generateCachedSprite();
            } else {
                this._destroyCachedSprite();
            }

            this._cacheAsBitmap = value;
        }
    });

    /*
     * Updates the object transform for rendering
     *
     * @method updateTransform
     * @private
     */
    PIXI.DisplayObject.prototype.updateTransform = function() {
        // create some matrix refs for easy access
        var pt = this.parent.worldTransform;
        var wt = this.worldTransform;

        // temporary matrix variables
        var a, b, c, d, tx, ty;

        // TODO create a const for 2_PI 
        // so if rotation is between 0 then we can simplify the multiplication process..
        if (this.rotation % PIXI.PI_2) {
            // check to see if the rotation is the same as the previous render. This means we only need to use sin and cos when rotation actually changes
            if (this.rotation !== this.rotationCache) {
                this.rotationCache = this.rotation;
                this._sr = Math.sin(this.rotation);
                this._cr = Math.cos(this.rotation);
            }

            // get the matrix values of the displayobject based on its transform properties..
            a = this._cr * this.scale.x;
            b = this._sr * this.scale.x;
            c = -this._sr * this.scale.y;
            d = this._cr * this.scale.y;
            tx = this.position.x;
            ty = this.position.y;

            // check for pivot.. not often used so geared towards that fact!
            if (this.pivot.x || this.pivot.y) {
                tx -= this.pivot.x * a + this.pivot.y * c;
                ty -= this.pivot.x * b + this.pivot.y * d;
            }

            // concat the parent matrix with the objects transform.
            wt.a = a * pt.a + b * pt.c;
            wt.b = a * pt.b + b * pt.d;
            wt.c = c * pt.a + d * pt.c;
            wt.d = c * pt.b + d * pt.d;
            wt.tx = tx * pt.a + ty * pt.c + pt.tx;
            wt.ty = tx * pt.b + ty * pt.d + pt.ty;


        } else {
            // lets do the fast version as we know there is no rotation..
            a = this.scale.x;
            d = this.scale.y;
            tx = this.position.x - this.pivot.x * a;
            ty = this.position.y - this.pivot.y * d;

            wt.a = pt.a * a;
            wt.b = pt.b * d;
            wt.c = pt.c * a;
            wt.d = pt.d * d;
            wt.tx = tx * pt.a + ty * pt.c + pt.tx;
            wt.ty = tx * pt.b + ty * pt.d + pt.ty;
        }

        // multiply the alphas..
        this.worldAlpha = this.alpha * this.parent.worldAlpha;
    };

    /**
     * Retrieves the bounds of the displayObject as a rectangle object
     *
     * @method getBounds
     * @param matrix {Matrix}
     * @return {Rectangle} the rectangular bounding area
     */
    PIXI.DisplayObject.prototype.getBounds = function(matrix) {
        matrix = matrix; //just to get passed js hinting (and preserve inheritance)
        return PIXI.EmptyRectangle;
    };

    /**
     * Retrieves the local bounds of the displayObject as a rectangle object
     *
     * @method getLocalBounds
     * @return {Rectangle} the rectangular bounding area
     */
    PIXI.DisplayObject.prototype.getLocalBounds = function() {
        return this.getBounds(PIXI.identityMatrix); ///PIXI.EmptyRectangle();
    };

    /**
     * Sets the object's stage reference, the stage this object is connected to
     *
     * @method setStageReference
     * @param stage {Stage} the stage that the object will have as its current stage reference
     */
    PIXI.DisplayObject.prototype.setStageReference = function(stage) {
        this.stage = stage;
        if (this._interactive) this.stage.dirty = true;
    };

    /**
     * Useful function that returns a texture of the displayObject object that can then be used to create sprites
     * This can be quite useful if your displayObject is static / complicated and needs to be reused multiple times.
     *
     * @method generateTexture
     * @param resolution {Number} The resolution of the texture being generated
     * @param scaleMode {Number} Should be one of the PIXI.scaleMode consts
     * @param renderer {CanvasRenderer|WebGLRenderer} The renderer used to generate the texture.
     * @return {Texture} a texture of the graphics object
     */
    PIXI.DisplayObject.prototype.generateTexture = function(resolution, scaleMode, renderer) {
        var bounds = this.getLocalBounds();

        var renderTexture = new PIXI.RenderTexture(bounds.width | 0, bounds.height | 0, renderer, scaleMode, resolution);

        PIXI.DisplayObject._tempMatrix.tx = -bounds.x;
        PIXI.DisplayObject._tempMatrix.ty = -bounds.y;

        renderTexture.render(this, PIXI.DisplayObject._tempMatrix);

        return renderTexture;
    };

    /**
     * Generates and updates the cached sprite for this object.
     *
     * @method updateCache
     */
    PIXI.DisplayObject.prototype.updateCache = function() {
        this._generateCachedSprite();
    };

    /**
     * Calculates the global position of the display object
     *
     * @method toGlobal
     * @param position {Point} The world origin to calculate from
     * @return {Point} A point object representing the position of this object
     */
    PIXI.DisplayObject.prototype.toGlobal = function(position) {
        this.updateTransform();
        return this.worldTransform.apply(position);
    };

    /**
     * Calculates the local position of the display object relative to another point
     *
     * @method toLocal
     * @param position {Point} The world origin to calculate from
     * @param [from] {DisplayObject} The DisplayObject to calculate the global position from
     * @return {Point} A point object representing the position of this object
     */
    PIXI.DisplayObject.prototype.toLocal = function(position, from) {
        if (from) {
            position = from.toGlobal(position);
        }

        this.updateTransform();

        return this.worldTransform.applyInverse(position);
    };

    /**
     * Internal method.
     *
     * @method _renderCachedSprite
     * @param renderSession {Object} The render session
     * @private
     */
    PIXI.DisplayObject.prototype._renderCachedSprite = function(renderSession) {
        this._cachedSprite.worldAlpha = this.worldAlpha;

        if (renderSession.gl) {
            PIXI.Sprite.prototype._renderWebGL.call(this._cachedSprite, renderSession);
        } else {
            PIXI.Sprite.prototype._renderCanvas.call(this._cachedSprite, renderSession);
        }
    };

    /**
     * Internal method.
     *
     * @method _generateCachedSprite
     * @private
     */
    PIXI.DisplayObject.prototype._generateCachedSprite = function() {
        this._cacheAsBitmap = false;
        var bounds = this.getLocalBounds();

        if (!this._cachedSprite) {
            var renderTexture = new PIXI.RenderTexture(bounds.width | 0, bounds.height | 0); //, renderSession.renderer);

            this._cachedSprite = new PIXI.Sprite(renderTexture);
            this._cachedSprite.worldTransform = this.worldTransform;
        } else {
            this._cachedSprite.texture.resize(bounds.width | 0, bounds.height | 0);
        }

        //REMOVE filter!
        var tempFilters = this._filters;
        this._filters = null;

        this._cachedSprite.filters = tempFilters;

        PIXI.DisplayObject._tempMatrix.tx = -bounds.x;
        PIXI.DisplayObject._tempMatrix.ty = -bounds.y;

        this._cachedSprite.texture.render(this, PIXI.DisplayObject._tempMatrix);

        this._cachedSprite.anchor.x = -(bounds.x / bounds.width);
        this._cachedSprite.anchor.y = -(bounds.y / bounds.height);

        this._filters = tempFilters;

        this._cacheAsBitmap = true;
    };

    /**
     * Destroys the cached sprite.
     *
     * @method _destroyCachedSprite
     * @private
     */
    PIXI.DisplayObject.prototype._destroyCachedSprite = function() {
        if (!this._cachedSprite) return;

        this._cachedSprite.texture.destroy(true);

        // TODO could be object pooled!
        this._cachedSprite = null;
    };

    /**
     * Renders the object using the WebGL renderer
     *
     * @method _renderWebGL
     * @param renderSession {RenderSession}
     * @private
     */
    PIXI.DisplayObject.prototype._renderWebGL = function(renderSession) {
        // OVERWRITE;
        // this line is just here to pass jshinting :)
        renderSession = renderSession;
    };

    /**
     * Renders the object using the Canvas renderer
     *
     * @method _renderCanvas
     * @param renderSession {RenderSession}
     * @private
     */
    PIXI.DisplayObject.prototype._renderCanvas = function(renderSession) {
        // OVERWRITE;
        // this line is just here to pass jshinting :)
        renderSession = renderSession;
    };


    PIXI.DisplayObject._tempMatrix = new PIXI.Matrix();

    /**
     * The position of the displayObject on the x axis relative to the local coordinates of the parent.
     *
     * @property x
     * @type Number
     */
    Object.defineProperty(PIXI.DisplayObject.prototype, 'x', {
        get: function() {
            return this.position.x;
        },
        set: function(value) {
            this.position.x = value;
        }
    });

    /**
     * The position of the displayObject on the y axis relative to the local coordinates of the parent.
     *
     * @property y
     * @type Number
     */
    Object.defineProperty(PIXI.DisplayObject.prototype, 'y', {
        get: function() {
            return this.position.y;
        },
        set: function(value) {
            this.position.y = value;
        }
    });

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * A DisplayObjectContainer represents a collection of display objects.
     * It is the base class of all display objects that act as a container for other objects.
     *
     * @class DisplayObjectContainer
     * @extends DisplayObject
     * @constructor
     */
    PIXI.DisplayObjectContainer = function() {
        PIXI.DisplayObject.call(this);

        /**
         * [read-only] The array of children of this container.
         *
         * @property children
         * @type Array<DisplayObject>
         * @readOnly
         */
        this.children = [];
    };

    // constructor
    PIXI.DisplayObjectContainer.prototype = Object.create(PIXI.DisplayObject.prototype);
    PIXI.DisplayObjectContainer.prototype.constructor = PIXI.DisplayObjectContainer;

    /**
     * The width of the displayObjectContainer, setting this will actually modify the scale to achieve the value set
     *
     * @property width
     * @type Number
     */
    Object.defineProperty(PIXI.DisplayObjectContainer.prototype, 'width', {
        get: function() {
            return this.scale.x * this.getLocalBounds().width;
        },
        set: function(value) {

            var width = this.getLocalBounds().width;

            if (width !== 0) {
                this.scale.x = value / (width / this.scale.x);
            } else {
                this.scale.x = 1;
            }


            this._width = value;
        }
    });

    /**
     * The height of the displayObjectContainer, setting this will actually modify the scale to achieve the value set
     *
     * @property height
     * @type Number
     */
    Object.defineProperty(PIXI.DisplayObjectContainer.prototype, 'height', {
        get: function() {
            return this.scale.y * this.getLocalBounds().height;
        },
        set: function(value) {

            var height = this.getLocalBounds().height;

            if (height !== 0) {
                this.scale.y = value / (height / this.scale.y);
            } else {
                this.scale.y = 1;
            }

            this._height = value;
        }
    });

    /**
     * Adds a child to the container.
     *
     * @method addChild
     * @param child {DisplayObject} The DisplayObject to add to the container
     * @return {DisplayObject} The child that was added.
     */
    PIXI.DisplayObjectContainer.prototype.addChild = function(child) {
        return this.addChildAt(child, this.children.length);
    };

    /**
     * Adds a child to the container at a specified index. If the index is out of bounds an error will be thrown
     *
     * @method addChildAt
     * @param child {DisplayObject} The child to add
     * @param index {Number} The index to place the child in
     * @return {DisplayObject} The child that was added.
     */
    PIXI.DisplayObjectContainer.prototype.addChildAt = function(child, index) {
        if (index >= 0 && index <= this.children.length) {
            if (child.parent) {
                child.parent.removeChild(child);
            }

            child.parent = this;

            this.children.splice(index, 0, child);

            if (this.stage) child.setStageReference(this.stage);

            return child;
        } else {
            throw new Error(child + 'addChildAt: The index ' + index + ' supplied is out of bounds ' + this.children.length);
        }
    };

    /**
     * Swaps the position of 2 Display Objects within this container.
     *
     * @method swapChildren
     * @param child {DisplayObject}
     * @param child2 {DisplayObject}
     */
    PIXI.DisplayObjectContainer.prototype.swapChildren = function(child, child2) {
        if (child === child2) {
            return;
        }

        var index1 = this.getChildIndex(child);
        var index2 = this.getChildIndex(child2);

        if (index1 < 0 || index2 < 0) {
            throw new Error('swapChildren: Both the supplied DisplayObjects must be a child of the caller.');
        }

        this.children[index1] = child2;
        this.children[index2] = child;

    };

    /**
     * Returns the index position of a child DisplayObject instance
     *
     * @method getChildIndex
     * @param child {DisplayObject} The DisplayObject instance to identify
     * @return {Number} The index position of the child display object to identify
     */
    PIXI.DisplayObjectContainer.prototype.getChildIndex = function(child) {
        var index = this.children.indexOf(child);
        if (index === -1) {
            throw new Error('The supplied DisplayObject must be a child of the caller');
        }
        return index;
    };

    /**
     * Changes the position of an existing child in the display object container
     *
     * @method setChildIndex
     * @param child {DisplayObject} The child DisplayObject instance for which you want to change the index number
     * @param index {Number} The resulting index number for the child display object
     */
    PIXI.DisplayObjectContainer.prototype.setChildIndex = function(child, index) {
        if (index < 0 || index >= this.children.length) {
            throw new Error('The supplied index is out of bounds');
        }
        var currentIndex = this.getChildIndex(child);
        this.children.splice(currentIndex, 1); //remove from old position
        this.children.splice(index, 0, child); //add at new position
    };

    /**
     * Returns the child at the specified index
     *
     * @method getChildAt
     * @param index {Number} The index to get the child from
     * @return {DisplayObject} The child at the given index, if any.
     */
    PIXI.DisplayObjectContainer.prototype.getChildAt = function(index) {
        if (index < 0 || index >= this.children.length) {
            throw new Error('getChildAt: Supplied index ' + index + ' does not exist in the child list, or the supplied DisplayObject must be a child of the caller');
        }
        return this.children[index];

    };

    /**
     * Removes a child from the container.
     *
     * @method removeChild
     * @param child {DisplayObject} The DisplayObject to remove
     * @return {DisplayObject} The child that was removed.
     */
    PIXI.DisplayObjectContainer.prototype.removeChild = function(child) {
        var index = this.children.indexOf(child);
        if (index === -1) return;

        return this.removeChildAt(index);
    };

    /**
     * Removes a child from the specified index position.
     *
     * @method removeChildAt
     * @param index {Number} The index to get the child from
     * @return {DisplayObject} The child that was removed.
     */
    PIXI.DisplayObjectContainer.prototype.removeChildAt = function(index) {
        var child = this.getChildAt(index);
        if (this.stage)
            child.removeStageReference();

        child.parent = undefined;
        this.children.splice(index, 1);
        return child;
    };

    /**
     * Removes all children from this container that are within the begin and end indexes.
     *
     * @method removeChildren
     * @param beginIndex {Number} The beginning position. Default value is 0.
     * @param endIndex {Number} The ending position. Default value is size of the container.
     */
    PIXI.DisplayObjectContainer.prototype.removeChildren = function(beginIndex, endIndex) {
        var begin = beginIndex || 0;
        var end = typeof endIndex === 'number' ? endIndex : this.children.length;
        var range = end - begin;

        if (range > 0 && range <= end) {
            var removed = this.children.splice(begin, range);
            for (var i = 0; i < removed.length; i++) {
                var child = removed[i];
                if (this.stage)
                    child.removeStageReference();
                child.parent = undefined;
            }
            return removed;
        } else if (range === 0 && this.children.length === 0) {
            return [];
        } else {
            throw new Error('removeChildren: Range Error, numeric values are outside the acceptable range');
        }
    };

    /*
     * Updates the transform on all children of this container for rendering
     *
     * @method updateTransform
     * @private
     */
    PIXI.DisplayObjectContainer.prototype.updateTransform = function() {
        if (!this.visible) return;

        PIXI.DisplayObject.prototype.updateTransform.call(this);

        if (this._cacheAsBitmap) return;

        for (var i = 0, j = this.children.length; i < j; i++) {
            this.children[i].updateTransform();
        }
    };

    /**
     * Retrieves the bounds of the displayObjectContainer as a rectangle. The bounds calculation takes all visible children into consideration.
     *
     * @method getBounds
     * @return {Rectangle} The rectangular bounding area
     */
    PIXI.DisplayObjectContainer.prototype.getBounds = function() {
        if (this.children.length === 0) return PIXI.EmptyRectangle;

        // TODO the bounds have already been calculated this render session so return what we have

        var minX = Infinity;
        var minY = Infinity;

        var maxX = -Infinity;
        var maxY = -Infinity;

        var childBounds;
        var childMaxX;
        var childMaxY;

        var childVisible = false;

        for (var i = 0, j = this.children.length; i < j; i++) {
            var child = this.children[i];

            if (!child.visible) continue;

            childVisible = true;

            childBounds = this.children[i].getBounds();

            minX = minX < childBounds.x ? minX : childBounds.x;
            minY = minY < childBounds.y ? minY : childBounds.y;

            childMaxX = childBounds.width + childBounds.x;
            childMaxY = childBounds.height + childBounds.y;

            maxX = maxX > childMaxX ? maxX : childMaxX;
            maxY = maxY > childMaxY ? maxY : childMaxY;
        }

        if (!childVisible)
            return PIXI.EmptyRectangle;

        var bounds = this._bounds;

        bounds.x = minX;
        bounds.y = minY;
        bounds.width = maxX - minX;
        bounds.height = maxY - minY;

        // TODO: store a reference so that if this function gets called again in the render cycle we do not have to recalculate
        //this._currentBounds = bounds;

        return bounds;
    };

    /**
     * Retrieves the non-global local bounds of the displayObjectContainer as a rectangle. The calculation takes all visible children into consideration.
     *
     * @method getLocalBounds
     * @return {Rectangle} The rectangular bounding area
     */
    PIXI.DisplayObjectContainer.prototype.getLocalBounds = function() {
        var matrixCache = this.worldTransform;

        this.worldTransform = PIXI.identityMatrix;

        for (var i = 0, j = this.children.length; i < j; i++) {
            this.children[i].updateTransform();
        }

        var bounds = this.getBounds();

        this.worldTransform = matrixCache;

        return bounds;
    };

    /**
     * Sets the containers Stage reference. This is the Stage that this object, and all of its children, is connected to.
     *
     * @method setStageReference
     * @param stage {Stage} the stage that the container will have as its current stage reference
     */
    PIXI.DisplayObjectContainer.prototype.setStageReference = function(stage) {
        this.stage = stage;
        if (this._interactive) this.stage.dirty = true;

        for (var i = 0, j = this.children.length; i < j; i++) {
            var child = this.children[i];
            child.setStageReference(stage);
        }
    };

    /**
     * Removes the current stage reference from the container and all of its children.
     *
     * @method removeStageReference
     */
    PIXI.DisplayObjectContainer.prototype.removeStageReference = function() {

        for (var i = 0, j = this.children.length; i < j; i++) {
            var child = this.children[i];
            child.removeStageReference();
        }

        if (this._interactive) this.stage.dirty = true;

        this.stage = null;
    };

    /**
     * Renders the object using the WebGL renderer
     *
     * @method _renderWebGL
     * @param renderSession {RenderSession} 
     * @private
     */
    PIXI.DisplayObjectContainer.prototype._renderWebGL = function(renderSession) {
        if (!this.visible || this.alpha <= 0) return;

        if (this._cacheAsBitmap) {
            this._renderCachedSprite(renderSession);
            return;
        }

        var i, j;

        if (this._mask || this._filters) {

            // push filter first as we need to ensure the stencil buffer is correct for any masking
            if (this._filters) {
                renderSession.spriteBatch.flush();
                renderSession.filterManager.pushFilter(this._filterBlock);
            }

            if (this._mask) {
                renderSession.spriteBatch.stop();
                renderSession.maskManager.pushMask(this.mask, renderSession);
                renderSession.spriteBatch.start();
            }

            // simple render children!
            for (i = 0, j = this.children.length; i < j; i++) {
                this.children[i]._renderWebGL(renderSession);
            }

            renderSession.spriteBatch.stop();

            if (this._mask) renderSession.maskManager.popMask(this._mask, renderSession);
            if (this._filters) renderSession.filterManager.popFilter();

            renderSession.spriteBatch.start();
        } else {
            // simple render children!
            for (i = 0, j = this.children.length; i < j; i++) {
                this.children[i]._renderWebGL(renderSession);
            }
        }
    };

    /**
     * Renders the object using the Canvas renderer
     *
     * @method _renderCanvas
     * @param renderSession {RenderSession} 
     * @private
     */
    PIXI.DisplayObjectContainer.prototype._renderCanvas = function(renderSession) {
        if (this.visible === false || this.alpha === 0) return;

        if (this._cacheAsBitmap) {

            this._renderCachedSprite(renderSession);
            return;
        }

        if (this._mask) {
            renderSession.maskManager.pushMask(this._mask, renderSession);
        }

        for (var i = 0, j = this.children.length; i < j; i++) {
            var child = this.children[i];
            child._renderCanvas(renderSession);
        }

        if (this._mask) {
            renderSession.maskManager.popMask(renderSession);
        }
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * The Sprite object is the base for all textured objects that are rendered to the screen
     *
     * @class Sprite
     * @extends DisplayObjectContainer
     * @constructor
     * @param texture {Texture} The texture for this sprite
     * 
     * A sprite can be created directly from an image like this : 
     * var sprite = new PIXI.Sprite.fromImage('assets/image.png');
     * yourStage.addChild(sprite);
     * then obviously don't forget to add it to the stage you have already created
     */
    PIXI.Sprite = function(texture) {
        PIXI.DisplayObjectContainer.call(this);

        /**
         * The anchor sets the origin point of the texture.
         * The default is 0,0 this means the texture's origin is the top left
         * Setting than anchor to 0.5,0.5 means the textures origin is centered
         * Setting the anchor to 1,1 would mean the textures origin points will be the bottom right corner
         *
         * @property anchor
         * @type Point
         */
        this.anchor = new PIXI.Point();

        /**
         * The texture that the sprite is using
         *
         * @property texture
         * @type Texture
         */
        this.texture = texture;

        /**
         * The width of the sprite (this is initially set by the texture)
         *
         * @property _width
         * @type Number
         * @private
         */
        this._width = 0;

        /**
         * The height of the sprite (this is initially set by the texture)
         *
         * @property _height
         * @type Number
         * @private
         */
        this._height = 0;

        /**
         * The tint applied to the sprite. This is a hex value. A value of 0xFFFFFF will remove any tint effect.
         *
         * @property tint
         * @type Number
         * @default 0xFFFFFF
         */
        this.tint = 0xFFFFFF;

        /**
         * The blend mode to be applied to the sprite. Set to PIXI.blendModes.NORMAL to remove any blend mode.
         *
         * @property blendMode
         * @type Number
         * @default PIXI.blendModes.NORMAL;
         */
        this.blendMode = PIXI.blendModes.NORMAL;

        /**
         * The shader that will be used to render the texture to the stage. Set to null to remove a current shader.
         *
         * @property shader
         * @type PIXI.AbstractFilter
         * @default null
         */
        this.shader = null;

        if (texture.baseTexture.hasLoaded) {
            this.onTextureUpdate();
        } else {
            this.onTextureUpdateBind = this.onTextureUpdate.bind(this);
            this.texture.on('update', this.onTextureUpdateBind);
        }

        this.renderable = true;

    };

    // constructor
    PIXI.Sprite.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
    PIXI.Sprite.prototype.constructor = PIXI.Sprite;

    /**
     * The width of the sprite, setting this will actually modify the scale to achieve the value set
     *
     * @property width
     * @type Number
     */
    Object.defineProperty(PIXI.Sprite.prototype, 'width', {
        get: function() {
            return this.scale.x * this.texture.frame.width;
        },
        set: function(value) {
            this.scale.x = value / this.texture.frame.width;
            this._width = value;
        }
    });

    /**
     * The height of the sprite, setting this will actually modify the scale to achieve the value set
     *
     * @property height
     * @type Number
     */
    Object.defineProperty(PIXI.Sprite.prototype, 'height', {
        get: function() {
            return this.scale.y * this.texture.frame.height;
        },
        set: function(value) {
            this.scale.y = value / this.texture.frame.height;
            this._height = value;
        }
    });

    /**
     * Sets the texture of the sprite
     *
     * @method setTexture
     * @param texture {Texture} The PIXI texture that is displayed by the sprite
     */
    PIXI.Sprite.prototype.setTexture = function(texture) {
        this.texture = texture;
        this.cachedTint = 0xFFFFFF;
    };

    /**
     * When the texture is updated, this event will fire to update the scale and frame
     *
     * @method onTextureUpdate
     * @param event
     * @private
     */
    PIXI.Sprite.prototype.onTextureUpdate = function() {
        // so if _width is 0 then width was not set..
        if (this._width) this.scale.x = this._width / this.texture.frame.width;
        if (this._height) this.scale.y = this._height / this.texture.frame.height;

        //this.updateFrame = true;
    };

    /**
     * Returns the bounds of the Sprite as a rectangle. The bounds calculation takes the worldTransform into account.
     *
     * @method getBounds
     * @param matrix {Matrix} the transformation matrix of the sprite
     * @return {Rectangle} the framing rectangle
     */
    PIXI.Sprite.prototype.getBounds = function(matrix) {
        var width = this.texture.frame.width;
        var height = this.texture.frame.height;

        var w0 = width * (1 - this.anchor.x);
        var w1 = width * -this.anchor.x;

        var h0 = height * (1 - this.anchor.y);
        var h1 = height * -this.anchor.y;

        var worldTransform = matrix || this.worldTransform;

        var a = worldTransform.a;
        var b = worldTransform.c;
        var c = worldTransform.b;
        var d = worldTransform.d;
        var tx = worldTransform.tx;
        var ty = worldTransform.ty;

        var x1 = a * w1 + c * h1 + tx;
        var y1 = d * h1 + b * w1 + ty;

        var x2 = a * w0 + c * h1 + tx;
        var y2 = d * h1 + b * w0 + ty;

        var x3 = a * w0 + c * h0 + tx;
        var y3 = d * h0 + b * w0 + ty;

        var x4 = a * w1 + c * h0 + tx;
        var y4 = d * h0 + b * w1 + ty;

        var maxX = -Infinity;
        var maxY = -Infinity;

        var minX = Infinity;
        var minY = Infinity;

        minX = x1 < minX ? x1 : minX;
        minX = x2 < minX ? x2 : minX;
        minX = x3 < minX ? x3 : minX;
        minX = x4 < minX ? x4 : minX;

        minY = y1 < minY ? y1 : minY;
        minY = y2 < minY ? y2 : minY;
        minY = y3 < minY ? y3 : minY;
        minY = y4 < minY ? y4 : minY;

        maxX = x1 > maxX ? x1 : maxX;
        maxX = x2 > maxX ? x2 : maxX;
        maxX = x3 > maxX ? x3 : maxX;
        maxX = x4 > maxX ? x4 : maxX;

        maxY = y1 > maxY ? y1 : maxY;
        maxY = y2 > maxY ? y2 : maxY;
        maxY = y3 > maxY ? y3 : maxY;
        maxY = y4 > maxY ? y4 : maxY;

        var bounds = this._bounds;

        bounds.x = minX;
        bounds.width = maxX - minX;

        bounds.y = minY;
        bounds.height = maxY - minY;

        // store a reference so that if this function gets called again in the render cycle we do not have to recalculate
        this._currentBounds = bounds;

        return bounds;
    };

    /**
     * Renders the object using the WebGL renderer
     *
     * @method _renderWebGL
     * @param renderSession {RenderSession} 
     * @private
     */
    PIXI.Sprite.prototype._renderWebGL = function(renderSession) {
        // if the sprite is not visible or the alpha is 0 then no need to render this element
        if (!this.visible || this.alpha <= 0) return;

        var i, j;

        // do a quick check to see if this element has a mask or a filter.
        if (this._mask || this._filters) {
            var spriteBatch = renderSession.spriteBatch;

            // push filter first as we need to ensure the stencil buffer is correct for any masking
            if (this._filters) {
                spriteBatch.flush();
                renderSession.filterManager.pushFilter(this._filterBlock);
            }

            if (this._mask) {
                spriteBatch.stop();
                renderSession.maskManager.pushMask(this.mask, renderSession);
                spriteBatch.start();
            }

            // add this sprite to the batch
            spriteBatch.render(this);

            // now loop through the children and make sure they get rendered
            for (i = 0, j = this.children.length; i < j; i++) {
                this.children[i]._renderWebGL(renderSession);
            }

            // time to stop the sprite batch as either a mask element or a filter draw will happen next
            spriteBatch.stop();

            if (this._mask) renderSession.maskManager.popMask(this._mask, renderSession);
            if (this._filters) renderSession.filterManager.popFilter();

            spriteBatch.start();
        } else {
            renderSession.spriteBatch.render(this);

            // simple render children!
            for (i = 0, j = this.children.length; i < j; i++) {
                this.children[i]._renderWebGL(renderSession);
            }

        }
    };

    /**
     * Renders the object using the Canvas renderer
     *
     * @method _renderCanvas
     * @param renderSession {RenderSession} 
     * @private
     */
    PIXI.Sprite.prototype._renderCanvas = function(renderSession) {
        // If the sprite is not visible or the alpha is 0 then no need to render this element
        if (this.visible === false || this.alpha === 0 || this.texture.crop.width <= 0 || this.texture.crop.height <= 0) return;

        if (this.blendMode !== renderSession.currentBlendMode) {
            renderSession.currentBlendMode = this.blendMode;
            renderSession.context.globalCompositeOperation = PIXI.blendModesCanvas[renderSession.currentBlendMode];
        }

        if (this._mask) {
            renderSession.maskManager.pushMask(this._mask, renderSession);
        }

        //  Ignore null sources
        if (this.texture.valid) {
            var resolution = this.texture.baseTexture.resolution / renderSession.resolution;

            renderSession.context.globalAlpha = this.worldAlpha;

            //  Allow for pixel rounding
            if (renderSession.roundPixels) {
                renderSession.context.setTransform(
                    this.worldTransform.a,
                    this.worldTransform.b,
                    this.worldTransform.c,
                    this.worldTransform.d,
                    (this.worldTransform.tx * renderSession.resolution) | 0,
                    (this.worldTransform.ty * renderSession.resolution) | 0);
            } else {
                renderSession.context.setTransform(
                    this.worldTransform.a,
                    this.worldTransform.b,
                    this.worldTransform.c,
                    this.worldTransform.d,
                    this.worldTransform.tx * renderSession.resolution,
                    this.worldTransform.ty * renderSession.resolution);
            }

            //  If smoothingEnabled is supported and we need to change the smoothing property for this texture
            if (renderSession.smoothProperty && renderSession.scaleMode !== this.texture.baseTexture.scaleMode) {
                renderSession.scaleMode = this.texture.baseTexture.scaleMode;
                renderSession.context[renderSession.smoothProperty] = (renderSession.scaleMode === PIXI.scaleModes.LINEAR);
            }

            //  If the texture is trimmed we offset by the trim x/y, otherwise we use the frame dimensions
            var dx = (this.texture.trim) ? this.texture.trim.x - this.anchor.x * this.texture.trim.width : this.anchor.x * -this.texture.frame.width;
            var dy = (this.texture.trim) ? this.texture.trim.y - this.anchor.y * this.texture.trim.height : this.anchor.y * -this.texture.frame.height;

            if (this.tint !== 0xFFFFFF) {
                if (this.cachedTint !== this.tint) {
                    this.cachedTint = this.tint;

                    //  TODO clean up caching - how to clean up the caches?
                    this.tintedTexture = PIXI.CanvasTinter.getTintedTexture(this, this.tint);
                }

                renderSession.context.drawImage(
                    this.tintedTexture,
                    0,
                    0,
                    this.texture.crop.width,
                    this.texture.crop.height,
                    dx / resolution,
                    dy / resolution,
                    this.texture.crop.width / resolution,
                    this.texture.crop.height / resolution);
            } else {
                renderSession.context.drawImage(
                    this.texture.baseTexture.source,
                    this.texture.crop.x,
                    this.texture.crop.y,
                    this.texture.crop.width,
                    this.texture.crop.height,
                    dx / resolution,
                    dy / resolution,
                    this.texture.crop.width / resolution,
                    this.texture.crop.height / resolution);
            }
        }

        // OVERWRITE
        for (var i = 0, j = this.children.length; i < j; i++) {
            this.children[i]._renderCanvas(renderSession);
        }

        if (this._mask) {
            renderSession.maskManager.popMask(renderSession);
        }
    };

    // some helper functions..

    /**
     *
     * Helper function that creates a sprite that will contain a texture from the TextureCache based on the frameId
     * The frame ids are created when a Texture packer file has been loaded
     *
     * @method fromFrame
     * @static
     * @param frameId {String} The frame Id of the texture in the cache
     * @return {Sprite} A new Sprite using a texture from the texture cache matching the frameId
     */
    PIXI.Sprite.fromFrame = function(frameId) {
        var texture = PIXI.TextureCache[frameId];
        if (!texture) throw new Error('The frameId "' + frameId + '" does not exist in the texture cache' + this);
        return new PIXI.Sprite(texture);
    };

    /**
     *
     * Helper function that creates a sprite that will contain a texture based on an image url
     * If the image is not in the texture cache it will be loaded
     *
     * @method fromImage
     * @static
     * @param imageId {String} The image url of the texture
     * @return {Sprite} A new Sprite using a texture from the texture cache matching the image id
     */
    PIXI.Sprite.fromImage = function(imageId, crossorigin, scaleMode) {
        var texture = PIXI.Texture.fromImage(imageId, crossorigin, scaleMode);
        return new PIXI.Sprite(texture);
    };

    /**
     * @author Mat Groves http://matgroves.com/
     */

    /**
     * The SpriteBatch class is a really fast version of the DisplayObjectContainer 
     * built solely for speed, so use when you need a lot of sprites or particles.
     * And it's extremely easy to use : 

        var container = new PIXI.SpriteBatch();
     
        stage.addChild(container);
     
        for(var i  = 0; i < 100; i++)
        {
            var sprite = new PIXI.Sprite.fromImage("myImage.png");
            container.addChild(sprite);
        }
     * And here you have a hundred sprites that will be renderer at the speed of light
     *
     * @class SpriteBatch
     * @constructor
     * @param texture {Texture}
     */

    //TODO RENAME to PARTICLE CONTAINER?
    PIXI.SpriteBatch = function(texture) {
        PIXI.DisplayObjectContainer.call(this);

        this.textureThing = texture;

        this.ready = false;
    };

    PIXI.SpriteBatch.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
    PIXI.SpriteBatch.prototype.constructor = PIXI.SpriteBatch;

    /*
     * Initialises the spriteBatch
     *
     * @method initWebGL
     * @param gl {WebGLContext} the current WebGL drawing context
     */
    PIXI.SpriteBatch.prototype.initWebGL = function(gl) {
        // TODO only one needed for the whole engine really?
        this.fastSpriteBatch = new PIXI.WebGLFastSpriteBatch(gl);

        this.ready = true;
    };

    /*
     * Updates the object transform for rendering
     *
     * @method updateTransform
     * @private
     */
    PIXI.SpriteBatch.prototype.updateTransform = function() {
        // TODO don't need to!
        PIXI.DisplayObject.prototype.updateTransform.call(this);
        //  PIXI.DisplayObjectContainer.prototype.updateTransform.call( this );
    };

    /**
     * Renders the object using the WebGL renderer
     *
     * @method _renderWebGL
     * @param renderSession {RenderSession} 
     * @private
     */
    PIXI.SpriteBatch.prototype._renderWebGL = function(renderSession) {
        if (!this.visible || this.alpha <= 0 || !this.children.length) return;

        if (!this.ready) this.initWebGL(renderSession.gl);

        renderSession.spriteBatch.stop();

        renderSession.shaderManager.setShader(renderSession.shaderManager.fastShader);

        this.fastSpriteBatch.begin(this, renderSession);
        this.fastSpriteBatch.render(this);

        renderSession.spriteBatch.start();

    };

    /**
     * Renders the object using the Canvas renderer
     *
     * @method _renderCanvas
     * @param renderSession {RenderSession} 
     * @private
     */
    PIXI.SpriteBatch.prototype._renderCanvas = function(renderSession) {
        if (!this.visible || this.alpha <= 0 || !this.children.length) return;

        var context = renderSession.context;
        context.globalAlpha = this.worldAlpha;

        PIXI.DisplayObject.prototype.updateTransform.call(this);

        var transform = this.worldTransform;
        // alow for trimming

        var isRotated = true;

        for (var i = 0; i < this.children.length; i++) {

            var child = this.children[i];

            if (!child.visible) continue;

            var texture = child.texture;
            var frame = texture.frame;

            context.globalAlpha = this.worldAlpha * child.alpha;

            if (child.rotation % (Math.PI * 2) === 0) {
                if (isRotated) {
                    context.setTransform(transform.a, transform.b, transform.c, transform.d, transform.tx, transform.ty);
                    isRotated = false;
                }

                // this is the fastest  way to optimise! - if rotation is 0 then we can avoid any kind of setTransform call
                context.drawImage(texture.baseTexture.source,
                    frame.x,
                    frame.y,
                    frame.width,
                    frame.height,
                    ((child.anchor.x) * (-frame.width * child.scale.x) + child.position.x + 0.5) | 0,
                    ((child.anchor.y) * (-frame.height * child.scale.y) + child.position.y + 0.5) | 0,
                    frame.width * child.scale.x,
                    frame.height * child.scale.y);
            } else {
                if (!isRotated) isRotated = true;

                PIXI.DisplayObject.prototype.updateTransform.call(child);

                var childTransform = child.worldTransform;

                // allow for trimming

                if (renderSession.roundPixels) {
                    context.setTransform(childTransform.a, childTransform.b, childTransform.c, childTransform.d, childTransform.tx | 0, childTransform.ty | 0);
                } else {
                    context.setTransform(childTransform.a, childTransform.b, childTransform.c, childTransform.d, childTransform.tx, childTransform.ty);
                }

                context.drawImage(texture.baseTexture.source,
                    frame.x,
                    frame.y,
                    frame.width,
                    frame.height,
                    ((child.anchor.x) * (-frame.width) + 0.5) | 0,
                    ((child.anchor.y) * (-frame.height) + 0.5) | 0,
                    frame.width,
                    frame.height);


            }

            // context.restore();
        }

        //    context.restore();
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * A MovieClip is a simple way to display an animation depicted by a list of textures.
     *
     * @class MovieClip
     * @extends Sprite
     * @constructor
     * @param textures {Array<Texture>} an array of {Texture} objects that make up the animation
     */
    PIXI.MovieClip = function(textures) {
        PIXI.Sprite.call(this, textures[0]);

        /**
         * The array of textures that make up the animation
         *
         * @property textures
         * @type Array
         */
        this.textures = textures;

        /**
         * The speed that the MovieClip will play at. Higher is faster, lower is slower
         *
         * @property animationSpeed
         * @type Number
         * @default 1
         */
        this.animationSpeed = 1;

        /**
         * Whether or not the movie clip repeats after playing.
         *
         * @property loop
         * @type Boolean
         * @default true
         */
        this.loop = true;

        /**
         * Function to call when a MovieClip finishes playing
         *
         * @property onComplete
         * @type Function
         */
        this.onComplete = null;

        /**
         * [read-only] The MovieClips current frame index (this may not have to be a whole number)
         *
         * @property currentFrame
         * @type Number
         * @default 0
         * @readOnly
         */
        this.currentFrame = 0;

        /**
         * [read-only] Indicates if the MovieClip is currently playing
         *
         * @property playing
         * @type Boolean
         * @readOnly
         */
        this.playing = false;
    };

    // constructor
    PIXI.MovieClip.prototype = Object.create(PIXI.Sprite.prototype);
    PIXI.MovieClip.prototype.constructor = PIXI.MovieClip;

    /**
     * [read-only] totalFrames is the total number of frames in the MovieClip. This is the same as number of textures
     * assigned to the MovieClip.
     *
     * @property totalFrames
     * @type Number
     * @default 0
     * @readOnly
     */
    Object.defineProperty(PIXI.MovieClip.prototype, 'totalFrames', {
        get: function() {

            return this.textures.length;
        }
    });

    /**
     * Stops the MovieClip
     *
     * @method stop
     */
    PIXI.MovieClip.prototype.stop = function() {
        this.playing = false;
    };

    /**
     * Plays the MovieClip
     *
     * @method play
     */
    PIXI.MovieClip.prototype.play = function() {
        this.playing = true;
    };

    /**
     * Stops the MovieClip and goes to a specific frame
     *
     * @method gotoAndStop
     * @param frameNumber {Number} frame index to stop at
     */
    PIXI.MovieClip.prototype.gotoAndStop = function(frameNumber) {
        this.playing = false;
        this.currentFrame = frameNumber;
        var round = (this.currentFrame + 0.5) | 0;
        this.setTexture(this.textures[round % this.textures.length]);
    };

    /**
     * Goes to a specific frame and begins playing the MovieClip
     *
     * @method gotoAndPlay
     * @param frameNumber {Number} frame index to start at
     */
    PIXI.MovieClip.prototype.gotoAndPlay = function(frameNumber) {
        this.currentFrame = frameNumber;
        this.playing = true;
    };

    /*
     * Updates the object transform for rendering
     *
     * @method updateTransform
     * @private
     */
    PIXI.MovieClip.prototype.updateTransform = function() {
        PIXI.Sprite.prototype.updateTransform.call(this);

        if (!this.playing) return;

        this.currentFrame += this.animationSpeed;

        var round = (this.currentFrame + 0.5) | 0;

        this.currentFrame = this.currentFrame % this.textures.length;

        if (this.loop || round < this.textures.length) {
            this.setTexture(this.textures[round % this.textures.length]);
        } else if (round >= this.textures.length) {
            this.gotoAndStop(this.textures.length - 1);
            if (this.onComplete) {
                this.onComplete();
            }
        }
    };

    /**
     * A short hand way of creating a movieclip from an array of frame ids
     *
     * @static
     * @method fromFrames
     * @param frames {Array} the array of frames ids the movieclip will use as its texture frames
     */
    PIXI.MovieClip.fromFrames = function(frames) {
        var textures = [];

        for (var i = 0; i < frames.length; i++) {
            textures.push(new PIXI.Texture.fromFrame(frames[i]));
        }

        return new PIXI.MovieClip(textures);
    };

    /**
     * A short hand way of creating a movieclip from an array of image ids
     *
     * @static
     * @method fromImages
     * @param frames {Array} the array of image ids the movieclip will use as its texture frames
     */
    PIXI.MovieClip.fromImages = function(images) {
        var textures = [];

        for (var i = 0; i < images.length; i++) {
            textures.push(new PIXI.Texture.fromImage(images[i]));
        }

        return new PIXI.MovieClip(textures);
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * A target and pass info object for filters.
     * 
     * @class FilterBlock
     * @constructor
     */
    PIXI.FilterBlock = function() {
        /**
         * The visible state of this FilterBlock.
         *
         * @property visible
         * @type Boolean
         */
        this.visible = true;

        /**
         * The renderable state of this FilterBlock.
         *
         * @property renderable
         * @type Boolean
         */
        this.renderable = true;
    };

    PIXI.FilterBlock.prototype.constructor = PIXI.FilterBlock;

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     * Modified by Tom Slezakowski http://www.tomslezakowski.com @TomSlezakowski (24/03/2014) - Added dropShadowColor.
     */

    /**
     * A Text Object will create a line or multiple lines of text. To split a line you can use '\n' in your text string,
     * or add a wordWrap property set to true and and wordWrapWidth property with a value in the style object.
     *
     * @class Text
     * @extends Sprite
     * @constructor
     * @param text {String} The copy that you would like the text to display
     * @param [style] {Object} The style parameters
     * @param [style.font] {String} default 'bold 20px Arial' The style and size of the font
     * @param [style.fill='black'] {String|Number} A canvas fillstyle that will be used on the text e.g 'red', '#00FF00'
     * @param [style.align='left'] {String} Alignment for multiline text ('left', 'center' or 'right'), does not affect single line text
     * @param [style.stroke] {String|Number} A canvas fillstyle that will be used on the text stroke e.g 'blue', '#FCFF00'
     * @param [style.strokeThickness=0] {Number} A number that represents the thickness of the stroke. Default is 0 (no stroke)
     * @param [style.wordWrap=false] {Boolean} Indicates if word wrap should be used
     * @param [style.wordWrapWidth=100] {Number} The width at which text will wrap, it needs wordWrap to be set to true
     * @param [style.dropShadow=false] {Boolean} Set a drop shadow for the text
     * @param [style.dropShadowColor='#000000'] {String} A fill style to be used on the dropshadow e.g 'red', '#00FF00'
     * @param [style.dropShadowAngle=Math.PI/4] {Number} Set a angle of the drop shadow
     * @param [style.dropShadowDistance=5] {Number} Set a distance of the drop shadow
     */
    PIXI.Text = function(text, style) {
        /**
         * The canvas element that everything is drawn to
         *
         * @property canvas
         * @type HTMLCanvasElement
         */
        this.canvas = document.createElement('canvas');

        /**
         * The canvas 2d context that everything is drawn with
         * @property context
         * @type HTMLCanvasElement
         */
        this.context = this.canvas.getContext('2d');

        /**
         * The resolution of the canvas.
         * @property resolution
         * @type Number
         */
        this.resolution = 1;

        PIXI.Sprite.call(this, PIXI.Texture.fromCanvas(this.canvas));

        this.setText(text);
        this.setStyle(style);

    };

    // constructor
    PIXI.Text.prototype = Object.create(PIXI.Sprite.prototype);
    PIXI.Text.prototype.constructor = PIXI.Text;

    /**
     * The width of the Text, setting this will actually modify the scale to achieve the value set
     *
     * @property width
     * @type Number
     */
    Object.defineProperty(PIXI.Text.prototype, 'width', {
        get: function() {

            if (this.dirty) {
                this.updateText();
                this.dirty = false;
            }


            return this.scale.x * this.texture.frame.width;
        },
        set: function(value) {
            this.scale.x = value / this.texture.frame.width;
            this._width = value;
        }
    });

    /**
     * The height of the Text, setting this will actually modify the scale to achieve the value set
     *
     * @property height
     * @type Number
     */
    Object.defineProperty(PIXI.Text.prototype, 'height', {
        get: function() {

            if (this.dirty) {
                this.updateText();
                this.dirty = false;
            }


            return this.scale.y * this.texture.frame.height;
        },
        set: function(value) {
            this.scale.y = value / this.texture.frame.height;
            this._height = value;
        }
    });

    /**
     * Set the style of the text
     *
     * @method setStyle
     * @param [style] {Object} The style parameters
     * @param [style.font='bold 20pt Arial'] {String} The style and size of the font
     * @param [style.fill='black'] {Object} A canvas fillstyle that will be used on the text eg 'red', '#00FF00'
     * @param [style.align='left'] {String} Alignment for multiline text ('left', 'center' or 'right'), does not affect single line text
     * @param [style.stroke='black'] {String} A canvas fillstyle that will be used on the text stroke eg 'blue', '#FCFF00'
     * @param [style.strokeThickness=0] {Number} A number that represents the thickness of the stroke. Default is 0 (no stroke)
     * @param [style.wordWrap=false] {Boolean} Indicates if word wrap should be used
     * @param [style.wordWrapWidth=100] {Number} The width at which text will wrap
     * @param [style.dropShadow=false] {Boolean} Set a drop shadow for the text
     * @param [style.dropShadowColor='#000000'] {String} A fill style to be used on the dropshadow e.g 'red', '#00FF00'
     * @param [style.dropShadowAngle=Math.PI/4] {Number} Set a angle of the drop shadow
     * @param [style.dropShadowDistance=5] {Number} Set a distance of the drop shadow
     */
    PIXI.Text.prototype.setStyle = function(style) {
        style = style || {};
        style.font = style.font || 'bold 20pt Arial';
        style.fill = style.fill || 'black';
        style.align = style.align || 'left';
        style.stroke = style.stroke || 'black'; //provide a default, see: https://github.com/GoodBoyDigital/pixi.js/issues/136
        style.strokeThickness = style.strokeThickness || 0;
        style.wordWrap = style.wordWrap || false;
        style.wordWrapWidth = style.wordWrapWidth || 100;

        style.dropShadow = style.dropShadow || false;
        style.dropShadowAngle = style.dropShadowAngle || Math.PI / 6;
        style.dropShadowDistance = style.dropShadowDistance || 4;
        style.dropShadowColor = style.dropShadowColor || 'black';

        this.style = style;
        this.dirty = true;
    };

    /**
     * Set the copy for the text object. To split a line you can use '\n'.
     *
     * @method setText
     * @param text {String} The copy that you would like the text to display
     */
    PIXI.Text.prototype.setText = function(text) {
        this.text = text.toString() || ' ';
        this.dirty = true;
    };

    /**
     * Renders text and updates it when needed
     *
     * @method updateText
     * @private
     */
    PIXI.Text.prototype.updateText = function() {
        this.texture.baseTexture.resolution = this.resolution;

        this.context.font = this.style.font;

        var outputText = this.text;

        // word wrap
        // preserve original text
        if (this.style.wordWrap) outputText = this.wordWrap(this.text);

        //split text into lines
        var lines = outputText.split(/(?:\r\n|\r|\n)/);

        //calculate text width
        var lineWidths = [];
        var maxLineWidth = 0;
        var fontProperties = this.determineFontProperties(this.style.font);
        for (var i = 0; i < lines.length; i++) {
            var lineWidth = this.context.measureText(lines[i]).width;
            lineWidths[i] = lineWidth;
            maxLineWidth = Math.max(maxLineWidth, lineWidth);
        }

        var width = maxLineWidth + this.style.strokeThickness;
        if (this.style.dropShadow) width += this.style.dropShadowDistance;

        this.canvas.width = (width + this.context.lineWidth) * this.resolution;

        //calculate text height
        var lineHeight = fontProperties.fontSize + this.style.strokeThickness;

        var height = lineHeight * lines.length;
        if (this.style.dropShadow) height += this.style.dropShadowDistance;

        this.canvas.height = height * this.resolution;

        this.context.scale(this.resolution, this.resolution);

        if (navigator.isCocoonJS) this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.context.font = this.style.font;
        this.context.strokeStyle = this.style.stroke;
        this.context.lineWidth = this.style.strokeThickness;
        this.context.textBaseline = 'alphabetic';
        this.context.lineJoin = 'round';

        var linePositionX;
        var linePositionY;

        if (this.style.dropShadow) {
            this.context.fillStyle = this.style.dropShadowColor;

            var xShadowOffset = Math.sin(this.style.dropShadowAngle) * this.style.dropShadowDistance;
            var yShadowOffset = Math.cos(this.style.dropShadowAngle) * this.style.dropShadowDistance;

            for (i = 0; i < lines.length; i++) {
                linePositionX = this.style.strokeThickness / 2;
                linePositionY = (this.style.strokeThickness / 2 + i * lineHeight) + fontProperties.ascent;

                if (this.style.align === 'right') {
                    linePositionX += maxLineWidth - lineWidths[i];
                } else if (this.style.align === 'center') {
                    linePositionX += (maxLineWidth - lineWidths[i]) / 2;
                }

                if (this.style.fill) {
                    this.context.fillText(lines[i], linePositionX + xShadowOffset, linePositionY + yShadowOffset);
                }

                //  if(dropShadow)
            }
        }

        //set canvas text styles
        this.context.fillStyle = this.style.fill;

        //draw lines line by line
        for (i = 0; i < lines.length; i++) {
            linePositionX = this.style.strokeThickness / 2;
            linePositionY = (this.style.strokeThickness / 2 + i * lineHeight) + fontProperties.ascent;

            if (this.style.align === 'right') {
                linePositionX += maxLineWidth - lineWidths[i];
            } else if (this.style.align === 'center') {
                linePositionX += (maxLineWidth - lineWidths[i]) / 2;
            }

            if (this.style.stroke && this.style.strokeThickness) {
                this.context.strokeText(lines[i], linePositionX, linePositionY);
            }

            if (this.style.fill) {
                this.context.fillText(lines[i], linePositionX, linePositionY);
            }

            //  if(dropShadow)
        }

        this.updateTexture();
    };

    /**
     * Updates texture size based on canvas size
     *
     * @method updateTexture
     * @private
     */
    PIXI.Text.prototype.updateTexture = function() {
        this.texture.baseTexture.width = this.canvas.width;
        this.texture.baseTexture.height = this.canvas.height;
        this.texture.crop.width = this.texture.frame.width = this.canvas.width;
        this.texture.crop.height = this.texture.frame.height = this.canvas.height;

        this._width = this.canvas.width;
        this._height = this.canvas.height;

        // update the dirty base textures
        this.texture.baseTexture.dirty();
    };

    /**
     * Renders the object using the WebGL renderer
     *
     * @method _renderWebGL
     * @param renderSession {RenderSession} 
     * @private
     */
    PIXI.Text.prototype._renderWebGL = function(renderSession) {
        if (this.dirty) {
            this.resolution = renderSession.resolution;

            this.updateText();
            this.dirty = false;
        }

        PIXI.Sprite.prototype._renderWebGL.call(this, renderSession);
    };

    /**
     * Renders the object using the Canvas renderer
     *
     * @method _renderCanvas
     * @param renderSession {RenderSession} 
     * @private
     */
    PIXI.Text.prototype._renderCanvas = function(renderSession) {
        if (this.dirty) {
            this.resolution = renderSession.resolution;

            this.updateText();
            this.dirty = false;
        }

        PIXI.Sprite.prototype._renderCanvas.call(this, renderSession);
    };

    /**
     * Calculates the ascent, descent and fontSize of a given fontStyle
     *
     * @method determineFontProperties
     * @param fontStyle {Object}
     * @private
     */
    PIXI.Text.prototype.determineFontProperties = function(fontStyle) {
        var properties = PIXI.Text.fontPropertiesCache[fontStyle];

        if (!properties) {
            properties = {};

            var canvas = PIXI.Text.fontPropertiesCanvas;
            var context = PIXI.Text.fontPropertiesContext;

            context.font = fontStyle;

            var width = Math.ceil(context.measureText('|Mq').width);
            var baseline = Math.ceil(context.measureText('M').width);
            var height = 2 * baseline;

            baseline = baseline * 1.4 | 0;

            canvas.width = width;
            canvas.height = height;

            context.fillStyle = '#f00';
            context.fillRect(0, 0, width, height);

            context.font = fontStyle;

            context.textBaseline = 'alphabetic';
            context.fillStyle = '#000';
            context.fillText('|Mq', 0, baseline);

            var imagedata = context.getImageData(0, 0, width, height).data;
            var pixels = imagedata.length;
            var line = width * 4;

            var i, j;

            var idx = 0;
            var stop = false;

            // ascent. scan from top to bottom until we find a non red pixel
            for (i = 0; i < baseline; i++) {
                for (j = 0; j < line; j += 4) {
                    if (imagedata[idx + j] !== 255) {
                        stop = true;
                        break;
                    }
                }
                if (!stop) {
                    idx += line;
                } else {
                    break;
                }
            }

            properties.ascent = baseline - i;

            idx = pixels - line;
            stop = false;

            // descent. scan from bottom to top until we find a non red pixel
            for (i = height; i > baseline; i--) {
                for (j = 0; j < line; j += 4) {
                    if (imagedata[idx + j] !== 255) {
                        stop = true;
                        break;
                    }
                }
                if (!stop) {
                    idx -= line;
                } else {
                    break;
                }
            }

            properties.descent = i - baseline;
            properties.fontSize = properties.ascent + properties.descent;

            PIXI.Text.fontPropertiesCache[fontStyle] = properties;
        }

        return properties;
    };

    /**
     * Applies newlines to a string to have it optimally fit into the horizontal
     * bounds set by the Text object's wordWrapWidth property.
     *
     * @method wordWrap
     * @param text {String}
     * @private
     */
    PIXI.Text.prototype.wordWrap = function(text) {
        // Greedy wrapping algorithm that will wrap words as the line grows longer
        // than its horizontal bounds.
        var result = '';
        var lines = text.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var spaceLeft = this.style.wordWrapWidth;
            var words = lines[i].split(' ');
            for (var j = 0; j < words.length; j++) {
                var wordWidth = this.context.measureText(words[j]).width;
                var wordWidthWithSpace = wordWidth + this.context.measureText(' ').width;
                if (j === 0 || wordWidthWithSpace > spaceLeft) {
                    // Skip printing the newline if it's the first word of the line that is
                    // greater than the word wrap width.
                    if (j > 0) {
                        result += '\n';
                    }
                    result += words[j];
                    spaceLeft = this.style.wordWrapWidth - wordWidth;
                } else {
                    spaceLeft -= wordWidthWithSpace;
                    result += ' ' + words[j];
                }
            }

            if (i < lines.length - 1) {
                result += '\n';
            }
        }
        return result;
    };

    /**
     * Destroys this text object.
     *
     * @method destroy
     * @param destroyBaseTexture {Boolean} whether to destroy the base texture as well
     */
    PIXI.Text.prototype.destroy = function(destroyBaseTexture) {
        // make sure to reset the the context and canvas.. dont want this hanging around in memory!
        this.context = null;
        this.canvas = null;

        this.texture.destroy(destroyBaseTexture === undefined ? true : destroyBaseTexture);
    };

    PIXI.Text.fontPropertiesCache = {};
    PIXI.Text.fontPropertiesCanvas = document.createElement('canvas');
    PIXI.Text.fontPropertiesContext = PIXI.Text.fontPropertiesCanvas.getContext('2d');

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * A BitmapText object will create a line or multiple lines of text using bitmap font. To split a line you can use '\n', '\r' or '\r\n' in your string.
     * You can generate the fnt files using
     * http://www.angelcode.com/products/bmfont/ for windows or
     * http://www.bmglyph.com/ for mac.
     *
     * @class BitmapText
     * @extends DisplayObjectContainer
     * @constructor
     * @param text {String} The copy that you would like the text to display
     * @param style {Object} The style parameters
     * @param style.font {String} The size (optional) and bitmap font id (required) eq 'Arial' or '20px Arial' (must have loaded previously)
     * @param [style.align='left'] {String} Alignment for multiline text ('left', 'center' or 'right'), does not affect single line text
     */
    PIXI.BitmapText = function(text, style) {
        PIXI.DisplayObjectContainer.call(this);

        /**
         * [read-only] The width of the overall text, different from fontSize,
         * which is defined in the style object
         *
         * @property textWidth
         * @type Number
         * @readOnly
         */
        this.textWidth = 0;

        /**
         * [read-only] The height of the overall text, different from fontSize,
         * which is defined in the style object
         *
         * @property textHeight
         * @type Number
         * @readOnly
         */
        this.textHeight = 0;

        /**
         * @property _pool
         * @type Array
         * @private
         */
        this._pool = [];

        this.setText(text);
        this.setStyle(style);
        this.updateText();

        /**
         * The dirty state of this object.
         * @property dirty
         * @type Boolean
         */
        this.dirty = false;
    };

    // constructor
    PIXI.BitmapText.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
    PIXI.BitmapText.prototype.constructor = PIXI.BitmapText;

    /**
     * Set the text string to be rendered.
     *
     * @method setText
     * @param text {String} The text that you would like displayed
     */
    PIXI.BitmapText.prototype.setText = function(text) {
        this.text = text || ' ';
        this.dirty = true;
    };

    /**
     * Set the style of the text
     * style.font {String} The size (optional) and bitmap font id (required) eq 'Arial' or '20px Arial' (must have loaded previously)
     * [style.align='left'] {String} Alignment for multiline text ('left', 'center' or 'right'), does not affect single lines of text
     *
     * @method setStyle
     * @param style {Object} The style parameters, contained as properties of an object
     */
    PIXI.BitmapText.prototype.setStyle = function(style) {
        style = style || {};
        style.align = style.align || 'left';
        this.style = style;

        var font = style.font.split(' ');
        this.fontName = font[font.length - 1];
        this.fontSize = font.length >= 2 ? parseInt(font[font.length - 2], 10) : PIXI.BitmapText.fonts[this.fontName].size;

        this.dirty = true;
        this.tint = style.tint;
    };

    /**
     * Renders text and updates it when needed
     *
     * @method updateText
     * @private
     */
    PIXI.BitmapText.prototype.updateText = function() {
        var data = PIXI.BitmapText.fonts[this.fontName];
        var pos = new PIXI.Point();
        var prevCharCode = null;
        var chars = [];
        var maxLineWidth = 0;
        var lineWidths = [];
        var line = 0;
        var scale = this.fontSize / data.size;

        for (var i = 0; i < this.text.length; i++) {
            var charCode = this.text.charCodeAt(i);

            if (/(?:\r\n|\r|\n)/.test(this.text.charAt(i))) {
                lineWidths.push(pos.x);
                maxLineWidth = Math.max(maxLineWidth, pos.x);
                line++;

                pos.x = 0;
                pos.y += data.lineHeight;
                prevCharCode = null;
                continue;
            }

            var charData = data.chars[charCode];

            if (!charData) continue;

            if (prevCharCode && charData.kerning[prevCharCode]) {
                pos.x += charData.kerning[prevCharCode];
            }

            chars.push({ texture: charData.texture, line: line, charCode: charCode, position: new PIXI.Point(pos.x + charData.xOffset, pos.y + charData.yOffset) });
            pos.x += charData.xAdvance;

            prevCharCode = charCode;
        }

        lineWidths.push(pos.x);
        maxLineWidth = Math.max(maxLineWidth, pos.x);

        var lineAlignOffsets = [];

        for (i = 0; i <= line; i++) {
            var alignOffset = 0;
            if (this.style.align === 'right') {
                alignOffset = maxLineWidth - lineWidths[i];
            } else if (this.style.align === 'center') {
                alignOffset = (maxLineWidth - lineWidths[i]) / 2;
            }
            lineAlignOffsets.push(alignOffset);
        }

        var lenChildren = this.children.length;
        var lenChars = chars.length;
        var tint = this.tint || 0xFFFFFF;

        for (i = 0; i < lenChars; i++) {
            var c = i < lenChildren ? this.children[i] : this._pool.pop(); // get old child if have. if not - take from pool.

            if (c) c.setTexture(chars[i].texture); // check if got one before.
            else c = new PIXI.Sprite(chars[i].texture); // if no create new one.

            c.position.x = (chars[i].position.x + lineAlignOffsets[chars[i].line]) * scale;
            c.position.y = chars[i].position.y * scale;
            c.scale.x = c.scale.y = scale;
            c.tint = tint;
            if (!c.parent) this.addChild(c);
        }

        // remove unnecessary children.
        // and put their into the pool.
        while (this.children.length > lenChars) {
            var child = this.getChildAt(this.children.length - 1);
            this._pool.push(child);
            this.removeChild(child);
        }

        this.textWidth = maxLineWidth * scale;
        this.textHeight = (pos.y + data.lineHeight) * scale;
    };

    /**
     * Updates the transform of this object
     *
     * @method updateTransform
     * @private
     */
    PIXI.BitmapText.prototype.updateTransform = function() {
        if (this.dirty) {
            this.updateText();
            this.dirty = false;
        }

        PIXI.DisplayObjectContainer.prototype.updateTransform.call(this);
    };

    PIXI.BitmapText.fonts = {};

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * Holds all information related to an Interaction event
     *
     * @class InteractionData
     * @constructor
     */
    PIXI.InteractionData = function() {
        /**
         * This point stores the global coords of where the touch/mouse event happened
         *
         * @property global
         * @type Point
         */
        this.global = new PIXI.Point();

        /**
         * The target Sprite that was interacted with
         *
         * @property target
         * @type Sprite
         */
        this.target = null;

        /**
         * When passed to an event handler, this will be the original DOM Event that was captured
         *
         * @property originalEvent
         * @type Event
         */
        this.originalEvent = null;
    };

    /**
     * This will return the local coordinates of the specified displayObject for this InteractionData
     *
     * @method getLocalPosition
     * @param displayObject {DisplayObject} The DisplayObject that you would like the local coords off
     * @param [point] {Point} A Point object in which to store the value, optional (otherwise will create a new point)
     * @return {Point} A point containing the coordinates of the InteractionData position relative to the DisplayObject
     */
    PIXI.InteractionData.prototype.getLocalPosition = function(displayObject, point) {
        var worldTransform = displayObject.worldTransform;
        var global = this.global;

        // do a cheeky transform to get the mouse coords;
        var a00 = worldTransform.a,
            a01 = worldTransform.b,
            a02 = worldTransform.tx,
            a10 = worldTransform.c,
            a11 = worldTransform.d,
            a12 = worldTransform.ty,
            id = 1 / (a00 * a11 + a01 * -a10);

        point = point || new PIXI.Point();

        point.x = a11 * id * global.x + -a01 * id * global.y + (a12 * a01 - a02 * a11) * id;
        point.y = a00 * id * global.y + -a10 * id * global.x + (-a12 * a00 + a02 * a10) * id;

        // set the mouse coords...
        return point;
    };

    // constructor
    PIXI.InteractionData.prototype.constructor = PIXI.InteractionData;

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * The interaction manager deals with mouse and touch events. Any DisplayObject can be interactive
     * if its interactive parameter is set to true
     * This manager also supports multitouch.
     *
     * @class InteractionManager
     * @constructor
     * @param stage {Stage} The stage to handle interactions
     */
    PIXI.InteractionManager = function(stage) {
        /**
         * A reference to the stage
         *
         * @property stage
         * @type Stage
         */
        this.stage = stage;

        /**
         * The mouse data
         *
         * @property mouse
         * @type InteractionData
         */
        this.mouse = new PIXI.InteractionData();

        /**
         * An object that stores current touches (InteractionData) by id reference
         *
         * @property touches
         * @type Object
         */
        this.touches = {};

        /**
         * @property tempPoint
         * @type Point
         * @private
         */
        this.tempPoint = new PIXI.Point();

        /**
         * @property mouseoverEnabled
         * @type Boolean
         * @default
         */
        this.mouseoverEnabled = true;

        /**
         * Tiny little interactiveData pool !
         *
         * @property pool
         * @type Array
         */
        this.pool = [];

        /**
         * An array containing all the iterative items from the our interactive tree
         * @property interactiveItems
         * @type Array
         * @private
         */
        this.interactiveItems = [];

        /**
         * Our canvas
         * @property interactionDOMElement
         * @type HTMLCanvasElement
         * @private
         */
        this.interactionDOMElement = null;

        //this will make it so that you don't have to call bind all the time

        /**
         * @property onMouseMove
         * @type Function
         */
        this.onMouseMove = this.onMouseMove.bind(this);

        /**
         * @property onMouseDown
         * @type Function
         */
        this.onMouseDown = this.onMouseDown.bind(this);

        /**
         * @property onMouseOut
         * @type Function
         */
        this.onMouseOut = this.onMouseOut.bind(this);

        /**
         * @property onMouseUp
         * @type Function
         */
        this.onMouseUp = this.onMouseUp.bind(this);

        /**
         * @property onTouchStart
         * @type Function
         */
        this.onTouchStart = this.onTouchStart.bind(this);

        /**
         * @property onTouchEnd
         * @type Function
         */
        this.onTouchEnd = this.onTouchEnd.bind(this);

        /**
         * @property onTouchMove
         * @type Function
         */
        this.onTouchMove = this.onTouchMove.bind(this);

        /**
         * @property last
         * @type Number
         */
        this.last = 0;

        /**
         * The css style of the cursor that is being used
         * @property currentCursorStyle
         * @type String
         */
        this.currentCursorStyle = 'inherit';

        /**
         * Is set to true when the mouse is moved out of the canvas
         * @property mouseOut
         * @type Boolean
         */
        this.mouseOut = false;

        /**
         * @property resolution
         * @type Number
         */
        this.resolution = 1;
    };

    // constructor
    PIXI.InteractionManager.prototype.constructor = PIXI.InteractionManager;

    /**
     * Collects an interactive sprite recursively to have their interactions managed
     *
     * @method collectInteractiveSprite
     * @param displayObject {DisplayObject} the displayObject to collect
     * @param iParent {DisplayObject} the display object's parent
     * @private
     */
    PIXI.InteractionManager.prototype.collectInteractiveSprite = function(displayObject, iParent) {
        var children = displayObject.children;
        var length = children.length;

        // make an interaction tree... {item.__interactiveParent}
        for (var i = length - 1; i >= 0; i--) {
            var child = children[i];

            // push all interactive bits
            if (child._interactive) {
                iParent.interactiveChildren = true;
                //child.__iParent = iParent;
                this.interactiveItems.push(child);

                if (child.children.length > 0) {
                    this.collectInteractiveSprite(child, child);
                }
            } else {
                child.__iParent = null;
                if (child.children.length > 0) {
                    this.collectInteractiveSprite(child, iParent);
                }
            }

        }
    };

    /**
     * Sets the target for event delegation
     *
     * @method setTarget
     * @param target {WebGLRenderer|CanvasRenderer} the renderer to bind events to
     * @private
     */
    PIXI.InteractionManager.prototype.setTarget = function(target) {
        this.target = target;
        this.resolution = target.resolution;

        // Check if the dom element has been set. If it has don't do anything.
        if (this.interactionDOMElement !== null) return;

        this.setTargetDomElement(target.view);
    };

    /**
     * Sets the DOM element which will receive mouse/touch events. This is useful for when you have other DOM
     * elements on top of the renderers Canvas element. With this you'll be able to delegate another DOM element
     * to receive those events
     *
     * @method setTargetDomElement
     * @param domElement {DOMElement} the DOM element which will receive mouse and touch events
     * @private
     */
    PIXI.InteractionManager.prototype.setTargetDomElement = function(domElement) {
        this.removeEvents();

        if (window.navigator.msPointerEnabled) {
            // time to remove some of that zoom in ja..
            domElement.style['-ms-content-zooming'] = 'none';
            domElement.style['-ms-touch-action'] = 'none';
        }

        this.interactionDOMElement = domElement;

        domElement.addEventListener('mousemove', this.onMouseMove, true);
        domElement.addEventListener('mousedown', this.onMouseDown, true);
        domElement.addEventListener('mouseout', this.onMouseOut, true);

        // aint no multi touch just yet!
        domElement.addEventListener('touchstart', this.onTouchStart, true);
        domElement.addEventListener('touchend', this.onTouchEnd, true);
        domElement.addEventListener('touchmove', this.onTouchMove, true);

        window.addEventListener('mouseup', this.onMouseUp, true);
    };

    /**
     * @method removeEvents
     * @private
     */
    PIXI.InteractionManager.prototype.removeEvents = function() {
        if (!this.interactionDOMElement) return;

        this.interactionDOMElement.style['-ms-content-zooming'] = '';
        this.interactionDOMElement.style['-ms-touch-action'] = '';

        this.interactionDOMElement.removeEventListener('mousemove', this.onMouseMove, true);
        this.interactionDOMElement.removeEventListener('mousedown', this.onMouseDown, true);
        this.interactionDOMElement.removeEventListener('mouseout', this.onMouseOut, true);

        // aint no multi touch just yet!
        this.interactionDOMElement.removeEventListener('touchstart', this.onTouchStart, true);
        this.interactionDOMElement.removeEventListener('touchend', this.onTouchEnd, true);
        this.interactionDOMElement.removeEventListener('touchmove', this.onTouchMove, true);

        this.interactionDOMElement = null;

        window.removeEventListener('mouseup', this.onMouseUp, true);
    };

    /**
     * updates the state of interactive objects
     *
     * @method update
     * @private
     */
    PIXI.InteractionManager.prototype.update = function() {
        if (!this.target) return;

        // frequency of 30fps??
        var now = Date.now();
        var diff = now - this.last;
        diff = (diff * PIXI.INTERACTION_FREQUENCY) / 1000;
        if (diff < 1) return;
        this.last = now;

        var i = 0;

        // ok.. so mouse events??
        // yes for now :)
        // OPTIMISE - how often to check??
        if (this.dirty) {
            this.rebuildInteractiveGraph();
        }

        // loop through interactive objects!
        var length = this.interactiveItems.length;
        var cursor = 'inherit';
        var over = false;

        for (i = 0; i < length; i++) {
            var item = this.interactiveItems[i];

            // OPTIMISATION - only calculate every time if the mousemove function exists..
            // OK so.. does the object have any other interactive functions?
            // hit-test the clip!
            // if (item.mouseover || item.mouseout || item.buttonMode)
            // {
            // ok so there are some functions so lets hit test it..
            item.__hit = this.hitTest(item, this.mouse);
            this.mouse.target = item;
            // ok so deal with interactions..
            // looks like there was a hit!
            if (item.__hit && !over) {
                if (item.buttonMode) cursor = item.defaultCursor;

                if (!item.interactiveChildren) {
                    over = true;
                }

                if (!item.__isOver) {
                    if (item.mouseover) {
                        item.mouseover(this.mouse);
                    }
                    item.__isOver = true;
                }
            } else {
                if (item.__isOver) {
                    // roll out!
                    if (item.mouseout) {
                        item.mouseout(this.mouse);
                    }
                    item.__isOver = false;
                }
            }
        }

        if (this.currentCursorStyle !== cursor) {
            this.currentCursorStyle = cursor;
            this.interactionDOMElement.style.cursor = cursor;
        }
    };

    /**
     * @method rebuildInteractiveGraph
     * @private
     */
    PIXI.InteractionManager.prototype.rebuildInteractiveGraph = function() {
        this.dirty = false;

        var len = this.interactiveItems.length;

        for (var i = 0; i < len; i++) {
            this.interactiveItems[i].interactiveChildren = false;
        }

        this.interactiveItems = [];

        if (this.stage.interactive) {
            this.interactiveItems.push(this.stage);
        }

        // Go through and collect all the objects that are interactive..
        this.collectInteractiveSprite(this.stage, this.stage);
    };

    /**
     * Is called when the mouse moves across the renderer element
     *
     * @method onMouseMove
     * @param event {Event} The DOM event of the mouse moving
     * @private
     */
    PIXI.InteractionManager.prototype.onMouseMove = function(event) {
        if (this.dirty) {
            this.rebuildInteractiveGraph();
        }

        this.mouse.originalEvent = event;

        // TODO optimize by not check EVERY TIME! maybe half as often? //
        var rect = this.interactionDOMElement.getBoundingClientRect();

        this.mouse.global.x = (event.clientX - rect.left) * (this.target.width / rect.width) / this.resolution;
        this.mouse.global.y = (event.clientY - rect.top) * (this.target.height / rect.height) / this.resolution;

        var length = this.interactiveItems.length;

        for (var i = 0; i < length; i++) {
            var item = this.interactiveItems[i];

            // Call the function!
            if (item.mousemove) {
                item.mousemove(this.mouse);
            }
        }
    };

    /**
     * Is called when the mouse button is pressed down on the renderer element
     *
     * @method onMouseDown
     * @param event {Event} The DOM event of a mouse button being pressed down
     * @private
     */
    PIXI.InteractionManager.prototype.onMouseDown = function(event) {
        if (this.dirty) {
            this.rebuildInteractiveGraph();
        }

        this.mouse.originalEvent = event;

        if (PIXI.AUTO_PREVENT_DEFAULT) {
            this.mouse.originalEvent.preventDefault();
        }

        // loop through interaction tree...
        // hit test each item! ->
        // get interactive items under point??
        //stage.__i
        var length = this.interactiveItems.length;

        var e = this.mouse.originalEvent;
        var isRightButton = e.button === 2 || e.which === 3;
        var downFunction = isRightButton ? 'rightdown' : 'mousedown';
        var clickFunction = isRightButton ? 'rightclick' : 'click';
        var buttonIsDown = isRightButton ? '__rightIsDown' : '__mouseIsDown';
        var isDown = isRightButton ? '__isRightDown' : '__isDown';

        // while
        // hit test
        for (var i = 0; i < length; i++) {
            var item = this.interactiveItems[i];

            if (item[downFunction] || item[clickFunction]) {
                item[buttonIsDown] = true;
                item.__hit = this.hitTest(item, this.mouse);

                if (item.__hit) {
                    //call the function!
                    if (item[downFunction]) {
                        item[downFunction](this.mouse);
                    }
                    item[isDown] = true;

                    // just the one!
                    if (!item.interactiveChildren) break;
                }
            }
        }
    };

    /**
     * Is called when the mouse is moved out of the renderer element
     *
     * @method onMouseOut
     * @param event {Event} The DOM event of a mouse being moved out
     * @private
     */
    PIXI.InteractionManager.prototype.onMouseOut = function(event) {
        if (this.dirty) {
            this.rebuildInteractiveGraph();
        }

        this.mouse.originalEvent = event;

        var length = this.interactiveItems.length;

        this.interactionDOMElement.style.cursor = 'inherit';

        for (var i = 0; i < length; i++) {
            var item = this.interactiveItems[i];
            if (item.__isOver) {
                this.mouse.target = item;
                if (item.mouseout) {
                    item.mouseout(this.mouse);
                }
                item.__isOver = false;
            }
        }

        this.mouseOut = true;

        // move the mouse to an impossible position
        this.mouse.global.x = -10000;
        this.mouse.global.y = -10000;
    };

    /**
     * Is called when the mouse button is released on the renderer element
     *
     * @method onMouseUp
     * @param event {Event} The DOM event of a mouse button being released
     * @private
     */
    PIXI.InteractionManager.prototype.onMouseUp = function(event) {
        if (this.dirty) {
            this.rebuildInteractiveGraph();
        }

        this.mouse.originalEvent = event;

        var length = this.interactiveItems.length;
        var up = false;

        var e = this.mouse.originalEvent;
        var isRightButton = e.button === 2 || e.which === 3;

        var upFunction = isRightButton ? 'rightup' : 'mouseup';
        var clickFunction = isRightButton ? 'rightclick' : 'click';
        var upOutsideFunction = isRightButton ? 'rightupoutside' : 'mouseupoutside';
        var isDown = isRightButton ? '__isRightDown' : '__isDown';

        for (var i = 0; i < length; i++) {
            var item = this.interactiveItems[i];

            if (item[clickFunction] || item[upFunction] || item[upOutsideFunction]) {
                item.__hit = this.hitTest(item, this.mouse);

                if (item.__hit && !up) {
                    //call the function!
                    if (item[upFunction]) {
                        item[upFunction](this.mouse);
                    }
                    if (item[isDown]) {
                        if (item[clickFunction]) {
                            item[clickFunction](this.mouse);
                        }
                    }

                    if (!item.interactiveChildren) {
                        up = true;
                    }
                } else {
                    if (item[isDown]) {
                        if (item[upOutsideFunction]) item[upOutsideFunction](this.mouse);
                    }
                }

                item[isDown] = false;
            }
        }
    };

    /**
     * Tests if the current mouse coordinates hit a sprite
     *
     * @method hitTest
     * @param item {DisplayObject} The displayObject to test for a hit
     * @param interactionData {InteractionData} The interactionData object to update in the case there is a hit
     * @private
     */
    PIXI.InteractionManager.prototype.hitTest = function(item, interactionData) {
        var global = interactionData.global;

        if (!item.worldVisible) {
            return false;
        }

        // temp fix for if the element is in a non visible

        var worldTransform = item.worldTransform,
            i,
            a = worldTransform.a,
            b = worldTransform.b,
            c = worldTransform.c,
            tx = worldTransform.tx,
            d = worldTransform.d,
            ty = worldTransform.ty,

            id = 1 / (a * d + c * -b),
            x = d * id * global.x + -c * id * global.y + (ty * c - tx * d) * id,
            y = a * id * global.y + -b * id * global.x + (-ty * a + tx * b) * id;


        interactionData.target = item;

        //a sprite or display object with a hit area defined
        if (item.hitArea && item.hitArea.contains) {
            if (item.hitArea.contains(x, y)) {
                interactionData.target = item;
                return true;
            }
            return false;
        }
        // a sprite with no hitarea defined
        else if (item instanceof PIXI.Sprite) {
            var width = item.texture.frame.width;
            var height = item.texture.frame.height;
            var x1 = -width * item.anchor.x;
            var y1;

            if (x > x1 && x < x1 + width) {
                y1 = -height * item.anchor.y;

                if (y > y1 && y < y1 + height) {
                    // set the target property if a hit is true!
                    interactionData.target = item;
                    return true;
                }
            }
        } else if (item instanceof PIXI.Graphics) {
            var graphicsData = item.graphicsData;
            for (i = 0; i < graphicsData.length; i++) {
                var data = graphicsData[i];
                if (!data.fill) continue;

                // only deal with fills..
                if (data.shape) {
                    if (data.shape.contains(x, y)) {
                        interactionData.target = item;
                        return true;
                    }
                }
            }
        }

        var length = item.children.length;

        for (i = 0; i < length; i++) {
            var tempItem = item.children[i];
            var hit = this.hitTest(tempItem, interactionData);
            if (hit) {
                // hmm.. TODO SET CORRECT TARGET?
                interactionData.target = item;
                return true;
            }
        }
        return false;
    };

    /**
     * Is called when a touch is moved across the renderer element
     *
     * @method onTouchMove
     * @param event {Event} The DOM event of a touch moving across the renderer view
     * @private
     */
    PIXI.InteractionManager.prototype.onTouchMove = function(event) {
        if (this.dirty) {
            this.rebuildInteractiveGraph();
        }

        var rect = this.interactionDOMElement.getBoundingClientRect();
        var changedTouches = event.changedTouches;
        var touchData;
        var i = 0;

        for (i = 0; i < changedTouches.length; i++) {
            var touchEvent = changedTouches[i];
            touchData = this.touches[touchEvent.identifier];
            touchData.originalEvent = event;

            // update the touch position
            touchData.global.x = ((touchEvent.clientX - rect.left) * (this.target.width / rect.width)) / this.resolution;
            touchData.global.y = ((touchEvent.clientY - rect.top) * (this.target.height / rect.height)) / this.resolution;
            if (navigator.isCocoonJS && !rect.left && !rect.top && !event.target.style.width && !event.target.style.height) {
                //Support for CocoonJS fullscreen scale modes
                touchData.global.x = touchEvent.clientX;
                touchData.global.y = touchEvent.clientY;
            }

            for (var j = 0; j < this.interactiveItems.length; j++) {
                var item = this.interactiveItems[j];
                if (item.touchmove && item.__touchData && item.__touchData[touchEvent.identifier]) {
                    item.touchmove(touchData);
                }
            }
        }
    };

    /**
     * Is called when a touch is started on the renderer element
     *
     * @method onTouchStart
     * @param event {Event} The DOM event of a touch starting on the renderer view
     * @private
     */
    PIXI.InteractionManager.prototype.onTouchStart = function(event) {
        if (this.dirty) {
            this.rebuildInteractiveGraph();
        }

        var rect = this.interactionDOMElement.getBoundingClientRect();

        if (PIXI.AUTO_PREVENT_DEFAULT) {
            event.preventDefault();
        }

        var changedTouches = event.changedTouches;
        for (var i = 0; i < changedTouches.length; i++) {
            var touchEvent = changedTouches[i];

            var touchData = this.pool.pop();
            if (!touchData) {
                touchData = new PIXI.InteractionData();
            }

            touchData.originalEvent = event;

            this.touches[touchEvent.identifier] = touchData;
            touchData.global.x = ((touchEvent.clientX - rect.left) * (this.target.width / rect.width)) / this.resolution;
            touchData.global.y = ((touchEvent.clientY - rect.top) * (this.target.height / rect.height)) / this.resolution;
            if (navigator.isCocoonJS && !rect.left && !rect.top && !event.target.style.width && !event.target.style.height) {
                //Support for CocoonJS fullscreen scale modes
                touchData.global.x = touchEvent.clientX;
                touchData.global.y = touchEvent.clientY;
            }

            var length = this.interactiveItems.length;

            for (var j = 0; j < length; j++) {
                var item = this.interactiveItems[j];

                if (item.touchstart || item.tap) {
                    item.__hit = this.hitTest(item, touchData);

                    if (item.__hit) {
                        //call the function!
                        if (item.touchstart) item.touchstart(touchData);
                        item.__isDown = true;
                        item.__touchData = item.__touchData || {};
                        item.__touchData[touchEvent.identifier] = touchData;

                        if (!item.interactiveChildren) break;
                    }
                }
            }
        }
    };

    /**
     * Is called when a touch is ended on the renderer element
     *
     * @method onTouchEnd
     * @param event {Event} The DOM event of a touch ending on the renderer view
     * @private
     */
    PIXI.InteractionManager.prototype.onTouchEnd = function(event) {
        if (this.dirty) {
            this.rebuildInteractiveGraph();
        }

        var rect = this.interactionDOMElement.getBoundingClientRect();
        var changedTouches = event.changedTouches;

        for (var i = 0; i < changedTouches.length; i++) {
            var touchEvent = changedTouches[i];
            var touchData = this.touches[touchEvent.identifier];
            var up = false;
            touchData.global.x = ((touchEvent.clientX - rect.left) * (this.target.width / rect.width)) / this.resolution;
            touchData.global.y = ((touchEvent.clientY - rect.top) * (this.target.height / rect.height)) / this.resolution;
            if (navigator.isCocoonJS && !rect.left && !rect.top && !event.target.style.width && !event.target.style.height) {
                //Support for CocoonJS fullscreen scale modes
                touchData.global.x = touchEvent.clientX;
                touchData.global.y = touchEvent.clientY;
            }

            var length = this.interactiveItems.length;
            for (var j = 0; j < length; j++) {
                var item = this.interactiveItems[j];

                if (item.__touchData && item.__touchData[touchEvent.identifier]) {

                    item.__hit = this.hitTest(item, item.__touchData[touchEvent.identifier]);

                    // so this one WAS down...
                    touchData.originalEvent = event;
                    // hitTest??

                    if (item.touchend || item.tap) {
                        if (item.__hit && !up) {
                            if (item.touchend) {
                                item.touchend(touchData);
                            }
                            if (item.__isDown && item.tap) {
                                item.tap(touchData);
                            }
                            if (!item.interactiveChildren) {
                                up = true;
                            }
                        } else {
                            if (item.__isDown && item.touchendoutside) {
                                item.touchendoutside(touchData);
                            }
                        }

                        item.__isDown = false;
                    }

                    item.__touchData[touchEvent.identifier] = null;
                }
            }
            // remove the touch..
            this.pool.push(touchData);
            this.touches[touchEvent.identifier] = null;
        }
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * A Stage represents the root of the display tree. Everything connected to the stage is rendered
     *
     * @class Stage
     * @extends DisplayObjectContainer
     * @constructor
     * @param backgroundColor {Number} the background color of the stage, you have to pass this in is in hex format
     *      like: 0xFFFFFF for white
     * 
     * Creating a stage is a mandatory process when you use Pixi, which is as simple as this : 
     * var stage = new PIXI.Stage(0xFFFFFF);
     * where the parameter given is the background colour of the stage, in hex
     * you will use this stage instance to add your sprites to it and therefore to the renderer
     * Here is how to add a sprite to the stage : 
     * stage.addChild(sprite);
     */
    PIXI.Stage = function(backgroundColor) {
        PIXI.DisplayObjectContainer.call(this);

        /**
         * [read-only] Current transform of the object based on world (parent) factors
         *
         * @property worldTransform
         * @type Matrix
         * @readOnly
         * @private
         */
        this.worldTransform = new PIXI.Matrix();

        /**
         * Whether or not the stage is interactive
         *
         * @property interactive
         * @type Boolean
         */
        this.interactive = true;

        /**
         * The interaction manage for this stage, manages all interactive activity on the stage
         *
         * @property interactionManager
         * @type InteractionManager
         */
        this.interactionManager = new PIXI.InteractionManager(this);

        /**
         * Whether the stage is dirty and needs to have interactions updated
         *
         * @property dirty
         * @type Boolean
         * @private
         */
        this.dirty = true;

        //the stage is its own stage
        this.stage = this;

        //optimize hit detection a bit
        this.stage.hitArea = new PIXI.Rectangle(0, 0, 100000, 100000);

        this.setBackgroundColor(backgroundColor);
    };

    // constructor
    PIXI.Stage.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
    PIXI.Stage.prototype.constructor = PIXI.Stage;

    /**
     * Sets another DOM element which can receive mouse/touch interactions instead of the default Canvas element.
     * This is useful for when you have other DOM elements on top of the Canvas element.
     *
     * @method setInteractionDelegate
     * @param domElement {DOMElement} This new domElement which will receive mouse/touch events
     */
    PIXI.Stage.prototype.setInteractionDelegate = function(domElement) {
        this.interactionManager.setTargetDomElement(domElement);
    };

    /*
     * Updates the object transform for rendering
     *
     * @method updateTransform
     * @private
     */
    PIXI.Stage.prototype.updateTransform = function() {
        this.worldAlpha = 1;

        for (var i = 0, j = this.children.length; i < j; i++) {
            this.children[i].updateTransform();
        }

        if (this.dirty) {
            this.dirty = false;
            // update interactive!
            this.interactionManager.dirty = true;
        }

        if (this.interactive) this.interactionManager.update();
    };

    /**
     * Sets the background color for the stage
     *
     * @method setBackgroundColor
     * @param backgroundColor {Number} the color of the background, easiest way to pass this in is in hex format
     *      like: 0xFFFFFF for white
     */
    PIXI.Stage.prototype.setBackgroundColor = function(backgroundColor) {
        this.backgroundColor = backgroundColor || 0x000000;
        this.backgroundColorSplit = PIXI.hex2rgb(this.backgroundColor);
        var hex = this.backgroundColor.toString(16);
        hex = '000000'.substr(0, 6 - hex.length) + hex;
        this.backgroundColorString = '#' + hex;
    };

    /**
     * This will return the point containing global coordinates of the mouse.
     *
     * @method getMousePosition
     * @return {Point} A point containing the coordinates of the global InteractionData position.
     */
    PIXI.Stage.prototype.getMousePosition = function() {
        return this.interactionManager.mouse.global;
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    // http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

    // requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel

    // MIT license

    /**
     * A polyfill for requestAnimationFrame
     * You can actually use both requestAnimationFrame and requestAnimFrame, 
     * you will still benefit from the polyfill
     *
     * @method requestAnimationFrame
     */

    /**
     * A polyfill for cancelAnimationFrame
     *
     * @method cancelAnimationFrame
     */
    (function(window) {
        var lastTime = 0;
        var vendors = ['ms', 'moz', 'webkit', 'o'];
        for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
            window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
            window.cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame'] ||
                window[vendors[x] + 'CancelRequestAnimationFrame'];
        }

        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = function(callback) {
                var currTime = new Date().getTime();
                var timeToCall = Math.max(0, 16 - (currTime - lastTime));
                var id = window.setTimeout(function() { callback(currTime + timeToCall); },
                    timeToCall);
                lastTime = currTime + timeToCall;
                return id;
            };
        }

        if (!window.cancelAnimationFrame) {
            window.cancelAnimationFrame = function(id) {
                clearTimeout(id);
            };
        }

        window.requestAnimFrame = window.requestAnimationFrame;
    })(this);

    /**
     * Converts a hex color number to an [R, G, B] array
     *
     * @method hex2rgb
     * @param hex {Number}
     */
    PIXI.hex2rgb = function(hex) {
        return [(hex >> 16 & 0xFF) / 255, (hex >> 8 & 0xFF) / 255, (hex & 0xFF) / 255];
    };

    /**
     * Converts a color as an [R, G, B] array to a hex number
     *
     * @method rgb2hex
     * @param rgb {Array}
     */
    PIXI.rgb2hex = function(rgb) {
        return ((rgb[0] * 255 << 16) + (rgb[1] * 255 << 8) + rgb[2] * 255);
    };

    /**
     * A polyfill for Function.prototype.bind
     *
     * @method bind
     */
    if (typeof Function.prototype.bind !== 'function') {
        Function.prototype.bind = (function() {
            return function(thisArg) {
                var target = this,
                    i = arguments.length - 1,
                    boundArgs = [];
                if (i > 0) {
                    boundArgs.length = i;
                    while (i--) boundArgs[i] = arguments[i + 1];
                }

                if (typeof target !== 'function') throw new TypeError();

                function bound() {
                    var i = arguments.length,
                        args = new Array(i);
                    while (i--) args[i] = arguments[i];
                    args = boundArgs.concat(args);
                    return target.apply(this instanceof bound ? this : thisArg, args);
                }

                bound.prototype = (function F(proto) {
                    if (proto) F.prototype = proto;
                    if (!(this instanceof F)) return new F();
                })(target.prototype);

                return bound;
            };
        })();
    }

    /**
     * A wrapper for ajax requests to be handled cross browser
     *
     * @class AjaxRequest
     * @constructor
     */
    PIXI.AjaxRequest = function() {
        var activexmodes = ['Msxml2.XMLHTTP.6.0', 'Msxml2.XMLHTTP.3.0', 'Microsoft.XMLHTTP']; //activeX versions to check for in IE

        if (window.ActiveXObject) { //Test for support for ActiveXObject in IE first (as XMLHttpRequest in IE7 is broken)
            for (var i = 0; i < activexmodes.length; i++) {
                try {
                    return new window.ActiveXObject(activexmodes[i]);
                } catch (e) {
                    //suppress error
                }
            }
        } else if (window.XMLHttpRequest) // if Mozilla, Safari etc
        {
            return new window.XMLHttpRequest();
        } else {
            return false;
        }
    };
    /*
    PIXI.packColorRGBA = function(r, g, b, a)//r, g, b, a)
    {
      //  console.log(r, b, c, d)
      return (Math.floor((r)*63) << 18) | (Math.floor((g)*63) << 12) | (Math.floor((b)*63) << 6);// | (Math.floor((a)*63))
      //  i = i | (Math.floor((a)*63));
       // return i;
       // var r = (i / 262144.0 ) / 64;
       // var g = (i / 4096.0)%64 / 64;
      //  var b = (i / 64.0)%64 / 64;
      //  var a = (i)%64 / 64;
         
      //  console.log(r, g, b, a);
      //  return i;

    };
    */
    /*
    PIXI.packColorRGB = function(r, g, b)//r, g, b, a)
    {
        return (Math.floor((r)*255) << 16) | (Math.floor((g)*255) << 8) | (Math.floor((b)*255));
    };

    PIXI.unpackColorRGB = function(r, g, b)//r, g, b, a)
    {
        return (Math.floor((r)*255) << 16) | (Math.floor((g)*255) << 8) | (Math.floor((b)*255));
    };
    */

    /**
     * Checks whether the Canvas BlendModes are supported by the current browser
     *
     * @method canUseNewCanvasBlendModes
     * @return {Boolean} whether they are supported
     */
    PIXI.canUseNewCanvasBlendModes = function() {
        if (typeof document === 'undefined') return false;
        var canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        var context = canvas.getContext('2d');
        context.fillStyle = '#000';
        context.fillRect(0, 0, 1, 1);
        context.globalCompositeOperation = 'multiply';
        context.fillStyle = '#fff';
        context.fillRect(0, 0, 1, 1);
        return context.getImageData(0, 0, 1, 1).data[0] === 0;
    };

    /**
     * Given a number, this function returns the closest number that is a power of two
     * this function is taken from Starling Framework as its pretty neat ;)
     *
     * @method getNextPowerOfTwo
     * @param number {Number}
     * @return {Number} the closest number that is a power of two
     */
    PIXI.getNextPowerOfTwo = function(number) {
        if (number > 0 && (number & (number - 1)) === 0) // see: http://goo.gl/D9kPj
            return number;
        else {
            var result = 1;
            while (result < number) result <<= 1;
            return result;
        }
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     * @author Chad Engler https://github.com/englercj @Rolnaaba
     */

    /**
     * Originally based on https://github.com/mrdoob/eventtarget.js/ from mr Doob.
     * Currently takes inspiration from the nodejs EventEmitter, EventEmitter3, and smokesignals
     */

    /**
     * Mixins event emitter functionality to a class
     *
     * @class EventTarget
     * @example
     *      function MyEmitter() {}
     *
     *      PIXI.EventTarget.mixin(MyEmitter.prototype);
     *
     *      var em = new MyEmitter();
     *      em.emit('eventName', 'some data', 'some more data', {}, null, ...);
     */
    PIXI.EventTarget = {
        /**
         * Backward compat from when this used to be a function
         */
        call: function callCompat(obj) {
            if (obj) {
                obj = obj.prototype || obj;
                PIXI.EventTarget.mixin(obj);
            }
        },

        /**
         * Mixes in the properties of the EventTarget prototype onto another object
         *
         * @method mixin
         * @param object {Object} The obj to mix into
         */
        mixin: function mixin(obj) {
            /**
             * Return a list of assigned event listeners.
             *
             * @method listeners
             * @param eventName {String} The events that should be listed.
             * @returns {Array} An array of listener functions
             */
            obj.listeners = function listeners(eventName) {
                this._listeners = this._listeners || {};

                return this._listeners[eventName] ? this._listeners[eventName].slice() : [];
            };

            /**
             * Emit an event to all registered event listeners.
             *
             * @method emit
             * @alias dispatchEvent
             * @param eventName {String} The name of the event.
             * @returns {Boolean} Indication if we've emitted an event.
             */
            obj.emit = obj.dispatchEvent = function emit(eventName, data) {
                this._listeners = this._listeners || {};

                //backwards compat with old method ".emit({ type: 'something' })"
                if (typeof eventName === 'object') {
                    data = eventName;
                    eventName = eventName.type;
                }

                //ensure we are using a real pixi event
                if (!data || data.__isEventObject !== true) {
                    data = new PIXI.Event(this, eventName, data);
                }

                //iterate the listeners
                if (this._listeners && this._listeners[eventName]) {
                    var listeners = this._listeners[eventName],
                        length = listeners.length,
                        fn = listeners[0],
                        i;

                    for (i = 0; i < length; fn = listeners[++i]) {
                        //call the event listener
                        fn.call(this, data);

                        //if "stopImmediatePropagation" is called, stop calling sibling events
                        if (data.stoppedImmediate) {
                            return this;
                        }
                    }

                    //if "stopPropagation" is called then don't bubble the event
                    if (data.stopped) {
                        return this;
                    }
                }

                //bubble this event up the scene graph
                if (this.parent && this.parent.emit) {
                    this.parent.emit.call(this.parent, eventName, data);
                }

                return this;
            };

            /**
             * Register a new EventListener for the given event.
             *
             * @method on
             * @alias addEventListener
             * @param eventName {String} Name of the event.
             * @param callback {Functon} fn Callback function.
             */
            obj.on = obj.addEventListener = function on(eventName, fn) {
                this._listeners = this._listeners || {};

                (this._listeners[eventName] = this._listeners[eventName] || [])
                .push(fn);

                return this;
            };

            /**
             * Add an EventListener that's only called once.
             *
             * @method once
             * @param eventName {String} Name of the event.
             * @param callback {Function} Callback function.
             */
            obj.once = function once(eventName, fn) {
                this._listeners = this._listeners || {};

                var self = this;

                function onceHandlerWrapper() {
                    fn.apply(self.off(eventName, onceHandlerWrapper), arguments);
                }
                onceHandlerWrapper._originalHandler = fn;

                return this.on(eventName, onceHandlerWrapper);
            };

            /**
             * Remove event listeners.
             *
             * @method off
             * @alias removeEventListener
             * @param eventName {String} The event we want to remove.
             * @param callback {Function} The listener that we need to find.
             */
            obj.off = obj.removeEventListener = function off(eventName, fn) {
                this._listeners = this._listeners || {};

                if (!this._listeners[eventName])
                    return this;

                var list = this._listeners[eventName],
                    i = fn ? list.length : 0;

                while (i-- > 0) {
                    if (list[i] === fn || list[i]._originalHandler === fn) {
                        list.splice(i, 1);
                    }
                }

                if (list.length === 0) {
                    delete this._listeners[eventName];
                }

                return this;
            };

            /**
             * Remove all listeners or only the listeners for the specified event.
             *
             * @method removeAllListeners
             * @param eventName {String} The event you want to remove all listeners for.
             */
            obj.removeAllListeners = function removeAllListeners(eventName) {
                this._listeners = this._listeners || {};

                if (!this._listeners[eventName])
                    return this;

                delete this._listeners[eventName];

                return this;
            };
        }
    };

    /**
     * Creates an homogenous object for tracking events so users can know what to expect.
     *
     * @class Event
     * @extends Object
     * @constructor
     * @param target {Object} The target object that the event is called on
     * @param name {String} The string name of the event that was triggered
     * @param data {Object} Arbitrary event data to pass along
     */
    PIXI.Event = function(target, name, data) {
        //for duck typing in the ".on()" function
        this.__isEventObject = true;

        /**
         * Tracks the state of bubbling propagation. Do not
         * set this directly, instead use `event.stopPropagation()`
         *
         * @property stopped
         * @type Boolean
         * @private
         * @readOnly
         */
        this.stopped = false;

        /**
         * Tracks the state of sibling listener propagation. Do not
         * set this directly, instead use `event.stopImmediatePropagation()`
         *
         * @property stoppedImmediate
         * @type Boolean
         * @private
         * @readOnly
         */
        this.stoppedImmediate = false;

        /**
         * The original target the event triggered on.
         *
         * @property target
         * @type Object
         * @readOnly
         */
        this.target = target;

        /**
         * The string name of the event that this represents.
         *
         * @property type
         * @type String
         * @readOnly
         */
        this.type = name;

        /**
         * The data that was passed in with this event.
         *
         * @property data
         * @type Object
         * @readOnly
         */
        this.data = data;

        //backwards compat with older version of events
        this.content = data;

        /**
         * The timestamp when the event occurred.
         *
         * @property timeStamp
         * @type Number
         * @readOnly
         */
        this.timeStamp = Date.now();
    };

    /**
     * Stops the propagation of events up the scene graph (prevents bubbling).
     *
     * @method stopPropagation
     */
    PIXI.Event.prototype.stopPropagation = function stopPropagation() {
        this.stopped = true;
    };

    /**
     * Stops the propagation of events to sibling listeners (no longer calls any listeners).
     *
     * @method stopImmediatePropagation
     */
    PIXI.Event.prototype.stopImmediatePropagation = function stopImmediatePropagation() {
        this.stoppedImmediate = true;
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * This helper function will automatically detect which renderer you should be using.
     * WebGL is the preferred renderer as it is a lot faster. If webGL is not supported by
     * the browser then this function will return a canvas renderer
     * @class autoDetectRenderer
     * @static
     * @param width=800 {Number} the width of the renderers view
     * @param height=600 {Number} the height of the renderers view
     * 
     * @param [options] {Object} The optional renderer parameters
     * @param [options.view] {HTMLCanvasElement} the canvas to use as a view, optional
     * @param [options.transparent=false] {Boolean} If the render view is transparent, default false
     * @param [options.antialias=false] {Boolean} sets antialias (only applicable in chrome at the moment)
     * @param [options.preserveDrawingBuffer=false] {Boolean} enables drawing buffer preservation, enable this if you need to call toDataUrl on the webgl context
     * @param [options.resolution=1] {Number} the resolution of the renderer retina would be 2
     * 
     */
    PIXI.autoDetectRenderer = function(width, height, options) {
        if (!width) width = 800;
        if (!height) height = 600;

        // BORROWED from Mr Doob (mrdoob.com)
        var webgl = (function() {
            try {
                var canvas = document.createElement('canvas');
                return !!window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
            } catch (e) {
                return false;
            }
        })();

        if (webgl) {
            return new PIXI.WebGLRenderer(width, height, options);
        }

        return new PIXI.CanvasRenderer(width, height, options);
    };

    /**
     * This helper function will automatically detect which renderer you should be using.
     * This function is very similar to the autoDetectRenderer function except that is will return a canvas renderer for android.
     * Even thought both android chrome supports webGL the canvas implementation perform better at the time of writing. 
     * This function will likely change and update as webGL performance improves on these devices.
     * 
     * @class autoDetectRecommendedRenderer
     * @static
     * @param width=800 {Number} the width of the renderers view
     * @param height=600 {Number} the height of the renderers view
     * 
     * @param [options] {Object} The optional renderer parameters
     * @param [options.view] {HTMLCanvasElement} the canvas to use as a view, optional
     * @param [options.transparent=false] {Boolean} If the render view is transparent, default false
     * @param [options.antialias=false] {Boolean} sets antialias (only applicable in chrome at the moment)
     * @param [options.preserveDrawingBuffer=false] {Boolean} enables drawing buffer preservation, enable this if you need to call toDataUrl on the webgl context
     * @param [options.resolution=1] {Number} the resolution of the renderer retina would be 2
     * 
     */
    PIXI.autoDetectRecommendedRenderer = function(width, height, options) {
        if (!width) width = 800;
        if (!height) height = 600;

        // BORROWED from Mr Doob (mrdoob.com)
        var webgl = (function() {
            try {
                var canvas = document.createElement('canvas');
                return !!window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
            } catch (e) {
                return false;
            }
        })();

        var isAndroid = /Android/i.test(navigator.userAgent);

        if (webgl && !isAndroid) {
            return new PIXI.WebGLRenderer(width, height, options);
        }

        return new PIXI.CanvasRenderer(width, height, options);
    };

    /*
        PolyK library
        url: http://polyk.ivank.net
        Released under MIT licence.

        Copyright (c) 2012 Ivan Kuckir

        Permission is hereby granted, free of charge, to any person
        obtaining a copy of this software and associated documentation
        files (the "Software"), to deal in the Software without
        restriction, including without limitation the rights to use,
        copy, modify, merge, publish, distribute, sublicense, and/or sell
        copies of the Software, and to permit persons to whom the
        Software is furnished to do so, subject to the following
        conditions:

        The above copyright notice and this permission notice shall be
        included in all copies or substantial portions of the Software.

        THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
        EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
        OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
        NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
        HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
        WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
        FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
        OTHER DEALINGS IN THE SOFTWARE.

        This is an amazing lib!

        Slightly modified by Mat Groves (matgroves.com);
    */

    /**
     * Based on the Polyk library http://polyk.ivank.net released under MIT licence.
     * This is an amazing lib!
     * Slightly modified by Mat Groves (matgroves.com);
     * @class PolyK
     */
    PIXI.PolyK = {};

    /**
     * Triangulates shapes for webGL graphic fills.
     *
     * @method Triangulate
     */
    PIXI.PolyK.Triangulate = function(p) {
        var sign = true;

        var n = p.length >> 1;
        if (n < 3) return [];

        var tgs = [];
        var avl = [];
        for (var i = 0; i < n; i++) avl.push(i);

        i = 0;
        var al = n;
        while (al > 3) {
            var i0 = avl[(i + 0) % al];
            var i1 = avl[(i + 1) % al];
            var i2 = avl[(i + 2) % al];

            var ax = p[2 * i0],
                ay = p[2 * i0 + 1];
            var bx = p[2 * i1],
                by = p[2 * i1 + 1];
            var cx = p[2 * i2],
                cy = p[2 * i2 + 1];

            var earFound = false;
            if (PIXI.PolyK._convex(ax, ay, bx, by, cx, cy, sign)) {
                earFound = true;
                for (var j = 0; j < al; j++) {
                    var vi = avl[j];
                    if (vi === i0 || vi === i1 || vi === i2) continue;

                    if (PIXI.PolyK._PointInTriangle(p[2 * vi], p[2 * vi + 1], ax, ay, bx, by, cx, cy)) {
                        earFound = false;
                        break;
                    }
                }
            }

            if (earFound) {
                tgs.push(i0, i1, i2);
                avl.splice((i + 1) % al, 1);
                al--;
                i = 0;
            } else if (i++ > 3 * al) {
                // need to flip flip reverse it!
                // reset!
                if (sign) {
                    tgs = [];
                    avl = [];
                    for (i = 0; i < n; i++) avl.push(i);

                    i = 0;
                    al = n;

                    sign = false;
                } else {
                    window.console.log("PIXI Warning: shape too complex to fill");
                    return [];
                }
            }
        }

        tgs.push(avl[0], avl[1], avl[2]);
        return tgs;
    };

    /**
     * Checks whether a point is within a triangle
     *
     * @method _PointInTriangle
     * @param px {Number} x coordinate of the point to test
     * @param py {Number} y coordinate of the point to test
     * @param ax {Number} x coordinate of the a point of the triangle
     * @param ay {Number} y coordinate of the a point of the triangle
     * @param bx {Number} x coordinate of the b point of the triangle
     * @param by {Number} y coordinate of the b point of the triangle
     * @param cx {Number} x coordinate of the c point of the triangle
     * @param cy {Number} y coordinate of the c point of the triangle
     * @private
     * @return {Boolean}
     */
    PIXI.PolyK._PointInTriangle = function(px, py, ax, ay, bx, by, cx, cy) {
        var v0x = cx - ax;
        var v0y = cy - ay;
        var v1x = bx - ax;
        var v1y = by - ay;
        var v2x = px - ax;
        var v2y = py - ay;

        var dot00 = v0x * v0x + v0y * v0y;
        var dot01 = v0x * v1x + v0y * v1y;
        var dot02 = v0x * v2x + v0y * v2y;
        var dot11 = v1x * v1x + v1y * v1y;
        var dot12 = v1x * v2x + v1y * v2y;

        var invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
        var u = (dot11 * dot02 - dot01 * dot12) * invDenom;
        var v = (dot00 * dot12 - dot01 * dot02) * invDenom;

        // Check if point is in triangle
        return (u >= 0) && (v >= 0) && (u + v < 1);
    };

    /**
     * Checks whether a shape is convex
     *
     * @method _convex
     * @private
     * @return {Boolean}
     */
    PIXI.PolyK._convex = function(ax, ay, bx, by, cx, cy, sign) {
        return ((ay - by) * (cx - bx) + (bx - ax) * (cy - by) >= 0) === sign;
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * @method initDefaultShaders
     * @static
     * @private
     */
    PIXI.initDefaultShaders = function() {};

    /**
     * @method CompileVertexShader
     * @static
     * @param gl {WebGLContext} the current WebGL drawing context
     * @param shaderSrc {Array}
     * @return {Any}
     */
    PIXI.CompileVertexShader = function(gl, shaderSrc) {
        return PIXI._CompileShader(gl, shaderSrc, gl.VERTEX_SHADER);
    };

    /**
     * @method CompileFragmentShader
     * @static
     * @param gl {WebGLContext} the current WebGL drawing context
     * @param shaderSrc {Array}
     * @return {Any}
     */
    PIXI.CompileFragmentShader = function(gl, shaderSrc) {
        return PIXI._CompileShader(gl, shaderSrc, gl.FRAGMENT_SHADER);
    };

    /**
     * @method _CompileShader
     * @static
     * @private
     * @param gl {WebGLContext} the current WebGL drawing context
     * @param shaderSrc {Array}
     * @param shaderType {Number}
     * @return {Any}
     */
    PIXI._CompileShader = function(gl, shaderSrc, shaderType) {
        var src = shaderSrc.join("\n");
        var shader = gl.createShader(shaderType);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            window.console.log(gl.getShaderInfoLog(shader));
            return null;
        }

        return shader;
    };

    /**
     * @method compileProgram
     * @static
     * @param gl {WebGLContext} the current WebGL drawing context
     * @param vertexSrc {Array}
     * @param fragmentSrc {Array}
     * @return {Any}
     */
    PIXI.compileProgram = function(gl, vertexSrc, fragmentSrc) {
        var fragmentShader = PIXI.CompileFragmentShader(gl, fragmentSrc);
        var vertexShader = PIXI.CompileVertexShader(gl, vertexSrc);

        var shaderProgram = gl.createProgram();

        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            window.console.log("Could not initialise shaders");
        }

        return shaderProgram;
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     * @author Richard Davey http://www.photonstorm.com @photonstorm
     */

    /**
     * @class PixiShader
     * @constructor
     * @param gl {WebGLContext} the current WebGL drawing context
     */
    PIXI.PixiShader = function(gl) {
        /**
         * @property _UID
         * @type Number
         * @private
         */
        this._UID = PIXI._UID++;

        /**
         * @property gl
         * @type WebGLContext
         */
        this.gl = gl;

        /**
         * The WebGL program.
         * @property program
         * @type {Any}
         */
        this.program = null;

        /**
         * The fragment shader.
         * @property fragmentSrc
         * @type Array
         */
        this.fragmentSrc = [
            'precision lowp float;',
            'varying vec2 vTextureCoord;',
            'varying vec4 vColor;',
            'uniform sampler2D uSampler;',
            'void main(void) {',
            '   gl_FragColor = texture2D(uSampler, vTextureCoord) * vColor ;',
            '}'
        ];

        /**
         * A local texture counter for multi-texture shaders.
         * @property textureCount
         * @type Number
         */
        this.textureCount = 0;

        /**
         * A local flag
         * @property firstRun
         * @type Boolean
         * @private
         */
        this.firstRun = true;

        /**
         * A dirty flag
         * @property dirty
         * @type Boolean
         */
        this.dirty = true;

        /**
         * Uniform attributes cache.
         * @property attributes
         * @type Array
         * @private
         */
        this.attributes = [];

        this.init();
    };

    PIXI.PixiShader.prototype.constructor = PIXI.PixiShader;

    /**
     * Initialises the shader.
     * 
     * @method init
     */
    PIXI.PixiShader.prototype.init = function() {
        var gl = this.gl;

        var program = PIXI.compileProgram(gl, this.vertexSrc || PIXI.PixiShader.defaultVertexSrc, this.fragmentSrc);

        gl.useProgram(program);

        // get and store the uniforms for the shader
        this.uSampler = gl.getUniformLocation(program, 'uSampler');
        this.projectionVector = gl.getUniformLocation(program, 'projectionVector');
        this.offsetVector = gl.getUniformLocation(program, 'offsetVector');
        this.dimensions = gl.getUniformLocation(program, 'dimensions');

        // get and store the attributes
        this.aVertexPosition = gl.getAttribLocation(program, 'aVertexPosition');
        this.aTextureCoord = gl.getAttribLocation(program, 'aTextureCoord');
        this.colorAttribute = gl.getAttribLocation(program, 'aColor');

        // Begin worst hack eva //

        // WHY??? ONLY on my chrome pixel the line above returns -1 when using filters?
        // maybe its something to do with the current state of the gl context.
        // I'm convinced this is a bug in the chrome browser as there is NO reason why this should be returning -1 especially as it only manifests on my chrome pixel
        // If theres any webGL people that know why could happen please help :)
        if (this.colorAttribute === -1) {
            this.colorAttribute = 2;
        }

        this.attributes = [this.aVertexPosition, this.aTextureCoord, this.colorAttribute];

        // End worst hack eva //

        // add those custom shaders!
        for (var key in this.uniforms) {
            // get the uniform locations..
            this.uniforms[key].uniformLocation = gl.getUniformLocation(program, key);
        }

        this.initUniforms();

        this.program = program;
    };

    /**
     * Initialises the shader uniform values.
     * 
     * Uniforms are specified in the GLSL_ES Specification: http://www.khronos.org/registry/webgl/specs/latest/1.0/
     * http://www.khronos.org/registry/gles/specs/2.0/GLSL_ES_Specification_1.0.17.pdf
     *
     * @method initUniforms
     */
    PIXI.PixiShader.prototype.initUniforms = function() {
        this.textureCount = 1;
        var gl = this.gl;
        var uniform;

        for (var key in this.uniforms) {
            uniform = this.uniforms[key];

            var type = uniform.type;

            if (type === 'sampler2D') {
                uniform._init = false;

                if (uniform.value !== null) {
                    this.initSampler2D(uniform);
                }
            } else if (type === 'mat2' || type === 'mat3' || type === 'mat4') {
                //  These require special handling
                uniform.glMatrix = true;
                uniform.glValueLength = 1;

                if (type === 'mat2') {
                    uniform.glFunc = gl.uniformMatrix2fv;
                } else if (type === 'mat3') {
                    uniform.glFunc = gl.uniformMatrix3fv;
                } else if (type === 'mat4') {
                    uniform.glFunc = gl.uniformMatrix4fv;
                }
            } else {
                //  GL function reference
                uniform.glFunc = gl['uniform' + type];

                if (type === '2f' || type === '2i') {
                    uniform.glValueLength = 2;
                } else if (type === '3f' || type === '3i') {
                    uniform.glValueLength = 3;
                } else if (type === '4f' || type === '4i') {
                    uniform.glValueLength = 4;
                } else {
                    uniform.glValueLength = 1;
                }
            }
        }

    };

    /**
     * Initialises a Sampler2D uniform (which may only be available later on after initUniforms once the texture has loaded)
     *
     * @method initSampler2D
     */
    PIXI.PixiShader.prototype.initSampler2D = function(uniform) {
        if (!uniform.value || !uniform.value.baseTexture || !uniform.value.baseTexture.hasLoaded) {
            return;
        }

        var gl = this.gl;

        gl.activeTexture(gl['TEXTURE' + this.textureCount]);
        gl.bindTexture(gl.TEXTURE_2D, uniform.value.baseTexture._glTextures[gl.id]);

        //  Extended texture data
        if (uniform.textureData) {
            var data = uniform.textureData;

            // GLTexture = mag linear, min linear_mipmap_linear, wrap repeat + gl.generateMipmap(gl.TEXTURE_2D);
            // GLTextureLinear = mag/min linear, wrap clamp
            // GLTextureNearestRepeat = mag/min NEAREST, wrap repeat
            // GLTextureNearest = mag/min nearest, wrap clamp
            // AudioTexture = whatever + luminance + width 512, height 2, border 0
            // KeyTexture = whatever + luminance + width 256, height 2, border 0

            //  magFilter can be: gl.LINEAR, gl.LINEAR_MIPMAP_LINEAR or gl.NEAREST
            //  wrapS/T can be: gl.CLAMP_TO_EDGE or gl.REPEAT

            var magFilter = (data.magFilter) ? data.magFilter : gl.LINEAR;
            var minFilter = (data.minFilter) ? data.minFilter : gl.LINEAR;
            var wrapS = (data.wrapS) ? data.wrapS : gl.CLAMP_TO_EDGE;
            var wrapT = (data.wrapT) ? data.wrapT : gl.CLAMP_TO_EDGE;
            var format = (data.luminance) ? gl.LUMINANCE : gl.RGBA;

            if (data.repeat) {
                wrapS = gl.REPEAT;
                wrapT = gl.REPEAT;
            }

            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, !!data.flipY);

            if (data.width) {
                var width = (data.width) ? data.width : 512;
                var height = (data.height) ? data.height : 2;
                var border = (data.border) ? data.border : 0;

                // void texImage2D(GLenum target, GLint level, GLenum internalformat, GLsizei width, GLsizei height, GLint border, GLenum format, GLenum type, ArrayBufferView? pixels);
                gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, border, format, gl.UNSIGNED_BYTE, null);
            } else {
                //  void texImage2D(GLenum target, GLint level, GLenum internalformat, GLenum format, GLenum type, ImageData? pixels);
                gl.texImage2D(gl.TEXTURE_2D, 0, format, gl.RGBA, gl.UNSIGNED_BYTE, uniform.value.baseTexture.source);
            }

            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
        }

        gl.uniform1i(uniform.uniformLocation, this.textureCount);

        uniform._init = true;

        this.textureCount++;

    };

    /**
     * Updates the shader uniform values.
     *
     * @method syncUniforms
     */
    PIXI.PixiShader.prototype.syncUniforms = function() {
        this.textureCount = 1;
        var uniform;
        var gl = this.gl;

        //  This would probably be faster in an array and it would guarantee key order
        for (var key in this.uniforms) {
            uniform = this.uniforms[key];

            if (uniform.glValueLength === 1) {
                if (uniform.glMatrix === true) {
                    uniform.glFunc.call(gl, uniform.uniformLocation, uniform.transpose, uniform.value);
                } else {
                    uniform.glFunc.call(gl, uniform.uniformLocation, uniform.value);
                }
            } else if (uniform.glValueLength === 2) {
                uniform.glFunc.call(gl, uniform.uniformLocation, uniform.value.x, uniform.value.y);
            } else if (uniform.glValueLength === 3) {
                uniform.glFunc.call(gl, uniform.uniformLocation, uniform.value.x, uniform.value.y, uniform.value.z);
            } else if (uniform.glValueLength === 4) {
                uniform.glFunc.call(gl, uniform.uniformLocation, uniform.value.x, uniform.value.y, uniform.value.z, uniform.value.w);
            } else if (uniform.type === 'sampler2D') {
                if (uniform._init) {
                    gl.activeTexture(gl['TEXTURE' + this.textureCount]);

                    if (uniform.value.baseTexture._dirty[gl.id]) {
                        PIXI.defaultRenderer.updateTexture(uniform.value.baseTexture);
                    } else {
                        // bind the current texture
                        gl.bindTexture(gl.TEXTURE_2D, uniform.value.baseTexture._glTextures[gl.id]);
                    }

                    //   gl.bindTexture(gl.TEXTURE_2D, uniform.value.baseTexture._glTextures[gl.id] || PIXI.createWebGLTexture( uniform.value.baseTexture, gl));
                    gl.uniform1i(uniform.uniformLocation, this.textureCount);
                    this.textureCount++;
                } else {
                    this.initSampler2D(uniform);
                }
            }
        }

    };

    /**
     * Destroys the shader.
     * 
     * @method destroy
     */
    PIXI.PixiShader.prototype.destroy = function() {
        this.gl.deleteProgram(this.program);
        this.uniforms = null;
        this.gl = null;

        this.attributes = null;
    };

    /**
     * The Default Vertex shader source.
     * 
     * @property defaultVertexSrc
     * @type String
     */
    PIXI.PixiShader.defaultVertexSrc = [
        'attribute vec2 aVertexPosition;',
        'attribute vec2 aTextureCoord;',
        'attribute vec4 aColor;',

        'uniform vec2 projectionVector;',
        'uniform vec2 offsetVector;',

        'varying vec2 vTextureCoord;',
        'varying vec4 vColor;',

        'const vec2 center = vec2(-1.0, 1.0);',

        'void main(void) {',
        '   gl_Position = vec4( ((aVertexPosition + offsetVector) / projectionVector) + center , 0.0, 1.0);',
        '   vTextureCoord = aTextureCoord;',
        '   vec3 color = mod(vec3(aColor.y/65536.0, aColor.y/256.0, aColor.y), 256.0) / 256.0;',
        '   vColor = vec4(color * aColor.x, aColor.x);',
        '}'
    ];

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * @class PixiFastShader
     * @constructor
     * @param gl {WebGLContext} the current WebGL drawing context
     */
    PIXI.PixiFastShader = function(gl) {
        /**
         * @property _UID
         * @type Number
         * @private
         */
        this._UID = PIXI._UID++;

        /**
         * @property gl
         * @type WebGLContext
         */
        this.gl = gl;

        /**
         * The WebGL program.
         * @property program
         * @type {Any}
         */
        this.program = null;

        /**
         * The fragment shader.
         * @property fragmentSrc
         * @type Array
         */
        this.fragmentSrc = [
            'precision lowp float;',
            'varying vec2 vTextureCoord;',
            'varying float vColor;',
            'uniform sampler2D uSampler;',
            'void main(void) {',
            '   gl_FragColor = texture2D(uSampler, vTextureCoord) * vColor ;',
            '}'
        ];

        /**
         * The vertex shader.
         * @property vertexSrc
         * @type Array
         */
        this.vertexSrc = [
            'attribute vec2 aVertexPosition;',
            'attribute vec2 aPositionCoord;',
            'attribute vec2 aScale;',
            'attribute float aRotation;',
            'attribute vec2 aTextureCoord;',
            'attribute float aColor;',

            'uniform vec2 projectionVector;',
            'uniform vec2 offsetVector;',
            'uniform mat3 uMatrix;',

            'varying vec2 vTextureCoord;',
            'varying float vColor;',

            'const vec2 center = vec2(-1.0, 1.0);',

            'void main(void) {',
            '   vec2 v;',
            '   vec2 sv = aVertexPosition * aScale;',
            '   v.x = (sv.x) * cos(aRotation) - (sv.y) * sin(aRotation);',
            '   v.y = (sv.x) * sin(aRotation) + (sv.y) * cos(aRotation);',
            '   v = ( uMatrix * vec3(v + aPositionCoord , 1.0) ).xy ;',
            '   gl_Position = vec4( ( v / projectionVector) + center , 0.0, 1.0);',
            '   vTextureCoord = aTextureCoord;',
            //  '   vec3 color = mod(vec3(aColor.y/65536.0, aColor.y/256.0, aColor.y), 256.0) / 256.0;',
            '   vColor = aColor;',
            '}'
        ];

        /**
         * A local texture counter for multi-texture shaders.
         * @property textureCount
         * @type Number
         */
        this.textureCount = 0;

        this.init();
    };

    PIXI.PixiFastShader.prototype.constructor = PIXI.PixiFastShader;

    /**
     * Initialises the shader.
     * 
     * @method init
     */
    PIXI.PixiFastShader.prototype.init = function() {
        var gl = this.gl;

        var program = PIXI.compileProgram(gl, this.vertexSrc, this.fragmentSrc);

        gl.useProgram(program);

        // get and store the uniforms for the shader
        this.uSampler = gl.getUniformLocation(program, 'uSampler');

        this.projectionVector = gl.getUniformLocation(program, 'projectionVector');
        this.offsetVector = gl.getUniformLocation(program, 'offsetVector');
        this.dimensions = gl.getUniformLocation(program, 'dimensions');
        this.uMatrix = gl.getUniformLocation(program, 'uMatrix');

        // get and store the attributes
        this.aVertexPosition = gl.getAttribLocation(program, 'aVertexPosition');
        this.aPositionCoord = gl.getAttribLocation(program, 'aPositionCoord');

        this.aScale = gl.getAttribLocation(program, 'aScale');
        this.aRotation = gl.getAttribLocation(program, 'aRotation');

        this.aTextureCoord = gl.getAttribLocation(program, 'aTextureCoord');
        this.colorAttribute = gl.getAttribLocation(program, 'aColor');

        // Begin worst hack eva //

        // WHY??? ONLY on my chrome pixel the line above returns -1 when using filters?
        // maybe its somthing to do with the current state of the gl context.
        // Im convinced this is a bug in the chrome browser as there is NO reason why this should be returning -1 especially as it only manifests on my chrome pixel
        // If theres any webGL people that know why could happen please help :)
        if (this.colorAttribute === -1) {
            this.colorAttribute = 2;
        }

        this.attributes = [this.aVertexPosition, this.aPositionCoord, this.aScale, this.aRotation, this.aTextureCoord, this.colorAttribute];

        // End worst hack eva //

        this.program = program;
    };

    /**
     * Destroys the shader.
     * 
     * @method destroy
     */
    PIXI.PixiFastShader.prototype.destroy = function() {
        this.gl.deleteProgram(this.program);
        this.uniforms = null;
        this.gl = null;

        this.attributes = null;
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * @class StripShader
     * @constructor
     * @param gl {WebGLContext} the current WebGL drawing context
     */
    PIXI.StripShader = function(gl) {
        /**
         * @property _UID
         * @type Number
         * @private
         */
        this._UID = PIXI._UID++;

        /**
         * @property gl
         * @type WebGLContext
         */
        this.gl = gl;

        /**
         * The WebGL program.
         * @property program
         * @type {Any}
         */
        this.program = null;

        /**
         * The fragment shader.
         * @property fragmentSrc
         * @type Array
         */
        this.fragmentSrc = [
            'precision mediump float;',
            'varying vec2 vTextureCoord;',
            //   'varying float vColor;',
            'uniform float alpha;',
            'uniform sampler2D uSampler;',

            'void main(void) {',
            '   gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y));',
            //  '   gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);',//gl_FragColor * alpha;',
            '}'
        ];

        /**
         * The vertex shader.
         * @property vertexSrc
         * @type Array
         */
        this.vertexSrc = [
            'attribute vec2 aVertexPosition;',
            'attribute vec2 aTextureCoord;',
            'uniform mat3 translationMatrix;',
            'uniform vec2 projectionVector;',
            'uniform vec2 offsetVector;',
            //  'uniform float alpha;',
            // 'uniform vec3 tint;',
            'varying vec2 vTextureCoord;',
            //  'varying vec4 vColor;',

            'void main(void) {',
            '   vec3 v = translationMatrix * vec3(aVertexPosition , 1.0);',
            '   v -= offsetVector.xyx;',
            '   gl_Position = vec4( v.x / projectionVector.x -1.0, v.y / -projectionVector.y + 1.0 , 0.0, 1.0);',
            '   vTextureCoord = aTextureCoord;',
            // '   vColor = aColor * vec4(tint * alpha, alpha);',
            '}'
        ];

        this.init();
    };

    PIXI.StripShader.prototype.constructor = PIXI.StripShader;

    /**
     * Initialises the shader.
     * 
     * @method init
     */
    PIXI.StripShader.prototype.init = function() {
        var gl = this.gl;

        var program = PIXI.compileProgram(gl, this.vertexSrc, this.fragmentSrc);
        gl.useProgram(program);

        // get and store the uniforms for the shader
        this.uSampler = gl.getUniformLocation(program, 'uSampler');
        this.projectionVector = gl.getUniformLocation(program, 'projectionVector');
        this.offsetVector = gl.getUniformLocation(program, 'offsetVector');
        this.colorAttribute = gl.getAttribLocation(program, 'aColor');
        //this.dimensions = gl.getUniformLocation(this.program, 'dimensions');

        // get and store the attributes
        this.aVertexPosition = gl.getAttribLocation(program, 'aVertexPosition');
        this.aTextureCoord = gl.getAttribLocation(program, 'aTextureCoord');

        this.attributes = [this.aVertexPosition, this.aTextureCoord];

        this.translationMatrix = gl.getUniformLocation(program, 'translationMatrix');
        this.alpha = gl.getUniformLocation(program, 'alpha');

        this.program = program;
    };

    /**
     * Destroys the shader.
     * 
     * @method destroy
     */
    PIXI.StripShader.prototype.destroy = function() {
        this.gl.deleteProgram(this.program);
        this.uniforms = null;
        this.gl = null;

        this.attribute = null;
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * @class PrimitiveShader
     * @constructor
     * @param gl {WebGLContext} the current WebGL drawing context
     */
    PIXI.PrimitiveShader = function(gl) {
        /**
         * @property _UID
         * @type Number
         * @private
         */
        this._UID = PIXI._UID++;

        /**
         * @property gl
         * @type WebGLContext
         */
        this.gl = gl;

        /**
         * The WebGL program.
         * @property program
         * @type {Any}
         */
        this.program = null;

        /**
         * The fragment shader.
         * @property fragmentSrc
         * @type Array
         */
        this.fragmentSrc = [
            'precision mediump float;',
            'varying vec4 vColor;',

            'void main(void) {',
            '   gl_FragColor = vColor;',
            '}'
        ];

        /**
         * The vertex shader.
         * @property vertexSrc
         * @type Array
         */
        this.vertexSrc = [
            'attribute vec2 aVertexPosition;',
            'attribute vec4 aColor;',
            'uniform mat3 translationMatrix;',
            'uniform vec2 projectionVector;',
            'uniform vec2 offsetVector;',
            'uniform float alpha;',
            'uniform vec3 tint;',
            'varying vec4 vColor;',

            'void main(void) {',
            '   vec3 v = translationMatrix * vec3(aVertexPosition , 1.0);',
            '   v -= offsetVector.xyx;',
            '   gl_Position = vec4( v.x / projectionVector.x -1.0, v.y / -projectionVector.y + 1.0 , 0.0, 1.0);',
            '   vColor = aColor * vec4(tint * alpha, alpha);',
            '}'
        ];

        this.init();
    };

    PIXI.PrimitiveShader.prototype.constructor = PIXI.PrimitiveShader;

    /**
     * Initialises the shader.
     * 
     * @method init
     */
    PIXI.PrimitiveShader.prototype.init = function() {
        var gl = this.gl;

        var program = PIXI.compileProgram(gl, this.vertexSrc, this.fragmentSrc);
        gl.useProgram(program);

        // get and store the uniforms for the shader
        this.projectionVector = gl.getUniformLocation(program, 'projectionVector');
        this.offsetVector = gl.getUniformLocation(program, 'offsetVector');
        this.tintColor = gl.getUniformLocation(program, 'tint');

        // get and store the attributes
        this.aVertexPosition = gl.getAttribLocation(program, 'aVertexPosition');
        this.colorAttribute = gl.getAttribLocation(program, 'aColor');

        this.attributes = [this.aVertexPosition, this.colorAttribute];

        this.translationMatrix = gl.getUniformLocation(program, 'translationMatrix');
        this.alpha = gl.getUniformLocation(program, 'alpha');

        this.program = program;
    };

    /**
     * Destroys the shader.
     * 
     * @method destroy
     */
    PIXI.PrimitiveShader.prototype.destroy = function() {
        this.gl.deleteProgram(this.program);
        this.uniforms = null;
        this.gl = null;

        this.attributes = null;
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * @class ComplexPrimitiveShader
     * @constructor
     * @param gl {WebGLContext} the current WebGL drawing context
     */
    PIXI.ComplexPrimitiveShader = function(gl) {
        /**
         * @property _UID
         * @type Number
         * @private
         */
        this._UID = PIXI._UID++;

        /**
         * @property gl
         * @type WebGLContext
         */
        this.gl = gl;

        /**
         * The WebGL program.
         * @property program
         * @type {Any}
         */
        this.program = null;

        /**
         * The fragment shader.
         * @property fragmentSrc
         * @type Array
         */
        this.fragmentSrc = [

            'precision mediump float;',

            'varying vec4 vColor;',

            'void main(void) {',
            '   gl_FragColor = vColor;',
            '}'
        ];

        /**
         * The vertex shader.
         * @property vertexSrc
         * @type Array
         */
        this.vertexSrc = [
            'attribute vec2 aVertexPosition;',
            //'attribute vec4 aColor;',
            'uniform mat3 translationMatrix;',
            'uniform vec2 projectionVector;',
            'uniform vec2 offsetVector;',

            'uniform vec3 tint;',
            'uniform float alpha;',
            'uniform vec3 color;',

            'varying vec4 vColor;',

            'void main(void) {',
            '   vec3 v = translationMatrix * vec3(aVertexPosition , 1.0);',
            '   v -= offsetVector.xyx;',
            '   gl_Position = vec4( v.x / projectionVector.x -1.0, v.y / -projectionVector.y + 1.0 , 0.0, 1.0);',
            '   vColor = vec4(color * alpha * tint, alpha);', //" * vec4(tint * alpha, alpha);',
            '}'
        ];

        this.init();
    };

    PIXI.ComplexPrimitiveShader.prototype.constructor = PIXI.ComplexPrimitiveShader;

    /**
     * Initialises the shader.
     * 
     * @method init
     */
    PIXI.ComplexPrimitiveShader.prototype.init = function() {
        var gl = this.gl;

        var program = PIXI.compileProgram(gl, this.vertexSrc, this.fragmentSrc);
        gl.useProgram(program);

        // get and store the uniforms for the shader
        this.projectionVector = gl.getUniformLocation(program, 'projectionVector');
        this.offsetVector = gl.getUniformLocation(program, 'offsetVector');
        this.tintColor = gl.getUniformLocation(program, 'tint');
        this.color = gl.getUniformLocation(program, 'color');

        // get and store the attributes
        this.aVertexPosition = gl.getAttribLocation(program, 'aVertexPosition');
        // this.colorAttribute = gl.getAttribLocation(program, 'aColor');

        this.attributes = [this.aVertexPosition, this.colorAttribute];

        this.translationMatrix = gl.getUniformLocation(program, 'translationMatrix');
        this.alpha = gl.getUniformLocation(program, 'alpha');

        this.program = program;
    };

    /**
     * Destroys the shader.
     * 
     * @method destroy
     */
    PIXI.ComplexPrimitiveShader.prototype.destroy = function() {
        this.gl.deleteProgram(this.program);
        this.uniforms = null;
        this.gl = null;

        this.attribute = null;
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * A set of functions used by the webGL renderer to draw the primitive graphics data
     *
     * @class WebGLGraphics
     * @private
     * @static
     */
    PIXI.WebGLGraphics = function() {};

    /**
     * Renders the graphics object
     *
     * @static
     * @private
     * @method renderGraphics
     * @param graphics {Graphics}
     * @param renderSession {Object}
     */
    PIXI.WebGLGraphics.renderGraphics = function(graphics, renderSession) //projection, offset)
        {
            var gl = renderSession.gl;
            var projection = renderSession.projection,
                offset = renderSession.offset,
                shader = renderSession.shaderManager.primitiveShader,
                webGLData;

            if (graphics.dirty) {
                PIXI.WebGLGraphics.updateGraphics(graphics, gl);
            }

            var webGL = graphics._webGL[gl.id];

            // This  could be speeded up for sure!

            for (var i = 0; i < webGL.data.length; i++) {
                if (webGL.data[i].mode === 1) {
                    webGLData = webGL.data[i];

                    renderSession.stencilManager.pushStencil(graphics, webGLData, renderSession);

                    // render quad..
                    gl.drawElements(gl.TRIANGLE_FAN, 4, gl.UNSIGNED_SHORT, (webGLData.indices.length - 4) * 2);

                    renderSession.stencilManager.popStencil(graphics, webGLData, renderSession);
                } else {
                    webGLData = webGL.data[i];


                    renderSession.shaderManager.setShader(shader); //activatePrimitiveShader();
                    shader = renderSession.shaderManager.primitiveShader;
                    gl.uniformMatrix3fv(shader.translationMatrix, false, graphics.worldTransform.toArray(true));

                    gl.uniform2f(shader.projectionVector, projection.x, -projection.y);
                    gl.uniform2f(shader.offsetVector, -offset.x, -offset.y);

                    gl.uniform3fv(shader.tintColor, PIXI.hex2rgb(graphics.tint));

                    gl.uniform1f(shader.alpha, graphics.worldAlpha);


                    gl.bindBuffer(gl.ARRAY_BUFFER, webGLData.buffer);

                    gl.vertexAttribPointer(shader.aVertexPosition, 2, gl.FLOAT, false, 4 * 6, 0);
                    gl.vertexAttribPointer(shader.colorAttribute, 4, gl.FLOAT, false, 4 * 6, 2 * 4);

                    // set the index buffer!
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, webGLData.indexBuffer);
                    gl.drawElements(gl.TRIANGLE_STRIP, webGLData.indices.length, gl.UNSIGNED_SHORT, 0);
                }
            }
        };

    /**
     * Updates the graphics object
     *
     * @static
     * @private
     * @method updateGraphics
     * @param graphicsData {Graphics} The graphics object to update
     * @param gl {WebGLContext} the current WebGL drawing context
     */
    PIXI.WebGLGraphics.updateGraphics = function(graphics, gl) {
        // get the contexts graphics object
        var webGL = graphics._webGL[gl.id];
        // if the graphics object does not exist in the webGL context time to create it!
        if (!webGL) webGL = graphics._webGL[gl.id] = { lastIndex: 0, data: [], gl: gl };

        // flag the graphics as not dirty as we are about to update it...
        graphics.dirty = false;

        var i;

        // if the user cleared the graphics object we will need to clear every object
        if (graphics.clearDirty) {
            graphics.clearDirty = false;

            // lop through and return all the webGLDatas to the object pool so than can be reused later on
            for (i = 0; i < webGL.data.length; i++) {
                var graphicsData = webGL.data[i];
                graphicsData.reset();
                PIXI.WebGLGraphics.graphicsDataPool.push(graphicsData);
            }

            // clear the array and reset the index.. 
            webGL.data = [];
            webGL.lastIndex = 0;
        }

        var webGLData;

        // loop through the graphics datas and construct each one..
        // if the object is a complex fill then the new stencil buffer technique will be used
        // other wise graphics objects will be pushed into a batch..
        for (i = webGL.lastIndex; i < graphics.graphicsData.length; i++) {
            var data = graphics.graphicsData[i];

            if (data.type === PIXI.Graphics.POLY) {
                // need to add the points the the graphics object..
                data.points = data.shape.points.slice();
                if (data.shape.closed) {
                    // close the poly if the valu is true!
                    if (data.points[0] !== data.points[data.points.length - 2] && data.points[1] !== data.points[data.points.length - 1]) {
                        data.points.push(data.points[0], data.points[1]);
                    }
                }

                // MAKE SURE WE HAVE THE CORRECT TYPE..
                if (data.fill) {
                    if (data.points.length >= 6) {
                        if (data.points.length > 5 * 2) {
                            webGLData = PIXI.WebGLGraphics.switchMode(webGL, 1);
                            PIXI.WebGLGraphics.buildComplexPoly(data, webGLData);
                        } else {
                            webGLData = PIXI.WebGLGraphics.switchMode(webGL, 0);
                            PIXI.WebGLGraphics.buildPoly(data, webGLData);
                        }
                    }
                }

                if (data.lineWidth > 0) {
                    webGLData = PIXI.WebGLGraphics.switchMode(webGL, 0);
                    PIXI.WebGLGraphics.buildLine(data, webGLData);

                }
            } else {
                webGLData = PIXI.WebGLGraphics.switchMode(webGL, 0);

                if (data.type === PIXI.Graphics.RECT) {
                    PIXI.WebGLGraphics.buildRectangle(data, webGLData);
                } else if (data.type === PIXI.Graphics.CIRC || data.type === PIXI.Graphics.ELIP) {
                    PIXI.WebGLGraphics.buildCircle(data, webGLData);
                } else if (data.type === PIXI.Graphics.RREC) {
                    PIXI.WebGLGraphics.buildRoundedRectangle(data, webGLData);
                }
            }

            webGL.lastIndex++;
        }

        // upload all the dirty data...
        for (i = 0; i < webGL.data.length; i++) {
            webGLData = webGL.data[i];
            if (webGLData.dirty) webGLData.upload();
        }
    };

    /**
     * @static
     * @private
     * @method switchMode
     * @param webGL {WebGLContext}
     * @param type {Number}
     */
    PIXI.WebGLGraphics.switchMode = function(webGL, type) {
        var webGLData;

        if (!webGL.data.length) {
            webGLData = PIXI.WebGLGraphics.graphicsDataPool.pop() || new PIXI.WebGLGraphicsData(webGL.gl);
            webGLData.mode = type;
            webGL.data.push(webGLData);
        } else {
            webGLData = webGL.data[webGL.data.length - 1];

            if (webGLData.mode !== type || type === 1) {
                webGLData = PIXI.WebGLGraphics.graphicsDataPool.pop() || new PIXI.WebGLGraphicsData(webGL.gl);
                webGLData.mode = type;
                webGL.data.push(webGLData);
            }
        }

        webGLData.dirty = true;

        return webGLData;
    };

    /**
     * Builds a rectangle to draw
     *
     * @static
     * @private
     * @method buildRectangle
     * @param graphicsData {Graphics} The graphics object containing all the necessary properties
     * @param webGLData {Object}
     */
    PIXI.WebGLGraphics.buildRectangle = function(graphicsData, webGLData) {
        // --- //
        // need to convert points to a nice regular data
        //
        var rectData = graphicsData.shape;
        var x = rectData.x;
        var y = rectData.y;
        var width = rectData.width;
        var height = rectData.height;

        if (graphicsData.fill) {
            var color = PIXI.hex2rgb(graphicsData.fillColor);
            var alpha = graphicsData.fillAlpha;

            var r = color[0] * alpha;
            var g = color[1] * alpha;
            var b = color[2] * alpha;

            var verts = webGLData.points;
            var indices = webGLData.indices;

            var vertPos = verts.length / 6;

            // start
            verts.push(x, y);
            verts.push(r, g, b, alpha);

            verts.push(x + width, y);
            verts.push(r, g, b, alpha);

            verts.push(x, y + height);
            verts.push(r, g, b, alpha);

            verts.push(x + width, y + height);
            verts.push(r, g, b, alpha);

            // insert 2 dead triangles..
            indices.push(vertPos, vertPos, vertPos + 1, vertPos + 2, vertPos + 3, vertPos + 3);
        }

        if (graphicsData.lineWidth) {
            var tempPoints = graphicsData.points;

            graphicsData.points = [x, y,
                x + width, y,
                x + width, y + height,
                x, y + height,
                x, y
            ];


            PIXI.WebGLGraphics.buildLine(graphicsData, webGLData);

            graphicsData.points = tempPoints;
        }
    };

    /**
     * Builds a rounded rectangle to draw
     *
     * @static
     * @private
     * @method buildRoundedRectangle
     * @param graphicsData {Graphics} The graphics object containing all the necessary properties
     * @param webGLData {Object}
     */
    PIXI.WebGLGraphics.buildRoundedRectangle = function(graphicsData, webGLData) {
        var points = graphicsData.shape.points;
        var x = points[0];
        var y = points[1];
        var width = points[2];
        var height = points[3];
        var radius = points[4];

        var recPoints = [];
        recPoints.push(x, y + radius);
        recPoints = recPoints.concat(PIXI.WebGLGraphics.quadraticBezierCurve(x, y + height - radius, x, y + height, x + radius, y + height));
        recPoints = recPoints.concat(PIXI.WebGLGraphics.quadraticBezierCurve(x + width - radius, y + height, x + width, y + height, x + width, y + height - radius));
        recPoints = recPoints.concat(PIXI.WebGLGraphics.quadraticBezierCurve(x + width, y + radius, x + width, y, x + width - radius, y));
        recPoints = recPoints.concat(PIXI.WebGLGraphics.quadraticBezierCurve(x + radius, y, x, y, x, y + radius));

        if (graphicsData.fill) {
            var color = PIXI.hex2rgb(graphicsData.fillColor);
            var alpha = graphicsData.fillAlpha;

            var r = color[0] * alpha;
            var g = color[1] * alpha;
            var b = color[2] * alpha;

            var verts = webGLData.points;
            var indices = webGLData.indices;

            var vecPos = verts.length / 6;

            var triangles = PIXI.PolyK.Triangulate(recPoints);

            var i = 0;
            for (i = 0; i < triangles.length; i += 3) {
                indices.push(triangles[i] + vecPos);
                indices.push(triangles[i] + vecPos);
                indices.push(triangles[i + 1] + vecPos);
                indices.push(triangles[i + 2] + vecPos);
                indices.push(triangles[i + 2] + vecPos);
            }

            for (i = 0; i < recPoints.length; i++) {
                verts.push(recPoints[i], recPoints[++i], r, g, b, alpha);
            }
        }

        if (graphicsData.lineWidth) {
            var tempPoints = graphicsData.points;

            graphicsData.points = recPoints;

            PIXI.WebGLGraphics.buildLine(graphicsData, webGLData);

            graphicsData.points = tempPoints;
        }
    };

    /**
     * Calculate the points for a quadratic bezier curve. (helper function..)
     * Based on: https://stackoverflow.com/questions/785097/how-do-i-implement-a-bezier-curve-in-c
     *
     * @static
     * @private
     * @method quadraticBezierCurve
     * @param fromX {Number} Origin point x
     * @param fromY {Number} Origin point x
     * @param cpX {Number} Control point x
     * @param cpY {Number} Control point y
     * @param toX {Number} Destination point x
     * @param toY {Number} Destination point y
     * @return {Array<Number>}
     */
    PIXI.WebGLGraphics.quadraticBezierCurve = function(fromX, fromY, cpX, cpY, toX, toY) {

        var xa,
            ya,
            xb,
            yb,
            x,
            y,
            n = 20,
            points = [];

        function getPt(n1, n2, perc) {
            var diff = n2 - n1;

            return n1 + (diff * perc);
        }

        var j = 0;
        for (var i = 0; i <= n; i++) {
            j = i / n;

            // The Green Line
            xa = getPt(fromX, cpX, j);
            ya = getPt(fromY, cpY, j);
            xb = getPt(cpX, toX, j);
            yb = getPt(cpY, toY, j);

            // The Black Dot
            x = getPt(xa, xb, j);
            y = getPt(ya, yb, j);

            points.push(x, y);
        }
        return points;
    };

    /**
     * Builds a circle to draw
     *
     * @static
     * @private
     * @method buildCircle
     * @param graphicsData {Graphics} The graphics object to draw
     * @param webGLData {Object}
     */
    PIXI.WebGLGraphics.buildCircle = function(graphicsData, webGLData) {
        // need to convert points to a nice regular data
        var circleData = graphicsData.shape;
        var x = circleData.x;
        var y = circleData.y;
        var width;
        var height;

        // TODO - bit hacky??
        if (graphicsData.type === PIXI.Graphics.CIRC) {
            width = circleData.radius;
            height = circleData.radius;
        } else {
            width = circleData.width;
            height = circleData.height;
        }

        var totalSegs = 40;
        var seg = (Math.PI * 2) / totalSegs;

        var i = 0;

        if (graphicsData.fill) {
            var color = PIXI.hex2rgb(graphicsData.fillColor);
            var alpha = graphicsData.fillAlpha;

            var r = color[0] * alpha;
            var g = color[1] * alpha;
            var b = color[2] * alpha;

            var verts = webGLData.points;
            var indices = webGLData.indices;

            var vecPos = verts.length / 6;

            indices.push(vecPos);

            for (i = 0; i < totalSegs + 1; i++) {
                verts.push(x, y, r, g, b, alpha);

                verts.push(x + Math.sin(seg * i) * width,
                    y + Math.cos(seg * i) * height,
                    r, g, b, alpha);

                indices.push(vecPos++, vecPos++);
            }

            indices.push(vecPos - 1);
        }

        if (graphicsData.lineWidth) {
            var tempPoints = graphicsData.points;

            graphicsData.points = [];

            for (i = 0; i < totalSegs + 1; i++) {
                graphicsData.points.push(x + Math.sin(seg * i) * width,
                    y + Math.cos(seg * i) * height);
            }

            PIXI.WebGLGraphics.buildLine(graphicsData, webGLData);

            graphicsData.points = tempPoints;
        }
    };

    /**
     * Builds a line to draw
     *
     * @static
     * @private
     * @method buildLine
     * @param graphicsData {Graphics} The graphics object containing all the necessary properties
     * @param webGLData {Object}
     */
    PIXI.WebGLGraphics.buildLine = function(graphicsData, webGLData) {
        // TODO OPTIMISE!
        var i = 0;
        var points = graphicsData.points;
        if (points.length === 0) return;

        // if the line width is an odd number add 0.5 to align to a whole pixel
        if (graphicsData.lineWidth % 2) {
            for (i = 0; i < points.length; i++) {
                points[i] += 0.5;
            }
        }

        // get first and last point.. figure out the middle!
        var firstPoint = new PIXI.Point(points[0], points[1]);
        var lastPoint = new PIXI.Point(points[points.length - 2], points[points.length - 1]);

        // if the first point is the last point - gonna have issues :)
        if (firstPoint.x === lastPoint.x && firstPoint.y === lastPoint.y) {
            // need to clone as we are going to slightly modify the shape..
            points = points.slice();

            points.pop();
            points.pop();

            lastPoint = new PIXI.Point(points[points.length - 2], points[points.length - 1]);

            var midPointX = lastPoint.x + (firstPoint.x - lastPoint.x) * 0.5;
            var midPointY = lastPoint.y + (firstPoint.y - lastPoint.y) * 0.5;

            points.unshift(midPointX, midPointY);
            points.push(midPointX, midPointY);
        }

        var verts = webGLData.points;
        var indices = webGLData.indices;
        var length = points.length / 2;
        var indexCount = points.length;
        var indexStart = verts.length / 6;

        // DRAW the Line
        var width = graphicsData.lineWidth / 2;

        // sort color
        var color = PIXI.hex2rgb(graphicsData.lineColor);
        var alpha = graphicsData.lineAlpha;
        var r = color[0] * alpha;
        var g = color[1] * alpha;
        var b = color[2] * alpha;

        var px, py, p1x, p1y, p2x, p2y, p3x, p3y;
        var perpx, perpy, perp2x, perp2y, perp3x, perp3y;
        var a1, b1, c1, a2, b2, c2;
        var denom, pdist, dist;

        p1x = points[0];
        p1y = points[1];

        p2x = points[2];
        p2y = points[3];

        perpx = -(p1y - p2y);
        perpy = p1x - p2x;

        dist = Math.sqrt(perpx * perpx + perpy * perpy);

        perpx /= dist;
        perpy /= dist;
        perpx *= width;
        perpy *= width;

        // start
        verts.push(p1x - perpx, p1y - perpy,
            r, g, b, alpha);

        verts.push(p1x + perpx, p1y + perpy,
            r, g, b, alpha);

        for (i = 1; i < length - 1; i++) {
            p1x = points[(i - 1) * 2];
            p1y = points[(i - 1) * 2 + 1];

            p2x = points[(i) * 2];
            p2y = points[(i) * 2 + 1];

            p3x = points[(i + 1) * 2];
            p3y = points[(i + 1) * 2 + 1];

            perpx = -(p1y - p2y);
            perpy = p1x - p2x;

            dist = Math.sqrt(perpx * perpx + perpy * perpy);
            perpx /= dist;
            perpy /= dist;
            perpx *= width;
            perpy *= width;

            perp2x = -(p2y - p3y);
            perp2y = p2x - p3x;

            dist = Math.sqrt(perp2x * perp2x + perp2y * perp2y);
            perp2x /= dist;
            perp2y /= dist;
            perp2x *= width;
            perp2y *= width;

            a1 = (-perpy + p1y) - (-perpy + p2y);
            b1 = (-perpx + p2x) - (-perpx + p1x);
            c1 = (-perpx + p1x) * (-perpy + p2y) - (-perpx + p2x) * (-perpy + p1y);
            a2 = (-perp2y + p3y) - (-perp2y + p2y);
            b2 = (-perp2x + p2x) - (-perp2x + p3x);
            c2 = (-perp2x + p3x) * (-perp2y + p2y) - (-perp2x + p2x) * (-perp2y + p3y);

            denom = a1 * b2 - a2 * b1;

            if (Math.abs(denom) < 0.1) {

                denom += 10.1;
                verts.push(p2x - perpx, p2y - perpy,
                    r, g, b, alpha);

                verts.push(p2x + perpx, p2y + perpy,
                    r, g, b, alpha);

                continue;
            }

            px = (b1 * c2 - b2 * c1) / denom;
            py = (a2 * c1 - a1 * c2) / denom;


            pdist = (px - p2x) * (px - p2x) + (py - p2y) + (py - p2y);


            if (pdist > 140 * 140) {
                perp3x = perpx - perp2x;
                perp3y = perpy - perp2y;

                dist = Math.sqrt(perp3x * perp3x + perp3y * perp3y);
                perp3x /= dist;
                perp3y /= dist;
                perp3x *= width;
                perp3y *= width;

                verts.push(p2x - perp3x, p2y - perp3y);
                verts.push(r, g, b, alpha);

                verts.push(p2x + perp3x, p2y + perp3y);
                verts.push(r, g, b, alpha);

                verts.push(p2x - perp3x, p2y - perp3y);
                verts.push(r, g, b, alpha);

                indexCount++;
            } else {

                verts.push(px, py);
                verts.push(r, g, b, alpha);

                verts.push(p2x - (px - p2x), p2y - (py - p2y));
                verts.push(r, g, b, alpha);
            }
        }

        p1x = points[(length - 2) * 2];
        p1y = points[(length - 2) * 2 + 1];

        p2x = points[(length - 1) * 2];
        p2y = points[(length - 1) * 2 + 1];

        perpx = -(p1y - p2y);
        perpy = p1x - p2x;

        dist = Math.sqrt(perpx * perpx + perpy * perpy);
        perpx /= dist;
        perpy /= dist;
        perpx *= width;
        perpy *= width;

        verts.push(p2x - perpx, p2y - perpy);
        verts.push(r, g, b, alpha);

        verts.push(p2x + perpx, p2y + perpy);
        verts.push(r, g, b, alpha);

        indices.push(indexStart);

        for (i = 0; i < indexCount; i++) {
            indices.push(indexStart++);
        }

        indices.push(indexStart - 1);
    };

    /**
     * Builds a complex polygon to draw
     *
     * @static
     * @private
     * @method buildComplexPoly
     * @param graphicsData {Graphics} The graphics object containing all the necessary properties
     * @param webGLData {Object}
     */
    PIXI.WebGLGraphics.buildComplexPoly = function(graphicsData, webGLData) {
        //TODO - no need to copy this as it gets turned into a FLoat32Array anyways..
        var points = graphicsData.points.slice();
        if (points.length < 6) return;

        // get first and last point.. figure out the middle!
        var indices = webGLData.indices;
        webGLData.points = points;
        webGLData.alpha = graphicsData.fillAlpha;
        webGLData.color = PIXI.hex2rgb(graphicsData.fillColor);

        /*
            calclate the bounds..
        */
        var minX = Infinity;
        var maxX = -Infinity;

        var minY = Infinity;
        var maxY = -Infinity;

        var x, y;

        // get size..
        for (var i = 0; i < points.length; i += 2) {
            x = points[i];
            y = points[i + 1];

            minX = x < minX ? x : minX;
            maxX = x > maxX ? x : maxX;

            minY = y < minY ? y : minY;
            maxY = y > maxY ? y : maxY;
        }

        // add a quad to the end cos there is no point making another buffer!
        points.push(minX, minY,
            maxX, minY,
            maxX, maxY,
            minX, maxY);

        // push a quad onto the end.. 

        //TODO - this aint needed!
        var length = points.length / 2;
        for (i = 0; i < length; i++) {
            indices.push(i);
        }

    };

    /**
     * Builds a polygon to draw
     *
     * @static
     * @private
     * @method buildPoly
     * @param graphicsData {Graphics} The graphics object containing all the necessary properties
     * @param webGLData {Object}
     */
    PIXI.WebGLGraphics.buildPoly = function(graphicsData, webGLData) {
        var points = graphicsData.points;

        if (points.length < 6) return;
        // get first and last point.. figure out the middle!
        var verts = webGLData.points;
        var indices = webGLData.indices;

        var length = points.length / 2;

        // sort color
        var color = PIXI.hex2rgb(graphicsData.fillColor);
        var alpha = graphicsData.fillAlpha;
        var r = color[0] * alpha;
        var g = color[1] * alpha;
        var b = color[2] * alpha;

        var triangles = PIXI.PolyK.Triangulate(points);
        var vertPos = verts.length / 6;

        var i = 0;

        for (i = 0; i < triangles.length; i += 3) {
            indices.push(triangles[i] + vertPos);
            indices.push(triangles[i] + vertPos);
            indices.push(triangles[i + 1] + vertPos);
            indices.push(triangles[i + 2] + vertPos);
            indices.push(triangles[i + 2] + vertPos);
        }

        for (i = 0; i < length; i++) {
            verts.push(points[i * 2], points[i * 2 + 1],
                r, g, b, alpha);
        }

    };

    PIXI.WebGLGraphics.graphicsDataPool = [];

    /**
     * @class WebGLGraphicsData
     * @private
     * @static
     */
    PIXI.WebGLGraphicsData = function(gl) {
        this.gl = gl;

        //TODO does this need to be split before uploding??
        this.color = [0, 0, 0]; // color split!
        this.points = [];
        this.indices = [];
        this.lastIndex = 0;
        this.buffer = gl.createBuffer();
        this.indexBuffer = gl.createBuffer();
        this.mode = 1;
        this.alpha = 1;
        this.dirty = true;
    };

    /**
     * @method reset
     */
    PIXI.WebGLGraphicsData.prototype.reset = function() {
        this.points = [];
        this.indices = [];
        this.lastIndex = 0;
    };

    /**
     * @method upload
     */
    PIXI.WebGLGraphicsData.prototype.upload = function() {
        var gl = this.gl;

        //    this.lastIndex = graphics.graphicsData.length;
        this.glPoints = new Float32Array(this.points);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.glPoints, gl.STATIC_DRAW);

        this.glIndicies = new Uint16Array(this.indices);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.glIndicies, gl.STATIC_DRAW);

        this.dirty = false;
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    PIXI.glContexts = []; // this is where we store the webGL contexts for easy access.

    /**
     * The WebGLRenderer draws the stage and all its content onto a webGL enabled canvas. This renderer
     * should be used for browsers that support webGL. This Render works by automatically managing webGLBatchs.
     * So no need for Sprite Batches or Sprite Clouds.
     * Don't forget to add the view to your DOM or you will not see anything :)
     *
     * @class WebGLRenderer
     * @constructor
     * @param [width=0] {Number} the width of the canvas view
     * @param [height=0] {Number} the height of the canvas view
     * @param [options] {Object} The optional renderer parameters
     * @param [options.view] {HTMLCanvasElement} the canvas to use as a view, optional
     * @param [options.transparent=false] {Boolean} If the render view is transparent, default false
     * @param [options.antialias=false] {Boolean} sets antialias (only applicable in chrome at the moment)
     * @param [options.preserveDrawingBuffer=false] {Boolean} enables drawing buffer preservation, enable this if you need to call toDataUrl on the webgl context
     * @param [options.resolution=1] {Number} the resolution of the renderer retina would be 2
     */
    PIXI.WebGLRenderer = function(width, height, options) {
        if (options) {
            for (var i in PIXI.defaultRenderOptions) {
                if (typeof options[i] === 'undefined') options[i] = PIXI.defaultRenderOptions[i];
            }
        } else {
            options = PIXI.defaultRenderOptions;
        }

        if (!PIXI.defaultRenderer) {
            PIXI.sayHello('webGL');
            PIXI.defaultRenderer = this;
        }

        /**
         * @property type
         * @type Number
         */
        this.type = PIXI.WEBGL_RENDERER;

        /**
         * The resolution of the renderer
         *
         * @property resolution
         * @type Number
         * @default 1
         */
        this.resolution = options.resolution;

        // do a catch.. only 1 webGL renderer..

        /**
         * Whether the render view is transparent
         *
         * @property transparent
         * @type Boolean
         */
        this.transparent = options.transparent;

        /**
         * The value of the preserveDrawingBuffer flag affects whether or not the contents of the stencil buffer is retained after rendering.
         *
         * @property preserveDrawingBuffer
         * @type Boolean
         */
        this.preserveDrawingBuffer = options.preserveDrawingBuffer;

        /**
         * This sets if the WebGLRenderer will clear the context texture or not before the new render pass. If true:
         * If the Stage is NOT transparent, Pixi will clear to alpha (0, 0, 0, 0).
         * If the Stage is transparent, Pixi will clear to the target Stage's background color.
         * Disable this by setting this to false. For example: if your game has a canvas filling background image, you often don't need this set.
         *
         * @property clearBeforeRender
         * @type Boolean
         * @default
         */
        this.clearBeforeRender = options.clearBeforeRender;

        /**
         * The width of the canvas view
         *
         * @property width
         * @type Number
         * @default 800
         */
        this.width = width || 800;

        /**
         * The height of the canvas view
         *
         * @property height
         * @type Number
         * @default 600
         */
        this.height = height || 600;

        /**
         * The canvas element that everything is drawn to
         *
         * @property view
         * @type HTMLCanvasElement
         */
        this.view = options.view || document.createElement('canvas');

        // deal with losing context..

        /**
         * @property contextLostBound
         * @type Function
         */
        this.contextLostBound = this.handleContextLost.bind(this);

        /**
         * @property contextRestoredBound
         * @type Function
         */
        this.contextRestoredBound = this.handleContextRestored.bind(this);

        this.view.addEventListener('webglcontextlost', this.contextLostBound, false);
        this.view.addEventListener('webglcontextrestored', this.contextRestoredBound, false);

        /**
         * @property _contextOptions
         * @type Object
         * @private
         */
        this._contextOptions = {
            alpha: this.transparent,
            antialias: options.antialias, // SPEED UP??
            premultipliedAlpha: this.transparent && this.transparent !== 'notMultiplied',
            stencil: true,
            preserveDrawingBuffer: options.preserveDrawingBuffer
        };

        /**
         * @property projection
         * @type Point
         */
        this.projection = new PIXI.Point();

        /**
         * @property offset
         * @type Point
         */
        this.offset = new PIXI.Point(0, 0);

        // time to create the render managers! each one focuses on managing a state in webGL

        /**
         * Deals with managing the shader programs and their attribs
         * @property shaderManager
         * @type WebGLShaderManager
         */
        this.shaderManager = new PIXI.WebGLShaderManager();

        /**
         * Manages the rendering of sprites
         * @property spriteBatch
         * @type WebGLSpriteBatch
         */
        this.spriteBatch = new PIXI.WebGLSpriteBatch();

        /**
         * Manages the masks using the stencil buffer
         * @property maskManager
         * @type WebGLMaskManager
         */
        this.maskManager = new PIXI.WebGLMaskManager();

        /**
         * Manages the filters
         * @property filterManager
         * @type WebGLFilterManager
         */
        this.filterManager = new PIXI.WebGLFilterManager();

        /**
         * Manages the stencil buffer
         * @property stencilManager
         * @type WebGLStencilManager
         */
        this.stencilManager = new PIXI.WebGLStencilManager();

        /**
         * Manages the blendModes
         * @property blendModeManager
         * @type WebGLBlendModeManager
         */
        this.blendModeManager = new PIXI.WebGLBlendModeManager();

        /**
         * TODO remove
         * @property renderSession
         * @type Object
         */
        this.renderSession = {};
        this.renderSession.gl = this.gl;
        this.renderSession.drawCount = 0;
        this.renderSession.shaderManager = this.shaderManager;
        this.renderSession.maskManager = this.maskManager;
        this.renderSession.filterManager = this.filterManager;
        this.renderSession.blendModeManager = this.blendModeManager;
        this.renderSession.spriteBatch = this.spriteBatch;
        this.renderSession.stencilManager = this.stencilManager;
        this.renderSession.renderer = this;
        this.renderSession.resolution = this.resolution;

        // time init the context..
        this.initContext();

        // map some webGL blend modes..
        this.mapBlendModes();
    };

    // constructor
    PIXI.WebGLRenderer.prototype.constructor = PIXI.WebGLRenderer;

    /**
     * @method initContext
     */
    PIXI.WebGLRenderer.prototype.initContext = function() {
        var gl = this.view.getContext('webgl', this._contextOptions) || this.view.getContext('experimental-webgl', this._contextOptions);
        this.gl = gl;

        if (!gl) {
            // fail, not able to get a context
            throw new Error('This browser does not support webGL. Try using the canvas renderer');
        }

        this.glContextId = gl.id = PIXI.WebGLRenderer.glContextId++;

        PIXI.glContexts[this.glContextId] = gl;

        // set up the default pixi settings..
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.enable(gl.BLEND);

        // need to set the context for all the managers...
        this.shaderManager.setContext(gl);
        this.spriteBatch.setContext(gl);
        this.maskManager.setContext(gl);
        this.filterManager.setContext(gl);
        this.blendModeManager.setContext(gl);
        this.stencilManager.setContext(gl);

        this.renderSession.gl = this.gl;

        // now resize and we are good to go!
        this.resize(this.width, this.height);
    };

    /**
     * Renders the stage to its webGL view
     *
     * @method render
     * @param stage {Stage} the Stage element to be rendered
     */
    PIXI.WebGLRenderer.prototype.render = function(stage) {
        // no point rendering if our context has been blown up!
        if (this.contextLost) return;

        // if rendering a new stage clear the batches..
        if (this.__stage !== stage) {
            if (stage.interactive) stage.interactionManager.removeEvents();

            // TODO make this work
            // dont think this is needed any more?
            this.__stage = stage;
        }

        // update the scene graph
        stage.updateTransform();

        var gl = this.gl;

        // interaction
        if (stage._interactive) {
            //need to add some events!
            if (!stage._interactiveEventsAdded) {
                stage._interactiveEventsAdded = true;
                stage.interactionManager.setTarget(this);
            }
        } else {
            if (stage._interactiveEventsAdded) {
                stage._interactiveEventsAdded = false;
                stage.interactionManager.setTarget(this);
            }
        }

        // -- Does this need to be set every frame? -- //
        gl.viewport(0, 0, this.width, this.height);

        // make sure we are bound to the main frame buffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        if (this.clearBeforeRender) {
            if (this.transparent) {
                gl.clearColor(0, 0, 0, 0);
            } else {
                gl.clearColor(stage.backgroundColorSplit[0], stage.backgroundColorSplit[1], stage.backgroundColorSplit[2], 1);
            }

            gl.clear(gl.COLOR_BUFFER_BIT);
        }

        this.renderDisplayObject(stage, this.projection);
    };

    /**
     * Renders a Display Object.
     *
     * @method renderDisplayObject
     * @param displayObject {DisplayObject} The DisplayObject to render
     * @param projection {Point} The projection
     * @param buffer {Array} a standard WebGL buffer
     */
    PIXI.WebGLRenderer.prototype.renderDisplayObject = function(displayObject, projection, buffer) {
        this.renderSession.blendModeManager.setBlendMode(PIXI.blendModes.NORMAL);

        // reset the render session data..
        this.renderSession.drawCount = 0;

        // set the default projection
        this.renderSession.projection = projection;

        //set the default offset
        this.renderSession.offset = this.offset;

        // start the sprite batch
        this.spriteBatch.begin(this.renderSession);

        // start the filter manager
        this.filterManager.begin(this.renderSession, buffer);

        // render the scene!
        displayObject._renderWebGL(this.renderSession);

        // finish the sprite batch
        this.spriteBatch.end();
    };

    /**
     * Resizes the webGL view to the specified width and height.
     *
     * @method resize
     * @param width {Number} the new width of the webGL view
     * @param height {Number} the new height of the webGL view
     */
    PIXI.WebGLRenderer.prototype.resize = function(width, height) {
        this.width = width * this.resolution;
        this.height = height * this.resolution;

        this.view.width = this.width;
        this.view.height = this.height;

        this.gl.viewport(0, 0, this.width, this.height);

        this.projection.x = this.width / 2 / this.resolution;
        this.projection.y = -this.height / 2 / this.resolution;
    };

    /**
     * Updates and Creates a WebGL texture for the renderers context.
     *
     * @method updateTexture
     * @param texture {Texture} the texture to update
     */
    PIXI.WebGLRenderer.prototype.updateTexture = function(texture) {
        if (!texture.hasLoaded) return;

        var gl = this.gl;

        if (!texture._glTextures[gl.id]) texture._glTextures[gl.id] = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, texture._glTextures[gl.id]);

        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.premultipliedAlpha);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.source);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, texture.scaleMode === PIXI.scaleModes.LINEAR ? gl.LINEAR : gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, texture.scaleMode === PIXI.scaleModes.LINEAR ? gl.LINEAR : gl.NEAREST);

        // reguler...
        if (!texture._powerOf2) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        }

        texture._dirty[gl.id] = false;

        return texture._glTextures[gl.id];
    };

    /**
     * Handles a lost webgl context
     *
     * @method handleContextLost
     * @param event {Event}
     * @private
     */
    PIXI.WebGLRenderer.prototype.handleContextLost = function(event) {
        event.preventDefault();
        this.contextLost = true;
    };

    /**
     * Handles a restored webgl context
     *
     * @method handleContextRestored
     * @param event {Event}
     * @private
     */
    PIXI.WebGLRenderer.prototype.handleContextRestored = function() {
        this.initContext();

        // empty all the ol gl textures as they are useless now
        for (var key in PIXI.TextureCache) {
            var texture = PIXI.TextureCache[key].baseTexture;
            texture._glTextures = [];
        }

        this.contextLost = false;
    };

    /**
     * Removes everything from the renderer (event listeners, spritebatch, etc...)
     *
     * @method destroy
     */
    PIXI.WebGLRenderer.prototype.destroy = function() {
        // remove listeners
        this.view.off('webglcontextlost', this.contextLostBound);
        this.view.off('webglcontextrestored', this.contextRestoredBound);

        PIXI.glContexts[this.glContextId] = null;

        this.projection = null;
        this.offset = null;

        // time to create the render managers! each one focuses on managine a state in webGL
        this.shaderManager.destroy();
        this.spriteBatch.destroy();
        this.maskManager.destroy();
        this.filterManager.destroy();

        this.shaderManager = null;
        this.spriteBatch = null;
        this.maskManager = null;
        this.filterManager = null;

        this.gl = null;
        this.renderSession = null;
    };

    /**
     * Maps Pixi blend modes to WebGL blend modes.
     *
     * @method mapBlendModes
     */
    PIXI.WebGLRenderer.prototype.mapBlendModes = function() {
        var gl = this.gl;

        if (!PIXI.blendModesWebGL) {
            PIXI.blendModesWebGL = [];

            PIXI.blendModesWebGL[PIXI.blendModes.NORMAL] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            PIXI.blendModesWebGL[PIXI.blendModes.ADD] = [gl.SRC_ALPHA, gl.DST_ALPHA];
            PIXI.blendModesWebGL[PIXI.blendModes.MULTIPLY] = [gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA];
            PIXI.blendModesWebGL[PIXI.blendModes.SCREEN] = [gl.SRC_ALPHA, gl.ONE];
            PIXI.blendModesWebGL[PIXI.blendModes.OVERLAY] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            PIXI.blendModesWebGL[PIXI.blendModes.DARKEN] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            PIXI.blendModesWebGL[PIXI.blendModes.LIGHTEN] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            PIXI.blendModesWebGL[PIXI.blendModes.COLOR_DODGE] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            PIXI.blendModesWebGL[PIXI.blendModes.COLOR_BURN] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            PIXI.blendModesWebGL[PIXI.blendModes.HARD_LIGHT] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            PIXI.blendModesWebGL[PIXI.blendModes.SOFT_LIGHT] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            PIXI.blendModesWebGL[PIXI.blendModes.DIFFERENCE] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            PIXI.blendModesWebGL[PIXI.blendModes.EXCLUSION] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            PIXI.blendModesWebGL[PIXI.blendModes.HUE] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            PIXI.blendModesWebGL[PIXI.blendModes.SATURATION] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            PIXI.blendModesWebGL[PIXI.blendModes.COLOR] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            PIXI.blendModesWebGL[PIXI.blendModes.LUMINOSITY] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
        }
    };

    PIXI.WebGLRenderer.glContextId = 0;

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * @class WebGLBlendModeManager
     * @constructor
     * @param gl {WebGLContext} the current WebGL drawing context
     */
    PIXI.WebGLBlendModeManager = function() {
        /**
         * @property currentBlendMode
         * @type Number
         */
        this.currentBlendMode = 99999;
    };

    PIXI.WebGLBlendModeManager.prototype.constructor = PIXI.WebGLBlendModeManager;

    /**
     * Sets the WebGL Context.
     *
     * @method setContext
     * @param gl {WebGLContext} the current WebGL drawing context
     */
    PIXI.WebGLBlendModeManager.prototype.setContext = function(gl) {
        this.gl = gl;
    };

    /**
     * Sets-up the given blendMode from WebGL's point of view.
     * 
     * @method setBlendMode 
     * @param blendMode {Number} the blendMode, should be a Pixi const, such as PIXI.BlendModes.ADD
     */
    PIXI.WebGLBlendModeManager.prototype.setBlendMode = function(blendMode) {
        if (this.currentBlendMode === blendMode) return false;

        this.currentBlendMode = blendMode;

        var blendModeWebGL = PIXI.blendModesWebGL[this.currentBlendMode];
        this.gl.blendFunc(blendModeWebGL[0], blendModeWebGL[1]);

        return true;
    };

    /**
     * Destroys this object.
     * 
     * @method destroy
     */
    PIXI.WebGLBlendModeManager.prototype.destroy = function() {
        this.gl = null;
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * @class WebGLMaskManager
     * @constructor
     * @private
     */
    PIXI.WebGLMaskManager = function() {};

    PIXI.WebGLMaskManager.prototype.constructor = PIXI.WebGLMaskManager;

    /**
     * Sets the drawing context to the one given in parameter.
     * 
     * @method setContext 
     * @param gl {WebGLContext} the current WebGL drawing context
     */
    PIXI.WebGLMaskManager.prototype.setContext = function(gl) {
        this.gl = gl;
    };

    /**
     * Applies the Mask and adds it to the current filter stack.
     * 
     * @method pushMask
     * @param maskData {Array}
     * @param renderSession {Object}
     */
    PIXI.WebGLMaskManager.prototype.pushMask = function(maskData, renderSession) {
        var gl = renderSession.gl;

        if (maskData.dirty) {
            PIXI.WebGLGraphics.updateGraphics(maskData, gl);
        }

        if (!maskData._webGL[gl.id].data.length) return;

        renderSession.stencilManager.pushStencil(maskData, maskData._webGL[gl.id].data[0], renderSession);
    };

    /**
     * Removes the last filter from the filter stack and doesn't return it.
     * 
     * @method popMask
     * @param maskData {Array}
     * @param renderSession {Object} an object containing all the useful parameters
     */
    PIXI.WebGLMaskManager.prototype.popMask = function(maskData, renderSession) {
        var gl = this.gl;
        renderSession.stencilManager.popStencil(maskData, maskData._webGL[gl.id].data[0], renderSession);
    };

    /**
     * Destroys the mask stack.
     * 
     * @method destroy
     */
    PIXI.WebGLMaskManager.prototype.destroy = function() {
        this.gl = null;
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * @class WebGLStencilManager
     * @constructor
     * @private
     */
    PIXI.WebGLStencilManager = function() {
        this.stencilStack = [];
        this.reverse = true;
        this.count = 0;
    };

    /**
     * Sets the drawing context to the one given in parameter.
     * 
     * @method setContext 
     * @param gl {WebGLContext} the current WebGL drawing context
     */
    PIXI.WebGLStencilManager.prototype.setContext = function(gl) {
        this.gl = gl;
    };

    /**
     * Applies the Mask and adds it to the current filter stack.
     * 
     * @method pushMask
     * @param graphics {Graphics}
     * @param webGLData {Array}
     * @param renderSession {Object}
     */
    PIXI.WebGLStencilManager.prototype.pushStencil = function(graphics, webGLData, renderSession) {
        var gl = this.gl;
        this.bindGraphics(graphics, webGLData, renderSession);

        if (this.stencilStack.length === 0) {
            gl.enable(gl.STENCIL_TEST);
            gl.clear(gl.STENCIL_BUFFER_BIT);
            this.reverse = true;
            this.count = 0;
        }

        this.stencilStack.push(webGLData);

        var level = this.count;

        gl.colorMask(false, false, false, false);

        gl.stencilFunc(gl.ALWAYS, 0, 0xFF);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);

        // draw the triangle strip!

        if (webGLData.mode === 1) {
            gl.drawElements(gl.TRIANGLE_FAN, webGLData.indices.length - 4, gl.UNSIGNED_SHORT, 0);

            if (this.reverse) {
                gl.stencilFunc(gl.EQUAL, 0xFF - level, 0xFF);
                gl.stencilOp(gl.KEEP, gl.KEEP, gl.DECR);
            } else {
                gl.stencilFunc(gl.EQUAL, level, 0xFF);
                gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
            }

            // draw a quad to increment..
            gl.drawElements(gl.TRIANGLE_FAN, 4, gl.UNSIGNED_SHORT, (webGLData.indices.length - 4) * 2);

            if (this.reverse) {
                gl.stencilFunc(gl.EQUAL, 0xFF - (level + 1), 0xFF);
            } else {
                gl.stencilFunc(gl.EQUAL, level + 1, 0xFF);
            }

            this.reverse = !this.reverse;
        } else {
            if (!this.reverse) {
                gl.stencilFunc(gl.EQUAL, 0xFF - level, 0xFF);
                gl.stencilOp(gl.KEEP, gl.KEEP, gl.DECR);
            } else {
                gl.stencilFunc(gl.EQUAL, level, 0xFF);
                gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
            }

            gl.drawElements(gl.TRIANGLE_STRIP, webGLData.indices.length, gl.UNSIGNED_SHORT, 0);

            if (!this.reverse) {
                gl.stencilFunc(gl.EQUAL, 0xFF - (level + 1), 0xFF);
            } else {
                gl.stencilFunc(gl.EQUAL, level + 1, 0xFF);
            }
        }

        gl.colorMask(true, true, true, true);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

        this.count++;
    };

    /**
     * TODO this does not belong here!
     * 
     * @method bindGraphics
     * @param graphics {Graphics}
     * @param webGLData {Array}
     * @param renderSession {Object}
     */
    PIXI.WebGLStencilManager.prototype.bindGraphics = function(graphics, webGLData, renderSession) {
        //if(this._currentGraphics === graphics)return;
        this._currentGraphics = graphics;

        var gl = this.gl;

        // bind the graphics object..
        var projection = renderSession.projection,
            offset = renderSession.offset,
            shader; // = renderSession.shaderManager.primitiveShader;

        if (webGLData.mode === 1) {
            shader = renderSession.shaderManager.complexPrimitiveShader;

            renderSession.shaderManager.setShader(shader);

            gl.uniformMatrix3fv(shader.translationMatrix, false, graphics.worldTransform.toArray(true));

            gl.uniform2f(shader.projectionVector, projection.x, -projection.y);
            gl.uniform2f(shader.offsetVector, -offset.x, -offset.y);

            gl.uniform3fv(shader.tintColor, PIXI.hex2rgb(graphics.tint));
            gl.uniform3fv(shader.color, webGLData.color);

            gl.uniform1f(shader.alpha, graphics.worldAlpha * webGLData.alpha);

            gl.bindBuffer(gl.ARRAY_BUFFER, webGLData.buffer);

            gl.vertexAttribPointer(shader.aVertexPosition, 2, gl.FLOAT, false, 4 * 2, 0);


            // now do the rest..
            // set the index buffer!
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, webGLData.indexBuffer);
        } else {
            //renderSession.shaderManager.activatePrimitiveShader();
            shader = renderSession.shaderManager.primitiveShader;
            renderSession.shaderManager.setShader(shader);

            gl.uniformMatrix3fv(shader.translationMatrix, false, graphics.worldTransform.toArray(true));

            gl.uniform2f(shader.projectionVector, projection.x, -projection.y);
            gl.uniform2f(shader.offsetVector, -offset.x, -offset.y);

            gl.uniform3fv(shader.tintColor, PIXI.hex2rgb(graphics.tint));

            gl.uniform1f(shader.alpha, graphics.worldAlpha);

            gl.bindBuffer(gl.ARRAY_BUFFER, webGLData.buffer);

            gl.vertexAttribPointer(shader.aVertexPosition, 2, gl.FLOAT, false, 4 * 6, 0);
            gl.vertexAttribPointer(shader.colorAttribute, 4, gl.FLOAT, false, 4 * 6, 2 * 4);

            // set the index buffer!
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, webGLData.indexBuffer);
        }
    };

    /**
     * @method popStencil
     * @param graphics {Graphics}
     * @param webGLData {Array}
     * @param renderSession {Object}
     */
    PIXI.WebGLStencilManager.prototype.popStencil = function(graphics, webGLData, renderSession) {
        var gl = this.gl;
        this.stencilStack.pop();

        this.count--;

        if (this.stencilStack.length === 0) {
            // the stack is empty!
            gl.disable(gl.STENCIL_TEST);

        } else {

            var level = this.count;

            this.bindGraphics(graphics, webGLData, renderSession);

            gl.colorMask(false, false, false, false);

            if (webGLData.mode === 1) {
                this.reverse = !this.reverse;

                if (this.reverse) {
                    gl.stencilFunc(gl.EQUAL, 0xFF - (level + 1), 0xFF);
                    gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
                } else {
                    gl.stencilFunc(gl.EQUAL, level + 1, 0xFF);
                    gl.stencilOp(gl.KEEP, gl.KEEP, gl.DECR);
                }

                // draw a quad to increment..
                gl.drawElements(gl.TRIANGLE_FAN, 4, gl.UNSIGNED_SHORT, (webGLData.indices.length - 4) * 2);

                gl.stencilFunc(gl.ALWAYS, 0, 0xFF);
                gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);

                // draw the triangle strip!
                gl.drawElements(gl.TRIANGLE_FAN, webGLData.indices.length - 4, gl.UNSIGNED_SHORT, 0);

                if (!this.reverse) {
                    gl.stencilFunc(gl.EQUAL, 0xFF - (level), 0xFF);
                } else {
                    gl.stencilFunc(gl.EQUAL, level, 0xFF);
                }

            } else {
                //  console.log("<<>>")
                if (!this.reverse) {
                    gl.stencilFunc(gl.EQUAL, 0xFF - (level + 1), 0xFF);
                    gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
                } else {
                    gl.stencilFunc(gl.EQUAL, level + 1, 0xFF);
                    gl.stencilOp(gl.KEEP, gl.KEEP, gl.DECR);
                }

                gl.drawElements(gl.TRIANGLE_STRIP, webGLData.indices.length, gl.UNSIGNED_SHORT, 0);

                if (!this.reverse) {
                    gl.stencilFunc(gl.EQUAL, 0xFF - (level), 0xFF);
                } else {
                    gl.stencilFunc(gl.EQUAL, level, 0xFF);
                }
            }

            gl.colorMask(true, true, true, true);
            gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);


        }
    };

    /**
     * Destroys the mask stack.
     * 
     * @method destroy
     */
    PIXI.WebGLStencilManager.prototype.destroy = function() {
        this.stencilStack = null;
        this.gl = null;
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * @class WebGLShaderManager
     * @constructor
     * @private
     */
    PIXI.WebGLShaderManager = function() {
        /**
         * @property maxAttibs
         * @type Number
         */
        this.maxAttibs = 10;

        /**
         * @property attribState
         * @type Array
         */
        this.attribState = [];

        /**
         * @property tempAttribState
         * @type Array
         */
        this.tempAttribState = [];

        for (var i = 0; i < this.maxAttibs; i++) {
            this.attribState[i] = false;
        }

        /**
         * @property stack
         * @type Array
         */
        this.stack = [];

    };

    PIXI.WebGLShaderManager.prototype.constructor = PIXI.WebGLShaderManager;

    /**
     * Initialises the context and the properties.
     * 
     * @method setContext 
     * @param gl {WebGLContext} the current WebGL drawing context
     */
    PIXI.WebGLShaderManager.prototype.setContext = function(gl) {
        this.gl = gl;

        // the next one is used for rendering primitives
        this.primitiveShader = new PIXI.PrimitiveShader(gl);

        // the next one is used for rendering triangle strips
        this.complexPrimitiveShader = new PIXI.ComplexPrimitiveShader(gl);

        // this shader is used for the default sprite rendering
        this.defaultShader = new PIXI.PixiShader(gl);

        // this shader is used for the fast sprite rendering
        this.fastShader = new PIXI.PixiFastShader(gl);

        // the next one is used for rendering triangle strips
        this.stripShader = new PIXI.StripShader(gl);
        this.setShader(this.defaultShader);
    };

    /**
     * Takes the attributes given in parameters.
     * 
     * @method setAttribs
     * @param attribs {Array} attribs 
     */
    PIXI.WebGLShaderManager.prototype.setAttribs = function(attribs) {
        // reset temp state
        var i;

        for (i = 0; i < this.tempAttribState.length; i++) {
            this.tempAttribState[i] = false;
        }

        // set the new attribs
        for (i = 0; i < attribs.length; i++) {
            var attribId = attribs[i];
            this.tempAttribState[attribId] = true;
        }

        var gl = this.gl;

        for (i = 0; i < this.attribState.length; i++) {
            if (this.attribState[i] !== this.tempAttribState[i]) {
                this.attribState[i] = this.tempAttribState[i];

                if (this.tempAttribState[i]) {
                    gl.enableVertexAttribArray(i);
                } else {
                    gl.disableVertexAttribArray(i);
                }
            }
        }
    };

    /**
     * Sets the current shader.
     * 
     * @method setShader
     * @param shader {Any}
     */
    PIXI.WebGLShaderManager.prototype.setShader = function(shader) {
        if (this._currentId === shader._UID) return false;

        this._currentId = shader._UID;

        this.currentShader = shader;

        this.gl.useProgram(shader.program);
        this.setAttribs(shader.attributes);

        return true;
    };

    /**
     * Destroys this object.
     * 
     * @method destroy
     */
    PIXI.WebGLShaderManager.prototype.destroy = function() {
        this.attribState = null;

        this.tempAttribState = null;

        this.primitiveShader.destroy();

        this.complexPrimitiveShader.destroy();

        this.defaultShader.destroy();

        this.fastShader.destroy();

        this.stripShader.destroy();

        this.gl = null;
    };

    /**
     * @author Mat Groves
     * 
     * Big thanks to the very clever Matt DesLauriers <mattdesl> https://github.com/mattdesl/
     * for creating the original pixi version!
     *
     * Heavily inspired by LibGDX's WebGLSpriteBatch:
     * https://github.com/libgdx/libgdx/blob/master/gdx/src/com/badlogic/gdx/graphics/g2d/WebGLSpriteBatch.java
     */

    /**
     *
     * @class WebGLSpriteBatch
     * @private
     * @constructor
     */
    PIXI.WebGLSpriteBatch = function() {
        /**
         * @property vertSize
         * @type Number
         */
        this.vertSize = 6;

        /**
         * The number of images in the SpriteBatch before it flushes
         * @property size
         * @type Number
         */
        this.size = 2000; //Math.pow(2, 16) /  this.vertSize;

        //the total number of floats in our batch
        var numVerts = this.size * 4 * this.vertSize;
        //the total number of indices in our batch
        var numIndices = this.size * 6;

        /**
         * Holds the vertices
         *
         * @property vertices
         * @type Float32Array
         */
        this.vertices = new Float32Array(numVerts);

        /**
         * Holds the indices
         *
         * @property indices
         * @type Uint16Array
         */
        this.indices = new Uint16Array(numIndices);

        /**
         * @property lastIndexCount
         * @type Number
         */
        this.lastIndexCount = 0;

        for (var i = 0, j = 0; i < numIndices; i += 6, j += 4) {
            this.indices[i + 0] = j + 0;
            this.indices[i + 1] = j + 1;
            this.indices[i + 2] = j + 2;
            this.indices[i + 3] = j + 0;
            this.indices[i + 4] = j + 2;
            this.indices[i + 5] = j + 3;
        }

        /**
         * @property drawing
         * @type Boolean
         */
        this.drawing = false;

        /**
         * @property currentBatchSize
         * @type Number
         */
        this.currentBatchSize = 0;

        /**
         * @property currentBaseTexture
         * @type BaseTexture
         */
        this.currentBaseTexture = null;

        /**
         * @property dirty
         * @type Boolean
         */
        this.dirty = true;

        /**
         * @property textures
         * @type Array
         */
        this.textures = [];

        /**
         * @property blendModes
         * @type Array
         */
        this.blendModes = [];

        /**
         * @property shaders
         * @type Array
         */
        this.shaders = [];

        /**
         * @property sprites
         * @type Array
         */
        this.sprites = [];

        /**
         * @property defaultShader
         * @type AbstractFilter
         */
        this.defaultShader = new PIXI.AbstractFilter([
            'precision lowp float;',
            'varying vec2 vTextureCoord;',
            'varying vec4 vColor;',
            'uniform sampler2D uSampler;',
            'void main(void) {',
            '   gl_FragColor = texture2D(uSampler, vTextureCoord) * vColor ;',
            '}'
        ]);
    };

    /**
     * @method setContext
     * @param gl {WebGLContext} the current WebGL drawing context
     */
    PIXI.WebGLSpriteBatch.prototype.setContext = function(gl) {
        this.gl = gl;

        // create a couple of buffers
        this.vertexBuffer = gl.createBuffer();
        this.indexBuffer = gl.createBuffer();

        // 65535 is max index, so 65535 / 6 = 10922.

        //upload the index data
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.DYNAMIC_DRAW);

        this.currentBlendMode = 99999;

        var shader = new PIXI.PixiShader(gl);

        shader.fragmentSrc = this.defaultShader.fragmentSrc;
        shader.uniforms = {};
        shader.init();

        this.defaultShader.shaders[gl.id] = shader;
    };

    /**
     * @method begin
     * @param renderSession {Object} The RenderSession object
     */
    PIXI.WebGLSpriteBatch.prototype.begin = function(renderSession) {
        this.renderSession = renderSession;
        this.shader = this.renderSession.shaderManager.defaultShader;

        this.start();
    };

    /**
     * @method end
     */
    PIXI.WebGLSpriteBatch.prototype.end = function() {
        this.flush();
    };

    /**
     * @method render
     * @param sprite {Sprite} the sprite to render when using this spritebatch
     */
    PIXI.WebGLSpriteBatch.prototype.render = function(sprite) {
        var texture = sprite.texture;

        //TODO set blend modes.. 
        // check texture..
        if (this.currentBatchSize >= this.size) {
            this.flush();
            this.currentBaseTexture = texture.baseTexture;
        }

        // get the uvs for the texture
        var uvs = texture._uvs;
        // if the uvs have not updated then no point rendering just yet!
        if (!uvs) return;

        // get the sprites current alpha
        var alpha = sprite.worldAlpha;
        var tint = sprite.tint;

        var verticies = this.vertices;

        // TODO trim??
        var aX = sprite.anchor.x;
        var aY = sprite.anchor.y;

        var w0, w1, h0, h1;

        if (texture.trim) {
            // if the sprite is trimmed then we need to add the extra space before transforming the sprite coords..
            var trim = texture.trim;

            w1 = trim.x - aX * trim.width;
            w0 = w1 + texture.crop.width;

            h1 = trim.y - aY * trim.height;
            h0 = h1 + texture.crop.height;

        } else {
            w0 = (texture.frame.width) * (1 - aX);
            w1 = (texture.frame.width) * -aX;

            h0 = texture.frame.height * (1 - aY);
            h1 = texture.frame.height * -aY;
        }

        var index = this.currentBatchSize * 4 * this.vertSize;

        var resolution = texture.baseTexture.resolution;

        var worldTransform = sprite.worldTransform;

        var a = worldTransform.a / resolution;
        var b = worldTransform.b / resolution;
        var c = worldTransform.c / resolution;
        var d = worldTransform.d / resolution;
        var tx = worldTransform.tx;
        var ty = worldTransform.ty;


        // xy
        verticies[index++] = a * w1 + c * h1 + tx;
        verticies[index++] = d * h1 + b * w1 + ty;
        // uv
        verticies[index++] = uvs.x0;
        verticies[index++] = uvs.y0;
        // color
        verticies[index++] = alpha;
        verticies[index++] = tint;

        // xy
        verticies[index++] = a * w0 + c * h1 + tx;
        verticies[index++] = d * h1 + b * w0 + ty;
        // uv
        verticies[index++] = uvs.x1;
        verticies[index++] = uvs.y1;
        // color
        verticies[index++] = alpha;
        verticies[index++] = tint;

        // xy
        verticies[index++] = a * w0 + c * h0 + tx;
        verticies[index++] = d * h0 + b * w0 + ty;
        // uv
        verticies[index++] = uvs.x2;
        verticies[index++] = uvs.y2;
        // color
        verticies[index++] = alpha;
        verticies[index++] = tint;

        // xy
        verticies[index++] = a * w1 + c * h0 + tx;
        verticies[index++] = d * h0 + b * w1 + ty;
        // uv
        verticies[index++] = uvs.x3;
        verticies[index++] = uvs.y3;
        // color
        verticies[index++] = alpha;
        verticies[index++] = tint;

        // increment the batchsize
        this.sprites[this.currentBatchSize++] = sprite;

    };

    /**
     * Renders a TilingSprite using the spriteBatch.
     * 
     * @method renderTilingSprite
     * @param sprite {TilingSprite} the tilingSprite to render
     */
    PIXI.WebGLSpriteBatch.prototype.renderTilingSprite = function(tilingSprite) {
        var texture = tilingSprite.tilingTexture;

        // check texture..
        if (this.currentBatchSize >= this.size) {
            //return;
            this.flush();
            this.currentBaseTexture = texture.baseTexture;
        }

        // set the textures uvs temporarily
        // TODO create a separate texture so that we can tile part of a texture

        if (!tilingSprite._uvs) tilingSprite._uvs = new PIXI.TextureUvs();

        var uvs = tilingSprite._uvs;

        tilingSprite.tilePosition.x %= texture.baseTexture.width * tilingSprite.tileScaleOffset.x;
        tilingSprite.tilePosition.y %= texture.baseTexture.height * tilingSprite.tileScaleOffset.y;

        var offsetX = tilingSprite.tilePosition.x / (texture.baseTexture.width * tilingSprite.tileScaleOffset.x);
        var offsetY = tilingSprite.tilePosition.y / (texture.baseTexture.height * tilingSprite.tileScaleOffset.y);

        var scaleX = (tilingSprite.width / texture.baseTexture.width) / (tilingSprite.tileScale.x * tilingSprite.tileScaleOffset.x);
        var scaleY = (tilingSprite.height / texture.baseTexture.height) / (tilingSprite.tileScale.y * tilingSprite.tileScaleOffset.y);

        uvs.x0 = 0 - offsetX;
        uvs.y0 = 0 - offsetY;

        uvs.x1 = (1 * scaleX) - offsetX;
        uvs.y1 = 0 - offsetY;

        uvs.x2 = (1 * scaleX) - offsetX;
        uvs.y2 = (1 * scaleY) - offsetY;

        uvs.x3 = 0 - offsetX;
        uvs.y3 = (1 * scaleY) - offsetY;

        // get the tilingSprites current alpha
        var alpha = tilingSprite.worldAlpha;
        var tint = tilingSprite.tint;

        var verticies = this.vertices;

        var width = tilingSprite.width;
        var height = tilingSprite.height;

        // TODO trim??
        var aX = tilingSprite.anchor.x;
        var aY = tilingSprite.anchor.y;
        var w0 = width * (1 - aX);
        var w1 = width * -aX;

        var h0 = height * (1 - aY);
        var h1 = height * -aY;

        var index = this.currentBatchSize * 4 * this.vertSize;

        var resolution = texture.baseTexture.resolution;

        var worldTransform = tilingSprite.worldTransform;

        var a = worldTransform.a / resolution; //[0];
        var b = worldTransform.b / resolution; //[3];
        var c = worldTransform.c / resolution; //[1];
        var d = worldTransform.d / resolution; //[4];
        var tx = worldTransform.tx; //[2];
        var ty = worldTransform.ty; ///[5];

        // xy
        verticies[index++] = a * w1 + c * h1 + tx;
        verticies[index++] = d * h1 + b * w1 + ty;
        // uv
        verticies[index++] = uvs.x0;
        verticies[index++] = uvs.y0;
        // color
        verticies[index++] = alpha;
        verticies[index++] = tint;

        // xy
        verticies[index++] = (a * w0 + c * h1 + tx);
        verticies[index++] = d * h1 + b * w0 + ty;
        // uv
        verticies[index++] = uvs.x1;
        verticies[index++] = uvs.y1;
        // color
        verticies[index++] = alpha;
        verticies[index++] = tint;

        // xy
        verticies[index++] = a * w0 + c * h0 + tx;
        verticies[index++] = d * h0 + b * w0 + ty;
        // uv
        verticies[index++] = uvs.x2;
        verticies[index++] = uvs.y2;
        // color
        verticies[index++] = alpha;
        verticies[index++] = tint;

        // xy
        verticies[index++] = a * w1 + c * h0 + tx;
        verticies[index++] = d * h0 + b * w1 + ty;
        // uv
        verticies[index++] = uvs.x3;
        verticies[index++] = uvs.y3;
        // color
        verticies[index++] = alpha;
        verticies[index++] = tint;

        // increment the batchsize
        this.sprites[this.currentBatchSize++] = tilingSprite;
    };

    /**
     * Renders the content and empties the current batch.
     *
     * @method flush
     */
    PIXI.WebGLSpriteBatch.prototype.flush = function() {
        // If the batch is length 0 then return as there is nothing to draw
        if (this.currentBatchSize === 0) return;

        var gl = this.gl;
        var shader;

        if (this.dirty) {
            this.dirty = false;
            // bind the main texture
            gl.activeTexture(gl.TEXTURE0);

            // bind the buffers
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

            shader = this.defaultShader.shaders[gl.id];

            // this is the same for each shader?
            var stride = this.vertSize * 4;
            gl.vertexAttribPointer(shader.aVertexPosition, 2, gl.FLOAT, false, stride, 0);
            gl.vertexAttribPointer(shader.aTextureCoord, 2, gl.FLOAT, false, stride, 2 * 4);
            gl.vertexAttribPointer(shader.colorAttribute, 2, gl.FLOAT, false, stride, 4 * 4);
        }

        // upload the verts to the buffer  
        if (this.currentBatchSize > (this.size * 0.5)) {
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices);
        } else {
            var view = this.vertices.subarray(0, this.currentBatchSize * 4 * this.vertSize);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, view);
        }

        var nextTexture, nextBlendMode, nextShader;
        var batchSize = 0;
        var start = 0;

        var currentBaseTexture = null;
        var currentBlendMode = this.renderSession.blendModeManager.currentBlendMode;
        var currentShader = null;

        var blendSwap = false;
        var shaderSwap = false;
        var sprite;

        for (var i = 0, j = this.currentBatchSize; i < j; i++) {

            sprite = this.sprites[i];

            nextTexture = sprite.texture.baseTexture;
            nextBlendMode = sprite.blendMode;
            nextShader = sprite.shader || this.defaultShader;

            blendSwap = currentBlendMode !== nextBlendMode;
            shaderSwap = currentShader !== nextShader; // should I use _UIDS???

            if (currentBaseTexture !== nextTexture || blendSwap || shaderSwap) {
                this.renderBatch(currentBaseTexture, batchSize, start);

                start = i;
                batchSize = 0;
                currentBaseTexture = nextTexture;

                if (blendSwap) {
                    currentBlendMode = nextBlendMode;
                    this.renderSession.blendModeManager.setBlendMode(currentBlendMode);
                }

                if (shaderSwap) {
                    currentShader = nextShader;

                    shader = currentShader.shaders[gl.id];

                    if (!shader) {
                        shader = new PIXI.PixiShader(gl);

                        shader.fragmentSrc = currentShader.fragmentSrc;
                        shader.uniforms = currentShader.uniforms;
                        shader.init();

                        currentShader.shaders[gl.id] = shader;
                    }

                    // set shader function???
                    this.renderSession.shaderManager.setShader(shader);

                    if (shader.dirty) shader.syncUniforms();

                    // both thease only need to be set if they are changing..
                    // set the projection
                    var projection = this.renderSession.projection;
                    gl.uniform2f(shader.projectionVector, projection.x, projection.y);

                    // TODO - this is temprorary!
                    var offsetVector = this.renderSession.offset;
                    gl.uniform2f(shader.offsetVector, offsetVector.x, offsetVector.y);

                    // set the pointers
                }
            }

            batchSize++;
        }

        this.renderBatch(currentBaseTexture, batchSize, start);

        // then reset the batch!
        this.currentBatchSize = 0;
    };

    /**
     * @method renderBatch
     * @param texture {Texture}
     * @param size {Number}
     * @param startIndex {Number}
     */
    PIXI.WebGLSpriteBatch.prototype.renderBatch = function(texture, size, startIndex) {
        if (size === 0) return;

        var gl = this.gl;

        // check if a texture is dirty..
        if (texture._dirty[gl.id]) {
            this.renderSession.renderer.updateTexture(texture);
        } else {
            // bind the current texture
            gl.bindTexture(gl.TEXTURE_2D, texture._glTextures[gl.id]);
        }

        // now draw those suckas!
        gl.drawElements(gl.TRIANGLES, size * 6, gl.UNSIGNED_SHORT, startIndex * 6 * 2);

        // increment the draw count
        this.renderSession.drawCount++;
    };

    /**
     * @method stop
     */
    PIXI.WebGLSpriteBatch.prototype.stop = function() {
        this.flush();
        this.dirty = true;
    };

    /**
     * @method start
     */
    PIXI.WebGLSpriteBatch.prototype.start = function() {
        this.dirty = true;
    };

    /**
     * Destroys the SpriteBatch.
     * 
     * @method destroy
     */
    PIXI.WebGLSpriteBatch.prototype.destroy = function() {
        this.vertices = null;
        this.indices = null;

        this.gl.deleteBuffer(this.vertexBuffer);
        this.gl.deleteBuffer(this.indexBuffer);

        this.currentBaseTexture = null;

        this.gl = null;
    };

    /**
     * @author Mat Groves
     * 
     * Big thanks to the very clever Matt DesLauriers <mattdesl> https://github.com/mattdesl/
     * for creating the original pixi version!
     *
     * Heavily inspired by LibGDX's WebGLSpriteBatch:
     * https://github.com/libgdx/libgdx/blob/master/gdx/src/com/badlogic/gdx/graphics/g2d/WebGLSpriteBatch.java
     */

    /**
     * @class WebGLFastSpriteBatch
     * @constructor
     */
    PIXI.WebGLFastSpriteBatch = function(gl) {
        /**
         * @property vertSize
         * @type Number
         */
        this.vertSize = 10;

        /**
         * @property maxSize
         * @type Number
         */
        this.maxSize = 6000; //Math.pow(2, 16) /  this.vertSize;

        /**
         * @property size
         * @type Number
         */
        this.size = this.maxSize;

        //the total number of floats in our batch
        var numVerts = this.size * 4 * this.vertSize;

        //the total number of indices in our batch
        var numIndices = this.maxSize * 6;

        /**
         * Vertex data
         * @property vertices
         * @type Float32Array
         */
        this.vertices = new Float32Array(numVerts);

        /**
         * Index data
         * @property indices
         * @type Uint16Array
         */
        this.indices = new Uint16Array(numIndices);

        /**
         * @property vertexBuffer
         * @type Object
         */
        this.vertexBuffer = null;

        /**
         * @property indexBuffer
         * @type Object
         */
        this.indexBuffer = null;

        /**
         * @property lastIndexCount
         * @type Number
         */
        this.lastIndexCount = 0;

        for (var i = 0, j = 0; i < numIndices; i += 6, j += 4) {
            this.indices[i + 0] = j + 0;
            this.indices[i + 1] = j + 1;
            this.indices[i + 2] = j + 2;
            this.indices[i + 3] = j + 0;
            this.indices[i + 4] = j + 2;
            this.indices[i + 5] = j + 3;
        }

        /**
         * @property drawing
         * @type Boolean
         */
        this.drawing = false;

        /**
         * @property currentBatchSize
         * @type Number
         */
        this.currentBatchSize = 0;

        /**
         * @property currentBaseTexture
         * @type BaseTexture
         */
        this.currentBaseTexture = null;

        /**
         * @property currentBlendMode
         * @type Number
         */
        this.currentBlendMode = 0;

        /**
         * @property renderSession
         * @type Object
         */
        this.renderSession = null;

        /**
         * @property shader
         * @type Object
         */
        this.shader = null;

        /**
         * @property matrix
         * @type Matrix
         */
        this.matrix = null;

        this.setContext(gl);
    };

    PIXI.WebGLFastSpriteBatch.prototype.constructor = PIXI.WebGLFastSpriteBatch;

    /**
     * Sets the WebGL Context.
     *
     * @method setContext
     * @param gl {WebGLContext} the current WebGL drawing context
     */
    PIXI.WebGLFastSpriteBatch.prototype.setContext = function(gl) {
        this.gl = gl;

        // create a couple of buffers
        this.vertexBuffer = gl.createBuffer();
        this.indexBuffer = gl.createBuffer();

        // 65535 is max index, so 65535 / 6 = 10922.

        //upload the index data
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.DYNAMIC_DRAW);
    };

    /**
     * @method begin
     * @param spriteBatch {WebGLSpriteBatch}
     * @param renderSession {Object}
     */
    PIXI.WebGLFastSpriteBatch.prototype.begin = function(spriteBatch, renderSession) {
        this.renderSession = renderSession;
        this.shader = this.renderSession.shaderManager.fastShader;

        this.matrix = spriteBatch.worldTransform.toArray(true);

        this.start();
    };

    /**
     * @method end
     */
    PIXI.WebGLFastSpriteBatch.prototype.end = function() {
        this.flush();
    };

    /**
     * @method render
     * @param spriteBatch {WebGLSpriteBatch}
     */
    PIXI.WebGLFastSpriteBatch.prototype.render = function(spriteBatch) {
        var children = spriteBatch.children;
        var sprite = children[0];

        // if the uvs have not updated then no point rendering just yet!

        // check texture.
        if (!sprite.texture._uvs) return;

        this.currentBaseTexture = sprite.texture.baseTexture;

        // check blend mode
        if (sprite.blendMode !== this.renderSession.blendModeManager.currentBlendMode) {
            this.flush();
            this.renderSession.blendModeManager.setBlendMode(sprite.blendMode);
        }

        for (var i = 0, j = children.length; i < j; i++) {
            this.renderSprite(children[i]);
        }

        this.flush();
    };

    /**
     * @method renderSprite
     * @param sprite {Sprite}
     */
    PIXI.WebGLFastSpriteBatch.prototype.renderSprite = function(sprite) {
        //sprite = children[i];
        if (!sprite.visible) return;

        // TODO trim??
        if (sprite.texture.baseTexture !== this.currentBaseTexture) {
            this.flush();
            this.currentBaseTexture = sprite.texture.baseTexture;

            if (!sprite.texture._uvs) return;
        }

        var uvs, verticies = this.vertices,
            width, height, w0, w1, h0, h1, index;

        uvs = sprite.texture._uvs;

        width = sprite.texture.frame.width;
        height = sprite.texture.frame.height;

        if (sprite.texture.trim) {
            // if the sprite is trimmed then we need to add the extra space before transforming the sprite coords..
            var trim = sprite.texture.trim;

            w1 = trim.x - sprite.anchor.x * trim.width;
            w0 = w1 + sprite.texture.crop.width;

            h1 = trim.y - sprite.anchor.y * trim.height;
            h0 = h1 + sprite.texture.crop.height;
        } else {
            w0 = (sprite.texture.frame.width) * (1 - sprite.anchor.x);
            w1 = (sprite.texture.frame.width) * -sprite.anchor.x;

            h0 = sprite.texture.frame.height * (1 - sprite.anchor.y);
            h1 = sprite.texture.frame.height * -sprite.anchor.y;
        }

        index = this.currentBatchSize * 4 * this.vertSize;

        // xy
        verticies[index++] = w1;
        verticies[index++] = h1;

        verticies[index++] = sprite.position.x;
        verticies[index++] = sprite.position.y;

        //scale
        verticies[index++] = sprite.scale.x;
        verticies[index++] = sprite.scale.y;

        //rotation
        verticies[index++] = sprite.rotation;

        // uv
        verticies[index++] = uvs.x0;
        verticies[index++] = uvs.y1;
        // color
        verticies[index++] = sprite.alpha;


        // xy
        verticies[index++] = w0;
        verticies[index++] = h1;

        verticies[index++] = sprite.position.x;
        verticies[index++] = sprite.position.y;

        //scale
        verticies[index++] = sprite.scale.x;
        verticies[index++] = sprite.scale.y;

        //rotation
        verticies[index++] = sprite.rotation;

        // uv
        verticies[index++] = uvs.x1;
        verticies[index++] = uvs.y1;
        // color
        verticies[index++] = sprite.alpha;


        // xy
        verticies[index++] = w0;
        verticies[index++] = h0;

        verticies[index++] = sprite.position.x;
        verticies[index++] = sprite.position.y;

        //scale
        verticies[index++] = sprite.scale.x;
        verticies[index++] = sprite.scale.y;

        //rotation
        verticies[index++] = sprite.rotation;

        // uv
        verticies[index++] = uvs.x2;
        verticies[index++] = uvs.y2;
        // color
        verticies[index++] = sprite.alpha;




        // xy
        verticies[index++] = w1;
        verticies[index++] = h0;

        verticies[index++] = sprite.position.x;
        verticies[index++] = sprite.position.y;

        //scale
        verticies[index++] = sprite.scale.x;
        verticies[index++] = sprite.scale.y;

        //rotation
        verticies[index++] = sprite.rotation;

        // uv
        verticies[index++] = uvs.x3;
        verticies[index++] = uvs.y3;
        // color
        verticies[index++] = sprite.alpha;

        // increment the batchs
        this.currentBatchSize++;

        if (this.currentBatchSize >= this.size) {
            this.flush();
        }
    };

    /**
     * @method flush
     */
    PIXI.WebGLFastSpriteBatch.prototype.flush = function() {
        // If the batch is length 0 then return as there is nothing to draw
        if (this.currentBatchSize === 0) return;

        var gl = this.gl;

        // bind the current texture

        if (!this.currentBaseTexture._glTextures[gl.id]) this.renderSession.renderer.updateTexture(this.currentBaseTexture, gl);

        gl.bindTexture(gl.TEXTURE_2D, this.currentBaseTexture._glTextures[gl.id]);

        // upload the verts to the buffer

        if (this.currentBatchSize > (this.size * 0.5)) {
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices);
        } else {
            var view = this.vertices.subarray(0, this.currentBatchSize * 4 * this.vertSize);

            gl.bufferSubData(gl.ARRAY_BUFFER, 0, view);
        }

        // now draw those suckas!
        gl.drawElements(gl.TRIANGLES, this.currentBatchSize * 6, gl.UNSIGNED_SHORT, 0);

        // then reset the batch!
        this.currentBatchSize = 0;

        // increment the draw count
        this.renderSession.drawCount++;
    };


    /**
     * @method stop
     */
    PIXI.WebGLFastSpriteBatch.prototype.stop = function() {
        this.flush();
    };

    /**
     * @method start
     */
    PIXI.WebGLFastSpriteBatch.prototype.start = function() {
        var gl = this.gl;

        // bind the main texture
        gl.activeTexture(gl.TEXTURE0);

        // bind the buffers
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

        // set the projection
        var projection = this.renderSession.projection;
        gl.uniform2f(this.shader.projectionVector, projection.x, projection.y);

        // set the matrix
        gl.uniformMatrix3fv(this.shader.uMatrix, false, this.matrix);

        // set the pointers
        var stride = this.vertSize * 4;

        gl.vertexAttribPointer(this.shader.aVertexPosition, 2, gl.FLOAT, false, stride, 0);
        gl.vertexAttribPointer(this.shader.aPositionCoord, 2, gl.FLOAT, false, stride, 2 * 4);
        gl.vertexAttribPointer(this.shader.aScale, 2, gl.FLOAT, false, stride, 4 * 4);
        gl.vertexAttribPointer(this.shader.aRotation, 1, gl.FLOAT, false, stride, 6 * 4);
        gl.vertexAttribPointer(this.shader.aTextureCoord, 2, gl.FLOAT, false, stride, 7 * 4);
        gl.vertexAttribPointer(this.shader.colorAttribute, 1, gl.FLOAT, false, stride, 9 * 4);

    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * @class WebGLFilterManager
     * @constructor
     */
    PIXI.WebGLFilterManager = function() {
        /**
         * @property filterStack
         * @type Array
         */
        this.filterStack = [];

        /**
         * @property offsetX
         * @type Number
         */
        this.offsetX = 0;

        /**
         * @property offsetY
         * @type Number
         */
        this.offsetY = 0;
    };

    PIXI.WebGLFilterManager.prototype.constructor = PIXI.WebGLFilterManager;

    /**
     * Initialises the context and the properties.
     * 
     * @method setContext 
     * @param gl {WebGLContext} the current WebGL drawing context
     */
    PIXI.WebGLFilterManager.prototype.setContext = function(gl) {
        this.gl = gl;
        this.texturePool = [];

        this.initShaderBuffers();
    };

    /**
     * @method begin
     * @param renderSession {RenderSession} 
     * @param buffer {ArrayBuffer} 
     */
    PIXI.WebGLFilterManager.prototype.begin = function(renderSession, buffer) {
        this.renderSession = renderSession;
        this.defaultShader = renderSession.shaderManager.defaultShader;

        var projection = this.renderSession.projection;
        this.width = projection.x * 2;
        this.height = -projection.y * 2;
        this.buffer = buffer;
    };

    /**
     * Applies the filter and adds it to the current filter stack.
     * 
     * @method pushFilter
     * @param filterBlock {Object} the filter that will be pushed to the current filter stack
     */
    PIXI.WebGLFilterManager.prototype.pushFilter = function(filterBlock) {
        var gl = this.gl;

        var projection = this.renderSession.projection;
        var offset = this.renderSession.offset;

        filterBlock._filterArea = filterBlock.target.filterArea || filterBlock.target.getBounds();

        // filter program
        // OPTIMISATION - the first filter is free if its a simple color change?
        this.filterStack.push(filterBlock);

        var filter = filterBlock.filterPasses[0];

        this.offsetX += filterBlock._filterArea.x;
        this.offsetY += filterBlock._filterArea.y;

        var texture = this.texturePool.pop();
        if (!texture) {
            texture = new PIXI.FilterTexture(this.gl, this.width, this.height);
        } else {
            texture.resize(this.width, this.height);
        }

        gl.bindTexture(gl.TEXTURE_2D, texture.texture);

        var filterArea = filterBlock._filterArea; // filterBlock.target.getBounds();///filterBlock.target.filterArea;

        var padding = filter.padding;
        filterArea.x -= padding;
        filterArea.y -= padding;
        filterArea.width += padding * 2;
        filterArea.height += padding * 2;

        // cap filter to screen size..
        if (filterArea.x < 0) filterArea.x = 0;
        if (filterArea.width > this.width) filterArea.width = this.width;
        if (filterArea.y < 0) filterArea.y = 0;
        if (filterArea.height > this.height) filterArea.height = this.height;

        //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,  filterArea.width, filterArea.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, texture.frameBuffer);

        // set view port
        gl.viewport(0, 0, filterArea.width, filterArea.height);

        projection.x = filterArea.width / 2;
        projection.y = -filterArea.height / 2;

        offset.x = -filterArea.x;
        offset.y = -filterArea.y;

        // update projection
        // now restore the regular shader..
        // this.renderSession.shaderManager.setShader(this.defaultShader);
        //gl.uniform2f(this.defaultShader.projectionVector, filterArea.width/2, -filterArea.height/2);
        //gl.uniform2f(this.defaultShader.offsetVector, -filterArea.x, -filterArea.y);

        gl.colorMask(true, true, true, true);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        filterBlock._glFilterTexture = texture;

    };

    /**
     * Removes the last filter from the filter stack and doesn't return it.
     * 
     * @method popFilter
     */
    PIXI.WebGLFilterManager.prototype.popFilter = function() {
        var gl = this.gl;
        var filterBlock = this.filterStack.pop();
        var filterArea = filterBlock._filterArea;
        var texture = filterBlock._glFilterTexture;
        var projection = this.renderSession.projection;
        var offset = this.renderSession.offset;

        if (filterBlock.filterPasses.length > 1) {
            gl.viewport(0, 0, filterArea.width, filterArea.height);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

            this.vertexArray[0] = 0;
            this.vertexArray[1] = filterArea.height;

            this.vertexArray[2] = filterArea.width;
            this.vertexArray[3] = filterArea.height;

            this.vertexArray[4] = 0;
            this.vertexArray[5] = 0;

            this.vertexArray[6] = filterArea.width;
            this.vertexArray[7] = 0;

            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertexArray);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
            // now set the uvs..
            this.uvArray[2] = filterArea.width / this.width;
            this.uvArray[5] = filterArea.height / this.height;
            this.uvArray[6] = filterArea.width / this.width;
            this.uvArray[7] = filterArea.height / this.height;

            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.uvArray);

            var inputTexture = texture;
            var outputTexture = this.texturePool.pop();
            if (!outputTexture) outputTexture = new PIXI.FilterTexture(this.gl, this.width, this.height);
            outputTexture.resize(this.width, this.height);

            // need to clear this FBO as it may have some left over elements from a previous filter.
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputTexture.frameBuffer);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.disable(gl.BLEND);

            for (var i = 0; i < filterBlock.filterPasses.length - 1; i++) {
                var filterPass = filterBlock.filterPasses[i];

                gl.bindFramebuffer(gl.FRAMEBUFFER, outputTexture.frameBuffer);

                // set texture
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, inputTexture.texture);

                // draw texture..
                //filterPass.applyFilterPass(filterArea.width, filterArea.height);
                this.applyFilterPass(filterPass, filterArea, filterArea.width, filterArea.height);

                // swap the textures..
                var temp = inputTexture;
                inputTexture = outputTexture;
                outputTexture = temp;
            }

            gl.enable(gl.BLEND);

            texture = inputTexture;
            this.texturePool.push(outputTexture);
        }

        var filter = filterBlock.filterPasses[filterBlock.filterPasses.length - 1];

        this.offsetX -= filterArea.x;
        this.offsetY -= filterArea.y;

        var sizeX = this.width;
        var sizeY = this.height;

        var offsetX = 0;
        var offsetY = 0;

        var buffer = this.buffer;

        // time to render the filters texture to the previous scene
        if (this.filterStack.length === 0) {
            gl.colorMask(true, true, true, true); //this.transparent);
        } else {
            var currentFilter = this.filterStack[this.filterStack.length - 1];
            filterArea = currentFilter._filterArea;

            sizeX = filterArea.width;
            sizeY = filterArea.height;

            offsetX = filterArea.x;
            offsetY = filterArea.y;

            buffer = currentFilter._glFilterTexture.frameBuffer;
        }

        // TODO need to remove these global elements..
        projection.x = sizeX / 2;
        projection.y = -sizeY / 2;

        offset.x = offsetX;
        offset.y = offsetY;

        filterArea = filterBlock._filterArea;

        var x = filterArea.x - offsetX;
        var y = filterArea.y - offsetY;

        // update the buffers..
        // make sure to flip the y!
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

        this.vertexArray[0] = x;
        this.vertexArray[1] = y + filterArea.height;

        this.vertexArray[2] = x + filterArea.width;
        this.vertexArray[3] = y + filterArea.height;

        this.vertexArray[4] = x;
        this.vertexArray[5] = y;

        this.vertexArray[6] = x + filterArea.width;
        this.vertexArray[7] = y;

        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertexArray);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);

        this.uvArray[2] = filterArea.width / this.width;
        this.uvArray[5] = filterArea.height / this.height;
        this.uvArray[6] = filterArea.width / this.width;
        this.uvArray[7] = filterArea.height / this.height;

        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.uvArray);

        gl.viewport(0, 0, sizeX, sizeY);

        // bind the buffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);

        // set the blend mode! 
        //gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

        // set texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture.texture);

        // apply!
        this.applyFilterPass(filter, filterArea, sizeX, sizeY);

        // now restore the regular shader.. should happen automatically now..
        // this.renderSession.shaderManager.setShader(this.defaultShader);
        // gl.uniform2f(this.defaultShader.projectionVector, sizeX/2, -sizeY/2);
        // gl.uniform2f(this.defaultShader.offsetVector, -offsetX, -offsetY);

        // return the texture to the pool
        this.texturePool.push(texture);
        filterBlock._glFilterTexture = null;
    };


    /**
     * Applies the filter to the specified area.
     * 
     * @method applyFilterPass
     * @param filter {AbstractFilter} the filter that needs to be applied
     * @param filterArea {Texture} TODO - might need an update
     * @param width {Number} the horizontal range of the filter
     * @param height {Number} the vertical range of the filter
     */
    PIXI.WebGLFilterManager.prototype.applyFilterPass = function(filter, filterArea, width, height) {
        // use program
        var gl = this.gl;
        var shader = filter.shaders[gl.id];

        if (!shader) {
            shader = new PIXI.PixiShader(gl);

            shader.fragmentSrc = filter.fragmentSrc;
            shader.uniforms = filter.uniforms;
            shader.init();

            filter.shaders[gl.id] = shader;
        }

        // set the shader
        this.renderSession.shaderManager.setShader(shader);

        //    gl.useProgram(shader.program);

        gl.uniform2f(shader.projectionVector, width / 2, -height / 2);
        gl.uniform2f(shader.offsetVector, 0, 0);

        if (filter.uniforms.dimensions) {
            filter.uniforms.dimensions.value[0] = this.width; //width;
            filter.uniforms.dimensions.value[1] = this.height; //height;
            filter.uniforms.dimensions.value[2] = this.vertexArray[0];
            filter.uniforms.dimensions.value[3] = this.vertexArray[5]; //filterArea.height;
        }

        shader.syncUniforms();

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.vertexAttribPointer(shader.aVertexPosition, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
        gl.vertexAttribPointer(shader.aTextureCoord, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.vertexAttribPointer(shader.colorAttribute, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

        // draw the filter...
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

        this.renderSession.drawCount++;
    };

    /**
     * Initialises the shader buffers.
     * 
     * @method initShaderBuffers
     */
    PIXI.WebGLFilterManager.prototype.initShaderBuffers = function() {
        var gl = this.gl;

        // create some buffers
        this.vertexBuffer = gl.createBuffer();
        this.uvBuffer = gl.createBuffer();
        this.colorBuffer = gl.createBuffer();
        this.indexBuffer = gl.createBuffer();

        // bind and upload the vertexs..
        // keep a reference to the vertexFloatData..
        this.vertexArray = new Float32Array([0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            1.0, 1.0
        ]);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.vertexArray, gl.STATIC_DRAW);

        // bind and upload the uv buffer
        this.uvArray = new Float32Array([0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            1.0, 1.0
        ]);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.uvArray, gl.STATIC_DRAW);

        this.colorArray = new Float32Array([1.0, 0xFFFFFF,
            1.0, 0xFFFFFF,
            1.0, 0xFFFFFF,
            1.0, 0xFFFFFF
        ]);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.colorArray, gl.STATIC_DRAW);

        // bind and upload the index
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 1, 3, 2]), gl.STATIC_DRAW);

    };

    /**
     * Destroys the filter and removes it from the filter stack.
     * 
     * @method destroy
     */
    PIXI.WebGLFilterManager.prototype.destroy = function() {
        var gl = this.gl;

        this.filterStack = null;

        this.offsetX = 0;
        this.offsetY = 0;

        // destroy textures
        for (var i = 0; i < this.texturePool.length; i++) {
            this.texturePool[i].destroy();
        }

        this.texturePool = null;

        //destroy buffers..
        gl.deleteBuffer(this.vertexBuffer);
        gl.deleteBuffer(this.uvBuffer);
        gl.deleteBuffer(this.colorBuffer);
        gl.deleteBuffer(this.indexBuffer);
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * @class FilterTexture
     * @constructor
     * @param gl {WebGLContext} the current WebGL drawing context
     * @param width {Number} the horizontal range of the filter
     * @param height {Number} the vertical range of the filter
     * @param scaleMode {Number} Should be one of the PIXI.scaleMode consts
     */
    PIXI.FilterTexture = function(gl, width, height, scaleMode) {
        /**
         * @property gl
         * @type WebGLContext
         */
        this.gl = gl;

        // next time to create a frame buffer and texture

        /**
         * @property frameBuffer
         * @type Any
         */
        this.frameBuffer = gl.createFramebuffer();

        /**
         * @property texture
         * @type Any
         */
        this.texture = gl.createTexture();

        /**
         * @property scaleMode
         * @type Number
         */
        scaleMode = scaleMode || PIXI.scaleModes.DEFAULT;

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, scaleMode === PIXI.scaleModes.LINEAR ? gl.LINEAR : gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, scaleMode === PIXI.scaleModes.LINEAR ? gl.LINEAR : gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);

        // required for masking a mask??
        this.renderBuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderBuffer);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this.renderBuffer);

        this.resize(width, height);
    };

    PIXI.FilterTexture.prototype.constructor = PIXI.FilterTexture;

    /**
     * Clears the filter texture.
     * 
     * @method clear
     */
    PIXI.FilterTexture.prototype.clear = function() {
        var gl = this.gl;

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    };

    /**
     * Resizes the texture to the specified width and height
     *
     * @method resize
     * @param width {Number} the new width of the texture
     * @param height {Number} the new height of the texture
     */
    PIXI.FilterTexture.prototype.resize = function(width, height) {
        if (this.width === width && this.height === height) return;

        this.width = width;
        this.height = height;

        var gl = this.gl;

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        // update the stencil buffer width and height
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderBuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, width, height);
    };

    /**
     * Destroys the filter texture.
     * 
     * @method destroy
     */
    PIXI.FilterTexture.prototype.destroy = function() {
        var gl = this.gl;
        gl.deleteFramebuffer(this.frameBuffer);
        gl.deleteTexture(this.texture);

        this.frameBuffer = null;
        this.texture = null;
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * Creates a Canvas element of the given size.
     *
     * @class CanvasBuffer
     * @constructor
     * @param width {Number} the width for the newly created canvas
     * @param height {Number} the height for the newly created canvas
     */
    PIXI.CanvasBuffer = function(width, height) {
        /**
         * The width of the Canvas in pixels.
         *
         * @property width
         * @type Number
         */
        this.width = width;

        /**
         * The height of the Canvas in pixels.
         *
         * @property height
         * @type Number
         */
        this.height = height;

        /**
         * The Canvas object that belongs to this CanvasBuffer.
         *
         * @property canvas
         * @type HTMLCanvasElement
         */
        this.canvas = document.createElement("canvas");

        /**
         * A CanvasRenderingContext2D object representing a two-dimensional rendering context.
         *
         * @property context
         * @type CanvasRenderingContext2D
         */
        this.context = this.canvas.getContext("2d");

        this.canvas.width = width;
        this.canvas.height = height;
    };

    PIXI.CanvasBuffer.prototype.constructor = PIXI.CanvasBuffer;

    /**
     * Clears the canvas that was created by the CanvasBuffer class.
     *
     * @method clear
     * @private
     */
    PIXI.CanvasBuffer.prototype.clear = function() {
        this.context.clearRect(0, 0, this.width, this.height);
    };

    /**
     * Resizes the canvas to the specified width and height.
     *
     * @method resize
     * @param width {Number} the new width of the canvas
     * @param height {Number} the new height of the canvas
     */
    PIXI.CanvasBuffer.prototype.resize = function(width, height) {
        this.width = this.canvas.width = width;
        this.height = this.canvas.height = height;
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * A set of functions used to handle masking.
     *
     * @class CanvasMaskManager
     * @constructor
     */
    PIXI.CanvasMaskManager = function() {};

    PIXI.CanvasMaskManager.prototype.constructor = PIXI.CanvasMaskManager;

    /**
     * This method adds it to the current stack of masks.
     *
     * @method pushMask
     * @param maskData {Object} the maskData that will be pushed
     * @param renderSession {Object} The renderSession whose context will be used for this mask manager.
     */
    PIXI.CanvasMaskManager.prototype.pushMask = function(maskData, renderSession) {
        var context = renderSession.context;

        context.save();

        var cacheAlpha = maskData.alpha;
        var transform = maskData.worldTransform;

        var resolution = renderSession.resolution;

        context.setTransform(transform.a * resolution,
            transform.b * resolution,
            transform.c * resolution,
            transform.d * resolution,
            transform.tx * resolution,
            transform.ty * resolution);

        PIXI.CanvasGraphics.renderGraphicsMask(maskData, context);

        context.clip();

        maskData.worldAlpha = cacheAlpha;
    };

    /**
     * Restores the current drawing context to the state it was before the mask was applied.
     *
     * @method popMask
     * @param renderSession {Object} The renderSession whose context will be used for this mask manager.
     */
    PIXI.CanvasMaskManager.prototype.popMask = function(renderSession) {
        renderSession.context.restore();
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * @class CanvasTinter
     * @constructor
     * @static
     */
    PIXI.CanvasTinter = function() {};

    /**
     * Basically this method just needs a sprite and a color and tints the sprite with the given color.
     * 
     * @method getTintedTexture 
     * @param sprite {Sprite} the sprite to tint
     * @param color {Number} the color to use to tint the sprite with
     * @return {HTMLCanvasElement} The tinted canvas
     */
    PIXI.CanvasTinter.getTintedTexture = function(sprite, color) {
        var texture = sprite.texture;

        color = PIXI.CanvasTinter.roundColor(color);

        var stringColor = "#" + ("00000" + (color | 0).toString(16)).substr(-6);

        texture.tintCache = texture.tintCache || {};

        if (texture.tintCache[stringColor]) return texture.tintCache[stringColor];

        // clone texture..
        var canvas = PIXI.CanvasTinter.canvas || document.createElement("canvas");

        //PIXI.CanvasTinter.tintWithPerPixel(texture, stringColor, canvas);
        PIXI.CanvasTinter.tintMethod(texture, color, canvas);

        if (PIXI.CanvasTinter.convertTintToImage) {
            // is this better?
            var tintImage = new Image();
            tintImage.src = canvas.toDataURL();

            texture.tintCache[stringColor] = tintImage;
        } else {
            texture.tintCache[stringColor] = canvas;
            // if we are not converting the texture to an image then we need to lose the reference to the canvas
            PIXI.CanvasTinter.canvas = null;
        }

        return canvas;
    };

    /**
     * Tint a texture using the "multiply" operation.
     * 
     * @method tintWithMultiply
     * @param texture {Texture} the texture to tint
     * @param color {Number} the color to use to tint the sprite with
     * @param canvas {HTMLCanvasElement} the current canvas
     */
    PIXI.CanvasTinter.tintWithMultiply = function(texture, color, canvas) {
        var context = canvas.getContext("2d");

        var crop = texture.crop;

        canvas.width = crop.width;
        canvas.height = crop.height;

        context.fillStyle = "#" + ("00000" + (color | 0).toString(16)).substr(-6);

        context.fillRect(0, 0, crop.width, crop.height);

        context.globalCompositeOperation = "multiply";

        context.drawImage(texture.baseTexture.source,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            0,
            0,
            crop.width,
            crop.height);

        context.globalCompositeOperation = "destination-atop";

        context.drawImage(texture.baseTexture.source,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            0,
            0,
            crop.width,
            crop.height);
    };

    /**
     * Tint a texture using the "overlay" operation.
     * 
     * @method tintWithOverlay
     * @param texture {Texture} the texture to tint
     * @param color {Number} the color to use to tint the sprite with
     * @param canvas {HTMLCanvasElement} the current canvas
     */
    PIXI.CanvasTinter.tintWithOverlay = function(texture, color, canvas) {
        var context = canvas.getContext("2d");

        var crop = texture.crop;

        canvas.width = crop.width;
        canvas.height = crop.height;

        context.globalCompositeOperation = "copy";
        context.fillStyle = "#" + ("00000" + (color | 0).toString(16)).substr(-6);
        context.fillRect(0, 0, crop.width, crop.height);

        context.globalCompositeOperation = "destination-atop";
        context.drawImage(texture.baseTexture.source,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            0,
            0,
            crop.width,
            crop.height);

        //context.globalCompositeOperation = "copy";
    };

    /**
     * Tint a texture pixel per pixel.
     * 
     * @method tintPerPixel
     * @param texture {Texture} the texture to tint
     * @param color {Number} the color to use to tint the sprite with
     * @param canvas {HTMLCanvasElement} the current canvas
     */
    PIXI.CanvasTinter.tintWithPerPixel = function(texture, color, canvas) {
        var context = canvas.getContext("2d");

        var crop = texture.crop;

        canvas.width = crop.width;
        canvas.height = crop.height;

        context.globalCompositeOperation = "copy";
        context.drawImage(texture.baseTexture.source,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            0,
            0,
            crop.width,
            crop.height);

        var rgbValues = PIXI.hex2rgb(color);
        var r = rgbValues[0],
            g = rgbValues[1],
            b = rgbValues[2];

        var pixelData = context.getImageData(0, 0, crop.width, crop.height);

        var pixels = pixelData.data;

        for (var i = 0; i < pixels.length; i += 4) {
            pixels[i + 0] *= r;
            pixels[i + 1] *= g;
            pixels[i + 2] *= b;
        }

        context.putImageData(pixelData, 0, 0);
    };

    /**
     * Rounds the specified color according to the PIXI.CanvasTinter.cacheStepsPerColorChannel.
     * 
     * @method roundColor
     * @param color {number} the color to round, should be a hex color
     */
    PIXI.CanvasTinter.roundColor = function(color) {
        var step = PIXI.CanvasTinter.cacheStepsPerColorChannel;

        var rgbValues = PIXI.hex2rgb(color);

        rgbValues[0] = Math.min(255, (rgbValues[0] / step) * step);
        rgbValues[1] = Math.min(255, (rgbValues[1] / step) * step);
        rgbValues[2] = Math.min(255, (rgbValues[2] / step) * step);

        return PIXI.rgb2hex(rgbValues);
    };

    /**
     * Number of steps which will be used as a cap when rounding colors.
     *
     * @property cacheStepsPerColorChannel
     * @type Number
     */
    PIXI.CanvasTinter.cacheStepsPerColorChannel = 8;

    /**
     * Tint cache boolean flag.
     *
     * @property convertTintToImage
     * @type Boolean
     */
    PIXI.CanvasTinter.convertTintToImage = false;

    /**
     * Whether or not the Canvas BlendModes are supported, consequently the ability to tint using the multiply method.
     *
     * @property canUseMultiply
     * @type Boolean
     */
    PIXI.CanvasTinter.canUseMultiply = PIXI.canUseNewCanvasBlendModes();

    /**
     * The tinting method that will be used.
     * 
     * @method tintMethod
     */
    PIXI.CanvasTinter.tintMethod = PIXI.CanvasTinter.canUseMultiply ? PIXI.CanvasTinter.tintWithMultiply : PIXI.CanvasTinter.tintWithPerPixel;

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * The CanvasRenderer draws the Stage and all its content onto a 2d canvas. This renderer should be used for browsers that do not support webGL.
     * Don't forget to add the CanvasRenderer.view to your DOM or you will not see anything :)
     *
     * @class CanvasRenderer
     * @constructor
     * @param [width=800] {Number} the width of the canvas view
     * @param [height=600] {Number} the height of the canvas view
     * @param [options] {Object} The optional renderer parameters
     * @param [options.view] {HTMLCanvasElement} the canvas to use as a view, optional
     * @param [options.transparent=false] {Boolean} If the render view is transparent, default false
     * @param [options.resolution=1] {Number} the resolution of the renderer retina would be 2
     * @param [options.clearBeforeRender=true] {Boolean} This sets if the CanvasRenderer will clear the canvas or not before the new render pass.
     */
    PIXI.CanvasRenderer = function(width, height, options) {
        if (options) {
            for (var i in PIXI.defaultRenderOptions) {
                if (typeof options[i] === "undefined") options[i] = PIXI.defaultRenderOptions[i];
            }
        } else {
            options = PIXI.defaultRenderOptions;
        }

        if (!PIXI.defaultRenderer) {
            PIXI.sayHello("Canvas");
            PIXI.defaultRenderer = this;
        }

        /**
         * The renderer type.
         *
         * @property type
         * @type Number
         */
        this.type = PIXI.CANVAS_RENDERER;

        /**
         * The resolution of the canvas.
         *
         * @property resolution
         * @type Number
         */
        this.resolution = options.resolution;

        /**
         * This sets if the CanvasRenderer will clear the canvas or not before the new render pass.
         * If the Stage is NOT transparent Pixi will use a canvas sized fillRect operation every frame to set the canvas background color.
         * If the Stage is transparent Pixi will use clearRect to clear the canvas every frame.
         * Disable this by setting this to false. For example if your game has a canvas filling background image you often don't need this set.
         *
         * @property clearBeforeRender
         * @type Boolean
         * @default
         */
        this.clearBeforeRender = options.clearBeforeRender;

        /**
         * Whether the render view is transparent
         *
         * @property transparent
         * @type Boolean
         */
        this.transparent = options.transparent;

        /**
         * The width of the canvas view
         *
         * @property width
         * @type Number
         * @default 800
         */
        this.width = width || 800;

        /**
         * The height of the canvas view
         *
         * @property height
         * @type Number
         * @default 600
         */
        this.height = height || 600;

        this.width *= this.resolution;
        this.height *= this.resolution;

        /**
         * The canvas element that everything is drawn to.
         *
         * @property view
         * @type HTMLCanvasElement
         */
        this.view = options.view || document.createElement("canvas");

        /**
         * The canvas 2d context that everything is drawn with
         * @property context
         * @type CanvasRenderingContext2D
         */
        this.context = this.view.getContext("2d", { alpha: this.transparent });

        /**
         * Boolean flag controlling canvas refresh.
         *
         * @property refresh
         * @type Boolean
         */
        this.refresh = true;

        this.view.width = this.width * this.resolution;
        this.view.height = this.height * this.resolution;

        /**
         * Internal var.
         *
         * @property count
         * @type Number
         */
        this.count = 0;

        /**
         * Instance of a PIXI.CanvasMaskManager, handles masking when using the canvas renderer
         * @property CanvasMaskManager
         * @type CanvasMaskManager
         */
        this.maskManager = new PIXI.CanvasMaskManager();

        /**
         * The render session is just a bunch of parameter used for rendering
         * @property renderSession
         * @type Object
         */
        this.renderSession = {
            context: this.context,
            maskManager: this.maskManager,
            scaleMode: null,
            smoothProperty: null,
            /**
             * If true Pixi will Math.floor() x/y values when rendering, stopping pixel interpolation.
             * Handy for crisp pixel art and speed on legacy devices.
             *
             */
            roundPixels: false
        };

        this.mapBlendModes();

        this.resize(width, height);

        if ("imageSmoothingEnabled" in this.context)
            this.renderSession.smoothProperty = "imageSmoothingEnabled";
        else if ("webkitImageSmoothingEnabled" in this.context)
            this.renderSession.smoothProperty = "webkitImageSmoothingEnabled";
        else if ("mozImageSmoothingEnabled" in this.context)
            this.renderSession.smoothProperty = "mozImageSmoothingEnabled";
        else if ("oImageSmoothingEnabled" in this.context)
            this.renderSession.smoothProperty = "oImageSmoothingEnabled";
        else if ("msImageSmoothingEnabled" in this.context)
            this.renderSession.smoothProperty = "msImageSmoothingEnabled";
    };

    // constructor
    PIXI.CanvasRenderer.prototype.constructor = PIXI.CanvasRenderer;

    /**
     * Renders the Stage to this canvas view
     *
     * @method render
     * @param stage {Stage} the Stage element to be rendered
     */
    PIXI.CanvasRenderer.prototype.render = function(stage) {
        stage.updateTransform();

        this.context.setTransform(1, 0, 0, 1, 0, 0);

        this.context.globalAlpha = 1;

        this.renderSession.currentBlendMode = PIXI.blendModes.NORMAL;
        this.context.globalCompositeOperation = PIXI.blendModesCanvas[PIXI.blendModes.NORMAL];

        if (navigator.isCocoonJS && this.view.screencanvas) {
            this.context.fillStyle = "black";
            this.context.clear();
        }

        if (this.clearBeforeRender) {
            if (this.transparent) {
                this.context.clearRect(0, 0, this.width, this.height);
            } else {
                this.context.fillStyle = stage.backgroundColorString;
                this.context.fillRect(0, 0, this.width, this.height);
            }
        }

        this.renderDisplayObject(stage);

        // run interaction!
        if (stage.interactive) {
            //need to add some events!
            if (!stage._interactiveEventsAdded) {
                stage._interactiveEventsAdded = true;
                stage.interactionManager.setTarget(this);
            }
        }
    };

    /**
     * Removes everything from the renderer and optionally removes the Canvas DOM element.
     *
     * @method destroy
     * @param [removeView=true] {boolean} Removes the Canvas element from the DOM.
     */
    PIXI.CanvasRenderer.prototype.destroy = function(removeView) {
        if (typeof removeView === "undefined") { removeView = true; }

        if (removeView && this.view.parent) {
            this.view.parent.removeChild(this.view);
        }

        this.view = null;
        this.context = null;
        this.maskManager = null;
        this.renderSession = null;

    };

    /**
     * Resizes the canvas view to the specified width and height
     *
     * @method resize
     * @param width {Number} the new width of the canvas view
     * @param height {Number} the new height of the canvas view
     */
    PIXI.CanvasRenderer.prototype.resize = function(width, height) {
        this.width = width * this.resolution;
        this.height = height * this.resolution;

        this.view.width = this.width;
        this.view.height = this.height;

        this.view.style.width = this.width / this.resolution + "px";
        this.view.style.height = this.height / this.resolution + "px";
    };

    /**
     * Renders a display object
     *
     * @method renderDisplayObject
     * @param displayObject {DisplayObject} The displayObject to render
     * @param context {CanvasRenderingContext2D} the context 2d method of the canvas
     * @private
     */
    PIXI.CanvasRenderer.prototype.renderDisplayObject = function(displayObject, context) {
        this.renderSession.context = context || this.context;
        this.renderSession.resolution = this.resolution;
        displayObject._renderCanvas(this.renderSession);
    };

    /**
     * Maps Pixi blend modes to canvas blend modes.
     *
     * @method mapBlendModes
     * @private
     */
    PIXI.CanvasRenderer.prototype.mapBlendModes = function() {
        if (!PIXI.blendModesCanvas) {
            PIXI.blendModesCanvas = [];

            if (PIXI.canUseNewCanvasBlendModes()) {
                PIXI.blendModesCanvas[PIXI.blendModes.NORMAL] = "source-over";
                PIXI.blendModesCanvas[PIXI.blendModes.ADD] = "lighter"; //IS THIS OK???
                PIXI.blendModesCanvas[PIXI.blendModes.MULTIPLY] = "multiply";
                PIXI.blendModesCanvas[PIXI.blendModes.SCREEN] = "screen";
                PIXI.blendModesCanvas[PIXI.blendModes.OVERLAY] = "overlay";
                PIXI.blendModesCanvas[PIXI.blendModes.DARKEN] = "darken";
                PIXI.blendModesCanvas[PIXI.blendModes.LIGHTEN] = "lighten";
                PIXI.blendModesCanvas[PIXI.blendModes.COLOR_DODGE] = "color-dodge";
                PIXI.blendModesCanvas[PIXI.blendModes.COLOR_BURN] = "color-burn";
                PIXI.blendModesCanvas[PIXI.blendModes.HARD_LIGHT] = "hard-light";
                PIXI.blendModesCanvas[PIXI.blendModes.SOFT_LIGHT] = "soft-light";
                PIXI.blendModesCanvas[PIXI.blendModes.DIFFERENCE] = "difference";
                PIXI.blendModesCanvas[PIXI.blendModes.EXCLUSION] = "exclusion";
                PIXI.blendModesCanvas[PIXI.blendModes.HUE] = "hue";
                PIXI.blendModesCanvas[PIXI.blendModes.SATURATION] = "saturation";
                PIXI.blendModesCanvas[PIXI.blendModes.COLOR] = "color";
                PIXI.blendModesCanvas[PIXI.blendModes.LUMINOSITY] = "luminosity";
            } else {
                // this means that the browser does not support the cool new blend modes in canvas "cough" ie "cough"
                PIXI.blendModesCanvas[PIXI.blendModes.NORMAL] = "source-over";
                PIXI.blendModesCanvas[PIXI.blendModes.ADD] = "lighter"; //IS THIS OK???
                PIXI.blendModesCanvas[PIXI.blendModes.MULTIPLY] = "source-over";
                PIXI.blendModesCanvas[PIXI.blendModes.SCREEN] = "source-over";
                PIXI.blendModesCanvas[PIXI.blendModes.OVERLAY] = "source-over";
                PIXI.blendModesCanvas[PIXI.blendModes.DARKEN] = "source-over";
                PIXI.blendModesCanvas[PIXI.blendModes.LIGHTEN] = "source-over";
                PIXI.blendModesCanvas[PIXI.blendModes.COLOR_DODGE] = "source-over";
                PIXI.blendModesCanvas[PIXI.blendModes.COLOR_BURN] = "source-over";
                PIXI.blendModesCanvas[PIXI.blendModes.HARD_LIGHT] = "source-over";
                PIXI.blendModesCanvas[PIXI.blendModes.SOFT_LIGHT] = "source-over";
                PIXI.blendModesCanvas[PIXI.blendModes.DIFFERENCE] = "source-over";
                PIXI.blendModesCanvas[PIXI.blendModes.EXCLUSION] = "source-over";
                PIXI.blendModesCanvas[PIXI.blendModes.HUE] = "source-over";
                PIXI.blendModesCanvas[PIXI.blendModes.SATURATION] = "source-over";
                PIXI.blendModesCanvas[PIXI.blendModes.COLOR] = "source-over";
                PIXI.blendModesCanvas[PIXI.blendModes.LUMINOSITY] = "source-over";
            }
        }
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */


    /**
     * A set of functions used by the canvas renderer to draw the primitive graphics data.
     *
     * @class CanvasGraphics
     * @static
     */
    PIXI.CanvasGraphics = function() {};

    /*
     * Renders a PIXI.Graphics object to a canvas.
     *
     * @method renderGraphics
     * @static
     * @param graphics {Graphics} the actual graphics object to render
     * @param context {CanvasRenderingContext2D} the 2d drawing method of the canvas
     */
    PIXI.CanvasGraphics.renderGraphics = function(graphics, context) {
        var worldAlpha = graphics.worldAlpha;
        var color = '';

        for (var i = 0; i < graphics.graphicsData.length; i++) {
            var data = graphics.graphicsData[i];
            var shape = data.shape;

            context.strokeStyle = color = '#' + ('00000' + (data.lineColor | 0).toString(16)).substr(-6);

            context.lineWidth = data.lineWidth;

            if (data.type === PIXI.Graphics.POLY) {
                context.beginPath();

                var points = shape.points;

                context.moveTo(points[0], points[1]);

                for (var j = 1; j < points.length / 2; j++) {
                    context.lineTo(points[j * 2], points[j * 2 + 1]);
                }

                if (shape.closed) {
                    context.lineTo(points[0], points[1]);
                }

                // if the first and last point are the same close the path - much neater :)
                if (points[0] === points[points.length - 2] && points[1] === points[points.length - 1]) {
                    context.closePath();
                }

                if (data.fill) {
                    context.globalAlpha = data.fillAlpha * worldAlpha;
                    context.fillStyle = color = '#' + ('00000' + (data.fillColor | 0).toString(16)).substr(-6);
                    context.fill();
                }
                if (data.lineWidth) {
                    context.globalAlpha = data.lineAlpha * worldAlpha;
                    context.stroke();
                }
            } else if (data.type === PIXI.Graphics.RECT) {

                if (data.fillColor || data.fillColor === 0) {
                    context.globalAlpha = data.fillAlpha * worldAlpha;
                    context.fillStyle = color = '#' + ('00000' + (data.fillColor | 0).toString(16)).substr(-6);
                    context.fillRect(shape.x, shape.y, shape.width, shape.height);

                }
                if (data.lineWidth) {
                    context.globalAlpha = data.lineAlpha * worldAlpha;
                    context.strokeRect(shape.x, shape.y, shape.width, shape.height);
                }
            } else if (data.type === PIXI.Graphics.CIRC) {
                // TODO - need to be Undefined!
                context.beginPath();
                context.arc(shape.x, shape.y, shape.radius, 0, 2 * Math.PI);
                context.closePath();

                if (data.fill) {
                    context.globalAlpha = data.fillAlpha * worldAlpha;
                    context.fillStyle = color = '#' + ('00000' + (data.fillColor | 0).toString(16)).substr(-6);
                    context.fill();
                }
                if (data.lineWidth) {
                    context.globalAlpha = data.lineAlpha * worldAlpha;
                    context.stroke();
                }
            } else if (data.type === PIXI.Graphics.ELIP) {
                // ellipse code taken from: http://stackoverflow.com/questions/2172798/how-to-draw-an-oval-in-html5-canvas

                var w = shape.width * 2;
                var h = shape.height * 2;

                var x = shape.x - w / 2;
                var y = shape.y - h / 2;

                context.beginPath();

                var kappa = 0.5522848,
                    ox = (w / 2) * kappa, // control point offset horizontal
                    oy = (h / 2) * kappa, // control point offset vertical
                    xe = x + w, // x-end
                    ye = y + h, // y-end
                    xm = x + w / 2, // x-middle
                    ym = y + h / 2; // y-middle

                context.moveTo(x, ym);
                context.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
                context.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
                context.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
                context.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);

                context.closePath();

                if (data.fill) {
                    context.globalAlpha = data.fillAlpha * worldAlpha;
                    context.fillStyle = color = '#' + ('00000' + (data.fillColor | 0).toString(16)).substr(-6);
                    context.fill();
                }
                if (data.lineWidth) {
                    context.globalAlpha = data.lineAlpha * worldAlpha;
                    context.stroke();
                }
            } else if (data.type === PIXI.Graphics.RREC) {
                var pts = shape.points;
                var rx = pts[0];
                var ry = pts[1];
                var width = pts[2];
                var height = pts[3];
                var radius = pts[4];

                var maxRadius = Math.min(width, height) / 2 | 0;
                radius = radius > maxRadius ? maxRadius : radius;

                context.beginPath();
                context.moveTo(rx, ry + radius);
                context.lineTo(rx, ry + height - radius);
                context.quadraticCurveTo(rx, ry + height, rx + radius, ry + height);
                context.lineTo(rx + width - radius, ry + height);
                context.quadraticCurveTo(rx + width, ry + height, rx + width, ry + height - radius);
                context.lineTo(rx + width, ry + radius);
                context.quadraticCurveTo(rx + width, ry, rx + width - radius, ry);
                context.lineTo(rx + radius, ry);
                context.quadraticCurveTo(rx, ry, rx, ry + radius);
                context.closePath();

                if (data.fillColor || data.fillColor === 0) {
                    context.globalAlpha = data.fillAlpha * worldAlpha;
                    context.fillStyle = color = '#' + ('00000' + (data.fillColor | 0).toString(16)).substr(-6);
                    context.fill();

                }
                if (data.lineWidth) {
                    context.globalAlpha = data.lineAlpha * worldAlpha;
                    context.stroke();
                }
            }
        }
    };

    /*
     * Renders a graphics mask
     *
     * @static
     * @private
     * @method renderGraphicsMask
     * @param graphics {Graphics} the graphics which will be used as a mask
     * @param context {CanvasRenderingContext2D} the context 2d method of the canvas
     */
    PIXI.CanvasGraphics.renderGraphicsMask = function(graphics, context) {
        var len = graphics.graphicsData.length;

        if (len === 0) return;

        if (len > 1) {
            len = 1;
            window.console.log('Pixi.js warning: masks in canvas can only mask using the first path in the graphics object');
        }

        for (var i = 0; i < 1; i++) {
            var data = graphics.graphicsData[i];
            var shape = data.shape;

            if (data.type === PIXI.Graphics.POLY) {
                context.beginPath();

                var points = shape.points;

                context.moveTo(points[0], points[1]);

                for (var j = 1; j < points.length / 2; j++) {
                    context.lineTo(points[j * 2], points[j * 2 + 1]);
                }

                // if the first and last point are the same close the path - much neater :)
                if (points[0] === points[points.length - 2] && points[1] === points[points.length - 1]) {
                    context.closePath();
                }

            } else if (data.type === PIXI.Graphics.RECT) {
                context.beginPath();
                context.rect(shape.x, shape.y, shape.width, shape.height);
                context.closePath();
            } else if (data.type === PIXI.Graphics.CIRC) {
                // TODO - need to be Undefined!
                context.beginPath();
                context.arc(shape.x, shape.y, shape.radius, 0, 2 * Math.PI);
                context.closePath();
            } else if (data.type === PIXI.Graphics.ELIP) {

                // ellipse code taken from: http://stackoverflow.com/questions/2172798/how-to-draw-an-oval-in-html5-canvas

                var w = shape.width * 2;
                var h = shape.height * 2;

                var x = shape.x - w / 2;
                var y = shape.y - h / 2;

                context.beginPath();

                var kappa = 0.5522848,
                    ox = (w / 2) * kappa, // control point offset horizontal
                    oy = (h / 2) * kappa, // control point offset vertical
                    xe = x + w, // x-end
                    ye = y + h, // y-end
                    xm = x + w / 2, // x-middle
                    ym = y + h / 2; // y-middle

                context.moveTo(x, ym);
                context.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
                context.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
                context.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
                context.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
                context.closePath();
            } else if (data.type === PIXI.Graphics.RREC) {

                var pts = shape.points;
                var rx = pts[0];
                var ry = pts[1];
                var width = pts[2];
                var height = pts[3];
                var radius = pts[4];

                var maxRadius = Math.min(width, height) / 2 | 0;
                radius = radius > maxRadius ? maxRadius : radius;

                context.beginPath();
                context.moveTo(rx, ry + radius);
                context.lineTo(rx, ry + height - radius);
                context.quadraticCurveTo(rx, ry + height, rx + radius, ry + height);
                context.lineTo(rx + width - radius, ry + height);
                context.quadraticCurveTo(rx + width, ry + height, rx + width, ry + height - radius);
                context.lineTo(rx + width, ry + radius);
                context.quadraticCurveTo(rx + width, ry, rx + width - radius, ry);
                context.lineTo(rx + radius, ry);
                context.quadraticCurveTo(rx, ry, rx, ry + radius);
                context.closePath();
            }
        }
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * The Graphics class contains methods used to draw primitive shapes such as lines, circles and rectangles to the display, and color and fill them.
     * 
     * @class Graphics
     * @extends DisplayObjectContainer
     * @constructor
     */
    PIXI.Graphics = function() {
        PIXI.DisplayObjectContainer.call(this);

        this.renderable = true;

        /**
         * The alpha value used when filling the Graphics object.
         *
         * @property fillAlpha
         * @type Number
         */
        this.fillAlpha = 1;

        /**
         * The width (thickness) of any lines drawn.
         *
         * @property lineWidth
         * @type Number
         */
        this.lineWidth = 0;

        /**
         * The color of any lines drawn.
         *
         * @property lineColor
         * @type String
         * @default 0
         */
        this.lineColor = 0;

        /**
         * Graphics data
         *
         * @property graphicsData
         * @type Array
         * @private
         */
        this.graphicsData = [];

        /**
         * The tint applied to the graphic shape. This is a hex value. Apply a value of 0xFFFFFF to reset the tint.
         *
         * @property tint
         * @type Number
         * @default 0xFFFFFF
         */
        this.tint = 0xFFFFFF;

        /**
         * The blend mode to be applied to the graphic shape. Apply a value of PIXI.blendModes.NORMAL to reset the blend mode.
         *
         * @property blendMode
         * @type Number
         * @default PIXI.blendModes.NORMAL;
         */
        this.blendMode = PIXI.blendModes.NORMAL;

        /**
         * Current path
         *
         * @property currentPath
         * @type Object
         * @private
         */
        this.currentPath = null;

        /**
         * Array containing some WebGL-related properties used by the WebGL renderer.
         *
         * @property _webGL
         * @type Array
         * @private
         */
        this._webGL = [];

        /**
         * Whether this shape is being used as a mask.
         *
         * @property isMask
         * @type Boolean
         */
        this.isMask = false;

        /**
         * The bounds' padding used for bounds calculation.
         *
         * @property boundsPadding
         * @type Number
         */
        this.boundsPadding = 0;

        /**
         * Used to detect if the graphics object has changed. If this is set to true then the graphics object will be recalculated.
         * 
         * @property dirty
         * @type Boolean
         * @private
         */
        this.dirty = true;

        /**
         * Used to detect if the webgl graphics object has changed. If this is set to true then the graphics object will be recalculated.
         * 
         * @property webGLDirty
         * @type Boolean
         * @private
         */
        this.webGLDirty = false;

        /**
         * Used to detect if the cached sprite object needs to be updated.
         * 
         * @property cachedSpriteDirty
         * @type Boolean
         * @private
         */
        this.cachedSpriteDirty = false;

    };

    // constructor
    PIXI.Graphics.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
    PIXI.Graphics.prototype.constructor = PIXI.Graphics;

    /**
     * When cacheAsBitmap is set to true the graphics object will be rendered as if it was a sprite.
     * This is useful if your graphics element does not change often, as it will speed up the rendering of the object in exchange for taking up texture memory.
     * It is also useful if you need the graphics object to be anti-aliased, because it will be rendered using canvas.
     * This is not recommended if you are constantly redrawing the graphics element.
     *
     * @property cacheAsBitmap
     * @type Boolean
     * @default false
     * @private
     */
    Object.defineProperty(PIXI.Graphics.prototype, "cacheAsBitmap", {
        get: function() {
            return this._cacheAsBitmap;
        },
        set: function(value) {
            this._cacheAsBitmap = value;

            if (this._cacheAsBitmap) {

                this._generateCachedSprite();
            } else {
                this.destroyCachedSprite();
                this.dirty = true;
            }

        }
    });

    /**
     * Specifies the line style used for subsequent calls to Graphics methods such as the lineTo() method or the drawCircle() method.
     *
     * @method lineStyle
     * @param lineWidth {Number} width of the line to draw, will update the objects stored style
     * @param color {Number} color of the line to draw, will update the objects stored style
     * @param alpha {Number} alpha of the line to draw, will update the objects stored style
     * @return {Graphics}
     */
    PIXI.Graphics.prototype.lineStyle = function(lineWidth, color, alpha) {
        this.lineWidth = lineWidth || 0;
        this.lineColor = color || 0;
        this.lineAlpha = (arguments.length < 3) ? 1 : alpha;

        if (this.currentPath) {
            if (this.currentPath.shape.points.length) {
                // halfway through a line? start a new one!
                this.drawShape(new PIXI.Polygon(this.currentPath.shape.points.slice(-2)));
                return this;
            }

            // otherwise its empty so lets just set the line properties
            this.currentPath.lineWidth = this.lineWidth;
            this.currentPath.lineColor = this.lineColor;
            this.currentPath.lineAlpha = this.lineAlpha;

        }

        return this;
    };

    /**
     * Moves the current drawing position to x, y.
     *
     * @method moveTo
     * @param x {Number} the X coordinate to move to
     * @param y {Number} the Y coordinate to move to
     * @return {Graphics}
     */
    PIXI.Graphics.prototype.moveTo = function(x, y) {
        this.drawShape(new PIXI.Polygon([x, y]));

        return this;
    };

    /**
     * Draws a line using the current line style from the current drawing position to (x, y);
     * The current drawing position is then set to (x, y).
     *
     * @method lineTo
     * @param x {Number} the X coordinate to draw to
     * @param y {Number} the Y coordinate to draw to
     * @return {Graphics}
     */
    PIXI.Graphics.prototype.lineTo = function(x, y) {
        this.currentPath.shape.points.push(x, y);
        this.dirty = true;

        return this;
    };

    /**
     * Calculate the points for a quadratic bezier curve and then draws it.
     * Based on: https://stackoverflow.com/questions/785097/how-do-i-implement-a-bezier-curve-in-c
     *
     * @method quadraticCurveTo
     * @param cpX {Number} Control point x
     * @param cpY {Number} Control point y
     * @param toX {Number} Destination point x
     * @param toY {Number} Destination point y
     * @return {Graphics}
     */
    PIXI.Graphics.prototype.quadraticCurveTo = function(cpX, cpY, toX, toY) {
        if (this.currentPath) {
            if (this.currentPath.shape.points.length === 0) this.currentPath.shape.points = [0, 0];
        } else {
            this.moveTo(0, 0);
        }

        var xa,
            ya,
            n = 20,
            points = this.currentPath.shape.points;
        if (points.length === 0) this.moveTo(0, 0);


        var fromX = points[points.length - 2];
        var fromY = points[points.length - 1];

        var j = 0;
        for (var i = 1; i <= n; i++) {
            j = i / n;

            xa = fromX + ((cpX - fromX) * j);
            ya = fromY + ((cpY - fromY) * j);

            points.push(xa + (((cpX + ((toX - cpX) * j)) - xa) * j),
                ya + (((cpY + ((toY - cpY) * j)) - ya) * j));
        }


        this.dirty = true;

        return this;
    };

    /**
     * Calculate the points for a bezier curve and then draws it.
     *
     * @method bezierCurveTo
     * @param cpX {Number} Control point x
     * @param cpY {Number} Control point y
     * @param cpX2 {Number} Second Control point x
     * @param cpY2 {Number} Second Control point y
     * @param toX {Number} Destination point x
     * @param toY {Number} Destination point y
     * @return {Graphics}
     */
    PIXI.Graphics.prototype.bezierCurveTo = function(cpX, cpY, cpX2, cpY2, toX, toY) {
        if (this.currentPath) {
            if (this.currentPath.shape.points.length === 0) this.currentPath.shape.points = [0, 0];
        } else {
            this.moveTo(0, 0);
        }

        var n = 20,
            dt,
            dt2,
            dt3,
            t2,
            t3,
            points = this.currentPath.shape.points;

        var fromX = points[points.length - 2];
        var fromY = points[points.length - 1];

        var j = 0;

        for (var i = 1; i <= n; i++) {
            j = i / n;

            dt = (1 - j);
            dt2 = dt * dt;
            dt3 = dt2 * dt;

            t2 = j * j;
            t3 = t2 * j;

            points.push(dt3 * fromX + 3 * dt2 * j * cpX + 3 * dt * t2 * cpX2 + t3 * toX,
                dt3 * fromY + 3 * dt2 * j * cpY + 3 * dt * t2 * cpY2 + t3 * toY);
        }

        this.dirty = true;

        return this;
    };

    /*
     * The arcTo() method creates an arc/curve between two tangents on the canvas.
     * 
     * "borrowed" from https://code.google.com/p/fxcanvas/ - thanks google!
     *
     * @method arcTo
     * @param x1 {Number} The x-coordinate of the beginning of the arc
     * @param y1 {Number} The y-coordinate of the beginning of the arc
     * @param x2 {Number} The x-coordinate of the end of the arc
     * @param y2 {Number} The y-coordinate of the end of the arc
     * @param radius {Number} The radius of the arc
     * @return {Graphics}
     */
    PIXI.Graphics.prototype.arcTo = function(x1, y1, x2, y2, radius) {
        if (this.currentPath) {
            if (this.currentPath.shape.points.length === 0) this.currentPath.shape.points = [x1, y1];
        } else {
            this.moveTo(x1, y1);
        }

        // check that path contains subpaths
        if (this.currentPath.length === 0) this.moveTo(x1, y1);

        var points = this.currentPath;
        var fromX = points[points.length - 2];
        var fromY = points[points.length - 1];
        var a1 = fromY - y1;
        var b1 = fromX - x1;
        var a2 = y2 - y1;
        var b2 = x2 - x1;
        var mm = Math.abs(a1 * b2 - b1 * a2);

        if (mm < 1.0e-8 || radius === 0) {
            points.push(x1, y1);
        } else {
            var dd = a1 * a1 + b1 * b1;
            var cc = a2 * a2 + b2 * b2;
            var tt = a1 * a2 + b1 * b2;
            var k1 = radius * Math.sqrt(dd) / mm;
            var k2 = radius * Math.sqrt(cc) / mm;
            var j1 = k1 * tt / dd;
            var j2 = k2 * tt / cc;
            var cx = k1 * b2 + k2 * b1;
            var cy = k1 * a2 + k2 * a1;
            var px = b1 * (k2 + j1);
            var py = a1 * (k2 + j1);
            var qx = b2 * (k1 + j2);
            var qy = a2 * (k1 + j2);
            var startAngle = Math.atan2(py - cy, px - cx);
            var endAngle = Math.atan2(qy - cy, qx - cx);

            this.arc(cx + x1, cy + y1, radius, startAngle, endAngle, b1 * a2 > b2 * a1);
        }

        this.dirty = true;

        return this;
    };

    /**
     * The arc method creates an arc/curve (used to create circles, or parts of circles).
     *
     * @method arc
     * @param cx {Number} The x-coordinate of the center of the circle
     * @param cy {Number} The y-coordinate of the center of the circle
     * @param radius {Number} The radius of the circle
     * @param startAngle {Number} The starting angle, in radians (0 is at the 3 o'clock position of the arc's circle)
     * @param endAngle {Number} The ending angle, in radians
     * @param anticlockwise {Boolean} Optional. Specifies whether the drawing should be counterclockwise or clockwise. False is default, and indicates clockwise, while true indicates counter-clockwise.
     * @return {Graphics}
     */
    PIXI.Graphics.prototype.arc = function(cx, cy, radius, startAngle, endAngle, anticlockwise) {
        var startX = cx + Math.cos(startAngle) * radius;
        var startY = cy + Math.sin(startAngle) * radius;

        var points = this.currentPath.shape.points;

        if (points.length !== 0 && points[points.length - 2] !== startX || points[points.length - 1] !== startY) {
            this.moveTo(startX, startY);
            points = this.currentPath.shape.points;
        }

        if (startAngle === endAngle) return this;

        if (!anticlockwise && endAngle <= startAngle) {
            endAngle += Math.PI * 2;
        } else if (anticlockwise && startAngle <= endAngle) {
            startAngle += Math.PI * 2;
        }

        var sweep = anticlockwise ? (startAngle - endAngle) * -1 : (endAngle - startAngle);
        var segs = (Math.abs(sweep) / (Math.PI * 2)) * 40;

        if (sweep === 0) return this;

        var theta = sweep / (segs * 2);
        var theta2 = theta * 2;

        var cTheta = Math.cos(theta);
        var sTheta = Math.sin(theta);

        var segMinus = segs - 1;

        var remainder = (segMinus % 1) / segMinus;

        for (var i = 0; i <= segMinus; i++) {
            var real = i + remainder * i;


            var angle = ((theta) + startAngle + (theta2 * real));

            var c = Math.cos(angle);
            var s = -Math.sin(angle);

            points.push(((cTheta * c) + (sTheta * s)) * radius + cx,
                ((cTheta * -s) + (sTheta * c)) * radius + cy);
        }

        this.dirty = true;

        return this;
    };

    /**
     * Specifies a simple one-color fill that subsequent calls to other Graphics methods
     * (such as lineTo() or drawCircle()) use when drawing.
     *
     * @method beginFill
     * @param color {Number} the color of the fill
     * @param alpha {Number} the alpha of the fill
     * @return {Graphics}
     */
    PIXI.Graphics.prototype.beginFill = function(color, alpha) {
        this.filling = true;
        this.fillColor = color || 0;
        this.fillAlpha = (alpha === undefined) ? 1 : alpha;

        if (this.currentPath) {
            if (this.currentPath.shape.points.length <= 2) {
                this.currentPath.fill = this.filling;
                this.currentPath.fillColor = this.fillColor;
                this.currentPath.fillAlpha = this.fillAlpha;
            }
        }
        return this;
    };

    /**
     * Applies a fill to the lines and shapes that were added since the last call to the beginFill() method.
     *
     * @method endFill
     * @return {Graphics}
     */
    PIXI.Graphics.prototype.endFill = function() {
        this.filling = false;
        this.fillColor = null;
        this.fillAlpha = 1;

        return this;
    };

    /**
     * @method drawRect
     *
     * @param x {Number} The X coord of the top-left of the rectangle
     * @param y {Number} The Y coord of the top-left of the rectangle
     * @param width {Number} The width of the rectangle
     * @param height {Number} The height of the rectangle
     * @return {Graphics}
     */
    PIXI.Graphics.prototype.drawRect = function(x, y, width, height) {
        this.drawShape(new PIXI.Rectangle(x, y, width, height));

        return this;
    };

    /**
     * @method drawRoundedRect
     *
     * @param x {Number} The X coord of the top-left of the rectangle
     * @param y {Number} The Y coord of the top-left of the rectangle
     * @param width {Number} The width of the rectangle
     * @param height {Number} The height of the rectangle
     * @param radius {Number} Radius of the rectangle corners
     */
    PIXI.Graphics.prototype.drawRoundedRect = function(x, y, width, height, radius) {
        this.drawShape({ points: [x, y, width, height, radius], type: PIXI.Graphics.RREC });

        return this;
    };

    /**
     * Draws a circle.
     *
     * @method drawCircle
     * @param x {Number} The X coordinate of the center of the circle
     * @param y {Number} The Y coordinate of the center of the circle
     * @param radius {Number} The radius of the circle
     * @return {Graphics}
     */
    PIXI.Graphics.prototype.drawCircle = function(x, y, radius) {
        this.drawShape(new PIXI.Circle(x, y, radius));

        return this;
    };

    /**
     * Draws an ellipse.
     *
     * @method drawEllipse
     * @param x {Number} The X coordinate of the center of the ellipse
     * @param y {Number} The Y coordinate of the center of the ellipse
     * @param width {Number} The half width of the ellipse
     * @param height {Number} The half height of the ellipse
     * @return {Graphics}
     */
    PIXI.Graphics.prototype.drawEllipse = function(x, y, width, height) {
        this.drawShape(new PIXI.Ellipse(x, y, width, height));

        return this;
    };

    /**
     * Draws a polygon using the given path.
     *
     * @method drawPolygon
     * @param path {Array} The path data used to construct the polygon.
     * @return {Graphics}
     */
    PIXI.Graphics.prototype.drawPolygon = function(path) {
        if (!(path instanceof Array)) path = Array.prototype.slice.call(arguments);
        this.drawShape(new PIXI.Polygon(path));
        return this;
    };

    /**
     * Clears the graphics that were drawn to this Graphics object, and resets fill and line style settings.
     *
     * @method clear
     * @return {Graphics}
     */
    PIXI.Graphics.prototype.clear = function() {
        this.lineWidth = 0;
        this.filling = false;

        this.dirty = true;
        this.clearDirty = true;
        this.graphicsData = [];

        return this;
    };

    /**
     * Useful function that returns a texture of the graphics object that can then be used to create sprites
     * This can be quite useful if your geometry is complicated and needs to be reused multiple times.
     *
     * @method generateTexture
     * @param resolution {Number} The resolution of the texture being generated
     * @param scaleMode {Number} Should be one of the PIXI.scaleMode consts
     * @return {Texture} a texture of the graphics object
     */
    PIXI.Graphics.prototype.generateTexture = function(resolution, scaleMode) {
        resolution = resolution || 1;

        var bounds = this.getBounds();

        var canvasBuffer = new PIXI.CanvasBuffer(bounds.width * resolution, bounds.height * resolution);

        var texture = PIXI.Texture.fromCanvas(canvasBuffer.canvas, scaleMode);
        texture.baseTexture.resolution = resolution;

        canvasBuffer.context.scale(resolution, resolution);

        canvasBuffer.context.translate(-bounds.x, -bounds.y);

        PIXI.CanvasGraphics.renderGraphics(this, canvasBuffer.context);

        return texture;
    };

    /**
     * Renders the object using the WebGL renderer
     *
     * @method _renderWebGL
     * @param renderSession {RenderSession} 
     * @private
     */
    PIXI.Graphics.prototype._renderWebGL = function(renderSession) {
        // if the sprite is not visible or the alpha is 0 then no need to render this element
        if (this.visible === false || this.alpha === 0 || this.isMask === true) return;

        if (this._cacheAsBitmap) {

            if (this.dirty || this.cachedSpriteDirty) {

                this._generateCachedSprite();

                // we will also need to update the texture on the gpu too!
                this.updateCachedSpriteTexture();

                this.cachedSpriteDirty = false;
                this.dirty = false;
            }

            this._cachedSprite.alpha = this.alpha;
            PIXI.Sprite.prototype._renderWebGL.call(this._cachedSprite, renderSession);

            return;
        } else {
            renderSession.spriteBatch.stop();
            renderSession.blendModeManager.setBlendMode(this.blendMode);

            if (this._mask) renderSession.maskManager.pushMask(this._mask, renderSession);
            if (this._filters) renderSession.filterManager.pushFilter(this._filterBlock);

            // check blend mode
            if (this.blendMode !== renderSession.spriteBatch.currentBlendMode) {
                renderSession.spriteBatch.currentBlendMode = this.blendMode;
                var blendModeWebGL = PIXI.blendModesWebGL[renderSession.spriteBatch.currentBlendMode];
                renderSession.spriteBatch.gl.blendFunc(blendModeWebGL[0], blendModeWebGL[1]);
            }

            // check if the webgl graphic needs to be updated
            if (this.webGLDirty) {
                this.dirty = true;
                this.webGLDirty = false;
            }

            PIXI.WebGLGraphics.renderGraphics(this, renderSession);

            // only render if it has children!
            if (this.children.length) {
                renderSession.spriteBatch.start();

                // simple render children!
                for (var i = 0, j = this.children.length; i < j; i++) {
                    this.children[i]._renderWebGL(renderSession);
                }

                renderSession.spriteBatch.stop();
            }

            if (this._filters) renderSession.filterManager.popFilter();
            if (this._mask) renderSession.maskManager.popMask(this.mask, renderSession);

            renderSession.drawCount++;

            renderSession.spriteBatch.start();
        }
    };

    /**
     * Renders the object using the Canvas renderer
     *
     * @method _renderCanvas
     * @param renderSession {RenderSession} 
     * @private
     */
    PIXI.Graphics.prototype._renderCanvas = function(renderSession) {
        // if the sprite is not visible or the alpha is 0 then no need to render this element
        if (this.visible === false || this.alpha === 0 || this.isMask === true) return;

        if (this._cacheAsBitmap) {
            if (this.dirty || this.cachedSpriteDirty) {
                this._generateCachedSprite();

                // we will also need to update the texture
                this.updateCachedSpriteTexture();

                this.cachedSpriteDirty = false;
                this.dirty = false;
            }

            this._cachedSprite.alpha = this.alpha;
            PIXI.Sprite.prototype._renderCanvas.call(this._cachedSprite, renderSession);

            return;
        } else {
            var context = renderSession.context;
            var transform = this.worldTransform;

            if (this.blendMode !== renderSession.currentBlendMode) {
                renderSession.currentBlendMode = this.blendMode;
                context.globalCompositeOperation = PIXI.blendModesCanvas[renderSession.currentBlendMode];
            }

            if (this._mask) {
                renderSession.maskManager.pushMask(this._mask, renderSession);
            }

            var resolution = renderSession.resolution;
            context.setTransform(transform.a * resolution,
                transform.b * resolution,
                transform.c * resolution,
                transform.d * resolution,
                transform.tx * resolution,
                transform.ty * resolution);

            PIXI.CanvasGraphics.renderGraphics(this, context);

            // simple render children!
            for (var i = 0, j = this.children.length; i < j; i++) {
                this.children[i]._renderCanvas(renderSession);
            }

            if (this._mask) {
                renderSession.maskManager.popMask(renderSession);
            }
        }
    };

    /**
     * Retrieves the bounds of the graphic shape as a rectangle object
     *
     * @method getBounds
     * @return {Rectangle} the rectangular bounding area
     */
    PIXI.Graphics.prototype.getBounds = function(matrix) {
        if (this.dirty) {
            this.updateBounds();
            this.webGLDirty = true;
            this.cachedSpriteDirty = true;
            this.dirty = false;
        }

        var bounds = this._bounds;

        var w0 = bounds.x;
        var w1 = bounds.width + bounds.x;

        var h0 = bounds.y;
        var h1 = bounds.height + bounds.y;

        var worldTransform = matrix || this.worldTransform;

        var a = worldTransform.a;
        var b = worldTransform.c;
        var c = worldTransform.b;
        var d = worldTransform.d;
        var tx = worldTransform.tx;
        var ty = worldTransform.ty;

        var x1 = a * w1 + c * h1 + tx;
        var y1 = d * h1 + b * w1 + ty;

        var x2 = a * w0 + c * h1 + tx;
        var y2 = d * h1 + b * w0 + ty;

        var x3 = a * w0 + c * h0 + tx;
        var y3 = d * h0 + b * w0 + ty;

        var x4 = a * w1 + c * h0 + tx;
        var y4 = d * h0 + b * w1 + ty;

        var maxX = x1;
        var maxY = y1;

        var minX = x1;
        var minY = y1;

        minX = x2 < minX ? x2 : minX;
        minX = x3 < minX ? x3 : minX;
        minX = x4 < minX ? x4 : minX;

        minY = y2 < minY ? y2 : minY;
        minY = y3 < minY ? y3 : minY;
        minY = y4 < minY ? y4 : minY;

        maxX = x2 > maxX ? x2 : maxX;
        maxX = x3 > maxX ? x3 : maxX;
        maxX = x4 > maxX ? x4 : maxX;

        maxY = y2 > maxY ? y2 : maxY;
        maxY = y3 > maxY ? y3 : maxY;
        maxY = y4 > maxY ? y4 : maxY;

        bounds.x = minX;
        bounds.width = maxX - minX;

        bounds.y = minY;
        bounds.height = maxY - minY;

        return bounds;
    };

    /**
     * Update the bounds of the object
     *
     * @method updateBounds
     */
    PIXI.Graphics.prototype.updateBounds = function() {
        var minX = Infinity;
        var maxX = -Infinity;

        var minY = Infinity;
        var maxY = -Infinity;

        if (this.graphicsData.length) {
            var shape, points, x, y, w, h;

            for (var i = 0; i < this.graphicsData.length; i++) {
                var data = this.graphicsData[i];
                var type = data.type;
                var lineWidth = data.lineWidth;
                shape = data.shape;


                if (type === PIXI.Graphics.RECT || type === PIXI.Graphics.RRECT) {
                    x = shape.x - lineWidth / 2;
                    y = shape.y - lineWidth / 2;
                    w = shape.width + lineWidth;
                    h = shape.height + lineWidth;

                    minX = x < minX ? x : minX;
                    maxX = x + w > maxX ? x + w : maxX;

                    minY = y < minY ? y : minY;
                    maxY = y + h > maxY ? y + h : maxY;
                } else if (type === PIXI.Graphics.CIRC) {
                    x = shape.x;
                    y = shape.y;
                    w = shape.radius + lineWidth / 2;
                    h = shape.radius + lineWidth / 2;

                    minX = x - w < minX ? x - w : minX;
                    maxX = x + w > maxX ? x + w : maxX;

                    minY = y - h < minY ? y - h : minY;
                    maxY = y + h > maxY ? y + h : maxY;
                } else if (type === PIXI.Graphics.ELIP) {
                    x = shape.x;
                    y = shape.y;
                    w = shape.width + lineWidth / 2;
                    h = shape.height + lineWidth / 2;

                    minX = x - w < minX ? x - w : minX;
                    maxX = x + w > maxX ? x + w : maxX;

                    minY = y - h < minY ? y - h : minY;
                    maxY = y + h > maxY ? y + h : maxY;
                } else {
                    // POLY
                    points = shape.points;

                    for (var j = 0; j < points.length; j += 2) {

                        x = points[j];
                        y = points[j + 1];
                        minX = x - lineWidth < minX ? x - lineWidth : minX;
                        maxX = x + lineWidth > maxX ? x + lineWidth : maxX;

                        minY = y - lineWidth < minY ? y - lineWidth : minY;
                        maxY = y + lineWidth > maxY ? y + lineWidth : maxY;
                    }
                }
            }
        } else {
            minX = 0;
            maxX = 0;
            minY = 0;
            maxY = 0;
        }

        var padding = this.boundsPadding;
        var bounds = this._bounds;

        bounds.x = minX - padding;
        bounds.width = (maxX - minX) + padding * 2;

        bounds.y = minY - padding;
        bounds.height = (maxY - minY) + padding * 2;
    };

    /**
     * Generates the cached sprite when the sprite has cacheAsBitmap = true
     *
     * @method _generateCachedSprite
     * @private
     */
    PIXI.Graphics.prototype._generateCachedSprite = function() {
        var bounds = this.getLocalBounds();

        if (!this._cachedSprite) {
            var canvasBuffer = new PIXI.CanvasBuffer(bounds.width, bounds.height);
            var texture = PIXI.Texture.fromCanvas(canvasBuffer.canvas);

            this._cachedSprite = new PIXI.Sprite(texture);
            this._cachedSprite.buffer = canvasBuffer;

            this._cachedSprite.worldTransform = this.worldTransform;
        } else {
            this._cachedSprite.buffer.resize(bounds.width, bounds.height);
        }

        // leverage the anchor to account for the offset of the element
        this._cachedSprite.anchor.x = -(bounds.x / bounds.width);
        this._cachedSprite.anchor.y = -(bounds.y / bounds.height);

        // this._cachedSprite.buffer.context.save();
        this._cachedSprite.buffer.context.translate(-bounds.x, -bounds.y);

        // make sure we set the alpha of the graphics to 1 for the render.. 
        this.worldAlpha = 1;

        // now render the graphic..
        PIXI.CanvasGraphics.renderGraphics(this, this._cachedSprite.buffer.context);
        this._cachedSprite.alpha = this.alpha;
    };

    /**
     * Updates texture size based on canvas size
     *
     * @method updateCachedSpriteTexture
     * @private
     */
    PIXI.Graphics.prototype.updateCachedSpriteTexture = function() {
        var cachedSprite = this._cachedSprite;
        var texture = cachedSprite.texture;
        var canvas = cachedSprite.buffer.canvas;

        texture.baseTexture.width = canvas.width;
        texture.baseTexture.height = canvas.height;
        texture.crop.width = texture.frame.width = canvas.width;
        texture.crop.height = texture.frame.height = canvas.height;

        cachedSprite._width = canvas.width;
        cachedSprite._height = canvas.height;

        // update the dirty base textures
        texture.baseTexture.dirty();
    };

    /**
     * Destroys a previous cached sprite.
     *
     * @method destroyCachedSprite
     */
    PIXI.Graphics.prototype.destroyCachedSprite = function() {
        this._cachedSprite.texture.destroy(true);

        // let the gc collect the unused sprite
        // TODO could be object pooled!
        this._cachedSprite = null;
    };

    /**
     * Draws the given shape to this Graphics object. Can be any of Circle, Rectangle, Ellipse, Line or Polygon.
     *
     * @method drawShape
     * @param {Circle|Rectangle|Ellipse|Line|Polygon} shape The Shape object to draw.
     * @return {GraphicsData} The generated GraphicsData object.
     */
    PIXI.Graphics.prototype.drawShape = function(shape) {
        if (this.currentPath) {
            // check current path!
            if (this.currentPath.shape.points.length <= 2) this.graphicsData.pop();
        }

        this.currentPath = null;

        var data = new PIXI.GraphicsData(this.lineWidth, this.lineColor, this.lineAlpha, this.fillColor, this.fillAlpha, this.filling, shape);

        this.graphicsData.push(data);

        if (data.type === PIXI.Graphics.POLY) {
            data.shape.closed = this.filling;
            this.currentPath = data;
        }

        this.dirty = true;

        return data;
    };

    /**
     * A GraphicsData object.
     * 
     * @class GraphicsData
     * @constructor
     */
    PIXI.GraphicsData = function(lineWidth, lineColor, lineAlpha, fillColor, fillAlpha, fill, shape) {
        this.lineWidth = lineWidth;
        this.lineColor = lineColor;
        this.lineAlpha = lineAlpha;

        this.fillColor = fillColor;
        this.fillAlpha = fillAlpha;
        this.fill = fill;

        this.shape = shape;
        this.type = shape.type;
    };

    // SOME TYPES:
    PIXI.Graphics.POLY = 0;
    PIXI.Graphics.RECT = 1;
    PIXI.Graphics.CIRC = 2;
    PIXI.Graphics.ELIP = 3;
    PIXI.Graphics.RREC = 4;

    PIXI.Polygon.prototype.type = PIXI.Graphics.POLY;
    PIXI.Rectangle.prototype.type = PIXI.Graphics.RECT;
    PIXI.Circle.prototype.type = PIXI.Graphics.CIRC;
    PIXI.Ellipse.prototype.type = PIXI.Graphics.ELIP;

    /**
     * @author Mat Groves http://matgroves.com/
     */

    /**
     * 
     * @class Strip
     * @extends DisplayObjectContainer
     * @constructor
     * @param texture {Texture} The texture to use
     * @param width {Number} the width 
     * @param height {Number} the height
     * 
     */
    PIXI.Strip = function(texture) {
        PIXI.DisplayObjectContainer.call(this);


        /**
         * The texture of the strip
         *
         * @property texture
         * @type Texture
         */
        this.texture = texture;

        // set up the main bits..
        this.uvs = new PIXI.Float32Array([0, 1,
            1, 1,
            1, 0,
            0, 1
        ]);

        this.verticies = new PIXI.Float32Array([0, 0,
            100, 0,
            100, 100,
            0, 100
        ]);

        this.colors = new PIXI.Float32Array([1, 1, 1, 1]);

        this.indices = new PIXI.Uint16Array([0, 1, 2, 3]);

        /**
         * Whether the strip is dirty or not
         *
         * @property dirty
         * @type Boolean
         */
        this.dirty = true;


        /**
         * if you need a padding, not yet implemented
         *
         * @property padding
         * @type Number
         */
        this.padding = 0;
        // NYI, TODO padding ?

    };

    // constructor
    PIXI.Strip.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
    PIXI.Strip.prototype.constructor = PIXI.Strip;

    PIXI.Strip.prototype._renderWebGL = function(renderSession) {
        // if the sprite is not visible or the alpha is 0 then no need to render this element
        if (!this.visible || this.alpha <= 0) return;
        // render triangle strip..

        renderSession.spriteBatch.stop();

        // init! init!
        if (!this._vertexBuffer) this._initWebGL(renderSession);

        renderSession.shaderManager.setShader(renderSession.shaderManager.stripShader);

        this._renderStrip(renderSession);

        ///renderSession.shaderManager.activateDefaultShader();

        renderSession.spriteBatch.start();

        //TODO check culling  
    };

    PIXI.Strip.prototype._initWebGL = function(renderSession) {
        // build the strip!
        var gl = renderSession.gl;

        this._vertexBuffer = gl.createBuffer();
        this._indexBuffer = gl.createBuffer();
        this._uvBuffer = gl.createBuffer();
        this._colorBuffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.verticies, gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.uvs, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.colors, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);
    };

    PIXI.Strip.prototype._renderStrip = function(renderSession) {
        var gl = renderSession.gl;
        var projection = renderSession.projection,
            offset = renderSession.offset,
            shader = renderSession.shaderManager.stripShader;


        // gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mat4Real);

        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        // set uniforms
        gl.uniformMatrix3fv(shader.translationMatrix, false, this.worldTransform.toArray(true));
        gl.uniform2f(shader.projectionVector, projection.x, -projection.y);
        gl.uniform2f(shader.offsetVector, -offset.x, -offset.y);
        gl.uniform1f(shader.alpha, this.worldAlpha);

        if (!this.dirty) {

            gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.verticies);
            gl.vertexAttribPointer(shader.aVertexPosition, 2, gl.FLOAT, false, 0, 0);

            // update the uvs
            gl.bindBuffer(gl.ARRAY_BUFFER, this._uvBuffer);
            gl.vertexAttribPointer(shader.aTextureCoord, 2, gl.FLOAT, false, 0, 0);

            gl.activeTexture(gl.TEXTURE0);

            // check if a texture is dirty..
            if (this.texture.baseTexture._dirty[gl.id]) {
                renderSession.renderer.updateTexture(this.texture.baseTexture);
            } else {
                // bind the current texture
                gl.bindTexture(gl.TEXTURE_2D, this.texture.baseTexture._glTextures[gl.id]);
            }

            // dont need to upload!
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);


        } else {

            this.dirty = false;
            gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, this.verticies, gl.STATIC_DRAW);
            gl.vertexAttribPointer(shader.aVertexPosition, 2, gl.FLOAT, false, 0, 0);

            // update the uvs
            gl.bindBuffer(gl.ARRAY_BUFFER, this._uvBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, this.uvs, gl.STATIC_DRAW);
            gl.vertexAttribPointer(shader.aTextureCoord, 2, gl.FLOAT, false, 0, 0);

            gl.activeTexture(gl.TEXTURE0);

            // check if a texture is dirty..
            if (this.texture.baseTexture._dirty[gl.id]) {
                renderSession.renderer.updateTexture(this.texture.baseTexture);
            } else {
                gl.bindTexture(gl.TEXTURE_2D, this.texture.baseTexture._glTextures[gl.id]);
            }

            // dont need to upload!
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);

        }
        //console.log(gl.TRIANGLE_STRIP)
        //
        //
        gl.drawElements(gl.TRIANGLE_STRIP, this.indices.length, gl.UNSIGNED_SHORT, 0);


    };



    PIXI.Strip.prototype._renderCanvas = function(renderSession) {
        var context = renderSession.context;

        var transform = this.worldTransform;

        if (renderSession.roundPixels) {
            context.setTransform(transform.a, transform.b, transform.c, transform.d, transform.tx | 0, transform.ty | 0);
        } else {
            context.setTransform(transform.a, transform.b, transform.c, transform.d, transform.tx, transform.ty);
        }

        var strip = this;
        // draw triangles!!
        var verticies = strip.verticies;
        var uvs = strip.uvs;

        var length = verticies.length / 2;
        this.count++;

        for (var i = 0; i < length - 2; i++) {
            // draw some triangles!
            var index = i * 2;

            var x0 = verticies[index],
                x1 = verticies[index + 2],
                x2 = verticies[index + 4];
            var y0 = verticies[index + 1],
                y1 = verticies[index + 3],
                y2 = verticies[index + 5];

            if (this.padding > 0) {
                var centerX = (x0 + x1 + x2) / 3;
                var centerY = (y0 + y1 + y2) / 3;

                var normX = x0 - centerX;
                var normY = y0 - centerY;

                var dist = Math.sqrt(normX * normX + normY * normY);
                x0 = centerX + (normX / dist) * (dist + 3);
                y0 = centerY + (normY / dist) * (dist + 3);

                // 

                normX = x1 - centerX;
                normY = y1 - centerY;

                dist = Math.sqrt(normX * normX + normY * normY);
                x1 = centerX + (normX / dist) * (dist + 3);
                y1 = centerY + (normY / dist) * (dist + 3);

                normX = x2 - centerX;
                normY = y2 - centerY;

                dist = Math.sqrt(normX * normX + normY * normY);
                x2 = centerX + (normX / dist) * (dist + 3);
                y2 = centerY + (normY / dist) * (dist + 3);
            }

            var u0 = uvs[index] * strip.texture.width,
                u1 = uvs[index + 2] * strip.texture.width,
                u2 = uvs[index + 4] * strip.texture.width;
            var v0 = uvs[index + 1] * strip.texture.height,
                v1 = uvs[index + 3] * strip.texture.height,
                v2 = uvs[index + 5] * strip.texture.height;

            context.save();
            context.beginPath();


            context.moveTo(x0, y0);
            context.lineTo(x1, y1);
            context.lineTo(x2, y2);

            context.closePath();

            context.clip();

            // Compute matrix transform
            var delta = u0 * v1 + v0 * u2 + u1 * v2 - v1 * u2 - v0 * u1 - u0 * v2;
            var deltaA = x0 * v1 + v0 * x2 + x1 * v2 - v1 * x2 - v0 * x1 - x0 * v2;
            var deltaB = u0 * x1 + x0 * u2 + u1 * x2 - x1 * u2 - x0 * u1 - u0 * x2;
            var deltaC = u0 * v1 * x2 + v0 * x1 * u2 + x0 * u1 * v2 - x0 * v1 * u2 - v0 * u1 * x2 - u0 * x1 * v2;
            var deltaD = y0 * v1 + v0 * y2 + y1 * v2 - v1 * y2 - v0 * y1 - y0 * v2;
            var deltaE = u0 * y1 + y0 * u2 + u1 * y2 - y1 * u2 - y0 * u1 - u0 * y2;
            var deltaF = u0 * v1 * y2 + v0 * y1 * u2 + y0 * u1 * v2 - y0 * v1 * u2 - v0 * u1 * y2 - u0 * y1 * v2;

            context.transform(deltaA / delta, deltaD / delta,
                deltaB / delta, deltaE / delta,
                deltaC / delta, deltaF / delta);

            context.drawImage(strip.texture.baseTexture.source, 0, 0);
            context.restore();
        }
    };


    /**
     * Renders a flat strip
     *
     * @method renderStripFlat
     * @param strip {Strip} The Strip to render
     * @private
     */
    PIXI.Strip.prototype.renderStripFlat = function(strip) {
        var context = this.context;
        var verticies = strip.verticies;

        var length = verticies.length / 2;
        this.count++;

        context.beginPath();
        for (var i = 1; i < length - 2; i++) {
            // draw some triangles!
            var index = i * 2;

            var x0 = verticies[index],
                x1 = verticies[index + 2],
                x2 = verticies[index + 4];
            var y0 = verticies[index + 1],
                y1 = verticies[index + 3],
                y2 = verticies[index + 5];

            context.moveTo(x0, y0);
            context.lineTo(x1, y1);
            context.lineTo(x2, y2);
        }

        context.fillStyle = "#FF0000";
        context.fill();
        context.closePath();
    };

    /*
    PIXI.Strip.prototype.setTexture = function(texture)
    {
        //TODO SET THE TEXTURES
        //TODO VISIBILITY

        // stop current texture
        this.texture = texture;
        this.width   = texture.frame.width;
        this.height  = texture.frame.height;
        this.updateFrame = true;
    };
    */

    /**
     * When the texture is updated, this event will fire to update the scale and frame
     *
     * @method onTextureUpdate
     * @param event
     * @private
     */

    PIXI.Strip.prototype.onTextureUpdate = function() {
        this.updateFrame = true;
    };
    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     * @copyright Mat Groves, Rovanion Luckey
     */

    /**
     *
     * @class Rope
     * @constructor
     * @extends Strip
     * @param {Texture} texture - The texture to use on the rope.
     * @param {Array} points - An array of {PIXI.Point}.
     *
     */
    PIXI.Rope = function(texture, points) {
        PIXI.Strip.call(this, texture);
        this.points = points;

        this.verticies = new PIXI.Float32Array(points.length * 4);
        this.uvs = new PIXI.Float32Array(points.length * 4);
        this.colors = new PIXI.Float32Array(points.length * 2);
        this.indices = new PIXI.Uint16Array(points.length * 2);


        this.refresh();
    };


    // constructor
    PIXI.Rope.prototype = Object.create(PIXI.Strip.prototype);
    PIXI.Rope.prototype.constructor = PIXI.Rope;

    /*
     * Refreshes
     *
     * @method refresh
     */
    PIXI.Rope.prototype.refresh = function() {
        var points = this.points;
        if (points.length < 1) return;

        var uvs = this.uvs;

        var lastPoint = points[0];
        var indices = this.indices;
        var colors = this.colors;

        this.count -= 0.2;

        uvs[0] = 0;
        uvs[1] = 0;
        uvs[2] = 0;
        uvs[3] = 1;

        colors[0] = 1;
        colors[1] = 1;

        indices[0] = 0;
        indices[1] = 1;

        var total = points.length,
            point, index, amount;

        for (var i = 1; i < total; i++) {
            point = points[i];
            index = i * 4;
            // time to do some smart drawing!
            amount = i / (total - 1);

            if (i % 2) {
                uvs[index] = amount;
                uvs[index + 1] = 0;

                uvs[index + 2] = amount;
                uvs[index + 3] = 1;
            } else {
                uvs[index] = amount;
                uvs[index + 1] = 0;

                uvs[index + 2] = amount;
                uvs[index + 3] = 1;
            }

            index = i * 2;
            colors[index] = 1;
            colors[index + 1] = 1;

            index = i * 2;
            indices[index] = index;
            indices[index + 1] = index + 1;

            lastPoint = point;
        }
    };

    /*
     * Updates the object transform for rendering
     *
     * @method updateTransform
     * @private
     */
    PIXI.Rope.prototype.updateTransform = function() {

        var points = this.points;
        if (points.length < 1) return;

        var lastPoint = points[0];
        var nextPoint;
        var perp = { x: 0, y: 0 };

        this.count -= 0.2;

        var verticies = this.verticies;
        var total = points.length,
            point, index, ratio, perpLength, num;

        for (var i = 0; i < total; i++) {
            point = points[i];
            index = i * 4;

            if (i < points.length - 1) {
                nextPoint = points[i + 1];
            } else {
                nextPoint = point;
            }

            perp.y = -(nextPoint.x - lastPoint.x);
            perp.x = nextPoint.y - lastPoint.y;

            ratio = (1 - (i / (total - 1))) * 10;

            if (ratio > 1) ratio = 1;

            perpLength = Math.sqrt(perp.x * perp.x + perp.y * perp.y);
            num = this.texture.height / 2; //(20 + Math.abs(Math.sin((i + this.count) * 0.3) * 50) )* ratio;
            perp.x /= perpLength;
            perp.y /= perpLength;

            perp.x *= num;
            perp.y *= num;

            verticies[index] = point.x + perp.x;
            verticies[index + 1] = point.y + perp.y;
            verticies[index + 2] = point.x - perp.x;
            verticies[index + 3] = point.y - perp.y;

            lastPoint = point;
        }

        PIXI.DisplayObjectContainer.prototype.updateTransform.call(this);
    };
    /*
     * Sets the texture that the Rope will use
     *
     * @method setTexture
     * @param texture {Texture} the texture that will be used
     */
    PIXI.Rope.prototype.setTexture = function(texture) {
        // stop current texture
        this.texture = texture;
        //this.updateFrame = true;
    };

    /**
     * @author Mat Groves http://matgroves.com/
     */

    /**
     * A tiling sprite is a fast way of rendering a tiling image
     *
     * @class TilingSprite
     * @extends Sprite
     * @constructor
     * @param texture {Texture} the texture of the tiling sprite
     * @param width {Number}  the width of the tiling sprite
     * @param height {Number} the height of the tiling sprite
     */
    PIXI.TilingSprite = function(texture, width, height) {
        PIXI.Sprite.call(this, texture);

        /**
         * The with of the tiling sprite
         *
         * @property width
         * @type Number
         */
        this._width = width || 100;

        /**
         * The height of the tiling sprite
         *
         * @property height
         * @type Number
         */
        this._height = height || 100;

        /**
         * The scaling of the image that is being tiled
         *
         * @property tileScale
         * @type Point
         */
        this.tileScale = new PIXI.Point(1, 1);

        /**
         * A point that represents the scale of the texture object
         *
         * @property tileScaleOffset
         * @type Point
         */
        this.tileScaleOffset = new PIXI.Point(1, 1);

        /**
         * The offset position of the image that is being tiled
         *
         * @property tilePosition
         * @type Point
         */
        this.tilePosition = new PIXI.Point(0, 0);

        /**
         * Whether this sprite is renderable or not
         *
         * @property renderable
         * @type Boolean
         * @default true
         */
        this.renderable = true;

        /**
         * The tint applied to the sprite. This is a hex value
         *
         * @property tint
         * @type Number
         * @default 0xFFFFFF
         */
        this.tint = 0xFFFFFF;

        /**
         * The blend mode to be applied to the sprite
         *
         * @property blendMode
         * @type Number
         * @default PIXI.blendModes.NORMAL;
         */
        this.blendMode = PIXI.blendModes.NORMAL;



    };

    // constructor
    PIXI.TilingSprite.prototype = Object.create(PIXI.Sprite.prototype);
    PIXI.TilingSprite.prototype.constructor = PIXI.TilingSprite;


    /**
     * The width of the sprite, setting this will actually modify the scale to achieve the value set
     *
     * @property width
     * @type Number
     */
    Object.defineProperty(PIXI.TilingSprite.prototype, 'width', {
        get: function() {
            return this._width;
        },
        set: function(value) {

            this._width = value;
        }
    });

    /**
     * The height of the TilingSprite, setting this will actually modify the scale to achieve the value set
     *
     * @property height
     * @type Number
     */
    Object.defineProperty(PIXI.TilingSprite.prototype, 'height', {
        get: function() {
            return this._height;
        },
        set: function(value) {
            this._height = value;
        }
    });

    PIXI.TilingSprite.prototype.setTexture = function(texture) {
        if (this.texture === texture) return;

        this.texture = texture;

        this.refreshTexture = true;

        this.cachedTint = 0xFFFFFF;
    };

    /**
     * Renders the object using the WebGL renderer
     *
     * @method _renderWebGL
     * @param renderSession {RenderSession} 
     * @private
     */
    PIXI.TilingSprite.prototype._renderWebGL = function(renderSession) {
        if (this.visible === false || this.alpha === 0) return;
        var i, j;

        if (this._mask) {
            renderSession.spriteBatch.stop();
            renderSession.maskManager.pushMask(this.mask, renderSession);
            renderSession.spriteBatch.start();
        }

        if (this._filters) {
            renderSession.spriteBatch.flush();
            renderSession.filterManager.pushFilter(this._filterBlock);
        }



        if (!this.tilingTexture || this.refreshTexture) {
            this.generateTilingTexture(true);

            if (this.tilingTexture && this.tilingTexture.needsUpdate) {
                //TODO - tweaking
                PIXI.updateWebGLTexture(this.tilingTexture.baseTexture, renderSession.gl);
                this.tilingTexture.needsUpdate = false;
                // this.tilingTexture._uvs = null;
            }
        } else {
            renderSession.spriteBatch.renderTilingSprite(this);
        }
        // simple render children!
        for (i = 0, j = this.children.length; i < j; i++) {
            this.children[i]._renderWebGL(renderSession);
        }

        renderSession.spriteBatch.stop();

        if (this._filters) renderSession.filterManager.popFilter();
        if (this._mask) renderSession.maskManager.popMask(this._mask, renderSession);

        renderSession.spriteBatch.start();
    };

    /**
     * Renders the object using the Canvas renderer
     *
     * @method _renderCanvas
     * @param renderSession {RenderSession} 
     * @private
     */
    PIXI.TilingSprite.prototype._renderCanvas = function(renderSession) {
        if (this.visible === false || this.alpha === 0) return;

        var context = renderSession.context;

        if (this._mask) {
            renderSession.maskManager.pushMask(this._mask, context);
        }

        context.globalAlpha = this.worldAlpha;

        var transform = this.worldTransform;

        var i, j;

        var resolution = renderSession.resolution;

        context.setTransform(transform.a * resolution,
            transform.c * resolution,
            transform.b * resolution,
            transform.d * resolution,
            transform.tx * resolution,
            transform.ty * resolution);

        if (!this.__tilePattern || this.refreshTexture) {
            this.generateTilingTexture(false);

            if (this.tilingTexture) {
                this.__tilePattern = context.createPattern(this.tilingTexture.baseTexture.source, 'repeat');
            } else {
                return;
            }
        }

        // check blend mode
        if (this.blendMode !== renderSession.currentBlendMode) {
            renderSession.currentBlendMode = this.blendMode;
            context.globalCompositeOperation = PIXI.blendModesCanvas[renderSession.currentBlendMode];
        }

        var tilePosition = this.tilePosition;
        var tileScale = this.tileScale;

        tilePosition.x %= this.tilingTexture.baseTexture.width;
        tilePosition.y %= this.tilingTexture.baseTexture.height;

        // offset - make sure to account for the anchor point..
        context.scale(tileScale.x, tileScale.y);
        context.translate(tilePosition.x + (this.anchor.x * -this._width), tilePosition.y + (this.anchor.y * -this._height));

        context.fillStyle = this.__tilePattern;

        context.fillRect(-tilePosition.x, -tilePosition.y,
            this._width / tileScale.x,
            this._height / tileScale.y);

        context.scale(1 / tileScale.x, 1 / tileScale.y);
        context.translate(-tilePosition.x + (this.anchor.x * this._width), -tilePosition.y + (this.anchor.y * this._height));

        if (this._mask) {
            renderSession.maskManager.popMask(renderSession.context);
        }

        for (i = 0, j = this.children.length; i < j; i++) {
            this.children[i]._renderCanvas(renderSession);
        }
    };


    /**
     * Returns the framing rectangle of the sprite as a PIXI.Rectangle object
     *
     * @method getBounds
     * @return {Rectangle} the framing rectangle
     */
    PIXI.TilingSprite.prototype.getBounds = function() {
        var width = this._width;
        var height = this._height;

        var w0 = width * (1 - this.anchor.x);
        var w1 = width * -this.anchor.x;

        var h0 = height * (1 - this.anchor.y);
        var h1 = height * -this.anchor.y;

        var worldTransform = this.worldTransform;

        var a = worldTransform.a;
        var b = worldTransform.c;
        var c = worldTransform.b;
        var d = worldTransform.d;
        var tx = worldTransform.tx;
        var ty = worldTransform.ty;

        var x1 = a * w1 + c * h1 + tx;
        var y1 = d * h1 + b * w1 + ty;

        var x2 = a * w0 + c * h1 + tx;
        var y2 = d * h1 + b * w0 + ty;

        var x3 = a * w0 + c * h0 + tx;
        var y3 = d * h0 + b * w0 + ty;

        var x4 = a * w1 + c * h0 + tx;
        var y4 = d * h0 + b * w1 + ty;

        var maxX = -Infinity;
        var maxY = -Infinity;

        var minX = Infinity;
        var minY = Infinity;

        minX = x1 < minX ? x1 : minX;
        minX = x2 < minX ? x2 : minX;
        minX = x3 < minX ? x3 : minX;
        minX = x4 < minX ? x4 : minX;

        minY = y1 < minY ? y1 : minY;
        minY = y2 < minY ? y2 : minY;
        minY = y3 < minY ? y3 : minY;
        minY = y4 < minY ? y4 : minY;

        maxX = x1 > maxX ? x1 : maxX;
        maxX = x2 > maxX ? x2 : maxX;
        maxX = x3 > maxX ? x3 : maxX;
        maxX = x4 > maxX ? x4 : maxX;

        maxY = y1 > maxY ? y1 : maxY;
        maxY = y2 > maxY ? y2 : maxY;
        maxY = y3 > maxY ? y3 : maxY;
        maxY = y4 > maxY ? y4 : maxY;

        var bounds = this._bounds;

        bounds.x = minX;
        bounds.width = maxX - minX;

        bounds.y = minY;
        bounds.height = maxY - minY;

        // store a reference so that if this function gets called again in the render cycle we do not have to recalculate
        this._currentBounds = bounds;

        return bounds;
    };



    /**
     * When the texture is updated, this event will fire to update the scale and frame
     *
     * @method onTextureUpdate
     * @param event
     * @private
     */
    PIXI.TilingSprite.prototype.onTextureUpdate = function() {
        // overriding the sprite version of this!
    };


    /**
     * 
     * @method generateTilingTexture
     * 
     * @param forcePowerOfTwo {Boolean} Whether we want to force the texture to be a power of two
     */
    PIXI.TilingSprite.prototype.generateTilingTexture = function(forcePowerOfTwo) {
        if (!this.texture.baseTexture.hasLoaded) return;

        var texture = this.originalTexture || this.texture;
        var frame = texture.frame;
        var targetWidth, targetHeight;

        //  Check that the frame is the same size as the base texture.
        var isFrame = frame.width !== texture.baseTexture.width || frame.height !== texture.baseTexture.height;

        var newTextureRequired = false;

        if (!forcePowerOfTwo) {
            if (isFrame) {
                targetWidth = frame.width;
                targetHeight = frame.height;

                newTextureRequired = true;
            }
        } else {
            targetWidth = PIXI.getNextPowerOfTwo(frame.width);
            targetHeight = PIXI.getNextPowerOfTwo(frame.height);

            if (frame.width !== targetWidth || frame.height !== targetHeight) newTextureRequired = true;
        }

        if (newTextureRequired) {
            var canvasBuffer;

            if (this.tilingTexture && this.tilingTexture.isTiling) {
                canvasBuffer = this.tilingTexture.canvasBuffer;
                canvasBuffer.resize(targetWidth, targetHeight);
                this.tilingTexture.baseTexture.width = targetWidth;
                this.tilingTexture.baseTexture.height = targetHeight;
                this.tilingTexture.needsUpdate = true;
            } else {
                canvasBuffer = new PIXI.CanvasBuffer(targetWidth, targetHeight);

                this.tilingTexture = PIXI.Texture.fromCanvas(canvasBuffer.canvas);
                this.tilingTexture.canvasBuffer = canvasBuffer;
                this.tilingTexture.isTiling = true;
            }

            canvasBuffer.context.drawImage(texture.baseTexture.source,
                texture.crop.x,
                texture.crop.y,
                texture.crop.width,
                texture.crop.height,
                0,
                0,
                targetWidth,
                targetHeight);

            this.tileScaleOffset.x = frame.width / targetWidth;
            this.tileScaleOffset.y = frame.height / targetHeight;
        } else {
            //  TODO - switching?
            if (this.tilingTexture && this.tilingTexture.isTiling) {
                // destroy the tiling texture!
                // TODO could store this somewhere?
                this.tilingTexture.destroy(true);
            }

            this.tileScaleOffset.x = 1;
            this.tileScaleOffset.y = 1;
            this.tilingTexture = texture;
        }

        this.refreshTexture = false;

        this.originalTexture = this.texture;
        this.texture = this.tilingTexture;

        this.tilingTexture.baseTexture._powerOf2 = true;
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     * based on pixi impact spine implementation made by Eemeli Kelokorpi (@ekelokorpi) https://github.com/ekelokorpi
     *
     * Awesome JS run time provided by EsotericSoftware
     * https://github.com/EsotericSoftware/spine-runtimes
     *
     */

    /*
     * Awesome JS run time provided by EsotericSoftware
     *
     * https://github.com/EsotericSoftware/spine-runtimes
     *
     */



    var spine = {};

    spine.BoneData = function(name, parent) {
        this.name = name;
        this.parent = parent;
    };
    spine.BoneData.prototype = {
        length: 0,
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1
    };

    spine.SlotData = function(name, boneData) {
        this.name = name;
        this.boneData = boneData;
    };
    spine.SlotData.prototype = {
        r: 1,
        g: 1,
        b: 1,
        a: 1,
        attachmentName: null
    };

    spine.Bone = function(boneData, parent) {
        this.data = boneData;
        this.parent = parent;
        this.setToSetupPose();
    };
    spine.Bone.yDown = false;
    spine.Bone.prototype = {
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        m00: 0,
        m01: 0,
        worldX: 0, // a b x
        m10: 0,
        m11: 0,
        worldY: 0, // c d y
        worldRotation: 0,
        worldScaleX: 1,
        worldScaleY: 1,
        updateWorldTransform: function(flipX, flipY) {
            var parent = this.parent;
            if (parent != null) {
                this.worldX = this.x * parent.m00 + this.y * parent.m01 + parent.worldX;
                this.worldY = this.x * parent.m10 + this.y * parent.m11 + parent.worldY;
                this.worldScaleX = parent.worldScaleX * this.scaleX;
                this.worldScaleY = parent.worldScaleY * this.scaleY;
                this.worldRotation = parent.worldRotation + this.rotation;
            } else {
                this.worldX = this.x;
                this.worldY = this.y;
                this.worldScaleX = this.scaleX;
                this.worldScaleY = this.scaleY;
                this.worldRotation = this.rotation;
            }
            var radians = this.worldRotation * Math.PI / 180;
            var cos = Math.cos(radians);
            var sin = Math.sin(radians);
            this.m00 = cos * this.worldScaleX;
            this.m10 = sin * this.worldScaleX;
            this.m01 = -sin * this.worldScaleY;
            this.m11 = cos * this.worldScaleY;
            if (flipX) {
                this.m00 = -this.m00;
                this.m01 = -this.m01;
            }
            if (flipY) {
                this.m10 = -this.m10;
                this.m11 = -this.m11;
            }
            if (spine.Bone.yDown) {
                this.m10 = -this.m10;
                this.m11 = -this.m11;
            }
        },
        setToSetupPose: function() {
            var data = this.data;
            this.x = data.x;
            this.y = data.y;
            this.rotation = data.rotation;
            this.scaleX = data.scaleX;
            this.scaleY = data.scaleY;
        }
    };

    spine.Slot = function(slotData, skeleton, bone) {
        this.data = slotData;
        this.skeleton = skeleton;
        this.bone = bone;
        this.setToSetupPose();
    };
    spine.Slot.prototype = {
        r: 1,
        g: 1,
        b: 1,
        a: 1,
        _attachmentTime: 0,
        attachment: null,
        setAttachment: function(attachment) {
            this.attachment = attachment;
            this._attachmentTime = this.skeleton.time;
        },
        setAttachmentTime: function(time) {
            this._attachmentTime = this.skeleton.time - time;
        },
        getAttachmentTime: function() {
            return this.skeleton.time - this._attachmentTime;
        },
        setToSetupPose: function() {
            var data = this.data;
            this.r = data.r;
            this.g = data.g;
            this.b = data.b;
            this.a = data.a;

            var slotDatas = this.skeleton.data.slots;
            for (var i = 0, n = slotDatas.length; i < n; i++) {
                if (slotDatas[i] == data) {
                    this.setAttachment(!data.attachmentName ? null : this.skeleton.getAttachmentBySlotIndex(i, data.attachmentName));
                    break;
                }
            }
        }
    };

    spine.Skin = function(name) {
        this.name = name;
        this.attachments = {};
    };
    spine.Skin.prototype = {
        addAttachment: function(slotIndex, name, attachment) {
            this.attachments[slotIndex + ":" + name] = attachment;
        },
        getAttachment: function(slotIndex, name) {
            return this.attachments[slotIndex + ":" + name];
        },
        _attachAll: function(skeleton, oldSkin) {
            for (var key in oldSkin.attachments) {
                var colon = key.indexOf(":");
                var slotIndex = parseInt(key.substring(0, colon), 10);
                var name = key.substring(colon + 1);
                var slot = skeleton.slots[slotIndex];
                if (slot.attachment && slot.attachment.name == name) {
                    var attachment = this.getAttachment(slotIndex, name);
                    if (attachment) slot.setAttachment(attachment);
                }
            }
        }
    };

    spine.Animation = function(name, timelines, duration) {
        this.name = name;
        this.timelines = timelines;
        this.duration = duration;
    };
    spine.Animation.prototype = {
        apply: function(skeleton, time, loop) {
            if (loop && this.duration) time %= this.duration;
            var timelines = this.timelines;
            for (var i = 0, n = timelines.length; i < n; i++)
                timelines[i].apply(skeleton, time, 1);
        },
        mix: function(skeleton, time, loop, alpha) {
            if (loop && this.duration) time %= this.duration;
            var timelines = this.timelines;
            for (var i = 0, n = timelines.length; i < n; i++)
                timelines[i].apply(skeleton, time, alpha);
        }
    };

    spine.binarySearch = function(values, target, step) {
        var low = 0;
        var high = Math.floor(values.length / step) - 2;
        if (!high) return step;
        var current = high >>> 1;
        while (true) {
            if (values[(current + 1) * step] <= target)
                low = current + 1;
            else
                high = current;
            if (low == high) return (low + 1) * step;
            current = (low + high) >>> 1;
        }
    };
    spine.linearSearch = function(values, target, step) {
        for (var i = 0, last = values.length - step; i <= last; i += step)
            if (values[i] > target) return i;
        return -1;
    };

    spine.Curves = function(frameCount) {
        this.curves = []; // dfx, dfy, ddfx, ddfy, dddfx, dddfy, ...
        this.curves.length = (frameCount - 1) * 6;
    };
    spine.Curves.prototype = {
        setLinear: function(frameIndex) {
            this.curves[frameIndex * 6] = 0 /*LINEAR*/ ;
        },
        setStepped: function(frameIndex) {
            this.curves[frameIndex * 6] = -1 /*STEPPED*/ ;
        },
        /** Sets the control handle positions for an interpolation bezier curve used to transition from this keyframe to the next.
         * cx1 and cx2 are from 0 to 1, representing the percent of time between the two keyframes. cy1 and cy2 are the percent of
         * the difference between the keyframe's values. */
        setCurve: function(frameIndex, cx1, cy1, cx2, cy2) {
            var subdiv_step = 1 / 10 /*BEZIER_SEGMENTS*/ ;
            var subdiv_step2 = subdiv_step * subdiv_step;
            var subdiv_step3 = subdiv_step2 * subdiv_step;
            var pre1 = 3 * subdiv_step;
            var pre2 = 3 * subdiv_step2;
            var pre4 = 6 * subdiv_step2;
            var pre5 = 6 * subdiv_step3;
            var tmp1x = -cx1 * 2 + cx2;
            var tmp1y = -cy1 * 2 + cy2;
            var tmp2x = (cx1 - cx2) * 3 + 1;
            var tmp2y = (cy1 - cy2) * 3 + 1;
            var i = frameIndex * 6;
            var curves = this.curves;
            curves[i] = cx1 * pre1 + tmp1x * pre2 + tmp2x * subdiv_step3;
            curves[i + 1] = cy1 * pre1 + tmp1y * pre2 + tmp2y * subdiv_step3;
            curves[i + 2] = tmp1x * pre4 + tmp2x * pre5;
            curves[i + 3] = tmp1y * pre4 + tmp2y * pre5;
            curves[i + 4] = tmp2x * pre5;
            curves[i + 5] = tmp2y * pre5;
        },
        getCurvePercent: function(frameIndex, percent) {
            percent = percent < 0 ? 0 : (percent > 1 ? 1 : percent);
            var curveIndex = frameIndex * 6;
            var curves = this.curves;
            var dfx = curves[curveIndex];
            if (!dfx /*LINEAR*/ ) return percent;
            if (dfx == -1 /*STEPPED*/ ) return 0;
            var dfy = curves[curveIndex + 1];
            var ddfx = curves[curveIndex + 2];
            var ddfy = curves[curveIndex + 3];
            var dddfx = curves[curveIndex + 4];
            var dddfy = curves[curveIndex + 5];
            var x = dfx,
                y = dfy;
            var i = 10 /*BEZIER_SEGMENTS*/ - 2;
            while (true) {
                if (x >= percent) {
                    var lastX = x - dfx;
                    var lastY = y - dfy;
                    return lastY + (y - lastY) * (percent - lastX) / (x - lastX);
                }
                if (!i) break;
                i--;
                dfx += ddfx;
                dfy += ddfy;
                ddfx += dddfx;
                ddfy += dddfy;
                x += dfx;
                y += dfy;
            }
            return y + (1 - y) * (percent - x) / (1 - x); // Last point is 1,1.
        }
    };

    spine.RotateTimeline = function(frameCount) {
        this.curves = new spine.Curves(frameCount);
        this.frames = []; // time, angle, ...
        this.frames.length = frameCount * 2;
    };
    spine.RotateTimeline.prototype = {
        boneIndex: 0,
        getFrameCount: function() {
            return this.frames.length / 2;
        },
        setFrame: function(frameIndex, time, angle) {
            frameIndex *= 2;
            this.frames[frameIndex] = time;
            this.frames[frameIndex + 1] = angle;
        },
        apply: function(skeleton, time, alpha) {
            var frames = this.frames,
                amount;

            if (time < frames[0]) return; // Time is before first frame.

            var bone = skeleton.bones[this.boneIndex];

            if (time >= frames[frames.length - 2]) { // Time is after last frame.
                amount = bone.data.rotation + frames[frames.length - 1] - bone.rotation;
                while (amount > 180)
                    amount -= 360;
                while (amount < -180)
                    amount += 360;
                bone.rotation += amount * alpha;
                return;
            }

            // Interpolate between the last frame and the current frame.
            var frameIndex = spine.binarySearch(frames, time, 2);
            var lastFrameValue = frames[frameIndex - 1];
            var frameTime = frames[frameIndex];
            var percent = 1 - (time - frameTime) / (frames[frameIndex - 2 /*LAST_FRAME_TIME*/ ] - frameTime);
            percent = this.curves.getCurvePercent(frameIndex / 2 - 1, percent);

            amount = frames[frameIndex + 1 /*FRAME_VALUE*/ ] - lastFrameValue;
            while (amount > 180)
                amount -= 360;
            while (amount < -180)
                amount += 360;
            amount = bone.data.rotation + (lastFrameValue + amount * percent) - bone.rotation;
            while (amount > 180)
                amount -= 360;
            while (amount < -180)
                amount += 360;
            bone.rotation += amount * alpha;
        }
    };

    spine.TranslateTimeline = function(frameCount) {
        this.curves = new spine.Curves(frameCount);
        this.frames = []; // time, x, y, ...
        this.frames.length = frameCount * 3;
    };
    spine.TranslateTimeline.prototype = {
        boneIndex: 0,
        getFrameCount: function() {
            return this.frames.length / 3;
        },
        setFrame: function(frameIndex, time, x, y) {
            frameIndex *= 3;
            this.frames[frameIndex] = time;
            this.frames[frameIndex + 1] = x;
            this.frames[frameIndex + 2] = y;
        },
        apply: function(skeleton, time, alpha) {
            var frames = this.frames;
            if (time < frames[0]) return; // Time is before first frame.

            var bone = skeleton.bones[this.boneIndex];

            if (time >= frames[frames.length - 3]) { // Time is after last frame.
                bone.x += (bone.data.x + frames[frames.length - 2] - bone.x) * alpha;
                bone.y += (bone.data.y + frames[frames.length - 1] - bone.y) * alpha;
                return;
            }

            // Interpolate between the last frame and the current frame.
            var frameIndex = spine.binarySearch(frames, time, 3);
            var lastFrameX = frames[frameIndex - 2];
            var lastFrameY = frames[frameIndex - 1];
            var frameTime = frames[frameIndex];
            var percent = 1 - (time - frameTime) / (frames[frameIndex + -3 /*LAST_FRAME_TIME*/ ] - frameTime);
            percent = this.curves.getCurvePercent(frameIndex / 3 - 1, percent);

            bone.x += (bone.data.x + lastFrameX + (frames[frameIndex + 1 /*FRAME_X*/ ] - lastFrameX) * percent - bone.x) * alpha;
            bone.y += (bone.data.y + lastFrameY + (frames[frameIndex + 2 /*FRAME_Y*/ ] - lastFrameY) * percent - bone.y) * alpha;
        }
    };

    spine.ScaleTimeline = function(frameCount) {
        this.curves = new spine.Curves(frameCount);
        this.frames = []; // time, x, y, ...
        this.frames.length = frameCount * 3;
    };
    spine.ScaleTimeline.prototype = {
        boneIndex: 0,
        getFrameCount: function() {
            return this.frames.length / 3;
        },
        setFrame: function(frameIndex, time, x, y) {
            frameIndex *= 3;
            this.frames[frameIndex] = time;
            this.frames[frameIndex + 1] = x;
            this.frames[frameIndex + 2] = y;
        },
        apply: function(skeleton, time, alpha) {
            var frames = this.frames;
            if (time < frames[0]) return; // Time is before first frame.

            var bone = skeleton.bones[this.boneIndex];

            if (time >= frames[frames.length - 3]) { // Time is after last frame.
                bone.scaleX += (bone.data.scaleX - 1 + frames[frames.length - 2] - bone.scaleX) * alpha;
                bone.scaleY += (bone.data.scaleY - 1 + frames[frames.length - 1] - bone.scaleY) * alpha;
                return;
            }

            // Interpolate between the last frame and the current frame.
            var frameIndex = spine.binarySearch(frames, time, 3);
            var lastFrameX = frames[frameIndex - 2];
            var lastFrameY = frames[frameIndex - 1];
            var frameTime = frames[frameIndex];
            var percent = 1 - (time - frameTime) / (frames[frameIndex + -3 /*LAST_FRAME_TIME*/ ] - frameTime);
            percent = this.curves.getCurvePercent(frameIndex / 3 - 1, percent);

            bone.scaleX += (bone.data.scaleX - 1 + lastFrameX + (frames[frameIndex + 1 /*FRAME_X*/ ] - lastFrameX) * percent - bone.scaleX) * alpha;
            bone.scaleY += (bone.data.scaleY - 1 + lastFrameY + (frames[frameIndex + 2 /*FRAME_Y*/ ] - lastFrameY) * percent - bone.scaleY) * alpha;
        }
    };

    spine.ColorTimeline = function(frameCount) {
        this.curves = new spine.Curves(frameCount);
        this.frames = []; // time, r, g, b, a, ...
        this.frames.length = frameCount * 5;
    };
    spine.ColorTimeline.prototype = {
        slotIndex: 0,
        getFrameCount: function() {
            return this.frames.length / 5;
        },
        setFrame: function(frameIndex, time, r, g, b, a) {
            frameIndex *= 5;
            this.frames[frameIndex] = time;
            this.frames[frameIndex + 1] = r;
            this.frames[frameIndex + 2] = g;
            this.frames[frameIndex + 3] = b;
            this.frames[frameIndex + 4] = a;
        },
        apply: function(skeleton, time, alpha) {
            var frames = this.frames;
            if (time < frames[0]) return; // Time is before first frame.

            var slot = skeleton.slots[this.slotIndex];

            if (time >= frames[frames.length - 5]) { // Time is after last frame.
                var i = frames.length - 1;
                slot.r = frames[i - 3];
                slot.g = frames[i - 2];
                slot.b = frames[i - 1];
                slot.a = frames[i];
                return;
            }

            // Interpolate between the last frame and the current frame.
            var frameIndex = spine.binarySearch(frames, time, 5);
            var lastFrameR = frames[frameIndex - 4];
            var lastFrameG = frames[frameIndex - 3];
            var lastFrameB = frames[frameIndex - 2];
            var lastFrameA = frames[frameIndex - 1];
            var frameTime = frames[frameIndex];
            var percent = 1 - (time - frameTime) / (frames[frameIndex - 5 /*LAST_FRAME_TIME*/ ] - frameTime);
            percent = this.curves.getCurvePercent(frameIndex / 5 - 1, percent);

            var r = lastFrameR + (frames[frameIndex + 1 /*FRAME_R*/ ] - lastFrameR) * percent;
            var g = lastFrameG + (frames[frameIndex + 2 /*FRAME_G*/ ] - lastFrameG) * percent;
            var b = lastFrameB + (frames[frameIndex + 3 /*FRAME_B*/ ] - lastFrameB) * percent;
            var a = lastFrameA + (frames[frameIndex + 4 /*FRAME_A*/ ] - lastFrameA) * percent;
            if (alpha < 1) {
                slot.r += (r - slot.r) * alpha;
                slot.g += (g - slot.g) * alpha;
                slot.b += (b - slot.b) * alpha;
                slot.a += (a - slot.a) * alpha;
            } else {
                slot.r = r;
                slot.g = g;
                slot.b = b;
                slot.a = a;
            }
        }
    };

    spine.AttachmentTimeline = function(frameCount) {
        this.curves = new spine.Curves(frameCount);
        this.frames = []; // time, ...
        this.frames.length = frameCount;
        this.attachmentNames = []; // time, ...
        this.attachmentNames.length = frameCount;
    };
    spine.AttachmentTimeline.prototype = {
        slotIndex: 0,
        getFrameCount: function() {
            return this.frames.length;
        },
        setFrame: function(frameIndex, time, attachmentName) {
            this.frames[frameIndex] = time;
            this.attachmentNames[frameIndex] = attachmentName;
        },
        apply: function(skeleton, time, alpha) {
            var frames = this.frames;
            if (time < frames[0]) return; // Time is before first frame.

            var frameIndex;
            if (time >= frames[frames.length - 1]) // Time is after last frame.
                frameIndex = frames.length - 1;
            else
                frameIndex = spine.binarySearch(frames, time, 1) - 1;

            var attachmentName = this.attachmentNames[frameIndex];
            skeleton.slots[this.slotIndex].setAttachment(!attachmentName ? null : skeleton.getAttachmentBySlotIndex(this.slotIndex, attachmentName));
        }
    };

    spine.SkeletonData = function() {
        this.bones = [];
        this.slots = [];
        this.skins = [];
        this.animations = [];
    };
    spine.SkeletonData.prototype = {
        defaultSkin: null,
        /** @return May be null. */
        findBone: function(boneName) {
            var bones = this.bones;
            for (var i = 0, n = bones.length; i < n; i++)
                if (bones[i].name == boneName) return bones[i];
            return null;
        },
        /** @return -1 if the bone was not found. */
        findBoneIndex: function(boneName) {
            var bones = this.bones;
            for (var i = 0, n = bones.length; i < n; i++)
                if (bones[i].name == boneName) return i;
            return -1;
        },
        /** @return May be null. */
        findSlot: function(slotName) {
            var slots = this.slots;
            for (var i = 0, n = slots.length; i < n; i++) {
                if (slots[i].name == slotName) return slot[i];
            }
            return null;
        },
        /** @return -1 if the bone was not found. */
        findSlotIndex: function(slotName) {
            var slots = this.slots;
            for (var i = 0, n = slots.length; i < n; i++)
                if (slots[i].name == slotName) return i;
            return -1;
        },
        /** @return May be null. */
        findSkin: function(skinName) {
            var skins = this.skins;
            for (var i = 0, n = skins.length; i < n; i++)
                if (skins[i].name == skinName) return skins[i];
            return null;
        },
        /** @return May be null. */
        findAnimation: function(animationName) {
            var animations = this.animations;
            for (var i = 0, n = animations.length; i < n; i++)
                if (animations[i].name == animationName) return animations[i];
            return null;
        }
    };

    spine.Skeleton = function(skeletonData) {
        this.data = skeletonData;

        this.bones = [];
        for (var i = 0, n = skeletonData.bones.length; i < n; i++) {
            var boneData = skeletonData.bones[i];
            var parent = !boneData.parent ? null : this.bones[skeletonData.bones.indexOf(boneData.parent)];
            this.bones.push(new spine.Bone(boneData, parent));
        }

        this.slots = [];
        this.drawOrder = [];
        for (i = 0, n = skeletonData.slots.length; i < n; i++) {
            var slotData = skeletonData.slots[i];
            var bone = this.bones[skeletonData.bones.indexOf(slotData.boneData)];
            var slot = new spine.Slot(slotData, this, bone);
            this.slots.push(slot);
            this.drawOrder.push(slot);
        }
    };
    spine.Skeleton.prototype = {
        x: 0,
        y: 0,
        skin: null,
        r: 1,
        g: 1,
        b: 1,
        a: 1,
        time: 0,
        flipX: false,
        flipY: false,
        /** Updates the world transform for each bone. */
        updateWorldTransform: function() {
            var flipX = this.flipX;
            var flipY = this.flipY;
            var bones = this.bones;
            for (var i = 0, n = bones.length; i < n; i++)
                bones[i].updateWorldTransform(flipX, flipY);
        },
        /** Sets the bones and slots to their setup pose values. */
        setToSetupPose: function() {
            this.setBonesToSetupPose();
            this.setSlotsToSetupPose();
        },
        setBonesToSetupPose: function() {
            var bones = this.bones;
            for (var i = 0, n = bones.length; i < n; i++)
                bones[i].setToSetupPose();
        },
        setSlotsToSetupPose: function() {
            var slots = this.slots;
            for (var i = 0, n = slots.length; i < n; i++)
                slots[i].setToSetupPose(i);
        },
        /** @return May return null. */
        getRootBone: function() {
            return this.bones.length ? this.bones[0] : null;
        },
        /** @return May be null. */
        findBone: function(boneName) {
            var bones = this.bones;
            for (var i = 0, n = bones.length; i < n; i++)
                if (bones[i].data.name == boneName) return bones[i];
            return null;
        },
        /** @return -1 if the bone was not found. */
        findBoneIndex: function(boneName) {
            var bones = this.bones;
            for (var i = 0, n = bones.length; i < n; i++)
                if (bones[i].data.name == boneName) return i;
            return -1;
        },
        /** @return May be null. */
        findSlot: function(slotName) {
            var slots = this.slots;
            for (var i = 0, n = slots.length; i < n; i++)
                if (slots[i].data.name == slotName) return slots[i];
            return null;
        },
        /** @return -1 if the bone was not found. */
        findSlotIndex: function(slotName) {
            var slots = this.slots;
            for (var i = 0, n = slots.length; i < n; i++)
                if (slots[i].data.name == slotName) return i;
            return -1;
        },
        setSkinByName: function(skinName) {
            var skin = this.data.findSkin(skinName);
            if (!skin) throw "Skin not found: " + skinName;
            this.setSkin(skin);
        },
        /** Sets the skin used to look up attachments not found in the {@link SkeletonData#getDefaultSkin() default skin}. Attachments
         * from the new skin are attached if the corresponding attachment from the old skin was attached.
         * @param newSkin May be null. */
        setSkin: function(newSkin) {
            if (this.skin && newSkin) newSkin._attachAll(this, this.skin);
            this.skin = newSkin;
        },
        /** @return May be null. */
        getAttachmentBySlotName: function(slotName, attachmentName) {
            return this.getAttachmentBySlotIndex(this.data.findSlotIndex(slotName), attachmentName);
        },
        /** @return May be null. */
        getAttachmentBySlotIndex: function(slotIndex, attachmentName) {
            if (this.skin) {
                var attachment = this.skin.getAttachment(slotIndex, attachmentName);
                if (attachment) return attachment;
            }
            if (this.data.defaultSkin) return this.data.defaultSkin.getAttachment(slotIndex, attachmentName);
            return null;
        },
        /** @param attachmentName May be null. */
        setAttachment: function(slotName, attachmentName) {
            var slots = this.slots;
            for (var i = 0, n = slots.size; i < n; i++) {
                var slot = slots[i];
                if (slot.data.name == slotName) {
                    var attachment = null;
                    if (attachmentName) {
                        attachment = this.getAttachment(i, attachmentName);
                        if (attachment == null) throw "Attachment not found: " + attachmentName + ", for slot: " + slotName;
                    }
                    slot.setAttachment(attachment);
                    return;
                }
            }
            throw "Slot not found: " + slotName;
        },
        update: function(delta) {
            time += delta;
        }
    };

    spine.AttachmentType = {
        region: 0
    };

    spine.RegionAttachment = function() {
        this.offset = [];
        this.offset.length = 8;
        this.uvs = [];
        this.uvs.length = 8;
    };
    spine.RegionAttachment.prototype = {
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        width: 0,
        height: 0,
        rendererObject: null,
        regionOffsetX: 0,
        regionOffsetY: 0,
        regionWidth: 0,
        regionHeight: 0,
        regionOriginalWidth: 0,
        regionOriginalHeight: 0,
        setUVs: function(u, v, u2, v2, rotate) {
            var uvs = this.uvs;
            if (rotate) {
                uvs[2 /*X2*/ ] = u;
                uvs[3 /*Y2*/ ] = v2;
                uvs[4 /*X3*/ ] = u;
                uvs[5 /*Y3*/ ] = v;
                uvs[6 /*X4*/ ] = u2;
                uvs[7 /*Y4*/ ] = v;
                uvs[0 /*X1*/ ] = u2;
                uvs[1 /*Y1*/ ] = v2;
            } else {
                uvs[0 /*X1*/ ] = u;
                uvs[1 /*Y1*/ ] = v2;
                uvs[2 /*X2*/ ] = u;
                uvs[3 /*Y2*/ ] = v;
                uvs[4 /*X3*/ ] = u2;
                uvs[5 /*Y3*/ ] = v;
                uvs[6 /*X4*/ ] = u2;
                uvs[7 /*Y4*/ ] = v2;
            }
        },
        updateOffset: function() {
            var regionScaleX = this.width / this.regionOriginalWidth * this.scaleX;
            var regionScaleY = this.height / this.regionOriginalHeight * this.scaleY;
            var localX = -this.width / 2 * this.scaleX + this.regionOffsetX * regionScaleX;
            var localY = -this.height / 2 * this.scaleY + this.regionOffsetY * regionScaleY;
            var localX2 = localX + this.regionWidth * regionScaleX;
            var localY2 = localY + this.regionHeight * regionScaleY;
            var radians = this.rotation * Math.PI / 180;
            var cos = Math.cos(radians);
            var sin = Math.sin(radians);
            var localXCos = localX * cos + this.x;
            var localXSin = localX * sin;
            var localYCos = localY * cos + this.y;
            var localYSin = localY * sin;
            var localX2Cos = localX2 * cos + this.x;
            var localX2Sin = localX2 * sin;
            var localY2Cos = localY2 * cos + this.y;
            var localY2Sin = localY2 * sin;
            var offset = this.offset;
            offset[0 /*X1*/ ] = localXCos - localYSin;
            offset[1 /*Y1*/ ] = localYCos + localXSin;
            offset[2 /*X2*/ ] = localXCos - localY2Sin;
            offset[3 /*Y2*/ ] = localY2Cos + localXSin;
            offset[4 /*X3*/ ] = localX2Cos - localY2Sin;
            offset[5 /*Y3*/ ] = localY2Cos + localX2Sin;
            offset[6 /*X4*/ ] = localX2Cos - localYSin;
            offset[7 /*Y4*/ ] = localYCos + localX2Sin;
        },
        computeVertices: function(x, y, bone, vertices) {
            x += bone.worldX;
            y += bone.worldY;
            var m00 = bone.m00;
            var m01 = bone.m01;
            var m10 = bone.m10;
            var m11 = bone.m11;
            var offset = this.offset;
            vertices[0 /*X1*/ ] = offset[0 /*X1*/ ] * m00 + offset[1 /*Y1*/ ] * m01 + x;
            vertices[1 /*Y1*/ ] = offset[0 /*X1*/ ] * m10 + offset[1 /*Y1*/ ] * m11 + y;
            vertices[2 /*X2*/ ] = offset[2 /*X2*/ ] * m00 + offset[3 /*Y2*/ ] * m01 + x;
            vertices[3 /*Y2*/ ] = offset[2 /*X2*/ ] * m10 + offset[3 /*Y2*/ ] * m11 + y;
            vertices[4 /*X3*/ ] = offset[4 /*X3*/ ] * m00 + offset[5 /*X3*/ ] * m01 + x;
            vertices[5 /*X3*/ ] = offset[4 /*X3*/ ] * m10 + offset[5 /*X3*/ ] * m11 + y;
            vertices[6 /*X4*/ ] = offset[6 /*X4*/ ] * m00 + offset[7 /*Y4*/ ] * m01 + x;
            vertices[7 /*Y4*/ ] = offset[6 /*X4*/ ] * m10 + offset[7 /*Y4*/ ] * m11 + y;
        }
    }

    spine.AnimationStateData = function(skeletonData) {
        this.skeletonData = skeletonData;
        this.animationToMixTime = {};
    };
    spine.AnimationStateData.prototype = {
        defaultMix: 0,
        setMixByName: function(fromName, toName, duration) {
            var from = this.skeletonData.findAnimation(fromName);
            if (!from) throw "Animation not found: " + fromName;
            var to = this.skeletonData.findAnimation(toName);
            if (!to) throw "Animation not found: " + toName;
            this.setMix(from, to, duration);
        },
        setMix: function(from, to, duration) {
            this.animationToMixTime[from.name + ":" + to.name] = duration;
        },
        getMix: function(from, to) {
            var time = this.animationToMixTime[from.name + ":" + to.name];
            return time ? time : this.defaultMix;
        }
    };

    spine.AnimationState = function(stateData) {
        this.data = stateData;
        this.queue = [];
    };
    spine.AnimationState.prototype = {
        animationSpeed: 1,
        current: null,
        previous: null,
        currentTime: 0,
        previousTime: 0,
        currentLoop: false,
        previousLoop: false,
        mixTime: 0,
        mixDuration: 0,
        update: function(delta) {
            this.currentTime += (delta * this.animationSpeed); //timeScale: Multiply delta by the speed of animation required.
            this.previousTime += delta;
            this.mixTime += delta;

            if (this.queue.length > 0) {
                var entry = this.queue[0];
                if (this.currentTime >= entry.delay) {
                    this._setAnimation(entry.animation, entry.loop);
                    this.queue.shift();
                }
            }
        },
        apply: function(skeleton) {
            if (!this.current) return;
            if (this.previous) {
                this.previous.apply(skeleton, this.previousTime, this.previousLoop);
                var alpha = this.mixTime / this.mixDuration;
                if (alpha >= 1) {
                    alpha = 1;
                    this.previous = null;
                }
                this.current.mix(skeleton, this.currentTime, this.currentLoop, alpha);
            } else
                this.current.apply(skeleton, this.currentTime, this.currentLoop);
        },
        clearAnimation: function() {
            this.previous = null;
            this.current = null;
            this.queue.length = 0;
        },
        _setAnimation: function(animation, loop) {
            this.previous = null;
            if (animation && this.current) {
                this.mixDuration = this.data.getMix(this.current, animation);
                if (this.mixDuration > 0) {
                    this.mixTime = 0;
                    this.previous = this.current;
                    this.previousTime = this.currentTime;
                    this.previousLoop = this.currentLoop;
                }
            }
            this.current = animation;
            this.currentLoop = loop;
            this.currentTime = 0;
        },
        /** @see #setAnimation(Animation, Boolean) */
        setAnimationByName: function(animationName, loop) {
            var animation = this.data.skeletonData.findAnimation(animationName);
            if (!animation) throw "Animation not found: " + animationName;
            this.setAnimation(animation, loop);
        },
        /** Set the current animation. Any queued animations are cleared and the current animation time is set to 0.
         * @param animation May be null. */
        setAnimation: function(animation, loop) {
            this.queue.length = 0;
            this._setAnimation(animation, loop);
        },
        /** @see #addAnimation(Animation, Boolean, Number) */
        addAnimationByName: function(animationName, loop, delay) {
            var animation = this.data.skeletonData.findAnimation(animationName);
            if (!animation) throw "Animation not found: " + animationName;
            this.addAnimation(animation, loop, delay);
        },
        /** Adds an animation to be played delay seconds after the current or last queued animation.
         * @param delay May be <= 0 to use duration of previous animation minus any mix duration plus the negative delay. */
        addAnimation: function(animation, loop, delay) {
            var entry = {};
            entry.animation = animation;
            entry.loop = loop;

            if (!delay || delay <= 0) {
                var previousAnimation = this.queue.length ? this.queue[this.queue.length - 1].animation : this.current;
                if (previousAnimation != null)
                    delay = previousAnimation.duration - this.data.getMix(previousAnimation, animation) + (delay || 0);
                else
                    delay = 0;
            }
            entry.delay = delay;

            this.queue.push(entry);
        },
        /** Returns true if no animation is set or if the current time is greater than the animation duration, regardless of looping. */
        isComplete: function() {
            return !this.current || this.currentTime >= this.current.duration;
        }
    };

    spine.SkeletonJson = function(attachmentLoader) {
        this.attachmentLoader = attachmentLoader;
    };
    spine.SkeletonJson.prototype = {
        scale: 1,
        readSkeletonData: function(root) {
            /*jshint -W069*/
            var skeletonData = new spine.SkeletonData(),
                boneData;

            // Bones.
            var bones = root["bones"];
            for (var i = 0, n = bones.length; i < n; i++) {
                var boneMap = bones[i];
                var parent = null;
                if (boneMap["parent"]) {
                    parent = skeletonData.findBone(boneMap["parent"]);
                    if (!parent) throw "Parent bone not found: " + boneMap["parent"];
                }
                boneData = new spine.BoneData(boneMap["name"], parent);
                boneData.length = (boneMap["length"] || 0) * this.scale;
                boneData.x = (boneMap["x"] || 0) * this.scale;
                boneData.y = (boneMap["y"] || 0) * this.scale;
                boneData.rotation = (boneMap["rotation"] || 0);
                boneData.scaleX = boneMap["scaleX"] || 1;
                boneData.scaleY = boneMap["scaleY"] || 1;
                skeletonData.bones.push(boneData);
            }

            // Slots.
            var slots = root["slots"];
            for (i = 0, n = slots.length; i < n; i++) {
                var slotMap = slots[i];
                boneData = skeletonData.findBone(slotMap["bone"]);
                if (!boneData) throw "Slot bone not found: " + slotMap["bone"];
                var slotData = new spine.SlotData(slotMap["name"], boneData);

                var color = slotMap["color"];
                if (color) {
                    slotData.r = spine.SkeletonJson.toColor(color, 0);
                    slotData.g = spine.SkeletonJson.toColor(color, 1);
                    slotData.b = spine.SkeletonJson.toColor(color, 2);
                    slotData.a = spine.SkeletonJson.toColor(color, 3);
                }

                slotData.attachmentName = slotMap["attachment"];

                skeletonData.slots.push(slotData);
            }

            // Skins.
            var skins = root["skins"];
            for (var skinName in skins) {
                if (!skins.hasOwnProperty(skinName)) continue;
                var skinMap = skins[skinName];
                var skin = new spine.Skin(skinName);
                for (var slotName in skinMap) {
                    if (!skinMap.hasOwnProperty(slotName)) continue;
                    var slotIndex = skeletonData.findSlotIndex(slotName);
                    var slotEntry = skinMap[slotName];
                    for (var attachmentName in slotEntry) {
                        if (!slotEntry.hasOwnProperty(attachmentName)) continue;
                        var attachment = this.readAttachment(skin, attachmentName, slotEntry[attachmentName]);
                        if (attachment != null) skin.addAttachment(slotIndex, attachmentName, attachment);
                    }
                }
                skeletonData.skins.push(skin);
                if (skin.name == "default") skeletonData.defaultSkin = skin;
            }

            // Animations.
            var animations = root["animations"];
            for (var animationName in animations) {
                if (!animations.hasOwnProperty(animationName)) continue;
                this.readAnimation(animationName, animations[animationName], skeletonData);
            }

            return skeletonData;
        },
        readAttachment: function(skin, name, map) {
            /*jshint -W069*/
            name = map["name"] || name;

            var type = spine.AttachmentType[map["type"] || "region"];

            if (type == spine.AttachmentType.region) {
                var attachment = new spine.RegionAttachment();
                attachment.x = (map["x"] || 0) * this.scale;
                attachment.y = (map["y"] || 0) * this.scale;
                attachment.scaleX = map["scaleX"] || 1;
                attachment.scaleY = map["scaleY"] || 1;
                attachment.rotation = map["rotation"] || 0;
                attachment.width = (map["width"] || 32) * this.scale;
                attachment.height = (map["height"] || 32) * this.scale;
                attachment.updateOffset();

                attachment.rendererObject = {};
                attachment.rendererObject.name = name;
                attachment.rendererObject.scale = {};
                attachment.rendererObject.scale.x = attachment.scaleX;
                attachment.rendererObject.scale.y = attachment.scaleY;
                attachment.rendererObject.rotation = -attachment.rotation * Math.PI / 180;
                return attachment;
            }

            throw "Unknown attachment type: " + type;
        },

        readAnimation: function(name, map, skeletonData) {
            /*jshint -W069*/
            var timelines = [];
            var duration = 0;
            var frameIndex, timeline, timelineName, valueMap, values,
                i, n;

            var bones = map["bones"];
            for (var boneName in bones) {
                if (!bones.hasOwnProperty(boneName)) continue;
                var boneIndex = skeletonData.findBoneIndex(boneName);
                if (boneIndex == -1) throw "Bone not found: " + boneName;
                var boneMap = bones[boneName];

                for (timelineName in boneMap) {
                    if (!boneMap.hasOwnProperty(timelineName)) continue;
                    values = boneMap[timelineName];
                    if (timelineName == "rotate") {
                        timeline = new spine.RotateTimeline(values.length);
                        timeline.boneIndex = boneIndex;

                        frameIndex = 0;
                        for (i = 0, n = values.length; i < n; i++) {
                            valueMap = values[i];
                            timeline.setFrame(frameIndex, valueMap["time"], valueMap["angle"]);
                            spine.SkeletonJson.readCurve(timeline, frameIndex, valueMap);
                            frameIndex++;
                        }
                        timelines.push(timeline);
                        duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 2 - 2]);

                    } else if (timelineName == "translate" || timelineName == "scale") {
                        var timelineScale = 1;
                        if (timelineName == "scale")
                            timeline = new spine.ScaleTimeline(values.length);
                        else {
                            timeline = new spine.TranslateTimeline(values.length);
                            timelineScale = this.scale;
                        }
                        timeline.boneIndex = boneIndex;

                        frameIndex = 0;
                        for (i = 0, n = values.length; i < n; i++) {
                            valueMap = values[i];
                            var x = (valueMap["x"] || 0) * timelineScale;
                            var y = (valueMap["y"] || 0) * timelineScale;
                            timeline.setFrame(frameIndex, valueMap["time"], x, y);
                            spine.SkeletonJson.readCurve(timeline, frameIndex, valueMap);
                            frameIndex++;
                        }
                        timelines.push(timeline);
                        duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 3 - 3]);

                    } else
                        throw "Invalid timeline type for a bone: " + timelineName + " (" + boneName + ")";
                }
            }
            var slots = map["slots"];
            for (var slotName in slots) {
                if (!slots.hasOwnProperty(slotName)) continue;
                var slotMap = slots[slotName];
                var slotIndex = skeletonData.findSlotIndex(slotName);

                for (timelineName in slotMap) {
                    if (!slotMap.hasOwnProperty(timelineName)) continue;
                    values = slotMap[timelineName];
                    if (timelineName == "color") {
                        timeline = new spine.ColorTimeline(values.length);
                        timeline.slotIndex = slotIndex;

                        frameIndex = 0;
                        for (i = 0, n = values.length; i < n; i++) {
                            valueMap = values[i];
                            var color = valueMap["color"];
                            var r = spine.SkeletonJson.toColor(color, 0);
                            var g = spine.SkeletonJson.toColor(color, 1);
                            var b = spine.SkeletonJson.toColor(color, 2);
                            var a = spine.SkeletonJson.toColor(color, 3);
                            timeline.setFrame(frameIndex, valueMap["time"], r, g, b, a);
                            spine.SkeletonJson.readCurve(timeline, frameIndex, valueMap);
                            frameIndex++;
                        }
                        timelines.push(timeline);
                        duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 5 - 5]);

                    } else if (timelineName == "attachment") {
                        timeline = new spine.AttachmentTimeline(values.length);
                        timeline.slotIndex = slotIndex;

                        frameIndex = 0;
                        for (i = 0, n = values.length; i < n; i++) {
                            valueMap = values[i];
                            timeline.setFrame(frameIndex++, valueMap["time"], valueMap["name"]);
                        }
                        timelines.push(timeline);
                        duration = Math.max(duration, timeline.frames[timeline.getFrameCount() - 1]);

                    } else
                        throw "Invalid timeline type for a slot: " + timelineName + " (" + slotName + ")";
                }
            }
            skeletonData.animations.push(new spine.Animation(name, timelines, duration));
        }
    };
    spine.SkeletonJson.readCurve = function(timeline, frameIndex, valueMap) {
        /*jshint -W069*/
        var curve = valueMap["curve"];
        if (!curve) return;
        if (curve == "stepped")
            timeline.curves.setStepped(frameIndex);
        else if (curve instanceof Array)
            timeline.curves.setCurve(frameIndex, curve[0], curve[1], curve[2], curve[3]);
    };
    spine.SkeletonJson.toColor = function(hexString, colorIndex) {
        if (hexString.length != 8) throw "Color hexidecimal length must be 8, recieved: " + hexString;
        return parseInt(hexString.substr(colorIndex * 2, 2), 16) / 255;
    };

    spine.Atlas = function(atlasText, textureLoader) {
        this.textureLoader = textureLoader;
        this.pages = [];
        this.regions = [];

        var reader = new spine.AtlasReader(atlasText);
        var tuple = [];
        tuple.length = 4;
        var page = null;
        while (true) {
            var line = reader.readLine();
            if (line == null) break;
            line = reader.trim(line);
            if (!line.length)
                page = null;
            else if (!page) {
                page = new spine.AtlasPage();
                page.name = line;

                page.format = spine.Atlas.Format[reader.readValue()];

                reader.readTuple(tuple);
                page.minFilter = spine.Atlas.TextureFilter[tuple[0]];
                page.magFilter = spine.Atlas.TextureFilter[tuple[1]];

                var direction = reader.readValue();
                page.uWrap = spine.Atlas.TextureWrap.clampToEdge;
                page.vWrap = spine.Atlas.TextureWrap.clampToEdge;
                if (direction == "x")
                    page.uWrap = spine.Atlas.TextureWrap.repeat;
                else if (direction == "y")
                    page.vWrap = spine.Atlas.TextureWrap.repeat;
                else if (direction == "xy")
                    page.uWrap = page.vWrap = spine.Atlas.TextureWrap.repeat;

                textureLoader.load(page, line);

                this.pages.push(page);

            } else {
                var region = new spine.AtlasRegion();
                region.name = line;
                region.page = page;

                region.rotate = reader.readValue() == "true";

                reader.readTuple(tuple);
                var x = parseInt(tuple[0], 10);
                var y = parseInt(tuple[1], 10);

                reader.readTuple(tuple);
                var width = parseInt(tuple[0], 10);
                var height = parseInt(tuple[1], 10);

                region.u = x / page.width;
                region.v = y / page.height;
                if (region.rotate) {
                    region.u2 = (x + height) / page.width;
                    region.v2 = (y + width) / page.height;
                } else {
                    region.u2 = (x + width) / page.width;
                    region.v2 = (y + height) / page.height;
                }
                region.x = x;
                region.y = y;
                region.width = Math.abs(width);
                region.height = Math.abs(height);

                if (reader.readTuple(tuple) == 4) { // split is optional
                    region.splits = [parseInt(tuple[0], 10), parseInt(tuple[1], 10), parseInt(tuple[2], 10), parseInt(tuple[3], 10)];

                    if (reader.readTuple(tuple) == 4) { // pad is optional, but only present with splits
                        region.pads = [parseInt(tuple[0], 10), parseInt(tuple[1], 10), parseInt(tuple[2], 10), parseInt(tuple[3], 10)];

                        reader.readTuple(tuple);
                    }
                }

                region.originalWidth = parseInt(tuple[0], 10);
                region.originalHeight = parseInt(tuple[1], 10);

                reader.readTuple(tuple);
                region.offsetX = parseInt(tuple[0], 10);
                region.offsetY = parseInt(tuple[1], 10);

                region.index = parseInt(reader.readValue(), 10);

                this.regions.push(region);
            }
        }
    };
    spine.Atlas.prototype = {
        findRegion: function(name) {
            var regions = this.regions;
            for (var i = 0, n = regions.length; i < n; i++)
                if (regions[i].name == name) return regions[i];
            return null;
        },
        dispose: function() {
            var pages = this.pages;
            for (var i = 0, n = pages.length; i < n; i++)
                this.textureLoader.unload(pages[i].rendererObject);
        },
        updateUVs: function(page) {
            var regions = this.regions;
            for (var i = 0, n = regions.length; i < n; i++) {
                var region = regions[i];
                if (region.page != page) continue;
                region.u = region.x / page.width;
                region.v = region.y / page.height;
                if (region.rotate) {
                    region.u2 = (region.x + region.height) / page.width;
                    region.v2 = (region.y + region.width) / page.height;
                } else {
                    region.u2 = (region.x + region.width) / page.width;
                    region.v2 = (region.y + region.height) / page.height;
                }
            }
        }
    };

    spine.Atlas.Format = {
        alpha: 0,
        intensity: 1,
        luminanceAlpha: 2,
        rgb565: 3,
        rgba4444: 4,
        rgb888: 5,
        rgba8888: 6
    };

    spine.Atlas.TextureFilter = {
        nearest: 0,
        linear: 1,
        mipMap: 2,
        mipMapNearestNearest: 3,
        mipMapLinearNearest: 4,
        mipMapNearestLinear: 5,
        mipMapLinearLinear: 6
    };

    spine.Atlas.TextureWrap = {
        mirroredRepeat: 0,
        clampToEdge: 1,
        repeat: 2
    };

    spine.AtlasPage = function() {};
    spine.AtlasPage.prototype = {
        name: null,
        format: null,
        minFilter: null,
        magFilter: null,
        uWrap: null,
        vWrap: null,
        rendererObject: null,
        width: 0,
        height: 0
    };

    spine.AtlasRegion = function() {};
    spine.AtlasRegion.prototype = {
        page: null,
        name: null,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        u: 0,
        v: 0,
        u2: 0,
        v2: 0,
        offsetX: 0,
        offsetY: 0,
        originalWidth: 0,
        originalHeight: 0,
        index: 0,
        rotate: false,
        splits: null,
        pads: null
    };

    spine.AtlasReader = function(text) {
        this.lines = text.split(/\r\n|\r|\n/);
    };
    spine.AtlasReader.prototype = {
        index: 0,
        trim: function(value) {
            return value.replace(/^\s+|\s+$/g, "");
        },
        readLine: function() {
            if (this.index >= this.lines.length) return null;
            return this.lines[this.index++];
        },
        readValue: function() {
            var line = this.readLine();
            var colon = line.indexOf(":");
            if (colon == -1) throw "Invalid line: " + line;
            return this.trim(line.substring(colon + 1));
        },
        /** Returns the number of tuple values read (2 or 4). */
        readTuple: function(tuple) {
            var line = this.readLine();
            var colon = line.indexOf(":");
            if (colon == -1) throw "Invalid line: " + line;
            var i = 0,
                lastMatch = colon + 1;
            for (; i < 3; i++) {
                var comma = line.indexOf(",", lastMatch);
                if (comma == -1) {
                    if (!i) throw "Invalid line: " + line;
                    break;
                }
                tuple[i] = this.trim(line.substr(lastMatch, comma - lastMatch));
                lastMatch = comma + 1;
            }
            tuple[i] = this.trim(line.substring(lastMatch));
            return i + 1;
        }
    }

    spine.AtlasAttachmentLoader = function(atlas) {
        this.atlas = atlas;
    }
    spine.AtlasAttachmentLoader.prototype = {
        newAttachment: function(skin, type, name) {
            switch (type) {
                case spine.AttachmentType.region:
                    var region = this.atlas.findRegion(name);
                    if (!region) throw "Region not found in atlas: " + name + " (" + type + ")";
                    var attachment = new spine.RegionAttachment(name);
                    attachment.rendererObject = region;
                    attachment.setUVs(region.u, region.v, region.u2, region.v2, region.rotate);
                    attachment.regionOffsetX = region.offsetX;
                    attachment.regionOffsetY = region.offsetY;
                    attachment.regionWidth = region.width;
                    attachment.regionHeight = region.height;
                    attachment.regionOriginalWidth = region.originalWidth;
                    attachment.regionOriginalHeight = region.originalHeight;
                    return attachment;
            }
            throw "Unknown attachment type: " + type;
        }
    }

    spine.Bone.yDown = true;
    PIXI.AnimCache = {};

    /**
     * A class that enables the you to import and run your spine animations in pixi.
     * Spine animation data needs to be loaded using the PIXI.AssetLoader or PIXI.SpineLoader before it can be used by this class
     * See example 12 (http://www.goodboydigital.com/pixijs/examples/12/) to see a working example and check out the source
     *
     * @class Spine
     * @extends DisplayObjectContainer
     * @constructor
     * @param url {String} The url of the spine anim file to be used
     */
    PIXI.Spine = function(url) {
        PIXI.DisplayObjectContainer.call(this);

        this.spineData = PIXI.AnimCache[url];

        if (!this.spineData) {
            throw new Error("Spine data must be preloaded using PIXI.SpineLoader or PIXI.AssetLoader: " + url);
        }

        this.skeleton = new spine.Skeleton(this.spineData);
        this.skeleton.updateWorldTransform();

        this.stateData = new spine.AnimationStateData(this.spineData);
        this.state = new spine.AnimationState(this.stateData);

        this.slotContainers = [];

        for (var i = 0, n = this.skeleton.drawOrder.length; i < n; i++) {
            var slot = this.skeleton.drawOrder[i];
            var attachment = slot.attachment;
            var slotContainer = new PIXI.DisplayObjectContainer();
            this.slotContainers.push(slotContainer);
            this.addChild(slotContainer);
            if (!(attachment instanceof spine.RegionAttachment)) {
                continue;
            }
            var spriteName = attachment.rendererObject.name;
            var sprite = this.createSprite(slot, attachment.rendererObject);
            slot.currentSprite = sprite;
            slot.currentSpriteName = spriteName;
            slotContainer.addChild(sprite);
        }
    };

    PIXI.Spine.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
    PIXI.Spine.prototype.constructor = PIXI.Spine;

    /*
     * Updates the object transform for rendering
     *
     * @method updateTransform
     * @private
     */
    PIXI.Spine.prototype.updateTransform = function() {
        this.lastTime = this.lastTime || Date.now();
        var timeDelta = (Date.now() - this.lastTime) * 0.001;
        this.lastTime = Date.now();
        this.state.update(timeDelta);
        this.state.apply(this.skeleton);
        this.skeleton.updateWorldTransform();

        var drawOrder = this.skeleton.drawOrder;
        for (var i = 0, n = drawOrder.length; i < n; i++) {
            var slot = drawOrder[i];
            var attachment = slot.attachment;
            var slotContainer = this.slotContainers[i];
            if (!(attachment instanceof spine.RegionAttachment)) {
                slotContainer.visible = false;
                continue;
            }

            if (attachment.rendererObject) {
                if (!slot.currentSpriteName || slot.currentSpriteName != attachment.name) {
                    var spriteName = attachment.rendererObject.name;
                    if (slot.currentSprite !== undefined) {
                        slot.currentSprite.visible = false;
                    }
                    slot.sprites = slot.sprites || {};
                    if (slot.sprites[spriteName] !== undefined) {
                        slot.sprites[spriteName].visible = true;
                    } else {
                        var sprite = this.createSprite(slot, attachment.rendererObject);
                        slotContainer.addChild(sprite);
                    }
                    slot.currentSprite = slot.sprites[spriteName];
                    slot.currentSpriteName = spriteName;
                }
            }
            slotContainer.visible = true;

            var bone = slot.bone;

            slotContainer.position.x = bone.worldX + attachment.x * bone.m00 + attachment.y * bone.m01;
            slotContainer.position.y = bone.worldY + attachment.x * bone.m10 + attachment.y * bone.m11;
            slotContainer.scale.x = bone.worldScaleX;
            slotContainer.scale.y = bone.worldScaleY;

            slotContainer.rotation = -(slot.bone.worldRotation * Math.PI / 180);

            slotContainer.alpha = slot.a;
            slot.currentSprite.tint = PIXI.rgb2hex([slot.r, slot.g, slot.b]);
        }

        PIXI.DisplayObjectContainer.prototype.updateTransform.call(this);
    };


    PIXI.Spine.prototype.createSprite = function(slot, descriptor) {
        var name = PIXI.TextureCache[descriptor.name] ? descriptor.name : descriptor.name + ".png";
        var sprite = new PIXI.Sprite(PIXI.Texture.fromFrame(name));
        sprite.scale = descriptor.scale;
        sprite.rotation = descriptor.rotation;
        sprite.anchor.x = sprite.anchor.y = 0.5;

        slot.sprites = slot.sprites || {};
        slot.sprites[descriptor.name] = sprite;
        return sprite;
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    PIXI.BaseTextureCache = {};

    PIXI.BaseTextureCacheIdGenerator = 0;

    /**
     * A texture stores the information that represents an image. All textures have a base texture.
     *
     * @class BaseTexture
     * @uses EventTarget
     * @constructor
     * @param source {String} the source object (image or canvas)
     * @param scaleMode {Number} Should be one of the PIXI.scaleMode consts
     */
    PIXI.BaseTexture = function(source, scaleMode) {
        /**
         * The Resolution of the texture. 
         *
         * @property resolution
         * @type Number
         */
        this.resolution = 1;

        /**
         * [read-only] The width of the base texture set when the image has loaded
         *
         * @property width
         * @type Number
         * @readOnly
         */
        this.width = 100;

        /**
         * [read-only] The height of the base texture set when the image has loaded
         *
         * @property height
         * @type Number
         * @readOnly
         */
        this.height = 100;

        /**
         * The scale mode to apply when scaling this texture
         * 
         * @property scaleMode
         * @type PIXI.scaleModes
         * @default PIXI.scaleModes.LINEAR
         */
        this.scaleMode = scaleMode || PIXI.scaleModes.DEFAULT;

        /**
         * [read-only] Set to true once the base texture has loaded
         *
         * @property hasLoaded
         * @type Boolean
         * @readOnly
         */
        this.hasLoaded = false;

        /**
         * The image source that is used to create the texture.
         *
         * @property source
         * @type Image
         */
        this.source = source;

        this._UID = PIXI._UID++;

        /**
         * Controls if RGB channels should be pre-multiplied by Alpha  (WebGL only)
         *
         * @property premultipliedAlpha
         * @type Boolean
         * @default true
         */
        this.premultipliedAlpha = true;

        // used for webGL

        /**
         * @property _glTextures
         * @type Array
         * @private
         */
        this._glTextures = [];

        // used for webGL texture updating...
        // TODO - this needs to be addressed

        /**
         * @property _dirty
         * @type Array
         * @private
         */
        this._dirty = [true, true, true, true];

        if (!source) return;

        if ((this.source.complete || this.source.getContext) && this.source.width && this.source.height) {
            this.hasLoaded = true;
            this.width = this.source.naturalWidth || this.source.width;
            this.height = this.source.naturalHeight || this.source.height;
            this.dirty();
        } else {
            var scope = this;

            this.source.onload = function() {

                scope.hasLoaded = true;
                scope.width = scope.source.naturalWidth || scope.source.width;
                scope.height = scope.source.naturalHeight || scope.source.height;

                scope.dirty();

                // add it to somewhere...
                scope.dispatchEvent({ type: 'loaded', content: scope });
            };

            this.source.onerror = function() {
                scope.dispatchEvent({ type: 'error', content: scope });
            };
        }

        /**
         * @property imageUrl
         * @type String
         */
        this.imageUrl = null;

        /**
         * @property _powerOf2
         * @type Boolean
         * @private
         */
        this._powerOf2 = false;

    };

    PIXI.BaseTexture.prototype.constructor = PIXI.BaseTexture;

    PIXI.EventTarget.mixin(PIXI.BaseTexture.prototype);

    /**
     * Destroys this base texture
     *
     * @method destroy
     */
    PIXI.BaseTexture.prototype.destroy = function() {
        if (this.imageUrl) {
            delete PIXI.BaseTextureCache[this.imageUrl];
            delete PIXI.TextureCache[this.imageUrl];
            this.imageUrl = null;
            this.source.src = '';
        } else if (this.source && this.source._pixiId) {
            delete PIXI.BaseTextureCache[this.source._pixiId];
        }
        this.source = null;

        // delete the webGL textures if any.
        for (var i = this._glTextures.length - 1; i >= 0; i--) {
            var glTexture = this._glTextures[i];
            var gl = PIXI.glContexts[i];

            if (gl && glTexture) {
                gl.deleteTexture(glTexture);
            }
        }

        this._glTextures.length = 0;
    };

    /**
     * Changes the source image of the texture
     *
     * @method updateSourceImage
     * @param newSrc {String} the path of the image
     */
    PIXI.BaseTexture.prototype.updateSourceImage = function(newSrc) {
        this.hasLoaded = false;
        this.source.src = null;
        this.source.src = newSrc;
    };

    /**
     * Sets all glTextures to be dirty.
     *
     * @method dirty
     */
    PIXI.BaseTexture.prototype.dirty = function() {
        for (var i = 0; i < this._glTextures.length; i++) {
            this._dirty[i] = true;
        }
    };

    /**
     * Helper function that creates a base texture from the given image url.
     * If the image is not in the base texture cache it will be created and loaded.
     *
     * @static
     * @method fromImage
     * @param imageUrl {String} The image url of the texture
     * @param crossorigin {Boolean}
     * @param scaleMode {Number} Should be one of the PIXI.scaleMode consts
     * @return BaseTexture
     */
    PIXI.BaseTexture.fromImage = function(imageUrl, crossorigin, scaleMode) {
        var baseTexture = PIXI.BaseTextureCache[imageUrl];

        if (crossorigin === undefined && imageUrl.indexOf('data:') === -1) crossorigin = true;

        if (!baseTexture) {
            // new Image() breaks tex loading in some versions of Chrome.
            // See https://code.google.com/p/chromium/issues/detail?id=238071
            var image = new Image(); //document.createElement('img');
            if (crossorigin) {
                image.crossOrigin = '';
            }

            image.src = imageUrl;
            baseTexture = new PIXI.BaseTexture(image, scaleMode);
            baseTexture.imageUrl = imageUrl;
            PIXI.BaseTextureCache[imageUrl] = baseTexture;

            // if there is an @2x at the end of the url we are going to assume its a highres image
            if (imageUrl.indexOf(PIXI.RETINA_PREFIX + '.') !== -1) {
                baseTexture.resolution = 2;
            }
        }

        return baseTexture;
    };

    /**
     * Helper function that creates a base texture from the given canvas element.
     *
     * @static
     * @method fromCanvas
     * @param canvas {Canvas} The canvas element source of the texture
     * @param scaleMode {Number} Should be one of the PIXI.scaleMode consts
     * @return BaseTexture
     */
    PIXI.BaseTexture.fromCanvas = function(canvas, scaleMode) {
        if (!canvas._pixiId) {
            canvas._pixiId = 'canvas_' + PIXI.TextureCacheIdGenerator++;
        }

        var baseTexture = PIXI.BaseTextureCache[canvas._pixiId];

        if (!baseTexture) {
            baseTexture = new PIXI.BaseTexture(canvas, scaleMode);
            PIXI.BaseTextureCache[canvas._pixiId] = baseTexture;
        }

        return baseTexture;
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    PIXI.TextureCache = {};
    PIXI.FrameCache = {};

    PIXI.TextureCacheIdGenerator = 0;

    /**
     * A texture stores the information that represents an image or part of an image. It cannot be added
     * to the display list directly. Instead use it as the texture for a PIXI.Sprite. If no frame is provided then the whole image is used.
     *
     * @class Texture
     * @uses EventTarget
     * @constructor
     * @param baseTexture {BaseTexture} The base texture source to create the texture from
     * @param frame {Rectangle} The rectangle frame of the texture to show
     * @param [crop] {Rectangle} The area of original texture 
     * @param [trim] {Rectangle} Trimmed texture rectangle
     */
    PIXI.Texture = function(baseTexture, frame, crop, trim) {
        /**
         * Does this Texture have any frame data assigned to it?
         *
         * @property noFrame
         * @type Boolean
         */
        this.noFrame = false;

        if (!frame) {
            this.noFrame = true;
            frame = new PIXI.Rectangle(0, 0, 1, 1);
        }

        if (baseTexture instanceof PIXI.Texture) {
            baseTexture = baseTexture.baseTexture;
        }

        /**
         * The base texture that this texture uses.
         *
         * @property baseTexture
         * @type BaseTexture
         */
        this.baseTexture = baseTexture;

        /**
         * The frame specifies the region of the base texture that this texture uses
         *
         * @property frame
         * @type Rectangle
         */
        this.frame = frame;

        /**
         * The texture trim data.
         *
         * @property trim
         * @type Rectangle
         */
        this.trim = trim;

        /**
         * This will let the renderer know if the texture is valid. If it's not then it cannot be rendered.
         *
         * @property valid
         * @type Boolean
         */
        this.valid = false;

        /**
         * This will let a renderer know that a texture has been updated (used mainly for webGL uv updates)
         *
         * @property requiresUpdate
         * @type Boolean
         */
        this.requiresUpdate = false;

        /**
         * The WebGL UV data cache.
         *
         * @property _uvs
         * @type Object
         * @private
         */
        this._uvs = null;

        /**
         * The width of the Texture in pixels.
         *
         * @property width
         * @type Number
         */
        this.width = 0;

        /**
         * The height of the Texture in pixels.
         *
         * @property height
         * @type Number
         */
        this.height = 0;

        /**
         * This is the area of the BaseTexture image to actually copy to the Canvas / WebGL when rendering,
         * irrespective of the actual frame size or placement (which can be influenced by trimmed texture atlases)
         *
         * @property crop
         * @type Rectangle
         */
        this.crop = crop || new PIXI.Rectangle(0, 0, 1, 1);

        if (baseTexture.hasLoaded) {
            if (this.noFrame) frame = new PIXI.Rectangle(0, 0, baseTexture.width, baseTexture.height);
            this.setFrame(frame);
        } else {
            baseTexture.addEventListener('loaded', this.onBaseTextureLoaded.bind(this));
        }
    };

    PIXI.Texture.prototype.constructor = PIXI.Texture;
    PIXI.EventTarget.mixin(PIXI.Texture.prototype);

    /**
     * Called when the base texture is loaded
     *
     * @method onBaseTextureLoaded
     * @private
     */
    PIXI.Texture.prototype.onBaseTextureLoaded = function() {
        var baseTexture = this.baseTexture;
        baseTexture.removeEventListener('loaded', this.onLoaded);

        if (this.noFrame) this.frame = new PIXI.Rectangle(0, 0, baseTexture.width, baseTexture.height);

        this.setFrame(this.frame);

        this.dispatchEvent({ type: 'update', content: this });
    };

    /**
     * Destroys this texture
     *
     * @method destroy
     * @param destroyBase {Boolean} Whether to destroy the base texture as well
     */
    PIXI.Texture.prototype.destroy = function(destroyBase) {
        if (destroyBase) this.baseTexture.destroy();

        this.valid = false;
    };

    /**
     * Specifies the region of the baseTexture that this texture will use.
     *
     * @method setFrame
     * @param frame {Rectangle} The frame of the texture to set it to
     */
    PIXI.Texture.prototype.setFrame = function(frame) {
        this.noFrame = false;

        this.frame = frame;
        this.width = frame.width;
        this.height = frame.height;

        this.crop.x = frame.x;
        this.crop.y = frame.y;
        this.crop.width = frame.width;
        this.crop.height = frame.height;

        if (!this.trim && (frame.x + frame.width > this.baseTexture.width || frame.y + frame.height > this.baseTexture.height)) {
            throw new Error('Texture Error: frame does not fit inside the base Texture dimensions ' + this);
        }

        this.valid = frame && frame.width && frame.height && this.baseTexture.source && this.baseTexture.hasLoaded;

        if (this.trim) {
            this.width = this.trim.width;
            this.height = this.trim.height;
            this.frame.width = this.trim.width;
            this.frame.height = this.trim.height;
        }

        if (this.valid) this._updateUvs();

    };

    /**
     * Updates the internal WebGL UV cache.
     *
     * @method _updateUvs
     * @private
     */
    PIXI.Texture.prototype._updateUvs = function() {
        if (!this._uvs) this._uvs = new PIXI.TextureUvs();

        var frame = this.crop;
        var tw = this.baseTexture.width;
        var th = this.baseTexture.height;

        this._uvs.x0 = frame.x / tw;
        this._uvs.y0 = frame.y / th;

        this._uvs.x1 = (frame.x + frame.width) / tw;
        this._uvs.y1 = frame.y / th;

        this._uvs.x2 = (frame.x + frame.width) / tw;
        this._uvs.y2 = (frame.y + frame.height) / th;

        this._uvs.x3 = frame.x / tw;
        this._uvs.y3 = (frame.y + frame.height) / th;
    };

    /**
     * Helper function that creates a Texture object from the given image url.
     * If the image is not in the texture cache it will be  created and loaded.
     *
     * @static
     * @method fromImage
     * @param imageUrl {String} The image url of the texture
     * @param crossorigin {Boolean} Whether requests should be treated as crossorigin
     * @param scaleMode {Number} Should be one of the PIXI.scaleMode consts
     * @return Texture
     */
    PIXI.Texture.fromImage = function(imageUrl, crossorigin, scaleMode) {
        var texture = PIXI.TextureCache[imageUrl];

        if (!texture) {
            texture = new PIXI.Texture(PIXI.BaseTexture.fromImage(imageUrl, crossorigin, scaleMode));
            PIXI.TextureCache[imageUrl] = texture;
        }

        return texture;
    };

    /**
     * Helper function that returns a Texture objected based on the given frame id.
     * If the frame id is not in the texture cache an error will be thrown.
     *
     * @static
     * @method fromFrame
     * @param frameId {String} The frame id of the texture
     * @return Texture
     */
    PIXI.Texture.fromFrame = function(frameId) {
        var texture = PIXI.TextureCache[frameId];
        if (!texture) throw new Error('The frameId "' + frameId + '" does not exist in the texture cache ');
        return texture;
    };

    /**
     * Helper function that creates a new a Texture based on the given canvas element.
     *
     * @static
     * @method fromCanvas
     * @param canvas {Canvas} The canvas element source of the texture
     * @param scaleMode {Number} Should be one of the PIXI.scaleMode consts
     * @return Texture
     */
    PIXI.Texture.fromCanvas = function(canvas, scaleMode) {
        var baseTexture = PIXI.BaseTexture.fromCanvas(canvas, scaleMode);

        return new PIXI.Texture(baseTexture);

    };

    /**
     * Adds a texture to the global PIXI.TextureCache. This cache is shared across the whole PIXI object.
     *
     * @static
     * @method addTextureToCache
     * @param texture {Texture} The Texture to add to the cache.
     * @param id {String} The id that the texture will be stored against.
     */
    PIXI.Texture.addTextureToCache = function(texture, id) {
        PIXI.TextureCache[id] = texture;
    };

    /**
     * Remove a texture from the global PIXI.TextureCache.
     *
     * @static
     * @method removeTextureFromCache
     * @param id {String} The id of the texture to be removed
     * @return {Texture} The texture that was removed
     */
    PIXI.Texture.removeTextureFromCache = function(id) {
        var texture = PIXI.TextureCache[id];
        delete PIXI.TextureCache[id];
        delete PIXI.BaseTextureCache[id];
        return texture;
    };

    PIXI.TextureUvs = function() {
        this.x0 = 0;
        this.y0 = 0;

        this.x1 = 0;
        this.y1 = 0;

        this.x2 = 0;
        this.y2 = 0;

        this.x3 = 0;
        this.y3 = 0;
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * A RenderTexture is a special texture that allows any Pixi display object to be rendered to it.
     *
     * __Hint__: All DisplayObjects (i.e. Sprites) that render to a RenderTexture should be preloaded otherwise black rectangles will be drawn instead.
     *
     * A RenderTexture takes a snapshot of any Display Object given to its render method. The position and rotation of the given Display Objects is ignored. For example:
     *
     *    var renderTexture = new PIXI.RenderTexture(800, 600);
     *    var sprite = PIXI.Sprite.fromImage("spinObj_01.png");
     *    sprite.position.x = 800/2;
     *    sprite.position.y = 600/2;
     *    sprite.anchor.x = 0.5;
     *    sprite.anchor.y = 0.5;
     *    renderTexture.render(sprite);
     *
     * The Sprite in this case will be rendered to a position of 0,0. To render this sprite at its actual position a DisplayObjectContainer should be used:
     *
     *    var doc = new PIXI.DisplayObjectContainer();
     *    doc.addChild(sprite);
     *    renderTexture.render(doc);  // Renders to center of renderTexture
     *
     * @class RenderTexture
     * @extends Texture
     * @constructor
     * @param width {Number} The width of the render texture
     * @param height {Number} The height of the render texture
     * @param renderer {CanvasRenderer|WebGLRenderer} The renderer used for this RenderTexture
     * @param scaleMode {Number} Should be one of the PIXI.scaleMode consts
     * @param resolution {Number} The resolution of the texture being generated
     */
    PIXI.RenderTexture = function(width, height, renderer, scaleMode, resolution) {
        /**
         * The with of the render texture
         *
         * @property width
         * @type Number
         */
        this.width = width || 100;

        /**
         * The height of the render texture
         *
         * @property height
         * @type Number
         */
        this.height = height || 100;

        /**
         * The Resolution of the texture.
         *
         * @property resolution
         * @type Number
         */
        this.resolution = resolution || 1;

        /**
         * The framing rectangle of the render texture
         *
         * @property frame
         * @type Rectangle
         */
        this.frame = new PIXI.Rectangle(0, 0, this.width * this.resolution, this.height * this.resolution);

        /**
         * This is the area of the BaseTexture image to actually copy to the Canvas / WebGL when rendering,
         * irrespective of the actual frame size or placement (which can be influenced by trimmed texture atlases)
         *
         * @property crop
         * @type Rectangle
         */
        this.crop = new PIXI.Rectangle(0, 0, this.width * this.resolution, this.height * this.resolution);

        /**
         * The base texture object that this texture uses
         *
         * @property baseTexture
         * @type BaseTexture
         */
        this.baseTexture = new PIXI.BaseTexture();
        this.baseTexture.width = this.width * this.resolution;
        this.baseTexture.height = this.height * this.resolution;
        this.baseTexture._glTextures = [];
        this.baseTexture.resolution = this.resolution;

        this.baseTexture.scaleMode = scaleMode || PIXI.scaleModes.DEFAULT;

        this.baseTexture.hasLoaded = true;

        PIXI.Texture.call(this,
            this.baseTexture,
            new PIXI.Rectangle(0, 0, this.width, this.height)
        );

        /**
         * The renderer this RenderTexture uses. A RenderTexture can only belong to one renderer at the moment if its webGL.
         *
         * @property renderer
         * @type CanvasRenderer|WebGLRenderer
         */
        this.renderer = renderer || PIXI.defaultRenderer;

        if (this.renderer.type === PIXI.WEBGL_RENDERER) {
            var gl = this.renderer.gl;
            this.baseTexture._dirty[gl.id] = false;

            this.textureBuffer = new PIXI.FilterTexture(gl, this.width * this.resolution, this.height * this.resolution, this.baseTexture.scaleMode);
            this.baseTexture._glTextures[gl.id] = this.textureBuffer.texture;

            this.render = this.renderWebGL;
            this.projection = new PIXI.Point(this.width * 0.5, -this.height * 0.5);
        } else {
            this.render = this.renderCanvas;
            this.textureBuffer = new PIXI.CanvasBuffer(this.width * this.resolution, this.height * this.resolution);
            this.baseTexture.source = this.textureBuffer.canvas;
        }

        /**
         * @property valid
         * @type Boolean
         */
        this.valid = true;

        this._updateUvs();
    };

    PIXI.RenderTexture.prototype = Object.create(PIXI.Texture.prototype);
    PIXI.RenderTexture.prototype.constructor = PIXI.RenderTexture;

    /**
     * Resizes the RenderTexture.
     *
     * @method resize
     * @param width {Number} The width to resize to.
     * @param height {Number} The height to resize to.
     * @param updateBase {Boolean} Should the baseTexture.width and height values be resized as well?
     */
    PIXI.RenderTexture.prototype.resize = function(width, height, updateBase) {
        if (width === this.width && height === this.height) return;

        this.valid = (width > 0 && height > 0);

        this.width = this.frame.width = this.crop.width = width;
        this.height = this.frame.height = this.crop.height = height;

        if (updateBase) {
            this.baseTexture.width = this.width;
            this.baseTexture.height = this.height;
        }

        if (this.renderer.type === PIXI.WEBGL_RENDERER) {
            this.projection.x = this.width / 2;
            this.projection.y = -this.height / 2;
        }

        if (!this.valid) return;

        this.textureBuffer.resize(this.width * this.resolution, this.height * this.resolution);
    };

    /**
     * Clears the RenderTexture.
     *
     * @method clear
     */
    PIXI.RenderTexture.prototype.clear = function() {
        if (!this.valid) return;

        if (this.renderer.type === PIXI.WEBGL_RENDERER) {
            this.renderer.gl.bindFramebuffer(this.renderer.gl.FRAMEBUFFER, this.textureBuffer.frameBuffer);
        }

        this.textureBuffer.clear();
    };

    /**
     * This function will draw the display object to the texture.
     *
     * @method renderWebGL
     * @param displayObject {DisplayObject} The display object to render this texture on
     * @param [matrix] {Matrix} Optional matrix to apply to the display object before rendering.
     * @param [clear] {Boolean} If true the texture will be cleared before the displayObject is drawn
     * @private
     */
    PIXI.RenderTexture.prototype.renderWebGL = function(displayObject, matrix, clear) {
        if (!this.valid) return;
        //TOOD replace position with matrix..

        //Lets create a nice matrix to apply to our display object. Frame buffers come in upside down so we need to flip the matrix 
        var wt = displayObject.worldTransform;
        wt.identity();
        wt.translate(0, this.projection.y * 2);
        if (matrix) wt.append(matrix);
        wt.scale(1, -1);

        // setWorld Alpha to ensure that the object is renderer at full opacity
        displayObject.worldAlpha = 1;

        // Time to update all the children of the displayObject with the new matrix..    
        var children = displayObject.children;

        for (var i = 0, j = children.length; i < j; i++) {
            children[i].updateTransform();
        }

        // time for the webGL fun stuff!
        var gl = this.renderer.gl;

        gl.viewport(0, 0, this.width * this.resolution, this.height * this.resolution);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.textureBuffer.frameBuffer);

        if (clear) this.textureBuffer.clear();

        this.renderer.spriteBatch.dirty = true;

        this.renderer.renderDisplayObject(displayObject, this.projection, this.textureBuffer.frameBuffer);

        this.renderer.spriteBatch.dirty = true;
    };


    /**
     * This function will draw the display object to the texture.
     *
     * @method renderCanvas
     * @param displayObject {DisplayObject} The display object to render this texture on
     * @param [matrix] {Matrix} Optional matrix to apply to the display object before rendering.
     * @param [clear] {Boolean} If true the texture will be cleared before the displayObject is drawn
     * @private
     */
    PIXI.RenderTexture.prototype.renderCanvas = function(displayObject, matrix, clear) {
        if (!this.valid) return;

        var wt = displayObject.worldTransform;
        wt.identity();
        if (matrix) wt.append(matrix);

        // Time to update all the children of the displayObject with the new matrix..    
        var children = displayObject.children;

        for (var i = 0, j = children.length; i < j; i++) {
            children[i].updateTransform();
        }

        if (clear) this.textureBuffer.clear();

        var context = this.textureBuffer.context;

        var realResolution = this.renderer.resolution;

        this.renderer.resolution = this.resolution;

        this.renderer.renderDisplayObject(displayObject, context);

        this.renderer.resolution = realResolution;
    };

    /**
     * Will return a HTML Image of the texture
     *
     * @method getImage
     * @return {Image}
     */
    PIXI.RenderTexture.prototype.getImage = function() {
        var image = new Image();
        image.src = this.getBase64();
        return image;
    };

    /**
     * Will return a a base64 encoded string of this texture. It works by calling RenderTexture.getCanvas and then running toDataURL on that.
     *
     * @method getBase64
     * @return {String} A base64 encoded string of the texture.
     */
    PIXI.RenderTexture.prototype.getBase64 = function() {
        return this.getCanvas().toDataURL();
    };

    /**
     * Creates a Canvas element, renders this RenderTexture to it and then returns it.
     *
     * @method getCanvas
     * @return {HTMLCanvasElement} A Canvas element with the texture rendered on.
     */
    PIXI.RenderTexture.prototype.getCanvas = function() {
        if (this.renderer.type === PIXI.WEBGL_RENDERER) {
            var gl = this.renderer.gl;
            var width = this.textureBuffer.width;
            var height = this.textureBuffer.height;

            var webGLPixels = new Uint8Array(4 * width * height);

            gl.bindFramebuffer(gl.FRAMEBUFFER, this.textureBuffer.frameBuffer);
            gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, webGLPixels);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);

            var tempCanvas = new PIXI.CanvasBuffer(width, height);
            var canvasData = tempCanvas.context.getImageData(0, 0, width, height);
            var canvasPixels = canvasData.data;

            for (var i = 0; i < webGLPixels.length; i += 4) {
                var alpha = webGLPixels[i + 3];
                canvasPixels[i] = webGLPixels[i] * alpha;
                canvasPixels[i + 1] = webGLPixels[i + 1] * alpha;
                canvasPixels[i + 2] = webGLPixels[i + 2] * alpha;
                canvasPixels[i + 3] = alpha;
            }

            tempCanvas.context.putImageData(canvasData, 0, 0);

            return tempCanvas.canvas;
        } else {
            return this.textureBuffer.canvas;
        }
    };

    PIXI.RenderTexture.tempMatrix = new PIXI.Matrix();

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * A Class that loads a bunch of images / sprite sheet / bitmap font files. Once the
     * assets have been loaded they are added to the PIXI Texture cache and can be accessed
     * easily through PIXI.Texture.fromImage() and PIXI.Sprite.fromImage()
     * When all items have been loaded this class will dispatch a 'onLoaded' event
     * As each individual item is loaded this class will dispatch a 'onProgress' event
     *
     * @class AssetLoader
     * @constructor
     * @uses EventTarget
     * @param assetURLs {Array<String>} An array of image/sprite sheet urls that you would like loaded
     *      supported. Supported image formats include 'jpeg', 'jpg', 'png', 'gif'. Supported
     *      sprite sheet data formats only include 'JSON' at this time. Supported bitmap font
     *      data formats include 'xml' and 'fnt'.
     * @param crossorigin {Boolean} Whether requests should be treated as crossorigin
     */
    PIXI.AssetLoader = function(assetURLs, crossorigin) {
        /**
         * The array of asset URLs that are going to be loaded
         *
         * @property assetURLs
         * @type Array<String>
         */
        this.assetURLs = assetURLs;

        /**
         * Whether the requests should be treated as cross origin
         *
         * @property crossorigin
         * @type Boolean
         */
        this.crossorigin = crossorigin;

        /**
         * Maps file extension to loader types
         *
         * @property loadersByType
         * @type Object
         */
        this.loadersByType = {
            'jpg': PIXI.ImageLoader,
            'jpeg': PIXI.ImageLoader,
            'png': PIXI.ImageLoader,
            'gif': PIXI.ImageLoader,
            'webp': PIXI.ImageLoader,
            'json': PIXI.JsonLoader,
            'atlas': PIXI.AtlasLoader,
            'anim': PIXI.SpineLoader,
            'xml': PIXI.BitmapFontLoader,
            'fnt': PIXI.BitmapFontLoader
        };
    };

    PIXI.EventTarget.mixin(PIXI.AssetLoader.prototype);

    /**
     * Fired when an item has loaded
     * @event onProgress
     */

    /**
     * Fired when all the assets have loaded
     * @event onComplete
     */

    // constructor
    PIXI.AssetLoader.prototype.constructor = PIXI.AssetLoader;

    /**
     * Given a filename, returns its extension.
     *
     * @method _getDataType
     * @param str {String} the name of the asset
     */
    PIXI.AssetLoader.prototype._getDataType = function(str) {
        var test = 'data:';
        //starts with 'data:'
        var start = str.slice(0, test.length).toLowerCase();
        if (start === test) {
            var data = str.slice(test.length);

            var sepIdx = data.indexOf(',');
            if (sepIdx === -1) //malformed data URI scheme
                return null;

            //e.g. 'image/gif;base64' => 'image/gif'
            var info = data.slice(0, sepIdx).split(';')[0];

            //We might need to handle some special cases here...
            //standardize text/plain to 'txt' file extension
            if (!info || info.toLowerCase() === 'text/plain')
                return 'txt';

            //User specified mime type, try splitting it by '/'
            return info.split('/').pop().toLowerCase();
        }

        return null;
    };

    /**
     * Starts loading the assets sequentially
     *
     * @method load
     */
    PIXI.AssetLoader.prototype.load = function() {
        var scope = this;

        function onLoad(evt) {
            scope.onAssetLoaded(evt.data.content);
        }

        this.loadCount = this.assetURLs.length;

        for (var i = 0; i < this.assetURLs.length; i++) {
            var fileName = this.assetURLs[i];
            //first see if we have a data URI scheme..
            var fileType = this._getDataType(fileName);

            //if not, assume it's a file URI
            if (!fileType)
                fileType = fileName.split('?').shift().split('.').pop().toLowerCase();

            var Constructor = this.loadersByType[fileType];
            if (!Constructor)
                throw new Error(fileType + ' is an unsupported file type');

            var loader = new Constructor(fileName, this.crossorigin);

            loader.on('loaded', onLoad);
            loader.load();
        }
    };

    /**
     * Invoked after each file is loaded
     *
     * @method onAssetLoaded
     * @private
     */
    PIXI.AssetLoader.prototype.onAssetLoaded = function(loader) {
        this.loadCount--;
        this.emit('onProgress', { content: this, loader: loader });
        if (this.onProgress) this.onProgress(loader);

        if (!this.loadCount) {
            this.emit('onComplete', { content: this });
            if (this.onComplete) this.onComplete();
        }
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * The json file loader is used to load in JSON data and parse it
     * When loaded this class will dispatch a 'loaded' event
     * If loading fails this class will dispatch an 'error' event
     *
     * @class JsonLoader
     * @uses EventTarget
     * @constructor
     * @param url {String} The url of the JSON file
     * @param crossorigin {Boolean} Whether requests should be treated as crossorigin
     */
    PIXI.JsonLoader = function(url, crossorigin) {

        /**
         * The url of the bitmap font data
         *
         * @property url
         * @type String
         */
        this.url = url;

        /**
         * Whether the requests should be treated as cross origin
         *
         * @property crossorigin
         * @type Boolean
         */
        this.crossorigin = crossorigin;

        /**
         * [read-only] The base url of the bitmap font data
         *
         * @property baseUrl
         * @type String
         * @readOnly
         */
        this.baseUrl = url.replace(/[^\/]*$/, '');

        /**
         * [read-only] Whether the data has loaded yet
         *
         * @property loaded
         * @type Boolean
         * @readOnly
         */
        this.loaded = false;

    };

    // constructor
    PIXI.JsonLoader.prototype.constructor = PIXI.JsonLoader;

    PIXI.EventTarget.mixin(PIXI.JsonLoader.prototype);

    /**
     * Loads the JSON data
     *
     * @method load
     */
    PIXI.JsonLoader.prototype.load = function() {

        if (window.XDomainRequest && this.crossorigin) {
            this.ajaxRequest = new window.XDomainRequest();

            // XDomainRequest has a few quirks. Occasionally it will abort requests
            // A way to avoid this is to make sure ALL callbacks are set even if not used
            // More info here: http://stackoverflow.com/questions/15786966/xdomainrequest-aborts-post-on-ie-9
            this.ajaxRequest.timeout = 3000;

            this.ajaxRequest.onerror = this.onError.bind(this);

            this.ajaxRequest.ontimeout = this.onError.bind(this);

            this.ajaxRequest.onprogress = function() {};

        } else if (window.XMLHttpRequest) {
            this.ajaxRequest = new window.XMLHttpRequest();
        } else {
            this.ajaxRequest = new window.ActiveXObject('Microsoft.XMLHTTP');
        }

        this.ajaxRequest.onload = this.onJSONLoaded.bind(this);

        this.ajaxRequest.open('GET', this.url, true);

        this.ajaxRequest.send();
    };

    /**
     * Invoked when the JSON file is loaded.
     *
     * @method onJSONLoaded
     * @private
     */
    PIXI.JsonLoader.prototype.onJSONLoaded = function() {

        if (!this.ajaxRequest.responseText) {
            this.onError();
            return;
        }

        this.json = JSON.parse(this.ajaxRequest.responseText);

        if (this.json.frames) {
            // sprite sheet
            var textureUrl = this.baseUrl + this.json.meta.image;
            var image = new PIXI.ImageLoader(textureUrl, this.crossorigin);
            var frameData = this.json.frames;

            this.texture = image.texture.baseTexture;
            image.addEventListener('loaded', this.onLoaded.bind(this));

            for (var i in frameData) {
                var rect = frameData[i].frame;

                if (rect) {
                    var textureSize = new PIXI.Rectangle(rect.x, rect.y, rect.w, rect.h);
                    var crop = textureSize.clone();
                    var trim = null;

                    //  Check to see if the sprite is trimmed
                    if (frameData[i].trimmed) {
                        var actualSize = frameData[i].sourceSize;
                        var realSize = frameData[i].spriteSourceSize;
                        trim = new PIXI.Rectangle(realSize.x, realSize.y, actualSize.w, actualSize.h);
                    }
                    PIXI.TextureCache[i] = new PIXI.Texture(this.texture, textureSize, crop, trim);
                }
            }

            image.load();

        } else if (this.json.bones) {
            // spine animation
            var spineJsonParser = new spine.SkeletonJson();
            var skeletonData = spineJsonParser.readSkeletonData(this.json);
            PIXI.AnimCache[this.url] = skeletonData;
            this.onLoaded();
        } else {
            this.onLoaded();
        }
    };

    /**
     * Invoked when the json file has loaded.
     *
     * @method onLoaded
     * @private
     */
    PIXI.JsonLoader.prototype.onLoaded = function() {
        this.loaded = true;
        this.dispatchEvent({
            type: 'loaded',
            content: this
        });
    };

    /**
     * Invoked if an error occurs.
     *
     * @method onError
     * @private
     */
    PIXI.JsonLoader.prototype.onError = function() {

        this.dispatchEvent({
            type: 'error',
            content: this
        });
    };

    /**
     * @author Martin Kelm http://mkelm.github.com
     */

    /**
     * The atlas file loader is used to load in Texture Atlas data and parse it. When loaded this class will dispatch a 'loaded' event. If loading fails this class will dispatch an 'error' event.
     *
     * To generate the data you can use http://www.codeandweb.com/texturepacker and publish in the 'JSON' format.
     * 
     * It is highly recommended to use texture atlases (also know as 'sprite sheets') as it allowed sprites to be batched and drawn together for highly increased rendering speed.
     * Once the data has been loaded the frames are stored in the PIXI texture cache and can be accessed though PIXI.Texture.fromFrameId() and PIXI.Sprite.fromFrameId()
     * 
     * @class AtlasLoader
     * @uses EventTarget
     * @constructor
     * @param url {String} The url of the JSON file
     * @param crossorigin {Boolean} Whether requests should be treated as crossorigin
     */
    PIXI.AtlasLoader = function(url, crossorigin) {
        this.url = url;
        this.baseUrl = url.replace(/[^\/]*$/, '');
        this.crossorigin = crossorigin;
        this.loaded = false;

    };

    // constructor
    PIXI.AtlasLoader.constructor = PIXI.AtlasLoader;

    PIXI.EventTarget.mixin(PIXI.AtlasLoader.prototype);

    /**
     * Starts loading the JSON file
     *
     * @method load
     */
    PIXI.AtlasLoader.prototype.load = function() {
        this.ajaxRequest = new PIXI.AjaxRequest();
        this.ajaxRequest.onreadystatechange = this.onAtlasLoaded.bind(this);

        this.ajaxRequest.open('GET', this.url, true);
        if (this.ajaxRequest.overrideMimeType) this.ajaxRequest.overrideMimeType('application/json');
        this.ajaxRequest.send(null);
    };

    /**
     * Invoked when the Atlas has fully loaded. Parses the JSON and builds the texture frames.
     * 
     * @method onAtlasLoaded
     * @private
     */
    PIXI.AtlasLoader.prototype.onAtlasLoaded = function() {
        if (this.ajaxRequest.readyState === 4) {
            if (this.ajaxRequest.status === 200 || window.location.href.indexOf('http') === -1) {
                this.atlas = {
                    meta: {
                        image: []
                    },
                    frames: []
                };
                var result = this.ajaxRequest.responseText.split(/\r?\n/);
                var lineCount = -3;

                var currentImageId = 0;
                var currentFrame = null;
                var nameInNextLine = false;

                var i = 0,
                    j = 0,
                    selfOnLoaded = this.onLoaded.bind(this);

                // parser without rotation support yet!
                for (i = 0; i < result.length; i++) {
                    result[i] = result[i].replace(/^\s+|\s+$/g, '');
                    if (result[i] === '') {
                        nameInNextLine = i + 1;
                    }
                    if (result[i].length > 0) {
                        if (nameInNextLine === i) {
                            this.atlas.meta.image.push(result[i]);
                            currentImageId = this.atlas.meta.image.length - 1;
                            this.atlas.frames.push({});
                            lineCount = -3;
                        } else if (lineCount > 0) {
                            if (lineCount % 7 === 1) { // frame name
                                if (currentFrame != null) { //jshint ignore:line
                                    this.atlas.frames[currentImageId][currentFrame.name] = currentFrame;
                                }
                                currentFrame = { name: result[i], frame: {} };
                            } else {
                                var text = result[i].split(' ');
                                if (lineCount % 7 === 3) { // position
                                    currentFrame.frame.x = Number(text[1].replace(',', ''));
                                    currentFrame.frame.y = Number(text[2]);
                                } else if (lineCount % 7 === 4) { // size
                                    currentFrame.frame.w = Number(text[1].replace(',', ''));
                                    currentFrame.frame.h = Number(text[2]);
                                } else if (lineCount % 7 === 5) { // real size
                                    var realSize = {
                                        x: 0,
                                        y: 0,
                                        w: Number(text[1].replace(',', '')),
                                        h: Number(text[2])
                                    };

                                    if (realSize.w > currentFrame.frame.w || realSize.h > currentFrame.frame.h) {
                                        currentFrame.trimmed = true;
                                        currentFrame.realSize = realSize;
                                    } else {
                                        currentFrame.trimmed = false;
                                    }
                                }
                            }
                        }
                        lineCount++;
                    }
                }

                if (currentFrame != null) { //jshint ignore:line
                    this.atlas.frames[currentImageId][currentFrame.name] = currentFrame;
                }

                if (this.atlas.meta.image.length > 0) {
                    this.images = [];
                    for (j = 0; j < this.atlas.meta.image.length; j++) {
                        // sprite sheet
                        var textureUrl = this.baseUrl + this.atlas.meta.image[j];
                        var frameData = this.atlas.frames[j];
                        this.images.push(new PIXI.ImageLoader(textureUrl, this.crossorigin));

                        for (i in frameData) {
                            var rect = frameData[i].frame;
                            if (rect) {
                                PIXI.TextureCache[i] = new PIXI.Texture(this.images[j].texture.baseTexture, {
                                    x: rect.x,
                                    y: rect.y,
                                    width: rect.w,
                                    height: rect.h
                                });
                                if (frameData[i].trimmed) {
                                    PIXI.TextureCache[i].realSize = frameData[i].realSize;
                                    // trim in pixi not supported yet, todo update trim properties if it is done ...
                                    PIXI.TextureCache[i].trim.x = 0;
                                    PIXI.TextureCache[i].trim.y = 0;
                                }
                            }
                        }
                    }

                    this.currentImageId = 0;
                    for (j = 0; j < this.images.length; j++) {
                        this.images[j].on('loaded', selfOnLoaded);
                    }
                    this.images[this.currentImageId].load();

                } else {
                    this.onLoaded();
                }

            } else {
                this.onError();
            }
        }
    };

    /**
     * Invoked when json file has loaded.
     * 
     * @method onLoaded
     * @private
     */
    PIXI.AtlasLoader.prototype.onLoaded = function() {
        if (this.images.length - 1 > this.currentImageId) {
            this.currentImageId++;
            this.images[this.currentImageId].load();
        } else {
            this.loaded = true;
            this.emit('loaded', { content: this });
        }
    };

    /**
     * Invoked when an error occurs.
     * 
     * @method onError
     * @private
     */
    PIXI.AtlasLoader.prototype.onError = function() {
        this.emit('error', { content: this });
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * The sprite sheet loader is used to load in JSON sprite sheet data
     * To generate the data you can use http://www.codeandweb.com/texturepacker and publish in the 'JSON' format
     * There is a free version so thats nice, although the paid version is great value for money.
     * It is highly recommended to use Sprite sheets (also know as a 'texture atlas') as it means sprites can be batched and drawn together for highly increased rendering speed.
     * Once the data has been loaded the frames are stored in the PIXI texture cache and can be accessed though PIXI.Texture.fromFrameId() and PIXI.Sprite.fromFrameId()
     * This loader will load the image file that the Spritesheet points to as well as the data.
     * When loaded this class will dispatch a 'loaded' event
     *
     * @class SpriteSheetLoader
     * @uses EventTarget
     * @constructor
     * @param url {String} The url of the sprite sheet JSON file
     * @param crossorigin {Boolean} Whether requests should be treated as crossorigin
     */
    PIXI.SpriteSheetLoader = function(url, crossorigin) {

        /**
         * The url of the atlas data
         *
         * @property url
         * @type String
         */
        this.url = url;

        /**
         * Whether the requests should be treated as cross origin
         *
         * @property crossorigin
         * @type Boolean
         */
        this.crossorigin = crossorigin;

        /**
         * [read-only] The base url of the bitmap font data
         *
         * @property baseUrl
         * @type String
         * @readOnly
         */
        this.baseUrl = url.replace(/[^\/]*$/, '');

        /**
         * The texture being loaded
         *
         * @property texture
         * @type Texture
         */
        this.texture = null;

        /**
         * The frames of the sprite sheet
         *
         * @property frames
         * @type Object
         */
        this.frames = {};
    };

    // constructor
    PIXI.SpriteSheetLoader.prototype.constructor = PIXI.SpriteSheetLoader;

    PIXI.EventTarget.mixin(PIXI.SpriteSheetLoader.prototype);

    /**
     * This will begin loading the JSON file
     *
     * @method load
     */
    PIXI.SpriteSheetLoader.prototype.load = function() {
        var scope = this;
        var jsonLoader = new PIXI.JsonLoader(this.url, this.crossorigin);
        jsonLoader.on('loaded', function(event) {
            scope.json = event.data.content.json;
            scope.onLoaded();
        });
        jsonLoader.load();
    };

    /**
     * Invoke when all files are loaded (json and texture)
     *
     * @method onLoaded
     * @private
     */
    PIXI.SpriteSheetLoader.prototype.onLoaded = function() {
        this.emit('loaded', {
            content: this
        });
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * The image loader class is responsible for loading images file formats ('jpeg', 'jpg', 'png' and 'gif')
     * Once the image has been loaded it is stored in the PIXI texture cache and can be accessed though PIXI.Texture.fromFrame() and PIXI.Sprite.fromFrame()
     * When loaded this class will dispatch a 'loaded' event
     *
     * @class ImageLoader
     * @uses EventTarget
     * @constructor
     * @param url {String} The url of the image
     * @param crossorigin {Boolean} Whether requests should be treated as crossorigin
     */
    PIXI.ImageLoader = function(url, crossorigin) {
        /**
         * The texture being loaded
         *
         * @property texture
         * @type Texture
         */
        this.texture = PIXI.Texture.fromImage(url, crossorigin);

        /**
         * if the image is loaded with loadFramedSpriteSheet
         * frames will contain the sprite sheet frames
         *
         * @property frames
         * @type Array
         * @readOnly
         */
        this.frames = [];
    };

    // constructor
    PIXI.ImageLoader.prototype.constructor = PIXI.ImageLoader;

    PIXI.EventTarget.mixin(PIXI.ImageLoader.prototype);

    /**
     * Loads image or takes it from cache
     *
     * @method load
     */
    PIXI.ImageLoader.prototype.load = function() {
        if (!this.texture.baseTexture.hasLoaded) {
            this.texture.baseTexture.on('loaded', this.onLoaded.bind(this));
        } else {
            this.onLoaded();
        }
    };

    /**
     * Invoked when image file is loaded or it is already cached and ready to use
     *
     * @method onLoaded
     * @private
     */
    PIXI.ImageLoader.prototype.onLoaded = function() {
        this.emit('loaded', { content: this });
    };

    /**
     * Loads image and split it to uniform sized frames
     *
     * @method loadFramedSpriteSheet
     * @param frameWidth {Number} width of each frame
     * @param frameHeight {Number} height of each frame
     * @param textureName {String} if given, the frames will be cached in <textureName>-<ord> format
     */
    PIXI.ImageLoader.prototype.loadFramedSpriteSheet = function(frameWidth, frameHeight, textureName) {
        this.frames = [];
        var cols = Math.floor(this.texture.width / frameWidth);
        var rows = Math.floor(this.texture.height / frameHeight);

        var i = 0;
        for (var y = 0; y < rows; y++) {
            for (var x = 0; x < cols; x++, i++) {
                var texture = new PIXI.Texture(this.texture.baseTexture, {
                    x: x * frameWidth,
                    y: y * frameHeight,
                    width: frameWidth,
                    height: frameHeight
                });

                this.frames.push(texture);
                if (textureName) PIXI.TextureCache[textureName + '-' + i] = texture;
            }
        }

        this.load();
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * The xml loader is used to load in XML bitmap font data ('xml' or 'fnt')
     * To generate the data you can use http://www.angelcode.com/products/bmfont/
     * This loader will also load the image file as the data.
     * When loaded this class will dispatch a 'loaded' event
     *
     * @class BitmapFontLoader
     * @uses EventTarget
     * @constructor
     * @param url {String} The url of the sprite sheet JSON file
     * @param crossorigin {Boolean} Whether requests should be treated as crossorigin
     */
    PIXI.BitmapFontLoader = function(url, crossorigin) {
        /**
         * The url of the bitmap font data
         *
         * @property url
         * @type String
         */
        this.url = url;

        /**
         * Whether the requests should be treated as cross origin
         *
         * @property crossorigin
         * @type Boolean
         */
        this.crossorigin = crossorigin;

        /**
         * [read-only] The base url of the bitmap font data
         *
         * @property baseUrl
         * @type String
         * @readOnly
         */
        this.baseUrl = url.replace(/[^\/]*$/, '');

        /**
         * [read-only] The texture of the bitmap font
         *
         * @property texture
         * @type Texture
         */
        this.texture = null;
    };

    // constructor
    PIXI.BitmapFontLoader.prototype.constructor = PIXI.BitmapFontLoader;
    PIXI.EventTarget.mixin(PIXI.BitmapFontLoader.prototype);

    /**
     * Loads the XML font data
     *
     * @method load
     */
    PIXI.BitmapFontLoader.prototype.load = function() {
        this.ajaxRequest = new PIXI.AjaxRequest();
        this.ajaxRequest.onreadystatechange = this.onXMLLoaded.bind(this);

        this.ajaxRequest.open('GET', this.url, true);
        if (this.ajaxRequest.overrideMimeType) this.ajaxRequest.overrideMimeType('application/xml');
        this.ajaxRequest.send(null);
    };

    /**
     * Invoked when the XML file is loaded, parses the data.
     *
     * @method onXMLLoaded
     * @private
     */
    PIXI.BitmapFontLoader.prototype.onXMLLoaded = function() {
        if (this.ajaxRequest.readyState === 4) {
            if (this.ajaxRequest.status === 200 || window.location.protocol.indexOf('http') === -1) {
                var responseXML = this.ajaxRequest.responseXML;
                if (!responseXML || /MSIE 9/i.test(navigator.userAgent) || navigator.isCocoonJS) {
                    if (typeof(window.DOMParser) === 'function') {
                        var domparser = new DOMParser();
                        responseXML = domparser.parseFromString(this.ajaxRequest.responseText, 'text/xml');
                    } else {
                        var div = document.createElement('div');
                        div.innerHTML = this.ajaxRequest.responseText;
                        responseXML = div;
                    }
                }

                var textureUrl = this.baseUrl + responseXML.getElementsByTagName('page')[0].getAttribute('file');
                var image = new PIXI.ImageLoader(textureUrl, this.crossorigin);
                this.texture = image.texture.baseTexture;

                var data = {};
                var info = responseXML.getElementsByTagName('info')[0];
                var common = responseXML.getElementsByTagName('common')[0];
                data.font = info.getAttribute('face');
                data.size = parseInt(info.getAttribute('size'), 10);
                data.lineHeight = parseInt(common.getAttribute('lineHeight'), 10);
                data.chars = {};

                //parse letters
                var letters = responseXML.getElementsByTagName('char');

                for (var i = 0; i < letters.length; i++) {
                    var charCode = parseInt(letters[i].getAttribute('id'), 10);

                    var textureRect = new PIXI.Rectangle(
                        parseInt(letters[i].getAttribute('x'), 10),
                        parseInt(letters[i].getAttribute('y'), 10),
                        parseInt(letters[i].getAttribute('width'), 10),
                        parseInt(letters[i].getAttribute('height'), 10)
                    );

                    data.chars[charCode] = {
                        xOffset: parseInt(letters[i].getAttribute('xoffset'), 10),
                        yOffset: parseInt(letters[i].getAttribute('yoffset'), 10),
                        xAdvance: parseInt(letters[i].getAttribute('xadvance'), 10),
                        kerning: {},
                        texture: PIXI.TextureCache[charCode] = new PIXI.Texture(this.texture, textureRect)

                    };
                }

                //parse kernings
                var kernings = responseXML.getElementsByTagName('kerning');
                for (i = 0; i < kernings.length; i++) {
                    var first = parseInt(kernings[i].getAttribute('first'), 10);
                    var second = parseInt(kernings[i].getAttribute('second'), 10);
                    var amount = parseInt(kernings[i].getAttribute('amount'), 10);

                    data.chars[second].kerning[first] = amount;

                }

                PIXI.BitmapText.fonts[data.font] = data;

                image.addEventListener('loaded', this.onLoaded.bind(this));
                image.load();
            }
        }
    };

    /**
     * Invoked when all files are loaded (xml/fnt and texture)
     *
     * @method onLoaded
     * @private
     */
    PIXI.BitmapFontLoader.prototype.onLoaded = function() {
        this.emit('loaded', { content: this });
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     * based on pixi impact spine implementation made by Eemeli Kelokorpi (@ekelokorpi) https://github.com/ekelokorpi
     *
     * Awesome JS run time provided by EsotericSoftware
     * https://github.com/EsotericSoftware/spine-runtimes
     *
     */

    /**
     * The Spine loader is used to load in JSON spine data
     * To generate the data you need to use http://esotericsoftware.com/ and export in the "JSON" format
     * Due to a clash of names  You will need to change the extension of the spine file from *.json to *.anim for it to load
     * See example 12 (http://www.goodboydigital.com/pixijs/examples/12/) to see a working example and check out the source
     * You will need to generate a sprite sheet to accompany the spine data
     * When loaded this class will dispatch a "loaded" event
     *
     * @class SpineLoader
     * @uses EventTarget
     * @constructor
     * @param url {String} The url of the JSON file
     * @param crossorigin {Boolean} Whether requests should be treated as crossorigin
     */
    PIXI.SpineLoader = function(url, crossorigin) {
        /**
         * The url of the bitmap font data
         *
         * @property url
         * @type String
         */
        this.url = url;

        /**
         * Whether the requests should be treated as cross origin
         *
         * @property crossorigin
         * @type Boolean
         */
        this.crossorigin = crossorigin;

        /**
         * [read-only] Whether the data has loaded yet
         *
         * @property loaded
         * @type Boolean
         * @readOnly
         */
        this.loaded = false;
    };

    PIXI.SpineLoader.prototype.constructor = PIXI.SpineLoader;

    PIXI.EventTarget.mixin(PIXI.SpineLoader.prototype);

    /**
     * Loads the JSON data
     *
     * @method load
     */
    PIXI.SpineLoader.prototype.load = function() {

        var scope = this;
        var jsonLoader = new PIXI.JsonLoader(this.url, this.crossorigin);
        jsonLoader.on('loaded', function(event) {
            scope.json = event.data.content.json;
            scope.onLoaded();
        });
        jsonLoader.load();
    };

    /**
     * Invoked when JSON file is loaded.
     *
     * @method onLoaded
     * @private
     */
    PIXI.SpineLoader.prototype.onLoaded = function() {
        this.loaded = true;
        this.emit('loaded', { content: this });
    };

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * This is the base class for creating a PIXI filter. Currently only webGL supports filters.
     * If you want to make a custom filter this should be your base class.
     * @class AbstractFilter
     * @constructor
     * @param fragmentSrc {Array} The fragment source in an array of strings.
     * @param uniforms {Object} An object containing the uniforms for this filter.
     */
    PIXI.AbstractFilter = function(fragmentSrc, uniforms) {
        /**
         * An array of passes - some filters contain a few steps this array simply stores the steps in a liniear fashion.
         * For example the blur filter has two passes blurX and blurY.
         * @property passes
         * @type Array an array of filter objects
         * @private
         */
        this.passes = [this];

        /**
         * @property shaders
         * @type Array an array of shaders
         * @private
         */
        this.shaders = [];

        /**
         * @property dirty
         * @type Boolean
         */
        this.dirty = true;

        /**
         * @property padding
         * @type Number
         */
        this.padding = 0;

        /**
         * @property uniforms
         * @type object
         * @private
         */
        this.uniforms = uniforms || {};

        /**
         * @property fragmentSrc
         * @type Array
         * @private
         */
        this.fragmentSrc = fragmentSrc || [];
    };

    PIXI.AbstractFilter.prototype.constructor = PIXI.AbstractFilter;

    /**
     * Syncs the uniforms between the class object and the shaders.
     *
     * @method syncUniforms
     */
    PIXI.AbstractFilter.prototype.syncUniforms = function() {
        for (var i = 0, j = this.shaders.length; i < j; i++) {
            this.shaders[i].dirty = true;
        }
    };

    /*
    PIXI.AbstractFilter.prototype.apply = function(frameBuffer)
    {
        // TODO :)
    };
    */
    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * The AlphaMaskFilter class uses the pixel values from the specified texture (called the displacement map) to perform a displacement of an object.
     * You can use this filter to apply all manor of crazy warping effects
     * Currently the r property of the texture is used to offset the x and the g property of the texture is used to offset the y.
     * 
     * @class AlphaMaskFilter
     * @extends AbstractFilter
     * @constructor
     * @param texture {Texture} The texture used for the displacement map * must be power of 2 texture at the moment
     */
    PIXI.AlphaMaskFilter = function(texture) {
        PIXI.AbstractFilter.call(this);

        this.passes = [this];
        texture.baseTexture._powerOf2 = true;

        // set the uniforms
        this.uniforms = {
            mask: { type: 'sampler2D', value: texture },
            mapDimensions: { type: '2f', value: { x: 1, y: 5112 } },
            dimensions: { type: '4fv', value: [0, 0, 0, 0] }
        };

        if (texture.baseTexture.hasLoaded) {
            this.uniforms.mask.value.x = texture.width;
            this.uniforms.mask.value.y = texture.height;
        } else {
            this.boundLoadedFunction = this.onTextureLoaded.bind(this);

            texture.baseTexture.on('loaded', this.boundLoadedFunction);
        }

        this.fragmentSrc = [
            'precision mediump float;',
            'varying vec2 vTextureCoord;',
            'varying vec4 vColor;',
            'uniform sampler2D mask;',
            'uniform sampler2D uSampler;',
            'uniform vec2 offset;',
            'uniform vec4 dimensions;',
            'uniform vec2 mapDimensions;',

            'void main(void) {',
            '   vec2 mapCords = vTextureCoord.xy;',
            '   mapCords += (dimensions.zw + offset)/ dimensions.xy ;',
            '   mapCords.y *= -1.0;',
            '   mapCords.y += 1.0;',
            '   mapCords *= dimensions.xy / mapDimensions;',

            '   vec4 original =  texture2D(uSampler, vTextureCoord);',
            '   float maskAlpha =  texture2D(mask, mapCords).r;',
            '   original *= maskAlpha;',
            //'   original.rgb *= maskAlpha;',
            '   gl_FragColor =  original;',
            //'   gl_FragColor = gl_FragColor;',
            '}'
        ];
    };

    PIXI.AlphaMaskFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
    PIXI.AlphaMaskFilter.prototype.constructor = PIXI.AlphaMaskFilter;

    /**
     * Sets the map dimensions uniforms when the texture becomes available.
     *
     * @method onTextureLoaded
     */
    PIXI.AlphaMaskFilter.prototype.onTextureLoaded = function() {
        this.uniforms.mapDimensions.value.x = this.uniforms.mask.value.width;
        this.uniforms.mapDimensions.value.y = this.uniforms.mask.value.height;

        this.uniforms.mask.value.baseTexture.off('loaded', this.boundLoadedFunction);
    };

    /**
     * The texture used for the displacement map. Must be power of 2 sized texture.
     *
     * @property map
     * @type Texture
     */
    Object.defineProperty(PIXI.AlphaMaskFilter.prototype, 'map', {
        get: function() {
            return this.uniforms.mask.value;
        },
        set: function(value) {
            this.uniforms.mask.value = value;
        }
    });

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * The ColorMatrixFilter class lets you apply a 4x4 matrix transformation on the RGBA
     * color and alpha values of every pixel on your displayObject to produce a result
     * with a new set of RGBA color and alpha values. It's pretty powerful!
     * 
     * @class ColorMatrixFilter
     * @extends AbstractFilter
     * @constructor
     */
    PIXI.ColorMatrixFilter = function() {
        PIXI.AbstractFilter.call(this);

        this.passes = [this];

        // set the uniforms
        this.uniforms = {
            matrix: {
                type: 'mat4',
                value: [1, 0, 0, 0,
                    0, 1, 0, 0,
                    0, 0, 1, 0,
                    0, 0, 0, 1
                ]
            }
        };

        this.fragmentSrc = [
            'precision mediump float;',
            'varying vec2 vTextureCoord;',
            'varying vec4 vColor;',
            'uniform float invert;',
            'uniform mat4 matrix;',
            'uniform sampler2D uSampler;',

            'void main(void) {',
            '   gl_FragColor = texture2D(uSampler, vTextureCoord) * matrix;',
            //  '   gl_FragColor = gl_FragColor;',
            '}'
        ];
    };

    PIXI.ColorMatrixFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
    PIXI.ColorMatrixFilter.prototype.constructor = PIXI.ColorMatrixFilter;

    /**
     * Sets the matrix of the color matrix filter
     *
     * @property matrix
     * @type Array and array of 26 numbers
     * @default [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
     */
    Object.defineProperty(PIXI.ColorMatrixFilter.prototype, 'matrix', {
        get: function() {
            return this.uniforms.matrix.value;
        },
        set: function(value) {
            this.uniforms.matrix.value = value;
        }
    });
    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * This greyscales the palette of your Display Objects.
     * 
     * @class GrayFilter
     * @extends AbstractFilter
     * @constructor
     */
    PIXI.GrayFilter = function() {
        PIXI.AbstractFilter.call(this);

        this.passes = [this];

        // set the uniforms
        this.uniforms = {
            gray: { type: '1f', value: 1 }
        };

        this.fragmentSrc = [
            'precision mediump float;',
            'varying vec2 vTextureCoord;',
            'varying vec4 vColor;',
            'uniform sampler2D uSampler;',
            'uniform float gray;',

            'void main(void) {',
            '   gl_FragColor = texture2D(uSampler, vTextureCoord);',
            '   gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.2126*gl_FragColor.r + 0.7152*gl_FragColor.g + 0.0722*gl_FragColor.b), gray);',
            //   '   gl_FragColor = gl_FragColor;',
            '}'
        ];
    };

    PIXI.GrayFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
    PIXI.GrayFilter.prototype.constructor = PIXI.GrayFilter;

    /**
     * The strength of the gray. 1 will make the object black and white, 0 will make the object its normal color.
     * @property gray
     * @type Number
     */
    Object.defineProperty(PIXI.GrayFilter.prototype, 'gray', {
        get: function() {
            return this.uniforms.gray.value;
        },
        set: function(value) {
            this.uniforms.gray.value = value;
        }
    });

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * The DisplacementFilter class uses the pixel values from the specified texture (called the displacement map) to perform a displacement of an object.
     * You can use this filter to apply all manor of crazy warping effects
     * Currently the r property of the texture is used offset the x and the g property of the texture is used to offset the y.
     * 
     * @class DisplacementFilter
     * @extends AbstractFilter
     * @constructor
     * @param texture {Texture} The texture used for the displacement map * must be power of 2 texture at the moment
     */
    PIXI.DisplacementFilter = function(texture) {
        PIXI.AbstractFilter.call(this);

        this.passes = [this];
        texture.baseTexture._powerOf2 = true;

        // set the uniforms
        this.uniforms = {
            displacementMap: { type: 'sampler2D', value: texture },
            scale: { type: '2f', value: { x: 30, y: 30 } },
            offset: { type: '2f', value: { x: 0, y: 0 } },
            mapDimensions: { type: '2f', value: { x: 1, y: 5112 } },
            dimensions: { type: '4fv', value: [0, 0, 0, 0] }
        };

        if (texture.baseTexture.hasLoaded) {
            this.uniforms.mapDimensions.value.x = texture.width;
            this.uniforms.mapDimensions.value.y = texture.height;
        } else {
            this.boundLoadedFunction = this.onTextureLoaded.bind(this);

            texture.baseTexture.on('loaded', this.boundLoadedFunction);
        }

        this.fragmentSrc = [
            'precision mediump float;',
            'varying vec2 vTextureCoord;',
            'varying vec4 vColor;',
            'uniform sampler2D displacementMap;',
            'uniform sampler2D uSampler;',
            'uniform vec2 scale;',
            'uniform vec2 offset;',
            'uniform vec4 dimensions;',
            'uniform vec2 mapDimensions;', // = vec2(256.0, 256.0);',
            // 'const vec2 textureDimensions = vec2(750.0, 750.0);',

            'void main(void) {',
            '   vec2 mapCords = vTextureCoord.xy;',
            //'   mapCords -= ;',
            '   mapCords += (dimensions.zw + offset)/ dimensions.xy ;',
            '   mapCords.y *= -1.0;',
            '   mapCords.y += 1.0;',
            '   vec2 matSample = texture2D(displacementMap, mapCords).xy;',
            '   matSample -= 0.5;',
            '   matSample *= scale;',
            '   matSample /= mapDimensions;',
            '   gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.x + matSample.x, vTextureCoord.y + matSample.y));',
            '   gl_FragColor.rgb = mix( gl_FragColor.rgb, gl_FragColor.rgb, 1.0);',
            '   vec2 cord = vTextureCoord;',

            //'   gl_FragColor =  texture2D(displacementMap, cord);',
            //   '   gl_FragColor = gl_FragColor;',
            '}'
        ];
    };

    PIXI.DisplacementFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
    PIXI.DisplacementFilter.prototype.constructor = PIXI.DisplacementFilter;

    /**
     * Sets the map dimensions uniforms when the texture becomes available.
     *
     * @method onTextureLoaded
     */
    PIXI.DisplacementFilter.prototype.onTextureLoaded = function() {
        this.uniforms.mapDimensions.value.x = this.uniforms.displacementMap.value.width;
        this.uniforms.mapDimensions.value.y = this.uniforms.displacementMap.value.height;

        this.uniforms.displacementMap.value.baseTexture.off('loaded', this.boundLoadedFunction);
    };

    /**
     * The texture used for the displacement map. Must be power of 2 texture.
     *
     * @property map
     * @type Texture
     */
    Object.defineProperty(PIXI.DisplacementFilter.prototype, 'map', {
        get: function() {
            return this.uniforms.displacementMap.value;
        },
        set: function(value) {
            this.uniforms.displacementMap.value = value;
        }
    });

    /**
     * The multiplier used to scale the displacement result from the map calculation.
     *
     * @property scale
     * @type Point
     */
    Object.defineProperty(PIXI.DisplacementFilter.prototype, 'scale', {
        get: function() {
            return this.uniforms.scale.value;
        },
        set: function(value) {
            this.uniforms.scale.value = value;
        }
    });

    /**
     * The offset used to move the displacement map.
     *
     * @property offset
     * @type Point
     */
    Object.defineProperty(PIXI.DisplacementFilter.prototype, 'offset', {
        get: function() {
            return this.uniforms.offset.value;
        },
        set: function(value) {
            this.uniforms.offset.value = value;
        }
    });

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * This filter applies a pixelate effect making display objects appear 'blocky'.
     * 
     * @class PixelateFilter
     * @extends AbstractFilter
     * @constructor
     */
    PIXI.PixelateFilter = function() {
        PIXI.AbstractFilter.call(this);

        this.passes = [this];

        // set the uniforms
        this.uniforms = {
            invert: { type: '1f', value: 0 },
            dimensions: { type: '4fv', value: new Float32Array([10000, 100, 10, 10]) },
            pixelSize: { type: '2f', value: { x: 10, y: 10 } }
        };

        this.fragmentSrc = [
            'precision mediump float;',
            'varying vec2 vTextureCoord;',
            'varying vec4 vColor;',
            'uniform vec2 testDim;',
            'uniform vec4 dimensions;',
            'uniform vec2 pixelSize;',
            'uniform sampler2D uSampler;',

            'void main(void) {',
            '   vec2 coord = vTextureCoord;',

            '   vec2 size = dimensions.xy/pixelSize;',

            '   vec2 color = floor( ( vTextureCoord * size ) ) / size + pixelSize/dimensions.xy * 0.5;',
            '   gl_FragColor = texture2D(uSampler, color);',
            '}'
        ];
    };

    PIXI.PixelateFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
    PIXI.PixelateFilter.prototype.constructor = PIXI.PixelateFilter;

    /**
     * This a point that describes the size of the blocks. x is the width of the block and y is the height.
     * 
     * @property size
     * @type Point
     */
    Object.defineProperty(PIXI.PixelateFilter.prototype, 'size', {
        get: function() {
            return this.uniforms.pixelSize.value;
        },
        set: function(value) {
            this.dirty = true;
            this.uniforms.pixelSize.value = value;
        }
    });

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * The BlurXFilter applies a horizontal Gaussian blur to an object.
     *
     * @class BlurXFilter
     * @extends AbstractFilter
     * @constructor
     */
    PIXI.BlurXFilter = function() {
        PIXI.AbstractFilter.call(this);

        this.passes = [this];

        // set the uniforms
        this.uniforms = {
            blur: { type: '1f', value: 1 / 512 }
        };

        this.fragmentSrc = [
            'precision mediump float;',
            'varying vec2 vTextureCoord;',
            'varying vec4 vColor;',
            'uniform float blur;',
            'uniform sampler2D uSampler;',

            'void main(void) {',
            '   vec4 sum = vec4(0.0);',

            '   sum += texture2D(uSampler, vec2(vTextureCoord.x - 4.0*blur, vTextureCoord.y)) * 0.05;',
            '   sum += texture2D(uSampler, vec2(vTextureCoord.x - 3.0*blur, vTextureCoord.y)) * 0.09;',
            '   sum += texture2D(uSampler, vec2(vTextureCoord.x - 2.0*blur, vTextureCoord.y)) * 0.12;',
            '   sum += texture2D(uSampler, vec2(vTextureCoord.x - blur, vTextureCoord.y)) * 0.15;',
            '   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y)) * 0.16;',
            '   sum += texture2D(uSampler, vec2(vTextureCoord.x + blur, vTextureCoord.y)) * 0.15;',
            '   sum += texture2D(uSampler, vec2(vTextureCoord.x + 2.0*blur, vTextureCoord.y)) * 0.12;',
            '   sum += texture2D(uSampler, vec2(vTextureCoord.x + 3.0*blur, vTextureCoord.y)) * 0.09;',
            '   sum += texture2D(uSampler, vec2(vTextureCoord.x + 4.0*blur, vTextureCoord.y)) * 0.05;',

            '   gl_FragColor = sum;',
            '}'
        ];
    };

    PIXI.BlurXFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
    PIXI.BlurXFilter.prototype.constructor = PIXI.BlurXFilter;

    /**
     * Sets the strength of both the blur.
     *
     * @property blur
     * @type Number the strength of the blur
     * @default 2
     */
    Object.defineProperty(PIXI.BlurXFilter.prototype, 'blur', {
        get: function() {
            return this.uniforms.blur.value / (1 / 7000);
        },
        set: function(value) {

            this.dirty = true;
            this.uniforms.blur.value = (1 / 7000) * value;
        }
    });

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * The BlurYFilter applies a vertical Gaussian blur to an object.
     *
     * @class BlurYFilter
     * @extends AbstractFilter
     * @constructor
     */
    PIXI.BlurYFilter = function() {
        PIXI.AbstractFilter.call(this);

        this.passes = [this];

        // set the uniforms
        this.uniforms = {
            blur: { type: '1f', value: 1 / 512 }
        };

        this.fragmentSrc = [
            'precision mediump float;',
            'varying vec2 vTextureCoord;',
            'varying vec4 vColor;',
            'uniform float blur;',
            'uniform sampler2D uSampler;',

            'void main(void) {',
            '   vec4 sum = vec4(0.0);',

            '   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y - 4.0*blur)) * 0.05;',
            '   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y - 3.0*blur)) * 0.09;',
            '   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y - 2.0*blur)) * 0.12;',
            '   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y - blur)) * 0.15;',
            '   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y)) * 0.16;',
            '   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y + blur)) * 0.15;',
            '   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y + 2.0*blur)) * 0.12;',
            '   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y + 3.0*blur)) * 0.09;',
            '   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y + 4.0*blur)) * 0.05;',

            '   gl_FragColor = sum;',
            '}'
        ];
    };

    PIXI.BlurYFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
    PIXI.BlurYFilter.prototype.constructor = PIXI.BlurYFilter;

    /**
     * Sets the strength of both the blur.
     *
     * @property blur
     * @type Number the strength of the blur
     * @default 2
     */
    Object.defineProperty(PIXI.BlurYFilter.prototype, 'blur', {
        get: function() {
            return this.uniforms.blur.value / (1 / 7000);
        },
        set: function(value) {
            //this.padding = value;
            this.uniforms.blur.value = (1 / 7000) * value;
        }
    });

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * The BlurFilter applies a Gaussian blur to an object.
     * The strength of the blur can be set for x- and y-axis separately (always relative to the stage).
     *
     * @class BlurFilter
     * @extends AbstractFilter
     * @constructor
     */
    PIXI.BlurFilter = function() {
        this.blurXFilter = new PIXI.BlurXFilter();
        this.blurYFilter = new PIXI.BlurYFilter();

        this.passes = [this.blurXFilter, this.blurYFilter];
    };

    PIXI.BlurFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
    PIXI.BlurFilter.prototype.constructor = PIXI.BlurFilter;

    /**
     * Sets the strength of both the blurX and blurY properties simultaneously
     *
     * @property blur
     * @type Number the strength of the blur
     * @default 2
     */
    Object.defineProperty(PIXI.BlurFilter.prototype, 'blur', {
        get: function() {
            return this.blurXFilter.blur;
        },
        set: function(value) {
            this.blurXFilter.blur = this.blurYFilter.blur = value;
        }
    });

    /**
     * Sets the strength of the blurX property
     *
     * @property blurX
     * @type Number the strength of the blurX
     * @default 2
     */
    Object.defineProperty(PIXI.BlurFilter.prototype, 'blurX', {
        get: function() {
            return this.blurXFilter.blur;
        },
        set: function(value) {
            this.blurXFilter.blur = value;
        }
    });

    /**
     * Sets the strength of the blurY property
     *
     * @property blurY
     * @type Number the strength of the blurY
     * @default 2
     */
    Object.defineProperty(PIXI.BlurFilter.prototype, 'blurY', {
        get: function() {
            return this.blurYFilter.blur;
        },
        set: function(value) {
            this.blurYFilter.blur = value;
        }
    });

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * This inverts your Display Objects colors.
     * 
     * @class InvertFilter
     * @extends AbstractFilter
     * @constructor
     */
    PIXI.InvertFilter = function() {
        PIXI.AbstractFilter.call(this);

        this.passes = [this];

        // set the uniforms
        this.uniforms = {
            invert: { type: '1f', value: 1 }
        };

        this.fragmentSrc = [
            'precision mediump float;',
            'varying vec2 vTextureCoord;',
            'varying vec4 vColor;',
            'uniform float invert;',
            'uniform sampler2D uSampler;',

            'void main(void) {',
            '   gl_FragColor = texture2D(uSampler, vTextureCoord);',
            '   gl_FragColor.rgb = mix( (vec3(1)-gl_FragColor.rgb) * gl_FragColor.a, gl_FragColor.rgb, 1.0 - invert);',
            //'   gl_FragColor.rgb = gl_FragColor.rgb  * gl_FragColor.a;',
            //  '   gl_FragColor = gl_FragColor * vColor;',
            '}'
        ];
    };

    PIXI.InvertFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
    PIXI.InvertFilter.prototype.constructor = PIXI.InvertFilter;

    /**
     * The strength of the invert. 1 will fully invert the colors, 0 will make the object its normal color
     * @property invert
     * @type Number
     */
    Object.defineProperty(PIXI.InvertFilter.prototype, 'invert', {
        get: function() {
            return this.uniforms.invert.value;
        },
        set: function(value) {
            this.uniforms.invert.value = value;
        }
    });

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * This applies a sepia effect to your Display Objects.
     * 
     * @class SepiaFilter
     * @extends AbstractFilter
     * @constructor
     */
    PIXI.SepiaFilter = function() {
        PIXI.AbstractFilter.call(this);

        this.passes = [this];

        // set the uniforms
        this.uniforms = {
            sepia: { type: '1f', value: 1 }
        };

        this.fragmentSrc = [
            'precision mediump float;',
            'varying vec2 vTextureCoord;',
            'varying vec4 vColor;',
            'uniform float sepia;',
            'uniform sampler2D uSampler;',

            'const mat3 sepiaMatrix = mat3(0.3588, 0.7044, 0.1368, 0.2990, 0.5870, 0.1140, 0.2392, 0.4696, 0.0912);',

            'void main(void) {',
            '   gl_FragColor = texture2D(uSampler, vTextureCoord);',
            '   gl_FragColor.rgb = mix( gl_FragColor.rgb, gl_FragColor.rgb * sepiaMatrix, sepia);',
            // '   gl_FragColor = gl_FragColor * vColor;',
            '}'
        ];
    };

    PIXI.SepiaFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
    PIXI.SepiaFilter.prototype.constructor = PIXI.SepiaFilter;

    /**
     * The strength of the sepia. 1 will apply the full sepia effect, 0 will make the object its normal color.
     * @property sepia
     * @type Number
     */
    Object.defineProperty(PIXI.SepiaFilter.prototype, 'sepia', {
        get: function() {
            return this.uniforms.sepia.value;
        },
        set: function(value) {
            this.uniforms.sepia.value = value;
        }
    });

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * This filter applies a twist effect making display objects appear twisted in the given direction.
     * 
     * @class TwistFilter
     * @extends AbstractFilter
     * @constructor
     */
    PIXI.TwistFilter = function() {
        PIXI.AbstractFilter.call(this);

        this.passes = [this];

        // set the uniforms
        this.uniforms = {
            radius: { type: '1f', value: 0.5 },
            angle: { type: '1f', value: 5 },
            offset: { type: '2f', value: { x: 0.5, y: 0.5 } }
        };

        this.fragmentSrc = [
            'precision mediump float;',
            'varying vec2 vTextureCoord;',
            'varying vec4 vColor;',
            'uniform vec4 dimensions;',
            'uniform sampler2D uSampler;',

            'uniform float radius;',
            'uniform float angle;',
            'uniform vec2 offset;',

            'void main(void) {',
            '   vec2 coord = vTextureCoord - offset;',
            '   float distance = length(coord);',

            '   if (distance < radius) {',
            '       float ratio = (radius - distance) / radius;',
            '       float angleMod = ratio * ratio * angle;',
            '       float s = sin(angleMod);',
            '       float c = cos(angleMod);',
            '       coord = vec2(coord.x * c - coord.y * s, coord.x * s + coord.y * c);',
            '   }',

            '   gl_FragColor = texture2D(uSampler, coord+offset);',
            '}'
        ];
    };

    PIXI.TwistFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
    PIXI.TwistFilter.prototype.constructor = PIXI.TwistFilter;

    /**
     * This point describes the the offset of the twist.
     * 
     * @property offset
     * @type Point
     */
    Object.defineProperty(PIXI.TwistFilter.prototype, 'offset', {
        get: function() {
            return this.uniforms.offset.value;
        },
        set: function(value) {
            this.dirty = true;
            this.uniforms.offset.value = value;
        }
    });

    /**
     * This radius of the twist.
     * 
     * @property radius
     * @type Number
     */
    Object.defineProperty(PIXI.TwistFilter.prototype, 'radius', {
        get: function() {
            return this.uniforms.radius.value;
        },
        set: function(value) {
            this.dirty = true;
            this.uniforms.radius.value = value;
        }
    });

    /**
     * This angle of the twist.
     * 
     * @property angle
     * @type Number
     */
    Object.defineProperty(PIXI.TwistFilter.prototype, 'angle', {
        get: function() {
            return this.uniforms.angle.value;
        },
        set: function(value) {
            this.dirty = true;
            this.uniforms.angle.value = value;
        }
    });

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * This lowers the color depth of your image by the given amount, producing an image with a smaller palette.
     * 
     * @class ColorStepFilter
     * @extends AbstractFilter
     * @constructor
     */
    PIXI.ColorStepFilter = function() {
        PIXI.AbstractFilter.call(this);

        this.passes = [this];

        // set the uniforms
        this.uniforms = {
            step: { type: '1f', value: 5 }
        };

        this.fragmentSrc = [
            'precision mediump float;',
            'varying vec2 vTextureCoord;',
            'varying vec4 vColor;',
            'uniform sampler2D uSampler;',
            'uniform float step;',

            'void main(void) {',
            '   vec4 color = texture2D(uSampler, vTextureCoord);',
            '   color = floor(color * step) / step;',
            '   gl_FragColor = color;',
            '}'
        ];
    };

    PIXI.ColorStepFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
    PIXI.ColorStepFilter.prototype.constructor = PIXI.ColorStepFilter;

    /**
     * The number of steps to reduce the palette by.
     *
     * @property step
     * @type Number
     */
    Object.defineProperty(PIXI.ColorStepFilter.prototype, 'step', {
        get: function() {
            return this.uniforms.step.value;
        },
        set: function(value) {
            this.uniforms.step.value = value;
        }
    });

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     * original filter: https://github.com/evanw/glfx.js/blob/master/src/filters/fun/dotscreen.js
     */

    /**
     * This filter applies a dotscreen effect making display objects appear to be made out of black and white halftone dots like an old printer.
     * 
     * @class DotScreenFilter
     * @extends AbstractFilter
     * @constructor
     */
    PIXI.DotScreenFilter = function() {
        PIXI.AbstractFilter.call(this);

        this.passes = [this];

        // set the uniforms
        this.uniforms = {
            scale: { type: '1f', value: 1 },
            angle: { type: '1f', value: 5 },
            dimensions: { type: '4fv', value: [0, 0, 0, 0] }
        };

        this.fragmentSrc = [
            'precision mediump float;',
            'varying vec2 vTextureCoord;',
            'varying vec4 vColor;',
            'uniform vec4 dimensions;',
            'uniform sampler2D uSampler;',

            'uniform float angle;',
            'uniform float scale;',

            'float pattern() {',
            '   float s = sin(angle), c = cos(angle);',
            '   vec2 tex = vTextureCoord * dimensions.xy;',
            '   vec2 point = vec2(',
            '       c * tex.x - s * tex.y,',
            '       s * tex.x + c * tex.y',
            '   ) * scale;',
            '   return (sin(point.x) * sin(point.y)) * 4.0;',
            '}',

            'void main() {',
            '   vec4 color = texture2D(uSampler, vTextureCoord);',
            '   float average = (color.r + color.g + color.b) / 3.0;',
            '   gl_FragColor = vec4(vec3(average * 10.0 - 5.0 + pattern()), color.a);',
            '}'
        ];
    };

    PIXI.DotScreenFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
    PIXI.DotScreenFilter.prototype.constructor = PIXI.DotScreenFilter;

    /**
     * The scale of the effect.
     * @property scale
     * @type Number
     */
    Object.defineProperty(PIXI.DotScreenFilter.prototype, 'scale', {
        get: function() {
            return this.uniforms.scale.value;
        },
        set: function(value) {
            this.dirty = true;
            this.uniforms.scale.value = value;
        }
    });

    /**
     * The radius of the effect.
     * @property angle
     * @type Number
     */
    Object.defineProperty(PIXI.DotScreenFilter.prototype, 'angle', {
        get: function() {
            return this.uniforms.angle.value;
        },
        set: function(value) {
            this.dirty = true;
            this.uniforms.angle.value = value;
        }
    });

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * A Cross Hatch effect filter.
     * 
     * @class CrossHatchFilter
     * @extends AbstractFilter
     * @constructor
     */
    PIXI.CrossHatchFilter = function() {
        PIXI.AbstractFilter.call(this);

        this.passes = [this];

        // set the uniforms
        this.uniforms = {
            blur: { type: '1f', value: 1 / 512 }
        };

        this.fragmentSrc = [
            'precision mediump float;',
            'varying vec2 vTextureCoord;',
            'varying vec4 vColor;',
            'uniform float blur;',
            'uniform sampler2D uSampler;',

            'void main(void) {',
            '    float lum = length(texture2D(uSampler, vTextureCoord.xy).rgb);',

            '    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);',

            '    if (lum < 1.00) {',
            '        if (mod(gl_FragCoord.x + gl_FragCoord.y, 10.0) == 0.0) {',
            '            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);',
            '        }',
            '    }',

            '    if (lum < 0.75) {',
            '        if (mod(gl_FragCoord.x - gl_FragCoord.y, 10.0) == 0.0) {',
            '            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);',
            '        }',
            '    }',

            '    if (lum < 0.50) {',
            '        if (mod(gl_FragCoord.x + gl_FragCoord.y - 5.0, 10.0) == 0.0) {',
            '            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);',
            '        }',
            '    }',

            '    if (lum < 0.3) {',
            '        if (mod(gl_FragCoord.x - gl_FragCoord.y - 5.0, 10.0) == 0.0) {',
            '            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);',
            '        }',
            '    }',
            '}'
        ];
    };

    PIXI.CrossHatchFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
    PIXI.CrossHatchFilter.prototype.constructor = PIXI.CrossHatchFilter;

    /**
     * Sets the strength of both the blur.
     *
     * @property blur
     * @type Number the strength of the blur
     * @default 2
     */
    Object.defineProperty(PIXI.CrossHatchFilter.prototype, 'blur', {
        get: function() {
            return this.uniforms.blur.value / (1 / 7000);
        },
        set: function(value) {
            //this.padding = value;
            this.uniforms.blur.value = (1 / 7000) * value;
        }
    });

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    /**
     * An RGB Split Filter.
     * 
     * @class RGBSplitFilter
     * @extends AbstractFilter
     * @constructor
     */
    PIXI.RGBSplitFilter = function() {
        PIXI.AbstractFilter.call(this);

        this.passes = [this];

        // set the uniforms
        this.uniforms = {
            red: { type: '2f', value: { x: 20, y: 20 } },
            green: { type: '2f', value: { x: -20, y: 20 } },
            blue: { type: '2f', value: { x: 20, y: -20 } },
            dimensions: { type: '4fv', value: [0, 0, 0, 0] }
        };

        this.fragmentSrc = [
            'precision mediump float;',
            'varying vec2 vTextureCoord;',
            'varying vec4 vColor;',
            'uniform vec2 red;',
            'uniform vec2 green;',
            'uniform vec2 blue;',
            'uniform vec4 dimensions;',
            'uniform sampler2D uSampler;',

            'void main(void) {',
            '   gl_FragColor.r = texture2D(uSampler, vTextureCoord + red/dimensions.xy).r;',
            '   gl_FragColor.g = texture2D(uSampler, vTextureCoord + green/dimensions.xy).g;',
            '   gl_FragColor.b = texture2D(uSampler, vTextureCoord + blue/dimensions.xy).b;',
            '   gl_FragColor.a = texture2D(uSampler, vTextureCoord).a;',
            '}'
        ];
    };

    PIXI.RGBSplitFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
    PIXI.RGBSplitFilter.prototype.constructor = PIXI.RGBSplitFilter;

    /**
     * Red channel offset.
     * 
     * @property red
     * @type Point
     */
    Object.defineProperty(PIXI.RGBSplitFilter.prototype, 'red', {
        get: function() {
            return this.uniforms.red.value;
        },
        set: function(value) {
            this.uniforms.red.value = value;
        }
    });

    /**
     * Green channel offset.
     * 
     * @property green
     * @type Point
     */
    Object.defineProperty(PIXI.RGBSplitFilter.prototype, 'green', {
        get: function() {
            return this.uniforms.green.value;
        },
        set: function(value) {
            this.uniforms.green.value = value;
        }
    });

    /**
     * Blue offset.
     * 
     * @property blue
     * @type Point
     */
    Object.defineProperty(PIXI.RGBSplitFilter.prototype, 'blue', {
        get: function() {
            return this.uniforms.blue.value;
        },
        set: function(value) {
            this.uniforms.blue.value = value;
        }
    });

    /**
     * @author Mat Groves http://matgroves.com/ @Doormat23
     */

    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = PIXI;
        }
        exports.PIXI = PIXI;
    } else if (typeof define !== 'undefined' && define.amd) {
        define(PIXI);
    } else {
        root.PIXI = PIXI;
    }
}).call(this);
function convertToRadian(n) {
    return n * Math.PI / 180;
}

function radianToDegree(n) {
    return n * 180 / Math.PI;
}

/**
 * Tính khoảng cách giữa 2 điểm
 * @param {*} x1 
 * @param {*} x2 
 * @param {*} y1 
 * @param {*} y2 
 */
function distanceTwoPoints(x1, x2, y1, y2) {
    var dx = x1 - x2;
    var dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
}

/////////////////////////////
PIXI.Sprite.prototype.setLocation =
    PIXI.MovieClip.prototype.setLocation =
    PIXI.DisplayObjectContainer.prototype.setLocation = function(x, y) {
        this.position.x = x;
        this.position.y = y;
    }

PIXI.Sprite.prototype.addSprite =
    PIXI.MovieClip.prototype.addSprite =
    PIXI.DisplayObjectContainer.prototype.addSprite = function(id, url, startDrag) {


        var texture = new PIXI.Texture.fromImage(url);
        var target = new PIXI.Sprite(texture);

        addToQueue(url);

        this.addChild(target);
        this[id] = target;

        if (startDrag == true) target.startDrag(true);

        target.id = id;
        return target;

    }

PIXI.Sprite.prototype.setTexture =
    PIXI.MovieClip.prototype.setTexture =
    PIXI.DisplayObjectContainer.prototype.setTexture = function(id, texture, startDrag) {


        // var texture = new PIXI.Texture.fromImage(url);
        var target = new PIXI.Sprite(texture);

        // addToQueue(url);

        this.addChild(target);
        this[id] = target;

        if (startDrag == true) target.startDrag(true);

        target.id = id;
        return target;

    }

PIXI.Sprite.prototype.updateSprite =
    PIXI.MovieClip.prototype.updateSprite =
    PIXI.DisplayObjectContainer.prototype.updateSprite = function(id, url) {

        var texture = new PIXI.Texture.fromImage(url);
        this.sprite.setTexture(texture);
        // var target = new PIXI.Sprite(appleTexture);
        // this.addChild(target);
        // console.log('sprite', this);
        this.id = id;
        return this;
    }

PIXI.Sprite.prototype.updateTexture =
    PIXI.MovieClip.prototype.updateTexture =
    PIXI.DisplayObjectContainer.prototype.updateTexture = function(id, texture) {

        // var texture = new PIXI.Texture.fromImage(url);
        this.sprite.setTexture(texture);
        // var target = new PIXI.Sprite(appleTexture);
        // this.addChild(target);
        // console.log('sprite', this);
        this.id = id;
        return this;
    }

PIXI.Sprite.prototype.addContainer =
    PIXI.MovieClip.prototype.addContainer =
    PIXI.DisplayObjectContainer.prototype.addContainer = function(obj) {

        this[obj.id] = new PIXI.DisplayObjectContainer();
        var target = this[obj.id];
        this.addChild(target);

        target.id = obj.id;

        target.setProperties(obj);

        return target;
    }

PIXI.MovieClip.prototype.addObject =
    PIXI.Sprite.prototype.addObject =
    PIXI.DisplayObjectContainer.prototype.addObject = function(obj) {
        this[obj.id] = new PIXI.DisplayObjectContainer();
        var target = this[obj.id];

        target.id = obj.id;
        this.addChild(target)

        if (typeof obj.url != 'undefined') {
            target.sprite = target.addSprite('bitmap', obj.url);
        }

        if (typeof obj.texture != 'undefined') {
            target.sprite = target.setTexture('bitmap', obj.texture);
        }

        target.setProperties(obj);

        return target;
    }

PIXI.MovieClip.prototype.updateObject =
    PIXI.Sprite.prototype.updateObject =
    PIXI.DisplayObjectContainer.prototype.updateObject = function(obj) {

        var target = this[obj.id];

        // target.id = obj.id;
        // this.addChild(target)
        // console.log("this", this);
        if (obj.url != "") {
            target.updateSprite(obj.id, obj.url);
        }

        if (obj.texture) {
            target.sprite = target.updateTexture(obj.id, obj.texture);
        }

        target.setProperties(obj);

        return target;
    }

PIXI.MovieClip.prototype.setProperties =
    PIXI.Sprite.prototype.setProperties =
    PIXI.DisplayObjectContainer.prototype.setProperties = function(obj) {
        var target = this;


        if (obj.alpha != undefined) {
            target.alpha = obj.alpha;
        }

        if (obj.visible != undefined) {
            target.visible = obj.visible;
        }

        if (obj.x != undefined) {
            target.bitmap.position.x = obj.x;
        }

        if (obj.y != undefined) {
            target.bitmap.position.y = obj.y;
        }
        if (obj.scaleX != undefined) {
            target.bitmap.scale.x = obj.scaleX;
        }
        if (obj.scaleY != undefined) {
            target.bitmap.scale.y = obj.scaleY;
        }

        if (obj.locationX != undefined) {
            target.position.x = obj.locationX;
            target.initX = target.position.x;
        }

        if (obj.locationY != undefined) {
            target.position.y = obj.locationY;
            target.initY = target.position.y;
        }

        if (obj.startDrag == true) {
            target.startDrag(true);
        }

        if (obj.butotnMode != undefined) {
            target.buttonMode = obj.buttonMode;
        }

        if (obj.regPerX != undefined) {
            target.bitmap.anchor.x = obj.regPerX;
        }

        if (obj.regPerX != undefined) {
            target.bitmap.anchor.y = obj.regPerY;
        }

        if (obj.rotation != undefined) {
            target.rotation = obj.rotation;
            target.initRota = target.rotation
        }

        if (obj.name != undefined) {
            target.name = obj.name;
        }

        if (obj.width != undefined) {
            target.width = obj.width;
        }

        if (obj.height != undefined) {
            target.height = obj.height;
        }
    }

PIXI.Sprite.prototype.addCircle =
    PIXI.MovieClip.prototype.addCircle =
    PIXI.DisplayObjectContainer.prototype.addCircle = function(id, radius, color, dx, dy, alpha) {

        var target = new PIXI.Graphics();
        target.beginFill(color);
        target.drawCircle(0, 0, radius);
        target.endFill();

        this[id] = target;
        this.addChild(target);

        if (dx != undefined) {
            target.position.x = dx;
        }

        if (dy != undefined) {
            target.position.y = dy;
        }

        if (alpha != undefined) {
            target.alpha = alpha;
        }

        return target;
    }

PIXI.Sprite.prototype.addRect =
    PIXI.MovieClip.prototype.addRect =
    PIXI.DisplayObjectContainer.prototype.addRect = function(id, w, h, color, dx, dy, alpha) {

        var target = new PIXI.Graphics();
        target.beginFill(color);
        target.drawRect(0, 0, w, h);
        target.endFill();

        this[id] = target;
        this.addChild(target);

        if (dx != undefined) {
            target.position.x = dx;
        }

        if (dy != undefined) {
            target.position.y = dy;
        }

        if (alpha != undefined) {
            target.alpha = alpha;
        }

        return target;

    }

PIXI.Sprite.prototype.addText =
    PIXI.MovieClip.prototype.addText =
    PIXI.DisplayObjectContainer.prototype.addText = function(obj) {


        if (obj.strkeColor == undefined) {
            obj.strokeColor = 0;
        }
        if (obj.strokeThickness == undefined) {
            obj.strokeThickness = 0;
        }
        if (obj.align == undefined) {
            obj.align = 'left';
        }
        if (obj.color == undefined) {
            obj.color = '#000';
        }

        var target = new PIXI.Text(obj.text, { font: obj.font, fill: obj.color, align: obj.align, stroke: obj.strokeColor, strokeThickness: obj.strokeThickness });


        target.setProperties(obj);

        this[obj.id] = target;
        this.addChild(target)

        return target;

    }


PIXI.Sprite.prototype.setIndex =
    PIXI.MovieClip.prototype.setIndex =
    PIXI.DisplayObjectContainer.prototype.setIndex = function(index) {
        var parent = this.parent;
        parent.setChildIndex(this, parent.children.length - 1 - index);
    }

PIXI.Sprite.prototype.startDrag =
    PIXI.MovieClip.prototype.startDrag =
    PIXI.DisplayObjectContainer.prototype.startDrag = function(test) {
        var target = this;

        if (test) {
            target.addCircle("centerPoint", 2, "#ff0", -1, -1);
        }

        target.interactive = true;
        target.buttonMode = true;


        target.mousedown = target.touchstart = function(data) {

            trace("touch start");

            data.originalEvent.preventDefault();
            target.data = data;
            if (test) {
                target.alpha = 0.5;
            }

            var mousePos = this.data.getLocalPosition(this.parent);
            target.anchorX = mousePos.x;
            target.anchorY = mousePos.y;

            target.startX = target.position.x;
            target.startY = target.position.y;

            target.dragging = true;


            target.mousemove = target.touchmove = function(data) {

                trace("touch move");

                if (target.dragging) {

                    var mousePos = this.data.getLocalPosition(this.parent);
                    var dx = target.startX + (mousePos.x - target.anchorX);
                    var dy = target.startY + (mousePos.y - target.anchorY);

                    target.position.x = dx;
                    target.position.y = dy;
                }
            }

            target.mouseup = target.mouseupoutside = target.touchend = target.touchendoutside = function(data) {

                trace("touch end outside");

                if (test) {
                    target.alpha = 1;
                }
                target.dragging = false;
                target.data = null;
                target.mousemove = target.touchmove = null;
                target.mouseup = target.mouseupoutside = target.touchend = target.touchendoutside = null;
                trace(target.id + ': locationX:' + Math.round(target.position.x) + " ,locationY:" + Math.round(target.position.y))
            };


        }; //end mousedown	

    }


PIXI.Sprite.prototype.stopDrag =
    PIXI.MovieClip.prototype.stopDrag =
    PIXI.DisplayObjectContainer.prototype.stopDrag = function() {
        var target = this;

        target.interactive = false;
        target.buttonMode = false;
        target.mousedown = target.touchstart = null;
        target.mousemove = target.touchmove = null;
        target.mouseup = target.mouseupoutside = target.touchend = target.touchendoutside = null;
    }
var TEXTURES = {
	'images/apple.png': 'images/apple.png',
	'images/apple_broken.png': 'images/apple_broken.png',
	'images/bg.png': 'images/bg.png',
	'images/big_bottle.png': 'images/big_bottle.png',
	'images/bottle.png': 'images/bottle.png',
	'images/bottle_double.png': 'images/bottle_double.png',
	'images/bottle_grey.png': 'images/bottle_grey.png',
	'images/bubble.png': 'images/bubble.png',
	'images/bubble_group.png': 'images/bubble_group.png',
	'images/codeBG.png': 'images/codeBG.png',
	'images/congratulation.png': 'images/congratulation.png',
	'images/connectWifiBtn.png': 'images/connectWifiBtn.png',
	'images/copy1.png': 'images/copy1.png',
	'images/countDown.png': 'images/countDown.png',
	'images/f1.png': 'images/f1.png',
	'images/f2.png': 'images/f2.png',
	'images/f3.png': 'images/f3.png',
	'images/goNowBtn.png': 'images/goNowBtn.png',
	'images/intro_copy.png': 'images/intro_copy.png',
	'images/lastScence.png': 'images/lastScence.png',
	'images/lastScence_bg.png': 'images/lastScence_bg.png',
	'images/lemon.png': 'images/lemon.png',
	'images/lemon_broken.png': 'images/lemon_broken.png',
	'images/logo.png': 'images/logo.png',
	'images/mangcau.png': 'images/mangcau.png',
	'images/mangcau_broken.png': 'images/mangcau_broken.png',
	'images/numOfFrut.png': 'images/numOfFrut.png',
	'images/progress_bar.png': 'images/progress_bar.png',
	'images/progress_bg.png': 'images/progress_bg.png',
	'images/sakura.png': 'images/sakura.png',
	'images/tini_bubble.png': 'images/tini_bubble.png',
	'images/tocotococup.png': 'images/tocotococup.png',
	'images/win.png': 'images/win.png',
}
//trace
window.trace = console.log
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

        }
    };
})();
/**
 * Màn hình chơi game
 */
var Scene1JS = (function() {

    /**
     * Thay đổi hình ảnh của các phần tử trái cây
     * @param {*} fruits 
     * @param {*} breaks 
     * @param {*} material_input 
     */
    function changeCircleSprite(fruits) {
        // Thay đổi texture cho các phần tử trái cây trong vòng tròn
        for (var i = 0; i < fruits.itemArr.length; i++) {
            var material_input = getMaterialInput();
            var target = fruits.updateObject({ id: "item" + i, url: material_input.url, name: material_input.id });
            backFn(target);
        }
    }

    /**
     * Tự động sinh ra mảng các vòng tròn
     * @param {*} frutHolder 
     * @param {*} itemArr 
     * @param {*} breakArr 
     */
    function generateCircleMaterial(frutHolder, itemArr, breakArr) {
        GAME.max_appear_circle = CONFIG.appear_circle + (CONFIG.total_seconds / CONFIG.circle_scale_seconds * CONFIG.appear_circle); // Tính số lượng vòng sẽ xuất hiện
        GAME.max_appear_items = GAME.max_appear_circle * CONFIG.total_item_on_circle; // Tính số lượng item sẽ xuất hiện trong toàn game

        // Chuyển các nguyên liệu đầu vào thành 1 mảng
        var inputs = [];
        for (var i in MATERIAL_INPUT) {
            inputs.push(MATERIAL_INPUT[i]);
            breakArr[MATERIAL_INPUT[i].id] = frutHolder.addObject({ id: MATERIAL_INPUT[i].broken_id, texture: TEXTURES[MATERIAL_INPUT[i].broken_url], visible: false });
        }

        // Ngẫu nhiên chọn 1 loại nguyên liệu để giới hạn số lượng
        var chooseRandomInput = Math.floor((Math.random() * inputs.length) + 0);
        inputs[chooseRandomInput].is_limit = true;
        // Số lượng nguyên liệu loại này theo độ khó của game    
        var difficultOffset = CONFIG.max_difficult_level - CONFIG.difficult_level;
        difficultOffset = difficultOffset < 0 ? 0 : difficultOffset;
        inputs[chooseRandomInput].limit_quantity = inputs[chooseRandomInput].quantity + Math.floor(difficultOffset * inputs[chooseRandomInput].quantity * (CONFIG.multiplier_with_difficult || 1));

        var limit_input = inputs.splice(chooseRandomInput, 1)[0];

        // Sinh ra 1 mảng tất cả các loại nguyên liệu sẽ xuất hiện trong game
        GAME.all_items_will_appear = {
            currentIndex: 0,
            array: []
        };

        for (var i = 1; i <= GAME.max_appear_items; i++) {
            var randomInputIndex = Math.floor((Math.random() * inputs.length) + 0);
            var inputItem = inputs[randomInputIndex];
            GAME.all_items_will_appear.array.push(inputItem.id);
            // if (inputItem.is_limit) {
            //     inputItem.limit_quantity--;
            //     if (inputItem.limit_quantity <= 0) {
            //         inputs.splice(randomInputIndex, 1);
            //     }
            // }
        }

        var beforeIndex = -1;
        // Chèn ngẫu nhiên các phần tử giới hạn vào mảng tất cả nguyên liệu
        for (var i = 1; i <= limit_input.limit_quantity; i++) {
            var randomIndex = -1;
            while (randomIndex == beforeIndex) {
                randomIndex = Math.floor((Math.random() * (GAME.all_items_will_appear.array.length - CONFIG.total_item_on_circle - 1)) + (CONFIG.total_item_on_circle - 1));
            }
            GAME.all_items_will_appear.array[randomIndex] = limit_input.id;
        }

        var ratio = CONFIG.sh / 568;
        if (CONFIG.sh < CONFIG.sw) ratio = CONFIG.sw / 568;

        var r = 90 + (ratio - 1) * 50;
        var sc = .3;

        for (var i = 1; i <= CONFIG.appear_circle; i++) {
            var item = creatFrut(frutHolder.core, "circle_" + i, r, sc);
            itemArr.push(item);
        }
    }

    /**
     * Sinh ra các phần tử trái cây trên vòng tròn
     * @param {*} target 
     * @param {*} id 
     * @param {*} name 
     * @param {*} url 
     * @param {*} total 
     * @param {*} r 
     * @param {*} sc 
     * @param {*} frutID 
     */
    function creatFrut(target, id, r, sc, frutID) {
        var total = CONFIG.total_item_on_circle;

        var item = target.addContainer({ id: id });
        item.frutID = frutID;
        item.r = r;
        with(item) {

            var rota = 2 * Math.PI / total;
            var itemArr = [];

            for (var i = 0; i < total; i++) {
                // Lấy các dữ liệu của phần tử từ trong mảng nguyên liệu đã có sẵn
                var material_input = getMaterialInput();

                var name = material_input.id,
                    url = material_input.url;

                var randomR = 0;

                var dx = Math.cos(i * rota) * (r + randomR);
                var dy = Math.sin(i * rota) * (r + randomR);

                var angle = Math.atan2(dy, dx) * 180 / Math.PI - 90;
                var radians = convertToRadian(angle);

                var circleFrut = addObject({ id: "item" + i, regPerX: .5, regPerY: .5, url: url, rotation: radians, locationX: dx, locationY: dy, scaleX: sc, scaleY: sc, name: name });
                itemArr.push(circleFrut);

                // Thiết đặt số lượng ban đầu của loại nguyên liệu này là 0
                GAME.material_collected[MATERIAL_INPUT[name].id] = 0;

                itemAutoScale(circleFrut, total, i);
            }

            item.itemArr = itemArr;
        }

        return item;
    }

    /**
     * Lấy nguyên liệu từ mảng nguyên liệu đã sinh ra
     */
    function getMaterialInput() {
        var material_input = MATERIAL_INPUT[GAME.all_items_will_appear.array[GAME.all_items_will_appear.currentIndex]];
        GAME.all_items_will_appear.currentIndex++;
        if (GAME.all_items_will_appear.currentIndex >= GAME.all_items_will_appear.array.length) {
            GAME.all_items_will_appear.currentIndex = 0;
        }
        return material_input;
    }

    /**
     * Tạo hiệu ứng phóng to/thu nhỏ cho nguyên liệu
     * @param {*} item 
     * @param {*} total 
     * @param {*} i 
     */
    function itemAutoScale(item, total, i) {
        // Cho mỗi nguyên liệu tự scale to nhỏ
        item.scale.x = item.scale.y = CONFIG.material_min_scale || 0.3;
        item.autoScale = TweenMax.from(item.scale, 1, {
            x: 1,
            y: 1,
            ease: Linear.easeNone,
            repeat: -1,
            yoyo: true,
        });

        var percent = (1 / (total / 4)) * i;
        item.autoScale.progress(percent);
    }

    /**
     * Đưa nguyên liệu về vị trí ban đầu
     * @param {*} target 
     */
    function backFn(target) {
        target.visible = true;
        target.holder.addChild(target);
        target.scale.x = target.scale.y = 0;
        target.rotation = target.initRota;
        TweenMax.to(target, 0, { x: target.initX, y: target.initY, ease: Sine.easeOut });
        target.autoScale.resume();
    }

    /**
     * Định nghĩa sự kiện kéo thả nguyên liệu sẽ làm gì
     * @param {*} target 
     */
    function startDrag(target) {

        target.interactive = true;
        target.buttonMode = true;

        target.mousedown = target.touchstart = function(data) {

            trace("touch start");

            data.originalEvent.preventDefault();

            var frutID = target.parent.frutID;

            ////////////////
            var checkHitHolder = GAME.Scene1.checkHitHolder;
            var sc = target.holder.scale.x;
            var rota = target.holder.rotation;

            var r = 150;

            checkHitHolder.addChild(target);

            target.rotation = target.rotation - convertToRadian(-radianToDegree(rota));
            target.position.x = -(CONFIG.sw / 2 - GAME.mousePosition.x);
            target.position.y = -(CONFIG.sh / 2 - GAME.mousePosition.y);
            target.scale.x = target.scale.y = sc;

            target.data = data;

            var mousePos = target.data.getLocalPosition(target.parent);
            target.anchorX = mousePos.x;
            target.anchorY = mousePos.y;

            target.startX = target.position.x;
            target.startY = target.position.y;

            target.dragging = true;

            target.mousemove = target.touchmove = function(data) {

                trace("touch move");

                if (target.dragging) {
                    if (!target.dragScale) {
                        target.autoScale.pause();
                        tweenFn(target, 0, 0, (target.scale.x < 1.5 ? 1.5 : target.scale.x));
                        target.dragScale = true;
                    }
                    var mousePos = target.data.getLocalPosition(target.parent);
                    var dx = target.startX + (mousePos.x - target.anchorX);
                    var dy = target.startY + (mousePos.y - target.anchorY);

                    target.position.x = dx;
                    target.position.y = dy;

                    checkHitBubble(target, false, frutID);
                }
            }

            target.mouseup = target.mouseupoutside = target.touchend = target.touchendoutside = function(data) {

                trace("touch end outside");

                var hit = checkHitBubble(target, true, frutID);
                if (!hit) backFn(target);
                else target.visible = false;

                target.dragging = false;
                target.data = null;
                target.mousemove = target.touchmove = null;
                target.mouseup = target.mouseupoutside = target.touchend = target.touchendoutside = null;

                target.dragScale = undefined;
            };

        }; //end mousedown 
    }

    /**
     * Kiểm tra nguyên liệu đã được kéo vào đúng vùng chế biến chưa
     * @param {*} target 
     * @param {*} flag 
     * @param {*} frutID 
     */
    function checkHitBubble(target, flag, frutID) {
        var bubbleArr = GAME.Scene1.bubbleHolder.bubbleArr;
        var len = bubbleArr.length;
        var curItem = null;
        var curDis = 100000;
        for (var i = 0; i < len; i++) {
            var item = bubbleArr[i];
            var dis = distanceTwoPoints(item.position.x, target.position.x, item.position.y, target.position.y);

            if (item.active) {
                if (dis < item.width / 2) {
                    if (curDis > dis) {
                        curDis = dis;
                        curItem = item;
                    }
                }
            }
        }

        if (curItem != null) {
            if (flag) {
                curItem.active = false;
                addFrutToBubble(target, curItem, frutID);
            }
            return true;
        }

        return false;
    }

    /**
     * Xử lý khi nguyên liệu đã được đưa vào đúng vùng chế biến
     * @param {*} frut 
     * @param {*} bubble 
     * @param {*} frutID 
     */
    function addFrutToBubble(frut, bubble, frutID) {
        trace("add frut to bubble");
        var spr = new PIXI.Sprite(frut.generateTexture());

        spr.scale.x = spr.scale.y = (bubble.width / spr.width) * .6;
        spr.position.x = -spr.width / 2;
        spr.position.y = -spr.height / 2;

        GAME.Scene1.small_bubble_group.visible = true;
        var smallBubble = new PIXI.Sprite(GAME.Scene1.small_bubble_group.generateTexture());
        smallBubble.visible = false;

        smallBubble.anchor.set(0.5, 0.5);

        GAME.Scene1.small_bubble_group.visible = false;

        // Timf
        var breakArr = GAME.Scene1.frutHolder.breakArr;
        var item = breakArr[MATERIAL_INPUT[frut.name].id];

        bubble.addChild(item);
        item.anchor = new PIXI.Point(0.5, 0.5);;


        item.initSC = spr.scale.x / 2;
        item.scale.x = item.scale.y = item.initSC;

        item.position.x = -item.width / 2;
        item.position.y = -item.height / 2;

        item.visible = false;

        bubble.addChild(spr);
        bubble.addChild(smallBubble);
        bubble.curFrut = spr;

        setTimeout(function() {
            item.visible = true;
            spr.visible = false;
            bubble.bitmap.visible = false;

            var delay = .1;
            var dur = .3;

            smallBubble.visible = true;
            smallBubble.scale.x = smallBubble.scale.y = .5;
            TweenMax.to(smallBubble.scale, dur, {
                delay: 0,
                x: 1,
                y: 1,
                ease: Sine.easeIn,
                onComplete: function() {
                    smallBubble.parent.removeChild(smallBubble);
                }
            })

            tweenFn(item, delay, dur, item.initSC * 1);

            TweenMax.to(bubble, dur, {
                delay: delay + .2,
                alpha: 0,
                ease: Sine.easeIn,
                onComplete: function() {
                    bubble.removeChild(item);
                    bubble.bitmap.visible = true;
                    bubble.alpha = 1;
                    randomFn(bubble, false);
                }
            })

            // backFn(frut);

        }, 300);

        checkFullMaterial(frut);
    }

    /**
     * Cập nhật số lượng nguyên liệu thu thập và kiểm tra đã đủ số lượng chế biến chưa
     * @param {*} fruit 
     */
    function checkFullMaterial(fruit) {
        GAME.material_collected[MATERIAL_INPUT[fruit.name].id]++;
        GAME.Scene1.collectHolder.collectObject[MATERIAL_INPUT[fruit.name].id].setText(GAME.material_collected[MATERIAL_INPUT[fruit.name].id]);

        var full_array = [];
        for (var i in MATERIAL_INPUT) {
            var material_input = MATERIAL_INPUT[i];
            if (GAME.material_collected[i] >= material_input.quantity) {
                full_array.push(true);
            } else {
                full_array.push(false);
            }
        }
        if (full_array.includes(false)) {
            // Chưa đủ
            trace("Chưa đủ nguyên liệu", GAME.material_collected);
        } else {
            GAME.finish_cup_number++;
            var per = (GAME.finish_cup_number / CONFIG.request_cup_number);

            setProgressBar(per);

            // Reset lại số lượng nguyên liệu thu thập
            for (var i in GAME.material_collected) {
                GAME.material_collected[i] = 0;
            }

            if (per >= 1) {
                stopGame();
            }
        }
    }

    function setProgressBar(per, dur) {
        var progress_bar = GAME.Scene1.progressHoder.progress_bar;

        if (per < 0) per = 0;
        if (per > 1) per = 1;

        if (dur == undefined) dur = .3;
        TweenMax.to(progress_bar.scale, dur, { x: per, ease: Sine.easeOut });
    }

    /**
     * Dừng game
     */
    function stopGame() {
        trace("stop game");
        GAME.stop_countdown = true;
        GAME.is_stop = true;

        gotoScene(Scene2JS);
    }

    /**
     * Bắt đầu chạy game
     */
    function startGame() {
        var dur = .3;
        var itemArr = GAME.Scene1.frutHolder.itemArr;

        GAME.Scene1.interactive = false;
        GAME.Scene1.removeChild(GAME.Scene1.hit);

        for (var i = 0; i < itemArr.length; i++) {
            var item = itemArr[i];
            starDragItem(item);
        }

        with(GAME.Scene1) {
            // TweenMax.to(intro.scale, dur, {
            //     x: 0,
            //     y: 0,
            //     ease: Back.easeIn,
            //     onComplete: function() {
            //         intro.parent.removeChild(intro);
            //     }
            // });

            TweenMax.to(countDown, dur, {
                alpha: 1,
                ease: Sine.easeOut,
                onComplete: function() {
                    startCountDown();
                }
            });

            TweenMax.to(progressHoder, dur, { alpha: 1, ease: Sine.easeOut });
        }
    }

    /**
     * Tạo sự kiện kéo thả lên nguyên liệu
     * @param {*} holder 
     */
    function starDragItem(holder) {
        var itemArr = holder.itemArr;
        var len = itemArr.length;

        for (var i = 0; i < len; i++) {
            var item = itemArr[i];
            item.holder = holder;
            startDrag(item);
        }
    }

    /**
     * Bắt đầu đồng hồ đếm ngược
     */
    function startCountDown() {
        GAME.stop_countdown = false;
        GAME.start_time = Date.now();
        requestAnimFrame(countDown);
    }

    function countDown() {
        if (GAME.is_stop) return;
        if (GAME.stop_countdown) return;

        GAME.count_time = Date.now() - GAME.start_time;
        requestAnimFrame(countDown, 100);
        setTime(GAME.count_time);
    }

    function setTime(count) {

        var ms = Math.floor((count % 1000) / 10);
        var ss = Math.floor(count / 1000) % 60;
        var mm = Math.floor(Math.floor(count / 1000) / 60) % 60;
        var hh = Math.floor((Math.floor(count / 1000) / 60) / 60) % 60;

        if (ms < 10) ms = "0" + ms;
        if (ss < 10) ss = "0" + ss;
        if (mm < 10) mm = "0" + mm;
        if (hh < 10) hh = "0" + hh;

        var curTime = CONFIG.total_seconds - ss;
        if (curTime <= 0) {
            curTime = 0;
            stopGame();
        }

        if (curTime < 10) curTime = "0" + curTime;
        GAME.Scene1.countDown.txt.setText(curTime);
        GAME.Scene1.countDown.s.x = GAME.Scene1.countDown.txt.position.x + GAME.Scene1.countDown.txt.width;
    }

    function sence1_enterFrame() {
        if (GAME.is_stop) return;
        var itemArr = GAME.Scene1.frutHolder.itemArr;
        var len = itemArr.length;
        var rota_sp = 0.005; // Tốc độ quay của vòng tròn nguyên liệu

        for (var i = 0; i < len; i++) {
            var item = itemArr[i];
            if (i % 2 == 0) item.rotation += item.rotate_speed || rota_sp;
            else item.rotation -= item.rotate_speed || rota_sp;
        }
        requestAnimFrame(sence1_enterFrame, 100);
    }

    function tweenFn(item, delay, dur, sc) {
        TweenMax.to(item.scale, dur, { delay: delay, x: sc, y: sc, ease: Sine.easeOut })
    }

    function randomFn(item, flag) {
        trace("random Bubble")

        item.active = true;
        // item.sp_x = (Math.random() - Math.random()) * 2;
        // item.sp_y = Math.random() * 3 + 1;

        // item.scale.x = item.scale.y = Math.random() * .5 + .5;
        // item.initSC = item.scale.x;

        // item.position.x = (Math.random() - Math.random()) * CONFIG.sw / 2;

        // if (flag) item.position.y = CONFIG.sh / 2 + Math.random() * CONFIG.sh;
        // else item.position.y = CONFIG.sh / 2 + item.height;
    }

    return {
        id: "s1",
        create: function() {
            trace("create 1")
            with(GAME.Container) {

                GAME.Scene1 = addContainer({ id: Scene1JS.id, locationX: CONFIG.sw / 2, locationY: CONFIG.sh / 2, alpha: 0 });

                with(GAME.Scene1) {
                    addRect("hit", CONFIG.sw, CONFIG.sh, "0xff0", 0, 0, 0);
                    addContainer({ id: "frutHolder" })
                    addContainer({ id: "bubbleHolder" })
                    addContainer({ id: "checkHitHolder" });
                    addContainer({ id: "countDown", alpha: 0 });
                    addContainer({ id: "progressHoder", locationX: -35, alpha: 0 });
                    // addContainer({ id: "intro" });
                    addContainer({ id: "collectHolder" });

                    addObject({ id: "small_bubble_group", texture: TEXTURES["images/bubble_group.png"], visible: false });

                    // with(intro) {
                    //     addObject({ id: "copy", texture: TEXTURES["images/intro_copy.png"], scaleX: .5, scaleY: .5, locationX: -155, locationY: -20 })
                    // }

                    with(countDown) {
                        addObject({ id: "bg", texture: TEXTURES["images/countDown.png"], scaleX: .5, scaleY: .5 });
                        addText({ id: "txt", text: CONFIG.total_seconds, font: "bold 20px Arial", color: "#008d41", locationX: 130, locationY: 15 });
                        addText({ id: "s", text: "s", font: "bold 15px Arial", color: "#008d41", locationX: 129, locationY: 19 });
                    }

                    with(progressHoder) {
                        addObject({ id: "progress_bg", texture: TEXTURES["images/progress_bg.png"], scaleX: .5, scaleY: .5 });
                        addObject({ id: "progress_bar", texture: TEXTURES["images/progress_bar.png"], scaleX: .5, scaleY: .5, locationX: 3, locationY: 3 });
                        addObject({ id: "num", texture: TEXTURES["images/numOfFrut.png"], scaleX: .5, scaleY: .5, locationX: 7, locationY: 7 });
                        addObject({ id: "bottle", texture: TEXTURES["images/bottle_double.png"], scaleX: .5, scaleY: .5, locationX: 80, locationY: -37 });
                    }


                    frutHolder.addContainer({ id: "core" });
                    with(frutHolder) {
                        var itemArr = [];
                        var breakArr = {};

                        generateCircleMaterial(frutHolder, itemArr, breakArr);

                        frutHolder.breakArr = breakArr;

                        var sc = 1 / itemArr.length;
                        for (var i = 0; i < itemArr.length; i++) {
                            var item = itemArr[i];
                            item.frutID = i;
                            item.rotation = convertToRadian(45);
                            item.scale.x = item.scale.y = 3;
                            // setRotateSpeed(item);
                        }
                        frutHolder.itemArr = itemArr;
                    }

                    with(bubbleHolder) {
                        var bubbleArr = [];

                        // Thêm ly tocotoco vào giữa màn hình chơi game
                        var bubbleItem = addObject({ id: "tocotocoCup", regPerX: .5, regPerY: .5, texture: TEXTURES["images/bubble.png"], scaleX: .5, scaleY: .5 });
                        bubbleArr.push(bubbleItem);
                        randomFn(bubbleItem, true);

                        bubbleHolder.bubbleArr = bubbleArr;
                    }

                    with(collectHolder) {
                        var collectObject = {};
                        var index = 0;
                        for (var i in GAME.material_collected) {
                            var rootX = (60 * index);
                            var rootY = 6;
                            collectObject[i] = addText({ id: "count", text: GAME.material_collected[i], font: "bold 18px Arial", color: "#008d41", locationX: rootX + 27, locationY: rootY });
                            addText({ id: "quantity", text: "/" + MATERIAL_INPUT[i].quantity, font: "bold 18px Arial", color: "#008d41", locationX: rootX + 40, locationY: rootY });
                            addObject({ id: "image", texture: TEXTURES[MATERIAL_INPUT[i].url], width: 25, height: 25, locationX: rootX });
                            index++;
                        }

                        collectHolder.collectObject = collectObject;
                    }
                }
            }
        },
        resize: function(sw, sh) {
            if (GAME.Scene1) {
                with(GAME.Scene1) {
                    hit.width = sw;
                    hit.height = sh;
                    hit.position.x = -hit.width / 2;
                    hit.position.y = -hit.height / 2;

                    position.x = sw / 2;
                    position.y = sh / 2;

                    countDown.position.x = -80;
                    countDown.position.y = -sh / 2 + 5;

                    progressHoder.position.y = sh / 2 - 60;

                    collectHolder.position.x = -sw / 2 + 20;
                    collectHolder.position.y = sh / 2 - 50;
                }
            }
        },
        start: function() {
            trace("isAllowWin = " + isAllowWin);
            haveAPrize = isAllowWin;

            TweenMax.to(GAME.Scene1, .5, { alpha: 1, ease: Sine.easeOut })
            setProgressBar(0, 0);

            var timeout;
            var itemArr = GAME.Scene1.frutHolder.itemArr;
            var breakArr = GAME.Scene1.frutHolder.breakArr;
            var sc = 1 / itemArr.length;
            for (var i = 0; i < itemArr.length; i++) {
                (function(item, i) {
                    item.frutID = i;
                    item.rotation = convertToRadian(45);

                    item.scale.x = item.scale.y = 0;
                    var tweenConfig = {
                        x: 5,
                        y: 5,
                        ease: Linear.easeNone,
                        repeat: -1,
                        // onStart: function() {
                        // },
                        onRepeat: function() {
                            changeCircleSprite(item);
                        }
                    };

                    item.tween = TweenMax.from(item.scale, CONFIG.circle_scale_seconds, tweenConfig);

                    var percent = (1 / itemArr.length) * i;
                    item.tween.progress(percent);
                })(itemArr[i], i);
            }

            requestAnimFrame(sence1_enterFrame);

            GAME.Scene1.interactive = true;

            startGame();
        }
    };
})();
/**
 * Màn hình kết quả
 */
var Scene2JS = (function() {
    return {
        id: "s2",
        create: function() {
            trace("create 2")

            with(GAME.Container) {

                GAME.Scene2 = addContainer({ id: Scene2JS.id, visible: false });
                GAME.Scene2.interactive = true;
                GAME.Scene2.buttonMode = true;

                with(GAME.Scene2) {
                    addRect("hit", CONFIG.sw, CONFIG.sh, "0xff0", 0, 0, 0);
                    addObject({ id: "logo", texture: TEXTURES["images/logo.png"], scaleX: .5, scaleY: .5 })
                    addObject({ id: "copy1", texture: TEXTURES["images/congratulation.png"], scaleX: .5, scaleY: .5, visible: false });
                    addObject({ id: "copy2", texture: TEXTURES["images/win.png"], scaleX: .5, scaleY: .5, visible: false })
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
                gotoScene(Scene3JS);
            }, 3000);
        },
        resize: function(sw, sh) {
            if (GAME.Scene2) {
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
        }
    };
})();
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