"""
Leakage-resistant model training, cross-validation evaluation, and artifact export.
Trains 4 independent target models (Cath, LAD, LCX, RCA) with 3 candidate algorithms each.
Strictly excludes all target columns from the feature matrix and fits all preprocessing inside CV folds.
"""

import json
import os
import sys
from typing import Dict, Any, List, Tuple
import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import Pipeline

from src.ml.preprocess import (
    TARGET_COLUMNS,
    extract_features_and_target,
    build_preprocessor,
    get_feature_schema
)
from src.ml.evaluate import compute_binary_metrics
from src.ml.explain import compute_permutation_importance

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_PATH = os.path.join(PROJECT_ROOT, "data", "processed", "alizadeh_sani.csv")
MODELS_DIR = os.path.join(PROJECT_ROOT, "artifacts", "models")
METRICS_DIR = os.path.join(PROJECT_ROOT, "results", "metrics")

RANDOM_STATE = 42

CANDIDATE_MODELS = {
    "LogisticRegression": LogisticRegression(
        C=0.5,
        max_iter=1000,
        class_weight="balanced",
        random_state=RANDOM_STATE
    ),
    "RandomForest": RandomForestClassifier(
        n_estimators=120,
        max_depth=5,
        min_samples_split=4,
        class_weight="balanced",
        random_state=RANDOM_STATE
    ),
    "GradientBoosting": GradientBoostingClassifier(
        n_estimators=100,
        max_depth=3,
        learning_rate=0.05,
        subsample=0.85,
        random_state=RANDOM_STATE
    )
}

TARGET_DESCRIPTIONS = {
    "Cath": "Overall Coronary Artery Disease (Cath / CAD)",
    "LAD": "Left Anterior Descending Artery Stenosis (>=50%)",
    "LCX": "Left Circumflex Artery Stenosis (>=50%)",
    "RCA": "Right Coronary Artery Stenosis (>=50%)"
}


def run_cross_validation_for_target(
    X: pd.DataFrame,
    y: pd.Series,
    target_name: str,
    n_splits: int = 5
) -> Dict[str, Any]:
    """
    Performs stratified 5-fold cross-validation for all candidate models on a single target.
    Preprocessing is strictly fitted inside each fold.
    Returns candidate metrics and out-of-fold predictions.
    """
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=RANDOM_STATE)

    target_results = {}

    for model_name, base_estimator in CANDIDATE_MODELS.items():
        oof_preds = np.zeros(len(y), dtype=int)
        oof_probas = np.zeros(len(y), dtype=float)

        fold_permutation_importances = []

        for fold_idx, (train_idx, val_idx) in enumerate(skf.split(X, y)):
            X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
            y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]

            # Build fresh preprocessor and pipeline for each fold
            preprocessor = build_preprocessor(list(X.columns))
            estimator = clone(base_estimator)

            fold_pipeline = Pipeline([
                ("preprocessor", preprocessor),
                ("classifier", estimator)
            ])

            # Strictly fit only on training fold
            fold_pipeline.fit(X_train, y_train)

            val_preds = fold_pipeline.predict(X_val)
            val_probas = fold_pipeline.predict_proba(X_val)[:, 1]

            oof_preds[val_idx] = val_preds
            oof_probas[val_idx] = val_probas

            # Optional fold permutation importance sample
            if fold_idx == 0:
                fold_perm = compute_permutation_importance(
                    fold_pipeline, X_val, y_val, n_repeats=5, random_state=RANDOM_STATE
                )
                fold_permutation_importances.append(fold_perm)

        # Compute full out-of-fold metrics across all 303 samples
        metrics = compute_binary_metrics(y.values, oof_preds, oof_probas)
        target_results[model_name] = {
            "metrics": metrics,
            "sample_permutation_importance": fold_permutation_importances[0] if fold_permutation_importances else {}
        }

    return target_results


