import { titleCase } from "./day";

/**
 * Garmin's activity types, as the app names and groups them: every type of
 * the tree `/activity-service/activity/activityTypes` returns (154 under the
 * root `all`, 17), with the app's English name, the filter group All
 * Activities' sheet lists it under, its place in that group and its card's
 * disc. Generated on 2026-10-15 from `ref/activities/all-activities/types.json`
 * (the spec: names from the phone, else the web's type select; five Inferred);
 * edit by hand since. `api:check` on `activity-types` tells when Garmin's tree
 * moves from it.
 *
 * A type the table lacks (one Garmin adds later) is named from its key and
 * grouped by its parent; failing that it is Other.
 *
 * Pure.
 */

/** A card disc's colour, by name: the page maps it to `--color-<name>` (neutral: the border colour). */
export type DiscColour = "orange" | "green" | "blue" | "cyan" | "red" | "neutral";

export interface ActivityType {
	id: number;
	/** Garmin's typeKey: `road_biking`. */
	key: string;
	/** The app's name: "Road Cycling". */
	name: string;
	/** The next type up Garmin's tree (17, `all`, for the groups). */
	parent?: number;
	/** The filter group's type id (`FILTER_GROUPS`); absent only for the root. */
	group?: number;
	/** Its row in the group: 0 is the group's own ("All <Group>"), its sub-types follow by name. */
	order?: number;
	/** Never listed in the sheet: the root, and Steps (108), which "All Other" still selects. */
	hidden?: true;
	/** The card disc, where the phone (or the web, for its hue) shows one; else the group's or neutral. */
	disc?: DiscColour;
}

