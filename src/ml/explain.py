"""
Feature explanation and interpretability module for cardiovascular prediction.
Provides both cross-validated permutation importance (global) and
linear / perturbation-based local feature attributions (patient-specific).
"""

from typing import List, Dict, Any, Tuple
import numpy as np
import pandas as pd
from sklearn.inspection import permutation_importance
from sklearn.pipeline import Pipeline


def compute_permutation_importance(
    fitted_pipeline: Pipeline,
    X_val: pd.DataFrame,
    y_val: pd.Series,
    n_repeats: int = 10,
    random_state: int = 42
) -> Dict[str, float]:
    """
    Computes permutation importance on a held-out validation dataset.
    Returns a dictionary mapping feature names to mean importance score (ROC-AUC drop).
    """
    result = permutation_importance(
        fitted_pipeline,
        X_val,
        y_val,
        n_repeats=n_repeats,
        random_state=random_state,
        scoring="roc_auc",
        n_jobs=-1
    )

    feature_importances = {}
    for col_name, mean_imp in zip(X_val.columns, result.importances_mean):
        feature_importances[col_name] = round(float(mean_imp), 5)

    # Sort descending
    sorted_importances = dict(
        sorted(feature_importances.items(), key=lambda item: item[1], reverse=True)
    )
    return sorted_importances


def compute_local_explanation(
    fitted_pipeline: Pipeline,
    patient_row: pd.DataFrame,
    background_df: pd.DataFrame,
    top_n: int = 8
) -> List[Dict[str, Any]]:
    """
    Computes patient-specific feature attribution.
    For linear models (LogisticRegression), uses coefficient * (standardized_patient - standardized_mean).
    For tree-based models, uses single-feature perturbation difference relative to baseline.
    Explicitly labeled as prototype decision-support attribution.
    """
    classifier = fitted_pipeline.named_steps["classifier"]
    preprocessor = fitted_pipeline.named_steps["preprocessor"]

    pos_idx = list(classifier.classes_).index(1) if hasattr(classifier, "classes_") else 1
    base_proba = float(fitted_pipeline.predict_proba(patient_row)[0, pos_idx])

    attributions = []

    # If linear classifier, compute exact linear contribution in transformed space
    if hasattr(classifier, "coef_"):
        coefs = classifier.coef_[0]
        # Transform patient
        x_pt_trans = preprocessor.transform(patient_row)[0]
        feature_names_out = preprocessor.get_feature_names_out()

        # Group transformed features back to original columns
        col_attributions: Dict[str, float] = {}
        for feat_out, coef, val in zip(feature_names_out, coefs, x_pt_trans):
            # Parse original column name from 'transformer__col'
            orig_col = feat_out.split("__")[-1]
            # Strip one-hot level if present
            for base_col in patient_row.columns:
                if orig_col == base_col or orig_col.startswith(base_col + "_"):
                    orig_col = base_col
                    break
            contrib = float(coef * val)
            col_attributions[orig_col] = col_attributions.get(orig_col, 0.0) + contrib

        for col, score in col_attributions.items():
            attributions.append({
                "feature": col,
                "contribution_score": round(score, 4),
                "direction": "increases_risk" if score > 0 else "decreases_risk",
                "patient_value": str(patient_row[col].iloc[0]) if col in patient_row else None
            })
    else:
        # Perturbation attribution for non-linear / tree classifiers:
        # Compare prediction with feature replaced by sample median/mode
        for col in patient_row.columns:
            perturbed = patient_row.copy()
            if pd.api.types.is_numeric_dtype(background_df[col]):
                perturbed[col] = background_df[col].median()
            else:
                perturbed[col] = background_df[col].mode().iloc[0]
            
            alt_proba = float(fitted_pipeline.predict_proba(perturbed)[0, pos_idx])
            diff = base_proba - alt_proba  # positive means this feature pushed risk up

            attributions.append({
                "feature": col,
                "contribution_score": round(diff, 4),
                "direction": "increases_risk" if diff > 0 else "decreases_risk",
                "patient_value": str(patient_row[col].iloc[0])
            })

    # Sort by absolute magnitude of contribution
    attributions.sort(key=lambda x: abs(x["contribution_score"]), reverse=True)
    return attributions[:top_n]