def select_best_model(candidate_results: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    """
    Selection rule:
    Prioritize clinical balance using a composite score:
    Score = 0.40 * F1 + 0.35 * ROC_AUC + 0.25 * Recall
    Ensures high sensitivity for stenosis detection without extreme false positive rate.
    """
    best_model_name = None
    best_score = -1.0
    best_data = None

    for model_name, data in candidate_results.items():
        m = data["metrics"]
        f1 = m["f1"]
        auc = m["roc_auc"] if m["roc_auc"] is not None else 0.5
        rec = m["recall"]

        composite = 0.40 * f1 + 0.35 * auc + 0.25 * rec
        if composite > best_score:
            best_score = composite
            best_model_name = model_name
            best_data = data

    return best_model_name, best_data


def train_and_export_all():
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(METRICS_DIR, exist_ok=True)

    print(f"Loading processed dataset from {DATA_PATH}...")
    df = pd.read_csv(DATA_PATH)
    print(f"Dataset shape: {df.shape}")

    comparison_rows = []
    selected_metrics_summary = {}
    top_feature_importances = {}

    # Extract schema from full features (target excluded)
    X_sample, _ = extract_features_and_target(df, "Cath")
    schema = get_feature_schema(X_sample)
    schema_path = os.path.join(MODELS_DIR, "feature_schema.json")
    with open(schema_path, "w") as f:
        json.dump(schema, f, indent=2)
    print(f"Saved feature schema ({len(schema['ordered_features'])} features) to {schema_path}")

    # Process all 4 targets
    for target_name in TARGET_COLUMNS:
        print(f"\n==================================================")
        print(f"Evaluating Target: {target_name} ({TARGET_DESCRIPTIONS[target_name]})")
        print(f"==================================================")

        X, y = extract_features_and_target(df, target_name)
        print(f"Feature matrix shape: {X.shape}, Target distribution: {y.value_counts().to_dict()}")

        cv_results = run_cross_validation_for_target(X, y, target_name)

        # Tabulate comparison
        for model_name, res in cv_results.items():
            m = res["metrics"]
            comparison_rows.append({
                "target": target_name,
                "target_description": TARGET_DESCRIPTIONS[target_name],
                "model": model_name,
                "accuracy": m["accuracy"],
                "precision": m["precision"],
                "recall": m["recall"],
                "f1_score": m["f1"],
                "roc_auc": m["roc_auc"],
                "pos_support": m["pos_support"],
                "neg_support": m["neg_support"]
            })
            print(
                f"[{model_name:18s}] Acc: {m['accuracy']:.4f} | "
                f"Prec: {m['precision']:.4f} | Rec: {m['recall']:.4f} | "
                f"F1: {m['f1']:.4f} | ROC-AUC: {m['roc_auc']:.4f}"
            )

        # Select best model
        best_name, best_info = select_best_model(cv_results)
        print(f"--> SELECTED BEST MODEL for {target_name}: {best_name}")

        selected_metrics_summary[target_name] = {
            "target": target_name,
            "target_description": TARGET_DESCRIPTIONS[target_name],
            "selected_model": best_name,
            "cross_validation": "Stratified 5-Fold",
            "metrics": best_info["metrics"],
            "selection_rationale": "Maximized clinical composite score (0.40*F1 + 0.35*ROC_AUC + 0.25*Recall)"
        }

        # PHASE 4: Refit ONLY the selected model pipeline on FULL available dataset for production prototype inference
        print(f"Refitting final selected pipeline ({best_name}) on complete dataset for {target_name}...")
        final_preprocessor = build_preprocessor(list(X.columns))
        final_estimator = clone(CANDIDATE_MODELS[best_name])
        final_pipeline = Pipeline([
            ("preprocessor", final_preprocessor),
            ("classifier", final_estimator)
        ])
        final_pipeline.fit(X, y)

        # Save model artifact
        model_filename = f"{target_name.lower()}_pipeline.joblib"
        model_filepath = os.path.join(MODELS_DIR, model_filename)
        joblib.dump(final_pipeline, model_filepath)
        print(f"Saved production pipeline to {model_filepath}")

        # Compute permutation importance on full dataset for the dashboard
        perm_imp = compute_permutation_importance(
            final_pipeline, X, y, n_repeats=10, random_state=RANDOM_STATE
        )
        # Store top 10 features
        top_10 = dict(list(perm_imp.items())[:10])
        top_feature_importances[target_name] = top_10
        print(f"Top 5 predictive features for {target_name}: {list(top_10.keys())[:5]}")

    # Save model comparison CSV
    comparison_df = pd.DataFrame(comparison_rows)
    comparison_csv_path = os.path.join(METRICS_DIR, "model_comparison.csv")
    comparison_df.to_csv(comparison_csv_path, index=False)
    print(f"\nSaved full model comparison table to {comparison_csv_path}")

    # Save selected models metrics summary JSON
    selected_metrics_path = os.path.join(METRICS_DIR, "selected_model_metrics.json")
    with open(selected_metrics_path, "w") as f:
        json.dump(selected_metrics_summary, f, indent=2)
    print(f"Saved selected model metrics to {selected_metrics_path}")

    # Save feature importances JSON
    feature_imp_path = os.path.join(MODELS_DIR, "feature_importances.json")
    with open(feature_imp_path, "w") as f:
        json.dump(top_feature_importances, f, indent=2)
    print(f"Saved top feature importances to {feature_imp_path}")

    print("\nTraining and evaluation pipeline completed successfully!")


if __name__ == "__main__":
    train_and_export_all()
