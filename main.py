import streamlit as st
import requests
import pandas as pd
import plotly.graph_objects as go
import numpy as np

# --- CONFIGURATIE ---
st.set_page_config(page_title="USA AI SwingTrading Dashboard", layout="wide")

# --- AI LOGICA FUNCTIES ---

def calculate_rsi(series, period=14):
    """Berekent de RSI indicator"""
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def get_ai_analysis(df):
    """Geavanceerde AI Patroon Analyse"""
    if df is None or len(df) < 20:
        return 50, "Onvoldoende data voor analyse"

    current_price = df['close'].iloc[-1]
    sma_20 = df['close'].rolling(window=20).mean().iloc[-1]
    rsi = calculate_rsi(df['close']).iloc[-1]
    
    score = 50
    reasons = []

    # Trend Analyse
    if current_price > sma_20:
        score += 15
        reasons.append("Boven 20-daags gemiddelde (Bullish)")
    else:
        score -= 10
        reasons.append("Onder 20-daags gemiddelde (Bearish)")

    # RSI Analyse (Overbought/Oversold)
    if rsi < 30:
        score += 20
        reasons.append("RSI is Oversold (Koopkans)")
    elif rsi > 70:
        score -= 15
        reasons.append("RSI is Overbought (Pas op)")
    else:
        score += 5
        reasons.append("RSI is neutraal")

    # Volume Check
    avg_vol = df['volume'].mean()
    if df['volume'].iloc[-1] > avg_vol:
        score += 10
        reasons.append("Hoog volume gedetecteerd")

    final_score = max(0, min(100, score))
    return final_score, reasons

# --- DATA OPHALEN ---

def get_stock_data(symbol, period='1mo', interval='1d'):
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
        }).dropna()
        return df
    except:
        return None

# --- UI LAYOUT ---

st.title("🤖 USA AI SwingTrading Dashboard")

symbol = st.sidebar.text_input("Aandeel Symbool", value="NVDA").upper()
df = get_stock_data(symbol)

if df is not None:
    ai_score, reasons = get_ai_analysis(df)
    
    col1, col2 = st.columns([1, 2])

    with col1:
        st.subheader("AI Patroon Score")
        # Score Meter
        fig_gauge = go.Figure(go.Indicator(
            mode = "gauge+number",
            value = ai_score,
            domain = {'x': [0, 1], 'y': [0, 1]},
            title = {'text': "Confidence Score"},
            gauge = {
                'axis': {'range': [0, 100]},
                'bar': {'color': "#2563eb"},
                'steps': [
                    {'range': [0, 40], 'color': "#ef4444"},
                    {'range': [40, 70], 'color': "#f59e0b"},
                    {'range': [70, 100], 'color': "#10b981"}
                ],
            }
        ))
        fig_gauge.update_layout(height=300, margin=dict(l=20, r=20, t=50, b=20))
        st.plotly_chart(fig_gauge, use_container_width=True)
        
        st.write("**Analyse details:**")
        for r in reasons:
            st.write(f"- {r}")

    with col2:
        st.subheader(f"Koers Grafiek {symbol}")
        fig = go.Figure(data=[go.Candlestick(
            x=df['timestamp'], open=df['open'], high=df['high'],
            low=df['low'], close=df['close']
        )])
        fig.update_layout(template="plotly_dark", height=450)
        st.plotly_chart(fig, use_container_width=True)

else:
    st.error("Kon geen data vinden voor dit symbool. Controleer of het klopt (bijv. AAPL, TSLA, NVDA).")
