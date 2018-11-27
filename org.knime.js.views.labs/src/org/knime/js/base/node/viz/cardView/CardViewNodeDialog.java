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
 *   Aug 22, 2018 (awalter): created
 */
package org.knime.js.base.node.viz.cardView;

import java.awt.Color;
import java.awt.Component;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.GridLayout;

import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.ButtonGroup;
import javax.swing.JCheckBox;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JRadioButton;
import javax.swing.JSpinner;
import javax.swing.JTextField;
import javax.swing.SwingConstants;
import javax.swing.border.TitledBorder;

import org.knime.core.data.DataTableSpec;
import org.knime.core.data.DoubleValue;
import org.knime.core.data.NominalValue;
import org.knime.core.node.InvalidSettingsException;
import org.knime.core.node.NodeDialogPane;
import org.knime.core.node.NodeSettingsRO;
import org.knime.core.node.NodeSettingsWO;
import org.knime.core.node.NotConfigurableException;
import org.knime.core.node.defaultnodesettings.DialogComponentNumber;
import org.knime.core.node.defaultnodesettings.SettingsModelIntegerBounded;
import org.knime.core.node.port.PortObjectSpec;
import org.knime.core.node.util.ColumnSelectionPanel;
import org.knime.core.node.util.DataValueColumnFilter;
import org.knime.core.node.util.filter.column.DataColumnSpecFilterConfiguration;
import org.knime.core.node.util.filter.column.DataColumnSpecFilterPanel;
import org.knime.js.core.components.datetime.DialogComponentDateTimeOptions;
import org.knime.js.core.components.datetime.SettingsModelDateTimeOptions;
import org.knime.js.core.settings.DialogUtil;
import org.knime.js.core.settings.table.TableRepresentationSettings;
import org.knime.js.core.settings.table.TableSettings;

/**
 * @author Alison Walter, KNIME GmbH, Konstanz, Germany
 */
public class CardViewNodeDialog extends NodeDialogPane {

    private static final int TEXT_FIELD_SIZE = 20;

    private final CardViewConfig m_config;

    private final JLabel m_warningLabelOptions;
    private final JLabel m_warningLabelInteract;

    // Options
    private final DialogComponentNumber m_maxRowsSpinner;
    private final JCheckBox m_displayRowColorsCheckBox;
    private final JCheckBox m_displayColumnHeadersCheckBox;
    private final JCheckBox m_displayFullscreenButtonCheckBox;
    private final JTextField m_titleField;
    private final JTextField m_subtitleField;
    private final DataColumnSpecFilterPanel m_columnFilterPanel;
    private final JCheckBox m_useNumColsCheckBox;
    private final JCheckBox m_useColWidthCheckBox;
    private final DialogComponentNumber m_numColsSpinner;
    private final DialogComponentNumber m_colWidthSpinner;
    private final ColumnSelectionPanel m_labelColColumnSelectionPanel;
    private final JRadioButton m_alignLeftRadioButton;
    private final JRadioButton m_alignRightRadioButton;
    private final JRadioButton m_alignCenterRadioButton;

    // Interactivity copied from table view dialog
    private final JCheckBox m_enablePagingCheckBox;
    private final DialogComponentNumber m_initialPageSizeSpinner;
    private final JCheckBox m_enablePageSizeChangeCheckBox;
    private final JTextField m_allowedPageSizesField;
    private final JCheckBox m_enableShowAllCheckBox;
    private final JCheckBox m_enableJumpToPageCheckBox;
    private final JCheckBox m_enableSelectionCheckbox;
    private final JCheckBox m_enableClearSelectionButtonCheckbox;
    private final JTextField m_selectionColumnNameField;
    private final JCheckBox m_publishSelectionCheckBox;
    private final JCheckBox m_subscribeSelectionCheckBox;
    private final JCheckBox m_enableHideUnselectedCheckbox;
    private final JCheckBox m_hideUnselectedCheckbox;
    private final JCheckBox m_publishFilterCheckBox;
    private final JCheckBox m_subscribeFilterCheckBox;

    // Formatters, copied from table view dialog
    private final DialogComponentDateTimeOptions m_dateTimeFormats;
    private final JCheckBox m_enableGlobalNumberFormatCheckbox;
    private final DialogComponentNumber m_globalNumberFormatDecimalSpinner;
    private final JCheckBox m_displayMissingValueAsQuestionMark;

    // warnings
    private final Component m_whitespace;
    private final JLabel m_numColWarning;
    private final JLabel m_colWidthWarning;
    private final JLabel m_maxWidthWarning;

