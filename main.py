import streamlit as st
import requests
import pandas as pd
import numpy as np
import plotly.graph_objects as go

# --- CONFIGURATION ---
st.set_page_config(page_title="USA AI SwingTrading Dashboard", layout="wide")

# Custom CSS for a professional dark look
st.markdown("""
    <style>
    .main { background-color: #0f172a; color: #f8fafc; }
    .stMetric { background-color: #1e293b; border: 1px solid #334155; padding: 15px; border-radius: 10px; }
    </style>
    """, unsafe_allow_html=True)

# --- AI MODELS LOGIC (Scale 1-10) ---

def get_model_scores(df, timeframe):
    if df is None or len(df) < 20:
        return 5.0, 5.0, 5.0

    close = df['close']
    last_close = close.iloc[-1]
    
    # 1. Pattern Analysis (0-10)
    ma_20 = close.rolling(window=20).mean().iloc[-1]
    pattern_score = 5.0
    if last_close > ma_20: pattern_score += 1.5
    if last_close > close.iloc[-5]: pattern_score += 1.0
    
    # 2. ENSEMBLE AI MODEL (0-10)
    # Based on trend confirmation (EMA crossover)
    ema_8 = close.ewm(span=8).mean().iloc[-1]
    ema_21 = close.ewm(span=21).mean().iloc[-1]
    
    if ema_8 > ema_21:
        ensemble_score = 7.9 if timeframe == "1D" else 7.2
    else:
        ensemble_score = 3.2 if timeframe == "1D" else 4.1
    
    # 3. LSTM NEURAL NET (0-10)
    # Predictive momentum simulation
    momentum = (close.iloc[-1] - close.iloc[-10]) / close.iloc[-10]
    if momentum > 0:
        lstm_score = 7.7
    else:
        lstm_score = 5.4

    return (
        round(max(0, min(10, pattern_score)), 1),
        round(max(0, min(10, ensemble_score)), 1),
        round(max(0, min(10, lstm_score)), 1)
    )

# --- DATA FETCHING ---

def get_stock_data(symbol, timeframe):
    if timeframe == "1H":
        interval = "1h"
        range_data = "1mo" 
    else:
        interval = "1d"
        range_data = "1y"

    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval={interval}&range={range_data}"
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

def create_gauge(score, title, color):
    fig = go.Figure(go.Indicator(
        mode = "gauge+number",
        value = score,
        domain = {'x': [0, 1], 'y': [0, 1]},
        title = {'text': title, 'font': {'size': 18, 'color': 'white'}},
        gauge = {
            'axis': {'range': [0, 10], 'tickwidth': 1, 'tickcolor': "white"},
            'bar': {'color': color},
            'bgcolor': "rgba(0,0,0,0)",
            'steps': [
                {'range': [0, 4], 'color': "rgba(239, 68, 68, 0.2)"},
                {'range': [7, 10], 'color': "rgba(16, 185, 129, 0.2)"}
            ],
            'threshold': {
                'line': {'color': "white", 'width': 3},
                'thickness': 0.75,
                'value': score
            }
        }
    ))
    fig.update_layout(height=230, margin=dict(l=30, r=30, t=50, b=20), paper_bgcolor='rgba(0,0,0,0)')
    return fig

# --- USER INTERFACE ---

st.sidebar.title("⚙️ Dashboard Settings")
symbol = st.sidebar.text_input("Ticker Symbol", value="NVDA").upper()
timeframe_choice = st.sidebar.radio("Select Timeframe", ["1H", "1D"], index=1)

st.title(f"🚀 AI Trading Analytics: {symbol} ({timeframe_choice})")

df = get_stock_data(symbol, timeframe_choice)

if df is not None:
    p_score, e_score, l_score = get_model_scores(df, timeframe_choice)
    
    # Metrics Row
    col_a, col_b, col_c, col_d = st.columns(4)
    current_p = df['close'].iloc[-1]
    change = current_p - df['close'].iloc[-2]
    
    col_a.metric("Current Price", f"${current_p:,.2f}", f"{change:+.2f}")
    col_b.metric("High (Period)", f"${df['high'].max():,.2f}")
    col_c.metric("Low (Period)", f"${df['low'].min():,.2f}")
    col_d.metric("Volume", f"{df['volume'].iloc[-1]:,.0f}")

    st.divider()

    # AI Gauges Row
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.plotly_chart(create_gauge(p_score, "Pattern Analysis", "#3b82f6"), use_container_width=True)
    with col2:
        st.plotly_chart(create_gauge(e_score, "Ensemble AI Model", "#8b5cf6"), use_container_width=True)
    with col3:
        st.plotly_chart(create_gauge(l_score, "LSTM Neural Net", "#ec4899"), use_container_width=True)

    # Combined Signal Logic
    avg_score = round((p_score + e_score + l_score) / 3, 1)
    if avg_score >= 7.0:
        st.success(f"**STRONG BUY SIGNAL: {avg_score}/10**")
    elif avg_score <= 4.0:
        st.error(f"**SELL / RISK WARNING: {avg_score}/10**")
    else:
        st.warning(f"**NEUTRAL / HOLD: {avg_score}/10**")

    # Main Chart
    st.subheader(f"Market Analysis Chart")
    fig_chart = go.Figure(data=[go.Candlestick(
        x=df['timestamp'], open=df['open'], high=df['high'], low=df['low'], close=df['close']
    )])
    fig_chart.update_layout(template="plotly_dark", height=600, xaxis_rangeslider_visible=False)
    st.plotly_chart(fig_chart, use_container_width=True)

    # Footer
    st.caption(f"Last update: {df['timestamp'].iloc[-1]} | Data provided by Yahoo Finance")

else:
    st.error("Could not retrieve data. Please verify the ticker symbol (e.g., AAPL, TSLA, BTC-USD).")
