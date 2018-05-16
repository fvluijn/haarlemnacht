$(document).ready(init);

function init() {
    /* ========== DRAWING THE PATH AND INITIATING THE PLUGIN ============= */

    $.fn.scrollPath("getPath")
        // Move to 'start' element
        .moveTo(400, 50, {name: "start"})
        // Line to 'description' element
        .lineTo(400, 800, {name: "description"})
        // Arc down and line to 'syntax'
        .arc(200, 1200, 400, -Math.PI/2, Math.PI/2, true)
        .lineTo(600, 1600, {
            callback: function() {
                highlight($(".settings"));
            },
            name: "syntax"
        })
        // Continue line to 'scrollbar'
        .lineTo(1750, 1600, {
            callback: function() {
                highlight($(".sp-scroll-handle"));
            },
            name: "scrollbar"
        })
        // Arc up while rotating
        .arc(1800, 1000, 600, Math.PI/2, 0, true, {rotate: Math.PI/2 })
        // Line to 'rotations'
        .lineTo(2400, 750, {
            name: "rotations"
        })
        // Rotate in place
        .rotate(3*Math.PI/2, {
            name: "rotations-rotated"
        })
        // Continue upwards to 'source'
        .lineTo(2400, -700, {
            name: "source"
        })
        // Small arc downwards
        .arc(2250, -700, 150, 0, -Math.PI/2, true)

        //Line to 'follow'
        .lineTo(1350, -850, {
            name: "follow"
        })
        // Arc and rotate back to the beginning.
        .arc(1300, 50, 900, -Math.PI/2, -Math.PI, true, {rotate: Math.PI*2, name: "end"});

    // We're done with the path, let's initate the plugin on our wrapper element
    $(".wrapper").scrollPath({drawPath: 0, wrapAround: true});

    // Add scrollTo on click on the navigation anchors
    $("nav").find("a").each(function() {
        var target = $(this).attr("href").replace("#", "");
        $(this).click(function(e) {
            e.preventDefault();

            // Include the jQuery easing plugin (http://gsgd.co.uk/sandbox/jquery/easing/)
            // for extra easing functions like the one below
            $.fn.scrollPath("scrollTo", target, 1000, "easeInOutSine");
        });
    });

    /* ===================================================================== */

    $(".settings .show-path").click(function(e) {
        e.preventDefault();
        $(".sp-canvas").toggle();
    }).toggle(function() {
        $(this).text("Hide Path");
    }, function() {
        $(this).text("Show Path");
    });

    $(".tweet").click(function(e) {
        open(this.href, "", "width=550, height=450");
        e.preventDefault();
    });

    $.getJSON("http://cdn.api.twitter.com/1/urls/count.json?callback=?&url=http%3A%2F%2Fjoelb.me%2Fscrollpath",
        function(data) {
            if(data && data.count !== undefined) {
                $(".follow .count").html("the " + ordinal(data.count + 1) + " kind person to");
            }
        });
}


function highlight(element) {
    if(!element.hasClass("highlight")) {
        element.addClass("highlight");
        setTimeout(function() { element.removeClass("highlight"); }, 2000);
    }
}
function ordinal(num) {
    return num + (
        (num % 10 == 1 && num % 100 != 11) ? 'st' :
            (num % 10 == 2 && num % 100 != 12) ? 'nd' :
                (num % 10 == 3 && num % 100 != 13) ? 'rd' : 'th'
    );
}