    @SuppressWarnings("unchecked")
    CardViewNodeDialog() {
        m_config = new CardViewConfig();

        // copied from table view start
        m_maxRowsSpinner = new DialogComponentNumber(
            new SettingsModelIntegerBounded("maxRows", 0, 0, Integer.MAX_VALUE),
            "No. of rows to display: ", 1, 20, null, true, "value cannot be negative.");
        m_enablePagingCheckBox = new JCheckBox("Enable pagination");
        m_enablePagingCheckBox.addChangeListener(e -> enablePagingFields());
        m_initialPageSizeSpinner = new DialogComponentNumber(new SettingsModelIntegerBounded("initialPageSize",
            1, 1, Integer.MAX_VALUE), "Initial page size: ", 1, 20, null, true, "value must be greater than 0.");
        m_enablePageSizeChangeCheckBox = new JCheckBox("Enable page size change control");
        m_enablePageSizeChangeCheckBox.addChangeListener(e -> enablePagingFields());
        m_allowedPageSizesField = new JTextField(TEXT_FIELD_SIZE);
        m_enableShowAllCheckBox = new JCheckBox("Add \"All\" option to page sizes");
        m_enableJumpToPageCheckBox = new JCheckBox("Display field to jump to a page directly");
        m_displayRowColorsCheckBox = new JCheckBox("Display row colors");
        m_displayColumnHeadersCheckBox = new JCheckBox("Display column headers");
        m_displayFullscreenButtonCheckBox = new JCheckBox("Display fullscreen button");
        m_titleField = new JTextField(TEXT_FIELD_SIZE);
        m_subtitleField = new JTextField(TEXT_FIELD_SIZE);
        m_columnFilterPanel = new DataColumnSpecFilterPanel();
        m_enableSelectionCheckbox = new JCheckBox("Enable selection");
        m_enableSelectionCheckbox.addChangeListener(e -> enableSelectionFields());
        m_enableClearSelectionButtonCheckbox = new JCheckBox("Enable 'Clear Selection' button");
        m_selectionColumnNameField = new JTextField(TEXT_FIELD_SIZE);
        m_publishSelectionCheckBox = new JCheckBox("Publish selection events");
        m_subscribeSelectionCheckBox = new JCheckBox("Subscribe to selection events");
        m_hideUnselectedCheckbox = new JCheckBox("Show selected rows only");
        m_enableHideUnselectedCheckbox = new JCheckBox("Enable 'Show selected rows only' option");
        m_publishFilterCheckBox = new JCheckBox("Publish filter events");
        m_subscribeFilterCheckBox = new JCheckBox("Subscribe to filter events");
        final DialogComponentDateTimeOptions.Config dateTimeFormatsConfig = new DialogComponentDateTimeOptions.Config();
        dateTimeFormatsConfig.setShowTimezoneChooser(false);
        m_dateTimeFormats = new DialogComponentDateTimeOptions(
            new SettingsModelDateTimeOptions(TableRepresentationSettings.CFG_DATE_TIME_FORMATS),
            "Global Date Formatters", dateTimeFormatsConfig);
        m_enableGlobalNumberFormatCheckbox = new JCheckBox("Enable global number format (double cells)");
        m_enableGlobalNumberFormatCheckbox.addChangeListener(e -> enableFormatterFields());
        m_globalNumberFormatDecimalSpinner =
            new DialogComponentNumber(new SettingsModelIntegerBounded("globalNumberFormatDecimals", 2, 0,
                Integer.MAX_VALUE), "Decimal places: ", 1, 20, null, true, "value cannot be negative");
        m_displayMissingValueAsQuestionMark = new JCheckBox("Display missing value as red question mark");
        // end

        m_useNumColsCheckBox = new JCheckBox("Fixed number of cards per row (" + CardViewConfig.MIN_NUM_COLS + " - "
            + CardViewConfig.MAX_NUM_COLS + ")");
        m_useColWidthCheckBox = new JCheckBox(
            "Fixed card width (" + CardViewConfig.MIN_COL_WIDTH + " - " + CardViewConfig.MAX_COL_WIDTH + "px)");
        m_numColsSpinner =
            new DialogComponentNumber(new SettingsModelIntegerBounded(CardViewConfig.CFG_NUM_COLS, CardViewConfig.DEFAULT_NUM_COLS,
                CardViewConfig.MIN_NUM_COLS, CardViewConfig.MAX_NUM_COLS), "", 1, 35, null, true, null);
        m_colWidthSpinner = new DialogComponentNumber(new SettingsModelIntegerBounded(CardViewConfig.CFG_COL_WIDTH,
            CardViewConfig.DEFAULT_COL_WIDTH, CardViewConfig.MIN_COL_WIDTH, CardViewConfig.MAX_COL_WIDTH), "", 1,
            35, null, true, null);
        m_useNumColsCheckBox.addChangeListener(e -> enabledNumColMode());
        m_useColWidthCheckBox.addChangeListener(e -> enableColumnWidthMode());

        m_labelColColumnSelectionPanel = new ColumnSelectionPanel(
            BorderFactory.createTitledBorder("Choose a title column: "),
            new DataValueColumnFilter(NominalValue.class, DoubleValue.class), true, true);
        m_alignLeftRadioButton = new JRadioButton("Left");
        m_alignRightRadioButton = new JRadioButton("Right");
        m_alignCenterRadioButton = new JRadioButton("Center");

        m_warningLabelOptions = new JLabel("");
        m_warningLabelOptions.setForeground(Color.RED);
        m_warningLabelOptions.setVisible(false);
        m_warningLabelInteract = new JLabel("");
        m_warningLabelInteract.setForeground(Color.RED);
        m_warningLabelInteract.setVisible(false);

        getSpinner(m_numColsSpinner).addChangeListener(e -> checkRowsAndPage());
        getSpinner(m_initialPageSizeSpinner).addChangeListener(e -> checkRowsAndPage());

        // ensure space for warnings without scroll bar
        m_numColWarning = getWarning(m_numColsSpinner);
        m_colWidthWarning = getWarning(m_colWidthSpinner);
        m_maxWidthWarning = getWarning(m_maxRowsSpinner);
        m_numColWarning.addPropertyChangeListener(e -> changeWhiteSpaceVisibility());
        m_colWidthWarning.addPropertyChangeListener(e -> changeWhiteSpaceVisibility());
        m_maxWidthWarning.addPropertyChangeListener(e -> changeWhiteSpaceVisibility());
        m_warningLabelOptions.addPropertyChangeListener(e -> changeWhiteSpaceVisibility());
        m_whitespace = Box.createVerticalStrut(50);
        m_whitespace.setVisible(true);

        addTab("Options", initOptions());
        addTab("Interactivity", initInteractivity());
        addTab("Formatters", initFormatters());
    }

