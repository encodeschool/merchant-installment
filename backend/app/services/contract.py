import uuid
from datetime import date
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer


def generate_payment_schedule(contract_id: str, start_date: date, monthly_payment_amount: int, months: int) -> list[dict]:
    installments = []
    for i in range(1, months + 1):
        month = start_date.month - 1 + i
        year = start_date.year + month // 12
        month = month % 12 + 1
        try:
            due = date(year, month, start_date.day)
        except ValueError:
            import calendar
            last_day = calendar.monthrange(year, month)[1]
            due = date(year, month, last_day)

        installments.append({
            "id": str(uuid.uuid4()),
            "contract_id": contract_id,
            "installment_number": i,
            "due_date": due.isoformat(),
            "amount": monthly_payment_amount,
            "paid_at": None,
            "status": "UPCOMING",
        })
    return installments


_STATUS_UZ = {
    "UPCOMING": "Kutilmoqda",
    "PAID": "To'langan",
    "OVERDUE": "Muddati o'tgan",
    "ACTIVE": "Faol",
    "COMPLETED": "Tugallangan",
    "DEFAULTED": "Muddati o'tgan",
    "APPROVED": "Tasdiqlangan",
    "REJECTED": "Rad etilgan",
    "PENDING": "Kutilmoqda",
}


def generate_pdf(contract: dict, application: dict, schedule: list[dict]) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=50, rightMargin=50, topMargin=50, bottomMargin=50)
    styles = getSampleStyleSheet()
    elements = []

    # ── Header ────────────────────────────────────────────────────────────────
    title_style = styles["Title"]
    elements.append(Paragraph("Muddatli to'lov platformasi", title_style))
    elements.append(Paragraph("Kredit shartnomasi", styles["Heading2"]))
    elements.append(Spacer(1, 16))

    created_at = contract.get("created_at", "")
    if created_at and len(created_at) >= 10:
        created_at = created_at[:10]

    contract_status = _STATUS_UZ.get(str(contract.get("status") or ""), str(contract.get("status") or "—"))

    # Build product/items display
    items_summary = application.get("_items_summary") or application.get("_product_name") or "—"

    # ── Contract info table ───────────────────────────────────────────────────
    info_data = [
        ["Shartnoma raqami",   str(contract.get("id", "—"))[-8:].upper()],
        ["Ariza raqami",       str(contract.get("application_id", "—"))[-8:].upper()],
        ["Mijoz",              application.get("_client_name", "—") or "—"],
        ["Pasport",            application.get("_client_passport", "—") or "—"],
        ["Telefon",            application.get("_client_phone", "—") or "—"],
        ["Savdogar",           application.get("_merchant_name", "—") or "—"],
        ["Mahsulot(lar)",      items_summary],
        ["Umumiy summa (UZS)", f"{int(contract.get('total_amount') or 0):,}"],
        ["Oylik to'lov (UZS)", f"{int(contract.get('monthly_payment') or 0):,}"],
        ["Oylar soni",         str(contract.get("months") or "—")],
        ["Holati",             contract_status],
        ["Tuzilgan sana",      created_at],
    ]
    info_table = Table(info_data, colWidths=[170, 320])
    info_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F0FDF4")),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 7),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.HexColor("#F9FAFB"), colors.white]),
        ])
    )
    elements.append(info_table)
    elements.append(Spacer(1, 24))

    # ── Payment schedule table ────────────────────────────────────────────────
    elements.append(Paragraph("To'lov jadvali", styles["Heading2"]))
    elements.append(Spacer(1, 8))

    schedule_data = [["#", "To'lov sanasi", "Summa (UZS)", "Holati"]]
    for inst in schedule:
        raw_status = str(inst.get("status", ""))
        status_uz = _STATUS_UZ.get(raw_status, raw_status)
        schedule_data.append([
            str(inst.get("installment_number", "")),
            str(inst.get("due_date", "—")),
            f"{int(inst.get('amount') or 0):,}",
            status_uz,
        ])

    sched_table = Table(schedule_data, colWidths=[35, 130, 160, 120])
    sched_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#059669")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F0FDF4")]),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (2, 1), (2, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 6),
        ])
    )
    elements.append(sched_table)

    # ── Footer ────────────────────────────────────────────────────────────────
    elements.append(Spacer(1, 30))
    footer_style = styles["Normal"]
    footer_style.fontSize = 8
    footer_style.textColor = colors.HexColor("#9CA3AF")
    elements.append(Paragraph(
        f"Ushbu hujjat avtomatik tarzda yaratilgan. Sana: {created_at}",
        footer_style,
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()
