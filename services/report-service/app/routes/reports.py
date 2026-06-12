import base64
from datetime import datetime, timezone, date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, BackgroundTasks
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.report import Report, ReportType, ReportFormat, ReportStatus, ReportPeriod
from app.core.dependencies import get_current_user, CurrentUser
from app.generators import pdf_generator, xlsx_generator
from app.generators.data_fetcher import fetch_portfolio_data, fetch_order_data, fetch_client_data

router = APIRouter(tags=["Reports"])

MIME = {
    ReportFormat.PDF:  "application/pdf",
    ReportFormat.XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ReportFormat.CSV:  "text/csv",
}

PERIOD_LABELS = {
    "this_month":  "This Month",
    "last_month":  "Last Month",
    "this_quarter":"This Quarter",
    "this_fy":     "FY 2025-26",
    "last_fy":     "FY 2024-25",
    "custom":      "Custom Range",
}

def _period_dates(period: str) -> tuple[str, str]:
    today = date.today()
    if period == "this_month":
        return today.replace(day=1).isoformat(), today.isoformat()
    if period == "last_month":
        first = today.replace(day=1) - timedelta(days=1)
        return first.replace(day=1).isoformat(), first.isoformat()
    if period == "this_quarter":
        q_start_month = ((today.month - 1) // 3) * 3 + 1
        return today.replace(month=q_start_month, day=1).isoformat(), today.isoformat()
    if period == "this_fy":
        fy_start = date(today.year if today.month >= 4 else today.year - 1, 4, 1)
        return fy_start.isoformat(), today.isoformat()
    if period == "last_fy":
        yr = today.year - 1 if today.month >= 4 else today.year - 2
        return date(yr, 4, 1).isoformat(), date(yr+1, 3, 31).isoformat()
    return "", ""


async def _auth(authorization: str = Header(default="")) -> CurrentUser:
    return await get_current_user(authorization)


class GenerateRequest(BaseModel):
    report_type: ReportType
    format: ReportFormat = ReportFormat.PDF
    period: ReportPeriod = ReportPeriod.THIS_MONTH
    date_from: str | None = None
    date_to: str | None = None


async def _do_generate(report_id: UUID, token: str, report_type: ReportType,
                       fmt: ReportFormat, period: str, date_from: str, date_to: str):
    """Background task: fetch data, generate file, store in DB."""
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        async with db.begin():
            report = (await db.execute(select(Report).where(Report.id == report_id))).scalar_one_or_none()
            if not report:
                return
            report.status = ReportStatus.GENERATING
        await db.commit()

    try:
        d_from, d_to = date_from or _period_dates(period)[0], date_to or _period_dates(period)[1]
        period_label = f"{PERIOD_LABELS.get(period, period)} ({d_from} to {d_to})"

        # Fetch data from services
        if report_type in (ReportType.PORTFOLIO_SUMMARY, ReportType.PERFORMANCE):
            data = await fetch_portfolio_data(token)
        elif report_type == ReportType.ORDER_HISTORY:
            data = await fetch_order_data(token, d_from, d_to)
        elif report_type == ReportType.CLIENT_STATEMENT:
            data = await fetch_client_data(token)
        elif report_type == ReportType.TAX_REPORT:
            # Tax uses order history + portfolio data
            orders = await fetch_order_data(token, d_from, d_to)
            portfolio = await fetch_portfolio_data(token)
            data = {**portfolio, **orders}
        else:
            data = await fetch_portfolio_data(token)

        # Generate file
        if fmt == ReportFormat.PDF:
            if report_type == ReportType.ORDER_HISTORY:
                file_bytes = pdf_generator.generate_order_history(data, period_label)
            elif report_type == ReportType.CLIENT_STATEMENT:
                file_bytes = pdf_generator.generate_client_statement(data, period_label)
            elif report_type == ReportType.PERFORMANCE:
                file_bytes = pdf_generator.generate_performance(data, period_label)
            else:
                file_bytes = pdf_generator.generate_portfolio_summary(data, period_label)
        elif fmt == ReportFormat.XLSX:
            if report_type == ReportType.ORDER_HISTORY:
                file_bytes = xlsx_generator.generate_order_history_xlsx(data, period_label)
            else:
                file_bytes = xlsx_generator.generate_portfolio_summary_xlsx(data, period_label)
        else:  # CSV
            file_bytes = xlsx_generator.generate_csv(data, report_type.value)

        encoded = base64.b64encode(file_bytes).decode()
        size = len(file_bytes)

        async with AsyncSessionLocal() as db:
            async with db.begin():
                report = (await db.execute(select(Report).where(Report.id == report_id))).scalar_one_or_none()
                if report:
                    report.status = ReportStatus.READY
                    report.file_data = encoded
                    report.file_size_bytes = size
                    report.completed_at = datetime.now(timezone.utc)

        try:
            from app.main import REPORTS_GENERATED
            REPORTS_GENERATED.labels(report_type=report_type.value, format=fmt.value, status="READY").inc()
        except Exception:
            pass

    except Exception as e:
        async with AsyncSessionLocal() as db:
            async with db.begin():
                report = (await db.execute(select(Report).where(Report.id == report_id))).scalar_one_or_none()
                if report:
                    report.status = ReportStatus.FAILED
                    report.error_message = str(e)


@router.post("/reports")
async def generate_report(
    body: GenerateRequest,
    background_tasks: BackgroundTasks,
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(_auth),
):
    type_labels = {
        ReportType.PORTFOLIO_SUMMARY: "Portfolio Summary",
        ReportType.CLIENT_STATEMENT:  "Client Statement",
        ReportType.TAX_REPORT:        "Tax P&L Report",
        ReportType.PERFORMANCE:       "Performance Report",
        ReportType.ORDER_HISTORY:     "Order History",
    }
    period_label = PERIOD_LABELS.get(body.period.value, body.period.value)
    name = f"{type_labels.get(body.report_type, body.report_type.value)} — {period_label}"

    report = Report(
        created_by=UUID(current_user.user_id),
        report_type=body.report_type,
        format=body.format,
        period=body.period,
        date_from=body.date_from,
        date_to=body.date_to,
        status=ReportStatus.PENDING,
        name=name,
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)
    report_id = report.id

    token = authorization.replace("Bearer ", "").strip()
    background_tasks.add_task(
        _do_generate, report_id, token,
        body.report_type, body.format, body.period.value,
        body.date_from or "", body.date_to or ""
    )

    return _serialize(report)


@router.get("/reports")
async def list_reports(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(_auth),
):
    q = select(Report).where(Report.created_by == UUID(current_user.user_id)).order_by(Report.created_at.desc()).limit(50)
    reports = (await db.execute(q)).scalars().all()
    return [_serialize(r) for r in reports]


@router.get("/reports/{report_id}/status")
async def report_status(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(_auth),
):
    report = (await db.execute(select(Report).where(Report.id == report_id))).scalar_one_or_none()
    if not report or str(report.created_by) != current_user.user_id:
        raise HTTPException(status_code=404, detail="Report not found")
    return _serialize(report)


@router.get("/reports/{report_id}/download")
async def download_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(_auth),
):
    report = (await db.execute(select(Report).where(Report.id == report_id))).scalar_one_or_none()
    if not report or str(report.created_by) != current_user.user_id:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status != ReportStatus.READY:
        raise HTTPException(status_code=400, detail=f"Report is {report.status.value}")
    if not report.file_data:
        raise HTTPException(status_code=500, detail="File data missing")

    file_bytes = base64.b64decode(report.file_data)
    ext = report.format.value.lower()
    filename = f"{report.name.replace(' ', '_').replace('—','').replace('/','-')}.{ext}"

    return Response(
        content=file_bytes,
        media_type=MIME.get(report.format, "application/octet-stream"),
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
    )


def _serialize(r: Report) -> dict:
    size_mb = f"{r.file_size_bytes / 1_048_576:.1f} MB" if r.file_size_bytes else "—"
    return {
        "id": str(r.id),
        "name": r.name,
        "report_type": r.report_type.value,
        "format": r.format.value,
        "period": r.period.value,
        "status": r.status.value,
        "size": size_mb,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        "error_message": r.error_message,
    }
