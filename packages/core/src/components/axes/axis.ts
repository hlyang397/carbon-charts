// Internal Imports
import { Component } from "../component";
import {
	AxisPositions,
	Events,
	ScaleTypes,
	Roles,
	TruncationTypes
} from "../../interfaces";
import { Tools } from "../../tools";
import { ChartModel } from "../../model";
import { DOMUtils } from "../../services";
import * as Configuration from "../../configuration";
import {
	computeTimeIntervalName,
	formatTick,
	isTickPrimary
} from "../../services/time-series";

// D3 Imports
import { select } from "d3-selection";
import { axisBottom, axisLeft, axisRight, axisTop } from "d3-axis";

export class Axis extends Component {
	type = "axes";

	margins: any;

	scale: any;
	scaleType: ScaleTypes;

	constructor(model: ChartModel, services: any, configs?: any) {
		super(model, services, configs);

		if (configs) {
			this.configs = configs;
		}

		this.margins = this.configs.margins;
	}

	render(animate = true) {
		const { position: axisPosition } = this.configs;
		const options = this.model.getOptions();
		const axisOptions = Tools.getProperty(options, "axes", axisPosition);
		const axisScaleType = Tools.getProperty(axisOptions, "scaleType");
		const isDataLoading = Tools.getProperty(options, "data", "loading");
		const numberOfTicksProvided = Tools.getProperty(
			axisOptions,
			"ticks",
			"number"
		);

		// user can provide custom ticks to be displayed
		// ticks need to be in the domain of the axis data
		const userProvidedTickValues = Tools.getProperty(
			axisOptions,
			"ticks",
			"values"
		);

		// get user provided custom values for truncation
		const truncationType = Tools.getProperty(
			axisOptions,
			"truncation",
			"type"
		);
		const truncationThreshold = Tools.getProperty(
			axisOptions,
			"truncation",
			"threshold"
		);
		const truncationNumCharacter = Tools.getProperty(
			axisOptions,
			"truncation",
			"numCharacter"
		);

		const isNumberOfTicksProvided = numberOfTicksProvided !== null;
		const isVerticalAxis =
			axisPosition === AxisPositions.LEFT ||
			axisPosition === AxisPositions.RIGHT;
		const timeScaleOptions = Tools.getProperty(options, "timeScale");

		const svg = this.getContainerSVG();
		const { width, height } = DOMUtils.getSVGElementSize(this.parent, {
			useAttrs: true
		});

		let startPosition, endPosition;
		if (
			axisPosition === AxisPositions.BOTTOM ||
			axisPosition === AxisPositions.TOP
		) {
			startPosition = this.configs.axes[AxisPositions.LEFT]
				? this.margins.left
				: 0;
			endPosition = this.configs.axes[AxisPositions.RIGHT]
				? width - this.margins.right
				: width;
		} else {
			startPosition = height - this.margins.bottom;
			endPosition = this.margins.top;
		}

		// Grab the scale off of the Scales service
		const scale = this.services.cartesianScales.getScaleByPosition(
			axisPosition
		);

		if (this.scaleType === ScaleTypes.LABELS) {
			scale.rangeRound([startPosition, endPosition]);
		} else {
			scale.range([startPosition, endPosition]);
		}

		// Identify the corresponding d3 axis function
		let axisFunction;
		switch (axisPosition) {
			case AxisPositions.LEFT:
				axisFunction = axisLeft;
				break;
			case AxisPositions.BOTTOM:
				axisFunction = axisBottom;
				break;
			case AxisPositions.RIGHT:
				axisFunction = axisRight;
				break;
			case AxisPositions.TOP:
				axisFunction = axisTop;
				break;
		}

		// Add axis into the parent
		const container = DOMUtils.appendOrSelect(
			svg,
			`g.axis.${axisPosition}`
		);
		container.attr("aria-label", `${axisPosition} axis`);
		const axisRefExists = !container.select(`g.ticks`).empty();
		let axisRef = DOMUtils.appendOrSelect(container, `g.ticks`);
		if (!axisRefExists) {
			axisRef.attr("role", `${Roles.GRAPHICS_OBJECT} ${Roles.GROUP}`);
			axisRef.attr("aria-label", `${axisPosition} ticks`);
		}

		// We draw the invisible axis because of the async nature of d3 transitions
		// To be able to tell the final width & height of the axis when initiaing the transition
		// The invisible axis is updated instantly and without a transition
		const invisibleAxisRef = DOMUtils.appendOrSelect(
			container,
			`g.ticks.invisible`
		)
			.style("opacity", "0")
			.style("pointer-events", "none")
			.attr("aria-hidden", true)
			.attr("aria-label", `invisible ${axisPosition} ticks`);

		// Append to DOM a fake tick to get the right computed font height
		const fakeTick = DOMUtils.appendOrSelect(invisibleAxisRef, `g.tick`);
		const fakeTickText = DOMUtils.appendOrSelect(fakeTick, `text`).text(
			"0"
		);
		const tickHeight = DOMUtils.getSVGElementSize(fakeTickText.node(), {
			useBBox: true
		}).height;
		fakeTick.remove();

		const isTimeScaleType =
			this.scaleType === ScaleTypes.TIME ||
			axisOptions.scaleType === ScaleTypes.TIME;
		const scaleType =
			this.scaleType || axisOptions.scaleType || ScaleTypes.LINEAR;

		// if zoomDomain is available, scale type is time, and axis position isBOTTOM or TOP
		// update scale domain to zoomDomain.
		const zoomDomain = this.model.get("zoomDomain");
		if (zoomDomain && isTimeScaleType && !isVerticalAxis) {
			scale.domain(zoomDomain);
		}

		// Initialize axis object
		const axis = axisFunction(scale).tickSizeOuter(0);

		if (scale.ticks) {
			let numberOfTicks;

			if (isNumberOfTicksProvided) {
				numberOfTicks = numberOfTicksProvided;
			} else {
				numberOfTicks = Configuration.axis.ticks.number;
				if (isVerticalAxis) {
					// Set how many ticks based on height
					numberOfTicks = this.getNumberOfFittingTicks(
						height,
						tickHeight,
						Configuration.tickSpaceRatioVertical
					);
				}
			}

			// scale continuous
			// remove 0 ticks for skeleton
			if (scale.ticks().length === 1 && scale.ticks()[0] === 0) {
				numberOfTicks = 0;
			}

			axis.ticks(numberOfTicks);

			if (isTimeScaleType) {
				if (!scale.ticks(numberOfTicks).length) {
					axis.tickValues([]);
				} else {
					const addSpaceOnEdges = Tools.getProperty(
						options,
						"timeScale",
						"addSpaceOnEdges"
					);
					
					const customDomain = Tools.getProperty(
						options,
						"axes",
						axisPosition,
						"domain"
					);

					let tickValues;
					if (addSpaceOnEdges && !customDomain) {
						tickValues = scale.nice(numberOfTicks);
					}
					tickValues = scale.ticks(numberOfTicks);

					// Remove labels on the edges
					// If there are more than 2 labels to show
					if (addSpaceOnEdges && tickValues.length > 2 && !customDomain) {
						tickValues.splice(tickValues.length - 1, 1);
						tickValues.splice(0, 1);
					}

					axis.tickValues(tickValues);
				}
			}
		}

		// create the right ticks formatter
		let formatter;
		const userProvidedFormatter = Tools.getProperty(
			axisOptions,
			"ticks",
			"formatter"
		);
		if (isTimeScaleType) {
			const timeInterval = computeTimeIntervalName(axis.tickValues());
			if (userProvidedFormatter === null) {
				formatter = (t: number, i: number) =>
					formatTick(t, i, timeInterval, timeScaleOptions);
			} else {
				formatter = (t: number, i: number) => {
					const defaultFormattedValue = formatTick(
						t,
						i,
						timeInterval,
						timeScaleOptions
					);
					return userProvidedFormatter(t, i, defaultFormattedValue);
				};
			}
		} else {
			if (userProvidedFormatter === null) {
				if (scaleType === ScaleTypes.LINEAR) {
					formatter = (t) => t.toLocaleString();
				}
			} else {
				formatter = userProvidedFormatter;
			}
		}

		// Set ticks formatter
		axis.tickFormat(formatter);

		// prioritize using a custom array of values rather than number of ticks
		// if both are provided. custom tick values need to be within the domain
		if (userProvidedTickValues) {
			axis.tickValues(userProvidedTickValues);
		}

		// Position and transition the axis
		switch (axisPosition) {
			case AxisPositions.LEFT:
				axisRef.attr("transform", `translate(${this.margins.left}, 0)`);
				break;
			case AxisPositions.BOTTOM:
				axisRef.attr(
					"transform",
					`translate(0, ${height - this.margins.bottom})`
				);
				break;
			case AxisPositions.RIGHT:
				axisRef.attr(
					"transform",
					`translate(${width - this.margins.right}, 0)`
				);
				break;
			case AxisPositions.TOP:
				axisRef.attr("transform", `translate(0, ${this.margins.top})`);
				break;
		}

		// Position the axis title
		// check that data exists, if they don't, doesn't show the title axis
		const isDataEmpty = this.model.isDataEmpty();
		if (axisOptions.title) {
			const axisTitleRef = DOMUtils.appendOrSelect(
				container,
				`text.axis-title`
			).html(isDataEmpty || isDataLoading ? "" : axisOptions.title);

			switch (axisPosition) {
				case AxisPositions.LEFT:
					axisTitleRef
						.attr("transform", "rotate(-90)")
						.attr("y", 0)
						.attr("x", -(scale.range()[0] / 2))
						.attr("dy", "1em")
						.style("text-anchor", "middle");
					break;
				case AxisPositions.BOTTOM:
					axisTitleRef
						.attr(
							"transform",
							`translate(${
								this.margins.left / 2 + scale.range()[1] / 2
							}, ${height})`
						)
						.style("text-anchor", "middle");
					break;
				case AxisPositions.RIGHT:
					axisTitleRef
						.attr("transform", "rotate(90)")
						.attr("y", -width)
						.attr("x", scale.range()[0] / 2)
						.attr("dy", "1em")
						.style("text-anchor", "middle");
					break;
				case AxisPositions.TOP:
					const { height: titleHeight } = DOMUtils.getSVGElementSize(
						axisTitleRef,
						{
							useBBox: true
						}
					);
					axisTitleRef
						.attr(
							"transform",
							`translate(${
								this.margins.left / 2 + scale.range()[1] / 2
							}, ${titleHeight / 2})`
						)
						.style("text-anchor", "middle");
					break;
			}
		}

		// Apply new axis to the axis element
		if (isTimeScaleType) {
			const timeInterval = computeTimeIntervalName(axis.tickValues());
			const showDayName = timeScaleOptions.showDayName;
			const axisRefSelection = axisRef;

			if (animate) {
				axisRef = axisRef.transition(
					this.services.transitions.getTransition(
						"axis-update",
						animate
					)
				);
			}
			axisRef = axisRef.call(axis);

			// Manipulate tick labels to make bold those that are in long format
			const ticks = axisRefSelection
				.selectAll(".tick")
				.data(axis.tickValues(), scale)
				.order()
				.select("text");
			ticks.style("font-weight", (tickValue: number, i: number) => {
				return isTickPrimary(tickValue, i, timeInterval, showDayName)
					? "bold"
					: "normal";
			});
		} else {
			if (!animate || !axisRefExists) {
				axisRef = axisRef.call(axis);
			} else {
				axisRef = axisRef
					.transition(
						this.services.transitions.getTransition("axis-update")
					)
					.call(axis);
			}
		}

		invisibleAxisRef.call(axis);

		if (
			axisPosition === AxisPositions.BOTTOM ||
			axisPosition === AxisPositions.TOP
		) {
			let rotateTicks = false;

			// If we're dealing with a discrete scale type
			// We're able to grab the spacing between the ticks
			if (scale.step) {
				const textNodes = invisibleAxisRef
					.selectAll("g.tick text")
					.nodes();

				// If any ticks are any larger than the scale step size
				rotateTicks = textNodes.some(
					(textNode) =>
						DOMUtils.getSVGElementSize(textNode, { useBBox: true })
							.width >= scale.step()
				);
			} else {
				// When dealing with a continuous scale
				// We need to calculate an estimated size of the ticks
				const minTickSize =
					Tools.getProperty(
						axisOptions,
						"ticks",
						"rotateIfSmallerThan"
					) || Configuration.axis.ticks.rotateIfSmallerThan;
				const ticksNumber = isTimeScaleType
					? axis.tickValues().length
					: scale.ticks().length;
				const estimatedTickSize = width / ticksNumber / 2;
				rotateTicks = isTimeScaleType
					? estimatedTickSize < minTickSize * 2 // datetime tick could be very long
					: estimatedTickSize < minTickSize;
			}
			if (rotateTicks) {
				if (!isNumberOfTicksProvided) {
					axis.ticks(
						this.getNumberOfFittingTicks(
							width,
							tickHeight,
							Configuration.tickSpaceRatioHorizontal
						)
					);

					invisibleAxisRef.call(axis);
					axisRef.call(axis);
				}

				container
					.selectAll("g.ticks g.tick text")
					.attr("transform", `rotate(-45)`)
					.style(
						"text-anchor",
						axisPosition === AxisPositions.TOP ? "start" : "end"
					);
			} else {
				container
					.selectAll("g.ticks g.tick text")
					.attr("transform", null)
					.style("text-anchor", null);
			}
		}

		// we don't need to show axes on empty state and on skeleton state
		// because the Skeleton component draws them
		if (isDataLoading) {
			container.attr("opacity", 0);
		}

		axisRef.selectAll("g.tick").attr("aria-label", (d) => d);

		invisibleAxisRef.selectAll("g.tick").attr("aria-label", (d) => d);

		// truncate the label if it's too long
		// only applies to discrete type
		if (
			truncationType !== TruncationTypes.NONE &&
			axisScaleType === ScaleTypes.LABELS &&
			!userProvidedTickValues
		) {
			const dataGroups = this.model.getDataValuesGroupedByKeys();
			if (dataGroups.length > 0) {
				const activeDataGroups = dataGroups.map(
					(d) => d.sharedStackKey
				);
				const tick_html = svg
					.select(`g.axis.${axisPosition} g.ticks g.tick`)
					.html();

				container.selectAll("g.ticks g.tick").html(tick_html);

				container
					.selectAll("g.tick text")
					.data(activeDataGroups)
					.text(function (d) {
						if (d.length > truncationThreshold) {
							return Tools.truncateLabel(
								d,
								truncationType,
								truncationNumCharacter
							);
						} else {
							return d;
						}
					});

				this.getInvisibleAxisRef()
					.selectAll("g.tick text")
					.data(activeDataGroups)
					.text(function (d) {
						if (d.length > truncationThreshold) {
							return Tools.truncateLabel(
								d,
								truncationType,
								truncationNumCharacter
							);
						} else {
							return d;
						}
					});

				container
					.selectAll("g.ticks")
					.html(this.getInvisibleAxisRef().html());

				container.selectAll("g.tick text").data(activeDataGroups);
			}
		}
		// Add event listeners to elements drawn
		this.addEventListeners();
	}

