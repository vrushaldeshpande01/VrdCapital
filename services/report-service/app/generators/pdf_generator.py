"""
PDF report generator using ReportLab.
Produces professional A4 reports with VrdCapital branding.
"""
import io
from datetime import datetime
from decimal import Decimal
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm  # noqa: F401
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT


# ─── Brand colours ────────────────────────────────────────────────────────────
NAVY   = colors.HexColor("#1a237e")
TEAL   = colors.HexColor("#00695c")
GOLD   = colors.HexColor("#f9a825")
LIGHT  = colors.HexColor("#e8eaf6")
RED    = colors.HexColor("#c62828")
GREEN  = colors.HexColor("#2e7d32")
GRAY   = colors.HexColor("#757575")
WHITE  = colors.white
BLACK  = colors.black


def _styles():
    s = getSampleStyleSheet()
    return {
        "h1":      ParagraphStyle("h1",      parent=s["Normal"], fontSize=20, textColor=NAVY, fontName="Helvetica-Bold",  spaceAfter=4),
        "h2":      ParagraphStyle("h2",      parent=s["Normal"], fontSize=13, textColor=NAVY, fontName="Helvetica-Bold",  spaceBefore=12, spaceAfter=4),
        "body":    ParagraphStyle("body",    parent=s["Normal"], fontSize=9,  textColor=BLACK, leading=13),
        "caption": ParagraphStyle("caption", parent=s["Normal"], fontSize=8,  textColor=GRAY),
        "right":   ParagraphStyle("right",   parent=s["Normal"], fontSize=9,  alignment=TA_RIGHT),
        "center":  ParagraphStyle("center",  parent=s["Normal"], fontSize=9,  alignment=TA_CENTER),
        "label":   ParagraphStyle("label",   parent=s["Normal"], fontSize=8,  textColor=GRAY, fontName="Helvetica"),
        "value":   ParagraphStyle("value",   parent=s["Normal"], fontSize=10, textColor=NAVY, fontName="Helvetica-Bold"),
    }


def _header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    # Header bar
    canvas.setFillColor(NAVY)
    canvas.rect(0, h - 2*cm, w, 2*cm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 14)
    canvas.drawString(1.5*cm, h - 1.2*cm, "VrdCapital")
    canvas.setFont("Helvetica", 9)
    canvas.drawRightString(w - 1.5*cm, h - 1.2*cm, f"Generated: {datetime.now().strftime('%d %b %Y, %H:%M')}")
    # Footer
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, w, 1*cm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(1.5*cm, 0.35*cm, "VrdCapital Portfolio Management Platform — Confidential")
    canvas.drawRightString(w - 1.5*cm, 0.35*cm, f"Page {doc.page}")
    canvas.restoreState()


