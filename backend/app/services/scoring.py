FIXED_MONTHS = {3, 6, 9, 12}
PARTIAL_RATIO = 0.70


def calculate_score(monthly_income: int, monthly_payment: float, age: int, credit_history: str) -> dict:
    if monthly_payment > 0:
        ratio = monthly_income / monthly_payment
        if ratio >= 3:
            income_score = 30
        elif ratio >= 2:
            income_score = 20
        elif ratio >= 1.5:
            income_score = 10
        else:
            income_score = 5
    else:
        income_score = 5

    credit_map = {"GOOD": 30, "FAIR": 20, "NONE": 10, "BAD": 0}
    credit_score = credit_map.get(credit_history, 10)

    if 25 <= age <= 55:
        age_score = 20
    elif 18 <= age <= 65:
        age_score = 15
    else:
        age_score = 5

    tariff_score = 20
    total = income_score + credit_score + age_score + tariff_score

    return {
        "income_score": income_score,
        "credit_score": credit_score,
        "age_score": age_score,
        "tariff_score": tariff_score,
        "total": total,
    }


def get_outcome(score: int, tariff_min_score: int) -> str:
    if score < 50:
        return "REJECTED"
    if score >= tariff_min_score:
        return "APPROVED"
    return "PARTIAL"


def monthly_payment(principal: int, months: int, annual_rate: float) -> float:
    if annual_rate == 0:
        return principal / months
    r = annual_rate / 100 / 12
    return principal * r * (1 + r) ** months / ((1 + r) ** months - 1)