/*
                =============================
                  jQuery Scroll Path Plugin
                            v1.1.1

                   Demo and Documentation:
                  http://joelb.me/scrollpath
                =============================

    A jQuery plugin for defining a custom path that the browser
    follows when scrolling. Comes with a custom scrollbar,
    which is styled in scrollpath.css.

    Author: Joel Besada (http://www.joelb.me)
    Date: 2012-02-01

    Copyright 2012, Joel Besada
    MIT Licensed (http://www.opensource.org/licenses/mit-license.php)
*/
( function ( $, window, document, undefined ) {
    var	PREFIX =  "-" + getVendorPrefix().toLowerCase() + "-",
        HAS_TRANSFORM_SUPPORT = supportsTransforms(),
        HAS_CANVAS_SUPPORT = supportsCanvas(),
        FPS = 60,
        STEP_SIZE = 50,	// Number of actual path steps per scroll steps.
                           // The extra steps are needed to make animations look smooth.
        BIG_STEP_SIZE = STEP_SIZE * 5, // Step size for space, page down/up
        isInitialized = false,
        isDragging = false,
        isAnimating = false,
        step,
        pathObject,
        pathList,
        element,
        scrollBar,
        scrollHandle,

        // Default speeds for scrolling and rotating (with path.rotate())
        speeds = {
            scrollSpeed: 50,
            rotationSpeed: Math.PI/15
        },

        // Default plugin settings
        settings = {
            wrapAround: false,
            drawPath: false,
            scrollBar: true
        },

        methods = {
            /* Initializes the plugin */
            init: function( options ) {
                if ( this.length > 1 || isInitialized ) $.error( "jQuery.scrollPath can only be initialized on *one* element *once*" );

                $.extend( settings, options );
                isInitialized = true;
                element = this;
                pathList = pathObject.getPath();
                initCanvas();
                initScrollBar();
                scrollToStep( 0 ); // Go to the first step immediately
                element.css( "position", "relative" );

                $( document ).on({
                    "mousewheel": scrollHandler,
                    "DOMMouseScroll": ("onmousewheel" in document) ? null : scrollHandler, // Firefox
                    "keydown": keyHandler,
                    "mousedown": function( e ) {
                        if( e.button === 1 ) {
                            e.preventDefault();
                            return false;
                        }
                    }
                });

                $( window ).on( "resize", function() { scrollToStep( step ); } ); // Re-centers the screen
                return this;
            },

            getPath: function( options ) {
                $.extend( speeds, options );
                return pathObject || ( pathObject = new Path( speeds.scrollSpeed, speeds.rotationSpeed ));
            },

            scrollTo: function( name, duration, easing, callback ) {
                var destination = findStep( name );
                if ( destination === undefined ) $.error( "jQuery.scrollPath could not find scroll target with name '" + name + "'" );

                var distance = destination - step;

                if ( settings.wrapAround && Math.abs( distance ) > pathList.length / 2) {
                    if ( destination > step) {
                        distance = -step - pathList.length + destination;
                    } else {
                        distance = pathList.length - step + destination;
                    }
                }
                animateSteps( distance, duration, easing, callback );
                return this;
            }
        };

    /* The Path object serves as a context to "draw" the scroll path
        on before initializing the plugin */
    function Path( scrollS, rotateS ) {
        var PADDING = 40,
            scrollSpeed = scrollS,
            rotationSpeed = rotateS,
            xPos = 0,
            yPos = 0,
            rotation = 0,
            width = 0,
            height = 0,
            offsetX = 0,
            offsetY = 0,
            canvasPath = [{ method: "moveTo", args: [ 0, 0 ] }], // Needed if first path operation isn't a moveTo
            path = [],
            nameMap = {},

            defaults = {
                rotate: null,
                callback: null,
                name: null
            };

        /* Rotates the screen while staying in place */
        this.rotate = function( radians, options ) {
            var settings = $.extend( {}, defaults, options ),
                rotDistance = Math.abs( radians - rotation ),
                steps = Math.round( rotDistance / rotationSpeed ) * STEP_SIZE,
                rotStep = ( radians - rotation ) / steps,
                i = 1;

            if ( !HAS_TRANSFORM_SUPPORT ) {
                if ( settings.name || settings.callback ) {
                    // In case there was a name or callback set to this path, we add an extra step with those
                    // so they don't get lost in browsers without rotation support
                    this.moveTo(xPos, yPos, {
                        callback: settings.callback,
                        name: settings.name
                    });
                }
                return this;
            }

            for( ; i <= steps; i++ ) {
                path.push({ x: xPos,
                    y: yPos,
                    rotate: rotation + rotStep * i,
                    callback: i === steps ? settings.callback : null
                });
            }
            if( settings.name ) nameMap[ settings.name ] = path.length - 1;

            rotation = radians % ( Math.PI*2 );

            return this;
        };

        /* Moves (jumps) directly to the given point */
        this.moveTo = function( x, y, options ) {
            var settings = $.extend( {}, defaults, options ),
                steps = path.length ? STEP_SIZE : 1;
            var i = 0;

            for( ; i < steps; i++ ) {
                path.push({ x: x,
                    y: y,
                    rotate: settings.rotate !== null ? settings.rotate : rotation,
                    callback: i === steps - 1 ? settings.callback : null
                });
            }
            if( settings.name ) nameMap[ settings.name ] = path.length - 1;

            setPos( x, y );

            updateCanvas( x, y );
            canvasPath.push({ method: "moveTo", args: arguments });

            return this;
        };

        /* Draws a straight path to the given point */
        this.lineTo = function( x, y, options ) {
            var settings = $.extend( {}, defaults, options ),
                relX = x - xPos,
                relY = y - yPos,
                distance = hypotenuse( relX, relY ),
                steps = Math.round( distance/scrollSpeed ) * STEP_SIZE,
                xStep = relX / steps,
                yStep =  relY / steps,
                canRotate = settings.rotate !== null && HAS_TRANSFORM_SUPPORT,
                rotStep = ( canRotate ? ( settings.rotate - rotation ) / steps : 0 ),
                i = 1;

            for ( ; i <= steps; i++ ) {
                path.push({ x: xPos + xStep * i,
                    y: yPos + yStep * i,
                    rotate: rotation + rotStep * i,
                    callback: i === steps ? settings.callback : null
                });
            }
            if( settings.name ) nameMap[ settings.name ] = path.length - 1;

            rotation = ( canRotate ? settings.rotate : rotation );
            setPos( x, y );

            updateCanvas( x, y );
            canvasPath.push({ method: "lineTo", args: arguments });

            return this;
        };

        /* Draws an arced path with a given circle center, radius, start and end angle. */
        this.arc = function( centerX, centerY, radius, startAngle, endAngle, counterclockwise, options ) {
            var settings = $.extend( {}, defaults, options ),
                startX = centerX + Math.cos( startAngle ) * radius,
                startY = centerY + Math.sin( startAngle ) * radius,
                endX = centerX + Math.cos( endAngle ) * radius,
                endY = centerY + Math.sin( endAngle ) * radius,
                angleDistance = sectorAngle( startAngle, endAngle, counterclockwise ),
                distance = radius * angleDistance,
                steps = Math.round( distance/scrollSpeed ) * STEP_SIZE,
                radStep = angleDistance / steps * ( counterclockwise ? -1 : 1 ),
                canRotate = settings.rotate !== null && HAS_TRANSFORM_SUPPORT,
                rotStep = ( canRotate ? (settings.rotate - rotation) / steps : 0 ),
                i = 1;

            // If the arc starting point isn't the same as the end point of the preceding path,
            // prepend a line to the starting point. This is the default behavior when drawing on
            // a canvas.
            if ( xPos !== startX || yPos !== startY ) {
                this.lineTo( startX, startY );
            }

            for ( ; i <= steps; i++ ) {
                path.push({ x: centerX + radius * Math.cos( startAngle + radStep*i ),
                    y: centerY + radius * Math.sin( startAngle + radStep*i ),
                    rotate: rotation + rotStep * i,
                    callback: i === steps ? settings.callback : null
                });
            }
            if( settings.name ) nameMap[ settings.name ] = path.length - 1;

            rotation = ( canRotate ? settings.rotate : rotation );
            setPos( endX, endY );

            updateCanvas( centerX + radius, centerY + radius );
            updateCanvas( centerX - radius, centerY - radius );
            canvasPath.push({ method: "arc", args: arguments });

            return this;
        };

        this.getPath = function() {
            return path;
        };

        this.getNameMap = function() {
            return nameMap;
        };

        /* Appends offsets to all x and y coordinates before returning the canvas path */
        this.getCanvasPath = function() {
            var i = 0;
            for( ; i < canvasPath.length; i++ ) {
                canvasPath[ i ].args[ 0 ] -= this.getPathOffsetX();
                canvasPath[ i ].args[ 1 ] -= this.getPathOffsetY();
            }
            return canvasPath;
        };

        this.getPathWidth = function() {
            return width - offsetX + PADDING;
        };

        this.getPathHeight = function() {
            return height - offsetY + PADDING;
        };

        this.getPathOffsetX = function() {
            return offsetX - PADDING / 2;
        };

        this.getPathOffsetY = function() {
            return offsetY - PADDING / 2;
        };

        /* Sets the current position */
        function setPos( x, y ) {
            xPos = x;
            yPos = y;
        }

        /* Updates width and height, if needed */
        function updateCanvas( x, y ) {
            offsetX = Math.min( x, offsetX );
            offsetY = Math.min( y, offsetY );
            width = Math.max( x, width );
            height = Math.max( y, height );
        }

    }

    /* Plugin wrapper, handles method calling */
    $.fn.scrollPath = function( method ) {
        if ( methods[method] ) {
            return methods[ method ].apply( this, Array.prototype.slice.call( arguments, 1 ) );
        } else if ( typeof method === "object" || !method ) {
            return methods.init.apply( this, arguments );
        } else {
            $.error( "Method " +  method + " does not exist on jQuery.scrollPath" );
        }
    };

    /* Initialize the scroll bar */
    function initScrollBar() {
        if ( !settings.scrollBar ) return;

        // TODO: Holding down the mouse on the bar should "rapidfire", like holding down space
        scrollBar = $( "<div>" ).
        addClass( "sp-scroll-bar" ).
        on( "mousedown", function( e ) {
            var clickStep = Math.round( (e.offsetY || e.clientY) / scrollBar.height() * ( pathList.length - 1) );
            // Close in on the clicked part instead of jumping directly to it.
            // This mimics the default browser scroll bar behavior.
            if ( Math.abs(clickStep - step) > BIG_STEP_SIZE) {
                clickStep = step + ( 5 * STEP_SIZE * ( clickStep > step ? 1 : -1 ) );
            }
            scrollToStep(clickStep);

            e.preventDefault();
            return false;
        });

        scrollHandle = $( "<div>" ).
        addClass( "sp-scroll-handle" ).
        on({
            click: function( e ) {
                e.preventDefault();
                return false;
            },
            mousedown: function( e ) {
                if ( e.button !== 0 ) return;
                isDragging = true;
                e.preventDefault();
                return false;
            }
        });
        $( document ).on({
            mouseup: function( e ) { isDragging = false;  },
            mousemove: function( e ) {  if( isDragging ) dragScrollHandler( e ); }
        });

        $( "body" ).prepend( scrollBar.append( scrollHandle ) );

    }

    /* Initializes the path canvas */
    function initCanvas() {
        if ( !settings.drawPath || !HAS_CANVAS_SUPPORT ) return;

        var canvas,
            style = {
                position: "absolute",
                "z-index": 9998,
                left: pathObject.getPathOffsetX(),
                top: pathObject.getPathOffsetY(),
                "pointer-events": "none"
            };

        applyPrefix( style, "user-select", "none" );
        applyPrefix( style, "user-drag", "none" );

        canvas = $("<canvas>")
                .addClass("sp-canvas")
                .css(style)
                .prependTo(element);
console.log(canvas);
        canvas[0].width = pathObject.getPathWidth();
        canvas[0].height = pathObject.getPathHeight();

        drawCanvasPath( canvas[ 0 ].getContext( "2d" ), pathObject.getCanvasPath() );
    }

    /* Sets the canvas path styles and draws the path */
    function drawCanvasPath( context, path ) {
        var i = 0;

        context.shadowBlur = 15;
        context.shadowColor = "black";
        context.strokeStyle = "white";
        context.lineJoin = "round";
        context.lineCap = "round";
        context.lineWidth = 10;

        for( ; i < path.length; i++ ) {
            context[ path[ i ].method ].apply( context, path[ i ].args );
        }

        context.stroke();
    }

    /* Handles mousewheel scrolling */
    function scrollHandler( e ) {
        var scrollDelta = e.originalEvent.wheelDelta || -e.originalEvent.detail,
            dir = scrollDelta / ( Math.abs( scrollDelta ) );

        e.preventDefault();
        $( window ).scrollTop( 0 ).scrollLeft( 0 );
        scrollSteps( -dir * STEP_SIZE );
    }

    /* Handles key scrolling (arrows and space) */
    function keyHandler( e ) {
        // Disable scrolling with keys when user has focus on text input elements
        if ( /^text/.test( e.target.type ) ) return;
        switch ( e.keyCode ) {
            case 40: // Down Arrow
                scrollSteps( STEP_SIZE );
                break;
            case 38: // Up Arrow
                scrollSteps( -STEP_SIZE );
                break;
            case 34: //Page Down
                scrollSteps( BIG_STEP_SIZE );
                break;
            case 33: //Page Up
                scrollSteps( -BIG_STEP_SIZE );
                break;
            case 32: // Spacebar
                scrollSteps( BIG_STEP_SIZE * ( e.shiftKey ? -1 : 1 ) );
                break;
            case 35: // End
                scrollToStep( pathList.length - 1 );
                break;
            case 36: //Home
                scrollToStep( 0 );
                break;
        }
    }

    /* Handles scrollbar scrolling */
    function dragScrollHandler( e ) {
        var dragStep,
            y = e.clientY - scrollBar.offset().top;

        dragStep = limitWithin( Math.round( y / scrollBar.height() * ( pathList.length - 1 ) ), 0, pathList.length - 1 );

        scrollToStep( snap(dragStep, STEP_SIZE) );
    }

    /* Scrolls forward the given amount of steps. Negative values scroll backward. */
    function scrollSteps( steps ) {
        scrollToStep( wrapStep( step + steps ) );
    }

    /* Animates forward the given amount of steps over the set duration. Negative values scroll backward */
    function animateSteps ( steps, duration, easing, callback ) {
        if( steps === 0 || isAnimating ) return;
        if( !duration || typeof duration !== "number" ) {
            if ( typeof duration === "function" ) duration();
            return scrollSteps( steps );
        }
        isAnimating = true;

        var frames = ( duration / 1000 ) * FPS,
            startStep = step,
            currentFrame = 0,
            easedSteps,
            nextStep,
            interval = setInterval(function() {
                easedSteps = Math.round( ($.easing[easing] || $.easing.swing)( ++currentFrame / frames, duration / frames * currentFrame, 0, steps, duration) );
                nextStep = wrapStep( startStep + easedSteps);
                if (currentFrame === frames) {
                    clearInterval( interval );
                    if ( typeof easing === "function" ) {
                        easing();
                    } else if ( callback ) {
                        callback();
                    }
                    isAnimating = false;
                }
                scrollToStep( nextStep, true );
            }, duration / frames);
    }

    /* Scrolls to a specified step */
    function scrollToStep( stepParam, fromAnimation ) {
        if ( isAnimating && !fromAnimation ) return;
        var cb;
        if (pathList[ stepParam ] ){
            cb = pathList[ stepParam ].callback;
            element.css( makeCSS( pathList[ stepParam ] ) );
        }
        if( scrollHandle ) scrollHandle.css( "top", stepParam / (pathList.length - 1 ) * ( scrollBar.height() - scrollHandle.height() ) + "px" );
        if ( cb && stepParam !== step && !isAnimating ) cb();
        step = stepParam;
    }

    /* Finds the step number of a given name */
    function findStep( name ) {
        return pathObject.getNameMap()[ name ];
    }

    /* Wraps a step around the path, or limits it, depending on the wrapAround setting */
    function wrapStep( wStep ) {
        if ( settings.wrapAround ) {
            if( isAnimating ) {
                while ( wStep < 0 ) wStep += pathList.length;
                while ( wStep >= pathList.length ) wStep -= pathList.length;
            } else {
                if ( wStep < 0 ) wStep = pathList.length - 1;
                if ( wStep >= pathList.length ) wStep = 0;
            }
        } else {
            wStep = limitWithin( wStep, 0, pathList.length - 1 );
        }
        return wStep;
    }

    /* Translates a given node in the path to CSS styles */
    function makeCSS( node ) {
        var centeredX = node.x - $( window ).width() / 2,
            centeredY = node.y - $( window ).height() / 2,
            style = {};

        // Only use transforms when page is rotated
        if ( normalizeAngle(node.rotate) === 0 ) {
            style.left = -centeredX;
            style.top = -centeredY;
            applyPrefix( style, "transform-origin", "" );
            applyPrefix( style, "transform", "" );
        } else {
            style.left = style.top = "";
            applyPrefix( style, "transform-origin",  node.x + "px " + node.y + "px" );
            applyPrefix( style, "transform", "translate(" + -centeredX + "px, " + -centeredY + "px) rotate(" + node.rotate + "rad)" );
        }

        return style;
    }

    /* Determine the vendor prefix of the visitor's browser,
        http://lea.verou.me/2009/02/find-the-vendor-prefix-of-the-current-browser/
    */
    function getVendorPrefix() {
        var regex = /^(Moz|Webkit|Khtml|O|ms|Icab)(?=[A-Z])/,
            someScript = document.getElementsByTagName( "script" )[ 0 ];

        for ( var prop in someScript.style ) {
            if ( regex.test(prop) ) {
                return prop.match( regex )[ 0 ];
            }
        }

        if ( "WebkitOpacity" in someScript.style ) return "Webkit";
        if ( "KhtmlOpacity" in someScript.style ) return "Khtml";

        return "";
    }

    /* Applied prefixed and unprefixed css values of a given property to a given object*/
    function applyPrefix( style, prop, value ) {
        style[ PREFIX + prop ] = style[ prop ] = value;
    }

    /* Checks for CSS transform support */
    function supportsTransforms() {
        var	testStyle =  document.createElement( "dummy" ).style,
            testProps = [ "transform",
                "WebkitTransform",
                "MozTransform",
                "OTransform",
                "msTransform",
                "KhtmlTransform" ],
            i = 0;

        for ( ; i < testProps.length; i++ ) {
            if ( testStyle[testProps[ i ]] !== undefined ) {
                return true;
            }
        }
        return false;
    }

    /* Checks for canvas support */
    function supportsCanvas() {
        return !!document.createElement( "canvas" ).getContext;
    }

    /* Calculates the angle distance between two angles */
    function sectorAngle( start, end, ccw ) {
        var nStart = normalizeAngle( start ),
            nEnd = normalizeAngle( end ),
            diff = Math.abs( nStart - nEnd ),
            invDiff = Math.PI * 2 - diff;

        if ( ( ccw && nStart < nEnd ) ||
            ( !ccw && nStart > nEnd ) ||
            ( nStart === nEnd && start !== end ) // Special case *
        ) {
            return invDiff;
        }

        // *: In the case of a full circle, say from 0 to 2 * Math.PI (0 to 360 degrees),
        // the normalized angles would be the same, which means the sector angle is 0.
        // To allow full circles, we set this special case.

        return diff;
    }

    /* Limits a given value between a lower and upper limit */
    function limitWithin( value, lowerLimit, upperLimit ) {
        if ( value > upperLimit ) {
            return upperLimit;
        } else if ( value < lowerLimit ) {
            return lowerLimit;
        }
        return value;
    }

    /* 'Snaps' a value to be a multiple of a given snap value */
    function snap( value, snapValue ) {
        var mod = value % snapValue;
        if( mod > snapValue / 2) return value + snapValue - mod;
        return value - mod;
    }

    /* Normalizes a given angle (sets it between 0 and 2 * Math.PI) */
    function normalizeAngle( angle ) {
        while( angle < 0 ) {
            angle += Math.PI * 2;
        }
        return angle % ( Math.PI * 2 );
    }

    /* Calculates the hypotenuse of a right triangle with sides x and y */
    function hypotenuse( x, y ) {
        return Math.sqrt( x * x + y * y );
    }

})( jQuery, window, document );



