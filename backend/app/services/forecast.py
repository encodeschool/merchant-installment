"""
Revenue forecasting service.
Collects rich monthly metrics from DB and delegates projection + insight to Claude AI.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone, timedelta

from supabase import Client

from ..core.config import settings

logger = logging.getLogger(__name__)


class ForecastService:
    def __init__(self, db: Client, mfo_user_id: str, mfo_name: str):
        self.db = db
        self.mfo_user_id = mfo_user_id
        self.mfo_name = mfo_name
        self._merchant_ids: list[str] | None = None

    @property
    def merchant_ids(self) -> list[str]:
        if self._merchant_ids is None:
            rows = (
                self.db.table("merchants")
                .select("id")
                .eq("mfo_user_id", self.mfo_user_id)
                .execute()
                .data
            )
            self._merchant_ids = [m["id"] for m in rows]
            logger.info(
                "ForecastService: mfo_user_id=%s → merchant_ids=%s",
                self.mfo_user_id,
                self._merchant_ids,
            )
        return self._merchant_ids

    def collect_monthly_history(self) -> list[dict]:
        """Per-month disbursement + approval metrics for the last 6 months."""
        now = datetime.now(timezone.utc)
        history = []

        for offset in range(5, -1, -1):
            target = now - timedelta(days=30 * offset)
            year, month = target.year, target.month
            from_dt = datetime(year, month, 1, tzinfo=timezone.utc)
            next_month = month + 1 if month < 12 else 1
            next_year = year if month < 12 else year + 1
            to_dt = datetime(next_year, next_month, 1, tzinfo=timezone.utc)

            disbursed = 0.0
            approved_count = 0
            rejected_count = 0
            total_score = 0.0
            score_count = 0

            if self.merchant_ids:
                apps = (
                    self.db.table("applications")
                    .select("approved_amount, total_amount, status, score")
                    .in_("merchant_id", self.merchant_ids)
                    .gte("created_at", from_dt.isoformat())
                    .lt("created_at", to_dt.isoformat())
                    .execute()
                    .data
                )
                for a in apps:
                    if a["status"] in ("APPROVED", "PARTIAL", "ACTIVE", "COMPLETED"):
                        approved_count += 1
                        disbursed += a.get("approved_amount") or a.get("total_amount") or 0
                    elif a["status"] == "REJECTED":
                        rejected_count += 1
                    if a.get("score"):
                        total_score += a["score"]
                        score_count += 1

            total = approved_count + rejected_count
            history.append({
                "month": target.strftime("%b %Y"),
                "disbursed": round(disbursed),
                "approved": approved_count,
                "rejected": rejected_count,
                "approvalRate": round(approved_count / total * 100) if total > 0 else 0,
                "avgScore": round(total_score / score_count, 1) if score_count > 0 else 0,
            })

        logger.info(
            "ForecastService: monthly_history=%s",
            [(h["month"], h["disbursed"], h["approved"]) for h in history],
        )
        return history

    def collect_active_tariffs(self) -> list[dict]:
        return (
            self.db.table("tariffs")
            .select("name, interest_rate, min_score, min_amount, max_amount")
            .eq("mfo_user_id", self.mfo_user_id)
            .eq("status", "APPROVED")
            .execute()
            .data
        )

    def collect_pending_pipeline(self) -> dict:
        if not self.merchant_ids:
            return {"count": 0, "total": 0, "avgScore": 0}

        apps = (
            self.db.table("applications")
            .select("total_amount, score")
            .in_("merchant_id", self.merchant_ids)
            .eq("status", "PENDING")
            .execute()
            .data
        )
        count = len(apps)
        total = sum(a.get("total_amount") or 0 for a in apps)
        avg_score = (
            round(sum(a.get("score") or 0 for a in apps) / count, 1)
            if count > 0 else 0
        )
        return {"count": count, "total": total, "avgScore": avg_score}

    def build(self) -> dict:
        """Main entry point: return cached forecast or generate a new one."""
        cached = self._load_cache()
        if cached is not None:
            return cached

        monthly_history = self.collect_monthly_history()
        tariffs = self.collect_active_tariffs()
        pipeline = self.collect_pending_pipeline()

        now = datetime.now(timezone.utc)
        next_months = [
            (now + timedelta(days=30 * i)).strftime("%b %Y") for i in range(1, 4)
        ]

        if settings.ANTHROPIC_API_KEY:
            result = self._claude_forecast(monthly_history, tariffs, pipeline, next_months)
        else:
            result = self._fallback_forecast(monthly_history, next_months)

        result["monthlyHistory"] = [
            {"month": h["month"], "revenue": h["disbursed"], "approved": h["approved"]}
            for h in monthly_history
        ]

        self._save_cache(result)
        return result

    def _load_cache(self) -> dict | None:
        """Return cached result if still valid, else None."""
        try:
            now = datetime.now(timezone.utc)
            rows = (
                self.db.table("forecast_cache")
                .select("result")
                .eq("mfo_user_id", self.mfo_user_id)
                .gt("expires_at", now.isoformat())
                .order("generated_at", desc=True)
                .limit(1)
                .execute()
                .data
            )
            if rows:
                return rows[0]["result"]
        except Exception:
            pass
        return None

    def _save_cache(self, result: dict) -> None:
        """Persist forecast result; expires at next midnight UTC."""
        try:
            now = datetime.now(timezone.utc)
            tomorrow = (now + timedelta(days=1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            self.db.table("forecast_cache").insert({
                "mfo_user_id": self.mfo_user_id,
                "result": result,
                "generated_at": now.isoformat(),
                "expires_at": tomorrow.isoformat(),
            }).execute()
        except Exception:
            pass

    # ------------------------------------------------------------------
    # Private: Claude AI forecast
    # ------------------------------------------------------------------

    def _claude_forecast(
        self,
        monthly_history: list[dict],
        tariffs: list[dict],
        pipeline: dict,
        next_months: list[str],
    ) -> dict:
        history_text = "\n".join(
            f"  {h['month']}: disbursed={h['disbursed']:,} UZS, "
            f"approved={h['approved']}, rejected={h['rejected']}, "
            f"approval_rate={h['approvalRate']}%, avg_score={h['avgScore']}"
            for h in monthly_history
        )
        tariff_text = "\n".join(
            f"  {t['name']}: rate={t['interest_rate']}%, min_score={t['min_score']}, "
            f"range={t['min_amount']:,}–{t['max_amount']:,} UZS"
            for t in tariffs
        ) or "  No active tariffs"

        prompt = f"""You are a financial forecasting AI for {self.mfo_name}, a microfinance organization in Uzbekistan.

