"""Train a separate APS diagnostic classifier on the public Scania records."""
from pathlib import Path
import hashlib
import json
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.isotonic import IsotonicRegression
from sklearn.model_selection import train_test_split
from train import metrics, export_trees, SEED

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "ml/public/aps"
RESULTS = ROOT / "ml/results/aps"

def read_original(name):
    path = DATA / name
    expected = manifest["files"][name]["sha256"]
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise ValueError("Dataset hash differs: " + name)
    with path.open(encoding="ascii") as stream:
        for skipped, line in enumerate(stream):
            if line.startswith("class,"):
                break
        else:
            raise ValueError("Missing CSV header: " + name)
    frame = pd.read_csv(path, skiprows=skipped, na_values=["na"])
    if set(frame["class"].unique()) != {"neg", "pos"} or len(frame.columns) != 171:
        raise ValueError("Unexpected APS schema.")
    return frame

def cost_metrics(y, probability, threshold):
    result = metrics(y, probability, threshold)
    result["confusion_order"] = ["other_component_fault", "APS_fault"]
    tn, fp, fn, tp = np.asarray(result["confusion_matrix"]).ravel()
    result["challenge_cost"] = int(10*fp + 500*fn)
    return result

manifest = json.loads((DATA / "manifest.json").read_text())
original_train = read_original("aps_failure_training_set.csv")
holdout = read_original("aps_failure_test_set.csv")
if len(original_train) != 60000 or len(holdout) != 16000:
    raise ValueError("Expected original 60,000 / 16,000 split.")
names = original_train.columns.drop("class").tolist()
if holdout.columns.tolist() != original_train.columns.tolist():
    raise ValueError("Train and evaluation feature orders differ.")
if np.isinf(original_train[names].to_numpy()).any() or np.isinf(holdout[names].to_numpy()).any():
    raise ValueError("Infinite sensor values are not supported.")
# Keep the official evaluation intact, removing matching training feature vectors.
# This uses evaluation covariates for duplicate hygiene, never its outcomes for fitting.
original_hash = pd.util.hash_pandas_object(original_train[names], index=False)
holdout_hash = pd.util.hash_pandas_object(holdout[names], index=False)
overlap = original_hash.isin(set(holdout_hash))
eligible = original_train.loc[~overlap].copy()
eligible_hash = original_hash.loc[~overlap]
conflicts = eligible.assign(_hash=eligible_hash).groupby("_hash")["class"].nunique()
conflict_hashes = set(conflicts[conflicts > 1].index)
conflicting = eligible_hash.isin(conflict_hashes)
duplicates = eligible_hash.duplicated(keep="first")
train_pool = eligible.loc[~conflicting & ~duplicates].copy()
fit_idx, validation_idx = train_test_split(np.arange(len(train_pool)), test_size=.2,
    stratify=train_pool["class"], random_state=SEED)
fit, validation = train_pool.iloc[fit_idx], train_pool.iloc[validation_idx]
# All feature selection and missing-value estimates are fitted on fit rows only.
selected = [name for name in names if fit[name].isna().mean() < .8 and fit[name].nunique() > 1]
imputer = SimpleImputer(strategy="median")
x_fit = imputer.fit_transform(fit[selected])
x_validation = imputer.transform(validation[selected])
y_fit = fit["class"].eq("pos").astype(int).to_numpy()
y_validation = validation["class"].eq("pos").astype(int).to_numpy()
forest = RandomForestClassifier(n_estimators=64, max_depth=12, min_samples_leaf=8,
    max_features="sqrt", class_weight="balanced_subsample", n_jobs=2, random_state=SEED)
print(f"Training on {len(fit):,} records, {len(selected)} features; calibration {len(validation):,}.", flush=True)
forest.fit(x_fit, y_fit)
calibration = IsotonicRegression(out_of_bounds="clip")
raw_validation = forest.predict_proba(x_validation)[:, 1]
calibration.fit(raw_validation, y_validation)
validation_probability = calibration.predict(raw_validation)
options = []
for threshold in np.unique(np.r_[0., validation_probability, 1.000001]):
    prediction = validation_probability >= threshold
    fp = int(np.sum(prediction & (y_validation == 0)))
    fn = int(np.sum(~prediction & (y_validation == 1)))
    options.append((10*fp + 500*fn, fp, -float(threshold), float(threshold)))
