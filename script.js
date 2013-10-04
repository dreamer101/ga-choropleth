// geo data from http://www.diva-gis.org/gdata
// parsed with OGR2OGR into GeoJSON and GeoJSON into topoJSON
// combined county (adm2) with state (adm1) data via topoJSON


var chart = {},
    info = {},
    width = 650,
    height = 750,
    scaleFactor = 5;

chart.data = {};

// Define some of the basic D3 utilities and elements
var svg = d3.select('.d3-container').append('svg')
    .attr('width', width)
    .attr('height', height);

// Define the map projection, scale and path to use
var projection = d3.geo.mercator()
    .translate([11212.5, 4912.5])
    .scale(7500);

var path = d3.geo.path()
    .projection(projection);

// Quantize the groupings used to generate the choropleth mapping
var quantize = d3.scale.quantize()
    .domain([0, 25000000])
    .range(d3.range(8).map(function(i) { return 'q' + i; }));

// Load the topojson file of Georgia state and county geometry
d3.json('lib/geo/ga.json', function(error, ga) {
    chart.data.georgia = topojson.feature(ga, ga.objects.states);
    chart.data.counties = topojson.feature(ga, ga.objects.counties);

    // Load the disaster.csv file of Georgia state disasters indexed by county name
    d3.csv('/lib/geo/disasters.csv', function(error, data) {
        chart.data.disasters = {
            raw: data,
            byCounty: {},
            byCountyByMonth: {}
        };

        // Map disaster data into array associated with each county's properties
        _.each(data, function(disaster) {
            var county = _.filter(chart.data.counties.features, function(d) {
                var countyName = d.properties.NAME_2.trim().toLowerCase(),
                    disasterCountyName = disaster.NAME.trim().toLowerCase();

                return countyName === disasterCountyName;
            });

            if (county[0]) {
                if (!county[0].properties.disasters) {
                    county[0].properties.disasters = [];
                }

                county[0].properties.disasters.push(disaster);
            }
        });

        // Group the data by county and then by month
        counties = _.groupBy(data, 'NAME');
        chart.data.disasters.byCounty = counties;

        _.each(counties, function(county) {
            _.each(county, function(disaster) {
                var dateStart = moment(disaster.HAZARD_BEGIN_DATE);
                var monthYear = dateStart.format('YYYY-MM');

                disaster.start = monthYear;
            });

            chart.data.disasters.byCountyByMonth[county[0].NAME] = _.groupBy(county, 'start');
        });

        chart.data.disasters.maxByCounty = d3.max(
            _.toArray(chart.data.disasters.byCounty),
            function(d) {
                return d.length;
            });

        chart.data.disasters.minByCounty = d3.min(
            _.toArray(chart.data.disasters.byCounty),
            function(d) {
                return d.length;
            });



        // Create the path for the state outline
        svg.append('path')
            .datum(chart.data.georgia)
            .attr('class', 'state')
            .attr('d', path);

        // Create paths for each county that will be used for county selection and UI effects
        svg.selectAll('.subunit')
            .data(chart.data.counties.features)
            .enter().append('path')
            .attr('class', function(d) {
                var cost = 0;

                // Calculate the total cost per county
                if (d.properties.disasters) {
                    cost = d3.sum(d.properties.disasters, function(dd) {
                        return +dd.PROPERTY_DAMAGE;
                    });
                }

                return 'county ' + d.properties.NAME_2.trim() + ' ' + quantize(cost);
            })
            .attr('d', path)
            .on("mouseover", function (d) {
                    hover(d, true);
            })
            .on("mouseout", function (d) {
                    hover(d, false);
            });

        // Create the boundary lines between counties
        svg.append('path')
            .datum(topojson.mesh(ga, ga.objects.counties, function(a, b) { return a.properties.NAME_2 !== b.properties.NAME_2;}))
            .attr('d', path)
            .attr('class', 'county-boundary');


        // Create the info with charts and data
        info.header = svg
            .append('text')
            .attr('y', 35)
            .attr('x', 350)
            .attr('class', 'info header')
            .text(info.title);

        info.years = svg
            .append('text')
            .attr('y', 725)
            .attr('x', 100)
            .attr('class', 'info years')
            .text('2010 - 2012');

        info.totalCost = svg
            .append('text')
            .attr('y', 53)
            .attr('x', 350)
            .attr('class', 'info totalCost')
            .text('Average Annual Cost of Damage: $0');

        info.avgCost = svg
            .append('text')
            .attr('y', 70)
            .attr('x', 350)
            .attr('class', 'info avgCost')
            .text('Average Cost per Disaster: $0');

        // Initialize some of the highlevel data by calling the "mouseout" function
        hover(null, false);

    });
});

var hover = function(data, bHover) {
    var totalCost = 0,
        avgCost = 0,
        avgDailyCost = 0;

    // A simple formatter to round and add commas to numbers
    var formatNumber = function(val) {
        val = Math.round(val);

        val = val
            .toString()
            .replace(/\B(?=(\d{3})+(?!\d))/g, ",");

        return val;
    };

    if (bHover) {
        // When hovering over a county, show the county specific data

        info.title = data.properties.NAME_2.trim() + ' County';
        info.header.text(info.title);

        // Update figures
        if (data.properties.disasters) {
            totalCost = d3.sum(data.properties.disasters,
                function(d) {
                    return +d.PROPERTY_DAMAGE;
                });

            avgCost = d3.mean(data.properties.disasters,
                function(d) {
                    return +d.PROPERTY_DAMAGE;
                });

            totalCost = formatNumber(totalCost/3);
            avgCost = formatNumber(avgCost);
        }

        info.totalCost.text('Average Annual Cost of Damage: $' + totalCost);
        info.avgCost.text('Average Cost per Disaster: $' + avgCost);
    } else {
        // When not hovering over a county, show the overall Georgia data

        info.title = 'Georgia';
        info.header.text(info.title);

        // Update figures
        totalCost = d3.sum(chart.data.disasters.raw,
            function(d) {
                return +d.PROPERTY_DAMAGE;
            });

        avgCost = d3.mean(chart.data.disasters.raw,
            function(d) {
                return +d.PROPERTY_DAMAGE;
            });

        totalCost = formatNumber(totalCost/3);
        avgCost = formatNumber(avgCost);

        info.totalCost.text('Average Annual Cost of Damage: $' + totalCost);
        info.avgCost.text('Average Cost per Disaster: $' + avgCost);
    }
};


