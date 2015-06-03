knime_lift_chart = function() {
    view = {};
    var _representation = null;
    var _value = null;
    var containerID = "lineContainer";
    var layoutContainerID = "layoutContainer";
     
    var minWidth = 400;
    var minHeight = 300;
    var defaultFont = "sans-serif";
    var defaultFontSize = 12;
    var xy = {};
    var gainXY = {};
    var legendHeight = 0;
    var _maxY = 0;
    var smoothing = "line";
    var smoothingMap = {
                "None" : "linear",
                "Bezier" : "basis",
                "Step before" : "step-before",
                "Cardinal" : "cardinal",
                "Monotone" : "monotone"
            };
            
    view.init = function(representation, value) {
        _value = value;
        _representation = representation;
        
        d3.select("html").style("width", "100%").style("height", "100%")/*.style("overflow", "hidden")*/;
        d3.select("body").style("width", "100%").style("height", "100%").style("margin", "0").style("padding", "0");
       
        var body = d3.select("body").attr("id", "body");
        
        var layoutContainer = body.append("div").attr("id", layoutContainerID)
                .style("width", "100%").style("height", "calc(100% - 50px)")
                .style("min-width", minWidth + "px");
        
        var controlHeight;
        if (_representation.enableControls) {
            var controlsContainer = body.append("div").style({position : "absolute", bottom : "0px", padding : "5px", "background-color" : "white",
                                        "padding-left" : "60px", width : "100%", "border-top" : "1px solid black"})
                                        .attr("id", "controlContainer");
            createControls(controlsContainer);
            controlHeight = controlsContainer.node().getBoundingClientRect().height;
        } else {
            controlHeight = 0;
        }

        layoutContainer.style({
            "height" : "calc(100% - " + controlHeight + "px)",
            "min-height" :  (minHeight + controlHeight) + "px"
        });
            
        xy["Lift"] = {color : "red", data : []};
        xy["Cumulative Lift"] = {color : "blue", data : []};
        
        if (!isNaN(representation.baseline)) {
            xy["Baseline"] = {color : "lime", data : [{x : representation.intervalWidth, y : representation.baseline},
                                                  {x : 100, y : representation.baseline}]};
        }
        
        _maxY = representation.baseline;
        for (var i = 0; i < representation.liftValues.length; i++) {
            var x = (i + 1) * representation.intervalWidth;
            var y = representation.liftValues[i];
            if (isNaN(y)) {
                delete xy["Lift"];
                break;
            }
            
            if (y > _maxY) {
                _maxY = y;
            }
            xy["Lift"].data.push({x : x, y : y});
        }
        for (var i = 0; i < representation.cumulativeLift.length; i++) {
            var x = (i + 1) * representation.intervalWidth;
            var y = representation.cumulativeLift[i];
            if (isNaN(y)) {
                delete xy["Cumulative Lift"];
                break;
            }
            if (y > _maxY) {
                _maxY = y;
            }
            xy["Cumulative Lift"].data.push({x : x, y : y});
        }
        
        gainXY["Cumulative Gain"] = { data : [], color : "red"};
        for (var i = 0; i < representation.response.length; i++) {
            var x = i * representation.intervalWidth;
            var y = representation.response[i];
            if (isNaN(y)) {
                delete gainXY["Cumulative Gain"];
                break;
            }
            gainXY["Cumulative Gain"].data.push({x : x, y : y});
        }
        
        gainXY["random"] = {color : "black", data : [{x : 0, y : 0}, {x : 100, y : 100}]};
        
        drawChart();
        if (parent != undefined && parent.KnimePageLoader != undefined) {
            parent.KnimePageLoader.autoResize(window.frameElement.id);
        }
    }
    
    function viewToggled() {
        _value.showGainChart = !_value.showGainChart;
        d3.select("#titleIn").attr("value", _value.showGainChart ? _value.titleGain : _value.titleLift);
        d3.select("#subtitleIn").attr("value", _value.showGainChart ? _value.subtitleGain : _value.subtitleLift);
        
        d3.select("#xTitleIn").attr("value", _value.showGainChart ? _value.xAxisTitleGain : _value.xAxisTitleLift);
        d3.select("#yTitleIn").attr("value", _value.showGainChart ? _value.yAxisTitleGain : _value.yAxisTitleLift);
        
        drawChart();
    }
    
    function createControls(controlsContainer) {
        
        if (_representation.enableViewToggle) {
            var toggleDiv = controlsContainer.append("div");
            toggleDiv.append("input").attr({type : "radio", id : "toggleLift", "name" : "toggleView"}).property("checked", !_value.showGainChart).on("click", viewToggled);
            toggleDiv.append("label").attr("for", "toggleLift").text(" Show Lift Chart");
            
            toggleDiv.append("input").attr({type : "radio", id : "toggleGains", "name" : "toggleView"}).style("margin-left", "10px").property("checked", _value.showGainChart).on("click", viewToggled);
            toggleDiv.append("label").attr("for", "toggleGains").text(" Show Cumulative Gains Chart");
        }
        var titleDiv;
        if (_representation.enableEditTitle || _representation.enableEditSubtitle) {
            titleDiv = controlsContainer.append("div").style({"margin-top" : "5px"});
        }
        if (_representation.enableEditTitle) {
            titleDiv.append("label").attr("for", "titleIn").text("Title: ").style({"width" : "100px", display : "inline-block"});
            titleDiv.append("input")
            .attr({id : "titleIn", type : "text", value : _value.showGainChart ? _value.titleGain : _value.titleLift}).style("width", 150)
            .on("keyup", function() {
                if (_value.showGainChart) {
                    _value.titleGain = this.value;
                } else {
                    _value.titleLift = this.value;
                }
                d3.select("#title").text(this.value);
            });
        }
        
        if (_representation.enableEditSubtitle) {
            titleDiv.append("label").attr("for", "subtitleIn").text("Subtitle: ").style({"margin-left" : "10px", "width" : "100px", display : "inline-block"});
            titleDiv.append("input")
            .attr({id : "subtitleIn", type : "text", value : _value.showGainChart ? _value.subtitleGain : _value.subtitleLift}).style("width", 150)
            .on("keyup", function() {
                if (_value.showGainChart) {
                    _value.subtitleGain = this.value;
                } else {
                    _value.subtitleLift = this.value;
                }
                d3.select("#subtitle").text(this.value);
            });
        }
        
        var axisTitleDiv;
        if (_representation.enableEditYAxisLabel || _representation.enableEditXAxisLabel) {
            axisTitleDiv = controlsContainer.append("div").style({"margin-top" : "5px"});
        }
        if (_representation.enableEditXAxisLabel) {
            axisTitleDiv.append("label").attr("for", "xTitleIn").text("X-axis title: ").style({"width" : "100px", display : "inline-block"});
            axisTitleDiv.append("input")
            .attr({id : "xTitleIn", type : "text", value : _value.showGainChart ? _value.xAxisTitleGain : _value.xAxisTitleLift}).style("width", 150)
            .on("keyup", function() {
                if (_value.showGainChart) {
                    _value.xAxisTitleGain = this.value;
                } else {
                    _value.xAxisTitleLift = this.value;
                }
                d3.select("#xtitle").text(this.value);
            });
        }
        
        if (_representation.enableEditYAxisLabel) {
            axisTitleDiv.append("label").attr("for", "yTitleIn").text("Y-axis title: ").style({"margin-left" : "10px", "width" : "100px", display : "inline-block"});
            axisTitleDiv.append("input")
            .attr({id : "yTitleIn", type : "text", value : _value.showGainChart ? _value.yAxisTitleGain : _value.yAxisTitleLift}).style("width", 150)
            .on("keyup", function() {
                if (_value.showGainChart) {
                    _value.yAxisTitleGain = this.value;
                } else {
                    _value.yAxisTitleLift = this.value;
                }
                d3.select("#ytitle").text(this.value);
            });
        }

        if (_representation.enableSmoothingEdit) {
            var smoothingDiv = controlsContainer.append("div").style({"margin-top" : "5px"});
            smoothingDiv.append("label").attr("for", "smoothingIn").text("Smoothing: ").style({"width" : "100px", display : "inline-block"});
            var select = smoothingDiv.append("select").attr("id", "smoothingIn");
            for (var key in smoothingMap) {
                var o = select.append("option").attr("value", key).text(key);
                if (_value.smoothing === smoothingMap[key]) {
                    
                    o.property("selected", true);
                }
            }
            select.on("change", function() {
                _value.smoothing = smoothingMap[this.value];
                drawChart();
            });
        }
    }
    
    function drawChart() {
        var currentData = _value.showGainChart ? gainXY : xy;
        var title = _value.showGainChart ? _value.titleGain : _value.titleLift;
        var subtitle = _value.showGainChart ? _value.subtitleGain : _value.subtitleLift;
        var xAxisTitle = _value.showGainChart ? _value.xAxisTitleGain : _value.xAxisTitleLift;
        var yAxisTitle = _value.showGainChart ? _value.yAxisTitleGain : _value.yAxisTitleLift;
        
        var cw = Math.max(minWidth, _representation.imageWidth);
        var ch = Math.max(minHeight, _representation.imageHeight);
        var chartWidth = cw + "px;"
        var chartHeight = ch + "px";

        if (_representation.resizeToWindow) {
            chartWidth = "100%";
            chartHeight = "calc(100% - " + getControlHeight() + "px)";
        }

        var lc = d3.select("#"+layoutContainerID);
        lc.selectAll("*").remove();
        
        var div = lc.append("div")
            .attr("id", containerID)
            .style("min-width", minWidth + "px")
            .style("min-height", minHeight + "px")
            .style("box-sizing", "border-box")
            .style("display", "inline-block")
            .style("overflow", "hidden")
            .style("margin", "0")
            .style("height", chartHeight)
            .style("width", chartWidth);
            
        var mTop = 10;
        if (_value.titleLift || _value.subtitleLift) {
            mTop += 55;
        }
        var margin = {top : mTop, left : 70, bottom : (legendHeight > 0 ? legendHeight + 10 : 60), right : 20};
        var svg1 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        document.getElementById(containerID).appendChild(svg1);
        
        var d3svg = d3.select(svg1);

        var svg = d3svg.attr({width : cw, height : ch}).style({width : chartWidth, height : chartHeight})
            .append("g").attr("transform", 
              "translate(" + margin.left + "," + margin.top + ")");

        var w = parseInt(d3svg.style('width')) - margin.left - margin.right;
        var h = parseInt(d3svg.style('height')) - margin.top - margin.bottom;
        
        var bg = parseColor(_representation.backgroundColor);
        var areaColor = parseColor(_representation.dataAreaColor);

        svg.append("rect").attr({fill : bg.rgb, "fill-opacity" : bg.opacity, width : margin.left + w + margin.right,
                                    height : margin.top + margin.bottom + h, x : -margin.left, y : -margin.top});
        svg.append("rect").attr({fill : areaColor.rgb, "fill-opacity" : areaColor.opacity, width : w, height : h});
                    
        var titleG = d3svg.append("g").attr("transform", "translate(" + margin.left + ",0)");
        var title = titleG.append("text").text(title).attr({"y" : 30, "id" : "title"}).attr("font-size", 24);
        var subtitle = titleG.append("text").text(subtitle).attr({"y" : mTop - 15, "id" : "subtitle"});
                    
        var x = d3.scale.linear().domain([0, 100]).range([0, w]);
        var y = d3.scale.linear().domain([0, _value.showGainChart ? 100 : _maxY]).nice().range([h, 0]);

        var xAxis, yAxis;

        // Define the axes
        if (!_representation.showGrid) {
            xAxis = d3.svg.axis().scale(x)
                .orient("bottom").ticks(5);
            
            yAxis = d3.svg.axis().scale(y)
                .orient("left").ticks(5);
        } else {

            xAxis = d3.svg.axis()
                .scale(x)
                .orient("bottom")
                .tickSize(-h, 0)
                .tickPadding(10);
        
            yAxis = d3.svg.axis()
                .scale(y)
                .orient("left")
                .tickSize(-w, 0)
                .tickPadding(10);
        }
        
        var valuelineInterpolated = d3.svg.line().interpolate(_value.smoothing)
        .x(function(d) { return x(d.x); })
        .y(function(d) { return y(d.y); });
        
        var valueline = d3.svg.line()
        .x(function(d) { return x(d.x); })
        .y(function(d) { return y(d.y); });
        
        // Add the X Axis
        var d3XAxis = svg.append("g");
            d3XAxis.attr("class", "x axis")
            .attr("transform", "translate(0," + h + ")")
            .call(xAxis);
    
        // Add the Y Axis
        var d3YAxis = svg.append("g");
            d3YAxis.attr("class", "y axis")
            .call(yAxis);
        
        svg.append("text")
            .attr("class", "x label")
            .attr("text-anchor", "end")
            .attr("x", w - 10)
            .attr("y", h + 45)
            .attr("id", "xtitle")
            .text(xAxisTitle);
            
        svg.append("text")
            .attr("class", "y label")
            .attr("text-anchor", "end")
            .attr("y", -55)
            .attr("dy", ".75em")
            .attr("transform", "rotate(-90)")
            .attr("id", "ytitle")
            .text(yAxisTitle);
        
        var gridColor = parseColor(_representation.gridColor);
        var stroke = _representation.showGrid ? gridColor.rgb : "#000";
        
        d3YAxis.selectAll("line").attr("stroke", stroke);
        d3XAxis.selectAll("line").attr("stroke", stroke);
        d3YAxis.selectAll("path").attr({"stroke" : stroke, "stroke-width" : 1, "fill" : "none"});
        d3XAxis.selectAll("path").attr({"stroke" : stroke, "stroke-width" : 1, "fill" : "none"});
        
        var xPos = 0;
        var yPos = 70;
        var areaG = svg.append("g");
        var areaCount = 0;
        var maxWidth = 0;
        
        // Add the valueline path.
        for (var key in currentData) {  
            var p;
            if (key != "random") {
                p = svg.append("path")
                .attr("class", "line")
                .style({stroke : currentData[key].color, fill : "none", "stroke-width" : _representation.lineWidth})
                .attr("d", valuelineInterpolated(currentData[key].data));
            } else {
                p = svg.append("path")
                .attr("class", "line")
                .style({stroke : currentData[key].color, fill : "none", "stroke-width" : _representation.lineWidth})
                .attr("d", valueline(currentData[key].data));
            }
            
            if (_representation.showLegend) { 
                var g = svg.append("g").attr("transform", "translate(" + xPos + "," + (h + yPos) + ")");
                var l = g.append("text").attr({x : 20}).text(key);
                g.append("circle").attr({"r" : 5, "fill" : currentData[key].color, cx : 5, cy : -5});
                xPos += parseInt(l.style("width")) + 20;
                
                if (xPos > w) {
                    yPos += 25;
                    xPos = 0;
                    g.attr("transform", "translate(" + xPos + "," + (h + yPos) + ")");
                    xPos += parseInt(l.style("width")) + 30;
                } else {
                    xPos += 10;
                }
            }
        }
        
        areaG.attr("transform", "translate(" + (w - maxWidth - 10) + "," + (h - areaCount * 25 + margin.top) + ")");
        
        if (legendHeight == 0 && _representation.showLegend) {
            legendHeight = Math.max(yPos, 75);
            drawChart();
        }

        if (_representation.resizeToWindow) {
            var win = document.defaultView || document.parentWindow;
            win.onresize = resize;
        }
    }
    
    view.getSVG = function() {
        var svg = d3.select("svg")[0][0];
        return (new XMLSerializer()).serializeToString(svg);
    };
    
    function parseColor(col) {
       var COLOR_REGEX = /rgba\(([0-9]{1,3}),([0-9]{1,3}),([0-9]{1,3}),([0-9]\.[0-9])\)/g;
       var match = COLOR_REGEX.exec(col), rgb, opacity;
       if (match) {
           rgb = "rgb(" + match[1] + "," + match[2] + "," + match[3] + ")";
           opacity = match[4];
       } else {
           rgb = col;
           opacity = "1.0";
       }
       return {rgb : rgb, opacity : opacity};
    }
    
    function resize(event) {
       legendHeight = 0;
       var controlHeight = d3.select("#controlContainer").node().getBoundingClientRect().height;
        d3.select("#" + layoutContainerID).style({
            "height" : "calc(100% - " + controlHeight + "px)",
            "min-height" :  (minHeight + controlHeight) + "px"
        });
        drawChart();
    };
    
    getControlHeight = function() {
        var height = rows = 0;
        var sizeFactor = 25;
        var padding = 10;
        if (height > 0) height += padding;
        return height;
    };
    
    view.validate = function() {
        return true;
    };
    
    view.getComponentValue = function() {
        return _value;
    };

    return view;
}();