/*
 * jQuery Easing v1.3 - http://gsgd.co.uk/sandbox/jquery/easing/
 *
 * Uses the built in easing capabilities added In jQuery 1.1
 * to offer multiple easing options
 *
 * TERMS OF USE - jQuery Easing
 *
 * Open source under the BSD License.
 *
 * Copyright Â© 2008 George McGinley Smith
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice, this list of
 * conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice, this list
 * of conditions and the following disclaimer in the documentation and/or other materials
 * provided with the distribution.
 *
 * Neither the name of the author nor the names of contributors may be used to endorse
 * or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 *  COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
 *  GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED
 * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *  NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 *
*/

// t: current time, b: begInnIng value, c: change In value, d: duration
jQuery.easing['jswing'] = jQuery.easing['swing'];

jQuery.extend( jQuery.easing,
    {
        def: 'easeOutQuad',
        swing: function (x, t, b, c, d) {
            //alert(jQuery.easing.default);
            return jQuery.easing[jQuery.easing.def](x, t, b, c, d);
        },
        easeInQuad: function (x, t, b, c, d) {
            return c*(t/=d)*t + b;
        },
        easeOutQuad: function (x, t, b, c, d) {
            return -c *(t/=d)*(t-2) + b;
        },
        easeInOutQuad: function (x, t, b, c, d) {
            if ((t/=d/2) < 1) return c/2*t*t + b;
            return -c/2 * ((--t)*(t-2) - 1) + b;
        },
        easeInCubic: function (x, t, b, c, d) {
            return c*(t/=d)*t*t + b;
        },
        easeOutCubic: function (x, t, b, c, d) {
            return c*((t=t/d-1)*t*t + 1) + b;
        },
        easeInOutCubic: function (x, t, b, c, d) {
            if ((t/=d/2) < 1) return c/2*t*t*t + b;
            return c/2*((t-=2)*t*t + 2) + b;
        },
        easeInQuart: function (x, t, b, c, d) {
            return c*(t/=d)*t*t*t + b;
        },
        easeOutQuart: function (x, t, b, c, d) {
            return -c * ((t=t/d-1)*t*t*t - 1) + b;
        },
        easeInOutQuart: function (x, t, b, c, d) {
            if ((t/=d/2) < 1) return c/2*t*t*t*t + b;
            return -c/2 * ((t-=2)*t*t*t - 2) + b;
        },
        easeInQuint: function (x, t, b, c, d) {
            return c*(t/=d)*t*t*t*t + b;
        },
        easeOutQuint: function (x, t, b, c, d) {
            return c*((t=t/d-1)*t*t*t*t + 1) + b;
        },
        easeInOutQuint: function (x, t, b, c, d) {
            if ((t/=d/2) < 1) return c/2*t*t*t*t*t + b;
            return c/2*((t-=2)*t*t*t*t + 2) + b;
        },
        easeInSine: function (x, t, b, c, d) {
            return -c * Math.cos(t/d * (Math.PI/2)) + c + b;
        },
        easeOutSine: function (x, t, b, c, d) {
            return c * Math.sin(t/d * (Math.PI/2)) + b;
        },
        easeInOutSine: function (x, t, b, c, d) {
            return -c/2 * (Math.cos(Math.PI*t/d) - 1) + b;
        },
        easeInExpo: function (x, t, b, c, d) {
            return (t==0) ? b : c * Math.pow(2, 10 * (t/d - 1)) + b;
        },
        easeOutExpo: function (x, t, b, c, d) {
            return (t==d) ? b+c : c * (-Math.pow(2, -10 * t/d) + 1) + b;
        },
        easeInOutExpo: function (x, t, b, c, d) {
            if (t==0) return b;
            if (t==d) return b+c;
            if ((t/=d/2) < 1) return c/2 * Math.pow(2, 10 * (t - 1)) + b;
            return c/2 * (-Math.pow(2, -10 * --t) + 2) + b;
        },
        easeInCirc: function (x, t, b, c, d) {
            return -c * (Math.sqrt(1 - (t/=d)*t) - 1) + b;
        },
        easeOutCirc: function (x, t, b, c, d) {
            return c * Math.sqrt(1 - (t=t/d-1)*t) + b;
        },
        easeInOutCirc: function (x, t, b, c, d) {
            if ((t/=d/2) < 1) return -c/2 * (Math.sqrt(1 - t*t) - 1) + b;
            return c/2 * (Math.sqrt(1 - (t-=2)*t) + 1) + b;
        },
        easeInElastic: function (x, t, b, c, d) {
            var s=1.70158;var p=0;var a=c;
            if (t==0) return b;  if ((t/=d)==1) return b+c;  if (!p) p=d*.3;
            if (a < Math.abs(c)) { a=c; var s=p/4; }
            else var s = p/(2*Math.PI) * Math.asin (c/a);
            return -(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )) + b;
        },
        easeOutElastic: function (x, t, b, c, d) {
            var s=1.70158;var p=0;var a=c;
            if (t==0) return b;  if ((t/=d)==1) return b+c;  if (!p) p=d*.3;
            if (a < Math.abs(c)) { a=c; var s=p/4; }
            else var s = p/(2*Math.PI) * Math.asin (c/a);
            return a*Math.pow(2,-10*t) * Math.sin( (t*d-s)*(2*Math.PI)/p ) + c + b;
        },
        easeInOutElastic: function (x, t, b, c, d) {
            var s=1.70158;var p=0;var a=c;
            if (t==0) return b;  if ((t/=d/2)==2) return b+c;  if (!p) p=d*(.3*1.5);
            if (a < Math.abs(c)) { a=c; var s=p/4; }
            else var s = p/(2*Math.PI) * Math.asin (c/a);
            if (t < 1) return -.5*(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )) + b;
            return a*Math.pow(2,-10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )*.5 + c + b;
        },
        easeInBack: function (x, t, b, c, d, s) {
            if (s == undefined) s = 1.70158;
            return c*(t/=d)*t*((s+1)*t - s) + b;
        },
        easeOutBack: function (x, t, b, c, d, s) {
            if (s == undefined) s = 1.70158;
            return c*((t=t/d-1)*t*((s+1)*t + s) + 1) + b;
        },
        easeInOutBack: function (x, t, b, c, d, s) {
            if (s == undefined) s = 1.70158;
            if ((t/=d/2) < 1) return c/2*(t*t*(((s*=(1.525))+1)*t - s)) + b;
            return c/2*((t-=2)*t*(((s*=(1.525))+1)*t + s) + 2) + b;
        },
        easeInBounce: function (x, t, b, c, d) {
            return c - jQuery.easing.easeOutBounce (x, d-t, 0, c, d) + b;
        },
        easeOutBounce: function (x, t, b, c, d) {
            if ((t/=d) < (1/2.75)) {
                return c*(7.5625*t*t) + b;
            } else if (t < (2/2.75)) {
                return c*(7.5625*(t-=(1.5/2.75))*t + .75) + b;
            } else if (t < (2.5/2.75)) {
                return c*(7.5625*(t-=(2.25/2.75))*t + .9375) + b;
            } else {
                return c*(7.5625*(t-=(2.625/2.75))*t + .984375) + b;
            }
        },
        easeInOutBounce: function (x, t, b, c, d) {
            if (t < d/2) return jQuery.easing.easeInBounce (x, t*2, 0, c, d) * .5 + b;
            return jQuery.easing.easeOutBounce (x, t*2-d, 0, c, d) * .5 + c*.5 + b;
        }
    });