export const ACTIVITY_TYPES: readonly ActivityType[] = [
	{ id: 1, key: "running", name: "Running", parent: 17, group: 1, order: 0, disc: "orange" },
	{ id: 2, key: "cycling", name: "Cycling", parent: 17, group: 2, order: 0, disc: "green" },
	{ id: 3, key: "hiking", name: "Hiking", parent: 17, group: 3, order: 0, disc: "red" },
	{ id: 4, key: "other", name: "Other", parent: 17, group: 4, order: 0 },
	{ id: 5, key: "mountain_biking", name: "Mountain Biking", parent: 2, group: 2, order: 9, disc: "green" },
	{ id: 6, key: "trail_running", name: "Trail Running", parent: 1, group: 1, order: 5, disc: "orange" },
	{ id: 7, key: "street_running", name: "Street Running", parent: 1, group: 1, order: 3, disc: "orange" },
	{ id: 8, key: "track_running", name: "Track Running", parent: 1, group: 1, order: 4, disc: "orange" },
	{ id: 9, key: "walking", name: "Walking", parent: 17, group: 9, order: 0 },
	{ id: 10, key: "road_biking", name: "Road Cycling", parent: 2, group: 2, order: 11, disc: "green" },
	{ id: 11, key: "indoor_cardio", name: "Cardio", parent: 29, group: 29, order: 2, disc: "orange" },
	{ id: 13, key: "strength_training", name: "Strength Training", parent: 29, group: 29, order: 14, disc: "orange" },
	{ id: 15, key: "casual_walking", name: "Casual Walking", parent: 9, group: 9, order: 1 },
	{ id: 16, key: "speed_walking", name: "Speed Walking", parent: 9, group: 9, order: 2 },
	{ id: 17, key: "all", name: "All", hidden: true },
	{ id: 18, key: "treadmill_running", name: "Treadmill Running", parent: 1, group: 1, order: 6, disc: "orange" },
	{ id: 19, key: "cyclocross", name: "Cyclocross", parent: 2, group: 2, order: 2, disc: "green" },
	{ id: 20, key: "downhill_biking", name: "Downhill Biking", parent: 2, group: 2, order: 3, disc: "green" },
	{ id: 21, key: "track_cycling", name: "Track Cycling", parent: 2, group: 2, order: 12, disc: "green" },
	{ id: 22, key: "recumbent_cycling", name: "Recumbent Cycling", parent: 2, group: 2, order: 10, disc: "green" },
	{ id: 25, key: "indoor_cycling", name: "Indoor Cycling", parent: 2, group: 2, order: 7, disc: "green" },
	{ id: 26, key: "swimming", name: "Swimming", parent: 17, group: 26, order: 0, disc: "blue" },
	{ id: 27, key: "lap_swimming", name: "Pool Swimming", parent: 26, group: 26, order: 2, disc: "blue" },
	{ id: 28, key: "open_water_swimming", name: "Open Water Swimming", parent: 26, group: 26, order: 1, disc: "blue" },
	{ id: 29, key: "fitness_equipment", name: "Gym & Fitness Equipment", parent: 17, group: 29, order: 0, disc: "orange" },
	{ id: 30, key: "elliptical", name: "Elliptical", parent: 29, group: 29, order: 4, disc: "orange" },
	{ id: 31, key: "stair_climbing", name: "Stair Stepper", parent: 29, group: 29, order: 13, disc: "orange" },
	{ id: 32, key: "indoor_rowing", name: "Indoor Rowing", parent: 29, group: 29, order: 8, disc: "orange" },
	{ id: 37, key: "mountaineering", name: "Mountaineering", parent: 4, group: 4, order: 22 },
	{ id: 41, key: "wind_kite_surfing", name: "Wind/Kite Surfing", parent: 4, group: 4, order: 32 },
	{ id: 44, key: "horseback_riding", name: "Horseback Riding", parent: 4, group: 4, order: 14 },
	{ id: 49, key: "driving_general", name: "Driving", parent: 4, group: 4, order: 8 },
	{ id: 52, key: "flying", name: "Flying", parent: 4, group: 4, order: 10 },
	{ id: 60, key: "whitewater_rafting_kayaking", name: "Whitewater Kayaking/Rafting", parent: 4, group: 4, order: 31 },
	{ id: 63, key: "inline_skating", name: "Inline Skating", parent: 4, group: 4, order: 17 },
	{ id: 88, key: "golf", name: "Golf", parent: 4, group: 4, order: 12 },
	{ id: 89, key: "multi_sport", name: "Multisport", parent: 17, group: 89, order: 0, disc: "red" },
	{ id: 108, key: "steps", name: "Steps", parent: 17, group: 4, hidden: true },
	{ id: 131, key: "bmx", name: "BMX", parent: 2, group: 2, order: 1, disc: "green" },
	{ id: 133, key: "hunting_fishing", name: "Hunting/Fishing", parent: 4, group: 4, order: 16 },
	{ id: 134, key: "sky_diving", name: "Sky Diving", parent: 4, group: 4, order: 27 },
	{ id: 136, key: "rc_drone", name: "RC/Drone", parent: 4, group: 4, order: 24 },
	{ id: 139, key: "rock_climbing", name: "Rock Climbing", parent: 4, group: 4, order: 25 },
	{ id: 140, key: "hang_gliding", name: "Hang Gliding", parent: 4, group: 4, order: 13 },
	{ id: 141, key: "wingsuit_flying", name: "Wingsuit Flying", parent: 4, group: 4, order: 33 },
	{ id: 143, key: "gravel_cycling", name: "Gravel/Unpaved Cycling", parent: 2, group: 2, order: 5, disc: "green" },
	{ id: 144, key: "diving", name: "Diving", parent: 17, group: 144, order: 0 },
	{ id: 145, key: "single_gas_diving", name: "Single Gas Diving", parent: 144, group: 144, order: 7 },
	{ id: 146, key: "multi_gas_diving", name: "Multi-Gas Diving", parent: 144, group: 144, order: 5 },
	{ id: 147, key: "gauge_diving", name: "Gauge Diving", parent: 144, group: 144, order: 4 },
	{ id: 148, key: "apnea_diving", name: "Apnea Diving", parent: 144, group: 144, order: 1 },
	{ id: 150, key: "floor_climbing", name: "Floor Climbing", parent: 4, group: 4, order: 9 },
	{ id: 151, key: "stop_watch", name: "Stopwatch", parent: 4, group: 4, order: 28 },
	{ id: 152, key: "virtual_ride", name: "Virtual Ride", parent: 2, group: 2, order: 13, disc: "green" },
	{ id: 153, key: "virtual_run", name: "Virtual Run", parent: 1, group: 1, order: 8, disc: "orange" },
	{ id: 154, key: "obstacle_run", name: "Obstacle Course Racing", parent: 1, group: 1, order: 2, disc: "orange" },
	{ id: 155, key: "apnea_hunting", name: "Apnea Hunt", parent: 144, group: 144, order: 2 },
	{ id: 156, key: "indoor_running", name: "Indoor Running", parent: 1, group: 1, order: 1, disc: "orange" },
	{ id: 157, key: "safety", name: "Safety", parent: 17, group: 157, order: 0 },
	{ id: 158, key: "assistance", name: "Assistance", parent: 157, group: 157, order: 1 },
	{ id: 159, key: "incident_detected", name: "Incident Detected", parent: 157, group: 157, order: 3 },
	{ id: 160, key: "pilates", name: "Pilates", parent: 29, group: 29, order: 12, disc: "cyan" },
	{ id: 161, key: "ccr_diving", name: "CCR", parent: 144, group: 144, order: 3 },
	{ id: 162, key: "auto_racing", name: "Auto Racing", parent: 4, group: 4, order: 3 },
	{ id: 163, key: "yoga", name: "Yoga", parent: 29, group: 29, order: 15, disc: "cyan" },
	{ id: 164, key: "breathwork", name: "Breathwork", parent: 4, group: 4, order: 6, disc: "cyan" },
	{ id: 165, key: "winter_sports", name: "Winter Sports", parent: 17, group: 165, order: 0 },
	{ id: 166, key: "snowmobiling_ws", name: "Snowmobiling", parent: 165, group: 165, order: 10 },
	{ id: 167, key: "snow_shoe_ws", name: "Snowshoeing", parent: 165, group: 165, order: 11 },
	{ id: 168, key: "skating_ws", name: "Skating", parent: 165, group: 165, order: 9 },
	{ id: 169, key: "backcountry_skiing_snowboarding_ws", name: "Backcountry Skiing/Snowboarding", parent: 165, group: 165, order: 2 },
	{ id: 170, key: "skate_skiing_ws", name: "Cross Country Skate Skiing", parent: 165, group: 165, order: 5 },
	{ id: 171, key: "cross_country_skiing_ws", name: "Cross Country Classic Skiing", parent: 165, group: 165, order: 4 },
	{ id: 172, key: "resort_skiing_snowboarding_ws", name: "Resort Skiing or Snowboarding", parent: 165, group: 165, order: 7 },
	{ id: 173, key: "indoor_climbing", name: "Indoor Climbing", parent: 29, group: 29, order: 6, disc: "orange" },
	{ id: 174, key: "bouldering", name: "Bouldering", parent: 29, group: 29, order: 1, disc: "orange" },
	{ id: 175, key: "e_bike_mountain", name: "eMountain Biking", parent: 2, group: 2, order: 16, disc: "green" },
	{ id: 176, key: "e_bike_fitness", name: "eBiking", parent: 2, group: 2, order: 14, disc: "green" },
	{ id: 180, key: "hiit", name: "HIIT", parent: 29, group: 29, order: 5, disc: "orange" },
	{ id: 181, key: "ultra_run", name: "Ultra Run", parent: 1, group: 1, order: 7, disc: "orange" },
	{ id: 182, key: "e_sport", name: "Gaming", parent: 4, group: 4, order: 11 },
	{ id: 185, key: "motorcycling_v2", name: "Motorcycling", parent: 4, group: 4, order: 21 },
	{ id: 186, key: "motocross_v2", name: "Motocross", parent: 4, group: 4, order: 20 },
	{ id: 187, key: "atv_v2", name: "ATV", parent: 4, group: 4, order: 1 },
	{ id: 189, key: "transition_v2", name: "Transition", parent: 4, group: 4, order: 30, disc: "red" },
	{ id: 190, key: "swimToBikeTransition_v2", name: "Swim to Bike Transition", parent: 4, group: 4, order: 29 },
	{ id: 191, key: "bikeToRunTransition_v2", name: "Bike to Run Transition", parent: 4, group: 4, order: 4 },
	{ id: 192, key: "runToBikeTransition_v2", name: "Run to Bike Transition", parent: 4, group: 4, order: 26 },
	{ id: 193, key: "hunting", name: "Hunting", parent: 4, group: 4, order: 15 },
	{ id: 197, key: "hand_cycling", name: "Handcycling", parent: 2, group: 2, order: 6, disc: "green" },
	{ id: 198, key: "indoor_hand_cycling", name: "Indoor Handcycling", parent: 2, group: 2, order: 8, disc: "green" },
	{ id: 199, key: "para_sports", name: "Parasports", parent: 17, group: 199, order: 0 },
	{ id: 200, key: "wheelchair_push_run", name: "Pushing - Run Speed", parent: 199, group: 199, order: 1 },
	{ id: 201, key: "wheelchair_push_walk", name: "Pushing - Walk Speed", parent: 199, group: 199, order: 2 },
	{ id: 202, key: "meditation", name: "Meditation", parent: 4, group: 4, order: 18, disc: "cyan" },
	{ id: 203, key: "backcountry_skiing", name: "Backcountry Skiing", parent: 165, group: 165, order: 1 },
	{ id: 204, key: "backcountry_snowboarding", name: "Backcountry Snowboarding", parent: 165, group: 165, order: 3 },
	{ id: 205, key: "disc_golf", name: "Disc Golf", parent: 4, group: 4, order: 7 },
	{ id: 206, key: "team_sports", name: "Team Sports", parent: 17, group: 206, order: 0 },
	{ id: 207, key: "cricket", name: "Cricket", parent: 206, group: 206, order: 4 },
	{ id: 208, key: "rugby", name: "Rugby", parent: 206, group: 206, order: 8 },
	{ id: 209, key: "ice_hockey", name: "Ice Hockey", parent: 206, group: 206, order: 6 },
	{ id: 210, key: "field_hockey", name: "Field Hockey", parent: 206, group: 206, order: 5 },
	{ id: 211, key: "lacrosse", name: "Lacrosse", parent: 206, group: 206, order: 7 },
	{ id: 212, key: "volleyball", name: "Volleyball", parent: 206, group: 206, order: 12 },
	{ id: 213, key: "ultimate_disc", name: "Ultimate Disc", parent: 206, group: 206, order: 11 },
	{ id: 214, key: "softball", name: "Softball", parent: 206, group: 206, order: 10 },
	{ id: 215, key: "soccer", name: "Soccer/Football", parent: 206, group: 206, order: 9 },
	{ id: 216, key: "american_football", name: "American Football", parent: 206, group: 206, order: 1 },
	{ id: 217, key: "basketball", name: "Basketball", parent: 206, group: 206, order: 3 },
	{ id: 218, key: "baseball", name: "Baseball", parent: 206, group: 206, order: 2 },
	{ id: 219, key: "racket_sports", name: "Racket Sports", parent: 17, group: 219, order: 0 },
	{ id: 220, key: "table_tennis", name: "Table Tennis", parent: 219, group: 219, order: 7 },
	{ id: 221, key: "platform_tennis", name: "Platform Tennis", parent: 219, group: 219, order: 4 },
	{ id: 222, key: "racquetball", name: "Racquetball", parent: 219, group: 219, order: 5 },
	{ id: 223, key: "squash", name: "Squash", parent: 219, group: 219, order: 6 },
	{ id: 224, key: "badminton", name: "Badminton", parent: 219, group: 219, order: 1 },
	{ id: 225, key: "pickleball", name: "Pickleball", parent: 219, group: 219, order: 3 },
	{ id: 226, key: "paddelball", name: "Padel", parent: 219, group: 219, order: 2 },
	{ id: 227, key: "tennis_v2", name: "Tennis", parent: 219, group: 219, order: 8 },
	{ id: 228, key: "water_sports", name: "Water Sports", parent: 17, group: 228, order: 0 },
	{ id: 229, key: "boating_v2", name: "Boating", parent: 228, group: 228, order: 1 },
	{ id: 230, key: "fishing_v2", name: "Fishing", parent: 228, group: 228, order: 3 },
	{ id: 231, key: "kayaking_v2", name: "Kayaking", parent: 228, group: 228, order: 4 },
	{ id: 232, key: "kiteboarding_v2", name: "Kiteboarding", parent: 228, group: 228, order: 5 },
	{ id: 233, key: "offshore_grinding_v2", name: "Offshore Grinding", parent: 228, group: 228, order: 6 },
	{ id: 234, key: "onshore_grinding_v2", name: "Onshore Grinding", parent: 29, group: 29, order: 11, disc: "orange" },
	{ id: 235, key: "paddling_v2", name: "Canoeing", parent: 228, group: 228, order: 2 },
	{ id: 236, key: "whitewater_rafting_v2", name: "Whitewater", parent: 228, group: 228, order: 16 },
	{ id: 237, key: "rowing_v2", name: "Rowing", parent: 228, group: 228, order: 7 },
	{ id: 238, key: "sailing_v2", name: "Sailing", parent: 228, group: 228, order: 8 },
	{ id: 239, key: "stand_up_paddleboarding_v2", name: "Stand Up Paddleboarding", parent: 228, group: 228, order: 10 },
	{ id: 240, key: "surfing_v2", name: "Surfing", parent: 228, group: 228, order: 11 },
	{ id: 241, key: "water_tubing", name: "Tubing", parent: 228, group: 228, order: 12 },
	{ id: 242, key: "windsurfing_v2", name: "Windsurfing", parent: 228, group: 228, order: 17 },
	{ id: 243, key: "wakeboarding_v2", name: "Wakeboarding", parent: 228, group: 228, order: 13 },
	{ id: 244, key: "wakesurfing", name: "Wakesurfing", parent: 228, group: 228, order: 14 },
	{ id: 245, key: "waterskiing", name: "Waterskiing", parent: 228, group: 228, order: 15 },
	{ id: 246, key: "boxing", name: "Boxing", parent: 4, group: 4, order: 5 },
	{ id: 247, key: "archery", name: "Archery", parent: 4, group: 4, order: 2 },
	{ id: 248, key: "mixed_martial_arts", name: "Mixed Martial Arts", parent: 4, group: 4, order: 19 },
	{ id: 249, key: "overland", name: "Overland", parent: 4, group: 4, order: 23 },
	{ id: 250, key: "snorkeling", name: "Snorkeling", parent: 228, group: 228, order: 9 },
	{ id: 251, key: "resort_skiing", name: "Resort Skiing", parent: 165, group: 165, order: 6 },
	{ id: 252, key: "resort_snowboarding", name: "Resort Snowboarding", parent: 165, group: 165, order: 8 },
	{ id: 253, key: "dance", name: "Dance Fitness", parent: 29, group: 29, order: 3, disc: "orange" },
	{ id: 254, key: "jump_rope", name: "Jump Rope", parent: 29, group: 29, order: 9, disc: "orange" },
	{ id: 255, key: "mobility", name: "Mobility", parent: 29, group: 29, order: 10, disc: "orange" },
	{ id: 256, key: "enduro_mtb", name: "Enduro Mountain Biking", parent: 2, group: 2, order: 4, disc: "green" },
	{ id: 257, key: "rucking", name: "Rucking", parent: 3, group: 3, order: 1, disc: "red" },
	{ id: 259, key: "pool_apnea", name: "Pool Apnea", parent: 144, group: 144, order: 6 },
	{ id: 260, key: "e_enduro_mtb", name: "eEnduro Mountain Biking", parent: 2, group: 2, order: 15, disc: "green" },
	{ id: 262, key: "fall_detected", name: "Fall Detected", parent: 157, group: 157, order: 2 },
	{ id: 263, key: "cross_country_indoor_skiing", name: "Indoor Cross Country Skiing", parent: 29, group: 29, order: 7, disc: "orange" },
];