def _table_style(header_color=NAVY, alt_color=LIGHT):
    return TableStyle([
        ("BACKGROUND",   (0, 0), (-1, 0),  header_color),
        ("TEXTCOLOR",    (0, 0), (-1, 0),  WHITE),
        ("FONTNAME",     (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",     (0, 0), (-1, 0),  9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, alt_color]),
        ("FONTSIZE",     (0, 1), (-1, -1), 8),
        ("GRID",         (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING",  (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
    ])


def _fmt_inr(val, prefix="₹") -> str:
    try:
        n = float(val or 0)
        if abs(n) >= 1e7:
            return f"{prefix}{n/1e7:.2f} Cr"
        if abs(n) >= 1e5:
            return f"{prefix}{n/1e5:.2f} L"
        return f"{prefix}{n:,.2f}"
    except Exception:
        return "—"


def _pct(val) -> str:
    try:
        n = float(val or 0)
        sign = "+" if n >= 0 else ""
        return f"{sign}{n:.2f}%"
    except Exception:
        return "—"


# ─── Portfolio Summary ─────────────────────────────────────────────────────────

def generate_portfolio_summary(data: dict, period_label: str) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=1.5*cm, rightMargin=1.5*cm,
                            topMargin=2.5*cm, bottomMargin=1.5*cm)
    st = _styles()
    story = []

    summary = data.get("summary", {})
    holdings = data.get("holdings", [])
    history  = data.get("history",  [])

    # Title
    story += [Paragraph("Portfolio Summary Report", st["h1"]),
               Paragraph(f"Period: {period_label}", st["caption"]),
               Spacer(1, 8)]

    # KPI cards (2-column table)
    kpi = [
        ["Total Value", _fmt_inr(summary.get("total_value")),
         "Total Invested", _fmt_inr(summary.get("total_invested"))],
        ["Total P&L", _fmt_inr(summary.get("total_pnl")),
         "Overall Return", _pct(summary.get("total_pnl_pct"))],
        ["Day P&L", _fmt_inr(summary.get("day_pnl")),
         "Holdings", str(summary.get("num_holdings", "—"))],
    ]
    kpi_rows = []
    for row in kpi:
        kpi_rows.append([
            Paragraph(row[0], st["label"]), Paragraph(row[1], st["value"]),
            Paragraph(row[2], st["label"]), Paragraph(row[3], st["value"]),
        ])
    kpi_table = Table(kpi_rows, colWidths=[3.96*cm, 5.04*cm, 3.96*cm, 5.04*cm])
    kpi_table.setStyle(TableStyle([
        ("BOX",         (0,0),(-1,-1), 1, NAVY),
        ("LINEAFTER",   (1,0),(1,-1),  1, LIGHT),
        ("BACKGROUND",  (0,0),(-1,-1), colors.HexColor("#f5f5f5")),
        ("VALIGN",      (0,0),(-1,-1), "MIDDLE"),
        ("TOPPADDING",  (0,0),(-1,-1), 6),
        ("BOTTOMPADDING",(0,0),(-1,-1),6),
        ("LEFTPADDING", (0,0),(-1,-1), 8),
    ]))
    story += [kpi_table, Spacer(1, 12)]

    # Holdings table
    if holdings:
        story.append(Paragraph("Holdings", st["h2"]))
        h_data = [["Symbol", "Exchange", "Qty", "Avg Cost", "LTP", "P&L", "P&L %", "Weight"]]
        for h in holdings:
            pnl = float(h.get("pnl") or 0)
            pnl_color = GREEN if pnl >= 0 else RED
            h_data.append([
                h.get("symbol",""), h.get("exchange","NSE"),
                str(h.get("quantity","")),
                _fmt_inr(h.get("average_cost")),
                _fmt_inr(h.get("last_price")),
                _fmt_inr(h.get("pnl")),
                _pct(h.get("pnl_pct")),
                f"{float(h.get('weight_pct',0)):.1f}%",
            ])
        h_table = Table(h_data, colWidths=[2.7*cm, 1.8*cm, 1.5*cm, 2.4*cm, 2.4*cm, 2.4*cm, 2.0*cm, 2.8*cm],
                        repeatRows=1)
        h_table.setStyle(_table_style())
        story += [h_table, Spacer(1, 12)]

    # Portfolio value history (last 10 rows)
    if history:
        story.append(Paragraph("Portfolio Value History", st["h2"]))
        hist_data = [["Date", "Portfolio Value", "Change"]]
        rows = sorted(history, key=lambda x: x.get("date",""), reverse=True)[:10]
        for i, row in enumerate(rows):
            prev = rows[i+1]["portfolio_value"] if i+1 < len(rows) else row["portfolio_value"]
            try:
                chg = float(row["portfolio_value"]) - float(prev)
            except Exception:
                chg = 0
            hist_data.append([
                row.get("date",""),
                _fmt_inr(row.get("portfolio_value")),
                _fmt_inr(chg) if i < len(rows)-1 else "—",
            ])
        hist_table = Table(hist_data, colWidths=[6*cm, 6*cm, 6*cm], repeatRows=1)
        hist_table.setStyle(_table_style())
        story.append(hist_table)

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buf.getvalue()


# ─── Order History ────────────────────────────────────────────────────────────

def generate_order_history(data: dict, period_label: str) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=1.5*cm, rightMargin=1.5*cm,
                            topMargin=2.5*cm, bottomMargin=1.5*cm)
    st = _styles()
    story = [
        Paragraph("Order History Report", st["h1"]),
        Paragraph(f"Period: {period_label}", st["caption"]),
        Spacer(1, 10),
    ]

    orders = data.get("orders", [])
    total  = len(orders)
    executed = sum(1 for o in orders if o.get("status") == "EXECUTED")
    cancelled = sum(1 for o in orders if o.get("status") == "CANCELLED")

    # Summary row
    summ = Table([[
        Paragraph("Total Orders", st["label"]), Paragraph(str(total), st["value"]),
        Paragraph("Executed", st["label"]),      Paragraph(str(executed), st["value"]),
        Paragraph("Cancelled", st["label"]),     Paragraph(str(cancelled), st["value"]),
    ]], colWidths=[2.88*cm, 3.06*cm, 2.88*cm, 3.06*cm, 2.88*cm, 3.24*cm])
    summ.setStyle(TableStyle([
        ("BOX",         (0,0),(-1,-1),1,NAVY),
        ("BACKGROUND",  (0,0),(-1,-1),LIGHT),
        ("VALIGN",      (0,0),(-1,-1),"MIDDLE"),
        ("TOPPADDING",  (0,0),(-1,-1),6),
        ("BOTTOMPADDING",(0,0),(-1,-1),6),
        ("LEFTPADDING", (0,0),(-1,-1),8),
    ]))
    story += [summ, Spacer(1, 12)]

    if orders:
        story.append(Paragraph("Order Details", st["h2"]))
        od = [["Date", "Symbol", "Side", "Type", "Qty", "Price", "Broker", "Status"]]
        for o in orders:
            dt = o.get("placed_at","")[:16].replace("T"," ") if o.get("placed_at") else ""
            price = _fmt_inr(o.get("average_price") or o.get("price"))
            od.append([dt, o.get("symbol",""), o.get("side",""), o.get("price_type",""),
                       str(o.get("quantity","")), price, o.get("broker",""), o.get("status","")])
        od_table = Table(od, colWidths=[3.0*cm, 2.2*cm, 1.5*cm, 1.7*cm, 1.4*cm, 2.6*cm, 2.0*cm, 3.6*cm], repeatRows=1)
        od_table.setStyle(_table_style())
        story.append(od_table)

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buf.getvalue()


# ─── Client Statement ─────────────────────────────────────────────────────────

def generate_client_statement(data: dict, period_label: str) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=1.5*cm, rightMargin=1.5*cm,
                            topMargin=2.5*cm, bottomMargin=1.5*cm)
    st = _styles()
    story = [
        Paragraph("Client Portfolio Statement", st["h1"]),
        Paragraph(f"Period: {period_label}", st["caption"]),
        Spacer(1, 10),
    ]

    clients = data.get("clients", [])
    for client in clients[:20]:  # cap at 20 clients per report
        story.append(KeepTogether([
            Paragraph(client.get("full_name","Unknown Client"), st["h2"]),
            Paragraph(f"Email: {client.get('email','')}  |  Risk: {client.get('risk_profile','—')}  |  KYC: {'✓' if client.get('kyc_verified') else '✗'}", st["caption"]),
            Spacer(1, 4),
        ]))
        holdings = client.get("holdings", [])
        if holdings:
            hd = [["Symbol", "Qty", "Avg Cost", "LTP", "P&L", "Weight"]]
            for h in holdings:
                hd.append([h.get("symbol",""), str(h.get("quantity","")),
                            _fmt_inr(h.get("average_cost")), _fmt_inr(h.get("last_price")),
                            _fmt_inr(h.get("pnl")), f"{float(h.get('weight_pct',0)):.1f}%"])
            t = Table(hd, colWidths=[3.6*cm, 2.0*cm, 3.0*cm, 3.0*cm, 3.2*cm, 3.2*cm], repeatRows=1)
            t.setStyle(_table_style())
            story += [t, Spacer(1, 10)]
        else:
            story += [Paragraph("No holdings for this client.", st["caption"]), Spacer(1, 8)]

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buf.getvalue()


# ─── Performance Report ───────────────────────────────────────────────────────

def generate_performance(data: dict, period_label: str) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=1.5*cm, rightMargin=1.5*cm,
                            topMargin=2.5*cm, bottomMargin=1.5*cm)
    st = _styles()
    story = [
        Paragraph("Performance Report", st["h1"]),
        Paragraph(f"Period: {period_label}", st["caption"]),
        Spacer(1, 10),
    ]

    summary = data.get("summary", {})
    history = data.get("history", [])

    kpi = [
        ["Total Return",      _pct(summary.get("total_pnl_pct")),
         "Total P&L",         _fmt_inr(summary.get("total_pnl"))],
        ["Portfolio Value",   _fmt_inr(summary.get("total_value")),
         "Invested Capital",  _fmt_inr(summary.get("total_invested"))],
    ]
    kpi_rows = []
    for row in kpi:
        kpi_rows.append([
            Paragraph(row[0], st["label"]), Paragraph(row[1], st["value"]),
            Paragraph(row[2], st["label"]), Paragraph(row[3], st["value"]),
        ])
    kpi_table = Table(kpi_rows, colWidths=[3.96*cm, 5.04*cm, 3.96*cm, 5.04*cm])
    kpi_table.setStyle(TableStyle([
        ("BOX",          (0,0),(-1,-1),1,NAVY),
        ("BACKGROUND",   (0,0),(-1,-1),LIGHT),
        ("VALIGN",       (0,0),(-1,-1),"MIDDLE"),
        ("TOPPADDING",   (0,0),(-1,-1),6),
        ("BOTTOMPADDING",(0,0),(-1,-1),6),
        ("LEFTPADDING",  (0,0),(-1,-1),8),
    ]))
    story += [kpi_table, Spacer(1, 12)]

    if history:
        story.append(Paragraph("Monthly Portfolio Value", st["h2"]))
        rows = sorted(history, key=lambda x: x.get("date",""))
        hd = [["Date", "Portfolio Value", "Day Change"]]
        for i, row in enumerate(rows):
            prev_val = float(rows[i-1]["portfolio_value"]) if i > 0 else float(row["portfolio_value"])
            curr_val = float(row["portfolio_value"])
            chg = curr_val - prev_val
            hd.append([row.get("date",""), _fmt_inr(curr_val), _fmt_inr(chg) if i > 0 else "—"])
        t = Table(hd, colWidths=[6*cm, 6*cm, 6*cm], repeatRows=1)
        t.setStyle(_table_style())
        story.append(t)

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buf.getvalue()