/*
 *
 * TERMS OF USE - EASING EQUATIONS
 *
 * Open source under the BSD License.
 *
 * Copyright Â© 2001 Robert Penner
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice, this list of
 * conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice, this list
 * of conditions and the following disclaimer in the documentation and/or other materials
 * provided with the distribution.
 *
 * Neither the name of the author nor the names of contributors may be used to endorse
 * or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 *  COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
 *  GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED
 * AND ON ANY THEORY OF LIABILITY0, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *  NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */
// StyleFix 1.0.1 & PrefixFree 1.0.4 / by Lea Verou / MIT license
(function(){function h(a,b){return[].slice.call((b||document).querySelectorAll(a))}if(window.addEventListener){var b=window.StyleFix={link:function(a){try{if(!/\bstylesheet\b/i.test(a.rel)||!a.sheet.cssRules)return}catch(c){return}var d=a.href||a.getAttribute("data-href"),f=d.replace(/[^\/]+$/,""),g=a.parentNode,e=new XMLHttpRequest;e.open("GET",d);e.onreadystatechange=function(){if(4===e.readyState){var c=e.responseText;if(c&&a.parentNode){c=b.fix(c,!0,a);f&&(c=c.replace(/url\((?:'|")?(.+?)(?:'|")?\)/gi,
        function(a,c){return!/^([a-z]{3,10}:|\/)/i.test(c)?'url("'+f+c+'")':a}),c=c.replace(RegExp("\\b(behavior:\\s*?url\\('?\"?)"+f,"gi"),"$1"));var d=document.createElement("style");d.textContent=c;d.media=a.media;d.disabled=a.disabled;d.setAttribute("data-href",a.getAttribute("href"));g.insertBefore(d,a);g.removeChild(a)}}};e.send(null);a.setAttribute("data-inprogress","")},styleElement:function(a){var c=a.disabled;a.textContent=b.fix(a.textContent,!0,a);a.disabled=c},styleAttribute:function(a){var c=
        a.getAttribute("style"),c=b.fix(c,!1,a);a.setAttribute("style",c)},process:function(){h('link[rel~="stylesheet"]:not([data-inprogress])').forEach(StyleFix.link);h("style").forEach(StyleFix.styleElement);h("[style]").forEach(StyleFix.styleAttribute)},register:function(a,c){(b.fixers=b.fixers||[]).splice(void 0===c?b.fixers.length:c,0,a)},fix:function(a,c){for(var d=0;d<b.fixers.length;d++)a=b.fixers[d](a,c)||a;return a},camelCase:function(a){return a.replace(/-([a-z])/g,function(a,b){return b.toUpperCase()}).replace("-",
        "")},deCamelCase:function(a){return a.replace(/[A-Z]/g,function(a){return"-"+a.toLowerCase()})}};(function(){setTimeout(function(){h('link[rel~="stylesheet"]').forEach(StyleFix.link)},10);document.addEventListener("DOMContentLoaded",StyleFix.process,!1)})()}})();
(function(h){if(window.StyleFix&&window.getComputedStyle){var b=window.PrefixFree={prefixCSS:function(a,c){function d(c,d,f,g){c=b[c];c.length&&(c=RegExp(d+"("+c.join("|")+")"+f,"gi"),a=a.replace(c,g))}var f=b.prefix;d("functions","(\\s|:|,)","\\s*\\(","$1"+f+"$2(");d("keywords","(\\s|:)","(\\s|;|\\}|$)","$1"+f+"$2$3");d("properties","(^|\\{|\\s|;)","\\s*:","$1"+f+"$2:");if(b.properties.length){var g=RegExp("\\b("+b.properties.join("|")+")(?!:)","gi");d("valueProperties","\\b",":(.+?);",function(a){return a.replace(g,
        f+"$1")})}c&&(d("selectors","","\\b",b.prefixSelector),d("atrules","@","\\b","@"+f+"$1"));return a=a.replace(RegExp("-"+f,"g"),"-")},prefixSelector:function(a){return a.replace(/^:{1,2}/,function(a){return a+b.prefix})},prefixProperty:function(a,c){var d=b.prefix+a;return c?StyleFix.camelCase(d):d}};(function(){var a={},c=[],d=getComputedStyle(document.documentElement,null),f=document.createElement("div").style,g=function(b){if("-"===b.charAt(0)){c.push(b);var b=b.split("-"),d=b[1];for(a[d]=++a[d]||
    1;3<b.length;)b.pop(),d=b.join("-"),StyleFix.camelCase(d)in f&&-1===c.indexOf(d)&&c.push(d)}};if(0<d.length)for(var e=0;e<d.length;e++)g(d[e]);else for(var i in d)g(StyleFix.deCamelCase(i));var e=0,j,h;for(h in a)d=a[h],e<d&&(j=h,e=d);b.prefix="-"+j+"-";b.Prefix=StyleFix.camelCase(b.prefix);b.properties=[];for(e=0;e<c.length;e++)i=c[e],0===i.indexOf(b.prefix)&&(j=i.slice(b.prefix.length),StyleFix.camelCase(j)in f||b.properties.push(j));"Ms"==b.Prefix&&!("transform"in f)&&!("MsTransform"in f)&&"msTransform"in
f&&b.properties.push("transform","transform-origin");b.properties.sort()})();(function(){function a(a,b){f[b]="";f[b]=a;return!!f[b]}var c={"linear-gradient":{property:"backgroundImage",params:"red, teal"},calc:{property:"width",params:"1px + 5%"},element:{property:"backgroundImage",params:"#foo"}};c["repeating-linear-gradient"]=c["repeating-radial-gradient"]=c["radial-gradient"]=c["linear-gradient"];var d={initial:"color","zoom-in":"cursor","zoom-out":"cursor",box:"display",flexbox:"display","inline-flexbox":"display"};
    b.functions=[];b.keywords=[];var f=document.createElement("div").style,g;for(g in c){var e=c[g],i=e.property,e=g+"("+e.params+")";!a(e,i)&&a(b.prefix+e,i)&&b.functions.push(g)}for(var h in d)i=d[h],!a(h,i)&&a(b.prefix+h,i)&&b.keywords.push(h)})();(function(){function a(a){f.textContent=a+"{}";return!!f.sheet.cssRules.length}var c={":read-only":null,":read-write":null,":any-link":null,"::selection":null},d={keyframes:"name",viewport:null,document:'regexp(".")'};b.selectors=[];b.atrules=[];var f=h.appendChild(document.createElement("style")),
    g;for(g in c){var e=g+(c[g]?"("+c[g]+")":"");!a(e)&&a(b.prefixSelector(e))&&b.selectors.push(g)}for(var i in d)e=i+" "+(d[i]||""),!a("@"+e)&&a("@"+b.prefix+e)&&b.atrules.push(i);h.removeChild(f)})();b.valueProperties=["transition","transition-property"];h.className+=" "+b.prefix;StyleFix.register(b.prefixCSS)}})(document.documentElement);