/** All Activities' filter groups, in the sheet's order: the first five always, the rest after "Show All". */
export const FILTER_GROUPS: readonly number[] = [1, 2, 29, 26, 9, 3, 89, 144, 165, 199, 228, 206, 219, 4, 157];
/** How many groups the sheet lists before "Show All". */
export const SHOWN_GROUPS = 5;
/** Other: where a type nothing else claims is filed. */
export const OTHER_GROUP = 4;

const BY_ID = new Map(ACTIVITY_TYPES.map((t) => [t.id, t]));
const BY_KEY = new Map(ACTIVITY_TYPES.map((t) => [t.key, t]));

/** An activity's type, by its id or else its key. */
export function activityType(row: { type: string; typeId?: number }): ActivityType | undefined {
	return (row.typeId !== undefined ? BY_ID.get(row.typeId) : undefined) ?? BY_KEY.get(row.type);
}

/** A type by its id. */
export function typeById(id: number): ActivityType | undefined {
	return BY_ID.get(id);
}

/** The app's name for a type: "Pool Swimming", "Stair Stepper"; an unknown key in title case. */
export function typeName(row: { type: string; typeId?: number }): string {
	return activityType(row)?.name ?? titleCase(row.type) ?? "Activity";
}

/** The filter group a type sits in: its own, its parent's for a type the table lacks, else Other. */
export function groupOf(row: { type: string; typeId?: number; parentTypeId?: number }): number {
	const known = activityType(row);
	if (known?.group !== undefined) return known.group;
	const parent = row.parentTypeId !== undefined ? BY_ID.get(row.parentTypeId) : undefined;
	return parent?.group ?? OTHER_GROUP;
}

/** A group's name: "Gym & Fitness Equipment". */
export function groupName(group: number): string {
	return BY_ID.get(group)?.name ?? "Other";
}

/** A group's sub-types in the sheet's order, not the group itself or what the sheet hides. */
export function subTypes(group: number): ActivityType[] {
	return ACTIVITY_TYPES.filter((t) => t.group === group && t.id !== group && !t.hidden).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** A card's disc: the type's own colour, else its group's, else neutral. */
export function discOf(row: { type: string; typeId?: number; parentTypeId?: number }): DiscColour {
	return activityType(row)?.disc ?? BY_ID.get(groupOf(row))?.disc ?? "neutral";
}
