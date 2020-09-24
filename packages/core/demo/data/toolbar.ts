import * as barChart from "./bar";
import * as lineChart from "./line";
import { ToolbarControlTypes } from "../../src/interfaces";

// utility function to enable toolbar option
const addToolbarOptions = (options, configs?) => {
	options.experimental = true;

	options.toolbar = {
		enabled: true
	};
	options.zoomBar = {
		top: {
			enabled: true
		}
	};
	if (configs) {
		if (configs.titlePostifx) {
			options.title += configs.titlePostifx;
		}
		if (configs.maxIcons) {
			options.toolbar.maxIcons = configs.maxIcons;
		}
		if (configs.controlsInOrder) {
			options.toolbar.controlsInOrder = configs.controlsInOrder;
		}
	}

	return options;
};

export const toolbarStackedBarTimeSeriesData =
	barChart.stackedBarTimeSeriesData;
export const toolbarStackedBarTimeSeriesOptions = addToolbarOptions(
	Object.assign({}, barChart.stackedBarTimeSeriesOptions)
);

export const toolbarLineTimeSeriesData = lineChart.lineTimeSeriesData;
export const toolbarLineTimeSeriesOptions = addToolbarOptions(
	Object.assign({}, lineChart.lineTimeSeriesOptions),
	{
		titlePostfix: " - two icons",
		maxIcons: 2,
		controlsInOrder: [
			{
				type: ToolbarControlTypes.RESET_ZOOM,
				text: "Reset zoom"
			},
			{
				type: ToolbarControlTypes.ZOOM_IN,
				text: "Zoom in"
			},
			{
				type: ToolbarControlTypes.ZOOM_OUT,
				text: "Zoom out"
			}
		]
	}
);