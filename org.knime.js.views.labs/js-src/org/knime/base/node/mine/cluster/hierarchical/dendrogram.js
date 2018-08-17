window.dendrogram_namespace = (function () {
    const dendrogram = {};

    var _representation,
        _value,
        table,
        selectedRows = [],
        filteredRows = [];

    // view related settings
    const xAxisHeight = 100,
        yAxisWidth = 40,
        labelMargin = 10,
        xAxisLabelWidth = 15,
        linkStrokeWidth = 1,
        clusterMarkerRadius = 4,
        viewportMarginTop = 10,
        leafWidth = 8,
        leafHeight = 20,
        thresholdHandleHeight = 2,
        thresholdFormat = d3.format('.3f');

    // hierarchy related variables
    var cluster,
        nodes,
        leaves,
        links;

    // view related variables
    var svg,
        svgSize,
        viewportWidth,
        viewportHeight,
        viewportClipEl,
        xAxisClipEl,
        titleEl,
        subtitleEl,
        dendrogramEl,
        clusterMarkerEl,
        leafEl,
        linkEl,
        thresholdEl,
        thresholdDisplayEl,
        thresholdClusterDisplayEl,
        xAxis,
        xAxisEl,
        xScale,
        xShowNthTicks,
        xEllipsisNthTick,
        yAxis,
        yAxisEl,
        yScale,
        zoom;

    dendrogram.init = function (representation, value) {
        _representation = representation;
        _value = value;

        if (!_representation.tree || !_representation.tree.root) {
            if (_representation.showWarningsInView) {
                d3.select('body').append('p').text('Error: No data available');
            }
            return;
        }

        table = new kt();
        table.setDataTable(_representation.table);

        drawControls();

        drawSVG();
        drawTitle();
        createHierarchyFromTree();
        drawXAxis();
        drawYAxis();
        drawDendrogram();
        drawThresholdHandle();

        initZoomingAndPanning();

        resizeDiagram();

        if (_representation.enableSelection) {
            initSelection();
        }

        if (_representation.subscribeFilterEvents) {
            initFiltering();
        }

        if (_representation.resizeToWindow) {
            initWindowResize();
        }
    };

    const drawControls = function () {
        if (_representation.displayFullscreenButton) {
            knimeService.allowFullscreen();
        }

        if (_representation.enableTitleEdit) {
            knimeService.addMenuItem('Chart Title:', 'header', knimeService.createMenuTextField(
                'chartTitleText', _value.title, function () {
                    if (_value.title != this.value) {
                        _value.title = this.value;
                        updateTitle();
                    }
                }, true));

            knimeService.addMenuItem('Chart Subtitle:', 'header', knimeService.createMenuTextField(
                'chartSubtitleText', _value.subtitle, function () {
                    if (_value.subtitle != this.value) {
                        _value.subtitle = this.value;
                        updateTitle();
                    }
                }, true));
        }

        if (_representation.enableZoom && _representation.showZoomResetButton) {
            knimeService.addButton('zoom-reset-button', 'search-minus', 'Reset Zoom', function () {
                resetZoom();
            });
        }

        if (_representation.enableSelection) {
            knimeService.addButton('selection-reset-button', 'minus-square-o', 'Reset Selection', function () {
                clearSelection();
            });
        }

        /*
        knimeService.addMenuDivider();

        knimeService.addMenuItem('Show Filtered Rows Only', 'filter', knimeService.createMenuCheckbox(
            'showOnlySelectedRows',
            _value.showOnlySelectedRows,
            function () {
                _value.showOnlySelectedRows = this.checked;
            }
        ));
        */
    };

    const calcSVGSize = function () {
        svgSize = d3.select('svg').node().getClientRects()[0];
        viewportWidth = svgSize.width - yAxisWidth;
        viewportHeight = svgSize.height - xAxisHeight;
    };

    const drawSVG = function () {
        d3.select('html').style('width', '100%').style('height', '100%');
        d3.select('body').style('width', '100%').style('height', '100%');

        const resizeToWindow = _representation.runningInView && _representation.resizeToWindow;

        // create SVG
        svg = d3.select('body').insert('svg:svg')
            .attr('width', resizeToWindow ? '100%' : _representation.imageWidth)
            .attr('height', resizeToWindow ? '100%' : _representation.imageHeight);

        if (_representation.runningInView) {
            // tag element for iframe resizer
            svg.attr('data-iframe-width', '').attr('data-iframe-height', '');
        }

        calcSVGSize();

        // create clipping path for viewport (needed for zooming & panning)
        const defs = svg.append('defs');
        viewportClipEl = defs.append('clipPath')
            .attr('id', 'viewportClip')
            .append('rect');

        xAxisClipEl = defs.append('clipPath')
            .attr('id', 'xAxisClip')
            .append('rect')
            .attr('height', xAxisHeight);

        dendrogramEl = svg.append('g').attr('class', 'viewport').attr('transform', 'translate(' + yAxisWidth + ',0)')
            .append('g').attr('transform', 'translate(0,' + viewportMarginTop + ')')
            .append('g');

    };

    const createHierarchyFromTree = function () {
        // load data into d3 hierarchy representation
        nodes = d3.hierarchy(_representation.tree.root);
        cluster = d3.cluster().separation(function () {
            return 1;
        });
        links = nodes.links();
        leaves = nodes.leaves();
    };

    const drawXAxis = function () {
        const labels = leaves.map(function (n) { return n.data.rowKey; });
        xScale = d3.scaleBand()
            .domain(labels);
        xAxis = d3.axisBottom(xScale);
        xAxis.tickFormat(function (d, i) {
            // show ellipsis if not all labels are shown
            const showEllipsis = !!(i % xEllipsisNthTick);
            d3.select(this.parentNode).classed('ellipsis', showEllipsis);
            return showEllipsis ? '…' : d;
        });
        xAxisEl = svg.append('g')
            .attr('class', 'knime-axis knime-x')
            .on('click', function () { // register event listener on container to also catch dynamically added labels
                if (d3.event.target.nodeName === 'text') {
                    var rowKey = d3.event.target.__data__;
                    toggleSelectRow(rowKey);
                }
            });
    };

    const updateXAxis = function (transformEvent) {
        // prevent overlapping labels by removing some if there is not enough space to show all
        const scale = transformEvent ? transformEvent.k : 1;
        xShowNthTicks = Math.round(xScale.domain().length / (viewportWidth * scale / (xAxisLabelWidth + 2)));
        xEllipsisNthTick = xShowNthTicks <= 1 ? 0 : 2;
        xAxis.tickValues(xScale.domain().filter(function (d, i) { return !(i % xShowNthTicks); }));
        xScale.range([0, viewportWidth].map(function (d) { return transformEvent ? d3.event.transform.applyX(d) : d; }));
        xAxisEl.call(xAxis);

        // apply knime classes
        const isFiltering = !!filteredRows.length;
        const xTickEls = xAxisEl.selectAll('.tick').classed('knime-tick', true)
            .classed('selected', function (rowKey) {
                return selectedRows.indexOf(rowKey) !== -1;
            }).classed('outOfFilter', function (rowKey) {
                return isFiltering && !(filteredRows.indexOf(rowKey) !== -1);
            });
        xTickEls.selectAll('line').classed('knime-tick-line', true);
        xTickEls.selectAll('text').classed('knime-tick-label', true)
            .attr('dx', labelMargin * -1 + 'px')
            .attr('dy', '-5px');
    };

    const drawYAxis = function () {
        const maxDistance = nodes.data.distance;
        yScale = d3.scaleLinear()
            .domain([0, maxDistance])
            .nice();
        yAxis = d3.axisLeft(yScale)
            .ticks(5);
        yAxisEl = svg.append('g')
            .attr('class', 'knime-axis knime-y')
            .attr('transform', 'translate(' + yAxisWidth + ',' + viewportMarginTop + ')');

        // apply the distance of each node
        nodes.each(function (n) {
            n.y = yScale(n.data.distance);
        });
    };

    const updateYAxis = function (transformEvent) {
        yScale.range([viewportHeight, 0]);
        if (transformEvent) {
            yAxis.scale(transformEvent.rescaleY(yScale));
        }
        yAxisEl.call(yAxis);

        // apply knime classes
        const yTickEls = yAxisEl.selectAll('.tick').classed('knime-tick', true);
        yTickEls.selectAll('line').classed('knime-tick-line', true);
        yTickEls.selectAll('text').classed('knime-tick-label', true);
    };

    const drawDendrogram = function () {
        // draw links
        linkEl = dendrogramEl.selectAll('.link').data(links).enter().append('path').attr('class', 'link')
            .attr('stroke-width', linkStrokeWidth);

        // draw leaves
        leafEl = dendrogramEl.selectAll('.leaf').data(leaves).enter().append('rect').attr('class', 'leaf')
            .attr('x', -leafWidth / 2)
            .attr('y', -leafHeight).attr('width', leafWidth)
            .attr('height', leafHeight)
            .attr('fill', function (d) {
                return d.data.color;
            });

        // draw cluster markers
        clusterMarkerEl = dendrogramEl.selectAll('.cluster').data(nodes.descendants().filter(function (n) {
            return n.children != null;
        })).enter().append('circle').attr('class', 'cluster').attr('r', clusterMarkerRadius);
        clusterMarkerEl.append('title').text(function (d) {
            return 'Cluster ' + d.data.id + '; Distance: ' + d.data.distance;
        });
        dendrogramEl.on('click', function () { // make use of event bubbling and only register one listener
            if (d3.event.target.nodeName === 'circle') {
                toggleSelectCluster(d3.event.target.__data__);
            } else if (d3.event.target.nodeName === 'rect') {
                toggleSelectRow(d3.event.target.__data__.data.rowKey);
            }
        });
    };

    const drawTitle = function () {
        titleEl = svg.append('text')
            .attr('id', 'title')
            .attr('class', 'knime-title')
            .attr('x', 180)
            .attr('y', 30)
            .text(_value.title);

        subtitleEl = svg.append('text')
            .attr('id', 'subtitle')
            .attr('class', 'knime-subtitle')
            .attr('x', 180)
            .attr('y', 46)
            .text(_value.subtitle);
    };

    const updateTitle = function () {
        titleEl.text(_value.title);
        subtitleEl.text(_value.subtitle);
    };

    const drawThresholdHandle = function () {
        const maxDistance = yScale.domain()[1];

        thresholdEl = dendrogramEl.append('rect').attr('class', 'threshold')
            .attr('width', '100%').attr('height', thresholdHandleHeight)
            .call(d3.drag()
                .on('drag', function () {
                    // abort if dragged outside min or max distance
                    var newThreshold = yScale.invert(d3.event.y);
                    if (newThreshold <= 0 || newThreshold >= maxDistance) {
                        return false;
                    }

                    // move threshold handle
                    thresholdEl.attr('transform', 'translate(0,' + d3.event.y + ')');

                    onThresholdChange(newThreshold);

                    // save new threshold
                    _value.threshold = newThreshold;
                }));

        thresholdDisplayEl = svg.append('text').attr('class', 'thresholdDisplay')
            .attr('transform', 'translate(' + (yAxisWidth + 5) + ' ,' + 25 + ')');

        thresholdClusterDisplayEl = svg.append('text').attr('class', 'thresholdClusterDisplay')
            .attr('transform', 'translate(' + (yAxisWidth + 5) + ' ,' + 40 + ')');

        // set initial threshold
        onThresholdChange(_value.threshold);

        if (_representation.runningInView) {
            svg.classed('thresholdEnabled', true);
        }
    };

    const onThresholdChange = function (threshold) {
        var numberOfRootCluster = 0;
        clusterMarkerEl.each(function (n) {
            const isRoot = n.data.distance <= threshold && (!n.parent || n.parent && n.parent.data.distance >= threshold);
            if (isRoot) {
                numberOfRootCluster++;
            }

            // mark nodes out of threshold and after-threshold root nodes
            d3.select(this)
                .classed('outOfThreshold', n.data.distance >= threshold)
                .classed('root', isRoot);
        });

        // count all leaves which represent a single cluster
        leaves.forEach(function (leaf) {
            if (leaf.parent.data.distance >= threshold) {
                numberOfRootCluster++;
            }
        });

        // update threshold display
        const thresholdFormatted = thresholdFormat(threshold);
        thresholdDisplayEl.text('Threshold: ' + thresholdFormatted);
        thresholdClusterDisplayEl.text('Cluster: ' + numberOfRootCluster);
        // mark links
        linkEl.each(function (n) {
            d3.select(this).classed('outOfThreshold', n.source.data.distance >= threshold);
        });
    };

    const resizeDiagram = function () {
        calcSVGSize();

        viewportClipEl.attr('width', viewportWidth)
            .attr('height', viewportHeight + viewportMarginTop);

        xAxisClipEl.attr('width', viewportWidth + yAxisWidth);

        // recalculate cluster
        cluster.size([viewportWidth, viewportHeight - viewportMarginTop]);
        cluster(nodes);

        // update axis
        xAxisEl.attr('transform', 'translate(' + yAxisWidth + ',' + (viewportHeight + viewportMarginTop) + ')');
        updateXAxis();
        updateYAxis();

        // apply the distance of each node
        nodes.each(function (n) {
            n.y = yScale(n.data.distance);
        });

        // re-position elements
        linkEl.attr('d', function (l) {
            return 'M' + l.source.x + ' ' + l.source.y + ' L' + l.target.x + ' ' + l.source.y + ' L' + l.target.x + ' ' + l.target.y;
        });

        leafEl.attr('transform', function (d) {
            return 'translate(' + d.x + ',' + d.y + ')';
        });

        clusterMarkerEl.attr('transform', function (d) {
            return 'translate(' + d.x + ',' + d.y + ')';
        });

        thresholdEl.attr('transform', 'translate(0,' + yScale(_value.threshold) + ')');

        zoom.translateExtent([[0, 0], [viewportWidth, viewportHeight]]);
        zoom.extent([[0, 0], [viewportWidth, viewportHeight]]);
        svg.call(zoom).on('dblclick.zoom', null); // prevent zoom on double click

        // zoom out? TODO maybe there is a smarter behaviour here
        resetZoom();
    };

    const initWindowResize = function () {
        const debounce = function (func, delay) {
            var timeout;
            return function () {
                const context = this, args = arguments;
                clearTimeout(timeout);
                timeout = setTimeout(function () {
                    timeout = null;
                    func.apply(context, args);
                }, delay);
            };
        };
        d3.select(window).on('resize', debounce(resizeDiagram, 75));
    };

    const initZoomingAndPanning = function () {
        zoom = d3.zoom()
            .translateExtent([[0, 0], [viewportWidth, viewportHeight]])
            .extent([[0, 0], [viewportWidth, viewportHeight]])
            .on('zoom', function () {
                dendrogramEl.attr('transform', d3.event.transform);

                updateXAxis(d3.event.transform);
                updateYAxis(d3.event.transform);

                // rescale line widths and markers
                linkEl.attr('stroke-width', linkStrokeWidth / d3.event.transform.k);
                clusterMarkerEl.attr('r', clusterMarkerRadius / d3.event.transform.k);
                leafEl.attr('width', leafWidth / d3.event.transform.k)
                    .attr('height', leafHeight / d3.event.transform.k)
                    .attr('x', -(leafWidth / d3.event.transform.k) / 2)
                    .attr('y', -(leafHeight / d3.event.transform.k));
                thresholdEl.attr('height', thresholdHandleHeight / d3.event.transform.k);

                // save zoom and pan
                _value.zoomx = d3.event.transform.x;
                _value.zoomy = d3.event.transform.y;
                _value.zoomk = d3.event.transform.k;
            });

        const zoomX = _value.zoomx !== undefined ? _value.zoomx : 0;
        const zoomY = _value.zoomy !== undefined ? _value.zoomy : 0;
        const zoomK = _value.zoomk !== undefined ? _value.zoomk : 1;
        if (_representation.enableZoom) {
            zoom.scaleExtent([1, Infinity]);
        } else {
            zoom.scaleExtent([zoomK, zoomK]);
        }

        svg.call(zoom)
            .on('dblclick.zoom', null); // prevent zoom on double click

        // set initial zoom and pan
        setTimeout(function () {
            svg.call(zoom.transform, d3.zoomIdentity.translate(zoomX, zoomY).scale(zoomK));
        }, 0);
    };

    const resetZoom = function () {
        svg.transition()
            .duration(750)
            .call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(1));
    };

    const updateSelectionInView = function () {
        // add selected flag for leaves
        leaves.forEach(function (n) {
            n.selected = selectedRows.indexOf(n.data.rowKey) !== -1;
        });

        // also select cluster if both children are selected
        nodes.eachAfter(function (n) {
            if (n.children) {
                n.selected = n.children[0].selected && n.children[1].selected;
            }
        });

        // set/remove styles for selected rows and cluster and links
        clusterMarkerEl.classed('selected', function (d) {
            return d.selected;
        });
        linkEl.classed('selected', function (d) {
            return (d.source.selected && d.target.selected) || d.target.selected && !d.target.children;
        });
        xAxisEl.selectAll('.tick').classed('selected', function (rowKey) {
            return selectedRows.indexOf(rowKey) !== -1;
        });
    };

    const onSelectionChange = function (data) {
        if (data.changeSet.removed) {
            selectedRows = selectedRows.filter(function (item) {
                return data.changeSet.removed.indexOf(item) === -1;
            });
        }
        if (data.changeSet.added) {
            data.changeSet.added.forEach(function (item) {
                if (selectedRows.indexOf(item) === -1) {
                    selectedRows.push(item);
                }
            });
        }

        updateSelectionInView();
    };

    const toggleSelectRow = function (rowKey) {
        if (filteredRows.length && filteredRows.indexOf(rowKey) === -1) {
            // abort if row is filtered out
            return;
        }
        const select = selectedRows.indexOf(rowKey) === -1 ? true : false;
        const multiSelect = d3.event.ctrlKey || d3.event.shiftKey || d3.event.metaKey;

        if (select) {
            if (multiSelect) {
                if (selectedRows.indexOf(rowKey) === -1) {
                    selectedRows.push(rowKey);
                }
            } else {
                selectedRows = [rowKey];
            }
        } else {
            if (multiSelect) {
                selectedRows = selectedRows.filter(function (item) {
                    return item !== rowKey;
                });
            } else {
                selectedRows = [rowKey];
            }
        }

        updateSelectionInView();
        if (_representation.publishSelectionEvents) {
            knimeService.setSelectedRows(table.getTableId(), selectedRows, onSelectionChange);
        }
    };

    const toggleSelectCluster = function (clusterNode) {
        if (clusterNode.outOfFilter) {
            // abort if cluster is filtered out
            return;
        }
        const select = !clusterNode.selected;
        const multiSelect = d3.event.ctrlKey || d3.event.shiftKey || d3.event.metaKey;

        const leaves = clusterNode.leaves();
        const rowsToSelect = leaves.map(function (leaf) { return leaf.data.rowKey; });
        if (select) {
            if (multiSelect) {
                rowsToSelect.forEach(function (rowKey) {
                    if (selectedRows.indexOf(rowKey) === -1) {
                        selectedRows.push(rowKey);
                    }
                });
            } else {
                selectedRows = rowsToSelect;
            }
        } else {
            if (multiSelect) {
                selectedRows = selectedRows.filter(function (item) {
                    return rowsToSelect.indexOf(item) === -1;
                });
            } else {
                selectedRows = selectedRows.filter(function (item) {
                    return rowsToSelect.indexOf(item) !== -1;
                });
            }
        }

        updateSelectionInView();
        if (_representation.publishSelectionEvents) {
            knimeService.setSelectedRows(table.getTableId(), selectedRows, onSelectionChange);
        }
    };

    const clearSelection = function () {
        selectedRows = [];
        updateSelectionInView();

        if (_representation.publishSelectionEvents) {
            knimeService.setSelectedRows(table.getTableId(), selectedRows, onSelectionChange);
        }
    };

    const initSelection = function () {
        if (_representation.subscribeSelectionEvents) {
            knimeService.subscribeToSelection(table.getTableId(), onSelectionChange);
        }

        if (_representation.runningInView) {
            svg.classed('selectionEnabled', true);
        }
    };

    const updateFilterInView = function () {
        const isFiltering = !!filteredRows.length;

        // add filter flag for leaves
        leaves.forEach(function (n) {
            n.outOfFilter = isFiltering && filteredRows.indexOf(n.data.rowKey) === -1;
        });

        // also mark cluster if both children are filtered out
        nodes.eachAfter(function (n) {
            if (n.children) {
                n.outOfFilter = n.children[0].outOfFilter || n.children[1].outOfFilter;
            }
        });

        // set/remove styles for filtered rows and cluster and links
        clusterMarkerEl.classed('outOfFilter', function (d) {
            return d.outOfFilter;
        });
        leafEl.classed('outOfFilter', function (d) {
            return d.outOfFilter;
        });
        linkEl.classed('outOfFilter', function (d) {
            return d.source.outOfFilter || d.target.outOfFilter;
        });
        xAxisEl.selectAll('.tick').classed('outOfFilter', function (rowKey) {
            return isFiltering && !(filteredRows.indexOf(rowKey) !== -1);
        });

        // also update threshold
        onThresholdChange(_value.threshold);
    };

    const onFilterChange = function (data) {
        // TODO support multiple filters?!
        filteredRows = leaves.map(function (leaf) {
            return leaf.data.rowKey;
        }).filter(function (rowKey) {
            return table.isRowIncludedInFilter(rowKey, data);
        });

        updateFilterInView();
    };

    const initFiltering = function () {
        table.getFilterIds().forEach(function (filterId) {
            knimeService.subscribeToFilter(table.getTableId(), onFilterChange, filterId);
        });
    };

    dendrogram.validate = function () {
        return true;
    };

    dendrogram.getComponentValue = function () {
        return _value;
    };

    dendrogram.getSVG = function () {
        if (!svg.empty()) {
            var svgElement = svg.node();
            knimeService.inlineSvgStyles(svgElement);
            // Return the SVG as a string.
            return (new XMLSerializer()).serializeToString(svgElement);
        } else {
            var w = _representation.imageWidth;
            var h = _representation.imageHeight;
            return '<svg height="' + h + '" width="' + w + '"><text x="0" y="15" fill="red">Error: No data available</text></svg>';
        }
    };

    return dendrogram;
}());
