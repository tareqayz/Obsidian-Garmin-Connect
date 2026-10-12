import type { Component } from "svelte";
import type { PerformanceStatPageId } from "../../../dashboard/performance-stats";
import type { PerformanceStatRoute } from "../../../dashboard/routes";
import type { StatPageProps } from "../health/pages";
import EnduranceScorePage from "../endurance-score/EnduranceScorePage.svelte";
import FtpPage from "../ftp/FtpPage.svelte";
import HeatAcclimationPage from "../heat-acclimation/HeatAcclimationPage.svelte";
import HillScorePage from "../hill-score/HillScorePage.svelte";
import HrvStatusPage from "../hrv-status/HrvStatusPage.svelte";
import RacePredictorPage from "../race-predictor/RacePredictorPage.svelte";
import RunningLactateThresholdPage from "../running-lactate-threshold/RunningLactateThresholdPage.svelte";
import RunningTolerancePage from "../running-tolerance/RunningTolerancePage.svelte";
import TrainingEffectPage from "../training-effect/TrainingEffectPage.svelte";
import TrainingLoadPage from "../training-load/TrainingLoadPage.svelte";
import TrainingReadinessPage from "../training-readiness/TrainingReadinessPage.svelte";
import TrainingStatusPage from "../training-status/TrainingStatusPage.svelte";
import Vo2MaxPage from "../vo2-max/Vo2MaxPage.svelte";

/** A Performance Stats page's props: the same as a Health Stats page's, on its own route. */
export type PerformanceStatPageProps = StatPageProps<PerformanceStatRoute>;

/**
 * Every Performance Stats page built so far, by stat. One line per stat, its
 * page in `src/ui/svelte/<stat>/`:
 *
 *   import Vo2MaxPage from "../vo2-max/Vo2MaxPage.svelte";
 *   export const PERFORMANCE_PAGES: … = { "vo2-max": Vo2MaxPage };
 *
 * A stat appears in the Performance Stats hub, gets an "Open <stat>" command
 * and opens from its At a Glance and In Focus cards once it is here; the
 * hub and More's row show once one of the hub's stats is. Load and Heat
 * Acclimation (`hub: false`) open only from Training Status and their cards.
 */
export const PERFORMANCE_PAGES: Partial<Record<PerformanceStatPageId, Component<PerformanceStatPageProps>>> = {
	"vo2-max": Vo2MaxPage,
	"hill-score": HillScorePage,
	"hrv-status": HrvStatusPage,
	"race-predictor": RacePredictorPage,
	"training-status": TrainingStatusPage,
	"endurance-score": EnduranceScorePage,
	"training-load": TrainingLoadPage,
	"heat-acclimation": HeatAcclimationPage,
	"training-readiness": TrainingReadinessPage,
	"training-effect": TrainingEffectPage,
	"running-tolerance": RunningTolerancePage,
	ftp: FtpPage,
	"running-lactate-threshold": RunningLactateThresholdPage,
};