## Historical monthly data (last 6 months):
{history_text}

## Active tariff products:
{tariff_text}

## Current pipeline:
- Pending applications: {pipeline['count']} (total value: {pipeline['total']:,} UZS, avg score: {pipeline['avgScore']})

## Your task:
Analyze the trends (disbursement growth, approval rate changes, score trends) and forecast the next 3 months.

Respond ONLY with a valid JSON object in this exact format:
{{
  "projections": [
    {{"month": "{next_months[0]}", "projectedRevenue": <integer_uzs>}},
    {{"month": "{next_months[1]}", "projectedRevenue": <integer_uzs>}},
    {{"month": "{next_months[2]}", "projectedRevenue": <integer_uzs>}}
  ],
  "insight": "<2-3 sentences: key trend observed, forecast rationale, one actionable recommendation. Be specific with numbers. Max 90 words.>",
  "riskLevel": "<LOW|MEDIUM|HIGH>",
  "riskReason": "<one sentence explaining the main risk factor>"
}}

Base projections on: disbursement trend, approval rate trajectory, pending pipeline, and seasonal patterns for Uzbekistan (spring uptick in consumer lending). Be realistic — do not extrapolate linearly if the trend is flattening."""

        try:
            import anthropic
            client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            message = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=400,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = message.content[0].text.strip()
            parsed = json.loads(raw[raw.find("{"):raw.rfind("}") + 1])
            return {
                "projections": parsed["projections"],
                "aiInsight": parsed["insight"],
                "riskLevel": parsed.get("riskLevel", "MEDIUM"),
                "riskReason": parsed.get("riskReason", ""),
            }
        except Exception:
            return self._fallback_forecast(monthly_history, next_months)

    # ------------------------------------------------------------------
    # Private: simple linear trend fallback
    # ------------------------------------------------------------------

    @staticmethod
    def _fallback_forecast(monthly_history: list[dict], next_months: list[str]) -> dict:
        revenues = [h["disbursed"] for h in monthly_history if h["disbursed"] > 0]
        if len(revenues) >= 2:
            deltas = [revenues[i] - revenues[i - 1] for i in range(1, len(revenues))]
            avg_delta = sum(deltas) / len(deltas)
            last = revenues[-1]
        else:
            avg_delta = 0
            last = revenues[-1] if revenues else 0

        projections = [
            {
                "month": next_months[i],
                "projectedRevenue": round(max(0, last + avg_delta * (i + 1) * 0.85)),
            }
            for i in range(3)
        ]
        total = sum(p["projectedRevenue"] for p in projections)
        best = max(projections, key=lambda x: x["projectedRevenue"])
        trend = "growing" if avg_delta > 0 else ("declining" if avg_delta < 0 else "stable")

        return {
            "projections": projections,
            "aiInsight": (
                f"Forecast for next 3 months: {total:,} UZS total. "
                f"Peak expected in {best['month']} ({best['projectedRevenue']:,} UZS). "
                f"Trend: {trend}."
            ),
            "riskLevel": "MEDIUM",
            "riskReason": "Forecast based on linear trend extrapolation (AI unavailable).",
        }


def build_forecast(db: Client, mfo_user_id: str, mfo_name: str) -> dict:
    """Router-facing entry point."""
    return ForecastService(db, mfo_user_id, mfo_name).build()