    /**
     * {@inheritDoc}
     */
    @Override
    protected void saveSettingsTo(final NodeSettingsWO settings) throws InvalidSettingsException {
        // use spinner values, since if the value is out of range it isn't propagated to the model
        final int maxRows = (int)getSpinner(m_maxRowsSpinner).getValue();
        final int numCols = (int)getSpinner(m_numColsSpinner).getValue();
        final int colWidth = (int)getSpinner(m_colWidthSpinner).getValue();
        final int initPageSize = (int)getSpinner(m_initialPageSizeSpinner).getValue();
        final int decimalPlaces = (int)getSpinner(m_globalNumberFormatDecimalSpinner).getValue();

        // copied from table view start
        m_dateTimeFormats.validateSettings();

        m_config.getSettings().getRepresentationSettings().setMaxRows(maxRows);
        m_config.getSettings().getRepresentationSettings().setEnablePaging(m_enablePagingCheckBox.isSelected());
        m_config.getSettings().getRepresentationSettings().setInitialPageSize(initPageSize);
        m_config.getSettings().getRepresentationSettings()
            .setEnablePageSizeChange(m_enablePageSizeChangeCheckBox.isSelected());
        m_config.getSettings().getRepresentationSettings().setAllowedPageSizes(getAllowedPageSizes());
        m_config.getSettings().getRepresentationSettings().setPageSizeShowAll(m_enableShowAllCheckBox.isSelected());
        m_config.getSettings().getRepresentationSettings().setEnableJumpToPage(m_enableJumpToPageCheckBox.isSelected());
        m_config.getSettings().getRepresentationSettings().setDisplayRowColors(m_displayRowColorsCheckBox.isSelected());
        m_config.getSettings().getRepresentationSettings()
            .setDisplayColumnHeaders(m_displayColumnHeadersCheckBox.isSelected());
        m_config.getSettings().getRepresentationSettings()
            .setDisplayFullscreenButton(m_displayFullscreenButtonCheckBox.isSelected());
        m_config.getSettings().getRepresentationSettings().setTitle(m_titleField.getText());
        m_config.getSettings().getRepresentationSettings().setSubtitle(m_subtitleField.getText());
        final DataColumnSpecFilterConfiguration filterConfig =
            new DataColumnSpecFilterConfiguration(TableSettings.CFG_COLUMN_FILTER);
        m_columnFilterPanel.saveConfiguration(filterConfig);
        m_config.getSettings().setColumnFilterConfig(filterConfig);
        m_config.getSettings().getRepresentationSettings().setEnableSelection(m_enableSelectionCheckbox.isSelected());
        m_config.getSettings().getRepresentationSettings()
            .setEnableClearSelectionButton(m_enableClearSelectionButtonCheckbox.isSelected());
        m_config.getSettings().setSelectionColumnName(m_selectionColumnNameField.getText());
        m_config.getSettings().getValueSettings().setHideUnselected(m_hideUnselectedCheckbox.isSelected());
        m_config.getSettings().getRepresentationSettings()
            .setEnableHideUnselected(m_enableHideUnselectedCheckbox.isSelected());
        m_config.getSettings().getValueSettings().setPublishSelection(m_publishSelectionCheckBox.isSelected());
        m_config.getSettings().getValueSettings().setSubscribeSelection(m_subscribeSelectionCheckBox.isSelected());
        m_config.getSettings().getValueSettings().setPublishFilter(m_publishFilterCheckBox.isSelected());
        m_config.getSettings().getValueSettings().setSubscribeFilter(m_subscribeFilterCheckBox.isSelected());
        m_config.getSettings().getRepresentationSettings()
            .setDateTimeFormats((SettingsModelDateTimeOptions)m_dateTimeFormats.getModel());
        m_config.getSettings().getRepresentationSettings()
            .setEnableGlobalNumberFormat(m_enableGlobalNumberFormatCheckbox.isSelected());
        m_config.getSettings().getRepresentationSettings().setGlobalNumberFormatDecimals(decimalPlaces);
        m_config.getSettings().getRepresentationSettings()
            .setDisplayMissingValueAsQuestionMark(m_displayMissingValueAsQuestionMark.isSelected());
        // end

        m_config.setUseNumCols(m_useNumColsCheckBox.isSelected());
        if (m_useNumColsCheckBox.isSelected()) {
            m_config.setNumCols(numCols);
        }
        m_config.setUseColWidth(m_useColWidthCheckBox.isSelected());
        if (m_useColWidthCheckBox.isSelected()) {
            m_config.setColWidth(colWidth);
        }
        m_config.setUseRowID(m_labelColColumnSelectionPanel.rowIDSelected());
        m_config.setLabelCol(m_labelColColumnSelectionPanel.getSelectedColumn());
        m_config.setAlignLeft(m_alignLeftRadioButton.isSelected());
        m_config.setAlignRight(m_alignRightRadioButton.isSelected());
        m_config.setAlignCenter(m_alignCenterRadioButton.isSelected());

        m_config.saveSettings(settings);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    protected void loadSettingsFrom(final NodeSettingsRO settings, final PortObjectSpec[] specs)
        throws NotConfigurableException {
        // copied from table view start
        final DataTableSpec inSpec = (DataTableSpec)specs[0];
        m_config.loadSettingsForDialog(settings, inSpec);
        // use loadSettingsFrom method to ensure listeners are notified to sync model and spinner
        m_maxRowsSpinner.loadSettingsFrom(settings, specs);
        m_enablePagingCheckBox.setSelected(m_config.getSettings().getRepresentationSettings().getEnablePaging());
        m_initialPageSizeSpinner.loadSettingsFrom(settings, specs);
        m_enablePageSizeChangeCheckBox
            .setSelected(m_config.getSettings().getRepresentationSettings().getEnablePageSizeChange());
        m_allowedPageSizesField.setText(
            getAllowedPageSizesString(m_config.getSettings().getRepresentationSettings().getAllowedPageSizes()));
        m_enableShowAllCheckBox.setSelected(m_config.getSettings().getRepresentationSettings().getPageSizeShowAll());
        m_enableJumpToPageCheckBox
            .setSelected(m_config.getSettings().getRepresentationSettings().getEnableJumpToPage());
        m_displayRowColorsCheckBox
            .setSelected(m_config.getSettings().getRepresentationSettings().getDisplayRowColors());
        m_displayColumnHeadersCheckBox
            .setSelected(m_config.getSettings().getRepresentationSettings().getDisplayColumnHeaders());
        m_displayFullscreenButtonCheckBox
            .setSelected(m_config.getSettings().getRepresentationSettings().getDisplayFullscreenButton());
        m_titleField.setText(m_config.getSettings().getRepresentationSettings().getTitle());
        m_subtitleField.setText(m_config.getSettings().getRepresentationSettings().getSubtitle());
        m_columnFilterPanel.loadConfiguration(m_config.getSettings().getColumnFilterConfig(), inSpec);
        m_enableSelectionCheckbox.setSelected(m_config.getSettings().getRepresentationSettings().getEnableSelection());
        m_enableClearSelectionButtonCheckbox
            .setSelected(m_config.getSettings().getRepresentationSettings().getEnableClearSelectionButton());
        m_selectionColumnNameField.setText(m_config.getSettings().getSelectionColumnName());
        m_hideUnselectedCheckbox.setSelected(m_config.getSettings().getValueSettings().getHideUnselected());
        m_enableHideUnselectedCheckbox
            .setSelected(m_config.getSettings().getRepresentationSettings().getEnableHideUnselected());
        m_publishSelectionCheckBox.setSelected(m_config.getSettings().getValueSettings().getPublishSelection());
        m_subscribeSelectionCheckBox.setSelected(m_config.getSettings().getValueSettings().getSubscribeSelection());
        m_publishFilterCheckBox.setSelected(m_config.getSettings().getValueSettings().getPublishFilter());
        m_subscribeFilterCheckBox.setSelected(m_config.getSettings().getValueSettings().getSubscribeFilter());
        m_dateTimeFormats
            .loadSettingsFromModel(m_config.getSettings().getRepresentationSettings().getDateTimeFormats());
        m_enableGlobalNumberFormatCheckbox
            .setSelected(m_config.getSettings().getRepresentationSettings().getEnableGlobalNumberFormat());
        m_globalNumberFormatDecimalSpinner.loadSettingsFrom(settings, specs);
        m_displayMissingValueAsQuestionMark
            .setSelected(m_config.getSettings().getRepresentationSettings().getDisplayMissingValueAsQuestionMark());
        // end

        final boolean numColMode = m_config.getUseNumCols();
        final boolean colWidthMode = m_config.getUseColWidth();
        m_useNumColsCheckBox.setSelected(numColMode);
        m_useColWidthCheckBox.setSelected(colWidthMode);
        if (!numColMode && !colWidthMode) {
            m_useNumColsCheckBox.setSelected(true);
        }
        m_numColsSpinner.loadSettingsFrom(settings, specs);
        m_colWidthSpinner.loadSettingsFrom(settings, specs);
        m_labelColColumnSelectionPanel.update(inSpec, m_config.getLabelCol(), m_config.getUseRowID());
        m_alignLeftRadioButton.setSelected(m_config.getAlignLeft());
        m_alignRightRadioButton.setSelected(m_config.getAlignRight());
        m_alignCenterRadioButton.setSelected(m_config.getAlignCenter());

        enabledNumColMode();
        enableColumnWidthMode();
        enablePagingFields();
        enableSelectionFields();
        enableFormatterFields();
        setNumberOfFilters(inSpec);
        m_whitespace.setVisible(true);
    }

    // -- Helper methods --

    private void enabledNumColMode() {
        if (!m_useNumColsCheckBox.isSelected() && !m_useColWidthCheckBox.isSelected()) {
            m_useNumColsCheckBox.setSelected(true);
        }
        m_numColsSpinner.getModel().setEnabled(m_useNumColsCheckBox.isSelected());
        checkRowsAndPage();
    }

    private void enableColumnWidthMode() {
        if (!m_useNumColsCheckBox.isSelected() && !m_useColWidthCheckBox.isSelected()) {
            m_useColWidthCheckBox.setSelected(true);
        }
        m_colWidthSpinner.getModel().setEnabled(m_useColWidthCheckBox.isSelected());
    }

    private JPanel initOptions() {
        final ButtonGroup alignment = new ButtonGroup();
        alignment.add(m_alignCenterRadioButton);
        alignment.add(m_alignLeftRadioButton);
        alignment.add(m_alignRightRadioButton);

        // copied from table view start
        final JPanel generalPanel = new JPanel(new GridBagLayout());
        generalPanel.setBorder(new TitledBorder("General Options"));
        final GridBagConstraints gbcG = DialogUtil.defaultGridBagConstraints();
        gbcG.fill = GridBagConstraints.HORIZONTAL;
        gbcG.gridwidth = 1;
        generalPanel.add(m_maxRowsSpinner.getComponentPanel(), gbcG);

        final JPanel titlePanel = new JPanel(new GridBagLayout());
        titlePanel.setBorder(new TitledBorder("Titles"));
        final GridBagConstraints gbcT = DialogUtil.defaultGridBagConstraints();
        titlePanel.add(new JLabel("Title: "), gbcT);
        gbcT.gridx++;
        titlePanel.add(m_titleField, gbcT);
        gbcT.gridx = 0;
        gbcT.gridy++;
        titlePanel.add(new JLabel("Subtitle: "), gbcT);
        gbcT.gridx++;
        titlePanel.add(m_subtitleField, gbcT);

        final JPanel displayPanel = new JPanel(new GridBagLayout());
        displayPanel.setBorder(new TitledBorder("Display Options"));
        final GridBagConstraints gbcD = DialogUtil.defaultGridBagConstraints();
        gbcD.fill = GridBagConstraints.HORIZONTAL;
        gbcD.weightx = 1;
        // end
        gbcD.gridwidth = 3;
        gbcD.gridx = 0;
        final JPanel displayRow = new JPanel(new GridLayout(1, 3));
        displayRow.add(m_displayRowColorsCheckBox);
        m_displayColumnHeadersCheckBox.setHorizontalAlignment(SwingConstants.CENTER);
        displayRow.add(m_displayColumnHeadersCheckBox);
        m_displayFullscreenButtonCheckBox.setHorizontalAlignment(SwingConstants.RIGHT);
        displayRow.add(m_displayFullscreenButtonCheckBox);
        displayPanel.add(displayRow, gbcD);
        gbcD.gridwidth = 1;
        gbcD.gridx = 0;
        gbcD.gridy++;
        displayPanel.add(m_useNumColsCheckBox, gbcD);
        gbcD.gridx++;
        gbcD.gridwidth = 2;
        displayPanel.add(m_numColsSpinner.getComponentPanel(), gbcD);
        gbcD.gridx = 1;
        gbcD.gridy++;
        gbcD.gridwidth = 2;
        displayPanel.add(m_warningLabelOptions, gbcD);
        gbcD.gridx = 0;
        gbcD.gridy++;
        gbcD.gridwidth = 1;
        displayPanel.add(m_useColWidthCheckBox, gbcD);
        gbcD.gridx++;
        gbcD.gridwidth = 2;
        displayPanel.add(m_colWidthSpinner.getComponentPanel(), gbcD);
        gbcD.gridx = 0;
        gbcD.gridy++;
        gbcD.gridwidth = 1;
        displayPanel.add(new JLabel("Select text alignment:"), gbcD);
        gbcD.gridx = 0;
        gbcD.gridy++;
        gbcD.gridwidth = 3;
        final JPanel alignmentButtons = new JPanel(new GridLayout(1, 3));
        alignmentButtons.add(m_alignLeftRadioButton);
        m_alignCenterRadioButton.setHorizontalAlignment(SwingConstants.CENTER);
        alignmentButtons.add(m_alignCenterRadioButton);
        m_alignRightRadioButton.setHorizontalAlignment(SwingConstants.RIGHT);
        alignmentButtons.add(m_alignRightRadioButton);
        displayPanel.add(alignmentButtons, gbcD);
        gbcD.gridx = 0;
        gbcD.gridy++;
        gbcD.gridwidth = 3;
        displayPanel.add(m_labelColColumnSelectionPanel, gbcD);
        gbcD.gridy++;
        // copied from table view start
        displayPanel.add(new JLabel("Columns to display: "), gbcD);
        gbcD.gridy++;
        displayPanel.add(m_columnFilterPanel, gbcD);

        final JPanel panel = new JPanel(new GridBagLayout());
        final GridBagConstraints gbc = DialogUtil.defaultGridBagConstraints();
        gbc.fill = GridBagConstraints.HORIZONTAL;
        panel.add(generalPanel, gbc);
        gbc.gridy++;
        panel.add(titlePanel, gbc);
        gbc.gridy++;
        panel.add(displayPanel, gbc);
        gbc.gridy++;
        panel.add(m_whitespace, gbc);
        return panel;
        // end
    }

    private JPanel initInteractivity() {
        // copied from table view start
        final JPanel pagingPanel = new JPanel(new GridBagLayout());
        pagingPanel.setBorder(new TitledBorder("Paging"));
        final GridBagConstraints gbcP = DialogUtil.defaultGridBagConstraints();
        gbcP.fill = GridBagConstraints.HORIZONTAL;
        gbcP.weightx = 1;
        gbcP.gridwidth = 2;
        pagingPanel.add(m_enablePagingCheckBox, gbcP);
        gbcP.gridy++;
        gbcP.gridwidth = 1;
        pagingPanel.add(m_initialPageSizeSpinner.getComponentPanel(), gbcP);
        gbcP.gridx = 0;
        gbcP.gridy++;
        gbcP.gridwidth = 2;
        pagingPanel.add(m_warningLabelInteract, gbcP);
        gbcP.gridx = 0;
        gbcP.gridy++;
        gbcP.gridwidth = 1;
        pagingPanel.add(m_enablePageSizeChangeCheckBox, gbcP);
        gbcP.gridx = 0;
        gbcP.gridy++;
        pagingPanel.add(new JLabel("Selectable page sizes: "), gbcP);
        gbcP.gridx++;
        pagingPanel.add(m_allowedPageSizesField, gbcP);
        gbcP.gridx = 0;
        gbcP.gridy++;
        gbcP.gridwidth = 2;
        pagingPanel.add(m_enableShowAllCheckBox, gbcP);

        final JPanel selectionPanel = new JPanel(new GridBagLayout());
        // section name change not in table view
        selectionPanel.setBorder(new TitledBorder("Selection & Filtering"));
        final GridBagConstraints gbcS = DialogUtil.defaultGridBagConstraints();
        gbcS.fill = GridBagConstraints.HORIZONTAL;
        gbcS.weightx = 1;
        gbcS.gridwidth = 1;
        selectionPanel.add(m_enableSelectionCheckbox, gbcS);
        gbcS.gridx++;
        selectionPanel.add(m_subscribeFilterCheckBox, gbcS);
        gbcS.gridx = 0;
        gbcS.gridy++;
        selectionPanel.add(m_enableClearSelectionButtonCheckbox, gbcS);
        gbcS.gridx++;
        selectionPanel.add(m_hideUnselectedCheckbox, gbcS);
        gbcS.gridx = 0;
        gbcS.gridy++;
        selectionPanel.add(m_enableHideUnselectedCheckbox, gbcS);
        gbcS.gridx++;
        selectionPanel.add(m_publishSelectionCheckBox, gbcS);
        gbcS.gridx = 0;
        gbcS.gridy++;
        selectionPanel.add(m_subscribeSelectionCheckBox, gbcS);
        gbcS.gridx = 0;
        gbcS.gridy++;
        selectionPanel.add(new JLabel("Selection column name: "), gbcS);
        gbcS.gridx++;
        selectionPanel.add(m_selectionColumnNameField, gbcS);
        // end

        final JPanel panel = new JPanel(new GridBagLayout());
        final GridBagConstraints gbc = DialogUtil.defaultGridBagConstraints();
        gbc.fill = GridBagConstraints.HORIZONTAL;
        panel.add(pagingPanel, gbc);
        gbc.gridy++;
        panel.add(selectionPanel, gbc);
        gbc.gridy++;
        return panel;
    }

    // -- The below were copied directly from table view dialog --

    private JPanel initFormatters() {
        final JPanel numberPanel = new JPanel(new GridBagLayout());
        numberPanel.setBorder(new TitledBorder("Number Formatter"));
        final GridBagConstraints gbcN = DialogUtil.defaultGridBagConstraints();
        gbcN.fill = GridBagConstraints.HORIZONTAL;
        gbcN.weightx = 1;
        gbcN.gridwidth = 2;
        numberPanel.add(m_enableGlobalNumberFormatCheckbox, gbcN);
        gbcN.gridy++;
        gbcN.gridwidth = 1;
        numberPanel.add(m_globalNumberFormatDecimalSpinner.getComponentPanel(), gbcN);
        gbcN.gridx = 0;
        gbcN.gridy++;

        final JPanel missingValuePanel = new JPanel(new GridBagLayout());
        missingValuePanel.setBorder(new TitledBorder("Missing value formatter"));
        missingValuePanel.add(m_displayMissingValueAsQuestionMark, gbcN);

        final JPanel panel = new JPanel(new GridBagLayout());
        final GridBagConstraints gbc = DialogUtil.defaultGridBagConstraints();
        gbc.fill = GridBagConstraints.HORIZONTAL;
        panel.add(m_dateTimeFormats.getPanel(), gbc);
        gbc.gridy++;
        panel.add(numberPanel, gbc);
        gbc.gridy++;
        panel.add(missingValuePanel, gbc);
        return panel;
    }

    private void setNumberOfFilters(final DataTableSpec spec) {
        int numFilters = 0;
        for (int i = 0; i < spec.getNumColumns(); i++) {
            if (spec.getColumnSpec(i).getFilterHandler().isPresent()) {
                numFilters++;
            }
        }
        final StringBuilder builder = new StringBuilder("Subscribe to filter events");
        builder.append(" (");
        builder.append(numFilters == 0 ? "no" : numFilters);
        builder.append(numFilters == 1 ? " filter" : " filters");
        builder.append(" available)");
        m_subscribeFilterCheckBox.setText(builder.toString());
    }

    private static String getAllowedPageSizesString(final int[] sizes) {
        if (sizes.length < 1) {
            return "";
        }
        final StringBuilder builder = new StringBuilder(String.valueOf(sizes[0]));
        for (int i = 1; i < sizes.length; i++) {
            builder.append(", ");
            builder.append(sizes[i]);
        }
        return builder.toString();
    }

    private int[] getAllowedPageSizes() throws InvalidSettingsException {
        final String[] sizesArray = m_allowedPageSizesField.getText().split(",");
        final int[] allowedPageSizes = new int[sizesArray.length];
        try {
            for (int i = 0; i < sizesArray.length; i++) {
                allowedPageSizes[i] = Integer.parseInt(sizesArray[i].trim());
            }
        } catch (final NumberFormatException e) {
            throw new InvalidSettingsException(e.getMessage(), e);
        }
        return allowedPageSizes;
    }

    private void enablePagingFields() {
        final boolean enableGlobal = m_enablePagingCheckBox.isSelected();
        final boolean enableSizeChange = m_enablePageSizeChangeCheckBox.isSelected();
        m_initialPageSizeSpinner.getModel().setEnabled(enableGlobal);
        m_enablePageSizeChangeCheckBox.setEnabled(enableGlobal);
        m_allowedPageSizesField.setEnabled(enableGlobal && enableSizeChange);
        m_enableShowAllCheckBox.setEnabled(enableGlobal && enableSizeChange);
        m_enableJumpToPageCheckBox.setEnabled(enableGlobal);
        checkRowsAndPage();
    }

    private void enableSelectionFields() {
        final boolean enable = m_enableSelectionCheckbox.isSelected();

        m_enableClearSelectionButtonCheckbox.setEnabled(enable);
        m_hideUnselectedCheckbox.setEnabled(enable);
        m_enableHideUnselectedCheckbox.setEnabled(enable);
        m_publishSelectionCheckBox.setEnabled(enable);
        m_subscribeSelectionCheckBox.setEnabled(enable);
        m_selectionColumnNameField.setEnabled(enable);
    }

    private void enableFormatterFields() {
        final boolean enableNumberFormat = m_enableGlobalNumberFormatCheckbox.isSelected();
        m_globalNumberFormatDecimalSpinner.getModel().setEnabled(enableNumberFormat);
    }

    private void checkRowsAndPage() {
        if (!m_useNumColsCheckBox.isSelected() || !m_enablePagingCheckBox.isSelected()) {
            m_warningLabelOptions.setText("");
            m_warningLabelOptions.setVisible(false);
            m_warningLabelInteract.setText("");
            m_warningLabelInteract.setVisible(false);
            return;
        }
        // the value in the SettingsModel doesn't always match what is displayed in the dialog, use spinners directly
        final int numCols = (int)getSpinner(m_numColsSpinner).getValue();
        final int initPageSize = (int)getSpinner(m_initialPageSizeSpinner).getValue();
        if (numCols > initPageSize) {
            m_warningLabelOptions.setText(
                "<html>Number of cards per row (" + numCols + ") cannot be greater than the <br />initial page size ("
                    + initPageSize + "). Check the \"Interactivity\" tab.</html>");
            m_warningLabelOptions.setVisible(true);
            m_warningLabelInteract.setText(
                "<html>Number of cards per row (" + numCols + ") cannot be greater than the <br />initial page size ("
                    + initPageSize + "). Check the \"Options\" tab.</html>");
            m_warningLabelInteract.setVisible(true);
        } else {
            m_warningLabelOptions.setText("");
            m_warningLabelOptions.setVisible(false);
            m_warningLabelInteract.setText("");
            m_warningLabelInteract.setVisible(false);
        }
    }

    private static JSpinner getSpinner(final DialogComponentNumber component) {
        for (int i = 0; i < component.getComponentPanel().getComponentCount(); i++) {
            final Component c = component.getComponentPanel().getComponent(i);
            if (c instanceof JSpinner) {
                return (JSpinner) c;
            }
        }
        return null;
    }

    private static JLabel getWarning(final DialogComponentNumber component) {
        for (int i = 0; i < component.getComponentPanel().getComponentCount(); i++) {
            final Component c = component.getComponentPanel().getComponent(i);
            if ((c instanceof JLabel) && ((JLabel)c).getForeground().equals(Color.RED)) {
                return (JLabel)c;
            }
        }
        return null;
    }

    private void changeWhiteSpaceVisibility() {
        if (m_numColWarning.isVisible() || m_colWidthWarning.isVisible() || m_maxWidthWarning.isVisible()
            || m_warningLabelOptions.isVisible()) {
            m_whitespace.setVisible(false);
        } else {
            m_whitespace.setVisible(true);
        }
    }
}
