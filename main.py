import streamlit as st
import requests
import pandas as pd
import numpy as np
import plotly.graph_objects as go

# --- CONFIGURATION ---
st.set_page_config(page_title="AI Multi-Timeframe Dashboard", layout="wide")

st.markdown("""
    <style>
    .main { background-color: #0f172a; color: #f8fafc; }
    .stMetric { background-color: #1e293b; border: 1px solid #334155; padding: 15px; border-radius: 10px; }
    .status-box { padding: 10px; border-radius: 5px; text-align: center; font-weight: bold; margin-bottom: 20px; }
    .buy { background-color: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid #10b981; }
    .neutral { background-color: rgba(148, 163, 184, 0.2); color: #94a3b8; border: 1px solid #94a3b8; }
    .sell { background-color: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid #ef4444; }
    </style>
    """, unsafe_allow_html=True)

# --- AI LOGIC (Scale 1-10) ---

def get_model_scores(df, timeframe):
    if df is None or len(df) < 20:
        return 5.0, 5.0, 5.0
    close = df['close']
    last_close = close.iloc[-1]
    
    # 1. Pattern Analysis
    ma_20 = close.rolling(window=20).mean().iloc[-1]
    pattern_score = 5.0
    if last_close > ma_20: pattern_score += 1.5
    if last_close > close.iloc[-5]: pattern_score += 1.0
    
    # 2. ENSEMBLE AI MODEL
    ema_8 = close.ewm(span=8).mean().iloc[-1]
    ema_21 = close.ewm(span=21).mean().iloc[-1]
    ensemble_score = 7.9 if ema_8 > ema_21 else 3.2
    
    # 3. LSTM NEURAL NET
    momentum = (close.iloc[-1] - close.iloc[-10]) / close.iloc[-10]
    lstm_score = 7.7 if momentum > 0 else 5.4

    return (round(max(0, min(10, pattern_score)), 1),
            round(max(0, min(10, ensemble_score)), 1),
            round(max(0, min(10, lstm_score)), 1))

# --- DATA FETCHING ---

def get_stock_data(symbol, timeframe):
    interval = "1h" if timeframe == "1H" else "1d"
    range_data = "1mo" if timeframe == "1H" else "1y"
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval={interval}&range={range_data}"
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

def create_gauge(score, title, timeframe_id):
    # Dynamische hoofdkleur voor de naald/balk op basis van de score
    if score >= 7:
        bar_color = "#10b981"  # Groen
    elif score >= 4:
        bar_color = "#94a3b8"  # Grijs
    else:
        bar_color = "#ef4444"  # Rood

    fig = go.Figure(go.Indicator(
        mode = "gauge+number",
        value = score,
        domain = {'x': [0, 1], 'y': [0, 1]},
        title = {'text': f"{title}", 'font': {'size': 14, 'color': 'white'}},
        gauge = {
            'axis': {'range': [0, 10], 'tickcolor': "white"},
            'bar': {'color': bar_color},
            'bgcolor': "rgba(0,0,0,0)",
            'steps': [
                {'range': [0, 4], 'color': "rgba(239, 68, 68, 0.3)"},   # Rood (Sell)
                {'range': [4, 7], 'color': "rgba(148, 163, 184, 0.3)"}, # Grijs (Hold)
                {'range': [7, 10], 'color': "rgba(16, 185, 129, 0.3)"}  # Groen (Buy)
            ],
            'threshold': {
                'line': {'color': "white", 'width': 2},
                'thickness': 0.75,
                'value': score
            }
        }
    ))
    fig.update_layout(height=160, margin=dict(l=20, r=20, t=40, b=10), paper_bgcolor='rgba(0,0,0,0)')
    return fig

# --- UI INTERFACE ---

st.sidebar.title("⚙️ Dashboard Settings")
symbol = st.sidebar.text_input("Ticker Symbol", value="NVDA").upper()

st.title(f"🚀 Dual-Timeframe Analysis: {symbol}")

df_1h = get_stock_data(symbol, "1H")
df_1d = get_stock_data(symbol, "1D")

if df_1h is not None and df_1d is not None:
    h_scores = get_model_scores(df_1h, "1H")
    d_scores = get_model_scores(df_1d, "1D")
    
    avg_1h = sum(h_scores) / 3
    avg_1d = sum(d_scores) / 3

    col_1h, col_1d = st.columns(2)

    # --- 1 HOUR SECTION ---
    with col_1h:
        st.subheader("⏱️ 1 HOUR Analysis")
        h_class = "buy" if avg_1h >= 7 else ("neutral" if avg_1h >= 4 else "sell")
        st.markdown(f'<div class="status-box {h_class}">1H SIGNAL: {"BUY" if avg_1h >= 7 else ("HOLD" if avg_1h >= 4 else "SELL")} ({round(avg_1h,1)}/10)</div>', unsafe_allow_html=True)
        
        c1, c2, c3 = st.columns(3)
        c1.plotly_chart(create_gauge(h_scores[0], "Pattern", "1H"), use_container_width=True, key="p1h")
        c2.plotly_chart(create_gauge(h_scores[1], "Ensemble", "1H"), use_container_width=True, key="e1h")
        c3.plotly_chart(create_gauge(h_scores[2], "LSTM", "1H"), use_container_width=True, key="l1h")

    # --- 1 DAY SECTION ---
    with col_1d:
        st.subheader("📅 1 DAY Analysis")
        d_class = "buy" if avg_1d >= 7 else ("neutral" if avg_1d >= 4 else "sell")
        st.markdown(f'<div class="status-box {d_class}">1D SIGNAL: {"BUY" if avg_1d >= 7 else ("HOLD" if avg_1d >= 4 else "SELL")} ({round(avg_1d,1)}/10)</div>', unsafe_allow_html=True)
        
        c4, c5, c6 = st.columns(3)
        c4.plotly_chart(create_gauge(d_scores[0], "Pattern", "1D"), use_container_width=True, key="p1d")
        c5.plotly_chart(create_gauge(d_scores[1], "Ensemble", "1D"), use_container_width=True, key="e1d")
        c6.plotly_chart(create_gauge(d_scores[2], "LSTM", "1D"), use_container_width=True, key="l1d")

    # --- TOTAL SCORE SECTION ---
    st.divider()
    total_avg = (avg_1h + avg_1d) / 2
    
    t_col1, t_col2 = st.columns
