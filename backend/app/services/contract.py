import base64
import uuid
from datetime import date
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Image as RLImage
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
    "UPCOMING": "To'lanmagan",
    "PAID": "To'langan",
    "OVERDUE": "Muddati o'tgan",
    "ACTIVE": "Faol",
    "COMPLETED": "Tugallangan",
    "DEFAULTED": "Muddati o'tgan",
    "APPROVED": "Tasdiqlangan",
    "REJECTED": "Rad etilgan",
    "PENDING": "To'lanmagan",
}


def _b64_to_rl_image(b64_str: str, max_width: float, max_height: float):
    """Decode a base64 PNG/JPEG string into a scaled ReportLab Image.

    Returns ``None`` if the string is empty or cannot be decoded.
    """
    if not b64_str:
        return None
    try:
        # Strip data-URI prefix if present (e.g. "data:image/png;base64,…")
        if "," in b64_str:
            b64_str = b64_str.split(",", 1)[1]
        data = base64.b64decode(b64_str)
        buf = BytesIO(data)
        img = RLImage(buf)
        img_w = img.imageWidth or 1
        img_h = img.imageHeight or 1
        scale = min(max_width / img_w, max_height / img_h, 1.0)
        img.drawWidth = img_w * scale
        img.drawHeight = img_h * scale
        return img
    except Exception:
        return None


def generate_pdf(contract: dict, application: dict, schedule: list[dict]) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=50, rightMargin=50, topMargin=50, bottomMargin=50)
    styles = getSampleStyleSheet()
    elements = []

    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY

    # ── Header ────────────────────────────────────────────────────────────────
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Title"],
        fontSize=16,
        spaceAfter=4,
        textColor=colors.HexColor("#065F46"),
    )
    subtitle_style = ParagraphStyle(
        "CustomSubtitle",
        parent=styles["Heading2"],
        fontSize=12,
        spaceAfter=6,
        textColor=colors.HexColor("#065F46"),
        alignment=TA_CENTER,
    )
    created_at = contract.get("created_at", "")
    if created_at and len(created_at) >= 10:
        created_at = created_at[:10]

    contract_status = _STATUS_UZ.get(str(contract.get("status") or ""), str(contract.get("status") or "—"))

    # Build product/items display
    items_summary = application.get("_items_summary") or application.get("_product_name") or "—"

    client_name = application.get("_client_name", "—") or "—"
    merchant_name = application.get("_merchant_name", "—") or "—"
    total_amount = f"{int(contract.get('total_amount') or 0):,}"
    monthly_payment = f"{int(contract.get('monthly_payment') or 0):,}"
    months = str(contract.get("months") or "—")
    contract_short_id = str(contract.get("id", "—"))[-8:].upper()

    elements.append(Paragraph("Muddatli to'lov platformasi", title_style))
    elements.append(Paragraph(
        f"MUDDATLI TO'LOV SHARTNOMASI № {contract_short_id}",
        subtitle_style,
    ))
    elements.append(Spacer(1, 12))

    # ── Description / Introduction ─────────────────────────────────────────────
    desc_style = ParagraphStyle(
        "DescStyle",
        parent=styles["Normal"],
        fontSize=10,
        leading=16,
        alignment=TA_JUSTIFY,
        spaceAfter=6,
    )

    description_text = (
        f"Ushbu shartnoma <b>{created_at}</b> sanada tuzildi. <b>{client_name}</b> (bundan keyin — "
        f"\"Mijoz\") <b>{merchant_name}</b> savdo do'konidan (bundan keyin — \"Sotuvchi\") "
        f"quyidagi mahsulot(lar)ni muddatli(halol nasiya) to'lov asosida sotib oldi:"
    )
    elements.append(Paragraph(description_text, desc_style))

    product_style = ParagraphStyle(
        "ProductItem",
        parent=styles["Normal"],
        fontSize=10,
        leading=16,
        leftIndent=20,
        spaceAfter=8,
    )
    elements.append(Paragraph(f"• <u>{items_summary}</u>", product_style))

    payment_terms_text = (
        f"Mahsulotning umumiy narxi <b>{total_amount} UZS</b> bo'lib, to'lov <b>{months} oy</b> "
        f"muddatiga bo'lib to'lanadi. Har oyda to'lanadigan summa: <b>{monthly_payment} UZS</b>. "
        f"To'lovlar quyidagi jadvalda ko'rsatilgan muddatlarda amalga oshirilishi shart. "
        f"Belgilangan muddatda to'lov amalga oshirilmagan taqdirda, tegishli jarimalar qo'llanilishi mumkin."
    )
    elements.append(Paragraph(payment_terms_text, desc_style))
    elements.append(Spacer(1, 20))

    # ── Payment schedule table ────────────────────────────────────────────────
    elements.append(Paragraph("To'lov jadvali (oylik to'lovlar)", styles["Heading2"]))
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

    # ── Client photo + signature section ─────────────────────────────────────
    face_b64 = application.get("_face_image", "") or ""
    sig_b64  = application.get("_signature", "") or ""

    face_img = _b64_to_rl_image(face_b64, max_width=120, max_height=140)
    sig_img  = _b64_to_rl_image(sig_b64,  max_width=180, max_height=80)

    if face_img or sig_img:
        elements.append(Spacer(1, 28))
        elements.append(Paragraph("Mijoz tasdiqlovchi ma'lumotlar", styles["Heading2"]))
        elements.append(Spacer(1, 10))

        # Build two-column table: [photo label + image | signature label + image]
        label_style = styles["Normal"]

        face_cell_content: list = [Paragraph("Mijoz surati", label_style)]
        if face_img:
            face_cell_content.append(Spacer(1, 6))
            face_cell_content.append(face_img)
        else:
            face_cell_content.append(Paragraph("(rasm mavjud emas)", label_style))

        sig_cell_content: list = [Paragraph("Imzo", label_style)]
        if sig_img:
            sig_cell_content.append(Spacer(1, 6))
            sig_cell_content.append(sig_img)
        else:
            sig_cell_content.append(Paragraph("(imzo mavjud emas)", label_style))

        media_table = Table(
            [[face_cell_content, sig_cell_content]],
            colWidths=[240, 250],
        )
        media_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F9FAFB")),
                ("PADDING", (0, 0), (-1, -1), 10),
            ])
        )
        elements.append(media_table)

    # ── Footer ────────────────────────────────────────────────────────────────
    elements.append(Spacer(1, 20))
    footer_style = ParagraphStyle(
        "Footer",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.HexColor("#9CA3AF"),
        alignment=TA_CENTER,
    )
    elements.append(Paragraph(
        f"Ushbu hujjat avtomatik tarzda yaratilgan · Muddatli to'lov platformasi · Sana: {created_at}",
        footer_style,
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()
