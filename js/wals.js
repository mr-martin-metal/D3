// Copyright 2013 Peter Cook @prcweb prcweb.co.uk
var chart = {
	data: null,
	xScale: null,
	yScale: null,
	svgLine: null,
	colorScale: null,
	scrollTimer: null,
	lastScrollFireTime : null,

	perspectiveOffsetX: 5,
	perspectiveOffsetY: 4.5,

	chartHeight: 600,
	lineWidth: 600,
	lineHeight: 150,

	bodyHeight: 9000, // Scroll height - small number will not scroll over the whole set of data!
	windowHeight: 0,
	scrollScale: null,

	menu: [
	{'label': 'Day', 'sortBy': 'year'},
	{'label': 'Maximum', 'sortBy': 'max'},
	{'label': 'Minimum', 'sortBy': 'min'},
	{'label': 'Mean', 'sortBy': 'mean'}
	],

	uiState: {
		selectedIndex: 0,
		selectedDatum: null, // Automatically updated
		sortBy: 'year',
		sorting: false
	},

	sortFunction: {},
	openingTimer: null,

	translate: function(x, y) {return 'translate('+x+','+y+')';},

	init: function() {
		var data = {};

		var dataset = _.map(this.data.walHistory, function(data, k) {
			var yearAve = _.reduce(data, function(m, v) { return m + v; }, 0) / 24;
			var yearMax = _.max(data);
			var yearMin = _.min(data);
			return {year: k, data: data, mean: yearAve, max: yearMax, min: yearMin};
		});
		this.data.walHistory = {data: dataset.reverse() , extent: [0, 100]}; //MM1

		d3.select('body').style('height', this.bodyHeight + 'px');
		this.windowHeight = $(window).height();
		this.scrollScale = d3.scale.linear().domain([0, this.bodyHeight - this.windowHeight * 0.99]).range([0, this.data.itemCount]).clamp(true);

		this.sortFunction.year = function(a, b) {return d3.descending(a.year, b.year);}
		this.sortFunction.mean = function(a, b) {return d3.descending(a.mean, b.mean);}
		this.sortFunction.max = function(a, b) {return d3.descending(a.max, b.max);}
		this.sortFunction.min = function(a, b) {return d3.ascending(a.min, b.min);}

		this.initChart();
		this.initEvents();
		this.initMenu();
	},

	initMenu: function() {
		var that = this;
		d3.select('#menu')
			.text('Sort by: ')
			.selectAll('span')
			.data(this.menu)
			.enter()
			.append('span')
			.html(function(d, i) {
				var html = '<span class="button">' + d.label + '</span>';
				if(i < that.menu.length - 1) html += ' / ';
				return html;
			});

		d3.select('#menu')
			.selectAll('span.button')
			.classed('selected', function(d, i) {return i===0;})
			.on('click', function() {
				var d = d3.select(this.parentNode).datum();
				console.log(d, d.sortBy);

				d3.selectAll('#menu span.button')
				.classed('selected', false);

			d3.select(this)
				.classed('selected', true);

			that.updateSort(d.sortBy);
			});
	},

	updateVisibleYears: function() {
		var that = chart; // Better way to do this?

		var index = that.uiState.selectedIndex;
		var years = d3.selectAll('#chart .years g.year');
		years.classed('hover', false);

		years
			.filter(function(d, i) {return i === index;})
			.classed('hover', true);

		d3.selectAll('.axes')
			.attr('transform', that.translate(30 + index * that.perspectiveOffsetX, that.chartHeight + that.yScale(0) + -index * that.perspectiveOffsetY));

		years
			.style('opacity', function(d, i) {
				if(i < index) return 0;
				return that.colorScale(i);
			});

		var datum = years.filter(function(d, i) {return i === index;}).datum();
		that.uiState.selectedDatum = datum;

		that.updateInfo();
	},

	updateInfo: function() {
		var that = chart;
		var d = that.uiState.selectedDatum;
		var html = '<h2>' + d.year + '</h2>';
		html += _.has(that.data.info, d.year) ? that.data.info[d.year].text : '';
		html += '<p>Highest hourly rate: ' + d.max + '</p>';
		html += '<p>Lowest hourly rate: ' + d.min + '</p>';
		html += '<p>Average hourly rate: ' + d.mean.toFixed(1) + '</p>';

		d3.select('#info')
			.html(html);
	},

	/* Throttled handling. The fucntion executes immediately but then 
	 * deboubces the other incomming inout and prevent handling
	 * of the scroll commands. First after the debounce interval
	 * expires, the next handling is allowed. It is time bound, and doe not have
	 * proportional or derivative component. Therefore is the response 
	 * not optimal 
	 */
	handleScrollThrottled: function() {
		var minScrollTime = 600;
		var now = new Date().getTime();
		var that = chart;

		function processScroll() {
			console.log(new Date().getTime().toString());
			if(that.uiState.sorting) return;
			that.scroll[1] = $(window).scrollTop();
			if(that.scroll[0] == that.scroll[1]) return;
			if( that.scroll[0] < that.scroll[1]) {
				if( that.uiState.selectedIndex < that.data.itemCount ) {
					that.uiState.selectedIndex += 1;
				}
			} else {
				if( that.uiState.selectedIndex > 0 ) {
					that.uiState.selectedIndex -= 1;
				}
			}
			if( that.scroll[1] > parseInt((that.bodyHeight - ( that.bodyHeight * 0.25 )),10) ) {
				$(window).scrollTop(4000);
				if( that.uiState.selectedIndex < that.data.itemCount ) {
					that.uiState.selectedIndex += 1;
				}
			}

			console.log("selectedIndex=", that.uiState.selectedIndex );
			console.log("Scroll 0 / 1", that.scroll[0], that.scroll[1]);
			that.scroll[0] = that.scroll[1];
			that.updateVisibleYears();
		}

		if (!this.scrollTimer) {
			if (now - this.lastScrollFireTime > (3 * minScrollTime)) {
				processScroll();   // fire immediately on first scroll
				this.lastScrollFireTime = now;
			}
			this.scrollTimer = setTimeout(function() {
				this.scrollTimer = null;
				this.lastScrollFireTime = new Date().getTime();
				processScroll();
			}, minScrollTime);
		}
	},

	/* Throttled handler. 
	 * This throttling incorporates proportonal and derivative component
	 * into time limitted trottling. It works a little better that the 
	 * statically configured throttling function but still does not bring
	 * the adequate responsivnes. Perhaps a better set of tuning constants for
	 * proportional and derivative components can bring better results.
	 */
	handleScrollThrottled_ex: function() {
		var that = chart; // Better way to do this?
		var interval, delay;

		function reRegister(e) {
			$(window).on('scroll', e );
		}

		$(window).off('scroll', that.handleScrollThrottled_ex);

		that.scroll[1] = $(window).scrollTop();
		interval = Math.ceil(Math.abs(that.scroll[0] - that.scroll[1])/ 80);
		delay = Math.floor(500 / (interval*interval));
		console.log("Calculated delay=", delay);

//		_.delay( reRegister(that.handleScroll), 200 );
		this.scrollTimer = setTimeout(function() {
			this.scrollTimer = null;
			reRegister(that.handleScrollThrottled_ex);
		}, delay);

		if(that.uiState.sorting) return;
		that.scroll[1] = $(window).scrollTop();
		//		that.uiState.selectedIndex = Math.round(that.scrollScale(scroll));
		//		console.log("scroll=",scroll);
		//		console.log("oldIndex - newIndex", that.uiState.selectedIndex, newIndex );
		if( that.scroll[0] < that.scroll[1]) {
			if( that.uiState.selectedIndex < that.data.itemCount ) {
				that.uiState.selectedIndex += 1;
			}
		} else {
			if( that.uiState.selectedIndex > 0 ) {
				that.uiState.selectedIndex -= 1;
			}
		}
		if( that.scroll[1] > parseInt((that.bodyHeight - ( that.bodyHeight * 0.25 )),10) ) {
			$(window).scrollTop(4000);
			if( that.uiState.selectedIndex < that.data.itemCount ) {
				that.uiState.selectedIndex += 1;
			}
		}

		console.log("selectedIndex=", that.uiState.selectedIndex );
		console.log("Scroll 0 / 1", that.scroll[0], that.scroll[1], Math.abs(that.scroll[0] - that.scroll[1]));
		that.scroll[0] = that.scroll[1];
		that.updateVisibleYears();
	},

	/* Throttled handler
	 * This handler is much simpler compared to the previous one and relies on
	 * properties of the "event" fired by tye browser. The evetn itself is supposed
	 * to bring the proportional and derivative acceleration components. The handler
	 * just gets the output. Typically, the Edge and Chromium fires once per mouse
	 * scroll evetn and the amount of chnage they send depends on the used mouse. 
	 * I measure 53 for my mouse. Firefox however sends multiple events "during" the
	 * wheel still moves and first the cummulative envent totals "53" for the same mouse.
	 * This throttling cummulates the chnage until it reaces level 53, then it triggers
	 * the chnage in the display
	 */
	handleScrollCustom: function() {
		var that = chart; // Better way to do this?

		if(that.uiState.sorting) return;
		that.scroll[1] = $(window).scrollTop();
		//		that.uiState.selectedIndex = Math.round(that.scrollScale(scroll));
		//		console.log("scroll=",scroll);
		//		console.log("oldIndex - newIndex", that.uiState.selectedIndex, newIndex );
		that.scroll[2] += Math.abs(that.scroll[1] - that.scroll[0]); 
		if( that.scroll[0] < that.scroll[1]) {
			if( (that.uiState.selectedIndex < that.data.itemCount) && ( that.scroll[2] > 52 ) ) {
				that.uiState.selectedIndex += 1;
				that.scroll[2] = 0;
			}
		} else {
			if( (that.uiState.selectedIndex > 0) && ( that.scroll[2] > 52 ) ) {
				that.uiState.selectedIndex -= 1;
				that.scroll[2] = 0;
			}
		}
		if( that.scroll[1] > parseInt((that.bodyHeight - ( that.bodyHeight * 0.25 )),10) ) {
			$(window).scrollTop(4000);
			if( that.uiState.selectedIndex < that.data.itemCount ) {
				that.uiState.selectedIndex += 1;
			}
		}

		console.log("selectedIndex=", that.uiState.selectedIndex );
		console.log("Scroll 0 - 1 = ", that.scroll[0], that.scroll[1], Math.abs(that.scroll[0] - that.scroll[1]));
		that.scroll[0] = that.scroll[1];
		that.updateVisibleYears();
	},

	/* Original handler. 
	 * Does not throttle the scroll event. It works fine on Chromium
	 * but is failing on other browsers.
	 */
	handleScroll: function() {
		var that = chart; // Better way to do this?

		if(that.uiState.sorting) return;
		that.scroll[1] = $(window).scrollTop();
		//		that.uiState.selectedIndex = Math.round(that.scrollScale(scroll));
		//		console.log("scroll=",scroll);
		//		console.log("oldIndex - newIndex", that.uiState.selectedIndex, newIndex );
		if( that.scroll[0] < that.scroll[1]) {
			if( that.uiState.selectedIndex < that.data.itemCount ) {
				that.uiState.selectedIndex += 1;
			}
		} else {
			if( that.uiState.selectedIndex > 0 ) {
				that.uiState.selectedIndex -= 1;
			}
		}
		if( that.scroll[1] > parseInt((that.bodyHeight - ( that.bodyHeight * 0.25 )),10) ) {
			$(window).scrollTop(4000);
			if( that.uiState.selectedIndex < that.data.itemCount ) {
				that.uiState.selectedIndex += 1;
			}
		}

		console.log("selectedIndex=", that.uiState.selectedIndex );
		console.log("Scroll 0 - 1 = ", that.scroll[0], that.scroll[1], Math.abs(that.scroll[0] - that.scroll[1]));
		that.scroll[0] = that.scroll[1];
		that.updateVisibleYears();
	},

	initEvents: function() {
		var that = this;
//		$(window).scroll(_.debounce(this.handleScroll, 80));
//		$(window).scroll(this.handleScroll);
		$(window).scroll(this.handleScrollCustom);
//		$(window).scroll(this.handleScrollThrottled);
//		$(window).scroll(this.handleScrollThrottled_ex);
		$(window).on('touchmove', this.handleScroll);
	},

	initChart: function() {
		var that = this;

		this.scroll=[3];
		this.scroll[0] = 0; // old scroll position
		this.scroll[1] = 0; // latest scroll position
		this.scroll[2] = 0; // difference counter
		this.xScale = d3.scale.linear()
			.domain([0, 23])
			.range([0, this.lineWidth]);

		this.yScale = d3.scale.linear()
			.domain(this.data.walHistory.extent)
			.range([this.lineHeight, 0]);

		this.colorScale = d3.scale.linear()
			.domain([0, this.data.itemCount])
			.range([1, 0.5]);

		this.svgLine = d3.svg.line()
			//.interpolate('cardinal')
			.interpolate('monotone')
			.x(function(d, i) {return that.xScale(i);})
			.y(function(d) {return that.yScale(d);});

		// YEAR LINES
		var years = d3.select('#chart svg')
			.append('g')
			.classed('years', true)
			.attr('transform', this.translate(30, this.chartHeight))
			.selectAll('g.year')
			.data(this.data.walHistory.data)
			.enter()
			.append('g')
			.attr('class', function(d, i) {return 'year-' + d.year;})
			.classed('year', true)
			.sort(this.sortFunction[this.uiState.sortBy])
			.attr('transform', function(d, i) {
				return that.translate(i * that.perspectiveOffsetX, -i * that.perspectiveOffsetY);
			})
			.style('opacity', function(d, i) {
				return that.colorScale(i);
			});

		// Add paths
		years
			.append('path')
			.attr('d', function(d, i) {
				return that.svgLine(d.data);
			});

		// Base and end lines
		years
			.append('line')
			.classed('base', true)
			.attr('x1', 0)
			.attr('y1', this.yScale(0))
			.attr('x2', this.xScale(23))
			.attr('y2', this.yScale(0));

		years
			.append('line')
			.classed('start', true)
			.attr('x1', 0)
			.attr('y1', this.yScale(0))
			.attr('x2', 0)
			.attr('y2', function(d) {return that.yScale(d.data[0]);});

		years
			.append('line')
			.classed('end', true)
			.attr('x1', this.xScale(23))
			.attr('y1', this.yScale(0))
			.attr('x2', this.xScale(23))
			.attr('y2', function(d) {return that.yScale(d.data[23]);});

		years
			.append('text')
			.classed('label', true)
			.attr('x', this.xScale(23) + 5)
			.attr('y', this.yScale(0))
			.text(function(d) {return d.year;})
			.each(function(d) {
				if(!_.has(that.data.info, d.year)) return;
				var color = that.data.info[d.year].class === 'hot' ? 'indianred' : 'steelblue';
				d3.select(this)
				.style('opacity', 1)
				.style('font-weight', '100')
				.style('fill', color);
			});

		d3.select('#chart svg')
			.append('g')
			.classed('axes', true)
			.attr('transform', this.translate(30, this.chartHeight));

		this.renderAxes();
	},

	renderAxes: function() {
		var monthScale = d3.scale.ordinal()
			.domain(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23'])
			.rangePoints([0, this.lineWidth]);

		var yAxis = d3.svg.axis()
			.scale(this.yScale)
			.orient('left')
			.tickValues([0,20,40,60,80,100,120,140,160,180,200]);

		d3.select('#chart .axes')
			.append('g')
			.classed('axis y', true)
			.attr('transform', this.translate(0, -this.yScale(0)))
			.call(yAxis);

		var xAxis = d3.svg.axis()
			.scale(monthScale)
			.orient('bottom');

		d3.select('#chart .axes')
			.append('g')
			.classed('axis x', true)
			.call(xAxis);
	},

	updateSort: function(sortBy) {
		var that = this;
		this.uiState.sortBy = sortBy;

		// Do the sort
		var years = d3.select('#chart .years')
			.selectAll('g.year')
			.sort(this.sortFunction[this.uiState.sortBy]);

		// Persist the chosen year: get the index of the chosen year
		d3.selectAll('#chart .years g.year')
			.each(function(d, i) {
				if(d.year === that.uiState.selectedDatum.year) index = i;
			});
		that.uiState.selectedIndex = index;

		// Transform the axes
		d3.selectAll('.axes')
			.transition()
			.duration(2000)
			.attr('transform', that.translate(25 + index * that.perspectiveOffsetX, that.chartHeight + that.yScale(0) + -index * that.perspectiveOffsetY))
			.each('end', function() {
				that.uiState.sorting = false;
			});

		// Transform the year paths
		d3.selectAll('#chart .years .year')
			.transition()
			.duration(2000)
			.attr('transform', function(d, i) {
				return that.translate(i * that.perspectiveOffsetX, -i * that.perspectiveOffsetY);
			})
		.style('opacity', function(d, i) {
			if(i < index) return 0;
			return that.colorScale(i);
		});

		// Reset scroll
		this.uiState.sorting = true;
		$(window).scrollTop(this.scrollScale.invert(index));
	}
}

//d3.json('data/wal.data.json', function(temperatureData) {
d3.json('data/test.json', function(temperatureData) {
	chart.data = temperatureData;
	chart.init();
	chart.updateVisibleYears();
});

