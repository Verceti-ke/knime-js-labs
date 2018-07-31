/*
 * ------------------------------------------------------------------------
 *
 *  Copyright by KNIME AG, Zurich, Switzerland
 *  Website: http://www.knime.com; Email: contact@knime.com
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License, Version 3, as
 *  published by the Free Software Foundation.
 *
 *  This program is distributed in the hope that it will be useful, but
 *  WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program; if not, see <http://www.gnu.org/licenses>.
 *
 *  Additional permission under GNU GPL version 3 section 7:
 *
 *  KNIME interoperates with ECLIPSE solely via ECLIPSE's plug-in APIs.
 *  Hence, KNIME and ECLIPSE are both independent programs and are not
 *  derived from each other. Should, however, the interpretation of the
 *  GNU GPL Version 3 ("License") under any applicable laws result in
 *  KNIME and ECLIPSE being a combined program, KNIME AG herewith grants
 *  you the additional permission to use and propagate KNIME together with
 *  ECLIPSE with only the license terms in place for ECLIPSE applying to
 *  ECLIPSE and the GNU GPL Version 3 applying for KNIME, provided the
 *  license terms of ECLIPSE themselves allow for the respective use and
 *  propagation of ECLIPSE together with KNIME.
 *
 *  Additional permission relating to nodes for KNIME that extend the Node
 *  Extension (and in particular that are based on subclasses of NodeModel,
 *  NodeDialog, and NodeView) and that only interoperate with KNIME through
 *  standard APIs ("Nodes"):
 *  Nodes are deemed to be separate and independent programs and to not be
 *  covered works.  Notwithstanding anything to the contrary in the
 *  License, the License does not apply to Nodes, you are not required to
 *  license Nodes under the License, and you are granted a license to
 *  prepare and propagate Nodes, in each case even if such Nodes are
 *  propagated with or for interoperation with KNIME.  The owner of a Node
 *  may freely choose the license terms applicable to such Node, including
 *  when such Node is propagated with or for interoperation with KNIME.
 * ---------------------------------------------------------------------
 *
 * History
 *   Jul 19, 2018 (awalter): created
 */
package org.knime.base.node.mine.cluster.hierarchical.js;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.knime.base.data.xml.SvgCell;
import org.knime.base.node.mine.cluster.hierarchical.ClusterTreeModel;
import org.knime.base.node.mine.cluster.hierarchical.view.ClusterViewNode;
import org.knime.base.node.viz.plotter.dendrogram.DendrogramNode;
import org.knime.core.data.DataCell;
import org.knime.core.data.DataColumnSpecCreator;
import org.knime.core.data.DataRow;
import org.knime.core.data.DataTableSpec;
import org.knime.core.data.DataType;
import org.knime.core.data.RowKey;
import org.knime.core.data.container.ColumnRearranger;
import org.knime.core.data.container.SingleCellFactory;
import org.knime.core.data.def.BooleanCell;
import org.knime.core.data.def.BooleanCell.BooleanCellFactory;
import org.knime.core.data.def.StringCell;
import org.knime.core.node.BufferedDataTable;
import org.knime.core.node.BufferedDataTableHolder;
import org.knime.core.node.ExecutionContext;
import org.knime.core.node.InvalidSettingsException;
import org.knime.core.node.NodeSettingsRO;
import org.knime.core.node.NodeSettingsWO;
import org.knime.core.node.port.PortObject;
import org.knime.core.node.port.PortObjectSpec;
import org.knime.core.node.port.PortType;
import org.knime.core.node.port.image.ImagePortObject;
import org.knime.core.node.port.image.ImagePortObjectSpec;
import org.knime.core.node.port.inactive.InactiveBranchPortObjectSpec;
import org.knime.core.node.web.ValidationError;
import org.knime.js.core.node.AbstractSVGWizardNodeModel;
import org.knime.js.core.node.CSSModifiable;

/**
 *
 * @author Alison Walter
 */
