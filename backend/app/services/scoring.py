def calculate_score_full(
    # Client data
    monthly_income: int,
    monthly_payment: float,
    age: int,
    credit_history: str,  # "GOOD" | "FAIR" | "NONE" | "BAD"
    open_loans: int,
    overdue_days: int,
    has_bankruptcy: bool,
    # MFO scoring config (read from tariff object)
    w_affordability: float,
    w_credit: float,
    w_behavioral: float,
    w_demographic: float,
    min_score: int,
    partial_threshold: int,
    partial_ratio: float,
    hard_dti_min: float,
    max_open_loans: int,
    max_overdue_days: int,
    bankruptcy_reject: bool,
) -> dict:
    # 1. HARD RULES
    if bankruptcy_reject and has_bankruptcy:
        return _hard_reject("BANKRUPTCY")
    if open_loans > max_open_loans:
        return _hard_reject("TOO_MANY_LOANS")
    if overdue_days > max_overdue_days:
        return _hard_reject("HIGH_OVERDUE")
    if monthly_payment > 0 and (monthly_income / monthly_payment) < hard_dti_min:
        return _hard_reject("LOW_DTI")

    # 2. FACTOR SCORES

    # F1: Affordability (0–100)
    if monthly_payment > 0:
        dti = monthly_income / monthly_payment
        if dti >= 5:
            f1 = 100
        elif dti >= 3:
            f1 = 80
        elif dti >= 2:
            f1 = 50
        elif dti >= 1.5:
            f1 = 30
        else:
            f1 = 0
    else:
        f1 = 100

    # F2: Credit history (0–100) + overdue penalty
    credit_map = {"GOOD": 100, "FAIR": 65, "NONE": 25, "BAD": 0}
    f2 = credit_map.get(credit_history, 25)
    if 30 <= overdue_days <= 60:
        f2 = max(0, f2 - 10)
    elif 60 < overdue_days <= 90:
        f2 = max(0, f2 - 20)

    # F3: Behavioral — open loans inverse (0–100)
    behavioral_map = {0: 100, 1: 85, 2: 70, 3: 50, 4: 30}
    f3 = behavioral_map.get(open_loans, 10)

    # F4: Demographic — age bands (0–100)
    if 25 <= age <= 45:
        f4 = 100
    elif 18 <= age <= 55:
        f4 = 70
    elif 18 <= age <= 65:
        f4 = 40
    else:
        f4 = 10

    # 3. TOTAL SCORE
    total = round(
        f1 * w_affordability + f2 * w_credit + f3 * w_behavioral + f4 * w_demographic
    )

    # 4. DECISION
    reason_codes = []
    if total >= min_score:
        decision = "APPROVED"
        approved_ratio = 1.0
    elif total >= partial_threshold:
        decision = "PARTIAL"
        approved_ratio = partial_ratio
        reason_codes.append("SCORE_BELOW_FULL_APPROVAL")
    else:
        decision = "REJECTED"
        approved_ratio = 0.0
        reason_codes.append("SCORE_TOO_LOW")
        if f1 < 50:
            reason_codes.append("LOW_AFFORDABILITY")
        if f2 < 50:
            reason_codes.append("POOR_CREDIT_HISTORY")
        if f3 < 50:
            reason_codes.append("TOO_MANY_OPEN_LOANS")

    # 5. RETURN
    return {
        "hard_reject": False,
        "hard_reject_reason": None,
        "f1_affordability": f1,
        "f2_credit": f2,
        "f3_behavioral": f3,
        "f4_demographic": f4,
        "weights": {
            "w1": w_affordability,
            "w2": w_credit,
            "w3": w_behavioral,
            "w4": w_demographic,
        },
        "total_score": total,
        "decision": decision,
        "approved_ratio": approved_ratio,
        "reason_codes": reason_codes,
    }


def _hard_reject(reason: str) -> dict:
    return {
        "hard_reject": True,
        "hard_reject_reason": reason,
        "f1_affordability": 0,
        "f2_credit": 0,
        "f3_behavioral": 0,
        "f4_demographic": 0,
        "weights": {"w1": 0.0, "w2": 0.0, "w3": 0.0, "w4": 0.0},
        "total_score": 0,
        "decision": "REJECTED",
        "approved_ratio": 0.0,
        "reason_codes": [reason],
    }


def monthly_payment(principal: int, months: int, annual_rate: float) -> float:
    if annual_rate == 0:
        return principal / months
    r = annual_rate / 100 / 12
    return principal * r * (1 + r) ** months / ((1 + r) ** months - 1)


def get_outcome(total_score: int, min_score: int) -> str:
    """Determine outcome based on total score and minimum required score."""
    if total_score >= min_score:
        return "APPROVED"
    elif total_score >= min_score * 0.7:  # 70% threshold for partial approval
        return "PARTIAL"
    else:
        return "REJECTED"


def calculate_score(
    monthly_income: int, monthly_payment: float, age: int, credit_history: str
) -> dict:
    """Simplified scoring for basic calculations."""
    # Income score based on DTI
    if monthly_payment > 0:
        dti = monthly_income / monthly_payment
        if dti >= 5:
            income_score = 100
        elif dti >= 3:
            income_score = 80
        elif dti >= 2:
            income_score = 50
        elif dti >= 1.5:
            income_score = 30
        else:
            income_score = 0
    else:
        income_score = 100

    # Credit score
    credit_map = {"GOOD": 100, "FAIR": 65, "NONE": 25, "BAD": 0}
    credit_score = credit_map.get(credit_history, 25)

    # Age score
    if 25 <= age <= 45:
        age_score = 100
    elif 18 <= age <= 55:
        age_score = 70
    elif 18 <= age <= 65:
        age_score = 40
    else:
        age_score = 10

    # Tariff score (placeholder)
    tariff_score = 50

    # Total (weighted average)
    total = int(
        (income_score * 0.4 + credit_score * 0.3 + age_score * 0.2 + tariff_score * 0.1)
    )

    return {
        "income_score": income_score,
        "credit_score": credit_score,
        "age_score": age_score,
        "tariff_score": tariff_score,
        "total": total,
    }
