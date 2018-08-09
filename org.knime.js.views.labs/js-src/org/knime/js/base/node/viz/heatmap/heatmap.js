heatmap_namespace = (function() {
    var heatmap = {};
    var _representation,
        _value,
        _table,
        _imageColumnName,
        _colNames,
        _extent,
        _wrapper,
        _axis,
        _scales,
        _drawCellQueue,
        _tooltip,
        _colorRange;

    // Hardcoded Default Settings
    var _cellSize = 15;
    var _margin = { top: 130, left: 50 };

    // State managment objects
    var defaultViewValues = {
        selectedRowsBuffer: [],
        currentPage: 1,
        zoomEnabled: false,
        paginationEnabled: true,
        selectionEnabled: false,
        showOnlySelectedRows: false,
        currentZoomLevel: {
            x: 0,
            y: 0,
            k: 1
        }
    };

    heatmap.init = function(representation, value) {
        if (!representation.table) {
            //todo: error
            return;
        }

        if (!representation.columns.length) {
            //todo: error
            return;
        }

        // prepare data
        _representation = representation;
        _value = Object.assign(defaultViewValues, value);
        _table = new kt();
        _table.setDataTable(representation.table);
        _imageColumnName = representation.svgLabelColumn;

        // Get valid indexes for heatmap columns by comparing them to input colNames
        _colNames = [];
        var repColNames = _representation.table.spec.colNames;
        _representation.columns.map(function(hmColName) {
            _colNames[repColNames.indexOf(hmColName)] = hmColName;
        });

        // Get min max of all rows
        _extent = getMinMaxFromAllRows(_table.getRows());

        knimeService.subscribeToSelection(_table.getTableId(), onSelectionChange);
        var filterIds = _table.getFilterIds();
        for (var i = 0; i < filterIds.length; i++) {
            knimeService.subscribeToFilter(_table.getTableId(), onFilterChange, filterIds[i]);
        }

        drawControls();

        document.body.insertAdjacentHTML('beforeend', '<div class="knime-layout-container"></div>');

        drawChart();
    };

    heatmap.getComponentValue = function() {
        return _value;
    };

    function onFilterChange(data) {
        // Filter
        var filteredData = _table.getRows().filter(function(row) {
            return _table.isRowIncludedInFilter(row.rowKey, data);
        });
        drawChart(filteredData);
    }

    function onSelectionChange(data) {
        var removed = data.changedSet.removed;
        var added = data.changedSet.added;

        if (added) {
            _value.selectedRowsBuffer.concat(data.changeSet.added);
        }
        if (removed) {
            _value.selectedRowsBuffer.filter(function(rowId) {
                if (removed.indexOf(rowId) > -1) {
                    return false;
                }
                return true;
            });
        }
    }

    function getSelectionData(data) {
        var selectedData;
        if (_value.showOnlySelectedRows) {
            selectedData = data.filter(function(row) {
                return _value.selectedRowsBuffer.indexOf(row.rowKey) > -1;
            });
        }
        if (selectedData && selectedData.length) {
            return selectedData;
        }
        return data;
    }

    /**
     * Draw and re-draw the whole chart
     */
    function drawChart(filteredData) {
        var container = document.querySelector('.knime-layout-container');
        container.innerHTML = '';

        var svgWrapper = '<div class="knime-svg-container"></div>';
        var toolTipWrapper = '<div class="knime-tooltip"></div>';
        var infoWrapperEl = '<div class="info-wrapper"></div>';

        var data = filteredData ? getSelectionData(filteredData) : getSelectionData(_table.getRows());

        container.insertAdjacentHTML('beforeend', svgWrapper + infoWrapperEl + toolTipWrapper);

        // Meta info
        var paginationData = createPagination(data);
        drawMetaInfo(paginationData);

        // Build svg based on the current data
        buildSvg(paginationData.rows);

        // Events
        registerDomEvents();
    }

    function drawMetaInfo(paginationData) {
        var paginationHtml = _representation.enablePaging ? getPaginationHtml(paginationData) : '';
        var displayedRows =
            '<p>Showing ' +
            (paginationData.pageRowStartIndex + 1) +
            ' to ' +
            paginationData.pageRowEndIndex +
            ' of ' +
            paginationData.totalRowCount +
            ' entries</p>';
        document.body.querySelector('.info-wrapper').innerHTML = displayedRows + paginationHtml;
    }

    function updateTitles() {
        var chartTitleEl = document.querySelector('.knime-title');
        chartTitleEl.textContent = _value.chartTitle;
        var subTitleEl = document.querySelector('.knime-subtitle');
        subTitleEl.textContent = _value.subtitle;
    }

    function drawControls() {
        knimeService.allowFullscreen();

        if (_representation.enableTitleChange) {
            var chartTitleText = knimeService.createMenuTextField(
                'chartTitleText',
                _value.chartTitle,
                function() {
                    if (_value.chartTitle != this.value) {
                        _value.chartTitle = this.value;
                        updateTitles();
                    }
                },
                true
            );
            knimeService.addMenuItem('Chart Title:', 'header', chartTitleText);
            var chartSubtitleText = knimeService.createMenuTextField(
                'chartSubtitleText',
                _value.subtitle,
                function() {
                    if (_value.subtitle != this.value) {
                        _value.subtitle = this.value;
                        updateTitles();
                    }
                },
                true
            );
            knimeService.addMenuItem('Chart Subtitle:', 'header', chartSubtitleText, null, knimeService.SMALL_ICON);
        }

        var panButtonClicked = function() {
            _value.zoomEnabled = !_value.zoomEnabled;
            initializeZoom();
            var button = document.getElementById('heatmap-mouse-mode-pan');
            button.classList.toggle('active');
            if (_value.zoomEnabled === true) {
                selectionButtonClicked();
            }
        };
        knimeService.addButton('heatmap-mouse-mode-pan', 'arrows', 'Mouse Mode "Pan"', panButtonClicked);

        knimeService.addMenuDivider();

        if (_representation.enableSelection) {
            var selectionButtonClicked = function() {
                _value.selectionEnabled = !_value.selectionEnabled;
                var button = document.getElementById('heatmap-selection-mode');
                button.classList.toggle('active');
                if (_value.selectionEnabled === true) {
                    panButtonClicked();
                }
            };
            knimeService.addButton(
                'heatmap-selection-mode',
                'check-square-o',
                'Mouse Mode "Select"',
                selectionButtonClicked
            );
            panButtonClicked();
        }

        var displayDataCellToolTip = knimeService.createMenuCheckbox(
            'displayDataCellToolTip',
            _value.displayDataCellToolTip,
            function() {
                _value.displayDataCellToolTip = this.checked;
            }
        );
        knimeService.addMenuItem('Show Tooltips', 'info', displayDataCellToolTip);

        var showOnlySelectedRows = knimeService.createMenuCheckbox(
            'showOnlySelectedRows',
            _value.showOnlySelectedRows,
            function() {
                _value.showOnlySelectedRows = this.checked;
                drawChart();
            }
        );
        knimeService.addMenuItem('Show Selected Rows Only', 'filter', showOnlySelectedRows);

        var enableContinuousGradient = knimeService.createMenuCheckbox(
            'continuousGradient',
            _value.continuousGradient,
            function() {
                _value.continuousGradient = this.checked;
                drawChart();
            }
        );
        knimeService.addMenuItem('Continous Gradient', 'exchange', enableContinuousGradient);

        if (_representation.enablePageSizeChange) {
            var initialPageSize = knimeService.createMenuSelect(
                'initialPageSize',
                _value.initialPageSize,
                _representation.allowedPageSizes,
                function() {
                    _value.initialPageSize = this.value;
                    drawChart();
                }
            );
            knimeService.addMenuItem('Rows per Page', 'table', initialPageSize);
        }
    }

    function getPaginationHtml(pagination) {
        var paginationRange = createPaginationRange(pagination);

        if (paginationRange.length === 0 || !_value.paginationEnabled) {
            return '';
        }
        var html = '<ul class="pagination">';

        if (paginationRange.prev) {
            html += '<li><a href="#' + paginationRange.prev + '">&laquo;</a></li>';
        } else {
            html += '<li class="disabled"><span>&laquo;</span></li>';
        }

        paginationRange.pages.map(function(item) {
            if (item === '...') {
                html += '<li class="disabled"><span>' + item + '</span></li>';
            } else {
                html +=
                    '<li class="' +
                    (_value.currentPage === item ? 'active' : '') +
                    '"><a href="#' +
                    item +
                    '">' +
                    item +
                    '</a></li>';
            }
        });

        if (paginationRange.next) {
            html += '<li><a href="#' + paginationRange.next + '">&raquo;</a></li>';
        } else {
            html += '<li class="disabled"><span>&raquo;</span></li>';
        }
        html += '</ul>';
        return html;
    }

    function registerDomEvents() {
        var pagination = document.body.querySelector('.pagination');
        if (pagination) {
            document.body.querySelector('.pagination').addEventListener('click', function(e) {
                if (e.target.tagName === 'A') {
                    var pageNumber = parseInt(e.target.getAttribute('href').substr(1), 10);
                    _value.currentPage = pageNumber;
                    drawChart();
                }
            });
        }
    }

    function createPaginationRange(pagination) {
        var delta = 2; // number of pages displayed left and right to "center"
        var left = _value.currentPage - delta;
        var right = _value.currentPage + delta + 1;
        var range = [];
        var paginationRange = [];
        var curPage;

        for (var i = 1; i <= pagination.pageCount; i++) {
            if (i == 1 || i == pagination.pageCount || (i >= left && i < right)) {
                range.push(i);
            }
        }

        range.map(function(page) {
            if (curPage) {
                if (page - curPage === delta) {
                    paginationRange.push(page + 1);
                } else if (page - curPage !== 1) {
                    paginationRange.push('...');
                }
            }
            paginationRange.push(page);
            curPage = page;
        });

        return {
            prev: pagination.prev,
            next: pagination.next,
            pages: paginationRange
        };
    }

    /**
     * Create very basic pagination data from rows
     * @param {Array} data
     */
    function createPagination(data) {
        if (!_value.paginationEnabled) {
            return { rows: data };
        }
        var pageCount = Math.ceil(data.length / _value.initialPageSize);

        // jump to page 1 if total number of pages exceeds current page
        _value.currentPage = _value.currentPage <= pageCount ? _value.currentPage : 1;

        var pageRowEndIndex = _value.initialPageSize * _value.currentPage;
        var pageRowStartIndex = _value.initialPageSize * (_value.currentPage - 1);
        var rows = data.slice(pageRowStartIndex, pageRowEndIndex);

        return {
            totalRowCount: data.length,
            rows: rows,
            pageCount: pageCount,
            pageRowEndIndex: pageRowEndIndex > data.length ? data.length : pageRowEndIndex,
            pageRowStartIndex: pageRowStartIndex,
            next: pageRowEndIndex < data.length ? _value.currentPage + 1 : false,
            prev: pageRowStartIndex > 0 ? _value.currentPage - 1 : false
        };
    }

    function getMinMaxFromAllRows(allRows) {
        return allRows.reduce(
            function(accumulator, row) {
                var rowMaxMin = row.data.reduce(
                    function(rowAcc, currentValue, currentIndex) {
                        if (_colNames[currentIndex] === undefined) {
                            return rowAcc;
                        }
                        if (currentValue === null) {
                            return rowAcc;
                        }
                        rowAcc.minimum = Math.min(rowAcc.minimum, currentValue);
                        rowAcc.maximum = Math.max(rowAcc.maximum, currentValue);
                        return rowAcc;
                    },
                    {
                        minimum: accumulator.minimum,
                        maximum: accumulator.maximum
                    }
                );

                accumulator.minimum = Math.min(accumulator.minimum, rowMaxMin.minimum);
                accumulator.maximum = Math.max(accumulator.maximum, rowMaxMin.maximum);
                return accumulator;
            },
            {
                minimum: Number.POSITIVE_INFINITY,
                maximum: Number.NEGATIVE_INFINITY
            }
        );
    }

    function formatPageData(rows) {
        var images = [];
        var rowNames = [];

        var allValues = rows.reduce(function(accumulator, row) {
            rowNames.push(row.rowKey);
            var rowIsSelected = _value.selectedRowsBuffer.indexOf(row.rowKey) > -1;

            // Storing images in an separate array is enough
            if (_imageColumnName) {
                images[row.rowKey] = _table.getCell(row.rowKey, _imageColumnName);
            }

            // Set values for each cell
            var vals = row.data.reduce(function(rowAcc, value, currentIndex) {
                if (_colNames[currentIndex] === undefined) {
                    return rowAcc;
                }
                var newItem = {};
                newItem.y = row.rowKey;
                newItem.x = _colNames[currentIndex];
                newItem.value = value;
                newItem.initallySelected = rowIsSelected;

                rowAcc.push(newItem);
                return rowAcc;
            }, []);
            return accumulator.concat(vals);
        }, []);

        return {
            images: images,
            data: allValues,
            rowNames: rowNames
        };
    }

    function getLinearColorDomain(minimum, maximum) {
        var domain = [];
        var interpolator = d3.interpolateNumber(minimum, maximum);
        for (var i = 0; i < _colorRange.length; i++) {
            domain.push(interpolator(i / (_colorRange.length - 1)));
        }
        return domain;
    }

    function createScales(formattedDataset) {
        return {
            x: d3
                .scaleBand()
                .domain(_colNames)
                .range([_margin.left, _colNames.length * _cellSize - 1 + _margin.left]),
            y: d3
                .scaleBand()
                .domain(formattedDataset.rowNames)
                .range([_margin.top, formattedDataset.rowNames.length * _cellSize - 1 + _margin.top]),
            colorScale: _value.continuousGradient
                ? d3
                      .scaleLinear()
                      .domain(getLinearColorDomain(_extent.minimum, _extent.maximum))
                      .range(_colorRange)
                : d3
                      .scaleQuantize()
                      .domain([_extent.minimum, _extent.maximum])
                      .range(_colorRange)
        };
    }

    function createAxis() {
        return {
            x: d3.axisTop(_scales.x).tickFormat(function(d) {
                return d;
            }),

            y: d3.axisLeft(_scales.y).tickFormat(function(d) {
                return d;
            })
        };
    }

    function formatImage(string) {
        return 'data:image/svg+xml;base64,' + btoa(string);
    }

    function initializeZoom() {
        var svgD3 = d3.select('.knime-svg-container  svg');

        var xAxisD3El = svgD3.select('.knime-axis.knime-x');
        var yAxisD3El = svgD3.select('.knime-axis.knime-y');

        // Zoom and pan
        var zoom = d3
            .zoom()
            .scaleExtent([0, 1])
            .on('zoom', function() {
                var t = d3.event.transform;

                // Limit zoom
                t.x = d3.min([t.x, (1 - t.k) * _margin.left]);
                t.y = d3.min([t.y, (1 - t.k) * _margin.top]);

                // Save current zoom level
                _value.currentZoomLevel = t;

                xAxisD3El.attr('transform', 'translate(' + t.x + ', ' + _margin.top + ') scale(' + t.k + ')');
                yAxisD3El.attr('transform', 'translate(' + _margin.left + ', ' + t.y + ') scale(' + t.k + ')');

                _wrapper.attr('transform', t);
            });

        if (_value.zoomEnabled) {
            svgD3.call(zoom);
        } else {
            svgD3.on('.zoom', null);
        }
        return zoom;
    }

    function showTooltip(e, innerHtml) {
        if (!_value.displayDataCellToolTip && innerHtml) {
            return;
        }
        _tooltip.classList.add('active');
        e.target.classList.add('active');
        _tooltip.innerHTML = innerHtml;
        _tooltip.style.left = event.clientX + _cellSize + 'px';
        _tooltip.style.top = event.clientY - _cellSize + 'px';
    }

    function hideTooltip() {
        _tooltip.classList.remove('active');
    }

    function drawCell(cell) {
        _wrapper
            .data([cell])
            .append('g')
            .append('rect')
            .attr('class', 'cell')
            .attr('width', _cellSize - 1)
            .attr('height', _cellSize - 1)
            .attr('y', function(d) {
                return _scales.y(d.y);
            })
            .attr('x', function(d) {
                return _scales.x(d.x);
            })
            .attr('fill', function(d) {
                if (d.value === null) {
                    return _representation.missingValueColor;
                }
                return _scales.colorScale(d.value);
            })
            .attr('selection', function(d) {
                //initialize selection if already selected
                return d.initallySelected ? 'active' : 'inactive';
            });
    }

    function prioritizeCells(viewportSize, data) {
        var priorityCells = [];
        var delayedCells = [];
        var rowItemsWidth = 0;
        var currentRowKey = data[0].y;

        data.forEach(function(cell) {
            rowItemsWidth = rowItemsWidth + _cellSize * _value.currentZoomLevel.k;
            if (cell.y == currentRowKey) {
                if (rowItemsWidth < viewportSize.width - _value.currentZoomLevel.x) {
                    priorityCells.push(cell);
                } else {
                    delayedCells.push(cell);
                }
            } else {
                rowItemsWidth = 0;
                currentRowKey = cell.y;
                priorityCells.push(cell);
            }
        });
        return {
            priorityCells: priorityCells,
            delayedCells: delayedCells
        };
    }

    function buildSvg(rows) {
        if (_drawCellQueue) {
            _drawCellQueue.invalidate();
        }

        var formattedDataset = formatPageData(rows);
        _colorRange = _value.continuousGradient
            ? _representation.threeColorGradient
            : _representation.discreteGradientColors;

        _tooltip = document.querySelector('.knime-tooltip');
        _scales = createScales(formattedDataset);
        _axis = createAxis();

        var svg = d3
            .select('.knime-svg-container')
            .append('svg')
            .attr('class', 'heatmap');

        var defs = svg.append('defs');
        var clipPath = defs
            .append('clipPath')
            .attr('id', 'clip')
            .append('rect')
            .attr('y', _margin.top)
            .attr('x', _margin.left)
            .attr('width', '100%')
            .attr('height', '100%');

        var viewport = svg
            .append('g')
            .attr('class', 'viewport')
            .attr('clip-path', 'url(#clip)');

        _wrapper = viewport.append('g').attr('class', 'wrapper');

        // Improve performance: render cells progressivley
        var viewportSize = clipPath.node().getBoundingClientRect();
        var sortedData = prioritizeCells(viewportSize, formattedDataset.data);
        _drawCellQueue = renderQueue(drawCell).rate(250);
        _drawCellQueue(sortedData.priorityCells);
        _drawCellQueue.add(sortedData.delayedCells);

        // Events for the svg are native js event listeners not
        // d3 event listeners for better performance
        var domWrapper = document.querySelector('.knime-svg-container svg .wrapper');

        // Highlight mouseover cell and show tooltip
        domWrapper.addEventListener('mouseover', function(e) {
            if (!e.target.classList.contains('cell')) {
                return;
            }

            var data = d3.select(e.target).data()[0];

            toolTipInnerHTML =
                '<span class="knime-tooltip-caption">x:' +
                data.x +
                ' y:' +
                data.y +
                '</span><span class="knime-tooltip-value">' +
                (data.value === null
                    ? '<span class="missing-value">?</span>'
                    : '<span class="knime-double">' + data.value + '</span>') +
                '</span>';

            showTooltip(e, toolTipInnerHTML);
        });

        // Deactivation relies on gaps in the wrapper between the cells
        domWrapper.addEventListener('mouseout', function(e) {
            hideTooltip();
            e.target.classList.remove('active');
        });

        // Row selection
        domWrapper.addEventListener('mousedown', function(e) {
            if (e.target.tagName !== 'rect') {
                return;
            }
            var data = d3.select(e.target).data()[0];
            if (e.shiftKey) {
                return selectDeltaRow(data.y, formattedDataset);
            }
            if (event.ctrlKey || event.metaKey) {
                return selectSingleRow(data.y, true);
            }
            return selectSingleRow(data.y);
        });

        // Append axis
        var maskAxis = defs.append('mask').attr('id', 'maskAxis');
        maskAxis
            .append('rect')
            .attr('y', 0)
            .attr('x', 0)
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('fill', 'white');
        maskAxis
            .append('rect')
            .attr('y', 0)
            .attr('x', 0)
            .attr('width', _margin.left + 1)
            .attr('height', _margin.top + 1)
            .attr('fill', 'black');

        var axisWrapper = svg
            .append('g')
            .attr('class', 'axisWrapper')
            .attr('mask', 'url(#maskAxis)');
        axisWrapper
            .append('g')
            .attr('class', 'knime-axis knime-y')
            .call(_axis.y)
            .selectAll('text')
            .attr('font-weight', 'normal')
            .on('mouseover', function(d) {
                if (!formattedDataset.images[d]) {
                    return;
                }
                d3.event.target.classList.add('active');
                tooltipInnerHTML = '<img src="' + formatImage(formattedDataset.images[d]) + '" alt/>';
                showTooltip(d3.event, tooltipInnerHTML);
            })
            .on('mouseleave', function() {
                hideTooltip();
                d3.event.target.classList.remove('active');
            });

        axisWrapper
            .append('g')
            .attr('class', 'knime-axis knime-x')
            .call(_axis.x)
            .selectAll('text')
            .attr('font-weight', 'normal')
            .style('text-anchor', 'start')
            .attr('dx', '1rem')
            .attr('dy', '.5rem')
            .attr('transform', function(d) {
                return 'rotate(-65)';
            });

        // general tick styling
        var ticks = axisWrapper.selectAll('.tick').attr('class', 'knime-tick');
        ticks.select('text').attr('class', 'knime-tick-label');
        ticks.select('line').attr('class', 'knime-tick-line');

        axisWrapper
            .selectAll('.knime-axis.knime-y .knime-tick')
            .attr('class', function(d) {
                if (_value.selectedRowsBuffer.indexOf(d) > -1) {
                    return 'knime-tick active';
                } else {
                    return 'knime-tick';
                }
            })
            .attr('data-id', function(d) {
                return d;
            })
            .on('click', function(d) {
                selectSingleRow(d);
            });

        // Initialize zoom
        var zoom = initializeZoom();
        resetZoom(zoom);

        // Create titles
        svg.append('text')
            .attr('class', 'knime-title')
            .attr('x', _margin.left)
            .attr('y', 30)
            .text(_value.chartTitle);
        svg.append('text')
            .attr('class', 'knime-subtitle')
            .attr('x', _margin.left)
            .attr('y', 50)
            .text(_value.subtitle);

        // Legend
        var legendWidth = 100;
        var legendHeight = 50;
        var legendColorRangeHeight = 25;
        var legendMargin = 5;

        var legend = d3
            .select('.info-wrapper')
            .append('svg')
            .attr('class', 'knime-legend')
            .attr('width', legendWidth + 2 * legendMargin)
            .attr('height', legendHeight + 2 * legendMargin);

        var legendDefs = legend.append('defs');
        var legendGradient = legendDefs.append('linearGradient').attr('id', 'legendGradient');

        var colorDomain = getLinearColorDomain(_extent.minimum, _extent.maximum);

        // append a single rect to display a gradient
        legend
            .append('rect')
            .attr('y', 0)
            .attr('x', legendMargin)
            .attr('width', legendWidth)
            .attr('height', legendColorRangeHeight)
            .attr('right', legendMargin)
            .attr('fill', 'url(#legendGradient)');

        // set gradient stops
        if (_value.continuousGradient) {
            for (var i = 0; i < colorDomain.length; i++) {
                var percentage = (100 / (colorDomain.length - 1)) * i;
                legendGradient
                    .append('stop')
                    .attr('offset', percentage + '%')
                    .attr('style', 'stop-opacity:1; stop-color:' + _scales.colorScale(colorDomain[i]));
            }
        } else if (!_value.continuousGradient) {
            var legendCellPercentage = 100 / colorDomain.length;
            var previousPercentage = 0;
            var interpolator = d3.interpolateNumber(_extent.minimum, _extent.maximum);
            var tickValues = [];
            tickValues.push(_extent.minimum, _extent.maximum);

            for (var i = 0; i < colorDomain.length; i++) {
                var currentPercentage = legendCellPercentage * (i + 1);

                tickValues.push(interpolator(currentPercentage / 100));

                legendGradient
                    .append('stop')
                    .attr('offset', previousPercentage + '%')
                    .attr('style', 'stop-opacity:1; stop-color:' + _scales.colorScale(colorDomain[i]));
                legendGradient
                    .append('stop')
                    .attr('offset', currentPercentage + '%')
                    .attr('style', 'stop-opacity:1; stop-color:' + _scales.colorScale(colorDomain[i]));
                previousPercentage = currentPercentage;
            }
        }

        var legendScale = d3
            .scaleLinear()
            .domain([_extent.minimum, _extent.maximum])
            .range([0, legendWidth]);

        var legendAxis = d3
            .axisBottom(legendScale)
            .tickValues(tickValues || colorDomain)
            .tickFormat(function(d) {
                return Math.round(d * 100) / 100;
            });

        legend
            .append('g')
            .attr('transform', 'translate(' + legendMargin + ', ' + legendColorRangeHeight + ')')
            .attr('class', 'legend-axis')
            .call(legendAxis)
            .selectAll('text')
            .attr('font-weight', 'normal');
    }

    function resetZoom(zoom) {
        var svg = d3.select('.knime-svg-container svg');
        zoom.transform(svg, function() {
            return d3.zoomIdentity
                .translate(_value.currentZoomLevel.x, _value.currentZoomLevel.y)
                .scale(_value.currentZoomLevel.k);
        });
    }

    function selectDeltaRow(selectedRowId, formattedDataset) {
        // Get closest selected row to newly selected row
        var currentIndex = formattedDataset.rowNames.indexOf(selectedRowId);
        var closestRow = _value.selectedRowsBuffer.reduce(
            function(closestRow, rowId) {
                var rowIdIndex = formattedDataset.rowNames.indexOf(rowId);
                var indexDistance = Math.abs(currentIndex - rowIdIndex);
                if (indexDistance < closestRow.distance) {
                    return {
                        distance: indexDistance,
                        index: rowIdIndex
                    };
                }
                return closestRow;
            },
            {
                distance: Number.POSITIVE_INFINITY,
                index: Number.POSITIVE_INFINITY
            }
        );

        var startIndex = Math.min(closestRow.index, currentIndex);
        var endIndex = Math.max(closestRow.index, currentIndex);
        var rowKey;
        for (var i = startIndex; i <= endIndex; i++) {
            rowKey = formattedDataset.rowNames[i];
            styleSelectedRow(rowKey, true);
            if (!_value.selectedRowsBuffer.indexOf(rowKey) > -1) {
                _value.selectedRowsBuffer.push(rowKey);
            }
        }

        var tableId = _table.getTableId();

        knimeService.setSelectedRows(tableId, _value.selectedRowsBuffer);
    }

    function selectSingleRow(selectedRowId, keepCurrentSelections) {
        if (!_value.selectionEnabled) {
            return;
        }

        // Cast optional parameter to boolean
        keepCurrentSelections = !!keepCurrentSelections;

        var tableId = _table.getTableId();

        if (!keepCurrentSelections) {
            // Remove all selections
            _value.selectedRowsBuffer = [];
            knimeService.setSelectedRows(tableId, []);
            styleSelectedRow();
        }

        if (_value.selectedRowsBuffer.indexOf(selectedRowId) != -1) {
            styleSelectedRow(selectedRowId, false);
            _value.selectedRowsBuffer = _value.selectedRowsBuffer.filter(function(rowId) {
                return rowId !== selectedRowId;
            });
            knimeService.removeRowsFromSelection(tableId, [selectedRowId]);
        } else {
            styleSelectedRow(selectedRowId, true);
            _value.selectedRowsBuffer.push(selectedRowId);
            knimeService.addRowsToSelection(tableId, [selectedRowId]);
        }

        if (_value.showOnlySelectedRows) {
            drawChart();
        }
    }

    function styleSelectedRow(selectedRowId, selected) {
        // If no selectedRowId is given, only reset everything
        if (!selectedRowId) {
            d3.selectAll('.knime-axis.knime-y .knime-tick').attr('class', 'knime-tick');
            d3.selectAll('.cell').attr('selection', 'inactive');
            return;
        }

        // Style row labels
        if (selected) {
            d3.select('[data-id="' + selectedRowId + '"]').attr('class', 'knime-tick active');
        } else {
            d3.select('[data-id="' + selectedRowId + '"]').attr('class', 'knime-tick');
        }

        // Style row cells
        d3.selectAll('.cell').attr('selection', function(d) {
            if (selected && d.y === selectedRowId) {
                return 'active';
            }
            if (!selected && d.y === selectedRowId) {
                return 'inactive';
            }
            // else return current state
            return d3.select(this).attr('selection');
        });
    }

    heatmap.getSVG = function() {
        var svgElement = d3.select('svg')[0][0];
        knimeService.inlineSvgStyles(svgElement);

        // Return the SVG as a string.
        return new XMLSerializer().serializeToString(svgElement);
    };

    return heatmap;
})();
