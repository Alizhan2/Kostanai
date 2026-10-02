"""Train a portable classifier on synthetic or chronologically split telemetry."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import (average_precision_score, brier_score_loss,
                            confusion_matrix, f1_score, precision_score,
                            recall_score, roc_auc_score)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.inspection import permutation_importance

ROOT = Path(__file__).resolve().parents[1]
SEED = 20261002
FEATURES = ["buffer", "demand_per_hour", "supply_per_hour", "net_deficit_per_hour",
            "coverage_minutes", "buffer_trend_per_hour", "flow_std_per_hour", "mean_flow_per_hour"]


def metrics(y, probability, threshold):
    prediction = np.asarray(probability) >= threshold
    return {
        "roc_auc": float(roc_auc_score(y, probability)),
        "average_precision": float(average_precision_score(y, probability)),
        "brier_score": float(brier_score_loss(y, probability)),
        "precision": float(precision_score(y, prediction, zero_division=0)),
        "recall": float(recall_score(y, prediction, zero_division=0)),
        "f1": float(f1_score(y, prediction, zero_division=0)),
        "threshold": float(threshold),
        "confusion_matrix": confusion_matrix(y, prediction, labels=[0, 1]).tolist(),
        "confusion_order": ["no_stop", "stop"],
        "rows": int(len(y)), "positive_rate": float(np.mean(y)),
    }


def select_threshold(y, p):
    # Alert threshold is selected exclusively on validation, never holdout.
    options = []
    for threshold in np.linspace(.02, .98, 97):
        m = metrics(y, p, threshold)
        if m["recall"] >= .85:
            options.append(m)
    if not options:
        raise ValueError("No threshold achieved validation recall >= 0.85; revise the model or alert objective.")
    return max(options, key=lambda m: (m["precision"], m["threshold"]))["threshold"]


def export_trees(forest):
    result = []
    for estimator in forest.estimators_:
        tree = estimator.tree_
        counts = tree.value[:, 0, :]
        probabilities = counts[:, 1] / counts.sum(axis=1)
        result.append({
            "left": tree.children_left.tolist(), "right": tree.children_right.tolist(),
            "feature": tree.feature.tolist(), "threshold": tree.threshold.tolist(),
            "probability": probabilities.tolist(),
        })
    return result


def grouped_intervals(frame, probability, threshold):
    # Cluster bootstrap: an entire held-out episode is the resampling unit.
    rng = np.random.default_rng(SEED)
    groups = frame.episode_id.unique()
    indices = {g: np.flatnonzero(frame.episode_id.to_numpy() == g) for g in groups}
    scores = []
    y = frame.stop_within_60m.to_numpy()
    for _ in range(150):
        sample = np.concatenate([indices[g] for g in rng.choice(groups, len(groups), replace=True)])
        if len(np.unique(y[sample])) < 2:
            continue
        scores.append(metrics(y[sample], probability[sample], threshold))
    return {key: [float(np.quantile([m[key] for m in scores], .025)),
                  float(np.quantile([m[key] for m in scores], .975))]
            for key in ["roc_auc", "average_precision", "precision", "recall", "brier_score"]}


def split_dataset(data, manifest):
    if manifest["source"] == "synthetic":
        train_idx, rest_idx = next(GroupShuffleSplit(
            n_splits=1, train_size=.6, random_state=SEED).split(data, groups=data.episode_id))
        rest = data.iloc[rest_idx]
        validation_idx, holdout_idx = next(GroupShuffleSplit(
            n_splits=1, train_size=.5, random_state=SEED+1).split(rest, groups=rest.episode_id))
        return (data.iloc[train_idx], rest.iloc[validation_idx], rest.iloc[holdout_idx]), (
            "Whole independent synthetic episodes: 60% train, 20% calibration/threshold, 20% untouched holdout.")
    if manifest["source"] != "observed" or manifest.get("splitMethod") != "chronological_whole_episodes":
        raise ValueError("Observed data require chronological whole-episode splits from prepare-telemetry.js.")
    if set(data["split"].unique()) != {"train", "validation", "holdout"}:
        raise ValueError("All three chronological splits must contain eligible observations.")
    if data.groupby("episode_id")["split"].nunique().max() != 1:
        raise ValueError("An episode belongs to multiple splits.")
    timestamps = pd.to_datetime(data.timestamp, utc=True, errors="raise")
    if not np.allclose(timestamps.astype("int64").to_numpy()/60_000_000_000,
                       data.minute.to_numpy(), rtol=0, atol=1e-6):
        raise ValueError("Timestamp and minute columns differ.")
    train_end, validation_end = pd.Timestamp(manifest["trainEnd"]), pd.Timestamp(manifest["validationEnd"])
    if train_end.tzinfo is None or validation_end.tzinfo is None or train_end >= validation_end:
        raise ValueError("Chronological cutoffs require ordered timezone-aware timestamps.")
    horizon = pd.Timedelta(minutes=manifest["horizonMinutes"])
    valid = ((data["split"].eq("train") & (timestamps+horizon < train_end)) |
             (data["split"].eq("validation") & (timestamps >= train_end) & (timestamps+horizon < validation_end)) |
             (data["split"].eq("holdout") & (timestamps >= validation_end)))
    if not valid.all():
        raise ValueError("A forecast window crosses its chronological split boundary.")
    return tuple(data[data["split"].eq(label)] for label in ["train", "validation", "holdout"]), (
        "Chronological whole episodes; crossing episodes discarded; label horizons contained in each period.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=ROOT / "ml/data/training.csv")
    parser.add_argument("--manifest", type=Path, default=ROOT / "ml/data/manifest.json")
    parser.add_argument("--output-dir", type=Path,
                        help="Parent directory for models/ and results/; required under ml/local for observed data.")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    digest = hashlib.sha256(args.data.read_bytes()).hexdigest()
    if digest != manifest["sha256"]:
        raise ValueError("Dataset checksum differs from the source manifest.")
    data = pd.read_csv(args.data, dtype={"episode_id": str}, keep_default_na=False)
    names = manifest["features"]
    if names != FEATURES or manifest["target"] != "stop_within_60m" or manifest["horizonMinutes"] != 60:
        raise ValueError("Unsupported feature schema, target or forecast horizon.")
    if data.episode_id.isna().any() or not np.isfinite(data.minute.to_numpy()).all():
        raise ValueError("Every observation requires an episode ID and finite time.")
    if not np.isfinite(data[names].to_numpy()).all():
        raise ValueError("Feature values must be finite.")
    if set(data.stop_within_60m.unique()) != {0, 1}:
        raise ValueError("Both target classes are required.")
    if data.duplicated(["episode_id", "minute"]).any():
        raise ValueError("Duplicate observations in an episode.")
    # Preserve the original numeric group ordering for reproducible synthetic splits.
    if manifest["source"] == "synthetic":
        data["episode_id"] = pd.to_numeric(data.episode_id, errors="raise").astype(int)
    (train, validation, holdout), split_method = split_dataset(data, manifest)
    group_sets = [set(f.episode_id) for f in (train, validation, holdout)]
    if any(group_sets[i] & group_sets[j] for i in range(3) for j in range(i+1, 3)):
        raise ValueError("Episodes overlap between splits.")
    for label, frame in zip(["train", "validation", "holdout"], [train, validation, holdout]):
        if set(frame.stop_within_60m.unique()) != {0, 1}:
            raise ValueError(f"Both target classes are required in {label}; change the cutoffs or obtain more data.")
    observed = manifest["source"] == "observed"
    output_root = args.output_dir.resolve() if args.output_dir else ROOT
    if observed and (not args.output_dir or not output_root.is_relative_to(ROOT / "ml/local")):
        raise ValueError("Observed training requires --output-dir under ml/local; demo artifacts must stay separate.")
    if observed and output_root.exists() and any(output_root.iterdir()):
        raise ValueError("Observed output directory is not empty; select a new directory.")
    forest = RandomForestClassifier(n_estimators=64, max_depth=8, min_samples_leaf=20,
                                    max_features=.8, n_jobs=2, random_state=SEED)
    forest.fit(train[names], train.stop_within_60m)
    validation_raw = forest.predict_proba(validation[names])[:, 1]
    calibration = IsotonicRegression(out_of_bounds="clip")
    calibration.fit(validation_raw, validation.stop_within_60m)
    validation_probability = calibration.predict(validation_raw)
    threshold = select_threshold(validation.stop_within_60m, validation_probability)
    holdout_raw = forest.predict_proba(holdout[names])[:, 1]
    probability = calibration.predict(holdout_raw)
    # Physics baseline assumes the currently observed flows remain constant.
    gap = holdout.net_deficit_per_hour.to_numpy()
    horizon = np.divide(holdout.buffer.to_numpy()*60, gap,
                        out=np.full(len(gap), np.inf), where=gap>0)
    baseline = (horizon <= manifest["horizonMinutes"]).astype(float)
    importance = permutation_importance(forest, validation[names], validation.stop_within_60m,
                                        scoring="average_precision", n_repeats=4, random_state=SEED,
                                        n_jobs=2)
    report = {
        "model_id": "allur-buffer-rf-observed-v1" if observed else "allur-buffer-rf-v1",
        "source": manifest["source"], "source_verified": manifest.get("sourceVerified", False),
        "seed": SEED, "dataset_sha256": digest, "features": names,
        "target": manifest["target"], "horizon_minutes": manifest["horizonMinutes"],
        "split_method": split_method,
        "split": {label: {"episodes": int(f.episode_id.nunique()), "rows": len(f),
                          "positive_rows": int(f.stop_within_60m.sum())}
                  for label, f in zip(["train", "validation", "holdout"], [train, validation, holdout])},
        "split_episode_ids": {label: sorted(f.episode_id.unique().tolist())
                             for label, f in zip(["train", "validation", "holdout"], [train, validation, holdout])},
        "forest": forest.get_params(),
        "calibration": "Isotonic, validation episodes only",
        "threshold_selection": "Highest precision with recall >= 0.85 on validation.",
        "validation": metrics(validation.stop_within_60m, validation_probability, threshold),
        "holdout": metrics(holdout.stop_within_60m, probability, threshold),
        "holdout_raw_brier_score": float(brier_score_loss(holdout.stop_within_60m, holdout_raw)),
        "baseline": metrics(holdout.stop_within_60m, baseline, .5),
        "baseline_score_type": "Hard 0/1 alert under constant current flows; its AUC/AP are not a continuous probability model.",
        "generated_episodes": None if observed else manifest["episodes"],
        "input_episodes": manifest["episodes"],
        "eligible_episodes": manifest.get("eligibleEpisodes", int(data.episode_id.nunique())),
        "observation_cadences_minutes": manifest.get("observationCadencesMinutes", None if observed else [5]),
        "data_preparation": {key: manifest[key] for key in ["sourceSha256", "trainEnd", "validationEnd",
            "maxGapMinutes", "excluded", "assumptions"] if key in manifest},
        "holdout_cluster_bootstrap_95": grouped_intervals(holdout, probability, threshold),
        "by_regime": {},
        "feature_importance_validation": [
            {"feature": name, "mean_ap_decrease": float(mean), "std": float(std)}
            for name, mean, std in zip(names, importance.importances_mean, importance.importances_std)],
        "libraries": {"numpy": np.__version__, "pandas": pd.__version__, "sklearn": sklearn.__version__},
        "limitations": [("Input provenance and stop labels require confirmation by the data owner; results describe only the supplied held-out period."
                          if observed else "Synthetic trajectories only; not validated on Allur telemetry."),
                       "Predicts buffer exhaustion, not equipment breakdown.",
                       "Assumes no operator replenishment during forecast horizon.",
                       ("Intervention and other-stop windows are excluded; the observed no-intervention cohort can be selected and biased."
                        if observed else "Scores reflect the synthetic stochastic supply generator."),
                       "Validation is shared by calibration and threshold selection; holdout is untouched.",
                       "Correlated observations are clustered by episode; dependence across episodes can remain.",
                       "Observed artifacts are not automatically enabled for browser inference." if observed else
                       "The deployed demo is restricted to synthetic inputs."],
    }
    for regime in sorted(holdout.regime.unique()):
        mask = holdout.regime.to_numpy() == regime
        y = holdout.stop_within_60m.to_numpy()[mask]
        report["by_regime"][regime] = metrics(y, probability[mask], threshold) if len(np.unique(y)) == 2 else {
            "rows": int(mask.sum()), "positive_rows": int(y.sum()), "auc": None}
    model = {
        "schemaVersion": 1, "id": report["model_id"], "source": manifest["source"],
        "horizonMinutes": manifest["horizonMinutes"], "features": names,
        "threshold": threshold, "trainingEpisodes": int(train.episode_id.nunique()),
        "trainingRows": int(len(train)), "datasetSha256": digest,
        "inputBounds": {"buffer": [0, 150], "demand_per_hour": [12, 28], "supply_per_hour": [0, 36],
                        "net_deficit_per_hour": [-24, 28], "coverage_minutes": [0, 750],
                        "buffer_trend_per_hour": [-28, 36], "flow_std_per_hour": [0, 36],
                        "mean_flow_per_hour": [-28, 36]},
        "calibration": {"x": calibration.X_thresholds_.tolist(), "y": calibration.y_thresholds_.tolist()},
        "trees": export_trees(forest),
        "evaluation": report["holdout"],
    }
    if observed:
        model["inputBounds"] = {name: [float(train[name].min()), float(train[name].max())] for name in names}
        model["deploymentApproved"] = False
    out = output_root / "models"; out.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(model, separators=(",", ":"), allow_nan=False)
    (out / "buffer-risk.json").write_text(payload+"\n")
    (out / "buffer-risk.js").write_text(
        "/* Training source: " + manifest["source"] + ". See accompanying results/report.json. */\n"
        "(function(root){root.PlantRiskModel="+payload+";})(typeof globalThis!=='undefined'?globalThis:this);\n")
    results = output_root / "results" if args.output_dir else ROOT / "ml/results"
    results.mkdir(parents=True, exist_ok=True)
    (results / "report.json").write_text(json.dumps(report, indent=2, allow_nan=False)+"\n")
    predictions = holdout[["episode_id", "minute", "regime", "stop_within_60m"]].copy()
    predictions["raw_probability"] = holdout_raw
    predictions["calibrated_probability"] = probability
    predictions["physics_baseline_alert"] = baseline
    predictions.to_csv(results / "holdout-predictions.csv", index=False)
    print(json.dumps({"split": report["split"], "threshold": threshold,
                      "holdout": report["holdout"], "baseline": report["baseline"]}, indent=2))


if __name__ == "__main__":
    main()