threshold = min(options)[-1]
# Only now evaluate the frozen model, calibration and threshold on the official set.
y_holdout = holdout["class"].eq("pos").astype(int).to_numpy()
raw_holdout = forest.predict_proba(imputer.transform(holdout[selected]))[:, 1]
probability = calibration.predict(raw_holdout)
summary = cost_metrics(y_holdout, probability, threshold)
missing_counts = holdout[selected].isna().sum(axis=1).to_numpy()
browser_accepts = ((missing_counts/len(selected) <= .8) & (len(selected)-missing_counts >= 20))
report = {"model_id": "scania-aps-rf-v1", "source": "public_observed_scania_aps",
    "dataset": manifest["dataset"], "creator": manifest["creator"],
    "scope": manifest["scope"], "canonical_url": manifest["canonicalUrl"],
    "license_declared_in_original_files": manifest["licenseDeclaredInOriginalFiles"],
    "dataset_files": manifest["files"], "seed": SEED,
    "feature_names": names, "selected_features": selected,
    "preprocessing": "Drop >=80% missing or constant features; median imputation fitted on fit rows only.",
    "split_method": "Original 16,000-row evaluation preserved; cleaned original training split 80/20 stratified by outcome.",
    "split": {label: {"rows": len(frame), "positive_rows": int(frame["class"].eq("pos").sum())}
        for label, frame in [("fit", fit), ("validation", validation), ("official_holdout", holdout)]},
    "training_rows_removed": {"matching_holdout_features": int(overlap.sum()),
        "conflicting_duplicate_features": int(conflicting.sum()),
        "same_feature_duplicates_nonconflicting": int((duplicates & ~conflicting).sum())},
    "fit_original_row_ids": fit.index.tolist(), "validation_original_row_ids": validation.index.tolist(),
    "forest": forest.get_params(), "calibration": "Isotonic on validation only",
    "threshold_selection": "Minimum validation cost 10*FP + 500*FN; ties prefer fewer false positives.",
    "cost_weights": {"false_positive": 10, "false_negative": 500},
    "validation": cost_metrics(y_validation, validation_probability, threshold),
    "holdout": summary,
    "always_non_APS": cost_metrics(y_holdout, np.zeros(len(holdout)), .5),
    "always_APS": cost_metrics(y_holdout, np.ones(len(holdout)), .5),
    "browser_input_coverage": {"eligible_records": int(browser_accepts.sum()),
        "insufficient_measurements": int((~browser_accepts).sum()),
        "gates_applied_to_full_holdout_metrics": False},
    "limitations": ["Negative class means other-component faults, not healthy trucks.",
        "Diagnoses APS fault class; does not forecast when a future failure occurs.",
        "Does not predict factory buffer exhaustion or diagnose Allur production machinery.",
        "No truck IDs or timestamps: grouped/chronological evaluation cannot be established.",
        "The same validation rows are used for calibration and threshold selection.",
        "Official holdout contains possible repeated records; counts are records, not unique trucks.",
        "Training duplicates matching holdout covariates are removed; the original split is therefore cleaned.",
        "Full holdout metrics include records that the browser may refuse for insufficient measurements.",
        "Anonymous features require an equivalent schema; deployment needs domain validation."],
    "feature_importance": sorted([{"feature": name, "impurity_importance": float(value)}
        for name, value in zip(selected, forest.feature_importances_)],
        key=lambda row: row["impurity_importance"], reverse=True)}
model = {"schemaVersion": 1, "id": report["model_id"], "scope": "scania_aps_diagnosis",
    "source": report["source"], "features": selected, "originalFeatures": names,
    "medians": imputer.statistics_.tolist(), "threshold": threshold,
    "maxMissingFraction": .8, "minimumObservedFeatures": 20,
    "inputBounds": {name: [float(fit[name].min()), float(fit[name].max())] for name in selected},
    "calibration": {"x": calibration.X_thresholds_.tolist(), "y": calibration.y_thresholds_.tolist()},
    "trees": export_trees(forest), "evaluation": summary,
    "fitRows": len(fit), "validationRows": len(validation), "evaluationRows": len(holdout),
    "classMeaning": {"0": "Other-component fault", "1": "APS component fault"},
    "licenseNotice": "Data: Copyright (c) 2016 Scania CV AB, GPL-3.0-or-later; see ml/public/aps."}
RESULTS.mkdir(parents=True, exist_ok=True)
(RESULTS / "report.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
summary_payload = json.dumps({"dataset": report["dataset"], "source": report["source"],
    "canonicalUrl": report["canonical_url"], "fitRows": len(fit), "validationRows": len(validation),
    "evaluation": summary}, separators=(",", ":"), allow_nan=False)
(ROOT / "data/aps-summary.js").write_text("(function(root){root.PlantAPSSummary=" + summary_payload +
    ";})(typeof globalThis!=='undefined'?globalThis:this);\n")
payload = json.dumps(model, separators=(",", ":"), allow_nan=False)
(ROOT / "models/aps-diagnostic.json").write_text(payload + "\n")
(ROOT / "models/aps-diagnostic.js").write_text(
    "/* Separate Scania APS diagnostic model. See ml/results/aps/report.json. */\n"
    "(function(root){root.PlantAPSModel=" + payload + ";})(typeof globalThis!=='undefined'?globalThis:this);\n")
pd.DataFrame({"official_row_id": holdout.index, "aps_fault": y_holdout,
    "raw_probability": raw_holdout, "calibrated_probability": probability,
    "prediction": (probability >= threshold).astype(int)}).to_csv(RESULTS / "holdout-predictions.csv", index=False)
# Balanced examples are for demonstration only; aggregate metrics use all 16,000 rows.
examples = []
for label in ["pos", "neg"]:
    for row_id in holdout.index[holdout["class"].eq(label)][:4]:
        row = holdout.loc[row_id]
        examples.append({"id": int(row_id), "label": label,
            "features": {name: None if pd.isna(row[name]) else float(row[name]) for name in names}})
example_payload = json.dumps({"selection": "First four official examples per class; not representative prevalence.",
    "licenseNotice": model["licenseNotice"], "examples": examples}, separators=(",", ":"), allow_nan=False)
(ROOT / "data/aps-examples.json").write_text(example_payload + "\n")
(ROOT / "data/aps-examples.js").write_text("(function(root){root.PlantAPSExamples=" + example_payload +
    ";})(typeof globalThis!=='undefined'?globalThis:this);\n")
print(json.dumps({"split": report["split"], "removed": report["training_rows_removed"],
    "threshold": threshold, "holdout": summary}, indent=2), flush=True)
