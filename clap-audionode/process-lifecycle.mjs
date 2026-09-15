export const CLAP_PROCESS_ERROR = 0;
export const CLAP_PROCESS_CONTINUE = 1;
export const CLAP_PROCESS_CONTINUE_IF_NOT_QUIET = 2;
export const CLAP_PROCESS_TAIL = 3;
export const CLAP_PROCESS_SLEEP = 4;

const audioIsQuiet = ports => {
	let energy = 0;
	for (const port of ports) {
		for (const channel of port) {
			for (const sample of channel) {
				energy += sample*sample;
				if (energy >= 1e-6) return false;
			}
		}
	}
	return true;
};

const clearAudio = ports => {
	for (const port of ports) {
		for (const channel of port) channel.fill(0);
	}
};

// Owns CLAP's process-status and start/stop state machine.
export default class ProcessLifecycle {
	constructor({getTailSamples, takeProcessRequest, advanceSteadyTime, setProcessing}) {
		this.getTailSamples = getTailSamples;
		this.takeProcessRequest = takeProcessRequest;
		this.advanceSteadyTime = advanceSteadyTime;
		this.setProcessing = setProcessing;
	}

	startProcessing() {
		if (!this.setProcessing(true)) {
			throw Error("CLAP start_processing failed while waking plugin");
		}
	}

	// Retains each channel's last sample to detect input variation across blocks.
	detectInputVariation(inputs, scanSamples) {
		let previous = this.inputSnapshot;
		let topologyChanged = !previous || inputs.length !== previous.length;
		for (let portIndex = 0; !topologyChanged && portIndex < inputs.length; ++portIndex) {
			topologyChanged = inputs[portIndex].length !== previous[portIndex].length;
		}

		let snapshot = topologyChanged
			? inputs.map(port => new Array(port.length))
			: previous;
		let changed = topologyChanged;
		for (let portIndex = 0; portIndex < inputs.length; ++portIndex) {
			for (let channelIndex = 0; channelIndex < inputs[portIndex].length; ++channelIndex) {
				let channel = inputs[portIndex][channelIndex];
				let priorSample = topologyChanged ? undefined : snapshot[portIndex][channelIndex];
				if (scanSamples && !changed) {
					for (let sample of channel) {
						if (sample !== priorSample) {
							changed = true;
							break;
						}
						priorSample = sample;
					}
				}
				if (channel.length) priorSample = channel[channel.length - 1];
				snapshot[portIndex][channelIndex] = priorSample;
			}
		}
		this.inputSnapshot = snapshot;
		return changed;
	}

	pause() {
		if (this.paused) return;
		if (!this.sleeping) this.setProcessing(false);
		this.paused = true;
	}

	resume() {
		if (!this.paused) return;
		if (!this.sleeping) this.startProcessing();
		this.paused = false;
	}

	wake() {
		this.wakeRequested = true;
	}

	process({frameCount, inputs, outputs, hasEvents, processBlock}) {
		if (this.paused) {
			this.advanceSteadyTime(frameCount);
			return null;
		}

		let processRequested = this.takeProcessRequest();
		if (this.wakeRequested) {
			processRequested = true;
			this.wakeRequested = false;
		}
		const inputChanged = this.detectInputVariation(inputs, this.sleeping);
		const inputActivity = this.sleeping
			? inputChanged
			: this.lastStatus === CLAP_PROCESS_TAIL && !audioIsQuiet(inputs);
		const hasActivity = hasEvents || inputActivity || processRequested;

		if (this.sleeping && !hasActivity) {
			this.advanceSteadyTime(frameCount);
			return null;
		}

		if (this.sleeping) {
			this.startProcessing();
			this.sleeping = false;
		}

		let status;
		try {
			status = processBlock();
		} catch (e) {
			this.setProcessing(false);
			throw e;
		}
		this.applyStatus(status, frameCount, hasActivity, outputs);
		return status;
	}

	applyStatus(status, frameCount, hasActivity, outputs) {
		let shouldSleep = false;
		switch (status) {
			case CLAP_PROCESS_CONTINUE:
				this.tailElapsed = 0;
				break;
			case CLAP_PROCESS_CONTINUE_IF_NOT_QUIET:
				this.tailElapsed = 0;
				shouldSleep = audioIsQuiet(outputs);
				break;
			case CLAP_PROCESS_TAIL: {
				const samples = this.getTailSamples() >>> 0;
				if (hasActivity || this.lastStatus !== CLAP_PROCESS_TAIL) {
					this.tailElapsed = 0;
				} else {
					this.tailElapsed += frameCount;
				}
				if (samples >= 0x7fffffff) break;
				// Finish the block which reaches the tail limit before sleeping,
				// a conservative block-level policy which avoids truncation.
				shouldSleep = this.tailElapsed >= samples;
				break;
			}
			case CLAP_PROCESS_SLEEP:
				this.tailElapsed = 0;
				shouldSleep = true;
				break;
			case CLAP_PROCESS_ERROR:
				clearAudio(outputs);
				shouldSleep = true;
				break;
			default:
				this.setProcessing(false);
				throw Error(`Unknown CLAP process status: ${status}`);
		}
		this.lastStatus = status;
		if (shouldSleep) {
			this.setProcessing(false);
			this.sleeping = true;
		}
	}

	paused = false;
	sleeping = false;
	wakeRequested = false;
	tailElapsed = 0;
	lastStatus = CLAP_PROCESS_CONTINUE;
	inputSnapshot = null;
}
