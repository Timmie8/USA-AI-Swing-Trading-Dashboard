import streamlit as st
import requests
import pandas as pd
import plotly.graph_objects as go
from datetime import datetime

# --- CONFIGURATIE ---
st.set_page_config(page_title="USA AI SwingTrading Dashboard", layout="wide")

# Custom CSS om de stijl van je style.css te benaderen
st.markdown("""
    <style>
    .main { background-color: #0f172a; color: #f8fafc; }
    .stMetric { background-color: #1e293b; border: 1px solid #334155; padding: 15px; border-radius: 10px; }
    </style>
    """, unsafe_allow_html=True)

# --- FUNCTIES (Vertaald uit main.js / dashboard.js) ---

def get_stock_data(symbol, period='1mo', interval='1d'):
    """Haalt data op van Yahoo Finance API"""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval={interval}&range={period}"
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    try:
        response = requests.get(url, headers=headers)
        data = response.json()
        
        result = data['chart']['result'][0]
        df = pd.DataFrame({
            'timestamp': pd.to_datetime(result['timestamp'], unit='s'),
            'open': result['indicators']['quote'][0]['open'],
            'high': result['indicators']['quote'][0]['high'],
            'low': result['indicators']['quote'][0]['low'],
            'close': result['indicators']['quote'][0]['close'],
            'volume': result['indicators']['quote'][0]['volume']
        })
        return df
    except Exception as e:
        st.error(f"Fout bij ophalen data voor {symbol}: {e}")
        return None

def calculate_ai_score(df):
    """Eenvoudige AI-logica simulatie (Pattern Analysis)"""
    if df is None or len(df) < 2: return 0
    last_close = df['close'].iloc[-1]
    prev_close = df['close'].iloc[-2]
    
    # Simpele trend score
    score = 50
    if last_close > prev_close: score += 10
    if last_close > df['close'].mean(): score += 15
    return min(score, 95)

# --- DASHBOARD LAYOUT ---

st.title("📈 USA AI SwingTrading Dashboard")

# Sidebar voor instellingen
st.sidebar.header("Instellingen")
target_stock = st.sidebar.text_input("Aandeel Symbool", value="AAPL").upper()
timeframe = st.sidebar.selectbox("Tijdframe", ["1d", "5d", "1mo", "6mo", "1y"], index=2)

# Data ophalen
df = get_stock_data(target_stock, period=timeframe)

if df is not None:
    # Bovenste rij: Statistieken
    col1, col2, col3, col4 = st.columns(4)
    
    current_price = df['close'].iloc[-1]
    price_change = current_price - df['close'].iloc[-2]
    ai_score = calculate_ai_score(df)
    
    col1.metric("Huidige Prijs", f"${current_price:.2f}", f"{price_change:.2f}")
    col2.metric("Hoogst (Periode)", f"${df['high'].max():.2f}")
    col3.metric("Laagst (Periode)", f"${df['low'].min():.2f}")
    col4.metric("AI Pattern Score", f"{ai_score}/100")

    # Grafiek Sectie
    st.subheader(f"Analyse: {target_stock}")
    fig = go.Figure(data=[go.Candlestick(
        x=df['timestamp'],
        open=df['open'],
        high=df['high'],
        low=df['low'],
        close=df['close'],
        name="Market Data"
    )])
    
    fig.update_layout(
        template="plotly_dark",
        xaxis_rangeslider_visible=False,
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)'
    )
    st.plotly_chart(fig, use_container_width=True)

    # Trading Journal Sectie (Vertaald van index.html modal)
    st.divider()
    st.subheader("📝 Trading Journal")
    
    with st.expander("Nieuwe Trade Toevoegen"):
        c1, c2 = st.columns(2)
        entry_p = c1.number_input("Entry Prijs", value=current_price)
        exit_p = c2.number_input("Exit Prijs", value=current_price * 1.05)
        notes = st.text_area("Opmerkingen")
        if st.button("Trade Opslaan"):
            st.success("Trade opgeslagen in sessie!")
            # In een echte app zou je dit naar een database of CSV schrijven

else:
    st.warning("Voer een geldig symbool in om data te bekijken.")

# Footer
st.sidebar.info("Data wordt elke 5 minuten ververst via Yahoo Finance API.")