public class HierarchicalClusterAssignerNodeModel extends AbstractSVGWizardNodeModel<HierarchicalClusterAssignerRepresentation,
HierarchicalClusterAssignerValue> implements BufferedDataTableHolder, CSSModifiable {

    private static final String JS_ID = "org.knime.base.node.mine.cluster.hierarchical";

    private HierarchicalClusterAssignerConfig m_config;
    private ClusterTreeModel m_tree;
    private BufferedDataTable m_table;
    private Map<DendrogramNode, Integer> m_nodeToId;
    private List<RowKey> m_rowsWithoutLeaves;
    private List<RowKey> m_leavesWithoutRows;

    /**
     * @param viewName The name of the interactive view
     */
    protected HierarchicalClusterAssignerNodeModel(final String viewName) {
        super(new PortType[]{ClusterTreeModel.TYPE, BufferedDataTable.TYPE}, new PortType[]{ImagePortObject.TYPE, BufferedDataTable.TYPE},
            viewName);
        m_config = new HierarchicalClusterAssignerConfig();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public HierarchicalClusterAssignerRepresentation createEmptyViewRepresentation() {
        return new HierarchicalClusterAssignerRepresentation();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public HierarchicalClusterAssignerValue createEmptyViewValue() {
        return new HierarchicalClusterAssignerValue();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public ValidationError validateViewValue(final HierarchicalClusterAssignerValue viewContent) {
        return null;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    protected PortObjectSpec[] configure(final PortObjectSpec[] inSpecs) throws InvalidSettingsException {
        if (!inSpecs[0].equals(inSpecs[1])) {
            throw new InvalidSettingsException("Incompatible data table for cluster tree");
        }
        final ColumnRearranger createColumnRearranger = createColumnAppender((DataTableSpec)inSpecs[1],
            m_config.getEnableSelection(), null, null);

        PortObjectSpec image;
        if (generateImage()) {
            image = new ImagePortObjectSpec(SvgCell.TYPE);
        } else {
            image = InactiveBranchPortObjectSpec.INSTANCE;
        }

        return new PortObjectSpec[]{image, createColumnRearranger.createSpec()};
    }

    /**
     * {@inheritDoc}
     */
    @Override
    protected void performExecuteCreateView(final PortObject[] inObjects, final ExecutionContext exec) throws Exception {
        m_tree = (ClusterTreeModel) inObjects[0];
        m_table = (BufferedDataTable) inObjects[1];

        if (m_table.size() < m_config.getNumClusters() && m_table.size() > 0) {
            throw new InvalidSettingsException("More clusters than data points selected");
        }

        if (m_nodeToId == null) {
            final String[] defaultLabels = initialSetUp();
            m_config.setClusterLabels(defaultLabels);
        }
        synchronized (getLock()) {
            copyConfigToView();
        }
    }

    /**
     * {@inheritDoc}
     */
    @Override
    protected PortObject[] performExecuteCreatePortObjects(final PortObject svgImageFromView,
        final PortObject[] inObjects, final ExecutionContext exec) throws Exception {
        BufferedDataTable out = null;
        synchronized (getLock()) {
            final Map<RowKey, String> rowToCluster = assignClusters(m_config.getThreshold());
            final List<String> selection = Arrays.asList(getViewValue().getSelection());
            final ColumnRearranger createColumnRearranger = createColumnAppender(m_table.getDataTableSpec(), m_config.getEnableSelection(), rowToCluster, selection);
            out = exec.createColumnRearrangeTable(m_table, createColumnRearranger, exec);
        }

        if (m_rowsWithoutLeaves != null && !m_rowsWithoutLeaves.isEmpty() && m_table.size() > 0) {
            setWarningMessage(m_rowsWithoutLeaves.size() + " row(s) cannot be assigned because they are not represented in the given cluster tree");
        }
        if (m_leavesWithoutRows != null && !m_leavesWithoutRows.isEmpty() && m_table.size() > 0) {
            setWarningMessage(m_leavesWithoutRows.size() + " cluster tree leaf(s) do not have corresponding row(s) in the given data table");
        }
        return new PortObject[]{svgImageFromView, out};
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public BufferedDataTable[] getInternalTables() {
        return new BufferedDataTable[]{m_table};
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public void setInternalTables(final BufferedDataTable[] tables) {
        m_table = tables[0];
    }

    /**
     * {@inheritDoc}
     */
    @Override
    protected void performReset() {
        m_tree = null;
        m_table = null;
        m_nodeToId = null;
        m_rowsWithoutLeaves = null;
        m_leavesWithoutRows = null;
        m_config.setSelection(HierarchicalClusterAssignerConfig.DEFAULT_SELECTION);
        m_config.setClusterLabels(HierarchicalClusterAssignerConfig.DEFAULT_CLUSTER_LABELS);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    protected void useCurrentValueAsDefault() {
        synchronized (getLock()) {
            copyValueToConfig();
        }
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public void saveCurrentValue(final NodeSettingsWO content) {
        // do nothing
    }

    /**
     * {@inheritDoc}
     */
    @Override
    protected void saveSettingsTo(final NodeSettingsWO settings) {
        m_config.saveSettings(settings);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    protected void validateSettings(final NodeSettingsRO settings) throws InvalidSettingsException {
        new HierarchicalClusterAssignerConfig().loadSettings(settings);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    protected void loadValidatedSettingsFrom(final NodeSettingsRO settings) throws InvalidSettingsException {
        m_config = new HierarchicalClusterAssignerConfig();
        m_config.loadSettings(settings);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public String getJavascriptObjectID() {
        return JS_ID;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public boolean isHideInWizard() {
        return m_config.getHideInWizard();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public void setHideInWizard(final boolean hide) {
        m_config.setHideInWizard(hide);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    protected boolean generateImage() {
        return m_config.getGenerateImage();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public String getCssStyles() {
        return m_config.getCustomCSS();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public void setCssStyles(final String styles) {
        m_config.setCustomCSS(styles);
    }

    // -- Helper methods --

    private String[] initialSetUp() {
        if (m_tree == null) {
            return null;
        }
        final Map<RowKey, DendrogramNode> leaves = new HashMap<>();
        int id = 0;
        final List<DendrogramNode> nodes = new ArrayList<>();
        final List<String> labels = new ArrayList<>();
        nodes.add(m_tree.getRoot());
        m_nodeToId = new HashMap<>();

        while(!nodes.isEmpty()) {
            final DendrogramNode node = nodes.remove(0);
            m_nodeToId.put(node, id);
            if (!node.isLeaf()) {
                nodes.add(node.getFirstSubnode());
                nodes.add(node.getSecondSubnode());
            }
            else {
                leaves.put(getLeafRowKey(node), node);
            }
            labels.add("Cluster " + id);
            id++;
        }
        populateLeaves(leaves);
        final String[] defaultClusterLabels = new String[labels.size()];
        return labels.toArray(defaultClusterLabels);
    }

    private void populateLeaves(final Map<RowKey, DendrogramNode> leaves) {
        if (m_table == null) {
            return;
        }
        for (final DataRow row : m_table) {
            final DendrogramNode leaf = leaves.get(row.getKey());
            if (leaf == null) {
                if (m_rowsWithoutLeaves == null) {
                    m_rowsWithoutLeaves = new ArrayList<>();
                }
                if (!m_rowsWithoutLeaves.contains(row.getKey())) {
                    m_rowsWithoutLeaves.add(row.getKey());
                }
            } else if (leaf.getLeafDataPoint() == null && !(leaf instanceof ClusterViewNode)) {
                throw new IllegalArgumentException(
                    "Cannot associate row data with leaf node of type " + leaf.getClass());
            } else {
                ((ClusterViewNode)leaf).setDataRow(row);
            }
        }
    }

    private double computeThresholdForNumClusters(final int numClusters) {
        if (numClusters <= 0) {
            throw new IllegalArgumentException("Cannot have " + numClusters + " clusters!");
        }
        if (numClusters == 1) {
            return m_tree.getRoot().getDist() + 0.01;
        }
        if (numClusters >= m_tree.getClusterDistances().length + 1) {
            return 0;
        }
        final double[] clusterDistances = m_tree.getClusterDistances();
        final int upperBound = clusterDistances.length - (numClusters - 1);
        final int lowerBound = clusterDistances.length - numClusters;
        return (clusterDistances[upperBound] + clusterDistances[lowerBound]) / 2.0;
    }

    private int computeNumClustersFromThreshold(final double threshold) {
        if (threshold < 0) {
            throw new IllegalArgumentException("threshold, " + threshold + ", is less than zero!");
        }

        // NB: If the threshold is the same value as a split, that split is included in the cluster count
        final double[] clusterDistances = m_tree.getClusterDistances();
        if (threshold > clusterDistances[clusterDistances.length - 1]) {
            return 1;
        }
        if (threshold <= clusterDistances[0]) {
            return clusterDistances.length + 1;
        }

        for (int i = 0; i <= clusterDistances.length / 2; i++) {
            if (clusterDistances[i] >= threshold) {
                return clusterDistances.length + 1 - i;
            }
            if (clusterDistances[clusterDistances.length - i - 1] == threshold) {
                return i + 2;
            }
            if (clusterDistances[clusterDistances.length - i - 1] < threshold) {
                return i + 1;
            }
        }

        // If you've gotten here, something has gone very wrong ...
        throw new IllegalArgumentException("Invalid threshold: " + threshold);
    }

    private void copyValueToConfig() {
        // Threshold and numClusters should be sync-ed by the view
        final HierarchicalClusterAssignerValue value = getViewValue();
        m_config.setTitle(value.getTitle());
        m_config.setSubtitle(value.getSubtitle());
        m_config.setNumClusters(value.getNumClusters());
        m_config.setXMin(value.getXMin());
        m_config.setXMax(value.getXMax());
        m_config.setYMin(value.getYMin());
        m_config.setYMax(value.getYMax());
        m_config.setUseLogScale(value.getUseLogScale());
        m_config.setOrientation(value.getOrientation());

        // the view does not deal with normalized thresholds,
        // so we want to sync to the non-normalized threshold always
        m_config.setThreshold(value.getThreshold());
        syncThresholds(false);
    }

    private void copyConfigToView() {
        final HierarchicalClusterAssignerRepresentation representation = getViewRepresentation();

        // Copy to representation
        representation.setGenerateImage(m_config.getGenerateImage());
        representation.setImageWidth(m_config.getImageWidth());
        representation.setImageHeight(m_config.getImageHeight());
        representation.setDisplayFullscreenButton(m_config.getDisplayFullscreenButton());
        representation.setResizeToWindow(m_config.getResizeToWindow());
        representation.setEnableViewEdit(m_config.getEnableViewEdit());
        representation.setEnableTitleEdit(m_config.getEnableTitleEdit());
        representation.setEnableNumClusterEdit(m_config.getEnableNumClusterEdit());
        representation.setEnableThresholdValue(m_config.getEnableThresholdValue());
        representation.setEnableClusterLabels(m_config.getEnableClusterLabels());
        representation.setEnableClusterColor(m_config.getEnableClusterColor());
        representation.setEnableSelection(m_config.getEnableSelection());
        representation.setPublishSelectionEvents(m_config.getPublishSelectionEvents());
        representation.setSubscribeSelectionEvents(m_config.getSubscribeSelectionEvents());
        representation.setShowWarningsInView(m_config.getShowWarningsInView());
        representation.setEnableZoom(m_config.getEnableZoom());
        representation.setShowZoomResetButton(m_config.getShowZoomResetButton());
        representation.setEnablePanning(m_config.getEnablePanning());
        representation.setEnableLogScaleToggle(m_config.getEnableLogScaleToggle());
        representation.setEnableChangeOrientation(m_config.getEnableChangeOrientation());
        representation.setColorPalette(m_config.getColorPalette());
        representation.setSubscribeFilterEvents(m_config.getSubscribeFilterEvents());
        representation.setTree(new JSClusterModelTree(m_tree, m_nodeToId));
        representation.setDataTableID(getTableId(1));

        // Copy to value
        final HierarchicalClusterAssignerValue value = getViewValue();
        if (isViewValueEmpty()) {
            if (m_config.getNumClustersMode()) {
                final double threshold = computeThresholdForNumClusters(m_config.getNumClusters());
                m_config.setThreshold(threshold);
            } else {
                syncThresholds(m_config.getUseNormalizedDistances());
                final int numClusters = computeNumClustersFromThreshold(m_config.getThreshold());
                m_config.setNumClusters(numClusters);
            }
            value.setTitle(m_config.getTitle());
            value.setSubtitle(m_config.getSubtitle());
            value.setNumClusters(m_config.getNumClusters());
            value.setThreshold(m_config.getThreshold());
            value.setClusterLabels(m_config.getClusterLabels());
            value.setSelection(m_config.getSelection());
            value.setXMin(getMinRowKey().toString());
            value.setXMax(getMaxRowKey().toString());
            value.setYMin(0);
            if (m_tree != null) {
                value.setYMax(m_tree.getClusterDistances()[m_tree.getClusterDistances().length - 1]);
            }
            value.setUseLogScale(m_config.getUseLogScale());
            value.setOrientation(m_config.getOrientation());
        }
    }

    private ColumnRearranger createColumnAppender(final DataTableSpec spec, final boolean selectionEnabled,
        final Map<RowKey, String> rowToCluster, final List<String> selection) {
        final ColumnRearranger columnRearranger = new ColumnRearranger(spec);

        // Append cluster column
        columnRearranger.append(new SingleCellFactory(new DataColumnSpecCreator(
            DataTableSpec.getUniqueColumnName(spec, m_config.getClusterColumnName()), StringCell.TYPE).createSpec()) {

            @Override
            public DataCell getCell(final DataRow row) {
                if (rowToCluster == null || rowToCluster.isEmpty() || rowToCluster.get(row.getKey()) == null) {
                    return DataType.getMissingCell();
                }
                return new StringCell(rowToCluster.get(row.getKey()));
            }
        });

        // Append selection column
        if (selectionEnabled) {
            columnRearranger.append(new SingleCellFactory(
                new DataColumnSpecCreator(DataTableSpec.getUniqueColumnName(spec, m_config.getSelectionColumnName()),
                    BooleanCell.TYPE).createSpec()) {

                @Override
                public DataCell getCell(final DataRow row) {
                    if (m_rowsWithoutLeaves != null && m_rowsWithoutLeaves.contains(row.getKey())) {
                        return DataType.getMissingCell();
                    }
                    if (selection != null && !selection.isEmpty()) {
                        return BooleanCellFactory.create(selection.contains(row.getKey().toString()));
                    }
                    return BooleanCell.FALSE;
                }
            });
        }

        return columnRearranger;
    }

    private Map<RowKey, String> assignClusters(final double threshold) {
        final Deque<DendrogramNode> stack = new ArrayDeque<>();
        final Map<RowKey, String> assignedClusters = new HashMap<>();
        final ArrayList<DendrogramNode> clusterNodes = new ArrayList<>();
        stack.push(m_tree.getRoot());
        while(!stack.isEmpty()) {
            final DendrogramNode n = stack.pop();
            if (n.getMaxDistance() <= threshold) {
                clusterNodes.add(n);
            }
            else {
                stack.push(n.getFirstSubnode());
                stack.push(n.getSecondSubnode());
            }
        }

        int clusterID = 0;
        for (final DendrogramNode node : clusterNodes) {
            final int id = m_nodeToId.get(node);
            String label = m_config.getClusterLabels()[id];
            if (label == null || label.isEmpty()) {
                label = "Cluster " + clusterID;
                clusterID++;
            }
            assignClusterLabelToRows(node, label, assignedClusters);
        }

        return assignedClusters;
    }

    private void assignClusterLabelToRows(final DendrogramNode cluster, final String label,
        final Map<RowKey, String> assignedClusters) {
        if (cluster.isLeaf()) {
            assignedClusters.put(getLeafRowKey(cluster), label);
        }

        final Deque<DendrogramNode> stack = new ArrayDeque<>();
        stack.push(cluster);
        while (!stack.isEmpty()) {
            final DendrogramNode n = stack.pop();
            if (n.isLeaf()) {
                final RowKey key = getLeafRowKey(n);
                if (n.getLeafDataPoint() == null) {
                    if (m_leavesWithoutRows == null) {
                        m_leavesWithoutRows = new ArrayList<>();
                    }
                    if (!m_leavesWithoutRows.contains(key)) {
                        m_leavesWithoutRows.add(key);
                    }
                }
                assignedClusters.put(key, label);
            } else {
                stack.push(n.getFirstSubnode());
                stack.push(n.getSecondSubnode());
            }
        }
    }

    private static RowKey getLeafRowKey(final DendrogramNode leaf) {
        if (leaf instanceof ClusterViewNode) {
            return ((ClusterViewNode) leaf).getLeafRowKey();
        }
        return leaf.getLeafDataPoint().getKey();
    }

    private RowKey getMinRowKey() {
        if (m_tree == null) {
            return null;
        }
        DendrogramNode node = m_tree.getRoot();
        while (!node.isLeaf()) {
            node = node.getFirstSubnode();
        }
        return getLeafRowKey(node);
    }

    private RowKey getMaxRowKey() {
        if (m_tree == null) {
            return null;
        }
        DendrogramNode node = m_tree.getRoot();
        while (!node.isLeaf()) {
            node = node.getSecondSubnode();
        }
        return getLeafRowKey(node);
    }

    private void syncThresholds(final boolean useNormalized) {
        final double maxDist = m_tree.getClusterDistances()[m_tree.getClusterDistances().length - 1];
        if (useNormalized) {
            m_config.setThreshold(m_config.getNormalizedThreshold() * maxDist);
        } else {
            m_config.setNormalizedThreshold(m_config.getThreshold() / maxDist);
        }
    }
}