	addEventListeners() {
		const svg = this.getContainerSVG();
		const { position: axisPosition } = this.configs;
		const container = DOMUtils.appendOrSelect(
			svg,
			`g.axis.${axisPosition}`
		);
		const options = this.model.getOptions();
		const axisOptions = Tools.getProperty(options, "axes", axisPosition);
		const axisScaleType = Tools.getProperty(axisOptions, "scaleType");
		const truncationThreshold = Tools.getProperty(
			axisOptions,
			"truncation",
			"threshold"
		);

		const isTimeScaleType =
			this.scaleType === ScaleTypes.TIME ||
			axisOptions.scaleType === ScaleTypes.TIME;

		const self = this;
		container
			.selectAll("g.tick text")
			.on("mouseover", function (datum) {
				// Dispatch mouse event
				self.services.events.dispatchEvent(
					Events.Axis.LABEL_MOUSEOVER,
					{
						element: select(this),
						datum
					}
				);

				if (
					axisScaleType === ScaleTypes.LABELS &&
					datum.length > truncationThreshold
				) {
					self.services.events.dispatchEvent(Events.Tooltip.SHOW, {
						hoveredElement: select(this),
						content: datum
					});
				}
			})
			.on("mousemove", function (datum) {
				// Dispatch mouse event
				self.services.events.dispatchEvent(
					Events.Axis.LABEL_MOUSEMOVE,
					{
						element: select(this),
						datum
					}
				);
				if (
					axisScaleType === ScaleTypes.LABELS &&
					datum.length > truncationThreshold
				) {
					self.services.events.dispatchEvent(Events.Tooltip.MOVE);
				}
			})
			.on("click", function (datum) {
				// Dispatch mouse event
				self.services.events.dispatchEvent(Events.Axis.LABEL_CLICK, {
					element: select(this),
					datum
				});
			})
			.on("mouseout", function (datum) {
				// Dispatch mouse event
				self.services.events.dispatchEvent(Events.Axis.LABEL_MOUSEOUT, {
					element: select(this),
					datum
				});
				if (axisScaleType === ScaleTypes.LABELS) {
					self.services.events.dispatchEvent(Events.Tooltip.HIDE);
				}
			});
	}

	getInvisibleAxisRef() {
		const { position: axisPosition } = this.configs;

		return this.getContainerSVG().select(
			`g.axis.${axisPosition} g.ticks.invisible`
		);
	}

	getTitleRef() {
		const { position: axisPosition } = this.configs;

		return this.getContainerSVG().select(
			`g.axis.${axisPosition} text.axis-title`
		);
	}

	getNumberOfFittingTicks(size, tickSize, spaceRatio) {
		const numberOfTicksFit = Math.floor(size / (tickSize * spaceRatio));
		return Tools.clamp(
			numberOfTicksFit,
			2,
			Configuration.axis.ticks.number
		);
	}

	destroy() {
		const svg = this.getContainerSVG();
		const { position: axisPosition } = this.configs;
		const container = DOMUtils.appendOrSelect(
			svg,
			`g.axis.${axisPosition}`
		);

		// Remove event listeners
		container
			.selectAll("g.tick text")
			.on("mouseover", null)
			.on("mousemove", null)
			.on("mouseout", null);
	}
}
