// Internal Imports
import { Component } from "../component";
import { Tools } from "../../tools";
import { ScaleTypes } from "../../interfaces";
import { DOMUtils } from "../../services";

// D3 Imports
import { area, line } from "d3-shape";
import { extent } from "d3-array";
import { drag } from "d3-drag";
import { event, select } from "d3-selection";

export class ZoomBar extends Component {
	type = "zoom-bar";

	render() {
		const svg = this.getContainerSVG();

		const { cartesianScales } = this.services;
		const mainXAxisPosition = cartesianScales.getMainXAxisPosition();
		const mainYAxisPosition = cartesianScales.getMainYAxisPosition();
		const mainXScale = cartesianScales.getMainXScale();
		const mainYScale = cartesianScales.getMainYScale();
		const mainXScaleType = cartesianScales.getScaleTypeByPosition(mainXAxisPosition);
		const mainYScaleType = cartesianScales.getScaleTypeByPosition(mainYAxisPosition);

		const startX = mainXScale(mainXScale.domain()[0]);
		console.log("startX", startX)
		const height = 32;
		const container = DOMUtils.appendOrSelect(svg, "svg.zoom-container")
			.attr("transform", "translateX(10)")
			.attr("width", "100%")
			.attr("height", height)
			.attr("opacity", 1);

		const zoomBG = DOMUtils.appendOrSelect(container, "rect.zoom-bg")
			.attr("x", 0)
			.attr("y", 0)
			.attr("width", "100%")
			.attr("height", "100%")
			.attr("fill", "white")
			.attr("stroke", "#e8e8e8");

		if (mainXScale) {
			const displayData = this.model.getDisplayData();

			if (mainXScaleType === ScaleTypes.TIME) {
				// Get all date values provided in data
				// TODO - Could be re-used through the model
				let allDates = [];
				displayData.datasets.forEach(dataset => {
					allDates = allDates.concat(dataset.data.map(datum => Number(datum.date)));
				});
				allDates = Tools.removeArrayDuplicates(allDates).sort();

				// Go through all date values
				// And get corresponding data from each dataset
				const stackDataArray = allDates.map((date, i) => {
					let count = 0;
					let correspondingSum = 0;
					const correspondingData = {};

					displayData.datasets.forEach(dataset => {
						const correspondingDatum = dataset.data.find(datum => Number(datum.date) === Number(date));
						if (correspondingDatum) {
							++count;
							correspondingSum += correspondingDatum.value;
						}
					});
					correspondingData["label"] = date;
					correspondingData["value"] = correspondingSum;

					return correspondingData;
				});

				const xScale = Tools.clone(this.services.cartesianScales.getMainXScale());
				const yScale = Tools.clone(this.services.cartesianScales.getMainYScale());

				const { width } = DOMUtils.getSVGElementSize(this.parent, { useAttrs: true });

				xScale.range([0, +width])
					.domain(extent(stackDataArray, (d: any) => d.label));

				yScale.range([0, height - 6])
					.domain(extent(stackDataArray, (d: any) => d.value));

				const zoomDomain = this.model.get("zoomDomain");

				// D3 line generator function
				const lineGenerator = line()
					.x((d, i) => cartesianScales.getValueFromScale(mainXScale, mainXScaleType, d, i))
					.y((d, i) => height - cartesianScales.getValueFromScale(mainYScale, mainYScaleType, d, i))
					.curve(this.services.curves.getD3Curve())
					// .defined((d: any, i) => {
					// 	if (zoomDomain) {
					// 		const dTimestamp = +d.label;

					// 		return dTimestamp >= +zoomDomain[0] && dTimestamp <= +zoomDomain[1];
					// 	}

					// 	return true;
					// });

				const lineGraph = DOMUtils.appendOrSelect(container, "path.zoom-graph-line")
					.datum(stackDataArray)
					.attr("d", lineGenerator)
					.attr("stroke", "#8e8e8e")
					.attr("stroke-width", 3)
					.attr("fill", "none");

				const areaGenerator = area()
					.x((d, i) => cartesianScales.getValueFromScale(mainXScale, mainXScaleType, d, i))
					.y0(height)
					.y1((d, i) => height - cartesianScales.getValueFromScale(mainYScale, mainYScaleType, d, i));

				const areaGraph = DOMUtils.appendOrSelect(container, "path.zoom-graph-area")
					.datum(stackDataArray)
					.attr("d", areaGenerator)
					.attr("fill", "#e0e0e0");

				// container.selectAll("circle")
				// 	.data(stackDataArray, d => d.label)
				// 	.enter()
				// 	.append("circle")
				// 	.classed("zoom-graph-circle", true)
				// 	.attr("cx", (d, i) => xAxis.getValueFromScale(d, i))
				// 	.attr("cy", (d, i) => height - yAxis.getValueFromScale(d, i))
				// 	.attr("r", 5)
				// 	.attr("fill", "blue");

				// container.selectAll("text")
				// 	.data(stackDataArray, d => d.label)
				// 	.enter()
				// 	.append("text")
				// 	.classed("zoom-graph-text", true)
				// 	.attr("x", (d, i) => xAxis.getValueFromScale(d, i))
				// 	.attr("y", (d, i) => height - yAxis.getValueFromScale(d, i) + 5)
				// 	.text(d => d.value);

				const startHandlePosition = zoomDomain ? mainXScale(+zoomDomain[0]) : 0;
				// Handle #1
				const startHandle = DOMUtils.appendOrSelect(container, "rect.zoom-handle.start")
					.attr("x", startHandlePosition)
					.attr("width", 5)
					.attr("height", "100%")
					.attr("fill", "#525252");

				DOMUtils.appendOrSelect(container, "rect.zoom-handle-bar.start")
					.attr("x", startHandlePosition + 2)
					.attr("y", 10)
					.attr("width", 1)
					.attr("height", 12)
					.attr("fill", "#fff");

				const endHandlePosition = zoomDomain ? mainXScale(+zoomDomain[1]) : mainXScale.range()[1];
				// Handle #2
				const handle2 = DOMUtils.appendOrSelect(container, "rect.zoom-handle.end")
					.attr("x", endHandlePosition - 5)
					.attr("width", 5)
					.attr("height", "100%")
					.attr("fill", "#525252");

				DOMUtils.appendOrSelect(container, "rect.zoom-handle-bar.end")
					.attr("x", endHandlePosition - 5 + 2)
					.attr("y", 10)
					.attr("width", 1)
					.attr("height", 12)
					.attr("fill", "#fff");

				const self = this;
				handle2.on("click", this.zoomIn.bind(this));
				handle2.call(
					drag()
						.on("start", () => {
							console.log("started dragging");
						})
						.on("drag", function(d) {
							self.dragged(this, d);
						})
				);
					// .on("end", dragended));
			}
		}
	}

	dragged(element, d) {
		const mainXScale = this.services.cartesianScales.getMainXScale();

		select(element).attr("x", d.x = event.x);
		this.getContainerSVG()
			.select("rect.zoom-handle-bar.end")
			.attr("x", event.x + 2);

		console.log("event.x", event.x, mainXScale.invert(event.x));

		this.model.set({
			zoomDomain: [mainXScale.domain()[0], mainXScale.invert(event.x)]
		});
	}

	zoomIn() {
		const mainXScale = this.services.cartesianScales.getMainXScale();
		console.log("zoom in", mainXScale.domain());
	}
}
