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


def generate_pdf(contract: dict, application: dict, schedule: list[dict]) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=40, rightMargin=40, topMargin=40, bottomMargin=40)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph("Installment Platform — Loan Contract", styles["Title"]))
    elements.append(Spacer(1, 12))

    created_at = contract.get("created_at", "")
    if created_at and len(created_at) >= 10:
        created_at = created_at[:10]

    info_data = [
        ["Contract ID", str(contract.get("id", "—"))],
        ["Application ID", str(contract.get("application_id", "—"))],
        ["Client", application.get("_client_name", "—") or "—"],
        ["Merchant", application.get("_merchant_name", "—") or "—"],
        ["Product", application.get("_product_name", "—") or "—"],
        ["Total Amount (UZS)", f"{int(contract.get('total_amount') or 0):,}"],
        ["Monthly Payment (UZS)", f"{int(contract.get('monthly_payment') or 0):,}"],
        ["Months", str(contract.get("months") or "—")],
        ["Status", str(contract.get("status") or "—")],
        ["Created At", created_at],
    ]
    info_table = Table(info_data, colWidths=[160, 340])
    info_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.lightgrey),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 6),
        ])
    )
    elements.append(info_table)
    elements.append(Spacer(1, 20))

    elements.append(Paragraph("Payment Schedule", styles["Heading2"]))
    elements.append(Spacer(1, 8))

    schedule_data = [["#", "Due Date", "Amount (UZS)", "Status"]]
    for inst in schedule:
        schedule_data.append([
            str(inst.get("installment_number", "")),
            str(inst.get("due_date", "—")),
            f"{int(inst.get('amount') or 0):,}",
            str(inst.get("status", "—")),
        ])

    sched_table = Table(schedule_data, colWidths=[40, 120, 160, 100])
    sched_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563EB")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 5),
        ])
    )
    elements.append(sched_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()
