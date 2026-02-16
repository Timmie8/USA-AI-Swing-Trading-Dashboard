import streamlit as st
import requests
import pandas as pd
import plotly.graph_objects as go
import numpy as np

# --- CONFIGURATIE ---
st.set_page_config(page_title="USA AI SwingTrading Dashboard", layout="wide")

# --- AI MODELLEN LOGICA ---

def calculate_rsi(series, period=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def get_model_scores(df):
    """Berekent drie verschillende AI scores"""
    if df is None or len(df) < 30:
        return 50, 50, 50

    close = df['close']
    last_close = close.iloc[-1]
    
    # 1. Pattern Analysis Score (Technisch)
    rsi = calculate_rsi(close).iloc[-1]
    pattern_score = 50
    if rsi < 30: pattern_score += 25
    if rsi > 70: pattern_score -= 20
    if last_close > close.rolling(20).mean().iloc[-1]: pattern_score += 15
    
    # 2. Ensemble AI Model (Gecombineerde indicatoren)
    # Simuleert een voting classifier tussen trend en momentum
    ema_fast = close.ewm(span=12).mean().iloc[-1]
    ema_slow = close.ewm(span=26).mean().iloc[-1]
    ensemble_score = 70 if ema_fast > ema_slow else 30
    ensemble_score += (np.random.randint(-5, 6)) # Voegt lichte 'AI jitter' toe

    # 3. LSTM Neural Net (Prijsvoorspelling simulatie)
    # Simuleert neurale netwerk voorspelling gebaseerd op volatiliteit en recente helling
    slope = (close.iloc[-1] - close.iloc[-5]) / close.iloc[-5]
    volatility = close.pct_change().std()
    lstm_score = 50 + (slope * 1000) - (volatility * 100)
    
    return (
        max(0, min(100, pattern_score)),
        max(0, min(100, ensemble_score)),
        max(0, min(100, lstm_score))
    )

# --- DATA FUNCTIE ---

def get_stock_data(symbol):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=5m&range=1d"
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        response = requests.get(url, headers=headers)
        data = response.json()
        result = data['chart']['result'][0]
        return pd.DataFrame({
            'timestamp': pd.to_datetime(result['timestamp'], unit='s'),
            'open': result['indicators']['quote'][0]['open'],
            'high': result['indicators']['quote'][0]['high'],
            'low': result['indicators']['quote'][0]['low'],
            'close': result['indicators']['quote'][0]['close']
        }).dropna()
    except:
        return None

def create_gauge(score, title, color):
    """Hulpmiddel om een gauge meter te maken"""
    fig = go.Figure(go.Indicator(
        mode = "gauge+number",
        value = score,
        title = {'text': title, 'font': {'size': 18}},
        gauge = {
            'axis': {'range': [0, 100]},
            'bar': {'color': color},
            'steps': [
                {'range': [0, 40], 'color': "rgba(239, 68, 68, 0.2)"},
                {'range': [70, 100], 'color': "rgba(16, 185, 129, 0.2)"}
            ],
            'threshold': {
                'line': {'color': "white", 'width': 4},
                'thickness': 0.75,
                'value': score
            }
        }
    ))
    fig.update_layout(height=250, margin=dict(l=30, r=30, t=50, b=20), paper_bgcolor='rgba(0,0,0,0)')
    return fig

# --- UI INTERFACE ---

st.title("🚀 Advanced AI Multi-Model Dashboard")

symbol = st.sidebar.text_input("Aandeel Symbool", value="TSLA").upper()
df = get_stock_data(symbol)

if df is not None:
    p_score, e_score, l_score = get_model_scores(df)
    
    # Rij met de drie AI Meters
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.plotly_chart(create_gauge(p_score, "Pattern Analysis", "#3b82f6"), use_container_width=True)
    with col2:
        st.plotly_chart(create_gauge(e_score, "Ensemble AI Model", "#8b5cf6"), use_container_width=True)
    with col3:
        st.plotly_chart(create_gauge(l_score, "LSTM Neural Net", "#ec4899"), use_container_width=True)

    # Gemiddelde Confidence Score
    avg_confidence = (p_score + e_score + l_score) / 3
    st.info(f"**Gecombineerde AI Confidence Score: {avg_confidence:.1f}%**")

    # Hoofdgrafiek
    st.subheader(f"Marktanalyse: {symbol}")
    fig_chart = go.Figure(data=[go.Candlestick(
        x=df['timestamp'], open=df['open'], high=df['high'], low=df['low'], close=df['close']
    )])
    fig_chart.update_layout(template="plotly_dark", height=500)
    st.plotly_chart(fig_chart, use_container_width=True)

else:
    st.error("Data kon niet worden opgehaald. Controleer het symbool.")
