import uuid
from datetime import date, timedelta
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

from ..models.contract import Installment


def generate_payment_schedule(contract_id: str, start_date: date, monthly_payment_amount: int, months: int) -> list:
    installments = []
    for i in range(1, months + 1):
        # Advance due date by i months from start
        month = start_date.month - 1 + i
        year = start_date.year + month // 12
        month = month % 12 + 1
        try:
            due = date(year, month, start_date.day)
        except ValueError:
            # Handle months shorter than start day (e.g., Feb 30 → Feb 28)
            import calendar
            last_day = calendar.monthrange(year, month)[1]
            due = date(year, month, last_day)

        installments.append(
            Installment(
                id=str(uuid.uuid4()),
                contract_id=contract_id,
                installment_number=i,
                due_date=due,
                amount=monthly_payment_amount,
                paid_at=None,
                status="UPCOMING",
            )
        )
    return installments


def generate_pdf(contract, application, schedule) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=40, rightMargin=40, topMargin=40, bottomMargin=40)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph("Installment Platform — Loan Contract", styles["Title"]))
    elements.append(Spacer(1, 12))

    info_data = [
        ["Contract ID", str(contract.id)],
        ["Application ID", str(contract.application_id)],
        ["Client", getattr(application, "_client_name", "—")],
        ["Merchant", getattr(application, "_merchant_name", "—")],
        ["Product", getattr(application, "_product_name", "—")],
        ["Total Amount (UZS)", f"{contract.total_amount:,}"],
        ["Monthly Payment (UZS)", f"{contract.monthly_payment:,}"],
        ["Months", str(contract.months)],
        ["Status", contract.status],
        ["Created At", contract.created_at.strftime("%Y-%m-%d") if contract.created_at else "—"],
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
            str(inst.installment_number),
            str(inst.due_date),
            f"{inst.amount:,}",
            inst.status,
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
    return buffer.getvalue()
