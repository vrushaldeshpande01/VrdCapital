"""
Seed instruments and demo client fund data.
Runs once on service startup if instruments table is empty.
"""
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.instrument import Instrument, InstrumentType

EQUITY_INSTRUMENTS = [
    {"symbol": "RELIANCE",  "name": "Reliance Industries Ltd",     "exchange": "NSE", "lot_size": 1,  "tick_size": "0.05", "ltp": "2485.00"},
    {"symbol": "INFY",      "name": "Infosys Ltd",                 "exchange": "NSE", "lot_size": 1,  "tick_size": "0.05", "ltp": "1458.75"},
    {"symbol": "TCS",       "name": "Tata Consultancy Services",   "exchange": "NSE", "lot_size": 1,  "tick_size": "0.05", "ltp": "3892.30"},
    {"symbol": "HDFCBANK",  "name": "HDFC Bank Ltd",               "exchange": "NSE", "lot_size": 1,  "tick_size": "0.05", "ltp": "1673.40"},
    {"symbol": "ICICIBANK", "name": "ICICI Bank Ltd",              "exchange": "NSE", "lot_size": 1,  "tick_size": "0.05", "ltp": "1245.60"},
    {"symbol": "WIPRO",     "name": "Wipro Ltd",                   "exchange": "NSE", "lot_size": 1,  "tick_size": "0.05", "ltp": "486.15"},
    {"symbol": "SBIN",      "name": "State Bank of India",         "exchange": "NSE", "lot_size": 1,  "tick_size": "0.05", "ltp": "815.25"},
    {"symbol": "BAJFINANCE","name": "Bajaj Finance Ltd",           "exchange": "NSE", "lot_size": 1,  "tick_size": "0.05", "ltp": "6890.00"},
]

FNO_INSTRUMENTS = [
    {
        "symbol": "NIFTY25JULCE",
        "name": "NIFTY Jul 25 Call Options",
        "exchange": "NFO",
        "instrument_type": InstrumentType.OPTIONS,
        "lot_size": 75,
        "tick_size": "0.05",
        "ltp": "245.50",
    },
    {
        "symbol": "BANKNIFTY25JULPE",
        "name": "Bank NIFTY Jul 25 Put Options",
        "exchange": "NFO",
        "instrument_type": InstrumentType.OPTIONS,
        "lot_size": 30,
        "tick_size": "0.05",
        "ltp": "312.80",
    },
    {
        "symbol": "RELIANCE25AUGFUT",
        "name": "Reliance Aug 25 Futures",
        "exchange": "NFO",
        "instrument_type": InstrumentType.FUTURES,
        "lot_size": 250,
        "tick_size": "0.05",
        "ltp": "2491.00",
    },
]


async def seed_instruments(db: AsyncSession) -> None:
    existing = (await db.execute(select(Instrument))).scalars().first()
    if existing:
        return  # already seeded

    for d in EQUITY_INSTRUMENTS:
        db.add(Instrument(
            symbol=d["symbol"],
            name=d["name"],
            exchange=d["exchange"],
            instrument_type=InstrumentType.EQUITY,
            lot_size=d["lot_size"],
            tick_size=Decimal(d["tick_size"]),
            ltp=Decimal(d["ltp"]),
        ))

    for d in FNO_INSTRUMENTS:
        db.add(Instrument(
            symbol=d["symbol"],
            name=d["name"],
            exchange=d["exchange"],
            instrument_type=d["instrument_type"],
            lot_size=d["lot_size"],
            tick_size=Decimal(d["tick_size"]),
            ltp=Decimal(d["ltp"]),
        ))

    await db.flush()
